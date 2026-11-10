/**
 * Client-side entry point for a receipt scan.
 *
 * Owns everything between "user picked a photo" and "we have receipt data or a
 * message to show": downscaling, the request, the deadline, and turning every
 * failure into something a person can act on. Both scan callers go through
 * here so they can't drift apart on any of it.
 *
 * The failures are deliberately distinguished. Previously anything that wasn't
 * a clean JSON error surfaced as "Couldn't reach the server", which sent
 * people to check their wifi when the actual problem was our per-minute
 * quota — or a request that was still running.
 */
import { downscaleImage, MAX_UPLOAD_BYTES } from "@/lib/image";
import type { ReceiptExtractionResult } from "@/lib/schemas/receipt";

/**
 * Hard ceiling on a scan from the user's side.
 *
 * Comfortably above the route's `maxDuration = 60` so a server that answers at
 * all still wins the race — this exists to end the spinner when nothing is
 * coming back (a dropped connection, a proxy holding the socket open), not to
 * cut a working scan short. Without it there is no timeout anywhere in the
 * path and the loader can stay up indefinitely.
 */
export const SCAN_TIMEOUT_MS = 120_000;

export interface ScanFailure {
  title: string;
  message: string;
  /** True when simply trying again shortly is the right advice. */
  retryable: boolean;
}

export type ScanOutcome =
  | { ok: true; data: ReceiptExtractionResult }
  | { ok: false; failure: ScanFailure };

const fail = (title: string, message: string, retryable = true): ScanOutcome => ({
  ok: false,
  failure: { title, message, retryable },
});

/** Read a JSON body without throwing on an HTML error page (504s serve one). */
async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function scanReceipt(file: File): Promise<ScanOutcome> {
  const upload = await downscaleImage(file);

  // Only reachable when downscaling bailed (an undecodable HEIC, say) — catch
  // it here so the user gets a real explanation instead of the platform's
  // opaque 413.
  if (upload.size > MAX_UPLOAD_BYTES) {
    return fail(
      "That photo is too large",
      "Try taking the photo again at a lower resolution, or pick a smaller image.",
      false
    );
  }

  const formData = new FormData();
  formData.append("file", upload);

  let res: Response;
  try {
    res = await fetch("/api/receipts/extract", {
      method: "POST",
      body: formData,
      signal:
        typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(SCAN_TIMEOUT_MS)
          : undefined,
    });
  } catch (err) {
    if ((err as Error)?.name === "TimeoutError") {
      return fail(
        "That took too long",
        "The scan didn't finish in time. Try again, or enter the expense manually."
      );
    }
    return fail(
      "Couldn't reach the server",
      "Check your connection and try again."
    );
  }

  const json = await readJson(res);
  const serverMessage = typeof json?.error === "string" ? json.error : null;

  // The one failure that clears on its own, so it gets its own advice.
  if (res.status === 429 || json?.code === "LLM_RATE_LIMITED") {
    return fail(
      "Too many scans right now",
      serverMessage ?? "Wait about a minute, then try again."
    );
  }

  if (res.status === 503 || json?.code === "LLM_UNAVAILABLE") {
    return fail(
      "Scanner is busy right now",
      serverMessage ?? "Try again shortly, or enter the expense manually."
    );
  }

  if (!res.ok || !json) {
    return fail(
      "Couldn't read that receipt",
      serverMessage ??
        "Something went wrong on our side. Try again, or enter the expense manually."
    );
  }

  if (!json.success) {
    return fail(
      "Couldn't read that receipt",
      serverMessage ?? "Try a straighter photo with the whole receipt in frame."
    );
  }

  return { ok: true, data: json.data as ReceiptExtractionResult };
}
