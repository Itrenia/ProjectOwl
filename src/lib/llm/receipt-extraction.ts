/**
 * What every receipt-extraction provider shares: the prompt, the bounded
 * retry-with-fallback policy, and validation of the model's JSON.
 *
 * A provider client only has to know how to make one HTTP call to one model.
 */
import {
  ReceiptExtractionResultSchema,
  type ReceiptExtractionResult,
} from "@/lib/schemas/receipt";
import { isRateLimitError, withRetry } from "@/lib/retry";
import { LLMError, LLMUnavailableError, RateLimitError, ValidationError } from "@/lib/errors";
import { ERROR_MESSAGES } from "@/lib/constants";
import { z } from "zod";

/**
 * Wall-clock ceiling for the retry sequence.
 *
 * Sized to fit inside the extract route's `maxDuration = 60`, leaving headroom
 * for reading the upload, base64-encoding it, and the final call. The two
 * numbers are coupled: raising one without the other reintroduces the mismatch
 * where the function is killed mid-retry and the real error is lost.
 */
const RETRY_BUDGET_MS = 40_000;

/**
 * Ceiling for a single provider call, headers and body included.
 *
 * Providers sometimes accept a request and never answer. Without this the call
 * never throws, so the retry policy never runs and the function sits until the
 * platform kills it. A healthy scan returns in 3–7s; three attempts at this
 * ceiling plus backoff (~48s) still fit inside `maxDuration = 60`.
 */
export const ATTEMPT_TIMEOUT_MS = 15_000;

/**
 * Prompt copied from the Python notebook's RECEIPT_PROMPT.
 *
 * Design philosophy: transcription-only — no calculation, no inference of
 * values not printed on the receipt. Business logic stays in the backend.
 */
export const RECEIPT_PROMPT = `
You are transcribing a photo of a receipt. Extract exactly what is printed - do not
calculate, infer, or estimate any value that is not directly shown on the receipt.

Rules:
- nm = item name, exactly as printed (keep original language, do not translate).
- cnt = quantity. If not explicit, use 1.
- price = the line's total price as printed (not unit price, not your own calculation).
- subtotal_price, tax_price, service_price, discount_price, total_price are separate
  fields - do not fold them into item prices.
- If a field is not present on the receipt, omit it or return 0 - do not estimate or
  back-calculate a value that isn't printed.
- Do not invent items or amounts that aren't visibly on the receipt.
`;

/**
 * Run `callModel` under the shared retry policy.
 *
 * Each attempt goes to the next model in `models`, wrapping around: when a
 * model is overloaded or hanging, asking it again a second later gets the same
 * answer. `callModel` must pass `AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)` to
 * its fetch; a call that outlives it is reported as provider overload.
 *
 * Exhausting the budget on a rate limit is reported as RateLimitError rather
 * than LLMError, so callers can tell "wait a minute" from "scanning is busy".
 */
export async function callWithFallback(
  provider: string,
  models: string[],
  callModel: (model: string) => Promise<string>
): Promise<string> {
  let attempt = 0;
  const callNextModel = async () => {
    const model = models[attempt++ % models.length];
    try {
      return await callModel(model);
    } catch (err) {
      if ((err as Error)?.name === "TimeoutError") {
        throw new LLMUnavailableError(
          `${provider} API timed out after ${ATTEMPT_TIMEOUT_MS}ms [${model}]`
        );
      }
      throw err;
    }
  };

  try {
    return await withRetry(callNextModel, {
      maxRetries: 2,
      baseDelayMs: 1000,
      budgetMs: RETRY_BUDGET_MS,
    });
  } catch (err) {
    if (isRateLimitError(err)) throw new RateLimitError(ERROR_MESSAGES.LLM_BUSY);
    throw err;
  }
}

/**
 * Parse and validate a model's JSON reply.
 *
 * Kept outside the retry wrapper: a reply that doesn't parse won't parse on a
 * second identical request either.
 */
export function parseReceiptJson(provider: string, raw: string): ReceiptExtractionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LLMError(
      `${provider} response was not valid JSON: ${raw.slice(0, 200)}`,
      false
    );
  }

  try {
    return ReceiptExtractionResultSchema.parse(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new ValidationError(
        `Receipt extraction failed schema validation: ${err.message}`
      );
    }
    throw new ValidationError("Receipt extraction returned unexpected data");
  }
}
