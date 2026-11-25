/* ============================================================
   СЕРВЕР ПЛАТЕЖЕЙ VK · v85
   ------------------------------------------------------------
   ЗАЧЕМ ОН НУЖЕН.
   В VK нельзя просто «выдать товар после нажатия кнопки».
   Схема платформы такая:

     1. Игрок жмёт «купить» → клиент открывает VKWebAppShowOrderBox
     2. VK присылает НА СЕРВЕР  get_item   → сервер отвечает ценой
     3. Игрок платит голосами
     4. VK присылает НА СЕРВЕР  order_status_change (status=1)
     5. Сервер фиксирует покупку и отвечает «ок»

   Без шага 2 покупка не начнётся вообще.
   Без шага 4 оплата пройдёт, но вы не узнаете, что нужно выдать товар.

   ЗАПУСК
     node server/vk-payments.js
   ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ
     VK_APP_SECRET   — секретный ключ приложения (Настройки → Приложение)
     VK_APP_ID       — id приложения
     PORT            — порт (по умолчанию 8080)
   ПУБЛИЧНЫЙ АДРЕС
     В настройках приложения указать: https://ваш-домен/vk/payments
     Требуется HTTPS и доступный из интернета сервер (не GitHub Pages).
   ============================================================ */

'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const APP_SECRET = process.env.VK_APP_SECRET || '';
const APP_ID = process.env.VK_APP_ID || '';
const PORT = Number(process.env.PORT || 8080);

/* ---------- КАТАЛОГ ----------
   Цены — в ГОЛОСАХ VK (1 голос ≈ 7 ₽ у пользователя).
   Должно совпадать с PUR_ITEMS в игре. */
const ITEMS = {
  gems_250:   { title: '250 самоцветов',   price: 15  },
  gems_700:   { title: '700 самоцветов',   price: 35  },
  gems_1600:  { title: '1600 самоцветов',  price: 70  },
  gems_4000:  { title: '4000 самоцветов',  price: 150 },
  vip_7:      { title: 'VIP на неделю',    price: 28  },
  vip_30:     { title: 'VIP на месяц',     price: 85  },
  vip_365:    { title: 'VIP на год',       price: 570 },
  pack_boost_x5:  { title: 'x5 Ускорение ×5',   price: 21 },
  pack_fert_x20:  { title: 'Удобрение ×20',     price: 18 },
  pack_repair_x3: { title: 'Ремкомплект ×3',    price: 25 },
  pack_energy_x5: { title: 'Энергетик ×5',      price: 17 },
  decor_golden_field: { title: 'Золотые поля',  price: 49 },
  decor_aurora:       { title: 'Северное сияние', price: 42 },
  perk_no_ads:        { title: 'Без рекламы навсегда', price: 42 },
};

/* ВЫДАЧА ТОВАРА.
   Здесь должна быть ваша бизнес-логика: записать покупку в базу,
   начислить самоцветы, продлить VIP. Ниже — минимальный пример
   с записью в JSON-файл, чтобы было видно, где это делать. */
const DB_PATH = path.join(__dirname, 'purchases.json');
function loadDB(){
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch(e){ return {}; }
}
function saveDB(db){
  try { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); } catch(e){ console.error('[db]', e.message); }
}

function deliver(userId, itemId, orderId){
  const db = loadDB();
  if (!db[userId]) db[userId] = { owned: [], orders: [], purchasedAt: {} };

  /* Защита от двойной выдачи одного заказа */
  if (db[userId].orders.includes(orderId)){
    console.log(`[deliver] заказ ${orderId} уже выдан, пропускаем`);
    return true;
  }

  if (!ITEMS[itemId]) {
    console.warn(`[deliver] неизвестный товар ${itemId}`);
    return false;
  }

  db[userId].owned.push(itemId);
  db[userId].orders.push(orderId);
  db[userId].purchasedAt[itemId] = Date.now();
  saveDB(db);

  console.log(`[deliver] пользователь ${userId} получил ${ITEMS[itemId].title} (заказ ${orderId})`);
  /* ЗДЕСЬ: начислить товар в вашей базе игры. */
  return true;
}

/* ---------- ПОДПИСЬ ----------
   VK подписывает каждый запрос параметром sign = md5(отсортированные
   пары «ключ=значение» + секрет приложения).
   Без проверки подписи любой может прислать «я купил всё». */
function verifySign(params){
  const { sign, ...rest } = params;
  if (!sign) return false;
  const sorted = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`).join('');
  const hash = crypto.createHash('md5').update(sorted + APP_SECRET).digest('hex');
  return hash === sign;
}

/* ---------- ОБРАБОТЧИК ---------- */
function handlePayment(params){
  if (!verifySign(params)){
    console.error('[payments] подпись неверна — запрос отклонён');
    return { error: { error_code: 10, error_msg: 'invalid sign', critical: true } };
  }

  const { notification_type, user_id, item, order_id, status, app_id } = params;

  if (APP_ID && String(app_id) !== String(APP_ID)){
    return { error: { error_code: 4, error_msg: 'wrong app', critical: true } };
  }

  /* Шаг 2: пользователь открыл окно оплаты — отдаём цену */
  if (notification_type === 'get_item'){
    const it = ITEMS[item];
    if (!it) return { error: { error_code: 20, error_msg: 'unknown item', critical: true } };
    return { response: { title: it.title, price: it.price } };
  }

  /* Шаг 3: заказ создан, деньги ещё не списаны */
  if (notification_type === 'order_status_change'){
    /* status: 1 — оплачено, 0 — отменено */
    if (String(status) === '1'){
      const ok = deliver(String(user_id), item, String(order_id));
      if (!ok) return { error: { error_code: 20, error_msg: 'deliver failed' } };
      return { response: { order_id: order_id, app_order_id: order_id } };
    }
    console.log(`[payments] заказ ${order_id} отменён (status=${status})`);
    return { response: { order_id: order_id, app_order_id: order_id } };
  }

  return { response: {} };
}

/* ---------- HTTP ---------- */
const server = http.createServer((req, res) => {
  if (req.method !== 'POST'){
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('VK payments endpoint is alive');
  }

  let body = '';
  req.on('data', ch => { body += ch; if (body.length > 1e6) req.destroy(); });
  req.on('end', () => {
    let params = {};
    try { params = Object.fromEntries(new URLSearchParams(body)); }
    catch(e){ console.error('[http] не разобрал тело'); }

    console.log('[payments]', params.notification_type || '?', 'item=' + (params.item || '-'), 'user=' + (params.user_id || '-'));

    let out;
    try { out = handlePayment(params); }
    catch(e){ console.error('[payments] исключение:', e); out = { error: { error_code: 1, error_msg: 'internal', critical: true } }; }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
  });
});

if (require.main === module){
  if (!APP_SECRET){
    console.error('!!! VK_APP_SECRET не задан — подпись проверить нечем. Запуск остановлен.');
    process.exit(1);
  }
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер платежей VK слушает порт ${PORT}`);
    console.log(`Укажите в настройках приложения: https://<домен>/vk/payments`);
    console.log(`Товаров в каталоге: ${Object.keys(ITEMS).length}`);
  });
}

module.exports = { server, handlePayment, verifySign, ITEMS, deliver };
