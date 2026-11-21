/* ============================================================
   МОДУЛЬ УДЕРЖАНИЯ — ЛОГИКА
   Вставляется в <script> после основных конфигов
   ============================================================ */

/* ---------------- РАСШИРЕНИЕ СОХРАНЕНИЯ ---------------- */
function RET_migrate(){
  if (!S) return;
  if (!S.ret) S.ret = {};
  const R = S.ret;
  if (!R.daily) R.daily = { date:'', ids:[], prog:{}, claimed:{} };
  if (!R.streak) R.streak = { last:'', count:0, best:0, freezes:1, usedFreeze:false };
  if (!R.fair) R.fair = { date:'', id:null };
  if (!R.aging) R.aging = { slots:[null,null,null], sizeCap:24 }; // {good,startedAt,durMs,units}|null
  if (!R.pass) R.pass = { xp:0, freeClaimed:[], premiumClaimed:[], premium:false, season:1 };
  if (!R.ach) R.ach = { unlocked:[], claimed:[] };
  if (!S.stats.aged) S.stats.aged = 0;
  if (!S.stats.buildings) S.stats.buildings = 0;
  if (!S.stats.bestStreak) S.stats.bestStreak = 0;
  if (!S.contractExpire) S.contractExpire = {};
}

/* ---------------- БАЗОВЫЕ ХЕЛПЕРЫ ---------------- */
function RET_today(){ return todayStr(); }
function RET_has(objId){ return !!S?.ret?.ach?.claimed?.includes(objId); }

/* Универсальный счётчик прогресса: quests + pass XP + achievements */
function RET_track(kind, amount){
  if (!S || !S.ret || amount <= 0) return;
  const R = S.ret;
  // ---- ежедневные задания
  if (R.daily.date === RET_today()){
    for (const q of (R.daily.ids||[])){
      const def = DAILY_QUESTS.find(d=>d.id===q);
      if (!def) continue;
      const tier = R.daily.tier?.[q] ?? 0;
      if ((R.daily.prog[q]||0) >= def.targets[tier]) continue;
      const relevant = (def.id === kind) || (def.id === 'sell' && kind === 'sellCoins') || (def.id === 'harvest' && kind === 'harvest');
      if (!relevant) continue;
      R.daily.prog[q] = Math.min(def.targets[tier], (R.daily.prog[q]||0) + amount);
      if (R.daily.prog[q] >= def.targets[tier]) {
        toast('Задание дня готово!', 'good', 'target');
        sfx.good(); buzz(35);
      }
    }
  }
  // ---- пропуск
  R.pass.xp = (R.pass.xp||0) + amount;

  // ---- достижения по статистике
  RET_checkAchievements();
}

function RET_checkAchievements(){
  const R = S.ret; if (!R) return;
  const statVal = {
    harvests: S.stats.harvests||0,
    earned: S.stats.earned||0,
    contractsDone: S.stats.contractsDone||0,
    aged: S.stats.aged||0,
    buildings: Object.values(S.buildings).filter(b=>b.owned).length,
    bestStreak: R.streak?.best||0,
  };
  for (const a of ACHIEVEMENTS){
    if (R.ach.unlocked.includes(a.id)) continue;
    if ((statVal[a.stat]||0) >= a.need){
      R.ach.unlocked.push(a.id);
      const rw = [];
      if (a.reward.coins){ addCoins(a.reward.coins); rw.push(`+${fmt(a.reward.coins)} монет`); }
      if (a.reward.gems){ S.gems += a.reward.gems; rw.push(`+${a.reward.gems} ${gemWord(a.reward.gems)}`); }
      R.ach.claimed.push(a.id);
      setTimeout(()=>{
        toast(`Достижение: ${a.name} · ${rw.join(', ')}`, 'good', a.icon);
        FX.confetti(); sfx.good();
      }, 400);
    }
  }
}

/* ---------------- ЕЖЕДНЕВНЫЕ ЗАДАНИЯ ---------------- */
function RET_rollDaily(){
  const R = S.ret;
  const today = RET_today();
  if (R.daily.date === today && R.daily.ids?.length) return;
  const pool = DAILY_QUESTS.filter(q=>q.id!=='age' || (S.level>=3));
  const picked = [];
  const shuffled = [...pool].sort(()=>Math.random()-0.5);
  for (const q of shuffled){ if (picked.length<3) picked.push(q.id); }
  R.daily = {
    date: today, ids: picked, prog:{}, claimed:{},
    tier: Object.fromEntries(picked.map(id=>[id, Math.min(2, Math.floor(S.level/6))])),
  };
}

function RET_questState(qid){
  const R = S.ret, def = DAILY_QUESTS.find(d=>d.id===qid);
  if (!def) return null;
  const tier = R.daily.tier?.[qid] ?? 0;
  const target = def.targets[tier];
  const prog = Math.min(target, R.daily.prog?.[qid] || 0);
  return { def, tier, target, prog, done: prog>=target, claimed: !!R.daily.claimed?.[qid] };
}

function RET_claimQuest(qid){
  const st = RET_questState(qid);
  if (!st || !st.done || st.claimed) return;
  const R = S.ret;
  R.daily.claimed[qid] = true;
  const rw = st.def.reward;
  const coins = rw.coins[st.tier] ?? rw.coins[0];
  const gems = (rw.gems?.[st.tier]) || 0;
  addCoins(coins);
  if (gems) S.gems += gems;
  RET_track('_noop', 30); // XP за задание
  toast(`Задание: +${fmt(coins)} монет${gems?`, +${gems} ${gemWord(gems)}`:''}`, 'good', 'gift');
  sfx.coin(); buzz(40); FX.confetti();
  save(); renderAll();
}

function RET_claimedAll(){
  const R = S.ret;
  return (R.daily.ids||[]).every(id => R.daily.claimed?.[id]);
}

/* ---------------- СТРИК С ЗАМОРОЗКОЙ ---------------- */
function RET_touchStreak(){
  const R = S.ret;
  const st = R.streak;
  const today = RET_today();
  if (st.last === today) return { counted:true, isNew:false };

  // если пришли вчера — продолжаем; если пропустили и есть заморозка — восстанавливаем
  const yesterday = yesterdayStr();
  if (st.last === yesterday){
    st.count = (st.count||0) + 1;
  } else if (st.last && st.freezes > 0 && st.last !== today){
    st.freezes--; st.usedFreeze = true;
    st.count = (st.count||0) + 1;
    setTimeout(()=>toast('Заморозка стрика спасла серию!', 'good', 'shield'), 1500);
  } else {
    st.count = 1;
  }
  st.last = today;
  st.best = Math.max(st.best||0, st.count);
  S.stats.bestStreak = Math.max(S.stats.bestStreak||0, st.count);

  // заморозки накапливаются
  if (st.count % 7 === 0) st.freezes = Math.min(STREAK_FREEZE_MAX, (st.freezes||0) + 1);

  // вехи
  const ms = STREAK_MILESTONES[st.count];
  if (ms){
    st.lastMilestone = st.count;
    addCoins(ms.coins); S.gems += ms.gems;
    if (ms.skin) S.ret.skin = ms.skin;
    setTimeout(()=>{
      FX.confetti();
      openDialog(`<div style="text-align:center">
        <div class="big-emoji">🔥</div>
        <h2>${ms.text}</h2>
        <p class="muted">Стрик ${st.count} дней подряд</p>
        <p><b>+${fmt(ms.coins)} монет и +${ms.gems} ${gemWord(ms.gems)}</b></p>
        ${ms.skin?`<p class="muted">Открыт скин фермы: «${ms.skin}»</p>`:''}
        <button class="btn btn-primary btn-block" onclick="App.closeModal()">Продолжить</button></div>`);
    }, 600);
  }
  RET_checkAchievements();
  save();
  return { counted:true, isNew:true };
}

/* ---------------- ЯРМАРКА (событие дня) ---------------- */
function RET_rollFair(){
  const R = S.ret;
  const today = RET_today();
  if (R.fair.date === today && R.fair.id) return;
  // 55% дней — есть событие
  if (Math.random() < 0.55){
    R.fair.id = pick(FAIR_EVENTS).id;
  } else {
    R.fair.id = null;
  }
  R.fair.date = today;
}
function RET_fair(){
  const R = S.ret;
  if (!R?.fair?.id) return null;
  return FAIR_EVENTS.find(f=>f.id===R.fair.id) || null;
}
function RET_fairActive(){ return !!RET_fair(); }

/* Множитель цены с учётом ярмарки */
function RET_priceMult(){
  const f = RET_fair();
  return f?.mult?.prices || 1;
}
function RET_growthMult(){
  const f = RET_fair();
  return f?.mult?.growth || 1;
}
function RET_contractMult(){
  const f = RET_fair();
  return f?.mult?.contracts || 1;
}
function RET_freeCare(){
  return !!RET_fair()?.mult?.freeCare;
}

/* ---------------- ВЫДЕРЖКА НА СКЛАДЕ ---------------- */
const AGING_TIERS = [
  { key:'fresh',  name:'Свежий',   mult:1.0,  hours:0,   color:'#9fae9c', icon:'🌾' },
  { key:'aged1',  name:'Выдержка', mult:1.25, hours:2,   color:'#b5d48a', icon:'⏳' },
  { key:'aged2',  name:'Выдержано',mult:1.55, hours:6,   color:'#e8c078', icon:'⭐' },
  { key:'aged3',  name:'Элита',    mult:2.0,  hours:12,  color:'#f0d68f', icon:'🏆' },
];

function RET_agingTier(p){
  if (!p) return null;
  const elapsed = (Date.now() - p.startedAt) / 3600000; // часы реального времени
  let t = 0;
  for (let i=AGING_TIERS.length-1; i>=0; i--){ if (elapsed >= AGING_TIERS[i].hours){ t = i; break; } }
  return { tier: AGING_TIERS[t], index: t, elapsed, progress: t>=AGING_TIERS.length-1 ? 1 : (elapsed - AGING_TIERS[t].hours) / (AGING_TIERS[t+1].hours - AGING_TIERS[t].hours) };
}

function RET_agedGoods(){
  return (S.ret.aging.slots||[]).filter(Boolean);
}

function RET_putToAge(good){
  const R = S.ret; const A = R.aging;
  if (!S.goods[good] || S.goods[good] <= 0) return;
  const freeSlot = A.slots.findIndex(s=>!s);
  if (freeSlot < 0){ toast('Все ячейки выдержки заняты', 'bad', 'box'); sfx.bad(); return; }
  const units = Math.min(S.goods[good], A.sizeCap || 24);
  S.goods[good] -= units;
  A.slots[freeSlot] = { good, units, startedAt: Date.now(), slot: freeSlot };
  toast(`${GOODS[good].name} ×${units} на выдержку`, 'good', 'clock');
  sfx.pop(); save(); renderAll();
}

function RET_takeFromAge(slotIndex){
  const R = S.ret, A = R.aging;
  const p = A.slots[slotIndex];
  if (!p) return;
  const tierInfo = RET_agingTier(p);
  const mult = tierInfo.tier.mult;
  const price = GOODS[p.good].price;
  const gain = Math.round(p.units * price * mult);
  A.slots[slotIndex] = null;
  addCoins(gain);
  S.stats.aged = (S.stats.aged||0) + 1;
  RET_track('age', 1);
  toast(`Продано выдержанного: +${fmt(gain)} монет (${mult}×)`, 'good', 'coin');
  sfx.coin(); buzz(45);
  FX.confetti(); FX.coin(document.querySelector('#modal-root .dialog'), document.querySelector('[data-coins]'));
  save(); renderAll();
}

function RET_autoSellAged(){
  let total = 0, count = 0;
  const A = S.ret.aging;
  A.slots.forEach((p, i)=>{
    if (!p) return;
    const t = RET_agingTier(p);
    total += Math.round(p.units * GOODS[p.good].price * t.tier.mult) * 1;
    count++;
    A.slots[i] = null;
  });
  if (total > 0){
    addCoins(total);
    toast(`+${fmt(total)} монет за ${count} парт.`, 'good', 'coin');
    sfx.coin(); save(); renderAll();
  }
}

/* ---------------- УХОД ЗА ЖИВОТНЫМИ (мягкая механика) ---------------- */
function RET_penMood(building){
  // mood = минимум из feed/water/clean + бонус, если всё в порядке
  const minVal = Math.min(building.feed||0, building.water||0, building.clean||0);
  const avg = ((building.feed||0)+(building.water||0)+(building.clean||0))/3;
  if (minVal < 20) return { level:'bad', label:'Голодные', mult:0.5, icon:'😟' };
  if (minVal < 40) return { level:'warn', label:'Нужен уход', mult:0.75, icon:'😐' };
  if (avg < 70) return { level:'warn', label:'Нормально', mult:0.95, icon:'🙂' };
  return { level:'good', label:'Довольны', mult:1.15, icon:'😊' };
}

/* ---------------- ПРОПУСК ---------------- */
function RET_passLevel(){
  return Math.min(PASS_TRACKS.length, Math.floor((S.ret.pass.xp||0) / PASS_XP_PER_LEVEL) + 1);
}
function RET_passProgress(){
  const xp = S.ret.pass.xp||0;
  const lvl = RET_passLevel();
  if (lvl >= PASS_TRACKS.length) return 1;
  return (xp % PASS_XP_PER_LEVEL) / PASS_XP_PER_LEVEL;
}
function RET_claimPass(track, level){
  const P = S.ret.pass;
  const tier = PASS_TRACKS.find(t=>t.level===level);
  if (!tier) return;
  const list = track==='premium' ? P.premiumClaimed : P.freeClaimed;
  if (list.includes(level)) return;
  if (level > RET_passLevel()-1 && level > RET_passLevel()) { toast('Ещё не достигнуто', 'bad', 'lock'); return; }
  if (list.includes(level)) return;
  const reward = tier[track];
  if (track==='premium' && !P.premium){ toast('Премиум-пропуск не активирован', 'bad', 'star'); return; }
  list.push(level);
  if (reward.coins) addCoins(reward.coins);
  if (reward.gems) S.gems += reward.gems;
  if (reward.skin) S.ret.skin = reward.skin;
  toast(`Пропуск: ${reward.coins?`+${fmt(reward.coins)} монет`:''}${reward.gems?` +${reward.gems} ${gemWord(reward.gems)}`:''}${reward.skin?' + скин':''}`, 'good', 'gift');
  sfx.good(); save(); renderAll();
}

/* ---------------- МАППИНГ ЭМОДЗИ ---------------- */
const RET_GOOD_EMOJI = { wheat:'🌾',rapeseed:'🌻',corn:'🌽',soy:'🫘',potato:'🥔',cotton:'☁️',grape:'🍇',hay:'🌿',
  eggs:'🥚',wool:'🧶',milk:'🥛',meat:'🍖',honey:'🍯',veggies:'🥕',flour:'🌾',bread:'🍞',cheese:'🧀',fabric:'🧵',clothes:'👕',silage:'🌿',biogas:'⚡' };
const RET_BLD_EMOJI = { coop:'🐔', sheep:'🐑', cow:'🐄', pig:'🐖', apiary:'🐝', greenhouse:'🌿' };
const RET_MACH_EMOJI = { tractor:'🚜', cultivator:'🛞', seeder:'🌱', combine:'🚛', sprayer:'💨', mower:'✂️', baler:'🎯', truck:'🚚' };
function RET_goodEmoji(g){ return RET_GOOD_EMOJI[g] || '📦'; }
