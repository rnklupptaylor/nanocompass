/* Nanocompass v8.0 · ferrocell digital twin view (lesson "Why does a ferrocell glow?").
 * The observer's view of the cell is rendered by src/v8/engines/ferrocell.js whenever a setting changes.
 * Drag the magnet (dashed outline) or, with a lamp behind the cell, the lamp. */
(function(root){
'use strict';
const F=root.NanoFerrocell,L=root.NanoLessons;
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;};
const HALF=42,CELL_R=40;

function mount(ctx,spec){
  const {stage,controls,guide,level}=ctx;
  const cfg={...spec.config};
  let fieldCache=null,fieldKey='',img=null,dirty=true,raf=0,hover=null,drag=null,quick=false;
  stage.classList.add('pv-stage','fc-stage');stage.textContent='';
  const inner=el('div','fc-inner'),wrap=el('div','fc-wrap'),cv=el('canvas','fc-canvas'),cap=el('div','fc-caption');wrap.append(cv);inner.append(wrap,cap);
  const bar=el('div','pv-bar'),showField=el('button','pv-btn','Show field direction');showField.type='button';
  showField.onclick=()=>{cfg.showField=!cfg.showField;showField.setAttribute('aria-pressed',String(!!cfg.showField));showField.textContent=cfg.showField?'Hide field direction':'Show field direction';dirty=true;};
  bar.append(showField);stage.append(inner,bar);
  /* ---------- controls ---------- */
  const readouts=el('dl','pv-readouts');
  function slider(c){return root.NanoSlider.make(c,cfg[c.key],{onInput:v=>{cfg[c.key]=v;quick=true;dirty=true;},onChange:v=>{cfg[c.key]=v;quick=false;dirty=true;}}).row;}
  function choice(c){const row=el('div','pv-control');row.append(el('span','pv-control-head',c.label));const seg=el('div','seg');
    for(const [v,label] of c.options){const b=el('button','',label);b.type='button';b.setAttribute('aria-pressed',String(cfg[c.key]===v));b.onclick=()=>{cfg[c.key]=v;buildControls();dirty=true;};seg.append(b);}row.append(seg);
    if(c.hint)row.append(el('span','pv-hint',c.hint));return row;}
  function buildControls(){controls.textContent='';for(const c of spec.controls(cfg))controls.append(c.type==='choice'?choice(c):slider(c));controls.append(readouts);}
  function renderReadouts(){readouts.textContent='';for(const [k,v,cls] of spec.readouts(cfg,hover,fieldCache)){const dt=el('dt'),dd=el('dd',cls||'');dt.innerHTML=L.sub(k);dd.innerHTML=L.sub(v);if(cls){dt.className='pv-verdict-label';dd.classList.add('pv-verdict');}readouts.append(dt,dd);}}
  /* ---------- guide ---------- */
  function renderGuide(){
    guide.textContent='';const g=spec.guide[level]||spec.guide.lecture,sub=L.sub,para=(cls,t)=>{const p=el('p',cls);p.innerHTML=sub(t);return p;};
    guide.append(para('pv-aim',g.aim),el('h3','','What you see'),para('',g.read),el('h3','','Try this'));const ol=el('ol');
    for(const t of g.tasks){const li=el('li'),sp=el('span');sp.innerHTML=sub(t.text);li.append(sp);
      if(t.set){const b=el('button','pv-task-btn','Set up');b.type='button';b.onclick=()=>{Object.assign(cfg,t.set);buildControls();dirty=true;};li.append(' ',b);}ol.append(li);}
    guide.append(ol);
    if(g.physics){guide.append(el('h3','','Physics'));const p=el('p','pv-physics');p.innerHTML=g.physics;guide.append(p);}
    if(g.check){const d=el('details','pv-check');d.append(el('summary','','Check yourself'),para('',g.check));const a=el('p','pv-answer');a.innerHTML='<b>Answer.</b> '+sub(g.answer);d.append(a);guide.append(d);}
  }
  /* ---------- rendering ---------- */
  function compute(){
    const N=quick?150:300,prims=F.magnets({kind:cfg.magnet,x:cfg.mx,y:cfg.my,gap:cfg.gap,Br:1.3}),key=N+'|'+cfg.magnet+'|'+cfg.mx.toFixed(2)+'|'+cfg.my.toFixed(2)+'|'+cfg.gap;
    if(key!==fieldKey){fieldCache={N,B:F.fieldGrid(prims,N,HALF),prims};fieldKey=key;}
    const leds=F.ledRing(cfg.leds,CELL_R+1,cfg.colours);
    const raw=F.render({N,half:HALF,cellR:CELL_R,eyeH:cfg.eyeH,needleUm:cfg.needleUm,orientSpread:cfg.spread,Bn:cfg.Bn/1e3,filmUm:10,mode:cfg.light,leds,lamp:{x:cfg.lampX,y:0,h:60},B:fieldCache.B});
    // tone mapping: scale to the 99.7th percentile of lit pixels, then a soft gamma
    const vals=[];for(let i=0;i<raw.length;i+=3){const v=Math.max(raw[i],raw[i+1],raw[i+2]);if(v>0)vals.push(v);}vals.sort((a,b)=>a-b);
    const ref=vals.length?vals[Math.floor(vals.length*.997)]:1;img={N,raw,ref,leds};
  }
  function draw(){
    const dpr=Math.min(2,root.devicePixelRatio||1),S=Math.max(80,Math.min(wrap.clientWidth,wrap.clientHeight)),w=Math.round(S*dpr);
    cv.style.width=S+'px';cv.style.height=S+'px';if(cv.width!==w){cv.width=w;cv.height=w;}
    const g=cv.getContext('2d');g.fillStyle='#0b0b0d';g.fillRect(0,0,w,w);
    const N=img.N,id=g.createImageData(N,N),gain=cfg.exposure/img.ref;
    for(let k=0;k<N*N;k++){for(let c=0;c<3;c++){const v=1-Math.exp(-img.raw[3*k+c]*gain*1.6);id.data[4*k+c]=255*Math.pow(v,.8);}id.data[4*k+3]=255;}
    const off=document.createElement('canvas');off.width=N;off.height=N;off.getContext('2d').putImageData(id,0,0);g.imageSmoothingEnabled=true;g.drawImage(off,0,0,w,w);
    const X=x=>(x+HALF)/(2*HALF)*w,Y=y=>(HALF-y)/(2*HALF)*w,s=w/(2*HALF);
    g.strokeStyle='rgba(255,255,255,.25)';g.lineWidth=1.5*dpr;g.beginPath();g.arc(X(0),Y(0),CELL_R*s,0,7);g.stroke();
    if(cfg.light==='edge')for(const l of img.leds){g.fillStyle='rgb('+l.rgb.map(v=>Math.round(255*v)).join(',')+')';g.beginPath();g.arc(X(l.x),Y(l.y),1.2*s,0,7);g.fill();}
    else{g.strokeStyle='rgba(255,230,150,.8)';g.setLineDash([3*dpr,3*dpr]);g.beginPath();g.arc(X(cfg.lampX),Y(0),3*s,0,7);g.stroke();g.setLineDash([]);}
    // magnet outline (below the cell)
    g.strokeStyle='rgba(255,255,255,.55)';g.setLineDash([5*dpr,4*dpr]);g.lineWidth=1.3*dpr;
    if(cfg.magnet==='disc'){g.beginPath();g.arc(X(cfg.mx),Y(cfg.my),6*s,0,7);g.stroke();}
    else if(cfg.magnet==='ring'){g.beginPath();g.arc(X(cfg.mx),Y(cfg.my),12*s,0,7);g.stroke();g.beginPath();g.arc(X(cfg.mx),Y(cfg.my),5*s,0,7);g.stroke();}
    else if(cfg.magnet==='bar'){g.strokeRect(X(cfg.mx-10),Y(cfg.my+4),20*s,8*s);}
    else{for(const dx of [-9,9]){g.beginPath();g.arc(X(cfg.mx+dx),Y(cfg.my),6*s,0,7);g.stroke();}}
    g.setLineDash([]);
    if(cfg.showField&&fieldCache){const B=fieldCache.B,Nf=fieldCache.N,k=17;g.strokeStyle='rgba(120,200,255,.85)';g.lineWidth=1.4*dpr;
      for(let a=0;a<k;a++)for(let b=0;b<k;b++){const x=-HALF+2*HALF*(a+.5)/k,y=HALF-2*HALF*(b+.5)/k;if(Math.hypot(x,y)>CELL_R)continue;const i=Math.min(Nf-1,Math.floor((x+HALF)/(2*HALF)*Nf)),j=Math.min(Nf-1,Math.floor((HALF-y)/(2*HALF)*Nf)),q=3*(j*Nf+i),bx=B[q],by=B[q+1],m=Math.hypot(bx,by);if(m<1e-4)continue;
        const l=1.7*s;g.beginPath();g.moveTo(X(x)-bx/m*l,Y(y)+by/m*l);g.lineTo(X(x)+bx/m*l,Y(y)-by/m*l);g.stroke();}}
    cap.innerHTML=L.sub(spec.caption(cfg));
  }
  function loop(){if(dirty){compute();draw();renderReadouts();dirty=false;if(!quick)api.refreshInspector?.();}raf=requestAnimationFrame(loop);}
  // Point inspector (src/v8/ui/ferrocell-inspector.js): opened by a click on the cell without dragging.
  const api={F,cfg,stage,canvas:cv,HALF,CELL_R,prims:()=>fieldCache.prims,leds:()=>img.leds,closeInspector:null,refreshInspector:null};
  root._nanoFerrocellApi=api; // for automated checks
  let down=null;
  /* ---------- dragging the magnet or the lamp ---------- */
  const toCell=e=>{const r=cv.getBoundingClientRect();return [((e.clientX-r.left)/r.width)*2*HALF-HALF,HALF-((e.clientY-r.top)/r.height)*2*HALF];};
  cv.addEventListener('pointerdown',e=>{const [x,y]=toCell(e);down={x:e.clientX,y:e.clientY,cell:[x,y],moved:false};if(cfg.light==='back'&&Math.hypot(x-cfg.lampX,y)<6)drag='lamp';else if(Math.hypot(x-cfg.mx,y-cfg.my)<14)drag='magnet';if(drag){cv.setPointerCapture(e.pointerId);quick=true;}});
  cv.addEventListener('pointermove',e=>{const [x,y]=toCell(e);hover=[x,y];if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>4)down.moved=true;if(drag==='magnet'){cfg.mx=Math.max(-30,Math.min(30,x));cfg.my=Math.max(-30,Math.min(30,y));dirty=true;}else if(drag==='lamp'){cfg.lampX=Math.max(-35,Math.min(35,x));dirty=true;}else renderReadouts();
    cv.style.cursor=drag?'grabbing':Math.hypot(x-cfg.mx,y-cfg.my)<14||(cfg.light==='back'&&Math.hypot(x-cfg.lampX,y)<6)?'grab':'crosshair';});
  cv.addEventListener('pointerup',()=>{const click=down&&!down.moved;if(drag){drag=null;quick=false;dirty=true;}
    if(click&&Math.hypot(...down.cell)<CELL_R&&img)root.NanoFerrocellInspector.open(api,...down.cell);down=null;});
  cv.addEventListener('pointerleave',()=>{hover=null;renderReadouts();});
  const size=new ResizeObserver(()=>{if(img)draw();});size.observe(wrap);
  buildControls();renderGuide();raf=requestAnimationFrame(loop);
  return {unmount(){api.closeInspector?.();cancelAnimationFrame(raf);size.disconnect();}};
}
function lesson(id,spec){root.NanoLessonViews=root.NanoLessonViews||{};let live=null;
  root.NanoLessonViews[id]={spec,mount(ctx){live=mount(ctx,spec);return live;},unmount(){live?.unmount();live=null;}};}
root.NanoFerrocellView={lesson,HALF,CELL_R};
})(typeof globalThis!=='undefined'?globalThis:this);
