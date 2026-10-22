"""analytic checks of form.json: nodes/closure, arcs, hex corners vs exact slide, thickness in the bend"""
import sys, json, math
sys.path.insert(0, '/home/user/site/scripts')
import numpy as np, figure_studies as fs
S='/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/'
F=json.load(open(S+'wf6/reconstruct/form.json'))
E=np.eye(3); m=np.ones(3); H=1/9; AX='xyz'
rho=math.sqrt(2)/24; th=math.acos(-1/3); L=1/3
out={}
nodes={k:np.array(v) for k,v in F['nodes'].items()}
# closure
gaps=[]; deg={k:0 for k in nodes}
for b in F['beams']:
    k=AX.index(b['axis']); P=np.array(b['start_node']); Q=np.array(b['end_node'])
    gaps.append(np.linalg.norm(Q-(P+E[k]-m/3)))
    for X in (P,Q):
        nm=min(nodes,key=lambda n:np.linalg.norm(nodes[n]-X)); deg[nm]+=1; gaps.append(np.linalg.norm(nodes[nm]-X))
    out.setdefault('beam_dot_m',[]).append(float((Q-P)@m))
out['max_node_gap']=max(gaps); out['node_degree']=deg
Cc=np.array(F['view']['centre']); out['node_depths']=[float((v-Cc)@m/math.sqrt(3)) for v in nodes.values()]
# exact profile: param s along the bend -> (a along axis, l lateral)
def prof(s):
    s=np.asarray(s,float); A=np.zeros_like(s); Lt=np.zeros_like(s)
    s1=rho*th; s2=s1+L
    p=s<=s1; ph=s[p]/rho; A[p]=rho*np.sin(ph); Lt[p]=rho*(1-np.cos(ph))
    q=(s>s1)&(s<=s2); A1=rho*math.sin(th); L1=rho*(1-math.cos(th)); t=s[q]-s1
    A[q]=A1+t*math.cos(th); Lt[q]=L1+t*math.sin(th)
    r=s>s2; ph=(2*s1+L-s[r])/rho; A[r]=-rho*np.sin(ph); Lt[r]=math.sqrt(2)/3-rho*(1-np.cos(ph))
    return A,Lt
stot=2*rho*th+L
ss=np.linspace(0,stot,200001); Aa,Ll=prof(ss); Xs=Aa+Ll/math.sqrt(2); Ys=Ll/math.sqrt(2)
out['end_point']=[float(Aa[-1]),float(Ll[-1]-math.sqrt(2)/3)]
out['X_monotone']=bool((np.diff(Xs)>0).all()); out['min_dX_ds']=float((np.diff(Xs)/np.diff(ss)).min())
s1=rho*th; s2=s1+L
iX=lambda s: float(np.interp(s,ss,Xs))
out['sigma_pieces']=[iX(s1),iX(s2)-iX(s1),iX(stot)-iX(s2)]
out['slide_pieces']=[float(np.interp(s1,ss,Ys)),float(np.interp(s2,ss,Ys)-np.interp(s1,ss,Ys)),float(Ys[-1]-np.interp(s2,ss,Ys))]
out['tan_half_theta']=math.tan(th/2)
def Yexact(sig):  # sigma offset from span start
    return np.interp(sig,Xs,Ys)
# centreline points vs analytic curve; hex corners vs exact slide
worst_cl=0; worst_corner=0; worst_c1=0
for b in F['beams']:
    k=AX.index(b['axis']); i,j=(k+1)%3,(k+2)%3; P=np.array(b['start_node']); w=-(E[i]+E[j])/math.sqrt(2)
    S0=P+3*H*E[k]
    cl=np.array(b['centreline'])[2:-2]
    cur=S0+Aa[:,None]*E[k]+Ll[:,None]*w
    for c in cl[::4]:
        worst_cl=max(worst_cl,np.linalg.norm(cur-c,axis=1).min())
    c1=np.array(b['bend']['arc1']['centre']); 
    worst_c1=max(worst_c1,abs(np.linalg.norm(cur[ss<=s1]-c1,axis=1)-rho).max())
    c2=np.array(b['bend']['arc2']['centre'])
    worst_c1=max(worst_c1,abs(np.linalg.norm(cur[ss>s2]-c2,axis=1)-rho).max())
    for h in b['hexes']:
        for q in np.array(h):
            d=q-P; sig=d[k]-(d[i]+d[j])/2
            if sig<3*H-1e-9: Y=0
            elif sig>1-3*H+1e-9: Y=1/3
            else: Y=Yexact(sig-3*H)
            qq=d+Y*m
            worst_corner=max(worst_corner,abs(abs(qq[i])-H),abs(abs(qq[j])-H))
out['centreline_off_analytic_curve']=worst_cl; out['arc_points_off_stated_circles']=worst_c1
out['hex_corner_off_exact_square_bar_after_unsliding']=worst_corner
# thickness: in the bend plane through the centreline, across the straight run, inside the hex union
b=F['beams'][0]; k=AX.index(b['axis']); i,j=(k+1)%3,(k+2)%3; P=np.array(b['start_node']); w=-(E[i]+E[j])/math.sqrt(2)
hx=[fs.Hex(np.array(h)) for h in b['hexes']]
HS=[x.halfspaces() for x in hx]
def inside(p):
    return any(((N@p-wv)<=1e-12).all() for N,wv,_ in HS)
def width(c,T):
    T=T/np.linalg.norm(T); n=np.cross(T,np.cross(E[k],w)); n/=np.linalg.norm(n)  # in bend plane, perp to T
    ts=np.linspace(-0.3,0.3,6001); ins=np.array([inside(c+t*n) for t in ts])
    return (ins.sum()-1)*(ts[1]-ts[0])
S0=P+3*H*E[k]
straight_mid=S0+(rho*math.sin(th)+L/2*math.cos(th))*E[k]+(rho*(1-math.cos(th))+L/2*math.sin(th))*w
Tst=math.cos(th)*E[k]+math.sin(th)*w
w_st=width(straight_mid,Tst); w_ref=width(P+0.2*E[k],E[k])
out['inplane_width_straight_run']=w_st; out['inplane_width_unbent']=w_ref; out['ratio']=w_st/w_ref
# out-of-plane width (along e_i-e_j) on the straight run
def width_dir(c,n):
    n=n/np.linalg.norm(n); ts=np.linspace(-0.3,0.3,6001); ins=np.array([inside(c+t*n) for t in ts]); return (ins.sum()-1)*(ts[1]-ts[0])
out['outofplane_width_straight_run']=width_dir(straight_mid,E[i]-E[j]); out['outofplane_width_unbent']=width_dir(P+0.2*E[k],E[i]-E[j])
# true perpendicular cross-section area of straight run vs square (2H)^2: area of slice perpendicular to T
out['true_section_area_ratio_straight_run']=None
print(json.dumps(out,indent=1,default=float))
json.dump(out,open(S+'wf6/check-reconstruct/check2.json','w'),indent=1,default=float)
