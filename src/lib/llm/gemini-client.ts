import type { LLMClient, ReceiptExtractionInput } from "./types";
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
 * for reading the upload, base64-encoding it, and the final Gemini call. The
 * two numbers are coupled: raising one without the other reintroduces the
 * mismatch where the function is killed mid-retry and the real error is lost.
 */
const RETRY_BUDGET_MS = 40_000;
const PRIMARY_MODEL = "gemini-flash-latest";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";

/**
 * Prompt copied from the Python notebook's RECEIPT_PROMPT.
 *
 * Design philosophy: transcription-only — no calculation, no inference of
 * values not printed on the receipt. Business logic stays in the backend.
 */
const RECEIPT_PROMPT = `
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
 * JSON Schema for Gemini's structured output (response_schema).
 *
 * Mirrors the notebook's receipt_schema exactly.
 * Men items: nm (string), cnt (integer, optional), price (number).
 * Totals: subtotal_price, tax_price, service_price, discount_price, total_price.
 */
const RECEIPT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    menu: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nm: { type: "string" },
          cnt: { type: "integer" },
          price: { type: "number" },
        },
        required: ["nm", "price"],
      },
    },
    subtotal_price: { type: "number" },
    tax_price: { type: "number" },
    service_price: { type: "number" },
    discount_price: { type: "number" },
    total_price: { type: "number" },
  },
  required: ["menu", "total_price"],
} as const;

/**
 * Gemini implementation of LLMClient.
 *
 * Uses raw REST API (not the @google/genai SDK) for full control over
 * response_schema and structured output parsing. The SDK's TypeScript types
 * may not fully support responseSchema yet.
 *
 * Endpoint: gemini-flash-latest — a Google-maintained alias for the current
 * recommended flash model, so this doesn't 404 for new API keys/projects
 * when a dated model version (e.g. gemini-2.5-flash) gets retired for them.
 * Pass a specific model name to the constructor to pin a version instead.
 */
export class GeminiClient implements LLMClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = PRIMARY_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async extractReceipt(
    input: ReceiptExtractionInput
  ): Promise<ReceiptExtractionResult> {
    const base64Image = input.imageBuffer.toString("base64");

    const body = {
      contents: [
        {
          parts: [
            { text: RECEIPT_PROMPT },
            {
              inlineData: {
                mimeType: input.mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RECEIPT_RESPONSE_SCHEMA,
      },
    };

    const startedAt = Date.now();
    let raw: string;
    try {
      raw = await this.callWithRetry(this.urlFor(this.model), body, RETRY_BUDGET_MS, 1);
    } catch (err) {
      // A 503 is model capacity, not an image or account problem. Try another
      // stable model while there is still time in this function's retry budget.
      if (!(err instanceof LLMError) || err.providerStatus !== 503 || this.model !== PRIMARY_MODEL) {
        throw err;
      }

      const remainingMs = RETRY_BUDGET_MS - (Date.now() - startedAt);
      if (remainingMs <= 0) throw new LLMUnavailableError();

      try {
        raw = await this.callWithRetry(this.urlFor(FALLBACK_MODEL), body, remainingMs, 1);
      } catch (fallbackErr) {
        if (fallbackErr instanceof LLMError && fallbackErr.providerStatus === 503) {
          throw new LLMUnavailableError();
        }
        throw fallbackErr;
      }
    }

    return this.parseResponse(raw);
  }

  private urlFor(model: string): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
  }

  /**
   * The network call plus its retry policy.
   *
   * Exhausting the budget on a rate limit is reported as RateLimitError rather
   * than LLMError: it's the one failure here that clears on its own, and the
   * caller can only say so if it can tell it apart.
   */
  private async callWithRetry(
    url: string,
    body: unknown,
    budgetMs: number,
    maxRetries: number
  ): Promise<string> {
    try {
      return await withRetry(
        () => this.callOnce(url, body),
        { maxRetries, baseDelayMs: 1000, budgetMs }
      );
    } catch (err) {
      if (isRateLimitError(err)) throw new RateLimitError(ERROR_MESSAGES.LLM_BUSY);
      throw err;
    }
  }

  private async callOnce(url: string, body: unknown): Promise<string> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "unknown");
      const isRetryable =
        res.status === 429 ||
        res.status === 503 ||
        errorText.includes("RESOURCE_EXHAUSTED") ||
        errorText.includes("UNAVAILABLE");

      throw new LLMError(
        `Gemini API returned ${res.status}: ${errorText.slice(0, 300)}`,
        isRetryable,
        res.status
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();

    // Thinking-capable models may put a reasoning part before the final JSON.
    const text = json?.candidates?.[0]?.content?.parts?.find(
      (part: { thought?: boolean; text?: string }) =>
        !part?.thought && typeof part?.text === "string" && part.text.length > 0
    )?.text ?? null;

    if (!text) {
      // Check for blocked content (safety filters)
      const blockReason =
        json?.candidates?.[0]?.finishReason ??
        json?.promptFeedback?.blockReason ??
        "unknown";
      throw new LLMError(
        `Gemini returned no text content (finishReason: ${blockReason})`,
        false
      );
    }

    return text;
  }

  /**
   * Parse and validate the LLM's JSON response.
   * Separated so the retry wrapper only wraps the network call,
   * not the parse/validate step.
   */
  private parseResponse(raw: string): ReceiptExtractionResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new LLMError(
        `Gemini response was not valid JSON: ${raw.slice(0, 200)}`,
        false
      );
    }

    // Validate against our Zod schema
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
}
