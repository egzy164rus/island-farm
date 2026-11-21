/* ============================================================
   ЭКРАНЫ: карта фермы, задания, стрик, ярмарка, пропуск, достижения
   ============================================================ */

/* ---------- БЛОК: ЕЖЕДНЕВНЫЕ ЗАДАНИЯ ---------- */
function RET_renderDailyQuests(){
  RET_rollDaily();
  const R = S.ret;
  let html = `<div class="sec-title"><h3>${ic('target')} Задания дня</h3><small>${R.daily.ids.filter(id=>R.daily.claimed?.[id]).length}/${R.daily.ids.length} выполнено</small></div><div class="quest-list">`;
  for (const qid of R.daily.ids){
    const st = RET_questState(qid);
    if (!st) continue;
    const pct = Math.min(100, st.prog/st.target*100);
    const rw = st.def.reward;
    const coins = rw.coins[st.tier] ?? rw.coins[0];
    html += `<div class="quest-item ${st.done?'done':''} ${st.claimed?'claimed':''}">
      <span class="quest-ic">${ic(st.def.icon)}</span>
      <div class="quest-body">
        <b>${st.def.text.replace('{n}', st.target)}</b>
        <div class="quest-bar"><i style="width:${pct}%"></i></div>
        <div class="quest-prog">${fmt(st.prog)} / ${fmt(st.target)} · +${fmt(coins)} монет</div>
      </div>
      ${st.claimed
        ? `<span class="quest-check">${ic('check')}</span>`
        : st.done
          ? `<button class="quest-claim" onclick="App.claimQuest('${qid}')">Забрать</button>`
          : `<button class="quest-claim" disabled>…</button>`}
    </div>`;
  }
  html += `</div>`;
  return html;
}

/* ---------- БЛОК: СТРИК ---------- */
function RET_renderStreak(){
  const st = S.ret.streak;
  const claimed = st.last === RET_today();
  const shown = claimed ? st.count : (st.last === yesterdayStr() ? st.count+1 : 1);
  const days = Math.min(7, ((shown-1) % 7) + 1);
  const dots = Array.from({length:7}, (_,i)=>`<i class="${i<days?'on':''}"></i>`).join('');
  const freezes = Array.from({length:STREAK_FREEZE_MAX}, (_,i)=>`<i class="${i<(st.freezes||0)?'on':''}"></i>`).join('');
  const nextMs = STREAK_MILESTONES[shown];
  return `<div class="streak-card">
    <span class="streak-flame">🔥</span>
    <div class="streak-info">
      <b>${shown} ${shown===1?'день':shown<5?'дня':'дней'} подряд <span class="streak-freeze">${freezes}</span></b>
      <small>${nextMs? `Награда за ${shown} дней готова!` : 'Заморозка восстановит серию, если пропустите день'}</small>
      <div class="streak-days">${dots}</div>
    </div>
    ${claimed ? `<span class="chip-mini">${ic('check')} Сегодня</span>` : ''}
  </div>`;
}

/* ---------- БЛОК: ЯРМАРКА ---------- */
function RET_renderFair(){
  const f = RET_fair();
  if (!f) return '';
  return `<div class="fair-banner" onclick="App.openFair()">
    <span class="fair-ic">${f.icon==='rain'?'🌧️':f.icon==='sun'?'☀️':f.icon==='heart'?'🤝':'🎪'}</span>
    <div class="fair-body"><b>${f.name}</b><small>${f.desc} · до конца дня</small></div>
    <span class="fair-timer">${ic('clock')}</span>
  </div>`;
}

/* ============================================================
   КАРТА ФЕРМЫ — главный новый экран
   ============================================================ */
function RET_renderFarmMap(){
  const R = S.ret;
  // Данные для карты
  const readyFields = S.fields.filter(f=>f.owned && f.state==='ready').length;
  const growingFields = S.fields.filter(f=>f.owned && f.state==='growing').length;
  const agedSlots = RET_agedGoods().length;
  const agedReady = RET_agedGoods().filter(p => RET_agingTier(p).index >= 2).length;
  const animalsReady = Object.keys(S.buildings).filter(id => S.buildings[id].owned && S.buildings[id].stored > 0).length;
  const animalsHungry = Object.keys(S.buildings).filter(id => S.buildings[id].owned && RET_penMood(S.buildings[id]).level==='bad').length;
  const machinesBroken = Object.keys(S.machines).filter(id => S.machines[id].owned && S.machines[id].cond < 40).length;
  const totalAlerts = readyFields + agedReady + animalsHungry + machinesBroken;

  // Геометрия карты (% от контейнера)
  const slots = [
    { key:'garage', emoji:'🚜', name:'Гараж',    x:50, y:16, badge: machinesBroken?machinesBroken:null, alert:machinesBroken>0, click:'App.openGarage()' },
    { key:'fields', emoji:'🌾', name:'Поля',     x:18, y:36, badge: readyFields?readyFields:null, alert:readyFields>0, click:"App.tab('map')" },
    { key:'bunker', emoji:'🏚️', name:'Склад',    x:82, y:36, badge: agedReady?agedReady:null, alert:agedReady>0, click:'App.openBunker()' },
    { key:'pens',   emoji:'🐄', name:'Загоны',   x:18, y:66, badge: animalsReady?animalsReady:null, alert:animalsHungry>0, click:'App.openPens()' },
    { key:'market', emoji:'🏪', name:'Рынок',    x:82, y:66, badge: null, alert:false, click:'App.openMarket()', locked:false },
    { key:'workshop', emoji:'🏭', name:'Цеха',   x:50, y:88, badge: null, alert:false, click:"App.tab('business')" },
  ];

  const slotHTML = slots.map(s=>`
    <div class="map-slot ${s.alert?'has-alert':''} ${s.locked?'locked':''}" style="left:${s.x}%;top:${s.y}%" onclick="${s.click}">
      <div class="slot-art">${s.emoji}${s.badge?`<span class="map-badge">${s.badge}</span>`:''}</div>
      <div class="slot-name">${s.name}</div>
    </div>`).join('');

  return `
    <div class="map-stats">
      <div class="map-stat ${animalsHungry?'warn':''}"><b>${animalsHungry ? animalsHungry : '✓'}</b><small>ЗАГОНЫ</small></div>
      <div class="map-stat ${agedSlots?'':''}"><b>${agedSlots}/3</b><small>ВЫДЕРЖКА</small></div>
      <div class="map-stat ${machinesBroken?'warn':''}"><b>${machinesBroken ? machinesBroken : '✓'}</b><small>ГАРАЖ</small></div>
    </div>
    <div class="map-scene">
      <div class="map-island">
        <div class="map-center">
          <div class="mc-art">🏝️</div>
          <div class="mc-name">Твоя ферма</div>
        </div>
        ${slotHTML}
      </div>
    </div>
    <div class="muted-small" style="text-align:center;margin-top:7px">${totalAlerts>0?`<b style="color:#e8b46a">${totalAlerts} мест требует внимания</b>`:'Всё под контролем'}</div>`;
}

/* ---------- СКЛАД-БУНКЕР (выдержка) ---------- */
function RET_renderBunker(){
  const goods = Object.keys(S.goods).filter(g=>S.goods[g]>0);
  let html = `<div class="sec-title"><h3>${ic('clock')} Бункер выдержки</h3><small>Чем дольше лежит — тем дороже</small></div>`;
  const A = S.ret.aging;

  // Текущие партии
  html += `<div class="age-card"><div class="age-head">
    <span class="age-ic">⏳</span>
    <div><b>Партии на выдержке</b><small>${RET_agedGoods().length} из 3 ячеек занято</small></div>
  </div><div class="age-slots">`;

  for (let i=0; i<3; i++){
    const p = A.slots[i];
    if (!p){
      html += `<div class="age-slot"><div class="age-empty">Пусто</div></div>`;
    } else {
      const ti = RET_agingTier(p);
      const isMax = ti.index >= AGING_TIERS.length-1;
      const gain = Math.round(p.units * GOODS[p.good].price * ti.tier.mult);
      html += `<div class="age-slot active" onclick="App.takeAged(${i})">
        <div class="as-good">${RET_goodEmoji(p.good)} ${GOODS[p.good].name.slice(0,7)} ×${p.units}</div>
        <div class="as-mult ${isMax?'as-mult-max':''}">${ti.tier.mult}×</div>
        <div class="as-time">${isMax ? 'МАКСИМУМ' : ti.tier.name}</div>
      </div>`;
    }
  }
  html += `</div></div>`;

  // Показать товары на складе, которые можно отложить
  if (goods.length){
    html += `<div class="sec-title" style="margin-top:12px"><h3>${ic('box')} На складе</h3><small>Положить на выдержку</small></div>`;
    html += `<div class="goods-grid">`;
    for (const g of goods.slice(0, 8)){
      const price = GOODS[g].price;
      const tiers = AGING_TIERS.map(t=>`${t.mult}×`).join(' → ');
      html += `<button class="goods-item" style="cursor:pointer" onclick="App.putAged('${g}')">
        <span class="goods-symbol">${goodsIcon(g)}</span><span>${GOODS[g].name}</span><b>×${fmt(S.goods[g])}</b>
      </button>`;
    }
    html += `</div><div class="muted-small" style="margin-top:6px">Тап по товару — положить до 24 ед. на выдержку. Максимум даёт ${AGING_TIERS[3].mult}×.</div>`;
  } else {
    html += `<div class="empty-state">${ic('box')}<b>Склад пуст</b><small>Урожай появится после уборки</small></div>`;
  }
  return html;
}

/* ---------- ЗАГОНЫ / ЖИВОТНЫЕ ---------- */
function RET_renderPens(){
  let html = `<div class="sec-title"><h3>${ic('cow')} Загоны</h3><small>${RET_freeCare() ? '🎉 Сегодня уход бесплатный' : 'Забота влияет на доход'}</small></div>`;
  const owned = Object.keys(S.buildings).filter(id=>S.buildings[id].owned);
  const notOwned = Object.keys(S.buildings).filter(id=>!S.buildings[id].owned);

  if (!owned.length){
    html += `<div class="empty-state">${ic('cow')}<b>Загонов пока нет</b><small>Построй курятник в «Хозяйстве»</small></div>`;
    html += `<button class="btn btn-primary btn-block" onclick="App.tab('business')">${ic('barn')} Открыть хозяйство</button>`;
    return html;
  }

  for (const id of owned){
    const b = S.buildings[id], d = BUILDINGS[id];
    const mood = RET_penMood(b);
    const ready = b.stored > 0;
    html += `<div class="pen-card">
      <div class="pen-head">
        <span class="pen-ic">${RET_BLD_EMOJI[id]||'🐾'}</span>
        <div><b>${d.name}</b><small>${ready?`${b.stored} ед. ${GOODS[d.good].name} готово`:`Работает · ${fmtTime(Math.max(0,(b.cycleEndsAt-Date.now())/1000))}`}</small></div>
        <span class="pen-status ${mood.level}">${mood.icon} ${mood.label}</span>
      </div>
      <div class="pen-care">
        <button class="${b.feed<40?'low':''}" onclick="App.feedPen('${id}')">${ic('sack')}Корм ${b.feed}%</button>
        <button class="${b.water<40?'low':''}" onclick="App.waterPen('${id}')">${ic('droplet')}Вода ${b.water}%</button>
        <button class="${b.clean<40?'low':''}" onclick="App.cleanPen('${id}')">${ic('wrench')}Чисто ${b.clean}%</button>
      </div>
      <div class="pen-mood">Настроение: <b>${mood.level==='good'?'отличное':mood.level==='warn'?'нормальное':'плохое'}</b> · Доход ×${mood.mult}</div>
      ${ready ? `<button class="btn btn-gold btn-block btn-sm" style="margin-top:8px" onclick="App.collectPen('${id}')">${ic('box')} Забрать ${b.stored} ${GOODS[d.good].name}</button>` : ''}
    </div>`;
  }
  return html;
}
