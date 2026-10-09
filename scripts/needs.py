"""What the buildings' and the cities' passes import, installed where a fresh container lacks it.

A scheduled pass (docs/v2/models/REFINE.md, docs/v2/grounds/REFINE.md) starts in a fresh container:
nothing on disk but the repository, and Python with only what the environment brings. A module missing
there does not always fail loudly: build_built_years.py takes a source it cannot read for one that "did
not answer" (EUBUCCO's years for France and Spain need h3; on 9 Oct 2026 Paris's were carried from its
last cut for want of it). So the passes' drivers (update_buildings.py, refine_cities.py) call ensure()
first, and it installs what is missing.
"""

import importlib
import importlib.util
import subprocess
import sys

# Each module the passes' scripts import (directly or through the scripts they run): its pip name.
PASSES = {"numpy": "numpy", "pyarrow": "pyarrow", "shapely": "shapely", "PIL": "pillow",
          "tifffile": "tifffile", "imagecodecs": "imagecodecs", "pyproj": "pyproj", "shapefile": "pyshp",
          "h3": "h3", "certifi": "certifi"}


def ensure(modules=PASSES):
    """Install the modules this Python cannot import; exit with the command to run if pip cannot."""
    missing = [pip for name, pip in modules.items() if importlib.util.find_spec(name) is None]
    if not missing:
        return []
    print("Installing what this container lacks: " + " ".join(missing), flush=True)
    if subprocess.call([sys.executable, "-m", "pip", "install", "-q", *missing]):
        sys.exit("Could not install them: run `pip install " + " ".join(missing) + "`, then this again.")
    importlib.invalidate_caches()
    return missing


if __name__ == "__main__":
    got = ensure()
    print("Installed: " + " ".join(got) if got else "Nothing missing.")
