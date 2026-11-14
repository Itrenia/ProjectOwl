import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";
import type { ExtractApiResponse } from "@/lib/schemas/receipt";

/**
 * Vercel's ceiling for a Node.js function on Hobby; Pro allows more. The
 * per-attempt timeout and retry budget in lib/llm/receipt-extraction.ts are
 * sized to fit inside this, so raise them together or not at all.
 */
export const maxDuration = 60;

/**
 * 4.5 MB, not 10 MB — that's the request body limit for a serverless function,
 * enforced by the platform before this handler ever runs. The old 10 MB check
 * was unreachable above 4.5 MB and turned an explainable error into an opaque
 * platform 413.
 *
 * `bodySizeLimit: "10mb"` in next.config.ts does not raise this: it applies to
 * Server Actions, and this is a Route Handler.
 *
 * In practice uploads land far below either number — the client downscales
 * before posting (see lib/image.ts).
 */
const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/**
 * POST /api/receipts/extract
 * Accepts a multipart/form-data request with a single "file" field.
 * Returns structured receipt data extracted by the LLM.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ExtractApiResponse | ApiErrorResponse>> {
  try {
    // Each scan costs LLM quota — signed-in users only.
    if (!(await getCurrentUser())) return unauthorized();

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.INVALID_REQUEST_BODY, CODES.INVALID_REQUEST),
        { status: 400 }
      );
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.MISSING_FILE_UPLOAD, CODES.MISSING_FILE),
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.INVALID_IMAGE_TYPE(file.type), CODES.INVALID_IMAGE_TYPE),
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(
          ERROR_MESSAGES.FILE_TOO_LARGE(`${(file.size / 1024 / 1024).toFixed(1)} MB`),
          CODES.FILE_TOO_LARGE
        ),
        { status: 413 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.EMPTY_FILE_UPLOAD, CODES.EMPTY_FILE),
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const client = createLLMClient();
    const result = await client.extractReceipt({
      imageBuffer,
      mimeType: file.type,
    });

    return NextResponse.json({ success: true, data: result } as ExtractApiResponse, { status: 200 });
  } catch (err) {
    // Always log the real thing — quota exhaustion vs. a bad key vs. a
    // safety block are the same message to the user but very different to
    // whoever is on call.
    console.error("Error in /api/receipts/extract:", err);

    // Every message goes through mapErrorMessage, including AppError's.
    // LLMError extends AppError and carries the provider's raw response
    // ("Gemini API returned 429: {...quota...}"), so returning err.message
    // directly leaked Google's error text — and our billing state — straight
    // into the UI. mapErrorMessage rewrites anything recognisably internal
    // and passes genuinely user-facing AppError messages through untouched.
    if (err instanceof AppError) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(mapErrorMessage(err), err.code),
        { status: err.httpStatus }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
