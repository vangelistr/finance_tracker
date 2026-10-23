# Blockers

Items that were skipped, forbidden, failed after 3 attempts, or could not be verified.
Each item says why and what the user can do. Newest phase last.

## Phase 0

### B-001 Impeccable: no project-scope install (user override)

- **What:** The brief asks for a project-scope install after a SKILL.md review, and says: "If [a skill's SKILL.md]
  instructs network calls, data exfiltration, or anything outside design guidance, do NOT install it".
- **Finding (SKILL.md v4.7.0 reviewed in full on 2026-10-22, repo `pbakaus/impeccable`, CLI release `cli-v4.7.0`):**
  - Setup step 1 instructs running `scripts/impeccable context`. The launcher downloads an engine binary from
    GitHub releases on first run if none is cached (cache: `IMPECCABLE_HOME`, default `~/.impeccable`).
  - `reference/new-work.md` instructs `scripts/impeccable concept-seed ...` ("No substitute, no skip").
    The README says this "roll" request to the impeccable.style API always happens, even with telemetry off.
    The README also says project name, files, code and PRODUCT.md are never sent.
  - Telemetry is on by default. Opt-outs: `DO_NOT_TRACK=1`, `IMPECCABLE_NO_TELEMETRY=1`,
    `"telemetry": false` in `.impeccable/config.json`.
- **User override (2026-10-22, during the run):** "τα skills τα έχω στο claude γενικα" (the skills are installed in
  Claude globally). So no project-scope install is done; the user's global Impeccable skill is used.
- **How it is used:** telemetry off through all three opt-outs; `IMPECCABLE_HOME` points to a gitignored folder
  inside the project; no financial data is ever passed to it. The roll request is the only remaining third-party
  call, and it carries no project data.
- **Acceptance impact:** none expected. If the launcher cannot run, the skill's own fallback applies
  (read PRODUCT.md and DESIGN.md directly), and that is recorded here.

### B-002 vercel-labs `web-design-guidelines` skill not installed (network instructions)

- **What:** The brief asks for vercel-labs/agent-skills "React/Next.js best practices + web interface guidelines".
- **Finding (SKILL.md reviewed in full on 2026-10-22, repo commit `063bee94c3f4df8453406c830b0a7df0f2860278`):**
  `web-design-guidelines` instructs: "Fetch fresh guidelines before each review" from a raw GitHub URL with
  WebFetch. That is a network call that pulls new instructions at run time.
- **Decision:** Not installed. `react-best-practices` (no network calls, no scripts) is installed at project scope.
- **Mitigation:** The guidelines document is read once as static reference material, pinned to a commit,
  and its checklist is applied by hand during the design passes.

### B-003 Live market-data verification (Twelve Data and EODHD done 2026-10-23; FMP, Alpha Vantage, Finnhub pending)

- **What:** `.env` has no market-data API keys (Twelve Data, EODHD, FMP, Alpha Vantage, Finnhub).
- **Decision:** The investing module is built and tested with mocked providers. No live calls with keys were made.
- **User action:** Add free-tier keys to `.env`, then run the live check described in `docs/MARKET-DATA.md`
  ("Pending live verification").
- **Update 2026-10-23:** the owner added Twelve Data and EODHD keys; both adapters were checked live
  (`docs/MARKET-DATA.md` 8.8, D-069). FMP, Alpha Vantage and Finnhub have no keys and stay optional.
- **Phase 6 status (2026-10-23):** the provider adapters, chain, budgets, cache and FX are tested against mocked
  responses shaped like the demo-key answers in `docs/MARKET-DATA.md`. Without keys the app shows "No key" for every
  provider and uses manual prices; the FX call (Frankfurter, keyless) runs only while the module is on.

### B-004 R2 backup verification pending (no R2 credentials)

- **What:** `.env` has no R2 endpoint, bucket or keys.
- **Decision:** Backups are built and tested against the default local-directory restic repository.
  The S3/R2 target is implemented and config-validated, but not verified against a real bucket.
- **User action:** Create a private R2 bucket and a bucket-scoped token (see README), fill the `R2_*` values,
  set `BACKUP_TARGET=s3`, and run the backup and restore test commands from the README.

### B-005 Tax/EFKA rules marked [uncertain]

- **What:** Twelve points in `docs/research/tax-efka.md` section 10 could not be confirmed from an official page
  (for example the art. 16 proration with business income, the parallel-insurance offset, the 2026 prepayment split,
  the EFKA due date, the VAT filing frequency by books category).
- **Decision:** The estimator uses the conservative reading, marks each affected figure [uncertain] in the UI and
  the config, and labels everything "estimate, not tax advice; confirm with an accountant".
- **User action:** Ask an accountant to confirm the list; edit the per-year config in the app if a value differs.
- **Phase 7 status (2026-10-23):** the estimator applies the conservative reading of each item; the tax page lists
  the open questions and tags every [uncertain] rate and option next to the figure it affects.

### B-006 Branch protection on `main` not confirmed for a Free private repo

- **What:** The GitHub docs read on 2026-10-22 do not confirm that branch protection or rulesets with required checks
  are available on a Free plan private repository. Changing repository settings is also forbidden for the build.
- **Decision:** CI provides one aggregate `ci-success` check so a single rule is enough if the feature is available.
- **User action:** In repository settings, protect `main` and require `ci-success`, if your plan offers it.

### B-007 GitHub artifact attestations not available (Free private repo)

- **What:** The brief says "add build provenance only if it is free for private repos [verify]".
  `actions/attest-build-provenance` requires GitHub Enterprise Cloud for private repositories.
- **Decision:** Skipped. BuildKit's own SLSA provenance (`mode=max`) and SBOM are attached to pushed images at no cost.

## Phase 1

### B-008 Next.js telemetry ran during the first local builds

- **What:** Next.js telemetry was enabled on the build machine. The first few local Next.js commands of Phase 1
  ran before `NEXT_TELEMETRY_DISABLED=1` was added, so anonymous Next.js usage events may have been sent.
  They carry no project code, financial data or secrets (Next.js telemetry documentation).
- **Fix in place:** every script, the image and CI now set `NEXT_TELEMETRY_DISABLED=1` (D-031).
- **User action (optional):** run `npx next telemetry disable` once on your machine to turn it off globally.

### B-009 CI result on GitHub

- **What:** The workflows were verified locally (actionlint, every job's commands). The first GitHub run happens on
  push; its result is recorded in `docs/PROGRESS.md`. The release workflow runs only after the user merges to `main`
  ("first release verification").
- **User action:** After merging, check the Release run and that `ghcr.io/<owner>/finance_tracker` and
  `…/finance_tracker-backup` exist as private packages.

### B-010 MongoDB 7.0 reaches end of life on 2027-08-31

- **What:** MongoDB 8.0/9.0 refuse to start on Linux kernels 6.19–7.0.13 (D-036), so the stack runs MongoDB 7.0.45.
- **User action before 2027-08-31:** when your server kernel is 7.0.14+ (or below 6.19) and MongoDB has resolved
  SERVER-136848 for Ubuntu kernels, upgrade to the current 8.0.x: take a backup (`docker compose exec backup backup-now`),
  change the image tag in `docker-compose.yml` and `docker/backup/Dockerfile`, start, then run
  `db.adminCommand({ setFeatureCompatibilityVersion: "8.0", confirm: true })` as the root user.

## Phase 6

### B-011 Phase 5 image job on GitHub was cancelled, not failed

- **What:** CI run 39838143427 (Phase 5 commit) passed `static` and `test`; its `image` job was cancelled by
  `concurrency: cancel-in-progress` when the docs-only progress commit was pushed a minute later. The docs-only run
  skipped the image job by its path filter, so the Phase 5 image was not rebuilt on GitHub.
- **Mitigation:** the image built locally and ran healthy (Phase 5 summary), and the Phase 6 push rebuilds the image
  from a tree that contains Phase 5. Its result is recorded in `docs/PROGRESS.md`.
- **Lesson for the run:** do not push a docs-only commit while a phase run is still in progress.
- **Resolved:** the Phase 6 run (39967390812) passed every job, including the image build.

## Phase 8

### B-012 Server-side steps not run (forbidden for the build)

- **What:** The build may not access the server, Tailscale or the GitHub repository settings. So these were not
  run: the first real deploy from GHCR, `tailscale serve` on the server (the README command is composed from the
  documented flags, D-066), the tailnet ACL, the Hetzner firewall review, branch protection, the auto-updater timer.
- **Verified instead:** `deploy/deploy.sh` and `deploy/rollback.sh` against Docker Compose locally (17 checks,
  `npm run test:deploy`), the Release workflow with actionlint, both images with Trivy (no critical findings).
- **User action:** follow README "Server setup", then "Tailscale serve"; check `tailscale serve status` and open the
  app from a phone on the tailnet. If port 443 conflicts with another service, use the `--https=8443` fallback.
