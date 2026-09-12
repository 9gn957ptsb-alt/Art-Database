#!/usr/bin/env python3
"""Isometric core: voxel models projected to pixels, in 2:1 dimetric.

Every object in this project was a 2D grid of cells. Isometric makes that
impossible — a thing seen from a corner has three visible faces, and which face
a pixel belongs to decides its colour. So an object becomes a VOXEL MODEL, and
the renderer projects it.

Projection is 2:1 dimetric, which is what pixel art means by "isometric". True
30-degree isometry puts edges at 1.732 px across per pixel down, and no integer
step follows that line, so every edge frays into ragged stairs. 2:1 steps
exactly two across for one down: unbroken edges at any size. The angle is
26.565 degrees, not 30, and that is the right choice, not an approximation.

    screen_x = (x - y) * HALF
    screen_y = (x + y) * (HALF / 2) - z * ZSTEP

Shading falls out of the projection for free, and it maps onto the existing
palette machinery exactly. A voxel carries one material — an index into a ramp —
and each of its three faces offsets that index by a fixed amount: the top face
catches the light, the left face is the mid tone, the right face turns away.
One material, three slots, and `slot_cycle` backs every slot with real colours
from the collection exactly as it already does.

Draw order is the painter's algorithm on (x + y + z): a voxel further along all
three axes is nearer the viewer and is drawn later.

Nothing here knows about any particular object. It is the projection, the
rasteriser, and the deformations that animation needs.
"""

import math

# A voxel is HALF*2 pixels wide. The top face is HALF tall, the sides ZSTEP.
# ZSTEP == HALF makes a voxel read as a cube rather than as a slab.
#
# HALF MUST BE EVEN. The rhombus needs its exact half-height, and at an odd HALF
# integer division truncates it — 3//2 is 1 where the geometry wants 1.5. The
# faces then fail to tile, and every gap between them is a hole straight through
# to the back of the model. That was not visible on a cube, where neighbours
# cover the gaps, and obvious on a sphere, which came out striped.
HALF = 4
ZSTEP = 4

FACE_TOP, FACE_LEFT, FACE_RIGHT = 0, 1, 2

# Shading is per VOXEL, from its surface normal — not per face.
#
# Shading by face alone is what a cube wants: three flat tones, one per
# orientation. On a curved body it is wrong. A voxel sphere is a stack of
# terraces, so every ring exposes a lit top face directly above a dark side
# face, and the surface combs itself into ridges that read as noise. Taking the
# tone from the direction the surface actually points makes the ramp run
# smoothly around the form, and the terracing becomes the pixel steps of a
# gradient rather than a corduroy texture.
#
# No face delta at all. The normal already carries orientation — on a solid
# cube, top voxels normal to +z and side voxels normal to +x get different tones
# without any help. Adding a per-face darkening on top of it stacks with an
# already-dark normal on the shadowed side of a curve, and every terrace step
# there turns into a black sliver: a picket fence down the dark half of the ball.
FACE_DELTA = {FACE_TOP: 0, FACE_LEFT: 0, FACE_RIGHT: 0}
SPEC_OFFSET = +2
# Upper LEFT of the screen, which is not what it looks like in world terms.
# -x projects up-and-left, -y projects up-and-right; a light at (-1,-1,+1) is
# therefore straight overhead on screen and bands the form in flat horizontal
# stripes. Tilting toward -x and away from -y swings it to the upper left.
LIGHT = (-0.62, 0.18, 0.76)
SHADE_RANGE = 2                   # ramp steps either side of the material tone


def project(x, y, z):
    """Voxel coordinate to the screen position of its top-face apex."""
    return (x - y) * HALF, (x + y) * (HALF / 2.0) - z * ZSTEP


def cube_faces(sx, sy):
    """The three visible faces of one cube, as screen-space polygons.

    The top face is a 2:1 rhombus; the two side faces are parallelograms
    hanging off its lower edges. Coordinates are relative to the apex returned
    by `project`, which sits at the rhombus's top corner.
    """
    w, h, d = HALF, HALF / 2.0, ZSTEP      # half-width, half-height, side depth
    top = [(sx, sy), (sx + w, sy + h), (sx, sy + 2 * h), (sx - w, sy + h)]
    left = [(sx - w, sy + h), (sx, sy + 2 * h), (sx, sy + 2 * h + d), (sx - w, sy + h + d)]
    right = [(sx, sy + 2 * h), (sx + w, sy + h), (sx + w, sy + h + d), (sx, sy + 2 * h + d)]
    return ((FACE_TOP, top), (FACE_LEFT, left), (FACE_RIGHT, right))


def fill_polygon(grid, poly, value, cols, rows):
    """Scanline fill, half-open on the right edge.

    Half-open matters: adjacent faces share an edge, and filling both sides of
    it closed leaves a one-pixel seam of whichever was drawn last running down
    every join in the model.
    """
    ys = [p[1] for p in poly]
    y0, y1 = max(0, int(math.floor(min(ys)))), min(rows - 1, int(math.ceil(max(ys))))
    n = len(poly)
    for y in range(y0, y1 + 1):
        centre = y + 0.5
        xs = []
        for i in range(n):
            (ax, ay), (bx, by) = poly[i], poly[(i + 1) % n]
            if (ay <= centre < by) or (by <= centre < ay):
                xs.append(ax + (centre - ay) / (by - ay) * (bx - ax))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            for x in range(max(0, int(math.ceil(xs[i] - 0.5))),
                           min(cols - 1, int(math.floor(xs[i + 1] - 0.5))) + 1):
                grid[y * cols + x] = value


def normals(voxels, known=None):
    """A surface normal per voxel, summed from the directions that are open.

    Derived from the model rather than from the primitive that made it, so it
    works for anything hand-placed and stays correct after a deformation. But it
    can only ever point in one of twenty-six directions, which bands a smooth
    body into patches — so a primitive that knows its own analytic normal passes
    it in as `known` and that is used instead.
    """
    if known:
        out = dict(known)
    else:
        out = {}
    dirs = ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))
    for (x, y, z) in voxels:
        if (x, y, z) in out:
            continue
        nx = ny = nz = 0.0
        for dx, dy, dz in dirs:
            if (x + dx, y + dy, z + dz) not in voxels:
                nx += dx; ny += dy; nz += dz
        length = math.sqrt(nx * nx + ny * ny + nz * nz)
        out[(x, y, z)] = (nx / length, ny / length, nz / length) if length else (0.0, 0.0, 1.0)
    return out


def shade(normal):
    """Ramp offset for a surface pointing this way, from -SHADE_RANGE to +."""
    d = normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2]
    return int(round(d * SHADE_RANGE))


def bounds(voxels):
    """Screen extent of a voxel set, so a model can be centred in its frame."""
    xs, ys = [], []
    for (x, y, z) in voxels:
        sx, sy = project(x, y, z)
        xs += [sx - HALF, sx + HALF]
        ys += [sy, sy + HALF + ZSTEP]
    return min(xs), min(ys), max(xs), max(ys)


def render(voxels, cols, rows, ox, oy, shadow=None, known_normals=None):
    """Rasterise a voxel model into a grid of ramp indices; -1 is a hole.

    `voxels` maps (x, y, z) -> (material, specular). Drawn back to front by
    (x + y + z), so nearer voxels overwrite further ones. No depth buffer is
    needed: the painter's order is exact for axis-aligned cubes on a grid.
    """
    grid = [-1] * (cols * rows)

    if shadow:
        for (sx, sy), slot in shadow:
            h = HALF / 2.0
            fill_polygon(grid, [(sx + ox, sy + oy), (sx + HALF + ox, sy + h + oy),
                                (sx + ox, sy + 2 * h + oy), (sx - HALF + ox, sy + h + oy)],
                         slot, cols, rows)

    # Only three faces of a cube can ever face the viewer: +z, +x and +y.
    # Each is drawn only when nothing occupies the cell it faces. Drawing all
    # three for every surface voxel stripes a curved body with slivers of
    # interior face — which is what made the first solid read as corduroy.
    neighbour = {FACE_TOP: (0, 0, 1), FACE_RIGHT: (1, 0, 0), FACE_LEFT: (0, 1, 0)}
    norm = normals(voxels, known_normals)
    for (x, y, z) in sorted(voxels, key=lambda v: (v[0] + v[1] + v[2], v[2])):
        material, spec = voxels[(x, y, z)]
        lit = material + shade(norm[(x, y, z)])
        sx, sy = project(x, y, z)
        for face, poly in cube_faces(sx + ox, sy + oy):
            dx, dy, dz = neighbour[face]
            if (x + dx, y + dy, z + dz) in voxels:
                continue
            slot = material + SPEC_OFFSET if (spec and face == FACE_TOP) else lit + FACE_DELTA[face]
            fill_polygon(grid, poly, slot, cols, rows)
    return grid


# --------------------------------------------------------------- solids

def ellipsoid_normals(rx, ry, rz, centre=(0, 0, 0)):
    """Analytic normals for an ellipsoid: the gradient of its own equation."""
    cx, cy, cz = centre
    out = {}
    for x in range(-int(rx) - 1, int(rx) + 2):
        for y in range(-int(ry) - 1, int(ry) + 2):
            for z in range(-int(rz) - 1, int(rz) + 2):
                if (x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2 > 1.0:
                    continue
                gx, gy, gz = x / (rx * rx), y / (ry * ry), z / (rz * rz)
                length = math.sqrt(gx * gx + gy * gy + gz * gz)
                if length:
                    out[(x + cx, y + cy, z + cz)] = (gx / length, gy / length, gz / length)
    return out


def revolve_normals(profile, centre=(0, 0)):
    """Analytic normals for a solid of revolution: radially out, tilted by how
    fast the profile's radius is changing with height."""
    cx, cy = centre
    by_z = {z: r for z, r in profile}
    out = {}
    for z, radius in profile:
        slope = (by_z.get(z - 1, radius) - by_z.get(z + 1, radius)) / 2.0
        for x in range(-int(radius) - 1, int(radius) + 2):
            for y in range(-int(radius) - 1, int(radius) + 2):
                d = math.sqrt(x * x + y * y)
                if d > radius:
                    continue
                nx, ny = (x / d, y / d) if d else (0.0, 0.0)
                nz = slope if d > radius - 1.5 else 1.0
                length = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
                out[(x + cx, y + cy, z)] = (nx / length, ny / length, nz / length)
    return out


def ellipsoid(rx, ry, rz, material=3, centre=(0, 0, 0)):
    """A voxel ball, built at whatever proportions are wanted.

    Squash and stretch is done by generating the shape at the deformed radii,
    never by remapping a finished voxel set — scaling integer keys rounds
    several of them onto the same cell and punches holes through the surface.
    """
    cx, cy, cz = centre
    out = {}
    for x in range(-int(rx) - 1, int(rx) + 2):
        for y in range(-int(ry) - 1, int(ry) + 2):
            for z in range(-int(rz) - 1, int(rz) + 2):
                if (x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2 > 1.0:
                    continue
                # One specular cluster on the upper-left-far shoulder. Scattered
                # highlights read as noise; a single cluster reads as gloss.
                spec = (z >= rz * 0.55 and x <= -rx * 0.15 and y <= -ry * 0.15)
                out[(x + cx, y + cy, z + cz)] = (material, spec)
    return out


def sphere(radius, material=3, centre=(0, 0, 0)):
    return ellipsoid(radius, radius, radius, material, centre)


def revolve(profile, material=3, centre=(0, 0)):
    """Turn a 2D silhouette profile into a solid of revolution.

    `profile` is a list of (z, radius) — the half-width of the object at each
    height, which is exactly what the amphora and column silhouettes already
    are. A jar is a solid of revolution; so is a column. Lifting them into three
    dimensions costs nothing but this.
    """
    cx, cy = centre
    out = {}
    for z, radius in profile:
        r2 = radius * radius
        lo, hi = -int(radius) - 1, int(radius) + 2
        for x in range(lo, hi):
            for y in range(lo, hi):
                if x * x + y * y <= r2:
                    out[(x + cx, y + cy, z)] = (material, False)
    return out


# NOTE: there is deliberately no shell() here. Hidden voxels are not removed
# ahead of rendering, because `render` culls faces by testing whether the
# neighbouring cell is occupied — and the occupants doing that occluding are
# exactly the interior voxels a shell pass would have deleted. Culling twice,
# in two places, opens every back face of the model straight through the front.
# Interior voxels simply draw nothing, which costs a membership test each.


# --------------------------------------------------------------- deformation

def squash(voxels, sx=1.0, sy=1.0, sz=1.0, floor=0):
    """Scale a model about its footprint, keeping it standing on the floor.

    Squash and stretch is the whole of a bounce. Without it a ball landing is a
    circle that stops, which reads as a bug rather than as an impact.
    """
    out = {}
    for (x, y, z), v in voxels.items():
        key = (int(round(x * sx)), int(round(y * sy)), floor + int(round((z - floor) * sz)))
        out[key] = v
    return out


def rotate(voxels, turns, known=None):
    """Turn a model a quarter at a time about the vertical axis.

    Final Fantasy Tactics' signature was a battlefield you could rotate through
    four views, and in a voxel model that costs nothing: a quarter turn is a
    permutation of x and y, exact at every step, with no resampling and nothing
    to redraw. Hand-drawn isometric sprites cannot do this at all — each facing
    has to be authored separately. It is the one thing this engine gets for free
    that the games it is imitating had to pay for.

    Normals rotate with the model, so analytic shading survives the turn.
    """
    turns %= 4
    if turns == 0:
        return dict(voxels), (dict(known) if known else None)

    def spin(x, y):
        for _ in range(turns):
            x, y = -y, x
        return x, y

    out = {spin(x, y) + (z,): v for (x, y, z), v in voxels.items()}
    spun = None
    if known:
        spun = {}
        for (x, y, z), (nx, ny, nz) in known.items():
            spun[spin(x, y) + (z,)] = spin(nx, ny) + (nz,)
    return out, spun


def contour(grid, cols, rows, slot=0):
    """Darken every drawn cell that touches a hole.

    Every isometric game on the reference list separates a body from the ground
    with a hard dark edge — without one, a shaded form sitting on a shaded floor
    has nothing to read its silhouette against. Traced from the rendered
    silhouette, not computed per row: a per-row edge stacks a dark band down
    every diagonal, which is the same mistake the flat sprites made.
    """
    edge = []
    for y in range(rows):
        for x in range(cols):
            i = y * cols + x
            if grid[i] < 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= cols or ny >= rows or grid[ny * cols + nx] < 0:
                    edge.append(i)
                    break
    for i in edge:
        grid[i] = slot
    return grid


def translate(voxels, dx=0, dy=0, dz=0):
    return {(x + dx, y + dy, z + dz): v for (x, y, z), v in voxels.items()}


def morph(a, b, t):
    """Interpolate between two voxel sets.

    Not a blend — a voxel is present or it is not. Each voxel's own threshold is
    a stable hash of its position, so it appears at the same moment every loop
    and the transformation reads as a dissolve with structure rather than as
    random flicker.
    """
    if t <= 0:
        return dict(a)
    if t >= 1:
        return dict(b)
    out = {}
    for key, v in a.items():
        if key in b or _threshold(key) > t:
            out[key] = b.get(key, v) if key in b else v
    for key, v in b.items():
        if key not in a and _threshold(key) <= t:
            out[key] = v
    return out


def _threshold(key):
    h = (key[0] * 73856093) ^ (key[1] * 19349663) ^ (key[2] * 83492791)
    return ((h & 0xFFFF) / 65535.0)


def ground_shadow(radius, height, centre=(0, 0), slot=0):
    """A flat disc on the floor, shrinking as the object rises.

    The shadow is how height is read at all: in an axonometric projection,
    rising and moving away produce the same pixels. Without it a bounce is
    indistinguishable from sliding backwards.
    """
    cx, cy = centre
    r = max(0.8, radius * max(0.3, 1.0 - height * 0.05))
    out, r2 = [], r * r
    for x in range(-int(r) - 1, int(r) + 2):
        for y in range(-int(r) - 1, int(r) + 2):
            if x * x + y * y <= r2:
                out.append((project(x + cx, y + cy, 0), slot))
    return out


def frame_box(models, pad=2):
    """Canvas big enough for every frame, and the offset that centres them.

    Sizing the canvas by eye clips the tall frames and leaves the short ones
    adrift; it has to come from the union of the whole animation.
    """
    xs0, ys0, xs1, ys1 = [], [], [], []
    for m in models:
        if not m:
            continue
        a, b, c, d = bounds(m)
        xs0.append(a); ys0.append(b); xs1.append(c); ys1.append(d)
    x0, y0, x1, y1 = min(xs0), min(ys0), max(xs1), max(ys1)
    cols, rows = int(x1 - x0) + pad * 2, int(y1 - y0) + pad * 2
    return cols, rows, int(-x0) + pad, int(-y0) + pad
