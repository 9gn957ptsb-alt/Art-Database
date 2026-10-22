#!/usr/bin/env python3
"""Build the 5s page: src/ -> OUT (default 5s/dist).

    python3 5s/build_page.py [--deck DIR] [--out DIR]

Writes OUT/index.html (src/index.html with app.css inlined in a <style> right after the <title> and
<meta> at the top, as the Artifact page contract asks), copies engine.js, bring.js, ground.js, the
hub's hub.js and hubpage.js, and app.js into OUT (the page loads them in that order, and the build
stops if src/index.html loads any other list), copies DECK/deck.json and DECK/img/ (and
DECK/logo.webp when present) into OUT when DECK is not OUT, and writes OUT/dev.html: the same page
wrapped in the skeleton the Artifact platform adds at publish, for local testing.
"""
import argparse
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
# In the order src/index.html loads them: the hub's drivers (hub.js, hubpage.js) before app.js.
# Connect your apps adds connect.js (FiveSConnect: data files read on the device, the 5s connector), also before app.js.
SCRIPTS = ['engine.js', 'bring.js', 'ground.js', 'hub.js', 'hubpage.js', 'connect.js', 'app.js']
SCRIPT_RE = re.compile(r'<script\s+src="([^"]+)"')

SKELETON_HEAD = (
    '<!doctype html><html><head><meta charset=utf8>'
    '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);'
    'padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}'
    'img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
)
SKELETON_TAIL = '</body></html>'

LINK_RE = re.compile(r'<link\s+rel="stylesheet"\s+href="app\.css"[^>]*>\s*\n?')


def build_page():
    with open(os.path.join(SRC, 'index.html'), encoding='utf-8') as f:
        html = f.read()
    with open(os.path.join(SRC, 'app.css'), encoding='utf-8') as f:
        css = f.read()
    if '</style' in css.lower():
        sys.exit('app.css must not contain "</style"')
    style = '<style>\n' + css.rstrip() + '\n</style>\n'
    if LINK_RE.search(html):
        html = LINK_RE.sub(lambda m: style, html, count=1)
    else:
        # No placeholder: put the style right after the leading <title>/<meta> lines.
        m = re.match(r'(\s*(?:<title>.*?</title>|<meta[^>]*>)\s*)+', html, re.S)
        cut = m.end() if m else 0
        html = html[:cut] + style + html[cut:]
    if not html.lstrip().startswith('<title>'):
        sys.exit('src/index.html must start with <title>')
    for tag in ('!doctype', 'html', 'head', 'body'):
        if re.search(r'<' + re.escape(tag) + r'[\s>]', html, re.I):
            sys.exit('src/index.html must not contain <' + tag + '>')
    # Every script the page loads ships with it, and in the order above (hub.js and hubpage.js
    # define FiveSHub and FiveSHubPage, which app.js reads when it starts).
    loaded = SCRIPT_RE.findall(html)
    if loaded != SCRIPTS:
        sys.exit('src/index.html loads %s; build_page.py ships %s (same files, same order)' % (loaded, SCRIPTS))
    return html


def copy_tree(src, dst):
    if os.path.isdir(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--deck', default=os.path.join(HERE, 'dist'), help='folder holding deck.json and img/ (default 5s/dist)')
    ap.add_argument('--out', default=os.path.join(HERE, 'dist'), help='output folder (default 5s/dist)')
    args = ap.parse_args(argv)
    deck = os.path.abspath(args.deck)
    out = os.path.abspath(args.out)
    os.makedirs(out, exist_ok=True)

    page = build_page()
    with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(page)
    with open(os.path.join(out, 'dev.html'), 'w', encoding='utf-8') as f:
        f.write(SKELETON_HEAD + page + SKELETON_TAIL)
    for name in SCRIPTS:
        shutil.copyfile(os.path.join(SRC, name), os.path.join(out, name))

    copied = []
    if deck != out:
        deck_json = os.path.join(deck, 'deck.json')
        if not os.path.isfile(deck_json):
            sys.exit('no deck.json in ' + deck)
        shutil.copyfile(deck_json, os.path.join(out, 'deck.json'))
        copied.append('deck.json')
        if os.path.isdir(os.path.join(deck, 'img')):
            copy_tree(os.path.join(deck, 'img'), os.path.join(out, 'img'))
            copied.append('img/')
        logo = os.path.join(deck, 'logo.webp')
        if os.path.isfile(logo):
            shutil.copyfile(logo, os.path.join(out, 'logo.webp'))
            copied.append('logo.webp')

    size = os.path.getsize(os.path.join(out, 'index.html'))
    print('built %s (index.html %d bytes; %s%s)' % (
        out, size, ', '.join(SCRIPTS), (', ' + ', '.join(copied)) if copied else ''))


if __name__ == '__main__':
    main()
