# EcoGuard — Database Backup & Recovery Design

> Status: **DESIGN ONLY — NOT IMPLEMENTED.** No backups, backup scripts, or
> restore tooling exist in this repository today. Nothing in this document
> should be read as a claim that backups are in place. It is the design to
> implement and *test* before any such claim is made.

---

## 1. Scope and goal

Design a durable backup and recovery mechanism for EcoGuard's SQLite database
and user-uploaded report images, appropriate for the intended production
deployment. The design must be implementable with minimal new dependencies and
must be *testable* (backup + restore drills) before it can be trusted.

---

## 2. Observed architecture (inspection findings)

| Area | Fact |
|---|---|
| Database engine | SQLite (single-file). |
| DB location | `server/database.sqlite`, path **hard-coded** in `server/config/database.js` (`../database.sqlite` relative to config). Not configurable via env today. |
| DB access | Single shared in-process connection (`sqlite` wrapper over `node-sqlite3`). Schema auto-created on boot (`CREATE TABLE IF NOT EXISTS`). No WAL/journal tuning in code. |
| DB size | ~120 KB in dev (will stay small at demo scale). |
| Uploads | `server/uploads/` holds user-submitted report images (JPG/PNG/WebP, ≤ 5 MB each, random filenames). Git-ignored except `.gitkeep`. Currently empty in dev. |
| DB ↔ uploads link | `hazard_reports.image_url` stores `/uploads/<filename>`; both must be restored together or images will dangle. |
| Auth/secrets | Passwords stored as bcrypt hashes in the DB. `JWT_SECRET` lives in env (`server/.env`), **not** in the DB. |
| Deployment | `netlify.toml` builds/publishes **only the client** (`client/` → static `dist`). **No backend host, Dockerfile, CI, or process manager is configured in the repo.** |
| Existing tooling | `server/scripts/` contains only `seed.js`. No backup, no restore, no tests. |

---

## 3. The ten questions

### Q1. Where will the production SQLite database live?
**Undetermined by the repo today**, and this is the single most important
open decision. The API backend has no defined production home. SQLite can only
run where the backend runs, so the database file must live **on the same host
as the API process, on a persistent disk**:

- Recommended: a single VM / VPS or a single container with a **mounted
  persistent volume**, e.g. `/var/lib/ecoguard/ecoguard.sqlite`.
- The DB path should become configurable (`DB_PATH` env) before production so
  the file is not written inside an ephemeral container layer or an
  app-directory that gets replaced on deploy.

### Q2. Does the deployment environment provide persistent storage?
- **Netlify static hosting (currently configured): NO.** It serves built files
  only; there is no writable/persistent filesystem for the API, so SQLite
  cannot run there.
- **Netlify Functions / serverless in general: effectively NO.** Filesystems
  are ephemeral and instance-local; SQLite state would be lost and is unsafe.
- **A VM / VPS / container with a mounted volume: YES.** This is the only
  currently-viable production shape for SQLite, and the design below assumes it.
- Consequence: before any backup design can be *operational*, a persistent
  backend host must be provisioned. Until that decision is made, backups
  cannot exist.

### Q3. Are scheduled filesystem backups possible?
Yes — **but only on a persistent-disk host with a scheduler**:

- A system scheduler (cron / systemd timer on the VM; Kubernetes CronJob or a
  sidecar on containers) can run backups on a fixed cadence.
- On ephemeral/serverless platforms scheduled local backups are not possible;
  the correct move there is to *not use SQLite* (see Q10).

### Q4. What backup mechanism is appropriate?
SQLite is a single file; the correct mechanisms, in order of preference:

1. **Online consistent snapshot with `VACUUM INTO '<file>'`** (SQLite ≥ 3.27,
   which modern sqlite3 builds ship). Produces a consistent, self-contained
   copy **while the API is live** — no downtime, no risk of copying a torn
   `-wal`/`-journal`. Recommended primary mechanism.
2. `sqlite3` CLI `.backup` — equivalent result, but requires the CLI binary on
   the host.
3. **Cold file copy** — only acceptable with the API stopped (or a completed
   checkpoint in WAL mode); do **not** `cp` a hot database file and call it a
   backup.

The snapshot must then be handled as an **artifact**: compressed, checksummed,
encrypted, and copied off-host (see §7).

### Q5. How should uploaded report images be backed up?
Images and DB are two halves of the same record and must be backed up with the
**same cadence and retention**, then restored together:

- Back up the `uploads/` directory with a file sync that copies only changed
  files (rsync-style; `robocopy /MIR` on Windows, `rsync -a` elsewhere), or an
  object-storage sync if the target is S3-compatible.
- Store uploads with the **same relative layout** (`uploads/<filename>`) so
  `image_url` values keep working after restore.
- Do not compress the whole uploads tree into one archive per backup if the
  tree is large — mirror/sync instead; snapshot the DB, mirror the uploads.
- Optionally take a lightweight manifest (filename list + checksums) so a
  partial uploads loss can be detected and repaired.

### Q6. How should backups be encrypted/protected?
Treat backups as sensitive: the DB contains user emails, profile data, report
locations/descriptions, and bcrypt password hashes; uploads may contain
recognisable imagery/location metadata.

- Encrypt **before the backup leaves the host** (encrypt the DB snapshot
  artifact; encrypt or store-under-access-control the uploads mirror).
- Use age or GPG with a **dedicated backup key**, never the app's `JWT_SECRET`.
- Keep the decryption key **separate from the backup host** and from the
  backups themselves (second location / secrets manager).
- Restrict write access to the backup destination and read access to the key
  (separate IAM/ACL identities; no world-readable backup files).
- Never include `.env` / `JWT_SECRET` in backup artifacts — record which env
  secrets are required for restore *in the runbook*, not in the backup.
- Verify encryption every restore drill (decrypt a copy) — an unreadable
  backup is no backup.

### Q7. How would restoration work?
High level (full detail in §9):

1. Stop the API (or restore into a staging copy first for verification).
2. Replace the live DB file with the restored snapshot; ensure file ownership
   and permissions are correct.
3. Restore the `uploads/` mirror to the expected path.
4. Start the API; it re-runs `CREATE TABLE IF NOT EXISTS` (no destructive
   migration) and reconnects.
5. Verify: user count, latest report, a known audit row, an image URL loads.
6. Rotate `JWT_SECRET` if there is any chance the environment/backups leaked
   (cheap insurance; invalidates old tokens).

### Q8. How should backup integrity be verified?
- **Checksums**: record `sha256` for each DB snapshot at creation; verify on
  every restore and periodically against the stored artifact.
- **Automatic post-backup check**: after each backup, run a lightweight query
  against the *snapshot copy* (open it read-only, count rows in key tables,
  run `PRAGMA integrity_check`) before trusting it.
- **Scheduled restore drills**: at least monthly (and after any schema or
  deploy change), restore the newest backup to a **staging path**, boot the API
  against it on a scratch port, and assert core flows.
- **Uploads**: compare manifest counts/checksums on a schedule.
- A backup that has never been restored is not a backup.

### Q9. What happens if the host / database is destroyed?
This is the **full-loss scenario** and the reason everything above must be
off-host:

- RPO target: **≤ 6 hours** of data (matches the recommended backup frequency).
- RTO target: **≤ 1 hour** to a working API on a replacement host.
- Required recovery inputs, all stored off-host: latest encrypted DB snapshot,
  uploads mirror, env config (JWT secret handled per §7 security), runbook.
- If only the DB file is lost but the host survives: restore from the newest
  snapshot (worst case lose < one interval of writes).
- If the whole host/volume is destroyed: provision a new host with a persistent
  volume, install the app, restore DB + uploads, restart, verify.
- If *both* primary and backups are destroyed (e.g., backups sat on the same
  host): that is data loss — which is why off-site / different-account backup
  copies are non-negotiable, and why restore drills must validate the off-site
  copy actually exists and decrypts.

### Q10. Is SQLite still appropriate for production?
**Yes — with hard constraints; No — on a serverless/multi-instance shape.**

- Appropriate when: a single API instance with a **persistent disk**, modest
  concurrent writes, and one-process DB access (all true for EcoGuard's
  architecture and scale). Zero-config, transactional, easy backups.
- Not appropriate when: multiple stateless replicas share the DB, or the host
  has no durable disk (Netlify Functions / serverless / auto-scaling groups).
  Those shapes need a real database server.
- **Verdict**: SQLite remains the right engine *if and only if* production is a
  single persistent-disk host. That hosting decision is prerequisite #1 for
  everything in this document.

---

## 4. Recommended backup architecture

```
                    ┌────────────────────────────────────────────┐
                    │  EcoGuard API host (single VM / container) │
                    │  persistent disk /var/lib/ecoguard/        │
                    │    ecoguard.sqlite                          │
                    │    uploads/…                               │
                    └───────────────┬────────────────────────────┘
                                    │ scheduled job (systemd timer /
                                    │ cron / K8s CronJob) — every 6 h
                    ┌───────────────▼────────────────────────────┐
                    │  1. VACUUM INTO snapshot.sqlite  (live, consistent)
                    │  2. sha256 checksum
                    │  3. gzip + age/gpg encrypt (dedicated key)
                    │  4. sync uploads/ (rsync-style mirror)
                    │  5. push artifacts to off-site store (S3-compatible)
                    │  6. auto-verify snapshot (PRAGMA integrity_check
                    │     on a decrypted scratch copy)
                    └───────────────┬────────────────────────────┘
                                    │ daily off-site + retention
                    ┌───────────────▼────────────────────────────┐
                    │ Off-site backup store (separate account/region) │
                    │  DB snapshots:  keep 4/day × 3 days + 14 daily  │
                    │  Uploads mirror + manifest                    │
                    └──────────────────────────────────────────────┘
```

Components:
- **Snapshot**: `VACUUM INTO` (no downtime, consistent).
- **Artifact**: gzip + age/GPG-encrypted; named
  `ecoguard-db-<UTC-timestamp>.sqlite.gz.age`; checksum sidecar.
- **Scheduler**: systemd timer / cron on the host.
- **Off-site copy**: object storage or second host in a different
  account/region; uploads mirrored with a manifest.
- **Drills**: monthly automated restore-to-staging; per-backup auto-verify.

---

## 5. Backup frequency recommendation

| Tier | Frequency | Retention | Rationale |
|---|---|---|---|
| DB snapshot (off-host) | **Every 6 hours** | 4/day × 3 days, plus 14 daily | RPO ≤ 6 h; DB is tiny (~KB–MB), so cost is negligible; hourly is also fine if the app gets write-heavy |
| Uploads mirror | Every 6 h (same job) | same as DB | must stay restorable *with* the DB |
| Off-site copy push | Every 6 h, immediate | as above | protects against host loss |
| Restore drill | **Monthly** + after schema/deploy changes | — | proves backups work |
| `PRAGMA integrity_check` | Every backup (auto) | — | catches torn/corrupt snapshots early |

Rationale: EcoGuard's write volume is low (reports, moderation, auth). Six-hour
snapshots give a small RPO at near-zero cost; the retention window gives at
least 14 days of rollback even if corruption is discovered late. Frequencies
are configuration knobs, not fixed constants.

---

## 6. Database + uploads strategy

- **One backup job, one cadence, one retention** for both halves of the record.
- DB: consistent `VACUUM INTO` snapshot (never a raw copy of the hot file).
- Uploads: `rsync -a`/`robocopy /MIR` style mirror + checksum manifest, so
  restores are byte-consistent and damaged files are detectable.
- Restore both to the exact paths the API expects (DB path from config;
  uploads at `server/uploads/`).
- Because rows reference uploads by filename, restoring DB without uploads (or
  vice versa) yields broken `image_url`s — restore **as a unit** and verify
  with a sample-image spot check.

---

## 7. Restore procedure (full loss → working API)

1. **Provision** a new host with a persistent volume (or reuse the surviving
   host for a DB-only loss).
2. **Install** the app and dependencies (same versions as backed-up state).
3. **Fetch** the newest DB snapshot + uploads mirror from the off-site store.
4. **Verify** the artifact: checksum, then decrypt to a scratch path and run
   `PRAGMA integrity_check` + row-count sanity.
5. **Stop** the API (if running).
6. **Place** the DB file at the configured path with correct owner/permissions
   (e.g. `chown ecoguard:ecoguard`, `chmod 600`).
7. **Restore** the uploads mirror to `server/uploads/`.
8. **Restore env** (`.env` / secrets) from the secrets manager — never from a
   backup artifact. Rotate `JWT_SECRET` if there is any suspicion of exposure.
9. **Start** the API; confirm the DB initializes (schema re-run is
   idempotent/`IF NOT EXISTS`) and health check passes.
10. **Verify data**: user/report counts, latest report, newest audit entries,
    and that at least one `image_url` loads.

---

## 8. Failure scenarios

| Scenario | Impact | Recovery | Notes |
|---|---|---|---|
| Corrupt/torn DB file | API down | Restore newest verified snapshot | If corruption detected late, restore oldest *still-valid* snapshot within retention |
| DB file deleted | data loss since last snapshot | Same as above | RPO ≤ 6 h |
| Host/volume destroyed | total loss of primary | New host + off-site restore | Requires off-site copy to exist (drill-tested) |
| Uploads lost/partial | broken images | Restore uploads mirror; reconcile via manifest | Keep manifest to detect partial loss |
| Backup artifact corrupt/unreadable | no usable backup | Detect via auto-verify + monthly drill *before* needed | Encrypt/checksum every artifact |
| Backup host compromised | backups + secrets at risk | Rotate backup key + app secrets; treat old artifacts as exposed | Keys stored separately from backups |
| Secrets (.env) lost | app can't boot | Restore from secrets manager; rotate JWT secret | Never in backup artifacts |
| Schema/deploy regression | app misbehaves after upgrade | Restore pre-change snapshot + roll back app version | Run a drill after every deploy change |
| Serverless/ephemeral deployment attempted | SQLite unusable | Do not deploy SQLite there; use a DB server instead | See Q10 |

---

## 9. Security considerations

- DB backups contain **PII** (emails, report locations/descriptions) and
  **bcrypt password hashes** → treat artifacts as secret data; encrypt
  off-host and restrict access.
- Never include `.env`, `JWT_SECRET`, or other runtime secrets in backup
  artifacts; record *where* to get them in the runbook instead.
- Use a dedicated backup encryption key; store it apart from the backups and
  apart from the host (secrets manager / second location).
- Least privilege: backup job runs as a dedicated user with read access to DB +
  uploads and write access only to the backup destination.
- Off-site destination in a separate account/region with separate credentials
  so host compromise does not expose the backups.
- Retention-based deletion of old artifacts; logs of backup/restore activity
  are themselves useful audit data.
- All of the above must be exercised in drills (encrypt → decrypt → restore),
  not just documented.

---

## 10. Deployment-specific limitations

1. **No backend host is defined.** The repo deploys only the client to Netlify.
   Until the API gets a persistent-disk host, backups cannot exist. This is the
   blocking prerequisite.
2. **Ephemeral/serverless = no SQLite.** If Netlify Functions or any
   stateless/multi-instance platform becomes the API home, the DB engine itself
   must change (Q10); local scheduled backups are impossible there.
3. **DB path is hard-coded** (`server/config/database.js`). A `DB_PATH`
   environment override should be added during deployment work so the file
   lives on durable storage rather than an app directory.
4. **Journal mode**: the app does not set WAL. If WAL is enabled later, backup
   tooling must account for `-wal`/`-shm` (use `VACUUM INTO` / `.backup`,
   never a bare file copy).
5. **Small scale**: all recommendations assume KB–MB DBs and modest upload
   volume. If uploads grow large, migrate the mirror to object storage with
   lifecycle rules and keep DB snapshots independent.
6. **Single point of failure**: SQLite implies a single writable instance;
   high-availability failover is out of scope. Acceptable for this product's
   shape, but a deliberate decision, not an accident.

---

## 11. Implementation checklist (for the later build task — not done)

- [ ] Decide and provision the production host + persistent volume (prereq #1).
- [ ] Make DB path env-configurable.
- [ ] Implement snapshot job: `VACUUM INTO` → checksum → compress → encrypt →
      off-site push; uploads mirror with manifest.
- [ ] Wire scheduler (systemd timer/cron/CronJob).
- [ ] Auto-verify each snapshot (`PRAGMA integrity_check`, row counts).
- [ ] Write and *execute* a restore runbook drill (monthly cadence).
- [ ] Decide backup encryption/off-site tooling (provider-agnostic; choose at
      implementation time).
- [ ] Document RPO/RTO and confirm with a real drill.

> **Bottom line:** a sound, low-dependency backup design exists here, but until
> the API runs on a persistent-disk host and this checklist is executed and
> drill-tested, **EcoGuard has no backups.**
