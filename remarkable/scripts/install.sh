#!/bin/sh
# install.sh — install the Estante reader on a reMarkable, from a computer.
#
# Step 4 of remarkable/INSTALL.md (design docs/remarkable-reader.md §2.1).
# xovi and AppLoad must already be on the tablet (step 3).
#
#   RM_IP=<address> ./install.sh
#
# RM_IP           the tablet's address (10.11.99.1 over USB); required.
# RM_USER         the login on the tablet; default root.
# ESTANTE_RELEASES  where the latest release is; default
#                 https://github.com/ruoso/estante-de-cifras/releases/latest/download
#                 — the reader is published as GitHub releases of the
#                 repository, never by the site (design §8).
# ESTANTE_FROM_SOURCE=1
#                 build the reader here, from the checkout this script is in,
#                 instead of taking the release's: the backend (Go), the screens
#                 (the QML, compiled with Qt's rcc) and the music code (the
#                 app's device bundle, with npm). The backend is built with
#                 its self-update off, so what this puts on the tablet stays
#                 until the next install. Needs Go here (the module's go line
#                 names the version, which Go fetches by itself), npm for the
#                 bundle, and python3 or ESTANTE_RCC for the screens.
# ESTANTE_SOURCE_QML=0, ESTANTE_SOURCE_BUNDLE=0
#                 with ESTANTE_FROM_SOURCE, keep the release's screens or the
#                 release's bundle instead.
# ESTANTE_RCC     with ESTANTE_FROM_SOURCE, the rcc to compile the screens
#                 with; default the QML tests' venv's pyside6-rcc, made
#                 from remarkable/qml/tests/requirements.txt when absent.
#
# It asks the tablet its architecture, downloads that app folder from the
# latest release — everything the reader runs: the backend, the screens, the
# music code — checks it against the release's manifest's SHA-256, unpacks it here,
# copies it over one SSH connection to a staging folder, then swaps it into
# AppLoad's directory, keeping the installed one as the previous install
# (outside AppLoad's directory) and stopping its backend if it still runs.
# It never touches the reader's books and state in
# /home/root/.local/share/estante/.
#
# Needs here: ssh, scp, curl, tar, and sha256sum or shasum (and the
# ESTANTE_FROM_SOURCE tools above). On the tablet:
# sh, uname, mkdir, mv, rm, readlink, kill and /proc.

set -eu

APPLOAD_SO=/home/root/xovi/extensions.d/appload.so
APPLOAD_PARENT=/home/root/xovi/exthome/appload
APPLOAD_DIR=/home/root/xovi/exthome/appload/estante
PREVIOUS_DIR=/home/root/xovi/exthome/estante.previous
STAGING_DIR=/home/root/xovi/exthome/estante.new
# A release the self-update staged, which an install makes stale.
NEXT_DIR=/home/root/xovi/exthome/estante.next

say() { printf '%s\n' "$*"; }
die() { printf 'install.sh: %s\n' "$*" >&2; exit 1; }

if [ -z "${RM_IP:-}" ]; then
    die "set RM_IP to the tablet's address: RM_IP=10.11.99.1 ./install.sh over USB, or the Wi-Fi address from Settings → General → Help → About → Copyrights and licenses (INSTALL.md step 2)"
fi
RM_USER=${RM_USER:-root}
ESTANTE_RELEASES=${ESTANTE_RELEASES:-https://github.com/ruoso/estante-de-cifras/releases/latest/download}
ESTANTE_RELEASES=${ESTANTE_RELEASES%/}
DEST="$RM_USER@$RM_IP"

for tool in ssh scp curl tar; do
    command -v "$tool" >/dev/null 2>&1 || die "$tool is not installed on this computer; install it, or install the reader by hand (INSTALL.md step 4)"
done

# The checkout to build from: the reader's module this script sits in, and
# cifra.md's Go module beside it, which the backend's version also digests.
FROM_SOURCE=
case "${ESTANTE_FROM_SOURCE:-}" in
'' | 0) ;;
*)
    FROM_SOURCE=1
    command -v go >/dev/null 2>&1 ||
        die "ESTANTE_FROM_SOURCE needs Go on this computer (https://go.dev/dl/); install it, or run without ESTANTE_FROM_SOURCE. Nothing was changed."
    SRC=$(cd "$(dirname "$0")/.." 2>/dev/null && pwd) || SRC=
    if [ -z "$SRC" ] || ! grep -q '^module estantedecifras.app/remarkable$' "$SRC/go.mod" 2>/dev/null ||
        [ ! -f "$SRC/../cifra.md/go/go.mod" ] || [ ! -f "$SRC/../app/package.json" ]; then
        die "ESTANTE_FROM_SOURCE builds from the checkout this script is in, and this one is not in one: clone https://github.com/ruoso/estante-de-cifras and run remarkable/scripts/install.sh from it. Nothing was changed."
    fi
    APP_SRC=$(cd "$SRC/../app" && pwd)
    SOURCE_QML=1
    case "${ESTANTE_SOURCE_QML:-1}" in 0) SOURCE_QML= ;; esac
    SOURCE_BUNDLE=1
    case "${ESTANTE_SOURCE_BUNDLE:-1}" in 0) SOURCE_BUNDLE= ;; esac
    if [ -n "$SOURCE_BUNDLE" ]; then
        command -v npm >/dev/null 2>&1 ||
            die "ESTANTE_FROM_SOURCE builds the bundle with npm, which is not on this computer: install Node (its version is in .node-version), or set ESTANTE_SOURCE_BUNDLE=0 for the release's bundle. Nothing was changed."
    fi
    if [ -n "$SOURCE_QML" ]; then
        RCC=${ESTANTE_RCC:-$SRC/qml/tests/.venv/bin/pyside6-rcc}
        if [ ! -x "$RCC" ] && [ -n "${ESTANTE_RCC:-}" ]; then
            die "ESTANTE_RCC is $ESTANTE_RCC, which is not an executable. Nothing was changed."
        fi
        if [ ! -x "$RCC" ]; then
            command -v python3 >/dev/null 2>&1 ||
                die "ESTANTE_FROM_SOURCE compiles the screens with Qt's rcc, from a Python venv, and python3 is not on this computer: install it, set ESTANTE_RCC to an rcc, or set ESTANTE_SOURCE_QML=0 for the release's screens. Nothing was changed."
        fi
    fi
    ;;
esac
if command -v sha256sum >/dev/null 2>&1; then
    sha256() { sha256sum "$1" | cut -d ' ' -f 1; }
elif command -v shasum >/dev/null 2>&1; then
    sha256() { shasum -a 256 "$1" | cut -d ' ' -f 1; }
else
    die "neither sha256sum nor shasum is installed on this computer; install one, or install the reader by hand (INSTALL.md step 4)"
fi

WORK=$(mktemp -d "${TMPDIR:-/tmp}/estante-install.XXXXXX")
CONTROL="$WORK/cm"
CONNECTED=
cleanup() {
    if [ -n "$CONNECTED" ]; then
        ssh -o "ControlPath=$CONTROL" -O exit "$DEST" >/dev/null 2>&1 || true
    fi
    rm -rf "$WORK"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

# remote CMD runs CMD on the tablet over the shared connection: the first call
# opens it (asking the password, if any, once), the rest reuse it.
remote() {
    CONNECTED=1
    ssh -o ControlMaster=auto -o "ControlPath=$CONTROL" -o ControlPersist=60 "$DEST" "$1"
}

# 1. The tablet's architecture. The output goes to a file, not a pipe: the
# connection's master stays in the background and must not hold the pipe open.
remote 'uname -m' >"$WORK/machine" ||
    die "could not reach the tablet as $DEST; check RM_IP, the cable or the Wi-Fi, and the root password (INSTALL.md step 2)"
machine=$(cat "$WORK/machine")
case "$machine" in
    armv7l) ARCH=armv7 ;;
    aarch64) ARCH=arm64 ;;
    *) die "the tablet is a $machine machine; the reader runs on armv7l (reMarkable 2) and aarch64 (Paper Pro) only. Nothing was downloaded or changed." ;;
esac
ARCHIVE="estante-${ARCH}.tar.gz"
# Everything built here: nothing is taken from a release.
LOCAL_ONLY=
if [ -n "$FROM_SOURCE" ] && [ -n "$SOURCE_QML" ] && [ -n "$SOURCE_BUNDLE" ]; then
    LOCAL_ONLY=1
    say "The tablet is $machine: installing the $ARCH reader built here."
else
    say "The tablet is $machine: installing the $ARCH reader from the latest release ($ESTANTE_RELEASES)."
fi

# 2. The folder and the manifest that names its SHA-256.
fetch() {
    curl --fail --location --silent --show-error -o "$2" "$ESTANTE_RELEASES/$1" ||
        die "could not download $ESTANTE_RELEASES/$1; check this computer's connection and try again. Nothing was changed on the tablet."
}
mkdir "$WORK/unpacked"
version=
if [ -z "$LOCAL_ONLY" ]; then
fetch manifest.json "$WORK/manifest.json"
fetch "$ARCHIVE" "$WORK/$ARCHIVE"

# The manifest without whitespace, one JSON object per line: the line naming
# the archive's path holds its sha256, whichever order the keys are in.
flat=$(tr -d ' \t\r\n' <"$WORK/manifest.json")
want=$(printf '%s\n' "$flat" | tr '{}' '\n\n' | grep -F "\"path\":\"$ARCHIVE\"" |
    sed -n 's/.*"sha256":"\([0-9a-fA-F]*\)".*/\1/p' | head -n 1 | tr 'A-F' 'a-f') || true
got=$(sha256 "$WORK/$ARCHIVE")
if [ -z "$want" ] || [ "$want" != "$got" ]; then
    die "the download does not match the release's manifest ($ARCHIVE); try again in a few minutes, a release may be being published. Nothing was changed on the tablet."
fi
# The release's number: the top-level key, once every nested object is
# removed, innermost first.
version=$(printf '%s\n' "$flat" | sed 's/^{//; s/}$//' |
    sed -e ':a' -e 's/{[^{}]*}//' -e 'ta' |
    sed -n 's/.*"release":\([0-9][0-9]*\).*/\1/p')
version=${version:-unknown}

# 3. Unpacked here: the tablet needs no tar.
tar -x -z -f "$WORK/$ARCHIVE" -C "$WORK/unpacked" ||
    die "could not unpack $ARCHIVE; try again. Nothing was changed on the tablet."
if [ ! -f "$WORK/unpacked/estante/manifest.json" ] || [ ! -x "$WORK/unpacked/estante/backend/entry" ]; then
    die "$ARCHIVE does not hold estante/manifest.json and an executable estante/backend/entry. Nothing was changed on the tablet."
fi
fi

# 3b. With ESTANTE_FROM_SOURCE, the reader built here replaces the release's.
# The backend: for the tablet's architecture, stamped with its version as
# the image stamps it (a digest of the sources and the Go toolchain), with
# the image's flags, and with its self-update off.
if [ -n "$FROM_SOURCE" ]; then
    case "$ARCH" in
        armv7) goarch=arm goarm=7 ;;
        arm64) goarch=arm64 goarm= ;;
    esac
    say "Building the $ARCH backend from $SRC…"
    mkdir "$WORK/build"
    built=$(cd "$SRC" && v=$(go run ./tools/payload digest . ../cifra.md/go) &&
        CGO_ENABLED=0 GOOS=linux GOARCH=$goarch GOARM=$goarm \
            go build -trimpath -ldflags "-X main.version=$v -X main.selfUpdate=off" \
            -o "$WORK/build/" ./cmd/estante-reader &&
        printf '%s\n' "$v") ||
        die "could not build the backend from $SRC (the output above says why). Nothing was changed on the tablet."
    say "Built backend version $built, its self-update off."

    # The music code: built here, the bundle the build's manifest names
    # (build:device leaves earlier builds' bundles beside it); else the
    # release's, in its folder's bundle/.
    bundle="$WORK/unpacked/estante/bundle"
    if [ -n "$SOURCE_BUNDLE" ]; then
        say "Building the bundle from $APP_SRC…"
        (cd "$APP_SRC" && { [ -d node_modules ] || npm ci --no-audit --no-fund; } &&
            npm run --silent build:device) ||
            die "could not build the bundle (the output above says why); set ESTANTE_SOURCE_BUNDLE=0 for the release's. Nothing was changed on the tablet."
        built_manifest=$(tr -d ' \t\r\n' <"$APP_SRC/dist/device/manifest.json" 2>/dev/null) || built_manifest=
        built_bundle=$(printf '%s\n' "$built_manifest" | tr '{}' '\n\n' |
            sed -n 's/.*"path":"\(bundle\.[0-9a-f]*\.js\)".*/\1/p' | head -n 1)
        bundle="$WORK/bundle"
        [ -n "$built_bundle" ] && [ -f "$APP_SRC/dist/device/$built_bundle" ] && mkdir "$bundle" &&
            cp "$APP_SRC/dist/device/manifest.json" "$APP_SRC/dist/device/$built_bundle" "$bundle/" ||
            die "the bundle build left no app/dist/device/manifest.json and the bundle it names. Nothing was changed on the tablet."
    fi

    # The screens: compiled here (tools/appfolder), the whole folder when
    # everything is built here, else their resources.rcc in the release's.
    if [ -n "$SOURCE_QML" ]; then
        if [ ! -x "$RCC" ]; then
            say "Making the venv with Qt's rcc in $SRC/qml/tests/.venv (a download of about 100 MB, once)…"
            { python3 -m venv "$SRC/qml/tests/.venv" &&
                "$SRC/qml/tests/.venv/bin/pip" install --quiet --require-hashes \
                    -r "$SRC/qml/tests/requirements.txt"; } ||
                die "could not make the venv with Qt's rcc (the output above says why); set ESTANTE_RCC, or ESTANTE_SOURCE_QML=0. Nothing was changed on the tablet."
        fi
        say "Building the screens from $SRC/qml…"
        (cd "$SRC" && go run ./tools/appfolder --arch "$ARCH" --backend "$WORK/build/estante-reader" \
            --qml qml --rcc "$RCC" --bundle "$bundle" --out "$WORK/folder") ||
            die "could not build the screens (the output above says why). Nothing was changed on the tablet."
        if [ -n "$LOCAL_ONLY" ]; then
            mv "$WORK/folder/estante" "$WORK/unpacked/estante" ||
                die "could not put the built folder in place. Nothing was changed on the tablet."
        else
            cp "$WORK/folder/estante/resources.rcc" "$WORK/unpacked/estante/resources.rcc" ||
                die "could not put the built screens in the folder. Nothing was changed on the tablet."
        fi
    fi

    # The backend and the music code in the release's folder.
    if [ -z "$LOCAL_ONLY" ]; then
        cp "$WORK/build/estante-reader" "$WORK/unpacked/estante/backend/entry" &&
            chmod 755 "$WORK/unpacked/estante/backend/entry" ||
            die "could not put the built backend in the folder. Nothing was changed on the tablet."
        if [ -n "$SOURCE_BUNDLE" ]; then
            rm -rf "$WORK/unpacked/estante/bundle" && cp -R "$bundle" "$WORK/unpacked/estante/bundle" ||
                die "could not put the built bundle in the folder. Nothing was changed on the tablet."
        fi
    fi
fi

# 4. Copied to a staging folder outside AppLoad's directory, so a Reload in
# the middle of the copy never lists a half-copied app.
# AppLoad lists the apps in its xovi extension directory but does not make
# it, and an install by Vellum leaves it absent: it is made here. An AppLoad
# not installed yet (no extension in extensions.d) lists the reader once it
# is; the person is told, and the install goes on.
ready=$(remote "mkdir -p $APPLOAD_PARENT && rm -rf $STAGING_DIR && if [ -f $APPLOAD_SO ]; then echo ready; else echo no-appload; fi") ||
    die "lost the connection to the tablet; try again. Nothing was changed in AppLoad's directory."
case "$ready" in
ready) ;;
no-appload) say "AppLoad is not installed on the tablet yet (no $APPLOAD_SO): the reader is installed, and AppLoad lists it once AppLoad is (INSTALL.md step 3)." ;;
*) die "could not prepare $APPLOAD_PARENT on the tablet; try again. Nothing was changed in AppLoad's directory." ;;
esac
say "Copying the reader to the tablet…"
copy() {
    scp -q -r "$@" -o ControlMaster=auto -o "ControlPath=$CONTROL" -o ControlPersist=60 \
        "$WORK/unpacked/estante" "$DEST:$STAGING_DIR"
}
# A recent scp speaks SFTP, which a tablet without sftp-server refuses; the
# legacy protocol (-O) is the fallback, into a cleared staging folder.
if ! copy; then
    remote "rm -rf $STAGING_DIR" && copy -O ||
        die "could not copy the reader to the tablet; try again. Nothing was changed in AppLoad's directory."
fi

# 5. The swap, in one remote command; every path is on one filesystem, so
# each mv is a rename. The previous install's backend is stopped by what its
# /proc/<pid>/exe names: after the rename, that is exactly the old backend.
swap="set -e
if [ -e $APPLOAD_DIR ]; then
    rm -rf $PREVIOUS_DIR
    mv $APPLOAD_DIR $PREVIOUS_DIR
    echo kept
else
    echo none
fi
mv $STAGING_DIR $APPLOAD_DIR
rm -rf $NEXT_DIR
for p in /proc/[0-9]*; do
    exe=\$(readlink \"\$p/exe\" 2>/dev/null) || continue
    if [ \"\$exe\" = $PREVIOUS_DIR/backend/entry ]; then
        kill \"\${p#/proc/}\" 2>/dev/null || true
    fi
done
"
kept=$(remote "$swap") ||
    die "the swap on the tablet failed; check $APPLOAD_DIR and $PREVIOUS_DIR with ssh $DEST ls /home/root/xovi/exthome (INSTALL.md step 7)"

# 6. What was installed, and the next step.
if [ -n "$FROM_SOURCE" ]; then
    built_parts="the backend${SOURCE_QML:+, the screens}${SOURCE_BUNDLE:+, the bundle}"
    say "Installed the $ARCH reader built here ($built_parts; backend version $built, self-update off) at $APPLOAD_DIR."
else
    say "Installed the $ARCH reader, release $version, at $APPLOAD_DIR."
fi
if [ "$kept" = kept ]; then
    say "The previous install is kept at $PREVIOUS_DIR."
else
    say "There was no previous install."
fi
say "Next: on the tablet, open AppLoad and press Reload; Estante is listed."
