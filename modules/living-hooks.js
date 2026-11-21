/* ============================================================
   ЖИВОЙ МИР — ХУКИ
   ============================================================ */

function LIV_installHooks(){
  LIV_injectBirdKeyframes();

  /* [1] Множитель урожая: золотой час + питомец */
  if (typeof fieldYield === 'function'){
    const orig = fieldYield;
    fieldYield = function(f){
      let v = orig.apply(this, arguments);
      try {
        const pet = LIV_petBonus().yield * LIV_petMood().mult;
        v *= (1 + pet) * LIV_todYieldMult();
      } catch(e){}
      return v;
    };
  }

  /* [2] Ночная выдержка ×1.4 */
  if (typeof RET_agingTier === 'function'){
    const orig = RET_agingTier;
    RET_agingTier = function(p){
      const r = orig.apply(this, arguments);
      if (!r || !p) return r;
      const boost = LIV_todAgingMult();
      if (boost === 1) return r;
      // ночью «время» идёт быстрее — пересчитываем индекс
      const elapsed = ((Date.now() - p.startedAt) / 3600000) * boost;
      let t = 0;
      for (let i = AGING_TIERS.length-1; i >= 0; i--){ if (elapsed >= AGING_TIERS[i].hours){ t = i; break; } }
      return { tier: AGING_TIERS[t], index: t, elapsed, progress: t>=AGING_TIERS.length-1?1:(elapsed-AGING_TIERS[t].hours)/(AGING_TIERS[t+1].hours-AGING_TIERS[t].hours) };
    };
  }

  /* [3] Молоко на рассвете + очки недели при сборе продукции */
  if (typeof collectBuilding === 'function'){
    const orig = collectBuilding;
    collectBuilding = function(id){
      const before = S.goods[BUILDINGS[id]?.good] || 0;
      const res = orig.apply(this, arguments);
      const after = S.goods[BUILDINGS[id]?.good] || 0;
      const got = after - before;
      if (got > 0){
        // рассветный бонус к молоку
        if (BUILDINGS[id]?.good === 'milk'){
          const extra = Math.round(got * (LIV_todMilkMult() - 1));
          if (extra > 0){ addGoods('milk', extra); toast(`Рассвет: молоко +${extra}`, 'good', 'milk'); }
        }
        LIV_weekPoints(got);
        LIV_petXP(2);
      }
      return res;
    };
  }

  /* [4] Заказы: закатный бонус + очки недели */
  if (window.App && typeof App.claimContract === 'function'){
    const orig = App.claimContract.bind(App);
    App.claimContract = function(id){
      const res = orig(id);
      try {
        const mult = LIV_todContractMult();
        if (mult > 1){
          const bonus = 150;
          addCoins(bonus);
          toast(`Закат: бонус заказа +${fmt(bonus)}`, 'good', 'coin');
        }
        LIV_weekPoints(120);
      } catch(e){}
      return res;
    };
  }

  /* [5] Урожай: очки недели + опыт питомцу */
  if (typeof completeFieldWork === 'function'){
    const orig = completeFieldWork;
    completeFieldWork = function(f){
      const beforeCoins = 0;
      const hadCrop = f && f.crop;
      const res = orig.apply(this, arguments);
      if (hadCrop){
        LIV_weekPoints(45);
        LIV_petXP(3);
        // случайная карточка при уборке — 6% шанс
        if (Math.random() < 0.06) LIV_grantCard();
      }
      return res;
    };
  }

  /* [6] Продажа: очки недели */
  if (typeof sellGood === 'function'){
    const orig = sellGood;
    sellGood = function(good, qty){
      const gain = orig.apply(this, arguments);
      if (gain > 0){ LIV_weekPoints(Math.round(gain/10)); }
      return gain;
    };
  }

  /* [7] renderFarm: добавляем питомца, шторм, недельную ярмарку */
  if (typeof RET_renderFarm === 'function'){
    window.__liv_origRenderFarm = RET_renderFarm;
    RET_renderFarm = function(){
      const res = window.__liv_origRenderFarm.apply(this, arguments);
      try { LIV_afterRender(); } catch(e){}
      return res;
    };
  }

  /* [8] Новые методы App */
  if (window.App){
    Object.assign(App, {
      openPet(){ sfx.click(); openPet(); },
      feedPet(){ LIV_feedPet(); },
      playPet(){ LIV_playPet(); },
      openStorm(){ sfx.click(); openStorm(); },
      stormSafe(){ LIV_stormSafe(); },
      stormRisk(){ LIV_stormRisk(); },
      openWeek(){ sfx.click(); openWeek(); },
      weekClaim(){ LIV_weekClaim(); },
      expStart(id){ LIV_expStart(id); openExpeditions(); },
      expCollect(){ LIV_expCollect(); },
      openExpeditions(){ sfx.click(); openExpeditions(); },
      cardInfo(id){ openCardInfo(id); },
    });
  }
}

/* ---------- Действия после рендера главной ---------- */
function LIV_afterRender(){
  // время суток
  LIV_applyTOD();

  // питомец на главной
  const screen = document.getElementById('screen');
  const scene = screen?.querySelector('.farm-scene');
  if (scene && ui.tab === 'farm' && (ui.farmView === 'map' || !ui.farmView)){
    if (!scene.querySelector('.liv-pet')){
      const wrap = document.createElement('div');
      wrap.innerHTML = LIV_renderPetBadge();
      const petEl = wrap.firstElementChild;
      if (petEl) scene.appendChild(petEl);
    }
    // светлячки
    if (!scene.querySelector('.liv-fireflies')){
      const ff = document.createElement('div');
      ff.className = 'liv-fireflies';
      scene.appendChild(ff);
      LIV_spawnFireflies(ff);
    }
    // птицы (если есть животные)
    const hasAnimals = Object.values(S.buildings).some(b => b.owned);
    if (!scene.querySelector('.liv-critters')){
      const cr = document.createElement('div');
      cr.className = 'liv-critters';
      scene.appendChild(cr);
      LIV_spawnCritters(cr, hasAnimals);
    }
  }
}

/* ---------- Экраны ---------- */
function openExpeditions(){
  openDialog(`<h2>${ic('map')} Экспедиции</h2>${LIV_renderExpeditions()}`);
}
function openCollection(){
  openDialog(`<h2>${ic('star')} Коллекция</h2>${LIV_renderCollection()}`);
}

/* ---------- Расширение вкладок фермы ---------- */
function LIV_extendFarmTabs(){
  if (typeof RET_renderFarm !== 'function') return;
  // Добавляем 2 новые вкладки через переопределение
  const orig = RET_renderFarm;
  RET_renderFarm = function(){
    const view = ui.farmView || 'map';
    if (view === 'exped'){
      $('#screen').innerHTML = `<div class="farm-switch">${LIV_switchHTML('exped')}</div>
        ${LIV_renderWeek()}${LIV_renderStorm()}${LIV_renderExpeditions()}
        <div class="sec-title"><h3>${ic('star')} Коллекция</h3><small>${S.liv.cards.owned.length}/${CARD_SET.length}</small></div>
        ${LIV_renderCollection()}`;
      positionCoach();
      return;
    }
    if (view === 'cards'){
      $('#screen').innerHTML = `<div class="farm-switch">${LIV_switchHTML('cards')}</div>
        <div class="sec-title"><h3>${ic('star')} Коллекция</h3><small>${S.liv.cards.owned.length}/${CARD_SET.length}</small></div>
        ${LIV_renderCollection()}
        <div style="margin-top:12px">${LIV_renderExpeditions()}</div>`;
      positionCoach();
      return;
    }
    // добавляем шторм и ярмарку в существующие представления
    const r = orig.apply(this, arguments);
    try {
      const stormHTML = LIV_renderStorm();
      const weekHTML = LIV_renderWeek();
      if (view === 'map' && (stormHTML || weekHTML)){
        const host = document.querySelector('.daily-focus');
        if (host && !document.querySelector('.liv-storm-banner') && !document.querySelector('.liv-week')){
          host.insertAdjacentHTML('afterend', stormHTML + weekHTML);
        }
      }
    } catch(e){}
    return r;
  };
}

function LIV_switchHTML(active){
  const sw = (id, icon, label) => `<button class="${active===id?'active':''}" onclick="App.farmView('${id}')">${ic(icon)}${label}</button>`;
  return sw('map','map','Ферма') + sw('quests','target','Задания') + sw('exped','map','Походы') + sw('cards','star','Карточки') + sw('pass','medal','Пропуск') + sw('ach','medal','Награды');
}

/* ---------- Периодическое обновление (раз в минуту) ---------- */
function LIV_tickMinute(){
  if (!S || !S.liv) return;
  // смена времени суток
  const p = LIV_todPhase();
  if (window.__liv_lastPhase !== p.id){
    window.__liv_lastPhase = p.id;
    LIV_applyTOD();
    const names = { dawn:'Рассвет', day:'День', golden:'Золотой час', dusk:'Закат', night:'Ночь' };
    if (window.__liv_booted) toast(`${names[p.id]} · ${p.bonus}`, '', p.icon);
  }
  // питомец говорит
  if (Math.random() < 0.12){
    const mood = LIV_petMood();
    const lines = mood.key === 'happy' ? ['Гав!','Всё под контролем','Я слежу за полем','Хороший день!']
      : mood.key === 'ok' ? ['Покорми меня...','Скучно...']
      : ['Я голодный...','Покорми, пожалуйста'];
    LIV_petSay(pick(lines));
  }
  LIV_rollStorm();
}

/* ---------- Запуск ---------- */
function LIV_boot(){
  LIV_installHooks();
  LIV_extendFarmTabs();
  if (S){
    LIV_migrate();
    LIV_rollStorm();
    LIV_rollWeek();
    LIV_applyTOD();
  }
  setInterval(LIV_tickMinute, 60000);
  setTimeout(()=>{ window.__liv_booted = true; }, 3000);
}

/* ---------- Обёртка инициализации ---------- */
function LIV_afterState(){
  if (!S) return;
  LIV_migrate();
  LIV_rollStorm();
  LIV_rollWeek();
  LIV_applyTOD();
  // карточка-подарок при первом запуске
  if (!S.liv.cards.owned.length){
    S.liv.cards.owned.push('wheat','eggs','coin');
  }
}
