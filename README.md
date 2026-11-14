# 🦉 ProjectOwl

Split receipts with friends — without the math.

A Splitwise-like PWA built with **Next.js 15**, **Tailwind v4**, and **PostgreSQL** (via Drizzle ORM).

## Features

| Flow | What you can do |
|---|---|
| **Scan a receipt** | Upload a photo → Gemini extracts items/prices/totals → review → assign to friends → save |
| **Manual entry** | Type description + amount → pick participants → split evenly or custom (% or $) → save |
| **Home dashboard** | Net balance, owe/owed breakdown, top debtor/creditor, recent activity, quick actions |
| **Transaction history** | Filter by who paid + who's involved, tap for full breakdown |
| **Transaction detail** | Itemized list with assignment avatars, per-person totals, paid-by badge, settled status |
| **Friends** | List with individual balances (owes you / you owe / settled) |
| **Settle up** | Personalized "who pays who" view with Mark Paid buttons |

## ✅ Status

**Setup Complete** — All dependencies installed, database configured, and ready to run.

## Quick start

### Prerequisites

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **Google Gemini API key** (free at [aistudio.google.com](https://aistudio.google.com/apikey))
- **PostgreSQL 16** (the setup scripts install/verify it)
  - **macOS**: `brew install postgresql@16 && brew services start postgresql@16`
  - **Linux**: `sudo apt install postgresql-16`
  - **Windows**: `winget install PostgreSQL.PostgreSQL.16` (runs as a Windows service)

### Setup

**macOS / Linux:**
```bash
chmod +x setup.sh
./setup.sh
```

**Windows (PowerShell):**
```powershell
.\setup.ps1
```

The setup script will:
1. Verify Node.js v18+
2. Verify (or install) PostgreSQL 16 and create the `projectowl` database
3. Install npm dependencies
4. Create `.env.local` from `.env.example` (add your `OPENROUTER_API_KEY`, or `GEMINI_API_KEY` with `LLM_PROVIDER=gemini`) and set `DATABASE_URL`
5. Apply database migrations (`npm run db:migrate`) and seed demo data (`npm run db:seed`)
6. Run a build check

### Start

```bash
npm run dev       # normal development server
npm run testmode  # dev server with the debug UI + mock scan enabled
```

Open [http://localhost:3000](http://localhost:3000). On first visit, pick your name from the seeded users.

`npm run testmode` turns on the in-app debug tools — notably the "🐛 Mock scan"
option, which loads canned receipts instead of calling the LLM so you can
exercise item allocation for free. See [Test mode](#test-mode-mock-scan-no-llm-api).

### Reset data

With the dev server running: `POST /api/debug?action=reset` (or the button on `/debug`).
From scratch: `dropdb projectowl && createdb projectowl && npm run db:migrate && npm run db:seed`.

## API Routes

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/receipts/extract` | Upload receipt image → returns structured JSON from Gemini |
| `GET` | `/api/groups?userId=` | List a user's groups (members, your net position, settled flag) |
| `POST` | `/api/groups` | Create a group `{ name, creatorId, memberIds? }` |
| `GET` | `/api/groups/[id]?userId=` | Group detail: member balances, pairwise nets, transfer plan, down-bad ranking |
| `POST` | `/api/groups/[id]/members` | Add members `{ userIds, actorId }` |
| `GET` | `/api/activities?userId=` | Activity feed across all the user's groups |
| `POST` | `/api/transactions` | Create transaction (requires `groupId`; payer + participants must be members) |
| `GET` | `/api/transactions?userId=` | List transactions (filter by `groupId`, `payer`, `payees`) |
| `GET` | `/api/transactions?id=&userId=` | Single transaction with full details |
| `DELETE` | `/api/transactions?id=` | Soft-delete single transaction (kept for ledger history) |
| `DELETE` | `/api/transactions?all=true` | **Delete ALL transactions** |
| `GET` | `/api/balances?userId=` | Balance summary — overall, or one group with `&groupId=` |
| `GET` | `/api/settlements/optimize?groupId=` | **Minimum-transaction** settlement plan within a group (app-wide without `groupId`) |
| `GET` | `/api/users` | List all users |
| `POST` | `/api/users` | Create a new test user |
| `POST` | `/api/settlements/mark-paid` | Mark a settlement as paid |
| `GET` | `/api/debug` | View DB stats (counts, users, transactions) |
| `GET` | `/api/debug/simplify-tests` | Run the debt-simplification test suite (in-memory) |
| `GET` | `/api/debug/allocation-tests` | Run the receipt item-allocation test suite (in-memory) |
| `POST` | `/api/debug?action=reset` | **Full DB reset** — wipes everything and re-seeds |
| `POST` | `/api/debug?action=delete-all-transactions` | **Delete all transactions** (keeps users) |

## Debt simplification

When several people owe each other in overlapping ways, the naive
"everyone-pays-everyone" plan has far more payments than necessary. ProjectOwl
collapses the whole group's debts into the **fewest possible transfers** using a
greedy minimum-cash-flow algorithm (largest debtor pays largest creditor,
repeat) — the same approach used by Splitwise and
[oss-apps/split-pro](https://github.com/oss-apps/split-pro).

The algorithm lives in [`src/lib/simplify.ts`](src/lib/simplify.ts) and is
**pure** — it takes a list of transactions and returns a settlement plan, with
no database or network involved:

- `computeNetBalances(transactions)` → each user's net position (owed vs owes)
- `minimizeTransfers(balances)` → the minimal list of `from → to` payments

The live group plan is served by `GET /api/settlements/optimize`, which reads
the current (non-deleted) transactions and runs the same function.

### Running the tests

The algorithm is covered by 10 scenarios in
[`src/lib/test-data/simplify-fixtures.ts`](src/lib/test-data/simplify-fixtures.ts)
(cycles, chains, star payments, mutual cancellations, dense webs, …). Each
fixture is a plain in-memory list of transactions — **no data is ever written to
the database, so there is nothing to clean up.** Every case is checked against
these invariants: money is conserved, no one pays themselves, all amounts are
positive, and the plan uses at most `n-1` payments (plus an exact expected count
where known).

**From the command line:**
```bash
npm run test:simplify
```
Prints a per-case report and exits non-zero if anything fails.

**From the browser:** open `/debug` and click **Run tests** under
"🧮 Debt-simplification tests" — the same suite runs via
`GET /api/debug/simplify-tests` and renders each scenario's net balances and
resulting plan.

## Receipt item allocation

After a receipt is scanned, items are assigned to people ("pass the phone":
each person taps the items they shared, including individual units of a
multi-quantity item). The resulting **prefilled split** is computed by the pure
function [`computeAllocation`](src/lib/allocation.ts) — the same function the
[`ItemAssigner`](src/components/ItemAssigner.tsx) UI uses live, so what you see
on screen is exactly what the tests verify.

### Test mode (mock scan, no LLM API)

To exercise the allocation flow without burning LLM quota, run the app in
**test mode**:

```bash
npm run testmode
```

This launches the dev server with `NEXT_PUBLIC_DEBUG_UI=true` and
`NEXT_PUBLIC_MOCK_SCAN=true`. The New Transaction page then shows a
"🐛 Mock scan" checkbox — tick it and pick a fixture from `MOCK_RECEIPTS` to
load a canned receipt instead of calling `/api/receipts/extract`. Mock receipts
are shaped exactly like a real extraction response, so the rest of the flow is
unchanged.

A normal `npm run dev` leaves all of this off — the debug toggle and mock-scan
path only appear in test mode (or if you set the env vars by hand in
`.env.local`). See [`src/lib/debug-config.ts`](src/lib/debug-config.ts).

### Running the allocation tests

Nine scenarios in
[`src/lib/test-data/allocation-fixtures.ts`](src/lib/test-data/allocation-fixtures.ts)
(shared items, solo items, multi-quantity even/uneven splits, three-way rounding,
partially-unassigned receipts) assert the exact prefilled per-user totals, plus
invariants: item shares are conserved, no negative shares, and the unassigned-unit
count is correct. Pure and in-memory — nothing is persisted.

**From the command line:**
```bash
npm run test:allocation
```

**From the browser:** open `/debug` and click **Run tests** under
"🧾 Item-allocation tests" — the same suite runs via
`GET /api/debug/allocation-tests` and shows computed-vs-expected totals per case.

### Viewing Database Data

The app uses the PostgreSQL database `projectowl` on `localhost:5432`. To inspect it:

**Via the debug API** (no tools needed):
```bash
curl http://localhost:3000/api/debug
```

**Via psql** (recommended for deep inspection):
```bash
psql projectowl                     # macOS/Linux
psql -U postgres -d projectowl      # Windows
```
Or point any Postgres GUI (TablePlus, pgAdmin, DBeaver) at the `DATABASE_URL` in `.env.local`.

## Page Structure

```
/                          → Home: "most down bad" ranking per group + overall balance
/groups                    → Your groups (create group, settled-groups toggle)
/groups/[id]               → Group detail: members, balances, ledger, + new transaction
/groups/[id]/settle-up     → Minimal transfer plan within the group (mark paid)
/activity                  → Activity feed across all your groups
/transactions              → Transaction history (filterable, all groups)
/transactions/new          → Unified manual + scan entry (scoped to a group)
/transactions/[id]         → Transaction detail
/friends                   → Friend list with balances (legacy, off-nav)
/settle-up                 → All-groups settlement view (legacy, off-nav)
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                     # Home dashboard
│   ├── layout.tsx                   # Root layout
│   ├── AppShell.tsx                 # Session wrapper + BottomNav
│   ├── scan/                        # Standalone scan (legacy)
│   ├── transactions/
│   │   ├── page.tsx                 # Transaction list
│   │   ├── [id]/page.tsx            # Transaction detail
│   │   └── new/
│   │       ├── page.tsx             # Type picker
│   │       ├── scan/page.tsx        # Scan + review flow
│   │       └── manual/page.tsx      # Manual entry
│   ├── friends/page.tsx             # Friend list
│   ├── settle-up/page.tsx           # Settlement view
│   └── api/
│       ├── receipts/extract/route.ts  # Gemini receipt OCR
│       ├── transactions/route.ts      # Transactions CRUD
│       ├── balances/route.ts          # Balance computation
│       ├── settlements/mark-paid/     # Mark as settled
│       └── users/route.ts             # User list
├── components/
│   ├── BottomNav.tsx               # 3-tab bottom navigation
│   ├── UserAvatar.tsx              # Colored avatar with initials
│   ├── UserPicker.tsx              # Multi-select participant picker
│   ├── SplitInput.tsx              # Even/custom split (% or $)
│   ├── BalanceCard.tsx             # Net balance display
│   ├── TransactionCard.tsx         # Summary row for list
│   ├── ConfirmDialog.tsx           # Reusable confirmation modal
│   ├── ReceiptUploader.tsx         # Drag-and-drop upload
│   ├── ReceiptResult.tsx           # Extracted item table
│   ├── LoadingOverlay.tsx          # Processing spinner
│   └── ErrorAlert.tsx              # Error display with retry
└── lib/
    ├── db/
    │   ├── schema.ts               # Drizzle ORM table definitions (pg-core)
    │   ├── index.ts                # Postgres client + Drizzle instance
    │   └── seed.ts                 # Seed users + demo transactions (npm run db:seed)
    ├── actions/
    │   ├── users.ts                # User CRUD + friend balance
    │   ├── transactions.ts         # Transaction CRUD with items
    │   ├── balances.ts             # Balance computation engine
    │   └── settlements.ts          # Settlement plan + mark paid
    ├── llm/
    │   ├── types.ts                # LLMClient interface
    │   ├── gemini-client.ts        # Gemini REST API implementation
    │   └── index.ts                # Factory (createLLMClient)
    ├── schemas/receipt.ts          # Zod schemas for receipt data
    ├── session.ts                  # sessionStorage helper
    ├── errors.ts                   # Error class hierarchy
    └── retry.ts                    # Backoff retry utility
```

## Database

**PostgreSQL** via Drizzle ORM (`postgres` driver). Schema lives in `src/lib/db/schema.ts`;
versioned SQL migrations are generated with `npm run db:generate` (drizzle-kit) into `drizzle/`
and applied with `npm run db:migrate`. Seeding is an explicit step (`npm run db:seed`) that
refuses to run in production. Connection comes from `DATABASE_URL`; `DIRECT_URL` (optional)
is used for migrations when `DATABASE_URL` points at a transaction-mode pooler (e.g. Supabase
port 6543).

| Table | Purpose |
|---|---|
| `users` | id, name, email, avatar |
| `friendships` | user ↔ friend edges (legacy) |
| `groups` | name, color, creator — expenses are shared within a group |
| `group_members` | user ↔ group edges (users can be in many groups) |
| `activities` | feed: type, actor, related user, amount, group, transaction |
| `transactions` | title, total, paid by, date, **group** |
| `transaction_items` | item name, quantity, price per line |
| `item_assignments` | user + share per item |
| `settlements` | debt records with paid status (+ group) |

All balances are **computed from raw data** on every page load (not stored), ensuring consistency on delete or edit.

## Architecture decisions

- **LLM client interface** — Swap providers (OpenAI, Anthropic) by adding one file + one factory case
- **Zod as single source of truth** — Runtime validation + TypeScript types from one schema
- **Raw REST API over SDK** — Full control over `responseSchema` for structured JSON output
- **Item-level splitting** — Multiple people can share one item via `item_assignments`, enabling exact per-person totals
- **Session via sessionStorage** — Picks user on first visit; no passwords (swap for Clerk/Supabase Auth later)
- **No global state** — Each page fetches its own data; no Redux/Context needed at this scale
