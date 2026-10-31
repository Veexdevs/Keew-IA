"""
Keew IA — brand asset pipeline.

Source of truth: the designer's 1254x1254 PNGs (blue #004CFD mark on black).
Produces: vector mark SVG, favicons, PWA icons, app icons for every platform,
plus a monochrome mark for themeable UI use.

Usage:  python3 tools/build_brand.py
Reads:  brand/source/*.png
Writes: brand/mark.svg, brand/mark-mono.svg, brand/png/*, public/*, dist/icons/*
"""
from __future__ import annotations

import os
import subprocess

import numpy as np
import potrace
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "brand", "source")
OUT = os.path.join(ROOT, "brand")
PUBLIC = os.path.join(ROOT, "public")
BLUE = "#004CFD"          # sampled brand blue
S = 1254                  # source canvas


# --------------------------------------------------------------------- vector
def _curve_path(curve) -> str:
    parts = [f"M{curve.start_point.x:.1f},{curve.start_point.y:.1f}"]
    for seg in curve.segments:
        if seg.is_corner:
            c, e = seg.c, seg.end_point
            parts.append(f"L{c.x:.1f},{c.y:.1f}L{e.x:.1f},{e.y:.1f}")
        else:
            c1, c2, e = seg.c1, seg.c2, seg.end_point
            parts.append(f"C{c1.x:.1f},{c1.y:.1f} {c2.x:.1f},{c2.y:.1f} {e.x:.1f},{e.y:.1f}")
    parts.append("Z")
    return "".join(parts)


def _bbox_of_curve(curve):
    xs = [curve.start_point.x] + [s.end_point.x for s in curve.segments]
    ys = [curve.start_point.y] + [s.end_point.y for s in curve.segments]
    return min(xs), min(ys), max(xs), max(ys)


def trace_mark(mask: np.ndarray):
    """Vectorise the mark, dropping the artwork frame and any dust specks."""
    bmp = potrace.Bitmap(np.ascontiguousarray(mask))
    paths = bmp.trace(turdsize=10, alphamax=1.0, opticurve=True, opttolerance=0.2)
    keep = []
    for curve in paths:
        x0, y0, x1, y1 = _bbox_of_curve(curve)
        w, h = x1 - x0, y1 - y0
        if w * h > S * S * 0.92:        # canvas frame
            continue
        if w * h < S * S * 0.01:        # dust speck
            continue
        keep.append((x0, y0, x1, y1, _curve_path(curve)))
    if not keep:
        raise SystemExit("trace failed: no mark found")
    d = "".join(k[4] for k in keep)
    x0 = min(k[0] for k in keep); y0 = min(k[1] for k in keep)
    x1 = max(k[2] for k in keep); y1 = max(k[3] for k in keep)
    return d, (x0, y0, x1, y1)


def mark_mask(path: str) -> np.ndarray:
    """Blue ink only — ignores white, black and mid-grey backgrounds."""
    im = Image.open(path).convert("RGB").resize((S, S), Image.LANCZOS)
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (b - r > 90) & (b > 120)


def bbox(mask: np.ndarray):
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


# --------------------------------------------------------------------- raster
def make_renderer(mask: np.ndarray):
    alpha = Image.fromarray((mask * 255).astype("uint8"))

    def render(mark_hex, bg_hex, size, radius_pct=0.0, tight=False, margin=0.05, out=None):
        """Render from the master mask so every icon is pixel-identical to the artwork.

        tight=False keeps the designer's original padding (used for app icons).
        tight=True crops to the glyph with `margin` breathing room (used for marks).
        """
        # Every icon is composed from the glyph's own bounding box. The artwork's
        # original canvas is asymmetric (more air on top than at the bottom), so
        # trusting it made the mark sit high and touch the bottom edge on small
        # icons. Cropping to the glyph and re-padding symmetrically fixes that.
        gx0, gy0, gx1, gy1 = ink_bbox()
        gw, gh = gx1 - gx0, gy1 - gy0
        # the glyph's longest side + symmetric breathing room = final square
        side_box = int(round(max(gw, gh) * (1 + 2 * margin)))
        src_a = Image.new("L", (side_box, side_box), 0)
        # paste by the glyph's centre so left == right and top == bottom
        src_a.paste(alpha.crop((gx0, gy0, gx1, gy1)), ((side_box - gw) // 2, (side_box - gh) // 2))
        _ = tight
        canvas = Image.new("RGBA", src_a.size, bg_hex if bg_hex else (0, 0, 0, 0))
        if mark_hex:
            layer = Image.new("RGBA", src_a.size, mark_hex)
            layer.putalpha(src_a)
            canvas = Image.alpha_composite(canvas, layer)
        img = canvas.resize((size, size), Image.LANCZOS)
        if radius_pct:
            ss = 4
            m = Image.new("L", (size * ss, size * ss), 0)
            ImageDraw.Draw(m).rounded_rectangle(
                [0, 0, size * ss - 1, size * ss - 1], radius=int(size * ss * radius_pct), fill=255
            )
            m = m.resize((size, size), Image.LANCZOS)
            img.putalpha(Image.composite(img.getchannel("A"), Image.new("L", (size, size), 0), m))
        if out:
            os.makedirs(os.path.dirname(out), exist_ok=True)
            img.save(out)
        return img

    def ink_bbox(threshold_frac=0.004, min_run=3):
        """Bounding box of the *real* artwork.

        The source PNG carries a few stray noise pixels (one lit pixel at y=129,
        while the glyph starts at y=245). A naive bbox includes them and pushes
        the whole mark upward in every generated icon, which is exactly what made
        the logo look cropped. We require a minimum amount of ink per row/column
        before considering it part of the glyph.
        """
        rows = mask.sum(axis=1)
        cols = mask.sum(axis=0)
        row_thr = max(2, int(mask.shape[1] * threshold_frac))
        col_thr = max(2, int(mask.shape[0] * threshold_frac))
        strong_rows = np.nonzero(rows >= row_thr)[0]
        strong_cols = np.nonzero(cols >= col_thr)[0]
        # require `min_run` consecutive qualifying rows/cols so a lone cluster fails
        def span(idx):
            best = (int(idx[0]), int(idx[0]))
            start = prev = int(idx[0])
            for v in idx[1:]:
                v = int(v)
                if v != prev + 1:
                    if prev - start + 1 > best[1] - best[0]:
                        best = (start, prev)
                    start = v
                prev = v
            if prev - start + 1 > best[1] - best[0]:
                best = (start, prev)
            return best
        y0, y1 = span(strong_rows)
        x0, x1 = span(strong_cols)
        if y1 - y0 < min_run or x1 - x0 < min_run:
            return bbox(mask)
        return x0, y0, x1 + 1, y1 + 1

    return render


# ----------------------------------------------------------------------- main
def main() -> None:
    for d in ("brand/png", "public/icons", "dist/icons", "apps/mobile/resources"):
        os.makedirs(os.path.join(ROOT, d), exist_ok=True)

    # white-on-black artwork gives a clean silhouette (no background ambiguity)
    im = Image.open(os.path.join(SRC, "logo-white-on-black.png")).convert("RGB").resize((S, S))
    mask = np.asarray(im).astype(np.int16).mean(axis=2) > 128
    assert mask.mean() < 0.5, "logo mask looks wrong"

    # --- vector marks ------------------------------------------------------
    d, (x0, y0, x1, y1) = trace_mark(mask)
    pad = int((x1 - x0) * 0.035)
    vb = f"{x0 - pad} {y0 - pad} {(x1 - x0) + 2 * pad} {(y1 - y0) + 2 * pad}"
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Keew IA">'
           f'<path d="{d}" fill="{BLUE}"/></svg>')
    mono = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Keew IA">'
            f'<path d="{d}" fill="currentColor"/></svg>')
    open(os.path.join(OUT, "mark.svg"), "w").write(svg)
    open(os.path.join(OUT, "mark-mono.svg"), "w").write(mono)

    W, K = "#FFFFFF", "#000000"
    render = make_renderer(mask)

    # --- app icons (designer padding preserved) ----------------------------
    icon_jobs = [
        (W, BLUE, 512, 0.225, "app-icon-512.png"),
        (W, BLUE, 1024, 0.225, "app-icon-1024.png"),
        (W, BLUE, 192, 0.225, "android-192.png"),
        (W, BLUE, 180, 0.225, "apple-touch-icon.png"),
        (W, BLUE, 256, 0.225, "windows-256.png"),
        (W, BLUE, 512, 0.0, "maskable-512.png"),      # mark sits in the safe zone already
        (W, BLUE, 48, 0.225, "favicon-48.png"),
        (W, BLUE, 32, 0.225, "favicon-32.png"),
        (W, BLUE, 16, 0.225, "favicon-16.png"),
        (BLUE, None, 512, 0.0, "mark-blue-512.png"),
        (W, None, 512, 0.0, "mark-white-512.png"),
        (K, None, 512, 0.0, "mark-black-512.png"),
        (BLUE, W, 512, 0.0, "mark-blue-on-white-512.png"),
    ]
    for mark_hex, bg, size, radius, name in icon_jobs:
        # app tiles get the glyph at ~72% so it reads at 48px, marks stay tight
        render(mark_hex, bg, size, radius, tight=(bg is None or size <= 48 or radius > 0),
               margin=0.16, out=os.path.join(OUT, "png", name))

    # tight marks for in-app use
    for mark_hex, name in ((BLUE, "mark-tight-blue.png"), (W, "mark-tight-white.png")):
        render(mark_hex, None, 512, 0.0, tight=True, margin=0.02,
               out=os.path.join(OUT, "png", name))

    # --- public assets -----------------------------------------------------
    for name in ("app-icon-512.png", "app-icon-1024.png", "maskable-512.png",
                 "android-192.png", "apple-touch-icon.png", "favicon-32.png"):
        Image.open(os.path.join(OUT, "png", name)).save(os.path.join(PUBLIC, "icons", name))
    open(os.path.join(PUBLIC, "mark.svg"), "w").write(svg)
    open(os.path.join(PUBLIC, "mark-mono.svg"), "w").write(mono)
    render(W, BLUE, 256, 0.225, tight=True, margin=0.16, out=os.path.join(PUBLIC, "icon.png"))

    ico_srcs = [os.path.join(OUT, "png", f"favicon-{s}.png") for s in (16, 32, 48)]
    subprocess.run(["convert", *ico_srcs, os.path.join(PUBLIC, "favicon.ico")], check=True)

    # --- desktop / electron ------------------------------------------------
    render(W, BLUE, 1024, 0.225, tight=True, margin=0.16, out=os.path.join(ROOT, "dist/icons", "icon.png"))
    subprocess.run(["convert", *ico_srcs, os.path.join(ROOT, "dist/icons", "icon.ico")], check=True)
    for size in (16, 32, 48, 64, 128, 256, 512):
        render(W, BLUE, size, 0.225, tight=True, margin=0.16, out=os.path.join(ROOT, "dist/icons", f"{size}x{size}.png"))
    # electron-builder reads apps/desktop/build
    render(W, BLUE, 1024, 0.225, tight=True, margin=0.16,
           out=os.path.join(ROOT, "apps/desktop/build/icon.png"))

    # --- capacitor (android / ios) -----------------------------------------
    res = os.path.join(ROOT, "apps/mobile/resources")
    render(W, BLUE, 1024, 0.225, tight=True, margin=0.16, out=os.path.join(res, "icon.png"))
    render(W, BLUE, 2732, 0.0, out=os.path.join(res, "splash.png"))
    render(W, BLUE, 2732, 0.0, out=os.path.join(res, "splash-dark.png"))

    # --- open graph card ---------------------------------------------------
    og = Image.new("RGB", (1200, 630), "#050505")
    grad = Image.new("L", (1200, 630))
    grad.putdata(np.tile(np.linspace(0, 255, 1200).astype("uint8"), 630).tolist())
    og = Image.composite(Image.new("RGB", (1200, 630), "#0a1c45"), og, grad.point(lambda v: int(v * 0.6)))
    mark_img = Image.open(os.path.join(OUT, "png", "mark-white-512.png")).convert("RGBA").resize((280, 280), Image.LANCZOS)
    og.paste(mark_img, (460, 175), mark_img)
    og.save(os.path.join(PUBLIC, "og.png"))
    og.save(os.path.join(OUT, "png", "og.png"))

    # --- report ------------------------------------------------------------
    print("mark.svg", os.path.getsize(os.path.join(OUT, "mark.svg")), "bytes | viewBox", vb)
    print("mark bbox px", x0, y0, x1, y1, "-> mark occupies",
          str(round((x1 - x0) / S * 100, 1)) + "% of the canvas")


if __name__ == "__main__":
    main()
