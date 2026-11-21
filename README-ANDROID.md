# Островная ферма — сборка для Android

Игра — это один самодостаточный файл `index.html` (HTML/CSS/JS внутри). Поэтому для Android есть три пути — от самого простого к полноценному APK.

---

## Способ 1. PWA — установка без сборки (2 минуты)

Работает на любом Android-телефоне с Chrome:

1. Разместите папку `farm-game` на HTTPS-хостинге (GitHub Pages, Netlify или своём сервере) — установка PWA требует HTTPS либо localhost.
2. Откройте адрес сайта в Chrome на Android. После первой загрузки дождитесь окончания регистрации Service Worker.
3. В игре откройте ⚙ Настройки → **Установить приложение** либо выберите в меню Chrome (⋮) «Установить приложение» / «Добавить на главный экран».
4. Подтвердите установку. Игра появится на главном экране и будет запускаться в отдельном окне; оболочка иконки доступны офлайн после первой успешной загрузки.

На iPhone/iPad откройте сайт в Safari → «Поделиться» → «На экран Домой». Инсталляционная кнопка в настройках показывает эту подсказку.

> Локально для проверки: `python3 -m http.server 8000` в папке игры, затем на телефоне откройте `http://<IP-компьютера>:8000` — но установка PWA там не сработает без HTTPS.

---

## Способ 2. Capacitor — полноценный APK (рекомендуется)

Нужны: Node.js 18+, Android Studio (или только Android SDK + JDK 17).

```bash
cd farm-game
npm install
npx cap add android        # создаст папку android/
npx cap sync
npx cap open android       # откроется Android Studio
```

В Android Studio: **Build → Build App Bundle / APK** → получите `app-debug.apk` (для теста) или подписанный `.aab` (для Google Play).

Иконка приложения: положите `icon-512.png` в `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` (и остальные плотности — Android Studio умеет сгенерировать из Image Asset).

Конфиг уже готов: `capacitor.config.json` (appId `com.farm.island`, webDir — текущая папка).

---

## Способ 3. Голая WebView-обёртка (без Node)

Если не хочется ставить Capacitor — минимальный Kotlin-проект:

```kotlin
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true   // важно: localStorage для сейвов!
        web.settings.allowFileAccess = true
        web.loadUrl("file:///android_asset/index.html")
        setContentView(web)
    }
}
```

Положите `index.html` в `app/src/main/assets/`. `domStorageEnabled = true` обязателен — на нём держится автосохранение и офлайн-прогресс.

---

## Что уже внутри

- **Браузер**: игра работает в современном браузере; прогресс сохраняется в localStorage.
- **PWA/офлайн**: Service Worker кэширует оболочку и иконки; после первой загрузки игра открывается без сети. Таймеры считаются по времени устройства (до 12 часов офлайн-прогресса, как в ТЗ).
- **Сохранения**: автосейв после каждого действия + при сворачивании приложения.
- **Портрет**, тапы от 48px, нижняя зона большого пальца, safe-area — по требованиям ТЗ.
