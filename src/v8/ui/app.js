/* Nanocompass v8.0 · start menu, routing, explanation level and theme.
 * Routes are URL hashes (#particle, #lab …) so a lecturer can link straight to a lesson. */
(function(){
'use strict';
const {LESSONS,DESTINATIONS,byId}=window.NanoLessons;
const $=id=>document.getElementById(id);
const store={get(k,d){try{return localStorage.getItem('nanocompass.'+k)??d;}catch(e){return d;}},set(k,v){try{localStorage.setItem('nanocompass.'+k,v);}catch(e){}}};
const DEFAULT_LEVEL='lecture'; // the deploy build keeps the same default
const state={level:store.get('level',DEFAULT_LEVEL),theme:store.get('theme','auto'),lesson:null};

function setLevel(level){state.level=level==='research'?'research':'lecture';document.documentElement.dataset.level=state.level;store.set('level',state.level);
  document.querySelectorAll('[data-level-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.levelChoice===state.level)));
  if(state.lesson)renderLesson(state.lesson);}
function setTheme(theme){state.theme=['light','dark'].includes(theme)?theme:'auto';store.set('theme',state.theme);
  if(state.theme==='auto')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=state.theme;
  document.querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===state.theme)));}
function segment(kind,choices){
  const seg=document.createElement('div');seg.className='seg';seg.setAttribute('role','group');
  for(const [value,label] of choices){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset[kind+'Choice']=value;
    b.addEventListener('click',()=>kind==='level'?setLevel(value):setTheme(value));seg.append(b);}
  return seg;
}
const levelChoices=[['lecture','Lecture'],['research','Research']],themeChoices=[['auto','Auto'],['light','Light'],['dark','Dark']];

function card(item,isLesson){
  const b=document.createElement('a');b.className='start-card';b.href='#'+item.id;b.style.setProperty('--card-accent',item.accent);
  const wrap=document.createElement('span');wrap.className='start-image-wrap';
  const cv=document.createElement('canvas');cv.className='start-image';cv.setAttribute('aria-hidden','true');window.NanoCards.render(cv,item.id);wrap.append(cv);
  if(isLesson){const badge=document.createElement('span');badge.className='start-badge';badge.textContent=item.num;wrap.append(badge);}
  const copy=document.createElement('span');copy.className='start-copy';
  copy.innerHTML='<span class="start-name"></span>'+(isLesson?'<span class="start-question"></span><span class="start-research"></span>':'')+'<span class="start-slogan"></span><span class="start-arrow" aria-hidden="true">→</span>';
  copy.querySelector('.start-name').textContent=item.name;copy.querySelector('.start-slogan').textContent=item.slogan;
  if(isLesson){copy.querySelector('.start-question').textContent=item.question;copy.querySelector('.start-research').innerHTML=window.NanoLessons.sub(item.research);}
  b.append(wrap,copy);return b;
}
function buildStart(){
  $('startLogo').append(window.NanoLogo.create({label:'Nanocompass',title:'Point at the logo to switch on a field'}));
  $('startLevel').append(segment('level',levelChoices));$('startTheme').append(segment('theme',themeChoices));
  for(const l of LESSONS)$('startLessons').append(card(l,true));
  for(const d of DESTINATIONS){const c=card(d,false);c.classList.add('dest','dest-'+d.id);$('startLessons').append(c);}
}
function buildTop(){
  $('topLogo').append(window.NanoLogo.create({href:'#',label:'Nanocompass · start menu',title:'Back to the start menu'}));
  $('topLevel').append(segment('level',levelChoices));
}
function renderLesson(item){
  $('app').style.setProperty('--lesson-accent',item.accent);
  $('topNum').textContent=item.num;$('topName').textContent=item.name;
  const q=$('lessonQuestion');
  if(item.question){q.hidden=false;q.innerHTML='';q.innerHTML=window.NanoLessons.sub(state.level==='research'?item.research:item.question);
    const s=document.createElement('small');s.textContent=item.slogan;q.append(s);} else q.hidden=true;
  // Lesson content is added in steps 3–5 of the v8.0 plan; each lesson module registers itself in NanoLessonViews.
  const views=window.NanoLessonViews||{};
  $('lessonStage').textContent='';$('lessonGuide').textContent='';$('lessonControls').textContent='';
  views[item.id]?.unmount?.();
  const hs=document.querySelectorAll('#lessonView .side h2'),names=item.id==='theory'?['Contents','Further reading']:['Controls','Guide'];hs.forEach((h,i)=>{if(names[i])h.textContent=names[i];});
  document.getElementById('lessonStage').className='panel stage';
  if(views[item.id])views[item.id].mount({stage:$('lessonStage'),controls:$('lessonControls'),guide:$('lessonGuide'),level:state.level,lesson:item});
  else $('lessonStage').textContent='This part of Nanocompass is being built.';
}
function route(){
  const id=location.hash.slice(1),item=byId(id);
  const views=window.NanoLessonViews||{};
  if(state.lesson&&views[state.lesson.id]?.unmount)views[state.lesson.id].unmount();
  state.lesson=item||null;
  $('start').hidden=!!item;$('app').hidden=!item;document.documentElement.classList.toggle('in-lesson',!!item);
  document.title=item?item.name+' · Nanocompass':'Nanocompass · Superparamagnetism explored';
  if(item){renderLesson(item);window.scrollTo(0,0);}else window.NanoLogo.bind(null);
}
function setPane(p){$('app').dataset.pane=p;document.querySelectorAll('#paneTabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pane===p)));}
document.querySelectorAll('#paneTabs button').forEach(b=>b.addEventListener('click',()=>setPane(b.dataset.pane)));setPane('controls');
buildStart();buildTop();setTheme(state.theme);setLevel(state.level);
window.addEventListener('hashchange',route);route();
window.Nanocompass={state,setLevel,setTheme,route};
})();
