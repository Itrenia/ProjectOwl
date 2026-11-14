import type { LLMClient, LLMProvider } from "./types";
import { GeminiClient } from "./gemini-client";
import { OpenRouterClient } from "./openrouter-client";

/**
 * Factory function — creates the appropriate LLM client based on the
 * LLM_PROVIDER environment variable.
 *
 * To add a new provider:
 * 1. Create `lib/llm/<name>-client.ts` implementing LLMClient.
 * 2. Add a `case` below.
 * 3. Done — no other code changes needed.
 */
export function createLLMClient(provider?: LLMProvider): LLMClient {
  const resolved: LLMProvider =
    provider ??
    (process.env.LLM_PROVIDER as LLMProvider | undefined) ??
    "openrouter";

  switch (resolved) {
    case "openrouter": {
      return new OpenRouterClient(
        requireEnv("OPENROUTER_API_KEY"),
        modelsFromEnv("OPENROUTER_MODELS")
      );
    }
    case "gemini": {
      return new GeminiClient(
        requireEnv("GEMINI_API_KEY"),
        modelsFromEnv("GEMINI_MODELS")
      );
    }
    // Future providers:
    // case "openai": return new OpenAIClient(process.env.OPENAI_API_KEY!);
    // case "anthropic": return new AnthropicClient(process.env.ANTHROPIC_API_KEY!);
    default: {
      // When adding a new provider, add a case above and remove from this error
      const provider: string = resolved;
      throw new Error(
        `Unknown or unsupported LLM provider: "${provider}". ` +
          "Supported: openrouter, gemini. Set LLM_PROVIDER in .env.local"
      );
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `${name} is not set. ` +
        "Add it to .env.local or set it as an environment variable."
    );
  }
  return value;
}

/**
 * A comma-separated model list (OPENROUTER_MODELS, GEMINI_MODELS), tried in
 * order, one per attempt. Unset or blank means the client's defaults — so a
 * bad model can be swapped out from the environment without a code change.
 */
function modelsFromEnv(name: string): string[] | undefined {
  const models = (process.env[name] ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return models.length > 0 ? models : undefined;
}

// Re-export for convenience
export { type LLMClient, type LLMProvider, type ReceiptExtractionInput } from "./types";
