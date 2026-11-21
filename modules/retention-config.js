/* ============================================================
   ОСТРОВНАЯ ФЕРМА — МОДУЛЬ УДЕРЖАНИЯ (локальный прототип)
   ------------------------------------------------------------
   Всё лежит одним файлом, чтобы потом просто подключить.
   Точки подключения помечены: [HOOK: ...]
   ============================================================ */

/* ---------------- 1. КОНФИГИ ---------------- */

/* Ежедневные задания: пул, из которого берём 3 штуки на день */
const DAILY_QUESTS = [
  { id:'harvest', icon:'wheat',  text:'Собери {n} единиц урожая',      targets:[150,300,500], reward:{coins:[120,180,260]} },
  { id:'sell',    icon:'coin',   text:'Продай товаров на {n} монет',   targets:[600,1200,2000], reward:{coins:[100,150,220]} },
  { id:'contract',icon:'clipboard', text:'Выполни {n} заказа соседей', targets:[1,2,3], reward:{coins:[150,220,300], gems:[0,0,1]} },
  { id:'plant',   icon:'seed',   text:'Засеяй {n} полей',              targets:[1,2,4], reward:{coins:[90,140,200]} },
  { id:'collect', icon:'barn',   text:'Собери продукцию {n} раз',      targets:[2,4,6], reward:{coins:[110,170,240]} },
  { id:'produce', icon:'factory',text:'Запусти {n} цехов',             targets:[1,2,3], reward:{coins:[130,190,270]} },
  { id:'care',    icon:'heart',  text:'Позаботься о животных {n} раз', targets:[4,8,12], reward:{coins:[80,130,190]} },
  { id:'repair',  icon:'wrench', text:'Почини технику {n} раз',        targets:[1,1,2], reward:{coins:[120,120,200]} },
  { id:'age',     icon:'clock',  text:'Выдержи {n} партий на выдержке', targets:[1,1,2], reward:{coins:[200,200,340], gems:[0,1,1]} },
];

/* Стрик: награда растёт, на 7/14/30 — особые */
const STREAK_MILESTONES = {
  7:  { text:'Неделя с фермой!',      gems:5,  coins:500 },
  14: { text:'Две недели подряд!',    gems:8,  coins:900 },
  30: { text:'Месяц на острове!',     gems:20, coins:2500, skin:'gold' },
};
const STREAK_FREEZE_MAX = 2;

/* Ярмарка: событие дня, меняет экономику на 24 часа */
const FAIR_EVENTS = [
  { id:'price',  name:'Ярмарка выходного дня', icon:'coin',  desc:'Цены на урожай ×1.5',   color:'gold',  mult:{ prices:1.5 } },
  { id:'growth', name:'Тёплый фронт',          icon:'sun',   desc:'Рост культур +40%',      color:'green', mult:{ growth:1.4 } },
  { id:'order',  name:'День соседей',          icon:'heart', desc:'Оплата заказов +50%',    color:'blue',  mult:{ contracts:1.5 } },
  { id:'mutual', name:'Дождливый день',        icon:'rain',  desc:'Уход за животными не тратится', color:'blue', mult:{ freeCare:true } },
];

/* Фермерский пропуск (пока без оплаты — только прогресс и награды) */
const PASS_TRACKS = [
  { level:1,  free:{coins:200},              premium:{gems:2} },
  { level:2,  free:{coins:300},              premium:{coins:600} },
  { level:3,  free:{gems:1},                 premium:{skin:'autumn'} },
  { level:4,  free:{coins:400},              premium:{gems:3} },
  { level:5,  free:{coins:500},              premium:{coins:1200} },
  { level:6,  free:{gems:2},                 premium:{skin:'winter'} },
  { level:7,  free:{coins:700},              premium:{gems:5} },
  { level:8,  free:{coins:900},              premium:{skin:'gold'} },
];
const PASS_XP_PER_LEVEL = 100;

/* Достижения */
const ACHIEVEMENTS = [
  { id:'first_harvest', icon:'wheat',   name:'Первый урожай',      desc:'Собери 1 урожай',              need:1,    stat:'harvests',   reward:{coins:100} },
  { id:'harvest_50',    icon:'wheat',   name:'Хлебороб',           desc:'Собери 50 урожаев',            need:50,   stat:'harvests',   reward:{coins:800, gems:2} },
  { id:'earn_10k',      icon:'coin',    name:'Крепкое хозяйство',  desc:'Заработай 10 000 монет',       need:10000,stat:'earned',     reward:{coins:500} },
  { id:'earn_100k',     icon:'coin',    name:'Магнат острова',     desc:'Заработай 100 000 монет',      need:100000,stat:'earned',    reward:{coins:3000, gems:5} },
  { id:'contracts_10',  icon:'clipboard',name:'Надёжный сосед',    desc:'Выполни 10 заказов',           need:10,   stat:'contractsDone', reward:{coins:600} },
  { id:'contracts_50',  icon:'clipboard',name:'Душа деревни',      desc:'Выполни 50 заказов',           need:50,   stat:'contractsDone', reward:{coins:2500, gems:4} },
  { id:'age_1',         icon:'clock',   name:'Терпение',           desc:'Выдержи первую партию',        need:1,    stat:'aged',       reward:{coins:300} },
  { id:'age_25',        icon:'clock',   name:'Мастер выдержки',    desc:'Выдержи 25 партий',            need:25,   stat:'aged',       reward:{coins:1500, gems:3} },
  { id:'animals_6',     icon:'cow',     name:'Полный двор',        desc:'Построй все загоны',           need:6,    stat:'buildings',  reward:{coins:1200, gems:2} },
  { id:'streak_7',      icon:'gift',    name:'Неделя подряд',      desc:'Зайди 7 дней подряд',          need:7,    stat:'bestStreak', reward:{coins:800, gems:3} },
];

/* Последствия «просрочки» — мягкие, не карательные */
const CARE_DECAY = { softAfterMs: 6*3600*1000, penalty: 0.6 }; // через 6 ч простоя загон даёт 60%
const CONTRACT_EXPIRE_MS = 48*3600*1000;                        // заказ висит 48 ч, потом сгорает
