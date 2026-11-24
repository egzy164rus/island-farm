/* ============================================================
   YANDEX GAMES SDK · v84
   ------------------------------------------------------------
   Один модуль закрывает три вещи, которых у игры не было:
     1) АККАУНТ   — Яндекс ID, игрок перестаёт быть «этим браузером»;
     2) ОБЛАКО    — сейв в player.setData (наш сейв 9 КБ при лимите 200 КБ);
     3) ПЛАТЕЖИ   — реальные покупки через Яндекс Pay.

   ГЛАВНОЕ ПРАВИЛО: игра работает и БЕЗ Яндекса.
   Если SDK не загрузился (локальный запуск, GitHub Pages, офлайн,
   модерация) — YA.on=false, всё идёт по старому пути через localStorage,
   а магазин остаётся демо. Ни один вызов не должен ронять игру.
   ============================================================ */

const YA = {
  on: false,          // SDK поднялся и мы внутри Яндекс Игр
  ysdk: null,
  player: null,       // только если игрок авторизован
  payments: null,     // только если магазин доступен
  catalog: null,      // товары из консоли разработчика
  lang: 'ru',
  device: 'desktop',
  canReview: false,
  catalogError: '',
};

/* Соответствие наших товаров товарам в консоли Яндекса.
   id справа — это ровно то, что вводится в Developer Console → Покупки. */
const YA_SKU = {
  gems_s:     'gems_250',
  gems_m:     'gems_700',
  gems_l:     'gems_1600',
  gems_xl:    'gems_4000',
  vip_week:   'vip_7',
  vip_month:  'vip_30',
  vip_year:   'vip_365',
  pack_boost: 'pack_boost_x5',
  pack_fert:  'pack_fert_x20',
  pack_repair:'pack_repair_x3',
  pack_energy:'pack_energy_x5',
  decor_gold: 'decor_golden_field',
  decor_sky:  'decor_aurora',
  perk_noads: 'perk_no_ads',
};
const YA_skuOf = id => YA_SKU[id] || id;
const YA_itemBySku = sku => PUR_ITEMS.find(it => YA_skuOf(it.id) === sku) || null;

/* Товары, которые можно купить много раз. Всё остальное — навсегда. */
const YA_consumable = it => !!it && (it.kind === 'gems' || it.kind === 'pack' || it.kind === 'sub');

/* ---------- 1. ИНИЦИАЛИЗАЦИЯ ---------- */
async function YA_init(){
  /* Мы внутри Яндекс Игр?
     По умолчанию — только на домене Яндекса. Для локальной отладки
     можно включить принудительно: ?ya_debug=1 или localStorage.yаForce=1
     (так же удобно тестировать мок-SDK). */
  const hosted = /(^|\.)yandex\.(ru|com|kz|by|uz)$/.test(location.hostname)
              || /yandex\.net$/.test(location.hostname);
  const forced = /[?&]ya_debug=1/.test(location.search)
              || (()=>{ try{ return localStorage.getItem('yaForce') === '1'; }catch(e){ return false; } })();
  if ((!hosted && !forced) || typeof window.YaGames === 'undefined') return YA;

  try {
    /* Короткий таймаут: если платформа молчит — не задерживаем запуск игры */
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
    const ysdk = await Promise.race([window.YaGames.init(), timeout]);
    YA.ysdk = ysdk;
    YA.on = true;

    try { YA.lang = (ysdk.environment.i18n.lang || 'ru').toLowerCase(); } catch(e){}
    try { YA.device = ysdk.deviceInfo.type || 'desktop'; } catch(e){}

    /* Пауза и возврат: платформа сворачивает игру — надо замолчать и сохраниться */
    try {
      ysdk.on('game_api_pause',  () => YA_pause(true));
      ysdk.on('game_api_resume', () => YA_pause(false));
    } catch(e){}

    YA_installAdapters();
    console.log('[YA] SDK готов, устройство:', YA.device);
    return YA;
  } catch(e){
    YA.on = false; YA.catalogError = String(e && e.message || e);
    console.warn('[YA] SDK не поднялся:', e);
    return YA;
  }
}

function YA_pause(paused){
  try {
    if (paused){
      save();
      YA_cloudSave(true);
      if (typeof AUD_mute === 'function') AUD_mute(true);
    } else {
      if (typeof AUD_mute === 'function') AUD_mute(false);
    }
  } catch(e){}
}

/* После инициализации SDK вызываем это — платформа уберёт свой сплэш */
function YA_gameReady(){
  try { YA.ysdk && YA.ysdk.features && YA.ysdk.features.LoadingAPI && YA.ysdk.features.LoadingAPI.ready(); } catch(e){}
}
function YA_gameplayStart(){
  try { YA.ysdk && YA.ysdk.features && YA.ysdk.features.GameplayAPI && YA.ysdk.features.GameplayAPI.start(); } catch(e){}
}
function YA_gameplayStop(){
  try { YA.ysdk && YA.ysdk.features && YA.ysdk.features.GameplayAPI && YA.ysdk.features.GameplayAPI.stop(); } catch(e){}
}

/* ---------- 2. АККАУНТ И ОБЛАЧНЫЙ СЕЙВ ---------- */
async function YA_initPlayer(){
  if (!YA.on) return null;
  try {
    const player = await YA.ysdk.getPlayer();
    YA.player = player;
    return player;
  } catch(e){ YA.player = null; return null; }
}
const YA_authorized = () => !!(YA.player && YA.player.isAuthorized && YA.player.isAuthorized());

/* Ключ облачного профиля. Один ключ, в нём весь сейв — так проще мигрировать. */
const YA_CLOUD_KEY = 'islandFarm';

async function YA_cloudSave(immediate){
  if (!YA.on || !YA_authorized() || !S) return false;
  try {
    const payload = { d: S, savedAt: Date.now(), v: 84 };
    /* flush:true — отправляем сразу (умеет только при явном требовании) */
    await YA.player.setData({ [YA_CLOUD_KEY]: JSON.stringify(payload) }, immediate !== false);
    YA.lastCloudSave = Date.now();
    return true;
  } catch(e){
    console.warn('[YA] облачное сохранение не прошло:', e);
    return false;
  }
}

async function YA_cloudLoad(){
  if (!YA.on || !YA_authorized()) return null;
  try {
    const data = await YA.player.getData([YA_CLOUD_KEY]);
    const raw = data && data[YA_CLOUD_KEY];
    if (!raw) return null;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return (parsed && parsed.d && parsed.d.v === 1) ? parsed : null;
  } catch(e){
    console.warn('[YA] облако не прочиталось:', e);
    return null;
  }
}

/* Разрешение конфликта «локальный сейв против облачного».
   Берём тот, что новее по lastSeen. Слияния нет — это осознанно:
   половинчатый сейв хуже, чем немного потерять. */
function YA_pickSave(localS, cloud){
  if (!cloud || !cloud.d) return { save: localS, source: 'local' };
  if (!localS) return { save: cloud.d, source: 'cloud' };
  const l = localS.lastSeen || 0, c = (cloud.d.lastSeen || cloud.savedAt || 0);
  return c > l ? { save: cloud.d, source: 'cloud' } : { save: localS, source: 'local' };
}

/* ---------- 3. ПЛАТЕЖИ ---------- */
async function YA_initPayments(){
  if (!YA.on) return null;
  try {
    /* Ленивая инициализация: первый вызов purchase() может быть медленным */
    const payments = await YA.ysdk.getPayments();
    YA.payments = payments;
    try { YA.catalog = await payments.getCatalog(); } catch(e){ YA.catalog = null; }
    return payments;
  } catch(e){
    YA.payments = null;
    YA.catalogError = String(e && e.message || e);
    console.warn('[YA] покупки недоступны:', e);
    return null;
  }
}

/* Цена из консоли Яндекса в человеческом виде. Если каталога нет — берём нашу. */
function YA_priceOf(item){
  const fromCatalog = (YA.catalog || []).find(p => (p.id || p.productID) === YA_skuOf(item.id));
  if (fromCatalog){
    if (fromCatalog.price) return fromCatalog.price;           // уже строка «99 ₽»
    if (typeof fromCatalog.priceValue === 'string') return fromCatalog.priceValue;
  }
  return `${fmt(item.price)} ₽`;
}

/* Сама покупка. Возвращает {ok, ...}. Никогда не бросает наружу. */
async function YA_buy(item){
  if (!item) return { ok:false, reason:'no-item' };
  if (!YA.payments){
    const p = await YA_initPayments();
    if (!p) return { ok:false, reason:'payments-unavailable', message:YA.catalogError };
  }
  const sku = YA_skuOf(item.id);
  let purchase;
  try {
    purchase = await YA.payments.purchase({ id: sku });
  } catch(e){
    /* Игрок закрыл окно, нет денег, не авторизован — это НЕ ошибка игры */
    return { ok:false, reason:'cancelled', message:String(e && e.message || e) };
  }
  return YA_deliver(item, purchase);
}

/* Выдача товара. Порядок важен: сначала сохраняем, потом гасим покупку. */
async function YA_deliver(item, purchase){
  const token = purchase && (purchase.purchaseToken || (purchase.purchaseData && purchase.purchaseData.purchaseToken));

  if (typeof S === 'undefined' || !S) return { ok:false, reason:'no-save' };
  /* Защита от двойной выдачи одного и того же токена */
  PUR_init();
  if (token){
    if (!S.pur.yaTokens) S.pur.yaTokens = [];
    if (S.pur.yaTokens.includes(token)){
      console.log('[YA] токен уже выдан ранее, пропускаем');
      return { ok:true, duplicate:true };
    }
  }

  PUR_grant(item);

  if (token){
    S.pur.yaTokens.push(token);
    try { await YA_cloudSave(true); } catch(e){}
    /* Гасим только после того, как награда точно записана */
    if (YA_consumable(item)){
      try { await YA.payments.consumePurchase(token); }
      catch(e){ console.warn('[YA] consume не прошёл, повторим при старте:', e); }
    }
  }
  save(); renderAll();
  return { ok:true };
}

/* ---------- 4. НЕЗАКРЫТЫЕ ПОКУПКИ ----------
   Игрок заплатил, но связь оборвалась и награда не дошла.
   Яндекс хранит такие покупки — выдаём их при каждом запуске. */
async function YA_deliverPending(){
  if (!YA.on) return 0;
  /* Сейва ещё нет (игрок на экране старта) — отложим до первого входа в игру.
     Иначе PUR_grant упадёт на S === null. */
  if (typeof S === 'undefined' || !S) { YA.pendingDeferred = true; return 0; }
  if (!YA.payments){ const p = await YA_initPayments(); if (!p) return 0; }
  let list = [];
  try { list = await YA.payments.getPurchases(); } catch(e){ return 0; }
  let delivered = 0;
  for (const p of (list || [])){
    const sku = p.productID || (p.purchaseData && p.purchaseData.productID);
    const item = YA_itemBySku(sku);
    if (!item) continue;
    const res = await YA_deliver(item, p);
    if (res && res.ok && !res.duplicate) delivered++;
  }
  if (delivered) toast(`Восстановлено покупок: ${delivered}`, 'good', 'gift');
  return delivered;
}

/* ---------- 5. АДАПТЕР МАГАЗИНА ----------
   Магазин в игре теперь спрашивает канал, а не выдаёт товар сам. */
function YA_installAdapters(){
  /* Подменяем заглушку PUR_storeBuy на реальный канал, когда он есть */
  window.__PUR_storeBuy_dev = PUR_storeBuy;
  PUR_storeBuy = function(id){
    const item = PUR_ITEMS.find(x => x.id === id);
    if (!item) return;
    const oneTime = (item.kind === 'decor' || item.kind === 'perk');
    if (oneTime && PUR_owns(item.id)){ toast('Уже куплено', '', 'check'); return; }

    if (!YA.on){
      /* Яндекс Игр нет — ведём себя как раньше (демо) */
      return window.__PUR_storeBuy_dev(id);
    }

    const btn = document.querySelector(`[data-prem-buy="${id}"]`);
    if (btn) btn.classList.add('is-loading');

    YA_buy(item).then(res => {
      if (btn) btn.classList.remove('is-loading');
      if (res.ok){
        if (res.duplicate) toast('Эта покупка уже учтена', '', 'check');
        return;
      }
      if (res.reason === 'cancelled'){ toast('Покупка отменена', '', 'info'); return; }
      toast('Магазин недоступен. Попробуй позже', 'bad', 'info');
    }).catch(e => {
      if (btn) btn.classList.remove('is-loading');
      toast('Ошибка покупки', 'bad', 'info');
    });
  };
}

/* ---------- 6. ОТЗЫВ ---------- */
async function YA_maybeAskReview(){
  if (!YA.on) return false;
  try {
    const fb = YA.ysdk.feedback;
    if (!fb) return false;
    const can = await fb.canReview();
    if (!can || !can.value) return false;
    await fb.requestReview();
    return true;
  } catch(e){ return false; }
}

/* ---------- 7. ОТЛАДОЧНАЯ ПАНЕЛЬ ----------
   Полезна при загрузке в консоль: сразу видно, что поднялось, а что нет. */
function YA_statusText(){
  if (!YA.on) return 'SDK не активен (не Яндекс Игры или SDK не загрузился)';
  return [
    'SDK: активен',
    `игрок: ${YA_authorized() ? 'авторизован' : 'гость'}`,
    `платежи: ${YA.payments ? 'готовы' : (YA.catalogError || 'нет')}`,
    `язык: ${YA.lang}`,
  ].join(' · ');
}

/* Вызывается, когда сейв точно существует (новый старт или загрузка).
   Догоняет покупки, отложенные на экране старта. */
async function YA_flushPending(){
  if (!YA.on) return 0;
  if (typeof S === 'undefined' || !S) return 0;
  return YA_deliverPending();
}
