/* ---------- инфраструктура состояния ---------- */
const KEY='biennale2027.v2', CFG=window.CFG||{}, D_=window.DATA;
const NOW=new Date(); NOW.setHours(0,0,0,0);
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const TODAY=iso(NOW);
const WD=['вс','пн','вт','ср','чт','пт','сб'];
const MN=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const D=s=>new Date(s+'T00:00:00');
const days=s=>Math.round((D(s)-NOW)/864e5);
const fmt=s=>{const d=D(s);return `${d.getDate()} ${MN[d.getMonth()]} ${d.getFullYear()} (${WD[d.getDay()]})`};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* цвета берём из CSS-переменных, чтобы диаграмма жила в светлой и тёмной теме */
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const col=k=>cssv('--c-'+k)||cssv('--accent')||'#0071e3';

const LS=(()=>{try{localStorage.setItem('__t','1');localStorage.removeItem('__t');return localStorage}catch(e){return null}})();
const mem={};
const store={
  get:k=>{try{return LS?LS.getItem(k):(mem[k]??null)}catch(e){return null}},
  set:(k,v)=>{try{LS?LS.setItem(k,v):(mem[k]=v)}catch(e){}}
};
let cells=(()=>{try{return JSON.parse(store.get(KEY)||'{}')}catch(e){return{}}})();
let me=store.get('biennale.me')||'';
const getV=(k,d='')=>cells[k]&&cells[k].v!==undefined?cells[k].v:d;
const byOf=k=>cells[k]&&cells[k].by||'';
const saveLocal=()=>store.set(KEY,JSON.stringify(cells));

const queue=new Set(); let pushTimer=null;
function setV(k,v){
  cells[k]={v,ts:Date.now(),by:me||'гость'};
  saveLocal(); queue.add(k);
  clearTimeout(pushTimer); pushTimer=setTimeout(push,900);
}

/* ---------- синхронизация с Google Sheets ---------- */
const syncEl=()=>document.getElementById('sync');
function setSync(cls,txt){const e=syncEl();if(e){e.className='sync '+cls;e.textContent=txt}}
const stamp=()=>new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});

async function api(method,body){
  const url=CFG.API+(CFG.API.includes('?')?'&':'?')+'token='+encodeURIComponent(CFG.TOKEN||'')+'&t='+Date.now();
  const opt=method==='POST'
    ? {method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),redirect:'follow'}
    : {method:'GET',redirect:'follow'};
  const r=await fetch(url,opt);
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}
function merge(serverCells){
  let changed=0;
  for(const k in serverCells){
    const s=serverCells[k], l=cells[k];
    if(!l||(s.ts||0)>(l.ts||0)){cells[k]=s;changed++}
  }
  if(changed){saveLocal()}
  return changed;
}
async function pull(silent){
  if(!CFG.API){setSync('local','локальный режим');return}
  if(!silent) setSync('wait','загрузка…');
  try{
    const r=await api('GET');
    const n=merge(r.cells||{});
    setSync('ok','синхронизировано '+stamp());
    if(n) renderSafe();
  }catch(e){ setSync('err','нет связи ('+stamp()+')'); }
}
async function push(){
  if(!CFG.API||!queue.size){return}
  const patch={}; queue.forEach(k=>patch[k]=cells[k]); queue.clear();
  setSync('wait','сохранение…');
  try{
    const r=await api('POST',{cells:patch,by:me||'гость'});
    if(r&&r.cells) merge(r.cells);
    setSync('ok','сохранено '+stamp());
  }catch(e){
    Object.keys(patch).forEach(k=>queue.add(k));
    setSync('err','не сохранено, повтор через 30 с');
    setTimeout(push,30000);
  }
}

/* ---------- KPI ---------- */
function renderKPI(){
  const all=[...D_.gates,...D_.props].map(g=>({...g,dd:days(g.date)}));
  const next=all.filter(g=>g.dd>=0&&getV('st:'+g.id,'todo')!=='done').sort((a,b)=>a.dd-b.dd)[0];
  const tot=D_.gates.reduce((s,g)=>s+g.chk.length,0);
  const done=D_.gates.reduce((s,g)=>s+g.chk.filter((_,i)=>getV(`chk:${g.id}-${i}`,false)).length,0);
  const late=all.filter(g=>g.dd<0&&getV('st:'+g.id,'todo')!=='done').length;
  const k=[
   {l:'Следующий дедлайн',n:next?next.dd+' дн.':'—',d:next?next.t+' · '+fmt(next.date):'все закрыты',c:next&&next.dd<30?'hot':'warn'},
   {l:'До вернисажа ANIMA MUNDI',n:days('2027-04-28')+' дн.',d:'28 апреля 2027, Арсенал',c:''},
   {l:'До открытия основных проектов',n:days('2027-05-12')+' дн.',d:'12 мая 2027, НГХМ и Пакгауз',c:''},
   {l:'Готовность гейтов',n:Math.round(done/tot*100)+'%',d:done+' из '+tot+' пунктов',c:done===tot?'ok':''},
   {l:'Просрочено',n:late,d:late?'требует решения сегодня':'нет просроченных',c:late?'hot':'ok'},
   {l:'Критических рисков',n:D_.risks.filter(r=>r.p===1).length,d:'решить до 01.12.2026',c:'hot'}
  ];
  document.getElementById('kpis').innerHTML=k.map(x=>
   `<div class="kpi ${x.c}"><div class="l">${x.l}</div><div class="n">${x.n}</div><div class="d">${esc(x.d)}</div></div>`).join('');
}

/* ---------- гейты ---------- */
function badge(date,st){
  const d=days(date);
  if(st==='done') return '<span class="dbadge past">закрыто</span>';
  const c=d<0?'hot':d<30?'hot':d<75?'warn':'';
  return `<span class="dbadge ${c}">${d<0?'просрочено '+(-d)+' дн.':d+' дн.'}</span>`;
}
function gateCard(g,prop){
  const st=getV('st:'+g.id,'todo'), chk=g.chk||[];
  const done=chk.filter((_,i)=>getV(`chk:${g.id}-${i}`,false)).length;
  const owner=getV('own:'+g.id,'');
  return `<div class="card s-${st}">
  <div class="chead">
    <div><div class="ttl">${fmt(g.date)} — ${esc(g.t)} ${prop?'<span class="pill prop">предложение</span>':''}</div>
    <div class="meta">${g.own?'По умолчанию: '+esc(g.own):''}${g.warn?' · ⚠️ '+esc(g.warn):''}</div></div>
    <div>${badge(g.date,st)}</div></div>
  <div class="ctrls">
    <select data-k="st:${g.id}">${[['todo','Не начато'],['wip','В работе'],['risk','Под риском'],['done','Закрыто']]
      .map(o=>`<option value="${o[0]}" ${st===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select>
    <input type="text" data-k="own:${g.id}" placeholder="Ответственный" value="${esc(owner)}">
    ${chk.length?`<span class="pill">${done} / ${chk.length}</span>`:''}
    ${byOf('st:'+g.id)?`<span class="by">статус: ${esc(byOf('st:'+g.id))}</span>`:''}
  </div>
  ${chk.length?`<div class="bar"><i style="width:${done/chk.length*100}%"></i></div>
  <ul class="chk">${chk.map((c,i)=>{const key=`chk:${g.id}-${i}`,on=getV(key,false);
    return `<li class="${on?'done':''}"><input type="checkbox" data-k="${key}" ${on?'checked':''}>
    <span>${esc(c)}${on&&byOf(key)?`<span class="by">— ${esc(byOf(key))}</span>`:''}</span></li>`}).join('')}</ul>`:''}
  <textarea class="note" data-k="note:${g.id}" placeholder="Заметки, блокеры, решения">${esc(getV('note:'+g.id,''))}</textarea>
  </div>`;
}
const renderGates=()=>{
  document.getElementById('gateList').innerHTML=D_.gates.map(g=>gateCard(g,false)).join('');
  document.getElementById('propList').innerHTML=D_.props.map(g=>gateCard(g,true)).join('');
};

/* ---------- проекты ---------- */
const TAG={main:'t-main',spec:'t-spec',media:'t-media',dig:'t-dig',ext:'t-ext',tbu:'t-tbu'};
function renderProjects(){
  const f=document.getElementById('fType').value, q=document.getElementById('fQ').value.toLowerCase();
  document.getElementById('projRows').innerHTML=D_.projects
    .filter(p=>(!f||p.f===f)&&(!q||(p.t+p.v+p.c+p.dt).toLowerCase().includes(q)))
    .map(p=>`<tr><td>${p.n}</td><td><b>${esc(p.t)}</b></td><td>${esc(p.v)}</td>
      <td><span class="tag ${TAG[p.k]}">${esc(p.f)}</span></td><td>${esc(p.c)}</td><td>${esc(p.dt)}</td>
      <td>${p.x?'⚠️ '+esc(p.x):'—'}</td></tr>`).join('');
}

/* ---------- таймлайн ---------- */
const T0=D('2026-09-01'), T1=D('2027-11-01');
const pos=d=>((D(d)-T0)/(T1-T0))*100;
function renderTimeline(){
  let gm='';
  for(let y=2026,m=8;!(y===2027&&m===10);m++){
    if(m>11){m=0;y++}
    const s=`${y}-${String(m+1).padStart(2,'0')}-01`;
    const nx=m===11?`${y+1}-01-01`:`${y}-${String(m+2).padStart(2,'0')}-01`;
    gm+=`<span style="left:${pos(s)}%;width:${pos(nx)-pos(s)}%">${MN[m]} ${String(y).slice(2)}</span>`;
  }
  const tl=`<div class="today" style="left:${pos(TODAY)}%"></div>`;
  document.getElementById('gm').innerHTML=gm+tl;

  const rows=[...D_.prep,...D_.projects.filter(p=>p.s)].map(p=>{
    const l=pos(p.s), w=Math.max(pos(p.e)-l,0.9);
    return `<div class="grow"><div class="glab" title="${esc(p.t)}">${esc(p.t)}</div>
     <div class="gtrack"><div class="gbar" style="left:${l}%;width:${w}%;background:${col(p.k)}">${esc(p.dt||'')}</div>${tl}</div></div>`;
  }).join('');

  const ms=[...D_.gates.map(g=>({...g,big:1})),...D_.props].map(g=>
   `<div class="mstone" style="left:${pos(g.date)}%;background:${g.big?'var(--accent)':'var(--accent-soft)'}" title="${fmt(g.date)} — ${esc(g.t)}"></div>`).join('');

  document.getElementById('gRows').innerHTML=rows+
   `<div class="grow" style="margin-top:16px"><div class="glab"><b>Гейты</b></div>
    <div class="gtrack" style="background:transparent;border-top:1px solid var(--hair)">${ms}${tl}</div></div>`;
}

/* ---------- риски, команда, журнал ---------- */
function renderRisks(){
  document.getElementById('riskList').innerHTML=[...D_.risks].sort((a,b)=>a.p-b.p).map((r,i)=>
   `<div class="card risk p${r.p}"><h3>${r.p===1?'Критический':r.p===2?'Высокий':'Средний'} — ${esc(r.t)}</h3>
    <div class="meta">${esc(r.d)}</div><div class="fix"><b>Что делать:</b> ${esc(r.f)}</div>
    <textarea class="note" data-k="risk:${i}" placeholder="Решение, владелец, срок">${esc(getV('risk:'+i,''))}</textarea></div>`).join('');
}
function renderTeam(){
  document.querySelectorAll('[data-k^="team:"]').forEach(el=>{
    if(document.activeElement!==el) el.value=getV(el.dataset.k,'');
  });
  const label={st:'статус',own:'ответственный',chk:'пункт',note:'заметка',risk:'риск',team:'команда'};
  const rows=Object.entries(cells).filter(([,c])=>c.ts).sort((a,b)=>b[1].ts-a[1].ts).slice(0,40);
  document.getElementById('log').innerHTML=rows.length?rows.map(([k,c])=>{
    const t=new Date(c.ts).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const v=typeof c.v==='boolean'?(c.v?'отмечено':'снято'):String(c.v).slice(0,90);
    return `<div class="logrow"><time>${t}</time><b>${esc(c.by||'—')}</b>
      <span>${label[k.split(':')[0]]||k} · ${esc(k.split(':')[1]||'')} → ${esc(v)}</span></div>`;
  }).join(''):'<div class="meta">Изменений пока нет.</div>';
}

/* ---------- рендер с сохранением фокуса ---------- */
let renderPending=false;
function renderAll(){
  const a=document.activeElement, fk=a&&a.dataset?a.dataset.k:null;
  const caret=a&&a.selectionStart;
  renderKPI();renderGates();renderProjects();renderTimeline();renderRisks();renderTeam();
  if(fk){const el=document.querySelector(`[data-k="${fk}"]`);
    if(el){el.focus();try{el.setSelectionRange(caret,caret)}catch(e){}}}
}
function renderSafe(){
  const a=document.activeElement;
  if(a&&/INPUT|TEXTAREA/.test(a.tagName)&&a.dataset.k){
    if(!renderPending){renderPending=true;a.addEventListener('blur',()=>{renderPending=false;renderAll()},{once:true})}
    renderKPI();return;
  }
  renderAll();
}

/* ---------- события ---------- */
document.addEventListener('change',e=>{
  const el=e.target,k=el.dataset&&el.dataset.k; if(!k)return;
  setV(k,el.type==='checkbox'?el.checked:el.value);
  if(el.tagName==='SELECT'||el.type==='checkbox') renderAll(); else renderKPI();
});
document.addEventListener('input',e=>{
  const el=e.target,k=el.dataset&&el.dataset.k; if(!k)return;
  if(el.tagName==='TEXTAREA'||el.type==='text') setV(k,el.value);
});
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('section').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); document.getElementById(b.dataset.t).classList.add('on');
});
['fType','fQ'].forEach(id=>document.getElementById(id).addEventListener('input',renderProjects));
document.getElementById('pullBtn').onclick=()=>pull(false);
document.getElementById('printBtn').onclick=()=>window.print();
document.getElementById('expBtn').onclick=()=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(cells,null,2)],{type:'application/json'}));
  a.download='biennale2027-'+TODAY+'.json'; a.click();
};
document.getElementById('impBtn').onclick=()=>document.getElementById('impFile').click();
document.getElementById('impFile').onchange=function(){
  const f=this.files[0]; if(!f)return; const r=new FileReader();
  r.onload=()=>{try{
    const inc=JSON.parse(r.result); merge(inc);
    Object.keys(inc).forEach(k=>queue.add(k)); push(); renderAll();
  }catch(e){alert('Не удалось прочитать файл')}};
  r.readAsText(f);
};
function askName(){
  const n=prompt('Ваше имя (видно команде в журнале изменений):',me||'');
  if(n!==null){me=n.trim()||'гость';store.set('biennale.me',me);document.getElementById('whoName').textContent=me}
}
document.getElementById('whoBtn').onclick=askName;

/* ---------- старт ---------- */
document.getElementById('today').textContent=fmt(TODAY);
document.getElementById('whoName').textContent=me||'гость';
if(!LS){
  const w=document.createElement('div'); w.className='banner';
  w.textContent='Браузер не сохраняет данные локально (частый случай в Safari при открытии файла с диска). Работайте через адрес сайта, а не через файл.';
  document.body.prepend(w);
}
renderAll();
if(CFG.API){
  pull(false);
  setInterval(()=>pull(true),CFG.POLL_MS||20000);
  window.addEventListener('focus',()=>pull(true));
} else setSync('local','локальный режим');
if(!me) setTimeout(askName,600);

/* перерисовка диаграммы при переключении светлой и тёмной темы macOS */
if(window.matchMedia){
  const mq=matchMedia('(prefers-color-scheme: dark)');
  const onTheme=()=>renderTimeline();
  mq.addEventListener?mq.addEventListener('change',onTheme):mq.addListener(onTheme);
}

/* если дашборд открыт круглосуточно — пересчёт после полуночи */
setInterval(()=>{
  const d=new Date(); d.setHours(0,0,0,0);
  if(d.getTime()!==NOW.getTime()) location.reload();
},60000);
