import assert from "node:assert/strict";
import { mapErrorMessage } from "../src/lib/constants";
import { LLMError, LLMUnavailableError } from "../src/lib/errors";
import { GeminiClient } from "../src/lib/llm/gemini-client";
import { scanReceipt } from "../src/lib/scan-receipt";

const unavailable = () =>
  new Response(
    JSON.stringify({ error: { code: 503, status: "UNAVAILABLE", message: "This model is currently experiencing high demand." } }),
    { status: 503 }
  );

const success = () =>
  Response.json({
    candidates: [{ content: { parts: [
      { thought: true, text: "reasoning" },
      { text: JSON.stringify({ menu: [{ nm: "Coffee", price: 4 }], total_price: 4 }) },
    ] } }],
  });

async function main() {
  const originalFetch = globalThis.fetch;
  const originalAbortTimeout = AbortSignal.timeout;
  const scan = () =>
    new GeminiClient("test-key").extractReceipt({
      imageBuffer: Buffer.from("receipt image"),
      mimeType: "image/jpeg",
    });

  try {
    const calls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      return url.includes("gemini-3.5-flash-lite") ? success() : unavailable();
    };

    const receipt = await scan();
    assert.equal(receipt.total_price, 4);
    assert(calls.some((url) => url.includes("gemini-flash-latest")));
    assert(calls.some((url) => url.includes("gemini-3.5-flash-lite")));
    console.log("PASS: 503 on the primary model recovers through the fallback model");

    const nonTransientCalls: string[] = [];
    globalThis.fetch = async (input) => {
      nonTransientCalls.push(String(input));
      return Response.json({ error: { code: 400, message: "Invalid request" } }, { status: 400 });
    };
    await assert.rejects(scan(), (error) =>
      error instanceof LLMError && error.providerStatus === 400
    );
    assert.equal(nonTransientCalls.length, 1);
    console.log("PASS: invalid requests do not switch models");

    const unavailableCalls: string[] = [];
    globalThis.fetch = async (input) => {
      unavailableCalls.push(String(input));
      return unavailable();
    };
    await assert.rejects(scan(), (error) => {
      assert(error instanceof LLMUnavailableError);
      assert.equal(error.httpStatus, 503);
      assert.equal(error.code, "LLM_UNAVAILABLE");
      assert.equal(mapErrorMessage(error), error.message);
      return true;
    });
    assert(unavailableCalls.some((url) => url.includes("gemini-3.5-flash-lite")));
    console.log("PASS: two unavailable models return a clear temporary error");

    globalThis.fetch = async () =>
      Response.json(
        { success: false, code: "LLM_UNAVAILABLE", error: new LLMUnavailableError().message },
        { status: 503 }
      );
    const outcome = await scanReceipt(new File(["image"], "receipt.jpg", { type: "image/jpeg" }));
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.failure.title, "Scanner is busy right now");
      assert.match(outcome.failure.message, /Try again shortly/);
    }
    console.log("PASS: the scan UI receives a useful temporary-error message");

    globalThis.fetch = async () => new Response("<html>Timed out</html>", { status: 504 });
    const timedOutOutcome = await scanReceipt(new File(["image"], "receipt.jpg", { type: "image/jpeg" }));
    assert.equal(timedOutOutcome.ok, false);
    if (!timedOutOutcome.ok) {
      assert.equal(timedOutOutcome.failure.title, "That took too long");
      assert.match(timedOutOutcome.failure.message, /Try again/);
    }
    console.log("PASS: a Vercel HTML 504 gives scan retry advice");

    // Model a provider request that never responds. The test's shorter clock
    // verifies the real fetch path aborts before the serverless deadline.
    AbortSignal.timeout = () => originalAbortTimeout(25);
    globalThis.fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    await assert.rejects(
      Promise.race([
        scan(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Gemini fetch exceeded its deadline")), 150)
        ),
      ]),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, "LLM_TIMEOUT");
        assert.equal((error as { httpStatus?: number }).httpStatus, 504);
        return true;
      }
    );
    console.log("PASS: a hung Gemini request ends before Vercel's deadline");
  } finally {
    globalThis.fetch = originalFetch;
    AbortSignal.timeout = originalAbortTimeout;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
