# ProjectOwl — Devlog

## 2026-08-30 — Placeholders were competing with what people typed

Issue #76: placeholder text reads as content rather than as a hint. Two things
were wrong, and only one of them was styling.

### Styling — one rule, not six utilities
There was **no `::placeholder` rule anywhere in the app**. Every field either
carried a `placeholder:text-ink-muted` utility or silently fell back to
Tailwind preflight's default, which is `currentColor` at 50% alpha — measured
on the create-group input as `oklab(0.221 … / 0.5)`, a cold near-black wash. On
a warm cream ground that reads as dirty grey rather than as a quiet hint, and
it is the exact failure mode of styling by opt-in: the one field that forgot
the class is the one that looked wrong.

`input::placeholder, textarea::placeholder` now sets size, weight, colour and
opacity in one place. Sized at `0.9em` rather than a fixed px so it steps down
proportionally: the 14px create-group field gets 12.6px, the 16px description
field 14.4px, the payment screen's 36px amount 32.4px. `opacity: 1` because
Firefox dims placeholders on its own and the tone should be ours.

Colour is a new `--color-ink-placeholder` (#68634f): the lightest warm tone
that still clears **4.5:1 on every surface these fields appear on**, measured
rather than assumed — 6.0:1 on the #FFFAEB card, 6.0:1 on the members sheet's
white, 5.3:1 on Cream Sode at login, and 4.7:1 on the payment screen's
blueberry-100, which is the binding one.

An earlier revision took this down to 3.5:1 on the reasoning that a labelled
field's hint may sit under the body-text bar. Review rejected that: form
guidance is text and holds the normal requirement. Recession is carried by
**size and weight** instead, which cost nothing in contrast.

Worth recording, because it changes what "just put it back" means: the previous
`--color-ink-muted` never met 4.5:1 on that payment card either — it measures
5.5:1 on the card but **4.44:1** on blueberry-100. Restoring it would have left
one field non-compliant. #68634f is fractionally darker than ink-muted for
exactly that reason, which is also why the token isn't called `-faint`: a name
implying "lighter than muted" would be a lie to the next reader.

The three surviving `placeholder:text-ink-muted` utilities had to go with it.
A Tailwind utility outranks a base-layer rule, so leaving them would have
pinned those three fields at the darker tone while the other three lightened —
the same opt-in inconsistency this rule exists to remove.

The iOS 16px auto-zoom floor a few lines below is unaffected — that applies to
the *field's* font-size, which is what governs zoom, so a sub-16px placeholder
is safe.

### Copy — a hint has to look like a hint
`"Ramen in Shinjuku"` was indistinguishable from a description someone had
already typed; that's the example the reporter cited. Prefixed with `e.g.`
along with the member-invite field. `"e.g. Roommates, Japan Trip"` was already
right and needed only the styling.

### Fixed on the way past: two unlabelled fields
The login screen's create-user inputs used `placeholder="Name"` and
`"Email"` **as their only label** — there is no `<label>` and no `aria-label`
on either. Converting those to examples would have left the fields nameless, so
both gained an `aria-label` first. The placeholder-as-label pattern was already
costing sighted users the field name the moment they typed; this makes the name
permanent for assistive tech and keeps the visual form unchanged.

The payment amount keeps `0.00` — a numeric hint, not a name — but at 32.4px
non-bold muted it now reads as an empty field rather than as a value of zero.

### Verification
Measured `getComputedStyle(el, "::placeholder")` on every placeholder in the
app, across five screens: compose, groups list, group members, payment, login.
All six report `rgb(107, 102, 86)` (`--color-ink-muted`), weight 400, opacity 1,
and 0.9× their field's size. Before/after taken on the same element by deleting
the new rule from `document.styleSheets` at runtime and re-measuring, rather
than trusting the diff: 14px/50%-alpha-ink → 12.6px/ink-muted.

`tsc --noEmit` clean; simplify 13/13, allocation 18/18, settlement 10/10,
security 35/35.

Not verified: `next build`, skipped because it clobbers `.next` under a running
dev server. The rule compiles — it is present in `document.styleSheets` at
runtime, which is what the before/after toggle manipulated.
## 2026-08-28 — The calculator had two Clear buttons and no obvious commit

Reported as issue #58: the keypad shows two "Clear" buttons. It did — a red
`C` in the operator column and a wide grey `Clear` across the bottom row.

### The two were genuinely the same button
Both were wired to the identical `handleClear` (`setExpression("")`) — no
clear-entry vs. clear-all distinction, nothing behind the duplication. So one
of them could go without costing anything.

### Fixed
- **The wide bottom `Clear` is now the commit key**, carrying a stroked check
  and wired to `handleClose`: evaluate the expression, hand it to `onConfirm`,
  let the caller close the pad. It is `--color-positive` green, so the pad's
  three coloured keys each carry a distinct job: red `C` destroys, Blueberry `+`
  operates, green ✓ confirms. White on it measures 6.44:1. All four call sites
  (`ExpenseComposer` ×3, `ItemAssigner`) already commit-and-close on
  `onConfirm`, so nothing outside the component changed.
- **The red `C` stays** as the pad's one clear. Removing the *duplicate* is
  what the issue asked for; removing clearing altogether would have left a long
  expression to be dismantled one backspace at a time.
- **The header's text `Done` was removed.** With the check key present it was a
  second commit affordance, which is the same complaint the issue was filed
  about wearing a different word.
- **The footer said "Tap outside or press ✕ to save"** and there has been no ✕
  since the bottom-sheet rework. Now "Tap the check or outside the keypad to
  save".

Nothing else moved: 64px keys, 12px gaps, `C` / `⌫` / `+` down the operator
column, `0` and `.` on the bottom row. An earlier pass had also re-laid the
grid out and shrunk the keys; that was reverted as scope that the issue never
asked for.

### Green on a confirm key, against the standing rule
The 2026-08-06 entry reserves green and red for owed/owing and says never to
spend them on chrome. This spends green. The exception is deliberate and
narrow: that rule exists so a *screen* doesn't grow a second identity competing
with Blueberry, and there is no balance figure anywhere on the keypad for the
colour to be misread against. Blueberry 900 was tried first — next to the `+`'s
600 the two saturated keys still read as one button. The palette has no second
accent, so hue had to come from the semantics or not at all.

### Why a check and not the word
The word is what the reporter suggested, and it was tried first. A check reads
faster on a key that sits under a thumb, and it keeps the pad free of the only
word among fourteen glyphs. The name survives where it has to: `aria-label` is
still `Done`, and the footer line names it.

### Verification
Real browser against `npm run testmode`. The `aria-label` sweep returns
`7 8 9 Clear 4 5 6 Backspace 1 2 3 Plus 0 "Decimal point" Done` — one clear,
one commit. `99` then `C` empties the display; `12.50+8` previews `= $20.50`
and the check (154×64) closes the pad and writes **$20.50** into the amount
card. `tsc --noEmit` clean; simplify 13/13, allocation 18/18, settlement 10/10,
security 35/35.

Not verified: the share/payer keypads inside a real group — this machine's
local `projectowl` database predates migration `0005`, so `/api/groups` 500s on
a missing `transaction_payers`. Same component; only `title`/`unit`/
`initialValue` differ. Also unverified through AO's own browser panel: its
click and screenshot calls failed for the whole session, so the run above was
driven against local Chrome over CDP instead.

## 2026-08-15 — UI pass: surfaces inverted, swipe paging fixed, one mascot

A round of visual and interaction work off the back of reference screens the
team liked. No API, schema or flow changes.

### Fixed — three real bugs, none of them cosmetic
- **Swiping mid-screen didn't change pages.** Three faults at once:
  `react-swipeable`'s `deltaX` is `start − current`, so the track followed the
  thumb *backwards*; there was no axis locking or `preventDefault`, so each
  page's own `overflow-y: auto` claimed the touch before the 10px threshold
  resolved (worst in the middle of a long page, which is exactly where it was
  reported); and on release it pushed the route *and* snapped home to the old
  index, so one gesture produced two movements. Replaced with native
  non-passive listeners: 8px slop decides scroll vs. swipe, the loser is
  released entirely, commit is 22% of width or a 0.35px/ms flick, and the track
  animates straight to the destination with the route pushed underneath.
- **The group picker couldn't be scrolled at all.** Every touch handler lived
  on the *collapsed* card, which unmounts the moment it expands — so once open
  nothing was listening, and `handleDragEnd` was never wired to anything.
  Replaced with a bottom sheet (305 lines → 149). Rebuilding the gesture wasn't
  worth it now that PageSlider claims horizontal drags across the whole screen.
- **Press states were dead on iPhone.** WebKit only applies `:active` to
  non-anchor elements when the document has a touch listener; combined with the
  `-webkit-tap-highlight-color: transparent` we set deliberately, there was no
  press feedback at all on the platform where it matters. Empty passive
  `touchstart` on `document` in AppShell.

### Done — surfaces
Cream Sode moved from the cards to the **ground**, and cards became a warm
near-white (`#FFFAEB`) on top of it. The two had been close enough in value
that a card read as part of the surface behind it whichever way the shadow
fell; swapping them lightens the ground and whitens the cards in one move.
This inverts the original brief — Cream Sode was specified as the surface that
replaces plain white, and is now the thing white sits on — but it ends up more
visible, since the background is the largest area on screen.

New `.card-lift` declares the card treatment once (radius 22, Blueberry-tinted
shadow rather than black, which on a warm ground reads as grey dirt).

### Done — screens
- **Home**: eyebrow, big semantic-coloured figure, then a proportional bar of
  owed-vs-owe and two arrowed labels. The bar earns its place — a `$0` net
  looks identical whether nothing is outstanding or $500 is owed each way.
- **Groups**: rows share one card with dividers rather than three separate
  cards; rounded-square group tiles (deliberately not circles — circles are
  people here), overlapping member avatars, settled groups as a drawer. The
  duplicate balance card was dropped for a one-line net in the header.
- **Add expense**: amount leads in its own card, description and Group/Date
  labelled below, Paid-by/Split kept as a sentence. Date moved off the keypad
  into its own field, so the keypad is purely numeric again.
- **Activity**: line-art glyphs in canvas-filled discs — the disc is the page
  ground, so it reads as a well pressed into the card. Emoji retired: they
  render at a different weight and colour on every platform, so a column of
  them never lines up.
- **Members / Balances**: the solid Blueberry header bar — the only band of
  saturated colour in the app — became canvas with a text Done. Creator is a
  chip beside the person rather than grey caps at the edge, and the mock-mode
  quick-add is now visibly a dev tool rather than styled like a real control.

### Done — one mascot
The header was bold blue text with no relationship to anything. It's now the
sloth in a Blueberry tile beside the wordmark. The scan loader's owl became the
sloth working a calculator — paws tapping in alternation, eyes down, display
scrambling. The owl marked the app while the sloth marked ItreAI, which is two
mascots; `OwlMark` is now unused by the UI (`public/icons/` are still the owl).

The scrambling digits are deliberately meaningless — Gemini reports nothing
until it returns, and a figure that looked like a running total would be
inventing one. Same reasoning as having no progress bar.

### Architecture decisions
1. **Native listeners for paging, not a gesture library.** Axis locking needs
   `preventDefault` on a non-passive listener, which is the one thing a
   passive-by-default library can't give you — and it's the whole fix.
2. **One `GroupList`, three framings.** The list appeared in the home picker,
   the compose field and the scan confirmation. Extracted when the third
   appeared; the sheet, heading and dismissal stay with each caller.
3. **Changing group after a scan asks first.** It clears participants, scanned
   items and the assignment — correct, but minutes of work after a
   pass-the-phone session. Guarded on both entry points, with a
   non-dismissible destructive confirm.
4. **Three press variants.** `.pressable` (scale 0.96), `.pressable-sm`
   (chips, 0.92 — 0.96 barely moves at that size), `.pressable-cta` (wide
   buttons press *down*; scaling a full-width button looks like squashing).
   All snap in over 90ms and ease back over 260ms with slight overshoot —
   equal durations read as a CSS transition, asymmetric reads as a button.
5. **The sloth is drawn, not the illustration.** `public/sloth-mascot.png` is
   in place for anywhere with room, but the header mark is a simplified SVG:
   the visor, the wide face and the two eye patches are what survive 26px.

### Verification
`tsc --noEmit` clean; simplify 13/13, allocation 18/18, settlement 10/10,
security 35/35 throughout.

### Known / deferred
- `public/sloth-mascot.png` is 620 KB and unoptimised, and isn't wired into any
  screen yet.
- `public/icons/*.png` are still the old blue owl.
- Activity rows show the transaction total but not the viewer's share —
  `getActivitiesForUser` doesn't return it, so "you lent $X" would need a
  backend change.
- Not exercised on hardware beyond the reports that prompted these fixes.
=======
## 2026-08-14 — A stale socket on the only DB connection hung every request

Reported as production hanging "once in a while", then recovering on its own.
A `/api/auth/me` invocation ran **300.3s** to the platform cap and returned
`FUNCTION_INVOCATION_TIMEOUT`.

### Reading the trace
The Vercel log exonerated auth outright: `supabase.co/auth/v1/user` came back
in **49ms**. `/api/auth/me` does exactly two things — that call, then Postgres
— so the remaining ~300s was all postgres.js. The External APIs table shows no
database row because it only traces HTTP; a raw TCP wait is invisible there.

Two further observations:

- **Pages were never slow.** `/`, `/groups`, `/activity`, `/transactions/new`
  all returned 304 promptly throughout an outage; only `/api/*` hung. Pages
  don't touch Postgres — the shell fetches its data client-side.
- **Recovery coincided exactly with the 504s.** `/api/groups` and
  `/api/balances` died at the same instant (17:09:27.26), having started
  together 300s earlier. The app didn't heal, it *timed out*.

### The wait is not execution — a wrong turn, and how the data corrected it
The first read of `pg_stat_activity` showed `state = 'active'`, which was taken
as proof the query had reached a backend, ruling out a dead socket and pointing
instead at a client-side queue deep enough to exceed the function timeout.

Both halves of that were wrong, and the measurements say so:

- `select … from pg_stat_activity where state <> 'idle'` **always returns the
  SQL editor's own session as `active`**. A single `active` row is the observer,
  not evidence of a stuck app query.
- A healthy request measures `db: 17ms` (`_timing`, from server-timing.ts).
  Queue-depth arithmetic needs thousands of pending requests to reach 300s;
  refreshing cannot produce that.
- **No app query appears in `pg_stat_statements` at all** when sorted by mean
  time — the top 20 is entirely Supabase internals (Studio's
  `pg_timezone_names`, PostgREST introspection, WAL machinery, one-time
  `CREATE TABLE`s). Every app query therefore has a mean under ~18ms, and the
  highest `max_exec_time` anywhere in that set is 1074ms. **Nothing ever
  executed for anything close to 300s.**

So the time is spent *waiting*, not running: the socket dies while the instance
sits idle (nothing notices — no query is in flight), the next request writes
into it, and postgres.js — which has **no query timeout** — waits forever. At
max:1 that one wedged socket blocked every request on the instance until the
platform killed it. That also explains why hangs are total and instant rather
than gradual, which a filling queue would not be.

### Amplifier: the client fires four uncoordinated requests per load
PageSlider keeps several pages mounted, and each fetches independently, so
`/api/groups` is requested **twice** per load (`app/page.tsx` and
`app/groups/page.tsx` both fetch it, as do both for `/api/balances`), alongside
`/api/balances` and `/api/activities`. Not the cause — with a healthy 17ms
database this is invisible — but it multiplies everything by ~4 when a socket
does wedge, and each of the four pays its own `auth.getUser()` round trip.

### Red herring: the auth "storm"
Supabase's auth log fills with `/auth/v1/user` during an outage and looks like
the cause. It isn't — every call returns 200 in ~49ms. `/groups`,
`/transactions/new` and `/activity` appear at the *identical* millisecond
(17:15:36.13), which is Next.js `<Link>` prefetch, not a user refreshing. Each
prefetch runs middleware (the `Vercel Edge Functions` entries) and its
`auth.getUser()`, then serves a 304 without touching Postgres. High volume,
no database cost. Don't chase it.

### Fixed
- **`idle_timeout: 20` → `5`.** The main defence: don't hold a socket across an
  idle gap at all. Costs one reconnect (tens of ms) after a quiet spell and
  removes almost the whole window in which a stale socket can be reused.
- **`max: 1` → `max: 5`.** Fluid compute serves concurrent requests from one
  instance, so a single connection meant one wedged socket took down every
  request on that instance rather than one. Safe because `DATABASE_URL` is the
  6543 transaction pooler; `DIRECT_URL`/5432 has a far lower limit and must not
  be pooled this way. Check the pooler's `default_pool_size` before raising it
  further.
- **`max_lifetime: 300`** so no socket outlives an idle instance, and
  **`keep_alive: 10`** so a dead peer surfaces as an error sooner.
- **`maxDuration = 20` on the 14 data routes.** A stall now returns our error
  instead of burning 300s of Fluid capacity. Same lesson as the `budgetMs`
  entry below: under a hard deadline, exceeding it destroys the error.

### Known broken (deliberately not fixed)
`setRequestAuth` does nothing. `set_config(..., true)` is *transaction*-local
and both calls run in autocommit, so each setting is discarded at the end of
its own statement — by the time a route queries, `role` and
`request.jwt.claims` are back to their defaults. **The policies in
`0004_enable_rls.sql` are not being enforced in production**; `src/lib/actions/*`
is what actually scopes data access. It also costs 2 serialized round trips
per authenticated request, which is 2/3 of the auth path's database latency.

Left in place for now — the comment in `rls.ts` was rewritten to say so,
because it previously justified its safety on `max: 1` and that is no longer
true. **Do not "fix" this by flipping the third argument to `false`**: session
-scoped settings would persist on a pooled connection and leak one user's auth
context into the next request. A correct fix has to open a transaction and run
the config and the query inside it, and survive the transaction pooler, where
a session's connection is not stable between statements.

### Architecture decisions
- **A connection pool of one is not a safe default, it's a global lock.** The
  `max: 1` came from single-invocation-per-instance assumptions that Fluid
  compute broke, and `rls.ts` had grown a *correctness* argument on top of it.
  Config that other files reason about needs to say why, or the next change
  silently invalidates them.
- **Client-side queueing is invisible to server-side monitoring.** `active`
  with a low backend count during a total hang was the tell; without checking
  the *number* of rows it reads as a healthy database.

### Not verified here
Reproduced only from production logs — the fix can't be exercised locally,
where a single Postgres has no queue. Watch whether 504s stop after deploy.
Server-side guards still want a one-time
`ALTER ROLE authenticated SET statement_timeout = '15s'` (plus `lock_timeout`
and `idle_in_transaction_session_timeout`); these are unreliable as postgres.js
startup params through Supavisor, so they belong on the role.

## 2026-08-14 — Service worker disabled

Turned off in every environment after a day of caching strategies that each
fixed the previous failure and introduced another.

### How you actually disable one
Deleting the file, or just dropping the `register()` call, disables nothing: a
worker already installed in someone's browser stays installed and keeps
intercepting every request forever. The only thing that reaches those browsers
is a **new version of the script**, which the browser re-fetches when checking
an existing registration. So `public/sw.js` is now a worker whose entire job is
to remove itself — clear Cache Storage, `registration.unregister()`, reload
controlled tabs.

`AppShell` unregisters and clears caches too, in every environment. Belt and
braces: the worker's own kill switch needs the browser to fetch sw.js, while
AppShell runs as soon as the app boots.

`public/sw.js` must keep being served. If that request 404s, the browser keeps
the last working registration and the old worker lives on.

### Why
Four strategies, four failures, each invisible until it hit a real browser:
blank app after every deploy → assets orphaned by Vercel's per-deploy `?dpl`
query → 404s from superseded builds reaching the page as fatal empty scripts →
requests that never settled, leaving the app loading forever.

The trade was bad. The worker bought offline support and, for online users,
essentially nothing: Next serves `/_next/static/**` with
`max-age=31536000, immutable`, so the browser's own HTTP cache already covers
speed. Offline support is not worth a feature that can take the whole app down
and then persist in users' browsers after the bad code is gone.

### The lesson worth keeping
**A node:vm harness cannot validate a service worker.** Every one of those
failures passed its suite. Worse, the suite produced false passes twice from
its own bugs: `new Response("", { status: 304 })` throws (304 is a null-body
status), which silently routed a test down the network-error path; and a
missing `setTimeout` in the VM context made a timeout test "pass" in 1ms
without ever running the timeout. Both looked green.

If caching comes back, it needs a real browser driving two consecutive deploys
with a tab held open. Anything less tests our model of the browser, not the
browser.

### Verification
- `npm run test:sw` rewritten to the four things that now matter: no fetch
  handler, all caches deleted, self-unregistered, controlled tabs reloaded.
  4/4.
- Confirmed no `serviceWorker.register` call remains anywhere in `src/`.
- `tsc --noEmit` clean; production build compiles.

## 2026-08-14 — Nothing in the worker could time out

Reported after the network-first deploy: the app loads forever and shows
nothing, on every page. Ruled out first, against live staging: all 16 assets
the served HTML referenced returned 200, the deployment id matched the current
deploy, and the deployed worker was the new one. So not staleness, not a
missing chunk, not an old worker.

That leaves a request that never settles. `AppShell` gates the whole app on one
fetch and flips `ready` in a `.finally()`, so a promise that stays pending
leaves `<div className="min-h-dvh" />` on screen indefinitely — no error, no
console output, just loading.

### Fixed
- **A network timeout in the worker.** `respondWith()` takes a promise and
  nothing bounded it. `timedFetch` races the fetch against 10s and falls back
  to cache. Implemented as a race rather than an `AbortSignal` because passing
  init to `fetch(request, ...)` reconstructs the Request, which throws for
  navigation-mode requests.
- **Drain the `clone()` before returning.** `cache.put(key, response.clone())`
  was fire-and-forget. `clone()` tees the body; a branch nobody consumes — a
  `put` that rejects on quota, say — can stall the branch the page is reading.
  Headers arrive, the body never completes, the page loads forever. The copy is
  now fully written before the response is handed over, with the cache error
  swallowed. Moving to network-first multiplied the number of clone+put pairs,
  since cache-first previously served most assets without touching either.

### Two false passes caught while writing the tests
Worth recording, because both would have shipped a green suite over a broken
worker:

1. The VM context had no `setTimeout`. The worker's timeout threw
   `ReferenceError`, the race rejected instantly, and `hung-network` "passed"
   in 1ms without ever exercising the timeout. Real timers make it 151ms.
2. Earlier, `new Response("", { status: 304 })` throws — 304 is a null-body
   status — which routed the 304 test down the network-error path instead.

### Verification
- `npm run test:sw` 7/7, including `hung-network`: a network that accepts the
  request and never answers must still settle, and must fall back to cache.
- `tsc --noEmit` clean; production build compiles.
- **Not verified in a browser.** Three previous fixes in this sequence passed
  their tests and failed in the real app; this one targets the reported symptom
  but carries the same caveat.

## 2026-08-14 — The cache is an offline fallback, and nothing else

Third attempt at the blank page, and the first one aimed at the right thing.
Cache-first was the wrong strategy for this app, not a strategy with bugs in
it.

### The thing every previous attempt missed
A deploy **deletes** the previous build's chunks. `layout-<hash>.js` captured
before a staging deploy returns 404 after it — a chunk whose content changed
gets a new hash and the old file is gone. So a tab open across a deploy asks
for files that no longer exist.

**A 404 is a response, not an error.** It sails past a `try/catch` and reaches
the page, and a 404'd `<script>` kills the app exactly as dead as a failed
one. Every fix so far guarded the throwing path and left this one open. Worse,
the first test suite asserted only "does not reject out of respondWith", which
a 404 satisfies — so the 404 case was reported as PASS while returning a fatal
response. Cache-first had been accidentally covering it by never reaching the
network.

### Done
- **One strategy: network-first, everywhere.** The cache is written on every
  success and read only when the network fails. Nothing cached can be served
  while online, which is the entire class of "stale cache disagrees with the
  running build" gone.
- **Except for a 404 on a build asset**, which falls back to cache. Safe only
  there: a content-hashed path means the cached copy is byte-identical to what
  the server would have sent, so it cannot be stale. Elsewhere a 404 is real
  information the app needs.
- **Caches are no longer per-deploy** (`shell`, `data`, `assets`), each bounded
  and pruned oldest-first. Versioned names meant every deploy started with an
  empty cache — no offline support until the user next went online, the
  opposite of the point. Nothing needs versioning now that nothing is served
  cache-first. `CACHE_VERSION` survives only to keep `?v=<sha>` changing so the
  browser installs the new worker at all.
- `navigateHandler`/`cacheFirst`/`assetCacheFirst` collapse into one function.

### Why this costs nothing
Next serves `/_next/static/**` with `max-age=31536000, immutable`, so the
browser's HTTP cache already holds those for a year — checked against staging,
not assumed. A `fetch()` from the worker goes through that cache, so
network-first on a build asset returns without touching the network anyway.
The worker's cache-first layer was duplicating the HTTP cache while adding
every failure mode above.

### 304 — reported as "when I get the blank page I see 304"
Two separate problems, both fixed here:

1. **A 304 has no body.** The browser normally never shows one to a page: it
   merges the 304 with its own HTTP cache entry and synthesises a 200. A
   response returned from `respondWith()` skips that merge, so passing a 304
   through delivers an empty document or empty script — a blank page with
   nothing in the console. `networkFirst` now resolves a 304 against the cache,
   and re-fetches with `cache: "reload"` when there's nothing cached to pair it
   with.
2. **`cache.addAll()` rejects the whole batch on any non-ok response**, and a
   rejected `install` means the new worker never activates — so a deployed fix
   silently does nothing and the old worker keeps serving. Demonstrated: the
   previous worker crashes the suite with `addAll: bad response for /` as soon
   as `/` answers 304. Precaching is now per-URL, best-effort, and
   unconditional. One missing icon can no longer cost us the whole worker.

This is the most likely explanation for why earlier fixes appeared not to take
effect at all, including the `cacheFirst (/sw.js:116:26)` stack from the *old*
worker after a new one had been deployed.

### Verification
- `npm run test:sw` 6/6, including a new `network-wins-while-online` case that
  primes every cache with old content and asserts the network's answer wins for
  asset, API and navigation — then that the stale copy is still there once the
  network dies.
- The suite scores 2/5 against the worker currently in production, so it
  discriminates rather than just agreeing with whatever is in front of it.
- `tsc --noEmit` clean; production build compiles.

## 2026-08-14 — Vercel's ?dpl defeated the asset cache

The previous entry's asset cache didn't survive a deploy after all, and the
blank page came back.

### Fixed
- **Build assets are cached under their URL with the query stripped.** Vercel
  appends `?dpl=<deployment id>` to every `/_next/static/**` URL. That value
  changes on every deploy while the bytes behind it don't — the path already
  carries a content hash. Matching on the full URL meant every asset missed
  after a deploy despite a byte-identical copy sitting in the cache, then got
  re-stored under the new query.

### Why the earlier fix looked right and wasn't
Both halves of it were keyed on the full URL, so `?dpl` defeated both at once:
the cache lookup missed, *and* the `caches.match(request)` fallback that was
supposed to catch the failure missed too. The net effect after each deploy was
worse than no cache — every asset fetched from the network, a safety net that
could never fire, and the cache filling with duplicates of identical files
until pruning evicted entries that were still live.

Verified against production rather than assumed this time: staging serves the
same bytes for `?dpl=<real>`, `?dpl=garbage`, and no query at all, confirming
the parameter is a pure cache-buster and safe to normalise away.

### Architecture decisions
- **Cache keys must be derived, not inherited from the request.** A request URL
  carries whatever the platform decided to staple on. What identifies a build
  asset here is the content-hashed path, so that's what the key is.
- **The test suite has to model the deployed URL shape.** The previous suite
  passed because its fixtures used bare chunk paths, which production never
  serves. The new `deployment-stamp` case appends `?dpl` the way Vercel does
  and fails (`TypeError: Failed to fetch`) against the previous worker.
## 2026-08-14 — The receipt scan could hang forever

Reported as scans being very slow or unresponsive after a new build. Not
caching — `/api/receipts/extract` is a POST, and the service worker returns on
`request.method !== "GET"` before touching it.

### Fixed
- **The retry policy could not finish inside the function that ran it.**
  `extractReceipt` retried a rate-limited Gemini call 3 times at ~13–15s each,
  ~46s of sleeping, inside a route with no `maxDuration` — so the platform
  killed it first and the caller got a 504 with an HTML body instead of the
  real error. `withRetry` now takes a `budgetMs` and refuses to start a sleep
  it can't finish; the extract path sets 40s inside `maxDuration = 60`, with
  `maxRetries` cut 3 → 2.
- **Nothing in the path had a timeout.** Neither the client fetch nor the
  Gemini call passed an `AbortSignal`, and `setScanning(false)` lives in a
  `finally` — so an unanswered request left `ScanLoader` up indefinitely.
  Client-side deadline is now 120s, well clear of the server's 60s so a
  working scan is never cut short; it exists to end the spinner when nothing
  is coming back at all.
- **Rate limiting is no longer reported as a network failure.** A new
  `RateLimitError` (429, `LLM_RATE_LIMITED`) is distinct from `LLMError` (502),
  so the UI can say "wait about a minute" instead of "check your connection" —
  which sent people to fix something that wasn't broken.
- **Uploads are downscaled before sending.** `lib/image.ts` re-encodes to
  2000px on the long edge at q0.85, typically several MB → a few hundred KB.
  There was no resizing anywhere before this (the old wizard had none either),
  so full-resolution camera photos were being posted.
- **`MAX_FILE_SIZE` 10 MB → 4.5 MB.** 4.5 MB is the serverless request-body
  limit, enforced before the handler runs, so the 10 MB check was unreachable
  above it and produced an opaque platform 413 instead of our own message.
  `bodySizeLimit: "10mb"` in next.config.ts does not raise it — that applies
  to Server Actions, and this is a Route Handler.

### Architecture decisions
- **A retry policy needs a deadline, not just a count.** Under a hard
  deadline, sleeping past it doesn't merely waste time — it destroys the
  error, because the function is killed before it can return. `budgetMs` and
  `maxDuration` are commented as coupled; raising one without the other
  reintroduces the bug.
- **`lib/scan-receipt.ts` owns the whole client-side scan.** Downscale,
  request, deadline, and failure classification live in one place, returning a
  `ScanOutcome` rather than throwing. `ExpenseComposer` and `/scan` had
  independently written error handling that had already drifted; now neither
  can regress alone.
- **Every downscale failure returns the original file.** A scan that works on
  a large upload beats one that fails because we couldn't re-encode it — most
  browsers can't decode HEIC via `createImageBitmap` even though the API
  accepts it. `scanReceipt` catches the leftover case where the fallback is
  still over the limit and explains it, rather than letting the platform 413.

### Verification
- Retry budget checked directly: unbounded runs 6 attempts / 4.5s; with a 3s
  budget, 5 attempts / 2.5s; with 500ms calls eating the budget, 4 attempts /
  3.3s — i.e. never sleeps past the budget, and call time counts against it.
- `tsc --noEmit` clean; production build compiles; security 35/35, allocation
  18/18, simplify 13/13, sw 3/3.
- Not verified here: the downscale itself needs a real browser (canvas +
  `createImageBitmap`), and EXIF rotation needs a phone photo. Worth one pass
  on a real device before trusting it.
## 2026-08-14 — A deploy could blank the app for open tabs

Reported as `TypeError: Failed to fetch at cacheFirst (/sw.js:116:26)` after a
new build, followed by the app not loading at all.

### Fixed
- **`/_next/static/**` moved out of the per-deploy versioned cache into a
  shared `assets` cache**, bounded at 300 entries and pruned oldest-first on
  `activate`. Those URLs are content-hashed, so a cached entry can never be
  stale — a changed file is a different URL — and rotating them per deploy was
  pure downside.
- **`cacheFirst` no longer rejects out of `respondWith`.** It now catches the
  network failure and falls back to `caches.match(request)` across *every*
  cache before rethrowing. `networkFirst` and `navigateHandler` both already
  had a fallback; `cacheFirst` was the only one of the three with no `try`.

### The mechanism
`cacheFirst` opens only the *current* version's cache. Versioning the cache
name per deploy (previous entry's `?v=<sha>` change) therefore orphaned every
asset the previous build had cached — the rename alone did it, before the
`activate` cleanup even ran. So after a deploy, a tab still running the old
build missed on all of its hashed chunks, went to the network, and got nothing
back: Vercel stops serving the superseded deploy's assets. A rejected
`respondWith` becomes a network error for that `<script>`, React never boots,
blank page.

The defect in `cacheFirst` was always there. `CACHE_VERSION = "v2"` was frozen
for so long that the cache never rotated, so it was never reached — the same
staleness that made Cache Storage grow without bound was also masking this.
Fixing the growth is what exposed it.

### Architecture decisions
- **Cache lifetime should follow the URL's own semantics, not the deploy.**
  Content-hashed assets are immutable and belong in a long-lived cache pruned
  by size; only unhashed shell entries (`/`, manifest, icons) need to rotate
  per deploy, and those stay in `shell-${CACHE_VERSION}`.
- **A cache-first handler must never let a fetch rejection escape.** One
  unreachable subresource taking down the whole app is a failure mode with no
  upside; serving a superseded-but-valid hashed asset is strictly better.

### Verification
- New suite `npm run test:sw` (`scripts/run-sw-tests.ts`) — 3 cases. Loads the
  real `public/sw.js` into a `node:vm` with a fake Cache Storage and a scripted
  network, then replays "deploy lands while a tab is open" for both failure
  shapes (network error and 404), plus the prune cap. Node-only, so unlike the
  simplify/allocation suites it isn't mirrored at `/debug`.
- Confirmed red-capable: the suite goes 0/3 against the pre-fix `sw.js` and 3/3
  after. The pre-`bfb813f` worker passes the *serving* check for the wrong
  reason — its `shell-v2` cache never rotated, so the old chunk was still a hit.
- `tsc --noEmit` clean; production build compiles; simplify 13/13, allocation
  18/18, security 35/35.


## 2026-08-12 — Add an expense on one screen

Replaces the four-step wizard with a single compose screen. The two decisions
that need room — who paid, how it's split — open as full-screen overlays and
come straight back.

```
New expense                                    [Cancel]        [Save]
  group · description · amount (keypad, + date)
  Paid by [you] and [split equally]
                                                      ( 🦥 ) ItreAI
     │              │                    │
  PayerSheet    SplitSheet          scan → ItemAssigner → Custom amounts
                                                          + ItemBreakdown
```

### Done
- `ExpenseComposer` (636) plus `compose/{PayerSheet, SplitSheet, ItemBreakdown}`
  and `SlothMark`. Removes `AddTransactionWizard`, six step components,
  `SplitInput` and `TypeDiagrams` — 2,016 lines out, 1,604 in.
- **`PayerSheet` gives multiple payers a UI.** The capability shipped with
  migration `0005` but the wizard only ever sent one payer, so it was
  API-reachable and not user-reachable. One person / Multiple people, with a
  running reconciliation line and Done disabled until the contributions add up.
- The scan is a shortcut to a custom split rather than a parallel branch: scan
  → who was there → `ItemAssigner` → back to Custom amounts with shares
  pre-computed and a per-person "From the receipt" breakdown to check against.
- Date lives on the amount keypad (opt-in `date`/`onDateChange`), so the keypad
  stays purely numeric where it's reused for shares and adjustment lines.

### Deliberately built ON the existing work, not over it
The receipt-adjustments feature, the draft guard and the allocation maths were
all written against the wizard. Rather than merge the older composer branch —
whose diff would have reverted 3,555 lines of them — this was rebuilt on top:

- **Tax / discount / other survive untouched.** They live in `ItemAssigner`,
  `AdjustmentRow`, `lib/adjustments.ts` and `lib/allocation.ts`, none of which
  this touches. The composer passes `scannedAdjustments` / `scannedTotal` so
  tax still pre-fills from the receipt, and `initialAdjustments` / `initialTotal`
  so re-opening the allocation restores what was typed.
- **`setAmount(result.total)`, not the sum of item prices.** `totals` includes
  tax while `assignmentsByItem` excludes it, so summing items would leave the
  amount short by the adjustment while the shares already contained it — the
  split could never reconcile and Save would never enable, with nothing on
  screen saying why.
- **The draft guard is now registered by the composer.** `PageSlider` keeps
  `/transactions/new` mounted, so swiping to another tab abandons a draft
  silently; the composer had that bug and no guard. It marks itself dirty once
  there's a description, an amount, people, or a scan.
- **Cancel exists and navigates**, routed through `guardedNavigate`.

### Architecture decisions
1. **Rebuilt rather than merged.** The older composer branch had drifted behind
   master by ~3,500 lines of other people's work. Its value was the composer
   itself, not its history — copying five files onto current master keeps every
   feature built since, and makes deleting the wizard a deliberate final step
   rather than a merge artifact.
2. **`onUseAllocationTotal` is dropped, not lost.** It existed because the
   wizard let the amount and the allocation drift across steps. The composer
   reconciles them at the moment of confirmation, so there is nothing to
   reconcile afterwards.
3. **Overlays, not routes, for the sub-screens.** `/transactions/new` is one of
   four pages mounted at once inside `PageSlider`; child routes would break its
   index maths and allow swiping sideways mid-flow.

### Verification
`tsc --noEmit` clean. `test:simplify` 13/13, `test:allocation` **18/18**,
`test:settlement` 10/10, `test:security` **35/35** — the allocation and
security counts are the pre-existing ones, which is the check that the
adjustments and validation work came through unreverted. Confirmed by diff that
`ItemAssigner`, `allocation.ts`, `adjustments.ts`, `AdjustmentRow`,
`draft-guard.ts`, `nav-direction.ts` and `DraftLeaveGuard` have zero changes.

### Known / deferred
- Not exercised on hardware. Gesture thresholds and haptics are desktop-tested
  only; `navigator.vibrate` is a no-op on iOS Safari regardless.
- The sloth is a stand-in drawn in `OwlMark`'s style, pending real artwork.
- The composer's Cancel returns to `/`; the wizard used to return to its own
  opening step. Worth a look in use.

## 2026-08-12 — Multiple payers per transaction, and three balance bugs

A bill can now be settled across several cards. Deliberately scoped to the data
model, the balance math and the affected non-wizard components — the
add-expense UI is untouched, so this lands independently of any decision about
that flow.

### Done
New `transaction_payers` table (migration `0005`), mirroring `participants`:
that one says who **owes**, this one says who **put money in**.
`transactions.paid_by_user_id` is kept as a denormalised primary payer for
display, and every existing transaction is backfilled as a single full-amount
row, so balances are unchanged by the migration itself.

`POST /api/transactions` accepts an optional `payers[]`; omitting it means the
primary payer covered everything, exactly as before. Payments stay
single-payer — splitting "I paid you back" across contributors is meaningless.

### Fixed — money bugs found by an adversarial audit of the balance math
All three had shipped green because nothing exercised `getBalance` with more
than one payer; the settlement fixtures never inserted payer rows.

1. **`getGroupPage.yourPairwise` showed creditors as debtors.** A third copy of
   the pairwise logic, keyed on `tx.paidBy` alone. On a $100 bill (Alice $60 /
   Ben $40, split 3 ways) Ben read "You owe Alice $33.33" when he was in fact
   owed $6.67 — sign flipped, 5× off, contradicting the settle-up plan on the
   same page. 9,388 violations across 4,000 randomised scenarios.
2. **A cent that could never be settled.** The API tolerated ±0.01 on
   shares-vs-total and ±0.01 on payers-vs-total independently. Net is
   `paid − owed`, so a 2¢ gap left someone pinned at +$0.01 forever with
   `isSettled` (`|net| < 0.005`) never firing. A follow-up pass found
   fractional-cent amounts reopening the same hole through the API — 300,000
   crafted payloads, all accepted, 83,915 with non-conserving nets.
3. **"Pay X back" could move real money to the wrong person.** On that same
   bill Ben was offered "Pay Alice back $33.33" against an actual $6.67 debt.

### Also
- **`Portal`** — `BottomSheet`, `ScanLoader`, `SettledOverlay`,
  `LoadingOverlay` and `CalculatorKeypad` were all still trapped beneath the
  app header by `PageSlider`'s animated transform (the same bug `ItemAssigner`
  fixed inline). Generalised that fix and adopted its layering: `z-[55]`, above
  the header, below the offline banner at `z-[60]`.
- **`npm run db:migrate` works again locally.** `0004_enable_rls.sql` calls
  `auth.uid()`, which Supabase provides and a local `createdb` does not, so
  local dev was stuck at `0003`. `scripts/db-migrate.ts` now creates a stub
  *only when absent* — no-op on Supabase, never replaces the real function.

### Architecture decisions
1. **One pairwise implementation, not three.** Bug 1 was fixed by extracting
   `pairwiseFor()` into `simplify.ts` and deleting the private loops in
   `getBalance` and `getGroupPage`. Patching the third copy would have left the
   same failure mode open to a fourth.
2. **Net = paid − owed.** Replaces "credit the payer with each non-payer's
   share, skip the payer's own row". Arithmetically identical for one payer —
   both give `total − ownShare`, verified over 8,000 scenarios — but it
   generalises and needs no self-reference special case.
3. **Shares are owed to payers in proportion to contribution.** A $25 share of
   a bill where Alex paid $60 and Ben $40 is $15 to Alex and $10 to Ben. An
   edge between two payers therefore nets *two* flows in opposite directions.
4. **Money means whole cents.** `isNonNegativeMoney` now rejects fractional
   cents. That is what makes the half-cent reconciliation check airtight: a gap
   that must be under half a cent and is a whole number of cents can only be
   zero. Verified this does not reject adjusted receipts — `lineAmount` and
   `netAdjustment` already round to cents, so an 8.75% tax on a $45.83 subtotal
   resolves cleanly and the shares reconcile exactly.
5. **Suppress the pay-back shortcut under multi-payer rather than recompute
   it.** A fourth place computing debt is how bug 1 happened; settle-up already
   works off net balances and gets it right.

### Verification
`tsc --noEmit` clean. `test:simplify` 13/13 (3 new multi-payer fixtures),
`test:allocation` 18/18, `test:settlement` 10/10 (2 new multi-payer fixtures —
this is the only suite that runs `getBalance` against a database, and its lack
of payer rows is exactly why bug 1 shipped), `test:security` 35/35.

Two fixture expectations written during this work were wrong and the suites
caught both: a 2-vs-3 transfer count, and expecting +$10 on an edge that nets
to +$5. The implementation was right each time.

### Known / deferred
- `getBalance`'s group-scoped path can't be exercised in-memory:
  `getGroupMemberIds` uses the global `getDb()` rather than the injected `_db`.
  Pre-existing.
- If shares don't sum exactly to the total, the transaction detail page shows
  `totalAmount` while the ledger credits the share sum — a 1¢ display
  disagreement, feeding no math.
- The wizard only ever sends one payer, so multi-payer is reachable through the
  API but has no UI on this branch. `PayerSheet` (One person / Multiple people)
  exists on `feature/flow-changes`.

## 2026-08-10 — Add is the expense path; payments move to settle-up

The Add tab opened on "What are you adding? Expense / Payment" — a fork the
overwhelming majority of taps resolved the same way, and one asked before the
app knows anything about you. Payment is now reached from the place where it
means something.

### Done
- **Wizard is expense-only** (`AddTransactionWizard`). `Step1_ChooseType` and
  `Step2_PaymentDetails` deleted, along with `txType`/`toUserId` state and the
  payment branch of `handleSave`. Add drops straight onto the method choice.
- **Five steps, not six.** Both branches are now
  `1 Method → 2 Details → 3 People → 4 Split/Items → 5 Review`. Step count and
  progress width read one `TOTAL_STEPS` constant; the `txType === "payment" ? 3 : 6`
  ternaries and the `txType` guards inside every `case` are gone.
- **`Step5_Review` lost its payment branch** — the two-avatar arrow view, the
  `txType`/`toUserId` props, and the "Record payment" button label.
- **"Record a payment" now lives on the group settle-up page**, under the
  transfer plan, linking to `/payments/new?groupId=…`. It renders in both
  states — including "All settled up!" — because that's exactly the case the
  per-row Pay buttons can't reach.
- **Group page FAB is a single direct link** to a new expense for that group,
  replacing the `+` that expanded into a two-item menu.

### Fixed
- **Cancel didn't leave the page.** It reset state to step 1 and stopped there,
  which on screen looked like the button doing nothing. Now clears the draft
  and returns to wherever the wizard was opened from, with step 1's Back doing
  the same. The reset still has to run — see below.

### Architecture decisions
1. **Payment is a group-scoped act, not a global one.** It needs a recipient
   and an amount you owe them; the Add tab knows neither. On the settle-up page
   the numbers are already on screen next to it. The free-form entry stays
   alongside the per-transfer Pay buttons rather than replacing them: the plan
   covers exact transfers, this covers part payments, repayments outside the
   simplified plan, and squaring up after the group already reads as settled.
2. **Leaving the wizard must reset it.** `/transactions/new` is one of the four
   tabs `PageSlider` keeps mounted simultaneously, so the component outlives
   navigating away — without the reset you return to a half-filled wizard on
   step 4. This is why Cancel was written as a state reset in the first place;
   it just never also navigated.
3. **`history.length` guards the back.** `router.back()` is right when
   something pushed us here, but wrong on a cold start at `/transactions/new`
   (shared link, PWA launch, hard refresh) where it would leave the app. The
   fallback routes to the deep-linked group if there is one, else home.

### Verification
`tsc --noEmit` clean. Not verified: behaviour on a device. Wizard steps are
still not history entries, so the hardware back button exits the wizard from
step 4 rather than stepping to 3 — making it step-aware means pushing a history
entry per step, which interacts with `PageSlider`'s swipe-push navigation.

## 2026-08-06 — UI overhaul: Blueberry/Cream design system, bottom sheets, ItreAI loader

Visual and interaction-level pass only — no navigation flow, screen structure,
state management, or API changes. The app read as a responsive web page rather
than something used with a thumb; this addresses that.

### Done

**Design tokens (`globals.css`)** — a `@theme` block replacing six ad-hoc
custom properties:
- Surfaces: `--color-canvas` #F6E7C0, `--color-surface` #FFF0C9 ("Cream Sode"),
  `--color-surface-raised` #FFF8E3. Cream Sode is the *card* tone, not the
  canvas — with both the same, cards vanish.
- Blueberry ramp 100–900 around #243B8F. 8.85:1 on Cream Sode, which is why it
  carries both text and fills and no second accent was needed.
- Warm neutrals (`--color-ink` 15.3:1, `--color-ink-muted` 5.1:1,
  `--color-hairline`), desaturated semantics, and warm-biased tints so an error
  banner sits *in* the cream instead of on it.
- Type scale mirrors iOS Dynamic Type rather than a modular scale. **Body 14 →
  17px** — this did more for "feels native" than any colour change.
- Legacy vars (`--primary`, `--border`, `--card`…) re-point at the new palette,
  so 251 existing call sites re-tinted from one file.
- ~310 hardcoded Tailwind colours swept to tokens across 26 files. Debug UI
  (`/debug`, DebugMenu, SimplifyTestViz) deliberately left on the old greys.

**Nav island (`BottomNav`, `NavIcons`)** — one `blueberry-100` pill slides
between tabs on a spring with overshoot, instead of four icons independently
recolouring. It's the only element allowed to overshoot, which is what makes
the bar read as a physical object. Text glyphs (`⌂ ⊟ + ◉`) replaced with stroked
SVGs — those resolved to different fonts with different baselines per platform.
Clearance consolidated into `--nav-clearance` (was hardcoded in three places at
two different values).

**Bottom sheets (`BottomSheet`)** — `ErrorDialog` and `ConfirmDialog` render
through it with **identical props**, so all 8 call sites are untouched. Actions
stack full-width rather than sitting side by side; destructive variants are
neither swipe- nor backdrop-dismissible.

**Swipe-to-reveal delete (`SwipeableRow`)** — deliberately two-stage: the swipe
reveals, a second tap commits. Vertical intent wins past a 6px slop so the
gesture never fights list scrolling. Optimistic with rollback; the group page
refetches after (deleting a transaction moves that group's nets).

**ItreAI scan loader (`OwlMark`, `ScanLoader`)** — the owl now exists as
animatable SVG (previously only flattened PNGs in the old #3a85c5 blue; the
source SVG was never committed). Three phases: assemble, read, resolve. No
progress bar — Gemini doesn't stream, so any percentage would be invented.

**Screens reworked** — wizard steps 1–5, `ItemAssigner` (receipt paper with
torn edges, avatar stamps replacing a 5×5 tri-state checkbox, active person
owning the header band), `SplitInput` (segmented control, proportional split
bar), `TransactionCard`, review screen (now lists every participant and their
exact share — it used to say "Participants: 4 people", the one fact you
couldn't check).

**PAID stamp (`PaidStamp`, `SettledOverlay`, `lib/settled.ts`)** — settling used
to be marked by animation *stopping*: the cash/Gandhi rain keys off the sign of
`netBalance`, so zero fell through to `null`. Now a stamp lands with sparks on
the settle-up paths, and a watermark rests on settled balance cards.

### Fixed
- **`.animate-slide-up` was never defined** — `CalculatorKeypad` referenced it,
  so the keypad had always snapped in with no transition. It also had no
  safe-area padding and a 32px `✕` as its only commit affordance.
- **Falling money/Gandhi piled up at the top of the card.** A positive
  `animation-delay` holds an element at its pre-animation state, so 60 elements
  sat visible at `top: 0` waiting their turn — the last Gandhi for 14.5s. All
  delays flipped negative; start moved to `-44px` to clear the box.
- **`text-gray-400` secondary text** was already below 4.5:1 on white before
  this work, and would have been worse on cream.
- Service worker served stale JS chunks over the dev server (see decision 3).

### Architecture decisions
1. **Green/red mean owed/owing — never "this is the payment screen."**
   `/payments/new` had a full emerald identity (gradient hero, green submit,
   green focus rings) that after the migration amounted to a second palette
   running beside Blueberry. Payment chrome is now Blueberry; the semantics are
   reserved for balances. Payments are told apart by the arrow diagram and the
   wording.
2. **`isSettled` checks both gross sides, not the net.** `netBalance === 0` is
   true when you owe Alex $50 and Ben owes you $50 — two live debts. Stamping
   that PAID would be a lie. Epsilon compare because money is
   `doublePrecision`. The net-zero-but-open case gets its own line instead.
3. **Service worker is disabled on local origins.** It's cache-first for
   same-origin assets with a hand-bumped `CACHE_VERSION`, so a worker
   registered against `localhost:3000` outlived the process that installed it
   and kept serving earlier sessions' chunks. Guarding `register()` client-side
   can't fix a browser that already has one — the stale worker *is* what serves
   the client code. Browsers always re-fetch `/sw.js` on navigation, so the
   kill switch lives in the worker: on a local origin it wipes caches,
   unregisters itself, and reloads open tabs. Production is byte-identical.
4. **Diagrams instead of emoji for iconography.** 🧾/💸/📷/⌨️ replaced with SVGs
   that draw the operation (expense fans one payer out to three shares; payment
   is one node to one node). Sparkles were specifically avoided for ItreAI — ✨
   is the generic "this is AI" signal and says nothing about the feature.
5. **The system font stack stays for UI text.** On iOS `-apple-system` resolves
   to SF Pro, which *is* the native face; a webfont there is the fastest way to
   feel non-native. Instrument Serif is scoped to balance amounts only.
6. **Light-only.** Cream Sode has no honest dark translation, and supporting one
   would double the token surface. Tokens are structured so a `[data-theme]`
   block could be added later.

### Verification
- `tsc --noEmit` clean; `test:simplify` 10/10, `test:allocation` 10/10,
  `test:security` 26/26.
- `test:settlement` **fails on an RLS statement PGlite can't parse — this
  predates these changes** (confirmed by stashing the whole branch and
  re-running). Not investigated here; no UI code touches it.
- `next build` passed earlier in the session. Note: running it against a live
  dev server clobbers `.next` and leaves the server serving mixed new-JS /
  old-CSS, which looks exactly like "the palette didn't apply". Use `tsc` plus
  the suites while a dev server is up; `touch src/app/globals.css` forces a
  Tailwind recompile if the served CSS goes stale.
- Not verified: appearance on real hardware. Gesture thresholds (88px reveal,
  40px snap, 6px slop) and haptics are unexercised on a device —
  `navigator.vibrate` is a no-op on iOS Safari regardless.

### Not done (deferred from the original brief)
Hero/shared-element transitions from list row into detail, spring page
transitions for non-tab routes, native swipe-back (conflicts with
`PageSlider`'s horizontal tab paging — needs scoping to non-slider routes),
pull-to-refresh on `/transactions` and group detail, and a global 44pt audit.

## 2026-08-01 — Native app feel: touch/scroll polish, pull-to-refresh, and offline support

Closes the "PWA manifest + service worker for offline capability" item from
the backlog, plus a pass on making touch interaction feel native rather than
web-in-a-wrapper.

### Done

**Touch/scroll polish:**
- `overscroll-behavior: none` on `html, body` and `overscroll-behavior:
  contain` on `.page-slide` (the actual scroll container inside
  `PageSlider`) — kills the rubber-band bounce/pull-to-refresh-chain that
  reads as "website," not "app."
- `touch-action: manipulation` + `-webkit-tap-highlight-color: transparent`
  on buttons/links/`[role="button"]` — belt-and-suspenders on top of the
  existing `userScalable: false` viewport meta for the 300ms tap delay, and
  removes the gray tap flash.
- Cash-rain / falling-Gandhi animations (`.raining-cash`, `.falling-gandhi`
  on the home/groups balance cards) were animating `top`, which is
  layout/paint work every frame across up to 30 elements. Converted both
  keyframes to `transform: translateY()` — same motion, GPU-accelerated.

**Pull-to-refresh (`src/components/PullToRefresh.tsx`):**
- Custom gesture (native pull-to-refresh is disabled by the
  `overscroll-behavior` change above): tracks touch drag when the nearest
  `.page-slide` ancestor is at `scrollTop: 0`, shows a resistance-curved
  spinner, and awaits an `onRefresh()` callback past a threshold.
- Wired into Home, Groups, and Activity pages. Each page's inline fetch
  effect was extracted into a reusable `loadData()` so it can be re-invoked
  from the pull gesture — also fixed a latent bug where refreshing groups
  data would silently reset the home page's selected group back to index 0.

**Offline support:**
- `public/manifest.json` had no `icons` array — Chrome/Android's
  installability check requires at least 192×192 and 512×512, so the app
  currently could not be installed via the standard prompt at all. Generated
  a vector owl-mark icon set (`public/icons/`: 192, 512, 512-maskable,
  apple-touch-icon) via `sharp` (already a transitive dep through
  `next/image`) rendering hand-written SVG — no emoji-font rendering
  dependency, no new package. Wired into `manifest.json` and
  `layout.tsx`'s `metadata.icons`/`appleWebApp`.
- `public/sw.js` — app-shell service worker: cache-first for same-origin
  static assets (populated opportunistically as the app is used, plus a
  small precache list on `install`), network-first-with-cache-fallback for
  `/api/*` GET responses. Non-GET requests and cross-origin calls (Supabase,
  Gemini) are never intercepted — this app does not support offline writes,
  and a cached mutation response would be actively wrong. Cache is versioned
  by a `CACHE_VERSION` string bumped manually on shell changes (no
  build-hash wiring yet). Registered from `AppShell.tsx`.
- `OfflineBanner.tsx` — persistent top bar on `online`/`offline` events.
  Threaded through a `--offline-banner-h` CSS variable so the fixed header
  and page content shift down when it appears, instead of overlapping
  (touches `globals.css`, `PageSlider.tsx`'s inline padding, and the
  header's `top` in `AppShell.tsx`).

### Architecture decisions
1. **Data caching is read-only and unlabeled beyond the global banner.**
   `/api/*` GETs get cached so offline shows the last-synced balances/groups/
   activity instead of an error, but there's no per-card "last synced Xm
   ago" timestamp — the one global offline banner was judged sufficient
   signal that numbers may not be current, without touching every page's
   data-rendering code.
2. **No offline write queueing.** Creating transactions/groups/payments
   still requires a live connection and fails the same way it did before
   this change. Queueing writes (IndexedDB + replay on reconnect) was
   scoped out as a separate, materially larger feature — iOS Safari's
   Background Sync support is also unreliable, so it would need a manual
   "retry on next open" fallback regardless.
3. **Manual cache versioning over build-hash wiring.** Next.js content-hashes
   JS/CSS chunk filenames per build, so a hand-written shell precache list
   can't enumerate them. Runtime cache-first population (assets get cached
   the first time they're fetched, not upfront) sidesteps needing that list
   to be exhaustive; `CACHE_VERSION` just needs a manual bump when shell
   behavior changes meaningfully enough to invalidate old entries.

### Verification
- `tsc --noEmit` clean.
- Dev server smoke test: `/`, `/sw.js`, `/manifest.json`, and
  `/icons/icon-192.png` all serve 200; manifest JSON shape confirmed with
  the icons array present.
- Not yet verified: actual offline behavior end-to-end (service workers only
  activate on HTTPS/localhost after a prior successful online visit, and
  dev-mode hot reload fights with SW caching) — needs `next build && next
  start` plus DevTools' offline throttle, or a real deploy, to confirm.

## 2026-07-27 — Multi-step transaction wizard with receipt scanning

Replaced the 1000+ line single-page Add Transaction form with a focused,
multi-step wizard. Each step asks 1–2 questions, mirroring how Splitwise
and similar apps guide users through expense/payment entry. Receipt
scanning (ItreAI) is now a first-class branch of the wizard rather than
a separate page.

### Done
- **Wizard shell (`AddTransactionWizard.tsx`)** manages all transaction
  state and renders the active step. Progress bar shows "Step X of Y"
  where Y is 3 for payments, 6 for expenses. Cancel button resets all
  state and returns to step 1 (previously called `router.back()`).
- **Step components** live in `src/components/wizard/`:
  - `Step1_ChooseType` — Expense 🧾 vs Payment 💸 cards
  - `Step2_InputMethod` — Scan Receipt 📷 vs Enter Manually ⌨️
  - `Step2_PaymentDetails` — amount, date, group, recipient (payment flow)
  - `Step3b_ManualExpenseDetails` — title, amount, date, group (manual)
  - `Step3_ScanDetails` — title, date, group with amount shown read-only
    (scan flow; amount comes from the extraction, not user input)
  - `Step3_ExpensePeople` — who paid + participants (UserPicker x2)
  - `Step3_ScanProcessing` — legacy extraction preview (kept, unused in
    current flow)
  - `Step4_SplitMethod` — Even/Custom split (manual flow)
  - `Step4_ItemAssignment` — wraps `ItemAssigner` for scan flow
  - `Step5_Review` — summary card + save button (both flows)
- **Scan flow integrates `ItemAssigner`** (the "pass the phone" item
  allocation screen). After scanning → naming → selecting participants,
  the user assigns receipt items to people. The assignment results
  (`totals` per participant) feed directly into the transaction's
  `participants` array on save — no even/custom split needed.
- **Manual flow** keeps the existing Even/Custom split with `SplitInput`.

### Fixed
- **File upload field name**: `Step2_InputMethod` was sending the image
  as `"image"` but the API expects `"file"` — scans silently failed with
  "no file uploaded."
- **Amount not pre-filling after scan**: the `onScan` callback received
  the full API envelope `{ success, data }` but code read `data.total`
  (doesn't exist). Fixed to read `response.data.total_price`.
- **`inputMethod` never set to `"scan"`**: clicking the Scan Receipt
  card only flipped local `showScan` state, so step 3 rendered the
  manual-entry component (with amount input) instead of the scan
  details component. Now calls `onMethodChange("scan")` on click.
- **UserPicker toggle deadlock for "who paid"**: `selectedUserIds={[paidBy]}`
  passed `[""]` when `paidBy` was empty, which broke `toggle()` — once
  deselected, the user couldn't be reselected. Fixed to pass `[]` when
  empty.
- **Step 3 Next button disabled**: validation required `selectedGroupId`
  even when no groups existed or hadn't loaded yet. Relaxed to
  `title && (selectedGroupId || groups.length === 0)`.
- **Payment flow had no review step**: `case 3` in the step switch
  returned `null` for payments, so clicking Next did nothing. Added
  `Step5_Review` rendering for `txType === "payment"` at step 3.
- **Recipient dropdown hidden for payments**: the "Paying to" selector
  only rendered when `groups.length === 0`. Now always shows, populated
  from the `users` array (excluding the current user).
- **`handleNext` capped at step 5**: hardcoded `if (step < 5)` blocked
  the expense flow from reaching the review step. Changed to use
  `txType`-aware max (3 for payment, 6 for expense).
- **TypeScript errors blocking build**: `MouseEvent` signature mismatch
  in `groups/page.tsx` drag handlers; missing `setGroups`/`setUsers`
  state setters in the wizard; invalid `single` prop on `UserPicker`.

### Architecture decisions
- **Single wizard, conditional branches.** One `AddTransactionWizard`
  component owns all state and switches on `step` + `txType` +
  `inputMethod`. Avoids a separate payment page or scan page, and lets
  the cancel button reset everything in one place.
- **Scan vs manual diverge at step 3.** Both share steps 1–2 (type →
  method), then split: scan goes to `Step3_ScanDetails` (read-only
  amount) → people → item assignment; manual goes to `Step3b_ManualExpenseDetails`
  (editable amount) → people → split method. Both converge at `Step5_Review`.
- **Item assignment results stored as `assignmentResults`, not folded
  into `splitValues`.** The scan flow's per-person totals come from
  `ItemAssigner`'s `computeAllocation`, which is a different code path
  from the manual `SplitInput`. Keeping them separate avoids shoehorning
  item-level math into the even/custom split state.

## 2026-07-24 — Merge master (timing body + waterfall fix) into UI-Changes

Second master → UI-Changes merge of the day: master's two new commits
(`_timing` in response bodies + homepage ranking waterfall removal) meet
the redesigned homepage.

### Done
- **Conflict resolution: `GroupSummary` ships `memberBalances`, not
  `downBadRanking`.** Master killed the homepage's dependent
  `/api/groups/[id]` fetch by shipping the debtors-only ranking inside
  `/api/groups`; but the UI-Changes homepage needs **every** member's net
  (hero card ranks you among creditors too; the leaderboard chart is
  bidirectional). Same zero-extra-queries trick, superset payload: the
  nets `getGroupsForUser` already computes go out as `memberBalances`,
  and the debtors-only field is dropped from the summary (no consumer
  left; `downBadFromNets` remains for the group page). The redesigned
  homepage keeps its look but reads the groups payload — no second fetch,
  and group-picker switches stay instant.
- Everything else merged clean: timer threading in `getGroupsForUser`
  coexists with UI-Changes' `displayOrder` ordering; `_timing` routes and
  Speed Insights came through untouched.

### Verification
- `tsc --noEmit` clean; `test:simplify` 10/10, `test:allocation` 10/10,
  `test:settlement` 8/8, `test:security` 26/26; `next build` passes.

## 2026-07-24 — Merge master (auth + perf) into UI-Changes

UI-Changes (iOS-style UI overhaul + transaction wizard, branched before the
auth/perf work) merged with master's 9 commits: dual-mode auth, group
invites, the N+1 batching rounds, and Server-Timing.

### Done
- **Migration renumbered.** Both sides had created an idx-1 migration:
  master's `0001_thick_sasquatch` (users.auth_id) + `0002_sweet_maelstrom`
  (group_invites), and UI-Changes' `0001_last_avengers`
  (groups.display_order). Master's numbering is canonical (already deployed
  via `db:migrate:deploy`), so the display_order migration was deleted and
  regenerated from the merged schema as `0003_wise_elektra` — identical SQL,
  new slot. Anyone who ran `0001_last_avengers` locally must roll it back
  (`ALTER TABLE groups DROP COLUMN display_order`) before migrating, or the
  0003 apply will fail on the existing column.
- **AppShell = both intents**: master's server-verified session gate
  (LoginScreen / sign-out) wrapped around UI-Changes' PageSlider navigation
  and translucent header.
- **`GET /api/groups/[id]`** kept master's one-fetch `getGroupPage()` route;
  its payload already contains the `memberBalances` the new UI reads (plus
  `downBadRanking`, which UI-Changes had dropped — harmless extra, no extra
  query).
- **`getGroupsForUser`** kept master's parallel ledger fetch, ordered by
  UI-Changes' `display_order` instead of `created_at`.

### Fixed
- **`PUT /api/groups/reorder` trusted a client-sent userId** — the pattern
  master's auth work eliminated everywhere else. It came through the merge
  without textual conflict, so it compiled but bypassed session identity.
  Now `getCurrentUser()` + `unauthorized()` like every other route; the
  groups page no longer sends `userId`.

### Verification
- `tsc --noEmit` clean; `test:simplify` 10/10, `test:allocation` 10/10,
  `test:settlement` 8/8, `test:security` 26/26; `next build` passes.

## 2026-07-24 — Homepage: kill the ranking request waterfall

The `_timing` instrumentation made the deferred frontend waterfall visible
in the wild: on staging the homepage's ranking request
(`GET /api/groups/[id]`) consistently landed a full round trip after
`/api/groups` and `/api/balances`, because it can't start until the groups
response supplies `selectedGroupId`.

### Done
- **`GroupSummary.downBadRanking`** — `getGroupsForUser` already computed
  every member's net per group (`computeMemberNets`) just to pluck out
  `yourNet`; it now also returns the debtor ranking derived from those same
  nets. Zero extra queries — the group page's formula extracted into a
  shared `downBadFromNets()` used by both `getGroupsForUser` and
  `getGroupPage`.
- **Homepage second fetch deleted.** The ranking `useEffect` in
  [src/app/page.tsx](src/app/page.tsx) is gone; the ranking is read
  straight off the groups payload. One fewer request per homepage load
  (on staging that's ~1–2 s of serialized latency), and switching groups
  in the picker is now instant instead of a fetch per switch.

### Verification
- `tsc --noEmit` clean; `test:simplify` 10/10, `test:allocation` 10/10,
  `test:settlement` 8/8, `test:security` 26/26; `next build` passes.

## 2026-07-24 — Timings in the response body (Vercel strips Server-Timing) + Speed Insights

The Server-Timing headers added for the perf work show up fine on localhost
but are stripped by Vercel's proxy, so deployed requests had no visible
phase breakdown — exactly where the numbers matter. Since we control both
ends of every API call, the fix is to carry the same marks in the JSON
payload, which nothing can strip.

### Done
- **`ServerTimer.toJSON()`** ([src/lib/server-timing.ts](src/lib/server-timing.ts))
  — same marks as `headers()` but as `{ auth: 12.3, db: 45.6, total: 60.1 }`.
  The five instrumented GET routes (`/api/groups`, `/api/groups/[id]`,
  `/api/balances`, `/api/transactions` list, `/api/auth/me`) now return
  `_timing: t.toJSON()` in the body **alongside** the header (header still
  works on localhost). `_timing` only exposes phase durations — no query
  text or data — so it's safe to leave on in prod.
- **`db` bucket split for the group page.** `getGroupPage`/`getGroupLedger`
  accept an optional `ServerTimer`; the route threads its timer through, so
  the group-page `db` mark decomposes into `db.group` / `db.members` /
  `db.txs` / `db.settlements`. The legs run in parallel, so the sub-marks
  overlap (per-query wall times, not additive). Only single-ledger callers
  thread a timer — `getGroupsForUser` fetches many ledgers concurrently and
  passes none.
- **`timedFetch()`** ([src/lib/timed-fetch.ts](src/lib/timed-fetch.ts)) —
  client-side fetch wrapper that pairs `_timing.total` (in-function time)
  with the browser's resource timing (`responseStart − requestStart` =
  TTFB, which survives Vercel) and backs out
  `network = ttfb − server total` — the pipe + Vercel queue/cold-start
  segment that the header used to hide. `console.table` output gated behind
  test mode (`NEXT_PUBLIC_DEBUG_UI=true`), silent otherwise. Available as a
  drop-in; call sites not rewired yet.
- **Vercel Speed Insights** — `@vercel/speed-insights` installed,
  `<SpeedInsights />` rendered in the root layout. Gives real-user TTFB /
  Web Vitals per route on deploys (needs Speed Insights enabled once in the
  Vercel dashboard; the component no-ops locally).

### Architecture decisions
1. **Body over header for deploy-visible timings.** We own every consumer
   of these APIs, so `_timing` in the payload beats fighting the proxy;
   the header stays because DevTools renders it natively on localhost.
2. **Timer threaded as an optional param, not ambient state.** Actions stay
   pure-ish and callable without a request context; `timed(t, …)` no-ops
   when no timer is passed, so nothing changes for untimed callers.

### Verification
- `tsc --noEmit` clean (after clearing a stale `.next` from a branch
  switch); `test:simplify` 10/10, `test:allocation` 10/10,
  `test:settlement` 8/8, `test:security` 26/26; `next build` passes.

## 2026-07-23 — Perf round 2: transactions/balances N+1s, one-fetch group page, single auth round trip

Follow-up to the groups.ts batching — Vercel was still slow because three
more hot paths had the same serial-query shape, plus every API request paid
auth twice.

### Done
- **`getTransactions` batched** (the worst offender — untouched last round).
  Per transaction it ran items + participants + payer + one query *per
  participant user* + one *per assignment user* + group name: ~180 serial
  round trips for a 20-tx ledger. Now three stages of IN queries (txs →
  items ∥ participants ∥ assignments-joined-to-items → users ∥ groups)
  regardless of list size.
- **`getBalance` batched** (homepage fetch #1; the earlier attempt was
  reverted before landing). Participants for all transactions in one IN
  query — the scan is unscoped (every group) for the overall balance —
  and all counterparty user rows in one IN query.
- **`GET /api/groups/[id]` = one ledger fetch.** New `getGroupPage()`
  computes detail + pairwise + transfer plan + down-bad ranking from a
  single parallel (members, txs, settlements) trio; the route previously
  called three actions that each re-fetched the ledger, plus a separate
  `areGroupMembers` query (membership now checked against the fetched
  members). `getGroupDetail`/`getGroupDownBadRanking` folded in;
  `getGroupTransferPlan` kept (settlements/optimize uses it) sharing a pure
  `planFromNets`.
- **Middleware skips `/api`.** It ran `supabase.auth.getUser()` (a network
  round trip to the auth server) on every API request, and then
  `getCurrentUser()` verified again inside the route — double auth per
  request. Route handlers can write refreshed session cookies themselves
  (the server client's setAll works there), so pages keep middleware
  refresh and API routes verify exactly once.

### Not fixed (known, deferred)
- Frontend waterfalls: AppShell gates every page behind `/api/auth/me`,
  and the homepage waits for `/api/groups` before fetching the ranking.
- Activity feed resolves names with serial per-row lookups.
- Staging latency: functions are pinned to syd1 (production's region);
  staging's DB is in Mumbai and pays ~140 ms per round trip by design.
- "Group not found" flash on back-navigation (loading gate tied to the
  wrong fetch — see previous entry).

### Verification
- `tsc --noEmit` clean; `test:simplify` 10/10, `test:allocation` 10/10,
  `test:settlement` 8/8 (directly exercises the rewritten `getBalance`),
  `test:security` 26/26; `next build` passes.
- Live smoke test: overall balance per-person amounts verified against
  hand-computed seed math; group page nets/pairwise/plan identical to
  pre-refactor plus correct ranking; ledger transactions carry correct
  participants/shares/group names; non-member group access still 404s.

## 2026-07-23 — Perf: kill serial N+1 queries in group actions, pin Vercel region

Vercel deploys were slow loading any balance-bearing page. Root cause: the
group actions were written as many small sequential queries — invisible
against localhost Postgres (sub-ms round trips) but multiplied by real
network latency on Vercel, worst when the function region didn't match the
Supabase region. A user in G groups with N transactions each paid roughly
`(N + 7) × G` serial round trips just to render the groups list.

### Done (`src/lib/actions/groups.ts` restructure)
- `getGroupSimpleTransactions` — participants now fetched with **one IN
  query** for all of a group's transactions instead of one query per
  transaction (the dominant cost; previously `1 + N` serial round trips).
- `getMembers` — single join query (was two round trips: ids, then users).
- New pure `computeMemberNets(members, txs, settlements)` + shared
  `getGroupLedger(groupId)` that fetches the (members, transactions,
  settlements) trio **in parallel**. `getGroupNetBalances`,
  `getGroupTransferPlan`, `getGroupDetail`, and `getGroupsForUser` are all
  thin wrappers over it now — each endpoint fetches the ledger exactly once
  (getGroupDetail previously fetched it ~3× via nested helpers; the
  transfer plan fetched members twice).
- `getGroupsForUser` — groups processed with `Promise.all` instead of a
  serial for-loop; transaction count reuses the ledger's rows (dropped the
  separate per-group count query and duplicate `getMembers` call).
  Groups-list wall time is now ~4 round trips regardless of group count.
- `vercel.json`: `"regions": ["syd1"]` — colocated with the **production**
  Supabase project (Sydney). Staging's Supabase project is in Mumbai; staging
  and production are one Vercel project (branch-based Preview/Production
  environments), and Vercel's function region is project-level only — no
  per-environment or per-branch override exists (confirmed against Vercel's
  docs). So this is a deliberate compromise: production gets the colocation
  win, staging keeps eating cross-region latency. Splitting staging into its
  own Vercel project is the only way to give it a matching region too, if
  that's ever worth doing. Default was iad1 (US East), which matched neither.

### Verification
- `tsc --noEmit` clean; `test:simplify` 10/10, `test:allocation` 10/10,
  `test:settlement` 8/8, `test:security` 26/26; `next build` passes.
- Live smoke test: `/api/groups` and `/api/groups/group-japan` outputs
  verified against hand-computed seed values (nets, pairwise, transfer plan
  all identical to pre-refactor behavior).

### Known issue (not fixed here)
The group page briefly flashes "Group not found" when navigating back from
the payment/transaction pages: `loadData` in `groups/[id]/page.tsx` ties
`setLoading(false)` to the *transactions* fetch, so a slower *group* fetch
loses the race and the `!group` branch renders before data arrives. Faster
queries mask it but the loading gate is still wrong.

## 2026-07-23 — Group membership: add by exact email + shareable invite links

How people get into groups, replacing the browse-the-whole-user-table picker.
Model follows Splitwise/Splitpro: **no acceptance flow and no friendship
system** — an existing member adds someone by their exact email, or shares an
invite link the person uses to join themselves. Friendship-gated adds and
invite/accept state machines were considered and rejected as strictly more
work for more friction.

### Done

**Add by exact email:**
- `getUserByEmail()` in `users.ts` — case-insensitive **exact** match via
  `lower(email) =` (deliberately not `ilike`, whose `%`/`_` wildcards in user
  input would allow pattern probing). No substring/name search anywhere, so
  the user table can't be enumerated from the client.
- `POST /api/groups/[id]/members` now accepts `{ email }` (alongside the old
  `{ userIds }` for internal use): 404 `EMAIL_NOT_FOUND` with a "share the
  invite link instead" message, 409 `ALREADY_MEMBER` for duplicates. Actor
  must still be a signed-in group member.
- MembersSheet on the group page: the all-users `UserPicker` (which listed
  every account) is gone; replaced with an email input + "Copy invite link".
- **Mock mode keeps a "Quick add (local dev)" picker** below the email/link
  section — seeded users have fake emails nobody remembers, so local testing
  can still add anyone directly (sends the `userIds` body the API retains).
  Gated on `authMode() === "mock"`, so it never renders on staging/prod.

**Invite links (`group_invites` table, migration `0002_sweet_maelstrom`):**
- `token` (random UUID) is the whole credential; FK to group (cascade) +
  creator; `expires_at` TEXT timestamp, 7-day TTL. `POST
  /api/groups/[id]/invites` (members only) reuses the newest still-valid
  token so repeated copies don't mint rows.
- `GET /api/invites/[token]` — signed-in preview (group name/color, inviter,
  member count, alreadyMember). `POST` joins: idempotent for existing
  members, 404 for unknown/expired tokens.
- `/join/[token]` page — signed-out visitors hit the AppShell LoginScreen in
  place (URL preserved), then see a one-tap "Join group" preview card.
- New `member_joined` activity type ("Ben joined via invite link", 🔗) —
  distinct from `member_added` since the joiner is their own actor.

**OAuth deep-link return:** `signInWithOAuth` now passes
`?next=<current path>` to `/auth/callback`, which redirects there after the
code exchange (validated: must start with `/` and not `//`, else falls back
to `/`). Mock mode needed nothing — its sign-in reloads the current URL.

### Architecture decisions
1. **No acceptance flow.** Email add is instant (Splitwise semantics); the
   invite link *is* consent — the invitee performs the join themselves. If
   approval is ever wanted, it slots in as a pending flag on `group_members`.
2. **Invite link over user-creation-by-adder for unknown emails.** In
   supabase mode app users only exist after first OAuth sign-in, so email-add
   can't reach unregistered people; the link routes them through the normal
   sign-in (`resolveAppUser` creates/links the row) and then into the group.
3. **Token reuse per group.** One valid link at a time keeps the "copy link"
   button idempotent and limits stray live credentials; expiry (7 days)
   bounds link leakage instead of a revocation UI (deferred).

### Verification
- `tsc --noEmit` clean; `test:simplify` 10/10, `test:allocation` 10/10,
  `test:settlement` 8/8, `test:security` 26/26; `next build` passes.
- Live smoke test (mock mode): case-insensitive email add works, duplicate →
  409, unknown → 404 with invite-link hint; invite token reused across
  creates; non-member preview + join + idempotent re-join work; `member_joined`
  activity logged; bad token → 404; anonymous → 401; non-member invite
  creation and email-add → 403. DB reset to seed state afterwards.

## 2026-07-23 — Dual-mode auth: server-verified identity (Supabase OAuth / mock cookie)

Implements [docs/auth-implementation-plan.md](docs/auth-implementation-plan.md).
Identity is now **server-verified on every API request** — no route reads
`userId`/`actorId`/`creatorId` from the request body or query anymore. This makes
the per-group authorization checks (deferred from the 2026-07-18 security
hardening) real boundaries instead of spoofable ones.

### Done

**One codebase, two env-gated auth modes** (`src/lib/auth/mode.ts`):
- `mock` (local dev): identity from an httpOnly `mock_user_id` cookie resolved
  against the seeded users table. Active when `NEXT_PUBLIC_AUTH_MODE=mock` or
  when no Supabase env vars exist — so a plain local checkout works untouched.
- `supabase` (staging/prod): verified Supabase session (Google OAuth) mapped to
  an app user via the new `users.auth_id uuid unique` column (migration
  `drizzle/0001_thick_sasquatch.sql`). Activated purely by env vars set in
  Vercel, so the master → staging → production promotion flow needs zero
  per-branch edits.

**Auth core** (`src/lib/auth/index.ts`, server-only):
- `getCurrentUser()` — the single identity source. Supabase path calls
  `auth.getUser()` (JWT verified against the auth server, not just decoded)
  then `resolveAppUser`: match `auth_id` → else link existing row by verified
  email → else create the app user from the Google profile. Mock path reads the
  cookie and looks up the seeded user.
- `@supabase/ssr` clients (`src/lib/supabase/server.ts` / `client.ts`), OAuth
  callback (`src/app/auth/callback/route.ts`), and `src/middleware.ts` for
  session-cookie refresh (pass-through in mock mode).
- `GET /api/auth/me` (current user or null), `POST/DELETE /api/auth/session`
  (mock cookie set/clear; POST 404s in supabase mode).

**Route refactor — every route off request-supplied identity:**
- `GET /api/groups`, `/api/activities`, `/api/balances`, `GET /api/transactions`
  → scoped to `me.id`; client-sent `userId` params are ignored.
- `GET /api/groups/[id]` and single-transaction reads → members only, **404**
  (not 403) so ids can't be probed. Group-ledger reads and
  `GET /api/settlements/optimize?groupId=` → members only (403).
- `POST /api/groups` creator = `me.id`; `POST /api/groups/[id]/members` actor =
  `me.id` and must already be a member (403).
- `POST /api/transactions` → `me.id` must be a group member (alongside payer +
  participants); `DELETE /api/transactions?id=` → members only.
- `POST /api/settlements/mark-paid` → `me.id` must be payer or recipient — you
  can't invent payments between two other people.
- `POST /api/users` → mock mode only (supabase users are created by OAuth);
  `GET /api/users` open in mock mode (pre-login picker needs it), signed-in
  only in supabase mode. `POST /api/receipts/extract` → signed-in only (LLM
  cost). Debug routes unchanged (already env-gated).

**Frontend:**
- `AppShell` resolves the session via `/api/auth/me` before rendering any page
  and warms the `sessionStorage` cache `getSessionUser()` reads — so all pages
  keep working unchanged. Signed out → new `LoginScreen` (seeded-user picker in
  mock mode / "Continue with Google" in supabase mode). Header gained Sign out.
- `src/lib/session.ts` rewritten: cache is display-only, populated from the
  server session; `signOut()` is mode-aware. The old self-asserted
  `setSessionUser` picker path is gone (home page's `UserPickerPage` deleted).

**Deploy:**
- `vercel.json` buildCommand is now `npm run db:migrate:deploy && npm run build`.
  The new `scripts/db-migrate-deploy.ts` applies pending drizzle migrations
  before every Vercel build using `DIRECT_URL`/`DATABASE_URL`, and **skips
  (exit 0) when neither is configured** so preview builds of branches without
  DB env vars still build. Staging/production env vars live in the Vercel
  dashboard (Preview scope pinned to `staging` / Production scope).

### Architecture decisions
1. **Routes ignore client-sent ids instead of the frontend being rewritten.**
   The security boundary is server-side; pages still append `userId=` to some
   URLs and the server discards it. This kept the change surface to the routes
   + shell instead of ~11 pages of fetch rewrites.
2. **Mock identity is a cookie, not a request param.** Route code is
   byte-identical in both modes, so local dev exercises the exact production
   authz path (a spoofed body userId fails locally too).
3. **404 over 403 for group/transaction membership failures** — non-members
   can't distinguish "doesn't exist" from "not yours", so ids can't be probed.
4. **`auth_id` nullable + email-linking on first OAuth login** — seeded users
   keep working in mock mode, and a future real user whose email matches an
   existing row inherits it instead of forking a duplicate identity.

### Verification
- `tsc --noEmit` clean; `test:simplify` 10/10, `test:allocation` 10/10,
  `test:settlement` 8/8, `test:security` 26/26; `next build` passes.
- Live smoke test (mock mode, local Postgres): anonymous → 401 on protected
  routes; mock sign-in sets cookie and `/api/auth/me` reflects it; Alex reading
  a group he's not in → 404; Alex spoofing `?userId=user-you` on balances →
  response reflects Alex (param dead); non-member creating a transaction in
  Roommates → 400 NOT_GROUP_MEMBER; member create/delete + sign-out all work.

## 2026-07-22 — Major UI overhaul: iOS-style interactions and visual refresh

### Done

**Color palette refresh:**
- Updated entire app color scheme to match photo reference with blue-based theme
- Primary color: `#3a85c5` (blue accent from reference image)
- Background: `#f2f2fd` (light blue-gray tint)
- Text: `#2a2a2a` (soft black)
- Borders: `#b0b0b0` (medium gray)
- Cards: `#fbfbff` (off-white with subtle blue tint)
- All CSS custom properties in `globals.css` updated

**iOS-style group picker wheel:**
- Replaced native `<select>` dropdowns with custom `GroupPickerWheel` component
- Collapsed state: single group card with colored circle, name, chevron
- Long-press (300ms) expands to vertical scroll wheel
- Scroll wheel: translucent (`bg-white/70`) with backdrop blur, centered item highlighted
- Auto-centering on selection, smooth animations
- Applied to home page ("Most down bad" group selector) and "Add Transaction" page
- Uses group's assigned color for avatar circles

**Page transitions and spacing:**
- Added slide-up animation (700ms ease-out) to New Transaction and New Payment pages
- Pages now "layer on top" with smooth vertical slide from bottom
- Reduced top spacing on home page: `pt-6` → `pt-2` for tighter header-to-content gap

**Navigation refinements:**
- Bottom navigation bar made slimmer: `px-6 py-4` → `px-4 py-2`
- Fixed header at top showing "ItreSplit" branding
- Content spacing adjusted via `.content-with-nav` CSS class

**Transaction/Payment unified form:**
- Replaced "Paying someone back? Record a payment →" link with toggle
- Toggle switches between "Add Expense" (default) and "Add Payment" modes
- Single page with two modes instead of separate routes
- Form state resets appropriately when toggling between modes
- Combined save handler supports both transaction and payment creation

**Label and copy updates:**
- Transaction form: "Description" → "Title"
- Removed emojis throughout: scan button, debug labels, payment headers
- Scan receipt button: "Scan a receipt" → "Use ItreAI"
- Toggle buttons: "💰 Split expense" / "💸 Pay someone back" → "Add Expense" / "Add Payment"

**ItreAI button premium treatment:**
- Gradient background (primary → primary-hover)
- Animated flowing border: rotating gradient (purple → pink → blue) with blur
- Hover effects: scale to 105%, enhanced shadow, horizontal shine sweep
- Added sparkle emoji (✨) for visual appeal
- CSS animation `@keyframes gradientPan` for continuous 3s rotation

**Components added:**
- `src/components/GroupPickerWheel.tsx`: iOS-style picker with press-and-hold expansion

### Architecture decisions
1. **Component-based picker over native select** — custom component enables iOS-style interactions (long-press, scroll wheel) that native `<select>` cannot provide, while maintaining accessibility via keyboard/touch handlers.
2. **Unified transaction/payment form** — single route with mode toggle reduces navigation complexity and keeps split/payment features contextually adjacent; state reset on toggle prevents cross-mode contamination.
3. **CSS animations over JavaScript** — gradient border animation uses pure CSS (`@keyframes`) for performance and smoothness, avoiding requestAnimationFrame churn.

### Verification
- All UI changes tested interactively in dev mode
- Color palette applied consistently across all pages
- Group picker works on home page and transaction form
- Transaction/payment toggle functions correctly
- Slide-up animations smooth at 700ms duration
- No TypeScript or build errors

## 2026-07-19 — Full PostgreSQL migration (feature/postgres-migration)

### Done
**Database layer (SQLite → Postgres):**
- `schema.ts` rewritten from `sqlite-core` to `pg-core`: `real` → `doublePrecision`,
  `integer({ mode: "boolean" })` → `boolean`, all 16 indexes from the old
  hand-written DDL declared in-schema. Timestamps stay TEXT
  (`YYYY-MM-DD HH:MM:SS`, UTC) via a `to_char(timezone('utc', now()), ...)`
  default so string-sorting and the `settledAt = "PAID"` sentinel behave
  exactly as before.
- Driver: `better-sqlite3` → `postgres` (postgres.js) with `prepare: false`
  (compatible with Supabase's transaction-mode pooler). `@electric-sql/pglite`
  added as a dev dep for tests.
- **`getDb()` is connection-only now.** Migrate/seed no longer run at
  connection time — no DDL in the request path, no auto-seed race, and a
  concurrent first request can't observe a half-migrated database.
- Migrations are versioned drizzle-kit SQL files (`drizzle/0000_init.sql`),
  generated with `npm run db:generate`, applied with `npm run db:migrate`
  (prefers `DIRECT_URL` for DDL). Old runtime `migrate.ts` (PRAGMA-based,
  one-time wipe logic) deleted.
- `npm run db:seed` is the explicit seed path — same demo data, async, no-op
  when users exist, **refuses to run when `NODE_ENV=production`**.

**Actions layer — all six modules async:**
- `.all()`/`.get()`/`.run()` (better-sqlite3 sync API) replaced with awaited
  queries; `.get()` → `rows[0]`; `result.changes > 0` → `.returning()` length
  (`deleteTransaction`, `markSettled`).
- `db.transaction(() => ...)` → `db.transaction(async (tx) => ...)` **using the
  `tx` client inside** — with the sync driver, using the outer `db` in the
  callback worked; with an async pg driver it would silently run outside the
  transaction (`createTransaction`, `createGroup`).
- `getBalance(userId, _db?, groupId?)` keeps its injectable-db signature for
  the test suite.
- All 14 API route handlers await the now-async actions.

**Debug endpoints ported:**
- `POST /api/debug?action=reset` uses `TRUNCATE ... CASCADE` + re-seed instead
  of `PRAGMA foreign_keys = OFF` + per-table DELETEs.
- `delete-all-transactions` deletes in FK order and nulls
  `settlements.transaction_id` (settlements survive the purge, as before).

**Settlement test suite → PGlite:**
- `run-settlement-tests.ts` now uses in-memory PGlite (Postgres-in-WASM) with
  the real generated migrations applied via `drizzle-orm/pglite/migrator` —
  still fully self-contained, no server or local Postgres needed. One shared
  instance with `TRUNCATE ... CASCADE` between fixtures.

**Setup scripts:**
- `setup.sh` / `setup.ps1`: dropped the C++ build-tools checks (no native
  addon anymore); added Postgres 16 install/verify (brew / winget), database
  creation, `DATABASE_URL` written into `.env.local`, and `db:migrate` +
  `db:seed` steps.
- README, CLAUDE.md, and the dev-tools skill updated for the Postgres
  workflow.

### Fixed
- **`getFriends()` friend lookup was broken for >1 friend** — it built
  `and(eq(users.id, a), eq(users.id, b), ...)`, which can never match a row
  (the comment said "OR chain" but the code used `and`). Now uses `inArray`.

### Architecture decisions
1. **Timestamps stay TEXT** — converting to native `timestamp`/`boolean`
   sentinels (`settledAt`) is a separate refactor; keeping the SQLite-era
   formats made this a pure driver swap with zero behavior change.
2. **Money stays `doublePrecision`** — `numeric(10,2)` is the correct type but
   changes every arithmetic path; deferred (noted as debt).
3. **Migrate at deploy, seed by hand, connect at runtime** — three lifecycle
   stages instead of one function, so production can never auto-seed and the
   runtime DB user never needs DDL rights.
4. **PGlite for tests** — keeps the settlement suite dependency-free (works in
   CI and on machines without Postgres) while testing against a real Postgres
   engine, not SQLite semantics.

### Verification
- `tsc --noEmit` clean; `test:simplify` 10/10, `test:allocation` 10/10,
  `test:settlement` 8/8 (on PGlite), `test:security` 26/26; `next build` passes.

## 2026-07-18 — Security hardening: auth-independent fixes (debug lockdown + input validation)

Done on branch `worktree-security-hardening`. Scope deliberately limited to fixes
that **don't depend on knowing who the caller is** — i.e. that hold up even under
the current spoofable `userId` identity model. Per-group authorization checks were
intentionally left out and deferred to the auth work (see below).

### Fixed
1. **Unauthenticated destructive / data-dump endpoints (critical).**
   `GET /api/debug` dumped every user + transaction; `POST /api/debug?action=reset`
   wiped and re-seeded the whole DB; `POST /api/debug?action=delete-all-transactions`
   and `DELETE /api/transactions?all=true` deleted all transactions — all with **no
   gating**, so any anonymous request could nuke or exfiltrate the entire database.
   Added [`src/lib/debug-guard.ts`](src/lib/debug-guard.ts) (`debugEndpointsEnabled()`,
   reads the **server-only** `NODE_ENV` / `ALLOW_DEBUG_ENDPOINTS`, never a
   `NEXT_PUBLIC_*` var so it can't be spoofed from the client bundle). The debug
   routes now 404 outside development; the `all=true` mass-delete returns 403.
   *(This is genuinely auth-independent: it gates on deploy environment, not caller
   identity.)*
2. **Money-field validation → balance corruption.** `totalAmount`, participant
   `shareAmount`, item `price`/`quantity`, and settlement `amount` were taken off JSON
   untyped. A negative total with negative shares passed the split-sum check and
   silently corrupted balances; settlement `amount: Infinity` passed `amount > 0`. Added
   `isNonNegativeMoney()` in [`src/lib/constants.ts`](src/lib/constants.ts) (finite,
   non-negative) and applied it in the transaction + settlement routes. Also clamped the
   transactions `limit` query param to 1–200 (was an unbounded/NaN `parseInt`).

### Deferred to the auth work (intentionally NOT implemented here)
Per-group authorization — restricting group detail (`GET /api/groups/[id]`), the group
ledger (`GET /api/transactions?groupId=`), and add-members (`POST /api/groups/[id]/members`)
to actual members — was **left out**. Those checks can only be real once identity is
server-verified; bolted onto the current self-asserted `userId`/`actorId` they're
trivially spoofable and give a false sense of protection. They belong in Phase 4 of
[`docs/auth-implementation-plan.md`](docs/auth-implementation-plan.md), enforced against
the authenticated user rather than a request param.

### Test suite (`npm run test:security`)
Added a dedicated suite so the security fixes have regression coverage that
**doesn't depend on the UI or HTTP layer**. The route validation logic was first
extracted into pure functions in [`src/lib/security.ts`](src/lib/security.ts)
(`transactionAmountsValid`, `settlementAmountValid`, `clampLimit`) so the routes
and the tests exercise the *same* code path — the same pattern as
`allocation.ts`. `debugEndpointsEnabled` in
[`src/lib/debug-guard.ts`](src/lib/debug-guard.ts) is already pure.

- Fixtures: [`src/lib/test-data/security-fixtures.ts`](src/lib/test-data/security-fixtures.ts)
  — 26 cases across four groups:
  - **transaction-amounts** — rejects negative total/share, NaN, Infinity, non-number,
    negative item price; accepts normal/zero/no-items.
  - **settlement-amount** — rejects zero, negative, NaN, Infinity, non-number.
  - **limit-clamp** — clamps to 1–200, falls back to 50 on missing/garbage input.
  - **debug-gate** — enabled in dev/test/undefined env, **blocked in production**,
    re-enabled only by explicit `ALLOW_DEBUG_ENDPOINTS`.
- Runner: [`src/lib/test-data/run-security-tests.ts`](src/lib/test-data/run-security-tests.ts);
  CLI: `scripts/run-security-tests.ts`; script: `npm run test:security`.
- Pure + in-memory (no server, no DB) — consistent with the other three suites, so
  UI/route refactors won't require touching these tests.

### Verification
- `tsc --noEmit` clean; `test:security` 26/26, `test:simplify` 10/10,
  `test:allocation` 10/10, `test:settlement` 8/8.
## 2026-07-19 — Payments: transactions of type "payment" (branch: payment)

### Done
**Payments as transactions:**
- `transactions.type` column added (`"expense"` default | `"payment"`), with an
  additive `ALTER TABLE` migration for existing DBs. A payment is stored as a
  transaction where the payer pays and the **sole participant is the recipient**
  for the full amount — so every balance path (group nets, transfer plan,
  pairwise, "down bad") folds payments in automatically with zero changes to
  the balance math.
- `POST /api/transactions` accepts `type`; payments are validated to have
  exactly one recipient who isn't the payer (`INVALID_PAYMENT` 400).
  Group-membership and split checks apply unchanged.
- Activity type `"payment"` logged on create (actor = payer, related user =
  recipient); Activity tab renders it as 💸 "You paid Alex $20" linking to the
  payment's transaction page.

**New payment page (`/payments/new`):**
- Deliberately distinct from the expense form: green money-transfer styling
  (emerald gradient hero, "You → recipient" avatar visual, big centered amount,
  green submit). Group + recipient (group members only) + amount + date.
- Deep-link prefills via `?groupId=&toUserId=&amount=`.
- Shows an owe/owed reference banner for the chosen recipient **based on the
  group's simplified settle-up plan** (`transferPlan` from `GET /api/groups/[id]`),
  with a one-tap "Pay $X" prefill. Plan-based (not pairwise) so it always
  matches the settle-up page's numbers.

**Entry points:**
- Group page ＋ FAB is now a two-option menu: 🧾 New transaction / 💸 Record a
  payment (backdrop + rotate animation).
- Transaction detail: "💸 Pay {payer} back $X" shortcut when you owe a share
  (prefills the payment page; the original transaction is untouched).
- Group settle-up: rows where you pay now deep-link to the prefilled payment
  page; "Mark paid" on rows where you receive still records a settlement.
- `/transactions/new` links to the payment page ("Paying someone back?").
- `TransactionCard` renders payments distinctly ("You paid Alex · Payment").

### Architecture decisions
1. **Payment = transaction, not settlement.** Balances are computed live from
   transactions + participants, so modeling a payment as payer→sole-participant
   makes it flow through every existing computation (including the settlement
   tests' `getBalance`) untouched. The settlements table still backs the
   receive-side "Mark paid" flow; both fold into group nets.
2. **Payment-page reference uses the transfer plan, not pairwise nets.** The
   two can differ (e.g. you owe Ben $11.75 directly but the plan routes a 5¢
   third-party debt straight to Ben, so *you* pay $11.70). Showing the plan
   number keeps the payment page consistent with settle-up and its prefill.

### Verification
- `tsc --noEmit` clean; `test:simplify` 10/10, `test:allocation` 10/10,
  `test:settlement` 8/8.
- Payment flow exercised against a live group ("Test group"): payment + plan
  amounts verified against a raw-SQL recomputation of pairwise vs. plan.

## 2026-07-17 — Groups feature: group-scoped transactions, activities feed, new app flow

### Done
**Database (schema + migrate):**
- New tables: `groups` (id, name, color, created_by), `group_members` (group ↔ user
  edges — users can be in many groups), `activities` (type, actor user, related user,
  amount, group, transaction, created_at).
- `transactions.group_id` and `settlements.group_id` added. Nullable at the DB level
  (so the in-memory settlement-test fixtures keep loading), but **required by the API**
  — every transaction must occur within a group, and payer + all participants must be
  group members (`NOT_GROUP_MEMBER` 400 otherwise).
- **One-time wipe migration**: a DB whose `transactions` table lacks `group_id`
  (pre-groups shape) is dropped entirely and re-seeded — per request, existing data was
  cleared rather than inventing group memberships for old rows.

**Seed (multiple test groups):**
- 5 users; 3 groups: *Itrenia Main Club* (all 5, red), *Roommates* (You/Alex/Ben, blue),
  *Japan Trip* (You/Chloe/Diana, yellow), each with 2 seeded transactions and matching
  activity rows.

**Backend actions:**
- `groups.ts` — create group (creator auto-member, random color), add members,
  `getGroupsForUser` (members + your net + settled flag), `getGroupDetail` (member
  nets, pairwise nets vs. you), `getGroupNetBalances` (transactions + PAID settlements),
  `getGroupDownBadRanking` (biggest debtor first), `getGroupTransferPlan`
  (minimizeTransfers scoped to the group, settlements included so paying updates the plan).
- `activities.ts` — `logActivity` + `getActivitiesForUser` (feed across all the user's
  groups with user/group/transaction names resolved). Logged on: transaction created,
  settlement paid, group created, member added.
- `balances.ts` — **rewritten to derive from transactions + settlements directly**
  (previously iterated friendships), with optional `groupId` scoping. Signature stays
  `getBalance(userId, _db?, groupId?)` so the settlement test suite is untouched (8/8 pass).
- `transactions.ts` — `groupId` on create + activity logging; `getTransactions({groupId})`
  returns the whole group ledger (members see all group transactions, not just their own).
- `settlements.ts` — `createAndMarkPaid(..., groupId?)` stamps the group and logs the
  settlement activity. Minimal-transfer calculation now happens **within group members**
  via `getGroupTransferPlan`, not across all people.

**API routes:**
- New: `GET/POST /api/groups`, `GET /api/groups/[id]` (detail + transferPlan +
  downBadRanking), `POST /api/groups/[id]/members`, `GET /api/activities`.
- Updated: `POST /api/transactions` requires `groupId` + membership check;
  `GET /api/transactions?groupId=`; `GET /api/balances?groupId=`;
  `GET /api/settlements/optimize?groupId=`; mark-paid accepts `groupId`;
  debug reset/delete-all clears the new tables (and the previously-missed
  `item_assignments`).

**Frontend (new flow per mock: Home / Groups / Activity bottom nav):**
- `BottomNav` tabs → Home `/`, Groups `/groups`, Activity `/activity`.
- **Home** — "Most down bad" ranking with a group selector (top-3 podium bars, ranked
  within the selected group, not across all friends) + overall balance card.
- **Groups** (`/groups`) — overall balance card, group rows (colored circle + name +
  your net), settled groups hidden behind a "Show settled groups" toggle, inline
  create-group form (name + participant picker; creator always included).
- **Group detail** (`/groups/[id]`) — members/balances/settle-up chips, pairwise
  "X owes you / You owe X" lines, group transaction ledger, floating ＋ that deep-links
  to `/transactions/new?groupId=`. Full-screen sheets: *Group Balances* (each member
  "gets back"/"owes") and *Members* (list + add participants).
- **Group settle-up** (`/groups/[id]/settle-up`) — the group's minimal transfer plan
  with Pay / Mark-paid on rows involving you (records settlement with groupId).
- **Activity** (`/activity`) — feed across all your groups (🧾 transaction, 💸 payment,
  ✨ group created, ➕ member added), each linking to the transaction/group.
- **New transaction** — group dropdown (preselected from `?groupId=`), participants and
  payer limited to that group's members (`UserPicker` got a `users` prop), redirects to
  the group page after save.
- `/friends` and `/settle-up` still exist but left the nav (superseded by group flows).

### Architecture decisions
1. **`group_id` nullable in SQLite, required at the API** — keeps the pure/in-memory
   test fixtures valid while enforcing "transactions occur within groups" where it
   matters. Membership is validated server-side on create.
2. **Balances stay computed, never stored** — group scoping is just a filter on the
   same raw-data computation; overall = all groups combined.
3. **Settlements are folded into group nets** (`+amount` payer, `-amount` recipient),
   so the transfer plan and "down bad" ranking react to mark-paid immediately.
4. **Group "settled"** = has ≥1 transaction **and** your net ≈ 0 — a brand-new empty
   group still shows in the active list instead of being hidden by the toggle.

### Verification
- `tsc --noEmit` clean; `test:simplify` 10/10, `test:allocation` 10/10,
  `test:settlement` 8/8 (settlement suite runs against the rewritten `getBalance`).
- DB deleted and re-seeded via the new migration path.

## 2026-07-06 — Initial prototype: receipt scanning

### Done
- Scaffolded Next.js 15 project with TypeScript, Tailwind v4, App Router (`src/` directory)
- Created typed Zod schemas mirroring the notebook's `receipt_schema`:
  - `MenuItem` (nm, cnt?, price) and `ReceiptExtractionResult` (menu + totals)
  - `.refine()` sanity check: total ≈ subtotal + tax + service - discount
- Built LLM client abstraction layer:
  - `LLMClient` interface for provider-agnostic receipt extraction
  - Factory `createLLMClient()` reads `LLM_PROVIDER` env var (defaults to gemini)
  - `GeminiClient` implementation using raw REST API (not SDK) to Gemini 2.0 Flash
  - Structured output via `responseMimeType: "application/json"` + `responseSchema`
  - Prompt matches the notebook's transcription-only design (no calculation/inference)
- Built exponential-backoff retry utility (`withRetry`) — retries on 429/503/RESOURCE_EXHAUSTED/UNAVAILABLE
- Created `POST /api/receipts/extract` endpoint:
  - Validates file presence, MIME type, size (≤10MB)
  - Calls Gemini → validates with Zod → returns structured JSON
  - Robust error mapping (400 for bad input, 502 for LLM failures, 500 for internal errors)
- Built frontend components:
  - `ReceiptUploader` — drag-and-drop zone + file picker, client-side validation
  - `LoadingOverlay` — spinner with backdrop
  - `ReceiptResult` — item table + totals summary
  - `ErrorAlert` — error card with retry button
- Scan page (`/scan`) with `idle → uploading → success | error` state machine
- Home page (`/`) with app overview and scan link

### Architecture decisions
1. **Raw REST API over SDK** — Using `fetch()` to Gemini's REST API instead of `@google/genai` SDK. Gives full control over `responseSchema` and request shaping; avoids SDK abstraction leaks.
2. **LLM client interface** — `LLMClient` in `lib/llm/types.ts` lets us add OpenAI/Anthropic providers by creating one file + one factory case. No other code changes.
3. **Zod as single source of truth** — Schema defines both runtime validation and TypeScript types. API route validates LLM output before returning to client.
4. **Exponential backoff** — 1s, 2s, 4s, 8s with jitter (vs. notebook's 15s linear). Better for production latency profiles.
5. **Frontend state machine** — Simple `idle | uploading | success | error` enum in the scan page. Maps cleanly to future loading/error/empty states.

## 2026-07-06 — Retry logic fix: distinguish daily quota from rate limits

### Fixed
- `withRetry()` now distinguishes **daily quota exhaustion** (429 with "quota" in body) from
  **per-minute rate limits** (429 with "rate limit" / "RESOURCE_EXHAUSTED"):
  - **Daily quota**: NEVER retried — fails immediately with the original error message
    so the user sees a clear message about enabling billing or waiting for reset
  - **Per-minute rate limit**: retried with ~13s delays (free tier: 5 req/min)
    instead of the old 1s–8s backoff which was too fast to clear the limit
  - **503 / UNAVAILABLE**: still retried with exponential backoff as before
- `GeminiClient.extractReceipt()` now separates the network-call retry from the
  response-parse step — the retry wrapper only wraps the `fetch()`, not JSON parsing

### Why
The free tier has a **daily request cap** (~50 requests/day). Hitting it returns 429
like any rate limit, but retrying is useless — the quota only resets ~24h after the
first request of the day. The old code tried 3x with 1s/2s/4s delays and then
returned a generic "LLM_FAILED" error, wasting 7 seconds and hiding the real cause.

## 2026-07-06 — Retry fix v2: Expose model config, check quota reality

The 429 "quota exceeded" error on a fresh key is likely one of:
- The free tier daily cap (as low as 50 req/day on new keys)
- `gemini-2.0-flash` being higher-demand with stricter limits
- The key still propagating (sometimes takes minutes before first request)

**Fix**: Switched default model to `gemini-2.5-flash` (same free tier availability,
often less contended). Made model configurable at construction for easy swapping.

## 2026-07-06 — Full Splitwise-like app flows (feature/full-app-flow)

### Done
**Database layer:**
- Created Drizzle ORM schema with 6 tables: `users`, `friendships`, `transactions`,
  `transaction_items`, `item_assignments`, `settlements`
- SQLite via `better-sqlite3` with auto-migration on startup
- Seed data: 5 users (You, Alex, Ben, Chloe, Diana) + friendships + 2 demo transactions
- Easy migration path to PostgreSQL (swap drizzle driver + schema dialect)

**Backend actions + API routes:**
- `users.ts` — CRUD, friend list, per-person balance computation
- `transactions.ts` — create (with items + assignments), query (with filters), delete
- `balances.ts` — net balance, owe/owed breakdown, top debtor/creditor (computed from raw data)
- `settlements.ts` — optimized settlement plan, mark-as-paid
- New API routes: `GET/POST/DELETE /api/transactions`, `POST /api/settlements/mark-paid`,
  `GET /api/balances`, `GET /api/users`
- Existing `/api/receipts/extract` integrated into transaction creation flow

**Frontend pages:**
| Page | Route | Key features |
|---|---|---|
| Home/Dashboard | `/` | Net balance card, owe/owed split, top debtor/creditor highlights, recent activity, quick actions. Also serves as session picker on first visit |
| Transactions | `/transactions` | Filterable list (payer dropdown, payee multi-select), deep-link support |
| New Transaction | `/transactions/new` | Choice between Scan receipt or Manual entry |
| Scan & Review | `/transactions/new/scan` | Upload → extract → review form (edit items, pick participants, split evenly) → save |
| Manual Entry | `/transactions/new/manual` | Description, total, date, participants, split toggle (even/custom with % or $ per-person), live remaining indicator |
| Transaction Detail | `/transactions/[id]` | Itemized breakdown with avatars, per-person totals, paid-by badge, settled/pending, mark-as-settled, delete with confirmation |
| Friends | `/friends` | Friend list with individual balances (owes you / you owe / settled) |
| Settle Up | `/settle-up` | Personalized view: who pays you / you pay, with Mark Paid buttons |

**Shared components:**
- `BottomNav` — 3-tab bar (Home, Transactions, Friends), hides on sub-pages
- `UserAvatar` — colored avatar circle with initials
- `UserPicker` — multi-select participant picker with avatar toggles
- `SplitInput` — even/custom split toggle, per-person $ and % inputs, live remaining indicator
- `BalanceCard` — headline net balance + owe/owed breakdown
- `TransactionCard` — summary row (title, amount, who paid, date, user share)
- `ConfirmDialog` — reusable confirmation modal with danger variant

**Architecture:**
- Session stored in `sessionStorage` (simple user picker on first visit)
- All balances computed from raw data (not stored), ensuring consistency on delete/edit
- Splitwise-like settlement optimizer (greedy max-debtor → max-creditor matching)
- Bottom nav with iOS safe-area padding
- No global state store — each page fetches its own data

## 2026-07-06 — Bugfix: navigation, validation, and redirect

### Fixed
1. **BottomNav now persistent** — Removed the `return null` condition that hid the
   navigation bar on `/transactions/new/*` and `/settle-up` sub-pages. Users can
   now always navigate between Home, Transactions, and Friends regardless of
   which flow they're in.

2. **Custom split validation** — Added both frontend and backend checks that the
   sum of all assignment amounts equals the item's total price:
   - **Backend** (`POST /api/transactions`): validates every item's assignment
     sums match its price within $0.01 tolerance. Returns `SPLIT_MISMATCH` error
     with a clear message showing the difference.
   - **Frontend manual** (`/transactions/new/manual`): validates split amounts
     against total *before* sending the API call, shows inline error.
   - **Frontend scan** (`/transactions/new/scan`): fixed a rounding bug where
     splitting by N people could leave unassigned pennies (last participant now
     gets the remainder).

3. **Redirect after save** — Both scan and manual flows now redirect to
   `/transactions` (transaction history list) instead of the individual
   transaction detail page. This matches the expected flow: after creating a
   transaction, see it in context with other transactions.

### Why
- Navigation bar was hidden on creation pages, leaving users with no way to
  go back to the main page without using the browser back button.
- Custom split amounts could be submitted without summing to the total,
  causing the transaction to save with incorrect balances.
- The rounding bug in the scan flow meant evenly-split items were off by
  pennies, which also triggered the backend validation.
- Redirecting to the detail page after creation was confusing — the user
  expects to return to the list where they can see the new transaction.

## 2026-07-06 — Bugfix: transactions not showing up, admin tools

### Fixed
1. **Transactions not appearing after save** — Two root causes:
   - `getTransactions()` only looked for transactions where the user has item
     *assignments*. If the user created a transaction but didn't assign any
     items to themselves (e.g., paid for friends only), the transaction was
     invisible to them. **Fix**: `getTransactions()` now also includes
     transactions where the user is the *payer*, regardless of assignments.
   - Manual entry didn't auto-include the current user in participants.
     **Fix**: `setSelectedParticipants([currentUser.id])` on page mount.

2. **Error messages centralized** — Created `src/lib/constants.ts` with all
   error codes (`CODES`), user-facing messages (`ERROR_MESSAGES`), and a
   helper function (`apiError()`). All 5 API routes and both transaction
   creation pages now reference this file instead of hardcoded strings.

### Added
3. **Delete all transactions** — `DELETE /api/transactions?all=true` removes
   all transactions, items, and assignments. Also accessible via
   `POST /api/debug?action=delete-all-transactions`.

4. **DB debug endpoint** — `GET /api/debug` returns counts and a listing of
   all users and transactions in the database for quick inspection.

5. **Full DB reset** — `POST /api/debug?action=reset` wipes everything and
   re-runs the seed data.

### Viewing SQLite data
```bash
# The database lives at: data/projectowl.db

# View via the debug API:
curl http://localhost:3000/api/debug

# Or open with any SQLite browser:
#   macOS:   brew install --cask db-browser-for-sqlite
#   Windows: Download DB Browser for SQLite (sqlitebrowser.org)
#   Then open: data/projectowl.db
```

## 2026-07-09 — Bugfix: transaction sort, persistent nav, validation, admin tools

### Fixed
1. **Transaction sort by creation time** — Changed from `transactionDate` (user-picked
   date) to `createdAt` (actual server timestamp with localTimezone formatting).
   `localTimestamp()` helper produces `YYYY-MM-DD HH:MM:SS` format matching SQLite's
   `CURRENT_TIMESTAMP`, so string sort works correctly in DESC order.
   Explicitly passes `createdAt: localTimestamp()` in `createTransaction` to guarantee
   uniqueness per transaction.

2. **BottomNav now persistent** — Removed the `return null` that hid navigation on
   `/transactions/new/*` and `/settle-up` sub-pages.

3. **Custom split validation** — Backend (`POST /api/transactions`): validates every
   item's assignment sums match its price within $0.01. Returns `SPLIT_MISMATCH` error.
   Frontend manual page: validates split totals against total *before* API call.
   Scan page: fixed rounding bug (last participant gets remainder pennies).

4. **Transaction not showing up after save** — Two causes fixed:
   - `getTransactions()` now includes transactions where user is the *payer* (not just
     assigned participant).
   - Manual entry auto-includes `currentUser.id` in participants on mount.
   - Redirect changed from `router.push` to `window.location.href` (forces full page
     reload to bypass Next.js client-side cache).

5. **Delete all transactions / full reset not working** — Switched from Drizzle's
   `.delete().run()` (which silently failed) to raw SQL `db.run("DELETE FROM table")`
   with `PRAGMA foreign_keys = OFF` to handle cascade constraints.

### Added
6. **Error messages centralized** — `src/lib/constants.ts` with `CODES` (error code
   constants), `ERROR_MESSAGES` (user-facing messages with template functions),
   `VALIDATION` (frontend validation messages), `apiError()` helper. All 5 API routes
   and both transaction creation pages now reference this file.

7. **Debug page** — `/debug` web UI showing DB counts, user list, transaction list
   with `createdAt` timestamps and assignment counts. Includes Refresh, Delete all
   transactions, and Full reset buttons.

8. **Debug API** — `GET /api/debug` returns counts + full transaction listing with
   `createdAt` and assignment counts. `POST /api/debug?action=reset` for full DB
   wipe+re-seed. `POST /api/debug?action=delete-all-transactions` for transaction-only purge.

9. **README updated** — All debug/admin API routes documented, SQLite viewing
   instructions added.

## 2026-07-13 — Unified scan + manual flow with item allocation (feature/unified-scan-and-manual-flow)

### Done
**Unified create flow:**
- Merged the separate `/transactions/new/scan` and `/transactions/new/manual`
  pages into a single `/transactions/new` page. Manual entry is the default;
  "Scan a receipt" is an optional action within the same form. The old routes
  now redirect (client redirect + `next.config.ts` redirects).
- After scanning, a full-screen **"pass the phone" item assigner**: an
  active-user selector sits at the top; each person taps their name, then taps
  the items they shared. All items start unassigned. Item prices stay editable.
- **Multi-quantity items** expand into a main row + one sub-row per unit.
  Tapping the main row assigns the active user to *all* units; tapping a
  sub-row toggles just that unit — so a "Ramen ×2" can go to two different
  people. Shares are therefore uneven-capable.
- After confirming, the receipt + allocation becomes a **read-only reference**
  card (items with their per-person assigned amounts). Buttons: **✎ Edit**
  (re-opens the assigner with prior per-unit state restored exactly) and
  **↺ Reset split to allocation** (re-applies the allocation to the custom
  split fields). The prefilled split stays editable.
- **Even split now resets** custom amounts; switching to Custom preserves them.
- **Paid by** can be any user, not only those in the split.

**Database:**
- Re-introduced the `item_assignments` table (item ↔ user ↔ shareAmount) to
  store the *raw* scan allocation alongside the (possibly-edited) participant
  split. The legacy one-time `item_assignments → participants` migration now
  only fires on the *old* schema shape (detected via a `transaction_id`
  column), so it no longer drops the new table.
- `createTransaction` persists item assignments; `getTransaction` /
  `getTransactions` return them with user names. The detail page shows the
  per-item assignment breakdown.

**Allocation math (pure + tested):**
- Extracted the allocation logic into a pure `computeAllocation()`
  (`src/lib/allocation.ts`) so the `ItemAssigner` UI and the tests share one
  code path — what the UI prefills is exactly what the tests verify.
- Test suite: 10 fixtures (`src/lib/test-data/allocation-fixtures.ts`), a
  runner, CLI `npm run test:allocation`, `GET /api/debug/allocation-tests`, and
  a viz section on `/debug` showing computed-vs-expected totals.

**Test mode (mock scan):**
- `npm run testmode` runs the dev server with `NEXT_PUBLIC_DEBUG_UI=true` and
  `NEXT_PUBLIC_MOCK_SCAN=true` (via `cross-env`). This unlocks a "🐛 Mock scan"
  toggle that loads canned receipts (`MOCK_RECEIPTS`) instead of calling the
  LLM, so the allocation flow can be exercised for free. Normal `npm run dev`
  leaves all debug tooling off. Toggles live in `src/lib/debug-config.ts`.

### Fixed
1. **Penny drift in allocation rounding (save-breaking).** Per-person shares
   were rounded independently, so they didn't sum back to the item price
   (e.g. $10 split 6 ways → $10.02). The prefilled split then failed the
   backend's `SPLIT_MISMATCH` check, making some receipts **unsaveable**.
   Fixed with **largest-remainder (Hamilton) rounding** so shares sum to the
   exact cent, with a per-item rotating tie-break so leftover pennies spread
   fairly across the receipt instead of always hitting the same person.
2. **Frontend split validation used the wrong participant set.** It summed all
   of `splitValues` but sent only `selectedParticipants`; removing someone from
   the picker after allocation could pass the frontend check then get rejected
   by the backend. Now validates over the same set it sends.
3. **Test hardening** — tightened the runner's conservation tolerance
   (0.02 → 0.005, which had *allowed* the drift bug), added a receipt-wide
   "total conserved (saveable)" check mirroring the backend validation, and
   added regression fixtures (`rounding-sixths`, corrected `rounding-thirds`).

### Next steps (future iterations)
- [x] PWA manifest + service worker for offline capability — see
      2026-08-01 entry (read-side only; no offline write queueing)
- [ ] Camera capture via `navigator.mediaDevices` for in-browser photo
- [ ] Real auth (Clerk / Supabase Auth) instead of sessionStorage
- [ ] Image pre-processing (compress oversized images, HEIC→JPEG)
- [ ] Receipt format templates (grocery, gas station, itemized vs totals-only)
- [ ] Equalize settlement flow (pay records actually persist in SQLite)
- [ ] Edit transaction (modify items, reassign, recalc balances)
- [ ] Real "Mark as paid" with persistent settlement records
- [ ] Filter by date range on transactions page
- [ ] Mobile-optimized touch interactions (swipe to delete, pull to refresh)

## 2026-07-14 — Calculator Keypad Implementation

### Done
**New component:**
- `CalculatorKeypad` — mobile-first numeric input with addition-only expressions
  - Bottom sheet design with slide-up animation and backdrop overlay
  - 4×4 button grid: 0-9, decimal point, addition operator, clear, backspace
  - Auto-calculates on exit (click outside or press ✕) — no enter button
  - Expression evaluation: `2.00+3.00+1.50` → `$6.50`
  - Live preview shows calculated result when `+` is used
  - Input validation: prevents multiple decimals in single number, consecutive operators
  - Keyboard shortcuts (desktop): 0-9, +, ., Backspace, Enter, Escape
  - Touch-friendly: 64×64px buttons with `touch-manipulation` to prevent zoom
  - Accessibility: ARIA labels on all buttons, high contrast colors

**Integrations:**
- Manual entry page (`/transactions/new/manual`) — total amount field
- SplitInput component (`/components/SplitInput`) — per-person amounts ($ and % modes)
- Scan page (`/transactions/new/scan`) — individual item price fields

**Technical implementation:**
- Expression evaluation: splits by `+`, parses each part, sums with 2-decimal rounding
- State management: `useCallback` for optimization, minimal re-renders
- CSS animations: slide-up on open, scale-down on button press
- Click-outside-to-close with proper event propagation handling

### Fixed
**Decimal button unresponsiveness:**
- Initial issue: Decimal validation checked `newExpr` (after adding decimal) instead of `prev` (before adding)
- Root cause: `lastPart.includes('.')` was always true since we just added the decimal
- Solution: Changed validation to check `prev.split('+')` before decimal addition

**Button sizing at different zoom levels:**
- Initial issue: `aspect-square` caused inconsistent sizing and touch targets
- Solution: Fixed dimensions `h-16 w-16` (64×64px) for consistent sizing
- Added `touch-manipulation` class to prevent browser zoom on double-tap

**UI/UX improvements:**
- Removed enter button for simpler interface
- Auto-calculate on exit instead of manual confirmation
- Click-outside-to-close functionality
- Better visual feedback with `active:scale-95` animations
- Larger fonts for readability (text-4xl display, text-2xl buttons)
- Modern design with `rounded-2xl` corners and improved color contrast

### Architecture decisions
1. **Auto-calculate on exit** — More intuitive than explicit enter button. Users naturally expect to see the result when they're done typing, not when they press a separate button.

2. **Fixed button dimensions** — Using `h-16 w-16` instead of `aspect-square` ensures consistent touch targets across all zoom levels and devices. Critical for mobile responsiveness.

3. **Addition-only expressions** — Kept scope minimal for v1. Addition covers 95% of expense splitting needs (e.g., "12.50+8.00" for two items). Future versions can add subtraction/multiplication.

4. **Individual keypad instances** — Each input field gets its own keypad state. This prevents data loss when switching between fields and allows concurrent editing of multiple amounts.

5. **Touch manipulation** — `touch-manipulation` CSS property prevents double-tap zoom and improves touch responsiveness, especially important for calculator apps with rapid button presses.

### Testing
✅ Decimal button works at all zoom levels
✅ Addition expressions calculate correctly
✅ Clear/backspace functionality works
✅ Click-outside-to-close saves result
✅ Individual keypads for multiple participants
✅ Dynamic item list handling
✅ Keyboard shortcuts work on desktop
✅ No TypeScript compilation errors
✅ Mobile touch interactions smooth

### Known issues resolved
- ❌ Decimal button unresponsiveness at certain zoom levels → ✅ Fixed validation logic
- ❌ Inconsistent button sizing across zoom levels → ✅ Fixed dimensions
- ❌ Large green "+" button → ✅ Consistent button sizes

### Future enhancements
- [ ] Subtraction support (- operator)
- [ ] Memory functions (M+, M-, MR)
- [ ] Complex expressions (parentheses, order of operations)
- [ ] Haptic feedback on mobile
- [ ] Sound effects for button presses
- [ ] Theme customization

## 2026-07-15 — UI Responsive Design & Transaction Sorting Fixes

### Fixed
1. **ItemAssigner responsive design for desktop** — The full-screen item assignment
   interface was taking up the entire screen width on desktop, making it hard to use.
   Added `md:max-w-3xl md:mx-auto` to constrain width to 768px on medium+ screens while
   maintaining full-screen mobile experience.

2. **Transaction sorting order on home page** — Recent transactions were sorted by
   `createdAt` (system entry time) instead of `transactionDate` (actual transaction date),
   causing confusing ordering. Changed `.orderBy(desc(schema.transactions.createdAt))`
   to `.orderBy(desc(schema.transactions.transactionDate))` so latest transactions by
   actual date appear at the top.

3. **Integrated calculator keypad from yf-feature-1 branch** — Merged the complete
   calculator keypad implementation with all expense entry flows, providing mobile-
   friendly numeric input with addition expression support.

### Technical Implementation
- **ItemAssigner.tsx**: Added responsive constraints with `md:max-w-3xl md:mx-auto`
- **transactions.ts**: Changed sort field from `createdAt` to `transactionDate`
- **CalculatorKeypad.tsx**: Full integration with auto-calculate on exit behavior

### Testing
✅ Desktop ItemAssigner now constrained to reasonable width
✅ Mobile ItemAssigner remains full screen (as intended)
✅ Home page transactions sorted by actual transaction date (newest first)
✅ Calculator keypad functional across all entry points

### Files Modified
- `src/components/ItemAssigner.tsx` - Responsive design fix
- `src/lib/actions/transactions.ts` - Transaction sorting fix
- `DEVLOG.md` - Implementation notes

## 2026-07-16 — User-friendly error messages across all API routes and frontend pages

### Done
**Centralized error pattern mapping:**
- Added `MAPPED_ERRORS` to `src/lib/constants.ts` — 15 pattern-to-message mappings covering:
  - SQLite `NOT NULL constraint failed` for transactions, users, and settlements
  - `FOREIGN KEY constraint failed` (invalid user references)
  - `UNIQUE constraint failed`
  - Generic database errors (connection, missing tables, corrupted DB)
  - Network/fetch errors (connection refused, JSON parse failures)
- Added `mapErrorMessage(err)` helper that checks a caught error against all patterns
  and returns a user-friendly string. Falls back to `"An unexpected error occurred"` when
  no pattern matches, so users never see raw SQL or internal error text.

**API routes — all 8 routes now use `mapErrorMessage()` in catch blocks:**
- `GET/POST/DELETE /api/transactions`
- `GET/POST /api/users`
- `GET /api/balances`
- `POST /api/settlements/mark-paid`
- `GET /api/settlements/optimize`
- `POST /api/receipts/extract`
- `GET/POST /api/debug`

Previously, a missing title would send `"NOT NULL constraint failed: transactions.title"`
to the frontend. Now it sends `"Transaction description is required."`
(The raw error is still logged server-side via `console.error`.)

**Frontend pages — error display for GET failures:**
Every page that fetches data from the API now shows an inline red error banner when
a GET request fails, instead of silently swallowing the error in `console.error`:

| Page | What fails | User sees |
|---|---|---|
| Home (`/`) | Balance or recent transactions | ⚠ error banner below greeting |
| Transactions (`/transactions`) | Transaction list + user filters | ⚠ error banner below header |
| Friends (`/friends`) | User list | ⚠ error banner below title |
| Settle Up (`/settle-up`) | Balance data | ⚠ error banner above summary |
| Transaction Detail (`/transactions/[id]`) | Single transaction load | Error text + "Try again" button |
| New Transaction (`/transactions/new`) | User list for pickers | Error shown in existing error slot |
| New Transaction (scan upload) | Network error during scan | Uses `mapErrorMessage()` instead of raw error |

**Files changed:**
- `src/lib/constants.ts` — Added `MAPPED_ERRORS`, `mapErrorMessage()`, import of `AppError`
- `src/app/api/transactions/route.ts` — 3 catch blocks updated
- `src/app/api/users/route.ts` — 2 catch blocks updated
- `src/app/api/balances/route.ts` — 1 catch block updated
- `src/app/api/settlements/mark-paid/route.ts` — 1 catch block updated
- `src/app/api/settlements/optimize/route.ts` — 1 catch block updated
- `src/app/api/receipts/extract/route.ts` — 1 catch block updated
- `src/app/api/debug/route.ts` — 2 catch blocks updated
- `src/app/page.tsx` — Error state + banner for GET failures
- `src/app/transactions/page.tsx` — Error state + banner for GET failures
- `src/app/friends/page.tsx` — Error state + banner for GET failures
- `src/app/settle-up/page.tsx` — Error state + banner for GET failures
- `src/app/transactions/[id]/page.tsx` — Error state + banner for GET/DELETE failures
- `src/app/transactions/new/page.tsx` — `mapErrorMessage()` for scan/save catch blocks

**ErrorDialog component:**
- Created `src/components/ErrorDialog.tsx` — modal overlay for POST action failures (save, delete, mark-paid)
- Matches the existing `ConfirmDialog` style: dimmed backdrop, centered white card, ⚠️ icon, single dismiss button
- Used on 3 pages for POST error display instead of inline `<p>` text

**Generic LLM error messages:**
- Added 8 LLM-specific patterns to `MAPPED_ERRORS` that convert provider-specific messages into generic text:
  - `"Gemini API returned 429: ..."` → `"Failed to scan receipt. Please try again."`
  - `"Gemini returned no text (finishReason: SAFETY)"` → `"Receipt scan returned no data. The image may be invalid or blurry."`
  - `"GEMINI_API_KEY is not set"` → `"Scan is unavailable. The API key has not been configured."`
  - `"You've exceeded the daily quota"` → `"Scan is temporarily unavailable. Please try again later."`
- Reordered `mapErrorMessage()` to check patterns FIRST before falling back to `AppError.message`
- This means LLMError messages get caught by the pattern matcher, while normal AppErrors (like "Transaction not found") still pass through unchanged

**Debug menu:**
- Created `src/components/DebugMenu.tsx` — floating 🐛 button when `DEBUG_UI=true` (appears at bottom-left)
- Page-aware: shows different error simulator buttons depending on the current route
- DB actions: "Delete all transactions" and "Full database reset" directly from any page
- Error simulators trigger the ErrorDialog with realistic messages — no need to cause real errors
- Integrated into `AppShell.tsx` so it appears on every page

**Error reference doc:**
- Created `docs/error-test-cases.md` — 23 error conditions with trigger steps and expected results

**New files added:**
- `src/components/ErrorDialog.tsx` — error modal overlay
- `src/components/DebugMenu.tsx` — floating debug panel with DB actions + error simulators
- `docs/error-test-cases.md` — error conditions reference

**Files modified:**
- `src/lib/constants.ts` — Added LLM patterns to MAPPED_ERRORS; reordered mapErrorMessage logic
- `src/app/AppShell.tsx` — Import and render DebugMenu
- `src/app/transactions/new/page.tsx` — ErrorDialog for POST save errors
- `src/app/transactions/[id]/page.tsx` — ErrorDialog for delete + mark-settled errors
- `src/app/settle-up/page.tsx` — ErrorDialog for mark-paid errors

## 2026-07-16 — Fix: Settle-up "Mark paid" never worked

### Fixed
1. **"Mark paid" flow was broken end-to-end.** Three interacting bugs:
   - **Frontend generated a fake settlement ID** (`settlement-${from}-${to}-${Date.now()}`) and sent it to the API, but never created a settlement record first. The backend's `markSettled()` tried to UPDATE a non-existent row, so `result.changes` was always 0 and it returned 404.
   - **`markSettled()` set `settledAt` to an ISO date string** (`new Date().toISOString()`), but every balance query checked for the literal string `"PAID"` — so even the seed settlement would never affect displayed balances if it were marked.
   - **No API route existed to create a settlement.** The `createSettlement()` action existed in `settlements.ts` but had no corresponding API endpoint.

2. **Consolidated into a single action** `createAndMarkPaid(fromUserId, toUserId, amount)` that creates the settlement record and marks it paid in one step. The API route now accepts `{ fromUserId, toUserId, amount }` directly.

3. **Fixed `markSettled()` to set `settledAt: "PAID"`** instead of an ISO timestamp, matching what all balance queries expect.

### Files changed
- `src/lib/actions/settlements.ts` — Added `createAndMarkPaid()`, fixed `markSettled()` to use `"PAID"` constant
- `src/app/api/settlements/mark-paid/route.ts` — Accepts `{ fromUserId, toUserId, amount }` instead of fake `settlementId`
- `src/app/settle-up/page.tsx` — Sends proper body instead of made-up settlement ID

## 2026-07-16 — Fix: Balance formula sign error, "Mark as settled" removal, settlement tests

### Fixed
1. **Balance formula sign error in both `balances.ts` and `users.ts`.** The settlement amounts for "friend already paid user" were being **added** to the net balance instead of subtracted. When Alex paid you $50 via settle-up, the formula `friendOwesUser - userOwesFriend + friendPaidUser - userPaidFriend` made it look like Alex owed you MORE, not less. Fixed both to use `- friendPaidUser + userPaidFriend`, so a settlement payment correctly reduces the outstanding debt.

2. **Removed "Mark as settled" button from transaction detail page.** Transaction-level settling was conceptually wrong — settling should be user-to-user only (paying off the net balance between two people, not marking individual line items as paid). Removed the `handleMarkSettled` function and its button.

### Added
3. **Settlement-balance test suite** — 8 in-memory test fixtures covering:
   - Simple debt + full settlement → net zero
   - Partial settlement → correct remaining balance
   - Over-payment → flips the balance direction
   - Multi-person with one settling
   - Transactions in both directions + settlement
   - User paying friend (settlement from user to friend)
   - No transactions → net zero
   - Multiple settlement payments accumulating to full payment

   Run: `npm run test:settlement` (CLI) or visit `/debug` (browser). Pure in-memory — no server needed, no data touched.

### Files changed
- `src/lib/actions/balances.ts` — Fixed balance formula: `+ friendPaidUser` → `- friendPaidUser`; added optional `_db` param for test injection
- `src/lib/actions/users.ts` — Same sign fix: `+ friendAlreadyPaid` → `- friendAlreadyPaid`
- `src/app/transactions/[id]/page.tsx` — Removed `handleMarkSettled` function and "Mark as settled" button
- `src/lib/test-data/settlement-fixtures.ts` — 8 test scenarios (new file)
- `src/lib/test-data/run-settlement-tests.ts` — In-memory test runner (new file)
- `scripts/run-settlement-tests.ts` — CLI runner (new file)
- `src/app/api/debug/settlement-tests/route.ts` — Debug API endpoint (new file)
- `src/app/debug/page.tsx` — Settlement test suite viz section
- `package.json` — Added `test:settlement` script
