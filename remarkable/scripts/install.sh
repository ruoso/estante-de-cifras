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
# ESTANTE_ORIGIN  the site to download from; default
#                 https://estantedecifras.app (a local stack: its address).
#
# It asks the tablet its architecture, downloads that app folder from the
# site's /device/, checks it against the manifest's SHA-256, unpacks it here,
# copies it over one SSH connection to a staging folder, then swaps it into
# AppLoad's directory, keeping the installed one as the previous install
# (outside AppLoad's directory) and stopping its backend if it still runs.
# It never touches the reader's books and state in
# /home/root/.local/share/estante/.
#
# Needs here: ssh, scp, curl, tar, and sha256sum or shasum. On the tablet:
# sh, uname, mkdir, mv, rm, readlink, kill and /proc.

set -eu

APPLOAD_PARENT=/home/root/xovi/exthome/appload
APPLOAD_DIR=/home/root/xovi/exthome/appload/estante
PREVIOUS_DIR=/home/root/xovi/exthome/estante.previous
STAGING_DIR=/home/root/xovi/exthome/estante.new

say() { printf '%s\n' "$*"; }
die() { printf 'install.sh: %s\n' "$*" >&2; exit 1; }

if [ -z "${RM_IP:-}" ]; then
    die "set RM_IP to the tablet's address: RM_IP=10.11.99.1 ./install.sh over USB, or the Wi-Fi address from Settings → General → Help → About → Copyrights and licenses (INSTALL.md step 2)"
fi
RM_USER=${RM_USER:-root}
ESTANTE_ORIGIN=${ESTANTE_ORIGIN:-https://estantedecifras.app}
ESTANTE_ORIGIN=${ESTANTE_ORIGIN%/}
DEST="$RM_USER@$RM_IP"

for tool in ssh scp curl tar; do
    command -v "$tool" >/dev/null 2>&1 || die "$tool is not installed on this computer; install it, or install the reader by hand (INSTALL.md step 4)"
done
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
say "The tablet is $machine: installing the $ARCH reader from $ESTANTE_ORIGIN."

# 2. The folder and the manifest that names its SHA-256.
fetch() {
    curl --fail --location --silent --show-error -o "$2" "$ESTANTE_ORIGIN/device/$1" ||
        die "could not download $ESTANTE_ORIGIN/device/$1; check this computer's connection and try again. Nothing was changed on the tablet."
}
fetch manifest.json "$WORK/manifest.json"
fetch "$ARCHIVE" "$WORK/$ARCHIVE"

# The manifest without whitespace, one JSON object per line: the line naming
# the archive's path holds its sha256, whichever order the keys are in.
flat=$(tr -d ' \t\r\n' <"$WORK/manifest.json")
want=$(printf '%s\n' "$flat" | tr '{}' '\n\n' | grep -F "\"path\":\"$ARCHIVE\"" |
    sed -n 's/.*"sha256":"\([0-9a-fA-F]*\)".*/\1/p' | head -n 1 | tr 'A-F' 'a-f') || true
got=$(sha256 "$WORK/$ARCHIVE")
if [ -z "$want" ] || [ "$want" != "$got" ]; then
    die "the download does not match the site's manifest ($ARCHIVE); try again in a few minutes, the site may be mid-deploy. Nothing was changed on the tablet."
fi
# The payload's version: the top-level key, once every nested object (the
# backends' own versions among them) is removed, innermost first.
version=$(printf '%s\n' "$flat" | sed 's/^{//; s/}$//' |
    sed -e ':a' -e 's/{[^{}]*}//' -e 'ta' |
    sed -n 's/.*"version":"\([^"]*\)".*/\1/p')
version=${version:-unknown}

# 3. Unpacked here: the tablet needs no tar.
mkdir "$WORK/unpacked"
tar -x -z -f "$WORK/$ARCHIVE" -C "$WORK/unpacked" ||
    die "could not unpack $ARCHIVE; try again. Nothing was changed on the tablet."
if [ ! -f "$WORK/unpacked/estante/manifest.json" ] || [ ! -x "$WORK/unpacked/estante/backend/entry" ]; then
    die "$ARCHIVE does not hold estante/manifest.json and an executable estante/backend/entry. Nothing was changed on the tablet."
fi

# 4. Copied to a staging folder outside AppLoad's directory, so a Reload in
# the middle of the copy never lists a half-copied app.
ready=$(remote "if [ -d $APPLOAD_PARENT ]; then rm -rf $STAGING_DIR && echo ready; else echo no-appload; fi") ||
    die "lost the connection to the tablet; try again. Nothing was changed in AppLoad's directory."
if [ "$ready" != ready ]; then
    die "$APPLOAD_PARENT is not on the tablet: install xovi and AppLoad first (INSTALL.md step 3). Nothing was changed."
fi
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
for p in /proc/[0-9]*; do
    exe=\$(readlink \"\$p/exe\" 2>/dev/null) || continue
    if [ \"\$exe\" = $PREVIOUS_DIR/backend/entry ]; then
        kill \"\${p#/proc/}\" 2>/dev/null || true
    fi
done"
kept=$(remote "$swap") ||
    die "the swap on the tablet failed; check $APPLOAD_DIR and $PREVIOUS_DIR with ssh $DEST ls /home/root/xovi/exthome (INSTALL.md step 7)"

# 6. What was installed, and the next step.
say "Installed the $ARCH reader, version $version, at $APPLOAD_DIR."
if [ "$kept" = kept ]; then
    say "The previous install is kept at $PREVIOUS_DIR."
else
    say "There was no previous install."
fi
say "Next: on the tablet, open AppLoad and press Reload; Estante is listed."
