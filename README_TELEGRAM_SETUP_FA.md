# راه‌اندازی رایگان ربات تلگرام برای داشبورد پورتفولیوی رباتیک

این نسخه سایت، توکن تلگرام را داخل فایل‌های GitHub Pages قرار نمی‌دهد. سایت فقط به یک Cloudflare Worker درخواست می‌فرستد و Worker پیام را به Telegram Bot API ارسال می‌کند.

## متغیرهای لازم در Cloudflare Worker

- `TELEGRAM_BOT_TOKEN` — Secret — توکن دریافتی از BotFather
- `APP_SHARED_SECRET` — Secret — یک رمز داخلی برای محدودکردن درخواست‌ها
- `ALLOWED_CHAT_IDS` — Variable — Chat IDهای مجاز، جداشده با ویرگول
- `ALLOWED_ORIGINS` — Variable — Origin سایت، مثلا `https://ali-asadi-eng-mech.github.io`

## اتصال داخل اپ

در تب «ویرایش و ذخیره»، بخش «اتصال تلگرام» را پر کنید:

- آدرس Cloudflare Worker
- کلید اعلان سایت، همان مقدار `APP_SHARED_SECRET`
- Chat IDهای پیش‌فرض
- لینک عمومی اپ

برای هر کارت نیز می‌توان Chat ID اختصاصی و یادداشت اختصاصی پیام تلگرام تعریف کرد.
