/* ============================================================
   ХУКИ (PATCHES) — встраивание модуля в существующую игру
   Вызывается один раз после загрузки основного скрипта.
   Все патчи безопасны: если что-то не найдено — просто пропускаем.
   ============================================================ */
function RET_installHooks(){
  /* [HOOK 1] renderFarm → новая версия со вкладками */
  if (typeof renderFarm === 'function'){
    window.__ret_origRenderFarm = renderFarm;
    renderFarm = function(){ RET_renderFarm(); };
  }

  /* [HOOK 2] renderAll должен пересчитывать задачи/стрик */
  const origRenderAll = window.renderAll;
  if (typeof origRenderAll === 'function'){
    window.renderAll = function(){
      if (S && S.ret){ RET_rollDaily(); RET_rollFair(); }
      return origRenderAll.apply(this, arguments);
    };
  }

  /* [HOOK 3] completeFieldWork — учёт урожая в заданиях */
  if (typeof completeFieldWork === 'function'){
    const orig = completeFieldWork;
    completeFieldWork = function(f){
      const before = {...S.goods};
      const hadCrop = f.crop;
      const result = orig.apply(this, arguments);
      if (hadCrop){
        let delta = 0;
        for (const g in S.goods){ delta += Math.max(0, S.goods[g] - (before[g]||0)); }
        if (delta > 0) RET_track('harvest', delta);
      }
      return result;
    };
  }

  /* [HOOK 4] sellGood — деньги в заданиях */
  if (typeof sellGood === 'function'){
    const orig = sellGood;
    sellGood = function(good, qty){
      const gain = orig.apply(this, arguments);
      if (gain > 0) RET_track('sellCoins', gain);
      return gain;
    };
  }

  /* [HOOK 5] claimContract — заказы в заданиях + множитель ярмарки */
  if (typeof claimContract === 'function'){
    const orig = claimContract;
    claimContract = function(id){
      const c = S.board.find(x=>x.id===id);
      return orig.call(this, id);
    };
  }
  if (typeof contractRewardMult === 'undefined'){
    window.contractRewardMult = function(){ return RET_contractMult(); };
  }

  /* [HOOK 6] startFieldWork — учёт посева */
  if (typeof startFieldWork === 'function'){
    const orig = startFieldWork;
    startFieldWork = function(f, action, extra){
      const ok = orig.apply(this, arguments);
      if (ok && action === 'sow') RET_track('plant', 1);
      return ok;
    };
  }

  /* [HOOK 7] startProduction — цеха в заданиях */
  if (typeof startProduction === 'function'){
    const orig = startProduction;
    startProduction = function(id){
      const wasRunning = S.productions[id]?.running;
      const result = orig.apply(this, arguments);
      if (!wasRunning && S.productions[id]?.running) RET_track('produce', 1);
      return result;
    };
  }

  /* [HOOK 8] collectBuilding — сбор продукции */
  if (typeof collectBuilding === 'function'){
    const orig = collectBuilding;
    collectBuilding = function(id){
      const had = S.buildings[id]?.stored > 0;
      const result = orig.apply(this, arguments);
      if (had) RET_track('collect', 1);
      return result;
    };
  }

  /* [HOOK 9] careBuilding — уход за животными */
  if (typeof careBuilding === 'function'){
    const orig = careBuilding;
    careBuilding = function(id, kind){
      if (RET_freeCare()){ sfx.pop(); return; } // ярмарка: бесплатный уход
      const result = orig.apply(this, arguments);
      RET_track('care', 1);
      return result;
    };
  }

  /* [HOOK 10] рост культур с учётом ярмарки */
  if (typeof growthFactor === 'function'){
    const orig = growthFactor;
    growthFactor = function(){
      return orig.apply(this, arguments) * RET_growthMult();
    };
  }

  /* [HOOK 11] цены с учётом ярмарки */
  if (typeof bestPoint === 'function'){
    const orig = bestPoint;
    bestPoint = function(good){
      const r = orig.apply(this, arguments);
      const fm = RET_priceMult();
      if (fm !== 1) return { ...r, mult: Math.round(r.mult * fm * 100) / 100 };
      return r;
    };
  }

  /* [HOOK 12] починка техники — в заданиях */
  if (window.App && typeof App.repairMachine === 'function'){
    const orig = App.repairMachine.bind(App);
    App.repairMachine = function(id){
      const wasBroken = S.machines[id]?.cond < 100;
      const result = orig(id);
      if (wasBroken) RET_track('repair', 1);
      return result;
    };
  }

  /* [HOOK 13] заказ получен — учёт */
  const origClaim = window.App?.claimContract;
  if (window.App && typeof origClaim === 'function'){
    window.App.claimContract = function(id){
      const result = origClaim.call(App, id);
      RET_track('contract', 1);
      return result;
    };
  }

  /* [HOOK 14] Добавляем новые методы в App */
  if (window.App){
    Object.assign(App, {
      farmView(v){ ui.farmView = v; sfx.click(); renderScreen(); },
      claimQuest(qid){ RET_claimQuest(qid); },
      openBunker(){ openDialog(`<h2>${ic('clock')} Бункер</h2>${RET_renderBunker()}`); },
      openPens(){ openDialog(`<h2>${ic('cow')} Загоны</h2>${RET_renderPens()}`); },
      openFair(){ RET_openFair(); },
      putAged(g){ RET_putToAge(g); if (ui.modal) openDialog(`<h2>${ic('clock')} Бункер</h2>${RET_renderBunker()}`); },
      takeAged(i){ RET_takeFromAge(i); openDialog(`<h2>${ic('clock')} Бункер</h2>${RET_renderBunker()}`); },
      feedPen(id){ RET_penCare(id,'feed'); openDialog(`<h2>${ic('cow')} Загоны</h2>${RET_renderPens()}`); },
      waterPen(id){ RET_penCare(id,'water'); openDialog(`<h2>${ic('cow')} Загоны</h2>${RET_renderPens()}`); },
      cleanPen(id){ RET_penCare(id,'clean'); openDialog(`<h2>${ic('cow')} Загоны</h2>${RET_renderPens()}`); },
      collectPen(id){ collectBuilding(id); openDialog(`<h2>${ic('cow')} Загоны</h2>${RET_renderPens()}`); },
      passInfo(){ openDialog(`<div style="text-align:center"><div class="big-emoji">🎖️</div><h2 style="justify-content:center">Фермерский пропуск</h2><p class="muted">Пока прототип: награды выдаются автоматически за очки опыта. В финальной версии появится премиум-ветка за самоцветы.</p><button class="btn btn-primary btn-block" onclick="App.closeModal()">Понятно</button></div>`); }
    });
  }

  /* [HOOK 15] Миграция + запуск дневных систем */
  if (S){
    RET_migrate();
    RET_rollDaily();
    RET_rollFair();
    RET_touchStreak();
    RET_checkAchievements();
  }
}

/* ---------- Дополнительные хелперы, используемые хуками ---------- */
function RET_penCare(id, kind){
  const b = S.buildings[id];
  if (!b || !b.owned) return;
  const cost = RET_freeCare() ? 0 : 8;
  if (cost && S.coins < cost){ toast('Не хватает монет', 'bad', 'coin'); sfx.bad(); return; }
  if (cost) addCoins(-cost);
  b[kind] = clamp((b[kind]||0) + 30, 0, 100);
  sfx.pop(); RET_track('care', 1); save(); renderAll();
}

function RET_openFair(){
  const f = RET_fair();
  if (!f){ openDialog(`<div style="text-align:center"><div class="big-emoji">🌤️</div><h2 style="justify-content:center">Сегодня без события</h2><p class="muted">Загляни завтра — на ярмарке бывают особые дни.</p><button class="btn btn-primary btn-block" onclick="App.closeModal()">Ок</button></div>`); return; }
  openDialog(`<div style="text-align:center">
    <div class="big-emoji">🎪</div><h2 style="justify-content:center">${f.name}</h2>
    <p class="muted">${f.desc}</p>
    <p class="muted-small">Событие действует до конца дня и меняет экономику фермы. Не пропусти!</p>
    <button class="btn btn-primary btn-block" onclick="App.closeModal()">Отлично</button></div>`);
}

/* ---------- Оффлайн-экран (перехват) ---------- */
function RET_installOfflineHook(){
  if (typeof applyOffline !== 'function') return;
  const orig = applyOffline;
  applyOffline = function(){
    const before = S.coins;
    const beforeGoods = {...S.goods};
    // сохраняем прошлую реализацию для эффектов (готовые поля и т.д.), но перехватываем диалог
    const dialogSnap = window.openDialog;
    let captured = [];
    window.openDialog = function(html){ captured.push(html); };
    try { orig.apply(this, arguments); } finally { window.openDialog = dialogSnap; }

    const elapsedSec = Math.min((Date.now()-S.lastSeen)/1000, OFFLINE_CAP);
    const gameSec = elapsedSec * ts();
    if (gameSec < 60) return;

    // собираем статистику для нового экрана
    const readyFields = S.fields.filter(f=>f.owned && f.state==='ready').length;
    const agedReady = RET_agedGoods().filter(p=>RET_agingTier(p).index>=2).length;
    const animals = Object.keys(S.buildings).filter(id=>S.buildings[id].owned && S.buildings[id].stored>0).length;
    const prod = Object.keys(S.productions).filter(id=>{
      const p = S.productions[id];
      return p.owned && !p.running && Object.values(p.stored||{}).some(v=>v>0);
    }).length;
    const coins = Math.max(0, S.coins - before);

    RET_showOfflineScreen({
      elapsedSec: gameSec, coins, readyFields, agedReady, animals, prod,
      lines: [],
    });
  };
}

/* ---------- Запуск всех хуков ---------- */
function RET_boot(){
  if (typeof S === 'undefined' || !S){
    // до старта игры: патчим рендер и оффлайн, которые нужны после старта
    RET_installHooks();
    return;
  }
  RET_installHooks();
}
