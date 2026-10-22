#!/usr/bin/env python3
"""Build the 5s Motion Lab: 5s/motion -> 5s/motion/dist.

    python3 5s/motion/build.py [--out DIR]

Writes
  dist/index.html   index.html with lab.css inlined in a <style> right after the leading <title>/<meta>
                    (the Artifact page contract: no doctype/html/head/body, the platform wraps it)
  dist/marks.js     the mark and the engine (copied)
  dist/families.js  every families/*.js, pulse first (the reference family), then alphabetical; each file
                    is wrapped so a family that throws while registering cannot stop the ones after it
  dist/lab.js       the lab (copied)
  dist/logo.webp    copied from 5s/dist/logo.webp (the app's cropped logo) when it is there
  dist/dev.html     the page wrapped in the skeleton the Artifact platform adds at publish, for local testing

Publish dist/index.html with files {marks.js, families.js, lab.js, logo.webp} and
capabilities {db: {}, user: {}, downloads: true}.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FAMILIES = os.path.join(HERE, 'families')
LOGO = os.path.join(os.path.dirname(HERE), 'dist', 'logo.webp')

SKELETON_HEAD = (
    '<!doctype html><html><head><meta charset=utf8>'
    '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);'
    'padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}'
    'img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
)
SKELETON_TAIL = '</body></html>'

LINK_RE = re.compile(r'<link\s+rel="stylesheet"\s+href="lab\.css"[^>]*>\s*\n?')
HEAD_RE = re.compile(r'(\s*(?:<title>.*?</title>|<meta[^>]*>)\s*)+', re.S)


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def write(path, text):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def build_page():
    html = read(os.path.join(HERE, 'index.html'))
    css = read(os.path.join(HERE, 'lab.css'))
    if '</style' in css.lower():
        sys.exit('lab.css must not contain "</style"')
    if not html.lstrip().startswith('<title>'):
        sys.exit('index.html must start with <title>')
    for tag in ('!doctype', 'html', 'head', 'body'):
        if re.search(r'<' + re.escape(tag) + r'[\s>]', html, re.I):
            sys.exit('index.html must not contain <' + tag + '>')
    html = LINK_RE.sub('', html, count=1)
    m = HEAD_RE.match(html)
    cut = m.end() if m else 0
    head = html[:cut].rstrip() + '\n'
    return head + '<style>\n' + css.rstrip() + '\n</style>\n' + html[cut:]


def syntax_ok(path):
    """True when node can parse the file (or node is not installed)."""
    node = shutil.which('node')
    if not node:
        return True, ''
    r = subprocess.run([node, '--check', path], capture_output=True, text=True)
    lines = [ln.strip() for ln in (r.stderr or '').splitlines() if ln.strip()]
    err = next((ln for ln in lines if 'Error' in ln), lines[0] if lines else '')
    where = lines[0].rsplit('/', 1)[-1] if lines else ''
    return r.returncode == 0, (where + ': ' + err) if err else ''


def build_families():
    names = sorted(f for f in os.listdir(FAMILIES) if f.endswith('.js')) if os.path.isdir(FAMILIES) else []
    if 'pulse.js' in names:
        names.remove('pulse.js')
        names.insert(0, 'pulse.js')
    parts = [
        '/* 5s Motion Lab: families.js, built by build.py from families/*.js (pulse first, then alphabetical).\n'
        ' * Each family is wrapped so one that throws while registering cannot stop the others;\n'
        ' * what failed is listed in window.MotionLoadErrors. */\n'
        'window.MotionLoadErrors = window.MotionLoadErrors || [];\n'
    ]
    included, skipped = [], []
    for name in names:
        path = os.path.join(FAMILIES, name)
        ok, err = syntax_ok(path)
        if not ok:
            skipped.append((name, err))
            parts.append('window.MotionLoadErrors.push({file: %r, error: "syntax error: not built"});\n' % name)
            continue
        src = read(path)
        parts.append(
            '\n/* ---- families/%s ---- */\n'
            'try {\n%s\n} catch (e) {\n'
            '  window.MotionLoadErrors.push({file: %r, error: String(e && e.message || e)});\n'
            '  if (window.console) console.warn("[Motion Lab] families/%s did not load: " + (e && e.message));\n'
            '}\n' % (name, src.rstrip(), name, name)
        )
        included.append(name)
    return ''.join(parts), included, skipped


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--out', default=os.path.join(HERE, 'dist'), help='output folder (default 5s/motion/dist)')
    args = ap.parse_args(argv)
    out = os.path.abspath(args.out)
    os.makedirs(out, exist_ok=True)

    page = build_page()
    write(os.path.join(out, 'index.html'), page)
    write(os.path.join(out, 'dev.html'), SKELETON_HEAD + page + SKELETON_TAIL)
    for name in ('marks.js', 'lab.js'):
        shutil.copyfile(os.path.join(HERE, name), os.path.join(out, name))
    fams, included, skipped = build_families()
    write(os.path.join(out, 'families.js'), fams)
    logo = 'missing'
    if os.path.isfile(LOGO):
        shutil.copyfile(LOGO, os.path.join(out, 'logo.webp'))
        logo = 'copied'

    print('built %s' % out)
    print('  index.html  %6d bytes (lab.css inlined)' % len(page.encode('utf-8')))
    print('  dev.html    for local testing (the platform skeleton around the page)')
    print('  marks.js, lab.js copied; logo.webp %s' % logo)
    print('  families.js %d families: %s' % (len(included), ', '.join(n[:-3] for n in included)))
    for name, err in skipped:
        print('  SKIPPED families/%s: %s' % (name, err), file=sys.stderr)
    if logo == 'missing':
        print('  note: %s not found; the brand mark falls back to the drawn logo' % LOGO, file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
