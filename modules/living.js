/* ============================================================
   ЖИВОЙ МИР — ЛОГИКА
   Время суток, питомец, существа, шторм, экспедиции, коллекция
   ============================================================ */

/* ---------------- КОНФИГ ---------------- */
const TOD_PHASES = [
  { id:'dawn',   name:'Рассвет',      icon:'sun',    from:5,  to:8,  bonus:'Молоко +15%',        color:'#f0a878' },
  { id:'day',    name:'День',         icon:'sun',    from:8,  to:17, bonus:'Обычный день',        color:'#a8d0e8' },
  { id:'golden', name:'Золотой час',  icon:'sun',    from:17, to:19, bonus:'Урожай +10%',         color:'#f0c878' },
  { id:'dusk',   name:'Закат',        icon:'snow',   from:19, to:21, bonus:'Заказы +15%',         color:'#d89a8a' },
  { id:'night',  name:'Ночь',         icon:'snow',   from:21, to:5,  bonus:'Выдержка ×1.4',       color:'#8a9ed8' },
];

const PET_STAGES = [
  { lvl:1, name:'Щенок',    need:0,    bonus:'+2% к урожаю' },
  { lvl:2, name:'Подросток',need:120,  bonus:'+4% к урожаю' },
  { lvl:3, name:'Взрослый', need:400,  bonus:'+6% урожай, −5% поломок' },
  { lvl:4, name:'Верный',   need:1000, bonus:'+9% урожай, −10% поломок' },
  { lvl:5, name:'Легенда',  need:2200, bonus:'+12% урожай, −15% поломок' },
];
const PET_STAGE_EMOJI = ['🐶','🐕','🦮','🐕\u200d🦺','🐺'];

const EXPEDITIONS = [
  { id:'shore',  name:'Рыбацкая бухта', icon:'droplet', min:1, dur:45,  cost:300,
    desc:'Сеть, сети и немного соли', rewards:['gems','seed'] },
  { id:'forest', name:'Лесопилка',      icon:'leaf',    min:2, dur:90,  cost:600,
    desc:'Древесина и редкие травы',   rewards:['coins','card'] },
  { id:'hill',   name:'Ветряные холмы', icon:'bolt',    min:3, dur:150, cost:1200,
    desc:'Старые механизмы и клады',   rewards:['gems','card','coins'] },
  { id:'ruins',  name:'Древние руины',  icon:'map',     min:5, dur:240, cost:2500,
    desc:'Тайны первого фермера',      rewards:['card','gems'] },
];

const STORM_EVENTS = [
  { id:'storm',  name:'Приближается шторм', icon:'rain',  text:'Ураган идёт на остров', safeCost:200, lossMin:.25, lossMax:.4 },
  { id:'drought',name:'Засуха',             icon:'drought',text:'Палящее солнце сушит землю', safeCost:250, lossMin:.2, lossMax:.35 },
  { id:'pests',  name:'Нашествие вредителей',icon:'leaf', text:'Тля атакует посевы', safeCost:180, lossMin:.3, lossMax:.45 },
];

/* Карточки коллекции — 30 штук по 3 редкости */
const CARD_SET = [
  { id:'wheat',   name:'Золотая пшеница', icon:'wheat',  r:'common' },
  { id:'corn',    name:'Сахарная кукуруза',icon:'corn',  r:'common' },
  { id:'potato',  name:'Белый картофель', icon:'potato', r:'common' },
  { id:'grape',   name:'Виноградная лоза',icon:'grape',  r:'common' },
  { id:'rapeseed',name:'Рапсовый цвет',   icon:'flower', r:'common' },
  { id:'soy',     name:'Полевая соя',     icon:'leaf',   r:'common' },
  { id:'cotton',  name:'Пушистый хлопок', icon:'cloud',  r:'common' },
  { id:'hay',     name:'Ароматное сено',  icon:'hay',    r:'common' },
  { id:'eggs',    name:'Крупные яйца',    icon:'egg',    r:'common' },
  { id:'milk',    name:'Парное молоко',   icon:'milk',   r:'common' },
  { id:'wool',    name:'Мягкая шерсть',   icon:'wool',   r:'rare' },
  { id:'honey',   name:'Лесной мёд',      icon:'honey',  r:'rare' },
  { id:'cheese',  name:'Зрелый сыр',      icon:'cheese', r:'rare' },
  { id:'bread',   name:'Ржаной хлеб',     icon:'bread',  r:'rare' },
  { id:'fabric',  name:'Льняная ткань',   icon:'fabric', r:'rare' },
  { id:'veggies', name:'Овощной сбор',    icon:'tomato', r:'rare' },
  { id:'meat',    name:'Фермерское мясо', icon:'meat',   r:'rare' },
  { id:'silage',  name:'Сочный силос',    icon:'silage', r:'rare' },
  { id:'biogas',  name:'Чистый биогаз',   icon:'zap',    r:'rare' },
  { id:'flour',   name:'Мельничная мука', icon:'sack',   r:'rare' },
  { id:'clothes', name:'Тёплая одежда',   icon:'shirt',  r:'epic' },
  { id:'gem',     name:'Островной самоцвет',icon:'gem',  r:'epic' },
  { id:'tractor', name:'Старый трактор',  icon:'tractor',r:'epic' },
  { id:'mill',    name:'Каменная мельница',icon:'windmill',r:'epic' },
  { id:'cow',     name:'Породистая корова',icon:'cow',   r:'epic' },
  { id:'bee',     name:'Матка пасеки',    icon:'bee',    r:'epic' },
  { id:'barn',    name:'Красный амбар',   icon:'barn',   r:'epic' },
  { id:'coin',    name:'Золотой талер',   icon:'coin',   r:'epic' },
  { id:'star',    name:'Звезда острова',  icon:'star',   r:'epic' },
  { id:'medal',   name:'Медаль фермера',  icon:'medal',  r:'epic' },
];
const CARD_RARITY_COLOR = { common:'#9fb8a0', rare:'#7fb8e0', epic:'#e0b870' };

/* ---------------- МИГРАЦИЯ ---------------- */
function LIV_migrate(){
  if (!S) return;
  if (!S.liv) S.liv = {};
  const L = S.liv;
  if (!L.pet) L.pet = { name:'Рекс', xp:0, fed:Date.now(), lastPlay:0, adopted:false };
  if (!L.exp) L.exp = { running:null, done:[] };
  if (!L.cards) L.cards = { owned:[], seen:[] };
  if (!L.storm) L.storm = { date:'', id:null, resolved:false, deadline:0 };
  if (!L.week) L.week = { start:'', points:0, claimed:[] };
  if (!S.stats.petLevel) S.stats.petLevel = 1;
  if (!S.stats.expeditions) S.stats.expeditions = 0;
}

/* ---------------- ВРЕМЯ СУТОК ---------------- */
function LIV_todPhase(){
  const h = new Date().getHours();
  for (const p of TOD_PHASES){
    if (p.from <= p.to){ if (h >= p.from && h < p.to) return p; }
    else { if (h >= p.from || h < p.to) return p; }
  }
  return TOD_PHASES[1];
}

function LIV_applyTOD(){
  const p = LIV_todPhase();
  const body = document.body;
  ['dawn','day','golden','dusk','night'].forEach(id => body.classList.toggle('tod-'+id, id === p.id));
  return p;
}

/* Бонусы времени суток */
function LIV_todYieldMult(){
  const p = LIV_todPhase();
  if (p.id === 'golden') return 1.10;
  return 1;
}
function LIV_todAgingMult(){
  return LIV_todPhase().id === 'night' ? 1.4 : 1;
}
function LIV_todMilkMult(){
  return LIV_todPhase().id === 'dawn' ? 1.15 : 1;
}
function LIV_todContractMult(){
  return LIV_todPhase().id === 'dusk' ? 1.15 : 1;
}

/* ---------------- СВЕТЛЯЧКИ ---------------- */
function LIV_spawnFireflies(container){
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 9; i++){
    const d = document.createElement('div');
    d.className = 'liv-ff';
    d.style.left = (8 + Math.random()*84) + '%';
    d.style.top = (22 + Math.random()*58) + '%';
    d.style.animationDelay = (-Math.random()*8).toFixed(1) + 's';
    d.style.animationDuration = (6 + Math.random()*5).toFixed(1) + 's';
    container.appendChild(d);
  }
}

/* ---------------- ПИТОМЕЦ ---------------- */
function LIV_petStage(){
  const xp = S.liv.pet.xp || 0;
  let stage = PET_STAGES[0];
  for (const s of PET_STAGES) if (xp >= s.need) stage = s;
  return stage;
}
function LIV_petBonus(){
  const lvl = LIV_petStage().lvl;
  return { yield: [0, .02, .04, .06, .09, .12][lvl] || 0,
           decay: [0, 0, 0, .05, .10, .15][lvl] || 0 };
}
function LIV_petMood(){
  // настроение падает, если давно не кормили
  const hours = (Date.now() - (S.liv.pet.fed || Date.now())) / 3600000;
  if (hours < 4) return { key:'happy',  label:'Сыт и весел',  mult:1.0,  icon:'😊' };
  if (hours < 10) return { key:'ok',   label:'Скучает',      mult:0.85, icon:'😐' };
  if (hours < 24) return { key:'sad',  label:'Голодный',     mult:0.6,  icon:'😟' };
  return { key:'bad', label:'Совсем один', mult:0.35, icon:'😢' };
}
function LIV_petXP(n){
  const before = LIV_petStage().lvl;
  S.liv.pet.xp = (S.liv.pet.xp || 0) + n;
  const after = LIV_petStage();
  if (after.lvl > before){
    S.stats.petLevel = after.lvl;
    setTimeout(()=>{
      FX.confetti();
      openDialog(`<div style="text-align:center">
        <div class="big-emoji">${PET_STAGE_EMOJI[after.lvl-1]}</div>
        <h2>${S.liv.pet.name} вырос!</h2>
        <p class="muted">Теперь он ${after.name}. ${after.bonus}</p>
        <button class="btn btn-primary btn-block" onclick="App.closeModal()">Отлично!</button></div>`);
      sfx.good();
    }, 400);
  }
}
function LIV_feedPet(){
  const p = S.liv.pet;
  const cost = 40;
  if (S.coins < cost){ toast('Не хватает монет', 'bad', 'coin'); sfx.bad(); return; }
  if (Date.now() - p.fed < 3600000){ toast(`${p.name} ещё сыт`, '', 'check'); return; }
  addCoins(-cost);
  p.fed = Date.now();
  LIV_petXP(18);
  toast(`${p.name} накормлен · +18 опыта`, 'good', 'sack');
  sfx.pop(); buzz(30);
  FX.pop(document.querySelector('.liv-pet'), '🍖', 4);
  save(); renderAll(); openPet();
}
function LIV_playPet(){
  const p = S.liv.pet;
  if (Date.now() - p.lastPlay < 1800000){ toast(`${p.name} устал играть`, '', 'clock'); return; }
  p.lastPlay = Date.now();
  LIV_petXP(12);
  addCoins(5);
  toast(`Игра с ${p.name} · +12 опыта, +5 монет`, 'good', 'check');
  sfx.good(); buzz(20);
  const el = document.querySelector('.liv-pet');
  if (el){ el.classList.add('wag'); setTimeout(()=>el.classList.remove('wag'), 1600); }
  FX.pop(el, '❤️', 3);
  save(); renderAll(); openPet();
}
function LIV_petSay(text){
  const el = document.querySelector('.liv-pet-bubble');
  if (el) el.remove();
  const pet = document.querySelector('.liv-pet');
  if (!pet) return;
  const b = document.createElement('div');
  b.className = 'liv-pet-bubble';
  b.textContent = text;
  pet.appendChild(b);
  setTimeout(()=>b.remove(), 2600);
}

/* ---------------- СУЩЕСТВА НА СЦЕНЕ ---------------- */
function LIV_spawnCritters(container, hasAnimals){
  if (!container) return;
  container.innerHTML = '';
  if (!hasAnimals) return;
  // птицы
  for (let i = 0; i < 2; i++){
    const b = document.createElement('div');
    b.className = 'liv-bird';
    b.style.top = (18 + i*14) + '%';
    b.style.left = '-10%';
    b.style.animation = `birdFly${i} ${18+i*7}s linear infinite`;
    b.style.animationDelay = (-i*9) + 's';
    container.appendChild(b);
  }
}
function LIV_injectBirdKeyframes(){
  if (document.getElementById('liv-bird-kf')) return;
  const st = document.createElement('style');
  st.id = 'liv-bird-kf';
  st.textContent = `
    @keyframes birdFly0{from{transform:translateX(-30px) translateY(0)}50%{transform:translateX(200px) translateY(-14px)}to{transform:translateX(420px) translateY(4px)}}
    @keyframes birdFly1{from{transform:translateX(-30px) translateY(0)}50%{transform:translateX(180px) translateY(10px)}to{transform:translateX(420px) translateY(-8px)}}
    @keyframes critterWalk{0%,100%{transform:translateX(0) scaleX(1)}45%{transform:translateX(var(--walk,60px)) scaleX(1)}55%{transform:translateX(var(--walk,60px)) scaleX(-1)}99%{transform:translateX(0) scaleX(-1)}}
  `;
  document.head.appendChild(st);
}

/* ---------------- ШТОРМ ---------------- */
function LIV_rollStorm(){
  const L = S.liv;
  const today = todayStr();
  if (L.storm.date === today) return;
  L.storm = { date: today, id: null, resolved: false, deadline: 0 };
  // 40% шанс, что сегодня будет событие
  if (S.level >= 2 && Math.random() < 0.40){
    L.storm.id = pick(STORM_EVENTS).id;
    L.storm.deadline = Date.now() + 3*3600*1000; // 3 часа
  }
  save();
}
function LIV_stormEvent(){
  const L = S.liv;
  if (!L?.storm?.id || L.storm.resolved) return null;
  if (Date.now() > L.storm.deadline){ L.storm.resolved = true; return null; }
  return STORM_EVENTS.find(e => e.id === L.storm.id) || null;
}
function LIV_stormSafe(){
  const ev = LIV_stormEvent();
  if (!ev) return;
  if (S.coins < ev.safeCost){ toast('Не хватает монет', 'bad', 'coin'); sfx.bad(); return; }
  addCoins(-ev.safeCost);
  S.liv.storm.resolved = true;
  toast(`${ev.name} пережит без потерь!`, 'good', 'shield');
  sfx.good(); save(); renderAll();
  openDialog(`<div style="text-align:center">
    <div class="big-emoji">🛡️</div><h2>Урожай спасён</h2>
    <p class="muted">Потрачено ${fmt(ev.safeCost)} монет, но всё осталось целым.</p>
    <button class="btn btn-primary btn-block" onclick="App.closeModal()">Хорошо</button></div>`);
}
function LIV_stormRisk(){
  const ev = LIV_stormEvent();
  if (!ev) return;
  S.liv.storm.resolved = true;
  const luck = Math.random();
  if (luck < 0.45){
    toast('Пронесло! Ничего не пострадало', 'good', 'sun');
    sfx.good(); FX.confetti();
    save(); renderAll();
    openDialog(`<div style="text-align:center">
      <div class="big-emoji">🍀</div><h2>Повезло!</h2>
      <p class="muted">${ev.name} прошёл мимо. Вы сохранили и деньги, и урожай.</p>
      <button class="btn btn-primary btn-block" onclick="App.closeModal()">Отлично</button></div>`);
  } else {
    const lossPct = rand(ev.lossMin, ev.lossMax);
    let lost = 0;
    for (const g in S.goods){
      const cut = Math.floor(S.goods[g] * lossPct);
      if (cut > 0){ S.goods[g] -= cut; lost += cut; }
    }
    // также бьёт по растущим полям
    let fieldHit = 0;
    for (const f of S.fields){
      if (f.owned && f.state === 'growing' && f.crop){
        if (Math.random() < 0.5){ if (f.t1 && f.t0){ f.t1 = f.t0 + (f.t1 - f.t0) * 1.35; fieldHit++; } }
      }
    }
    sfx.bad(); FX.shake();
    save(); renderAll();
    openDialog(`<div style="text-align:center">
      <div class="big-emoji">😖</div><h2>${ev.name} ударил</h2>
      <p class="muted">Потеряно ${fmt(lost)} ед. товара${fieldHit ? `, ${fieldHit} полей задержались` : ''}.</p>
      <button class="btn btn-primary btn-block" onclick="App.closeModal()">Переживём</button></div>`);
  }
}

/* ---------------- ЭКСПЕДИЦИИ ---------------- */
function LIV_expStart(id){
  const def = EXPEDITIONS.find(e => e.id === id);
  const L = S.liv.exp;
  if (!def) return;
  if (L.running){ toast('Экспедиция уже идёт', 'bad', 'clock'); return; }
  if (S.level < def.min){ toast(`Нужен ${def.min} уровень`, 'bad', 'star'); return; }
  if (S.coins < def.cost){ toast('Не хватает монет', 'bad', 'coin'); sfx.bad(); return; }
  addCoins(-def.cost);
  L.running = { id: def.id, startedAt: Date.now(), endsAt: Date.now() + def.dur*60000 };
  toast(`Отправлен в ${def.name} · ${def.dur} мин`, 'good', 'map');
  sfx.pop(); save(); renderAll();
}
function LIV_expCollect(){
  const L = S.liv.exp;
  const r = L.running;
  if (!r) return;
  const def = EXPEDITIONS.find(e => e.id === r.id);
  if (Date.now() < r.endsAt){ toast('Ещё в пути', '', 'clock'); return; }
  L.running = null;
  S.stats.expeditions = (S.stats.expeditions||0) + 1;

  const gained = [];
  const roll = Math.random();
  if (roll < 0.35){
    const coins = Math.round(def.cost * rand(1.8, 3.2));
    addCoins(coins); gained.push(`+${fmt(coins)} монет`);
  } else if (roll < 0.7){
    const gems = randi(1, 3);
    S.gems += gems; gained.push(`+${gems} ${gemWord(gems)}`);
  } else {
    const card = LIV_randomCard();
    if (card){ gained.push(`карточка «${card.name}»`); }
    else { const coins = Math.round(def.cost * 1.5); addCoins(coins); gained.push(`+${fmt(coins)} монет`); }
  }
  // бонус за уровень
  if (Math.random() < 0.3){ addCoins(Math.round(def.cost*0.6)); gained.push(`бонус +${fmt(Math.round(def.cost*0.6))}`); }

  LIV_petXP(10);
  RET_track('_noop', 20);
  sfx.good(); FX.confetti(); buzz(50);
  save(); renderAll();
  openDialog(`<div style="text-align:center">
    <div class="big-emoji">🧭</div><h2>Экспедиция вернулась</h2>
    <p class="muted">${def.name}</p>
    <p style="font-weight:800;color:#f0d68f">${gained.join('<br>')}</p>
    <button class="btn btn-primary btn-block" onclick="App.closeModal()">Забрать</button></div>`);
}
function LIV_randomCard(){
  const owned = S.liv.cards.owned;
  const pool = CARD_SET.filter(c => !owned.includes(c.id));
  if (!pool.length) return null;
  // редкие выпадают реже
  const weighted = [];
  for (const c of pool){
    const w = c.r === 'common' ? 6 : c.r === 'rare' ? 3 : 1;
    for (let i = 0; i < w; i++) weighted.push(c);
  }
  const card = pick(weighted);
  owned.push(card.id);
  setTimeout(()=>{
    FX.confetti();
    toast(`Новая карточка: ${card.name}`, 'good', card.icon);
    sfx.good();
  }, 500);
  return card;
}
function LIV_grantCard(){
  const c = LIV_randomCard();
  if (c){ save(); renderAll(); }
  return c;
}

/* ---------------- НЕДЕЛЬНАЯ ЯРМАРКА ---------------- */
function LIV_weekStart(){
  const d = new Date();
  const day = d.getDay() || 7;
  const monday = new Date(d); monday.setDate(d.getDate() - day + 1);
  return monday.getFullYear() + '-' + (monday.getMonth()+1) + '-' + monday.getDate();
}
function LIV_rollWeek(){
  const L = S.liv;
  const cur = LIV_weekStart();
  if (L.week.start === cur) return;
  L.week = { start: cur, points: 0, claimed: [] };
  save();
}
function LIV_weekPoints(n){
  const L = S.liv;
  LIV_rollWeek();
  L.week.points = (L.week.points||0) + n;
}
const WEEK_MILESTONES = [
  { at:500,  reward:{coins:800},           name:'500 очков' },
  { at:1500, reward:{gems:3},              name:'1 500 очков' },
  { at:3500, reward:{coins:2500, gems:2},  name:'3 500 очков' },
  { at:7000, reward:{coins:5000, gems:8},  name:'7 000 очков' },
];
function LIV_weekClaim(){
  const L = S.liv; LIV_rollWeek();
  const pts = L.week.points || 0;
  let claimedAny = false;
  for (const m of WEEK_MILESTONES){
    if (pts >= m.at && !L.week.claimed.includes(m.at)){
      L.week.claimed.push(m.at);
      if (m.reward.coins) addCoins(m.reward.coins);
      if (m.reward.gems) S.gems += m.reward.gems;
      claimedAny = true;
    }
  }
  if (claimedAny){
    toast('Награда недели получена!', 'good', 'gift');
    sfx.good(); FX.confetti(); save(); renderAll();
  } else {
    toast('Пока нечего забирать', '', 'clock');
  }
}
