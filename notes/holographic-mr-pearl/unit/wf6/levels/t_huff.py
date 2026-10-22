import nest as N
def tree(n, w=None):
    return {'key': 'x', 'parts': [{'key': i, 'parts': [{'key': j} for j in range((w[i] if w else 1))]} if w and w[i] > 1 else {'key': i} for i in range(n)]}
def show(t, ind=0):
    if t[0] == 'leaf': return 'L%s(w%d)' % (t[1].get('key'), N.weight(t[1]))
    if t[0] == 'pair': return 'PAIR[%s | gap %s]' % (show(t[1]), show(t[2]))
    return 'J[' + ' '.join(show(c) for c in t[1]) + (' | gap ' + show(t[2]) if t[2] else '') + ']'
for n in (1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13):
    t = tree(n); print(n, show(N.huffman(t['parts'])))
t = tree(6, [9, 5, 3, 2, 1, 1]); print('weighted', show(N.huffman(t['parts'])))
