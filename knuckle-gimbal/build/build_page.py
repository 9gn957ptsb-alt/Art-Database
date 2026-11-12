# Builds index.html from viewer.html, the packed mesh (mesh_meta.json, mesh_b64.txt), the posed hand (hand_meta.json, hand_b64.txt)
# and the phone (phone_meta.json, phone_b64.txt) in the current folder,
# then, with "quick" or "full", checks it in headless Chromium. Run it from a scratch copy of this folder.
# The browser test serves three.js r128 locally from ./package/build/three.min.js (npm pack three@0.128.0; tar xzf three-0.128.0.tgz).
import json, os, sys, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(HERE, "viewer.html")).read(); meta = json.load(open("mesh_meta.json")); b64 = open("mesh_b64.txt").read()
out = s.replace("/*META*/null", json.dumps(meta, separators=(",", ":"))).replace("/*DATA*/", b64)
# the hand (hand_fit.py writes these two files)
out = out.replace("/*HAND_META*/null", open("hand_meta.json").read()).replace("/*HAND_DATA*/", open("hand_b64.txt").read())
# the phone (phone.py writes these two)
out = out.replace("/*PHONE_META*/null", open("phone_meta.json").read()).replace("/*PHONE_DATA*/", open("phone_b64.txt").read())
HM = json.load(open("hand_meta.json")); HV = HM["variants"]["well"]     # the version the page opens with
R, RD = HV["reach"]["promax"], HV["reach"]["duoOpen"]                    # its limits with no phone or the Pro Max, and with the open Duo
open("index.html", "w").write(out)
# a copy without the Duo plate, so the test can tell that the plate is drawn
PM = json.load(open("phone_meta.json")); PM["parts"] = [q for q in PM["parts"] if q["group"] != "plate"]
noplate = out.replace(open("phone_meta.json").read(), json.dumps(PM, separators=(",", ":")))
open("chk.js", "w").write(out[out.index("<script>") + 8: out.rindex("</script>")])
subprocess.run(["node", "--check", "chk.js"], check=True)
if len(sys.argv) < 2: print("index.html written"); sys.exit(0)
head = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0}[hidden]{display:none!important}</style></head><body>'
open("_test.html", "w").write(head + out + "</body></html>"); open("_test_noplate.html", "w").write(head + noplate + "</body></html>")
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
THREE = open(os.environ.get('THREE_JS', 'package/build/three.min.js'), 'rb').read()
url = "file://" + os.path.abspath("_test.html")
def serve(route): route.fulfill(status=200, body=THREE, headers={"content-type": "application/javascript"})
def diff(a, b): return ImageChops.difference(Image.open(a).convert('RGB'), Image.open(b).convert('RGB')).getbbox() is not None
def same(a, b):
    # the same view: under 0.5% of pixels changed (a hovered button or the faded hint may differ)
    d = ImageChops.difference(Image.open(a).convert('L'), Image.open(b).convert('L')).point(lambda v: 255 if v > 30 else 0)
    return d.histogram()[255] < 0.005 * d.size[0] * d.size[1]
def skin(path):
    # share of the stage (top bar and dock left out) in the hand's clay colour; the camera may move, the colour does not
    import numpy as np
    a = np.asarray(Image.open(path).convert('RGB'), dtype=int)[60:-150]
    return float(((a[..., 0] - a[..., 2] > 12) & (a[..., 1] - a[..., 2] > 5) & (a[..., 0] > 120)).mean())
def orange(path):
    # share of the stage in the phone's orange
    import numpy as np
    a = np.asarray(Image.open(path).convert('RGB'), dtype=int)[60:-150]
    return float(((a[..., 0] - a[..., 2] > 70) & (a[..., 0] > 100) & (a[..., 1] < 0.75 * a[..., 0])).mean())
def duo(path):
    # share of the stage in the iPhone Duo's blue-grey
    import numpy as np
    a = np.asarray(Image.open(path).convert('RGB'), dtype=int)[60:-150]
    return float(((a[..., 2] - a[..., 0] > 12) & (a[..., 2] > 40) & (a[..., 2] < 150) & (a[..., 1] > a[..., 0])).mean())
def setv(pg, id_, v): pg.evaluate(f"s=document.getElementById('{id_}'); s.value={v}; s.dispatchEvent(new Event('input'))")
mode = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    errs = []
    d = b.new_page(viewport={"width": 1280, "height": 860}); d.on("pageerror", lambda e: errs.append(str(e))); d.route("**/three.min.js", serve)
    d.goto(url); d.wait_for_timeout(6000); d.screenshot(path="v_desk.png")
    print("webgl:", d.evaluate("!document.getElementById('cgl').hidden"))
    setv(d, "ring", 8); d.wait_for_timeout(500); d.screenshot(path="v_ring8.png"); print("ring moves:", diff("v_desk.png", "v_ring8.png"))
    if mode == "full":
        setv(d, "fold", 0); d.wait_for_timeout(400); d.screenshot(path="v_flat.png")
        setv(d, "fold", -180); setv(d, "slide", 0); d.wait_for_timeout(400); d.screenshot(path="v_stowed.png"); print("stowed:", d.inner_text("#foldOut"), d.inner_text("#slideOut"))
        setv(d, "fold", 90); d.wait_for_timeout(300); print("arm pushed out for hold:", d.inner_text("#slideOut"))
        setv(d, "slide", 45); setv(d, "ring", 0)
        d.click("#inside"); d.wait_for_timeout(5000); d.screenshot(path="v_inside.png"); d.click("#inside"); d.wait_for_timeout(5000)
        d.mouse.move(640, 420); d.mouse.down()
        for i in range(14): d.mouse.move(640 + i * 15, 420 + i * 3)
        d.mouse.up(); d.wait_for_timeout(6000); d.screenshot(path="v_orbit.png"); print("orbit:", diff("v_desk.png", "v_orbit.png"))
        d.click("#reset"); d.wait_for_timeout(6000); d.screenshot(path="v_reset.png"); print("reset returns home:", same("v_desk.png", "v_reset.png"))
        d.click("#version [data-v=tang]"); d.wait_for_timeout(1500); d.screenshot(path="v_tang.png")
        print("version switch:", diff("v_reset.png", "v_tang.png"), d.get_attribute("#version [data-v=tang]", "aria-checked") == "true", "sliding tang" in d.get_attribute("#stage", "aria-label"))
        d.focus("#version [data-v=tang]"); d.keyboard.press("ArrowLeft"); d.wait_for_timeout(1500); d.screenshot(path="v_well_again.png")
        print("arrow key back to the open well:", same("v_reset.png", "v_well_again.png"), d.get_attribute("#version [data-v=well]", "aria-checked") == "true")
        d.check("#hand"); d.wait_for_timeout(6000); d.screenshot(path="v_hand.png")
        print("hand shows:", diff("v_reset.png", "v_hand.png"), "| fingers slider shown:", d.is_visible("#clench"), "| arm:", d.inner_text("#slideOut"))
        d.click("#version [data-v=tang]"); d.wait_for_timeout(1500); d.screenshot(path="v_hand_tang.png"); print("the hand takes the sliding tang's pose:", diff("v_hand.png", "v_hand_tang.png"), "| arm:", d.inner_text("#slideOut"))
        setv(d, "ring", 8); d.wait_for_timeout(800); d.screenshot(path="v_hand_tang8.png"); setv(d, "clench", 50); d.wait_for_timeout(800); d.screenshot(path="v_hand_tang_half.png")
        setv(d, "clench", 100); setv(d, "ring", 0); d.click("#version [data-v=well]"); d.wait_for_timeout(1500); d.screenshot(path="v_hand_well.png"); print("and back:", same("v_hand.png", "v_hand_well.png"))
        setv(d, "ring", 8); d.wait_for_timeout(800); d.screenshot(path="v_hand_well8.png"); setv(d, "clench", 50); d.wait_for_timeout(800); d.screenshot(path="v_hand_well_half.png"); setv(d, "clench", 100); setv(d, "ring", 0)
        setv(d, "clench", 0); d.wait_for_timeout(800); d.screenshot(path="v_hand_open.png"); print("fingers open:", diff("v_hand.png", "v_hand_open.png"), d.inner_text("#clenchOut"))
        setv(d, "clench", 100); setv(d, "ring", 8); d.wait_for_timeout(800); d.screenshot(path="v_hand_ring8.png"); print("ring finger follows:", diff("v_hand.png", "v_hand_ring8.png"))
        setv(d, "ring", 0); setv(d, "slide", 20); d.wait_for_timeout(300); print("arm kept clear of the phone with the hand:", d.inner_text("#slideOut"))
        print("hand drawn:", round(skin("v_hand.png"), 3) > 0.03)
        setv(d, "fold", 45); d.wait_for_timeout(800); d.screenshot(path="v_hand_fold.png"); print("hand stays on the grip as it turns:", skin("v_hand_fold.png") > 0.03, diff("v_hand.png", "v_hand_fold.png"))
        setv(d, "fold", -180); d.wait_for_timeout(800); d.screenshot(path="v_hand_fold2.png")
        print("with the hand the grip stops at %d°:" % R["gripMin"], d.input_value("#fold") == str(R["gripMin"]), d.inner_text("#foldOut"), "| arm:", d.inner_text("#slideOut"), "| hand drawn:", skin("v_hand_fold2.png") > 0.01)
        setv(d, "slide", 0); setv(d, "fold", 0); d.wait_for_timeout(300); print("arm pushed out for the hand at 0°:", d.inner_text("#slideOut") == "%d mm" % R["eHand"][-R["gripMin"]])
        setv(d, "fold", 90); d.click("#inside"); d.wait_for_timeout(1500); d.screenshot(path="v_hand_inside.png"); print("hand hidden in the inside view:", skin("v_hand_inside.png") < 0.002)
        d.uncheck("#hand"); setv(d, "fold", -180); d.check("#hand"); d.wait_for_timeout(6000); d.screenshot(path="v_hand_back.png")
        print("checking Hand turns the grip back to the hold and closes the inside view:", d.input_value("#fold") == "90", d.get_attribute("#inside", "aria-pressed") == "false", skin("v_hand_back.png") > 0.03)
        d.uncheck("#hand"); setv(d, "fold", 0); d.check("#hand"); d.wait_for_timeout(1500); print("checking Hand keeps a grip angle the hand fits:", d.input_value("#fold") == "0"); setv(d, "fold", 90)
        setv(d, "slide", 45); d.uncheck("#hand"); d.wait_for_timeout(6000); d.screenshot(path="v_hand_off.png"); print("hand hides:", same("v_reset.png", "v_hand_off.png"), "| fingers slider hidden:", not d.is_visible("#clench"), "| grip goes to -180 again:", d.get_attribute("#fold", "min") == "-180")
        print("phone hidden at first:", orange("v_reset.png") < 0.001, "| picker shown:", d.is_visible("#phone"), d.eval_on_selector_all("#phone option", "o => o.map(x => x.value)"))
        d.select_option("#phone", "promax"); d.wait_for_timeout(6000); d.screenshot(path="v_phone_on.png"); print("phone shows:", orange("v_phone_on.png") > 0.03, round(orange("v_phone_on.png"), 3))
        d.check("#hand"); d.wait_for_timeout(6000); d.screenshot(path="v_phone_hand_on.png"); print("phone and hand:", orange("v_phone_hand_on.png") > 0.01, skin("v_phone_hand_on.png") > 0.02)
        setv(d, "fold", -60); d.wait_for_timeout(800); d.screenshot(path="v_phone_hand_fold.png")
        d.uncheck("#hand"); setv(d, "fold", -180); setv(d, "slide", 0); d.wait_for_timeout(800); d.screenshot(path="v_phone_stowed.png")
        setv(d, "fold", 90); setv(d, "slide", 45); d.click("#inside"); d.wait_for_timeout(1500); d.screenshot(path="v_phone_inside.png"); d.click("#inside"); d.wait_for_timeout(1500)
        d.select_option("#phone", "duo"); d.wait_for_timeout(6000); d.screenshot(path="v_duo.png")
        print("folded Duo shows:", duo("v_duo.png") - duo("v_reset.png") > 0.015, round(duo("v_duo.png"), 3), "| no orange:", orange("v_duo.png") < 0.001, "| said:", "folded iPhone Duo" in d.get_attribute("#stage", "aria-label"))
        d.select_option("#phone", "duoOpen"); d.wait_for_timeout(6000); d.screenshot(path="v_duo_open.png")
        print("open Duo on the plate:", duo("v_duo_open.png") - duo("v_reset.png") > 0.006, diff("v_duo.png", "v_duo_open.png"), "Duo plate" in d.get_attribute("#stage", "aria-label"), "| arm:", d.inner_text("#slideOut"))
        q = b.new_page(viewport={"width": 1280, "height": 860}); q.route("**/three.min.js", serve); q.goto("file://" + os.path.abspath("_test_noplate.html")); q.wait_for_timeout(6000)
        q.select_option("#phone", "duoOpen"); q.wait_for_timeout(6000); q.screenshot(path="v_duo_open_noplate.png"); q.close()
        print("the Duo plate is drawn:", diff("v_duo_open.png", "v_duo_open_noplate.png"))
        d.check("#hand"); d.wait_for_timeout(6000); d.screenshot(path="v_duo_open_hand.png")
        print("with the hand the arm goes out to %d mm for the open Duo:" % RD["eHand"][-1], d.inner_text("#slideOut") == "%d mm" % RD["eHand"][-1], "| hand drawn:", skin("v_duo_open_hand.png") > 0.02)
        setv(d, "fold", -180); d.wait_for_timeout(600); print("and the grip stops at %d°:" % RD["gripMin"], d.input_value("#fold") == str(RD["gripMin"]))
        setv(d, "fold", 90); setv(d, "slide", 0); d.wait_for_timeout(300); print("arm kept out for the open Duo:", d.inner_text("#slideOut") == "%d mm" % RD["eHand"][-1])
        d.uncheck("#hand"); setv(d, "fold", -180); setv(d, "slide", 0); d.wait_for_timeout(800); d.screenshot(path="v_duo_open_stowed.png"); print("open Duo stowed:", d.inner_text("#slideOut"), d.inner_text("#foldOut"))
        setv(d, "fold", 90); d.wait_for_timeout(300); print("arm pushed out for the open Duo without the hand:", d.inner_text("#slideOut") == "%d mm" % RD["eGrip"][-1], d.inner_text("#slideOut"))
        setv(d, "slide", 45); d.select_option("#phone", "none"); d.wait_for_timeout(6000); d.screenshot(path="v_phone_off.png"); print("phone hides:", same("v_reset.png", "v_phone_off.png"), "| arm:", d.inner_text("#slideOut"))
        ctx = b.new_context(viewport={"width": 400, "height": 860}, has_touch=True, is_mobile=True, color_scheme="dark"); m = ctx.new_page()
        m.on("pageerror", lambda e: errs.append(str(e))); m.route("**/three.min.js", serve)
        m.goto(url); m.wait_for_timeout(6000); m.screenshot(path="v_phone.png"); print("phone scrollW:", m.evaluate("document.documentElement.scrollWidth"))
        m.check("#hand"); m.select_option("#phone", "duoOpen"); m.wait_for_timeout(6000); m.screenshot(path="v_phone_hand.png"); print("phone with hand and iPhone scrollW:", m.evaluate("document.documentElement.scrollWidth"))
        m.uncheck("#hand"); m.select_option("#phone", "none"); m.wait_for_timeout(6000)
        cdp = ctx.new_cdp_session(m)
        def t(typ, pts): cdp.send("Input.dispatchTouchEvent", {"type": typ, "touchPoints": [{"x": a, "y": c, "id": i} for i, (a, c) in enumerate(pts)]})
        t("touchStart", [(170, 400), (230, 400)])
        for i in range(1, 12): t("touchMove", [(170 - i * 8, 400), (230 + i * 8, 400)])
        t("touchEnd", []); m.wait_for_timeout(900); m.screenshot(path="v_phone_pinch.png"); print("pinch zoom:", diff("v_phone.png", "v_phone_pinch.png"))
        f = b.new_page(viewport={"width": 1280, "height": 860}); f.on("pageerror", lambda e: errs.append(str(e))); f.route("**/three.min.js", lambda r: r.abort())
        f.goto(url); f.wait_for_timeout(4000); f.screenshot(path="v_basic.png"); print("fallback:", f.inner_text("#sub"))
        f.check("#hand"); f.wait_for_timeout(2500); f.screenshot(path="v_basic_hand.png"); print("fallback hand:", diff("v_basic.png", "v_basic_hand.png"))
        f.select_option("#phone", "promax"); f.wait_for_timeout(2500); f.screenshot(path="v_basic_phone.png"); print("fallback phone:", orange("v_basic_phone.png") > 0.01)
        f.select_option("#phone", "duoOpen"); f.wait_for_timeout(2500); f.screenshot(path="v_basic_duo.png"); print("fallback open Duo:", duo("v_basic_duo.png") - duo("v_basic.png") > 0.004, diff("v_basic_phone.png", "v_basic_duo.png"))
        f.select_option("#phone", "promax"); f.wait_for_timeout(1500)
        f.click("#version [data-v=tang]"); f.wait_for_timeout(2500); f.screenshot(path="v_basic_tang.png"); print("fallback version switch:", diff("v_basic_phone.png", "v_basic_tang.png"))
    print("errors:", errs)
os.remove("_test.html"); os.remove("_test_noplate.html")
