#!/usr/bin/env python3
"""Gather the artist's Architectural Authority bookmarks for 5s: each article's page, text and photos.

    the bookmark list (docs/v2/architecture.json on the site branch, kept by the hourly intake)
  + residential/bookmarks.json (AA's category) + residential/projects/*.json (year, architect)
      ->  data/aa/pages/<slug>.html        the article page, fetched once
          data/aa/img/<slug>/NN.jpg       every photograph on the page, in page order, fetched once
          data/aa/buildings.raw.json      what each page says (no decisions: see below)

This is the gathering step only. It reads what each page carries and writes it down: the name and
architect (from og:title "<Name> by <Architect>", else the headline), the credits, the photographer,
the description and article text, the series and place the page shows, the publication date, and
every year the text mentions together with its sentence. It does not decide a completion year, a
kind or a crop; the deck builder does that later from this file and the photos.

Incremental and cached, so the hourly intake's new bookmarks are gathered by running it again:
pages and photos already on disk are never fetched again, and buildings.raw.json is rebuilt from
the cached pages on every run (cheap, no network). Polite to the site: one request at a time, at
least --delay seconds apart (1 s), an honest User-Agent, robots.txt honoured, no sign-in (the pages
are public; no token is ever read or sent). Pages that answer 404/410 are remembered in
data/aa/failures.json and not asked for again unless --retry-failed is given.

data/ is git-ignored: the repository is public, and the pages and photos stay in data/aa/ only.

Usage:
    python3 5s/gather_buildings.py                       # fetch the list, gather what is new
    python3 5s/gather_buildings.py --sheets DIR          # also write a numbered contact sheet per building
    python3 5s/gather_buildings.py --offline             # rebuild buildings.raw.json from the cache only
Options: --list FILE (a local architecture.json instead of the branch), --no-git-fetch, --only SLUG...,
         --refresh SLUG... (fetch these pages again), --no-photos, --retry-failed, --delay SECONDS.
"""
import argparse
import html
import io
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
OUT = REPO / "data" / "aa"
PAGES = OUT / "pages"
IMG = OUT / "img"
RAW = OUT / "buildings.raw.json"
FAILURES = OUT / "failures.json"
ROBOTS = OUT / "robots.txt"
BOOKMARKS = REPO / "residential" / "bookmarks.json"
PROJECTS = REPO / "residential" / "projects"

BRANCH = "claude/artist-website-dev-s92irf"
LIST_PATH = "docs/v2/architecture.json"
SITE = "https://www.thearchitecturalauthority.com"
ARTICLE_PREFIX = SITE + "/article/"
UA = "5s-buildings-gatherer/1 (a personal art database; one request a second; low volume)"
PHOTO_RE = re.compile(
    r"https://s3\.amazonaws\.com/api\.thelocalproject/public/Articles/(\d+)/([^\"'\\\s<>()?#]+?\.(?:jpe?g|png|webp|gif))",
    re.I)
SIZE_RE = re.compile(r"-(\d{2,5})x(\d{2,5})\.\w+$")


def log(*a):
    print(*a, flush=True)


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_json(path, default):
    try:
        return json.loads(Path(path).read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save_json(path, obj, indent=1):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=indent))
    tmp.replace(path)


def write_bytes(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(path)


# ----------------------------------------------------------------------------------------------
# the network: one request at a time, a polite interval apart
# ----------------------------------------------------------------------------------------------

class Fetcher:
    def __init__(self, delay):
        self.delay = delay
        self.last = 0.0
        self.count = 0
        self.robots = None

    def _wait(self):
        gap = time.monotonic() - self.last
        if gap < self.delay:
            time.sleep(self.delay - gap)

    def get(self, url, tries=4, timeout=60):
        """GET url; returns (status, bytes, content_type). Raises on a permanent failure."""
        err = None
        for attempt in range(tries):
            self._wait()
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
                with urllib.request.urlopen(req, timeout=timeout) as r:
                    body = r.read()
                    return r.status, body, r.headers.get("Content-Type", "")
            except urllib.error.HTTPError as e:
                if e.code in (400, 401, 403, 404, 410):
                    raise
                err = e
                wait = 5.0 * (attempt + 1)
                if e.code == 429:
                    try:
                        wait = max(wait, float(e.headers.get("Retry-After", "0")))
                    except ValueError:
                        pass
                time.sleep(min(wait, 120))
            except Exception as e:  # a network hiccup: wait and try again
                err = e
                time.sleep(3.0 * (attempt + 1))
            finally:
                self.last = time.monotonic()
                self.count += 1
        raise err

    def allowed(self, url):
        if self.robots is None:
            self.robots = urllib.robotparser.RobotFileParser()
            if not ROBOTS.exists():
                try:
                    _, body, _ = self.get(SITE + "/robots.txt")
                    write_bytes(ROBOTS, body)
                except Exception as e:
                    log(f"  robots.txt unreadable ({e}); going ahead as if it allows articles")
                    write_bytes(ROBOTS, b"")
            self.robots.parse(ROBOTS.read_text(errors="replace").splitlines())
        return self.robots.can_fetch(UA, url)


# ----------------------------------------------------------------------------------------------
# the list
# ----------------------------------------------------------------------------------------------

def read_list(args):
    """The bookmarks: the branch file (or --list), each with AA's category and any project hints."""
    if args.list:
        data = json.loads(Path(args.list).read_text())
        src = str(args.list)
    else:
        if not args.no_git_fetch and not args.offline:
            r = subprocess.run(["git", "-C", str(REPO), "fetch", "-q", "origin", BRANCH],
                               capture_output=True, text=True)
            if r.returncode:
                log(f"  git fetch failed ({r.stderr.strip()[:200]}); using the last fetched list")
        r = subprocess.run(["git", "-C", str(REPO), "show", f"origin/{BRANCH}:{LIST_PATH}"],
                           capture_output=True, text=True)
        if r.returncode:
            sys.exit(f"cannot read {LIST_PATH} from origin/{BRANCH}: {r.stderr.strip()}")
        data = json.loads(r.stdout)
        src = f"origin/{BRANCH}:{LIST_PATH}"
    buildings = data["buildings"] if isinstance(data, dict) else data

    cats = {}
    for b in load_json(BOOKMARKS, []):
        cats[b["slug"]] = b
    projects = {}
    for f in sorted(PROJECTS.glob("*.json")):
        try:
            p = json.loads(f.read_text())
        except json.JSONDecodeError:
            continue
        projects[p.get("slug") or f.stem] = {
            "file": str(f.relative_to(REPO)),
            **{k: p[k] for k in ("name", "architect", "year", "location", "scope") if p.get(k) is not None}}
    return buildings, cats, projects, src


# ----------------------------------------------------------------------------------------------
# reading a page
# ----------------------------------------------------------------------------------------------

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source",
        "track", "wbr"}


class ArticleParser(HTMLParser):
    """Walks the server-rendered article and keeps the parts 5s needs, in page order.

    Class names carry build hashes (article_normalP__VGyho), so they are matched by prefix."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # [(tag, classes)]
        self.meta = {}
        self.ldjson = []
        self.h1 = []
        self.tags = []           # hero tag lines: series, place
        self.published = []
        self.credits = []        # [{role, name}]
        self.quote = []
        self.paras = []          # [[text pieces]]
        self.imgs = []           # src in page order (inside the article only)
        self._cap = None         # which bucket text goes to
        self._cap_depth = 0
        self._script = None
        self._title = None
        self.title = ""

    def _in(self, prefix):
        return any(c.startswith(prefix) for _, cls in self.stack for c in cls)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get("class") or "").split()
        if tag == "meta":
            k = a.get("property") or a.get("name")
            if k and "content" in a and k not in self.meta:
                self.meta[k] = a["content"]
            return
        if tag == "script":
            self._script = [] if a.get("type") == "application/ld+json" else None
            self.stack.append((tag, cls))
            return
        if tag == "title":
            self._title = []
        if tag == "img":
            src = a.get("src") or ""
            if self._in("article_root") and not self._in("EngagementStats") \
                    and not self._in("ArticleBookmark") and PHOTO_RE.match(src):
                self.imgs.append(src)
            return
        if tag == "br":
            if self._cap:
                self._piece(" ")
            return
        if tag in VOID:
            return
        self.stack.append((tag, cls))
        if self._cap is None:
            bucket = None
            if tag == "h1" and self._in("article_root"):
                bucket = "h1"
            elif any(c.startswith("AnimatedTextSwitcher_line") for c in cls):
                bucket = "tag"
            elif any(c.startswith("article_publicationDate") for c in cls):
                bucket = "published"
            elif any(c.startswith("article_creditsRole") for c in cls):
                bucket = "role"
            elif any(c.startswith("article_creditsName") for c in cls):
                bucket = "credname"
            elif tag == "h2" and self._in("page_aboutIntroMain"):
                bucket = "quote"
            elif tag == "p" and (any(c.startswith("article_bandParagraph") or c.startswith("article_normalP")
                                     for c in cls)):
                bucket = "para"
            if bucket:
                self._cap = bucket
                self._cap_depth = len(self.stack)
                if bucket == "para":
                    self.paras.append([])
                elif bucket == "tag":
                    self.tags.append([])
                elif bucket == "role":
                    self.credits.append({"role": [], "name": []})
                elif bucket == "credname":
                    if not self.credits or self.credits[-1]["name"]:
                        self.credits.append({"role": [], "name": []})

    def handle_endtag(self, tag):
        if tag == "title" and self._title is not None:
            self.title = "".join(self._title)
            self._title = None
        if tag == "script" and self._script is not None:
            self.ldjson.append("".join(self._script))
            self._script = None
        if tag in VOID:
            return
        # pop to the matching tag (tolerates the odd unclosed element)
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break
        if self._cap and len(self.stack) < self._cap_depth:
            self._cap = None

    def _piece(self, text):
        c = self._cap
        if c == "h1":
            self.h1.append(text)
        elif c == "tag":
            self.tags[-1].append(text)
        elif c == "published":
            self.published.append(text)
        elif c == "role":
            self.credits[-1]["role"].append(text)
        elif c == "credname":
            self.credits[-1]["name"].append(text)
        elif c == "quote":
            self.quote.append(text)
        elif c == "para":
            self.paras[-1].append(text)

    def handle_data(self, data):
        if self._title is not None:
            self._title.append(data)
        if self._script is not None:
            self._script.append(data)
            return
        if self.stack and self.stack[-1][0] in ("script", "style"):
            return
        if self._cap:
            self._piece(data)


def clean(s):
    s = html.unescape(s or "")
    s = s.replace(" ", " ").replace("​", "")
    return re.sub(r"\s+", " ", s).strip()


SENTENCE_RE = re.compile(r"(?:(?<=[.!?…])|(?<=[.!?…][\"”’)]))\s+(?=[\"“‘(]?[A-ZÀ-Ý])")
YEAR_RE = re.compile(r"(?<![\d,.$£€¥#])(1[5-9]\d\d|20[0-4]\d)(s|’s|'s)?(?!\d|\.\d)")
MEASURE_RE = re.compile(r"^\s*(?:sq\.?|square|m²|m2|sqm|sqft|ft\b|feet|foot|metres?|meters?|acres?|hectares?|ha\b|"
                        r"km|kilomet|mm\b|cm\b|units?|people|guests|seats|rooms|homes|residents|employees|"
                        r"visitors|trees|plants|tons?|tonnes?|kg\b|kw|kwh)", re.I)


def sentences(text):
    return [s.strip() for s in SENTENCE_RE.split(text) if s.strip()]


def years_in(text, where):
    out = []
    for sent in sentences(text):
        for m in YEAR_RE.finditer(sent):
            tail = sent[m.end():m.end() + 16]
            out.append({"year": int(m.group(1)), "token": m.group(0), "where": where,
                        "sentence": sent, "measure": bool(MEASURE_RE.match(tail))})
    return out


def split_by(og_title, name):
    """'<Name> by <Architect>' -> Architect (the name from the list first, else the first ' by ')."""
    if not og_title:
        return None
    if name:
        for sep in (" by ", " By ", " BY "):
            head = name + sep
            if og_title.startswith(head):
                return og_title[len(head):].strip() or None
            i = og_title.find(head)
            if i >= 0:
                return og_title[i + len(head):].strip() or None
    m = re.search(r"\s[Bb][Yy]\s+(.+)$", og_title)
    return m.group(1).strip() if m else None


def parse_page(text, entry):
    p = ArticleParser()
    p.feed(text)
    p.close()
    meta = {k: clean(v) for k, v in p.meta.items()}
    og_title = meta.get("og:title") or clean(p.title)
    h1 = clean("".join(p.h1))
    name = entry.get("name")

    architect, architect_from = split_by(og_title, name), "og:title"
    if not architect:
        architect, architect_from = split_by(h1 or entry.get("title"), name), "title"
    credits = []
    for c in p.credits:
        role, who = clean("".join(c["role"])), clean("".join(c["name"]))
        if who:
            credits.append({"role": role, "name": who})
    if not architect:
        arch = [c["name"] for c in credits if "architect" in c["role"].lower()]
        if arch:
            architect, architect_from = " and ".join(arch), "credits"
    if not architect:
        architect_from = None
    photographers = [c["name"] for c in credits if re.search(r"photo", c["role"], re.I)]

    paras = [clean("".join(x)) for x in p.paras]
    paras = [x for x in paras if x]
    ld = {}
    for blob in p.ldjson:
        try:
            j = json.loads(blob)
        except json.JSONDecodeError:
            continue
        for item in (j if isinstance(j, list) else [j]):
            if isinstance(item, dict) and item.get("@type") in ("Article", "NewsArticle", "BlogPosting"):
                ld = item
    if not paras and ld.get("articleBody"):
        paras = [clean(x) for x in re.split(r"\n\s*\n", ld["articleBody"]) if clean(x)]

    # photographer named in the text when the credits have none ("Photography by ...")
    if not photographers:
        for t in paras:
            m = re.search(r"\b(?:Photograph(?:y|s|er)|Photos?|Images?)\s*(?:by|:|©)\s*([A-Z][\w.'’-]+(?:\s+[A-Z][\w.'’-]+){0,3})", t)
            if m:
                photographers.append(m.group(1))
                break

    tags = [clean("".join(t)) for t in p.tags]
    series = None
    page_place = None
    for t in tags:
        m = re.match(r"(.+?)\s+SERIES\b", t)
        if m and not series:
            series = m.group(1).strip()
        elif t and not page_place and "SERIES" not in t and "FEATURE" not in t:
            page_place = t

    published = None
    if ld.get("datePublished"):
        published = ld["datePublished"][:10]
    else:
        pub = clean("".join(p.published)).replace("Published", "").strip()
        for fmt in ("%B %d, %Y", "%b %d, %Y"):
            try:
                published = datetime.strptime(pub, fmt).date().isoformat()
                break
            except ValueError:
                pass

    quote = clean("".join(p.quote)).strip("\"“”") or None

    # photos: page order, each address once (the payload repeats each with a trailing backslash)
    photos, seen = [], set()
    for src in p.imgs:
        u = src.rstrip("\\")
        if u not in seen:
            seen.add(u)
            photos.append(u)
    if not photos:  # nothing rendered: fall back to the addresses in the whole document, in order
        for m in PHOTO_RE.finditer(text):
            u = m.group(0).rstrip("\\")
            if u not in seen:
                seen.add(u)
                photos.append(u)
    article_ids = sorted({int(PHOTO_RE.match(u).group(1)) for u in photos})
    # addresses elsewhere in the page (head preloads, the payload, the structured data) not rendered
    unrendered = []
    for m in PHOTO_RE.finditer(text):
        u = m.group(0).rstrip("\\")
        if u not in seen and int(m.group(1)) in article_ids:
            seen.add(u)
            unrendered.append(u)

    description_parts, n = [], 0
    for t in paras:
        description_parts.append(t)
        n += len(t)
        if n >= 600 or len(description_parts) >= 3:
            break

    years = []
    for where, t in [("title", h1 or entry.get("title") or ""), ("quote", quote or "")] + \
                    [("text", t) for t in paras]:
        years += years_in(t, where)

    return {
        "og_title": og_title or None,
        "title": h1 or entry.get("title"),
        "architect": architect,
        "architect_from": architect_from,
        "credits": credits,
        "photographer": " and ".join(photographers) or None,
        "photographers": photographers,
        "series": series,
        "page_place": page_place,
        "published": published,
        "og_description": meta.get("og:description") or meta.get("description"),
        "quote": quote,
        "description": " ".join(description_parts) or meta.get("og:description"),
        "paragraphs": paras,
        "years": years,
        "article_id": article_ids[0] if len(article_ids) == 1 else (article_ids or None),
        "photos": photos,
        "photos_unrendered": unrendered,
    }


def looks_like_article(text):
    return 'property="og:title"' in text and "article_root" in text


# ----------------------------------------------------------------------------------------------
# photos
# ----------------------------------------------------------------------------------------------

def photo_dir(slug):
    return IMG / slug


def nn(i):
    return f"{i + 1:02d}.jpg"


def align_photo_files(slug, photos):
    """Keep NN.jpg in step with the page order when a refreshed page reorders its photos."""
    d = photo_dir(slug)
    man_path = d / "index.json"
    old = load_json(man_path, {}).get("photos")
    if old is None or old == photos:
        return
    moves = []
    for i, u in enumerate(old):
        src = d / nn(i)
        if src.exists():
            if u in photos:
                moves.append((src, d / nn(photos.index(u))))
            else:
                src.rename(d / f"gone-{nn(i)}")
    tmp = []
    for src, dst in moves:
        t = src.with_name("mv-" + src.name)
        src.rename(t)
        tmp.append((t, dst))
    for t, dst in tmp:
        t.rename(dst)


def fetch_photos(fetcher, slug, photos, failures, allow_network):
    d = photo_dir(slug)
    d.mkdir(parents=True, exist_ok=True)
    align_photo_files(slug, photos)
    files, sizes, problems = [], [], []
    got = 0
    for i, u in enumerate(photos):
        path = d / nn(i)
        if not path.exists() and allow_network:
            key = f"photo:{u}"
            if key in failures and failures[key].get("permanent"):
                problems.append(f"photo {i + 1:02d} failed earlier: {failures[key]['why']}")
            else:
                try:
                    status, body, ctype = fetcher.get(u)
                    im = Image.open(io.BytesIO(body))
                    fmt = im.format
                    im.load()
                    if fmt == "JPEG":
                        write_bytes(path, body)
                    else:  # keep NN.jpg for every photo: convert the odd PNG or WebP
                        buf = io.BytesIO()
                        ImageOps.exif_transpose(im).convert("RGB").save(buf, "JPEG", quality=92)
                        write_bytes(path, buf.getvalue())
                        problems.append(f"photo {i + 1:02d} was {fmt}; converted to JPEG")
                    got += 1
                    failures.pop(key, None)
                except urllib.error.HTTPError as e:
                    failures[key] = {"why": f"HTTP {e.code}", "permanent": e.code in (403, 404, 410),
                                     "when": now_iso(), "slug": slug}
                    problems.append(f"photo {i + 1:02d}: HTTP {e.code}")
                except Exception as e:
                    failures[key] = {"why": f"{type(e).__name__}: {e}"[:200], "permanent": False,
                                     "when": now_iso(), "slug": slug}
                    problems.append(f"photo {i + 1:02d}: {type(e).__name__}: {e}"[:200])
        if path.exists():
            try:
                with Image.open(path) as im:
                    sizes.append([im.width, im.height])
                files.append(f"img/{slug}/{nn(i)}")
            except Exception as e:
                problems.append(f"photo {i + 1:02d} unreadable on disk: {e}"[:200])
                files.append(None)
                sizes.append(None)
        else:
            files.append(None)
            sizes.append(None)
    save_json(d / "index.json", {"slug": slug, "photos": photos})
    return files, sizes, problems, got


# ----------------------------------------------------------------------------------------------
# contact sheets
# ----------------------------------------------------------------------------------------------

def _font(size, bold=False):
    for f in (["DejaVuSans-Bold.ttf"] if bold else []) + ["DejaVuSans.ttf"]:
        for d in ("/usr/share/fonts/truetype/dejavu/", ""):
            try:
                return ImageFont.truetype(d + f, size)
            except OSError:
                pass
    return ImageFont.load_default()


def _wrap(draw, text, font, width):
    lines, line = [], ""
    for w in text.split():
        t = (line + " " + w).strip()
        if draw.textlength(t, font=font) <= width:
            line = t
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def contact_sheet(b, out_path, cols=5, cell=260, pad=10):
    """Every photo of one building, numbered as in data/aa/img/<slug>/NN.jpg, small."""
    files = b.get("img") or []
    n = len(files)
    rows = max(1, -(-n // cols))
    W = cols * (cell + pad) + pad
    f_title, f_text, f_num = _font(22, True), _font(15), _font(17, True)
    probe = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    head = [b.get("name") or b["slug"]]
    sub = " · ".join(x for x in [b.get("architect"), b.get("where"), b.get("category"),
                                  ("photos " + b["photographer"]) if b.get("photographer") else None] if x)
    sub_lines = _wrap(probe, sub, f_text, W - 2 * pad)
    head_h = pad + 30 + 20 * len(sub_lines) + pad
    label_h = 22
    H = head_h + rows * (cell + label_h + pad) + pad
    sheet = Image.new("RGB", (W, H), (245, 244, 240))
    dr = ImageDraw.Draw(sheet)
    dr.text((pad, pad), head[0], font=f_title, fill=(20, 20, 20))
    for k, line in enumerate(sub_lines):
        dr.text((pad, pad + 32 + 20 * k), line, font=f_text, fill=(70, 70, 70))
    for i, rel in enumerate(files):
        r, c = divmod(i, cols)
        x = pad + c * (cell + pad)
        y = head_h + r * (cell + label_h + pad)
        dr.rectangle([x, y, x + cell - 1, y + cell - 1], fill=(225, 223, 218))
        size = ""
        if rel:
            try:
                with Image.open(OUT / rel) as im:
                    size = f"{im.width}×{im.height}"
                    im = ImageOps.exif_transpose(im).convert("RGB")
                    im.thumbnail((cell, cell), Image.LANCZOS)
                    sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
            except Exception:
                size = "unreadable"
        else:
            size = "missing"
        dr.rectangle([x, y, x + 34, y + 24], fill=(20, 20, 20))
        dr.text((x + 5, y + 2), f"{i + 1:02d}", font=f_num, fill=(255, 255, 255))
        dr.text((x, y + cell + 3), size, font=f_text, fill=(90, 90, 90))
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "JPEG", quality=85)


# ----------------------------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", help="a local architecture.json instead of the branch file")
    ap.add_argument("--no-git-fetch", action="store_true", help="use the last fetched branch as it is")
    ap.add_argument("--offline", action="store_true", help="no network at all: rebuild from the cache")
    ap.add_argument("--only", nargs="+", metavar="SLUG", help="gather these slugs only (the raw file keeps the rest)")
    ap.add_argument("--refresh", nargs="+", default=[], metavar="SLUG", help="fetch these pages again")
    ap.add_argument("--no-photos", action="store_true", help="pages and text only")
    ap.add_argument("--retry-failed", action="store_true", help="ask again for pages and photos that 404'd")
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between requests (at least 1)")
    ap.add_argument("--sheets", metavar="DIR", help="write a numbered contact sheet per building to DIR/<slug>.jpg")
    args = ap.parse_args()
    args.delay = max(1.0, args.delay)

    PAGES.mkdir(parents=True, exist_ok=True)
    IMG.mkdir(parents=True, exist_ok=True)
    entries, cats, projects, src = read_list(args)
    failures = load_json(FAILURES, {})
    if args.retry_failed:
        failures = {k: v for k, v in failures.items() if not v.get("permanent")}
    previous = {b["slug"]: b for b in load_json(RAW, {}).get("buildings", [])}
    fetcher = Fetcher(args.delay)
    net = not args.offline

    buildings, skipped, page_failures = [], [], []
    stats = {"pages_fetched": 0, "photos_fetched": 0}
    for k, e in enumerate(entries):
        slug, url = e.get("slug"), e.get("url") or ""
        if args.only and slug not in args.only:
            if slug in previous:
                buildings.append(previous[slug])
            continue
        if not url.startswith(ARTICLE_PREFIX):
            skipped.append({"slug": slug, "url": url,
                            "why": "not an Architectural Authority article"
                                   + (f" (added by hand from {e.get('source')})" if e.get("source") else "")})
            continue
        page = PAGES / f"{slug}.html"
        pkey = f"page:{url}"
        if (not page.exists() or slug in args.refresh) and net:
            if pkey in failures and failures[pkey].get("permanent"):
                page_failures.append({"slug": slug, "url": url, "why": failures[pkey]["why"] + " (earlier)"})
                continue
            if not fetcher.allowed(url):
                page_failures.append({"slug": slug, "url": url, "why": "robots.txt disallows it"})
                continue
            log(f"[{k + 1}/{len(entries)}] page {slug}")
            try:
                status, body, ctype = fetcher.get(url)
                text = body.decode("utf-8", errors="replace")
                if not looks_like_article(text):
                    raise ValueError(f"no article in the answer ({ctype}, {len(body)} bytes)")
                write_bytes(page, body)
                stats["pages_fetched"] += 1
                failures.pop(pkey, None)
            except urllib.error.HTTPError as err:
                failures[pkey] = {"why": f"HTTP {err.code}", "permanent": err.code in (404, 410),
                                  "when": now_iso(), "slug": slug}
                page_failures.append({"slug": slug, "url": url, "why": f"HTTP {err.code}"})
                save_json(FAILURES, failures)
                continue
            except Exception as err:
                failures[pkey] = {"why": f"{type(err).__name__}: {err}"[:200], "permanent": False,
                                  "when": now_iso(), "slug": slug}
                page_failures.append({"slug": slug, "url": url, "why": failures[pkey]["why"]})
                save_json(FAILURES, failures)
                continue
        if not page.exists():
            page_failures.append({"slug": slug, "url": url, "why": "not fetched yet (offline)"})
            continue

        text = page.read_text(errors="replace")
        info = parse_page(text, e)
        cat = cats.get(slug, {})
        b = {
            "slug": slug,
            "url": url,
            "name": e.get("name"),
            "title": info["title"] or e.get("title"),
            "architect": info["architect"],
            "architect_from": info["architect_from"],
            "credits": info["credits"],
            "photographer": info["photographer"],
            "category": cat.get("category") or info["series"],
            "category_from": "residential/bookmarks.json" if cat.get("category") else
                             ("page" if info["series"] else None),
            "series": info["series"],
            "city": e.get("city"),
            "country": e.get("country"),
            "where": e.get("where"),
            "lat": e.get("lat"),
            "lon": e.get("lon"),
            "precision": e.get("precision"),
            "page_place": info["page_place"],
            "published": info["published"],
            "first_seen": cat.get("first_seen"),
            "og_title": info["og_title"],
            "og_description": info["og_description"],
            "quote": info["quote"],
            "description": info["description"],
            "paragraphs": info["paragraphs"],
            "years": info["years"],
            "article_id": info["article_id"],
            "photos": info["photos"],
            "page": f"pages/{slug}.html",
        }
        if slug in projects:
            b["project"] = projects[slug]
        if info["photos_unrendered"]:
            b["photos_unrendered"] = info["photos_unrendered"]
        problems = []
        if not info["photos"]:
            problems.append("no photographs found on the page")
        if not info["architect"]:
            problems.append("no architect in og:title, the title or the credits")
        if not info["paragraphs"]:
            problems.append("no article text found")
        if not args.no_photos:
            if info["photos"] and net:
                log(f"[{k + 1}/{len(entries)}] photos {slug}: {len(info['photos'])}")
            files, sizes, pprob, got = fetch_photos(fetcher, slug, info["photos"], failures,
                                                    allow_network=net)
            stats["photos_fetched"] += got
            problems += pprob
            b["img"], b["sizes"] = files, sizes
            save_json(FAILURES, failures)
        b["problems"] = problems
        buildings.append(b)

    order = {e.get("slug"): i for i, e in enumerate(entries)}
    buildings.sort(key=lambda b: order.get(b["slug"], 1 << 30))
    n_photos = sum(len(b.get("photos") or []) for b in buildings)
    n_files = sum(1 for b in buildings for f in (b.get("img") or []) if f)
    out = {
        "version": 1,
        "gathered": now_iso(),
        "source": f"The artist's Architectural Authority bookmarks ({src}); category from "
                  "residential/bookmarks.json; project hints from residential/projects/",
        "counts": {"listed": len(entries), "buildings": len(buildings), "photos": n_photos,
                   "photo_files": n_files, "skipped": len(skipped), "page_failures": len(page_failures)},
        "skipped": skipped,
        "failures": page_failures,
        "buildings": buildings,
    }
    save_json(RAW, out)
    save_json(FAILURES, failures)

    if args.sheets:
        for b in buildings:
            if args.only and b["slug"] not in args.only:
                continue
            contact_sheet(b, Path(args.sheets) / f"{b['slug']}.jpg")

    log(f"\n{len(buildings)} buildings, {n_photos} photo addresses, {n_files} photo files on disk; "
        f"fetched now: {stats['pages_fetched']} pages, {stats['photos_fetched']} photos "
        f"({fetcher.count} requests)")
    for s in skipped:
        log(f"  skipped {s['slug']}: {s['why']}")
    for f in page_failures:
        log(f"  failed {f['slug']}: {f['why']}")
    for b in buildings:
        for p in b.get("problems", []):
            log(f"  {b['slug']}: {p}")
    log(f"wrote {RAW}")


if __name__ == "__main__":
    main()
