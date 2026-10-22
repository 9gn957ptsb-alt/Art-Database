# Step 3. Studio style and shadows (the camera set here is replaced by step 4).
MM = 1/25.4
ro = model.get_rendering_options(); si = model.get_shadow_info()
vals = {"EDGE_DISPLAY_MODE": TypedValue(int_value=1), "EDGE_COLOR_MODE": TypedValue(int_value=0), "RENDER_MODE": TypedValue(int_value=2),
    "MODEL_TRANSPARENCY": TypedValue(bool_value=False), "MATERIAL_TRANSPARENCY": TypedValue(bool_value=True),
    "DRAW_DEPTH_QUE": TypedValue(bool_value=False), "DRAW_SILHOUETTES": TypedValue(bool_value=True), "SILHOUETTE_WIDTH": TypedValue(int_value=2),
    "DRAW_HORIZON": TypedValue(bool_value=False), "DRAW_GROUND": TypedValue(bool_value=False), "DISPLAY_SKETCH_AXES": TypedValue(bool_value=False),
    "HIGHLIGHT_COLOR": TypedValue(color_value=SUColor(0, 1, 255, 255)), "LOCKED_COLOR": TypedValue(color_value=SUColor(255, 0, 0, 255)),
    "BACKGROUND_COLOR": TypedValue(color_value=SUColor(214, 216, 218, 255)),
    "FACE_FRONT_COLOR": TypedValue(color_value=SUColor(245, 240, 230, 255)), "FACE_BACK_COLOR": TypedValue(color_value=SUColor(180, 178, 170, 255)),
    "FOREGROUND_COLOR": TypedValue(color_value=SUColor(50, 48, 45, 255)), "AMBIENT_OCCLUSION": TypedValue(bool_value=True),
    "AMBIENT_OCCLUSION_INTENSITY": TypedValue(float_value=0.5), "AMBIENT_OCCLUSION_MULTIPLIER": TypedValue(float_value=1.2)}
applied, skipped = [], []
for k, v in vals.items():
    try: ro[RenderingOptionKey[k]] = v; applied.append(k)
    except Exception: skipped.append(k)
shadow_keys = [k for k in dir(ShadowInfoKey) if not k.startswith("_")]
sh = {"DISPLAY_SHADOWS": TypedValue(bool_value=True), "LIGHT": TypedValue(int_value=80), "DARK": TypedValue(int_value=60),
      "DISPLAY_ON_GROUND_PLANE": TypedValue(bool_value=False), "DISPLAY_ON_ALL_FACES": TypedValue(bool_value=True)}
for k, v in sh.items():
    try: si[ShadowInfoKey[k]] = v; applied.append(k)
    except Exception: skipped.append(k)
st = model.get_styles().get_active_style(); st.set_name("Knuckle Studio"); st.set_description("Carbon fiber product study")

# camera: from the grip side, a little in front and above, so the rings face the viewer and the phone back shows behind
xmin, ymin, zmin, xmax, ymax, zmax = -39 * MM, -81.7 * MM, -28.3 * MM, 82.0 * MM, 81.7 * MM, 27.7 * MM
cx, cy, cz = 22 * MM, 0.0, -2 * MM
fov = 30.0
az, el = math.radians(-24), math.radians(24)
dx, dy, dz = math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)
rl = math.hypot(dx, dy); rx, ry = -dy / rl, dx / rl
ux, uy, uz = -dz * ry, dz * rx, dx * ry - dy * rx
corners = [(x, y, z) for x in (xmin, xmax) for y in (ymin, ymax) for z in (zmin, zmax)]
he = max(abs((x - cx) * rx + (y - cy) * ry) for x, y, z in corners)
ve = max(abs((x - cx) * ux + (y - cy) * uy + (z - cz) * uz) for x, y, z in corners)
hv = math.radians(fov / 2); hh = math.atan(1.0 * math.tan(hv))
dist = max(ve / math.tan(hv), he / math.tan(hh)) * 1.12
cam = Camera(); cam.set_orientation(SUPoint3D(cx + dist * dx, cy + dist * dy, cz + dist * dz), SUPoint3D(cx, cy, cz), SUVector3D(0, 0, 1))
cam.enable_perspective(); cam.set_perspective_frustum_fov(fov); model.set_camera(cam)
result = {"applied": applied, "skipped": skipped, "shadow_keys": shadow_keys[:40]}
