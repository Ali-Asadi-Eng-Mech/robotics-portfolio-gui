# راهنمای انتشار داشبورد پورتفولیوی رباتیک

این پوشه آماده انتشار روی Netlify، GitHub Pages و Vercel است. فایل `index.html` باید در ریشه پوشه بماند و همراه با فایل‌های `styles.css`، `app.js`، `data.js`، `manifest.webmanifest`، `sw.js` و `favicon.svg` منتشر شود.

## سریع‌ترین روش: Netlify Drop

1. فایل ZIP را Extract کنید.
2. وارد Netlify شوید.
3. پوشه `robotics-portfolio-gui-deploy-ready` را Drag & Drop کنید.
4. بعد از چند ثانیه یک لینک مثل `...netlify.app` دریافت می‌کنید.
5. همان لینک را برای مخاطب ارسال کنید.

## روش GitHub Pages

1. یک Repository جدید در GitHub بسازید.
2. تمام فایل‌های داخل پوشه `robotics-portfolio-gui-deploy-ready` را در ریشه Repository آپلود کنید؛ نه خود پوشه را.
3. به Settings > Pages بروید.
4. Source را روی Deploy from a branch بگذارید.
5. Branch را `main` و Folder را `/root` انتخاب کنید.
6. چند دقیقه صبر کنید تا لینک Pages فعال شود.

## روش Vercel

1. یک Repository GitHub از همین فایل‌ها بسازید یا پوشه را با Vercel CLI منتشر کنید.
2. در Vercel گزینه Add New Project را بزنید و Repository را انتخاب کنید.
3. Build Command را خالی بگذارید.
4. Output Directory یا Publish Directory را `.` بگذارید.
5. Deploy را بزنید.

## نکته مهم درباره ذخیره اطلاعات

این نسخه دیتابیس ندارد. تغییر وضعیت‌ها، چک‌لیست‌ها و یادداشت‌ها در مرورگر هر فرد ذخیره می‌شود. یعنی اگر چند نفر لینک را باز کنند، تغییرات یکدیگر را نمی‌بینند. برای کار تیمی واقعی باید نسخه بعدی به دیتابیس متصل شود.
