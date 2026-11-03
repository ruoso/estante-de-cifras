#!/bin/sh
# screenshot.sh — a PNG of what the reMarkable 2 shows, over SSH.
#
#   RM_IP=<address> ./screenshot.sh out.png
#
# RM_IP   the tablet's address (10.11.99.1 over USB); required.
# RM_USER the login on the tablet; default root.
#
# The rM2 has no framebuffer to read: xochitl draws the e-ink itself and
# keeps the screen as a frame in its own memory, in the mapping right after
# its /dev/fb0 one. This copies that mapping out of /proc/<xochitl>/mem —
# reading, never writing; nothing on the tablet changes — and screenshot.py
# finds the 1404 x 1872 frame in it. A development tool: for the README's
# pictures, and for looking at a layout on the device.
#
# Needs here: ssh, python3 with Pillow and NumPy. On the tablet: sh, pidof,
# grep, sed, dd, gzip (BusyBox has them).

set -eu

die() { printf 'screenshot.sh: %s\n' "$*" >&2; exit 1; }

[ $# -eq 1 ] || die "usage: RM_IP=<address> $0 out.png"
[ -n "${RM_IP:-}" ] || die "set RM_IP to the tablet's address (10.11.99.1 over USB)"
out=$1
here=$(cd "$(dirname "$0")" && pwd)

tmp=$(mktemp "${TMPDIR:-/tmp}/rm-screen.XXXXXX")
trap 'rm -f "$tmp"' EXIT

# BusyBox dd has no iflag=skip_bytes: the mapping starts on a page, so it is
# read whole, in pages.
ssh "${RM_USER:-root}@$RM_IP" '
    pid=$(pidof xochitl) || { echo "xochitl is not running" >&2; exit 1; }
    line=$(grep -A1 /dev/fb0 /proc/$pid/maps | tail -n 1)
    start=$(printf "%s\n" "$line" | sed "s/-.*//")
    end=$(printf "%s\n" "$line" | sed "s/^[^-]*-//; s/ .*//")
    dd if=/proc/$pid/mem bs=4096 skip=$((0x$start / 4096)) count=$(((0x$end - 0x$start) / 4096)) 2>/dev/null | gzip -1
' | gzip -d > "$tmp" || die "could not read the screen from the tablet"

python3 "$here/screenshot.py" "$tmp" "$out"
