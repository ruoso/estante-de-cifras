# syntax=docker/dockerfile:1

# The service's production image: one Go binary, git beside it, and the built
# PWA, in a single small Linux image served on one origin (DIRECTION §3.6,
# "One binary, with git beside it in the image"). Built from the repository
# root so the context spans app/ (the PWA), service/ (the binary) and the
# cifra.md/ subtree both of them build against;
# compose.yaml builds this image and scripts/gate builds it from the working
# tree.

# --- Stage 1: build the PWA with Node 24 (foundation.app_tooling) ------------
# A Debian-based node image (glibc), to match the lockfile's platform and keep
# clear of musl optional-dependency pitfalls; this stage is discarded, so its
# size does not reach the final image.
FROM node:24.20.0-slim AS app
# The app depends on cifra.md for JavaScript as "cifra-md": "file:../cifra.md/js"
# (the cifra.md/ subtree beside app/). The build tree mirrors the repository —
# /build/app and /build/cifra.md/js — so that path resolves as it does in the
# working tree and `npm ci` accepts the lockfile. Only the package's
# package.json and src are copied, never its node_modules.
WORKDIR /build/app
COPY cifra.md/js/package.json /build/cifra.md/js/package.json
COPY cifra.md/js/src /build/cifra.md/js/src
# Install from the lockfile first, for a cached layer only the lockfile busts;
# then build the static bundle into /build/app/dist (vite build, base '/').
COPY app/package.json app/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY app/ ./
RUN npm run build

# --- Stage 2: build the Go service binary, CGO-free --------------------------
FROM golang:1.25-alpine AS service
WORKDIR /src
# Copying the module files first keeps the download layer cached when only
# sources change. go.sum appears with the service's first dependency, pgx
# (service.schema); go mod download verifies against it.
#
# The service module replaces estantedecifras.app/api with ../api (the API
# contract package, same repo — service.passkeys validates handler payloads
# against it). From /src that replace target is /api, so the replaced module's
# go.mod/go.sum must sit there before `go mod download` computes the build list.
COPY service/go.mod service/go.sum ./
COPY api/go.mod api/go.sum /api/
# cifra.md for Go, replaced by ../cifra.md/go (the subtree; from /src that
# target is /cifra.md/go): the hook links it to check canonical form
# (hook.canonical). Its go.mod/go.sum must sit at the replace target before
# `go mod download` computes the build list, like the api module above.
COPY cifra.md/go/go.mod cifra.md/go/go.sum /cifra.md/go/
RUN go mod download
COPY service/ ./
# The api module's source at the replace target, so the Go toolchain resolves
# estantedecifras.app/api inside the image exactly as it does from the working
# tree.
COPY api/ /api/
# The cifra.md for Go source at its replace target, so `go build ./cmd/pre-receive`
# links the hook's canonical-form check inside the image exactly as from the
# working tree.
COPY cifra.md/go/ /cifra.md/go/
# Two static binaries (CGO off) so the final image needs no C runtime: the
# service, and the pre-receive hook git runs on every push (hook.refs). The
# service proper imports no cifra.md Go package; the hook links cifra.md for Go
# to check canonical form (hook.canonical), copied into this stage above at the
# module's replace target.
RUN CGO_ENABLED=0 go build -trimpath -o /out/service ./cmd/service
RUN CGO_ENABLED=0 go build -trimpath -o /out/pre-receive ./cmd/pre-receive
# The operator's copyright-notice tool (service.admin / workflow 10), shipped
# beside the service so the operator can run it inside the production container
# with the service's own environment. It is a CLI, not an endpoint.
RUN CGO_ENABLED=0 go build -trimpath -o /out/estante-admin ./cmd/estante-admin

# --- Stage 3: the final image — the binary, git, and the built app -----------
FROM alpine:3.21
# git lives beside the binary so the service can run upload-pack/receive-pack
# over HTTP (DIRECTION §3.6); ca-certificates for the email provider's HTTPS
# API later. busybox wget in the base covers the container healthcheck with no
# extra tooling.
RUN apk add --no-cache git ca-certificates
COPY --from=service /out/service /usr/local/bin/service
# The operator runs this inside the running container (service.admin); it reads
# the service's own ESTANTE_* environment and moves registry rows, never git.
COPY --from=service /out/estante-admin /usr/local/bin/estante-admin
# The built PWA, bundled now; serving it at / stays a pure Go change
# (service.serve_app), which reads it from here.
COPY --from=app /build/app/dist /srv/app
# The book volume's mount point: one bare repository per book under
# /data/books (DIRECTION §3.3); compose mounts a named volume here.
RUN mkdir -p /data/books
# The git hooks directory (service.git_http): git is pointed here via
# core.hooksPath on every push, and the pre-receive binary built above sits here
# so git runs it on every push (hook.refs) — the config default is this path
# (config.DefaultHooksDir).
RUN mkdir -p /srv/hooks
COPY --from=service /out/pre-receive /srv/hooks/pre-receive
# The binary binds this fixed internal port; the stack publishes a host port
# and maps it here (service/internal/config.DefaultPort = 8080).
EXPOSE 8080
ENTRYPOINT ["service"]
