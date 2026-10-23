# Finance Tracker

A private, self-hosted personal finance PWA for one owner (plus invited users), built for a mix of fixed and
irregular Greek income. Next.js + MongoDB in Docker Compose, reachable only through your Tailscale network.

- Income (expected vs received), expenses, fixed costs and subscriptions, accounts, transfers, budgets.
- Recurring calendar, dashboard charts, reminders and alerts (Web Push), savings goals and the Smart Plan.
- Month-end reports, a Greek tax/EFKA set-aside estimator, and an optional investing module (off by default).
- Encrypted daily backups (restic) to a local repository or your own private Cloudflare R2 bucket.

Tax, allocation and ranking figures are estimates for education. They are not tax or financial advice.

Contents: [Local development](#local-development) · [Configuration](#configuration) ·
[Server setup](#server-setup-first-deploy) · [Tailscale serve](#tailscale-serve) · [Firewall and tailnet ACL](#firewall-and-tailnet-acl) ·
[Deploy, rollback and updates](#deploy-rollback-and-updates) · [Backups and restore](#backups-and-restore) ·
[Operations](#operations) · [CI/CD](#cicd) · [Module notes](#module-notes) · [Documents](#documents)

---

## Local development

Requirements: Docker with Compose v2, Node.js 24 (24.11 or later) and npm.

```sh
cp .env.example .env          # then fill the [generated] values, see Configuration
npm ci
docker compose up -d --build  # app on http://localhost:3000, worker, mongo, backup
```

Open http://localhost:3000: the first visit runs the setup wizard (owner account, language, currency, time zone,
investing module on or off). Registration is then closed; the owner invites other users from Settings.

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (needs a reachable MongoDB; set `MONGO_URL` in your shell) |
| `npm run lint` / `npm run typecheck` | ESLint, TypeScript |
| `npm test` | Unit and integration tests (integration needs MongoDB on `127.0.0.1:27018`, or `TEST_MONGO_URL`) |
| `npm run build` | Production build, service worker and the worker/migrate/admin bundles |
| `npm run screenshots` | Screenshot and accessibility tour (375/1440 px, light/dark) on a throwaway database |
| `npm run test:backup` | Backup acceptance checks against the running Compose stack |
| `npm run test:deploy` | Deploy, rollback and pruning checks in a throwaway Compose project |
| `npm run vapid:generate` | Prints a VAPID key pair for `.env` |

A test MongoDB for `npm test`: `docker run -d --name ft-dev-mongo -p 127.0.0.1:27018:27017 mongo:7.0.45-jammy`.

## Configuration

`.env.example` is the contract: every variable, with comments. Copy it to `.env` (never commit `.env`).

- `[generated]` values: `openssl rand -hex 32` for `SESSION_SECRET`, `DATA_ENCRYPTION_KEY`, `MONGO_ROOT_PASSWORD`,
  `MONGO_APP_PASSWORD` and `RESTIC_PASSWORD`. VAPID keys: `npm run vapid:generate` (on your laptop is fine; paste the
  two lines into the server `.env`).
- **Never change generated values after the first start.** MongoDB stores its passwords on first init; new VAPID
  keys break existing push subscriptions; without `RESTIC_PASSWORD` no backup can be restored. Keep a copy of
  `RESTIC_PASSWORD` in your password manager, outside the server.
- `APP_URL` must be the exact address you open the app at (on the server: `https://<machine>.<tailnet>.ts.net`).
  Requests from any other origin are refused (CSRF protection).
- `VAPID_SUBJECT`: `mailto:you@example.com` or an https URL of yours.
- Market-data keys are optional and used only when the investing module is on (see [Module notes](#module-notes)).

## Server setup (first deploy)

The server runs released images from GitHub Container Registry (GHCR). CI never connects to the server: the server
pulls. Run everything as the non-root user that is in the `docker` group, from the project directory.

1. **Get the files.** Clone the repository (a fine-grained token with read access to this repository, or a deploy
   key): `git clone https://github.com/<you>/finance_tracker.git && cd finance_tracker`.
   The server needs `docker-compose.yml`, `docker/mongo-init/`, `deploy/` and `.env`; nothing is built there.
2. **Configure.** `cp .env.example .env`, fill it in, set `IMAGE_NAME=ghcr.io/<you>/finance_tracker` (lower case)
   and `APP_URL=https://<machine>.<tailnet>.ts.net`. `chmod 600 .env`.
3. **Log in to GHCR with a read-only token.** Create a GitHub *classic* personal access token with only the
   `read:packages` scope (Settings → Developer settings → Personal access tokens). On the server:
   `echo '<token>' | docker login ghcr.io -u <your-github-user> --password-stdin`.
   The token lives only in the server's Docker credential store; never in the repository or in GitHub secrets.
4. **Check the disk.** `df -h /`. Each release image is a few hundred MB; the deploy script keeps the last 3.
5. **Deploy a released tag.** After you merge to `main`, the Release workflow publishes `sha-<7 chars>` tags (see
   GitHub → Packages). Then: `deploy/deploy.sh sha-abc1234`. The first deploy skips the pre-deploy backup (nothing
   to back up yet), starts MongoDB, runs the migrations and waits for `/api/ready`.
6. **Expose it on your tailnet** with [Tailscale serve](#tailscale-serve), open `https://<machine>.<tailnet>.ts.net`
   from a tailnet device and complete the setup wizard.
7. **Install the PWA** on your phone (Share → Add to Home Screen on iOS). On iPhone and iPad, push notifications
   work only for the installed app (iOS/iPadOS 16.4 or later) and permission must be asked from a tap; Settings →
   Notifications does that.

`docker compose ps`, `logs` and similar commands on the server: use `deploy/dc.sh ps`, `deploy/dc.sh logs -f app`
so Compose runs the recorded tag and never tries to build `local`.

## Tailscale serve

The app listens on `127.0.0.1:${APP_HOST_PORT}` only (default 3000). Docker-published ports bypass host firewalls
such as UFW, so the Compose file never publishes on `0.0.0.0`. Tailscale serve gives it an HTTPS address that only
your tailnet can reach. **Never use Tailscale Funnel**: Funnel publishes a service to the whole internet.

Once, in the Tailscale admin console (tailscale.com/kb/1153/enabling-https, read 2026-10-23):
1. DNS page → enable **MagicDNS** if it is off.
2. DNS page → **HTTPS Certificates** → **Enable HTTPS**. You are asked to acknowledge that machine names and the
   tailnet DNS name are published in the public Certificate Transparency logs. Rename the machine first if its name
   says anything you do not want public.

On the server (tailscale.com/kb/1242/tailscale-serve, read 2026-10-23; the page lists `--bg`, `--https=<port>`,
`status`, `off` and `reset`; this exact combination is composed from those flags):

```sh
sudo tailscale serve --bg --https=443 http://127.0.0.1:3000   # serve the app on https://<machine>.<tailnet>.ts.net
tailscale serve status                                         # check what is served
sudo tailscale serve --https=443 http://127.0.0.1:3000 off     # stop serving it
```

If another service on the host already uses port 443 publicly, serve normally still works on the tailnet address
[uncertain until tested on your host]. Check from a phone on the tailnet. If it does not, use another port:
`sudo tailscale serve --bg --https=8443 http://127.0.0.1:3000`, set `APP_URL=https://<machine>.<tailnet>.ts.net:8443`
and restart with `deploy/dc.sh up -d app worker`.

## Firewall and tailnet ACL

- **Hetzner Cloud firewall:** deny all inbound traffic by default. Allow only what other services on the host truly
  need publicly. SSH should not be open to the internet: reach the server through Tailscale (Tailscale SSH or sshd on
  the tailnet address). The finance app needs **no inbound rule**: it is reached only through Tailscale.
- **UFW:** Docker-published ports bypass it, so this stack relies on loopback binding instead. MongoDB publishes no
  port at all and sits on an internal Docker network with no route out.
- **Tailnet ACL suggestion** (Access controls in the admin console): allow only your own devices to reach the server
  on 443, for example:

```json
{
  "tagOwners": { "tag:finance": ["autogroup:admin"] },
  "acls": [
    { "action": "accept", "src": ["autogroup:member"], "dst": ["tag:finance:443"] }
  ]
}
```

  Tag the server `tag:finance` (or use its machine name in `dst`). Narrow `src` to your own user if others share the
  tailnet. Keep a separate rule for your admin SSH access.

## Deploy, rollback and updates

`deploy/deploy.sh <tag>` (an immutable tag such as `sha-abc1234`, never `latest`):
1. takes a pre-deploy backup through the backup service and waits for it (stops if it fails; nothing changes);
2. pulls the exact tag of the app and backup images;
3. runs the idempotent database migrations;
4. `docker compose up -d` on the new tag;
5. waits up to `DEPLOY_READY_TIMEOUT` seconds (default 120) for `/api/ready` (database and worker heartbeat);
6. if it does not become ready, switches back to the tag that was running and exits non-zero;
7. records the tag in `.deploy/` (current, previous, history, log) and removes older images it pulled, keeping the
   last 3. It touches only this project's two image repositories: never run `docker system prune -a`, and never
   `docker compose down -v` (that deletes the database volume).

`deploy/rollback.sh` switches back to the previous recorded tag (images are kept locally; nothing is pulled).
Migrations are forward-only and additive, so the previous release runs on the newer schema.

Find the tag of a commit: `sha-` plus the first 7 characters of the commit hash, also listed under the package in
GitHub. Deploy logs: `.deploy/deploy.log`.

**Optional auto-update (off until you enable it).** `deploy/finance-updater.timer` runs `deploy/check-update.sh`
every 15 minutes: it pulls the moving `main` tag, reads the commit it was built from and deploys the matching
`sha-` tag when it changed. Edit the paths and user in `deploy/finance-updater.service`, then:

```sh
sudo cp deploy/finance-updater.service deploy/finance-updater.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now finance-updater.timer
systemctl list-timers finance-updater.timer      # check; disable with: sudo systemctl disable --now finance-updater.timer
```

**Fallback without GHCR** (builds on the server, slower and uses more memory):

```sh
git pull
IMAGE_TAG=local docker compose up -d --build
```

## Backups and restore

The `backup` service dumps MongoDB (`mongodump`), encrypts and stores it with restic, on a schedule
(`BACKUP_SCHEDULE`, default 03:30 Europe/Athens) and before every deploy. Retention: 7 daily, 4 weekly, 6 monthly.
The first nightly run of each month also checks the repository and restores into a temporary MongoDB to compare
document counts. A failed run, or no success for `BACKUP_STALE_HOURS` (26), sends a push notification and shows in
Settings → Backups. The container refuses to start (exit 78) on an invalid configuration: an http endpoint, a missing
password or missing credentials.

Targets (`BACKUP_TARGET`): `local` (default, a Docker volume; tested), `s3` (Cloudflare R2 or another S3-compatible
store), `sftp` (for example a Hetzner Storage Box).

### Cloudflare R2 (off-server copy)

The data is small (estimated well under 1 GB including history), inside R2's free 10 GB-month.

1. In the Cloudflare dashboard create a bucket for backups only, for example `finance-tracker-backup`. Choose the EU
   jurisdiction if you want EU-only storage (then use the `.eu.` endpoint); it cannot be changed later.
2. **The bucket must stay private.** Leave "Public Development URL" (r2.dev) disabled and add **no custom domain**:
   a connected custom domain serves the bucket's objects publicly. Never reuse a bucket that has one, such as a
   bucket behind a CDN domain.
3. R2 → Manage API tokens → Create **Account API token**, permission **Object Read & Write**, scoped to this one
   bucket only. Copy the Access Key ID and Secret Access Key at once (the secret is shown only once).
4. In the server `.env`: `BACKUP_TARGET=s3`, `R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`,
   `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_REGION=auto`.
5. `deploy/dc.sh up -d backup`, then `deploy/dc.sh exec -T backup backup-now` and check
   `deploy/dc.sh exec -T backup backup-status`. The bucket now has objects under `restic/`.
6. Re-open the bucket settings and confirm public access is still off.

### Hetzner Storage Box (optional, SFTP)

Enable "SSH Support" (and "External Reachability" if needed) in the Hetzner console, install your key with
`cat key.pub | ssh -p23 uXXXXX@uXXXXX.your-storagebox.de install-ssh-key`, pin the host key with
`ssh-keyscan -p 23 uXXXXX.your-storagebox.de > known_hosts`, mount the key and `known_hosts` read-only into the
backup container with a `docker-compose.override.yml`, and set `BACKUP_TARGET=sftp` and the `SFTP_*` values.
Run `backup-now` once to create the repository. [uncertain] restic over the Storage Box was not tested here.

### Hetzner server backups

Optional and manual: Hetzner Cloud server backups or snapshots are a coarse whole-server safety net, enabled in the
Hetzner console (Backups → Enable Backups). This is a paid step; check the price in the console first. They do not
replace the application-consistent restic backups.

### Commands

```sh
deploy/dc.sh exec -T backup backup-now        # backup now (no pruning)
deploy/dc.sh exec -T backup backup-status     # last results and snapshot list
deploy/dc.sh exec -T backup restore-test      # restore into a temporary MongoDB and compare counts
deploy/dc.sh stop app worker                  # before a real restore
deploy/dc.sh exec -T backup restore --yes     # replace the database with the latest snapshot (takes a safety backup first)
deploy/dc.sh exec -T backup restore --snapshot <id> --yes
deploy/dc.sh up -d app worker
```

**Monthly restore check** (the automatic one runs on the first nightly run of each month): read the result in
Settings → Backups or run `restore-test`; check that the newest snapshot is under 26 hours old; for R2, check the
bucket size and that public access is still off. Once a year, rehearse a full restore on a spare machine with only
your `.env` backup values and the `RESTIC_PASSWORD` copy from your password manager.

## Operations

- Health: `GET /api/health` (liveness) and `GET /api/ready` (database and worker heartbeat), minimal JSON.
- Admin CLI: `deploy/dc.sh exec app node dist/admin.mjs list-users`, `reset-password <email>` (asks for the new
  password), `disable-totp <email>`.
- Logs: `deploy/dc.sh logs -f app worker backup` (JSON lines; secrets and keys are never logged).
- Memory limits (set in `docker-compose.yml`): mongo 768 MB (WiredTiger cache 0.25 GB), app 512 MB, worker 384 MB, backup 768 MB.

## CI/CD

- **CI** (`.github/workflows/ci.yml`, pull requests and pushes): lint, typecheck, `npm audit` (critical),
  actionlint, unit and integration tests on a MongoDB service container, gitleaks over the history, production
  image build with Trivy (critical) and an e2e smoke test against Docker Compose. Docs-only changes skip the heavy
  jobs. One aggregate job, `ci-success`, is the single check to require. Free GitHub features only.
- **Release** (`.github/workflows/release.yml`, pushes to `main` and `v*` tags): reruns CI, then the `publish` job
  (the only one with `packages: write`) pushes `linux/amd64` images to GHCR as private packages, tagged `sha-<7>`,
  `main` and, for tags, the version. No secrets beyond the automatic `GITHUB_TOKEN`; CI never reaches the server.
- **Dependabot** (`.github/dependabot.yml`): npm, Docker and GitHub Actions, weekly, minor and patch grouped.
- **Branch protection (recommended):** in the repository settings protect `main` and require the `ci-success`
  check, if your GitHub plan offers it for private repositories (not confirmed for Free, see `docs/BLOCKERS.md`).
- After the first merge to `main`, check the Release run and that both packages exist and are private.

## Module notes

- **Investing (optional, off by default).** Turn it on in the setup wizard or Settings → Modules. While it is off
  there is no investing screen, navigation entry, push or market-data call. Prices come from free provider tiers
  only, with keys you add to `.env` (`TWELVEDATA_API_KEY`, `EODHD_API_KEY`, `FMP_API_KEY`, `ALPHAVANTAGE_API_KEY`,
  `FINNHUB_API_KEY`); without keys, enter prices by hand. Requests carry only ticker symbols and dates. Before relying
  on a provider, run the live checklist in `docs/MARKET-DATA.md` section 8. Output is ranked by past-performance
  criteria; it is never a prediction or a buy/sell signal.
- **Tax/EFKA estimator.** Mark freelance income sources (Income → source → Freelance invoices). Rates come only from
  `config/tax/<year>.json` (sources, review dates and [uncertain] flags), copied per user and editable on the Tax
  page. Every figure is an estimate, not tax advice; confirm with an accountant. The open questions are listed on
  the page and in `docs/research/tax-efka.md` section 10.
- **Month-end reports** are generated once per closed month and never change; print them to A4 or PDF from the
  report page.

## Documents

| File | Content |
|---|---|
| `docs/PLAN.md` | Architecture, data model, API, domain rules, design direction |
| `docs/DECISIONS.md` | Every decision with its reason |
| `docs/BLOCKERS.md` | Skipped, unverified or pending items and what you can do about them |
| `docs/MARKET-DATA.md` | Free market-data providers, verified limits, chain and live checklist |
| `docs/allocation-methodology.md` | Smart Plan rules and sources |
| `docs/research/` | Tax/EFKA, backups (restic, R2), GitHub CI limits |
| `docs/EXTRAS.md` | Ranked ideas not built |
| `docs/HANDOFF.md` | Handoff notes (Greek) |
| `PRODUCT.md`, `DESIGN.md` | Product context and design system |
