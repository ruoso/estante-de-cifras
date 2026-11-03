#!/usr/bin/env python3
"""screenshot.py — the reMarkable 2's screen as a PNG, from a raw dump.

screenshot.sh dumps, over ssh, the memory mapping xochitl keeps right after
its /dev/fb0 mapping (/proc/<xochitl>/mem). On reMarkable OS 3.x the screen
is a 1404 x 1872 frame of 32-bit BGRA pixels in it, at an offset that is not
fixed; what comes before the frame has alpha 0, the frame alpha 255 (seen on
OS 3.29). So the frame is the 1404 x 1872 pixels from the first opaque one,
written in grey, as the e-ink shows it.

    python3 screenshot.py DUMP OUT.png

It needs Pillow and NumPy. Nothing in it is the reader's: it reads whatever
the tablet shows.
"""

import sys

import numpy as np
from PIL import Image

W, H = 1404, 1872


def main(dump, out):
    raw = np.frombuffer(open(dump, "rb").read(), dtype=np.uint8)
    px = raw[: len(raw) // 4 * 4].reshape(-1, 4)
    opaque = np.flatnonzero(px[:, 3] == 255)
    if len(opaque) == 0:
        sys.exit("screenshot: no opaque pixel in the dump; is this reMarkable OS 3.x on an rM2?")
    start = int(opaque[0])
    if start + W * H > len(px):
        sys.exit(f"screenshot: the frame from pixel {start} runs past the dump's {len(px)} pixels")
    frame = px[start : start + W * H].reshape(H, W, 4)
    grey = (0.114 * frame[..., 0] + 0.587 * frame[..., 1] + 0.299 * frame[..., 2]).astype(np.uint8)
    Image.fromarray(grey).save(out)
    print(f"screenshot: {out}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: screenshot.py DUMP OUT.png")
    main(sys.argv[1], sys.argv[2])
