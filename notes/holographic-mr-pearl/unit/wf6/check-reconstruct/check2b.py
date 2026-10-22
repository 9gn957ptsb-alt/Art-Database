exec(open('check2.py').read().split("out['inplane_width_straight_run']")[0].replace("print(json","pass#").replace("json.dump(out,open","pass#"))
def runs(c,n):
    n=n/np.linalg.norm(n); ts=np.linspace(-0.3,0.3,6001); ins=np.array([inside(c+t*n) for t in ts])
    d=np.diff(ins.astype(int)); st=list(ts[1:][d==1]); en=list(ts[:-1][d==-1])
    if ins[0]: st=[ts[0]]+st
    if ins[-1]: en=en+[ts[-1]]
    return [(round(a,4),round(b,4)) for a,b in zip(st,en)]
nT=np.cross(Tst,np.cross(E[k],w))
print('runs across straight run (in plane, perp to T):',runs(straight_mid,nT))
print('runs across unbent:',runs(P+0.2*E[k],np.cross(E[k],np.cross(E[k],w))))
# along the sight line m through the straight-run centre (the slice itself)
print('runs along m through straight-run centre:',runs(straight_mid,m))
