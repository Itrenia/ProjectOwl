# Error Test Cases

How to trigger every error condition and what the user should see.

## Prerequisites

- Run `npm run dev` for tests against the real backend
- Run `npm run testmode` to enable the 🐛 debug menu for simulated errors
- Reset data with `POST /api/debug?action=reset` or via the debug menu

---

## Validation Errors

### 1. Empty transaction description

| | |
|---|---|
| **How to trigger** | Go to `/transactions/new`, tap into the "Description" field, then tab out without typing anything |
| **API status** | — (frontend only) |
| **User sees** | Inline red text under the field: *"Enter a description"* |
| **Note** | Also shown on save attempt. Save button is disabled until fixed |

### 2. No participants selected

| | |
|---|---|
| **How to trigger** | Go to `/transactions/new`, set description + amount, deselect all participants, tap "Save" |
| **API status** | — (frontend only) |
| **User sees** | Inline red text under the picker: *"Select at least one person"* |
| **Note** | Error appears on save attempt or when interacting with other fields first |

### 3. Split mismatch (custom)

| | |
|---|---|
| **How to trigger** | Go to `/transactions/new`, total = $10.00, add 2 participants, switch to Custom split, set each to $4.00, tap "Save" |
| **API status** | 400 (if frontend validation is bypassed) |
| **User sees** | Inline red text: *"Split amounts ($8.00) don't equal total ($10.00)"* |

### 4. Invalid total amount

| | |
|---|---|
| **How to trigger** | Go to `/transactions/new`, set total = $0.00, tab out of the field |
| **API status** | — (frontend only) |
| **User sees** | Inline red text under the field: *"Enter an amount greater than $0"* |
| **Note** | Also shown on save attempt. Save button is disabled until fixed |

---

## Database / Backend Errors

### 5. Missing required field (backend safety net)

| | |
|---|---|
| **How to trigger** | Send `POST /api/transactions` with an empty JSON body `{}` via curl or the debug menu simulators |
| **API status** | 400 |
| **User sees** | ErrorDialog: *"Missing required fields: title, totalAmount, paidByUserId, transactionDate"* |

### 6. NOT NULL constraint — title

| | |
|---|---|
| **How to trigger** | Send `POST /api/transactions` with `"title": ""` and all other valid fields (empty string bypasses frontend check) |
| **API status** | 500 |
| **User sees** | ErrorDialog: *"Transaction description is required."* |
| **Backend log** | `NOT NULL constraint failed: transactions.title` |

### 7. NOT NULL constraint — payer

| | |
|---|---|
| **How to trigger** | Send `POST /api/transactions` without `paidByUserId` field |
| **API status** | 500 |
| **User sees** | ErrorDialog: *"A payer must be selected."* |
| **Backend log** | `NOT NULL constraint failed: transactions.paidByUserId` |

### 8. NOT NULL constraint — total amount

| | |
|---|---|
| **How to trigger** | Send `POST /api/transactions` without `totalAmount` field |
| **API status** | 500 |
| **User sees** | ErrorDialog: *"A total amount is required."* |

### 9. Foreign key violation (invalid user)

| | |
|---|---|
| **How to trigger** | Send `POST /api/transactions` with `"paidByUserId": "user-nonexistent"` and a valid participant array |
| **API status** | 500 |
| **User sees** | ErrorDialog: *"Invalid user reference — the selected user may not exist."* |
| **Backend log** | `FOREIGN KEY constraint failed` |

---

## Not Found Errors

### 10. Transaction not found (detail page)

| | |
|---|---|
| **How to trigger** | Navigate to `/transactions/tx-nonexistent` |
| **API status** | 404 |
| **User sees** | Center of screen: *"Transaction not found"* + "Try again" button |

### 11. User not found

| | |
|---|---|
| **How to trigger** | Send `GET /api/users?id=user-nonexistent` |
| **API status** | 404 |
| **User sees** | JSON response: *"User not found"* |

### 12. Settlement not found

| | |
|---|---|
| **How to trigger** | Send `POST /api/settlements/mark-paid` with `"settlementId": "nonexistent"` |
| **API status** | 404 |
| **User sees** | JSON response: *"Settlement not found"* |

---

## LLM / Scan Errors

### Temporary provider overload (503)

| | |
|---|---|
| **How to trigger** | Run `npm run test:receipts` to replay persistent Gemini `503 UNAVAILABLE` responses without API calls |
| **API status** | 503, code `LLM_UNAVAILABLE`, after up to two retries with exponential backoff |
| **User sees** | *"Receipt scanning is busy"* — *"Receipt scanning is temporarily busy. Try again shortly, or enter the expense manually."* |
| **Backend log** | `LLMUnavailableError` with the original Gemini status and error detail |
| **Recovery** | Scanning succeeds if Gemini recovers during retries; persistent overload requires trying again later |

### 13. No API key configured

| | |
|---|---|
| **How to trigger** | Remove `GEMINI_API_KEY` from `.env.local`, restart server, go to `/transactions/new`, tap "Scan a receipt", upload an image |
| **API status** | 500 |
| **User sees** | Inline ErrorAlert: *"Scan is unavailable. The API key has not been configured."* |
| **Backend log** | `GEMINI_API_KEY is not set` |
| **Debug trigger** | 🐛 → "LLM scan error (generic)" shows ErrorDialog: *"Failed to scan receipt. Please try again."* |

### 14. Daily quota exceeded

| | |
|---|---|
| **How to trigger** | Make ~50+ scan requests in a day, or use the debug simulator |
| **API status** | 502 (after retries exhausted) |
| **User sees** | Inline ErrorAlert: *"Scan is temporarily unavailable. Please try again later."* |
| **Backend log** | `Gemini API returned 429: Quota exceeded` |
| **Debug trigger** | 🐛 → "LLM scan error (quota)" shows ErrorDialog: *"Scan is temporarily unavailable. Please try again later."* |

### 15. Image blocked by safety filters

| | |
|---|---|
| **How to trigger** | Upload a NSFW or otherwise flagged image |
| **API status** | 502 |
| **User sees** | Inline ErrorAlert: *"Receipt scan returned no data. The image may be invalid or blurry."* |
| **Backend log** | `Gemini returned no text content (finishReason: SAFETY)` |

### 16. Invalid JSON response from LLM

| | |
|---|---|
| **How to trigger** | (Rare — Gemini returns malformed JSON) Or use the debug simulator |
| **API status** | 502 |
| **User sees** | Inline ErrorAlert: *"Received an unexpected response from the scan service. Please try again."* |

### 17. Schema validation failure

| | |
|---|---|
| **How to trigger** | (Rare — LLM response doesn't match Zod schema) |
| **API status** | 502 |
| **User sees** | Inline ErrorAlert: *"Receipt data could not be interpreted. Please try a clearer image."* |

---

## Network Errors

### 18. Server not running (save)

| | |
|---|---|
| **How to trigger** | Stop the dev server, fill out the form on `/transactions/new`, tap "Save" |
| **API status** | — (network error, no response) |
| **User sees** | ErrorDialog: *"Failed to connect to the server. Is it running?"* |
| **Debug trigger** | 🐛 → "Save failed (server error)" |

### 19. Server not running (scan)

| | |
|---|---|
| **How to trigger** | Stop the dev server, tap "Scan a receipt", upload an image |
| **API status** | — (network error) |
| **User sees** | Inline ErrorAlert: *"Failed to connect to the server. Is it running?"* |

### 20. Server not running (page load)

| | |
|---|---|
| **How to trigger** | Stop the dev server, navigate to `/transactions` or `/` |
| **API status** | — (network error) |
| **User sees** | Red inline banner at top: *"Failed to connect to the server"* |

---

## Frontend Validation Errors

### 21. Split not balanced (remaining)

| | |
|---|---|
| **How to trigger** | Go to `/transactions/new`, total = $10.00, 2 participants, Custom split, set each to $3.00 |
| **User sees** | Inline: *"Remaining to allocate: $4.00"* |

### 22. Split not balanced (over-allocated)

| | |
|---|---|
| **How to trigger** | Go to `/transactions/new`, total = $10.00, 2 participants, Custom split, set each to $6.00 |
| **User sees** | Inline: *"Over-allocated by: $2.00"* |

### 23. Amount not greater than $0

| | |
|---|---|
| **How to trigger** | Go to `/transactions/new`, leave total at $0.00, tap into another field then back |
| **User sees** | Inline under total field: *"Enter an amount greater than $0"* |

### 24. Description not entered on save

| | |
|---|---|
| **How to trigger** | Go to `/transactions/new`, leave description blank, tap "Save transaction" |
| **User sees** | Inline under description: *"Enter a description"*, under total: *"Enter an amount greater than $0"*, under participants: *"Select at least one person"* |

---

## Debug Menu 🐛

When running with `npm run testmode` (`NEXT_PUBLIC_DEBUG_UI=true`), a 🐛 button appears at the bottom-left of every page. It offers:

| Section | Actions |
|---|---|
| **Database** | "Delete all transactions", "Full database reset", "Go to full debug page →" |
| **Error simulators** | Page-specific buttons that trigger the ErrorDialog with realistic error messages |

Page-specific simulators:

| Page | Available simulators |
|---|---|
| `/transactions/new` | Save failed (validation), Save failed (server), LLM scan error (generic), LLM scan error (quota) |
| `/transactions` | Load transactions failed |
| `/transactions/[id]` | Delete failed, Mark settled failed, Transaction not found |
| `/friends` | Load friends failed |
| `/settle-up` | Mark paid failed |
| Any other page | *(no simulators)* |
