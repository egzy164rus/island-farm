/* ============================================================
   ЭКРАН «ПОКА ВАС НЕ БЫЛО» + ВСТРАИВАНИЕ ВО ВКЛАДКУ «ФЕРМА»
   ============================================================ */

/* ---------- ОФФЛАЙН-ЭКРАН ---------- */
function RET_showOfflineScreen(info){
  const elapsed = info.elapsedSec || 0;
  const coins = info.coins || 0;
  const lines = info.lines || [];
  const readyFields = info.readyFields || 0;
  const agedReady = info.agedReady || 0;

  const rows = [];
  if (readyFields) rows.push(`<div class="offline-stat gold"><b>${readyFields}</b><small>полей готово к уборке</small></div>`);
  if (agedReady) rows.push(`<div class="offline-stat gold"><b>${agedReady}</b><small>партии достигли элитного класса</small></div>`);
  if (info.animals) rows.push(`<div class="offline-stat"><b>${info.animals}</b><small>загонов накопили продукцию</small></div>`);
  if (info.prod) rows.push(`<div class="offline-stat"><b>${info.prod}</b><small>цехов завершили работу</small></div>`);
  if (coins) rows.push(`<div class="offline-stat gold"><b>+${fmt(coins)}</b><small>монет заработано автоматически</small></div>`);

  const body = `
    <div class="offline-hero">
      <div class="big">🌅</div>
      <h2 style="justify-content:center">Пока вас не было</h2>
      <div class="offline-time">${ic('clock')} ${fmtTime(elapsed)} прошло</div>
    </div>
    ${rows.length ? `<div class="offline-grid">${rows.join('')}</div>` : `<p class="muted" style="text-align:center">Ферма отдыхала вместе с вами.</p>`}
    ${lines.length ? `<div style="margin-top:8px">${lines.map(l=>`<p style="font-weight:700;font-size:11px;margin:4px 0">• ${l}</p>`).join('')}</div>` : ''}
    <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="App.closeModal(); App.tab('farm');">${ic('play')} Вернуться на ферму</button>
    ${readyFields ? `<button class="btn btn-gold btn-block btn-sm" style="margin-top:6px" onclick="App.closeModal(); App.tab('map');">${ic('wheat')} Собрать урожай · ${readyFields}</button>` : ''}
  `;
  openDialog(body);
  sfx.good();
}

/* ---------- ВКЛАДКА «ФЕРМА» — НОВАЯ ВЕРСИЯ С ПЕРЕКЛЮЧАТЕЛЕМ ---------- */
/* Заменяет старый renderFarm. Сохраняет сцену и срочные блоки, добавляет карту. */
function RET_renderFarm(){
  const view = ui.farmView || 'map';

  // --- исходные вычисления
  const owned = S.fields.filter(f=>f.owned);
  const ready = owned.filter(f=>f.state==='ready' && !f.busy);
  const growing = owned.filter(f=>f.state==='growing').length;
  const active = activeContracts().length;
  const login = S.loginReward || (S.loginReward={lastClaim:'',streak:0});
  const loginClaimed = login.lastClaim === todayStr();
  const loginStreak = loginClaimed ? (login.streak||1) : (login.lastClaim===yesterdayStr() ? (login.streak||0)+1 : 1);
  const loginDay = (loginStreak-1) % LOGIN_REWARDS.length + 1;
  const loginPrize = LOGIN_REWARDS[loginDay-1];
  const loginPrizeText = [loginPrize.coins?`+${fmt(loginPrize.coins)} монет`:null, loginPrize.gems?`+${loginPrize.gems} ${gemWord(loginPrize.gems)}`:null].filter(Boolean).join(' и ');

  const focus = ready[0] || owned.find(f=>f.state==='prepared') || owned.find(f=>f.state==='sterna') || owned.find(f=>f.state==='growing');
  let focusText='Расширь хозяйство', focusSub='Открой карту и выбери новое поле', focusIcon='map';
  if (focus){
    if (focus.state==='ready'){ focusText='Урожай созрел'; focusSub=`${focus.name} · ${CROPS[focus.crop]?.name||'культура'} ждёт уборки`; focusIcon='wheat'; }
    else if (focus.state==='growing'){ focusText='Поля растут'; focusSub=`${focus.name} · осталось ${fmtTime(Math.max(0,(focus.t1-Date.now())/1000))}`; focusIcon='clock'; }
    else if (focus.state==='prepared'){ focusText='Поле готово к посеву'; focusSub=`${focus.name} · выбери культуру`; focusIcon='seed'; }
    else { focusText='Пора в поле'; focusSub=`${focus.name} · почва ждёт обработки`; focusIcon='tractor'; }
  }
  const tutAttr = S.tutorial && !S.tutorial.done && (S.tutorial.step===0 && focus?.id==='f1' || S.tutorial.step===2 && focus?.id==='f1') ? `data-tut="${S.tutorial.step===0?'harvest':'field-f1'}"` : '';

  // --- переключатель вида
  const sw = (id, icon, label) => `<button class="${view===id?'active':''}" onclick="App.farmView('${id}')">${ic(icon)}${label}</button>`;
  const switcher = `<div class="farm-switch">
    ${sw('map','map','Ферма')}
    ${sw('quests','target','Задания')}
    ${sw('pass','medal','Пропуск')}
    ${sw('ach','star','Достижения')}
  </div>`;

  let body = '';

  if (view === 'map'){
    body = `
      <div class="daily-focus ${S.daily.goal?'is-done':''}" onclick="App.tab('tasks')">
        <span class="focus-mark">${ic(S.daily.goal?'check':'target')}</span>
        <span class="focus-copy"><b>${S.daily.goal?'Цель дня выполнена':'Заказы на сегодня'}</b><small>${S.daily.goal?'Награда получена':'3 заказа · награда 5 самоцветов'}</small>
          <span class="focus-progress"><i style="width:${Math.min(100,S.daily.contracts/3*100)}%"></i></span></span>
        <span class="focus-count">${S.daily.contracts}/3 <small>→</small></span>
      </div>
      ${RET_renderFair()}
      ${RET_renderStreak()}
      ${RET_renderFarmMap()}
      <div class="overview-actions" style="margin-top:10px">
        <button class="overview-action" onclick="App.tab('map')">${ic('seed')}<span>Мои поля</span></button>
        <button class="overview-action" onclick="App.openBunker()">${ic('box')}<span>Склад</span></button>
        <button class="overview-action" onclick="App.openPens()">${ic('cow')}<span>Загоны</span></button>
        <button class="overview-action" ${S.tutorial.step===1?'data-tut="sell"':''} onclick="App.openMarket()">${ic('coin')}<span>Рынок</span></button>
      </div>
      ${RET_renderDailyQuests()}
      <div class="login-reward ${loginClaimed?'claimed':''}">
        <button class="login-stamp" type="button" ${loginClaimed?'disabled':''} onclick="App.claimDailyReward()" aria-label="${loginClaimed?'Награда уже получена':'Забрать ежедневную награду'}">${ic(loginClaimed?'check':'gift')}</button>
        <span class="login-copy"><b>${loginClaimed?'Награда получена':`Ежедневный бонус · день ${loginDay}/7`}</b><small>${loginClaimed?`Стрик: ${S.ret.streak.count} дн.`:'Вернись завтра и получи больше'}</small>
          <span class="reward-track">${LOGIN_REWARDS.map((_,i)=>`<i class="${i<loginDay?'filled':''}"></i>`).join('')}</span>
        </span>
        <button class="login-claim" ${loginClaimed?'disabled':''} onclick="App.claimDailyReward()">${loginClaimed?'Получено':'Забрать'}</button>
      </div>`;
  } else if (view === 'quests'){
    body = `${RET_renderStreak()}${RET_renderFair()}${RET_renderDailyQuests()}`;
  } else if (view === 'pass'){
    body = RET_renderPassCard();
  } else if (view === 'ach'){
    body = RET_renderAchievements();
  }

  // --- сцена (только для карты)
  const scene = view === 'map' ? `
    <div class="farm-scene compact-scene season-${seasonInfo().id} weather-${weatherInfo().id}" role="group" aria-label="Островная ферма · ${seasonInfo().name}">
      <div class="scene-top"><span class="scene-kicker">ОСТРОВ • ${seasonInfo().name.toUpperCase()}</span>
        <button class="scene-weather" onclick="App.openForecast()">${ic(weatherInfo().icon)} ${weatherInfo().name}</button></div>
      <div class="scene-copy"><div class="scene-title">Твоя ферма</div><div class="scene-caption">Всё важное — под рукой</div></div>
      <div class="scene-count">${owned.length} / ${S.fields.length} полей</div>
    </div>` : '';

  $('#screen').innerHTML = `${scene}${switcher}${body}`;
  positionCoach();
}

/* ---------- ПРОПУСК ---------- */
function RET_renderPassCard(){
  const P = S.ret.pass;
  const lvl = RET_passLevel();
  const pct = Math.round(RET_passProgress()*100);
  const tiers = PASS_TRACKS.map(t=>{
    const reached = lvl > t.level;
    return `<div class="pass-tier ${reached?'reached':''}">
      <div class="pt-lvl">${t.level}</div>
      <div class="pt-ic">${t.free.gems?'💎':t.free.coins?'🪙':'🎁'}</div>
      <div class="pt-rw">${t.free.gems?`+${t.free.gems}💎`:`+${fmt(t.free.coins)}`}</div>
    </div>`;
  }).join('');

  return `
    <div class="sec-title"><h3>${ic('medal')} Фермерский пропуск</h3><small>Сезон 1</small></div>
    <div class="pass-card">
      <div class="pass-head">${ic('star')}<b>Уровень ${lvl}</b><small>${P.xp||0} / ${PASS_XP_PER_LEVEL} XP</small></div>
      <div class="pass-bar"><i style="width:${pct}%"></i></div>
      <div class="muted-small">Очки опыта дают любые действия: урожай, заказы, продажи, уход за животными.</div>
      <div class="pass-tiers">${tiers}</div>
    </div>
    <div style="margin-top:10px"><button class="btn btn-ghost btn-block btn-sm" onclick="App.passInfo()">${ic('info')} Как получить премиум?</button></div>
    ${RET_renderAchievements()}
  `;
}

/* ---------- ДОСТИЖЕНИЯ ---------- */
function RET_renderAchievements(){
  const R = S.ret;
  const statVal = {
    harvests: S.stats.harvests||0, earned: S.stats.earned||0, contractsDone: S.stats.contractsDone||0,
    aged: S.stats.aged||0, buildings: Object.values(S.buildings).filter(b=>b.owned).length,
    bestStreak: R.streak?.best||0,
  };
  let html = `<div class="sec-title"><h3>${ic('star')} Достижения</h3><small>${R.ach.unlocked.length} / ${ACHIEVEMENTS.length}</small></div><div class="ach-grid">`;
  for (const a of ACHIEVEMENTS){
    const done = R.ach.unlocked.includes(a.id);
    const cur = Math.min(a.need, statVal[a.stat]||0);
    html += `<div class="ach-item ${done?'done':'locked'}">
      <span class="ach-ic">${done?'🏆':'🔒'}</span>
      <div class="ach-body"><b>${a.name}</b><small>${done?'Получено':a.desc + ' · ' + cur + '/' + a.need}</small></div>
      <span class="ach-rw">${a.reward.coins?`+${fmt(a.reward.coins)}🪙`:''}${a.reward.gems?` +${a.reward.gems}💎`:''}</span>
    </div>`;
  }
  html += `</div>`;
  return html;
}
