/* ---------- состояние ---------- */
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
const nf=n=>n.toLocaleString('ru-RU');
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const col=k=>cssv('--c-'+k)||cssv('--accent')||'#0071e3';
const RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  document.querySelectorAll('.kpi .n').forEach(el=>animNum(el,el.dataset.val));
}
/* универсальный счётчик: принимает "173 147", "35", ">200", "42 дн." */
function animNum(el,raw,dur){
  if(RM()){el.textContent=raw;return}
  const m=String(raw).replace(/\s/g,'').match(/^(\D*)(-?\d+)(.*)$/);
  if(!m){el.textContent=raw;return}
  const pre=m[1],target=+m[2],suf=m[3],t0=performance.now(),T=dur||900;
  const step=t=>{
    const p=Math.min((t-t0)/T,1), e=1-Math.pow(1-p,3);
    el.textContent=pre+nf(Math.round(target*e))+suf;
    if(p<1) requestAnimationFrame(step);
  };
  el.textContent=pre+'0'+suf; requestAnimationFrame(step);
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
function buildScale(){
  const gm=document.getElementById('gm'), inner=document.getElementById('ginner');
  if(!gm||!inner) return;
  const labW=parseInt(cssv('--lab-w'))||250;
  const ppd=Math.max(inner.offsetWidth-labW-12,200)/SPAN_DAYS;
  let months='';
  for(let y=2026,m=8;!(y===2027&&m===10);m++){
    if(m>11){m=0;y++}
    const s=`${y}-${String(m+1).padStart(2,'0')}-01`;
    const nx=m===11?`${y+1}-01-01`:`${y}-${String(m+2).padStart(2,'0')}-01`;
    const full=`${MN[m]} ${String(y).slice(2)}`;
    months+=`<span style="left:${pos(s)}%;width:${pos(nx)-pos(s)}%" title="${full}">${ppd>1.4?full:MN[m]}</span>`;
  }
  let sub='',mode='';
  if(ppd>=13){
    mode='days';
    const every=ppd>=26?1:(ppd>=18?2:3), cur=new Date(T0);
    while(cur<T1){
      const s=iso(cur),dow=cur.getDay(),dn=cur.getDate();
      const show=(dn===1)||((dn-1)%every===0)||dow===1;
      sub+=`<span class="${dow===0||dow===6?'we':''} ${s===TODAY?'now':''}" style="left:${pos(s)}%;width:${100/SPAN_DAYS}%" title="${fmt(s)}">${show?dn:''}</span>`;
      cur.setDate(dn+1);
    }
  } else if(ppd>=4.2){
    mode='weeks';
    const cur=new Date(T0); cur.setDate(cur.getDate()+((8-cur.getDay())%7));
    while(cur<T1){
      const s=iso(cur);
      const txt=ppd>=7?`${cur.getDate()}.${String(cur.getMonth()+1).padStart(2,'0')}`:cur.getDate();
      sub+=`<span class="${s===TODAY?'now':''}" style="left:${pos(s)}%;width:${700/SPAN_DAYS}%" title="неделя с ${fmt(s)}">${txt}</span>`;
      cur.setDate(cur.getDate()+7);
    }
  }
  gm.className='gm'+(mode?' has-sub':'');
  gm.innerHTML=`<div class="gm-row gm-months">${months}</div>`+
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
      else{out.style.left='auto';out.style.right=(tr.clientWidth-b.offsetLeft+8)+'px'}
    } else {b.classList.remove('nolabel'); out.hidden=true}
  });
}
function renderTimeline(){
  const tl=`<div class="today" style="left:${pos(TODAY)}%"></div>`;
  const items=[...D_.prep,...D_.projects.filter(p=>p.s)];
  document.getElementById('gRows').innerHTML=items.map((p,i)=>{
    const l=pos(p.s), w=Math.max(pos(p.e)-l,0.35);
    const lab=esc(p.dt||`${short(p.s)} — ${short(p.e)}`), tip=esc(p.t)+' · '+lab;
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

/* ==================================================
   ПРЕЗЕНТАЦИЯ
   ================================================== */
const DECK=D_.deck||[];
let dIdx=0, dTimer=null, dBuilt=false;
const words=t=>String(t).split(' ').map((w,i)=>`<span class="w" style="--w:${i}">${esc(w)}</span>`).join(' ');
const fu=i=>`class="fadeup" style="--i:${i}"`;

function slideHTML(s,n){
  const head=`<p class="s-eyebrow" ${fu(0)}>${esc(s.eyebrow||'')}</p>
    <h2 class="s-title">${words(s.title||'')}</h2>`;
  let body='';
  if(s.k==='hero'){
    body=`${s.sub?`<p class="s-sub" ${fu(1)}>${esc(s.sub)}</p>`:''}
      ${s.foot?`<div class="s-foot" ${fu(2)}>${esc(s.foot)}</div>`:''}`;
  }
  if(s.k==='stats'){
    body=`${s.sub?`<p class="s-sub" ${fu(1)}>${esc(s.sub)}</p>`:''}
    <div class="s-stats">${s.stats.map((x,i)=>
      `<div class="s-stat fadeup" style="--i:${i+2}">
        <b data-num="${(x.pre||'')+x.n}">${(x.pre||'')+nf(x.n)}</b><span>${esc(x.l)}</span></div>`).join('')}</div>`;
  }
  if(s.k==='split'){
    body=`<div class="s-cols">${s.cols.map((c,i)=>
      `<div class="s-col fadeup" style="--i:${i+1}"><h4>${esc(c.h)}</h4>
       <ul>${c.items.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}</div>`;
  }
  if(s.k==='grid'||s.k==='chapters'){
    body=`<div class="s-grid">${s.cards.map((c,i)=>
      `<div class="s-cardx fadeup" style="--i:${i+1}"><b>${esc(c.t)}</b>
       ${c.en?`<i>${esc(c.en)}</i>`:''}${c.v?`<i>${esc(c.v)}</i>`:''}${c.d?`<em>${esc(c.d)}</em>`:''}</div>`).join('')}</div>`;
  }
  if(s.k==='curators'){
    body=`<div class="s-people">${s.people.map((p,i)=>
      `<div class="s-person fadeup" style="--i:${i+1}"><div class="av">${esc(p.ini)}</div>
       <h4>${esc(p.n)}</h4><div class="role">${esc(p.r)}</div><p>${esc(p.d)}</p>
       <ul>${p.works.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`).join('')}</div>`;
  }
  if(s.k==='quote'){
    body=`${s.sub?`<p class="q-sub" ${fu(1)}>${esc(s.sub)}</p>`:''}
      ${s.lead?`<p class="q-lead" ${fu(2)}>${esc(s.lead)}</p>`:''}
      <div class="q-body">
        ${s.text?`<p class="fadeup" style="--i:3">${esc(s.text)}</p>`:''}
        ${s.tail?`<p class="fadeup" style="--i:4">${esc(s.tail)}</p>`:''}
      </div>`;
  }
  if(s.k==='partners'){
    body=`<div class="s-groups">${s.groups.map((g,i)=>
      `<div class="s-group fadeup" style="--i:${i+1}"><h4>${esc(g.h)}</h4>
       <div class="s-chips">${g.items.map(t=>`<span class="s-chip ${i===0?'strong':''}">${esc(t)}</span>`).join('')}</div>
      </div>`).join('')}</div>`;
  }
  if(s.k==='cta'){
    const tot=D_.gates.reduce((a,g)=>a+g.chk.length,0);
    const done=D_.gates.reduce((a,g)=>a+g.chk.filter((_,i)=>getV(`chk:${g.id}-${i}`,false)).length,0);
    const nx=[...D_.gates,...D_.props].map(g=>({...g,dd:days(g.date)}))
      .filter(g=>g.dd>=0&&getV('st:'+g.id,'todo')!=='done').sort((a,b)=>a.dd-b.dd)[0];
    body=`${s.sub?`<p class="s-sub" ${fu(1)}>${esc(s.sub)}</p>`:''}
    <div class="s-cta">
      <div class="s-ctacard fadeup" style="--i:2"><b data-num="${nx?nx.dd:0}">${nx?nx.dd:0}</b>
        <span>дней до ближайшего гейта${nx?'<br>'+esc(nx.t):''}</span></div>
      <div class="s-ctacard fadeup" style="--i:3"><b data-num="${days('2027-04-28')}">${days('2027-04-28')}</b>
        <span>дней до вернисажа<br>ANIMA MUNDI, 28.04.2027</span></div>
      <div class="s-ctacard fadeup" style="--i:4"><b data-num="${Math.round(done/tot*100)}">${Math.round(done/tot*100)}</b>
        <span>% готовности чек-листов<br>${done} из ${tot} пунктов</span></div>
      <div class="s-ctacard fadeup" style="--i:5"><b data-num="${D_.projects.filter(p=>p.k!=='ext').length}">${D_.projects.filter(p=>p.k!=='ext').length}</b>
        <span>проектов в сезоне 2027<br>на шести площадках</span></div>
    </div>
    <div class="s-ctabtns fadeup" style="--i:6">
      <button data-goto="gates">Открыть дедлайны</button>
      <button class="outline" data-goto="timeline">Таймлайн</button>
      <button class="outline" data-goto="risks">Риски</button>
    </div>`;
  }
  const scroll=['curators','grid','chapters','partners','split'].includes(s.k)?' scroll':'';
  return `<article class="slide${scroll}" data-k="${s.k}" data-th="${s.theme||'green'}" data-n="${n}">${head}${body}</article>`;
}
function buildDeck(){
  if(dBuilt||!DECK.length) return;
  document.getElementById('slides').innerHTML=DECK.map((s,i)=>slideHTML(s,i)).join('');
  document.getElementById('deckDots').innerHTML=DECK.map((s,i)=>
    `<i data-go="${i}" title="${esc(s.title||'')}"></i>`).join('');
  dBuilt=true;
  deckGo(dIdx,true);
}
function deckGo(i,force){
  if(!DECK.length) return;
  const n=(i+DECK.length)%DECK.length;
  if(n===dIdx&&!force) return;
  const slides=[...document.querySelectorAll('.slide')];
  slides.forEach((el,k)=>{
    el.classList.toggle('on',k===n);
    el.classList.toggle('out',k!==n&&k===dIdx);
  });
  dIdx=n;
  const cur=slides[n];
  if(cur){
    const au=document.getElementById('aurora');
    ['--a1','--a2','--a3'].forEach(v=>au.style.setProperty(v,getComputedStyle(cur).getPropertyValue(v)));
    cur.scrollTop=0;
    cur.querySelectorAll('[data-num]').forEach((el,k)=>setTimeout(()=>animNum(el,el.dataset.num,1100),380+k*110));
  }
  document.querySelectorAll('#deckDots i').forEach((d,k)=>d.classList.toggle('on',k===n));
  document.getElementById('deckNum').textContent=String(n+1).padStart(2,'0')+' / '+String(DECK.length).padStart(2,'0');
  document.querySelector('#deckProg i').style.width=((n+1)/DECK.length*100)+'%';
}
const deckNext=()=>deckGo(dIdx+1), deckPrev=()=>deckGo(dIdx-1);
function deckAuto(on){
  const b=document.getElementById('deckPlay');
  if(dTimer){clearInterval(dTimer);dTimer=null}
  if(on===false){b.classList.remove('on');b.textContent='▶';return}
  if(on===true||!b.classList.contains('on')){
    dTimer=setInterval(deckNext,7000);
    b.classList.add('on'); b.textContent='❚❚';
  } else {b.classList.remove('on');b.textContent='▶'}
}
function deckFull(){
  const st=document.getElementById('stage');
  if(document.fullscreenElement||document.webkitFullscreenElement){
    (document.exitFullscreen||document.webkitExitFullscreen).call(document);
  } else {
    (st.requestFullscreen||st.webkitRequestFullscreen).call(st).catch(()=>{});
  }
}
const deckVisible=()=>document.getElementById('deck').classList.contains('on');
function initDeckUI(){
  const st=document.getElementById('stage');
  document.getElementById('deckNext').onclick=deckNext;
  document.getElementById('deckPrev').onclick=deckPrev;
  document.getElementById('deckPlay').onclick=()=>deckAuto();
  document.getElementById('deckFull').onclick=deckFull;
  document.getElementById('deckDots').onclick=e=>{const i=e.target.dataset.go;if(i!=null)deckGo(+i)};
  document.getElementById('slides').addEventListener('click',e=>{
    const b=e.target.closest('[data-goto]');
    if(b){deckAuto(false);document.querySelector(`nav button[data-t="${b.dataset.goto}"]`).click()}
  });
  st.addEventListener('pointermove',e=>{
    if(RM()) return;
    const r=st.getBoundingClientRect();
    st.style.setProperty('--mx',((e.clientX-r.left)/r.width*100).toFixed(1)+'%');
    st.style.setProperty('--my',((e.clientY-r.top)/r.height*100).toFixed(1)+'%');
  });
  st.addEventListener('pointerleave',()=>{st.style.setProperty('--mx','50%');st.style.setProperty('--my','50%')});
  let sx=0,sy=0;
  st.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
  st.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)>52&&Math.abs(dx)>Math.abs(dy)*1.4){deckAuto(false);dx<0?deckNext():deckPrev()}
  },{passive:true});
  st.addEventListener('wheel',e=>{
    if(!document.fullscreenElement) return;
    if(Math.abs(e.deltaX)>Math.abs(e.deltaY)&&Math.abs(e.deltaX)>40){e.preventDefault();e.deltaX>0?deckNext():deckPrev()}
  },{passive:false});
  document.addEventListener('keydown',e=>{
    if(!deckVisible()) return;
    if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const k=e.key;
    if(k==='ArrowRight'||k==='PageDown'||k===' '){e.preventDefault();deckAuto(false);deckNext()}
    else if(k==='ArrowLeft'||k==='PageUp'){e.preventDefault();deckAuto(false);deckPrev()}
    else if(k==='Home'){deckGo(0)} else if(k==='End'){deckGo(DECK.length-1)}
    else if(k==='f'||k==='F'||k==='у'||k==='У'){deckFull()}
    else if(k==='p'||k==='P'||k==='з'||k==='З'){deckAuto()}
    else if(k==='Escape'&&dTimer){deckAuto(false)}
  });
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
  if(b.dataset.t==='deck') requestAnimationFrame(()=>{buildDeck();deckGo(dIdx,true)});
  else deckAuto(false);
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
initDeckUI();
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
