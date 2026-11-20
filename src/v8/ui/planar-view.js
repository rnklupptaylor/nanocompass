/* Nanocompass v8.0 · shared view for the particle lessons 00–02 (2D planar engine).
 * A lesson supplies a spec: starting configuration, a few controls, readouts, an optional side plot
 * and its guide. This module runs the engine, draws particles as compass needles (north half red,
 * as in the logo), shows the magnetisation gauge, plays Néel-flip tones and renders the guide. */
(function(root){
'use strict';
const TAU=2*Math.PI;
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const P2=v=>Math.abs(v)<100?v.toPrecision(2):String(Math.round(v)); // 2 significant digits without exponent notation
function fmtTime(s){if(!Number.isFinite(s))return '—';const a=Math.abs(s);
  if(a>=3.15e7*100)return '≫ years';if(a>=3.15e7)return P2(s/3.15e7)+' years';if(a>=86400)return P2(s/86400)+' days';if(a>=3600)return P2(s/3600)+' h';if(a>=60)return P2(s/60)+' min';
  if(a>=1)return P2(s)+' s';if(a>=1e-3)return P2(s*1e3)+' ms';if(a>=1e-6)return P2(s*1e6)+' µs';return P2(s*1e9)+' ns';}
const sub=t=>root.NanoLessons.sub(t);
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}


/* Small line plot for lesson panels. series: [{y, color, dash, label, width}] */
function linePlot(cv,x,series,o={}){
  const dpr=Math.min(2,root.devicePixelRatio||1),W=cv.clientWidth||300,H=o.h||Math.round(Math.max(96,Math.min(165,root.innerHeight*.17)));cv.style.height=H+'px';
  const w=Math.round(W*dpr),h=Math.round(H*dpr);if(cv.width!==w)cv.width=w;if(cv.height!==h)cv.height=h;
  const g=cv.getContext('2d');g.clearRect(0,0,w,h);
  const ink=css('--ink-2')||'#555',grid=css('--grid')||'#ddd',L=36*dpr,R=8*dpr,T=(o.title?20:8)*dpr,B=28*dpr;
  const fin=a=>a.filter(Number.isFinite);const xs=fin(x),ys=fin(series.flatMap(s=>Array.from(s.y||[])));
  const x0=o.xmin??Math.min(...xs),x1=o.xmax??Math.max(...xs),y0=o.ymin??Math.min(0,...ys),y1=o.ymax??(ys.length?Math.max(...ys)*1.08:1);
  const X=v=>L+(w-L-R)*(v-x0)/((x1-x0)||1),Y=v=>h-B-(h-B-T)*(v-y0)/((y1-y0)||1);
  g.strokeStyle=grid;g.lineWidth=dpr;for(let i=0;i<=4;i++){const yy=T+(h-B-T)*i/4;g.beginPath();g.moveTo(L,yy);g.lineTo(w-R,yy);g.stroke();}
  if(o.ref!=null){g.strokeStyle=ink;g.setLineDash([3*dpr,3*dpr]);g.beginPath();g.moveTo(L,Y(o.ref));g.lineTo(w-R,Y(o.ref));g.stroke();g.setLineDash([]);}
  g.fillStyle=ink;g.font=(10.5*dpr)+'px '+(css('--ui')||'sans-serif');
  if(o.title){g.font='700 '+(12*dpr)+'px '+(css('--ui')||'sans-serif');g.fillText(o.title,L,13*dpr);g.font=(10.5*dpr)+'px sans-serif';}
  g.fillText(String(+y1.toPrecision(2)),2*dpr,T+4*dpr);g.fillText(String(+y0.toPrecision(2)),2*dpr,h-B);
  g.fillText(String(+x0.toPrecision(3)),L,h-B+13*dpr);const xr=String(+x1.toPrecision(3));g.fillText(xr,w-R-g.measureText(xr).width,h-B+13*dpr);
  if(o.xlabel){const tw=g.measureText(o.xlabel).width;g.fillText(o.xlabel,(L+w-R-tw)/2,h-5*dpr);}
  let lx=w-R;
  for(const s of series){if(!s.y)continue;g.strokeStyle=s.color||css('--accent');g.lineWidth=(s.width||2)*dpr;g.setLineDash(s.dash?s.dash.map(v=>v*dpr):[]);g.beginPath();let on=false;
    for(let i=0;i<x.length;i++){const v=s.y[i];if(!Number.isFinite(v)||!Number.isFinite(x[i])){on=false;continue;}const px=X(x[i]),py=Math.max(T,Math.min(h-B,Y(v)));if(s.dots){g.moveTo(px+2.6*dpr,py);g.arc(px,py,2.6*dpr,0,7);continue;}on?g.lineTo(px,py):g.moveTo(px,py);on=true;}if(s.dots){g.fillStyle=s.color||css('--accent');g.fill();}else g.stroke();g.setLineDash([]);
    if(s.label){g.font=(10.5*dpr)+'px sans-serif';const tw=g.measureText(s.label).width;lx-=tw+22*dpr;g.fillStyle=s.color||css('--accent');g.fillRect(lx,(o.title?6:T)+2*dpr,12*dpr,3*dpr);g.fillStyle=ink;g.fillText(s.label,lx+15*dpr,(o.title?6:T)+7*dpr);}}
  if(o.marker){g.strokeStyle=o.marker.color||'#d8382c';g.lineWidth=2*dpr;g.beginPath();g.moveTo(X(o.marker.x),T);g.lineTo(X(o.marker.x),h-B);g.stroke();}
}

/* ---------- sound: one short bell per Néel flip, pitch per particle ---------- */
let audio=null;
function bell(freq){
  try{audio=audio||new (root.AudioContext||root.webkitAudioContext)();const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();
    o.type='sine';o.frequency.value=freq||440;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.08,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+.5);
    o.connect(g).connect(audio.destination);o.start(t);o.stop(t+.55);}catch(e){}
}

function mount(ctx,spec){
  const {stage,controls,guide,level}=ctx;
  const flipsSeen={n:0};
  const engine=root.createPlanarEngine({onFlip:p=>{bell(p.freq);}});
  const cfg={...spec.config};
  // A lesson can ask for its particles to start in the middle of the box (lesson 00 shows one particle).
  function configure(){engine.configure(cfg);if(spec.centre){const c=engine.state.cfg;engine.state.particles.forEach((p,i,a)=>{p.x=c.Lx*(i+1)/(a.length+1);p.y=c.Ly/2;});}}
  configure();engine.state.sound=false;if(spec.record)engine.startRecording();
  let running=true,raf=0,last=0,mAvg=0,lastReadout=0,speedIndex=spec.speedIndex??1;
  const speeds=spec.speeds||[{label:'¼ ×',f:.25},{label:'1 ×',f:1},{label:'4 ×',f:4}];
  /* Time zoom. Lessons with physical time name the timescale of the behaviour students should watch
   * (spec.keyTime); in Auto the simulation runs so that this happens about once every keyEvery seconds
   * on screen. The step length follows, so motion stays smooth when slowed down. The readout always says
   * how much real time one second on screen represents. */
  const timed=!!spec.keyTime,EVERY=spec.keyEvery||1.5,MAXRATE=spec.maxRate||2e-3,MINRATE=1e-12;
  let timeMode='auto',rate=cfg.simSpeed,achieved=NaN,lastSim=0;
  function autoRate(){const k=spec.keyTime(engine,cfg);return Number.isFinite(k)&&k>0?k/EVERY:MAXRATE;}
  function setRate(r){rate=Math.max(MINRATE,Math.min(MAXRATE,r));const c=engine.state.cfg;cfg.simSpeed=c.simSpeed=rate;cfg.dtNs=c.dtNs=Math.max(1e-3,Math.min(10,rate*1e9/60));achieved=NaN;}
  function retime(){if(!timed)return;if(timeMode==='auto')setRate(autoRate());timeButtons?.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.t==='auto'&&timeMode==='auto')));}
  let timeButtons=null;

  /* ---------- stage ---------- */
  stage.classList.add('pv-stage');stage.textContent='';
  // Square boxes and lessons with a plot use the space beside the particles on wide screens.
  stage.classList.toggle('pv-side-ok',!!spec.plot||cfg.Ly/cfg.Lx>.8||cfg.boxMode==='fixedPhi');
  const canvasWrap=el('div','pv-canvas-wrap'),canvas=el('canvas','pv-canvas');canvas.setAttribute('role','img');
  const badge=el('div','pv-timebadge');badge.title='How much real time one second on screen shows';
  canvasWrap.append(canvas,badge);
  const hud=el('div','pv-hud');
  const gauge=el('div','pv-gauge');gauge.innerHTML='<div class="pv-gauge-label">Magnetisation along the field <b>M / M<sub>s</sub></b></div><div class="pv-gauge-bar"><span class="pv-gauge-zero"></span><span class="pv-gauge-fill"></span></div><div class="pv-gauge-scale"><span>−1</span><span>0</span><span>+1</span></div><div class="pv-gauge-value"></div>';
  const clock=el('div','pv-clock');
  hud.append(gauge,clock);
  const bar=el('div','pv-bar');
  const run=el('button','pv-btn pv-primary','Pause'),restart=el('button','pv-btn','Restart'),sound=el('button','pv-btn','Sound off');
  const speed=el('div','seg pv-speed');speeds.forEach((s,i)=>{const b=el('button','',s.label);b.type='button';b.setAttribute('aria-pressed',String(i===speedIndex));b.title='Simulation speed';b.onclick=()=>{speedIndex=i;speed.querySelectorAll('button').forEach((x,j)=>x.setAttribute('aria-pressed',String(j===i)));};speed.append(b);});
  [run,restart,sound].forEach(b=>b.type='button');
  if(timed){timeButtons=el('div','seg pv-speed');for(const [t,label,title] of [['slower','◀ Slower','Slow the simulation down 4 ×'],['auto','Auto','Choose a speed at which the key behaviour is easy to follow'],['faster','Faster ▶','Speed the simulation up 4 ×']]){const b=el('button','',label);b.type='button';b.dataset.t=t;b.title=title;
      b.onclick=()=>{if(t==='auto'){timeMode='auto';}else{timeMode='manual';setRate(rate*(t==='faster'?4:.25));}retime();};timeButtons.append(b);}
    bar.append(run,restart,sound,el('span','pv-bar-label','Time'),timeButtons);}
  else bar.append(run,restart,sound,el('span','pv-bar-label','Speed'),speed);
  const plotWrap=el('div','pv-plot');
  const inner=el('div','pv-stage-inner');inner.append(canvasWrap,hud,bar);stage.append(inner);
  // On narrow screens the plot moves to its own tab in the lower panel, so the stage keeps its space.
  const narrow=root.matchMedia?root.matchMedia('(max-width:900px)'):{matches:false,addEventListener(){}},plotHost=document.getElementById('lessonPlotPanel'),appEl=document.getElementById('app');
  function placePlot(){if(!spec.plot)return;(narrow.matches&&plotHost?plotHost:inner).append(plotWrap);}
  if(spec.plot){appEl?.setAttribute('data-has-plot','');placePlot();narrow.addEventListener('change',placePlot);}else appEl?.removeAttribute('data-has-plot');
  run.onclick=()=>{running=!running;run.textContent=running?'Pause':'Run';};
  restart.onclick=()=>{configure();if(spec.record)engine.startRecording();mAvg=0;history.length=0;retime();draw();};
  sound.onclick=()=>{engine.state.sound=!engine.state.sound;sound.textContent=engine.state.sound?'Sound on':'Sound off';sound.setAttribute('aria-pressed',String(engine.state.sound));if(engine.state.sound)bell(660);};

  /* ---------- controls ---------- */
  controls.textContent='';
  const inputs={};
  function apply(key,value,recreate,also){
    cfg[key]=value;for(const k of also||[])cfg[k]=value;
    if(recreate){configure();mAvg=0;history.length=0;if(spec.record)engine.startRecording();}
    else{const keep={Lx:engine.state.cfg.Lx,Ly:engine.state.cfg.Ly};engine.state.cfg=engine.sanitize({...cfg,...keep});
      if(engine.state.cfg.magDynamics==='legacy')for(const p of engine.state.particles)p.nextFlip=NaN;if(spec.record)engine.startRecording();} // reschedule Néel clocks for the new field or temperature
    retime();syncInputs();
  }
  // Controls may be grouped: {type:'group', label, open, items:[...]} becomes a collapsible section.
  const flat=[];
  function addControl(c,parent){
    if(c.type==='group'){const d=el('details','pv-group');if(c.open)d.open=true;d.append(el('summary','',c.label));parent.append(d);for(const x of c.items)addControl(x,d);return;}
    flat.push(c);
    if(c.type!=='toggle'&&c.type!=='choice'){const sl=root.NanoSlider.make(c,cfg[c.key],{onChange:v=>apply(c.key,v,c.recreate,c.also)});parent.append(sl.row);inputs[c.key]={c,slider:sl};return;}
    const row=el('label','pv-control');const head=el('span','pv-control-head');head.append(el('span','pv-control-name',c.label));const out=el('output','pv-control-value');head.append(out);row.append(head);
    let input;
    if(c.type==='toggle'){input=el('input');input.type='checkbox';row.classList.add('pv-toggle');row.prepend(input);head.remove();row.append(el('span','pv-control-name',c.label));
      input.onchange=()=>apply(c.key,c.on!==undefined?(input.checked?c.on:c.off):input.checked,c.recreate,c.also);}
    else if(c.type==='choice'){input=el('div','seg');for(const [v,label] of c.options){const b=el('button','',label);b.type='button';b.dataset.v=v;b.onclick=()=>apply(c.key,v,c.recreate);input.append(b);}row.append(input);}
    else{input=el('input');input.type='range';input.min=0;input.max=1000;input.step=1;row.append(input);
      const toSlider=v=>c.log?Math.round(1000*Math.log(v/c.min)/Math.log(c.max/c.min)):Math.round(1000*(v-c.min)/(c.max-c.min));
      const fromSlider=s=>{let v=c.log?c.min*(c.max/c.min)**(s/1000):c.min+(c.max-c.min)*s/1000;if(c.step)v=Math.round(v/c.step)*c.step;return +v.toFixed(6);};
      input.oninput=()=>{const v=fromSlider(+input.value);out.textContent=(c.format?c.format(v):v)+(c.unit?' '+c.unit:'');};
      input.onchange=()=>apply(c.key,fromSlider(+input.value),c.recreate);input._to=toSlider;}
    if(c.hint){const h=el('span','pv-hint',c.hint);row.append(h);}
    inputs[c.key]={c,input,out};parent.append(row);
  }
  for(const c of spec.controls)addControl(c,controls);
  function syncInputs(){
    for(const {c,input,out,slider} of Object.values(inputs)){const v=cfg[c.key];
      if(slider){slider.set(v);continue;}
      if(c.type==='toggle')input.checked=c.on!==undefined?v===c.on:!!v;
      else if(c.type==='choice')input.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===String(v))));
      else{input.value=input._to(v);out.textContent=(c.format?c.format(v):v)+(c.unit?' '+c.unit:'');}}
  }
  const readouts=el('dl','pv-readouts');controls.append(readouts);
  syncInputs();

  /* ---------- guide ---------- */
  function renderGuide(){
    guide.textContent='';const g=spec.guide[level]||spec.guide.lecture;
    const para=(cls,t)=>{const p=el('p',cls);p.innerHTML=sub(t);return p;};
    if(g.aim)guide.append(para('pv-aim',g.aim));
    if(g.read){guide.append(el('h3','','What you see'));guide.append(para('',g.read));}
    if(g.tasks?.length){guide.append(el('h3','','Try this'));const ol=el('ol');
      for(const t of g.tasks){const li=el('li'),span=el('span');span.innerHTML=sub(t.text);li.append(span);
        if(t.set){const b=el('button','pv-task-btn','Set up');b.type='button';b.onclick=()=>{Object.assign(cfg,t.set);configure();if(spec.record)engine.startRecording();mAvg=0;history.length=0;retime();syncInputs();if(!running)run.click();};li.append(' ',b);}
        ol.append(li);}guide.append(ol);}
    if(g.physics){guide.append(el('h3','','Physics'));const p=el('p','pv-physics');p.innerHTML=g.physics;guide.append(p);}
    if(g.check){const d=el('details','pv-check');d.append(el('summary','','Check yourself'));d.append(para('',g.check));if(g.answer){const a=el('p','pv-answer');a.innerHTML='<b>Answer.</b> '+sub(g.answer);d.append(a);}guide.append(d);}
  }
  renderGuide();

  /* ---------- drawing ---------- */
  const history=[];
  function draw(){
    const st=engine.state,c=st.cfg;if(!c)return;
    const dpr=Math.min(2,root.devicePixelRatio||1),aw=canvasWrap.clientWidth||600,ah=canvasWrap.clientHeight||400,cssW=Math.max(40,Math.min(aw,ah*c.Lx/c.Ly)),cssH=cssW*c.Ly/c.Lx;canvas.style.width=cssW+'px';canvas.style.height=cssH+'px';const w=Math.max(10,Math.round(cssW*dpr)),h=Math.max(10,Math.round(cssH*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const g=canvas.getContext('2d'),sx=w/c.Lx;
    g.fillStyle=css('--stage-bg')||'#eef4fb';g.fillRect(0,0,w,h);
    // field lines (field acts along +x; gradient makes it vary with height)
    if(c.field_mT!==0||c.gradientOn){g.save();g.strokeStyle=css('--field-line')||'#9db4cf';g.fillStyle=g.strokeStyle;g.lineWidth=1.2*dpr;
      for(let iy=1;iy<=4;iy++){const y=h*iy/5,B=engine.localExternalB(c.Ly*iy/5)*1e3,s=Math.sign(B)||1,len=Math.min(22,6+Math.abs(B)/4)*dpr;
        for(let x=w*.06;x<w*.97;x+=w/9){g.beginPath();g.moveTo(x-s*len/2,y);g.lineTo(x+s*len/2,y);g.stroke();g.beginPath();g.moveTo(x+s*len/2,y);g.lineTo(x+s*(len/2-5*dpr),y-3*dpr);g.lineTo(x+s*(len/2-5*dpr),y+3*dpr);g.fill();}}
      g.restore();}
    const now=performance.now(),north=css('--north')||'#d8382c',south=css('--south')||'#9b988f',core=css('--particle-core')||'#3b3a36';
    for(const p of st.particles){const x=p.x*sx,y=p.y*sx,rh=.5*p.dhydNm*sx,rc=Math.max(3*dpr,.5*p.coreNm*sx);
      if(c.showLigand){g.beginPath();g.fillStyle=css('--ligand')||'rgba(95,132,177,.18)';g.arc(x,y,rh,0,TAU);g.fill();}
      g.beginPath();g.fillStyle=core;g.arc(x,y,rc,0,TAU);g.fill();
      g.save();g.translate(x,y);g.rotate(p.theta);const l=rc*.86,wd=rc*.34;
      g.fillStyle=north;g.beginPath();g.moveTo(l,0);g.lineTo(0,wd);g.lineTo(0,-wd);g.fill();
      g.fillStyle=south;g.beginPath();g.moveTo(-l,0);g.lineTo(0,wd);g.lineTo(0,-wd);g.fill();g.restore();
      const age=now-(p.lastFlipWall||-1e9);if(spec.flashRings&&age<450){g.strokeStyle='rgba(245,180,0,'+(1-age/450)+')';g.lineWidth=3*dpr;g.beginPath();g.arc(x,y,Math.max(rh,rc)*1.35,0,TAU);g.stroke();}
    }
    if(c.gradientOn){g.strokeStyle='rgba(190,40,40,.5)';g.lineWidth=2*dpr;g.strokeRect(1,1,w-2,h-2);}
    // gauge: magnetisation averaged over about one second of viewing
    const m=st.particles.length?st.particles.reduce((s,p)=>s+Math.cos(p.theta),0)/st.particles.length:0;
    const fill=gauge.querySelector('.pv-gauge-fill');fill.style.left=(50+Math.min(0,mAvg)*50)+'%';fill.style.width=Math.abs(mAvg)*50+'%';
    gauge.querySelector('.pv-gauge-value').textContent=mAvg.toFixed(2)+' (now '+m.toFixed(2)+')';
    clock.textContent=c.magDynamics==='mc'?'Equilibrium sampling: '+st.mcSweeps+' sweeps, '+st.sampleCount+' measurements (Monte Carlo steps are not physical time)':timeText(st);
    return m;
  }
  function timeText(st){
    if(!timed)return 'Simulated time '+fmtTime(st.simTime)+' · shown at '+fmtTime(rate*speeds[speedIndex].f)+' per second';
    const limited=Number.isFinite(achieved)&&achieved<.7*rate,shown=limited?achieved:rate;
    let t='1 s on screen = '+fmtTime(shown)+' of real time';
    if(timeMode==='auto')t+=rate>=MAXRATE*.999?' · Auto: as fast as the computer allows':' · Auto: '+(spec.keyLabel||'key behaviour every '+EVERY+' s');
    if(limited)t+=' · the computer cannot go faster';
    badge.textContent='⏱ 1 s = '+fmtTime(shown)+(timeMode==='auto'?' · auto':' · fixed');
    return t+'. Simulated so far: '+fmtTime(st.simTime)+'.';
  }
  function plot(){
    if(!spec.plot)return;spec.plot(plotWrap,{engine,cfg,history,mAvg,fmtTime});
  }
  function readout(){
    readouts.textContent='';for(const [k,v,cls] of spec.readouts(engine,cfg,{mAvg,fmtTime,tShown:rate})){const dt=el('dt'),dd=el('dd',cls||'');dt.innerHTML=sub(k);dd.innerHTML=sub(v);if(cls){dt.className='pv-verdict-label';dd.classList.add('pv-verdict');}readouts.append(dt,dd);}
  }
  function frame(ts){
    const dt=last?Math.min(.1,(ts-last)/1000):0;last=ts;
    if(running&&dt>0){const c=engine.state.cfg;
      if(timed){const t0=engine.state.simTime;engine.advance(dt);const a=(engine.state.simTime-t0)/dt;achieved=Number.isFinite(achieved)?achieved+(a-achieved)*Math.min(1,dt/1.5):a;}
      else{const keep=c.simSpeed,keepR=c.mcRate,f=speeds[speedIndex].f;c.simSpeed=keep*f;c.mcRate=keepR*f;engine.advance(dt);c.simSpeed=keep;c.mcRate=keepR;}}
    const m=draw();const k=Math.min(1,dt/.8);mAvg+=(m-mAvg)*k;
    if(running&&dt>0)history.push({t:engine.state.simTime,m,mAvg,B:engine.state.cfg.field_mT});if(history.length>600)history.shift();
    if(ts-lastReadout>250){lastReadout=ts;readout();plot();}
    raf=requestAnimationFrame(frame);
  }
  // Choose a comfortable time scale for the opening settings once, then keep it fixed (Robin, 14 Nov 2026):
  // students first see how flip rates change with temperature and size; Auto is there when they want it.
  retime();timeMode='manual';retime();
  raf=requestAnimationFrame(frame);
  // The logo's two needles follow the first two particles of the lesson.
  root.NanoLogo.bind(()=>engine.state.particles.length?[engine.state.particles[0].theta+Math.PI/2,(engine.state.particles[1]||engine.state.particles[0]).theta+Math.PI/2]:null);
  return {engine,cfg,unmount(){cancelAnimationFrame(raf);root.NanoLogo.bind(null);engine.state.sound=false;narrow.removeEventListener?.('change',placePlot);plotWrap.remove();if(document.getElementById('app')?.dataset.pane==='plot')document.querySelector('#paneTabs [data-pane="controls"]')?.click();}};
}
/* Register a particle lesson. */
function lesson(id,spec){
  root.NanoLessonViews=root.NanoLessonViews||{};let live=null;
  root.NanoLessonViews[id]={spec,mount(ctx){live=mount(ctx,spec);return live;},unmount(){live?.unmount();live=null;}};
}
root.NanoPlanarView={mount,lesson,fmtTime,linePlot};
})(typeof globalThis!=='undefined'?globalThis:this);
