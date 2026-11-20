'use strict';
/* Nanocompass · 2D particle engine.
 * Brownian dynamics of coated magnetic nanoparticles in a plane (translation and rotation), Néel reversals on an
 * event clock, point-dipole and steric interactions, an equilibrium Metropolis sampler, and the statistics used
 * by the lessons (pair correlations, structure factor, density maps, block uncertainties, built-in checks).
 *
 * host (all optional):
 *   el(id)              → object with .value for analysis settings (densityGrid, densitySigma, shellMin, shellMax, Lx, Ly)
 *   setControl(id, v)   ← the engine reports values it changed (box size in fixed-area mode)
 *   onFlip(particle)    ← each discrete Néel reversal, e.g. to play a tone
 *   onStatistics()      ← statistics were sampled or cleared
 *   onRedraw()          ← particles were recreated; redraw the view
 *   now()               → wall clock in ms (default performance.now or Date.now)
 */
(function(root){
function createPlanarEngine(host={}){
const PAGE={densityGrid:48,densitySigma:0.8,shellMin:1.0,shellMax:2.5,Lx:'',Ly:''}; // default analysis settings
host={el:id=>({value:PAGE[id]??'',checked:false}),setControl(){},onFlip(){},onStatistics(){},onRedraw(){},
  now:()=>(typeof performance!=='undefined'?performance.now():Date.now()),...host};
const $=id=>host.el(id);
const setControl=(id,v)=>host.setControl(id,v);
/* ============================== I. CONSTANTS / RNG / UTILITIES ============================== */
const C={kB:1.380649e-23,mu0:4*Math.PI*1e-7,tau0:1e-9,qe:1.602176634e-19,ke:8.9875517923e9,Q0:5e-19};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;
function stdev(a){if(a.length<2)return NaN;const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1));}
function fmt(x,d=3){if(!Number.isFinite(x))return '—';if(x===0)return '0';const ax=Math.abs(x);if(ax>=1e4||ax<1e-3)return x.toExponential(2);const out=x.toFixed(d);return out.includes('.')?out.replace(/0+$/,'').replace(/\.$/,''):out;}
function hashSeed(str){let h=2166136261>>>0;for(let i=0;i<String(str).length;i++){h^=String(str).charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
class RNG{constructor(seed){this.state=hashSeed(seed)||1;this._g=null;} uniform(){let t=this.state=(this.state+0x6D2B79F5)>>>0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;} gauss(){if(this._g!==null){const g=this._g;this._g=null;return g;}let u=0,v=0;while(u<=Number.EPSILON)u=this.uniform();v=this.uniform();const r=Math.sqrt(-2*Math.log(u)),a=2*Math.PI*v;this._g=r*Math.sin(a);return r*Math.cos(a);} lognormalMedian(median,relSD){if(relSD<=0)return median;const s2=Math.log(1+relSD*relSD),s=Math.sqrt(s2);return median*Math.exp(s*this.gauss());}}
function csv(rows){return rows.map(r=>r.map(v=>{const s=String(v??'');return /[,"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}).join(',')).join('\n');}
function nowStamp(){return new Date().toISOString().replace(/[:.]/g,'-');}
function minImage(d,L){if(d>L/2)d-=L;else if(d<-L/2)d+=L;return d;}
function safeHypot(x,y){const r=Math.hypot(x,y);return r>1e-12?r:1e-12;}
function percentile(a,p){if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),i=(b.length-1)*p,j=Math.floor(i),f=i-j;return b[j]*(1-f)+(b[Math.min(j+1,b.length-1)]||b[j])*f;}
function blockStats(values,block=5){
  const v=values.filter(Number.isFinite),m=mean(v),n=v.length;
  if(n<2)return {mean:m,se:NaN,blocks:0,tau:NaN,ready:false};
  const variance=v.reduce((a,x)=>a+(x-m)**2,0)/n;
  let tau=1;
  if(variance>0)for(let lag=1;lag<Math.min(200,n/4);lag++){
    let cov=0;for(let i=0;i<n-lag;i++)cov+=(v[i]-m)*(v[i+lag]-m);
    const rho=cov/(n-lag)/variance;if(rho<=0)break;tau+=2*rho;
  }
  block=Math.max(5,block,Math.ceil(2*tau));
  const bs=[];for(let i=0;i+block<=n;i+=block)bs.push(mean(v.slice(i,i+block)));
  return {mean:m,se:bs.length>1?stdev(bs)/Math.sqrt(bs.length):NaN,blocks:bs.length,tau,blockSize:block,ready:bs.length>=12};
}
const scales={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],lydian:[0,2,4,6,7,9,11],mixolydian:[0,2,4,5,7,9,10],aeolian:[0,2,3,5,7,8,10],locrian:[0,1,3,5,6,8,10]};
function scaleFreqs(name){const ints=scales[name]||scales.major,out=[];for(let o=0;o<3;o++)for(const s of ints)out.push(130.81*2**(o+s/12));return out;}

const defaults={neelProjected:true,medium:'fluid',viscosity:1,temperature:300,coreNm:10,ligandNm:2,polyMode:'mono',polyPct:10,Ms:480,magDynamics:'mc',K:10000,neelRandom:.5,field_mT:0,gradientOn:false,gradient:0,dipoleRot:true,dipoleTrans:true,repulsion:'wca',epsilonKT:15,dipoleMode:'full',dipoleCutoff:8,N:150,boxMode:'fixedBox',Lx:500,Ly:500,areaFraction:.09,analysisMode:false,simSpeed:1e-5,dtNs:10,equilUs:50,sampleUs:20,historyMax:500,gaugeMode:'avg',gaugeWindowUs:100,pairBins:48,qNmax:10,qBins:36,sectorDeg:18,seed:'SPM-v5-demo-001',avatar:'standard',scale:'major',showLigand:true,densityGrid:48,densitySigma:.8,shellMin:1,shellMax:2.5,mcMove:.25,mcAngle:.7,mcRate:20,mcEquil:2000,mcSample:20,sfBlockSize:10};
const ids=Object.keys(defaults);

const state={cfg:null,rng:null,particles:[],running:false,paused:false,simTime:0,accum:0,lastFrame:0,recording:false,recordStart:0,nextSample:0,sampleCount:0,steps:0,stepsWindow:0,lastPerf:host.now(),physicsSPS:0,displayFPS:0,frames:0,lastFps:host.now(),lastMaxDisp:0,lastBrownRms:0,lastDetDisp:0,sweepStop:false,sweepResults:[],sound:true,lastGauge:0,gaugeHistory:[],neelEvents:0,neelEventsWindow:0,neelEventsPerS:0,neelGuardTrips:0,neelBellBudget:0,mcSweeps:0,mcTrials:0,mcAccepted:0,mcAttempt:0,nextMCSample:0,sweepActive:false,mcEnergy:NaN,frameToken:0};
const avg={pairSamples:0,sfSamples:0,densitySamples:0,gr:null,a2:null,qht:null,cm:null,angle:null,sf:null,density:null,obs:{A2:[],QHT:[],mag:[],densityContrast:[],SqPeak:[],qstar:[],pairEnergy:[],chainFraction:[],clusterFraction:[]}};
const instant={pair:null,sf:null,density:null,obs:{A2:NaN,QHT:NaN,mag:0,densityContrast:NaN,SqPeak:NaN,qstar:NaN,pairEnergy:NaN}};
const history=[];
let obsRevision=0,obsCacheRevision=-1,obsCache=null;
function resetStatistics(){
  obsRevision++;
  avg.pairSamples=avg.sfSamples=avg.densitySamples=0;
  avg.gr=avg.a2=avg.qht=avg.cm=avg.angle=avg.sf=avg.density=avg.pairCounts=avg.pairSums=null;avg.angleCount=0;
  for(const k of Object.keys(avg.obs))avg.obs[k]=[];
  history.length=0;state.sampleCount=0;
  instant.pair=instant.sf=instant.density=null;
  instant.obs={A2:NaN,QHT:NaN,mag:0,densityContrast:NaN,SqPeak:NaN,qstar:NaN,pairEnergy:NaN};
  state.nextSample=state.simTime+(state.cfg?.sampleUs||20)*1e-6;
  state.nextMCSample=state.mcSweeps+(state.cfg?.mcSample||20);
  host.onStatistics();
}
/* ============================== II. PHYSICAL MODEL / INTEGRATION ============================== */
function nominalMoment(c=state.cfg){const d=c.coreNm*1e-9;return c.Ms*1e3*Math.PI*d**3/6;}
function nominalDhyd(c=state.cfg){return c.coreNm+2*c.ligandNm;}
function currentAreaFraction(){const c=state.cfg;if(!c||!state.particles.length)return c?.areaFraction||0;const A=state.particles.reduce((s,p)=>s+Math.PI*p.dhydNm*p.dhydNm/4,0);return A/(c.Lx*c.Ly);}
function dimensionless(c=state.cfg){if(!c)return{};const mu=nominalMoment(c),dh=nominalDhyd(c)*1e-9,T=c.temperature,B=Math.abs(c.field_mT)*1e-3;const lam=C.mu0*mu*mu/(4*Math.PI*dh**3*C.kB*T);return {lambda:lam,UHT:-2*lam,alpha:mu*B/(C.kB*T),phi:currentAreaFraction(),mu,Dhyd:dh*1e9,dqx:2*Math.PI/c.Lx,dqy:2*Math.PI/c.Ly};}
function diffusion(p,c=state.cfg){const eta=c.viscosity*1e-3,T=c.temperature,Dm=p.dhydNm*1e-9;return {Dt:C.kB*T/(3*Math.PI*eta*Dm),Dr:C.kB*T/(Math.PI*eta*Dm**3)};}
function computeTauLegacy(p,B){const c=state.cfg,V=Math.PI*(p.coreNm*1e-9)**3/6,mu=p.mu;const BK=2*c.K/(c.Ms*1e3||1),xi=clamp(Math.abs(c.neelProjected?B*Math.cos(p.theta):B)/(BK||1e99),0,.999);const aligned=Math.cos(p.theta)*B>0;const barrier=c.K*V*(aligned?(1+xi)**2:(1-xi)**2);return C.tau0*Math.exp(clamp(barrier/(C.kB*c.temperature),-100,100));}
function scheduleFlip(p,now){const B=localExternalB(p.y);p.tauMean=computeTauLegacy(p,B);const tau=Math.max(C.tau0,p.tauMean*(1+state.cfg.neelRandom*state.rng.gauss()));p.nextFlip=now+Math.max(C.tau0,tau);}
/* Resolve every scheduled Néel event that falls inside the
 * current mechanical integration interval. This avoids a
 * one-flip-per-step ceiling without forcing the O(N²) force calculation to
 * run at the much shorter Néel timescale. The mechanical state is still
 * advanced at dt, so a warning is shown when dt is not small compared with τN. */
function processLegacyNeelEvents(tEnd){
  const c=state.cfg;if(c.magDynamics!=='legacy')return;
  const MAX_EVENTS_PER_PARTICLE_STEP=4096;
  for(const p of state.particles){
    if(!Number.isFinite(p.nextFlip))scheduleFlip(p,state.simTime);
    let n=0;
    while(p.nextFlip<=tEnd+1e-18&&n<MAX_EVENTS_PER_PARTICLE_STEP){
      const eventTime=p.nextFlip;
      p.theta=(p.theta+Math.PI)%(2*Math.PI);
      p.lastFlipWall=host.now();
      state.neelEvents++;state.neelEventsWindow++;n++;
      if(state.sound&&state.neelBellBudget>0){host.onFlip(p);state.neelBellBudget--;}
      scheduleFlip(p,eventTime);
    }
    if(n>=MAX_EVENTS_PER_PARTICLE_STEP&&p.nextFlip<=tEnd){
      /* Extreme unresolved case: do not hang the browser. Fast-forward the
       * event clock and flag the run. Users should reduce dt. */
      state.neelGuardTrips++;
      scheduleFlip(p,tEnd);
    }
  }
}
function localExternalB(yNm){const c=state.cfg;return c.field_mT*1e-3+(c.gradientOn?c.gradient*1e-3*(yNm-c.Ly/2):0);}
function randomizeFrequencies(){const fs=scaleFreqs(state.cfg.scale);const shuffled=[...fs],arng=new RNG(String(state.cfg.seed)+'|audio|'+state.cfg.scale);for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(arng.uniform()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}state.particles.forEach((p,i)=>p.freq=shuffled[i%shuffled.length]);}
function createParticles(){const c=state.cfg;state.rng=new RNG(c.seed);state.particles=[];const rel=c.polyMode==='lognormal'?c.polyPct/100:0;const sizes=[];for(let i=0;i<c.N;i++){const core=clamp(state.rng.lognormalMedian(c.coreNm,rel),1,200);sizes.push(core);}const maxDh=Math.max(...sizes.map(d=>d+2*c.ligandNm));
  if(c.boxMode==='fixedPhi'){const aspect=c.Lx/c.Ly,area=sizes.reduce((a,d)=>a+Math.PI*(d+2*c.ligandNm)**2/4,0)/c.areaFraction;c.Lx=Math.sqrt(area*aspect);c.Ly=area/c.Lx;setControl('Lx',c.Lx);setControl('Ly',c.Ly);}
  for(let i=0;i<c.N;i++){const core=sizes[i],dh=core+2*c.ligandNm,mu=c.Ms*1e3*Math.PI*(core*1e-9)**3/6;let x=0,y=0,placed=false;
    for(let g=0;g<1500&&!placed;g++){x=state.rng.uniform()*c.Lx;y=state.rng.uniform()*c.Ly;placed=true;for(const q of state.particles){let dx=x-q.x,dy=y-q.y;dx=minImage(dx,c.Lx);dy=minImage(dy,c.Ly);if(Math.hypot(dx,dy)<.95*(dh+q.dhydNm)/2){placed=false;break;}}}
    if(!placed){const cols=Math.ceil(Math.sqrt(c.N*c.Lx/c.Ly)),rows=Math.ceil(c.N/cols),ix=i%cols,iy=Math.floor(i/cols);x=(ix+.5)*c.Lx/cols+(state.rng.uniform()-.5)*.08*c.Lx/cols;y=(iy+.5)*c.Ly/rows+(state.rng.uniform()-.5)*.08*c.Ly/rows;x=(x+c.Lx)%c.Lx;y=(y+c.Ly)%c.Ly;}
    const p={x,y,coreNm:core,dhydNm:dh,mu,theta:state.rng.uniform()*2*Math.PI,index:i,lastFlipWall:-1e9,nextFlip:Infinity,tauMean:Infinity,freq:440};state.particles.push(p);applyBoundary(p);
  }
  state.gaugeHistory.length=0;state.neelEvents=0;state.neelEventsWindow=0;state.neelEventsPerS=0;state.neelGuardTrips=0;randomizeFrequencies();if(c.magDynamics==='legacy')for(const p of state.particles)scheduleFlip(p,0);resolveOverlaps(6);for(const p of state.particles){p.ux=Math.cos(p.theta);p.uy=Math.sin(p.theta);}state.simTime=0;state.mcSweeps=state.mcTrials=state.mcAccepted=state.mcAttempt=0;state.recording=false;state.accum=0;state.steps=0;state.lastMaxDisp=0;stopRecording();resetStatistics();host.onRedraw();host.onStatistics();}
function resolveOverlaps(iterMax=3){const c=state.cfg,N=state.particles.length;for(let iter=0;iter<iterMax;iter++){let moved=false;for(let i=0;i<N;i++){const a=state.particles[i];for(let j=i+1;j<N;j++){const b=state.particles[j];let dx=b.x-a.x,dy=b.y-a.y;if(!c.gradientOn){dx=minImage(dx,c.Lx);dy=minImage(dy,c.Ly);}let r=Math.hypot(dx,dy),contact=(a.dhydNm+b.dhydNm)/2;if(r>=contact||contact<=0)continue;if(r<1e-9){const ang=2*Math.PI*state.rng.uniform();dx=Math.cos(ang);dy=Math.sin(ang);r=1;}const nx=dx/r,ny=dy/r,push=(contact-r)/2+.0001;a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;applyBoundary(a);applyBoundary(b);moved=true;}}if(!moved)break;}}
function applyBoundary(p){const c=state.cfg;if(!c.gradientOn){p.x=(p.x%c.Lx+c.Lx)%c.Lx;p.y=(p.y%c.Ly+c.Ly)%c.Ly;}else{const r=p.dhydNm/2;p.x=clamp(p.x,r,c.Lx-r);p.y=clamp(p.y,r,c.Ly-r);}}
function pairLoopForces(dt){const c=state.cfg,N=state.particles.length,T=c.temperature,kT=C.kB*T,Fx=new Float64Array(N),Fy=new Float64Array(N),Bx=new Float64Array(N),By=new Float64Array(N);let pairEnergy=0,pairEnergyN=0;
  const cutoffNm=c.dipoleCutoff*nominalDhyd(c),useCut=c.dipoleMode==='cutoff';
  for(let i=0;i<N;i++){const pi=state.particles[i];for(let j=i+1;j<N;j++){const pj=state.particles[j];let dx=pj.x-pi.x,dy=pj.y-pi.y;if(!c.gradientOn){dx=minImage(dx,c.Lx);dy=minImage(dy,c.Ly);}const rNm=safeHypot(dx,dy),rx=dx/rNm,ry=dy/rNm,rM=rNm*1e-9,contact=(pi.dhydNm+pj.dhydNm)/2;
      if(c.repulsion==='wca'&&rNm<contact){const re=Math.max(rNm,.72*contact)*1e-9,sigma=(contact*1e-9)/2**(1/6),sr=sigma/re,sr6=sr**6,sr12=sr6*sr6,eps=c.epsilonKT*kT;const dUdr=24*eps/re*(sr6-2*sr12);const fx=dUdr*rx,fy=dUdr*ry;Fx[i]+=fx;Fy[i]+=fy;Fx[j]-=fx;Fy[j]-=fy;}
      else if(c.repulsion==='coulomb'){const F=C.ke*C.Q0*C.Q0/(rM*rM),fx=-F*rx,fy=-F*ry;Fx[i]+=fx;Fy[i]+=fy;Fx[j]-=fx;Fy[j]-=fy;}
      const dipAllowed=(c.dipoleRot||c.dipoleTrans)&&(!useCut||rNm<=cutoffNm);
      if(dipAllowed){const c1=Math.cos(pi.theta),s1=Math.sin(pi.theta),c2=Math.cos(pj.theta),s2=Math.sin(pj.theta),m1x=pi.mu*c1,m1y=pi.mu*s1,m2x=pj.mu*c2,m2y=pj.mu*s2,d1=m1x*rx+m1y*ry,d2=m2x*rx+m2y*ry,d12=m1x*m2x+m1y*m2y,pref=C.mu0/(4*Math.PI*rM**3);
        if(c.dipoleRot){Bx[i]+=pref*(3*d2*rx-m2x);By[i]+=pref*(3*d2*ry-m2y);Bx[j]+=pref*(3*d1*rx-m1x);By[j]+=pref*(3*d1*ry-m1y);}
        if(c.dipoleTrans){const fac=-3*C.mu0/(4*Math.PI*rM**4),fx=fac*(d1*m2x+d2*m1x+d12*rx-5*d1*d2*rx),fy=fac*(d1*m2y+d2*m1y+d12*ry-5*d1*d2*ry);Fx[i]+=fx;Fy[i]+=fy;Fx[j]-=fx;Fy[j]-=fy;}
        pairEnergy+=pref*(d12-3*d1*d2);pairEnergyN++;
      }
    }}
  let maxBrown=0,maxDet=0;
  for(let i=0;i<N;i++){const p=state.particles[i],dif=diffusion(p,c),Bext=localExternalB(p.y);Bx[i]+=Bext;
    if(c.gradientOn){const gradTpm=c.gradient*1e6;Fy[i]+=p.mu*Math.cos(p.theta)*gradTpm;}
    if(c.medium==='fluid'){
      const sigNm=Math.sqrt(2*dif.Dt*dt)*1e9,bx=sigNm*state.rng.gauss(),by=sigNm*state.rng.gauss();maxBrown=Math.max(maxBrown,Math.sqrt(4*dif.Dt*dt)*1e9/p.dhydNm);p.x+=bx;p.y+=by;
      const mob=dif.Dt/(C.kB*c.temperature),dxD=mob*Fx[i]*dt*1e9,dyD=mob*Fy[i]*dt*1e9;const cap=.25*p.dhydNm,dm=Math.hypot(dxD,dyD),scale=dm>cap?cap/dm:1;p.x+=dxD*scale;p.y+=dyD*scale;maxDet=Math.max(maxDet,dm/p.dhydNm);
      const torque=p.mu*(Math.cos(p.theta)*By[i]-Math.sin(p.theta)*Bx[i]);p.theta+=dif.Dr*torque/(C.kB*c.temperature)*dt+Math.sqrt(2*dif.Dr*dt)*state.rng.gauss();
    }
    p.theta=(p.theta%(2*Math.PI)+2*Math.PI)%(2*Math.PI);applyBoundary(p);
  }
  state.lastBrownRms=maxBrown;state.lastDetDisp=maxDet;instant.obs.pairEnergy=pairEnergyN?pairEnergy/pairEnergyN/(C.kB*T):NaN;resolveOverlaps(c.repulsion==='none'?4:2);
}
// One explicit equilibrium Hamiltonian, in units of kBT.
// WCA permits ligand-shell compression while bare cores never overlap.
function pairEnergyKT(a,b,c=state.cfg){
  let dx=b.x-a.x,dy=b.y-a.y;
  if(!c.gradientOn){dx=minImage(dx,c.Lx);dy=minImage(dy,c.Ly);}
  const r=Math.hypot(dx,dy),contact=(a.dhydNm+b.dhydNm)/2,core=(a.coreNm+b.coreNm)/2;
  const hard=c.repulsion==='wca'?core:contact;
  if(r<=hard)return Infinity;
  let u=0;
  if(c.repulsion==='wca'&&r<contact){const t=(contact/r)**6/2;u+=4*c.epsilonKT*(t*t-t)+c.epsilonKT;}
  if(c.repulsion==='coulomb')u+=C.ke*C.Q0*C.Q0/(r*1e-9)/(C.kB*c.temperature);
  if(c.dipoleTrans&&(! (c.dipoleMode==='cutoff')||r<=c.dipoleCutoff*nominalDhyd(c))){
    const rx=dx/r,ry=dy/r,ca=a.ux??Math.cos(a.theta),sa=a.uy??Math.sin(a.theta),cb=b.ux??Math.cos(b.theta),sb=b.uy??Math.sin(b.theta);
    u+=C.mu0*a.mu*b.mu/(4*Math.PI*(r*1e-9)**3*C.kB*c.temperature)*(ca*cb+sa*sb-3*(ca*rx+sa*ry)*(cb*rx+sb*ry));
  }
  return u;
}
function particleEnergyKT(i,p=state.particles[i]){
  let u=-p.mu*localExternalB(p.y)*(p.ux??Math.cos(p.theta))/(C.kB*state.cfg.temperature);
  for(let j=0;j<state.particles.length;j++)if(i!==j){u+=pairEnergyKT(p,state.particles[j]);if(!Number.isFinite(u))return Infinity;}
  return u;
}
function totalEnergyKT(){let u=0;for(let i=0;i<state.particles.length;i++){const a=state.particles[i];u-=a.mu*localExternalB(a.y)*Math.cos(a.theta)/(C.kB*state.cfg.temperature);for(let j=i+1;j<state.particles.length;j++)u+=pairEnergyKT(a,state.particles[j]);}return u;}
function metropolisSweep(deadline=Infinity){
  const c=state.cfg,N=state.particles.length;
  for(let attempt=state.mcAttempt||0;attempt<2*N;attempt++){
    if(attempt%16===0&&host.now()>deadline){state.mcAttempt=attempt;return false;}
    const i=Math.floor(state.rng.uniform()*N),p=state.particles[i],trial={...p};
    if(attempt%2===0){const scale=c.mcMove*p.dhydNm;trial.x+=(2*state.rng.uniform()-1)*scale;trial.y+=(2*state.rng.uniform()-1)*scale;}
    else {trial.theta=(trial.theta+(2*state.rng.uniform()-1)*c.mcAngle+2*Math.PI)%(2*Math.PI);trial.ux=Math.cos(trial.theta);trial.uy=Math.sin(trial.theta);}
    state.mcTrials++;
    if(c.gradientOn){const r=p.dhydNm/2;if(trial.x<r||trial.x>c.Lx-r||trial.y<r||trial.y>c.Ly-r)continue;}
    else applyBoundary(trial);
    const before=particleEnergyKT(i),after=particleEnergyKT(i,trial),du=after-before;
    if(Number.isFinite(after)&&(du<=0||state.rng.uniform()<Math.exp(-du))){p.x=trial.x;p.y=trial.y;p.theta=trial.theta;p.ux=trial.ux;p.uy=trial.uy;state.mcAccepted++;}
  }
  state.mcAttempt=0;
  state.mcSweeps++;state.steps++;state.stepsWindow++;
  if(state.recording&&state.mcSweeps>=state.nextMCSample){sampleScience();state.nextMCSample+=Math.max(1,c.mcSample);}
  return true;
}

function physicsStep(dt){pairLoopForces(dt);processLegacyNeelEvents(state.simTime+dt);state.simTime+=dt;state.steps++;state.stepsWindow++;if(state.recording&&state.simTime>=state.nextSample){sampleScience();state.nextSample+=state.cfg.sampleUs*1e-6;}}
/* ============================== III. STATISTICAL ANALYSIS ============================== */
function pairAnalysis(){const c=state.cfg,N=state.particles.length,nb=Math.max(8,c.pairBins|0),rMax=.5*Math.min(c.Lx,c.Ly),dr=rMax/nb,count=new Float64Array(nb),a2s=new Float64Array(nb),qhs=new Float64Array(nb),cms=new Float64Array(nb),nstat=new Uint32Array(nb),angN=36,angles=new Float64Array(angN);let shellA=0,shellQ=0,shellN=0,chainGood=0,chainNear=0;const parent=Array.from({length:N},(_,i)=>i),sz=new Array(N).fill(1);const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},join=(a,b)=>{a=root(a);b=root(b);if(a===b)return;if(sz[a]<sz[b])[a,b]=[b,a];parent[b]=a;sz[a]+=sz[b];};const rmin=+$('shellMin').value*nominalDhyd(c),rmax=+$('shellMax').value*nominalDhyd(c);
  for(let i=0;i<N;i++){const a=state.particles[i],miX=Math.cos(a.theta),miY=Math.sin(a.theta);for(let j=i+1;j<N;j++){const b=state.particles[j];let dx=b.x-a.x,dy=b.y-a.y;if(!c.gradientOn){dx=minImage(dx,c.Lx);dy=minImage(dy,c.Ly);}const r=Math.hypot(dx,dy);if(r<=0||r>=rMax)continue;const k=Math.min(nb-1,Math.floor(r/dr));count[k]++;const rx=dx/r,ry=dy/r,mjX=Math.cos(b.theta),mjY=Math.sin(b.theta),phi=(Math.atan2(dy,dx)+Math.PI)%Math.PI,a2=Math.cos(2*phi),qht=(miX*rx+miY*ry)**2+(mjX*rx+mjY*ry)**2-1,cm=miX*mjX+miY*mjY;a2s[k]+=a2;qhs[k]+=qht;cms[k]+=cm;nstat[k]++;
      if(r>=rmin&&r<rmax){shellA+=a2;shellQ+=qht;shellN++;angles[Math.min(angN-1,Math.floor(phi/Math.PI*angN))]++;}
      const contact=(a.dhydNm+b.dhydNm)/2;if(r<1.35*contact){chainNear++;join(i,j);if(qht>.35&&cm>.2)chainGood++;}
    }}
  const rho=Math.max(0,N-1)/(c.Lx*c.Ly),gr=[],A2r=[],Q=[],Cm=[];for(let k=0;k<nb;k++){const r1=k*dr,r2=(k+1)*dr,expected=.5*N*rho*Math.PI*(r2*r2-r1*r1);gr.push(expected>0?count[k]/expected:NaN);A2r.push(nstat[k]?a2s[k]/nstat[k]:NaN);Q.push(nstat[k]?qhs[k]/nstat[k]:NaN);Cm.push(nstat[k]?cms[k]/nstat[k]:NaN);}let largest=1;for(let i=0;i<N;i++)if(root(i)===i)largest=Math.max(largest,sz[i]);const clusterFraction=N?largest/N:0;const am=mean(Array.from(angles));const P=Array.from(angles,x=>am?x/am:0);return {r:Array.from({length:nb},(_,k)=>(k+.5)*dr/nominalDhyd(c)),gr,A2r,Q,Cm,angle:Array.from({length:angN},(_,k)=>(k+.5)*180/angN),P,A2:shellN?shellA/shellN:NaN,QHT:shellN?shellQ/shellN:NaN,chainFraction:chainNear?chainGood/chainNear:0,clusterFraction,pairs:shellN,counts:Array.from(nstat)};}
function addArrayAverage(oldArr,newArr,nOld){if(!oldArr)return [...newArr];return oldArr.map((x,i)=>{const y=newArr[i];if(!Number.isFinite(y))return x;if(!Number.isFinite(x))return y;return (x*nOld+y)/(nOld+1);});}
function accumulatePair(p){
  const n=avg.pairSamples;avg.gr=addArrayAverage(avg.gr,p.gr,n);
  if(p.pairs>0){const old=avg.angleCount||0;avg.angle=avg.angle?avg.angle.map((x,i)=>(x*old+p.P[i]*p.pairs)/(old+p.pairs)):[...p.P];avg.angleCount=old+p.pairs;}
  if(!avg.pairCounts){avg.pairCounts=new Array(p.counts.length).fill(0);avg.pairSums={a2:new Array(p.counts.length).fill(0),qht:new Array(p.counts.length).fill(0),cm:new Array(p.counts.length).fill(0)};}
  for(let k=0;k<p.counts.length;k++){const count=p.counts[k];avg.pairCounts[k]+=count;if(count){avg.pairSums.a2[k]+=p.A2r[k]*count;avg.pairSums.qht[k]+=p.Q[k]*count;avg.pairSums.cm[k]+=p.Cm[k]*count;}}
  for(const key of ['a2','qht','cm'])avg[key]=avg.pairCounts.map((n,i)=>n?avg.pairSums[key][i]/n:NaN);
  avg.pairSamples++;
}
function structureFactor(){const c=state.cfg,N=state.particles.length,nm=Math.max(2,c.qNmax|0),items=[];for(let nx=-nm;nx<=nm;nx++)for(let ny=-nm;ny<=nm;ny++){if(nx===0&&ny===0)continue;const qx=2*Math.PI*nx/c.Lx,qy=2*Math.PI*ny/c.Ly;let re=0,im=0;for(const p of state.particles){const ph=qx*p.x+qy*p.y;re+=Math.cos(ph);im+=Math.sin(ph);}items.push({nx,ny,qx,qy,q:Math.hypot(qx,qy),S:(re*re+im*im)/Math.max(1,N)});}const qmax=Math.max(...items.map(v=>v.q)),nb=Math.max(8,c.qBins|0),dq=qmax/nb,qsums=new Float64Array(nb),sums=new Float64Array(nb),cnt=new Uint32Array(nb),sp=new Float64Array(nb),cp=new Uint32Array(nb),ss=new Float64Array(nb),cs=new Uint32Array(nb),sector=c.sectorDeg*Math.PI/180;
  for(const v of items){const k=Math.min(nb-1,Math.floor(v.q/dq));qsums[k]+=v.q;sums[k]+=v.S;cnt[k]++;const ca=Math.abs(v.qx)/(v.q||1),ang=Math.acos(clamp(ca,0,1));if(ang<=sector){sp[k]+=v.S;cp[k]++;}if(Math.abs(Math.PI/2-ang)<=sector){ss[k]+=v.S;cs[k]++;}}
  const q=[],S=[],Spar=[],Sperp=[];for(let k=0;k<nb;k++){q.push(cnt[k]?qsums[k]/cnt[k]:(k+.5)*dq);S.push(cnt[k]?sums[k]/cnt[k]:NaN);Spar.push(cp[k]?sp[k]/cp[k]:NaN);Sperp.push(cs[k]?ss[k]/cs[k]:NaN);}const cand=findQCandidate(q,S,c);return {items,q,S,Spar,Sperp,qmax,nm,candidate:cand};}
function findQCandidate(q,S,c,blocks=[]){
  const qmin=Math.min(2*Math.PI/c.Lx,2*Math.PI/c.Ly),valid=S.map((v,i)=>Number.isFinite(v)?i:-1).filter(i=>i>=0);
  const bg=percentile(S.filter(Number.isFinite),.5),maxS=valid.length?Math.max(...valid.map(i=>S[i])):NaN;
  const base={q:NaN,S:maxS,credible:false,bg,qmin,blocks:blocks.length,reason:'Acquire at least 12 completed uncertainty blocks; inspect directional spectra too.'};
  if(c.gradientOn)return {...base,reason:'Periodic-fluid finite-q inference disabled for hard-wall/gradient runs.'};
  if(c.magDynamics==='legacy')return {...base,reason:'Use equilibrium sampling before interpreting a density wavelength.'};
  if(blocks.length<12)return base;
  let best=null;
  for(let k=1;k<valid.length-1;k++){
    const i=valid[k],left=valid[k-1],right=valid[k+1];
    if(S[i]<=S[left]||S[i]<=S[right]||S[i]<1.35)continue;
    const contrast=blocks.map(b=>b[i]-.5*(b[left]+b[right])).filter(Number.isFinite),bs=blockStats(contrast,1);
    // Blocks already contain sfBlockSize samples. Require conservative peak prominence,
    // a 4.5-SE threshold across the scanned bins, and consistency in both halves.
    const se=contrast.length>1?stdev(contrast)/Math.sqrt(contrast.length):NaN,half=Math.floor(contrast.length/2);
    if(!(mean(contrast)>4.5*se&&mean(contrast.slice(0,half))>0&&mean(contrast.slice(half))>0))continue;
    if(bs.tau>2.5)continue;
    if(!best||S[i]>best.S)best={q:q[i],S:S[i],index:i,prominence:mean(contrast),se,blocks:contrast.length};
  }
  if(!best)return {...base,reason:'No supported radial interior peak at the present resolution, block length and sampling duration. This is not proof of absence.'};
  const lambda=2*Math.PI/best.q,fitX=c.Lx/lambda,fitY=c.Ly/lambda;
  return {...best,credible:true,bg,qmin,lambda,fitX,fitY,boxWarning:Math.min(fitX,fitY)<3,floorWarning:best.q<1.8*qmin,reason:'Exploratory peak prominence supported by temporal blocks. Check block-length convergence, independent seeds, larger boxes and packing peaks.'};
}
function accumulateSF(sf){
  const n=avg.sfSamples;
  if(!avg.sf)avg.sf={items:sf.items.map(v=>({...v})),q:[...sf.q],S:[...sf.S],Spar:[...sf.Spar],Sperp:[...sf.Sperp],blockSum:new Array(sf.S.length).fill(0),blockCount:0,blocks:[]};
  else {avg.sf.S=addArrayAverage(avg.sf.S,sf.S,n);avg.sf.Spar=addArrayAverage(avg.sf.Spar,sf.Spar,n);avg.sf.Sperp=addArrayAverage(avg.sf.Sperp,sf.Sperp,n);for(let i=0;i<sf.items.length;i++)avg.sf.items[i].S=(avg.sf.items[i].S*n+sf.items[i].S)/(n+1);}
  avg.sfSamples++;avg.sf.blockCount++;
  for(let i=0;i<sf.S.length;i++)avg.sf.blockSum[i]+=sf.S[i];
  if(avg.sf.blockCount>=state.cfg.sfBlockSize){avg.sf.blocks.push(avg.sf.blockSum.map(x=>x/avg.sf.blockCount));if(avg.sf.blocks.length>128)avg.sf.blocks.shift();avg.sf.blockSum.fill(0);avg.sf.blockCount=0;}
  avg.sf.candidate=findQCandidate(avg.sf.q,avg.sf.S,state.cfg,avg.sf.blocks);
}
function gaussianSmoothGrid(grid,nx,ny,sigmaCells,sigmaY=sigmaCells){
  const convolve=(input,horizontal,sigma)=>{
    if(sigma<=.05)return new Float64Array(input);
    const rad=Math.min(3*(horizontal?nx:ny),Math.max(1,Math.ceil(3*sigma))),ker=[];let norm=0;
    for(let k=-rad;k<=rad;k++){const w=Math.exp(-.5*(k/sigma)**2);ker.push(w);norm+=w;}
    const out=new Float64Array(input.length);
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){let sum=0;for(let k=-rad;k<=rad;k++){const xx=horizontal?((x+k)%nx+nx)%nx:x,yy=horizontal?y:((y+k)%ny+ny)%ny;sum+=input[yy*nx+xx]*ker[k+rad]/norm;}out[y*nx+x]=sum;}
    return out;
  };
  return convolve(convolve(grid,true,sigmaCells),false,sigmaY);
}
function densityAnalysis(){const c=state.cfg,n=Math.max(8,Math.min(160,+$('densityGrid').value|0)),nx=n,ny=Math.min(160,Math.max(8,Math.round(n*c.Ly/c.Lx))),g=new Float64Array(nx*ny);for(const p of state.particles){let gx=p.x/c.Lx*nx,gy=p.y/c.Ly*ny,x0=Math.floor(gx)%nx,y0=Math.floor(gy)%ny,fx=gx-Math.floor(gx),fy=gy-Math.floor(gy),x1=(x0+1)%nx,y1=(y0+1)%ny;g[y0*nx+x0]+=(1-fx)*(1-fy);g[y0*nx+x1]+=fx*(1-fy);g[y1*nx+x0]+=(1-fx)*fy;g[y1*nx+x1]+=fx*fy;}const sigmaNm=+$('densitySigma').value*nominalDhyd(c),cellNm=.5*(c.Lx/nx+c.Ly/ny),sm=gaussianSmoothGrid(g,nx,ny,sigmaNm/(c.Lx/nx),sigmaNm/(c.Ly/ny)),m=mean(Array.from(sm)),sd=stdev(Array.from(sm)),contrast=m>0?sd/m:NaN,px=new Float64Array(nx),py=new Float64Array(ny);for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){px[x]+=sm[y*nx+x]/ny;py[y]+=sm[y*nx+x]/nx;}return {grid:sm,nx,ny,contrast,px:Array.from(px),py:Array.from(py)};}
function accumulateDensity(d){const n=avg.densitySamples;if(!avg.density||avg.density.nx!==d.nx||avg.density.ny!==d.ny){avg.density={grid:new Float64Array(d.grid),nx:d.nx,ny:d.ny};avg.densitySamples=1;return;}for(let i=0;i<d.grid.length;i++)avg.density.grid[i]=(avg.density.grid[i]*n+d.grid[i])/(n+1);avg.densitySamples++;}
function densityFromAccum(){if(!avg.density)return null;const d=avg.density,m=mean(Array.from(d.grid)),sd=stdev(Array.from(d.grid)),px=new Float64Array(d.nx),py=new Float64Array(d.ny);for(let y=0;y<d.ny;y++)for(let x=0;x<d.nx;x++){px[x]+=d.grid[y*d.nx+x]/d.ny;py[y]+=d.grid[y*d.nx+x]/d.nx;}return {...d,contrast:m>0?sd/m:NaN,px:Array.from(px),py:Array.from(py)};}
function sampleScience(){obsRevision++;if(state.cfg.magDynamics==='mc')instant.obs.pairEnergy=totalEnergyKT()/Math.max(1,state.particles.length);const p=pairAnalysis(),sf=structureFactor(),d=densityAnalysis(),mag=state.particles.length?mean(state.particles.map(x=>Math.cos(x.theta))):0;instant.pair=p;instant.sf=sf;instant.density=d;instant.obs={A2:p.A2,QHT:p.QHT,mag,densityContrast:d.contrast,SqPeak:sf.candidate.S,qstar:avg.sf?.candidate?.credible?avg.sf.candidate.q:NaN,pairEnergy:instant.obs.pairEnergy,chainFraction:p.chainFraction,clusterFraction:p.clusterFraction};accumulatePair(p);accumulateSF(sf);accumulateDensity(d);instant.obs.qstar=avg.sf?.candidate?.credible?avg.sf.candidate.q:NaN;for(const k of Object.keys(avg.obs))if(Number.isFinite(instant.obs[k]))avg.obs[k].push(instant.obs[k]);for(const k of Object.keys(avg.obs))if(avg.obs[k].length>10000)avg.obs[k].shift();state.sampleCount++;history.push({t:state.cfg.magDynamics==='mc'?state.mcSweeps:state.simTime,...instant.obs});while(history.length>state.cfg.historyMax)history.shift();host.onStatistics();}
function runningObs(){
  if(obsCacheRevision===obsRevision&&obsCache)return obsCache;
  const out={};for(const k of Object.keys(avg.obs))out[k]=blockStats(avg.obs[k],Math.max(3,Math.floor(Math.sqrt(Math.max(1,avg.obs[k].length)))));
  obsCacheRevision=obsRevision;obsCache=out;return out;
}
function fitFiniteQ(sf){if(!sf||!sf.candidate?.credible)return null;const q=sf.q,S=sf.S,q0=sf.candidate.q,bg=percentile(S.filter(Number.isFinite),.25),peak=sf.candidate.S,A=Math.max(1e-9,peak-bg);let left=q0,right=q0;const half=bg+A/2;for(let i=0;i<q.length;i++)if(q[i]<q0&&Number.isFinite(S[i])&&S[i]>=half)left=q[i];for(let i=q.length-1;i>=0;i--)if(q[i]>q0&&Number.isFinite(S[i])&&S[i]>=half)right=q[i];if(right<=left)return null;const fwhm=right-left,w2=Math.max(2*q0*fwhm,1e-9);let ss=0,rr=0,m=mean(S.filter(Number.isFinite));for(let i=0;i<q.length;i++)if(Number.isFinite(S[i])){const pred=bg+A/(1+((q[i]*q[i]-q0*q0)/w2)**2);ss+=(S[i]-pred)**2;rr+=(S[i]-m)**2;}return {q0,lambda:2*Math.PI/q0,fwhm,xi:1/fwhm,r2:rr>0?1-ss/rr:NaN,bg,A};}
avg.obs.chainFraction=[];avg.obs.clusterFraction=[];
function scientificallyStructuralChange(id){return ['coreNm','ligandNm','polyMode','polyPct','Ms','temperature','viscosity','K','magDynamics','N','boxMode','Lx','Ly','areaFraction','medium','repulsion','epsilonKT','dipoleMode','dipoleCutoff','dipoleRot','dipoleTrans','field_mT','gradientOn','gradient','seed','mcMove','mcAngle'].includes(id);}
function syncFixedPhi(c){if(c.boxMode!=='fixedPhi')return c;const dh=nominalDhyd(c),A=c.N*Math.PI*dh*dh/4/Math.max(.001,c.areaFraction),aspect=Math.max(.1,(+($('Lx').value)||1)/(+($('Ly').value)||1)),Lx=Math.sqrt(A*aspect),Ly=A/Lx;c.Lx=Lx;c.Ly=Ly;$('Lx').value=Lx.toFixed(2);$('Ly').value=Ly.toFixed(2);return c;}
function coreForLambda(target,c){if(!(target>0))return 2;let lo=2,hi=80;for(let it=0;it<60;it++){const mid=(lo+hi)/2,cc={...c,coreNm:mid},lam=dimensionless({...cc,Lx:c.Lx,Ly:c.Ly}).lambda;if(lam<target)lo=mid;else hi=mid;}return (lo+hi)/2;}
function validationChecks(){
  const saved={...state},out=[];
  const pass=(ok,label)=>out.push((ok?'PASS':'FAIL')+' — '+label);
  try{
    const r1=new RNG('validation'),r2=new RNG('validation');let same=true;for(let i=0;i<1000;i++)if(r1.uniform()!==r2.uniform())same=false;
    pass(same,'identical seeds reproduce the random stream');r1.state=4294967290;r1.uniform();pass(r1.state<=4294967295,'RNG state wraps at 32 bits');
    state.cfg={...saved.cfg,Lx:500,Ly:500,qNmax:10,qBins:36,gradientOn:false,magDynamics:'mc',dipoleTrans:true,dipoleRot:true,repulsion:'hard'};
    const p={x:0,y:0,theta:0,coreNm:state.cfg.coreNm,dhydNm:nominalDhyd(),mu:nominalMoment()},b={...p,x:nominalDhyd()+1e-6};
    pass(Math.abs(pairEnergyKT(p,b)+2*dimensionless().lambda)<1e-5,'head-to-tail pair energy agrees with −2λ');
    const peaks=[];
    for(const L of [500,1000]){
      state.cfg.Lx=state.cfg.Ly=L;const r=new RNG('stripe-'+L);state.particles=[];
      while(state.particles.length<400){const x=r.uniform()*L;if(r.uniform()<(1+.9*Math.cos(2*Math.PI*x/125))/1.9)state.particles.push({...p,x,y:r.uniform()*L});}
      const sf=structureFactor(),peak=sf.items.filter(x=>x.ny===0&&x.nx>0).reduce((a,b)=>a.S>b.S?a:b);peaks.push(peak);
    }
    pass(peaks.every(p=>Math.abs(p.q-2*Math.PI/125)<1e-9),'actual direct-coordinate S(q) detects a 125 nm stripe period in 500 and 1000 nm boxes');
    pass(!findQCandidate([.01,.02,.03,.04,.05],[1,1,8,1,1],state.cfg).credible,'a single high-noise snapshot cannot establish a wavelength');
    state.particles=[{...p,x:100,y:100},{...p,x:200,y:200}];state.recording=false;state.mcAttempt=0;state.rng=new RNG('trajectory');
    const initial=JSON.stringify(state.particles),rs=[state.rng.state,state.rng._g];
    for(let i=0;i<10;i++)metropolisSweep();const first=JSON.stringify(state.particles);
    state.particles=JSON.parse(initial);state.rng.state=rs[0];state.rng._g=rs[1];state.mcAttempt=0;
    for(let i=0;i<10;i++)metropolisSweep();pass(JSON.stringify(state.particles)===first,'actual Metropolis trajectories reproduce from the same state and seed');
  }catch(e){out.push('FAIL — '+e.message);}finally{Object.assign(state,saved);}
  out.push('INFO — numerical checks do not establish equilibration, an intrinsic wavelength or ferrocell physics. Repeat the controls across seeds, sizes and acquisition lengths.');
  return out;
}
/* ---------- v8 API (new; replaces the page's syncConfig and animation loop) ---------- */
function sanitize(input={}){
  // Consistency rules for a configuration (rigid matrix: Néel only; sampler: rotation follows translation).
  const c={...defaults,...input};
  c.N=Math.max(1,Math.min(1500,Math.round(c.N)));c.Lx=Math.max(20,c.Lx);c.Ly=Math.max(20,c.Ly);
  if(c.medium==='rigid'){c.magDynamics='legacy';c.gradientOn=false;c.dipoleRot=false;c.dipoleTrans=false;}
  if(c.magDynamics==='mc')c.dipoleRot=c.dipoleTrans;
  if(c.boxMode==='fixedPhi'){PAGE.Lx=c.Lx;PAGE.Ly=c.Ly;}
  return syncFixedPhi(c);
}
function configure(input,recreate=true){state.cfg=sanitize(input);if(recreate){createParticles();resetStatistics();}return state.cfg;}
/* Advance by realSeconds of wall time, as one animation frame of the original loop did (bounded by budgetMs). */
function advance(realSeconds,budgetMs=12){
  const c=state.cfg,dt=c.dtNs*1e-9,unit=c.magDynamics==='mc'?1:dt;
  state.accum+=Math.min(.1,realSeconds)*(c.magDynamics==='mc'?c.mcRate:c.simSpeed);
  state.neelBellBudget=12;const deadline=host.now()+budgetMs;let guard=0;
  while(state.accum>=unit&&guard<5000&&host.now()<deadline){
    if(c.magDynamics==='mc'){if(!metropolisSweep(deadline))break;}else physicsStep(dt);
    state.accum-=unit;guard++;
  }
  state.accum=Math.min(state.accum,10*unit);return guard;
}
function step(n=1){const c=state.cfg;for(let i=0;i<n;i++){if(c.magDynamics==='mc')metropolisSweep();else physicsStep(c.dtNs*1e-9);}}
function startRecording(){resetStatistics();state.recording=true;state.recordStart=state.simTime+state.cfg.equilUs*1e-6;state.nextSample=state.recordStart;state.nextMCSample=state.mcSweeps+state.cfg.mcEquil;}
function stopRecording(){state.recording=false;}
return {C,RNG,defaults,state,avg,instant,history,configure,sanitize,advance,step,startRecording,stopRecording,
  createParticles,resetStatistics,physicsStep,metropolisSweep,dimensionless,diffusion,nominalMoment,nominalDhyd,
  currentAreaFraction,localExternalB,computeTauLegacy,pairAnalysis,structureFactor,densityAnalysis,sampleScience,
  runningObs,fitFiniteQ,blockStats,totalEnergyKT,coreForLambda,validationChecks,scaleFreqs,csv,fmt};
}
root.createPlanarEngine=createPlanarEngine;
if(typeof module!=='undefined'&&module.exports)module.exports={createPlanarEngine};
})(typeof globalThis!=='undefined'?globalThis:this);
