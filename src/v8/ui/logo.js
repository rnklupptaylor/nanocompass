/* Nanocompass v8.0 · dynamic wordmark.
 * The two o's of "Nanocompass" are compass needles that behave like superparamagnetic particles:
 * each moment has an easy axis, wobbles thermally and flips at random (Néel relaxation), so the
 * wordmark "forgets" north. Hovering or focusing the logo applies a field: flips become one-sided
 * and the needles turn north. A lesson can bind the needles to its own simulation (NanoLogo.bind).
 * Every copy of the logo (top bar, start menu) shows the same two moments. */
(function(root){
'use strict';
const NS='http://www.w3.org/2000/svg';
const reduce=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const needles=[
  {axis:0,   sign:1, wobble:0,angle:0,  from:0,to:0,t0:0,next:0},
  {axis:-38, sign:-1,wobble:0,angle:142,from:142,to:142,t0:0,next:0},
];
const copies=new Set();
let field=0,hover=0,source=null,last=0,running=false;

function compass(i){
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox','-50 -50 100 100');svg.setAttribute('class','nc-o');svg.setAttribute('aria-hidden','true');
  svg.innerHTML='<circle class="nc-rim" r="40"/><g class="nc-needle"><path class="nc-n" d="M0 -33 L9 0 L-9 0Z"/><path class="nc-s" d="M0 33 L9 0 L-9 0Z"/></g><circle class="nc-hub" r="4.2"/>';
  svg.dataset.needle=i;return svg;
}
function create(opts={}){
  const tag=opts.href?'a':'span',el=document.createElement(tag);
  el.className='nc-brand'+(opts.className?' '+opts.className:'');
  if(opts.href){el.href=opts.href;}
  el.setAttribute('aria-label',opts.label||'Nanocompass');if(opts.title)el.title=opts.title;
  const word=document.createElement('span');word.className='nc-word';word.setAttribute('aria-hidden','true');
  word.append('Nan',compass(0),'c',compass(1),'mpass');
  el.append(word);
  const on=()=>{hover=1;},off=()=>{hover=0;};
  el.addEventListener('pointerenter',on);el.addEventListener('pointerleave',off);
  el.addEventListener('focus',on);el.addEventListener('blur',off);
  copies.add(el);paint();start();
  return el;
}
const expo=rate=>-Math.log(1-Math.random())/Math.max(rate,1e-6);
function flipRate(n,h){
  // Two-state Néel picture: a field lowers the barrier for flipping towards north and raises it away from it.
  const pointsNorth=Math.cos((n.axis+(n.sign>0?0:180))*Math.PI/180)>0;
  return 0.75*Math.exp(pointsNorth?-3.2*h:2.2*h);
}
function tick(ts){
  if(!copies.size){running=false;return;}
  const dt=Math.min(.1,(ts-(last||ts))/1000);last=ts;
  const h=Math.max(field,hover);
  const bound=source&&source();
  needles.forEach((n,i)=>{
    if(bound&&Number.isFinite(bound[i])){n.angle=bound[i]*180/Math.PI;return;}
    // In a field the easy axis is dragged towards north (Brown rotation of the whole particle).
    const home=i===0?0:-38;n.axis+=(home*(1-h)-n.axis)*Math.min(1,dt*3);
    if(!n.next)n.next=ts+1000*expo(flipRate(n,h));
    if(ts>=n.next){
      const towardsNorth=n.sign<0;
      n.sign=-n.sign;n.from=n.angle;n.t0=ts;n.next=ts+1000*expo(flipRate(n,h));
      if(!towardsNorth&&h>.5){n.sign=-n.sign;} // a strong field vetoes flips away from north
    }
    n.wobble+=(-n.wobble*4*dt)+Math.sqrt(dt)*(16*(1-.7*h))*(Math.random()*2-1)*2;
    const target=n.axis+(n.sign>0?0:180)+n.wobble;
    let d=((target-n.angle+540)%360)-180;
    const k=ts-n.t0<160?Math.min(1,dt*28):Math.min(1,dt*14);
    n.angle+=d*k;
  });
  paint();requestAnimationFrame(tick);
}
function paint(){
  for(const el of copies){
    if(!el.isConnected){copies.delete(el);continue;}
    el.querySelectorAll('svg.nc-o').forEach(svg=>{const n=needles[+svg.dataset.needle];svg.querySelector('.nc-needle').setAttribute('transform','rotate('+n.angle.toFixed(1)+')');});
    el.classList.toggle('nc-field',Math.max(field,hover)>.5);
  }
}
function start(){if(reduce||running||typeof requestAnimationFrame==='undefined')return;running=true;last=0;requestAnimationFrame(tick);}
root.NanoLogo={
  create,
  setField(h){field=Math.max(0,Math.min(1,+h||0));},
  /* fn() → [angle0, angle1] in radians clockwise from north, or null to use the logo's own dynamics. */
  bind(fn){source=typeof fn==='function'?fn:null;}
};
})(typeof globalThis!=='undefined'?globalThis:this);
