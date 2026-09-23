"""Read NASA POWER's monthly climatologies straight from its public Zarr stores on S3.

POWER (Prediction Of Worldwide Energy Resources, NASA Langley) publishes long-term monthly means as
Zarr v2 arrays shaped (13, lat, lon): January to December, then the annual mean. The MERRA-2 set is
on a 0.5 x 0.625 degree grid, the CERES SYN1deg set on 1 x 1 degree. Each month of each variable is
one compressed chunk, so a whole global field is one request. Chunks are cached on disk.
"""

import json
import urllib.request
from pathlib import Path

import numcodecs
import numpy as np

BASE = "https://nasa-power.s3.amazonaws.com/{ds}/spatial/power_{ds}_climatology_spatial_utc.zarr"


class Power:
    def __init__(self, ds, cache):
        self.ds, self.base = ds, BASE.format(ds=ds)
        self.cache = Path(cache) / f"power-{ds}"
        self.cache.mkdir(parents=True, exist_ok=True)
        meta = json.loads(self._get(".zmetadata"))["metadata"]
        self.arrays = {k[:-len("/.zarray")]: v for k, v in meta.items() if k.endswith("/.zarray")}
        self.attrs = {k[:-len("/.zattrs")]: v for k, v in meta.items() if k.endswith("/.zattrs")}
        self.lat, self.lon = self._whole("lat"), self._whole("lon")

    def _get(self, key):
        path = self.cache / key.replace("/", "__")
        if not path.exists():
            with urllib.request.urlopen(f"{self.base}/{key}", timeout=120) as r:
                path.write_bytes(r.read())
        return path.read_bytes()

    def _decode(self, name, raw):
        a = self.arrays[name]
        out = numcodecs.get_codec(a["compressor"]).decode(raw) if a.get("compressor") else raw
        for f in reversed(a.get("filters") or []):
            out = numcodecs.get_codec(f).decode(out)
        return np.frombuffer(out, dtype=np.dtype(a["dtype"])).reshape(a["chunks"])

    def _whole(self, name):
        a = self.arrays[name]
        assert a["chunks"] == a["shape"], name
        return self._decode(name, self._get(f"{name}/" + ".".join("0" * len(a["shape"]))))

    def month(self, name, m):
        """The global field of `name` for month m (0 = January ... 11 = December, 12 = the year), as
        (lat, lon) float32 with NaN where there is no value, rows running south to north."""
        a = self.arrays[name]
        field = self._decode(name, self._get(f"{name}/{m}.0.0"))[0].astype(np.float32)
        fill = a.get("fill_value")
        if fill is not None and not (isinstance(fill, str)):
            field[field == fill] = np.nan
        field[field <= -990] = np.nan
        return field

    def months(self, name):
        return np.stack([self.month(name, m) for m in range(12)])

    def describe(self, name):
        at = self.attrs.get(name, {})
        return f"{name}: {at.get('long_name', '')} [{at.get('units', '')}]"
