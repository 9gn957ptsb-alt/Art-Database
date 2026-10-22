import itertools, json
V=list(itertools.product((0,1),repeat=3))
diag=[((0,0,0),(1,1,1)),((1,0,0),(0,1,1)),((0,1,0),(1,0,1)),((0,0,1),(1,1,0))]
def paths(a,b):
    out=[]
    for order in itertools.permutations(range(3)):
        p=list(a); pts=[tuple(p)]; edges=[]
        for ax in order:
            q=p.copy(); q[ax]=b[ax]; edges.append(frozenset([tuple(p),tuple(q)])); p=q; pts.append(tuple(p))
        out.append((order,pts,edges))
    return out
sols=[]
for choice in itertools.product(*[paths(a,b) for a,b in diag]):
    E=[e for c in choice for e in c[2]]
    if len(set(E))==12: sols.append(choice)
print('decompositions of the 12 edges into 4 monotone paths, one per body diagonal:',len(sols))
# classify: how many are 'chiral' variants, and is any 3-fold symmetric about (1,1,1)?
for s in sols[:4]:
    print([ (c[1][0],c[0]) for c in s])
json.dump({'count':len(sols),'solutions':[[{'from':c[1][0],'order':c[0],'points':c[1]} for c in s] for s in sols]},open('tribars4.json','w'),indent=1)
