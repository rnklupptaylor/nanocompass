/* Nanocompass v8.0 · Magnetic measurements lesson: M(H) loops, ZFC/FC and AC susceptibility.
 * Requested by Robin on 14 November 2026. Physics: src/v8/engines/magnetometer.js, checked by tests/v8/magnetometer.cjs. */
(function(root){
'use strict';
const MV=root.NanoMagnetometerView,fmtT=s=>root.NanoPlanarView.fmtTime(s);
const temp={key:'T',label:'Temperature',min:2,max:400,step:1,unit:'K'};
function controls(c){
  const common=[
    {key:'dNm',label:'Core diameter (median)',min:4,max:30,step:.5,unit:'nm'},
    {key:'sigma',label:'Size spread σ',min:0,max:.5,step:.01,entry:{digits:2},hint:'Log-normal width; 0.2 is typical of a good synthesis.'},
    {key:'K',label:'Anisotropy K (median)',min:5,max:60,step:1,unit:'kJ m⁻³',hint:'How strongly each particle holds its moment along its easy axis.'},
    {key:'kSigma',label:'Anisotropy spread',min:0,max:1,step:.05,entry:{digits:2},hint:'Particles differ in shape, surface and strain, so their barriers differ even at equal size.'},
  ];
  if(c.mode==='loop')return [...common,{type:'choice',key:'medium',label:'Particles sit in',options:[['solid','Solid'],['liquid','Liquid']]},temp,
    {key:'Bmax',label:'Largest field',min:5,max:500,step:1,unit:'mT',log:true},
    {key:'sweepTime',label:'Time for one loop',min:1e-6,max:1e4,log:true,unit:'s'}];
  if(c.mode==='zfc')return [...common,{key:'Bm',label:'Measuring field',min:1,max:50,step:1,unit:'mT'},
    {key:'tPoint',label:'Time per point',min:1e-6,max:1e4,log:true,unit:'s',hint:'A SQUID magnetometer needs seconds to minutes per point.'},
    {key:'Tmax',label:'Highest temperature',min:50,max:400,step:10,unit:'K'}];
  return [...common,{type:'choice',key:'medium',label:'Particles sit in',options:[['solid','Solid'],['liquid','Liquid']]},
    {type:'choice',key:'against',label:'Plot against',options:[['T','Temperature'],['f','Frequency']]},
    c.against==='T'?{key:'f',label:'Frequency',min:.1,max:1e8,log:true,unit:'Hz'}:temp,
    ...(c.against==='T'?[{key:'Tmax',label:'Highest temperature',min:50,max:400,step:10,unit:'K'}]:[])];
}
function crossing(pts,branch){const a=pts.filter(p=>p.branch===branch);for(let i=1;i<a.length;i++)if(Math.sign(a[i].M)!==Math.sign(a[i-1].M)&&a[i-1].M!==0){const f=a[i-1].M/(a[i-1].M-a[i].M);return a[i-1].B+f*(a[i].B-a[i-1].B);}return NaN;}
function remanence(pts){const a=pts.filter(p=>p.branch==='down');for(let i=1;i<a.length;i++){if(a[i].B===0)return a[i].M;if(a[i].B<0&&a[i-1].B>0){const f=a[i-1].B/(a[i-1].B-a[i].B);return a[i-1].M+f*(a[i].M-a[i-1].M);}}return NaN;}
/* ZFC/FC landmarks. T_irr: bifurcation, the lowest temperature above which ZFC and FC agree within 1 %;
 * experimentally it marks blocking of the largest particles. T_L (model): Néel–Arrhenius blocking temperature
 * of a particle 2σ above the median size (97.7 % of particles are smaller), for the time per point. */
function zfcLandmarks(mag,c,pts){
  const z=pts.filter(p=>p.curve==='ZFC'||p.curve==='switch'),f=pts.filter(p=>p.curve==='FC');
  // Barrier spread combines size (E ∝ d³) and anisotropy spreads; T_L uses the barrier 2σ_E above the median.
  const sE=Math.hypot(3*c.sigma,c.kSigma||0),out={sE};out.TL=mag.blockingT(c.dNm,c.tPoint)*Math.exp(2*sE);
  if(z.length>3)out.Tmax=z.reduce((a,b)=>b.M>a.M?b:a).T;
  if(f.length>3&&f.length>=z.length-1){const fAt=T=>f.reduce((a,b)=>Math.abs(b.T-T)<Math.abs(a.T-T)?b:a).M;
    let Tirr=null;for(let i=z.length-1;i>=0;i--){const d=Math.abs(fAt(z[i].T)-z[i].M)/Math.max(1e-12,fAt(z[i].T));if(d>.01){Tirr=z[Math.min(z.length-1,i+1)].T;break;}}out.Tirr=Tirr;out.above=Tirr!=null&&Tirr>=z.at(-1).T;}
  return out;
}
function readouts(mag,c,pts){
  const rows=[['Anisotropy field 2K/M_s',(mag.hk()*1e3).toFixed(0)+' mT']];
  if(c.mode==='loop'){const hc=crossing(pts,'down'),mr=remanence(pts),tm=c.sweepTime/4,TB=mag.blockingT(c.dNm,tm);
    rows.push(['Blocking temperature for this sweep',TB.toFixed(0)+' K']);
    rows.push(['Coercive field H_c',Number.isFinite(hc)?Math.abs(hc*1e3).toFixed(1)+' mT':'measuring…'],['Remanence M_r / M_s',Number.isFinite(mr)?mr.toFixed(2):'measuring…']);
    if(Number.isFinite(hc))rows.push(Math.abs(hc)<5e-4?['Verdict','No opening: superparamagnetic on this timescale','pv-good']:['Verdict','Open loop: particles are blocked on this timescale','pv-bad']);}
  else if(c.mode==='zfc'){const TB=mag.blockingT(c.dNm,c.tPoint),z=pts.filter(p=>p.curve==='ZFC');
    rows.push(['T_B of the median particle',TB.toFixed(0)+' K']);
    const L=zfcLandmarks(mag,c,pts);if(L.Tmax!=null)rows.push(['ZFC maximum T_max',L.Tmax.toFixed(0)+' K']);
    if(L.Tirr!=null)rows.push(['ZFC and FC split at T_irr',L.above?'above '+c.Tmax.toFixed(0)+' K (not reached)':L.Tirr.toFixed(0)+' K']);
    if(L.Tirr!=null||L.sE>0)rows.push(['T_L, largest barriers block (2σ above median)',L.TL.toFixed(0)+' K']);
    if(L.Tirr!=null)rows.push(['Reading','Below T_irr ≈ T_L even the largest particles are blocked; above it all particles follow the field. Click the plot to see the particles at any temperature.','pv-warn']);}
  else{if(pts.length>5){const pk=pts.reduce((a,b)=>b.im>a.im?b:a);rows.push(['χ″ maximum',c.against==='T'?pk.T.toFixed(0)+' K':MV.fmtF(pk.f)]);
      rows.push(['Relaxation time there',fmtT(1/(2*Math.PI*(c.against==='T'?c.f:pk.f)))]);}
    rows.push(['T_B (1/2πf as measuring time)',c.against==='T'?mag.blockingT(c.dNm,1/(2*Math.PI*c.f)).toFixed(0)+' K':'—']);}
  return rows;
}
const base={mode:'loop',kSigma:.5,dNm:12,sigma:.15,K:20,medium:'solid',T:300,Bmax:200,sweepTime:10,Bm:5,tPoint:10,Tmax:300,against:'T',f:1e3};
MV.lesson('magnetometer',{
  config:base,controls,readouts,zfcLandmarks,
  // ZFC/FC pauses where the sequence changes, so the cooled state can be discussed before the field goes on.
  pauseBefore:(c,p)=>c.mode==='zfc'&&p.step===2?'switch on '+c.Bm.toFixed(0)+' mT':c.mode==='zfc'&&p.step===4?'cool in the field':c.mode==='zfc'&&p.step===5?'warm up and measure FC':'',
  curveLabel:c=>c.mode,
  guide:{
    lecture:{
      aim:'In the lab nobody watches single particles. A magnetometer measures the whole sample. Learn to read the three measurements that tell you whether particles are superparamagnetic or blocked.',
      read:'Nothing runs until you press Start measurement; you can pause at any step. The numbered strip above the plot shows the steps of the measurement, in the order they are done in the laboratory. Left: a sample of particles. The thin line through each particle is its easy axis; the needle shows its moment. A long needle keeps its direction during the measurement, a short one flips back and forth too fast to be caught. Right: the measured curve, drawn point by point. Keep a curve to compare it with the next one.',
      tasks:[
        {text:'M(H) loop at room temperature with 12 nm particles. Watch the steps: the sample starts demagnetised at zero field. Does the loop open? What does that tell you?',set:{...base,mode:'loop',T:300},clear:true},
        {text:'Cool the same sample to 10 K and measure again. Read the coercive field and the remanence.',set:{mode:'loop',T:10}},
        {text:'Use 17 nm particles (σ = 0.15) at 300 K and change only the loop time from 1 µs to 10 s. Why does the loop close when you sweep slowly?',set:{mode:'loop',dNm:17,T:300,sweepTime:1e-6},clear:true},
        {text:'Melt the sample (liquid) and repeat a fast loop. What turns the moments now?',set:{mode:'loop',medium:'liquid',sweepTime:1e-4}},
        {text:'Measure ZFC/FC. The measurement pauses after cooling: why do the needles stop flipping one after another? Then continue. Where do the two curves split, and where is the ZFC maximum?',set:{...base,mode:'zfc'},clear:true},
        {text:'Make the size spread larger (σ = 0.4). How do the ZFC peak and the splitting point change?',set:{mode:'zfc',sigma:.4}},
        {text:'AC susceptibility against temperature at 10 Hz, then at 100 kHz (keep the first curve). Why does the χ″ peak move?',set:{...base,mode:'ac',against:'T',f:10},clear:true},
        {text:'Liquid sample, AC against frequency at 300 K with 20 nm particles: which relaxation do you see?',set:{...base,mode:'ac',against:'f',medium:'liquid',dNm:20,T:300},clear:true},
      ],
      check:'A sample shows an open loop at 10 K, no opening at 300 K and a ZFC maximum at 80 K. A colleague says "the particles become non-magnetic above 80 K". What is wrong?',
      answer:'Each particle stays strongly magnetic. Above about 80 K its moment flips faster than the measurement lasts, so the sample shows no remanence. The blocking temperature depends on the measuring time, not on a change of the material.'},
    research:{
      aim:'Single-domain ensemble with log-normal sizes and random 3D easy axes: Stoner–Wohlfarth energy landscape per axis angle, thermally activated two-state Néel kinetics (f₀ = 1 GHz), Brown rotation in liquids and linear AC response.',
      read:'Loops start from the demagnetised (zero-field-cooled) state at B = 0, record the initial magnetisation curve to +B_max and then the full loop; exact two-state master equation along the sweep; at T → 0 the ensemble reproduces Stoner–Wohlfarth (H_c = 0.479 H_K, M_r = M_s/2). ZFC/FC follows the usual SQUID sequence: cool without field from the top temperature to 5 K, switch on the small measuring field, measure while warming (ZFC), cool to 5 K in the same field, and measure again while warming (FC, field-cooled warming). Cooling in a large field and measuring after switching it off would instead give a thermoremanence curve. AC: Debye response per particle with τ = τ_N/2 (solid) or 1/τ = 2/τ_N + 1/τ_B (liquid). Thermal fluctuation within a well is included through a factor s/(s + 1), s = (KV + μ|B|)/k_BT, on the mean moment projection; it restores χ₀ = μ²/(3k_BT) for random axes, so superparamagnetic curves agree with Langevin at low and high field and lie up to about 12 % below it in between, as expected for particles with KV of a few k_BT. Magnetisation is volume weighted and the superparamagnetic susceptibility grows with V², so with a size distribution the ZFC maximum lies well above T_B of the median particle.',
      tasks:[
        {text:'Verify the Stoner–Wohlfarth limit: 20 nm, no size or anisotropy spread, T = 2 K. Compare H_c with 0.479 × 2K/M_s.',set:{...base,mode:'loop',dNm:20,sigma:0,kSigma:0,T:2},clear:true},
        {text:'Sharrock behaviour: record H_c for loop times of 1 µs, 1 ms and 1 s at 250 K.',set:{...base,mode:'loop',dNm:20,sigma:0,kSigma:0,T:250,sweepTime:1e-6},clear:true},
        {text:'Identical particles (no spreads), ZFC: compare T_max with T_B = KV / (k_B ln(t/τ₀)) for 0.01 s and 100 s per point.',set:{...base,mode:'zfc',sigma:0,kSigma:0,tPoint:.01},clear:true},
        {text:'Néel–Arrhenius plot: read the χ″(T) peak at 1 Hz, 1 kHz and 1 MHz and fit ln f against 1/T_peak.',set:{...base,mode:'ac',against:'T',f:1},clear:true},
        {text:'Liquid versus solid at the same size: separate the Brown and Néel contributions in χ″(f).',set:{...base,mode:'ac',against:'f',dNm:20,medium:'solid',T:300},clear:true},
      ],
      physics:'e(θ) = sin²θ − 2h cos(θ − ψ), h = M<sub>s</sub>B/(2K); k = f<sub>0</sub> exp(−KVΔe/k<sub>B</sub>T); T<sub>B</sub> = KV/(k<sub>B</sub> ln(t<sub>m</sub>/τ<sub>0</sub>)); H<sub>c</sub>(T) ≈ H<sub>c</sub>(0)[1 − (T/T<sub>B</sub>)<sup>n</sup>] with n = 1/2 for aligned and about 0.75 for random axes; χ(ω) = Σ χ<sub>0,i</sub>/(1 + iωτ<sub>i</sub>), χ″ maximal at ωτ = 1.',
      check:'Why do ZFC/FC, M(H) and AC measurements on the same sample give different "blocking temperatures"?',
      answer:'Each probes a different measuring time: seconds per point in ZFC, the sweep time in a loop, 1/(2πf) in AC. Because τ_N depends exponentially on KV/k_BT, T_B scales with 1/ln(t_m/τ₀), so shorter measuring times give higher apparent T_B.'},
  },
});
})(typeof globalThis!=='undefined'?globalThis:this);
