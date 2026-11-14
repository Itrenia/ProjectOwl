import type { LLMClient, ReceiptExtractionInput } from "./types";
import type { ReceiptExtractionResult } from "@/lib/schemas/receipt";
import { LLMError, LLMUnavailableError } from "@/lib/errors";
import {
  ATTEMPT_TIMEOUT_MS,
  RECEIPT_PROMPT,
  callWithFallback,
  parseReceiptJson,
} from "./receipt-extraction";

/**
 * Models tried in order, one per attempt, wrapping around.
 * Override with GEMINI_MODELS (comma-separated) — see lib/llm/index.ts.
 */
export const DEFAULT_GEMINI_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
];

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
 * Models default to Google-maintained `-latest` aliases, so this doesn't 404
 * for new API keys/projects when a dated model version gets retired for them.
 * Pass specific model names to the constructor to pin versions instead.
 */
export class GeminiClient implements LLMClient {
  private apiKey: string;
  private models: string[];

  constructor(apiKey: string, models: string[] = DEFAULT_GEMINI_MODELS) {
    if (models.length === 0) throw new Error("GeminiClient needs at least one model");
    this.apiKey = apiKey;
    this.models = models;
  }

  async extractReceipt(
    input: ReceiptExtractionInput
  ): Promise<ReceiptExtractionResult> {
    const body = {
      contents: [
        {
          parts: [
            { text: RECEIPT_PROMPT },
            {
              inlineData: {
                mimeType: input.mimeType,
                data: input.imageBuffer.toString("base64"),
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

    const raw = await callWithFallback("Gemini", this.models, (model) =>
      this.request(model, body)
    );

    return parseReceiptJson("Gemini", raw);
  }

  private async request(model: string, body: unknown): Promise<string> {
    // The key travels in a header, not the query string, so it can't end up
    // in request logs or error messages that include the URL.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      }
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => "unknown");
      const message = `Gemini API returned ${res.status}: ${errorText.slice(0, 300)} [${model}]`;
      if (res.status === 503) {
        throw new LLMUnavailableError(message);
      }
      const isRetryable =
        res.status === 429 ||
        errorText.includes("RESOURCE_EXHAUSTED") ||
        errorText.includes("UNAVAILABLE");

      throw new LLMError(message, isRetryable);
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
}
