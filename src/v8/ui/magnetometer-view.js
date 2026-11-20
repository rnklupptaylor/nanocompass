/* Nanocompass v8.0 · "In the magnetometer" lesson view: a sample of particles beside a measurement plot.
 * Runs src/v8/engines/magnetometer.js protocols point by point so students watch the curve being measured. */
(function(root){
'use strict';
const MG=root.NanoMagnetometer,V=root.NanoPlanarView,L=root.NanoLessons;
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;};
const fmtT=s=>V.fmtTime(s);
const MV_fmtF=f=>(f>=1e6?(f/1e6).toPrecision(3)+' MHz':f>=1e3?(f/1e3).toPrecision(3)+' kHz':f.toPrecision(3)+' Hz');
const fmtF=f=>f>=1e6?(f/1e6).toPrecision(3)+' MHz':f>=1e3?(f/1e3).toPrecision(3)+' kHz':f.toPrecision(3)+' Hz';
const COLORS=['#d8382c','#2a78d6','#1b9e6f','#8b5fbf','#d0802a'];

/* Plot of one or more curves; x may be logarithmic. Earlier curves are drawn faded. */
function curvePlot(cv,curves,o){
  const dpr=Math.min(2,root.devicePixelRatio||1),W=cv.clientWidth||400,H=cv.clientHeight||300,w=Math.round(W*dpr),h=Math.round(H*dpr);
  if(cv.width!==w)cv.width=w;if(cv.height!==h)cv.height=h;const g=cv.getContext('2d');g.clearRect(0,0,w,h);
  const ink=css('--ink-2'),grid=css('--grid'),L0=48*dpr,R=12*dpr,T=26*dpr,B=40*dpr;
  const lx=v=>o.xlog?Math.log10(v):v,ly=v=>o.ylog?Math.log10(Math.max(v,1e-300)):v,x0=lx(o.xmin),x1=lx(o.xmax),y0=ly(o.ymin),y1=ly(o.ymax),X=v=>L0+(w-L0-R)*(lx(v)-x0)/(x1-x0),Y=v=>h-B-(h-B-T)*(ly(v)-y0)/(y1-y0);
  g.lineWidth=dpr;g.strokeStyle=grid;g.fillStyle=ink;g.font=(11*dpr)+'px '+css('--ui');
  const ticks=(a,b,n)=>{const out=[];for(let i=0;i<=n;i++)out.push(a+(b-a)*i/n);return out;};
  const yt=o.ylog?Array.from({length:Math.floor(y1)-Math.ceil(y0)+1},(_,i)=>10**(Math.ceil(y0)+i)):ticks(o.ymin,o.ymax,4);
  for(const v of yt){const y=Y(v);g.beginPath();g.moveTo(L0,y);g.lineTo(w-R,y);g.stroke();g.fillText(o.yfmt?o.yfmt(v):+v.toPrecision(3)+'',4*dpr,y+4*dpr);}
  const xt=o.xlog?Array.from({length:Math.floor(x1)-Math.ceil(x0)+1},(_,i)=>10**(Math.ceil(x0)+i)):ticks(o.xmin,o.xmax,5);
  for(const v of xt){const x=X(v);g.beginPath();g.moveTo(x,T);g.lineTo(x,h-B);g.stroke();const s=o.xfmt?o.xfmt(v):+v.toPrecision(3)+'';g.fillText(s,x-g.measureText(s).width/2,h-B+15*dpr);}
  if(o.zeroX&&o.xmin<0&&o.xmax>0){g.strokeStyle=ink;g.beginPath();g.moveTo(X(0),T);g.lineTo(X(0),h-B);g.stroke();}
  if(!o.ylog&&o.ymin<0&&o.ymax>0){g.strokeStyle=ink;g.beginPath();g.moveTo(L0,Y(0));g.lineTo(w-R,Y(0));g.stroke();}
  g.fillStyle=ink;g.font='600 '+(12*dpr)+'px '+css('--ui');const xl=o.xlabel;g.fillText(xl,(L0+w-R-g.measureText(xl).width)/2,h-8*dpr);
  g.fillText(o.ylabel,L0,15*dpr);
  for(const c of curves){g.globalAlpha=c.alpha??1;g.strokeStyle=c.color;g.lineWidth=(c.width||2.4)*dpr;g.setLineDash(c.dash?c.dash.map(v=>v*dpr):[]);g.beginPath();
    c.x.forEach((xv,i)=>{const px=X(xv),py=Y(c.y[i]);i?g.lineTo(px,py):g.moveTo(px,py);});g.stroke();g.setLineDash([]);g.globalAlpha=1;}
  let lxp=w-R;g.font=(11*dpr)+'px '+css('--ui');
  for(const c of curves.filter(c=>c.label&&!c.alpha)){const tw=g.measureText(c.label).width;lxp-=tw+24*dpr;g.fillStyle=c.color;g.fillRect(lxp,8*dpr,14*dpr,3*dpr);g.fillStyle=ink;g.fillText(c.label,lxp+17*dpr,13*dpr);}
  for(const vl of o.vlines||[]){const x=X(vl.x);g.strokeStyle=vl.color||ink;g.lineWidth=(vl.width||1.4)*dpr;g.setLineDash((vl.dash||[4,4]).map(v=>v*dpr));g.beginPath();g.moveTo(x,T);g.lineTo(x,h-B);g.stroke();g.setLineDash([]);
    g.font='600 '+(11*dpr)+'px '+css('--ui');const tw=g.measureText(vl.label).width,lx=Math.min(w-R-tw-4*dpr,x+4*dpr);g.fillStyle=css('--surface');g.fillRect(lx-2*dpr,T+(vl.row||0)*16*dpr+2*dpr,tw+4*dpr,14*dpr);g.fillStyle=vl.color||ink;g.fillText(vl.label,lx,T+(vl.row||0)*16*dpr+13*dpr);}
  if(o.marker){g.fillStyle=o.marker.color||'#d8382c';g.beginPath();g.arc(X(o.marker.x),Y(o.marker.y),5*dpr,0,7);g.fill();}
  cv._xmap={L0:L0/dpr,R:R/dpr,W,xmin:o.xmin,xmax:o.xmax,xlog:!!o.xlog};
}

function mount(ctx,spec){
  const {stage,controls,guide,level}=ctx;
  const cfg={...spec.config};
  let inspectT=null,pending=null,pauseNote='',zfcScale=0,acScale=0,state='ready',acc=0,last=0,shown=new Map(),mag=null,gen=null,points=[],kept=[],running=false,raf=0,lastReadout=0,display=[],measuredTime=0;
  /* ---------- layout ---------- */
  stage.classList.add('pv-stage','mg-stage');stage.textContent='';
  const inner=el('div','mg-inner'),sampleWrap=el('div','mg-sample'),sample=el('canvas'),info=el('div','mg-info');sampleWrap.append(sample,info);
  const plotWrap=el('div','mg-plot'),steps=el('ol','mg-steps'),plotBox=el('div','mg-plotbox'),plot=el('canvas');plotBox.append(plot);const hint=el('div','mg-hint','Set the sample and conditions, then press Start measurement.');plotBox.append(hint);plotWrap.append(steps,plotBox);
  const bar=el('div','pv-bar');
  const modes=el('div','seg mg-modes');for(const [m,label] of [['loop','M(H) loop'],['zfc','ZFC / FC'],['ac','AC susceptibility']]){const b=el('button','',label);b.type='button';b.dataset.m=m;b.onclick=()=>{cfg.mode=m;buildControls();prepare();};modes.append(b);}
  const go=el('button','pv-btn pv-primary','Measure again'),keep=el('button','pv-btn','Keep curve'),clear=el('button','pv-btn','Clear');[go,keep,clear].forEach(b=>b.type='button');
  go.onclick=()=>{if(state==='running'){state='paused';}else if(state==='paused'){state='running';pauseNote='';if(pending){points.push(pending);pending=null;}}else{if(state==='done')prepare();state='running';last=0;}label();};keep.onclick=()=>{if(points.length){kept.push({mode:cfg.mode,against:cfg.against,points:points.slice()});kept=kept.slice(-4);}};clear.onclick=()=>{kept=[];drawPlot();};
  bar.append(modes,go,keep,clear);
  // After a ZFC/FC run, clicking the plot picks a temperature: the sample picture then shows the particles there,
  // in the measuring field, with the unblocked ones flipping.
  plot.addEventListener('click',e=>{if(cfg.mode!=='zfc'||state!=='done'||!plot._xmap)return;const m=plot._xmap,r=plot.getBoundingClientRect(),u=(e.clientX-r.left-m.L0)/(m.W-m.L0-m.R);
    inspectT=Math.max(5,Math.min(cfg.Tmax,m.xmin+u*(m.xmax-m.xmin)));display.forEach(p=>{p.inspectSign=null;});});
  inner.append(sampleWrap,plotWrap);stage.append(inner,bar);

  /* ---------- controls ---------- */
  const readouts=el('dl','pv-readouts');
  function slider(c){return root.NanoSlider.make(c,cfg[c.key],{onChange:v=>{cfg[c.key]=v;prepare();}}).row;}
  function choice(c){const row=el('div','pv-control');row.append(el('span','pv-control-head',c.label));const seg=el('div','seg');
    for(const [v,label] of c.options){const b=el('button','',label);b.type='button';b.setAttribute('aria-pressed',String(cfg[c.key]===v));b.onclick=()=>{cfg[c.key]=v;buildControls();prepare();};seg.append(b);}row.append(seg);return row;}
  function buildControls(){
    controls.textContent='';modes.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.m===cfg.mode)));
    for(const c of spec.controls(cfg))controls.append(c.type==='choice'?choice(c):slider(c));
    controls.append(readouts);
  }
  /* ---------- guide ---------- */
  function renderGuide(){
    guide.textContent='';const g=spec.guide[level]||spec.guide.lecture,sub=L.sub;
    const para=(cls,t)=>{const p=el('p',cls);p.innerHTML=sub(t);return p;};
    guide.append(para('pv-aim',g.aim));guide.append(el('h3','','What you see'));guide.append(para('',g.read));
    guide.append(el('h3','','Try this'));const ol=el('ol');
    for(const t of g.tasks){const li=el('li'),sp=el('span');sp.innerHTML=sub(t.text);li.append(sp);
      if(t.set){const b=el('button','pv-task-btn','Set up');b.type='button';b.onclick=()=>{if(t.clear)kept=[];Object.assign(cfg,t.set);buildControls();prepare();};li.append(' ',b);}ol.append(li);}
    guide.append(ol);
    if(g.physics){guide.append(el('h3','','Physics'));const p=el('p','pv-physics');p.innerHTML=g.physics;guide.append(p);}
    if(g.check){const d=el('details','pv-check');d.append(el('summary','','Check yourself'));d.append(para('',g.check));const a=el('p','pv-answer');a.innerHTML='<b>Answer.</b> '+sub(g.answer);d.append(a);guide.append(d);}
  }
  /* ---------- measurement ---------- */
  function prepare(){
    if(cfg.mode==='zfc')cfg.medium='solid';
    mag=new MG.Magnetometer({dNm:cfg.dNm,sigma:cfg.sigma,K:cfg.K*1e3,kSigma:cfg.kSigma||0,medium:cfg.medium});
    points=[];measuredTime=0;
    if(cfg.mode==='loop')gen=MG.loopProtocol(mag,{T:cfg.T,Bmax:cfg.Bmax/1e3,sweepTime:cfg.sweepTime,steps:240});
    else if(cfg.mode==='zfc')gen=MG.zfcfcProtocol(mag,{Bm:cfg.Bm/1e3,Tmin:5,Tmax:cfg.Tmax,dT:cfg.Tmax/80,tPoint:cfg.tPoint});
    else gen=MG.acProtocol(mag,{against:cfg.against,f:cfg.f,T:cfg.T,Tmin:5,Tmax:cfg.Tmax,fmin:.01,fmax:1e9,points:160});
    // Fix the ZFC/FC scale in advance with a coarse run, so the axis does not jump while cooling.
    acScale=0;if(cfg.mode==='ac'){const q=new MG.Magnetometer({dNm:cfg.dNm,sigma:cfg.sigma,K:cfg.K*1e3,kSigma:cfg.kSigma||0,medium:cfg.medium});for(const v of MG.acProtocol(q,{against:cfg.against,f:cfg.f,T:cfg.T,Tmin:5,Tmax:cfg.Tmax,fmin:.01,fmax:1e9,points:60}))acScale=Math.max(acScale,v.re,v.im);}
    zfcScale=0;if(cfg.mode==='zfc'){const q=new MG.Magnetometer({dNm:cfg.dNm,sigma:cfg.sigma,K:cfg.K*1e3,kSigma:cfg.kSigma||0,sizeBins:12,psiBins:8});for(const v of MG.zfcfcProtocol(q,{Bm:cfg.Bm/1e3,Tmin:5,Tmax:cfg.Tmax,dT:cfg.Tmax/20,tPoint:cfg.tPoint}))zfcScale=Math.max(zfcScale,v.M);}
    state='ready';acc=0;pending=null;pauseNote='';inspectT=null;label();pickDisplay();renderReadouts();
  }
  function label(){go.textContent=state==='running'?'Pause':state==='paused'?(pauseNote?'Continue: '+pauseNote:'Continue'):state==='done'?'Measure again':'Start measurement';go.classList.toggle('pv-pulse',state==='ready');}
  function pickDisplay(){ // representative particles for the sample picture
    shown=new Map();display.forEach(p=>p.sign=null);
    const n=36,r=mulberry(7);display=[];const nsum=mag.sizes.reduce((a,x)=>a+x.n,0);
    for(let k=0;k<n;k++){let ui=r()*nsum,i=0;for(;i<mag.sizes.length-1;i++){ui-=mag.sizes[i].n;if(ui<0)break;} /* sizes drawn by number, as in the sample */ let u=r(),j=0,acc=0;for(;j<mag.psis.length-1;j++){acc+=mag.psiW[j];if(u<acc)break;}
      const flip=r()<.5?1:-1,side=r()<.5?1:-1;display.push({i,j,axis:side*mag.psis[j]+(flip<0?Math.PI:0),flip,x:(k%6+.5+(r()-.5)*.35)/6,y:(Math.floor(k/6)+.5+(r()-.5)*.35)/6});}
  }
  function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function frame(ts){
    const dt=last?Math.min(.1,(ts-last)/1000):0;last=ts;running=state==='running';
    if(running&&gen){acc+=dt*(cfg.mode==='loop'?40:cfg.mode==='zfc'?18:16);
      while(acc>=1){acc-=1;const r=gen.next();if(r.done){state='done';running=false;label();break;}
        const prevStep=points.at(-1)?.step,stop=prevStep!=null&&r.value.step!==prevStep&&spec.pauseBefore?.(cfg,r.value);
        if(stop){pending=r.value;pauseNote=stop;state='paused';running=false;label();acc=0;break;}
        points.push(r.value);}}
    fdt=dt;drawSample();drawPlot();drawSteps();
    const now=performance.now();if(now-lastReadout>300){lastReadout=now;renderReadouts();}
    raf=requestAnimationFrame(frame);
  }
  /* ---------- drawing ---------- */
  let fdt=0;
  function drawSample(){
    const dpr=Math.min(2,root.devicePixelRatio||1),W=sampleWrap.clientWidth,H=Math.max(60,sampleWrap.clientHeight-info.offsetHeight-4),S=Math.max(40,Math.min(W,H));
    sample.style.width=S+'px';sample.style.height=S+'px';const w=Math.round(S*dpr);if(sample.width!==w){sample.width=w;sample.height=w;}
    const g=sample.getContext('2d');g.fillStyle=css('--stage-bg');g.fillRect(0,0,w,w);
    const last=points.at(-1)||{},B=cfg.mode==='ac'?0:last.B||0,T=last.T??cfg.T;
    if(Math.abs(B)>1e-5){g.strokeStyle=css('--field-line');g.fillStyle=g.strokeStyle;g.lineWidth=1.3*dpr;const s=Math.sign(B),len=Math.min(.12,.03+Math.abs(B)*.5)*w;
      for(let r=0;r<6;r++){const y=(r+.98)/6*w;for(let c=0;c<4;c++){const x=(c+.5)/4*w;g.beginPath();g.moveTo(x-s*len/2,y);g.lineTo(x+s*len/2,y);g.stroke();g.beginPath();g.moveTo(x+s*len/2,y);g.lineTo(x+s*(len/2-5*dpr),y-3*dpr);g.lineTo(x+s*(len/2-5*dpr),y+3*dpr);g.fill();}}}
    const north=css('--north'),south=css('--south'),core=css('--particle-core'),dmax=Math.max(...mag.sizes.map(s=>s.d));
    const lastPt=points.at(-1);
    // Each needle shows one particle. It flips at an on-screen rate that grows with the chance of a flip within
    // one measuring point (tPoint, one field step of the loop, or one AC period): particles that relax much faster
    // flicker steadily (about 3 per second), blocked ones stay still. A flip picks the new direction with the
    // occupation computed by the model, so in a field most needles settle along it.
    const inspecting=inspectT!=null&&state==='done'&&cfg.mode==='zfc',Tnow=inspecting?inspectT:lastPt?.T??cfg.T,tMeas=cfg.mode==='zfc'?cfg.tPoint:cfg.mode==='loop'?cfg.sweepTime/480:1/(2*Math.PI*(lastPt?.f??cfg.f));
    for(const p of display){const s=mag.sizes[p.i],x=p.x*w,y=p.y*w,r=(.035+.04*s.d/dmax)*w;
      const tn=mag.tauN(s,Tnow),tau=cfg.medium==='liquid'?1/(2/tn+1/(s.tauB/Tnow)):tn/2;
      let pa=cfg.mode==='ac'?.5:cfg.medium==='liquid'?(1+mag.m[p.i][p.j])/2:mag.p[p.i][p.j];
      if(inspecting){pa=.5+.5*Math.tanh(s.mu*cfg.Bm/1e3*Math.cos(mag.psis[p.j])/(MG.KB*Tnow));
        if(p.inspectSign==null){p.inspectSign=p.sign??(Math.random()<.5?1:-1);p.sign=p.inspectSign;}}
      if(p.sign==null)p.sign=Math.random()<pa?1:-1;
      if(running||inspecting){const rate=3*(1-Math.exp(-tMeas/tau));if(Math.random()<rate*fdt){const ns=Math.random()<pa?1:-1;if(ns!==p.sign){p.sign=ns;p.flashed=performance.now();}}
        if(!inspecting&&(pa>.98&&p.sign<0||pa<.02&&p.sign>0)){p.sign=-p.sign;p.flashed=performance.now();}} // the barrier has vanished: forced switch
      const m=p.sign*p.flip;
      g.beginPath();g.fillStyle=core;g.arc(x,y,r,0,7);g.fill();
      const ang=cfg.medium==='liquid'?0:p.axis;g.save();g.translate(x,y);g.rotate(ang);
      g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1*dpr;g.beginPath();g.moveTo(-r*.9,0);g.lineTo(r*.9,0);g.stroke(); // easy axis
      const l=r*.86,wd=r*.32,dir=m>=0?1:-1;
      g.fillStyle=north;g.beginPath();g.moveTo(dir*l,0);g.lineTo(0,wd);g.lineTo(0,-wd);g.fill();g.fillStyle=south;g.beginPath();g.moveTo(-dir*l,0);g.lineTo(0,wd);g.lineTo(0,-wd);g.fill();g.restore();
      const age=performance.now()-(p.flashed||-1e9);if(age<350){g.strokeStyle='rgba(245,180,0,'+(1-age/350)+')';g.lineWidth=2*dpr;g.beginPath();g.arc(x,y,r*1.25,0,7);g.stroke();}}
    info.innerHTML=inspecting?L.sub('Inspecting '+inspectT.toFixed(0)+' K in '+cfg.Bm.toFixed(0)+' mT: flipping needles are particles that are not blocked at this temperature (they relax within '+V.fmtTime(cfg.tPoint)+'); still needles are blocked. Click another temperature to compare.'):L.sub((cfg.mode==='ac'?'Small alternating field, ':'Field '+(B*1e3).toFixed(1)+' mT, ')+'T = '+(+T).toFixed(0)+' K'+(cfg.medium==='liquid'?' · liquid':' · solid')+(cfg.mode==='ac'?'. Needles that keep flipping follow the oscillating field; still needles are too slow to follow it.':'. Needles that keep flipping are superparamagnetic within one measuring point; still needles are blocked. A yellow ring marks a Néel flip.'));
  }
  function curves(mode,pts,alpha){
    const col=alpha?css('--muted'):null;
    if(mode==='loop'){const v=pts.filter(p=>p.branch==='virgin'),l=pts.filter(p=>p.branch!=='virgin');if(l.length&&v.length)l.unshift(v.at(-1));
      return [{x:v.map(p=>p.B*1e3),y:v.map(p=>p.M),color:col||COLORS[2],alpha,dash:[6,4],label:alpha?'':'initial curve'},{x:l.map(p=>p.B*1e3),y:l.map(p=>p.M),color:col||COLORS[0],alpha,label:alpha?'':'loop'}];}
    if(mode==='zfc'){const c=pts.filter(p=>p.curve==='cool'),z=pts.filter(p=>p.curve==='switch'||p.curve==='ZFC'),fc=pts.filter(p=>p.curve==='fccool'),f=pts.filter(p=>p.curve==='FC');
      return [{x:c.map(p=>p.T),y:c.map(p=>p.M),color:col||'#8f8d86',alpha,dash:[6,4],label:alpha?'':'cooling, no field'},{x:fc.map(p=>p.T),y:fc.map(p=>p.M),color:col||COLORS[0],alpha:alpha||.45,width:1.6,dash:[3,4],label:''},{x:z.map(p=>p.T),y:z.map(p=>p.M),color:col||COLORS[1],alpha,label:alpha?'':'ZFC'},{x:f.map(p=>p.T),y:f.map(p=>p.M),color:col||COLORS[0],alpha,label:alpha?'':'FC'}];}
    const key=cfg.against==='T'?'T':'f';return [{x:pts.map(p=>p[key]),y:pts.map(p=>p.re),color:col||COLORS[1],alpha,label:alpha?'':'χ′ (in phase)'},{x:pts.map(p=>p[key]),y:pts.map(p=>p.im),color:col||COLORS[0],alpha,label:alpha?'':'χ″ (out of phase)'}];
  }
  /* Protocol strip: the steps of the measurement as done in the laboratory, the current one highlighted. */
  function drawSteps(){
    const list=cfg.mode==='loop'?['Start demagnetised, field 0 (sample cooled without field)','Raise the field to +'+cfg.Bmax.toFixed(0)+' mT: initial curve','Sweep down to −'+cfg.Bmax.toFixed(0)+' mT','Sweep back up to +'+cfg.Bmax.toFixed(0)+' mT']
      :cfg.mode==='zfc'?['Cool from '+cfg.Tmax.toFixed(0)+' K to 5 K without field','Switch on '+cfg.Bm.toFixed(0)+' mT at 5 K','Warm up and measure: ZFC','Cool to 5 K in the '+cfg.Bm.toFixed(0)+' mT field','Warm up and measure: FC']
      :[cfg.against==='T'?'Apply a small field oscillating at '+MV_fmtF(cfg.f)+', step the temperature':'Hold '+cfg.T.toFixed(0)+' K, step the frequency of a small oscillating field','Measure the in-phase (χ′) and delayed (χ″) response'];
    const cur=pending?pending.step:points.at(-1)?.step||(cfg.mode==='ac'?(points.length?2:1):1),key=cfg.mode+'|'+list.join('|')+'|'+cur+'|'+state;
    if(steps.dataset.key===key)return;steps.dataset.key=key;steps.textContent='';
    list.forEach((t,i)=>{const li=el('li','',t);if(i+1<cur||state==='done')li.className='done';if(i+1===cur&&(state==='running'||state==='paused'))li.className=pending?'next':'now';steps.append(li);});
  }
  function drawPlot(){
    const mode=cfg.mode,all=[...kept.filter(k=>k.mode===mode&&(mode!=='ac'||k.against===cfg.against)).flatMap(k=>curves(mode,k.points,.55)),...curves(mode,points,null)];
    let o;
    if(mode==='loop')o={xmin:-cfg.Bmax,xmax:cfg.Bmax,ymin:-1.05,ymax:1.05,xlabel:'Applied field (mT)',ylabel:'M / Ms',zeroX:true};
    else if(mode==='zfc'){const ys=all.flatMap(c=>c.y);o={xmin:0,xmax:cfg.Tmax,ymin:0,ymax:Math.max(1e-3,zfcScale,...ys)*1.1,xlabel:'Temperature (K)',ylabel:'M / Ms at '+cfg.Bm.toFixed(0)+' mT'};}
    else{const ys=all.flatMap(c=>c.y);o=cfg.against==='T'?{xmin:5,xmax:cfg.Tmax,xlabel:'Temperature (K) at '+fmtF(cfg.f),ylabel:'χ / χ(300 K, static)'}:{xmin:.01,xmax:1e9,xlog:true,xfmt:v=>v>=1e6?(v/1e6)+'M':v>=1e3?(v/1e3)+'k':''+v,xlabel:'Frequency (Hz) at '+cfg.T.toFixed(0)+' K',ylabel:'χ / χ(300 K, static)'};o.ymin=0;o.ymax=Math.max(1e-30,acScale,...ys)*1.1;}
    const sw=cfg.mode==='zfc'&&points.find(p=>p.curve==='switch');if(sw)o.marker={x:sw.T,y:sw.M,color:COLORS[1]};
    if(cfg.mode==='zfc'&&spec.zfcLandmarks){const Lm=spec.zfcLandmarks(mag,cfg,points);o.vlines=[];
      if(Lm.Tmax!=null&&state==='done')o.vlines.push({x:Lm.Tmax,label:'ZFC maximum '+Lm.Tmax.toFixed(0)+' K',color:COLORS[1],row:0});
      if(Lm.Tirr!=null&&!Lm.above)o.vlines.push({x:Lm.Tirr,label:'split '+Lm.Tirr.toFixed(0)+' K: largest particles block',color:COLORS[0],row:1});
      if(inspectT!=null)o.vlines.push({x:inspectT,label:'inspecting '+inspectT.toFixed(0)+' K',color:'#c0882a',dash:[1,0],width:2,row:2});}
    curvePlot(plot,all,o);
    hint.hidden=!(points.length===0&&state==='ready'||cfg.mode==='zfc'&&state==='done'&&inspectT==null);
    if(cfg.mode==='zfc'&&state==='done'&&inspectT==null){hint.textContent='Click the plot at any temperature to see which particles still flip there.';hint.classList.add('mg-hint-low');}
    else{hint.textContent='Set the sample and conditions, then press Start measurement.';hint.classList.remove('mg-hint-low');}
    plot.style.cursor=cfg.mode==='zfc'&&state==='done'?'crosshair':'';
  }
  function renderReadouts(){
    readouts.textContent='';for(const [k,v,cls] of spec.readouts(mag,cfg,points)){const dt=el('dt'),dd=el('dd',cls||'');dt.innerHTML=L.sub(k);dd.innerHTML=L.sub(v);if(cls){dt.className='pv-verdict-label';dd.classList.add('pv-verdict');}readouts.append(dt,dd);}
  }
  buildControls();renderGuide();prepare();raf=requestAnimationFrame(frame);
  root.NanoLogo.bind(()=>{if(!display.length||!mag)return null;return display.slice(0,2).map(p=>{const m=mag.axisMoment(p.i,p.j)*p.flip,a=(cfg.medium==='liquid'?0:p.axis)+(m<0?Math.PI:0);return a+Math.PI/2;});});
  return {unmount(){cancelAnimationFrame(raf);root.NanoLogo.bind(null);}};
}
function lesson(id,spec){root.NanoLessonViews=root.NanoLessonViews||{};let live=null;
  root.NanoLessonViews[id]={spec,mount(ctx){live=mount(ctx,spec);return live;},unmount(){live?.unmount();live=null;}};}
root.NanoMagnetometerView={lesson,curvePlot,fmtF};
})(typeof globalThis!=='undefined'?globalThis:this);
