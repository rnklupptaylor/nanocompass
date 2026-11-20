/* Nanocompass v8.0 · start-menu card pictures, drawn on canvas from the physics each lesson shows.
 * Seeded, so every card looks the same on every visit. */
(function(root){
'use strict';
function rng(seed){let s=seed>>>0||1;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const BG='#141413',INK='#e9e7e1',DIM='#8f8d86',NORTH='#ff6e5e',SOUTH='#c9c6bd';
function particle(ctx,x,y,r,theta,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);
  ctx.fillStyle='#2a2a27';ctx.strokeStyle='#5d5b55';ctx.lineWidth=Math.max(1,r*.12);
  ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();ctx.stroke();
  ctx.rotate(theta);const w=r*.32,l=r*.82;
  ctx.fillStyle=NORTH;ctx.beginPath();ctx.moveTo(0,-l);ctx.lineTo(w,0);ctx.lineTo(-w,0);ctx.fill();
  ctx.fillStyle=SOUTH;ctx.beginPath();ctx.moveTo(0,l);ctx.lineTo(w,0);ctx.lineTo(-w,0);ctx.fill();
  ctx.restore();
}
const draw={
  particle(ctx,w,h){
    // One moment between its two easy directions, with the double-well energy it has to cross.
    ctx.strokeStyle=DIM;ctx.lineWidth=2;ctx.beginPath();
    for(let i=0;i<=100;i++){const th=i/100*2*Math.PI,x=w*.08+i/100*w*.84,y=h*.86-Math.sin(th)**2*h*.24;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
    ctx.fillStyle=NORTH;ctx.beginPath();ctx.arc(w*.08,h*.86,5,0,7);ctx.fill();
    ctx.setLineDash([4,5]);ctx.strokeStyle=NORTH;ctx.beginPath();ctx.moveTo(w*.1,h*.82);ctx.quadraticCurveTo(w*.29,h*.5,w*.48,h*.6);ctx.stroke();ctx.setLineDash([]);
    particle(ctx,w*.5,h*.38,h*.24,0);particle(ctx,w*.5,h*.38,h*.24,Math.PI,.18);
    ctx.fillStyle=INK;ctx.font='600 13px "JetBrains Mono",monospace';ctx.fillText('KV',w*.47,h*.68);
    for(const [x,a] of [[.8,.4],[.88,.2],[.94,.1]]){ctx.globalAlpha=a;ctx.strokeStyle=NORTH;ctx.lineWidth=2;ctx.beginPath();ctx.arc(w*.5,h*.38,h*.24*(1+x*.6),-.6,.6);ctx.stroke();}
    ctx.globalAlpha=1;
  },
  fluid(ctx,w,h){
    const r=rng(11);
    for(let i=0;i<42;i++){const x=w*.05+r()*w*.68,y=h*.1+r()*h*.8,th=(r()-.5)*1.1;particle(ctx,x,y,h*.055,th);}
    ctx.fillStyle='#2a2a27';ctx.fillRect(w*.83,h*.1,w*.07,h*.8);
    ctx.fillStyle='#3987e5';ctx.fillRect(w*.83,h*.32,w*.07,h*.58);
    ctx.strokeStyle=INK;ctx.lineWidth=1.5;ctx.strokeRect(w*.83,h*.1,w*.07,h*.8);
    ctx.fillStyle=INK;ctx.font='600 12px "JetBrains Mono",monospace';ctx.fillText('M',w*.845,h*.08+1);
    ctx.strokeStyle='#3987e5';ctx.lineWidth=2;for(let i=0;i<3;i++){const x=w*(.76);ctx.beginPath();ctx.moveTo(x,h*(.8-i*.25));ctx.lineTo(x,h*(.66-i*.25));ctx.stroke();ctx.beginPath();ctx.moveTo(x-4,h*(.7-i*.25));ctx.lineTo(x,h*(.66-i*.25));ctx.lineTo(x+4,h*(.7-i*.25));ctx.stroke();}
  },
  magnetometer(ctx,w,h){
    const X=(b,x0,x1)=>x0+(x1-x0)*(b+1)/2,Y=(m,y0,y1)=>y1-(y1-y0)*(m+1)/2;
    ctx.strokeStyle='#4a4a45';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w*.05,h*.5);ctx.lineTo(w*.55,h*.5);ctx.moveTo(w*.3,h*.08);ctx.lineTo(w*.3,h*.92);ctx.stroke();
    ctx.lineWidth=2.4;ctx.strokeStyle='#3987e5';ctx.beginPath();for(let i=0;i<=80;i++){const b=-1+2*i/80,m=Math.tanh(3.2*b);const x=X(b,w*.05,w*.55),y=Y(m,h*.08,h*.92);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
    ctx.strokeStyle='#ff6e5e';for(const s of [1,-1]){ctx.beginPath();for(let i=0;i<=80;i++){const b=-1+2*i/80,m=Math.tanh(5*(b+s*.35))*.92;const x=X(b,w*.05,w*.55),y=Y(m,h*.08,h*.92);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}
    ctx.strokeStyle='#4a4a45';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w*.62,h*.92);ctx.lineTo(w*.96,h*.92);ctx.moveTo(w*.62,h*.92);ctx.lineTo(w*.62,h*.08);ctx.stroke();
    ctx.lineWidth=2.4;ctx.strokeStyle='#3987e5';ctx.beginPath();for(let i=0;i<=60;i++){const t=i/60,m=t<.35?.15+.75*Math.pow(t/.35,1.6):.9*Math.pow(.35/t,.9);const x=w*.62+t*w*.34,y=h*.92-m*h*.8;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
    ctx.strokeStyle='#ff6e5e';ctx.beginPath();for(let i=0;i<=60;i++){const t=i/60,m=t<.35?.9+.25*(1-t/.35):.9*Math.pow(.35/t,.9);const x=w*.62+t*w*.34,y=h*.92-Math.min(1.12,m)*h*.72;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
    ctx.fillStyle='#e9e7e1';ctx.font='600 12px "JetBrains Mono",monospace';ctx.fillText('M(H)',w*.08,h*.16);ctx.fillText('ZFC/FC',w*.8,h*.16);
  },
  ferrocell(ctx,w,h){
    // Thales circles: each LED around the rim draws a circle through itself and the magnet axis.
    ctx.fillStyle='#050506';ctx.fillRect(0,0,w,h);const cx=w/2,cy=h/2,R=h*.46,cols=['#ff5a4a','#ffa020','#f2ee30','#40e070','#30b8ff','#5468ff','#d050ff'];
    ctx.globalCompositeOperation='lighter';ctx.lineWidth=2.2;
    for(let i=0;i<14;i++){const a=2*Math.PI*i/14,lx=cx+R*Math.cos(a),ly=cy+R*Math.sin(a);ctx.strokeStyle=cols[i%cols.length];ctx.globalAlpha=.75;ctx.beginPath();ctx.arc((cx+lx)/2,(cy+ly)/2,R/2,0,7);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=cols[i%cols.length];ctx.beginPath();ctx.arc(lx,ly,3,0,7);ctx.fill();}
    ctx.globalCompositeOperation='source-over';ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.stroke();
  },
  chains(ctx,w,h){
    const r=rng(5),R=h*.06;
    const chains=[[.12,.15,7,.08],[.36,.35,5,-.05],[.58,.1,8,.03],[.82,.3,6,-.1]];
    for(const [x0,y0,n,tilt] of chains)for(let i=0;i<n;i++)particle(ctx,w*x0+i*2*R*Math.sin(tilt),h*y0+i*2*R*1.02,R,tilt);
    for(let i=0;i<9;i++)particle(ctx,w*(.2+r()*.6),h*(.1+r()*.8),R,r()*6.3,.55);
  },
  order(ctx,w,h){
    // Direction-resolved structure factor with a weak anisotropic ring, plus the question mark of a missing peak.
    const img=ctx.createImageData(w,h),cx=w*.5,cy=h*.5,r=rng(3);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(x-cx)/h,dy=(y-cy)/h,q=Math.hypot(dx,dy),phi=Math.atan2(dy,dx);
      let s=.35*Math.exp(-(((q-.28)/.06)**2))*(1+.35*Math.cos(2*phi))+.12*r()+(q<.04?.9:0);
      const v=Math.min(1,s),i=4*(y*w+x);img.data[i]=20+v*120;img.data[i+1]=20+v*90;img.data[i+2]=19+v*190;img.data[i+3]=255;}
    ctx.putImageData(img,0,0);
    ctx.strokeStyle=INK;ctx.globalAlpha=.6;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(cx,h*.06);ctx.lineTo(cx,h*.94);ctx.moveTo(w*.18,cy);ctx.lineTo(w*.82,cy);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    ctx.fillStyle=INK;ctx.font='600 13px "JetBrains Mono",monospace';ctx.fillText('S(q)',w*.82,h*.84);ctx.fillText('q*?',w*.72,h*.3);
  },
  patterns(ctx,w,h){
    const img=ctx.createImageData(w,h),r=rng(9),waves=[];
    for(let k=0;k<7;k++){const a=(k<4?0:1)*Math.PI/2+(r()-.5)*.35,q=.11+r()*.025;waves.push([Math.cos(a)*q,Math.sin(a)*q,r()*6.3,k<4?1:.25+.5*(1-(k-4)/3)]);}
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const blend=Math.min(1,Math.max(0,(x/w-.35)*2.2));let s=0;
      for(const [kx,ky,p,a] of waves)s+=(kx===0?0:1)*a*(1-(a<1?1-blend:0))*Math.cos(kx*x+ky*y+p);
      const v=1/(1+Math.exp(-3*s)),i=4*(y*w+x);img.data[i]=25+v*215;img.data[i+1]=40+v*100;img.data[i+2]=80*(1-v)+30;img.data[i+3]=255;}
    ctx.putImageData(img,0,0);
  },
  magnet(ctx,w,h){
    const img=ctx.createImageData(w,h),cx=w*.5,cy=h*.5;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const d=Math.hypot(x-cx,y-cy)/h,c=Math.exp(-((d/.2)**4)),i=4*(y*w+x);
      const lo=[38,72,140],mid=[240,238,232],hi=[214,102,40],v=c-.18*Math.exp(-(((d-.33)/.07)**2));
      const col=v>=0?mid.map((m,k)=>m+(hi[k]-m)*v):mid.map((m,k)=>m+(lo[k]-m)*(-v)*3);
      img.data[i]=col[0];img.data[i+1]=col[1];img.data[i+2]=col[2];img.data[i+3]=255;}
    ctx.putImageData(img,0,0);
    ctx.strokeStyle='#55534d';ctx.lineWidth=1.3;
    for(let y=h*.12;y<h;y+=h*.19)for(let x=w*.08;x<w;x+=h*.19){const dx=x-cx,dy=y-cy,a=Math.atan2(dy,dx),l=h*.06;
      ctx.beginPath();ctx.moveTo(x-Math.cos(a)*l/2,y-Math.sin(a)*l/2);ctx.lineTo(x+Math.cos(a)*l/2,y+Math.sin(a)*l/2);ctx.stroke();}
  },
  lab(ctx,w,h){
    ctx.strokeStyle=DIM;ctx.lineWidth=1;for(let i=0;i<=6;i++){const y=h*.15+i*h*.12;ctx.beginPath();ctx.moveTo(w*.06,y);ctx.lineTo(w*.56,y);ctx.stroke();}
    const r=rng(21);ctx.strokeStyle='#3987e5';ctx.lineWidth=2.2;ctx.beginPath();
    for(let i=0;i<=60;i++){const x=w*.06+i/60*w*.5,g=1+1.4*Math.exp(-(((i-12)/4)**2))-Math.exp(-i/5)+.05*(r()-.5);const y=h*.87-g*h*.3;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
    for(let i=0;i<5;i++){const y=h*(.2+i*.15);ctx.strokeStyle='#4a4a45';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(w*.66,y);ctx.lineTo(w*.94,y);ctx.stroke();
      const k=w*(.66+.28*(.2+.6*r()));ctx.fillStyle=INK;ctx.beginPath();ctx.arc(k,y,6,0,7);ctx.fill();}
  },
  theory(ctx,w,h){
    // Three key relations, set with real subscripts: Néel time, Langevin magnetisation, head-to-tail energy.
    const eq=(y,parts)=>{let x=w*.08;for(const [t,sub] of parts){ctx.font='italic 21px "STIX Two Text",Georgia,serif';ctx.fillText(t,x,y);x+=ctx.measureText(t).width;
      if(sub){ctx.font='italic 13px "STIX Two Text",Georgia,serif';ctx.fillText(sub,x+1,y+6);x+=ctx.measureText(sub).width+3;}}};
    ctx.fillStyle=INK;
    eq(h*.3,[['τ','N'],[' = τ','0'],[' exp(KV / k','B'],['T)']]);
    eq(h*.58,[['M = M','s'],[' L(μB / k','B'],['T)']]);
    eq(h*.86,[['U','HT'],[' = −2λ k','B'],['T']]);
  }
};
function render(canvas,id){
  if(id==='needles')id='patterns'; // the separation pattern picture
  const dpr=Math.min(2,root.devicePixelRatio||1),w=320,h=160;
  canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  ctx.fillStyle=BG;ctx.fillRect(0,0,w,h);
  if(draw[id]){
    if(['order','patterns','magnet'].includes(id)){ // pixel maps are drawn at 1x then scaled up
      const off=document.createElement('canvas');off.width=w;off.height=h;draw[id](off.getContext('2d'),w,h);ctx.drawImage(off,0,0,w,h);
    } else draw[id](ctx,w,h);
  }
}
root.NanoCards={render};
})(typeof globalThis!=='undefined'?globalThis:this);
