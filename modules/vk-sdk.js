/* ============================================================
   VK MINI APPS · v85
   ------------------------------------------------------------
   Чем VK отличается от Яндекс Игр — и что из этого следует:

   1) ХРАНИЛИЩЕ МАЛЕНЬКОЕ. VK Storage — 4096 байт НА КЛЮЧ.
      Наш сейв ~9 КБ, значит один ключ не подходит.
      Решение: base64 → нарезка на куски по 3000 символов → мета-ключ.
      Base64 — чистый ASCII, поэтому границы кусков не рвут символы.

   2) ПЛАТЕЖИ ТРЕБУЮТ СЕРВЕРА. VK присылает на ваш сервер
      get_item / order_status_change. Без сервера покупок не будет.
      Клиент готов: VKWebAppShowOrderBox. Сервер — отдельный файл.

   3) ПРИЛОЖЕНИЕ ЖИВЁТ В IFRAME. Service Worker там не работает —
      PWA-кэш отключаем, иначе будут зависания.

   4) БЕЗ VK ВСЁ РАБОТАЕТ. Как и с Яндексом: нет моста — демо-магазин
      и localStorage. Ни один вызов не роняет игру.
   ============================================================ */

const VKA = {
  on: false,              // мост VK доступен
  bridge: null,
  user: null,             // {id, first_name, last_name, photo_200}
  launch: null,           // параметры запуска
  appearance: 'dark',
  paymentsReady: false,   // включены ли платежи в настройках приложения
  storageOk: false,
  lastCloudSave: 0,
  lastError: '',
};

/* --- Ключи хранилища. Короткие: каждый байт на счету. --- */
const VK_KEY_META = 'if_meta';
const VK_KEY_CHUNK = 'if_';      // if_0, if_1, ...
const VK_CHUNK_SIZE = 3000;      // символов base64; 4096 — предел платформы
const VK_SAVE_VER = 85;

const VK_skuOf = id => (typeof YA_SKU !== 'undefined' ? YA_SKU[id] : id) || id;

/* ---------- 1. ИНИЦИАЛИЗАЦИЯ ---------- */
async function VKA_init(){
  /* Внутри VK? Определяем по хосту + наличию моста.
     Для отладки: ?vk_debug=1 или localStorage.vkForce='1' */
  const inVK = /(^|\.)vk\.(com|ru)$/.test(location.hostname)
            || /(^|\.)userapi\.com$/.test(location.hostname)
            || /(^|\.)vk-apps\.com$/.test(location.hostname);
  const forced = /[?&]vk_debug=1/.test(location.search)
              || (()=>{ try { return localStorage.getItem('vkForce') === '1'; } catch(e){ return false; } })();

  const bridge = window.vkBridge || window.vkConnect;
  if ((!inVK && !forced) || !bridge) return VKA;

  try {
    VKA.bridge = bridge;

    /* VKWebAppInit — обязателен. Без него платформа не считает приложение загруженным. */
    await VKA_send('VKWebAppInit', {}, 6000);
    VKA.on = true;

    /* Параметры запуска: язык, платформа, признак «пользователь приложения» */
    try { VKA.launch = await VKA_send('VKWebAppGetLaunchParams'); } catch(e){}

    /* Тема оформления — приходит событием, а не запросом */
    try {
      bridge.subscribe(ev => {
        if (!ev || !ev.detail) return;
        if (ev.detail.type === 'VKWebAppUpdateConfig'){
          const d = ev.detail.data || {};
          VKA.appearance = d.appearance || 'dark';
          VKA_applyAppearance();
        }
        if (ev.detail.type === 'VKWebAppViewHide') save();
        if (ev.detail.type === 'VKWebAppViewRestore') { /* возврат в приложение */ }
      });
    } catch(e){}

    VKA_installAdapters();
    console.log('[VK] мост поднят');
    return VKA;
  } catch(e){
    VKA.on = false;
    VKA.lastError = String(e && e.message || e);
    console.warn('[VK] мост не поднялся:', e);
    return VKA;
  }
}

/* Отправка события в мост с таймаутом: молчащий мост не должен вешать игру */
function VKA_send(method, params, timeoutMs){
  return new Promise((resolve, reject) => {
    if (!VKA.bridge) return reject(new Error('no-bridge'));
    let done = false;
    const t = setTimeout(() => { if (!done){ done = true; reject(new Error('timeout:'+method)); } }, timeoutMs || 10000);
    VKA.bridge.send(method, params || {})
      .then(res => { if (!done){ done = true; clearTimeout(t); resolve(res); } })
      .catch(err => { if (!done){ done = true; clearTimeout(t); reject(err); } });
  });
}

function VKA_applyAppearance(){
  try {
    document.body.classList.toggle('vk-light', VKA.appearance === 'light');
    document.body.classList.toggle('vk-dark',  VKA.appearance !== 'light');
  } catch(e){}
}

/* ---------- 2. ПОЛЬЗОВАТЕЛЬ ---------- */
async function VKA_initUser(){
  if (!VKA.on) return null;
  try {
    const info = await VKA_send('VKWebAppGetUserInfo', {}, 8000);
    VKA.user = info || null;
    return VKA.user;
  } catch(e){
    VKA.user = null;
    return null;
  }
}
const VKA_userId = () => (VKA.user && VKA.user.id) || (VKA.launch && VKA.launch.vk_user_id) || 0;

/* ---------- 3. ХРАНИЛИЩЕ С НАРЕЗКОЙ ----------
   4096 байт на ключ — единственное жёсткое ограничение VK Storage.
   Кодируем сейв в base64 (ASCII) и режем на куски по 3000 символов. */

function VKA_b64encode(str){
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function VKA_b64decode(b64){
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function VKA_storageSet(key, value){
  await VKA_send('VKWebAppStorageSet', { key, value: String(value) });
}

async function VKA_cloudSave(immediate){
  if (!VKA.on || !S) return false;
  try {
    const json = JSON.stringify({ d: S, savedAt: Date.now(), v: VK_SAVE_VER });
    const b64 = VKA_b64encode(json);
    const parts = [];
    for (let i = 0; i < b64.length; i += VK_CHUNK_SIZE) parts.push(b64.slice(i, i + VK_CHUNK_SIZE));

    /* Сначала данные, потом мета: если оборвётся, мета не укажет на битые куски */
    for (let i = 0; i < parts.length; i++) await VKA_storageSet(VK_KEY_CHUNK + i, parts[i]);
    await VKA_storageSet(VK_KEY_META, JSON.stringify({ n: parts.length, v: VK_SAVE_VER, savedAt: Date.now() }));

    VKA.storageOk = true;
    VKA.lastCloudSave = Date.now();
    return true;
  } catch(e){
    VKA.lastError = String(e && e.message || e);
    console.warn('[VK] сохранение в VK Storage не прошло:', e);
    return false;
  }
}

async function VKA_cloudLoad(){
  if (!VKA.on) return null;
  try {
    const metaRes = await VKA_send('VKWebAppStorageGet', { keys: [VK_KEY_META] });
    const metaRow = (metaRes.keys || []).find(k => k.key === VK_KEY_META);
    if (!metaRow || !metaRow.value) return null;
    const meta = JSON.parse(metaRow.value);
    if (!meta || !meta.n) return null;

    const chunkKeys = [];
    for (let i = 0; i < meta.n; i++) chunkKeys.push(VK_KEY_CHUNK + i);
    const res = await VKA_send('VKWebAppStorageGet', { keys: chunkKeys });

    let b64 = '';
    for (let i = 0; i < meta.n; i++){
      const row = (res.keys || []).find(k => k.key === VK_KEY_CHUNK + i);
      if (!row || typeof row.value !== 'string') return null;  // кусок потерян — сейв битый
      b64 += row.value;
    }

    const parsed = JSON.parse(VKA_b64decode(b64));
    return (parsed && parsed.d && parsed.d.v === 1) ? parsed : null;
  } catch(e){
    console.warn('[VK] чтение из VK Storage не прошло:', e);
    return null;
  }
}

/* Конфликт «локальный против облачного» — та же логика, что в Яндексе */
function VKA_pickSave(localS, cloud){
  if (!cloud || !cloud.d) return { save: localS, source: 'local' };
  if (!localS) return { save: cloud.d, source: 'cloud' };
  const l = localS.lastSeen || 0, c = (cloud.d.lastSeen || cloud.savedAt || 0);
  return c > l ? { save: cloud.d, source: 'cloud' } : { save: localS, source: 'local' };
}

/* ---------- 4. ПЛАТЕЖИ ----------
   VKWebAppShowOrderBox открывает окно оплаты голосами.
   Настоящая выдача товара происходит ТОЛЬКО после того, как сервер
   получил order_status_change со статусом 1 и подтвердил платформе.
   Здесь — клиентская часть и честная деградация. */

async function VKA_buy(item){
  if (!item) return { ok:false, reason:'no-item' };
  if (!VKA.on) return { ok:false, reason:'no-bridge' };

  const sku = VK_skuOf(item.id);
  try {
    const res = await VKA_send('VKWebAppShowOrderBox', { type: 'item', item: sku }, 120000);
    /* Платформа ответила: окно закрыто. Успех придёт от сервера, но
       для пользователя, который только что заплатил, товар нужен сразу. */
    return { ok: true, pending: true, result: res };
  } catch(e){
    const msg = String(e && e.message || e);
    if (/cancel/i.test(msg)) return { ok:false, reason:'cancelled' };
    return { ok:false, reason:'failed', message: msg };
  }
}

/* ---------- 5. ВСТРАИВАНИЕ В МАГАЗИН ---------- */
function VKA_installAdapters(){
  /* Если до нас уже подменил Яндекс — не трогаем: один канал за раз */
  if (window.__PUR_storeBuy_dev && PUR_storeBuy !== window.__PUR_storeBuy_dev){
    console.log('[VK] магазин уже занят другим каналом');
    return;
  }
  if (!window.__PUR_storeBuy_dev) window.__PUR_storeBuy_dev = PUR_storeBuy;

  PUR_storeBuy = function(id){
    const item = PUR_ITEMS.find(x => x.id === id);
    if (!item) return;
    const oneTime = (item.kind === 'decor' || item.kind === 'perk');
    if (oneTime && PUR_owns(item.id)){ toast('Уже куплено', '', 'check'); return; }

    const dev = window.__PUR_storeBuy_dev;
    if (!VKA.on){ return dev(id); }

    const btn = document.querySelector(`[data-prem-buy="${id}"]`);
    if (btn) btn.classList.add('is-loading');

    VKA_buy(item).then(res => {
      if (btn) btn.classList.remove('is-loading');
      if (res.ok){
        /* Выдача на клиенте — сразу, чтобы игрок не ждал сервер.
           Сервер получит подтверждение и зафиксирует факт оплаты. */
        PUR_grant(item);
        VKA_cloudSave(true).catch(()=>{});
        return;
      }
      if (res.reason === 'cancelled'){ toast('Покупка отменена', '', 'info'); return; }
      toast('Оплата недоступна. Попробуй позже', 'bad', 'info');
    }).catch(() => {
      if (btn) btn.classList.remove('is-loading');
      toast('Ошибка покупки', 'bad', 'info');
    });
  };
}

/* ---------- 6. СЛУЖЕБНОЕ ---------- */
/* VK не поддерживает Service Worker в iframe — PWA-кэш там только мешает */
const VKA_inIframe = () => { try { return window.self !== window.top; } catch(e){ return true; } };

function VKA_statusText(){
  if (!VKA.on) return 'Мост VK не активен (не VK Mini App или мост не загрузился)';
  const u = VKA.user;
  return [
    'Мост VK: активен',
    `игрок: ${u ? (u.first_name + ' ' + (u.last_name || '')).trim() + ' (id ' + u.id + ')' : 'гость'}`,
    `платформа: ${(VKA.launch && VKA.launch.vk_platform) || '?'}`,
    `тема: ${VKA.appearance}`,
    `хранилище: ${VKA.storageOk ? 'синхронизировано' : 'ожидает'}`,
  ].join(' · ');
}

/* Показать табличку с данными игрока — для отладки */
async function VKA_whoAmI(){
  if (!VKA.on) return toast('Не в VK', '', 'info');
  const u = VKA.user || await VKA_initUser();
  if (!u) return toast('Профиль недоступен', '', 'info');
  toast(`${u.first_name} ${u.last_name || ''} · id ${u.id}`, 'good', 'check');
}

/* Бейдж с профилем игрока в шапке: имя и аватар.
   Появляется только внутри VK — в обычном браузере ничего не рисует. */
function VKA_showUserBadge(){
  if (!VKA.on || !VKA.user) return;
  try {
    /* renderHUD перерисовывает шапку целиком — бейдж надо вставлять заново
       после каждой перерисовки. Поэтому запоминаем данные и цепляем хук. */
    const u = VKA.user;
    VKA._badgeHTML = (u.photo_100
        ? `<img src="${u.photo_100}" alt="" width="18" height="18">`
        : '') + `<span>${(u.first_name || '').slice(0, 10)}</span>`;

    const place = () => {
      const hud = document.querySelector('.hud-meta');
      if (!hud) return;
      let badge = document.getElementById('vk-user-badge');
      if (badge && badge.parentElement === hud) {
        if (badge.innerHTML !== VKA._badgeHTML) badge.innerHTML = VKA._badgeHTML;
        return;
      }
      if (!badge){
        badge = document.createElement('button');
        badge.id = 'vk-user-badge';
        badge.className = 'vk-user-badge';
        badge.title = 'Профиль ВКонтакте';
        badge.onclick = () => VKA_whoAmI();
      }
      badge.innerHTML = VKA._badgeHTML;
      hud.insertBefore(badge, hud.firstChild);
    };

    place();

    /* Хук на renderHUD: бейдж возвращается после каждой перерисовки шапки */
    if (!VKA._hudHooked && typeof renderHUD === 'function'){
      VKA._hudHooked = true;
      const orig = renderHUD;
      renderHUD = function(){
        const r = orig.apply(this, arguments);
        try { place(); } catch(e){}
        return r;
      };
    }
  } catch(e){}
}
