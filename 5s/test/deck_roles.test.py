"""Self-check for build_deck.py's add_roles and clean_room on the fixture (no real data): what each card is and the
interiors' marked rooms, as the deck build ships them. Run: python3 5s/test/deck_roles.test.py"""
import copy
import io
import json
import sys
import tempfile
from contextlib import redirect_stdout
from pathlib import Path

FIVE = Path(__file__).resolve().parents[1]
FIX = FIVE / "test" / "fixture"
sys.path.insert(0, str(FIVE))
from build_deck import add_roles, clean_room, corners_w  # noqa: E402
from roles import problems  # noqa: E402

deck = json.loads((FIX / "deck.json").read_text())


def run(cards, data):
    out = io.StringIO()
    with redirect_stdout(out):
        add_roles(cards, data)
    return out.getvalue()


# the fixture's synthetic roles.json and planes.json pass roles.py's checks, and the fixture deck carries them as built
for work, kinds in json.loads((FIX / "roles.json").read_text())["cards"].items():
    for kind, e in kinds.items():
        assert problems(kind, e) == [], (work, kind, problems(kind, e))


def bare():
    """The fixture's cards as the deck build makes them before add_roles."""
    return [{k: v for k, v in c.items() if k not in ("role", "what", "room")} for c in copy.deepcopy(deck["cards"])]


cards = bare()
log = run(cards, FIX)
assert cards == deck["cards"], "make_fixture.py is out of date: run python3 5s/test/make_fixture.py"
assert "5 interiors, 2 marked: s001 s003" in log, log

# only an interior takes its marked room: a building's is left out, and said
cards = bare()
with tempfile.TemporaryDirectory() as tmp:
    roles = json.loads((FIX / "roles.json").read_text())
    roles["cards"]["fixture-s001"]["space"]["role"] = ["building"]
    (Path(tmp) / "roles.json").write_text(json.dumps(roles))
    (Path(tmp) / "planes.json").write_text((FIX / "planes.json").read_text())
    log = run(cards, Path(tmp))
    s001 = next(c for c in cards if c["id"] == "s001")
    assert "room" not in s001 and s001["role"] == ["building"], s001
    assert "left out: fixture-s001" in log, log
    # no roles.json: nothing is shipped, and the page's word rules and kinds decide
    (Path(tmp) / "roles.json").unlink()
    cards = bare()
    log = run(cards, Path(tmp))
    assert cards == bare() and "no roles.json" in log, log

# clean_room: rounded; a plane with a corner behind the camera, a spot naming no plane, a short or outside polygon and a
# long name are dropped, each said
good = json.loads((FIX / "planes.json").read_text())["rooms"]["fixture-s001"]
bad = copy.deepcopy(good)
bad["planes"]["w2"] = {"q": [[0, 0], [100, 0], [0, 100], [100, 100]], "size": [300, 300]}   # a bow tie: a corner behind
bad["planes"]["f"]["q"][2] = [99.987, 100.04]
bad["spots"]["hang2"] = {"plane": "w2", "at": [10, 10], "name": "on the bow tie"}
bad["spots"]["lay"]["name"] = "x" * 41
bad["opening"]["polys"] += [[[1, 1], [2, 2]], [[1, 1], [2, 2], [120, 3]]]
said = []
r = clean_room(bad, said.append)
assert list(r["planes"]) == ["w1", "f"] and r["planes"]["f"]["q"][2] == [100.0, 100.0], r["planes"]
assert "hang2" not in r["spots"] and "lay" not in r["spots"] and "hang" in r["spots"]
assert r["opening"]["polys"] == good["opening"]["polys"]
assert said == ["plane w2", "2 of its opening", "spot lay", "spot hang2"], said
assert clean_room(good, said.append) == good, "a good room is shipped as marked"
assert clean_room({**good, "paint": None}, said.append)["paint"] is None, "never painted stays so"
assert min(corners_w([[0, 0], [100, 0], [0, 100], [100, 100]])) <= 0 and min(corners_w(good["planes"]["f"]["q"])) > 0
print("deck_roles.test: ok")
