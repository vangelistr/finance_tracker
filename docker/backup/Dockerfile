# syntax=docker/dockerfile:1.7
# Backup service: mongodump streamed into restic (client-side encrypted), on a schedule in Europe/Athens.
# Based on the same mongo image as the database, so mongodump/mongorestore/mongosh/mongod versions match.

ARG MONGO_IMAGE=mongo:8.0.34-noble@sha256:c2d54fddfb3738fb27fe117f51692e3f44e640a3e7aeb8da3937ee9cd33a650b

FROM ${MONGO_IMAGE} AS restic
ARG TARGETARCH
ARG RESTIC_VERSION=0.19.1
# From the release's signed SHA256SUMS (checked 2026-10-22); the signature is verified again below.
ARG RESTIC_SHA256_AMD64=f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c
ARG RESTIC_SHA256_ARM64=a5f64aaab53d51e311fa3829124c5b703f2d14cf187d8640b6be3b2b49376465
# Alexander Neumann's release signing key (restic installation docs)
ARG RESTIC_KEY_FPR=CF8F18F2844575973F79D4E191A6868BD3F7A907
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl gnupg bzip2 ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /build
RUN set -eu; \
    case "${TARGETARCH}" in amd64) expected="${RESTIC_SHA256_AMD64}" ;; arm64) expected="${RESTIC_SHA256_ARM64}" ;; *) echo "unsupported arch ${TARGETARCH}"; exit 1 ;; esac; \
    base="https://github.com/restic/restic/releases/download/v${RESTIC_VERSION}"; \
    file="restic_${RESTIC_VERSION}_linux_${TARGETARCH}.bz2"; \
    curl -fsSL -o "${file}" "${base}/${file}"; \
    curl -fsSL -o SHA256SUMS "${base}/SHA256SUMS"; \
    curl -fsSL -o SHA256SUMS.asc "${base}/SHA256SUMS.asc"; \
    curl -fsSL -o key.asc https://restic.net/gpg-key-alex.asc; \
    export GNUPGHOME="$(mktemp -d)"; \
    gpg --batch --quiet --import key.asc; \
    gpg --batch --with-colons --fingerprint | grep -q "^fpr:::::::::${RESTIC_KEY_FPR}:"; \
    gpg --batch --verify SHA256SUMS.asc SHA256SUMS; \
    grep " ${file}\$" SHA256SUMS | sha256sum -c -; \
    echo "${expected}  ${file}" | sha256sum -c -; \
    bunzip2 "${file}"; \
    install -m 0755 "restic_${RESTIC_VERSION}_linux_${TARGETARCH}" /restic

FROM ${MONGO_IMAGE}
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssh-client \
 && rm -rf /var/lib/apt/lists/* \
 # gosu is only used by the mongo server entrypoint, which this image replaces (it runs as USER mongodb).
 && rm -f /usr/local/bin/gosu \
 && mkdir -p /var/cache/restic /var/lib/backup /backups/restic \
 && chown mongodb:mongodb /var/cache/restic /var/lib/backup /backups/restic
COPY --from=restic /restic /usr/local/bin/restic
COPY lib/ /usr/local/lib/backup/
COPY bin/ /usr/local/bin/
RUN chmod 0755 /usr/local/bin/backup* /usr/local/bin/restore* /usr/local/bin/check-repo && restic version
ENV TZ=Europe/Athens \
    RESTIC_CACHE_DIR=/var/cache/restic \
    RESTIC_COMPRESSION=auto \
    BACKUP_STATE_DIR=/var/lib/backup
USER mongodb
HEALTHCHECK --interval=5m --timeout=20s --start-period=1m --retries=1 CMD ["/usr/local/bin/backup-health"]
ENTRYPOINT ["/usr/local/bin/backup-entrypoint"]
