// ============================================
// نقطة الدخول الرئيسية للتطبيق
// بوت تلجرام كلية الصماد للقرآن الكريم
// ============================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { Telegram, TgUpdate } from './utils/telegram';
import { handleUpdate } from './handlers/webhook';
import { getSetting, setSetting } from './utils/db';
import {
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  deleteSession,
  cleanupSessions,
} from './utils/auth';
import { loginPageHtml } from './admin/login';
import { dashboardHtml } from './admin/dashboard';
import adminApi from './admin/api';

type Env = {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  PANEL_SALT?: string;
};

const app = new Hono<{ Bindings: Env }>();

// CORS للـ API
app.use('/admin/api/*', cors());

// ============================================
// 1) الصفحة الرئيسية
// ============================================
app.get('/', async (c) => {
  // الحصول على معرف البوت لإنشاء روابط مباشرة (deep links)
  let botUsername = '';
  try {
    botUsername = (await getSetting(c.env.DB, 'bot_username')) || '';
  } catch (_) {}
  const baseLink = botUsername ? `https://t.me/${botUsername}` : 'https://t.me/';
  // روابط Deep Link لكل خدمة
  const linkStart       = baseLink;
  const linkCurriculum  = botUsername ? `${baseLink}?start=curriculum` : baseLink;
  const linkQuestion    = botUsername ? `${baseLink}?start=req_question` : baseLink;
  const linkRequest     = botUsername ? `${baseLink}?start=req_request` : baseLink;
  const linkContact     = botUsername ? `${baseLink}?start=contact` : baseLink;
  const linkAbout       = botUsername ? `${baseLink}?start=about` : baseLink;
  const linkGrades      = botUsername ? `${baseLink}?start=grades` : baseLink;

  return c.html(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#064e3b">
<title>بوت كلية الصماد للقرآن الكريم</title>
<link rel="icon" type="image/svg+xml" href="/static/icon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/static/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/static/favicon-16.png">
<link rel="apple-touch-icon" href="/static/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="بوت كلية الصماد">
<meta name="mobile-web-app-capable" content="yes">
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Tajawal', sans-serif; -webkit-tap-highlight-color: transparent; }
  .gradient-bg {
    background:
      radial-gradient(ellipse at top, rgba(16,185,129,0.35), transparent 60%),
      radial-gradient(ellipse at bottom, rgba(6,78,59,0.6), transparent 50%),
      linear-gradient(135deg, #022c22 0%, #064e3b 40%, #065f46 70%, #047857 100%);
    min-height: 100vh;
  }
  .glass { background: rgba(255,255,255,0.08); backdrop-filter: blur(18px) saturate(140%); -webkit-backdrop-filter: blur(18px) saturate(140%); border: 1px solid rgba(255,255,255,0.16); }
  .glass-strong { background: rgba(255,255,255,0.13); backdrop-filter: blur(22px) saturate(150%); -webkit-backdrop-filter: blur(22px) saturate(150%); border: 1px solid rgba(255,255,255,0.22); }
  .card-svc { transition: transform .35s cubic-bezier(.2,.7,.2,1), box-shadow .35s, background .3s; }
  .card-svc:hover { transform: translateY(-6px) scale(1.01); box-shadow: 0 25px 60px -15px rgba(0,0,0,0.45); }
  .card-svc:active { transform: scale(0.98); }
  .pulse-ring { animation: pulse-ring 2.4s infinite; }
  @keyframes pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.45); }
    70% { box-shadow: 0 0 0 22px rgba(16, 185, 129, 0); }
    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
  }
  .float-anim { animation: float 6s ease-in-out infinite; }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  .shine {
    position: relative; overflow: hidden;
  }
  .shine::after {
    content: ''; position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
    transform: skewX(-20deg);
  }
  .shine:hover::after { animation: shine-anim 1.1s; }
  @keyframes shine-anim { 0% { left: -100%; } 100% { left: 200%; } }
  /* تحسينات الجوّال */
  @media (max-width: 640px) {
    .hero-icon { width: 84px; height: 84px; }
    .hero-icon i { font-size: 2.6rem; }
  }
  /* تحسين منع الانفلات في الشاشات الصغيرة */
  html, body { overflow-x: hidden; }
</style>
</head>
<body class="gradient-bg text-white">

<header class="container mx-auto px-4 py-4 md:py-5">
  <nav class="flex justify-between items-center">
    <div class="flex items-center gap-2 md:gap-3">
      <div class="bg-emerald-500/20 p-2 rounded-xl border border-emerald-400/30">
        <i class="fas fa-mosque text-xl md:text-2xl text-emerald-200"></i>
      </div>
      <div>
        <h1 class="text-sm md:text-lg font-bold leading-tight">بوت كلية الصماد</h1>
        <p class="text-[10px] md:text-xs text-emerald-200/80 leading-tight">للقرآن الكريم وعلومه</p>
      </div>
    </div>
    <a href="/admin" class="glass hover:bg-white/20 px-3 md:px-5 py-2 rounded-xl transition text-xs md:text-sm font-semibold flex items-center gap-2">
      <i class="fas fa-lock"></i>
      <span class="hidden sm:inline">لوحة التحكم</span>
      <span class="sm:hidden">الإدارة</span>
    </a>
  </nav>
</header>

<main class="container mx-auto px-4 pb-10">
  <!-- Hero -->
  <section class="text-center pt-6 md:pt-10 pb-8 md:pb-12">
    <div class="inline-block p-5 md:p-7 bg-white/10 rounded-full backdrop-blur mb-5 pulse-ring float-anim hero-icon">
      <i class="fas fa-mosque text-5xl md:text-6xl text-emerald-100"></i>
    </div>
    <h1 class="text-2xl sm:text-3xl md:text-5xl font-black mb-3 leading-tight">
      كلية الصماد للقرآن الكريم
    </h1>
    <p class="text-sm sm:text-base md:text-xl text-emerald-100 mb-2 max-w-2xl mx-auto px-2">
      منظومة متكاملة لخدمة طلاب الكلية على تلجرام
    </p>
    <p class="text-emerald-200/70 text-xs sm:text-sm md:text-base px-2">
      اختر الخدمة التي تريدها لتنتقل إلى البوت مباشرة
    </p>
  </section>

  <!-- Services Grid - خدمات البوت -->
  <section class="max-w-6xl mx-auto">
    <div class="flex items-center justify-between mb-4 md:mb-6 px-1">
      <div class="flex items-center gap-2">
        <div class="w-1 h-6 bg-emerald-400 rounded"></div>
        <h2 class="text-lg md:text-2xl font-bold">خدمات البوت</h2>
      </div>
      <span class="text-xs md:text-sm text-emerald-200/70">اضغط للانتقال إلى تلجرام</span>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8 md:mb-10">
      <!-- المناهج الدراسية -->
      <a href="${linkCurriculum}" target="_blank" rel="noopener"
         class="card-svc shine glass-strong rounded-2xl p-4 md:p-6 text-center block group">
        <div class="bg-gradient-to-br from-emerald-400 to-emerald-600 w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-3 mx-auto shadow-lg shadow-emerald-500/30">
          <i class="fas fa-book-open text-2xl md:text-3xl text-white"></i>
        </div>
        <h3 class="font-bold text-sm md:text-lg mb-1">المناهج الدراسية</h3>
        <p class="text-emerald-100/80 text-[10px] md:text-xs leading-relaxed">جميع المستويات من الأول حتى الرابع</p>
      </a>

      <!-- استعلام عن الدرجات -->
      <a href="${linkGrades}" target="_blank" rel="noopener"
         class="card-svc shine glass-strong rounded-2xl p-4 md:p-6 text-center block group">
        <div class="bg-gradient-to-br from-purple-400 to-purple-600 w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-3 mx-auto shadow-lg shadow-purple-500/30">
          <i class="fas fa-chart-line text-2xl md:text-3xl text-white"></i>
        </div>
        <h3 class="font-bold text-sm md:text-lg mb-1">الاستعلام عن الدرجات</h3>
        <p class="text-emerald-100/80 text-[10px] md:text-xs leading-relaxed">عن طريق الرقم الأكاديمي</p>
      </a>

      <!-- تقديم سؤال -->
      <a href="${linkQuestion}" target="_blank" rel="noopener"
         class="card-svc shine glass-strong rounded-2xl p-4 md:p-6 text-center block group">
        <div class="bg-gradient-to-br from-sky-400 to-sky-600 w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-3 mx-auto shadow-lg shadow-sky-500/30">
          <i class="fas fa-question-circle text-2xl md:text-3xl text-white"></i>
        </div>
        <h3 class="font-bold text-sm md:text-lg mb-1">سؤال أو استفسار</h3>
        <p class="text-emerald-100/80 text-[10px] md:text-xs leading-relaxed">اطرح سؤالك وسنرد عليك</p>
      </a>

      <!-- تقديم طلب -->
      <a href="${linkRequest}" target="_blank" rel="noopener"
         class="card-svc shine glass-strong rounded-2xl p-4 md:p-6 text-center block group">
        <div class="bg-gradient-to-br from-amber-400 to-orange-600 w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-3 mx-auto shadow-lg shadow-orange-500/30">
          <i class="fas fa-edit text-2xl md:text-3xl text-white"></i>
        </div>
        <h3 class="font-bold text-sm md:text-lg mb-1">تقديم طلب</h3>
        <p class="text-emerald-100/80 text-[10px] md:text-xs leading-relaxed">طلبات إدارية وأكاديمية</p>
      </a>

      <!-- التواصل مع الإدارة -->
      <a href="${linkContact}" target="_blank" rel="noopener"
         class="card-svc shine glass-strong rounded-2xl p-4 md:p-6 text-center block group">
        <div class="bg-gradient-to-br from-rose-400 to-rose-600 w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-3 mx-auto shadow-lg shadow-rose-500/30">
          <i class="fas fa-headset text-2xl md:text-3xl text-white"></i>
        </div>
        <h3 class="font-bold text-sm md:text-lg mb-1">التواصل مع الإدارة</h3>
        <p class="text-emerald-100/80 text-[10px] md:text-xs leading-relaxed">إدارة البوت / الأكاديمية / الكنترول</p>
      </a>

      <!-- عن الكلية -->
      <a href="${linkAbout}" target="_blank" rel="noopener"
         class="card-svc shine glass-strong rounded-2xl p-4 md:p-6 text-center block group">
        <div class="bg-gradient-to-br from-teal-400 to-teal-600 w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-3 mx-auto shadow-lg shadow-teal-500/30">
          <i class="fas fa-info-circle text-2xl md:text-3xl text-white"></i>
        </div>
        <h3 class="font-bold text-sm md:text-lg mb-1">عن الكلية</h3>
        <p class="text-emerald-100/80 text-[10px] md:text-xs leading-relaxed">معلومات عن الكلية والتخصصات</p>
      </a>
    </div>

    <!-- زر فتح البوت كامل -->
    <div class="text-center mb-10">
      <a href="${linkStart}" target="_blank" rel="noopener"
         class="inline-flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-7 md:px-10 py-3 md:py-4 rounded-2xl font-bold text-sm md:text-lg shadow-2xl shadow-emerald-500/30 transition transform hover:scale-105">
        <i class="fab fa-telegram text-xl md:text-2xl"></i>
        فتح البوت في تلجرام
        <i class="fas fa-arrow-left text-sm md:text-base"></i>
      </a>
    </div>
  </section>

  <!-- مزايا سريعة -->
  <section class="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-8">
    <div class="glass p-3 md:p-4 rounded-xl text-center">
      <i class="fas fa-user-check text-xl md:text-2xl text-emerald-200 mb-1 md:mb-2"></i>
      <p class="text-[11px] md:text-sm font-semibold">تحقق من الطلاب</p>
    </div>
    <div class="glass p-3 md:p-4 rounded-xl text-center">
      <i class="fas fa-shield-alt text-xl md:text-2xl text-emerald-200 mb-1 md:mb-2"></i>
      <p class="text-[11px] md:text-sm font-semibold">إشراف ذكي</p>
    </div>
    <div class="glass p-3 md:p-4 rounded-xl text-center">
      <i class="fas fa-bullhorn text-xl md:text-2xl text-emerald-200 mb-1 md:mb-2"></i>
      <p class="text-[11px] md:text-sm font-semibold">إذاعة جماعية</p>
    </div>
    <div class="glass p-3 md:p-4 rounded-xl text-center">
      <i class="fas fa-mobile-alt text-xl md:text-2xl text-emerald-200 mb-1 md:mb-2"></i>
      <p class="text-[11px] md:text-sm font-semibold">متجاوب 100%</p>
    </div>
  </section>

  <footer class="text-center pb-6 pt-4 border-t border-white/10">
    <p class="text-emerald-200/70 text-[11px] md:text-sm">© 2026 كلية الصماد للقرآن الكريم — جميع الحقوق محفوظة</p>
  </footer>
</main>

</body>
</html>`);
});

// ============================================
// 2) Telegram Webhook Endpoint
// ============================================
app.post('/telegram/webhook', async (c) => {
  // التحقق من السر
  const headerSecret = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  const expectedSecret = await getSetting(c.env.DB, 'webhook_secret');
  if (expectedSecret && headerSecret !== expectedSecret) {
    return c.json({ ok: false, error: 'invalid secret' }, 401);
  }

  let update: TgUpdate;
  try {
    update = await c.req.json();
  } catch (_) {
    return c.json({ ok: false, error: 'invalid json' }, 400);
  }

  const token =
    c.env.TELEGRAM_BOT_TOKEN ||
    (await getSetting(c.env.DB, 'bot_token')) ||
    '';
  if (!token) {
    console.error('No bot token configured');
    return c.json({ ok: true });
  }

  const tg = new Telegram(token);
  // معالجة في الخلفية وإرجاع 200 سريعاً
  c.executionCtx.waitUntil(handleUpdate(update, c.env.DB, tg));
  return c.json({ ok: true });
});

// ============================================
// 3) Admin Login
// ============================================
app.get('/admin', async (c) => {
  const sid = getCookie(c, 'session');
  if (sid) {
    const user = await getSession(c.env.DB, sid);
    if (user) return c.redirect('/admin/dashboard');
  }
  return c.html(loginPageHtml());
});

app.get('/admin/login', (c) => c.html(loginPageHtml()));

app.post('/admin/login', async (c) => {
  const form = await c.req.parseBody();
  const username = String(form.username || '').trim();
  const password = String(form.password || '');
  const salt = c.env.PANEL_SALT || 'sammad2026';

  if (!username || !password) {
    return c.html(loginPageHtml('يرجى إدخال اسم المستخدم وكلمة المرور'));
  }

  const user: any = await c.env.DB
    .prepare('SELECT * FROM panel_users WHERE username = ?')
    .bind(username)
    .first();

  if (!user) {
    return c.html(loginPageHtml('اسم المستخدم أو كلمة المرور غير صحيحة'));
  }

  // التحقق من كلمة المرور - إذا كانت أول مرة (hash قديم خاطئ من seed) نقبل الافتراضية
  const ok = await verifyPassword(password, salt, user.password_hash);
  if (!ok) {
    // التحقق من كلمة المرور الافتراضية إذا كان hash من الـ seed
    const isDefault = username === 'admin' && password === 'Admin@2026' &&
                      user.password_hash === 'a4f7c1c1de1a8fbb5bb37e8b3f2c5d8e9a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
    if (!isDefault) {
      return c.html(loginPageHtml('اسم المستخدم أو كلمة المرور غير صحيحة'));
    }
    // تحديث الـ hash للقيمة الصحيحة
    const newHash = await hashPassword(password, salt);
    await c.env.DB
      .prepare('UPDATE panel_users SET password_hash = ? WHERE id = ?')
      .bind(newHash, user.id)
      .run();
  }

  await cleanupSessions(c.env.DB);
  const sid = await createSession(c.env.DB, user.id);
  setCookie(c, 'session', sid, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return c.redirect('/admin/dashboard');
});

app.get('/admin/logout', async (c) => {
  const sid = getCookie(c, 'session');
  if (sid) await deleteSession(c.env.DB, sid);
  deleteCookie(c, 'session', { path: '/' });
  return c.redirect('/admin');
});

// ============================================
// 4) Admin Dashboard
// ============================================
app.get('/admin/dashboard', async (c) => {
  const sid = getCookie(c, 'session');
  if (!sid) return c.redirect('/admin');
  const user = await getSession(c.env.DB, sid);
  if (!user) return c.redirect('/admin');

  // إحصائيات
  const db = c.env.DB;
  const stats: any = {};
  const queries: [string, string][] = [
    ['groups', 'SELECT COUNT(*) AS c FROM groups WHERE is_active = 1'],
    ['students', 'SELECT COUNT(*) AS c FROM students'],
    ['curriculums', 'SELECT COUNT(*) AS c FROM curriculums WHERE is_active = 1'],
    ['pending_requests', "SELECT COUNT(*) AS c FROM requests WHERE status='pending'"],
    ['approved', "SELECT COUNT(*) AS c FROM students WHERE status='approved'"],
    ['pending', "SELECT COUNT(*) AS c FROM students WHERE status='pending'"],
    ['restricted', "SELECT COUNT(*) AS c FROM students WHERE status='restricted'"],
    ['rejected', "SELECT COUNT(*) AS c FROM students WHERE status='rejected'"],
    ['replies', 'SELECT COUNT(*) AS c FROM auto_replies WHERE is_active = 1'],
    ['banned_words', 'SELECT COUNT(*) AS c FROM banned_words'],
    ['warnings', 'SELECT COUNT(*) AS c FROM warnings'],
  ];
  for (const [key, sql] of queries) {
    try {
      const r: any = await db.prepare(sql).first();
      stats[key] = r?.c || 0;
    } catch (_) {
      stats[key] = 0;
    }
  }

  // محاولة الحصول على معرف البوت
  let bot_username: string | undefined;
  try {
    const token = c.env.TELEGRAM_BOT_TOKEN || (await getSetting(c.env.DB, 'bot_token')) || '';
    if (token) {
      const tg = new Telegram(token);
      const me: any = await tg.getMe();
      bot_username = me?.username;
    }
  } catch (_) {}

  return c.html(dashboardHtml({ user, stats, bot_username }));
});

// ============================================
// 5) Admin API
// ============================================
app.route('/admin/api', adminApi);

// ============================================
// 6) Static Files (يخدمها Cloudflare Pages تلقائياً من /static/*)
// ============================================
// لا حاجة لتسجيل routes للملفات الثابتة - Cloudflare Pages يخدمها تلقائياً

// ============================================
// 7) Health Check
// ============================================
app.get('/health', async (c) => {
  try {
    const r: any = await c.env.DB.prepare('SELECT 1 AS ok').first();
    return c.json({ ok: true, db: !!r });
  } catch (e: any) {
    return c.json({ ok: false, error: e?.message }, 500);
  }
});

// ============================================
// PWA: manifest.json و service worker
// ============================================
const MANIFEST_JSON = {
  name: 'بوت كلية الصماد للقرآن الكريم',
  short_name: 'بوت الصماد',
  description: 'لوحة تحكم بوت تيليجرام لكلية الصماد للقرآن الكريم',
  start_url: '/admin',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#065f46',
  theme_color: '#065f46',
  lang: 'ar',
  dir: 'rtl',
  icons: [
    // Any-purpose icons (يستخدم لمعظم الأماكن: شاشة التطبيقات، التبويبات)
    { src: '/static/icon-72.png',  sizes: '72x72',   type: 'image/png', purpose: 'any' },
    { src: '/static/icon-96.png',  sizes: '96x96',   type: 'image/png', purpose: 'any' },
    { src: '/static/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
    { src: '/static/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/static/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    // Maskable icons (لـ Android adaptive icons - بدون الزوايا المدورة لتجنب القطع)
    { src: '/static/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: '/static/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    // SVG كاحتياط
    { src: '/static/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ],
};

app.get('/manifest.json', (c) => {
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json(MANIFEST_JSON);
});

const SW_JS = `// Service Worker — بوت كلية الصماد
const CACHE_NAME = 'samad-bot-v3';
const APP_SHELL = [
  '/admin',
  '/static/admin.js',
  '/static/admin-extra.js',
  '/static/admin-texts.js',
  '/static/styles.css',
  '/manifest.json',
  '/static/icon.svg',
  '/static/icon-72.png',
  '/static/icon-96.png',
  '/static/icon-144.png',
  '/static/icon-192.png',
  '/static/icon-512.png',
  '/static/icon-maskable-192.png',
  '/static/icon-maskable-512.png',
  '/static/apple-touch-icon.png',
  '/static/favicon-16.png',
  '/static/favicon-32.png',
  '/static/favicon-64.png'
];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL).catch(()=>null))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k!==CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/admin/api') || url.pathname.startsWith('/webhook')) return;
  if (url.pathname.startsWith('/static/') || url.pathname === '/manifest.json' || url.pathname === '/sw.js' || url.pathname === '/admin') {
    event.respondWith(caches.match(event.request).then(cached => {
      const fresh = fetch(event.request).then(res => { if (res && res.status === 200) { const clone = res.clone(); caches.open(CACHE_NAME).then(c => c.put(event.request, clone).catch(()=>{})); } return res; }).catch(() => cached);
      return cached || fresh;
    }));
  }
});
self.addEventListener('push', (event) => {
  let data = {};
  try { if (event.data) data = event.data.json(); } catch(_) { data = { title: 'إشعار', body: event.data?.text() || '' }; }
  const title = data.title || 'بوت الصماد';
  const options = { body: data.body || '', icon: data.icon || '/static/icon-192.png', badge: data.badge || '/static/icon-192.png', tag: data.tag || 'samad-bot', data: data.data || { url: data.url || '/admin' }, requireInteraction: !!data.requireInteraction, dir: 'rtl', lang: 'ar' };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/admin';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) { if (client.url.includes('/admin') && 'focus' in client) { client.navigate(targetUrl).catch(()=>{}); return client.focus(); } }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  }));
});
self.addEventListener('message', (event) => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
`;

app.get('/sw.js', (c) => {
  c.header('Content-Type', 'application/javascript; charset=utf-8');
  c.header('Service-Worker-Allowed', '/');
  c.header('Cache-Control', 'no-cache');
  return c.body(SW_JS);
});

// ============================================
// 404
// ============================================
app.notFound((c) => c.json({ error: 'Not Found' }, 404));

export default app;
