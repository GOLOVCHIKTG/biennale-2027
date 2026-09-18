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
const short=s=>{const d=D(s);return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getFullYear()).slice(2)}`};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
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

/* ---------- синхронизация ---------- */
const setSync=(cls,txt)=>{const e=document.getElementById('sync');if(e){e.className='sync '+cls;e.textContent=txt}};
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
function merge(sc){let n=0;for(const k in sc){const s=sc[k],l=cells[k];if(!l||(s.ts||0)>(l.ts||0)){cells[k]=s;n++}}if(n)saveLocal();return n}
async function pull(silent){
  if(!CFG.API){setSync('local','локальный режим');return}
  if(!silent) setSync('wait','загрузка…');
  try{const r=await api('GET');const n=merge(r.cells||{});setSync('ok','синхронизировано '+stamp());if(n)renderSafe()}
  catch(e){setSync('err','нет связи ('+stamp()+')')}
}
async function push(){
  if(!CFG.API||!queue.size)return;
  const patch={}; queue.forEach(k=>patch[k]=cells[k]); queue.clear();
  setSync('wait','сохранение…');
  try{const r=await api('POST',{cells:patch,by:me||'гость'});if(r&&r.cells)merge(r.cells);setSync('ok','сохранено '+stamp())}
  catch(e){Object.keys(patch).forEach(k=>queue.add(k));setSync('err','не сохранено, повтор через 30 с');setTimeout(push,30000)}
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
  document.getElementById('kpis').innerHTML=k.map((x,i)=>
   `<div class="kpi ${x.c}" style="--i:${i}"><div class="l">${x.l}</div>
    <div class="n" data-val="${esc(x.n)}">${esc(x.n)}</div><div class="d">${esc(x.d)}</div></div>`).join('');
  countUp();
}
function countUp(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.kpi .n').forEach(el=>{
    const m=el.dataset.val.match(/^(-?\d+)(.*)$/); if(!m) return;
    const target=+m[1], suffix=m[2], t0=performance.now(), dur=750;
    const step=t=>{const p=Math.min((t-t0)/dur,1), e=1-Math.pow(1-p,3);
      el.textContent=Math.round(target*e)+suffix; if(p<1) requestAnimationFrame(step)};
    el.textContent='0'+suffix; requestAnimationFrame(step);
  });
}

/* ---------- гейты ---------- */
function badge(date,st){
  const d=days(date);
  if(st==='done') return '<span class="dbadge past">закрыто</span>';
  const c=(d<0||d<30)?'hot':d<75?'warn':'';
  return `<span class="dbadge ${c}">${d<0?'просрочено '+(-d)+' дн.':d+' дн.'}</span>`;
}
function gateCard(g,prop,i){
  const st=getV('st:'+g.id,'todo'), chk=g.chk||[];
  const done=chk.filter((_,n)=>getV(`chk:${g.id}-${n}`,false)).length;
  return `<div class="card s-${st}" style="--i:${i}">
  <div class="chead">
    <div><div class="ttl">${fmt(g.date)} — ${esc(g.t)} ${prop?'<span class="pill prop">предложение</span>':''}</div>
    <div class="meta">${g.own?'По умолчанию: '+esc(g.own):''}${g.warn?' · ⚠️ '+esc(g.warn):''}</div></div>
    <div>${badge(g.date,st)}</div></div>
  <div class="ctrls">
    <select data-k="st:${g.id}">${[['todo','Не начато'],['wip','В работе'],['risk','Под риском'],['done','Закрыто']]
      .map(o=>`<option value="${o[0]}" ${st===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select>
    <input type="text" data-k="own:${g.id}" placeholder="Ответственный" value="${esc(getV('own:'+g.id,''))}">
    ${chk.length?`<span class="pill">${done} / ${chk.length}</span>`:''}
    ${byOf('st:'+g.id)?`<span class="by">статус: ${esc(byOf('st:'+g.id))}</span>`:''}
  </div>
  ${chk.length?`<div class="bar"><i style="width:${done/chk.length*100}%"></i></div>
  <ul class="chk">${chk.map((c,n)=>{const key=`chk:${g.id}-${n}`,on=getV(key,false);
    return `<li><label class="chkrow ${on?'done':''}">
      <input type="checkbox" data-k="${key}" ${on?'checked':''}>
      <span class="chktx">${esc(c)}${on&&byOf(key)?`<span class="by">— ${esc(byOf(key))}</span>`:''}</span>
    </label></li>`}).join('')}</ul>`:''}
  <textarea class="note" data-k="note:${g.id}" placeholder="Заметки, блокеры, решения">${esc(getV('note:'+g.id,''))}</textarea>
  </div>`;
}
const renderGates=()=>{
  document.getElementById('gateList').innerHTML=D_.gates.map((g,i)=>gateCard(g,false,i)).join('');
  document.getElementById('propList').innerHTML=D_.props.map((g,i)=>gateCard(g,true,i)).join('');
};

/* ---------- проекты ---------- */
const TAG={main:'t-main',spec:'t-spec',media:'t-media',dig:'t-dig',ext:'t-ext',tbu:'t-tbu'};
function renderProjects(){
  const f=document.getElementById('fType').value, q=document.getElementById('fQ').value.toLowerCase();
  document.getElementById('projRows').innerHTML=D_.projects
    .filter(p=>(!f||p.f===f)&&(!q||(p.t+p.v+p.c+p.dt).toLowerCase().includes(q)))
    .map(p=>`<tr>
      <td data-label="№">${p.n||'—'}</td>
      <td data-label="Проект"><b>${esc(p.t)}</b></td>
      <td data-label="Площадка">${esc(p.v)}</td>
      <td data-label="Формат"><span class="tag ${TAG[p.k]}">${esc(p.f)}</span></td>
      <td data-label="Кураторы">${esc(p.c)}</td>
      <td data-label="Даты">${esc(p.dt)}</td>
      <td data-label="Риски">${p.x?'⚠️ '+esc(p.x):'—'}</td></tr>`).join('');
}

/* ---------- таймлайн ---------- */
const T0=D('2026-09-01'), T1=D('2027-11-01');
const SPAN_DAYS=Math.round((T1-T0)/864e5);
const pos=d=>((D(d)-T0)/(T1-T0))*100;
let ZOOM=Math.min(6,Math.max(1,parseFloat(store.get('biennale.zoom')||'1')));

/* шкала: месяцы всегда, при приближении — недели и дни */
function buildScale(){
  const gm=document.getElementById('gm'), inner=document.getElementById('ginner');
  if(!gm||!inner) return;
  const labW=parseInt(cssv('--lab-w'))||250;
  const trackW=Math.max(inner.offsetWidth-labW-12,200);
  const ppd=trackW/SPAN_DAYS;                       // пикселей на день

  let months='';
  for(let y=2026,m=8;!(y===2027&&m===10);m++){
    if(m>11){m=0;y++}
    const s=`${y}-${String(m+1).padStart(2,'0')}-01`;
    const nx=m===11?`${y+1}-01-01`:`${y}-${String(m+2).padStart(2,'0')}-01`;
    const w=pos(nx)-pos(s);
    const full=`${MN[m]} ${String(y).slice(2)}`;
    months+=`<span style="left:${pos(s)}%;width:${w}%" title="${full}">${ppd>1.4?full:MN[m]}</span>`;
  }

  let sub='', mode='';
  if(ppd>=13){                                      // дни
    mode='days';
    const every=ppd>=26?1:(ppd>=18?2:3);
    const cur=new Date(T0);
    while(cur<T1){
      const s=iso(cur), dow=cur.getDay(), dn=cur.getDate();
      const showText=(dn===1)||((dn-1)%every===0)||dow===1;
      sub+=`<span class="${dow===0||dow===6?'we':''} ${s===TODAY?'now':''}"
        style="left:${pos(s)}%;width:${100/SPAN_DAYS}%" title="${fmt(s)}">${showText?dn:''}</span>`;
      cur.setDate(dn+1);
    }
  } else if(ppd>=4.2){                              // недели, метка по понедельникам
    mode='weeks';
    const cur=new Date(T0);
    cur.setDate(cur.getDate()+((8-cur.getDay())%7));
    while(cur<T1){
      const s=iso(cur);
      const txt=ppd>=7?`${cur.getDate()}.${String(cur.getMonth()+1).padStart(2,'0')}`:cur.getDate();
      sub+=`<span class="${s===TODAY?'now':''}" style="left:${pos(s)}%;width:${700/SPAN_DAYS}%"
        title="неделя с ${fmt(s)}">${txt}</span>`;
      cur.setDate(cur.getDate()+7);
    }
  }

  gm.className='gm'+(mode?' has-sub':'');
  gm.innerHTML=
    `<div class="gm-row gm-months">${months}</div>`+
    (mode?`<div class="gm-row gm-sub ${mode}">${sub}</div>`:'')+
    `<div class="today" style="left:${pos(TODAY)}%" title="Сегодня — ${fmt(TODAY)}"></div>`;
}

function applyZoom(){
  const inner=document.getElementById('ginner'), scroll=document.getElementById('gscroll');
  if(!inner||!scroll) return;
  const labW=parseInt(cssv('--lab-w'))||250;
  const base=Math.max(scroll.clientWidth,labW+320);
  inner.style.minWidth=Math.round(labW+(base-labW)*ZOOM)+'px';
  const r=document.getElementById('zRange'), v=document.getElementById('zVal');
  if(r) r.value=Math.round(ZOOM*100);
  if(v) v.textContent=Math.round(ZOOM*100)+'%';
  store.set('biennale.zoom',String(ZOOM));
  requestAnimationFrame(()=>{buildScale();fixLabels()});
}
function setZoom(z,keepToday){
  const scroll=document.getElementById('gscroll');
  const anchor=scroll?(scroll.scrollLeft+scroll.clientWidth/2)/Math.max(scroll.scrollWidth,1):0;
  ZOOM=Math.min(6,Math.max(1,Math.round(z*10)/10));
  applyZoom();
  if(scroll){
    if(keepToday) scrollToToday();
    else requestAnimationFrame(()=>{scroll.scrollLeft=anchor*scroll.scrollWidth-scroll.clientWidth/2});
  }
}
function scrollToToday(){
  const scroll=document.getElementById('gscroll'), inner=document.getElementById('ginner');
  if(!scroll||!inner) return;
  const labW=parseInt(cssv('--lab-w'))||250;
  const x=labW+(inner.offsetWidth-labW-12)*pos(TODAY)/100;
  scroll.scrollTo({left:Math.max(0,x-scroll.clientWidth/2),behavior:'smooth'});
}
function fixLabels(){
  document.querySelectorAll('.gtrack').forEach(tr=>{
    const b=tr.querySelector('.gbar'), out=tr.querySelector('.gout');
    if(!b||!out) return;
    const tight=b.clientWidth<56||b.scrollWidth>b.clientWidth+1;
    if(tight){
      b.classList.add('nolabel'); out.hidden=false;
      const right=b.offsetLeft+b.offsetWidth+8;
      if(right+out.offsetWidth<=tr.clientWidth-4){out.style.left=right+'px';out.style.right='auto'}
      else {out.style.left='auto';out.style.right=(tr.clientWidth-b.offsetLeft+8)+'px'}
    } else {b.classList.remove('nolabel'); out.hidden=true}
  });
}
function renderTimeline(){
  const tl=`<div class="today" style="left:${pos(TODAY)}%"></div>`;
  const items=[...D_.prep,...D_.projects.filter(p=>p.s)];
  document.getElementById('gRows').innerHTML=items.map((p,i)=>{
    const l=pos(p.s), w=Math.max(pos(p.e)-l,0.35);
    const lab=esc(p.dt||`${short(p.s)} — ${short(p.e)}`);
    const tip=esc(p.t)+' · '+lab;
    return `<div class="grow"><div class="glab" title="${tip}">${esc(p.t)}</div>
     <div class="gtrack">
       <div class="gbar" style="left:${l}%;width:${w}%;background:${col(p.k)};--i:${i}" title="${tip}"><span class="gtxt">${lab}</span></div>
       <span class="gout" hidden>${lab}</span>${tl}
     </div></div>`;
  }).join('')+
   `<div class="grow" style="margin-top:14px"><div class="glab"><b>Гейты</b></div>
    <div class="gtrack" style="background:transparent;border-top:1px solid var(--hair)">
    ${[...D_.gates.map(g=>({...g,big:1})),...D_.props].map((g,i)=>
      `<div class="mstone" style="left:${pos(g.date)}%;background:${g.big?'var(--accent)':'var(--accent-soft)'};--i:${i}"
        title="${fmt(g.date)} — ${esc(g.t)}"></div>`).join('')}${tl}</div></div>`;

  document.getElementById('gateLegend').innerHTML=[...D_.gates,...D_.props]
    .sort((a,b)=>D(a.date)-D(b.date))
    .map(g=>{const d=days(g.date);
      return `<div><b>${short(g.date)}</b><span>${esc(g.t)}</span><em>${d<0?'прошло':d+' дн.'}</em></div>`}).join('');
  applyZoom();
}

/* ---------- риски, команда, журнал ---------- */
function renderRisks(){
  document.getElementById('riskList').innerHTML=[...D_.risks].sort((a,b)=>a.p-b.p).map((r,i)=>
   `<div class="card risk p${r.p}" style="--i:${i}"><h3>${r.p===1?'Критический':r.p===2?'Высокий':'Средний'} — ${esc(r.t)}</h3>
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

/* ---------- рендер ---------- */
let renderPending=false;
function renderAll(){
  const a=document.activeElement, fk=a&&a.dataset?a.dataset.k:null, caret=a&&a.selectionStart;
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
  b.classList.add('on');
  document.getElementById(b.dataset.t).classList.add('on');
  if(b.dataset.t==='timeline') requestAnimationFrame(()=>{applyZoom();scrollToToday()});
  window.scrollTo({top:0,behavior:'smooth'});
});
['fType','fQ'].forEach(id=>document.getElementById(id).addEventListener('input',renderProjects));
document.getElementById('zIn').onclick=()=>setZoom(ZOOM+0.5);
document.getElementById('zOut').onclick=()=>setZoom(ZOOM-0.5);
document.getElementById('zRange').oninput=e=>setZoom(+e.target.value/100);
document.getElementById('zFit').onclick=()=>setZoom(1);
document.getElementById('zToday').onclick=()=>{if(ZOOM<2)setZoom(2,true);else scrollToToday()};
document.getElementById('pullBtn').onclick=()=>pull(false);
document.getElementById('printBtn').onclick=()=>window.print();
const doExport=()=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(cells,null,2)],{type:'application/json'}));
  a.download='biennale2027-'+TODAY+'.json'; a.click();
};
document.getElementById('expBtn').onclick=doExport;
document.getElementById('impBtn').onclick=()=>document.getElementById('impFile').click();
document.getElementById('moreBtn').onclick=()=>{
  const c=prompt('1 — экспорт JSON\n2 — импорт JSON\n3 — печать / PDF\n\nВведите номер:','1');
  if(c==='1') doExport();
  if(c==='2') document.getElementById('impFile').click();
  if(c==='3') window.print();
};
document.getElementById('impFile').onchange=function(){
  const f=this.files[0]; if(!f)return; const r=new FileReader();
  r.onload=()=>{try{const inc=JSON.parse(r.result);merge(inc);Object.keys(inc).forEach(k=>queue.add(k));push();renderAll()}
  catch(e){alert('Не удалось прочитать файл')}};
  r.readAsText(f);
};
function askName(){
  const n=prompt('Ваше имя (видно команде в журнале изменений):',me||'');
  if(n!==null){me=n.trim()||'гость';store.set('biennale.me',me);document.getElementById('whoName').textContent=me}
}
document.getElementById('whoBtn').onclick=askName;

let rt=null;
window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(applyZoom,150)});
window.addEventListener('orientationchange',()=>setTimeout(applyZoom,300));

/* ---------- старт ---------- */
document.getElementById('today').textContent=fmt(TODAY);
document.getElementById('whoName').textContent=me||'гость';
if(!LS){
  const w=document.createElement('div'); w.className='banner';
  w.textContent='Браузер не сохраняет данные локально (частый случай в Safari при открытии файла с диска). Работайте через адрес сайта, а не через файл.';
  document.body.prepend(w);
}
renderAll();
if(CFG.API){pull(false);setInterval(()=>pull(true),CFG.POLL_MS||20000);window.addEventListener('focus',()=>pull(true))}
else setSync('local','локальный режим');
if(!me) setTimeout(askName,600);

if(window.matchMedia){
  const mq=matchMedia('(prefers-color-scheme: dark)');
  const onTheme=()=>renderTimeline();
  mq.addEventListener?mq.addEventListener('change',onTheme):mq.addListener(onTheme);
}
setInterval(()=>{
  const d=new Date(); d.setHours(0,0,0,0);
  if(d.getTime()!==NOW.getTime()) location.reload();
},60000);
