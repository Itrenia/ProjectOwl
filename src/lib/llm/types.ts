import type { ReceiptExtractionResult } from "@/lib/schemas/receipt";

/**
 * Input to any LLM receipt extraction client.
 */
export interface ReceiptExtractionInput {
  /** Raw image bytes (server-side buffer, already validated). */
  imageBuffer: Buffer;
  /** MIME type of the image, e.g. "image/jpeg" or "image/png". */
  mimeType: string;
}

/**
 * Interface that all LLM providers must implement.
 *
 * Adding a new provider:
 * 1. Create `lib/llm/<provider>-client.ts` implementing this interface.
 * 2. Add a case to the factory function in `lib/llm/index.ts`.
 * 3. No other code changes needed.
 */
export interface LLMClient {
  /** Extract structured receipt data from an image. */
  extractReceipt(input: ReceiptExtractionInput): Promise<ReceiptExtractionResult>;
}

/**
 * Supported LLM providers.
 * Defaults to "openrouter" — set via LLM_PROVIDER env var.
 */
export type LLMProvider = "openrouter" | "gemini" | "openai" | "anthropic";
