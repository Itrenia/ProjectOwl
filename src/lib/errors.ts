/**
 * AppError — base error class for the application.
 * Carries structured info for API responses.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 500,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * LLMError — the LLM provider returned an error or gave a bad response.
 */
export class LLMError extends AppError {
  constructor(message: string, retryable: boolean = false) {
    super(message, "LLM_FAILED", 502, retryable);
    this.name = "LLMError";
  }
}

/** Temporary provider overload, distinct from scan failures and user rate limits. */
export class LLMUnavailableError extends AppError {
  constructor(message: string) {
    super(message, "LLM_UNAVAILABLE", 503, true);
    this.name = "LLMUnavailableError";
  }
}

/**
 * RateLimitError — the provider's per-minute rate limit is exhausted and our
 * retry budget ran out waiting for it to clear.
 *
 * Distinct from LLMError so the client can tell "wait a minute and it will
 * work" apart from "your connection is broken" — telling someone to check
 * their network when the real problem is our quota sends them to fix the
 * wrong thing. 429 rather than 502 for the same reason: the status alone is
 * enough for the caller to branch on.
 *
 * The message must not match the rate-limit/quota patterns in MAPPED_ERRORS,
 * or mapErrorMessage() will rewrite it back into the generic wording.
 */
export class RateLimitError extends AppError {
  constructor(message: string) {
    super(message, "LLM_RATE_LIMITED", 429, false);
    this.name = "RateLimitError";
  }
}

/**
 * ValidationError — the LLM response did not match the expected schema.
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_FAILED", 502, false);
    this.name = "ValidationError";
  }
}

/**
 * ImageError — the uploaded file is missing, too large, or the wrong type.
 */
export class ImageError extends AppError {
  constructor(message: string, code: string, httpStatus: number) {
    super(message, code, httpStatus, false);
    this.name = "ImageError";
  }
}
