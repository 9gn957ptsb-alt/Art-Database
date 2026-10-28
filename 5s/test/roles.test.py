"""Self-check for 5s/roles.py on the fixture deck (no real data). Run: python3 5s/test/roles.test.py"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

FIVE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(FIVE))
from roles import problems  # noqa: E402

DECK = FIVE / "test" / "fixture" / "deck.json"
cards = json.loads(DECK.read_text())["cards"]
first = {k: next(c for c in cards if c["kind"] == k) for k in ("image", "object", "space", "surface", "colour")}


def run(path):
    r = subprocess.run([sys.executable, str(FIVE / "roles.py"), "--deck", str(DECK), "--roles", str(path)],
                       capture_output=True, text=True)
    return r.returncode, r.stdout


# the checks, one entry at a time
assert problems("object", {"role": ["light", "ceiling"], "what": "a pendant lamp"}) == []
assert problems("space", {"role": ["room"], "what": "a dining room", "room": {"planes": {}}}) == []
assert problems("colour", {"role": ["walls", "light"]}) == []
assert problems("object", {"role": ["textile", "floor"], "what": "a rug"}) == []
for kind, e in [("object", {"role": ["lamp"], "what": "a lamp"}),                    # unknown role
                ("object", {"role": ["thing", "art", "light"], "what": "a box"}),     # three roles
                ("object", {"role": ["thing", "room"], "what": "a box"}),             # room only first, on a space
                ("space", {"role": ["building", "view"], "what": "a barn"}),          # a building has one role
                ("surface", {"role": ["ceiling"], "what": "slats"}),                 # a surface: floor or walls
                ("object", {"role": ["thing"]}),                                     # no what
                ("object", {"role": ["thing"], "what": "A vase"}),                   # lower case first
                ("object", {"role": ["thing"], "what": "a " + "very " * 9 + "vase"}),  # over 40 characters
                ("object", {"role": ["textile"], "what": "a wool mat"}),             # a rug is laid
                ("space", {"role": ["building"], "what": "a barn", "room": {}})]:    # a marked room is an interior's
    assert problems(kind, e), (kind, e)

with tempfile.TemporaryDirectory() as tmp:
    path = Path(tmp) / "roles.json"
    # no file: the rule fills images, colours and painted surfaces; objects and structures wait for an eye
    code, out = run(path)
    assert code == 0, out
    got = json.loads(path.read_text())["cards"]
    assert got[first["image"]["work"]]["image"] == {"role": ["art"], "what": "a painting"}
    assert got[first["colour"]["work"]]["colour"] == {"role": ["walls", "light"]}
    assert got[first["surface"]["work"]]["surface"] == {"role": ["walls"], "what": "a painted surface"}
    assert "object" not in got.get(first["object"]["work"], {}) and "space" not in got.get(first["space"]["work"], {})
    assert 'to judge by eye' in out and first["object"]["id"] in out and first["space"]["id"] in out, out

    # an entry judged by eye, with its marked room, stays exactly as written
    room = {"role": ["room"], "what": "a white hall", "room": {"say": "a white hall", "planes": {"f": {"size": [500, 400]}}}}
    got.setdefault(first["space"]["work"], {})["space"] = room
    path.write_text(json.dumps({"version": 1, "cards": got}))
    code, out = run(path)
    assert code == 0 and json.loads(path.read_text())["cards"][first["space"]["work"]]["space"] == room, out

    # a wrong entry: nothing is written, and the line says why
    got[first["object"]["work"]] = {"object": {"role": ["thing", "room"], "what": "a jug"}}
    before = json.dumps({"version": 1, "cards": got})
    path.write_text(before)
    code, out = run(path)
    assert code == 1 and "first roles of a space" in out and path.read_text() == before, out

print("roles.test: ok")
