"""Self-check for 5s/gather_buildings.py's page reader (no network). Run: python3 5s/test/gather_buildings.test.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import gather_buildings as g  # noqa: E402

S3 = "https://s3.amazonaws.com/api.thelocalproject/public/Articles/7/"
PAGE = f"""<html><head><title>x</title>
<meta property="og:title" content="Casa Uno by Estudio Dos | Architectural Authority">
<meta property="og:description" content="A house &amp; a hill."></head><body>
<div class="article_root__a1"><h1>Quiet – Casa Uno by Estudio Dos</h1>
<div class="AnimatedTextSwitcher_line__z">RESIDENTIAL SERIES</div>
<div class="AnimatedTextSwitcher_line__z">Lima, Peru</div>
<span class="article_creditsRole__q">Photographer</span><span class="article_creditsName__q">Ana Ruiz</span>
<p class="article_normalP__x">Completed in 2019, the house sits on a hill. It covers 2000 sq m.</p>
<img src="{S3}uno-2560x1707.jpg"><img src="{S3}dos-1707x2560.jpg"><img src="{S3}uno-2560x1707.jpg"></div>
<script>self.__next_f.push(["{S3}uno-2560x1707.jpg\\\\","{S3}tres-800x600.jpg\\\\"])</script>
</body></html>"""

i = g.parse_page(PAGE, {"slug": "casa-uno", "name": "Casa Uno", "title": ""})
assert i["architect"] == "Estudio Dos" and i["architect_from"] == "og:title", i["architect"]
assert i["photographer"] == "Ana Ruiz", i["credits"]
assert i["series"] == "RESIDENTIAL" and i["page_place"] == "Lima, Peru", (i["series"], i["page_place"])
assert i["photos"] == [S3 + "uno-2560x1707.jpg", S3 + "dos-1707x2560.jpg"], i["photos"]
assert i["photos_unrendered"] == [S3 + "tres-800x600.jpg"], i["photos_unrendered"]
assert [(y["year"], y["measure"]) for y in i["years"]] == [(2019, False), (2000, True)], i["years"]
assert i["years"][0]["sentence"] == "Completed in 2019, the house sits on a hill.", i["years"][0]
assert i["og_description"] == "A house & a hill." and i["description"].startswith("Completed in 2019")
assert g.split_by("Casa by the Sea by Studio X", "Casa by the Sea") == "Studio X"
print("gather_buildings: ok")
