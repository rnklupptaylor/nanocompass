/* Nanocompass · Lab: the particle simulation with every control and more measurements than the lessons.
 * Built on the 2D particle engine and the particle view; outputs are shown in tabs below or beside the particles. */
(function(root){
'use strict';
const V=root.NanoPlanarView,PL=root.NanoParticleLessons;
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const kB=1.380649e-23;
const base={medium:'fluid',viscosity:1,temperature:300,ligandNm:2,polyMode:'mono',polyPct:15,Ms:480,magDynamics:'legacy',K:10000,neelRandom:.5,
  gradientOn:false,gradient:0,repulsion:'wca',epsilonKT:15,dipoleMode:'full',boxMode:'fixedPhi',areaFraction:.06,N:30,coreNm:12,field_mT:20,
  dipoleRot:true,dipoleTrans:true,simSpeed:1e-5,dtNs:10,showLigand:true,scale:'major',seed:'Nanocompass-lab',neelProjected:true};

/* ---------- outputs ---------- */
const TABS=[['m','Magnetisation'],['pc','Pair correlations'],['sizes','Particle sizes'],['times','Relaxation times']];
function steps(edges,counts){const x=[],y=[];counts.forEach((c,i)=>{x.push(edges[i],edges[i+1]);y.push(c,c);});return {x,y};}
function plotLab(wrap,{engine,history,fmtTime}){
  if(!wrap._tabs){wrap.innerHTML='';const tabs=document.createElement('div');tabs.className='seg pv-outtabs';wrap._tab='m';
    for(const [k,label] of TABS){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.k=k;b.onclick=()=>{wrap._tab=k;tabs.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.k===k)));};tabs.append(b);}
    const cv=document.createElement('canvas'),grid=document.createElement('div');grid.className='lab-pc';for(let i=0;i<4;i++)grid.append(document.createElement('canvas'));
    wrap.append(tabs,cv,grid);wrap._tabs=tabs;wrap._cv=cv;wrap._grid=grid;tabs.querySelector('button').setAttribute('aria-pressed','true');}
  const cv=wrap._cv,st=engine.state,acc=css('--accent'),red='#d8382c';
  cv.style.display=wrap._tab==='pc'?'none':'';wrap._grid.style.display=wrap._tab==='pc'?'grid':'none';
  accumulatePairs(wrap,engine);
  if(wrap._tab==='m'){
    const h=history.slice(-400);if(h.length<2){V.linePlot(cv,[0,1],[{y:[0,0],color:acc}],{title:'Magnetisation along the field',ymin:-1,ymax:1,xlabel:'simulated time'});return;}
    const t0=h[0].t,x=h.map(p=>(p.t-t0));V.linePlot(cv,x,[{y:h.map(p=>p.m),color:'#8f8d86',label:'now',width:1.2},{y:h.map(p=>p.mAvg),color:red,label:'averaged'}],{title:'Magnetisation M/M_s along the field',ymin:-1,ymax:1,ref:0,xlabel:'simulated time (last '+fmtTime(x.at(-1))+')'});return;}
  if(wrap._tab==='sizes'){
    const d=st.particles.map(p=>p.coreNm),lo=Math.min(...d)*.9,hi=Math.max(...d)*1.1,nb=12,w=(hi-lo)/nb||1,edges=Array.from({length:nb+1},(_,i)=>lo+i*w),c=new Array(nb).fill(0);
    for(const v of d)c[Math.min(nb-1,Math.floor((v-lo)/w))]++;const s=steps(edges,c);V.linePlot(cv,s.x,[{y:s.y,color:acc,label:'particles'}],{title:'Core diameters in the box',ymin:0,xlabel:'core diameter (nm)'});return;}
  if(wrap._tab==='times'){
    // Néel and Brown time of every particle against its size (log scale): the faster process wins.
    const c=st.cfg,kT=kB*c.temperature,pts=st.particles.map(p=>{const V3=Math.PI*(p.coreNm*1e-9)**3/6,tn=1e-9*Math.exp(Math.min(700,c.K*V3/kT)),tb=c.medium==='fluid'?1/(2*engine.diffusion(p).Dr):NaN;return {d:p.coreNm,tn:Math.log10(tn),tb:Math.log10(tb)};}).sort((a,b)=>a.d-b.d);
    const ys=pts.flatMap(p=>[p.tn,p.tb]).filter(Number.isFinite);V.linePlot(cv,pts.map(p=>p.d),[{y:pts.map(p=>p.tn),color:red,label:'Néel τ_N',dots:true},{y:pts.map(p=>p.tb),color:acc,label:'Brown τ_B',dots:true}],
      {title:'Relaxation time of each particle (log₁₀ of seconds)',ymin:Math.floor(Math.min(...ys,-9)),ymax:Math.ceil(Math.max(...ys,-6)),ref:Math.log10(c.simSpeed),xlabel:'core diameter (nm) · dashed: what one second on screen shows'});return;}
  // Pair correlations of the current run, averaged over every update since the last change of settings.
  const A=wrap._pc,avg=k=>A[k].map((v,i)=>A[k+'n'][i]?v/A[k+'n'][i]:NaN),H=Math.round(Math.max(80,Math.min(140,root.innerHeight*.13))),cs=wrap._grid.querySelectorAll('canvas'),n=' ('+A.n+' snapshots)';
  if(!A.n)return;
  V.linePlot(cs[0],A.r,[{y:avg('gr'),color:acc}],{h:H,title:'Distance to neighbours g(r)'+n,ymin:0,ref:1,xlabel:'r / particle diameter'});
  V.linePlot(cs[1],A.angle,[{y:avg('P'),color:acc}],{h:H,title:'Direction to close neighbours P(φ)',ymin:0,ref:1,xmin:0,xmax:180,xlabel:'angle to the field (°): 0 = along it'});
  V.linePlot(cs[2],A.r,[{y:avg('Q'),color:red}],{h:H,title:'Head-to-tail order of pairs (+1 head to tail, −1 side by side)',ymin:-1,ymax:1,ref:0,xlabel:'r / particle diameter'});
  V.linePlot(cs[3],A.r,[{y:avg('Cm'),color:'#1b9e6f'}],{h:H,title:'Alignment of the two moments (+1 parallel)',ymin:-1,ymax:1,ref:0,xlabel:'r / particle diameter'});
}


/* Running averages of the pair analysis; restarted whenever particles are recreated or a setting changes. */
function accumulatePairs(wrap,engine){
  const st=engine.state,c=st.cfg,key=[c.field_mT,c.temperature,c.dipoleTrans,c.viscosity,c.K,c.gradientOn,c.gradient,c.medium].join('|');
  if(!wrap._pc||wrap._pc.parts!==st.particles||wrap._pc.key!==key)wrap._pc={parts:st.particles,key,n:0};
  const A=wrap._pc,p=engine.pairAnalysis();
  if(!A.n){A.r=p.r;A.angle=p.angle;for(const k of ['gr','P','Q','Cm']){A[k]=new Array(p[k].length).fill(0);A[k+'n']=new Array(p[k].length).fill(0);}}
  for(const k of ['gr','P','Q','Cm'])p[k].forEach((v,i)=>{if(Number.isFinite(v)){A[k][i]+=v;A[k+'n'][i]++;}});
  A.n++;
}

/* ---------- read-outs ---------- */
let lastFlips=null;
function readouts(engine,cfg,{fmtTime}){
  const st=engine.state,c=st.cfg,p=st.particles[0];if(!p)return [];
  const t=PL.times(engine),d=engine.dimensionless(),rows=[];
  rows.push(['Particles in the box',String(st.particles.length)],['Area covered',(100*engine.currentAreaFraction()).toFixed(1)+' %']);
  rows.push(['Néel time τ_N (median particle)',fmtTime(t.tauN)]);if(c.medium==='fluid')rows.push(['Brown time τ_B (median particle)',fmtTime(t.tauB)]);
  rows.push(['Field energy μB / k_BT',d.alpha.toFixed(2)],['Coupling λ',d.lambda.toFixed(2)]);
  const now=performance.now();if(lastFlips&&now>lastFlips.t){const r=(st.neelEvents-lastFlips.n)/((st.simTime-lastFlips.s)||Infinity);if(Number.isFinite(r)&&r>=0)rows.push(['Néel flips per particle and µs',(r*1e-6/Math.max(1,st.particles.length)).toPrecision(2)]);}
  lastFlips={t:now,n:st.neelEvents,s:st.simTime};
  rows.push(['Simulated time',fmtTime(st.simTime)]);
  return rows;
}
const kfmt=v=>(v/1000).toFixed(v<10000?1:0)+' kJ m⁻³';
V.lesson('lab',{
  flashRings:true,plot:plotLab,readouts,
  keyTime:e=>PL.times(e).tau,keyLabel:'about one flip or turn per particle every 1.5 s',
  config:base,
  controls:[
    {type:'group',label:'Particles',open:true,items:[
      {key:'N',label:'Number of particles',min:2,max:150,step:1,recreate:true},
      {key:'coreNm',label:'Core diameter (median)',min:4,max:30,step:.5,unit:'nm',recreate:true},
      {key:'polyMode',label:'Sizes',type:'choice',options:[['mono','All equal'],['lognormal','Spread']],recreate:true},
      {key:'polyPct',label:'Size spread',min:5,max:40,step:1,unit:'%',recreate:true,hint:'Used when Sizes is set to Spread (log-normal).'},
      {key:'ligandNm',label:'Coating thickness',min:.5,max:6,step:.5,unit:'nm',recreate:true},
      {key:'Ms',label:'Magnetisation of the core material',min:100,max:500,step:10,unit:'kA/m',recreate:true,hint:'Magnetite ≈ 480 kA/m.'},
      {key:'K',label:'Anisotropy K',min:2000,max:50000,log:true,step:100,entry:{scale:1e-3,unit:'kJ m⁻³',digits:1},hint:'Sets the Néel barrier KV.'},
    ]},
    {type:'group',label:'Surroundings',open:true,items:[
      {key:'medium',label:'Particles sit in',type:'choice',options:[['fluid','Liquid'],['rigid','Solid']],recreate:true},
      {key:'temperature',label:'Temperature',min:10,max:500,step:5,unit:'K'},
      {key:'viscosity',label:'Viscosity of the liquid',min:.3,max:100,log:true,step:.1,unit:'mPa s',hint:'Water ≈ 1 mPa s; light oil ≈ 5–10 mPa s.'},
      {key:'areaFraction',label:'Concentration (area covered)',min:.01,max:.3,step:.01,entry:{scale:100,unit:'%',digits:0},recreate:true},
    ]},
    {type:'group',label:'Field',open:true,items:[
      {key:'field_mT',label:'Field (to the right)',min:-200,max:500,step:1,unit:'mT'},
      {key:'gradientOn',label:'Field gradient (strength changes from bottom to top)',type:'toggle',recreate:true},
      {key:'gradient',label:'Gradient',min:0,max:.3,step:.005,unit:'mT/nm',hint:'Exaggerated so that drift towards the strong field is visible within microseconds.'},
    ]},
    {type:'group',label:'Forces between particles',items:[
      {key:'dipoleTrans',also:['dipoleRot'],label:'Magnetic forces between particles',type:'toggle',recreate:false},
    ]},
    {type:'group',label:'Display and sound',items:[
      {key:'showLigand',label:'Show the coating',type:'toggle'},
      {key:'scale',label:'Tone scale for Néel flips',type:'choice',options:[['major','Major'],['minor','Minor'],['dorian','Dorian'],['lydian','Lydian']],recreate:true},
    ]},
  ],
  guide:{
    lecture:{
      aim:'Free play. Change anything and watch both the particles and the measurements.',
      read:'The particle view works as in the lessons: red needle tips are north poles, yellow rings mark Néel flips, the badge shows the time zoom. Below or beside it, choose a measurement: magnetisation over time, the sizes of the particles in the box, the Néel and Brown time of every particle, or the pair correlations: how far apart neighbours sit, in which direction, and whether their moments line up. Settings are grouped on the right; open a group to see its controls.',
      tasks:[
        {text:'Give the particles a size spread (25 %) and look at Relaxation times: which particles flip by Néel, which turn by Brown?',set:{polyMode:'lognormal',polyPct:25,coreNm:14,N:40}},
        {text:'Make a solid at 300 K with 20 nm particles, then cool it. Watch the Néel times rise above what the screen can show.',set:{medium:'rigid',coreNm:20,temperature:300,polyMode:'mono'}},
        {text:'Make chains: 16 nm cores, thin coating, 300 mT. Press Auto so that particles move visibly, then open Pair correlations: a peak of g(r) at distance 1 means particles touch, and P(φ) shows that they touch head to tail along the field.',set:{medium:'fluid',coreNm:16,ligandNm:1.5,field_mT:300,dipoleTrans:true,dipoleRot:true,N:60,areaFraction:.08}},
        {text:'Switch on a field gradient and watch the particles drift towards the stronger field (magnetophoresis). Press Auto if they hardly move.',set:{gradientOn:true,gradient:.15,field_mT:0,coreNm:14,N:40}},
        {text:'Make the liquid 100 times more viscous. Which relaxation slows down, and which does not?',set:{viscosity:100,coreNm:14,polyMode:'mono'}},
      ],
      check:'In a liquid, which relaxation time depends on the viscosity, and which on the anisotropy?',
      answer:'Brown rotation (τ_B ∝ ηV_h/k_BT) depends on viscosity and the coated size; Néel relaxation (τ_N = τ₀ exp(KV/k_BT)) depends on anisotropy and the core volume, not on the liquid.'},
    research:{
      aim:'The full 2D particle model: Brownian translation and rotation (Stokes–Einstein), Néel reversals on an event clock with the field component along the easy axis, point dipoles, WCA sterics.',
      read:'Time step 10 ns or shorter (the time zoom shortens it); periodic boundaries without a gradient, hard walls with one. Pair correlations are averaged over all snapshots since the last change of settings (close neighbours: 1–2.5 particle diameters); τ_N uses the zero-field barrier, τ_B = πηd_h³/(2k_BT).',
      tasks:[
        {text:'Check Curie behaviour: 10 nm, forces off, 10 mT; compare averaged M at 150 K and 300 K.',set:{coreNm:10,dipoleTrans:false,dipoleRot:false,field_mT:10,temperature:150}},
        {text:'Find the core size at which τ_N = τ_B at 300 K in water (K = 10 kJ m⁻³).',set:{coreNm:18,K:10000,viscosity:1,temperature:300}},
      ],
      physics:'D<sub>t</sub> = k<sub>B</sub>T/(3πηd<sub>h</sub>), D<sub>r</sub> = k<sub>B</sub>T/(πηd<sub>h</sub><sup>3</sup>) (rotation in the plane); τ<sub>N</sub> = τ<sub>0</sub> exp(KV/k<sub>B</sub>T); λ = μ<sub>0</sub>μ²/(4πd<sub>h</sub><sup>3</sup>k<sub>B</sub>T); magnetophoretic force F = (μ·∇)B.',
      check:'Why does the Brown time depend on the coated size but the Néel time only on the core?',
      answer:'Brown rotation turns the whole particle against the liquid, so its friction depends on the hydrodynamic (coated) size. Néel relaxation turns only the magnetisation inside the crystal, against the anisotropy barrier of the magnetic core.'},
  },
});
})(typeof globalThis!=='undefined'?globalThis:this);
