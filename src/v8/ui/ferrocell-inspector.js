/* Nanocompass · ferrocell point inspector.
 * Click a point of the ferrocell twin: a panel shows a small copy of the cell with the chosen point, and a 3D section
 * through the full thickness of the cell at that point (thickness exaggerated):
 *   glass plates and the fluid film; the local field direction; field-aligned elongated structures (drawn vaguely);
 *   the relevant light: guided in the glass from the contributing LEDs (edge-lit) or straight through (lamp behind);
 *   the Keller cone of scattered light around the structures; the ray towards the observer, highlighted when it lies
 *   on the cone. Drag the circle on the small map or use the arrow keys to move the point; drag the 3D view to turn it. */
(function(root){
'use strict';
const L=root.NanoLessons;
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],norm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const rgb=(c,a=1)=>{if(c.every(v=>v>.65))c=[.85,.55,.1];return 'rgba('+c.map(v=>Math.round(255*v)).join(',')+','+a+')';}; // white light drawn amber

/* Optics at one point, consistent with src/v8/engines/ferrocell.js. */
function analyse(api,x,y){
  const F=api.F,cfg=api.cfg,prims=api.prims(),nf=F.N_FLUID,ng=F.N_GLASS,beta=.5*(nf+ng);
  const B=Phys.fieldAt(prims,x,y,0),Bm=Math.hypot(...B),t=Bm>1e-9?norm(B):[1,0,0],dens=Bm*Bm/(Bm*Bm+(cfg.Bn/1e3)**2);
  const d=norm([-x,-y,cfg.eyeH]),kout=[d[0],d[1],Math.sqrt(Math.max(nf*nf-d[0]*d[0]-d[1]*d[1],1e-9))];
  const sl=.39*.53/(nf*cfg.needleUm),sources=[];
  if(cfg.light==='edge'){
    for(const s of api.leds()){const ux=x-s.x,uy=y-s.y,r=Math.hypot(ux,uy);if(r<1e-6)continue;const u=[ux/r,uy/r,0],kin=[beta*u[0],beta*u[1],0],dk=[kout[0]-kin[0],kout[1]-kin[1],kout[2]],D=dot(dk,t);
      const perp2=Math.max(dot(dk,dk)-D*D,0),sig2=sl*sl+cfg.spread*cfg.spread*perp2,w=Math.exp(-r/25)/Math.max(r,1)*Math.exp(-.5*D*D/sig2)/Math.sqrt(2*Math.PI*sig2);
      sources.push({led:s,u,kin,D,w,dist:r,sig:Math.sqrt(sig2)});}
  }else{
    const lx=x-cfg.lampX,ly=y,lz=60,ld=Math.hypot(lx,ly,lz),a=[lx/ld,ly/ld,lz/ld],kin=[a[0],a[1],Math.sqrt(Math.max(nf*nf-a[0]*a[0]-a[1]*a[1],1e-9))],dk=[kout[0]-kin[0],kout[1]-kin[1],kout[2]-kin[2]],D=dot(dk,t);
    const perp2=Math.max(dot(dk,dk)-D*D,0),sig2=sl*sl+cfg.spread*cfg.spread*perp2;
    sources.push({lamp:true,dirAir:a,kin,D,sig:Math.sqrt(sig2),w:Math.exp(-.5*D*D/sig2)/Math.sqrt(2*Math.PI*sig2),led:{rgb:[1,.92,.7]}});
  }
  const col=[0,0,0];for(const so of sources)if(so.led?.rgb)for(let i=0;i<3;i++)col[i]+=so.w*so.led.rgb[i];
  sources.sort((a,b)=>b.w-a.w);
  const wmax=sources[0]?.w||0,relevant=sources.filter(s=>s.w>=.05*wmax&&s.w>1e-3).slice(0,3);
  const best=relevant[0]||sources.reduce((a,b)=>Math.abs(b.D)<Math.abs(a.D)?b:a,sources[0]);
  // cone half-angle around t for the best source, and how far the eye direction is from the cone
  const kinN=Math.hypot(...best.kin),cosIn=dot(best.kin,t)/nf,coneAngle=Math.acos(Math.max(-1,Math.min(1,cosIn))),eyeAngle=Math.acos(Math.max(-1,Math.min(1,dot(kout,t)/nf)));
  return {col,x,y,B,Bm,t,dens,kout,dAir:d,sources,relevant,best,coneAngle,eyeAngle,miss:Math.abs(eyeAngle-coneAngle)*180/Math.PI,lit:relevant.length>0&&dens>.05};
}

function open(api,x0,y0){
  api.closeInspector?.();
  const wrap=el('div','fi-panel');wrap.tabIndex=0;wrap.setAttribute('role','dialog');wrap.setAttribute('aria-label','What happens at this point');
  const head=el('div','fi-head');head.append(el('b','','What happens at this point'));const close=el('button','fi-close','×');close.type='button';close.setAttribute('aria-label','Close');head.append(close);
  const body=el('div','fi-body'),left=el('div','fi-left'),map=el('canvas','fi-map'),info=el('dl','pv-readouts fi-info'),hint=el('p','fi-hint');
  const modes=el('div','fi-modes');modes.setAttribute('role','group');modes.setAttribute('aria-label','Arrow keys move the point');
  const MODES=[['free','Freely'],['mag','Same field strength'],['dir','Same field direction'],['hue','Same colour']];
  left.append(map,modes,info,hint);const right=el('div','fi-right'),views=el('div','fi-views'),view=el('canvas','fi-3d'),zoom=el('canvas','fi-zoom'),legend=el('div','fi-legend');zoom.setAttribute('aria-label','Close-up where the structures touch the glass');views.append(view,zoom);right.append(views,legend);body.append(left,right);wrap.append(head,body);
  api.stage.append(wrap);
  let P={x:x0,y:y0},A=analyse(api,P.x,P.y),az=-.6,elv=.62,dragMap=false,dragView=null,mode='free',level=null,contour=null,hueLed=null;
  const H=api.HALF;
  /* Contour navigation: a scalar g(x, y) of the cell; the arrow keys follow the line g = const (left/right) or step across it (up/down).
     mag: |B| in mT; dir: in-plane field direction (period π, needles have no head or tail); hue: hue of the light seen there (edge-lit, rainbow). */
    const period=m=>m==='dir'?Math.PI:0,wrapA=(a,P0)=>P0?a-P0*Math.round(a/P0):a;
  function G(m,x,y){if(m==='mag'){const B=Phys.fieldAt(api.prims(),x,y,0);return 1e3*Math.hypot(...B);}if(m==='dir'){const B=Phys.fieldAt(api.prims(),x,y,0);return Math.atan2(B[1],B[0]);}const so=analyse(api,x,y).sources.find(q=>q.led===hueLed);return so?so.D:NaN;}
  function grad(m,x,y){const e=.05,P0=period(m),gx=wrapA(G(m,x+e,y)-G(m,x-e,y),P0)/(2*e),gy=wrapA(G(m,x,y+e)-G(m,x,y-e),P0)/(2*e);return [gx,gy];}
  function along(m,x,y,ds,v0){
    const tg=(x1,y1)=>{const q=grad(m,x1,y1),l=Math.hypot(...q);return l>1e-9&&isFinite(l)?[-q[1]/l,q[0]/l]:null;};
    const t1=tg(x,y);if(!t1)return null;const t2=tg(x+t1[0]*ds/2,y+t1[1]*ds/2);if(!t2)return null;let nx=x+t2[0]*ds,ny=y+t2[1]*ds;
    for(let k=0;k<2&&v0!=null;k++){const q=grad(m,nx,ny),l2=q[0]*q[0]+q[1]*q[1],dv=wrapA(G(m,nx,ny)-v0,period(m));if(!(l2>1e-12)||!isFinite(dv))break;const c=Math.max(-Math.abs(ds),Math.min(Math.abs(ds),dv/Math.sqrt(l2)));nx-=c*q[0]/Math.sqrt(l2);ny-=c*q[1]/Math.sqrt(l2);}
    return [nx,ny];}
  const inCell=(x,y)=>Math.hypot(x,y)<api.CELL_R-.5;
  function traceContour(){contour=null;if(mode==='free'||level==null||!isFinite(level))return;const segs=[];
    for(const sg of [1,-1]){const pts=[[P.x,P.y]];let q=[P.x,P.y];for(let i=0;i<220;i++){const n=along(mode,q[0],q[1],sg*.4,level);if(!n||!inCell(...n))break;if(i>10&&Math.hypot(n[0]-P.x,n[1]-P.y)<.3)break;pts.push(n);q=n;}segs.push(pts);}
    contour=segs;}
  function setLevel(){if(mode==='hue'){const b0=A.relevant[0]||A.sources.reduce((a,b)=>Math.abs(b.D)<Math.abs(a.D)?b:a,A.sources[0]);hueLed=b0?.led||null;}level=mode==='free'?null:G(mode,P.x,P.y);traceContour();}
  function move(x,y,keep){const r=Math.hypot(x,y),R=api.CELL_R-.5;if(r>R){x*=R/r;y*=R/r;}P={x,y};A=analyse(api,x,y);if(!keep)setLevel();else traceContour();draw();}
  function hueAvailable(){return api.cfg.light==='edge';}
  function drawModes(){modes.textContent='';const lab=el('span','fi-modes-label','Arrow keys move');modes.append(lab);
    for(const [k,t] of MODES){const b=el('button','',t);b.type='button';b.setAttribute('aria-pressed',String(mode===k));const off=k==='hue'&&!hueAvailable();b.disabled=off;if(off)b.title='Needs LEDs around the edge';
      b.onclick=()=>{mode=k;setLevel();draw();wrap.focus();};modes.append(b);}
    hint.textContent=mode==='free'?'Arrow keys move the point by 0.1 mm (Shift: 1 mm). Or drag the circle. Drag the 3D view to turn it.':
      '← → follow the dashed line through the point, ↑ ↓ move across the lines; 0.1 mm per step (Shift: 1 mm).'+(mode==='hue'?' Same colour: the line follows the curve drawn by one LED, so the colour you see stays that LED\'s colour.':'');}
  if(mode==='hue'&&!hueAvailable())mode='free';
  setLevel();
  function drawMap(){
    const dpr=Math.min(2,root.devicePixelRatio||1),S=map.clientWidth||200,w=Math.round(S*dpr);if(map.width!==w){map.width=w;map.height=w;}map.style.height=S+'px';
    const g=map.getContext('2d');g.fillStyle='#0b0b0d';g.fillRect(0,0,w,w);g.drawImage(api.canvas,0,0,w,w);
    const X=v=>(v+H)/(2*H)*w,Y=v=>(H-v)/(2*H)*w;g.strokeStyle='#fff';g.lineWidth=2*dpr;g.beginPath();g.arc(X(P.x),Y(P.y),5*dpr,0,7);g.stroke();g.strokeStyle='#000';g.lineWidth=1*dpr;g.beginPath();g.arc(X(P.x),Y(P.y),7*dpr,0,7);g.stroke();
    if(contour){g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=1.6*dpr;g.setLineDash([6*dpr,3*dpr]);for(const seg of contour){if(seg.length<2)continue;g.beginPath();seg.forEach((q,i)=>i?g.lineTo(X(q[0]),Y(q[1])):g.moveTo(X(q[0]),Y(q[1])));g.stroke();}g.setLineDash([]);}
    if(cfgLight()==='edge')for(const s of A.relevant){g.strokeStyle=rgb(s.led.rgb,.8);g.setLineDash([3*dpr,3*dpr]);g.beginPath();g.moveTo(X(s.led.x),Y(s.led.y));g.lineTo(X(P.x),Y(P.y));g.stroke();g.setLineDash([]);}
  }
  const cfgLight=()=>api.cfg.light;
  /* ---------- 3D section ---------- */
  function draw3d(){
    const dpr=Math.min(2,root.devicePixelRatio||1),W=view.clientWidth||400,Hh=view.clientHeight||300,w=Math.round(W*dpr),h=Math.round(Hh*dpr);if(view.width!==w)view.width=w;if(view.height!==h)view.height=h;
    const g=view.getContext('2d'),css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim(),bg=css('--stage-bg')||'#eef3f9';g.fillStyle=bg;g.fillRect(0,0,w,h);
    const s=Math.min(w/6,h/6.6),cx=w/2,cy=h*.55,ca=Math.cos(az),sa=Math.sin(az),ce=Math.cos(elv),se=Math.sin(elv);
    const pr=p=>{const x1=p[0]*ca-p[1]*sa,y1=p[0]*sa+p[1]*ca;return [cx+s*x1,cy-s*(p[2]*ce+y1*se)];};
    const line=(a,b,col,wd=1.5,dash)=>{const A1=pr(a),B1=pr(b);g.strokeStyle=col;g.lineWidth=wd*dpr;g.setLineDash(dash?dash.map(v=>v*dpr):[]);g.beginPath();g.moveTo(...A1);g.lineTo(...B1);g.stroke();g.setLineDash([]);};
    const poly=(pts,col,stroke)=>{g.beginPath();pts.forEach((p,i)=>{const q=pr(p);i?g.lineTo(...q):g.moveTo(...q);});g.closePath();g.fillStyle=col;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=dpr;g.stroke();}};
    const arrow=(a,b,col,wd=2.5)=>{line(a,b,col,wd);const A1=pr(a),B1=pr(b),ang=Math.atan2(B1[1]-A1[1],B1[0]-A1[0]),l=10*dpr;g.fillStyle=col;g.beginPath();g.moveTo(...B1);g.lineTo(B1[0]-l*Math.cos(ang-.4),B1[1]-l*Math.sin(ang-.4));g.lineTo(B1[0]-l*Math.cos(ang+.4),B1[1]-l*Math.sin(ang+.4));g.fill();};
    // labels are collected and placed at the end, shifted so that they do not overlap, with a halo for legibility
    const labels=[],label=(p,text,col,align)=>labels.push({q:pr(p),text,col:col||css('--ink'),align});
    // layers, thickness exaggerated: lower glass −1.35…−0.45, fluid film −0.45…0.45, upper glass 0.45…1.35
    const R=2.5,ZF=.6,ZG=1.6,ring=z=>Array.from({length:48},(_,i)=>{const a=2*Math.PI*i/48;return [R*Math.cos(a),R*Math.sin(a),z];});
    const glass='rgba(160,200,230,.30)',film='rgba(110,70,40,.30)';
    for(const [z0,z1,col] of [[-ZG,-ZF,glass],[-ZF,ZF,film],[ZF,ZG,glass]]){poly(ring(z0),col);poly(ring(z1),col,'rgba(80,100,120,.5)');
      for(const a of [0,Math.PI/2,Math.PI,1.5*Math.PI])line([R*Math.cos(a),R*Math.sin(a),z0],[R*Math.cos(a),R*Math.sin(a),z1],'rgba(80,100,120,.3)',1);}
    // layer names beside the leftmost edge of the stack
    const aL=Math.PI-az,rim=z=>[R*Math.cos(aL),R*Math.sin(aL),z];
    label(rim(-(ZF+ZG)/2),'glass',css('--ink-2'),'right');label(rim(0),'fluid film',css('--ink-2'),'right');label(rim((ZF+ZG)/2),'glass',css('--ink-2'),'right');
    // elongated structures along the field: all drawn with the same length; only their direction matters for the cone
    const t=A.t,rnd=mul(17),Ls=1,zr=Math.max(0,ZF-.04-Ls/2*Math.abs(t[2]));
    for(let i=0;i<16;i++){const c=[(rnd()-.5)*3.6,(rnd()-.5)*3.6,(rnd()*2-1)*zr];if(Math.hypot(c[0],c[1])>R-.5||Math.hypot(c[0],c[1])<.35)continue;
      line([c[0]-t[0]*Ls/2,c[1]-t[1]*Ls/2,c[2]-t[2]*Ls/2],[c[0]+t[0]*Ls/2,c[1]+t[1]*Ls/2,c[2]+t[2]*Ls/2],'rgba(70,40,20,'+(.2+.45*A.dens)+')',3.5*A.dens+1.6);}
    // incoming light
    const srcs=A.relevant.length?A.relevant:[A.best];
    for(const [si,sObj] of srcs.entries()){const col=A.relevant.length?rgb(sObj.led.rgb===undefined?[1,1,1]:sObj.led.rgb,.95):'rgba(140,140,140,.7)';
      if(sObj.lamp){const a=sObj.dirAir,k=norm(sObj.kin),p0=[-a[0]/a[2]*1.1,-a[1]/a[2]*1.1,-ZG-1.1];arrow(p0,[-k[0]/k[2]*ZG,-k[1]/k[2]*ZG,-ZG],col,2.4);line([-k[0]/k[2]*ZG,-k[1]/k[2]*ZG,-ZG],[0,0,0],col,2.4);label(p0,'light from the lamp behind',col);}
      else{const u=sObj.u,back=[-u[0],-u[1]],n=7,pts=[];for(let i=0;i<=n;i++){const f=1-i/n,z=(i%2?ZG-.08:ZF+.06);pts.push([back[0]*R*f,back[1]*R*f,z]);}
        for(let i=0;i<n;i++)line(pts[i],pts[i+1],col,2);for(let i=0;i<=n;i++){pts[i][2]=-pts[i][2];}for(let i=0;i<n;i++)line(pts[i],pts[i+1],col,2);
        arrow([back[0]*R*1.4,back[1]*R*1.4,(ZF+ZG)/2],[back[0]*R*1.02,back[1]*R*1.02,(ZF+ZG)/2],col,2.4);if(!si)label([back[0]*R*1.4,back[1]*R*1.4,ZG],'LED light, guided in the glass',col);
        // evanescent field: a thin glowing layer of the fluid next to each glass surface, along the guided light
        const pu=[-u[1],u[0]],wd=.32;for(const sg of [1,-1])for(let j=0;j<4;j++){const z=sg*(ZF-.05*j),a0=[back[0]*R*.95,back[1]*R*.95];
          poly([[a0[0]+pu[0]*wd,a0[1]+pu[1]*wd,z],[a0[0]-pu[0]*wd,a0[1]-pu[1]*wd,z],[-pu[0]*wd,-pu[1]*wd,z],[pu[0]*wd,pu[1]*wd,z]],rgb(sObj.led.rgb,.32*Math.exp(-j*.9)));}
        arrow([-u[0]*1.2,-u[1]*1.2,ZF-.05],[0,0,ZF-.05],col,2.6);if(!si)label([-u[0]*1.2,-u[1]*1.2,ZF-.05],'kᵢₙ along the glass',col);}}
    // Keller cone around the structure axis for the best source
    const ax=t,perp=norm(Math.abs(ax[2])<.9?cross(ax,[0,0,1]):cross(ax,[1,0,0])),perp2=cross(ax,perp),th=A.coneAngle,coneCol=A.lit?rgb(A.best.led.rgb||[1,1,1],.5):'rgba(150,150,150,.4)';
    for(let i=0;i<36;i++){const a=2*Math.PI*i/36,dir=[0,1,2].map(k=>Math.cos(th)*ax[k]+Math.sin(th)*(Math.cos(a)*perp[k]+Math.sin(a)*perp2[k]));line([0,0,0],dir.map(v=>v*1.6),coneCol,1.2);}
    {const a=Math.PI*.25,dir=[0,1,2].map(k=>Math.cos(th)*ax[k]+Math.sin(th)*(Math.cos(a)*perp[k]+Math.sin(a)*perp2[k]));label(dir.map(v=>v*1.65),'cone of scattered light',A.lit?rgb(A.best.led.rgb||[1,1,1]):css('--muted'));}
    // field direction at the point (drawn over the cone)
    arrow([0,0,0],[t[0]*1.3,t[1]*1.3,t[2]*1.3],'#2a78d6',3.2);label([t[0]*1.35,t[1]*1.35,t[2]*1.35],'B '+(A.Bm*1e3).toFixed(0)+' mT','#2a78d6');
    // ray towards the observer: through the film and upper glass, then in air
    const k=norm(A.kout),pTop=[k[0]/k[2]*ZG,k[1]/k[2]*ZG,ZG],d=A.dAir,pEye=[pTop[0]+d[0]*1.1/d[2],pTop[1]+d[1]*1.1/d[2],ZG+1.1];
    const rayCol=A.lit?'#d8382c':'rgba(110,110,110,.95)';line([0,0,0],pTop,rayCol,A.lit?3.5:2,A.lit?null:[5,4]);arrow(pTop,pEye,rayCol,A.lit?3.5:2);
    const q=pr(pEye);g.font=(18*dpr)+'px sans-serif';g.fillStyle=css('--ink');g.fillText('👁',q[0]-9*dpr,q[1]-6*dpr);label(pEye,A.lit?'your eye: this point is bright':'your eye: the cone misses it',rayCol);
    g.beginPath();g.fillStyle='#111';const o=pr([0,0,0]);g.arc(o[0],o[1],3.5*dpr,0,7);g.fill();
    // place labels without overlaps
    g.font='600 '+(12*dpr)+'px '+css('--ui');const fh=15*dpr,placed=[],offs=[0,1,-1,2,-2,3,-3,4,-4,5,-5];
    for(const L1 of labels){const tw=g.measureText(L1.text).width;let x=L1.align==='right'?L1.q[0]-tw-8*dpr:L1.q[0]+6*dpr;x=Math.max(4*dpr,Math.min(w-tw-4*dpr,x));let best=null;
      for(const o2 of offs){const y=Math.max(fh,Math.min(h-4*dpr,L1.q[1]-5*dpr+o2*fh)),r=[x,y-fh+3*dpr,x+tw,y+3*dpr];if(!placed.some(p=>r[0]<p[2]&&r[2]>p[0]&&r[1]<p[3]&&r[3]>p[1])){best={y,r};break;}}
      if(!best){const y=L1.q[1]-5*dpr;best={y,r:[x,y-fh,x+tw,y]};}placed.push(best.r);
      g.lineJoin='round';g.lineWidth=4*dpr;g.strokeStyle=bg;g.strokeText(L1.text,x,best.y);g.fillStyle=L1.col;g.fillText(L1.text,x,best.y);}
  }
  /* ---------- close-up at the glass: the section through the structure axis t and the direction to the eye ----------
     A plane through the cone's axis cuts the cone in exactly two lines at ±θ from t, so whether the eye lies on the cone
     can be read off here directly. The cone wall has a width (structure length and orientation spread): ±2σ is shaded. */
  function drawZoom(){
    const dpr=Math.min(2,root.devicePixelRatio||1),W=zoom.clientWidth||260,Hh=zoom.clientHeight||300,w=Math.round(W*dpr),h=Math.round(Hh*dpr);if(zoom.width!==w)zoom.width=w;if(zoom.height!==h)zoom.height=h;
    const g=zoom.getContext('2d'),css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim(),f=css('--ui'),ink=css('--ink'),ink2=css('--ink-2');
    g.fillStyle=css('--stage-bg')||'#eef3f9';g.fillRect(0,0,w,h);
    const edge=api.cfg.light==='edge',F=api.F,nf=F.N_FLUID,ng=F.N_GLASS,b=A.best,yI=h*.5,pad=10*dpr,t=A.t,deg=v=>(v*180/Math.PI).toFixed(0)+'°';
    const txt=(s,x,y,col,sz=11,bold,al)=>{g.font=(bold?'600 ':'')+(sz*dpr)+'px '+f;g.textAlign=al||'left';g.lineJoin='round';g.lineWidth=3*dpr;g.strokeStyle=css('--stage-bg')||'#eef3f9';g.strokeText(s,x,y);g.fillStyle=col||ink;g.fillText(s,x,y);g.textAlign='left';};
    const ko=norm(A.kout);
    // basis of the section: eh horizontal (along the glass), ev the other in-plane direction, pointing up
    let nrm=cross(t,ko);if(Math.hypot(...nrm)<1e-3)nrm=cross(t,Math.abs(t[0])<.9?[1,0,0]:[0,1,0]);nrm=norm(nrm);
    let eh=cross(nrm,[0,0,1]);if(Math.hypot(...eh)<1e-3)eh=[1,0,0];eh=norm(eh);let ev=cross(eh,nrm);if(ev[2]<0){ev=ev.map(v=>-v);}
    if(dot(ko,eh)<0)eh=eh.map(v=>-v);
    const P2=v=>[dot(v,eh),dot(v,ev)],o=[w*.5,yI],to=(d,L)=>{const q=P2(d),l=Math.hypot(...q)||1;return [o[0]+L*q[0]/l,o[1]-L*q[1]/l];};
    // layers: glass above, fluid below; the evanescent field as a glow just under the glass
    g.fillStyle='rgba(160,200,230,.45)';g.fillRect(0,0,w,yI);g.fillStyle='rgba(110,70,40,.40)';g.fillRect(0,yI,w,h-yI);
    const colA=a=>rgb(b.led?.rgb||[1,1,1],a),col=colA(1);
    if(edge){const dE=h*.05,gr=g.createLinearGradient(0,yI,0,yI+3*dE);gr.addColorStop(0,colA(.95));gr.addColorStop(.35,colA(.4));gr.addColorStop(1,colA(0));g.fillStyle=gr;g.fillRect(0,yI,w,3*dE);}
    g.strokeStyle='rgba(60,80,100,.8)';g.lineWidth=1.5*dpr;g.beginPath();g.moveTo(0,yI);g.lineTo(w,yI);g.stroke();
    txt(edge?'Close-up at the glass':'Close-up in the film',pad,pad+11*dpr,ink,12,true);
    txt('section through the structure and your eye',pad,pad+26*dpr,ink2,11);
    txt('glass',w-pad,yI-6*dpr,ink2,11,false,'right');txt('fluid',w-pad,yI+14*dpr,ink2,11,false,'right');
    // incoming light: along the glass (edge-lit) or from the lamp; drawn at the interface, the number gives its angle to the structure
    const alpha=Math.acos(Math.max(-1,Math.min(1,dot(norm(b.kin),t))));
    if(edge){const y=yI-9*dpr,x0a=pad,x1=o[0]-8*dpr,hl=18*dpr,hw=10*dpr;
      for(const [c2,lw,ex] of [['rgba(255,255,255,.95)',13,3],['rgba(20,20,20,.8)',9,1.5],[col,6,0]]){const e=ex*dpr;g.strokeStyle=c2;g.fillStyle=c2;g.lineWidth=lw*dpr;g.lineCap='round';g.beginPath();g.moveTo(x0a,y);g.lineTo(x1-hl,y);g.stroke();g.lineCap='butt';
        g.beginPath();g.moveTo(x1+e,y);g.lineTo(x1-hl-e,y-hw-e);g.lineTo(x1-hl-e,y+hw+e);g.closePath();g.fill();}
      txt('kᵢₙ',x0a+4*dpr,y-12*dpr,col,15,true);
      txt('LED light along the glass',pad+30*dpr,yI-24*dpr,col,11,true);txt('(evanescent field of the totally reflected light)',pad,yI+38*dpr,ink2,10);}
    else{const q=to(b.kin.map(v=>-v),h*.35);g.strokeStyle=col;g.lineWidth=3*dpr;g.beginPath();g.moveTo(...q);g.lineTo(...o);g.stroke();txt('lamp light',q[0]+6*dpr,q[1],col,11,true);}
    txt('light meets the structure at '+deg(alpha),pad,h-pad-30*dpr,ink,11);
    // the structure along t, ending at the glass
    const tdn=t[2]>0?t.map(v=>-v):t,se=to(tdn,h*.3);g.strokeStyle='rgba(70,40,20,.9)';g.lineWidth=7*dpr;g.lineCap='round';g.beginPath();g.moveTo(...o);g.lineTo(...se);g.stroke();g.lineCap='butt';
    txt('structure',Math.max(pad,Math.min(w-pad-60*dpr,se[0]-30*dpr)),Math.min(h-pad-48*dpr,se[1]+16*dpr),ink,11,true);
    // cone: two lines at ±θ from t, with its wall width ±2σ shaded; the half towards the fluid is absorbed
    const th=A.coneAngle,sig=b.sig||.01,cth=Math.cos(th),thLo=Math.min(th-.005,Math.acos(Math.min(1,cth+2*sig/nf))),thHi=Math.max(th+.005,Math.acos(Math.max(-1,cth-2*sig/nf))),[tu,tv]=P2(t),ang0=Math.atan2(tv,tu),Lc=Math.min(w,h)*.42;
    const coneCol=A.lit?colA(.35):'rgba(140,140,140,.3)',lineCol=A.lit?colA(.95):'rgba(120,120,120,.9)';
    for(const sg of [1,-1]){const a=ang0+sg*th,up=Math.sin(a)>0,a1=ang0+sg*thLo,a2=ang0+sg*thHi;
      g.fillStyle=up?coneCol:'rgba(120,120,120,.12)';g.beginPath();g.moveTo(...o);g.arc(o[0],o[1],Lc,-Math.max(a1,a2),-Math.min(a1,a2));g.closePath();g.fill();
      g.strokeStyle=up?lineCol:'rgba(120,120,120,.35)';g.lineWidth=1.5*dpr;g.setLineDash(up?[]:[4*dpr,3*dpr]);g.beginPath();g.moveTo(...o);g.lineTo(o[0]+Lc*Math.cos(a),o[1]-Lc*Math.sin(a));g.stroke();g.setLineDash([]);}
    // direction to the eye (exactly in this section)
    const eyeCol=A.lit?'#d8382c':'rgba(90,90,90,.95)',pe=to(ko,Lc*1.05);g.strokeStyle=eyeCol;g.lineWidth=(A.lit?3:2)*dpr;g.setLineDash(A.lit?[]:[5*dpr,4*dpr]);g.beginPath();g.moveTo(...o);g.lineTo(...pe);g.stroke();g.setLineDash([]);
    g.font=(16*dpr)+'px sans-serif';g.fillStyle=ink;g.fillText('👁',pe[0]-8*dpr,pe[1]-6*dpr);
    g.beginPath();g.fillStyle='#111';g.arc(o[0],o[1],3*dpr,0,7);g.fill();
    // reading
    txt('cone '+deg(th)+' (wall '+deg(thLo).replace('°','')+'–'+deg(thHi)+')',pad,yI-h*.38,A.lit?col:ink2,11,true);
    txt('your eye '+deg(A.eyeAngle)+(A.lit?': inside the wall, bright':': outside, dark'),pad,yI-h*.38+15*dpr,eyeCol,11,true);
    txt('not to scale',w-pad,h-pad,ink2,10,false,'right');
  }
  function mul(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function drawInfo(){
    const deg=v=>(v*180/Math.PI).toFixed(0)+'°',rows=[['Point',P.x.toFixed(2)+', '+P.y.toFixed(2)+' mm'],['Field',(A.Bm*1e3).toFixed(0)+' mT'],['Tilt out of the plane',(Math.asin(Math.min(1,Math.abs(A.t[2])))*180/Math.PI).toFixed(0)+'°'],['Structures formed',Math.round(100*A.dens)+' %'],
      ['Cone half-angle around the structures',deg(A.coneAngle)],['Cone wall, total (from length alone)',(()=>{const nf=api.F.N_FLUID,th=A.coneAngle,c=Math.cos(th),s2=A.best.sig||0,sl=.39*.53/(nf*api.cfg.needleUm),half=x=>(Math.acos(Math.max(-1,c-2*x/nf))-Math.acos(Math.min(1,c+2*x/nf)))*90/Math.PI;return '±'+half(s2).toFixed(1)+'° (±'+half(sl).toFixed(1)+'°)';})()],['Angle of your line of sight to the structures',deg(A.eyeAngle)]];
    if(api.cfg.light==='edge')rows.push(['LEDs whose cone reaches your eye',A.relevant.length?String(A.relevant.length):'none']);
    rows.push([A.lit?'Bright':'Dark',A.lit?'The cone passes through your eye.':'Your eye is '+A.miss.toFixed(1)+'° off the cone'+(A.dens<=.05?', and few structures form in this weak field':'')+'.',A.lit?'pv-good':'pv-warn']);
    info.textContent='';for(const [k,v,cls] of rows){const dt=el('dt'),dd=el('dd',cls||'');dt.innerHTML=L.sub(k);dd.textContent=v;if(cls){dt.className='pv-verdict-label';dd.classList.add('pv-verdict');}info.append(dt,dd);}
    legend.innerHTML=(api.cfg.light==='edge'?'The fluid absorbs too strongly for the LED light to cross it. The light is totally reflected in the glass; its evanescent field reaches about 0.3 µm into the fluid. It fades away from the glass but its waves run along it, so a structure touching the glass receives light travelling along the glass and scatters it into a cone around its own axis. The close-up (right) cuts through the structure and your eye: the shaded wedges are the cone with its finite wall thickness. ':'')+'Blue arrow: field. Brown rods: structures along the field (their exact nature does not matter here). '+(api.cfg.light==='back'?'Amber ray: light from the lamp behind, crossing the film.':'Coloured zig-zags: LED light travelling in the glass; glowing layers: its evanescent field.')+' Fan of lines: cone of scattered light. Red ray: light reaching your eye.';
  }
  function draw(){drawModes();drawMap();draw3d();drawZoom();drawInfo();}
  // interaction
  const mapXY=e=>{const r=map.getBoundingClientRect();return [((e.clientX-r.left)/r.width)*2*H-H,H-((e.clientY-r.top)/r.height)*2*H];};
  map.addEventListener('pointerdown',e=>{dragMap=true;map.setPointerCapture(e.pointerId);move(...mapXY(e));});
  map.addEventListener('pointermove',e=>{if(dragMap)move(...mapXY(e));});map.addEventListener('pointerup',()=>{dragMap=false;});
  view.addEventListener('pointerdown',e=>{dragView=[e.clientX,e.clientY,az,elv];view.setPointerCapture(e.pointerId);});
  view.addEventListener('pointermove',e=>{if(!dragView)return;az=dragView[2]+(e.clientX-dragView[0])*.01;elv=Math.max(-.2,Math.min(1.4,dragView[3]+(e.clientY-dragView[1])*.01));draw3d();});
  view.addEventListener('pointerup',()=>{dragView=null;});
  wrap.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeIt();return;}
    const st=e.shiftKey?1:.1,m={ArrowLeft:[-st,0],ArrowRight:[st,0],ArrowUp:[0,st],ArrowDown:[0,-st]}[e.key];if(!m)return;e.preventDefault();
    if(mode==='free'||level==null||!isFinite(level)){move(P.x+m[0],P.y+m[1]);return;}
    if(m[0]){const n=along(mode,P.x,P.y,m[0],level);if(n&&inCell(...n))move(n[0],n[1],true);return;}
    const q=grad(mode,P.x,P.y),l=Math.hypot(...q);if(!(l>1e-9))return;move(P.x+m[1]*q[0]/l,P.y+m[1]*q[1]/l);});
  function closeIt(){wrap.remove();api.closeInspector=null;api.onInspect?.(null);}
  close.onclick=closeIt;api.closeInspector=closeIt;
  api.refreshInspector=()=>{if(mode==='hue'&&!hueAvailable())mode='free';A=analyse(api,P.x,P.y);setLevel();draw();};
  requestAnimationFrame(()=>{draw();wrap.focus();});
}
root.NanoFerrocellInspector={open,analyse};
})(typeof globalThis!=='undefined'?globalThis:this);
