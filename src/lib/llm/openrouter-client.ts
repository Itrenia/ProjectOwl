import type { LLMClient, ReceiptExtractionInput } from "./types";
import type { ReceiptExtractionResult } from "@/lib/schemas/receipt";
import { LLMError, LLMUnavailableError } from "@/lib/errors";
import {
  ATTEMPT_TIMEOUT_MS,
  RECEIPT_PROMPT,
  callWithFallback,
  parseReceiptJson,
} from "./receipt-extraction";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Models tried in order, one per attempt, wrapping around.
 *
 * DeepSeek V4.1 Flash is the primary. The fallback is deliberately a different
 * vendor: V4.1 Flash is the only DeepSeek model that accepts images, and
 * OpenRouter already fails over between its hosts on its own, so a second
 * DeepSeek id would fail for the same reasons as the first.
 * Override with OPENROUTER_MODELS (comma-separated) — see lib/llm/index.ts.
 */
export const DEFAULT_OPENROUTER_MODELS = [
  "deepseek/deepseek-v4.1-flash",
  "google/gemini-3.5-flash-lite",
];

/**
 * The receipt shape as a strict JSON Schema.
 *
 * Strict structured output requires every property to be listed in `required`
 * and `additionalProperties: false`, so unlike Gemini's schema nothing is
 * optional here — a total that isn't printed comes back as 0, which the prompt
 * already asks for and the Zod schema accepts.
 */
const RECEIPT_JSON_SCHEMA = {
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
        required: ["nm", "cnt", "price"],
        additionalProperties: false,
      },
    },
    subtotal_price: { type: "number" },
    tax_price: { type: "number" },
    service_price: { type: "number" },
    discount_price: { type: "number" },
    total_price: { type: "number" },
  },
  required: [
    "menu",
    "subtotal_price",
    "tax_price",
    "service_price",
    "discount_price",
    "total_price",
  ],
  additionalProperties: false,
} as const;

/**
 * Statuses where another model or another moment may well succeed.
 *
 * 400 and 404 are here because on OpenRouter they are usually about the model
 * (an id that was retired, a parameter one model rejects) rather than about
 * our request, and a misconfigured primary shouldn't take scanning down while
 * a working fallback is configured.
 */
const RETRYABLE_STATUSES = new Set([400, 404, 408, 429, 500, 502]);

/** Sent when a model refuses to run with reasoning switched off. */
const REASONING_MANDATORY = /reasoning is mandatory/i;

/** Some hosts wrap JSON in a markdown fence despite response_format. */
function stripCodeFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

/**
 * OpenRouter implementation of LLMClient (OpenAI-compatible chat completions).
 *
 * OpenRouter routes one model id across many hosts and fails over between them
 * before any output is sent; the model list here adds fallback across models
 * on top of that.
 */
export class OpenRouterClient implements LLMClient {
  private apiKey: string;
  private models: string[];

  constructor(apiKey: string, models: string[] = DEFAULT_OPENROUTER_MODELS) {
    if (models.length === 0) throw new Error("OpenRouterClient needs at least one model");
    this.apiKey = apiKey;
    this.models = models;
  }

  async extractReceipt(
    input: ReceiptExtractionInput
  ): Promise<ReceiptExtractionResult> {
    const imageUrl = `data:${input.mimeType};base64,${input.imageBuffer.toString("base64")}`;

    const raw = await callWithFallback("OpenRouter", this.models, (model) =>
      this.request(model, imageUrl)
    );

    return parseReceiptJson("OpenRouter", stripCodeFence(raw));
  }

  /**
   * Transcription needs no reasoning; left on, it only adds latency and output
   * tokens (DeepSeek enables it by default). Some models can't run without it
   * and reject the request outright, so those are asked again on their default.
   */
  private async request(model: string, imageUrl: string): Promise<string> {
    try {
      return await this.send(model, imageUrl, { effort: "none" });
    } catch (err) {
      if (!REASONING_MANDATORY.test(String(err))) throw err;
      return this.send(model, imageUrl, undefined);
    }
  }

  private async send(
    model: string,
    imageUrl: string,
    reasoning: { effort: "none" } | undefined
  ): Promise<string> {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: RECEIPT_PROMPT },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.1,
        reasoning,
        response_format: {
          type: "json_schema",
          json_schema: { name: "receipt", strict: true, schema: RECEIPT_JSON_SCHEMA },
        },
        // Only route to hosts that honour response_format, rather than ones
        // that silently ignore it and return prose.
        provider: { require_parameters: true },
      }),
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json().catch(() => null);

    // OpenRouter answers 200 as soon as a host accepts the request, so a
    // failure after that point arrives in the body, not the status.
    const error = json?.error ?? json?.choices?.[0]?.error;
    if (!res.ok || error) {
      const status = res.ok ? Number(error?.code) || 502 : res.status;
      const detail = String(error?.message ?? "unknown").slice(0, 300);
      const message = `OpenRouter API returned ${status}: ${detail} [${model}]`;
      if (status === 503) throw new LLMUnavailableError(message);
      throw new LLMError(message, RETRYABLE_STATUSES.has(status));
    }

    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim() === "") {
      // A cold or scaling host can return 200 with nothing in it; the next
      // model is worth a try.
      const finishReason = json?.choices?.[0]?.finish_reason ?? "unknown";
      throw new LLMError(
        `OpenRouter returned no text content (finishReason: ${finishReason}) [${model}]`,
        true
      );
    }

    return text;
  }
}
