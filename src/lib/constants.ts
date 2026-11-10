import { AppError } from "@/lib/errors";

/**
 * Centralized error codes, messages, and error-pattern mappings for the app.
 *
 * - CODES / ERROR_MESSAGES: structured error responses for API routes.
 * - MAPPED_ERRORS + mapErrorMessage(): catch-all conversion of raw backend/SQLite
 *   errors into user-friendly messages so users never see "NOT NULL constraint failed".
 * - VALIDATION: frontend-side validation strings.
 *
 * Usage:
 *   import { mapErrorMessage, apiError, CODES } from "@/lib/constants";
 *   catch (err) { return apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR); }
 */

// ── API Error Codes ─────────────────────────────────────────────────
export const CODES = {
  // Generic
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
  MISSING_FIELDS: "MISSING_FIELDS",
  MISSING_ID: "MISSING_ID",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_AMOUNT: "INVALID_AMOUNT",

  // Users
  MISSING_USER_ID: "MISSING_USER_ID",
  MISSING_NAME_EMAIL: "MISSING_NAME_EMAIL",

  // File upload
  INVALID_REQUEST: "INVALID_REQUEST",
  MISSING_FILE: "MISSING_FILE",
  INVALID_IMAGE_TYPE: "INVALID_IMAGE_TYPE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  EMPTY_FILE: "EMPTY_FILE",

  // Transactions
  NO_PARTICIPANTS: "NO_PARTICIPANTS",
  SPLIT_MISMATCH: "SPLIT_MISMATCH",
  INVALID_PAYMENT: "INVALID_PAYMENT",

  // Groups
  MISSING_GROUP: "MISSING_GROUP",
  GROUP_NOT_FOUND: "GROUP_NOT_FOUND",
  NOT_GROUP_MEMBER: "NOT_GROUP_MEMBER",
  EMAIL_NOT_FOUND: "EMAIL_NOT_FOUND",
  ALREADY_MEMBER: "ALREADY_MEMBER",
  INVITE_INVALID: "INVITE_INVALID",

  // Settlements
  MISSING_SETTLEMENT_ID: "MISSING_SETTLEMENT_ID",

  // LLM
  LLM_FAILED: "LLM_FAILED",
  LLM_UNAVAILABLE: "LLM_UNAVAILABLE",
  LLM_INVALID_RESPONSE: "LLM_INVALID_RESPONSE",
  LLM_RATE_LIMITED: "LLM_RATE_LIMITED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
} as const;

// ── User-Facing Error Messages ──────────────────────────────────────
export const ERROR_MESSAGES = {
  // Generic / fallback
  UNKNOWN: "An unexpected error occurred",
  FAILED_TO_SAVE: "Failed to save. Please try again.",
  FAILED_TO_CONNECT: "Failed to connect to the server. Is it running?",
  NOT_SIGNED_IN: "Not signed in",
  FORBIDDEN: "You don't have access to this resource",
  INVALID_AMOUNT: "Amounts must be valid non-negative numbers",

  // Users
  USER_NOT_FOUND: "User not found",
  USER_ID_REQUIRED: "userId is required",
  NAME_EMAIL_REQUIRED: "Name and email are required",
  SESSION_REQUIRED: "Please select a user from the home page first",

  // File upload
  INVALID_REQUEST_BODY: "Request must be multipart/form-data",
  MISSING_FILE_UPLOAD: "No file uploaded — provide a receipt image as the 'file' field",
  INVALID_IMAGE_TYPE: (type: string) =>
    `Unsupported file type: ${type}. Accepted: JPEG, PNG, WebP, HEIC`,
  FILE_TOO_LARGE: (size: string) =>
    `File too large (${size}). Max: 4.5 MB`,
  EMPTY_FILE_UPLOAD: "Uploaded file is empty",

  // Transactions
  TX_MISSING_FIELDS: "Missing required fields: title, totalAmount, paidByUserId, transactionDate",
  TX_NO_PARTICIPANTS: "Transaction must have at least one participant",
  TX_NOT_FOUND: "Transaction not found",
  TX_ID_REQUIRED: "Transaction id is required",
  TX_SPLIT_MISMATCH: (assigned: string, price: string) =>
    `Split amounts ($${assigned}) don't equal total ($${price})`,
  PAYMENT_ONE_RECIPIENT: "A payment must have exactly one recipient",
  PAYMENT_SELF: "You can't make a payment to yourself",

  // Groups
  GROUP_REQUIRED: "A group is required — transactions happen within a group",
  GROUP_NOT_FOUND: "Group not found",
  GROUP_NAME_REQUIRED: "Group name is required",
  NOT_GROUP_MEMBER: "Everyone involved must be a member of the group",
  EMAIL_NOT_FOUND: "No account with that email yet — share the group invite link instead",
  ALREADY_MEMBER: "That person is already in this group",
  INVITE_INVALID: "This invite link is invalid or has expired",

  // Settlements
  SETTLEMENT_ID_REQUIRED: "settlementId is required",
  SETTLEMENT_NOT_FOUND: "Settlement not found",

  // LLM
  LLM_GENERIC: (status: number, detail: string) =>
    `Gemini API returned ${status}: ${detail}`,
  // User-facing: says nothing about which provider or whose billing.
  LLM_QUOTA: "Receipt scanning is unavailable right now. Please try again later.",
  /**
   * Per-minute rate limit, which genuinely does clear on its own — so unlike
   * LLM_QUOTA this gives a concrete thing to do and a time to do it at.
   * Deliberately avoids the words "rate limit" and "quota": MAPPED_ERRORS
   * matches those and would rewrite this back to the generic wording.
   */
  LLM_BUSY: "Too many scans in the last minute. Wait about a minute, then try again.",
  LLM_NO_CONTENT: (reason: string) =>
    `Gemini returned no content (${reason}). The image may have been blocked by safety filters.`,
  LLM_INVALID_JSON: (preview: string) =>
    `Gemini response was not valid JSON: ${preview}`,
} as const;

// ── Error Pattern Mappings ──────────────────────────────────────────
// Maps raw backend / SQLite error messages to user-friendly strings.
// Used by mapErrorMessage() as a catch-all for errors that slip past
// explicit validation in API routes.
export const MAPPED_ERRORS: { pattern: RegExp; message: string }[] = [
  // Transaction NOT NULL violations (DB-level safety net for
  // anything the frontend+API validation misses)
  { pattern: /NOT NULL constraint failed:\s+transactions\.title/i,
    message: "Transaction description is required." },
  { pattern: /NOT NULL constraint failed:\s+transactions\.paidByUserId/i,
    message: "A payer must be selected." },
  { pattern: /NOT NULL constraint failed:\s+transactions\.totalAmount/i,
    message: "A total amount is required." },
  { pattern: /NOT NULL constraint failed:\s+transactions\.transactionDate/i,
    message: "A transaction date is required." },
  { pattern: /NOT NULL constraint failed:\s+users\.name/i,
    message: "User name is required." },
  { pattern: /NOT NULL constraint failed:\s+users\.email/i,
    message: "User email is required." },
  { pattern: /NOT NULL constraint failed:\s+settlements\.fromUserId/i,
    message: "The payer for this settlement is missing." },
  { pattern: /NOT NULL constraint failed:\s+settlements\.toUserId/i,
    message: "The recipient for this settlement is missing." },
  { pattern: /NOT NULL constraint failed:\s+settlements\.amount/i,
    message: "A settlement amount is required." },

  // Foreign key violations
  { pattern: /FOREIGN KEY constraint failed/i,
    message: "Invalid user reference — the selected user may not exist." },
  { pattern: /violates foreign key constraint/i,
    message: "Invalid user reference — the selected user may not exist." },

  // Unique constraint
  { pattern: /UNIQUE constraint failed/i,
    message: "A duplicate entry was found. Please use different values." },

  // Postgres — the app's actual database. Its errors quote schema, table and
  // column names ("relation \"transactions\" does not exist"), which is a map
  // of the schema for anyone reading an error toast. The SQLite patterns
  // below are kept because the in-memory PGlite test suites and older
  // fixtures still surface that wording.
  { pattern: /relation ".*" does not exist|schema ".*" does not exist/i,
    message: "Database is missing required tables. Try resetting the database." },
  { pattern: /duplicate key value violates unique constraint/i,
    message: "A duplicate entry was found. Please use different values." },
  { pattern: /violates not-null constraint/i,
    message: "A required field is missing." },
  { pattern: /violates check constraint/i,
    message: "That value isn't allowed. Please check the amounts and try again." },
  { pattern: /column ".*" does not exist|syntax error at or near|invalid input syntax/i,
    message: "A database error occurred. Please try again." },
  { pattern: /ECONNREFUSED|connection terminated|too many clients/i,
    message: "Database connection failed. Please try again." },

  // Generic database errors (SQLite-era wording)
  { pattern: /cannot open database/i,
    message: "Database connection failed. Please try again." },
  { pattern: /no such table/i,
    message: "Database is missing required tables. Try resetting the database." },
  { pattern: /SQLITE_ERROR/i,
    message: "A database error occurred. Please try again." },
  { pattern: /database disk image is malformed/i,
    message: "The database file is corrupted. Try resetting from the debug page." },

  // Network / fetch errors
  { pattern: /fetch failed/i,
    message: "Failed to connect to the server. Is it running?" },
  { pattern: /networkerror/i,
    message: "A network error occurred. Check your connection and try again." },
  { pattern: /aborted/i,
    message: "The request was cancelled. Please try again." },
  { pattern: /json.*parse/i,
    message: "Received an unexpected response from the server." },

  // LLM / Gemini errors — never expose provider details to the user
  //
  // Rate limiting and quota exhaustion come first, because they're the one
  // case where "please try again" is actively wrong — an exhausted daily
  // quota won't recover on a retry. The wording names neither the provider
  // nor our billing state: which vendor we use and whether we've paid them
  // is not the user's problem, and "check your plan and billing details"
  // read as though it were theirs.
  //
  // Matches "returned 429" rather than a bare 429 so it can't fire on a
  // money amount like "$429.00" in an unrelated error.
  { pattern: /returned 429|RESOURCE_EXHAUSTED|rate.?limit|quota/i,
    message: "Receipt scanning is unavailable right now. Enter the expense manually, or try scanning again later." },
  { pattern: /Gemini API returned/i,
    message: "Failed to scan receipt. Please try again." },
  { pattern: /Gemini returned no text|finishReason|blocked|safety filter/i,
    message: "Receipt scan returned no data. The image may be invalid or blurry." },
  { pattern: /GEMINI_API_KEY is not set/i,
    message: "Scan is unavailable. The API key has not been configured." },
  { pattern: /LLM_FAILED/i,
    message: "Failed to scan receipt. Please try again." },
  { pattern: /VALIDATION_FAILED|schema validation/i,
    message: "Receipt data could not be interpreted. Please try a clearer image." },
  { pattern: /LLM_INVALID_RESPONSE|was not valid JSON/i,
    message: "Received an unexpected response from the scan service. Please try again." },
  { pattern: /quota|exceeded/i,
    message: "Scan is temporarily unavailable. Please try again later." },
];

/**
 * Map a raw caught error (DB, network, or Error instance) to a user-friendly
 * message. Falls back to a generic message when no pattern matches.
 *
 * Use this in every API route's catch block so users never see raw SQL or
 * internal error text.
 */
export function mapErrorMessage(err: unknown): string {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : String(err);

  // Check known error patterns FIRST — catches LLM errors, SQLite errors,
  // network errors, etc., even when they come through an AppError wrapper.
  for (const mapping of MAPPED_ERRORS) {
    if (mapping.pattern.test(message)) return mapping.message;
  }

  // AppError with no pattern match — return as-is.
  // These are intentionally user-friendly messages like "Transaction not found".
  if (err instanceof AppError) return err.message;

  return ERROR_MESSAGES.UNKNOWN;
}

// ── Frontend Validation Messages ────────────────────────────────────
export const VALIDATION = {
  SPLIT_NOT_BALANCED: (remaining: number) =>
    remaining > 0
      ? `Remaining to allocate: $${remaining.toFixed(2)}`
      : `Over-allocated by: $${Math.abs(remaining).toFixed(2)}`,

  NO_PARTICIPANTS: "Select at least one participant",
  NO_ITEMS: "Add at least one item to the transaction",
  EMPTY_TITLE: "Enter a description for the transaction",
  INVALID_AMOUNT: "Enter a valid total amount greater than $0",
} as const;

// ── API Response Helper ─────────────────────────────────────────────
export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
}

/** Build a standardized error response object. */
export function apiError(message: string, code: string): ApiErrorResponse {
  return { success: false, error: message, code };
}

/**
 * True when `n` is a real, finite, non-negative amount of money — meaning a
 * whole number of cents.
 *
 * Guards money fields (totals, shares, prices, settlement amounts) coming off
 * untrusted JSON: rejects negatives, `NaN`, and `Infinity` — any of which would
 * otherwise be written straight into the ledger and corrupt computed balances
 * (e.g. a negative-share transaction that still passes the split-sum check).
 *
 * The cent requirement closes a subtler hole. Reconciliation between what
 * people paid and what they owe is enforced to within half a cent, which is
 * airtight only while every amount is a multiple of $0.01 — a gap that must be
 * under half a cent and is a whole number of cents can only be zero.
 * Fractional-cent values slide under that tolerance while still summing wrong,
 * and the residue accumulates across transactions into balances that can never
 * settle. The UI only ever emits cent values; this stops a hand-crafted request
 * from doing otherwise.
 */
export function isNonNegativeMoney(n: unknown): n is number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return false;
  // Tolerant of float representation noise (0.1 + 0.2), strict about anything
  // genuinely finer than a cent.
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}
