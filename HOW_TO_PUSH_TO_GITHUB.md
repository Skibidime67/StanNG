# راهنمای گام‌به‌گام آپلود در گیت‌هاب (فقط از طریق وب‌سایت) | Step-by-Step GitHub Upload Guide (Website Only)

این پروژه در مجموع **۵۹ فایل** دارد — کاملاً زیر محدودیت آپلود وب‌سایت گیت‌هاب (که هر بار حدود ۱۰۰ فایل را می‌پذیرد). پس با یک یا دو بار drag & drop کل پروژه بالا می‌رود. نیازی به نصب Git یا استفاده از خط فرمان نیست.

This project has **59 files** total — comfortably under GitHub's website uploader limit (~100 files per batch). It uploads in one or two drag-and-drop passes. No Git installation or command line needed.

---

## ✅ چک‌لیست قبل از آپلود | Pre-upload Checklist

- [ ] فایل مخفی `.gitignore` را در Finder/Explorer قابل مشاهده کنید (در ویندوز: View → Hidden items، در مک: `Cmd+Shift+.`).
      Enable "show hidden files" so `.gitignore` is visible in your file manager (Windows: View → Hidden items, Mac: `Cmd+Shift+.`).
- [ ] پوشهٔ `data/` را با همان محتوایش (فقط فایل `.gitkeep`) آپلود کنید — **هرگز** فایل `db.json` را آپلود نکنید (اگر با اجرای محلی ساخته شده، حذفش کنید؛ در سرور خودش می‌سازدش).
      Upload the `data/` folder as-is (just `.gitkeep` inside) — **never** upload `db.json` if one was created locally (delete it first; the server auto-creates it fresh).
- [ ] پوشهٔ `__pycache__` (اگر با اجرای محلی ساخته شد) را حذف کنید — نیازی به آپلودش نیست.
      Delete any `__pycache__` folder (created if you ran it locally) — it's not needed.

---

## 🚀 مراحل | Steps

### ۱. ساخت ریپازیتوری خالی | Create an empty repository

1. وارد [github.com/new](https://github.com/new) شوید.
2. یک نام بگذارید (مثلاً `StanNG`).
3. **هیچ‌کدام** از گزینه‌های «Add a README file»، «Add .gitignore»، «Choose a license» را تیک نزنید — چون این پروژه از قبل همهٔ این‌ها را دارد و تیک زدنشان باعث تداخل می‌شود.
   Leave "Add a README file", "Add .gitignore", and "Choose a license" **unchecked** — this project already includes all of them, and checking these would cause a conflict.
4. روی **Create repository** کلیک کنید.

### ۲. آپلود فایل‌ها | Upload the files

1. در صفحهٔ خالی ریپازیتوری، روی لینک **uploading an existing file** کلیک کنید.
   On the empty repo page, click the **uploading an existing file** link.
2. در کامپیوترتان پوشهٔ پروژه (`StanNG/`) را باز کنید و **همهٔ آیتم‌های داخل آن** (نه خود پوشهٔ StanNG) را انتخاب کنید:
   Open the project folder (`StanNG/`) on your computer and select **everything inside it** (not the StanNG folder itself):
   - فایل‌های تکی: `main.py`, `storage.py`, `vless_engine.py`, `colo_map.py`, `requirements.txt`, `Procfile`, `railway.json`, `render.yaml`, `README.md`, `LICENSE`, `.gitignore`
   - پوشه‌ها: `templates/`, `static/`, `docs/`, `data/`
3. همه را بکشید و در ناحیهٔ آپلود گیت‌هاب رها کنید (drag & drop). گیت‌هاب ساختار پوشه‌ها را از روی مسیر محلی فایل‌ها حفظ می‌کند، پس لازم نیست پوشه‌ها را تک‌به‌تک باز کنید.
   Drag them all and drop them onto GitHub's upload area. GitHub preserves the folder structure from your local file paths, so you don't need to open each folder manually.
4. صبر کنید تا آپلود کامل شود (بسته به سرعت اینترنت، معمولاً کمتر از یک دقیقه — حجم کل پروژه حدود ۲ مگابایت است).
   Wait for the upload to finish (usually under a minute — total project size is ~2 MB).
5. پایین صفحه، در بخش «Commit changes»، یک پیام بنویسید (مثلاً `Initial commit — StanNG`) و روی **Commit changes** کلیک کنید.
   At the bottom, under "Commit changes", write a message (e.g. `Initial commit — StanNG`) and click **Commit changes**.

> ⚠️ اگر مرورگر شما اجازهٔ انتخاب هم‌زمان فایل‌ها و پوشه‌ها را نداد (بعضی مرورگرها این محدودیت را دارند)، می‌توانید در دو مرحله آپلود کنید: ابتدا فایل‌های تکی ریشه، سپس هر پوشه (`static`, `templates`, `docs`, `data`) را جداگانه با «Add file → Upload files» اضافه کنید.
> ⚠️ If your browser won't let you select files and folders together (some browsers restrict this), upload in two passes instead: first the root-level files, then each folder (`static`, `templates`, `docs`, `data`) separately via "Add file → Upload files".

### ۳. بررسی ساختار نهایی | Verify the final structure

بعد از آپلود، مطمئن شوید ساختار دقیقاً همین باشد (با کلیک روی هر پوشه در گیت‌هاب چک کنید):
After uploading, confirm the structure looks exactly like this (check by clicking into each folder on GitHub):

```
StanNG/
├── .gitignore
├── LICENSE
├── Procfile
├── README.md
├── railway.json
├── render.yaml
├── requirements.txt
├── colo_map.py
├── main.py
├── storage.py
├── vless_engine.py
├── data/
│   └── .gitkeep
├── docs/
│   └── screenshots/  (5-6 .jpg files)
├── static/
│   ├── css/, js/, fonts/, sfx/, img/  (all their files)
└── templates/
    └── (5 .html files)
```

اگر یک پوشه به‌جای اینکه محتوایش آپلود شود، به‌عنوان یک فایل تکی رفته باشد یا خالی مانده باشد، همان پوشه را دوباره جداگانه از طریق «Add file → Upload files → وارد شدن به همان مسیر» آپلود کنید.

If a folder ended up empty or wasn't nested correctly, re-upload just that folder via "Add file → Upload files" while browsing into the matching path on GitHub first.

---

## 🚂 اتصال به Railway یا Render بعد از آپلود | Connect to Railway or Render after uploading

1. وارد [railway.app](https://railway.app) یا [render.com](https://render.com) شوید.
2. **New Project / New Web Service → Deploy from GitHub repo** را انتخاب کرده و ریپازیتوری `StanNG` خودتان را پیدا کنید.
3. پلتفرم به‌صورت خودکار `railway.json` یا `render.yaml` را تشخیص داده و بدون هیچ تنظیم اضافه‌ای اجرا می‌شود.
   The platform auto-detects `railway.json` or `render.yaml` and runs with zero extra configuration.
4. بعد از اتمام دیپلوی، به آدرس سرویس + `/setup` بروید و نام‌کاربری و رمز عبور پنل را بسازید.
   Once deployed, visit `<your-domain>/setup` and create your panel's username & password.

---

## 🔄 برای آپدیت‌های بعدی | For future updates

اگر بعداً خواستید فایلی را عوض کنید، در گیت‌هاب روی همان فایل کلیک کنید → آیکون مداد (Edit) → تغییرات را بدهید → Commit changes. برای فایل‌های باینری (تصویر، فونت، صدا) باید حذف و دوباره آپلود کنید، چون گیت‌هاب امکان ویرایش مستقیم باینری در وب را نمی‌دهد.

If you later want to change a file, click it on GitHub → the pencil (Edit) icon → make changes → Commit changes. For binary files (images, fonts, sounds) you'll need to delete and re-upload since GitHub's web editor can't edit binaries directly.
