#!/usr/bin/env python3
"""Ask each host in scripts/sources.json, from this session, whether it can be reached — and write it down.

The artist, 10 Oct 2026: "I want you to continuously do research on finding domains to add to the
environment network access that would help you develop a better image of the globe and all of its
contents. Focusing specifically on how things look, I want to make sure that we are accurate in our
depiction of the globe and it's content". NETWORK.md is the ledger; this keeps its states true.

Each host is asked twice. First the session's proxy alone (a CONNECT, nothing fetched): does the
network policy let it through? It refuses in words ("no rule or allowlist entry allows host").
Then the host itself (a GET of the source's probe address): does it answer, and with what?

  open     the policy lets it through and the host answers (any status: 2xx usable; 401, 403, 429 said)
  refused  the policy refuses it: a domain to ask the artist for (NETWORK.md's block)
  stalls   the policy lets it through but nothing comes back (Overpass, Geofabrik): GitHub's runners
  silent   the policy lets it through and the host answers nothing it can read (TLS, reset, timeout)

Writes each host's state and the date into sources.json, prints what changed since the last probe
(a host newly open is one the artist has added: put it to use), and rewrites NETWORK.md's generated
parts between their markers: the block of domains to ask for, and the table of every host.

  python3 scripts/probe_sources.py              probe every host
  python3 scripts/probe_sources.py --pending    only the hosts not open
  python3 scripts/probe_sources.py --host H ... only these
  python3 scripts/probe_sources.py --write-only rewrite NETWORK.md from sources.json, no network
"""
import argparse
import json
import os
import re
import socket
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(ROOT, 'scripts', 'sources.json')
LEDGER = os.path.join(ROOT, 'NETWORK.md')
UA = 'ArtDatabaseProbe/1.0 (https://9gn957ptsb-alt.github.io/Art-Database/)'
FACETS = ['earth', 'cities', 'museums', 'life', 'past']
FACET_WORDS = {'earth': 'The Earth from above', 'cities': 'Cities and buildings',
               'museums': 'Museums and works', 'life': 'Plants and animals', 'past': 'Places as they were'}


def proxy():
    p = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    if not p:
        return None
    u = urllib.parse.urlparse(p)
    return u.hostname, u.port or 80


def policy(host, port=443):
    """The proxy's answer to a CONNECT: ('ok', '') or ('refused', its words), or (None, why) with no proxy."""
    px = proxy()
    if not px:
        return None, 'no proxy'
    try:
        s = socket.create_connection(px, timeout=15)
    except OSError as e:
        return None, 'proxy not reached: %s' % e
    try:
        s.sendall(('CONNECT %s:%d HTTP/1.1\r\nHost: %s:%d\r\n\r\n' % (host, port, host, port)).encode())
        data = b''
        while b'\r\n\r\n' not in data:
            chunk = s.recv(4096)
            if not chunk:
                break
            data += chunk
        head, _, body = data.partition(b'\r\n\r\n')
        first = head.split(b'\r\n', 1)[0].decode('latin-1')
        if ' 200 ' in first + ' ':
            return 'ok', ''
        m = re.search(rb'Content-Length:\s*(\d+)', head, re.I)
        want = int(m.group(1)) if m else 0
        s.settimeout(5)
        while len(body) < want:
            chunk = s.recv(4096)
            if not chunk:
                break
            body += chunk
        said = body.decode('utf-8', 'replace').strip() or first
        return 'refused', said[:160]
    except OSError as e:
        return None, 'proxy: %s' % e
    finally:
        s.close()


def tls(extra=False):
    """The default context; with `extra`, certifi's roots added too (verification stays on), for a host
    whose chain is incomplete (gdi.berlin.de, as build_built_years.py reads it)."""
    c = ssl.create_default_context()
    if extra:
        try:
            import certifi
            c.load_verify_locations(certifi.where())
        except Exception:
            pass
    return c


def fetch(url, timeout=25, extra=False):
    """The host's own answer: (code, said) or (None, why)."""
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=tls(extra)) as r:
            r.read(2048)
            return r.status, '%s in %.1f s' % (r.headers.get('Content-Type', '').split(';')[0] or 'answer', time.time() - t)
    except urllib.error.HTTPError as e:
        return e.code, (e.reason or '')[:80] if isinstance(e.reason, str) else str(e.code)
    except urllib.error.URLError as e:
        if not extra and 'CERTIFICATE_VERIFY_FAILED' in str(e.reason):
            return fetch(url, timeout, True)
        return None, str(e.reason)[:160]
    except Exception as e:  # a timeout, a reset, a handshake that never ends
        return None, ('%s: %s' % (type(e).__name__, e))[:160]


def probe(h):
    """One host: its state, the HTTP code if any, and what was said."""
    url = h.get('probe') or 'https://%s/' % h['host'].lstrip('*.')
    # A wildcard (*.us.archive.org) is asked about through one of its hosts, the probe's.
    pol, why = policy(urllib.parse.urlparse(url).hostname if h['host'].startswith('*.') else h['host'])
    if pol == 'refused':
        return {'state': 'refused', 'code': None, 'said': why}
    code, said = fetch(url)
    if code is not None:
        return {'state': 'open', 'code': code, 'said': said}
    if pol == 'ok' and re.search(r'timed out|reset|EOF|handshake|closed', said, re.I):
        return {'state': 'stalls', 'code': None, 'said': said}
    if pol is None and re.search(r'403 Forbidden', said):
        return {'state': 'refused', 'code': None, 'said': said}
    return {'state': 'silent', 'code': None, 'said': said}


def hosts_of(src):
    return [h for s in src['sources'] for h in s.get('hosts', [])]


# ---- the ledger's generated parts ----

NEVER_ASK = ('browser', 'alt', 'unconfirmed')   # a page for people, an alternative not needed, not yet seen


def wanted(s):
    return s.get('state') != 'dropped' and not s.get('key_needed')


def order(s):
    return (s.get('priority', 3), FACETS.index(s['facet']) if s.get('facet') in FACETS else 9, s['name'].lower())


def ask_block(src, level=1, before=()):
    """The domains to ask for at a priority: refused hosts the session needs, of sources wanted without a
    sign-up, most needed first, once each, none already in an earlier block."""
    seen, rows = set(before), []
    for s in sorted(src['sources'], key=order):
        if not wanted(s) or s.get('priority', 3) != level:
            continue
        for h in s.get('hosts', []):
            if h.get('state') == 'refused' and h.get('role') not in NEVER_ASK and h['host'] not in seen:
                seen.add(h['host'])
                rows.append(h['host'])
    return rows


def open_now(src):
    """The sources whose every needed host answers now and that nothing reads yet, most needed first."""
    out = []
    for s in sorted(src['sources'], key=order):
        if s.get('state') == 'allowed':
            out.append('- **%s** (P%d) — %s' % (s['name'], s.get('priority', 3), cell(s.get('improves'))[:260].rstrip() +
                                                ('…' if len(cell(s.get('improves'))) > 260 else '')))
    return '\n'.join(out) + '\n' if out else 'None.\n'


def sign_ups(src):
    """The sources that need the artist to sign up first: what, and the hosts they would then need."""
    out = []
    for s in sorted(src['sources'], key=order):
        if s.get('state') == 'dropped' or not s.get('key_needed'):
            continue
        hs = [h['host'] for h in s.get('hosts', []) if h.get('state') == 'refused' and h.get('role') not in NEVER_ASK]
        out.append('- **%s** — %s; then %s' % (s['name'], cell(s.get('key')), ', '.join('`%s`' % h for h in hs) or 'nothing more'))
    return '\n'.join(out) + '\n' if out else 'None.\n'


def word(h):
    """A host's state in the table: open (with the code when it is not a plain answer), to ask, stalls, silent."""
    w = {'open': 'open', 'refused': 'to ask', 'stalls': 'stalls', 'silent': 'silent'}.get(h.get('state'), 'not probed')
    if h.get('state') == 'open' and h.get('code') and h['code'] >= 400:
        w += ' (%d)' % h['code']
    return w


def cell(t):
    return str(t or '').replace('|', '/').replace('\n', ' ').strip()


def table(src):
    out = []
    for f in FACETS:
        group = [s for s in src['sources'] if s.get('facet') == f]
        if not group:
            continue
        out.append('### %s\n' % FACET_WORDS[f])
        out.append('| Source | Hosts | Would make truer | Licence | State |')
        out.append('| --- | --- | --- | --- | --- |')
        for s in sorted(group, key=lambda s: (s.get('state') == 'dropped', s.get('priority', 3), s['name'].lower())):
            hs = ', '.join('`%s` %s' % (h['host'], word(h)) for h in s.get('hosts', []))
            state = s.get('state', 'candidate')
            if s.get('used_by'):
                state += ' · ' + s['used_by']
            if state.startswith('dropped') and s.get('why'):
                state += ': ' + s['why']
            lic = cell(s.get('licence'))
            if s.get('key_needed'):
                lic += ' · key: ' + cell(s.get('key'))
            out.append('| **%s** (P%d) %s | %s | %s | %s | %s |' % (
                cell(s['name']), s.get('priority', 3), cell(s.get('what')), hs, cell(s.get('improves')),
                lic, cell(state)))
        out.append('')
    return '\n'.join(out).rstrip() + '\n'


def splice(text, name, body):
    a, b = '<!-- %s:begin -->' % name, '<!-- %s:end -->' % name
    if a not in text or b not in text:
        raise SystemExit('NETWORK.md has no %s markers' % name)
    head, rest = text.split(a, 1)
    _, tail = rest.split(b, 1)
    return head + a + '\n' + body + b + tail


def write_ledger(src):
    if not os.path.exists(LEDGER):
        return
    text = open(LEDGER).read()
    first = ask_block(src, 1)
    later = ask_block(src, 2, first)
    fence = lambda rows, none: ('```\n' + '\n'.join(rows) + '\n```\n') if rows else none + '\n'
    text = splice(text, 'ask', fence(first, 'Nothing to ask for now: every host of the first sources answers.'))
    text = splice(text, 'later', fence(later, 'None.'))
    text = splice(text, 'keys', sign_ups(src))
    text = splice(text, 'open', open_now(src))
    text = splice(text, 'table', table(src))
    probed = src.get('probed') or ''
    text = re.sub(r'(<!-- probed -->).*?(<!-- /probed -->)', r'\g<1>%s\g<2>' % probed, text)
    with open(LEDGER, 'w') as fh:
        fh.write(text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pending', action='store_true', help='only the hosts not open')
    ap.add_argument('--host', nargs='*')
    ap.add_argument('--write-only', action='store_true')
    ap.add_argument('--jobs', type=int, default=8)
    a = ap.parse_args()
    src = json.load(open(SOURCES))
    if not a.write_only:
        every = {}
        for h in hosts_of(src):
            every.setdefault(h['host'], h)
        todo = [h for h in every.values()
                if (not a.host or h['host'] in a.host) and (not a.pending or h.get('state') != 'open')]
        today = time.strftime('%Y-%m-%d', time.gmtime())
        with ThreadPoolExecutor(max_workers=max(1, a.jobs)) as pool:
            got = dict(zip([h['host'] for h in todo], pool.map(probe, todo)))
        changed = []
        for h in hosts_of(src):
            r = got.get(h['host'])
            if not r:
                continue
            if h.get('state') and h.get('state') != r['state']:
                changed.append((h['host'], h['state'], r['state']))
            h.update(r)
            h['seen'] = today
            if r['code'] is None:
                h.pop('code', None)
        # Once each, however many sources share a host.
        changed = sorted(set(changed))
        src['probed'] = time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())
        for s in src['sources']:
            states = {h.get('state') for h in s.get('hosts', []) if h.get('role') not in NEVER_ASK}
            if s.get('state') in ('candidate', 'asked') and states == {'open'}:
                s['state'] = 'allowed'
        with open(SOURCES, 'w') as fh:
            json.dump(src, fh, indent=1, ensure_ascii=False)
            fh.write('\n')
        n = {}
        for r in got.values():
            n[r['state']] = n.get(r['state'], 0) + 1
        print('probed %d hosts: %s' % (len(got), ', '.join('%d %s' % (v, k) for k, v in sorted(n.items()))))
        for host, was, now in changed:
            print('  %s: %s -> %s%s' % (host, was, now, '   <- newly open: put it to use' if now == 'open' else ''))
    write_ledger(src)
    first = ask_block(src, 1)
    print('to ask for: %d domains first, %d later, %d sources wait on a sign-up' % (
        len(first), len(ask_block(src, 2, first)), sum(1 for s in src['sources'] if s.get('key_needed'))))


if __name__ == '__main__':
    sys.exit(main())
