"""Vectorize the Keew mark from the supplied raster (white-on-black PNG)."""
import sys, json
from PIL import Image
import numpy as np

def load_mask(path, size=512):
    im = Image.open(path).convert("RGB")
    im = im.resize((size, size), Image.LANCZOS)
    a = np.asarray(im).astype(np.int16)
    # white-ish pixels = the mark
    mask = (a.mean(axis=2) > 110)
    return mask

def trace_contours(mask):
    """Moore-neighbour boundary tracing over connected components."""
    h, w = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    comps = []
    # 8-connectivity flood fill
    from collections import deque
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not visited[y, x]:
                q = deque([(y, x)]); visited[y, x] = True; pix = []
                while q:
                    cy, cx = q.popleft(); pix.append((cy, cx))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not visited[ny, nx]:
                                visited[ny, nx] = True; q.append((ny, nx))
                if len(pix) > h * w * 0.001:
                    comps.append(pix)
    comps.sort(key=len, reverse=True)
    return comps[:6]

def boundary_of(comp, mask):
    """Ordered boundary points of a component via edge midpoint marching."""
    pts = set(comp)
    # collect boundary pixels (4-neighbour exposed)
    boundary = []
    for (y, x) in comp:
        for dy, dx in ((-1,0),(1,0),(0,-1),(0,1)):
            ny, nx = y+dy, x+dx
            if (ny, nx) not in pts:
                boundary.append((y, x)); break
    if not boundary:
        return []
    bset = set(boundary)
    start = boundary[0]
    ordered = [start]
    cur = start
    prev = None
    for _ in range(len(boundary) * 4):
        cy, cx = cur
        best = None
        for dy in (-1,0,1):
            for dx in (-1,0,1):
                if dy == 0 and dx == 0: continue
                ny, nx = cy+dy, cx+dx
                if (ny, nx) in bset and (ny, nx) != prev:
                    # prefer clockwise-ish continuation
                    if best is None:
                        best = (ny, nx)
        if best is None: break
        prev, cur = cur, best
        if cur == start: break
        ordered.append(cur)
    return ordered

def rdp(points, eps):
    if len(points) < 3: return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dmax, idx = 0.0, 0
    for i in range(1, len(points)-1):
        x0, y0 = points[i]
        num = abs((y2-y1)*x0 - (x2-x1)*y0 + x2*y1 - y2*x1)
        den = ((y2-y1)**2 + (x2-x1)**2) ** 0.5 or 1e-9
        d = num / den
        if d > dmax: dmax, idx = d, i
    if dmax > eps:
        return rdp(points[:idx+1], eps)[:-1] + rdp(points[idx:], eps)
    return [points[0], points[-1]]

def catmull_to_path(pts, close=True):
    n = len(pts)
    d = f"M {pts[0][0]:.2f} {pts[0][1]:.2f} "
    rng = range(n) if close else range(n-1)
    for i in rng:
        p0 = pts[(i-1) % n]; p1 = pts[i]; p2 = pts[(i+1) % n]; p3 = pts[(i+2) % n]
        c1 = (p1[0] + (p2[0]-p0[0])/6.0, p1[1] + (p2[1]-p0[1])/6.0)
        c2 = (p2[0] - (p3[0]-p1[0])/6.0, p2[1] - (p3[1]-p1[1])/6.0)
        d += f"C {c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f} "
    return d + ("Z" if close else "")

def build(src, out_svg, size=512, eps=1.6, pad=0):
    mask = load_mask(src, size)
    comps = trace_contours(mask)
    paths = []
    for comp in comps:
        b = boundary_of(comp, mask)
        if len(b) < 20: continue
        b = [(float(x), float(y)) for (y, x) in b]
        simp = rdp(b, eps)
        if len(simp) < 6: continue
        paths.append(catmull_to_path(simp))
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" fill="currentColor">'
           + "".join(f'<path d="{p}"/>' for p in paths) + "</svg>")
    open(out_svg, "w").write(svg)
    print(f"{out_svg}: {len(paths)} shapes, {len(svg)} bytes")

if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
