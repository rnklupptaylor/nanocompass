/* Nanocompass · lessons 00 One particle, 01 Ferrofluid in a field and 03 Chains,
 * built on the 2D particle engine. Lecture texts pose tasks; Research texts name the physics. */
(function(root){
'use strict';
const V=root.NanoPlanarView,kB=1.380649e-23,mu0=4e-7*Math.PI;
const nm3=d=>Math.PI*(d*1e-9)**3/6;
function times(engine){
  const c=engine.state.cfg,p=engine.state.particles[0];if(!p)return {};
  const V=nm3(c.coreNm),kT=kB*c.temperature,barrier=c.K*V/kT,tauN=1e-9*Math.exp(barrier);
  const tauB=c.medium==='fluid'?1/(2*engine.diffusion(p).Dr):Infinity;
  const tau=1/(1/tauN+1/tauB);
  return {barrier,tauN,tauB,tau,mu:c.Ms*1e3*V,kT};
}
/* 2D equilibrium for moments that turn freely in the plane: ⟨cos θ⟩ = I1(α)/I0(α). */
function besselRatio(a){if(a>30)return 1-1/(2*a)-1/(8*a*a);let i0=0,i1=0,t=1;for(let k=0;k<60;k++){if(k>0)t*=(a/2)**2/(k*k);i0+=t;i1+=t*(a/2)/(k+1);}return i1/i0;}
function langevin(a){return Math.abs(a)<1e-4?a/3:1/Math.tanh(a)-1/a;}

const common={medium:'fluid',viscosity:1,temperature:300,ligandNm:2,polyMode:'mono',Ms:480,magDynamics:'legacy',K:10000,neelRandom:.5,
  gradientOn:false,gradient:0,repulsion:'wca',epsilonKT:15,dipoleMode:'full',boxMode:'fixedBox',simSpeed:1e-5,dtNs:10,showLigand:true,scale:'major',seed:'Nanocompass-v8',
  neelProjected:true}; // Néel flips use the field along the easy axis (detailed balance)

/* ---------------- 00 One particle ---------------- */
V.lesson('particle',{
  flashRings:true,centre:true,
  keyTime:e=>times(e).tau,keyLabel:'about one flip or turn every 1.5 s',
  config:{...common,N:1,Lx:90,Ly:60,coreNm:10,field_mT:0,dipoleRot:false,dipoleTrans:false},
  controls:[
    {key:'coreNm',label:'Core diameter',min:6,max:32,step:.5,unit:'nm',recreate:true},
    {key:'temperature',label:'Temperature',min:50,max:400,step:5,unit:'K'},
    {key:'medium',label:'The particle sits in',type:'choice',options:[['fluid','Liquid'],['rigid','Solid']],recreate:true},
    {key:'field_mT',label:'Field',min:0,max:50,step:1,unit:'mT'},
  ],
  readouts(engine,cfg,{fmtTime}){
    // The verdict uses a fixed laboratory measuring time, independent of the on-screen time zoom.
    const t=times(engine),tM=100;if(!t.tauN)return [];
    const verdict=t.tau<tM/20?['Superparamagnetic: forgets north within a 100 s measurement','pv-good']:t.tau>tM*20?['Blocked: keeps north for longer than a 100 s measurement','pv-bad']:['Near blocking: relaxes during a 100 s measurement','pv-warn'];
    const rows=[['Barrier KV / k_BT',t.barrier.toFixed(1)],['Néel flip time τ_N',fmtTime(t.tauN)]];
    if(cfg.medium==='fluid')rows.push(['Brown rotation time τ_B',fmtTime(t.tauB)]);
    rows.push(['Magnetometer measuring time','100 s'],['Verdict',verdict[0],verdict[1]]);return rows;
  },
  guide:{
    lecture:{
      aim:'A magnetic nanoparticle is a tiny compass needle. Unlike a real compass, it may not keep its direction. Find out what makes it forget.',
      read:'The circle is one 10 nm iron-oxide particle inside a thin coating; the red half of the needle is its north pole. A yellow ring marks each Néel flip: the magnetisation jumps to the opposite direction inside the particle, while the particle itself stays put. In a liquid the whole particle also turns and wanders, which is Brownian motion. The gauge shows how far the needle points along the field direction (to the right); averaged over time it shows what a magnetometer would measure for many such particles. Flips can take nanoseconds or years, so the app zooms time: the badge says how much real time one second on screen shows. The zoom is chosen when the lesson opens and then stays fixed, so changes in the flip rate are real; Auto re-chooses it for the current settings.',
      tasks:[
        {text:'Watch the 10 nm particle. Does its needle keep its direction for more than an instant? Switch on the sound: every tone is one flip.'},
        {text:'Make the core larger, step by step. The time scale stays fixed, so you see the flips slow down. When they become too rare to watch, press Auto: the app speeds up time until flips are visible again, and the badge shows by how much. At what size does the Néel flip time exceed the 100 s a magnetometer needs for one measurement?',set:{coreNm:20}},
        {text:'Cool a 20 nm particle in a solid to 60 K. What happens to the flips, and why?',set:{coreNm:20,temperature:60,medium:'rigid'}},
        {text:'Put a 30 nm particle into a solid at room temperature. Now only Néel flips could turn the moment. Is it blocked? Then melt the solid: what turns the moment now?',set:{coreNm:30,medium:'rigid',temperature:300}},
        {text:'Switch on a 30 mT field with a small particle. You have defined the superparamagnetic state when the needle forgets its direction at zero field but spends most of its time along the field when it is on.',set:{coreNm:10,medium:'fluid',field_mT:30}},
      ],
      check:'Two particles have cores of 8 nm and 16 nm. Which one keeps its direction longer, and by roughly what factor? Use the barrier, which grows with the core volume.',
      answer:'The 16 nm core has eight times the volume, so its barrier KV / k_BT is eight times higher. τ_N grows exponentially with the barrier, so the larger particle keeps its direction enormously longer (not just eight times).'},
    research:{
      aim:'Néel and Brown relaxation compete; the faster one sets the effective relaxation time τ = (1/τ_N + 1/τ_B)⁻¹. Blocking means τ exceeds the measurement time.',
      read:'Uniaxial cores with K = 10 kJ m⁻³ and M_s = 480 kA m⁻¹; τ_N = τ₀ exp(KV/k_BT) with τ₀ = 1 ns and a field-dependent barrier (1 ± B/B_K)². Néel reversals are scheduled per particle with an event clock, so several can happen within one 10 ns step. Brownian rotation uses the Stokes–Einstein rotational diffusion of the hydrodynamic sphere in water.',
      tasks:[
        {text:'Find the core diameter at which τ_N equals the viewing window at 300 K, and compare it with τ_B.',set:{coreNm:18}},
        {text:'Compare a solid (Néel only) and a liquid (Néel and Brown) at 20 nm. Which mechanism dominates in each?',set:{coreNm:20,medium:'rigid'}},
        {text:'At 50 mT, check whether flips towards the field outnumber flips away from it.',set:{coreNm:14,field_mT:50}},
      ],
      physics:'τ<sub>N</sub> = τ<sub>0</sub> exp(KV/k<sub>B</sub>T), τ<sub>B</sub> = πηd<sub>h</sub><sup>3</sup>/(2k<sub>B</sub>T) for rotation in the plane, τ<sup>−1</sup> = τ<sub>N</sub><sup>−1</sup> + τ<sub>B</sub><sup>−1</sup>. The blocking temperature follows from τ(T<sub>B</sub>) = t<sub>m</sub>: T<sub>B</sub> ≈ KV / (k<sub>B</sub> ln(t<sub>m</sub>/τ<sub>0</sub>)).',
      check:'Why does the blocking temperature depend on the measurement technique (for example magnetometry with t_m ≈ 100 s versus Mössbauer spectroscopy with t_m ≈ 10 ns)?',
      answer:'T_B ≈ KV/(k_B ln(t_m/τ₀)). A shorter t_m makes the logarithm smaller, so the same particles appear blocked up to a higher temperature.'},
  },
});

/* ---------------- 01 Ferrofluid in a field ---------------- */
V.lesson('fluid',{
  keyTime:e=>times(e).tau,keyEvery:2,keyLabel:'each needle flips or turns about every 2 s',
  config:{...common,N:60,Lx:300,Ly:200,coreNm:10,field_mT:20,dipoleRot:false,dipoleTrans:false},
  controls:[
    {key:'field_mT',label:'Field',min:0,max:200,step:1,unit:'mT'},
    {key:'temperature',label:'Temperature',min:50,max:400,step:5,unit:'K'},
    {key:'coreNm',label:'Core diameter',min:6,max:16,step:.5,unit:'nm',recreate:true},
    {key:'medium',label:'Particles sit in',type:'choice',options:[['fluid','Liquid'],['rigid','Solid']],recreate:true},
  ],
  readouts(engine,cfg,{mAvg}){
    const t=times(engine);if(!t.mu)return [];const a=t.mu*cfg.field_mT*1e-3/t.kT;
    const rows=[['Magnetic energy μB / k_BT',a.toFixed(2)],['Measured M / M_s',mAvg.toFixed(2)]];
    if(cfg.medium==='fluid')rows.push(['Expected for free turning',besselRatio(a).toFixed(2)]);
    return rows;
  },
  plot(wrap,{engine,cfg,mAvg}){
    // Magnetisation curve against the applied field (mT, as on the slider): theory for the current particles and
    // temperature, the current measured point and earlier points measured with the same particles and temperature.
    let cv=wrap.querySelector('canvas');if(!cv){wrap.innerHTML='<div class="pv-plot-title">Magnetisation curve</div>';cv=document.createElement('canvas');wrap.append(cv);wrap._pts=[];}
    const t=times(engine);if(!t.mu)return;const Bmax=200,key=[cfg.temperature,cfg.coreNm,cfg.medium].join('|'),alpha=B=>t.mu*B*1e-3/t.kT;
    if(wrap._key!==key){wrap._key=key;wrap._pts=[];}
    if(cfg.medium==='fluid'&&engine.state.simTime>2e-5)wrap._pts.push([cfg.field_mT,mAvg]);if(wrap._pts.length>400)wrap._pts.shift();
    const PH=Math.round(Math.max(96,Math.min(165,root.innerHeight*.17))),dpr=Math.min(2,root.devicePixelRatio||1),w=Math.round(wrap.clientWidth*dpr),h=Math.round(PH*dpr);cv.width=w;cv.height=h;cv.style.height=PH+'px';
    const g=cv.getContext('2d'),L=40*dpr,B=26*dpr,X=x=>L+(w-L-10*dpr)*x/Bmax,Y=y=>h-B-(h-B-8*dpr)*y;
    const ink=getComputedStyle(document.documentElement).getPropertyValue('--ink-2'),acc=getComputedStyle(document.documentElement).getPropertyValue('--accent');
    g.strokeStyle=ink;g.fillStyle=ink;g.lineWidth=dpr;g.font=11*dpr+'px sans-serif';g.beginPath();g.moveTo(L,8*dpr);g.lineTo(L,h-B);g.lineTo(w-10*dpr,h-B);g.stroke();
    g.fillText('M/Ms',L+6*dpr,14*dpr);g.fillText('1',L-12*dpr,Y(1)+4*dpr);g.fillText('0',L-12*dpr,Y(0)+4*dpr);const xl='Field (mT)';g.fillText(xl,w-10*dpr-g.measureText(xl).width,h-6*dpr);
    for(const x of [0,50,100,150]){const s=String(x);g.fillText(s,X(x)-g.measureText(s).width/2,h-B+13*dpr);}
    g.strokeStyle=acc;g.lineWidth=2*dpr;g.beginPath();for(let i=0;i<=160;i++){const x=i/160*Bmax,y=besselRatio(alpha(x));i?g.lineTo(X(x),Y(y)):g.moveTo(X(x),Y(y));}g.stroke();
    if(root.Nanocompass?.state.level==='research'){g.setLineDash([4*dpr,4*dpr]);g.strokeStyle=ink;g.beginPath();for(let i=0;i<=160;i++){const x=i/160*Bmax,y=langevin(alpha(x));i?g.lineTo(X(x),Y(y)):g.moveTo(X(x),Y(y));}g.stroke();g.setLineDash([]);}
    g.fillStyle='rgba(216,56,44,.25)';for(const [x,y] of wrap._pts)if(x<=Bmax){g.beginPath();g.arc(X(x),Y(y),2.5*dpr,0,7);g.fill();}
    g.fillStyle='#d8382c';g.beginPath();g.arc(X(Math.min(cfg.field_mT,Bmax)),Y(mAvg),5*dpr,0,7);g.fill();
  },
  guide:{
    lecture:{
      aim:'A ferrofluid is strongly magnetic near a magnet, but it is not a magnet itself. See how the needles share out their directions between order and heat.',
      read:'Sixty particles in water, without forces between them. The field points to the right. The gauge and the red dot on the curve show how far the needles agree with the field on average; the blue line is what theory expects when each needle can turn freely. Pale dots are your earlier measurements at the same temperature and particle size; changing either starts a new curve.',
      tasks:[
        {text:'Set the field to zero. Where does the gauge settle? Now raise the field slowly and watch the dot climb the curve.',set:{field_mT:0}},
        {text:'Find the field at which the fluid reaches half of its maximum magnetisation.'},
        {text:'Keep 40 mT and heat the fluid from 150 K to 400 K. Why does the magnetisation fall?',set:{field_mT:40,temperature:150}},
        {text:'Switch the field off again. How quickly does the magnetisation vanish? This is why a ferrofluid has no remanence.',set:{field_mT:0,temperature:300}},
        {text:'Use larger particles (14 nm) in a solid. Why does the curve no longer describe them?',set:{coreNm:14,medium:'rigid',field_mT:40}},
      ],
      check:'Doubling the core diameter changes the magnetic moment by what factor, and what does that do to the field needed for half saturation?',
      answer:'The moment grows with volume, so eight times. The magnetic energy μB / k_BT reaches the same value at an eighth of the field.'},
    research:{
      aim:'Superparamagnetic magnetisation follows a Langevin-type law in α = μB/k_BT. Here moments turn in the plane, so the equilibrium is I₁(α)/I₀(α) rather than the 3D L(α) = coth α − 1/α (dashed).',
      read:'Interactions are switched off to isolate the single-particle response. Néel flips use the field component along each easy axis, so flips obey detailed balance (rate ratio exp(2μB cos θ/k_BT)).  The initial susceptibility is χ ∝ nμ²/(2k_BT) in 2D (nμ²/(3k_BT) in 3D).',
      tasks:[
        {text:'Measure M at α ≈ 1, 3 and 8 and compare with I₁/I₀.',set:{field_mT:20}},
        {text:'Confirm Curie behaviour: at fixed small field, M·T should stay constant.',set:{field_mT:10,temperature:150}},
        {text:'In the solid matrix the easy axes are frozen at random. Predict M for strong fields (⟨|cos φ|⟩ = 2/π in 2D) and test it.',set:{medium:'rigid',coreNm:12,field_mT:150}},
      ],
      physics:'⟨cos θ⟩<sub>2D</sub> = I<sub>1</sub>(α)/I<sub>0</sub>(α); ⟨cos θ⟩<sub>3D</sub> = L(α) = coth α − 1/α; μ = M<sub>s</sub>πd<sup>3</sup>/6. For a frozen random 2D texture with Ising-like moments, M/M<sub>s</sub> → ⟨|cos φ|⟩ = 2/π at saturation.',
      check:'Why does a ferrofluid show no hysteresis on the timescale of a lecture demonstration, although each particle is a permanent single-domain magnet?',
      answer:'Each moment relaxes (Néel or Brown) in nanoseconds to microseconds, far shorter than the time the field is swept, so the ensemble always stays in equilibrium.'},
  },
});

/* ---------------- 02 Chains ---------------- */
V.lesson('chains',{
  keyTime:e=>{const p=e.state.particles[0];if(!p)return NaN;const D=e.diffusion(p).Dt;return (p.dhydNm*1e-9)**2/(4*D);},keyEvery:1,keyLabel:'a particle moves about its own size each second',
  config:{...common,N:40,Lx:260,Ly:180,coreNm:15,ligandNm:2,field_mT:100,dipoleRot:true,dipoleTrans:true},
  controls:[
    {key:'coreNm',label:'Core diameter',min:8,max:20,step:.5,unit:'nm',recreate:true,hint:'Larger cores have stronger attraction.'},
    {key:'ligandNm',label:'Coating thickness',min:1,max:6,step:.5,unit:'nm',recreate:true,hint:'The coating keeps cores apart.'},
    {key:'field_mT',label:'Field',min:0,max:500,step:5,unit:'mT'},
    {key:'dipoleTrans',also:['dipoleRot'],label:'Magnetic forces between particles',type:'toggle',recreate:false},
  ],
  readouts(engine,cfg){
    const d=engine.dimensionless(),pa=engine.pairAnalysis();
    const lam=d.lambda,verdict=lam>4?['Strong: chains expected','pv-bad']:lam>1.5?['Moderate: pairs and short chains','pv-warn']:['Weak: particles stay apart','pv-good'];
    return [['Coupling λ (pair energy / k_BT)',lam.toFixed(2)],['Head-to-tail energy',(-2*lam).toFixed(1)+' k_BT'],['Expectation',verdict[0],verdict[1]],
      ['Particles in head-to-tail contact',Number.isFinite(pa.chainFraction)?Math.round(100*pa.chainFraction)+' %':'—']];
  },
  guide:{
    lecture:{
      aim:'Every particle is a small magnet, so neighbours attract when north meets south. Find out when this wins over the jostling of heat and the coating that keeps them apart.',
      read:'Forty particles with 15 nm cores in water, in a 100 mT field to the right. Pale discs show the coating. Watch for particles that line up head to tail along the field.',
      tasks:[
        {text:'Watch for about a minute. Do chains form, and do they last?'},
        {text:'Try 15 nm particles in a strong field (500 mT) with magnetic forces on. Now switch the forces off. What changes?',set:{coreNm:15,field_mT:500,dipoleTrans:true,dipoleRot:true}},
        {text:'Make the cores smaller (10 nm). Why do the chains fall apart?',set:{coreNm:10}},
        {text:'Thicken the coating of 15 nm particles to 5 nm. This is how ferrofluids are stabilised.',set:{coreNm:15,ligandNm:5}},
        {text:'Switch the field off with large particles. Do they still pair up?',set:{coreNm:18,ligandNm:2,field_mT:0}},
      ],
      check:'A ferrofluid for a loudspeaker must not form chains, even next to a strong magnet. Name two ways the manufacturer can achieve this.',
      answer:'Use smaller cores (λ grows with the cube of the core size) and a thicker coating (which keeps the cores further apart). Both lower the coupling λ.'},
    research:{
      aim:'The dipolar coupling λ = μ₀μ²/(4πd_h³k_BT) compares the head-to-tail contact energy −2λk_BT with thermal energy. Chains need λ well above 1; typical commercial fluids have λ ≈ 1.',
      read:'Full pairwise point-dipole forces and torques, WCA steric repulsion at the hydrodynamic contact distance, Brownian dynamics with 10 ns steps and event-clock Néel flips. The head-to-tail fraction counts neighbours within the contact shell whose moments and separation are both aligned.',
      tasks:[
        {text:'Sweep the core size at 2 nm coating and locate the λ at which the contact fraction rises.',set:{coreNm:12,ligandNm:2,field_mT:100}},
        {text:'Compare zero field and 300 mT at λ ≈ 4: are chains field-induced or spontaneous?',set:{coreNm:16,field_mT:0}},
        {text:'Open the Lab to follow the distances between neighbours (g(r)) while chains form.'},
      ],
      physics:'λ = μ<sub>0</sub>μ<sup>2</sup>/(4πd<sub>h</sub><sup>3</sup>k<sub>B</sub>T), U<sub>HT</sub> = −2λk<sub>B</sub>T, U<sub>side</sub> = +λk<sub>B</sub>T (parallel, side by side). Chain formation in zero field typically requires λ ≳ 3–4 (Weis &amp; Levesque; Holm &amp; Weis).',
      check:'Why does a thicker coating reduce λ even though the magnetic core is unchanged?',
      answer:'λ is evaluated at contact, where the dipole energy scales as 1/r³. A thicker coating increases the closest approach d_h, so the contact energy drops as (d_core+2δ)⁻³.'},
  },
});

root.NanoParticleLessons={besselRatio,langevin,times};
})(typeof globalThis!=='undefined'?globalThis:this);
