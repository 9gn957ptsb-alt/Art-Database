#!/usr/bin/env python3
"""Build the 5s page: src/ -> OUT (default 5s/dist).

    python3 5s/build_page.py [--deck DIR] [--out DIR]

Writes OUT/index.html (src/index.html with app.css inlined in a <style> right after the <title> and
<meta> at the top, as the Artifact page contract asks, and play.css inlined as <style data-fives="play">),
copies engine.js, bring.js, ground.js, the hub's hub.js and hubpage.js, connect.js, Set's game (match.js,
relate.js, board.js, play.js, and its kingdom map, kingdom.js), the photo room (room.js), links.js, the logo in motion (motion.js, built: see build_motion) and app.js into OUT (the page loads them in that order, and the build
stops if src/index.html loads any other list), copies DECK/deck.json and DECK/img/ (and
DECK/logo.webp when present) into OUT when DECK is not OUT, and writes OUT/dev.html: the same page
wrapped in the skeleton the Artifact platform adds at publish, for local testing.
"""
import argparse
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
# In the order src/index.html loads them: the hub's drivers (hub.js, hubpage.js) before app.js.
# Connect your apps adds connect.js (FiveSConnect: data files read on the device, the 5s connector), also before app.js.
# Links out and in adds links.js (FiveSLinks: where a thing lives, what a pasted link is), also before app.js.
# Set's game adds match.js (FiveSMatch), board.js (FiveSBoard) and play.js (FiveSPlay), also before app.js.
# Set's kingdom adds kingdom.js (FiveSKingdom: the kingdom map), after play.js.
# See it as a room adds room.js (FiveSRoom: a kept interior's photograph as the room, the things placed in it), after kingdom.js.
# Set, inside out adds relate.js (FiveSRelate: the deal from kept things, relations, Sort's ask), after match.js.
# Its other eyes (deck.json's rhymes, words and each card's comp and feel) reach the page only in DECK's deck.json,
# which build_deck.py writes to the git-ignored dist from data/5s.
# The logo in motion adds motion.js (FiveSMotion: the logo, the artist's opening Motion Lab pick at rest, playing every
# 30 seconds), after links.js: built here from motion/marks.js, the pick's family, src/motion-picks.json and src/motion.js
# (build_motion below). Of the sixteen picks the app uses only these:
MOTION_USED = ('launch',)
SCRIPTS = ['engine.js', 'bring.js', 'ground.js', 'hub.js', 'hubpage.js', 'connect.js', 'match.js', 'relate.js', 'board.js', 'play.js', 'kingdom.js', 'room.js', 'links.js', 'motion.js', 'app.js']
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
# The game's and the board's styles: inlined under the attribute play.js and board.js look for, so they add no <link>.
PLAY_RE = re.compile(r'<link\s+rel="stylesheet"\s+href="play\.css"\s+data-fives="play"\s*>\s*\n?')


def build_page():
    with open(os.path.join(SRC, 'index.html'), encoding='utf-8') as f:
        html = f.read()
    with open(os.path.join(SRC, 'app.css'), encoding='utf-8') as f:
        css = f.read()
    with open(os.path.join(SRC, 'play.css'), encoding='utf-8') as f:
        play_css = f.read()
    if '</style' in css.lower() or '</style' in play_css.lower():
        sys.exit('app.css and play.css must not contain "</style"')
    if not PLAY_RE.search(html):
        sys.exit('src/index.html must link play.css with data-fives="play"')
    html = PLAY_RE.sub(lambda m: '<style data-fives="play">\n' + play_css.rstrip() + '\n</style>\n', html, count=1)
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


def build_motion():
    """dist/motion.js: the lab's engine, the families the used picks need, those picks, then the app's logo."""
    motion = os.path.join(HERE, 'motion')
    with open(os.path.join(SRC, 'motion-picks.json'), encoding='utf-8') as f:
        picks = json.load(f)['picks']
    picks = {k: v for k, v in picks.items() if k in MOTION_USED}
    parts = [open(os.path.join(motion, 'marks.js'), encoding='utf-8').read()]
    for fam in sorted({p['family'] for p in picks.values()}):
        path = os.path.join(motion, 'families', fam + '.js')
        if not os.path.isfile(path):
            sys.exit('motion-picks.json picks the family %r, which motion/families/ does not have' % fam)
        parts.append(open(path, encoding='utf-8').read())
    parts.append('window.FiveSMotionPicks = ' + json.dumps(picks, separators=(',', ':')) + ';')
    parts.append(open(os.path.join(SRC, 'motion.js'), encoding='utf-8').read())
    return '\n;\n'.join(parts)


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
        if name == 'motion.js':
            with open(os.path.join(out, name), 'w', encoding='utf-8') as f:
                f.write(build_motion())
        else:
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
