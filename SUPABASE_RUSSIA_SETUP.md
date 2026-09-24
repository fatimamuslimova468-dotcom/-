# Доступ «Смотрю» без прямого обращения к supabase.co

В клиенте теперь используется `/supabase` по умолчанию (на localhost оставлен прямой Supabase для разработки). Это позволяет браузеру работать через прокси на том же домене.

## Для твоего домена `smotru.zapto.org`

1. Держать сайт на `https://smotru.zapto.org`.
2. Для Nginx используй `proxy/nginx.smotru.zapto.org.conf`; для Caddy — `proxy/Caddyfile.smotru.zapto.org`.
3. Прокси должен направлять `/supabase/` на `https://xzaryhtrzdjrrqgrowkv.supabase.co/`.
4. В браузере приложение уже использует same-origin `https://smotru.zapto.org/supabase` — отдельный DNS в JavaScript не нужен.
5. Для Realtime обязательно сохранить WebSocket upgrade; в Nginx это уже предусмотрено.

После этого приложение продолжает использовать тот же Supabase-проект. Менять таблицы, ключ, Auth, Storage или данные не требуется.

## Если нужен отдельный proxy-домен

Можно задать его в `index.html`:

```html
<script>
  window.SMOTRY_CONFIG = {
    SUPABASE_URL: 'https://api.example.com'
  };
</script>
```

Тогда `/supabase` использоваться не будет.

## Важно

Сам HTML не может сменить DNS пользователя или самостоятельно сделать маршрут доступным. Нужен сервер/домен, доступный пользователям, который сам может подключиться к Supabase. Supabase рекомендует reverse proxy с HTTPS и поддержкой WebSocket для production-схем.

## Проверка после настройки

Открой `https://smotru.zapto.org` без VPN и проверь вход, профиль, комментарии и загрузку видео. Для Realtime браузер должен подключаться к тому же домену по `wss://smotru.zapto.org/supabase/realtime/...`. Reverse proxy должен поддерживать WebSocket. citeturn727223search1turn727223search6
