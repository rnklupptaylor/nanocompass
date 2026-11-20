/* Nanocompass · slider control shared by all views (behaves like the sliders of Colour with Mie):
 *   label and an editable number box with its unit on top; − and + buttons at the two ends of the slider;
 *   arrow keys on a focused slider step it (←/↓ smaller, →/↑ larger, Page Down/Up ten steps).
 * c: {label, min, max, step?, log?, unit?, hint?, entry?:{scale, unit, digits}} — entry converts the stored value
 *    to the number shown in the box (for example 0.06 → 6 %). */
(function(root){
'use strict';
const el=(t,cl,x)=>{const e=document.createElement(t);if(cl)e.className=cl;if(x!=null)e.textContent=x;return e;};
function make(c,value,{onInput,onChange}){
  const E=c.entry||{},scale=E.scale??1,unit=E.unit??c.unit??'';
  const row=el('div','pv-control ns-control'),head=el('div','pv-control-head'),name=el('label','pv-control-name',c.label);
  const box=el('span','ns-entry'),num=el('input','ns-num');num.type='text';num.inputMode='decimal';num.setAttribute('aria-label',c.label);
  box.append(num);if(unit)box.append(el('span','ns-unit',unit));head.append(name,box);
  const line=el('div','ns-line'),minus=el('button','ns-step','−'),plus=el('button','ns-step','+'),range=el('input');
  minus.type=plus.type='button';minus.setAttribute('aria-label','Decrease '+c.label);plus.setAttribute('aria-label','Increase '+c.label);
  range.type='range';range.min=0;range.max=1000;range.step=1;range.setAttribute('aria-label',c.label);line.append(minus,range,plus);row.append(head,line);
  if(c.hint)row.append(el('span','pv-hint',c.hint));
  const id='ns'+Math.random().toString(36).slice(2,9);range.id=id;name.htmlFor=id;
  const toS=v=>c.log?1000*Math.log(v/c.min)/Math.log(c.max/c.min):1000*(v-c.min)/((c.max-c.min)||1);
  const fromS=s=>c.log?c.min*(c.max/c.min)**(s/1000):c.min+(c.max-c.min)*s/1000;
  const snap=v=>{v=Math.max(c.min,Math.min(c.max,v));if(c.step)v=Math.round(v/c.step)*c.step;return +(+v).toPrecision(10);};
  const digits=v=>E.digits!=null?E.digits:Math.abs(v)>=100?0:Math.abs(v)>=10?1:Math.abs(v)>=1?2:3;
  const show=v=>{const d=v*scale;num.value=Math.abs(d)>=1e5||(Math.abs(d)<1e-3&&d!==0)?d.toExponential(2):(+d.toFixed(digits(d))).toString();};
  let cur=snap(value);
  function set(v,commit){cur=snap(v);range.value=toS(cur);show(cur);onInput?.(cur);if(commit)onChange?.(cur);}
  // one step: the slider's own step for linear scales (at least 1/200 of the range), 1/50 of the decades for log scales
  function nudge(dir,times=1){let v=cur;for(let i=0;i<times;i++){if(c.log)v*=Math.pow(c.max/c.min,dir/50);else v+=dir*Math.max(c.step||0,(c.max-c.min)/200);}
    if(c.step&&snap(v)===cur)v=cur+dir*c.step;set(v,true);}
  range.addEventListener('input',()=>{cur=snap(fromS(+range.value));show(cur);onInput?.(cur);});
  range.addEventListener('change',()=>onChange?.(cur));
  range.addEventListener('keydown',e=>{const k={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1,PageDown:-10,PageUp:10}[e.key];if(!k)return;e.preventDefault();nudge(Math.sign(k),Math.abs(k));});
  minus.onclick=()=>{nudge(-1);range.focus();};plus.onclick=()=>{nudge(1);range.focus();};
  const commitText=()=>{const v=parseFloat(num.value.replace(',','.').replace('−','-'));if(Number.isFinite(v))set(v/scale,true);else show(cur);};
  num.addEventListener('change',commitText);num.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commitText();num.blur();}if(e.key==='Escape'){show(cur);num.blur();}});
  range.value=toS(cur);show(cur);
  return {row,set:v=>{cur=snap(v);range.value=toS(cur);show(cur);},get:()=>cur};
}
root.NanoSlider={make};
})(typeof globalThis!=='undefined'?globalThis:this);
