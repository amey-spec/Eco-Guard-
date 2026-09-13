# 🛡️ EcoGuard — Adversarial Abuse, Resilience & Availability Audit

**Date:** 2026-09-13 · **Mode:** READ-ONLY audit of the real project + controlled reproduction against a fully isolated instance
**Isolation:** server copied to OS temp dir; throwaway DB (`audit.sqlite`, 106 KB seeded), throwaway uploads dir, port 5399; limiter envs raised and the *copy's* submit limiter wired to `SUBMIT_RATE_LIMIT_MAX` (10/15min default untouched in the real project). Second/third throwaway instances on ports 5398/5397 for prod-default limiter and DB-failure tests.
**Integrity proof:** SHA-256 of real `server/database.sqlite` identical before/after; real `server/uploads` still 35 files; real DB mtime predates session. All temp resources deleted; no listener left on 5397–5399.
**Result:** 25 controlled tests executed (T1–T20, incl. sub-tests). **Zero process crashes** in 25/25. Full raw results were captured in `audit-results.json` (temp, since removed — all evidence transcribed below).

---

## A. Executive Summary

**Overall resilience: 🟡 Needs hardening**

- **Crash-resistance is genuinely good.** Every abuse batch (concurrent races, oversized bodies, deep nesting, 23-way mixed concurrent writes) left `/api/health` returning 200. Bad DB path exits cleanly with a clear error. Oversized/malformed input is rejected in ~5–25 ms with 400/413.
- **What's broken is integrity and growth, not uptime.** Three reproduced P1s: (1) the MAX+1 report-ID race turns concurrent submissions into an error storm on the *core public write path* (15/16 concurrent submits returned 500); (2) the quiz grading contract desync makes **every in-app quiz submission score 0/5** — the whole quiz workflow is dead end-to-end; (3) anonymous, unauthenticated report submission enables unbounded DB + disk growth (rows, notifications, audit rows, uploaded files) with no quota and no cleanup.
- Several previously suspected issues were **rejected with evidence** (no-op notification flooding, SQLite BUSY/lock failures, crash via nesting, registration race) — see §L.

---

## B. P0 FINDINGS

> None reproduced. No test crashed the server, corrupted state irrecoverably, or caused sustained complete outage.

---

## C. P1 FINDINGS

### F-01 — Report-ID race: concurrent submissions produce a 500 error storm
- **Severity:** P1 · **Category:** Concurrency / Availability
- **Affected:** `server/routes/reports.js` → `generateReportId()` (`SELECT id … LIKE 'ECO-<year>-%' ORDER BY id DESC LIMIT 1` → `+1`), `POST /api/reports/submit` (public, anonymous allowed)
- **Attacker:** Anonymous (limiter: 10/15 min per IP)
- **Reproduction (T1):** 16 parallel `POST /reports/submit` → `{"201":1,"500":15}`. (T14) 23-way mixed writes incl. 6 parallel submits → 5×500, stderr full of `SQLITE_CONSTRAINT: UNIQUE constraint failed: hazard_reports.id`.
- **Observed:** one winner, all losers 500. **Expected:** one winner, losers 201 with the next ID (or clean 409/429).
- **Impact:** crash NO · degrades whole app: partially (error/log storm on every traffic burst, audit+security-event churn) · affects other users: YES during bursts (shared error path + log growth) · persists after stop: only in logs · DB growth: YES (failed attempts still emit security/audit rows) · reproducible: YES (deterministic at ≥8 concurrent).
- **Evidence:** T1 `statusCounts`, T14 `errors5xx` + stderr tail; schema PK prevents duplicate IDs (no silent corruption — verified `dbDuplicateIds: []`).
- **Fix direction:** generate IDs inside the INSERT (autoincrement PK mapped to `ECO-<year>-<seq>` view/format), or wrap allocate+insert in one `BEGIN IMMEDIATE` transaction with retry on UNIQUE.

### F-02 — Quiz grading contract desync: every frontend submission scores 0
- **Severity:** P1 · **Category:** State Integrity / Failure Handling (frontend↔backend disagreement)
- **Affected:** `client/src/pages/QuizPage.jsx` (submits option *indices*) vs `POST /api/quiz/:id/submit` (grades *option strings*)
- **Attacker:** none — plain users hit this 100% of the time
- **Reproduction (T11):** submitting `["0","1","2",…]` → score **0/5**; submitting `options[0]` strings → 3/5 (grading itself works, answer key never leaves server — good).
- **Observed:** 0/5 for the format the shipped UI actually sends. **Expected:** score reflects real answers.
- **Impact:** major workflow corruption (quiz feature functionally dead since the frontend was wired); no crash, no growth, no cross-user effect; reproducible YES.
- **Fix direction:** map selected index → `question.options[index]` in the client before POST (one line), or accept indices server-side and resolve there.

### F-03 — Anonymous unbounded resource growth (DB rows + notifications + uploads)
- **Severity:** P1 · **Category:** Resource Exhaustion / Data Growth
- **Affected:** `POST /api/reports/submit` (auth optional), `notifications` inserts, `audit_log`, `security_events`, `server/uploads/`; no quotas, no cleanup job anywhere in the codebase
- **Attacker:** Anonymous (or any user); multi-account/multi-IP trivially defeats the per-IP limiter
- **Reproduction (T12):** 8 valid PNG submissions → uploads 0→8 files, +8 report rows, +8 notifications (T5: 12 sequential submits → +12 notifications, 60→72). Extrapolation: every accepted upload is stored full-size (≤5 MB), every report forever, every notification forever.
- **Observed:** strictly linear growth in rows and files with **no** pruning path (admin report delete does not unlink files either — see F-07).
- **Impact:** crash NO · degrades app over time YES · affects other users YES (shared DB/list sizes) · persists YES · DB growth YES · storage growth YES · reproducible YES.
- **Fix direction:** require auth (or challenge) for submission; per-user daily quota; retention/cleanup job; global caps; paginate feeds.

---

## D. P2 FINDINGS

### F-04 — No report state machine: invalid transitions accepted
- **Severity:** P2 · **Category:** State Integrity
- **Affected:** `PUT /api/admin/reports/:id/status` (enum-checked per change, but no transition graph)
- **Reproduction (T4):** `Rejected → Verified` accepted (200,200); final status persisted as `Verified`. (T4b) 20 concurrent mixed transitions → all 200, single consistent final row (`Rejected`, last-write-wins).
- **Impact:** workflow incoherence (Rejected reports can re-enter review; tracking page semantics break); notification + audit rows created per real change. Crash NO · cross-user NO (reporter only) · reproducible YES.
- **Fix direction:** allowed-transition map (e.g. Resolved/Rejected are terminal or → Under Review only) enforced server-side.

### F-05 — No idempotency: retries/double-tabs create duplicate reports + notifications
- **Severity:** P2 · **Category:** Concurrency / Data Growth
- **Affected:** `POST /api/reports/submit`; UI guards single-tab double-click (`disabled={submitting}` in ReportPage) but nothing server-side
- **Reproduction (T6):** identical payload ×2 → both 201, two distinct rows (`ECO-2026-00043`, `-00044`), +2 notifications. Browser retry / two tabs ⇒ duplicates.
- **Impact:** duplicates YES · notifications YES · cross-user NO · persists YES · reproducible YES.
- **Fix direction:** idempotency key (client-generated UUID header) or content-hash dedupe window per user.

### F-06 — Orphaned uploads: rejected files survive; deletes never remove files
- **Severity:** P2 · **Category:** Data Growth / Storage
- **Affected:** `server/routes/reports.js` content-sniff path; `DELETE /api/admin/reports/:id` (no unlink anywhere in admin.js)
- **Reproduction (T13):** MIME-forged upload → 400 returned, but uploads dir count 0→**1** (`orphanCreated: true`) — `removeInvalidUpload` is best-effort and failed silently (verified on the isolated Windows FS). Code review: admin report delete writes audit + deletes row only; image files are never unlinked for any lifecycle event (report delete, account delete).
- **Impact:** storage growth YES (permanently) · user-visible NO · reproducible YES (T13 direct; delete path by code read).
- **Fix direction:** unlink on sniff-reject must be awaited/verified (and temp file written to the uploads dir only after validation); unlink `image_url` on report delete and account delete.

### F-07 — Unbounded list endpoints grow with the DB
- **Severity:** P2 · **Category:** Resource Exhaustion
- **Affected:** `GET /api/notifications` (no pagination), `GET /api/reports`, `GET /api/hazards`, `GET /api/admin/users`, `GET /api/admin/security-events` — all return full sets
- **Reproduction (T9c/T9d):** 74 notifications in DB → 74 returned; 45 reports → 45 returned. Contrast (good): `GET /admin/audit-log` caps limit at 100 and clamps offset (T9b: huge limit → 60 rows available, huge offset → 0, status 200).
- **Impact:** response size + client render cost scale linearly with total data; combined with F-03 this is the mechanism by which growth becomes *degradation for everyone*. Crash NO · cross-user YES over time · reproducible YES.
- **Fix direction:** port the audit-log pagination pattern to all list endpoints (limit ≤50, cursor/offset, filtered totals).

### F-08 — `admin_notes` exposed on public report data
- **Severity:** P2 · **Category:** Abuse / Information disclosure (functional inventory finding, not a pentest claim)
- **Affected:** public `GET /api/reports` (and detail) select full rows
- **Reproduction (T19):** public response fields include `admin_notes`, `user_id`; no password fields (verified absent).
- **Impact:** anonymous users read internal moderation notes for every report; contributes to an enumeration picture (F-10). Reproducible YES.
- **Fix direction:** explicit public projection (whitelist columns) for anonymous/user reads.

### F-09 — Multi-instance / scaling assumptions break silently
- **Severity:** P2 (only matters before scaling) · **Category:** Concurrency / Deployment
- **Static analysis (no deploy):** express-rate-limit uses per-process memory stores ⇒ limits multiply by instance count; SQLite single-writer ⇒ write contention worsens; MAX+1 ID allocation ⇒ F-01 gets worse; uploads dir is local disk ⇒ files 404 behind the wrong instance; no shared cache/timers.
- **Impact:** none today (single instance); blocks horizontal scaling and makes rate limits unenforceable behind a load balancer.

---

## E. P3 FINDINGS

### F-10 — Enumeration affordances on tracking
- **Severity:** P3 · **Category:** Abuse
- **Reproduction (T15):** IDs are sequential `ECO-YYYY-#####`; `GET /reports/track/ECO-1999-00001` → 404 vs malformed → 400 (mild oracle). Rate limits (300/15 min global) keep bulk crawling impractical; tracked data is already public by design. Reproducible YES, impact low.

### F-11 — No client-side fetch timeout/abort
- **Severity:** P3 · **Category:** Failure Handling
- **Evidence (code read):** `client/src/services/api.js` has no timeout/AbortController/retry. A hung connection leaves the submit spinner up and the button `disabled` indefinitely (ReportPage `submitting` never resets until fetch settles); user recovery = manual reload. No false success shown. Reproducible YES (by construction), impact per-user only.

### F-12 — Account deletion keeps password hash (soft delete)
- **Severity:** P3 · **Category:** State Integrity (note)
- **Reproduction (T7):** concurrent delete + reads → all 200, final `status='disabled'`, `password` hash retained. Consistent with audit/forensics intent but should be a documented decision; post-deletion token validity was not separately verified (🟡 UNVERIFIED).

---

## F. RESOURCE EXHAUSTION MATRIX

| Resource | Bounded? | Abuse tested? | Result | Risk |
| --- | --- | --- | --- | --- |
| CPU | Yes (validation is O(n) and rejects in ms) | Yes (T9/T10) | 400/413 in 5–25 ms; no measurable load | 🟢 Low |
| Memory | Yes for requests; no long-run growth seen | Yes (short-run) | No growth; no leak signal | 🟢 Low |
| Database | **No** — rows/notifications/audit grow unbounded | Yes (T1/T5/T12/T18) | Linear growth; no pruning anywhere | 🔴 High |
| Disk/storage | **No** — uploads never deleted (F-06) | Yes (T12/T13) | 8/8 uploads persisted; orphan + delete-orphan confirmed | 🟠 High |
| Network/response size | **No** on list endpoints | Yes (T9c/T9d) | Full-table responses; audit-log capped at 100 (good) | 🟠 Medium |
| Notifications | No cap; per-real-change 1; no-op 0 | Yes (T3/T3b/T5) | Flood only via repeated real actions/submissions | 🟠 Medium |
| Audit logs | Bounded by admin limiter (60/15 min per admin per op) | Yes (T4b) | Grows with moderation; read side capped | 🟡 Low-Med |
| Security events | Grows on failures (login misses, bad deletes) | Yes (indirect) | Bounded by auth limiters | 🟡 Low-Med |
| File uploads | Size cap 5 MB/file; **no count/quota cap** | Yes (T12) | Anonymous can persist files within limiter; multi-IP scales | 🔴 High |

## G. CONCURRENCY MATRIX

| Operation | Concurrent tested? | Duplicate possible? | Race found? | DB lock? | Result |
| --- | --- | --- | --- | --- | --- |
| Registration | Yes (8× same email) | No (UNIQUE holds: 1×201, 7×409) | No | No | 🟢 Safe |
| Login | Yes (8× sequential, prod limiter) | n/a | n/a | No | 🟢 429 after 5 fails, health 200 |
| Report submission | Yes (16×) | Yes (T6 retry; race duplicates blocked only by PK) | **YES — MAX+1 race (F-01)** | No BUSY observed | 🔴 15/16 → 500 |
| Report update | Yes (20× mixed statuses) | Last-write-wins, single consistent row | No corruption; no state machine (F-04) | No | 🟡 Works but unordered |
| Report deletion | Yes (in T14 mix) | No | No | No | 🟢 200; file left on disk (F-06) |
| Notifications | Yes (read/read-all mixes) | No | No | No | 🟢 Consistent |
| Password reset | Yes (6×) | 5 tokens minted (1 limiter 429); all unused remain valid | Design gap: token multiplication, no invalidation of older tokens | No | 🟡 See note |
| Account deletion | Yes (2× delete + 2× reads) | No (second is no-op-ish; final state `disabled`) | No | No | 🟢 Clean |
| Admin actions | Yes (30× no-op, 10× real, mixed T14) | No duplicates; no-op → 0 notifications | No | No | 🟢 Safe |

*Password-reset note (T8):* repeated forgot-password mints one valid token each (limiter allows ~5/window in dev-with-exposed-tokens mode). With email delivery absent, all valid tokens coexist — any one resets the password. Bounded by `resetRequestLimiter`, so P3 in practice.

## H. FAILURE-RECOVERY MATRIX

| Failure | Backend survives? | Frontend recovers? | Retry safe? | State consistent? |
| --- | --- | --- | --- | --- |
| Timeout | 🟡 (server has no slow-hang source found; client has no timeout — F-11) | ❌ spinner + disabled button until manual reload | ❌ duplicates report (F-05) | ✅ server-side |
| 401 | ✅ | ✅ AuthContext clears token → login | ✅ | ✅ |
| 403 | ✅ | ✅ error shown (admin guard) | ✅ | ✅ |
| 404 | ✅ | ✅ (track page error state) | ✅ | ✅ |
| 409 | ✅ | ✅ (register duplicate email) | ✅ | ✅ |
| 413 | ✅ (huge JSON/strings → 413) | ✅ error shown | ✅ | ✅ |
| 429 | ✅ (verified T16) | ✅ message shown | ✅ | ✅ |
| 500 | ✅ (process healthy after F-01 storm) | 🟡 generic error, user may retry into another 500 | ❌ retry is part of the storm | ✅ (PK holds) |
| DB failure | ✅ bad path → clean startup exit with clear error (T17) | n/a | n/a | ✅ no partial state |
| Upload failure | ✅ (multer limits → 400; sniff fail → 400) | ✅ error shown | ✅ | 🟡 orphan file may remain (F-06) |

## I. CROSS-USER IMPACT

**Can one malicious user materially degrade service for another normal user?**
Short test: **No** — 23-way mixed concurrent writes produced no `SQLITE_BUSY`, no lock timeouts, and read endpoints stayed fast; per-user data is strictly isolated (ownership checks verified in notification read paths).
Sustained: **Yes, indirectly** — an anonymous submit flood (F-03) grows shared tables and list-response sizes (F-07) for everyone, and bursts hit the whole user base with the F-01 500 path on the public write endpoint. Degradation is cumulative, not instantaneous.

## J. CRASH TEST RESULTS

**Did any controlled test crash the server process? No.** 25/25 batches ended with `/api/health` → 200 and the process alive; T14's 5×500 storm, T10's malformed/deep/huge inputs, and 16-way races all handled. Boot-time DB failure (T17) exits cleanly with `SQLITE_CANTOPEN` reported as "Failed to start server" — correct behavior.

## K. PERSISTENT RESOURCE GROWTH

**After the attacker stops, does resource usage return toward baseline?**
- **DB rows (reports, notifications, audit, security events): NO** — everything written persists; no retention job exists (T18 confirms read-only loops add nothing, but nothing removes prior writes).
- **Disk (uploads): NO** — orphaned/rejected files (T13) and files of deleted reports (code-verified) remain forever.
- **Memory: YES (returns to baseline)** — no growth signal in the test window.
- **Logs: NO (unbounded within disk)** — every 500 from F-01 appends error output.

## L. REJECTED HYPOTHESES (investigated, NOT reproduced)

1. **"No-op admin ops flood notifications"** — REJECTED: 30 no-op status PUTs → 0 notifications (T3); even 10 concurrent real changes created 0 extra beyond genuine transitions (T3b). Notifications are per-real-change only.
2. **"SQLite will throw BUSY / deadlock under concurrent writes"** — REJECTED at tested scale: no BUSY/lock errors in any batch (T14, 23 parallel mixed writes).
3. **"Deeply nested / weird-typed JSON crashes the parser"** — REJECTED: 20-level nesting and object/array/scalar type swaps → clean 400 in ~5 ms (T10).
4. **"Huge query params / search strings cause expensive scans"** — REJECTED: 5 000-char params rejected 400 in ~16 ms via input guards (T9).
5. **"Registration race creates duplicate accounts"** — REJECTED: exactly 1 row, 7×409 (T2).
6. **"Audit-log endpoint can be driven with huge limit/offset"** — REJECTED: limit clamped (100), offset clamped, 200 + sane results (T9b).
7. **"Admin can lock themselves out / escalate via self-role change"** — REJECTED: self-demotion and self-suspension blocked in code (admin.js).
8. **"Public reports leak password material"** — REJECTED: no password-ish fields in public responses (T19) — but `admin_notes` **is** exposed (F-08).
9. **"Read-only abuse (loops of GETs/PUT-reads) grows tables"** — REJECTED: zero row-count delta over 10 loops (T18).
10. **"Login brute force unbounded at prod defaults"** — REJECTED: 429 after 5 bad attempts, health unaffected (T16).
11. **"Invalid DB path hangs the server"** — REJECTED: clean exit, clear error (T17).
12. **"Quiz server is exploitable/leaky"** — REJECTED: answer key never leaves the server; grading contract is the (client-side) problem (F-02).

## M. TOP 10 REMAINING RISKS (ranked, verified only)

1. **F-01 Report-ID race → 500 storm on the public write path** (P1, reproduced).
2. **F-03 Anonymous unbounded DB + storage growth, no quotas/cleanup** (P1, reproduced).
3. **F-02 Quiz grading desync — feature scores 0 for everyone** (P1, reproduced).
4. **F-06 Upload files never deleted on any lifecycle event (+T13 orphan)** (P2, reproduced + code).
5. **F-07 Unbounded list endpoints amplify growth into user-facing slowness** (P2, reproduced).
6. **F-04 No report state machine — invalid transitions accepted** (P2, reproduced).
7. **F-05 No idempotency — retries/double-tabs duplicate reports + notifications** (P2, reproduced).
8. **F-08 `admin_notes` on public responses** (P2, reproduced).
9. **F-09 Per-instance rate limits + local uploads + SQLite block safe scaling** (P2, static).
10. **F-11 No client fetch timeout — hung requests freeze forms** (P3, code-verified).

## N. FINAL RECOMMENDATION

**Fix immediately**
- F-01: transactional/atomic report-ID allocation with UNIQUE-retry.
- F-02: send option strings (not indices) from QuizPage.

**Fix before public deployment**
- F-03: auth/challenge for submission + per-user quota; F-06: real file lifecycle (unlink on reject/delete/account-delete); F-08: public column whitelist; F-07: pagination on notifications/reports/hazards/users.

**Fix before scaling**
- F-09: shared rate-limit store, object storage or sticky uploads, move off MAX+1 (already implied by F-01 fix), plan Postgres-style migration if multi-instance is real.

**Monitor later**
- Audit/security-event table growth (add counts to `/admin/stats` and alert on spikes); reset-token accumulation (T8 note); 5xx rate as F-01 regression signal.

**No action required**
- Registration race, login limiter, audit-log pagination, input validation/limits, account deletion concurrency, no-op notification behavior, read-only stability, crash resilience on bad DB path — all verified healthy.

---

### Brief results (one-glance summary)

| Question | Answer |
| --- | --- |
| Crash found? | **No** (25/25 healthy) |
| P0 | None |
| P1 | 3 — ID-race 500 storm; quiz scores 0 for all users; anonymous unbounded growth |
| P2 | 6 — state machine, idempotency, orphan files, unbounded lists, `admin_notes` leak, scaling assumptions |
| P3 | 3 — tracking oracle, no fetch timeout, soft-delete hash retention |
| Real dev DB/uploads touched? | **No** — SHA-256 + file count + mtime all unchanged |
| Biggest old claim now downgraded | "Notification flooding via no-op admin ops" — **disproven** (0 notifications on 40 no-op/concurrent ops) |
| Biggest old claim now upgraded | "Report ID race" — **reproduced**: 15/16 concurrent submissions → 500 |
