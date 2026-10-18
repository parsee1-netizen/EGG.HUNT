#!/usr/bin/env python3
"""Draw the EggDrop app icons. No third-party imaging libraries."""

import struct
import zlib
from pathlib import Path


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, size: int, rgba: bytes) -> None:
    raw = b"".join(b"\x00" + rgba[y * size * 4 : (y + 1) * size * 4] for y in range(size))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def blend(dst: bytearray, i: int, r: int, g: int, b: int, a: int) -> None:
    if a <= 0:
        return
    if a >= 255:
        dst[i : i + 4] = bytes((r, g, b, 255))
        return
    src_a = a / 255
    dst_a = dst[i + 3] / 255
    out_a = src_a + dst_a * (1 - src_a)
    if out_a == 0:
        return
    for channel, value in enumerate((r, g, b)):
        dst[i + channel] = int((value * src_a + dst[i + channel] * dst_a * (1 - src_a)) / out_a)
    dst[i + 3] = int(out_a * 255)


def draw(size: int, padding: float) -> bytes:
    pixels = bytearray(size * size * 4)
    # Warm background so the icon stays readable when the OS masks it to a circle.
    bg = (255, 248, 231, 255)
    for i in range(0, len(pixels), 4):
        pixels[i : i + 4] = bytes(bg)

    cx = (size - 1) / 2
    cy = size * 0.52
    rx = size * (0.28 - padding)
    ry = size * (0.36 - padding)
    for y in range(size):
        for x in range(size):
            ny = (y - cy) / ry
            nx = (x - cx) / rx
            taper = 1 - 0.22 * max(0, -ny)
            if taper <= 0:
                continue
            egg = (nx / taper) ** 2 + ny ** 2
            if egg > 1:
                continue
            # Yolk-yellow body, lighter toward the top.
            light = max(0, 1 - (ny + 0.2))
            r = int(244 + (255 - 244) * min(1, light * 0.7))
            g = int(169 + (249 - 169) * min(1, light))
            b = int(0 + 220 * min(1, light * 0.45))
            # Soft edge.
            edge = 1 if egg < 0.92 else int(255 * (1 - egg) / 0.08)
            blend(pixels, (y * size + x) * 4, r, g, b, edge)

            # Pink-and-white ribbon across the middle of the egg.
            ribbon = abs((y - cy) / size - 0.02)
            if ribbon < 0.035 and egg < 0.9:
                stripe = int(((x / size) * 18) % 2)
                if stripe == 0:
                    blend(pixels, (y * size + x) * 4, 232, 93, 117, 230)
                else:
                    blend(pixels, (y * size + x) * 4, 255, 255, 255, 230)

    # Specular highlight.
    hx, hy, hr = cx - rx * 0.35, cy - ry * 0.45, size * 0.06
    for y in range(size):
        for x in range(size):
            if (x - hx) ** 2 + (y - hy) ** 2 <= hr ** 2:
                blend(pixels, (y * size + x) * 4, 255, 255, 255, 170)

    return bytes(pixels)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out = root / "public" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    write_png(out / "icon-192.png", 192, draw(192, 0))
    write_png(out / "icon-512.png", 512, draw(512, 0))
    write_png(out / "icon-maskable.png", 512, draw(512, 0.08))
    apple = draw(180, 0)
    write_png(out / "apple-touch-icon.png", 180, apple)
    write_png(root / "public" / "apple-touch-icon.png", 180, apple)


if __name__ == "__main__":
    main()
