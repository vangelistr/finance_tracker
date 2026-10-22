# GitHub CI/CD limits and design research

Date: 2026-10-22. Status: complete (Phase 0 research). Every claim has a source "read 2026-10-22"; unconfirmed items are tagged [uncertain] and collected at the end.

## 1. Free plan limits for a private repo (personal account)

Source key (all "read 2026-10-22"):
- [B] https://docs.github.com/en/billing/concepts/product-billing/github-actions
- [P] https://docs.github.com/en/billing/concepts/product-billing/github-packages
- [L] https://docs.github.com/en/actions/reference/limits
- [C] https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
- [R] https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- [M] https://docs.github.com/en/billing/reference/actions-minute-multipliers
- [CL] https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/

| Item | Free plan (personal account), private repo | Source |
|------|---------------------------------------------|--------|
| Included Actions minutes / month | 2,000 (standard GitHub-hosted runners) | [B] |
| Linux multiplier | The current docs do not list a "multiplier". They list per-minute prices instead. The [B] page example says a 10-minute Linux job uses "10 minutes of the repository owner's allowance", so Linux is counted 1:1. Windows and macOS counting against the quota is not stated in the pages read [uncertain]. We use Linux only. | [B] |
| Rounding | "GitHub rounds the minutes and partial minutes each job uses up to the nearest whole minute." Each job is rounded separately. | [M] |
| Per-minute price beyond quota (not our case) | Linux 2-core x64 $0.006, Linux 2-core arm64 $0.005, Linux 1-core $0.002, Windows $0.010, macOS $0.062 | [B], [M] |
| Artifacts + Packages storage (one shared pool) | 500 MB | [B], [P] |
| Actions cache storage | 10 GB per repository, separate from the 500 MB pool | [B], [L] |
| Cache eviction | Entries not accessed for over 7 days are removed. When the repo goes over 10 GB, the oldest caches by last access date are deleted first. | [C] |
| Cache access scope | A run can restore caches from its own branch and the default branch (PR runs also the base branch). Sibling and child branch caches are not reachable. PR-run caches are scoped to the merge ref. | [C] |
| Cache rate limits | 200 uploads/min and 1,500 downloads/min per repo | [L] |
| Concurrent jobs (Free) | 20 total | [L] |
| Max job time (hosted) | 6 hours (we will set much lower `timeout-minutes`) | [L] |
| Workflow re-runs | 50 per run | [L] |
| Max `needs`/matrix size | 256 matrix jobs per run | [L] |

### GHCR (container registry) billing

- "Container image storage and bandwidth for the Container registry is currently free." GitHub promises at least one month's notice before changing this. [P]
- The docs also give a general Packages free allowance on Free: 500 MB storage and 1 GB data transfer per month, but this is for the Packages billing model, and the GHCR sentence above says the container registry is currently free. [P]
- Downloads in a workflow that authenticates with `GITHUB_TOKEN` are free on hosted runners and self-hosted runners. Downloads with a PAT are free on hosted runners but billed on self-hosted runners. [P]
- Data transferred in from any source is free. Public packages are free. [P]
- Whether private GHCR images pulled by our own server (outside Actions) count as billable data transfer: the page says GHCR bandwidth is currently free, so no charge today, but this can change with one month's notice [uncertain: future policy].
- Rule for us: keep the image private, prune old `sha-*` tags (GHCR has no automatic retention) so we stay ready if GHCR becomes metered.

### 2025-2026 pricing changes

- Hosted-runner prices dropped by up to 39% on 2026-01-01. "The free usage minute quotas will remain the same." [CL]
- A planned $0.002/min "cloud platform charge" for self-hosted runners (was due 2026-03-01) is postponed with no new date. We use no self-hosted runners, so it does not affect us. [CL]
- The Billing page [B] still lists 2,000 minutes for Free, so the free allowance is unchanged as of 2026-10-22.
- I did not find a later 2026 change to the Free allowance in the pages read. [uncertain: other 2026 changelog entries not exhaustively searched]

### When the allowance is used up

- Without a valid payment method on file, usage is blocked once the quota is used up. With a payment method, usage above quota is billed and may be limited by budgets. [B]
- The Billing page does not state a default spending limit value [uncertain]. Practical rule: do not add a payment method to the account. Then CI cannot cost money; it only stops.
- Account owners can get email alerts at 90% and 100% of included usage. [B]
- Overage rates if a payment method existed: shared storage $0.25/GB-month, cache $0.07/GB-month. [B]
- Deleting artifacts stops future storage charges, but storage already accrued in the billing cycle remains on the bill. [B]

### Runners

- `ubuntu-latest` is listed in the Linux x64 row. Its link points to the Ubuntu 24.04 image README, so it currently maps to Ubuntu 24.04. [R]
- The private-repo table also lists `ubuntu-26.04` as a label. We should not use it; pin to `ubuntu-24.04` for stability, or accept `ubuntu-latest` and expect a future move. [R]
- Private repo `ubuntu-latest`: 2 vCPU, 8 GB RAM, 14 GB storage. (Public repos get 4 vCPU.) [R]
- `ubuntu-slim` (1 vCPU, 5 GB RAM) exists. Billed at the 1-core price. Whether it counts 1:1 against the free quota is not stated [uncertain]. We do not plan to use it for Docker builds or e2e.
- arm64 standard runners (`ubuntu-24.04-arm`) are free and unlimited only in public repos. In private repos they use the account's free minutes, then per-minute charges. So they are not free for us. We build amd64 only. [R]
- 14 GB disk on a 2-core runner: a Docker build plus Playwright browsers plus node_modules is tight but normally fits [uncertain: depends on image size].

## 2. Build provenance / attestations

### 2a. GitHub artifact attestations (`actions/attest-build-provenance`)

- **Not available for our repo.** The action README says: "Artifact attestations are available in public repositories for all current GitHub plans." Free, Pro and Team plans support them only for public repositories. Private or internal repositories need GitHub Enterprise Cloud. (https://github.com/actions/attest-build-provenance, read 2026-10-22)
- Private repos that do have the feature use GitHub's own Sigstore instance (no public transparency log), and reach SLSA v1.0 Build Level 2. (https://docs.github.com/en/actions/concepts/security/artifact-attestations, read 2026-10-22)
- As of v4 the action is only a wrapper around `actions/attest`. The README says new setups should use `actions/attest`. (same README, read 2026-10-22)
- The docs.github.com page itself did not state the plan matrix [uncertain on docs.github.com wording]. The plan rule comes from the action README.
- Result: do not use `actions/attest-build-provenance` or `actions/attest`. Do not add `id-token: write` / `attestations: write` permissions.

### 2b. BuildKit's own SLSA provenance and SBOM via `docker/build-push-action`

| Item | Fact | Source |
|------|------|--------|
| Default provenance | Public repo: `mode=max` added automatically. Private repo: `mode=min` added automatically. | https://docs.docker.com/build/ci/github-actions/attestations/ (read 2026-10-22) |
| `mode=max` on a private repo | Set `provenance: mode=max` by hand. | same |
| SBOM | Not added automatically. Set `sbom: true` (action v4 or later). | same |
| Needs push | Attestations need `push: true` to a registry. They are not stored with `load: true` or the `docker` exporter. So a build-only job has no attestations. | same |
| min vs max | `min` omits build-arg values and layer details and "is safe to use for all builds". `max` adds the Dockerfile, the LLB definition and build args. Secrets must go in secret mounts, never build args. | https://docs.docker.com/build/metadata/attestations/slsa-provenance/ (read 2026-10-22) |
| Action inputs | `provenance` and `sbom` are inputs of `build-push-action`. Also `attests` for explicit `type=sbom,generator=...`. | https://github.com/docker/build-push-action README (via `gh api`, read 2026-10-22) |
| Cost | No separate fee. The attestations are extra manifests in the same package, so they add a few KB to GHCR storage. GHCR is currently free (see section 1). | [P] in section 1 |
| SLSA version | v0.2 is the default; v1 is opt-in with `version=v1`. | slsa-provenance page |

Known problems with GHCR (community reports, not an official GitHub statement):
- GHCR's web UI lists an extra `unknown/unknown` platform and may stop showing labels like description and license when attestation manifests are in the index. The issue is open and labelled as needing an upstream fix. (https://github.com/docker/build-push-action/issues/900, read 2026-10-22)
- One user reported that a cleanup workflow which deleted "untagged" versions also deleted the attestation manifests and broke pulls. (same issue). **Rule: never auto-delete untagged GHCR versions. Delete by explicit tag age only.**
- Pulls of the normal image are not reported broken by the attestations themselves; the thread does not confirm pulls explicitly [uncertain].

### 2c. Recommendation

- Use BuildKit attestations, only on pushed images (main and `v*` tags): `provenance: mode=max` and `sbom: true`. We pass no build-arg secrets, so `max` is safe. The PR/no-push build keeps both off (they would have no effect anyway).
- Do not add `actions/attest-build-provenance`.
- Say honestly in docs: this provenance is stored with the image but nobody verifies it (the pull-based server does not check it). It is audit evidence, not enforcement.
- If the GHCR UI quirk (unknown/unknown, missing labels) is a nuisance, the fallback is `provenance: false` and `sbom: false`; nothing else in the design depends on them. Labels stay available through `docker inspect` either way.
- Keep the metadata-action OCI labels. Because the GHCR UI may not show them with an attestation index, optionally set `DOCKER_METADATA_ANNOTATIONS_LEVELS: manifest,index` and pass `annotations`; this was only suggested in the issue thread for Buildx 0.12+ [uncertain whether still needed].

## 3. Workflow facts the design relies on

### 3a. Path filters and required status checks

- Fact: "You cannot use both the `paths` and `paths-ignore` filters for the same event." If all changed paths match `paths-ignore`, the workflow does not run. If a workflow is skipped by path filtering, "checks associated with that workflow will remain in a 'Pending' state", and a PR that requires them is blocked. (https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax, read 2026-10-22)
- Fact: a job skipped by an `if` condition reports "Success" and "will not prevent a pull request from merging, even if it is a required check". (https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions, read 2026-10-22)
- Fact: required checks must be `successful`, `skipped` or `neutral`. Job names should be unique across all workflows, or status results get ambiguous. (https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches, read 2026-10-22)
- Fact: if a job fails or is skipped, jobs that `needs` it are skipped, unless the dependent uses `if: always()`. (workflow-syntax page, read 2026-10-22)
- **Do not put `paths-ignore` on the workflow trigger** if any check is ever made required. Instead, always start the workflow and decide inside it. Two patterns:
  1. Changes job (`dorny/paths-filter`) that outputs `code=true|false`; heavy jobs use `if: needs.changes.outputs.code == 'true'`; they show as skipped (counts as success); one aggregate job `ci-success` with `needs: [all jobs]`, `if: always()`, and a step that fails when `contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')`. Require only `ci-success`.
  2. No path logic at all (simplest) and rely on caches and concurrency to save minutes.
- Cheaper alternative to `dorny/paths-filter` (a third-party action): a `git diff --name-only` step in the changes job. `dorny/paths-filter` needs `pull-requests: read` for PRs, and a checkout for push events. (https://github.com/dorny/paths-filter README via `gh api`, read 2026-10-22)
- **Branch protection on a private repo with GitHub Free: availability is unclear.** The docs pages I opened (about-protected-branches, managing-a-branch-protection-rule, about-rulesets, available-rules-for-rulesets, read 2026-10-22) do not state a plan matrix. A web search summary says official docs offer protection on private repos only with Pro/Team/Enterprise and users report "not enforced" warnings for Free personal private repos, but that came from search results and community posts, not a page I opened. [uncertain] **Design consequence: the pipeline must not depend on required checks to be safe.** Since the user merges `build/finance-tracker` by hand, `ci-success` is still worth having (one clear status), but enforcement is by the human.

### 3b. Reusable workflows (`workflow_call`)

- Declared with `on: workflow_call` with `inputs` (types boolean, number, string) and `secrets`; called at job level with `uses: ./.github/workflows/<file>.yml`, `with:`, `secrets:`. Reusable workflows must sit directly in `.github/workflows` (no subfolders). Max nesting: 10 levels. Contexts/expressions are not allowed in `uses`. (https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows, read 2026-10-22)
- A same-repo call runs the called file at the caller's commit. For other repos, pin to a SHA. (same page)
- `permissions`: in a chain, permissions "can only be maintained or reduced, not elevated". So the caller job's `permissions:` is the ceiling; the called workflow's jobs can only narrow it. (same page). Setting any permission sets all unspecified ones to `none`; `permissions: {}` disables all. (workflow-syntax page, read 2026-10-22)
- `secrets: inherit` passes all caller secrets to the directly called workflow only (not further down). The docs describe it for callers in the same organisation or enterprise. (same reuse page and workflow-syntax page, read 2026-10-22) For a personal-account repo calling a workflow in the same repo, the docs I read do not say explicitly whether `inherit` works [uncertain]. **We need no secrets, so do not use `secrets: inherit` at all.**
- Are reusable workflows worth it here? One repo, one pipeline: probably not. A single `ci.yml` with parallel jobs plus a separate `release.yml` is simpler. Use `workflow_call` only if CI is reused by the release workflow (to avoid re-running tests) and then pass no secrets.

### 3c. Concurrency and timeouts

- `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` cancels the running run in that group when a new one arrives. Without `cancel-in-progress`, a new run only replaces a pending one. `queue: max` cannot be combined with `cancel-in-progress: true`. (workflow-syntax page, read 2026-10-22)
- Rule: cancel in progress for PR/branch pushes; **do not cancel on `main` or tag releases** (use `cancel-in-progress: ${{ github.ref_type == 'branch' && github.ref != 'refs/heads/main' }}` or a separate group for tags).
- `jobs.<id>.timeout-minutes` default is 360. Always set it low (5-20 min per job). (workflow-syntax page, read 2026-10-22)

### 3d. Caching

- `actions/setup-node` with `cache: npm` caches the npm global cache, keyed on a hash of `package-lock.json` (`cache-dependency-path` to override). It does **not** cache `node_modules`. Use `npm ci`. (https://github.com/actions/setup-node README, read 2026-10-22)
- setup-node v7 enables npm caching automatically if `package.json` has `packageManager` (or `devEngines.packageManager`) set to npm; the README recommends `package-manager-cache: false` for workflows with elevated privileges. Always set `cache` explicitly, and in the release job (which has `packages: write`) set `package-manager-cache: false`. (same README)
- Next.js: persist `.next/cache`. Docs example (uses `actions/cache`): `path: ~/.npm` and `.next/cache`; `key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**/*.js','**/*.jsx','**/*.ts','**/*.tsx') }}`; `restore-keys: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-`. (https://nextjs.org/docs/app/guides/ci-build-caching, read 2026-10-22)
- Cache scope: runs restore from their own branch and the default branch only; entries unused for 7 days are evicted; 10 GB cap per repo. (section 1 [C]) Consequence: a cache written on `build/finance-tracker` is not visible to `main` runs (sibling), and a PR-run cache is only visible to re-runs of that PR. Warm the default-branch cache by running the same jobs on push to `main`.
- Docker buildx `type=gha`: `cache-from: type=gha` and `cache-to: type=gha,mode=max`. Since 2025-04-15 only GitHub Cache service API v2 is supported. Minimum versions: Buildx v0.21.0, BuildKit v0.20.0, Compose v2.33.1, Docker Engine v28.0.0 (when the Docker driver uses the containerd image store). Use `docker/setup-buildx-action` (v4.4.1 pinned below) so the versions are met. Use a unique `scope` per image. Mode `max` exports all layers and uses more of the 10 GB. (https://docs.docker.com/build/ci/github-actions/cache/ and https://docs.docker.com/build/cache/backends/gha/, read 2026-10-22)
- The default `docker` driver works with gha cache only if the containerd image store is on; otherwise use the `docker-container` driver, which `setup-buildx-action` creates. (backend page, read 2026-10-22)

### 3e. Service containers (Mongo for integration tests)

- Service containers need a Linux (Ubuntu) runner. In a job that runs directly on the runner VM, map ports and connect via `localhost:<port>`. In a container job, connect by the service label as hostname. (https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers, read 2026-10-22)
- Health checks use `options: >- --health-cmd ... --health-interval 10s --health-timeout 5s --health-retries 5` (Postgres example). (https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers, read 2026-10-22)
- For `mongo:8.0`, a health command such as `mongosh --quiet --eval "db.adminCommand('ping')"` is the usual choice; I did not find it in a GitHub page [uncertain]. Test it locally with docker before pinning.
- Docker Hub pull rate limits could affect `mongo:8.0` on shared runner IPs [uncertain: not checked in a primary source]. Mitigation: pin by digest and keep the service image count to one.

### 3f. Runners

- `ubuntu-latest` = Ubuntu 24.04 image today (section 1 [R]). 2 vCPU, 8 GB, 14 GB disk for private repos. Pin `ubuntu-24.04` explicitly so a future `-latest` flip does not break the build.
- arm64 hosted runners are free only for public repos; private repos use the free minutes and then charges (section 1 [R]). We build amd64 only, so this is informational. Do not enable QEMU (`setup-qemu-action`): not needed for amd64-only builds.

## 4. Dependabot

### 4a. Availability and token rules

- Dependabot alerts, security updates, version updates and the dependency graph are listed under "Available for all GitHub plans". (https://docs.github.com/en/code-security/getting-started/github-security-features, read 2026-10-22) The page does not call out private repos separately for these features [uncertain for private; "most of these features are available for public and private repositories"].
- Secret scanning and push protection on private repos need GitHub Secret Protection; code scanning on private repos needs GitHub Code Security. Neither is available to us on Free (the page implies, but does not say outright that Free personal accounts cannot buy them) [uncertain]. This is why gitleaks and Trivy run in CI. (same page)
- Dependabot-triggered runs of `push`, `pull_request` etc. get a **read-only `GITHUB_TOKEN`** and **no Actions secrets** (only Dependabot secrets). Use `permissions:` to narrow, never to raise. (https://docs.github.com/en/code-security/dependabot/troubleshooting-dependabot/troubleshooting-dependabot-on-github-actions, read 2026-10-22) Our CI needs no secrets, so Dependabot PRs run the full CI normally. The release job must not run on Dependabot PRs (it only runs on `main` and `v*` tags).
- Standard hosted runner minutes for Dependabot jobs are listed as free in the billing doc summary I read ("free only in public repositories, for GitHub Pages, and for Dependabot"). The sentence came through a summarised fetch of [B]; the Dependabot troubleshooting page says nothing on this. [uncertain]

### 4b. `.github/dependabot.yml` (version 2)

Facts: `version` is always `2`. Ecosystem identifiers are `npm`, `docker` and `github-actions`. `schedule.interval` takes `daily|weekly|monthly|...`; `day` is `monday`...`sunday` for weekly; `time` is `hh:mm`, UTC unless `timezone` is set (IANA name). `groups.<name>.update-types` takes `minor`, `patch`, `major`. Default `open-pull-requests-limit` is 5. For `github-actions`, `directory: "/"` makes Dependabot look in `/.github/workflows`. (https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference, read 2026-10-22)

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "Europe/Athens"
    open-pull-requests-limit: 5
    groups:
      npm-minor-patch:
        update-types: ["minor", "patch"]
    commit-message:
      prefix: "chore(deps)"
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "Europe/Athens"
    groups:
      docker-minor-patch:
        update-types: ["minor", "patch"]
    commit-message:
      prefix: "chore(docker)"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "Europe/Athens"
    groups:
      actions-minor-patch:
        update-types: ["minor", "patch"]
    commit-message:
      prefix: "chore(ci)"
```

Notes:
- `Europe/Athens` is an IANA name; the page says only "must match an entry in the IANA time zone database", it does not list this example. The name is valid in that database. [low risk]
- The `docker` ecosystem reads Dockerfiles (and compose files only via the separate `docker-compose` ecosystem). If compose files pin images (mongo), add a `docker-compose` entry. (options page, read 2026-10-22)
- Dependabot updates SHA-pinned actions and rewrites the `# vX.Y.Z` comment when the pin is a full SHA with a version comment. This is widely used but I did not open a page that states it [uncertain].
- Group PRs only cover minor and patch. Majors arrive as single PRs. Good: majors need a human.
- `commit-message.prefix` max 50 chars; Dependabot adds a colon if the prefix ends in a letter, number, `)` or `]`. (options page)

## 5. Security tools in CI

All version and checksum data below was read with `gh api` (GET) on 2026-10-22. SHA-256 values come from each release's own `*checksums.txt`, so they are "trust on first read" pins: they stop later tampering, not a tampering that already happened before 2026-10-22.

### 5a. gitleaks

| Item | Fact |
|------|------|
| Current version | v8.30.1, published 2026-03-21 (latest release; last commit on default branch 2026-07-22). https://github.com/gitleaks/gitleaks/releases (via `gh api`, read 2026-10-22). Release is not marked immutable. |
| Linux amd64 asset | `gitleaks_8.30.1_linux_x64.tar.gz`, sha256 `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb` (from `gitleaks_8.30.1_checksums.txt`) |
| `gitleaks/gitleaks-action` licence | README: `GITLEAKS_LICENSE` is "required for organizations, not required for user accounts". A personal account needs no licence key. For an organisation a free key is requested via a form (name, email, company). Since v2.0.0 the action's licence changed from MIT to a custom licence (LICENSE.txt). https://github.com/gitleaks/gitleaks-action README (via `gh api`, read 2026-10-22) |
| gitleaks-action version | v3.0.0 (2026-05-30, immutable release, `node24`): only migrates Node 20 to Node 24, no input/output change. Node 20 is removed from hosted runners on 2026-09-16 (per its release notes), so any `@v2` pin is dead now. https://github.com/gitleaks/gitleaks-action/releases/tag/v3.0.0 (read 2026-10-22) |
| Docker image | README documents `ghcr.io/gitleaks/gitleaks:latest` and `zricethezav/gitleaks:latest`. The repo's `release.yml` builds images with `docker/metadata-action` on `release: published`, to both registries. A tag `ghcr.io/gitleaks/gitleaks:v8.30.1` is therefore expected but I could not list the tags with `gh api` [uncertain]. A digest pin must be resolved in Phase 1 (`docker buildx imagetools inspect`). |
| Commands (v8) | `gitleaks git` scans git history; `gitleaks dir` scans files. `--log-opts` passes options to `git log -p` (example in README: `--log-opts="--all commitA..commitB"`). `--redact` hides secrets in logs, `--exit-code` (default 1) on leaks, `--no-banner`, `-v`, `--baseline-path`, `--report-path`. `.gitleaksignore` holds fingerprints of accepted findings; allowlists live in `.gitleaks.toml`. https://github.com/gitleaks/gitleaks README (via `gh api`, read 2026-10-22) |

Recommendation (gitleaks): **run the pinned binary directly, not the action.** Reasons: no third-party action code in a job that can read the repo; works for personal and org accounts; no PR-comment feature needed; checksum pin is simple.

```yaml
      - uses: actions/checkout@<sha> # v7.0.1
        with:
          fetch-depth: 0          # full history, required for `gitleaks git`
          persist-credentials: false
      - name: gitleaks (full history on main/tags, range on PRs)
        run: |
          set -euo pipefail
          VER=8.30.1
          curl -sSfL -o gl.tgz "https://github.com/gitleaks/gitleaks/releases/download/v${VER}/gitleaks_${VER}_linux_x64.tar.gz"
          echo "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb  gl.tgz" | sha256sum -c -
          tar -xzf gl.tgz gitleaks
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            RANGE="${{ github.event.pull_request.base.sha }}..${{ github.event.pull_request.head.sha }}"
            ./gitleaks git --no-banner --redact -v --log-opts="$RANGE" .
          else
            ./gitleaks git --no-banner --redact -v .
          fi
```
- Full history: `fetch-depth: 0` plus `gitleaks git .` (default scans all commits reachable from HEAD). PR diff: `--log-opts="<base>..<head>"`. Use `${{ github.event.pull_request.* }}` values only through `env:` in the real file, not inline, to avoid script injection habits (these SHAs are not attacker text, but keep the habit).
- Also scan the working tree with `gitleaks dir .` if untracked generated files matter (optional).
- Local run: `docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:<tag> git --no-banner --redact -v /repo` (README shows `docker run -v ... ghcr.io/gitleaks/gitleaks:latest [COMMAND] [OPTIONS] [SOURCE_PATH]`).

### 5b. Trivy: the 2026 supply-chain incident

Primary sources read 2026-10-22:
- GitHub advisory GHSA-69fq-xp46-6x23 "Trivy ecosystem supply chain was briefly compromised", critical, published 2026-03-21/24 (read via `gh api /advisories/GHSA-69fq-xp46-6x23` and the repo advisory list). https://github.com/aquasecurity/trivy/security/advisories/GHSA-69fq-xp46-6x23
- Aqua blog "Update: Ongoing Investigation and Continued Remediation", last update 2026-04-01. https://www.aquasec.com/blog/trivy-supply-chain-attack-what-you-need-to-know/
- **Correction to the earlier attempt's notes:** GHSA-cxm3-wv7p-598c is NOT a Trivy advisory. It is "Malicious versions of Nx were published" (2025-08-27). It is unrelated to our tooling.

What happened (from the advisory):
- 2026-03-19: with compromised credentials an attacker published a malicious **Trivy v0.69.4** (binary, GHCR/ECR/Docker Hub images, deb/rpm; window about 3 h), force-pushed **76 of 77 version tags of `aquasecurity/trivy-action`** to credential-stealing code in `entrypoint.sh` (window about 12 h), and replaced **all 7 tags of `aquasecurity/setup-trivy`** (v0.2.0-v0.2.6; about 4 h).
- 2026-03-22: malicious Docker Hub images `aquasec/trivy:0.69.5` and `0.69.6` (about 10 h), pushed with separately stolen Docker Hub credentials; no matching GitHub tag.
- The payload dumped runner memory for secrets, swept key files, encrypted and exfiltrated them, with a fallback of creating a public `tpcp-docs` repo in the victim account when `INPUT_GITHUB_PAT` was set.
- Root cause: a continuation of a late-February 2026 compromise; the first credential rotation was not atomic.
- The Aqua blog counts 76 of 77 tags in one place and 75 in another; the advisory says 76 of 77 [tag count not fully consistent].
- Official safe list in the advisory: Trivy binary v0.69.2 or v0.69.3; trivy-action v0.35.0; setup-trivy v0.2.6. Images pulled by digest were not affected. Source builds and the official Homebrew formula were not affected.
- Old trivy-action tags `0.0.1`-`0.34.2` were deleted; new `v`-prefixed tags were created. All trivy-action tags `v0.35.0` and later, and setup-trivy v0.2.6 and later, are post-incident.
- Aqua warns: do not rely on GitHub's "Immutable" badge alone; "Pinning to full commit SHAs remains the only truly immutable protection." The advisory also says to pin actions to full SHAs.
- Separate older advisory GHSA-9p44-j4g5-cfx5 (2026-02-18): script injection in the trivy-action composite action, affects `>= 0.31.0, < 0.34.0`, fixed in 0.34.0 (read via `gh api /advisories?affects=aquasecurity/trivy-action`).
- Later Trivy (binary) advisories: GHSA-q3fv-x8vg-qqm4 (Helm chart OOM, fixed 0.71.0), GHSA-mcj4-mphf-j9ff (path traversal via crafted DB/artifacts, high, fixed 0.71.1), GHSA-8rc5-4fr6-64pw (plugin manager path traversal, fixed 0.72.0). So **use Trivy >= 0.72.0**.

Current versions (via `gh api`, 2026-10-22):
- Trivy binary **v0.76.1**, published 2026-10-21, release is immutable. Linux-64bit tarball sha256 `c7cbe3137fb8a48a17574bede3dd6beb16742d1e9772929940fc90082c39d9c0` (from `trivy_0.76.1_checksums.txt`). Each asset also has a `.sigstore.json` bundle.
- `aquasecurity/trivy-action` **v0.36.0** (2026-04-22, immutable release, annotated and SSH-signed tag, commit `ed142fd0673e97e23eac54620cfb913e5ce36c25`). **Its default `version` input is `v0.70.0`**, which is affected by the 0.71.1/0.72.0 path-traversal advisories. Always pass `version: v0.76.1`. The action pins its own `setup-trivy` to `3fb12ec12f41e471780db15c232d5dd185dcb514` (= v0.2.6, the safe one) and `actions/cache` v5.0.5. (read from `action.yaml` at that commit)
- `aquasecurity/setup-trivy` v0.3.1 (2026-06-03, immutable), commit `81e514348e19b6112ce2a7e3ecbafe19c1e1f567`. It installs Trivy by checking out the Trivy repo and running its install script.

Flags and ignore files:
- Fail only on CRITICAL: `--severity CRITICAL --exit-code 1`. Add `--ignore-unfixed` to skip CVEs with no fix (decision for the project: yes, to avoid noise). In the action: `severity: CRITICAL`, `exit-code: '1'`, `ignore-unfixed: true`, `scanners: vuln` (default is `vuln,secret`). Action input table: https://github.com/aquasecurity/trivy-action README (via `gh api`, read 2026-10-22).
- Ignore file: **`.trivyignore`** is the default and stable one (one ID per line, optional `exp:YYYY-MM-DD` expiry). **`.trivyignore.yaml`** is marked EXPERIMENTAL and must be passed with `--ignorefile ./.trivyignore.yaml` (supports `expired_at`, statements). In the action use `trivyignores: .trivyignore`. Source: https://github.com/aquasecurity/trivy `docs/guide/configuration/filtering.md` (via `gh api`, read 2026-10-22).
- The vulnerability DB is pulled from `ghcr.io/aquasecurity/trivy-db`; the action caches DB and Java DB with `actions/cache` and warns that disabling the cache risks rate limiting. (trivy-action README, read 2026-10-22). If we run the binary directly, cache `~/.cache/trivy` ourselves, keyed by date.

Recommendation (Trivy), safest first:
1. **Run the release binary directly and verify its sha256** (no third-party action executes in the job): download `trivy_0.76.1_Linux-64bit.tar.gz` from the GitHub release, check `c7cbe313...39d9c0`, then `trivy image --input image.tar --severity CRITICAL --exit-code 1 --ignore-unfixed --scanners vuln`. The image to scan is saved with `docker save` (or the buildx `outputs=type=docker,dest=...`). Optionally also verify the `.sigstore.json` bundle with cosign (pattern in the advisory: `--certificate-identity-regexp 'https://github\.com/aquasecurity/'`, issuer `https://token.actions.githubusercontent.com`) [uncertain: untested with 0.76.1].
2. Fallback: `aquasecurity/trivy-action` pinned to SHA `ed142fd0...` with `version: v0.76.1`.
3. Do not use `ghcr.io/aquasecurity/trivy:latest` or any floating tag. If using the image, pin a digest (resolve in Phase 1; I did not resolve it [uncertain]).
- Give the Trivy job minimal permissions: `contents: read` only, and no registry login, so even a repeat compromise has nothing to steal except the read-only token.
- Do not set `INPUT_GITHUB_PAT`.

### 5c. actionlint

- Current: **v1.7.12**, published 2026-03-30 (latest; not marked immutable); tag `v1.7.12` -> commit `914e7df21a07ef503a81201c76d2b11c789d3fca`. https://github.com/rhysd/actionlint (via `gh api`, read 2026-10-22).
- Linux amd64 asset `actionlint_1.7.12_linux_amd64.tar.gz`, sha256 `8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8` (from `actionlint_1.7.12_checksums.txt`).
- **There is no GitHub Action in the actionlint repo** (no `action.yml` at repo root). The usage doc offers: the download script (`bash <(curl .../scripts/download-actionlint.bash)`), the Docker image `rhysd/actionlint:<version>` (e.g. `1.7.12`), and `uses: docker://rhysd/actionlint:latest`. The download script has a default version and a version argument, but I found no checksum verification in it (grep for checksum/sha256 found nothing). https://github.com/rhysd/actionlint `docs/usage.md` and `scripts/download-actionlint.bash` (via `gh api`, read 2026-10-22)
- The Docker image bundles shellcheck and pyflakes; the standalone binary calls shellcheck only if it is on PATH (README lists the integrations). Whether `ubuntu-24.04` has shellcheck preinstalled was not checked [uncertain].
- Recommendation in CI: download the release tarball for the pinned version and check the sha256 (same pattern as gitleaks), then run `./actionlint -color`. Not the `curl | bash` form, and not `docker://rhysd/actionlint:latest`.
- Local: `docker run --rm -v "$(pwd):/repo" --workdir /repo rhysd/actionlint:1.7.12 -color` (usage doc form, with the tag pinned). A digest pin for the Docker Hub image: resolve in Phase 1 [uncertain].

### 5d. `npm audit`

- `--audit-level` sets "the minimum level of vulnerability for `npm audit` to exit with a non-zero exit code". Accepted values: info, low, moderate, high, critical, none. It changes only the pass/fail threshold, not the report. So `npm audit --audit-level=critical` fails the job on critical findings only. (https://docs.npmjs.com/cli/v11/commands/npm-audit, read 2026-10-22)
- It sends package names and versions to the configured registry (`/-/npm/v1/security/advisories/bulk`), no secrets needed; on endpoint error it falls back to the Quick Audit endpoint, which sends the whole lock-file tree plus npm/Node versions and platform. (same page)
- `--omit=dev` leaves dev dependencies out of the audit payload. Project decision: run once for all dependencies at `critical`; consider a second run with `--omit=dev` at `high` as a non-blocking report (not required by the brief).
- Overlaps with Dependabot alerts (free, section 4). Keep both: audit gives a CI gate, Dependabot gives PRs.

## 6. Pinned action SHAs

Resolved on 2026-10-22 with `gh api repos/<owner>/<repo>/releases/latest` (tag and date), then `git/ref/tags/<tag>` and, for annotated tags, `git/tags/<sha>` to dereference to the commit SHA. The Node runtime was read from `action.yml` / `action.yaml` at that commit. All are GET requests on public repos. Re-resolve at Phase 1 start; the lines below are only valid for today.

| Action | Tag | Commit SHA (40 chars) | Released | Runtime | Notes |
|--------|-----|-----------------------|----------|---------|-------|
| actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | 2026-07-20 | node24 | Lightweight tag. Use `persist-credentials: false`. |
| actions/setup-node | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` | 2026-10-08 | node24 | Auto-enables npm cache when `packageManager` is npm. |
| actions/cache | v6.1.0 | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` | 2026-06-26 | node24 | For `.next/cache`. |
| actions/upload-artifact | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | 2026-10-07 | node24 | Artifacts share the 500 MB pool; set `retention-days: 1-3`. |
| actions/download-artifact | v8.0.2 | `9000827ccba6bdab643e8b6fd33ac0654aef8333` | 2026-10-07 | node24 | Pairs with upload-artifact v7: the READMEs of both actions use `upload-artifact@v7` with `download-artifact@v8`. |
| docker/setup-buildx-action | v4.4.1 | `f87e5991a6d7451dcb8d9637bfbc97413f497069` | 2026-09-16 | node24 | Meets the gha cache v2 requirement (Buildx >= 0.21) [uncertain: bundled Buildx version not read]. |
| docker/setup-qemu-action | v4.4.0 | `99012661954931238ded8c8b007157a8430204e1` | 2026-09-15 | node24 | Informational. NOT needed (amd64 only). |
| docker/build-push-action | v7.4.0 | `c3c9e263c25d99ce0380d002d59b67737d91b0dc` | 2026-09-15 | node24 | Immutable release. `provenance`, `sbom`, `cache-from/to` inputs. |
| docker/login-action | v4.6.0 | `dbcb813823bdd20940b903addbd779551569679f` | 2026-07-29 | node24 | Login to `ghcr.io` with `GITHUB_TOKEN`; only in the release job. |
| docker/metadata-action | v6.2.0 | `dc802804100637a589fabce1cb79ff13a1411302` | 2026-07-02 | node24 | Tags and OCI labels. |
| aquasecurity/trivy-action | v0.36.0 | `ed142fd0673e97e23eac54620cfb913e5ce36c25` | 2026-04-22 | composite | Annotated, signed tag (tag object `a9c7b0f0...`). Immutable release. Default Trivy is v0.70.0: pass `version: v0.76.1`. Fallback only (section 5b prefers the direct binary). |
| aquasecurity/setup-trivy | v0.3.1 | `81e514348e19b6112ce2a7e3ecbafe19c1e1f567` | 2026-06-03 | composite | Only needed with `skip-setup-trivy`. trivy-action v0.36.0 itself pins v0.2.6 (`3fb12ec12f41e471780db15c232d5dd185dcb514`). |
| rhysd/actionlint | v1.7.12 | `914e7df21a07ef503a81201c76d2b11c789d3fca` | 2026-03-30 | no action exists | Use the release binary + sha256 (section 5c). SHA is of the tag commit, for reference only. |
| gitleaks/gitleaks-action | v3.0.0 | `e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e` | 2026-05-30 | node24 | Immutable release. NOT recommended (section 5a): use the binary. |
| dorny/paths-filter | v4.0.3 | `ceb8a2b8f2d89434be7ff52d3de7ec3738c5cc9d` | 2026-08-05 | node24 | Optional. Needs `pull-requests: read` on PRs. A plain `git diff` step avoids the dependency. |
| actions/attest-build-provenance | v4.2.2 | `4d101475d8b20a2381f78447822ac1eab6504dd8` | 2026-08-06 | composite | NOT usable on a Free private repo (section 2a). Wrapper of `actions/attest`. |
| actions/attest (informational) | v4.2.2 | `1e69f48acb82d1966a394da916b4c1698aa569d6` | 2026-08-04 | node24 | Same limit as above. |

Exact `uses:` lines (SHA-pinned, version in the trailing comment so Dependabot can bump both):

```yaml
uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2
uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
uses: docker/setup-qemu-action@99012661954931238ded8c8b007157a8430204e1 # v4.4.0
uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0
uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0
uses: docker/metadata-action@dc802804100637a589fabce1cb79ff13a1411302 # v6.2.0
uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
uses: aquasecurity/setup-trivy@81e514348e19b6112ce2a7e3ecbafe19c1e1f567 # v0.3.1
uses: gitleaks/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e # v3.0.0
uses: dorny/paths-filter@ceb8a2b8f2d89434be7ff52d3de7ec3738c5cc9d # v4.0.3
uses: actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2
# rhysd/actionlint: no action; binary rhysd/actionlint v1.7.12 (tag commit 914e7df21a07ef503a81201c76d2b11c789d3fca)
```

Checks and notes:
- Every SHA above is a commit that the repo's own tag points to (annotated tags were dereferenced; only trivy-action's tag was annotated).
- Each SHA was checked with `gh api repos/<repo>/compare/<default-branch>...<sha>`: the result was `identical` or `behind` for all 17, so every commit is in the default branch history of its own repository (not a fork-only commit).
- Node 20 is removed from hosted runners (gitleaks-action v3.0.0 release notes: 2026-09-16), so every JavaScript action must be `node24` (all listed ones are) and old `@v2`/`@v3` pins from memory will fail.
- Many majors changed in 2026 (checkout v7, setup-node v7, cache v6, upload-artifact v7, download-artifact v8, buildx v4, login v4, metadata v6, build-push v7). Online examples still show older majors (the trivy-action README itself still shows `actions/checkout@v4`). Trust this table, not examples.
- Suggested policy: let Dependabot (`github-actions` ecosystem, section 4) propose SHA bumps weekly, grouped minor/patch; review the diff of every action update manually (tags can be moved; a SHA cannot).

## 7. Minutes budget

**These are my estimates, not measurements.** No primary source gives job durations. Replace them with real numbers from the first 5-10 runs (Actions run page, or Settings > Billing usage). Rules used: Linux `ubuntu-24.04` standard runner counts 1 minute per minute against the 2,000 free minutes (section 1); each job is rounded up to a whole minute on its own ([M] section 1); jobs run in parallel but billing adds them up.

### 7a. Per-job estimate (minutes billed, after rounding)

| Job | What it does | Warm cache | Cold cache | Notes |
|-----|--------------|-----------:|-----------:|-------|
| lint | checkout, setup-node (npm cache), `npm ci`, eslint | 2 | 3 | Separate job pays `npm ci` again. |
| typecheck | same setup, `tsc --noEmit` | 2 | 3 | Same. |
| unit + integration | `npm ci`, vitest, Mongo service container | 4 | 5 | Mongo image pull about 30-60 s. |
| production build | `npm ci`, `next build` with `.next/cache` | 4 | 6 | Duplicated by the Docker build. |
| Docker build (no push) | buildx, `type=gha` cache | 4 | 8 | |
| e2e smoke | build/pull image, `docker compose up`, Playwright browsers, tests | 7 | 11 | Browser download is the cold cost; caching browsers needs a cache entry of a few hundred MB [uncertain size]. |
| gitleaks | checkout `fetch-depth: 0`, binary, scan | 1 | 2 | |
| npm audit | setup-node, `npm audit` (no install needed) | 1 | 1 | |
| Trivy | image (needs a built image) + DB download | 5 | 8 | DB cached per day. |
| actionlint | download binary, run | 1 | 1 | |
| **Naive total (10 jobs)** | | **about 31** | **about 48** | |

### 7b. Optimised layout (recommended)

| Job | Contents | Warm | Cold |
|-----|----------|-----:|-----:|
| `static` | lint + typecheck + `npm audit` + actionlint in one job, one `npm ci` | 3 | 4 |
| `test` | unit + integration with Mongo service | 4 | 5 |
| `image` | buildx build once (gha cache) with `load: true`, Trivy scan of that image, and on PRs/main: `docker compose up` e2e smoke against the same loaded image | 9 | 14 |
| `secrets` | gitleaks | 1 | 2 |
| `ci-success` | aggregate, `if: always()`, no checkout | 1 | 1 |
| **Total per push** | | **about 18** | **about 26** |

The separate "production build" job is dropped because the Docker build runs `next build` inside the image build. If the brief requires a visible "build" check, name a step, not a job.

### 7c. Monthly estimate (60 pushes, 10 releases)

| Item | Calculation | Minutes |
|------|-------------|--------:|
| 60 pushes, 50 warm + 10 cold | 50 x 18 + 10 x 26 | 1,160 |
| Pushes where e2e is skipped (feature branch with no PR): saves about 4 min each on, say, 15 of them | -15 x 4 | -60 |
| 10 releases (tag `v*`): build + push with attestations, cache warm from main (about 6 warm / 10 cold; say 8 average). Tests are not repeated if the tag is cut from a green commit. | 10 x 8 | 80 |
| Dependabot: about 12 PRs/month (3 ecosystems, weekly, grouped) x 18 | 12 x 18 | 216 |
| **Total** | | **about 1,400** |

- That is about 70% of the 2,000 free minutes. If Dependabot runs on standard runners are free, as one summary of the billing doc says [uncertain], the total drops to about 1,200.
- The naive 10-job layout would be 60 x 31 = 1,860 warm, and over 2,000 once cold runs and Dependabot are added. So the merging below matters.
- During the Phase 1-8 build, pushes are one per phase (about 9-15 in total), which is far below this budget.
- Risks that break the estimate: Playwright browser download without a cache, a cold cache after 7 days of inactivity (section 1 [C]), `max`-mode gha cache filling the 10 GB cap (evicts older entries), a flaky e2e retry loop, runs that are never cancelled.

### 7d. How to stay under the allowance

1. Merge small jobs (lint + typecheck + audit + actionlint share one `npm ci`). Every extra job costs at least 1 billed minute plus its setup.
2. Build the image once per run and reuse the loaded image for Trivy and e2e in the same job.
3. `concurrency` with `cancel-in-progress: true` for branches and PRs (not for `main`/tags).
4. `timeout-minutes` on every job (for example 10 for static, 15 for test, 25 for image), so a hang costs 10-25 minutes, not 360.
5. Run e2e only on `pull_request` and pushes to `main`, and release-time; skip on plain feature-branch pushes without a PR.
6. Path logic: for docs-only pushes, make the changes job report `code=false` and skip the heavy jobs (skipped jobs bill nothing). Do not use workflow-level `paths-ignore` if `ci-success` is ever required (section 3a).
7. Cache `~/.npm` (setup-node), `.next/cache`, buildx `type=gha` (unique scope), Trivy DB, Playwright browsers. Total should stay well under 10 GB; check with `gh api repos/<repo>/actions/cache/usage` (read-only GET) [uncertain: endpoint not opened in this task].
8. Artifacts: upload only on failure (Playwright traces/screenshots), `retention-days: 1-3`, since artifacts and packages share a 500 MB pool.
9. Do not add a payment method; then exceeding the quota blocks CI instead of charging (section 1).
10. Squash the number of pushes: one commit per phase is already the project rule.
11. Do not use `workflow_dispatch` loops, scheduled nightly runs, or matrix builds (a nightly run alone costs about 18 x 30 = 540 min).
12. Check `docker/setup-qemu-action` is absent (amd64 only).

## 8. Recommended CI/CD design summary

### 8a. Files

- `.github/workflows/ci.yml`: build, test, scan. Triggers: `pull_request` (all branches), `push` to `main` and `build/**`. No `paths-ignore` on the trigger.
- `.github/workflows/release.yml`: image publish. Triggers: `push` to `main` (tags `main`, `sha-<short>`) and `push` of tags `v*` (tags `X.Y.Z`, `X.Y`, `latest`). Runs the same checks inline or calls `ci.yml` via `workflow_call` (no secrets passed).
- `.github/dependabot.yml` (section 4b).
- Top of every workflow: `permissions: {}` (nothing), then grant per job. `concurrency` and `timeout-minutes` on every job.
- Runner: `ubuntu-24.04` everywhere. All actions pinned to full SHA (section 6).

### 8b. Jobs and permissions

| Job | Runs on | Permissions | Contents |
|-----|---------|-------------|----------|
| `changes` (optional) | PR, push | `contents: read` (+ `pull-requests: read` if paths-filter) | `git diff --name-only` -> output `code` |
| `static` | PR, push | `contents: read` | lint, typecheck, `npm audit --audit-level=critical`, actionlint (pinned binary + sha256) |
| `test` | PR, push | `contents: read` | vitest unit + integration, `mongo:8.0` service container with health check |
| `secrets` | PR, push | `contents: read` | gitleaks pinned binary; `fetch-depth: 0` |
| `image` | PR, push | `contents: read` | buildx build (`load: true`, `cache-from/to: type=gha`), Trivy binary (sha256-pinned, CRITICAL only), e2e smoke via `docker compose` (PR and `main` only) |
| `ci-success` | always | none (`permissions: {}`) | `needs: [all]`, `if: always()`, fails if any result is `failure` or `cancelled` |
| `publish` | push to `main` and `v*` tags only, after `ci-success` | `contents: read`, `packages: write` | login to `ghcr.io` with `GITHUB_TOKEN`, metadata-action, build-push with `push: true`, `provenance: mode=max`, `sbom: true` |

- No job gets `id-token`, `attestations`, `actions: write`, `security-events` or `pull-requests: write`.
- Fork PRs are not a concern (private repo, no outside collaborators). Dependabot PRs get a read-only token and no secrets (section 4a), which is enough: only `publish` needs `packages: write`, and it does not run on PRs.
- `actions/checkout` with `persist-credentials: false` in every job that does not push.
- `GITHUB_TOKEN` can publish to the package only if the package is linked to this repository (a workflow publishing from the repo links it automatically; an earlier manual push to the same name may not be linked). Add the label `org.opencontainers.image.source=https://github.com/<owner>/<repo>` in the Dockerfile or via metadata-action. (https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry, read 2026-10-22). The page did not mention the `packages: write` permission itself [uncertain; it is the standard permission and the `permissions` rules in section 3 apply].

### 8c. Image tags and labels (docker/metadata-action v6.2.0)

- Tags: `type=sha` gives `sha-<7 hex>` (default prefix `sha-`, short format; length via `DOCKER_METADATA_SHORT_SHA_LENGTH`). `type=ref,event=branch` gives `main`. `type=semver,pattern={{version}}` and `{{major}}.{{minor}}` on `v*` tags. `latest` is generated in `auto` mode for tag and semver types; set `flavor: latest=false` if the server must never pull `latest`. (https://github.com/docker/metadata-action README via `gh api`, read 2026-10-22)
- Labels: the action sets OCI labels (`org.opencontainers.image.source`, `.revision`, `.version`, `.created`, `.title`, `.description`, `.licenses`) from the repo; override `title` / `description` with `labels:`.
- Pull-based server should deploy an immutable reference (`sha-<short>` or, best, `@sha256:<digest>`) recorded in its env file, never `main` or `latest`. Rollback = redeploy the previous recorded tag/digest. `sha-*` tags are never moved.
- Retention: GHCR has no automatic retention. Prune old `sha-*` versions by explicit tag age only. Never delete "untagged" versions (they can be attestation manifests, section 2b). Deleting needs a PAT with `delete:packages`, or `GITHUB_TOKEN` with package `admin` (public preview) (container-registry page, read 2026-10-22), so do it by hand or by a local script, not CI (no secrets beyond `GITHUB_TOKEN`).
- Server pull from the private package needs a classic PAT with `read:packages` (`docker login ghcr.io`). That secret lives on the server only, never in GitHub. (same page)
- Package visibility: default is private on first publish. Keep it private. GHCR storage and bandwidth are currently free (section 1).

### 8d. Caches

| Cache | Key | Where |
|-------|-----|-------|
| npm global cache | lockfile hash (setup-node `cache: npm`) | static, test, image |
| `.next/cache` | OS + lockfile hash + source hash, restore-key on lockfile hash | Docker build uses the buildx cache instead; use the `.next/cache` step only if a non-Docker build job exists |
| buildx layers | `type=gha`, `scope=finance-tracker`, `mode=max` | image, publish |
| Trivy DB | `trivy-db-<date>`, restore-key `trivy-db-` | image |
| Playwright browsers | `playwright-<version>` | image (e2e) |

Cache-warming rule: because caches are branch-scoped, `main` pushes must run the same jobs so that `build/finance-tracker` PRs find the default-branch cache (section 3d).

### 8e. What is deliberately not used

- `actions/attest-build-provenance` (not available on Free private repos), CodeQL / secret scanning / code scanning (need paid features on private repos), QEMU, arm64 or larger runners, self-hosted runners, `secrets: inherit`, third-party actions beyond the pinned set, `gitleaks-action` (binary instead), `trivy-action` (binary instead; action is the fallback), any deploy step (CI never touches the server).

## [uncertain] list

1. Whether Windows/macOS minutes count with a multiplier against the 2,000 free minutes. Not stated in current pages; irrelevant (Linux only).
2. Default spending limit value on Free: not stated on the billing page. Rule used: no payment method on the account.
3. Future of GHCR billing: "currently free", at least one month notice before change. Private-image pulls from our own server are covered by that statement, not by a specific sentence.
4. Whether `ubuntu-slim` counts 1:1 against the free minutes, and whether 14 GB disk is enough for build + browsers + images.
5. Branch protection / rulesets / required status checks on a private repo with GitHub Free: the docs pages opened give no plan matrix; search results suggest it needs Pro or an organisation Team plan. The design does not depend on it.
6. Whether Dependabot Actions runs are free on standard runners (one billing-page summary says yes; the Dependabot page is silent). Whether Dependabot rewrites the `# vX.Y.Z` comments on SHA-pinned actions (widely used, not read in a primary page here).
7. Whether `secrets: inherit` works for a personal account calling a same-repo reusable workflow (docs say same org or enterprise). Not needed; not used.
8. GitHub's documentation page on artifact attestations did not state the plan matrix; the rule "Free private = not available" comes from the `actions/attest-build-provenance` README.
9. GHCR display of attestation manifests (`unknown/unknown`, missing labels) and the safe cleanup behaviour: community reports only. `DOCKER_METADATA_ANNOTATIONS_LEVELS` workaround may be obsolete.
10. gitleaks image tag name `ghcr.io/gitleaks/gitleaks:v8.30.1` and the image digests for gitleaks, Trivy, actionlint (`rhysd/actionlint:1.7.12`): not resolved. The plan uses sha256-pinned release binaries instead.
11. Cosign verification of the Trivy 0.76.1 `.sigstore.json` bundle: pattern copied from the advisory (for 0.69.2); not tested for 0.76.1.
12. Whether `shellcheck` is preinstalled on `ubuntu-24.04` (actionlint uses it when available).
13. Mongo service-container health command and Docker Hub pull limits on shared runner IPs.
14. `gh api repos/<repo>/actions/cache/usage` endpoint name (not opened).
15. All minutes numbers in section 7 are estimates, not measurements.
16. The Trivy tag count in the incident (76 of 77 in the advisory; one blog passage says 75). The Aqua blog says it is "nearly finalized" as of 2026-04-01; I did not find a later final report.
17. The bundled Buildx version in `docker/setup-buildx-action` v4.4.1 was not read (needed: Buildx >= 0.21.0, BuildKit >= 0.20.0).
18. Checksums for gitleaks, Trivy and actionlint come from each release's own checksum file read on 2026-10-22 (trust on first read). gitleaks and actionlint releases are not marked immutable.
