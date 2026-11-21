/* ============================================================
   ЖИВОЙ МИР — ЭКРАНЫ
   ============================================================ */

/* ---------- SVG ПИТОМЦА ---------- */
function LIV_petSVG(){
  const stage = LIV_petStage().lvl;
  const mood = LIV_petMood().key;
  const bodyC = ['#c8955e','#b8824e','#a87440','#946336','#7d5128'][Math.min(4, stage-1)];
  const dark = ['#8f6238','#7d5330','#6b4626','#57381e','#432a15'][Math.min(4, stage-1)];
  const eyeY = mood === 'sad' || mood === 'bad' ? 23 : 21;
  const earUp = stage >= 3;
  return `<svg viewBox="0 0 64 52" aria-hidden="true">
    <ellipse cx="32" cy="49" rx="20" ry="3" fill="rgba(0,0,0,.28)"/>
    <path d="M50 30 q10 -4 8 -14" stroke="${dark}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M14 18 l-1 -${earUp?12:9} l8 5 z" fill="${dark}"/>
    <path d="M26 16 l2 -${earUp?13:10} l7 6 z" fill="${dark}"/>
    <ellipse cx="30" cy="30" rx="17" ry="12.5" fill="${bodyC}"/>
    <ellipse cx="30" cy="35" rx="11" ry="6" fill="${dark}" opacity=".35"/>
    <ellipse cx="12" cy="26" rx="8" ry="7.5" fill="${bodyC}"/>
    <ellipse cx="9" cy="28" rx="4" ry="3.2" fill="${dark}"/>
    <circle cx="6.2" cy="26.4" r="1.5" fill="#2b1c0d"/>
    <circle cx="15.5" cy="${eyeY}" r="1.7" fill="#2b1c0d"/>
    <circle cx="24" cy="${eyeY}" r="1.7" fill="#2b1c0d"/>
    ${mood==='happy' ? `<path d="M32 27 q6 4 11 0" stroke="#2b1c0d" stroke-width="1.6" fill="none" stroke-linecap="round"/>` : ''}
    ${mood==='ok' ? `<circle cx="37" cy="28" r="1.5" fill="#2b1c0d"/>` : ''}
    ${(mood==='sad'||mood==='bad') ? `<path d="M33 29 q5 -3 10 0" stroke="#2b1c0d" stroke-width="1.6" fill="none" stroke-linecap="round"/>` : ''}
    ${mood==='bad' ? `<path d="M35 34 q3 -2 5 0 q2 -2 4 0" stroke="#7fb8e0" stroke-width="1.2" fill="none" opacity=".8"/>` : ''}
    <ellipse cx="24" cy="42.5" rx="3.6" ry="2.6" fill="${dark}"/>
    <ellipse cx="36" cy="42.5" rx="3.6" ry="2.6" fill="${dark}"/>
    ${stage >= 4 ? `<path d="M20 22 q10 -5 20 0" stroke="#c94a3c" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="30" cy="19" r="2.4" fill="#e0b850"/>` : ''}
  </svg>`;
}

/* ---------- ПИТОМЕЦ В HUD (на главной) ---------- */
function LIV_renderPetBadge(){
  const p = S.liv?.pet;
  if (!p) return '';
  const stage = LIV_petStage();
  const mood = LIV_petMood();
  return `<div class="liv-pet ${mood.key==='bad'?'sleeping':''}" onclick="App.openPet()" role="button" aria-label="${p.name} · ${stage.name}">
    ${LIV_petSVG()}
    <span class="liv-pet-lvl">${stage.lvl}</span>
  </div>`;
}

/* ---------- ДИАЛОГ ПИТОМЦА ---------- */
function openPet(){
  const p = S.liv.pet;
  const stage = LIV_petStage();
  const mood = LIV_petMood();
  const next = PET_STAGES.find(s => s.lvl === stage.lvl + 1);
  const pct = next ? Math.round(((p.xp - stage.need) / (next.need - stage.need)) * 100) : 100;
  const canFeed = Date.now() - p.fed >= 3600000;
  const canPlay = Date.now() - p.lastPlay >= 1800000;
  openDialog(`
    <div class="liv-pet-hero">
      ${LIV_petSVG()}
      <h2 style="justify-content:center;margin-top:4px">${p.name}</h2>
      <p class="muted" style="font-size:11px">${stage.name} · ${mood.icon} ${mood.label}</p>
    </div>
    <div class="liv-pet-xp"><i style="width:${pct}%"></i></div>
    <div class="muted-small" style="display:flex;justify-content:space-between">
      <span>Опыт ${Math.floor(p.xp)}${next ? ' / ' + next.need : ' · максимум'}</span>
      <span>${stage.bonus}</span>
    </div>
    <div class="liv-pet-actions">
      <button class="feed" onclick="App.feedPet()" ${canFeed?'':'disabled'} style="${canFeed?'':'opacity:.5'}">
        ${ic('sack')} ${canFeed ? 'Покормить · 40' : 'Сыт'}
      </button>
      <button class="play" onclick="App.playPet()" ${canPlay?'':'disabled'} style="${canPlay?'':'opacity:.5'}">
        ${ic('heart')} ${canPlay ? 'Поиграть' : 'Отдыхает'}
      </button>
    </div>
    <p class="muted-small" style="text-align:center;margin-top:9px">
      Сытый питомец приносит бонус к урожаю${stage.lvl>=3?` и меньше ломает технику`:''}.
    </p>
  `);
}

/* ---------- ШТОРМ-БАННЕР ---------- */
function LIV_renderStorm(){
  const ev = LIV_stormEvent();
  if (!ev) return '';
  const left = Math.max(0, Math.ceil((S.liv.storm.deadline - Date.now())/1000));
  return `<div class="liv-storm-banner" onclick="App.openStorm()">
    <span class="liv-storm-ic">${ic(ev.icon)}</span>
    <div class="liv-storm-body"><b>${ev.name}</b><small>Успей решить, пока не поздно</small></div>
    <span class="liv-storm-timer">${fmtTime(left)}</span>
  </div>`;
}
function openStorm(){
  const ev = LIV_stormEvent();
  if (!ev){ toast('Событие уже прошло', '', 'check'); closeModal(); return; }
  const left = Math.max(0, Math.ceil((S.liv.storm.deadline - Date.now())/1000));
  openDialog(`
    <div style="text-align:center">
      <div class="big-emoji">${ic(ev.icon,'ic-xl')}</div>
      <h2 style="justify-content:center">${ev.name}</h2>
      <p class="muted">${ev.text}. Осталось ${fmtTime(left)} — потом последствия необратимы.</p>
    </div>
    <div class="liv-choice">
      <button class="safe" onclick="App.stormSafe()">
        <b>${ic('shield')} Укрыть всё · ${fmt(ev.safeCost)} монет</b>
        <small>Гарантированно без потерь</small>
      </button>
      <button class="risky" onclick="App.stormRisk()">
        <b>${ic('bolt')} Рискнуть</b>
        <small>45% — ничего не случится · 55% — потеря ${Math.round(ev.lossMin*100)}–${Math.round(ev.lossMax*100)}% товара</small>
      </button>
    </div>
  `);
}

/* ---------- НЕДЕЛЬНАЯ ЯРМАРКА ---------- */
function LIV_renderWeek(){
  LIV_rollWeek();
  const L = S.liv.week;
  const pts = L.points || 0;
  const next = WEEK_MILESTONES.find(m => pts < m.at);
  const pct = next ? Math.min(100, (pts / next.at) * 100) : 100;
  const canClaim = WEEK_MILESTONES.some(m => pts >= m.at && !L.week.claimed.includes(m.at));
  return `<div class="liv-week" onclick="App.openWeek()">
    <span class="liv-week-ic">${ic('medal')}</span>
    <div class="liv-week-body">
      <b>Праздник урожая</b>
      <small>${next ? `${fmt(pts)} / ${next.at} очков до награды` : 'Все награды недели доступны!'}</small>
      <div class="liv-week-track"><i style="width:${pct}%"></i></div>
    </div>
    <span class="liv-storm-timer">${canClaim ? ic('gift') : fmt(pts)}</span>
  </div>`;
}
function openWeek(){
  LIV_rollWeek();
  const L = S.liv.week;
  const pts = L.points || 0;
  const rows = WEEK_MILESTONES.map(m => {
    const done = pts >= m.at, cl = L.week.claimed.includes(m.at);
    return `<div class="liv-exp-card" style="border-color:${cl?'#5f8a4d':done?'#8a7434':'#3a4a3d'}">
      <span class="liv-exp-ic">${ic(cl?'check':done?'gift':'clock')}</span>
      <div class="liv-exp-body"><b>${m.name}</b>
        <small>${m.reward.coins?`+${fmt(m.reward.coins)} монет`:''}${m.reward.gems?` +${m.reward.gems} ${gemWord(m.reward.gems)}`:''}</small></div>
      <span class="liv-storm-timer">${cl?'Получено':done?'Готово':`${fmt(pts)}/${m.at}`}</span>
    </div>`;
  }).join('');
  openDialog(`
    <h2>${ic('medal')} Праздник урожая</h2>
    <p class="muted" style="font-size:11px">Недельное событие. Очки капают за любые действия на ферме — урожай, заказы, продажи, животных.</p>
    <div class="liv-exp" style="margin-top:10px">${rows}</div>
    <button class="btn btn-gold btn-block" style="margin-top:12px" onclick="App.weekClaim()">${ic('gift')} Забрать награды</button>
  `);
}

/* ---------- ЭКСПЕДИЦИИ ---------- */
function LIV_renderExpeditions(){
  const L = S.liv.exp;
  const r = L.running;
  const def = r ? EXPEDITIONS.find(e => e.id === r.id) : null;
  const left = r ? Math.max(0, Math.ceil((r.endsAt - Date.now())/1000)) : 0;
  const ready = r && left === 0;
  const pct = r ? Math.min(100, ((Date.now()-r.startedAt)/(r.endsAt-r.startedAt))*100) : 0;

  let html = `<div class="sec-title"><h3>${ic('map')} Экспедиции</h3><small>${S.stats.expeditions||0} завершено</small></div>`;
  if (r){
    html += `<div class="liv-exp-card" style="border-color:${ready?'#8a7434':'#3a4a3d'}">
      <span class="liv-exp-ic">${ic(def.icon)}</span>
      <div class="liv-exp-body"><b>${def.name}</b><small>${ready?'Вернулся с находками!':'В пути · '+fmtTime(left)}</small>
        <div class="liv-exp-prog"><i style="width:${pct}%"></i></div></div>
      ${ready?`<button class="liv-exp-go" onclick="App.expCollect()">Забрать</button>`:''}
    </div>`;
  }
  html += `<div class="liv-exp">`;
  for (const e of EXPEDITIONS){
    const locked = S.level < e.min;
    html += `<div class="liv-exp-card ${locked?'locked':''}">
      <span class="liv-exp-ic">${ic(locked?'info':e.icon)}</span>
      <div class="liv-exp-body"><b>${e.name}</b>
        <small>${locked ? `Откроется на ${e.min} уровне` : `${e.desc} · ${e.dur} мин`}</small></div>
      <button class="liv-exp-go" ${locked||r?'disabled':''} onclick="App.expStart('${e.id}')">${locked?'🔒':fmt(e.cost)}</button>
    </div>`;
  }
  html += `</div>`;
  if (!r) html += `<div class="muted-small" style="margin-top:8px;text-align:center">Экспедиция приносит монеты, самоцветы и редкие карточки</div>`;
  return html;
}

/* ---------- КОЛЛЕКЦИЯ ---------- */
function LIV_renderCollection(){
  const owned = S.liv.cards.owned;
  const total = CARD_SET.length;
  const byRarity = {
    common: CARD_SET.filter(c=>c.r==='common').length,
    rare: CARD_SET.filter(c=>c.r==='rare').length,
    epic: CARD_SET.filter(c=>c.r==='epic').length,
  };
  let html = `<div class="sec-title"><h3>${ic('star')} Коллекция</h3><small>${owned.length} / ${total}</small></div>`;
  html += `<div class="liv-cards">`;
  for (const c of CARD_SET){
    const has = owned.includes(c.id);
    html += `<div class="liv-card ${has?'owned':'locked'}" ${has?`onclick="App.cardInfo('${c.id}')"`:''}>
      <span class="lc-ic">${I[c.icon]||I.box}</span>
      ${has?`<span class="liv-card-rarity" style="color:${CARD_RARITY_COLOR[c.r]}">${c.r==='epic'?'★':'•'}</span>`:''}
    </div>`;
  }
  html += `</div>`;
  html += `<div class="liv-card-meta">
    <b>Собрано ${Math.round(owned.length/total*100)}%</b>
    <small>${ICON_LEGEND(byRarity)}</small>
  </div>`;
  return html;
}
function ICON_LEGEND(r){
  return `<span style="color:${CARD_RARITY_COLOR.common}">•</span> обычные ${r.common} · <span style="color:${CARD_RARITY_COLOR.rare}">•</span> редкие ${r.rare} · <span style="color:${CARD_RARITY_COLOR.epic}">★</span> эпик ${r.epic}`;
}
function openCardInfo(id){
  const c = CARD_SET.find(x=>x.id===id);
  if (!c) return;
  openDialog(`<div style="text-align:center">
    <div class="big-emoji">${ic(c.icon,'ic-xl')}</div>
    <h2 style="justify-content:center">${c.name}</h2>
    <p class="muted">${c.r==='epic'?'Эпическая находка':c.r==='rare'?'Редкая находка':'Обычная находка'}</p>
    <button class="btn btn-primary btn-block" onclick="App.closeModal()">Закрыть</button></div>`);
}

/* ---------- HUD: фаза дня ---------- */
function LIV_phaseChip(){
  const p = LIV_todPhase();
  return `<span class="liv-phase">${ic(p.icon)} ${p.name}</span>`;
}
