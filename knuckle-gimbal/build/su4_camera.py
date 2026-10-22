# Step 4. Camera: phone upright, seen from the grip side and a little behind (the web viewer's home view).
MM = 1/25.4
ok = len([g for g in model.get_entities().get_groups() if g.get_name() == "Knuckle"]) == 1
if ok:
    # same angle as the web viewer: phone upright (model +y up), seen from the grip side and a little behind
    ex, ey, ez = 0.845, 0.267, 0.461
    l = math.sqrt(ex * ex + ey * ey + ez * ez); ex, ey, ez = ex / l, ey / l, ez / l
    tx, ty, tz = 24.0 * MM, 0.0, 2.0 * MM
    pts = [(x * MM, y * MM, z * MM) for x in (-39.0, 84.0) for y in (-81.7, 81.7) for z in (-28.3, 27.7)]
    upx, upy, upz = 0.0, 1.0, 0.0
    # right = up x forward-ish; build an orthonormal frame around the view direction
    fx, fy, fz = -ex, -ey, -ez
    rx, ry, rz = fy * upz - fz * upy, fz * upx - fx * upz, fx * upy - fy * upx
    rl = math.sqrt(rx * rx + ry * ry + rz * rz); rx, ry, rz = rx / rl, ry / rl, rz / rl
    ux, uy, uz = ry * fz - rz * fy, rz * fx - rx * fz, rx * fy - ry * fx
    fov = 30.0; t = math.tan(math.radians(fov / 2))
    dist = 0.0
    for (x, y, z) in pts:
        dx, dy, dz = x - tx, y - ty, z - tz
        h = abs(dx * rx + dy * ry + dz * rz); v = abs(dx * ux + dy * uy + dz * uz); dpt = dx * fx + dy * fy + dz * fz
        dist = max(dist, h / t + dpt, v / t + dpt)
    dist *= 1.06
    cam = Camera(); cam.set_orientation(SUPoint3D(tx + dist * ex, ty + dist * ey, tz + dist * ez), SUPoint3D(tx, ty, tz), SUVector3D(ux, uy, uz))
    cam.enable_perspective(); cam.set_perspective_frustum_fov(fov); model.set_camera(cam)
result = {"model_alive": ok}
