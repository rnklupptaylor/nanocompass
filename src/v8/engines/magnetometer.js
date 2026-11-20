'use strict';
/* Nanocompass v8.0 · magnetometer engine: M(H) loops, ZFC/FC curves and AC susceptibility of an ensemble of
 * single-domain particles. New in v8.0; independent of the particle animation engines.
 *
 * Model
 *  - Particles: log-normal core diameters (median d, spread σ), uniaxial anisotropy K, saturation Ms.
 *    The ensemble is represented by size quantiles × easy-axis angles ψ to the field, weighted by sin ψ
 *    (random 3D axes). Axes with ψ > 90° are equivalent to ψ' = 180° − ψ with the two states swapped.
 *  - Solid (frozen ferrofluid, particles in a matrix): Néel relaxation only. For each axis angle and field the
 *    Stoner–Wohlfarth energy e(θ) = sin²θ − 2h cos(θ − ψ), h = Ms B / (2K), gives the two minima, their moment
 *    projection on the field and the barriers. Each particle is a two-state system with escape rates
 *    k = f₀ exp(−KV Δe / k_BT), f₀ = 1/τ₀ = 1 GHz (the τ₀ = 1 ns of the lessons). The occupation p evolves by the
 *    exact two-state solution p(t+Δt) = p_eq + (p − p_eq) exp(−(k₊ + k₋)Δt), so curves are smooth and fast.
 *    If a minimum vanishes (field beyond the switching field) the particle switches at once.
 *    Thermal fluctuation inside a well is included approximately through the factor g = s/(s + 1),
 *    s = (KV + μ|B|)/k_BT, on the mean projection (see evolve()).
 *  - Liquid: the whole particle can turn (Brown rotation). Each particle's moment projection relaxes to the
 *    Langevin value L(μB/k_BT) with 1/τ = 2/τ_N + 1/τ_B (Néel and Brown in parallel); no hysteresis from
 *    anisotropy is kept. τ_N = τ₀ exp(KV/k_BT) is the mean dwell time in one state, as in lesson 00, so the
 *    magnetisation relaxes with τ_N/2. τ_B = πηd_h³/(2k_BT).
 *  - AC susceptibility: linear response of the same ensemble, χ = Σ g[χ₀ / (1 + iωτ) + χ_rot] (Debye per particle),
 *    χ₀ = μ² cos²ψ / k_BT, χ_rot = μ² sin²ψ / (2KV) (rotation inside the well) and τ = τ_N/2 in the solid, χ₀ = μ²/(3k_BT) in the liquid. Blocked particles keep
 *    χ₀ but relax too slowly to follow the field, so χ′ drops and χ″ peaks where ωτ ≈ 1.
 * Output magnetisation is M / M_s of the whole sample (volume-weighted). */
(function(root){
const KB=1.380649e-23,TAU0=1e-9,F0=1/TAU0;
const MAG_DEFAULTS={kSigma:0,kBins:7,dNm:10,sigma:.15,K:1e4,Ms:480e3,ligandNm:2,eta:1e-3,medium:'solid',sizeBins:48,psiBins:36};

function lognormalQuantiles(median,sigma,n){
  // Midpoint quantiles of a log-normal number distribution (inverse error function by rational approximation).
  const out=[];for(let i=0;i<n;i++){const p=(i+.5)/n;out.push(sigma>0?median*Math.exp(sigma*Math.SQRT2*erfinv(2*p-1)):median);}return out;
}
function erfinv(x){const a=.147,ln=Math.log(1-x*x),t=2/(Math.PI*a)+ln/2;return Math.sign(x)*Math.sqrt(Math.sqrt(t*t-ln/a)-t);}
function langevin(a){return Math.abs(a)<1e-4?a/3:1/Math.tanh(a)-1/a;}

/* Stoner–Wohlfarth wells for axis angle psi (0…π/2) and reduced field h (any sign).
 * Returns the state "up" (near θ = 0, along the axis direction that is closer to the field) and "down" (near π):
 * {exists, m (projection on field), barrier (to the other well, in units of KV)}. */
const GRID=720;
function wells(psi,h){
  const e=new Float64Array(GRID);for(let i=0;i<GRID;i++){const th=2*Math.PI*i/GRID;const s=Math.sin(th);e[i]=s*s-2*h*Math.cos(th-psi);}
  const mins=[],maxs=[];
  for(let i=0;i<GRID;i++){const a=e[(i+GRID-1)%GRID],b=e[i],c=e[(i+1)%GRID];if(b<a&&b<=c)mins.push(i);if(b>a&&b>=c)maxs.push(i);}
  const refine=i=>{const a=e[(i+GRID-1)%GRID],b=e[i],c=e[(i+1)%GRID],den=a-2*b+c,off=den>0?.5*(a-c)/den:0;return 2*Math.PI*(i+off)/GRID;};
  const near=(target)=>{let best=null,bd=9;for(const i of mins){const th=2*Math.PI*i/GRID;let d=Math.abs(((th-target+3*Math.PI)%(2*Math.PI))-Math.PI);if(d<bd){bd=d;best=i;}}return bd<Math.PI/2?best:null;};
  const iu=near(0),id=near(Math.PI);
  const state=(i)=>{if(i==null)return {exists:false};const th=refine(i);
    // barrier: lowest maximum reachable from this minimum going either way
    let bar=Infinity;for(const dir of [1,-1]){let j=i,peak=e[i];for(let k=0;k<GRID;k++){j=(j+dir+GRID)%GRID;if(e[j]>peak)peak=e[j];const a=e[(j+GRID-1)%GRID],c=e[(j+1)%GRID];if(e[j]<a&&e[j]<=c&&j!==i)break;}bar=Math.min(bar,peak-e[i]);}
    return {exists:true,m:Math.cos(th-psi),barrier:bar,theta:th};};
  const up=state(iu),down=state(id);
  if(iu!=null&&id!=null&&iu===id){ // a single minimum: assign it to the side it is closer to
    const th=2*Math.PI*iu/GRID;if(Math.cos(th)>0)return {up,down:{exists:false}};return {up:{exists:false},down};}
  return {up,down};
}

class Magnetometer{
  constructor(config={}){this.c={...MAG_DEFAULTS,...config};this.build();this.T=300;this.B=0;this.t=0;}
  build(){
    // Sizes: equally spaced in ln d over ±3σ with log-normal number weights. (Quantile midpoints left single
    // heavy bins in the large-size tail, whose unblocking showed up as small bumps in ZFC curves.)
    const c=this.c,nps=c.psiBins,nz=c.sigma>0?c.sizeBins:1,zs=nz>1?Array.from({length:nz},(_,i)=>-3+6*i/(nz-1)):[0];
    const ds=zs.map(z=>c.dNm*Math.exp(c.sigma*z)),nw=zs.map(z=>Math.exp(-z*z/2));
    // ψ bins with sin ψ weights (random 3D axes), folded onto 0…90°
    this.psis=[];this.psiW=[];let ws=0;for(let j=0;j<nps;j++){const a=Math.PI/2*j/nps,b=Math.PI/2*(j+1)/nps,w=Math.cos(a)-Math.cos(b);this.psis.push(Math.acos((Math.cos(a)+Math.cos(b))/2));this.psiW.push(w);ws+=w;}
    this.psiW=this.psiW.map(w=>w/ws);
    // Anisotropy spread: real particles differ in shape, surface and strain, so K varies from particle to particle.
    // kSigma is the log-normal width of K; each size is split into kBins anisotropy classes (±2.5σ).
    const nk=c.kSigma>0?c.kBins:1,kz=nk>1?Array.from({length:nk},(_,i)=>-2.5+5*i/(nk-1)):[0],kf=kz.map(z=>Math.exp(c.kSigma*z)),kw=kz.map(z=>Math.exp(-z*z/2));
    this.kFactors=kf;this.sizes=[];
    ds.forEach((d,k)=>kf.forEach((f,q)=>{const V=Math.PI*(d*1e-9)**3/6,dh=(d+2*c.ligandNm)*1e-9,K=c.K*f;
      this.sizes.push({d,V,n:nw[k]*kw[q],q,K,mu:c.Ms*V,KV:K*V,tauB:Math.PI*c.eta*dh**3/(2*KB)});}));
    const vol=this.sizes.reduce((s,x)=>s+x.n*x.V,0);this.sizes.forEach(x=>x.w=x.n*x.V/vol); // magnetisation is volume weighted
    this.reset();
  }
  reset(p0=.5){this.p=this.sizes.map(()=>this.psis.map(()=>p0));this.m=this.sizes.map(()=>this.psis.map(()=>0));this.cacheH=this.kFactors.map(()=>null);}
  hk(){return 2*this.c.K/this.c.Ms;} // anisotropy field in tesla
  tauN(s,T=this.T){return TAU0*Math.exp(Math.min(700,s.KV/(KB*T)));}
  /* Hold field B (T) and temperature T (K) for time dt (s); returns M/Ms. */
  evolve(B,T,dt){
    this.B=B;this.T=T;this.t+=dt;const c=this.c,kT=KB*T;
    if(c.medium==='liquid'){
      let M=0;this.sizes.forEach((s,i)=>{const tn=this.tauN(s,T),tb=s.tauB*1/T,rate=2/tn+1/tb,meq=langevin(s.mu*B/kT),f=Math.exp(-rate*dt);
        for(let j=0;j<this.psis.length;j++){this.m[i][j]=meq+(this.m[i][j]-meq)*f;M+=s.w*this.psiW[j]*this.m[i][j];}});
      return M;
    }
    const sign=B>=0?1:-1;
    // Reduced field h = B/(2K/Ms) differs between anisotropy classes; wells are cached per class.
    this.kFactors.forEach((f,q)=>{const ha=Math.abs(B)/(this.hk()*f);if(!this.cacheH[q]||this.cacheH[q].h!==ha)this.cacheH[q]={h:ha,w:this.psis.map(psi=>wells(psi,ha))};});
    // For negative fields the picture is mirrored: "up" (towards the field) is the state along −axis.
    let M=0;
    // Thermal fluctuation of the moment inside its well reduces its mean projection. Without this factor the
    // two-state picture plus the reversible rotation of the minima overestimates the superparamagnetic
    // susceptibility by about kT/KV (20 % for KV = 5 kT). g = s/(s + 1), s = (KV + μ|B|)/kT, restores
    // χ₀ = μ²/(3kT) for random axes and lets M → Ms at high field (approach ≈ 1 − kT/μB, as for Langevin).
    this.sizes.forEach((s,i)=>{const row=this.p[i],stiff=(s.KV+s.mu*Math.abs(B))/kT,g=stiff/(stiff+1);
      for(let j=0;j<this.psis.length;j++){const {up,down}=this.cacheH[s.q].w[j];
        // row[j] = probability of the state along +axis (towards +B for ψ ≤ 90°)
        let pa=row[j];const A=sign>0?up:down,Bw=sign>0?down:up; // A: state along +axis
        if(!A.exists)pa=0;else if(!Bw.exists)pa=1;else{
          const kOut=F0*Math.exp(-Math.min(700,s.KV*A.barrier/kT)),kIn=F0*Math.exp(-Math.min(700,s.KV*Bw.barrier/kT)),sum=kOut+kIn;
          if(sum>0){const peq=kIn/sum;pa=peq+(pa-peq)*Math.exp(-sum*dt);}}
        row[j]=pa;
        const mA=A.exists?A.m*sign:(sign>0?-1:1)*Math.abs(Bw.m),mB=Bw.exists?Bw.m*sign:-mA; // projections on +B direction
        M+=g*s.w*this.psiW[j]*(pa*mA+(1-pa)*mB);}});
    return M;
  }
  /* Ensemble-averaged display state for drawing: per size and angle, expected moment along +axis (−1…1). */
  axisMoment(i,j){return this.c.medium==='liquid'?this.m[i][j]:2*this.p[i][j]-1;}
  /* Linear AC susceptibility at temperature T and frequency f, relative to the static susceptibility of the
   * same sample at 300 K (so curves of one sample can be compared directly). */
  ac(T,f){if(this._ref==null){this._ref=1;const r=this.acRaw(300,0).re;this._ref=r>0?r:1;}const v=this.acRaw(T,f);return {re:v.re/this._ref,im:v.im/this._ref};}
  acRaw(T,f){
    const c=this.c,kT=KB*T,w=2*Math.PI*f;let re=0,im=0;
    this.sizes.forEach(s=>{const tn=this.tauN(s,T),tau=c.medium==='liquid'?1/(2/tn+1/(s.tauB/T)):tn/2;
      const chi0=c.medium==='liquid'?s.mu*s.mu/(3*kT):s.mu*s.mu*this.psis.reduce((a,psi,j)=>a+this.psiW[j]*Math.cos(psi)**2,0)/kT;
      const x=w*tau,d=1+x*x,wt=s.w/s.V;
      if(c.medium==='liquid'){re+=wt*chi0/d;im+=wt*chi0*x/d;return;}
      // Solid: the flip (two-state) part relaxes with τ; rotation inside the well follows any frequency.
      // The same thermal factor as in evolve() keeps χ₀ = μ²/(3kT) above blocking and leaves a small,
      // temperature-independent χ′ at low temperature, as measured.
      const sig=s.KV/kT,g=sig/(sig+1),chiR=s.mu*s.mu*this.psis.reduce((a,psi,j)=>a+this.psiW[j]*Math.sin(psi)**2,0)/(2*s.KV);
      re+=wt*g*(chi0/d+chiR);im+=wt*g*chi0*x/d;});
    return {re,im};
  }
  /* Blocking temperature of a particle of diameter d for measuring time tm: T_B = KV / (k_B ln(tm/τ₀)). */
  blockingT(dNm=this.c.dNm,tm=100,kf=1){const V=Math.PI*(dNm*1e-9)**3/6;return this.c.K*kf*V/(KB*Math.log(tm/TAU0));}
}

/* Measurement protocols. Each returns a generator of points so a view can animate them. */
/* As in the laboratory: the sample starts demagnetised in zero field (cooled without field), the field is
 * raised to +Bmax (initial magnetisation curve), swept down to −Bmax and back up to +Bmax.
 * sweepTime is the time for the closed loop +Bmax → −Bmax → +Bmax; every field step takes the same time. */
function* loopProtocol(mag,{T=300,Bmax=.2,sweepTime=10,steps=300}={}){
  mag.reset(.5);
  const dt=sweepTime/(2*steps),half=Math.round(steps/2);
  yield {B:0,M:mag.evolve(0,T,dt),branch:'virgin',step:1};
  for(let k=1;k<=half;k++){const B=Bmax*k/half;yield {B,M:mag.evolve(B,T,dt),branch:'virgin',step:2};}
  for(let k=1;k<=2*steps;k++){const u=k<=steps?k/steps:2-k/steps,B=Bmax*(1-2*u);const M=mag.evolve(B,T,dt);yield {B,M,branch:k<=steps?'down':'up',step:k<=steps?3:4};}
}
/* As in the laboratory: (1) the demagnetised sample is cooled from Tmax to Tmin without field,
 * (2) the measuring field is switched on at Tmin, (3) M is measured while warming (ZFC),
 * (4) M is measured while cooling back down in the same field (FC). Every point takes tPoint. */
/* fc: 'warming' (FCW, the common SQUID sequence: cool in the measuring field, then measure while warming)
 * or 'cooling' (FCC: measure while cooling in the field). FC uses the same small measuring field as ZFC;
 * cooling in a large field and measuring after switching it off would be a thermoremanence (TRM) curve. */
function* zfcfcProtocol(mag,{Bm=.005,Tmin=5,Tmax=350,dT=5,tPoint=10,fc='warming'}={}){
  mag.reset(.5);mag.evolve(0,Tmax,1e3);
  for(let T=Tmax;T>=Tmin-1e-9;T-=dT){const M=mag.evolve(0,T,tPoint);yield {T,M,B:0,curve:'cool',step:1};}
  yield {T:Tmin,M:mag.evolve(Bm,Tmin,tPoint),B:Bm,curve:'switch',step:2};
  for(let T=Tmin+dT;T<=Tmax+1e-9;T+=dT){const M=mag.evolve(Bm,T,tPoint);yield {T,M,B:Bm,curve:'ZFC',step:3};}
  if(fc==='cooling'){for(let T=Tmax;T>=Tmin-1e-9;T-=dT){const M=mag.evolve(Bm,T,tPoint);yield {T,M,B:Bm,curve:'FC',step:4};}return;}
  for(let T=Tmax;T>=Tmin-1e-9;T-=dT){const M=mag.evolve(Bm,T,tPoint);yield {T,M,B:Bm,curve:'fccool',step:4};}
  for(let T=Tmin;T<=Tmax+1e-9;T+=dT){const M=mag.evolve(Bm,T,tPoint);yield {T,M,B:Bm,curve:'FC',step:5};}
}
function* acProtocol(mag,{against='T',f=1e3,T=300,Tmin=5,Tmax=350,fmin=1,fmax=1e8,points=120}={}){
  for(let k=0;k<points;k++){const u=k/(points-1);
    if(against==='T'){const t=Tmin+(Tmax-Tmin)*u;yield {T:t,f,...mag.ac(t,f)};}
    else{const ff=fmin*(fmax/fmin)**u;yield {T,f:ff,...mag.ac(T,ff)};}}
}
const api={Magnetometer,MAG_DEFAULTS,wells,loopProtocol,zfcfcProtocol,acProtocol,langevin,KB,TAU0};
root.NanoMagnetometer=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
