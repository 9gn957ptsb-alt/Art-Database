# port of unit.glsl unitFilm/unitFacet to numpy (float64), independent of the study's python
import numpy as np, math, json
PI=3.14159265359; NF=1.1638; NS=1.3539; D=253.2; CRUX=0.57735026919
def fres(ci,n1,n2):
    st2=(n1/n2)**2*max(1-ci*ci,0)
    if st2>=1: return 1.0
    ct=math.sqrt(1-st2); rs=(n1*ci-n2*ct)/(n1*ci+n2*ct); rp=(n2*ci-n1*ct)/(n2*ci+n1*ct); return .5*(rs*rs+rp*rp)
def sens(opd,shift):
    ph=2*PI*opd*1e-9
    val=np.array([5.4856e-13,4.4201e-13,5.2481e-13]); pos=np.array([1.6810e6,1.7953e6,2.2084e6]); var=np.array([4.3278e9,9.3046e9,6.6121e9])
    xyz=val*np.sqrt(2*PI*var)*np.cos(pos*ph+shift)*np.exp(-ph*ph*var)
    xyz[0]+=9.7470e-14*math.sqrt(2*PI*4.5282e9)*math.cos(2.2399e6*ph+shift)*math.exp(-4.5282e9*ph*ph)
    xyz/=1.0685e-7
    M=np.array([[3.2404542,-1.5371385,-0.4985314],[-0.9692660,1.8760108,0.0415560],[0.0556434,-0.2040259,1.0572252]])
    return (M@xyz)/np.array([1.2049,0.9483,0.9088])
def film(c1,d=D):
    n2,n3=NF,NS
    c2=math.sqrt(max(1-(1-c1*c1)/n2**2,0)); R12=fres(c1,1,n2); R23=fres(c2,n2,n3); T=1-R12
    phi=PI+(PI if n3<n2 else 0); opd=2*n2*d*c2; R123=min(max(R12*R23,1e-5),.9999); r=math.sqrt(R123)
    Rs=T*T*R23/(1-R123); I=np.full(3,R12+Rs); Cm=Rs-T
    Cm*=r; I=I+Cm*2*sens(opd,phi); Cm*=r; I=I+Cm*2*sens(2*opd,2*phi); return np.maximum(I,0)
Y=lambda l: l@np.array([.2126,.7152,.0722])
toLin=lambda c: np.where(c>=0.04045,((c+.055)/1.055)**2.4,c/12.92)
toS=lambda l: (lambda l: np.where(l>=0.0031308,1.055*l**(1/2.4)-.055,12.92*l))(np.clip(l,0,1))
def facet(tone,c,d=D):
    R=film(c,d); RD=film(CRUX,d); chrom=(R/max(Y(R),1e-6))/(RD/Y(RD)); lt=toLin(tone)
    F=lt*chrom+np.maximum(R-RD,0); return np.clip(tone+(toS(F)-toS(lt)),0,1)
hx=lambda c:'#%02X%02X%02X'%tuple(np.floor(np.clip(c,0,1)*255+.5).astype(int))
T={'x':np.full(3,128/255),'y':np.zeros(3),'z':np.ones(3)}
out={}
for a in (0,20,40,54.7356,65,75,85):
    c=math.cos(math.radians(a)); out['%g'%a]={k:hx(facet(t,c)) for k,t in T.items()}
print(json.dumps(out))
# OPD at crux
c2=math.sqrt(1-(2/3)/NF**2); print('OPD crux',2*NF*D*c2)
# neutral band: angles where grey facet within 1 level of #808080... and where chroma small
ang=np.linspace(30,80,2001); g=np.array([np.abs(facet(T['x'],math.cos(math.radians(a)))*255-128).max() for a in ang])
ok=ang[g<=2.0]; print('grey within 2 levels: %.2f..%.2f deg'%(ok.min(),ok.max()))
ok=ang[g<=5.0]; print('grey within 5 levels: %.2f..%.2f deg'%(ok.min(),ok.max()))
json.dump(out,open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/check-colour/facet_recheck.json','w'),indent=1)
