# syntax=docker/dockerfile:1

# The service's production image: one Go binary, git beside it, and the built
# PWA, in a single small Linux image served on one origin (DIRECTION §3.6,
# "One binary, with git beside it in the image"). Built from the repository
# root so the context spans both app/ (the PWA) and service/ (the binary);
# compose.yaml builds this image and scripts/gate builds it from the working
# tree.

# --- Stage 1: build the PWA with Node 24 (foundation.app_tooling) ------------
# A Debian-based node image (glibc), to match the lockfile's platform and keep
# clear of musl optional-dependency pitfalls; this stage is discarded, so its
# size does not reach the final image.
FROM node:24.20.0-slim AS app
# The build tree lives two levels deep (/build/app) on purpose: the app is the
# first consumer of the cifra.md for JavaScript package (storage.working_copy),
# carried in package.json as a sibling-repo file: dependency,
# "cifra-md": "file:../../cifra.md/js". npm records that literal two-segment
# path in package-lock.json, and `npm ci` only accepts the lockfile when that
# path round-trips from the project root — which needs the root at least two
# directories deep (from /build/app, ../../cifra.md/js resolves to
# /cifra.md/js; from a top-level /app it would clamp at / and npm would reject
# the lockfile as invalid).
WORKDIR /build/app
# Bring the package's source in from the `cifra-md` named build context
# (compose.yaml wires it to the sibling checkout) at exactly the file: target —
# only package.json and src, never its node_modules — so `npm ci` can link it
# and `npm run build` (vite) can bundle it.
COPY --from=cifra-md package.json /cifra.md/js/package.json
COPY --from=cifra-md src /cifra.md/js/src
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
COPY service/go.mod service/go.sum ./
RUN go mod download
COPY service/ ./
# A static binary (CGO off) so the final image needs no C runtime. Only
# cmd/service is built; cmd/pre-receive has no main.go yet — the hook area adds
# it to this Dockerfile when it does (foundation.compose decision).
RUN CGO_ENABLED=0 go build -trimpath -o /out/service ./cmd/service

# --- Stage 3: the final image — the binary, git, and the built app -----------
FROM alpine:3.21
# git lives beside the binary so the service can run upload-pack/receive-pack
# over HTTP (DIRECTION §3.6); ca-certificates for the email provider's HTTPS
# API later. busybox wget in the base covers the container healthcheck with no
# extra tooling.
RUN apk add --no-cache git ca-certificates
COPY --from=service /out/service /usr/local/bin/service
# The built PWA, bundled now; serving it at / stays a pure Go change
# (service.serve_app), which reads it from here.
COPY --from=app /build/app/dist /srv/app
# The book volume's mount point: one bare repository per book under
# /data/books (DIRECTION §3.3); compose mounts a named volume here.
RUN mkdir -p /data/books
# The binary binds this fixed internal port; the stack publishes a host port
# and maps it here (service/internal/config.DefaultPort = 8080).
EXPOSE 8080
ENTRYPOINT ["service"]
