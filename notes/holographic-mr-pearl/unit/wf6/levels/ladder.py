#!/usr/bin/env python3
"""THE FIBONACCI LADDER (wf6/levels, run 2): the unit's modularity with itself across scales.

Unit of length: u = a third of a block's drawn edge (L/3, L = sqrt(2/3)). F = Fibonacci (F1 = F2 = 1).
A FRAME of level m is a figure-shaped place with lengths, in u,
    hole F(m), growth F(m+1), side F(m+2), tribar F(m+3), outline F(m+4)       (each the sum of the two before)
  * level 2 (1, 2, 3, 5, 8) is the original drawing exactly (H = 1/9): THE LEAF, one block, drawn as the drawing.
  * CORNERS: a level-m frame holds three level-(m-1) frames at its corners, centred at (F(m+2)/3) TRI_k: their
    outlines (F(m+3)) are its tribars' outlines; they overlap pairwise in triangles of side F(m+1); their joint
    opening is its hole, side 2F(m+2) - F(m+3) = F(m).
  * OPENING: a level-m frame's hole (side F(m)) is exactly the outline of a level-(m-4) frame, inverted (point
    reflection through the frame's centre: on the lattice, faces still toned by their axis).
  * a leaf in a level-m frame is the drawing scaled by F(m+4)/8.
  Ratios between levels: F(m+3)/F(m+4) -> 1/phi (5/8, 8/13, 13/21, ...); hole/outline F(m)/F(m+4) -> phi^-4.
THE RULE (a node of information = a frame; its parts laid in by weight = how many details it holds):
  1. If the count is even, the lightest part (ties: the first in the node's own order) goes into the frame's opening.
  2. The rest (an odd count) are joined three at a time, lightest first (golden Huffman): each join is a figure of
     three, heaviest at A (top), then B (bottom-right), C (bottom-left), ties by own order; the last join fills the frame.
     One part left fills the frame itself (and anything it sends to the opening shares this frame's opening).
  3. An opening asked for by more than one part holds all of them, laid in by the same rule.
  4. The root's level K is the least that makes the smallest leaf level 2: every detail is at least one block.
  5. Depth: siblings are tilted along (1,1,1) (never changes the drawing) by kappa = 1/(3L) per drawing unit, each
     rising toward the joint where it lies over the next (A over B over C over A, the drawing's own cyclic order).
"""
import math, json
import numpy as np
import nest as N

PHI = N.PHI
LL = N.LL
H9 = 1 / 9


def F(n):
    a, b = 0, 1
    if n < 0:
        return (-1) ** (n + 1) * F(-n)
    for _ in range(n):
        a, b = b, a + b
    return a


def lengths(m):
    return dict(hole=F(m), growth=F(m + 1), side=F(m + 2), tribar=F(m + 3), outline=F(m + 4))


class Fr:
    """A frame: drawing centre ab (in block units of the drawing), level m, inverted?, tilts, info, path."""
    def __init__(self, ab, m, inv=False, tilts=(), path='', info=None, kind=''):
        self.ab, self.m, self.inv, self.tilts, self.path = np.asarray(ab, float), int(m), bool(inv), list(tilts), path
        self.info, self.kind = info, kind

    def corner(self, k, kappa):
        sg = -1.0 if self.inv else 1.0
        ab = self.ab + sg * F(self.m + 2) / 3 * N.TRI[k]
        tilts = self.tilts + [(N.point(self.ab), N.tilt_dir(k) * kappa)]
        return Fr(ab, self.m - 1, self.inv, tilts, self.path + k)

    def opening(self):
        return Fr(self.ab, self.m - 4, not self.inv, self.tilts, self.path + 'G')

    def scale(self):
        return F(self.m + 4) / 8

    def copy(self, level_tag=0):
        cls = N.GapFrame if self.inv else N.Frame
        f = cls(self.scale(), N.point(self.ab), 0.0, self.tilts, level=level_tag, slot=self.path)
        if self.inv:
            f.M = -np.eye(3)
        f.info = self.info
        return f


def weight(node):
    if '_w' not in node:
        ps = node.get('parts') or []
        node['_w'] = 1 if not ps else sum(weight(p) for p in ps)
    return node['_w']


def huffman3(parts):
    """Odd count: join the three lightest into a figure (heaviest A, B, C; ties own order) until one is left."""
    items = [(weight(p), i, ('leaf', p)) for i, p in enumerate(parts)]
    seq = len(items)
    while len(items) > 1:
        items.sort(key=lambda x: (x[0], x[1]))
        take, items = items[:3], items[3:]
        cs = sorted(take, key=lambda x: (-x[0], x[1]))
        items.append((sum(c[0] for c in cs), seq, ('join', [c[2] for c in cs])))
        seq += 1
    return items[0][2]


PAIR_RECORD = True
RECORDS = True


def layout(root, K=None, kappa=None):
    """Returns dict(leaves=[Fr], frames=[Fr], openings_used, joins, K). Two passes: relative levels, then K."""
    kappa = N.kappa_of(H9) if kappa is None else kappa
    out = dict(leaves=[], frames=[], openings_used=0, joins=0, open_joins=0)

    def fill(frame, node):
        claims = []
        lay(node, frame, claims)
        if claims:
            out['openings_used'] += 1
            g = frame.opening()
            g.kind = 'opening'
            fill(g, claims[0] if len(claims) == 1 else {'key': '(opening)', 'kind': 'opening', 'parts': claims})

    def lay(node, frame, claims):
        if frame.info is None or frame.info is not node:
            frame = Fr(frame.ab, frame.m, frame.inv, frame.tilts, frame.path, node, node.get('kind', ''))
        out['frames'].append(frame)
        parts = node.get('parts') or []
        if not parts:
            out['leaves'].append(frame)
            return
        rest = list(parts)
        if RECORDS and len(parts) >= 2:
            # rule D: every node has its own record (a leaf: what the thing itself is). Odd count: the record goes
            # into the frame's opening (the centre of the figure is the thing itself); even count: the record is
            # one more part, so the corners always take an odd count. One part: it fills the frame (no record).
            rec = {'key': '%s (itself)' % node.get('key'), 'kind': 'record', 'of': node.get('key')}
            if len(parts) % 2 == 1:
                claims.append(rec)
            else:
                rest = rest + [rec]
            join(huffman3(rest), frame)
            return
        if len(parts) == 2 and PAIR_RECORD:
            # two parts and the node's own record make a figure of three (rule C)
            rec = {'key': '%s (its own record)' % node.get('key'), 'kind': 'record', 'of': node.get('key')}
            join(huffman3(rest + [rec]), frame)
            return
        if len(parts) % 2 == 0:
            light = min(range(len(parts)), key=lambda i: (weight(parts[i]), i))
            claims.append(parts[light])
            rest = [p for i, p in enumerate(parts) if i != light]
        if len(rest) == 1:
            lay(rest[0], frame, claims)
            return
        join(huffman3(rest), frame)

    def join(t, frame):
        if t[0] == 'leaf':
            fill(frame, t[1])
            return
        out['joins'] += 1
        out['open_joins'] += 1          # a join's own opening stays open unless its node claims it (counted below)
        for k, sub in zip('ABC', t[1]):
            join(sub, frame.corner(k, kappa))

    if K is None:
        probe = layout(root, K=0, kappa=kappa)
        K = 2 - min(f.m for f in probe['leaves'])
    fill(Fr((0.0, 0.0), K), root)
    out['K'] = K
    return out


def nest_frames(m_top, m_leaf=2, openings=True, kappa=None):
    """Pure geometry: a level-m_top frame split by corners down to m_leaf (3^(m_top - m_leaf) leaves); with
    openings, every split frame's hole holds a level-(m-4) leaf (when m-4 >= 0)."""
    kappa = N.kappa_of(H9) if kappa is None else kappa
    leaves = []
    def go(fr, depth):
        if fr.m == m_leaf:
            fr.kind = 'leaf'; leaves.append(fr); return
        if openings and fr.m - 4 >= -1:
            g = fr.opening(); g.kind = 'opening'; leaves.append(g)
        for k in 'ABC':
            go(fr.corner(k, kappa), depth + 1)
    go(Fr((0, 0), m_top), 0)
    return leaves


if __name__ == '__main__':
    for m in range(0, 12):
        L = lengths(m)
        sums = L['hole'] + L['growth'] == L['side'] and L['growth'] + L['side'] == L['tribar'] and L['side'] + L['tribar'] == L['outline']
        print(m, L, 'sums' if sums else 'NO', 'r=%.5f (%.3f%% from 1/phi)' % (F(m + 3) / F(m + 4), 100 * (F(m + 3) / F(m + 4) * PHI - 1)),
              'hole/outline=%.5f vs phi^-4 %.5f' % (F(m) / F(m + 4), PHI ** -4))


# ---- run 2, rule B: the top-down golden split (size follows weight) ------------------------------------------
LOGPHI = math.log(PHI)


def ideal(q):
    """The level offset at which a part holding share q of its node would have ink share q (ink ~ length^2,
    one level = 1/phi in length): d* = log_phi(q) / 2 (<= 0)."""
    return math.log(q) / (2 * LOGPHI)


def lpt3(items):
    """items [(w, i, x)] heaviest first -> 3 groups as equal as possible (each to the lightest group; ties A, B, C)."""
    gs = [[], [], []]; ws = [0, 0, 0]
    for it in items:
        j = min(range(3), key=lambda k: (ws[k], k))
        gs[j].append(it); ws[j] += it[0]
    return gs, ws


def candidates(items):
    """The fixed set of ways to lay parts into a frame. Each: list of (slot, group), slot in 'F' (fill), 'A','B','C',
    'G' (opening); level offsets F 0, corners -1, G -4."""
    n = len(items)
    out = []
    if n == 1:
        return [[('F', items)]]
    out.append([('F', items[:1]), ('G', items[1:])])                       # the heaviest fills, the rest in its opening
    if n >= 3:
        gs, ws = lpt3(items)
        out.append([(k, g) for k, g in zip('ABC', gs)])                   # three corners
        for kk in range(1, n - 2):                                        # three corners + the lightest kk in the opening
            gs, ws = lpt3(items[:n - kk])
            out.append([(k, g) for k, g in zip('ABC', gs)] + [('G', items[n - kk:])])
    return out


OFF = {'F': 0, 'A': -1, 'B': -1, 'C': -1, 'G': -4}


def score(cand, W):
    return sum(sum(it[0] for it in g) * abs(OFF[s] - ideal(sum(it[0] for it in g) / W)) for s, g in cand)


def layout_split(root, K=None, kappa=None):
    """Rule B. For each node, its parts (heaviest first, ties own order) are laid by the candidate whose levels best
    match their shares (least sum of weight x |offset - ideal offset|; ties: the earlier candidate). A group of
    several parts in one slot is laid into that slot by the same rule. An opening asked for twice holds both."""
    kappa = N.kappa_of(H9) if kappa is None else kappa
    out = dict(leaves=[], frames=[], openings_used=0, joins=0)

    def node_frame(frame, node):
        f = Fr(frame.ab, frame.m, frame.inv, frame.tilts, frame.path, node, node.get('kind', ''))
        out['frames'].append(f)
        return f

    def fill(frame, items, claims):
        """Lay items [(w, i, node)] into frame; parts sent to this frame's opening are appended to claims."""
        if len(items) == 1:
            node = items[0][2]
            f = node_frame(frame, node)
            parts = node.get('parts') or []
            if not parts:
                out['leaves'].append(f); return
            sub = sorted([(weight(p), i, p) for i, p in enumerate(parts)], key=lambda x: (-x[0], x[1]))
            fill(f, sub, claims); return
        W = sum(it[0] for it in items)
        cs = candidates(items)
        best = min(range(len(cs)), key=lambda j: (score(cs[j], W), j))
        for slot, g in cs[best]:
            if slot == 'F':
                fill(frame, g, claims)
            elif slot == 'G':
                claims.extend(g)
            else:
                out['joins'] += 1 if slot == 'A' else 0
                own = []
                cf = frame.corner(slot, kappa)
                fill(cf, g, own)
                flush(cf, own)

    def flush(frame, claims):
        if claims:
            out['openings_used'] += 1
            g = frame.opening(); g.kind = 'opening'
            own = []
            fill(g, sorted(claims, key=lambda x: (-x[0], x[1])), own)
            flush(g, own)

    if K is None:
        probe = layout_split(root, K=0, kappa=kappa)
        K = 2 - min(f.m for f in probe['leaves'])
    top = Fr((0.0, 0.0), K)
    claims = []
    fill(top, [(weight(root), 0, root)], claims)
    flush(top, claims)
    out['K'] = K
    return out


def size_error(lay):
    """For every information node with parts and each part: (actual level offset) - (ideal offset from its share)."""
    fr = {}
    for f in lay['frames']:
        fr.setdefault(id(f.info), f)
    errs = []
    for f in lay['frames']:
        node = f.info
        if fr.get(id(node)) is not f:
            continue
        for p in node.get('parts') or []:
            if id(p) in fr:
                e = (fr[id(p)].m - f.m) - ideal(weight(p) / weight(node))
                errs.append((weight(p), e))
    return errs
