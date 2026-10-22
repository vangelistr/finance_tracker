# Backup research: restic + Cloudflare R2 + MongoDB

Research date: 2026-10-22. Status: complete. Every URL below was opened on 2026-10-22 ("read 2026-10-22"). Items tagged [uncertain] could not be confirmed from an allowed source.

## 1. R2 S3 API

**Endpoint.** The S3 endpoint is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. (https://developers.cloudflare.com/r2/get-started/s3/, read 2026-10-22)

**Jurisdictions.** A bucket can be tied to a jurisdiction (`eu`, `fedramp`, `us`). The jurisdiction cannot be changed after the bucket is created. A jurisdiction bucket must be reached through its own endpoint: `https://<ACCOUNT_ID>.<JURISDICTION>.r2.cloudflarestorage.com`, for example `https://<account_id>.eu.r2.cloudflarestorage.com`. With that endpoint you cannot reach resources outside the jurisdiction. (https://developers.cloudflare.com/r2/buckets/data-location/, read 2026-10-22)
- If the owner creates the bucket in the EU jurisdiction, `R2_ENDPOINT` must be the `.eu.` form. If the owner creates a normal bucket (optionally with a location hint such as `weur`/`eeur`), `R2_ENDPOINT` is the plain form. Location hints are best effort and only apply at first creation. (same page)
- The API token must be created for the matching bucket. The token scope uses `<ACCOUNT_ID>_<JURISDICTION>_<BUCKET_NAME>`, with `default` for a non-jurisdiction bucket. (https://developers.cloudflare.com/r2/api/tokens/, read 2026-10-22)

**Region.** The value is `auto`. Cloudflare's own examples set `region_name='auto'`, commented "Required by boto3, not used by R2". (https://developers.cloudflare.com/r2/get-started/s3/, read 2026-10-22) Release notes say `auto` is required in SigV4 signing (2022-05-03) and that an empty string and `us-east-1` alias to `auto` (2022-05-05). (https://developers.cloudflare.com/r2/platform/release-notes/, read 2026-10-22) Decision: use `auto` (this is the `R2_REGION` default in `.env.example`). Restic defaults to `us-east-1` when no region is set (https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html, read 2026-10-22), which R2 aliases, but set `auto` explicitly.

**Addressing style.** R2 supports both path-style (bucket in the URL path under the account endpoint) and virtual-hosted style (bucket as subdomain; added 2022-05-16). (https://developers.cloudflare.com/r2/platform/release-notes/, read 2026-10-22) Restic's `s3.bucket-lookup` accepts `auto` (default), `dns` or `path`. `auto` uses `dns` for Amazon and Google endpoints and `path` for others. (https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html, read 2026-10-22) So restic uses path-style with R2 by default. Recommendation: pass `-o s3.bucket-lookup=path` explicitly so the behaviour is pinned and does not depend on the `auto` heuristic. [uncertain] whether `path` is the exact value Cloudflare tests; the restic docs and the R2 release notes both support it, but I found no Cloudflare page that names restic.

**Repository string.** `s3:https://<ACCOUNT_ID>.r2.cloudflarestorage.com/<bucket>` (restic form `s3:https://server:port/bucket_name`, https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html, read 2026-10-22). The parser in restic source takes the URL host as endpoint, the first path segment as bucket and the rest as prefix; with no prefix, the prefix `restic` is used (the source comment says so). Source: https://github.com/restic/restic/blob/master/internal/backend/s3/config.go (read 2026-10-22 via `gh api`). A maintainer-era user report confirms this exact form works with R2: `RESTIC_REPOSITORY=s3:https://<account id>.r2.cloudflarestorage.com/<bucket name>` then `restic init` (https://github.com/restic/restic/issues/3757, comment 2024-01-05, read 2026-10-22). Safer for us: use an explicit prefix, e.g. `.../<bucket>/restic`, so the repo path is visible.

**S3 operations restic needs, and R2 support** (https://developers.cloudflare.com/r2/api/s3/api/, read 2026-10-22). Restic's operation list below is from my knowledge of its minio-go based backend, not from a page I opened; treat the mapping as a reasoned match. [uncertain]
| Restic need | S3 operation | R2 status |
|---|---|---|
| Check bucket exists | HeadBucket / GetBucketLocation | Supported. GetBucketLocation always returns `auto` (release notes 2022-05-16). |
| List objects | ListObjectsV2 | Supported (`continuation-token`, `start-after`, `fetch-owner`). |
| Read file, partial read | GetObject (Range) | Supported. |
| Stat file | HeadObject | Supported. |
| Write file | PutObject | Supported. |
| Large file | Multipart (Create, UploadPart, Complete, Abort, ListParts, ListMultipartUploads) | Supported. |
| Remove file | DeleteObject / DeleteObjects | Supported. |
Not supported on R2: bucket versioning, bucket policy, ACLs, object lock, object tagging, SSE-KMS. Restic needs none of these.

**Known R2 + restic issues.**
- Old: restic 0.13.1 `init` failed with `GetBucketLocation not implemented`. Cause: R2 lacked that call and the region was unset. R2 added `GetBucketLocation` on 2022-05-16, and Cloudflare confirmed that `auto` is the intended region, with empty and `us-east-1` also accepted. Issue closed. (https://github.com/restic/restic/issues/3757, read 2026-10-22; release notes above)
- Current: no open restic issue found that is specific to R2 [uncertain: I only searched the issue pages I opened and one `gh` read, not a full tracker search; see below].
- Issue #22092 (open) "restic 0.19.1 s3 backend prune fails" is not R2. The reporter used Scaleway. The error is `error decoding tree: expected [, got <nil>`, which began in 0.19.0. Cause per PR #22117: snapshots written by old `repair snapshots` (v0.18.1) saved an empty subtree as `{"nodes":null}`. PR #22117 (open, not merged as of 2026-10-22) makes restic read those. (https://github.com/restic/restic/issues/22092 and https://github.com/restic/restic/pull/22117, read 2026-10-22 via `gh api`.) Impact for us: none, because our repository is new and we never run `repair snapshots`. Rule for the runbook: never run `restic repair snapshots`.
- Restic's S3 backend uses the minio-go client (`go.mod` lists `github.com/minio/minio-go/v7`), sends Content-MD5 on uploads, and on `init` calls `BucketExists` and then `MakeBucket` only if the bucket is missing. (https://github.com/restic/restic/blob/master/internal/backend/s3/s3.go and https://github.com/restic/restic/blob/master/go.mod, read 2026-10-22 via `gh api`) With a bucket-scoped Object Read & Write token, whether `BucketExists` (a HEAD on the bucket) is allowed is not stated by Cloudflare. [uncertain] It matters only for `init`; the runbook step "run `restic init` once and check it succeeds" will show it. A user report shows `init` working with R2 (issue #3757 comment, 2024-01-05) but does not say what token type was used.
- Restic 0.19.1 changelog has no S3 or R2 entries. (https://github.com/restic/restic/releases/tag/v0.19.1, read 2026-10-22 via `gh api`)

## 2. Credentials and access

**Token types and permission levels** (https://developers.cloudflare.com/r2/api/tokens/, read 2026-10-22):
- Admin Read & Write: create, list and delete buckets, edit bucket config, read/write/list objects.
- Admin Read only: list buckets, view config, read/list objects.
- **Object Read & Write: read, write and list objects in specific buckets.** This is the one to use.
- Object Read only: read and list objects in specific buckets.
- Object permissions work only with the S3-compatible API, not the Cloudflare REST API. They can optionally be limited to a set of buckets.
- Account API token: tied to the account, valid until revoked or a preset expiry. User API token: tied to a person and inactive if the user is removed from the account. Prefer an Account API token for a server job. [recommendation, not from a page]
- Restic needs delete rights, because `forget --prune` removes pack files. Object Read & Write includes write; the page's wording is "read, write, and list". I did not find text that says it includes delete. [uncertain] The R2 S3 reference lists DeleteObject as supported and the pricing page lists it as free, but permission to call it with this token level is not stated. The runbook must test a delete (the restore test step plus a `forget --prune` dry run on the first real run) and the BLOCKERS item should cover it.

**Where the S3 credentials come from.** Dashboard flow: R2 object storage, Overview, "Account Details", "Manage" next to API Tokens, "Create Account API token", choose Object Read & Write, optionally scope to one bucket, create. Copy both values at once: "You will not be able to access your Secret Access Key again after this step." (https://developers.cloudflare.com/r2/api/tokens/ and https://developers.cloudflare.com/r2/get-started/s3/, read 2026-10-22) For a token made through the API: Access Key ID is the token `id`; Secret Access Key is the SHA-256 hash of the token `value`. (tokens page) The account ID is found in the Cloudflare dashboard (tokens page links a guide; the endpoint is also shown on the token confirmation page or R2 Overview, get-started page).

**Mapping to `.env.example`:** `R2_ACCESS_KEY_ID` = Access Key ID, `R2_SECRET_ACCESS_KEY` = Secret Access Key, `R2_ENDPOINT` = the S3 endpoint, `R2_BUCKET` = bucket name, `R2_REGION=auto`.

**Buckets are private by default.** "Never publicly accessible and will always require explicit user permission to enable." Public access has two independent routes: a custom domain, and the Cloudflare-managed `r2.dev` subdomain (for non-production use). (https://developers.cloudflare.com/r2/buckets/public-buckets/, read 2026-10-22)
- **Why a custom domain makes contents public.** Connecting a custom domain exposes the bucket's objects over HTTP at that domain. The page describes "Disable domain" as turning off public access through that domain, and says removing a domain leaves the bucket public through any other enabled method. It does not use the words "a custom domain makes it public", but it describes it as the way to expose a bucket. Access can be limited only with Cloudflare Access or WAF token authentication, both of which need extra setup. For a backup bucket: never add one.
- **How to confirm it is private.** In the bucket: Settings, "Public Development URL" must show it is disabled (if enabled, the state reads "Allowed"; to disable type `disallow`). Settings, "Custom Domains" must be empty (a disabled-but-connected domain shows "Not allowed"; prefer "Remove domain" so nothing is left). (same page)
- Even if an object were fetched, restic data is encrypted client-side with the repo password, but a public bucket would still leak file names, sizes and timing. [reasoning, not from a page]
- The Object Read & Write token is useless over HTTP public routes; it works only with the S3 API (tokens page).

**Short step list for the README runbook (owner does this once, in the Cloudflare dashboard):**
1. Create a bucket (any name, e.g. `finance-tracker-backup`). Choose the EU jurisdiction if you want EU-only storage; then use the `.eu.` endpoint. The jurisdiction cannot be changed later.
2. Leave "Public Development URL" disabled. Do not add any custom domain.
3. R2 Overview, Manage API Tokens, Create Account API token. Permission: Object Read & Write. Scope: this one bucket only. No IP or other extras.
4. Copy the Access Key ID and Secret Access Key into the server `.env` (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`). Copy the endpoint into `R2_ENDPOINT` and the bucket name into `R2_BUCKET`. Keep `R2_REGION=auto`.
5. Store a copy of `RESTIC_PASSWORD` outside the server (a password manager). Without it a backup cannot be restored.
6. Set `BACKUP_TARGET=s3`, restart the backup container, run `backup-now`, check `backup_runs` shows success and that the bucket now has objects under `restic/`.
7. Re-open the bucket Settings page and confirm again that public access is off.

## 3. Free tier and usage estimate

**Current R2 pricing** (https://developers.cloudflare.com/r2/pricing/, read 2026-10-22):
| Item | Standard | Infrequent Access (IA) |
|---|---|---|
| Storage | $0.015 per GB-month | $0.01 per GB-month |
| Class A operations | $4.50 per million | $9.00 per million |
| Class B operations | $0.36 per million | $0.90 per million |
| Data retrieval | none | $0.01 per GB |
| Egress to Internet | free | free |
| Minimum storage duration | none | 30 days |
| Monthly free tier | 10 GB-month storage, 1 million Class A, 10 million Class B | none (free tier is Standard only) |

- Class A includes ListBuckets, PutBucket, ListObjects, PutObject, CopyObject, multipart Create/UploadPart/Complete, ListParts, ListMultipartUploads. Class B includes HeadBucket, HeadObject, GetObject. Free: DeleteObject, DeleteBucket, AbortMultipartUpload. (pricing page) `DeleteObjects` (plural, the batch call) is not named on the pricing page. [uncertain] It is probably billed like DeleteObject, but the page does not say; the volume is tiny either way.
- Usage is rounded up to the next billing unit. Storage is measured as the average of each day's peak over 30 days. The page's own examples about storage rounding disagree with each other, so exact rounding is [uncertain]; irrelevant at our size.
- Unauthorized (401) requests are not charged (pricing page).
- Beyond the free tier the price is the table above. Even 1 GB over would cost about $0.015 per month.

**Why not Infrequent Access.** IA has no free tier, a 30-day minimum storage duration (objects deleted or replaced earlier are still billed for 30 days), retrieval fees, and doubled-or-higher request prices. (https://developers.cloudflare.com/r2/pricing/ and https://developers.cloudflare.com/r2/buckets/storage-classes/, read 2026-10-22) Restic deletes and rewrites small files (locks, index, snapshots, repacked packs) all the time, so IA would bill the 30-day minimum on churn, and `check`/restore tests would pay retrieval. Use Standard (the default class for new buckets; same storage-classes page). Do not set `-o s3.storage-class=...`.

**Assumptions for the estimate** (my numbers; not measured):
- Dump size 5 to 50 MB per day (the upper end is conservative for a personal finance DB).
- Worst case for dedup: assume every daily snapshot adds a full new copy of the dump at its raw size (no dedup, no compression). In practice restic deduplicates unchanged chunks and compresses (repo format v2, level `auto`, https://restic.readthedocs.io/en/stable/047_tuning_parameters.html, read 2026-10-22), so real storage will be smaller.
- Retention 7 daily, 4 weekly, 6 monthly. `forget` keeps one snapshot per period for that many periods, ORed across options, so the maximum is 7 + 4 + 6 = 17 snapshots, fewer in practice because one snapshot can satisfy several rules. (https://restic.readthedocs.io/en/stable/060_forget.html, read 2026-10-22)
- Default pack size 16 MiB; a run that adds less than that writes small packs at the end of the run (https://restic.readthedocs.io/en/stable/047_tuning_parameters.html). I assume a few objects per run: data pack(s), tree pack, index, snapshot, plus lock create/delete.

**Storage.** Worst case 17 x 50 MB = 850 MB, about 0.85 GB. Free tier is 10 GB-month. Headroom more than 11 times. Typical case (10 MB dump, dedup + compression) is likely under 100 MB total. Even a repository 10 times larger than the worst case estimate would still be near the free limit, so a runbook note "check bucket size monthly in the dashboard" is enough.

**Class A (writes and lists).** Generous assumption: 100 per daily backup run (lists of `index`, `snapshots`, `keys`, `locks` and puts of new files), 100 per `forget --prune` run (daily with the backup), 200 per monthly `check`, 100 per monthly restore test.
Monthly: 30 x 100 + 30 x 100 + 200 + 100 = 6,300. Free tier: 1,000,000. That is 0.6%.

**Class B (reads).** Assumption: 100 per backup run, 100 per prune run (cache reduces this), `check` with `--read-data-subset=10%` reads about 10% of packs. A repo with < 1 GB has on the order of a few hundred objects, so say 500 per check. Restore test reads the latest dump (maybe 50 packs): 100.
Monthly: 30 x 100 + 30 x 100 + 500 + 100 = 6,600. Free tier: 10,000,000. That is 0.07%.

**Egress.** Free (pricing page). A monthly full `check --read-data` of < 1 GB would also be free of egress charges; only Class B operations count.

**Conclusion.** Backup, prune, monthly check and monthly restore test stay far inside the free tier on all three axes. The per-operation counts are estimates, not measurements. [uncertain] The ratios leave a factor of more than 100 on operations and more than 10 on storage, so a wrong guess does not change the conclusion.

**Cache.** Keep the restic cache directory on a Docker volume so repeated runs do not re-download tree/index data (default location on Linux is `$XDG_CACHE_HOME/restic` or `~/.cache/restic`; change with `--cache-dir` or `RESTIC_CACHE_DIR`; `--no-cache` disables it: https://restic.readthedocs.io/en/stable/manual_rest.html, read 2026-10-22).

## 4. restic

**Latest stable.** v0.19.1, published 2026-07-05. Previous: v0.19.0 (2026-06-09), v0.18.1 (2025-09-21). (GitHub releases API via `gh api repos/restic/restic/releases`, read 2026-10-22; https://github.com/restic/restic/releases/tag/v0.19.1) The 0.19.1 changelog lists only bug fixes (mount, stdin-unrelated `backup` path fixes, `stats` JSON, SFTP removal on Windows servers). No S3 changes. No newer release existed on 2026-10-22.

**Pinned linux/amd64 download.** Assets for v0.19.1 (same release page): `restic_0.19.1_linux_amd64.bz2` (10,107,515 bytes), `SHA256SUMS`, `SHA256SUMS.asc`. URLs:
- `https://github.com/restic/restic/releases/download/v0.19.1/restic_0.19.1_linux_amd64.bz2`
- `https://github.com/restic/restic/releases/download/v0.19.1/SHA256SUMS`
- `https://github.com/restic/restic/releases/download/v0.19.1/SHA256SUMS.asc`
- Signing key: `https://restic.net/gpg-key-alex.asc`

**Checksum to pin in the Dockerfile.** The `SHA256SUMS` file I downloaded on 2026-10-22 has `f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c  restic_0.19.1_linux_amd64.bz2`. The GitHub API `digest` field for the same asset shows the same value. Both agree. (Use as an extra pin; still verify the signature at build time.)

**Signature.** The signing key is 0x91A6868BD3F7A907 (Alexander Neumann), fingerprint `CF8F 18F2 8445 7597 3F79  D4E1 91A6 868B D3F7 A907`; key at https://restic.net/gpg-key-alex.asc. `SHA256SUMS` is signed in `SHA256SUMS.asc`; checking is "optional and suggested on first installation". (https://restic.readthedocs.io/en/stable/020_installation.html and its source `doc/020_installation.rst`, read 2026-10-22)
Build-time verification procedure (in a throw-away builder stage with `gnupg`, `curl`, `bzip2`; the official mongo image has none of these, see section 5):
1. Download the three release files and the key.
2. `gpg --import gpg-key-alex.asc`, then check the printed fingerprint equals the one above (fail the build otherwise).
3. `gpg --verify SHA256SUMS.asc SHA256SUMS` must report a good signature from that key.
4. `grep restic_0.19.1_linux_amd64.bz2 SHA256SUMS | sha256sum -c -`, and also compare with the pinned value above.
5. `bunzip2`, `chmod +x`, copy only the binary to the final image (multi-stage).
6. Run `restic version` in the final image as a smoke test.
I could not run the gpg steps in this task (no gpg locally, and the rules allow `docker run` only for `--version/--help`). [uncertain: the exact gpg output; the fingerprint and file names are verified from the sources above.] The SHA-256 match between the downloaded `SHA256SUMS` and the API digest is verified.

**Repository string and env vars for R2.**
```
RESTIC_REPOSITORY=s3:https://<ACCOUNT_ID>.r2.cloudflarestorage.com/<bucket>/restic
AWS_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
AWS_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
AWS_DEFAULT_REGION=auto            # or:  -o s3.region=auto
RESTIC_PASSWORD_FILE=/run/secrets/restic_password   # or RESTIC_PASSWORD
# every restic call:  -o s3.bucket-lookup=path
```
Sources: repo string, credentials, region and `bucket-lookup` values from https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html; option names `region`, `bucket-lookup`, `connections`, `retries`, `storage-class`, `list-objects-v1` and the `AWS_DEFAULT_REGION` fallback from `internal/backend/s3/config.go` (all read 2026-10-22). Default S3 connections: 5 (config.go). The setting `-o s3.list-objects-v1=true` is a workaround for old servers (e.g. Ceph before 14.2.5); R2 supports ListObjectsV2, so do not set it.

**Local repository.** `restic init --repo /srv/restic-repo`; use `RESTIC_REPOSITORY=/backups/restic` (matches `BACKUP_LOCAL_DIR`). On Linux, avoid CIFS/SMB shares. (030 page)

**SFTP repository (Hetzner Storage Box).** `RESTIC_REPOSITORY=sftp://<user>@<user>.your-storagebox.de:23/restic-repo`.
- Restic parses `sftp://user@host[:port]/directory` and the directory is relative to the remote home unless it starts with a double slash (`sftp://user@host//absolute`). It runs the local `ssh` client as `ssh <host> -p <port> -l <user> <args> -s sftp`. (`internal/backend/sftp/config.go` and `sftp.go`, read 2026-10-22)
- The container therefore needs an `openssh-client` package (not in the mongo image; builder stage must add it or the final image must install it). [reasoning from the source: restic execs `ssh`]
- Key auth: pass the key and host-key settings with `-o sftp.args="-i /run/secrets/sftp_key -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/etc/restic/known_hosts"` (option `sftp.args` is "arguments for ssh"; restic doc: `-o sftp.args` sets arguments for the default SSH command, ignored when `sftp.command` is set). Passwordless login is required. (030 page)
- Hetzner side: port 23 for SFTP/SSH; keys in normal OpenSSH one-line format on port 23. See section 6.

**`init`.** `restic init` creates a repository, using the default repo format (version 2, requires restic 0.14.0 or newer; version 2 is the "current default"). (030 page) A script should check first with `restic cat config`: exit code 0 means it exists, exit code 10 means the repository does not exist (since 0.17.0), 12 is a wrong password, 11 is a lock failure; do not treat exit code 1 as "missing". `init` itself refuses to overwrite an existing repository. (https://restic.readthedocs.io/en/stable/075_scripting.html, read 2026-10-22)
Idempotent pattern:
```
restic cat config >/dev/null 2>&1; rc=$?
if [ $rc -eq 10 ]; then restic init; elif [ $rc -ne 0 ]; then fail "cannot open repository (exit $rc)"; fi
```

**Backing up a stream.** Preferred form (docs recommend it over a pipe, because a pipe masks producer errors): `restic backup --stdin-from-command --stdin-filename finance.archive -- mongodump ... --archive`. A non-zero exit of the command cancels the backup: restic exits 1 and creates no snapshot. Put `--` before the command. Restic cannot tell if data from plain `--stdin` is complete. (https://restic.readthedocs.io/en/stable/040_backup.html, read 2026-10-22) The command is executed directly after `--`, so use a small wrapper script if you need shell features or env expansion. [reasoning from docs wording]
Flags: `--stdin-filename` (default name `stdin`), `--host` / `-H` (default is the machine hostname, or `$RESTIC_HOST`), `--tag`, `--group-by` (default host,paths), `--compression`, `--pack-size`. (`cmd_backup.go`, read 2026-10-22) A container hostname can change when the container is recreated, which would split snapshot groups. Always set `--host finance-tracker` on `backup`, `forget`, `dump`, `restore`. (docs: `forget` groups by host and paths; keep `backup --group-by` the same as `forget`; https://restic.readthedocs.io/en/stable/060_forget.html)

**Compression.** Available only on repository format v2. Levels: `off`, `fastest`, `auto` (default), `better`, `max`. Env: `RESTIC_COMPRESSION`. (https://restic.readthedocs.io/en/stable/047_tuning_parameters.html, read 2026-10-22) Keep `auto`.

**Pack size.** Default 16 MiB; `--pack-size` or `RESTIC_PACK_SIZE` in MiB. Temp space = pack size x (connections + 1). Default is fine. (same page)

**Retention.** `restic forget --host finance-tracker --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune`.
- Each `--keep-*` keeps one snapshot per period for the last n periods that have at least one snapshot; a snapshot is kept if any rule matches; weeks run Monday to Sunday; `--prune` runs prune only if at least one snapshot was removed. `--dry-run` is available. (060 page)
- Prune options: `--max-unused` default 5%; `--max-repack-size`; `--repack-cacheable-only`. The repository is locked during prune and a backup cannot complete in that time, so run prune after the backup, in the same script, never in parallel. (060 page)
- Exit code 3 for `forget` means some snapshots could not be removed (075 page).

**Check.** `restic check` verifies structure; `--read-data` reads every pack (more bandwidth and time); `--read-data-subset=n/t` (group n of t), `=10%` (random percentage) or `=50M` (random size). By default `check` makes a temporary cache; `--with-cache` reuses the cache. A healthy run ends with "no errors were found". (https://restic.readthedocs.io/en/stable/045_working_with_repos.html, read 2026-10-22) For this small repo, run a full `check --read-data` monthly. Egress is free on R2, and the cost in operations is negligible (section 3).

**Restore and stream back.** `restic restore latest --target <dir>` with `--host`/`--path` to pick the snapshot. `restic dump` writes a single file to stdout: `restic dump latest production.sql | mysql`, or `dump --path /production.sql latest production.sql`. (https://restic.readthedocs.io/en/stable/050_restore.html, read 2026-10-22) For us: `restic dump --host finance-tracker latest /finance.archive | mongorestore --archive ...`. The docs page does not discuss dumping stdin-backed snapshots specifically; the path inside the snapshot is `/<stdin-filename>`. [uncertain: confirm in the local test; use `restic ls latest` to see the path]

**Stale locks.** `restic unlock` "removes stale locks that have been created by other restic processes"; `--remove-all` removes all locks, even non-stale ones. Exit status 0 or 1. (source `cmd_unlock.go`, read 2026-10-22; the docs manual only lists the command) `--retry-lock 5m` waits for a lock instead of failing. Exit code 11 = could not lock. (manual_rest.html and 075 page) Use: if exit 11, retry with `--retry-lock`; only after repeated failure and no restic process running, `unlock` (without `--remove-all`).

**Exit codes for scripting** (075 page): 0 success; 1 general failure; 2 Go runtime error; 3 partial failure (`backup` could not read some source data, or `forget` could not remove some snapshots); 10 repository does not exist; 11 failed to lock; 12 wrong password; 130 cancelled by SIGINT/SIGTERM. "If an unknown exit code is returned, then it MUST be treated as a command failure." For the dump backup, treat anything but 0 as failure (3 cannot be a valid result for a stream).

**Password.** `RESTIC_PASSWORD` (value), `RESTIC_PASSWORD_FILE` (path, `--password-file`) or `RESTIC_PASSWORD_COMMAND`. (030 page) `.env.example` uses `RESTIC_PASSWORD`; the entrypoint can write it to a 0400 file on tmpfs and export `RESTIC_PASSWORD_FILE`, then unset the variable for child processes where possible. Restic cannot read both password and data from stdin (source `cmd_backup.go`): use env or file, never prompt.

**Cache.** Default `$XDG_CACHE_HOME/restic` or `~/.cache/restic`; change with `--cache-dir` or `RESTIC_CACHE_DIR`; `--no-cache` disables. (manual_rest.html) Mount a volume at `/var/cache/restic` and set `RESTIC_CACHE_DIR`.

**Never run** `restic repair snapshots` (see issue #22092 in section 1).

## 5. MongoDB dump and restore

**Tools in the official image.** `mongo:8.0.34-noble` (Ubuntu 24.04.5) contains `mongodump` and `mongorestore` version 100.19.1 (package `mongodb-database-tools 100.19.1`, from `mongodb-org-tools 8.0.34`) and `mongosh` 2.13.0. I ran `docker run --rm mongo:8.0.34-noble ...` for `--version` and `dpkg -l` on 2026-10-22 (the run was on an arm64 host; the amd64 image has the same package versions, but the digest differs [uncertain on amd64 versions; same tag, same Dockerfile]). The image Dockerfile pins `MONGO_VERSION 8.0.34` (https://github.com/docker-library/mongo/blob/master/8.0/Dockerfile, read 2026-10-22 via `gh api`) and installs `mongodb-org-tools` and `mongodb-org-shell`. The mongorestore docs page describes version 100.19.1 (https://www.mongodb.com/docs/database-tools/mongorestore/, read 2026-10-22).
Also in that image: `bash`, `sha256sum`, `tar`, `flock`, `jq`, CA certificates, and the Europe/Athens zoneinfo file. Not in it: `curl`, `wget`, `gpg`, `bzip2`, `cron`, `busybox`, `ssh`. (checked by running `command -v` in the container). So restic must be added through a multi-stage build and the scheduler must be something we ship (see section 7).

**Dump command.**
```
mongodump --host mongo --port 27017 --username root --authenticationDatabase admin \
          --config /run/backup/mongodump.yml --db finance --archive --quiet
```
- `--archive` with no file writes to stdout (`--archive=<file>` for a file); it cannot be combined with `--out`. `--db` dumps one database. `--authenticationDatabase admin`: needed because the root user lives in `admin`; if you omit both options mongodump assumes `admin` for credentials. (https://www.mongodb.com/docs/database-tools/mongodump/, read 2026-10-22)
- Password handling: a password in a URI or `--password` can be visible in `ps`. The docs say to use a prompt or `--config`. (same page) The `--config` YAML file can hold `password`, `uri` and `sslPEMKeyPassword` [from a search-result summary of the same page; the exact file layout is not confirmed, test it in the build] [uncertain]. A simple alternative: a wrapper script that builds a URI from env vars. Inside a single-purpose container, exposure through `ps` is limited to our own processes.
- Dumping only `--db finance` leaves out users and roles, which live elsewhere. "MongoDB always includes user and role definitions when `mongodump` applies to an entire instance"; for one database you need `--dumpDbUsersAndRoles`. (same page) The app does not need them in the backup, because the Mongo users are re-created on a fresh volume from `MONGO_*` env values; but the restore runbook must say so. [reasoning from the env contract in `.env.example`]
- Standalone server: no `--oplog`. `--oplog` "only works against nodes that maintain an oplog. This includes all members of a replica set" and fails with `--db`. Without `--oplog` "the dump will not reflect a single moment in time" if writes happen during the dump. (same page) Accept this for a personal app: run at 03:30 Europe/Athens when use is near zero; keep the dump short. Option for later (not now): a single-node replica set would allow `--oplog`, but that conflicts with `--db` anyway.
- `--numParallelCollections` default is 4. [mongodump page] For stable dedup, prefer `-j 1`: the archive format interleaves collections, and parallel dumping makes the byte order vary between runs. [reasoning, not from a page; uncertain whether it matters for a small DB]

**gzip or not.** Recommendation: **do not use `--gzip`**; let restic deduplicate and compress. `--gzip` on an archive/stdout compresses the whole stream (mongodump page). A compressed stream changes almost entirely after a small data change, so restic's chunk dedup finds little in common between days; restic's own compression (format v2, `auto`) then cannot help. Without `--gzip`, unchanged parts of the archive stay byte-identical and are deduplicated; restic compresses the rest. [reasoning, general; not from a page; estimate in section 3 assumed no dedup, so it holds either way] Cost: the stream is larger on the local pipe only. No temp file is needed.

**Restore.**
```
restic dump --host finance-tracker latest /finance.archive | \
  mongorestore --host mongo --username root --authenticationDatabase admin \
               --config /run/backup/mongodump.yml --archive --drop --nsInclude 'finance.*'
```
- `--archive` with no file reads stdin. `--drop` "drops the collections from the target database" before restoring them; collections not in the backup are not dropped. With the `admin` database in the restore it would replace users, and a failure there could leave an empty database; we restore only `finance.*`. (mongorestore page above)
- Rename: `--nsFrom 'finance.*' --nsTo 'finance_restore_test.*'`. Each `*` in `--nsFrom` must match an `*` in `--nsTo`. The page has no rename example; this one follows its wildcard rules. `--nsFrom/--nsTo` cannot be combined with `--oplogReplay` (not needed). (mongorestore page)
- Indexes are restored by default (`--noIndexRestore` disables that). By default restore continues on duplicate-key and validation errors; add `--stopOnError` in the restore test so errors fail loudly. (mongorestore page)
- Restore is supported into "the same major version or feature compatibility version as the source". Keep the temp Mongo container on the same pinned image tag. (mongorestore page)
- Mongo auth and users on a fresh volume: use the same `MONGO_*` env.

**Restore test design (monthly, and available as `restore-test`).**
1. Start a temporary container from the same pinned mongo image on an internal Compose network, no published port, no auth (`mongod --noauth` is acceptable since the network is internal and it is destroyed afterwards), with `tmpfs` for `/data/db`.
2. `restic dump --host finance-tracker latest /finance.archive | mongorestore --host <tmp> --archive --drop --nsFrom 'finance.*' --nsTo 'finance_restore_test.*' --stopOnError`. [The temp server is separate so rename is not strictly needed; use it anyway to avoid any chance of touching the live DB if the host variable is wrong.]
3. For each collection in the source (via `mongosh --quiet --eval` with `db.getCollectionNames()`), compare `countDocuments({})` in `finance` (source, live) against `finance_restore_test` (temp). Counts can differ slightly if the app wrote after the snapshot. Tolerance: compare against the count at dump time instead: at the end of each backup, store per-collection counts in the `backup_runs` record; the restore test compares restored counts with the counts stored in the snapshot's `backup_runs` entry. Also compare index count per collection. [design choice]
4. Fail if any collection is missing, any count differs from the recorded count, or `mongorestore` exits non-zero.
5. Tear down the temp container (`docker compose rm -sf`; only containers we created).
6. Record the result in `backup_runs` with trigger `restore-test`.

## 6. Hetzner

The build only documents this. It never logs in, buys or enables anything.

**Storage Box as an SFTP target (optional, `BACKUP_TARGET=sftp`).**
- Ports: SSH/SFTP/SCP/rsync/Borg on port 23 (extended SSH service). Port 22 supports SCP and SFTP only, with no interactive access. FTP/FTPS (port 21) and SFTP/SCP (port 22) are always active; other protocols must be enabled in the Hetzner Console. (https://docs.hetzner.com/storage/storage-box/access/access-ssh-rsync-borg/ and https://docs.hetzner.com/storage/storage-box/general/, read 2026-10-22)
- To use port 23 you must turn on "SSH Support" in the Console. For connections from outside Hetzner's network, also turn on "External Reachability" in the same "Change settings" dialog. (access page)
- User name `uXXXXX`, host `uXXXXX.your-storagebox.de`; with a sub-account use the sub-account's user name. Only `/home/` is writable; use relative paths. The box has no full shell (no pipes or redirects, no running uploaded scripts). (access page)
- SSH key (use the same format Hetzner documents): `ssh-keygen` (ed25519 in their example; use `-f` to avoid overwriting an existing key), then `cat ~/.ssh/id_ed25519.pub | ssh -p23 uXXXXX@uXXXXX.your-storagebox.de install-ssh-key` which adds the key for both ports and keeps existing keys. Port 23 needs the one-line OpenSSH format; port 22 needs RFC4716. `scp`-based options overwrite `authorized_keys`. Test with `sftp -P 23 uXXXXX@uXXXXX.your-storagebox.de`. (https://docs.hetzner.com/storage/storage-box/backup-space-ssh-keys/, read 2026-10-22)
- Restic repo string: `sftp://uXXXXX@uXXXXX.your-storagebox.de:23/restic-repo` (relative path under the home directory). See section 4. `.env.example` has `SFTP_HOST`, `SFTP_PORT=23`, `SFTP_USER`, `SFTP_PATH`, `SFTP_KEY_FILE`, which map directly. Pin the host key with a `known_hosts` file; do not use `StrictHostKeyChecking=no`.
- Whether restic works through the Storage Box's restricted shell: restic asks for the `sftp` subsystem (`ssh ... -s sftp`, source `sftp.go`). A web search summary said Hetzner documents restic as supported over SFTP, and one community example used port 23, but I did not open a Hetzner page that names restic. [uncertain] Verify with a real `restic init` before relying on it. Also a user report says SFTP on port 23 starts in `/home` (Home Assistant issue seen only in a search result, not opened). [uncertain]
- Pricing: the Storage Box pages I read give plan names (BX11, BX21, BX31, BX41) and "unlimited traffic" but no prices; they point to https://www.hetzner.com/storage/storage-box for plans and prices. Prices: [uncertain] (not read; that site is outside the allowed source list).
- Storage Box snapshots exist on the box itself (manual and automatic; limits per plan: 10/20/30/40 for BX11/BX21/BX31/BX41), stored on the same box, so they do not protect against loss of the box. (general page)

**Hetzner Cloud server backups and snapshots (documented only).**
- Backups: created automatically, daily; "Each server has a total of seven Backup slots", and when all seven are used the oldest is deleted. Snapshots: created manually and "never deleted or updated automatically". Neither includes attached Volumes. Rebuilding a server from either loses any data not saved in it. (https://docs.hetzner.com/cloud/servers/backups-snapshots/overview/ and .../faq/, read 2026-10-22)
- Consistency: Hetzner recommends powering off the server for a consistent disk copy; for a running server "we cannot guarantee data consistency". It does not mention databases. (faq page) So these are a second, coarse safety net for the whole VPS, not a replacement for the dump + restic backup, which is application-consistent per collection.
- Console steps. Enable backups: project, "Backups" in the upper menu, "Enable Backups", choose the server, "Enable & Buy now". Take a snapshot: project, "Snapshots", "Take Snapshot", choose the server, "Create & Buy now", add a description. (https://docs.hetzner.com/cloud/servers/getting-started/enabling-backups/ and .../taking-snapshots/, read 2026-10-22)
- Cost: the pages I read do not state it. The overview page says to see the info box at hetzner.com/cloud. The percentage of the server price for backups and the per-GB price of snapshots: [uncertain] (not confirmed from an allowed source). The Console shows the price before purchase ("Enable & Buy now").
- Runbook line: "Optional: enable Hetzner server backups in the Console for a whole-server safety net. This is a manual, paid step; check the price in the Console first."

## 7. Recommended design for the build

Items marked "(source)" are backed by sections 1 to 6. Everything else is a design choice or reasoning, not a researched fact.

### 7.1 Container

- Name `backup`. Dockerfile in `docker/backup/`, **multi-stage**:
  1. Builder stage on a pinned Ubuntu 24.04 image with `curl`, `gnupg`, `bzip2`: download restic v0.19.1 linux/amd64, check the key fingerprint, verify `SHA256SUMS.asc`, check SHA-256 against both `SHA256SUMS` and the pinned value `f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c`, unpack. (section 4)
  2. Final stage `FROM mongo:8.0.34-noble` (the same tag as the `mongo` service; mongodump/mongorestore 100.19.1, mongosh 2.13.0, `mongod`, bash, flock, tzdata are in it; section 5). `COPY --from=builder /restic /usr/local/bin/restic`. `apt-get install --no-install-recommends ca-certificates openssh-client` only (ssh needed for the sftp target; ca-certificates already present). Do not add cron.
- Pin the base by tag and digest. The index digest printed when I pulled `mongo:8.0.34-noble` on 2026-10-22 was `sha256:c2d54fddfb3738fb27fe117f51692e3f44e640a3e7aeb8da3937ee9cd33a650b`; re-read it at build time. Do not run `mongod` as the server in this container (the entrypoint is overridden); it is used only by `restore-test`.
- Run with `TZ=Europe/Athens`. Needs no published ports and **no Docker socket**. Volumes: `backup_cache` at `/var/cache/restic` (`RESTIC_CACHE_DIR`), `backup_state` at `/var/lib/backup` (lock file, status JSON), and for `BACKUP_TARGET=local` a volume at `BACKUP_LOCAL_DIR`. Network: only `finance_net` (to reach `mongo`) plus egress to R2/SFTP. Run as a non-root user if the volumes allow (the official image's `mongodb` user, uid 999). [uncertain: the image entrypoint runs as root by default; test that the non-root user can write the volumes]
- Memory: the temporary `mongod` in `restore-test` should limit cache with `--wiredTigerCacheSizeGB 0.25` and run only when nothing else is running (use the lock). [uncertain: not read in a MongoDB page; check the minimum value in the build]

### 7.2 Scheduler (no cron in the image)

A small bash loop (`entrypoint.sh`) started after validation. Each 30 seconds it reads the Europe/Athens local date and time and decides what is due. It is **catch-up based**, not exact-minute based:
- `BACKUP_SCHEDULE` is restricted to the form `M H * * *` (daily at a local time). Any other form fails validation. The default `30 3 * * *` is kept.
- A backup is due when now is at or after `H:M` today and `last_scheduled_date != today` (kept in `/var/lib/backup/state.json`). Reason: Athens moves its clocks forward in spring, and 03:30 local time then does not exist on that one night (clocks go from 03:00 to 04:00 under the EU rule). An exact-minute match would silently skip that night. The date guard also stops a double run when the clocks go back, and recovers from container downtime. [reasoning from the EU DST rule, not from a fetched page]
- After each successful scheduled backup, in the same locked section: `forget --prune` (7/4/6). Then, if `YYYY-MM` differs from `last_check_month`: `check --read-data`, and if it differs from `last_restore_test_month`: `restore-test`. So the monthly check and the restore test run on the first night of each month, after the backup.
- Everything runs under `flock /var/lib/backup/lock`. `backup-now` waits for the lock for up to 10 minutes (`flock -w 600`).

### 7.3 Environment variables

Existing in `.env.example` (use as is): `BACKUP_TARGET` (local|s3|sftp), `BACKUP_LOCAL_DIR`, `BACKUP_SCHEDULE`, `BACKUP_KEEP_DAILY/WEEKLY/MONTHLY` (7/4/6), `RESTIC_PASSWORD`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_REGION` (auto), `SFTP_HOST`, `SFTP_PORT` (23), `SFTP_USER`, `SFTP_PATH`, `SFTP_KEY_FILE`, plus `MONGO_HOST`, `MONGO_PORT`, `MONGO_DB`, `MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD`.
Mapping inside the container: `AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION=$R2_REGION`, `RESTIC_REPOSITORY` built from the target, `RESTIC_CACHE_DIR=/var/cache/restic`, `RESTIC_COMPRESSION=auto`.
Proposed additions (add to `.env.example` and `.env` together, with defaults, per the project rule):
| Variable | Default | Purpose |
|---|---|---|
| `BACKUP_HOST` | `finance-tracker` | Passed as `--host` to every restic command so container renames do not split snapshot groups (section 4). |
| `BACKUP_REPO_PREFIX` | `restic` | Key prefix inside the R2 bucket / folder on the Storage Box. |
| `SFTP_KNOWN_HOSTS_FILE` | empty | Required when `BACKUP_TARGET=sftp`; a pinned host key file. |
| `BACKUP_TIMEOUT_MINUTES` | `30` | Kills a hung backup run and records failure. |
| `BACKUP_STALE_HOURS` | `26` | Healthcheck and the worker's alert use this (matches PLAN alert rule). |
Set `TZ=Europe/Athens` in the Compose service, not in `.env`.

### 7.4 Repository string by target

- `local`: `RESTIC_REPOSITORY=$BACKUP_LOCAL_DIR` (a Docker volume). Used for local tests and as the default. This protects against app bugs, not against losing the VPS. The status record should mark the run `offsite=false`.
- `s3`: `s3:$R2_ENDPOINT/$R2_BUCKET/$BACKUP_REPO_PREFIX` plus `-o s3.bucket-lookup=path -o s3.region=$R2_REGION` on every call, via a `restic()` shell wrapper. (section 1 and 4)
- `sftp`: `sftp://$SFTP_USER@$SFTP_HOST:$SFTP_PORT/$SFTP_PATH` plus `-o sftp.args="-i $SFTP_KEY_FILE -o UserKnownHostsFile=$SFTP_KNOWN_HOSTS_FILE -o StrictHostKeyChecking=yes -o BatchMode=yes"`. (section 4 and 6)

### 7.5 Scripts (in `docker/backup/`, on PATH in the container)

All scripts: `set -Eeuo pipefail`, never `echo` a secret, redact env in error messages, write one JSON line per step to stdout.
- `backup [--trigger schedule|manual|pre-deploy] [--no-prune]`:
  1. Take the lock. Insert a `backup_runs` document `{kind:"backup", trigger, startedAt, status:"running"}`.
  2. Count documents per collection (`mongosh --quiet`, `countDocuments({})`) before the dump.
  3. `restic cat config`; exit 10 means `init`; anything else non-zero fails. (section 4)
  4. `timeout ${BACKUP_TIMEOUT_MINUTES}m restic backup --host $BACKUP_HOST --tag mongodb --tag $trigger --stdin-from-command --stdin-filename finance.archive -- mongodump ... --db $MONGO_DB --archive --quiet`. No `--gzip`. Exit code must be 0. (section 4 and 5)
  5. Count documents again after the dump. Store both count sets (`countsBefore`, `countsAfter`) so the restore test can accept a restored count that is between them.
  6. Unless `--no-prune`: `restic forget --host $BACKUP_HOST --tag mongodb --keep-daily $BACKUP_KEEP_DAILY --keep-weekly $BACKUP_KEEP_WEEKLY --keep-monthly $BACKUP_KEEP_MONTHLY --prune`. A forget/prune failure marks the run `success_with_warning` (the snapshot exists) and still raises an alert.
  7. Update the document: `finishedAt`, `status` (`success` | `failed` | `success_with_warning`), `snapshotId` (from `restic snapshots --json --host ... --tag ... latest`), counts, `durationMs`, `error` (short text, secrets stripped), `notifiedAt:null`. Write the same JSON to `/var/lib/backup/status.json`.
- `backup-now`: wrapper for `backup --trigger pre-deploy --no-prune`, waits for the lock, exits non-zero if the backup failed so the deploy script stops. Deploy usage: `docker compose exec -T backup backup-now`.
- `restore [--snapshot latest|<id>] [--db finance] [--yes]`: refuses unless `--yes`; first takes a safety backup (`backup --trigger pre-restore --no-prune`); then `restic dump ... /finance.archive | mongorestore --archive --drop --nsInclude "$MONGO_DB.*" --stopOnError`. The runbook says to stop `app` and `worker` first.
- `restore-test`: runs a temporary `mongod` inside the container (`--dbpath` on a fresh `mktemp -d` under `/tmp`, `--port 27018`, `--bind_ip 127.0.0.1`, no auth, `--wiredTigerCacheSizeGB 0.25`), restores the latest snapshot into it with `--nsFrom "$MONGO_DB.*" --nsTo "restore_test.*" --stopOnError`, then for every collection compares restored `countDocuments({})` with the recorded counts (restored count must be >= `countsBefore` and <= `countsAfter`) and compares collection names and index counts. It always shuts the temporary `mongod` down and deletes its temp dir. Records `{kind:"restore-test"}` in `backup_runs`. No Docker socket is needed, and nothing touches the live database. (design choice; section 5 steps)
- `check`: `restic check --read-data` (full read of the small repo); records `{kind:"check"}`. If the repo grows beyond about 2 GB, switch to `--read-data-subset=10%`. (section 4; 2 GB is a judgment, not sourced)
- `status`: prints the last run per kind from `status.json`, `restic snapshots --host ...` and repo size via `restic stats` (the v0.19.1 changelog mentions a `stats` fix, so the command exists; its flags were not read).

### 7.6 Status for the app and the failure alert

- `backup_runs` (PLAN.md schema) is written by the backup container using the root Mongo user it already has for the dump. Fields added to the PLAN list: `kind` (backup|check|restore-test), `countsBefore`, `countsAfter`, `offsite` (bool), `durationMs`. On start-up, any run left in `running` for longer than the timeout is marked `failed` with error `interrupted`.
- `/var/lib/backup/status.json` is the fallback when Mongo is down (then the dump would fail too). A Docker `HEALTHCHECK` fails when the last successful `backup` is older than `BACKUP_STALE_HOURS`, or when `status.json` is missing after the first scheduled time.
- Alert: handled by the worker (PLAN §alerts): a failed `backup_runs` entry with `notifiedAt` unset, or no success in 26 h, triggers a push plus an in-app banner, key `backup:<runId>`. Restore-test and check failures alert the same way. The settings page (owner) shows last backup time, last restore-test result, `offsite`, and snapshot count.
- Optional extra: print a clear `BACKUP FAILED` line to stdout so `docker compose logs backup` shows it.

### 7.7 Start-up configuration validation (fail loudly)

At container start, before the scheduler runs, print each failed rule by variable name (never values) and exit with code 78. Compose should use `restart: on-failure:3` so a bad config does not loop forever. A validation failure also writes a failed `backup_runs` row if Mongo is reachable.
- `BACKUP_TARGET` must be one of `local`, `s3`, `sftp`.
- `RESTIC_PASSWORD` must be set and at least 20 characters. (generated value is 64 hex characters; `.env.example`)
- Retention values: integers >= 1. `BACKUP_SCHEDULE`: matches `M H * * *`, minute 0-59, hour 0-23.
- `local`: `BACKUP_LOCAL_DIR` is an absolute path, exists, writable. Log a warning that this is not off-site.
- `s3`: `R2_ENDPOINT` must start with `https://` (reject `http://`) and match `^https://[a-z0-9]+(\.(eu|fedramp|us))?\.r2\.cloudflarestorage\.com/?$`; it must contain no path (no bucket name). `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` non-empty; `R2_BUCKET` has no `/`. `R2_REGION` is `auto` (warn on other values). Reject `*.r2.dev` hosts. (section 1; the 32-character account ID length is not asserted, to avoid a wrong rule)
- `sftp`: `SFTP_HOST`, `SFTP_USER`, `SFTP_PATH` set; `SFTP_PORT` numeric; `SFTP_KEY_FILE` and `SFTP_KNOWN_HOSTS_FILE` exist and are not world-readable.
- Connectivity probe after the checks: `restic cat config`. Exit 0 is fine. Exit 10: `init` runs at the first backup. Exit 12 (wrong password) or any other non-zero code: fail loudly. (section 4)
- It cannot check from inside the container that the R2 bucket is private; that is a manual runbook step (section 2).

### 7.8 Retention defaults

7 daily, 4 weekly, 6 monthly (`.env.example`; at most 17 snapshots; section 3). `forget` always uses `--host $BACKUP_HOST --tag mongodb`; prune runs right after, inside the same lock. Compression `auto`, pack size default.

### 7.9 Monthly restore-test procedure for the runbook

Automatic: the first nightly run of each month runs `check` and `restore-test`. The result shows in Settings and in `backup_runs`.
Manual (once a quarter, or after any change to the backup): 
1. `docker compose exec -T backup restore-test` and read the final JSON line: `status: success`, with a per-collection table.
2. `docker compose exec -T backup status` and check: newest snapshot is under 26 hours old; the list has the expected daily/weekly/monthly mix.
3. In the Cloudflare dashboard: open the R2 bucket, check the storage size is plausible (well under 10 GB), and re-check that "Public Development URL" is disabled and there is no custom domain. (section 2)
4. Once a year, do a full rehearsal on a spare machine or local Docker: new empty stack, only `mongo` and `backup`, same `.env` backup values and `RESTIC_PASSWORD`, run `restore --yes`, start the app, log in. This proves that the password copy outside the server works.
5. Record the date and result in the runbook log.

## 8. [uncertain] list

1. **Bucket-scoped token and `restic init`.** Whether an "Object Read & Write" token limited to one bucket is allowed to do the bucket-level call restic makes in `init` (`BucketExists`). Cloudflare does not say. Test during the first real setup (runbook step 6 in section 2). Workaround if it fails: none verified; the owner would need to create the bucket first and, if still denied, use an Admin Read & Write token scoped as narrowly as possible (a weaker setup).
2. **Delete permission for Object Read & Write.** The token page says "read, write, and list objects". It does not state that delete is included, but `forget --prune` needs it. Test with the first `forget --prune` run.
3. **`DeleteObjects` billing class.** The pricing page lists only `DeleteObject` as free. Impact negligible.
4. **R2 storage rounding.** The pricing page's examples disagree. Irrelevant at this size.
5. **Per-run operation counts** (Class A/B) in section 3 are my estimates with a large safety margin, not measurements.
6. **Restic operation list vs R2.** The mapping of restic's needs to S3 operations is reasoned from its minio-go based backend, not from a restic page. A user report shows `init` working with R2.
7. **`s3.bucket-lookup=path` as the exact tested value.** Supported by both restic and R2 docs, but no page names restic and R2 together.
8. **No open restic issue specific to R2.** I read the specific issues and PR given (#3757 closed, #22092 and #22117 not R2) but did not search the whole tracker.
9. **GPG verification output.** Commands and fingerprint are from restic docs; I could not run `gpg` in this task. The SHA-256 of `restic_0.19.1_linux_amd64.bz2` was verified against the downloaded `SHA256SUMS` and the GitHub API digest.
10. **`mongodump --config` YAML layout.** The `password`, `uri` keys come from a search-result summary of the mongodump page, not a quoted sample. Test in the build, or use a wrapper script.
11. **Image tool versions on amd64.** I read `mongodump`/`mongorestore` 100.19.1 and `mongosh` 2.13.0 from `mongo:8.0.34-noble` on an arm64 host. The amd64 image uses the same package versions per the Dockerfile pin, but I did not run it.
12. **Non-root user in the backup container** and the `--wiredTigerCacheSizeGB 0.25` minimum: not verified.
13. **Restic dump of a stdin snapshot.** Docs do not discuss it; the path `/finance.archive` is assumed. Confirm with `restic ls latest` in the local test.
14. **Restic through the Storage Box restricted shell.** Restic uses the `sftp` subsystem; I did not open a Hetzner page that names restic. A path quirk on port 23 (starts in `/home`) was seen only in a search result. Verify with a real `init`.
15. **Prices:** Storage Box plan prices, Hetzner Cloud backups (% of server price) and snapshot price per GB were not stated on the allowed pages I read. Not guessed.
16. **DST claim** about Europe/Athens skipping 03:30 once a year comes from the EU rule (general knowledge), not a fetched page. The catch-up scheduler is correct either way.
17. **Dedup and `--gzip`.** The advice to skip `--gzip` and use `-j 1` is reasoning about content-defined chunking, not a measured result. The storage estimate holds even with zero dedup.
18. **mongodump consistency.** On a standalone server without `--oplog` the dump is not point-in-time (documented). The impact on this app (a few writes during a short dump) is a judgment call; the recorded before/after counts make any drift visible.
