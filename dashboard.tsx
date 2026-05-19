// ============================================
// صفحة لوحة التحكم الرئيسية (Dashboard)
// ============================================

export const dashboardHtml = (data: {
  user: { username: string; role: string; full_name: string };
  stats: any;
  bot_username?: string;
}) => `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>لوحة التحكم - بوت كلية الصماد</title>
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#059669">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="بوت الصماد">
<link rel="icon" type="image/svg+xml" href="/static/icon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/static/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/static/favicon-16.png">
<link rel="apple-touch-icon" href="/static/apple-touch-icon.png">
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
<style>
  :root {
    --brand: #059669;
    --brand-d: #047857;
    --brand-l: #10b981;
    --bg: #f8fafc;
    --sidebar-bg: #0f172a;
  }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
  body { font-family: 'Tajawal', sans-serif; background: var(--bg); color: #334155; overflow-x: hidden; }

  /* Sidebar styling */
  .sidebar {
    background: linear-gradient(180deg, #064e3b 0%, #022c22 100%);
    box-shadow: -4px 0 24px rgba(0,0,0,0.15);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .sidebar-cat-title {
    font-size: 11px; font-weight: 700; color: #a7f3d0; opacity: 0.7;
    letter-spacing: 0.5px; padding: 14px 16px 6px;
  }
  .nav-item { transition: all .2s ease; border-radius: 12px; font-weight: 500; display: flex; align-items: center; color: #e2e8f0; }
  .nav-item i { transition: transform .2s ease; }
  .nav-item:hover { background: rgba(255,255,255,0.08); color: #fff; transform: translateX(-4px); }
  .nav-item:hover i { transform: scale(1.1); }
  .nav-item.active {
    background: linear-gradient(90deg, rgba(16,185,129,0.22) 0%, rgba(16,185,129,0.05) 100%);
    border-right: 4px solid #34d399;
    color: #34d399;
    font-weight: 700;
  }

  /* Cards & Micro-interactions */
  .stat-card { transition: all .3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; }
  .stat-card:hover { transform: translateY(-4px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); }

  .tab-content { display: none; animation: slideUp .35s cubic-bezier(0.4, 0, 0.2, 1) both; }
  .tab-content.active { display: block; }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
  ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  /* Inputs */
  input, select, textarea { transition: all 0.2s ease-in-out; }
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--brand-l) !important;
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15) !important;
  }

  /* Buttons preview cards */
  .preview-inline-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 12px; margin: 4px;
    color: #fff; font-size: 13px; font-weight: 600;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  }
  .preview-reply-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 14px; border-radius: 8px; margin: 3px;
    background: #fff; border: 1px solid #cbd5e1;
    font-size: 13px; font-weight: 500;
  }
  .placement-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
  .filter-btn { transition: all .2s; }

  /* === محرر النصوص === */
  .text-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; transition: box-shadow .2s; }
  .text-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.06); }
  .text-card.modified { border-color: #f59e0b; background: #fffbeb; }
  .text-card textarea { width: 100%; min-height: 90px; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: 'Tajawal', monospace; font-size: 14px; resize: vertical; }
  .text-card .cat-badge { font-size: 11px; padding: 2px 8px; border-radius: 6px; font-weight: 600; }
  .text-card .key-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #475569; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }

  /* Responsive Adjustments */
  @media (max-width: 1023px) {
    aside.sidebar {
      position: fixed !important; top: 0 !important; right: 0 !important; bottom: 0 !important; left: auto !important;
      width: 280px !important; max-width: 85vw !important; height: 100vh !important; z-index: 60 !important;
      transform: translateX(105%); overflow-y: auto;
    }
    aside.sidebar.show { transform: translateX(0) !important; }
    main { padding-top: 5rem !important; }
    .stat-card { padding: 1rem !important; }
    table { font-size: 0.78rem; }
    #modal > div { max-width: 95% !important; max-height: 95vh !important; }
    #modal input, #modal textarea, #modal select { font-size: 16px !important; }
  }
  @media (min-width: 1024px) {
    .sidebar-backdrop { display: none !important; }
    #mobile-header { display: none !important; }
  }

  .sidebar-backdrop {
    position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6);
    z-index: 55; backdrop-filter: blur(4px); transition: opacity 0.3s ease;
  }
  .sidebar-backdrop.hidden { display: none !important; }
</style>
</head>
<body class="min-h-screen flex flex-col antialiased">

<!-- Mobile Header / Top Bar -->
<header id="mobile-header" class="lg:hidden fixed top-0 inset-x-0 h-16 bg-white border-b border-slate-200 z-50 flex items-center justify-between px-4 shadow-sm">
  <div class="flex items-center gap-3">
    <button onclick="toggleSidebar()" class="p-2 text-slate-600 hover:bg-slate-100 rounded-lg focus:outline-none" aria-label="القائمة الرئيسية">
      <i class="fas fa-bars text-xl"></i>
    </button>
    <div class="flex items-center gap-2">
      <span class="bg-emerald-600 text-white p-1.5 rounded-lg text-xs"><i class="fas fa-mosque"></i></span>
      <span class="font-bold text-sm text-slate-800">بوت كلية الصماد</span>
    </div>
  </div>
  <div class="flex items-center gap-2">
    <span class="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold">
      ${data.user.role === 'owner' ? 'مالك' : 'مشرف'}
    </span>
  </div>
</header>

<div class="flex min-h-screen w-full relative">
  <!-- Backdrop -->
  <div id="sidebar-backdrop" class="sidebar-backdrop hidden" onclick="toggleSidebar(false)"></div>

  <!-- Sidebar -->
  <aside class="sidebar w-64 text-white flex-shrink-0 flex flex-col justify-between fixed lg:sticky top-0 h-screen overflow-y-auto">
    <div>
      <!-- Brand -->
      <div class="p-5 border-b border-white/10 hidden lg:block">
        <div class="flex items-center gap-3">
          <div class="bg-white/10 p-2.5 rounded-xl backdrop-blur-md">
            <i class="fas fa-mosque text-2xl text-emerald-300"></i>
          </div>
          <div>
            <h2 class="font-black text-sm tracking-wide">بوت كلية الصماد</h2>
            <p class="text-xs text-emerald-300/80 mt-0.5">للوحة التحكّم الإدارية</p>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="p-4 space-y-1">
        <div class="sidebar-cat-title">الرئيسية والإحصاءات</div>
        <a class="nav-item active px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="overview">
          <i class="fas fa-chart-pie ml-3 text-base w-5"></i> النظرة العامة
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="settings">
          <i class="fas fa-sliders-h ml-3 text-base w-5"></i> إعدادات البوت
        </a>

        <div class="sidebar-cat-title">شؤون الطلاب والمناهج</div>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="groups">
          <i class="fas fa-layer-group ml-3 text-base w-5"></i> المجموعات
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="students">
          <i class="fas fa-user-graduate ml-3 text-base w-5"></i> الطلاب
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="curriculum">
          <i class="fas fa-book-open ml-3 text-base w-5"></i> المناهج الدراسية
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="grades">
          <i class="fas fa-medal ml-3 text-base w-5"></i> كشف الدرجات
        </a>

        <div class="sidebar-cat-title">أدوات التحكم والرد الذكي</div>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="replies">
          <i class="fas fa-comment-dots ml-3 text-base w-5"></i> الردود التلقائية
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="banned">
          <i class="fas fa-shield-virus ml-3 text-base w-5"></i> الكلمات المحظورة
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="buttons">
          <i class="fas fa-cubes ml-3 text-base w-5"></i> الأزرار الموحدة
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="commands">
          <i class="fas fa-terminal ml-3 text-base w-5"></i> الأوامر المخصصة
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="texts">
          <i class="fas fa-language ml-3 text-base w-5"></i> محرر النصوص
        </a>

        <div class="sidebar-cat-title">التواصل والبث</div>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="requests">
          <i class="fas fa-inbox ml-3 text-base w-5"></i> الطلبات والاستفسارات
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="broadcast">
          <i class="fas fa-bullhorn ml-3 text-base w-5"></i> الإذاعة والمراسلة
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="contacts">
          <i class="fas fa-address-book ml-3 text-base w-5"></i> جهات التواصل
        </a>

        <div class="sidebar-cat-title">الإشعارات والأكاديمي</div>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="devices">
          <i class="fas fa-bell ml-3 text-base w-5"></i> 🔔 الإشعارات والأجهزة
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="routing">
          <i class="fas fa-route ml-3 text-base w-5"></i> 📡 توجيه الإشعارات
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="notif-log">
          <i class="fas fa-history ml-3 text-base w-5"></i> 📜 سجل الإشعارات
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="academic">
          <i class="fas fa-graduation-cap ml-3 text-base w-5"></i> 🎓 المستويات والفصول
        </a>

        <div class="sidebar-cat-title">النظام والحساب</div>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="admins">
          <i class="fas fa-user-shield ml-3 text-base w-5"></i> المشرفون
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="webhook">
          <i class="fas fa-project-diagram ml-3 text-base w-5"></i> الويبهوك
        </a>
        <a class="nav-item px-4 py-2.5 rounded-xl cursor-pointer text-sm" data-tab="account">
          <i class="fas fa-user-lock ml-3 text-base w-5"></i> الحساب
        </a>
      </nav>
    </div>

    <!-- Sidebar Footer -->
    <div class="p-4 border-t border-white/10 bg-black/10">
      <a href="/admin/logout" class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 font-bold text-sm transition-colors duration-200">
        <i class="fas fa-sign-out-alt"></i> تسجيل الخروج
      </a>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="flex-1 p-4 md:p-6 lg:p-8 w-full overflow-x-hidden min-h-screen">
    <!-- Desktop Header -->
    <header class="hidden lg:flex items-center justify-between mb-8 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
      <div>
        <h1 class="text-2xl font-black text-slate-800" id="page-title">لوحة التحكم</h1>
        <p class="text-sm text-slate-500 mt-1">أهلاً بك مجدداً، <span class="text-slate-800 font-semibold">${data.user.full_name || data.user.username}</span></p>
      </div>
      <div class="flex items-center gap-3">
        <span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          ${data.user.role === 'owner' ? 'مالك النظام' : 'مشرف عام'}
        </span>
        ${data.bot_username ? `<a href="https://t.me/${data.bot_username}" target="_blank" class="bg-sky-50 text-sky-700 border border-sky-200 px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-sky-100 transition flex items-center gap-1.5">
          <i class="fab fa-telegram text-sm"></i>@${data.bot_username}
        </a>` : ''}
      </div>
    </header>

    <!-- Tab: Overview -->
    <div class="tab-content active" id="tab-overview">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="stat-card bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-5 rounded-xl shadow-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-emerald-100 text-sm">المجموعات</p>
              <p class="text-3xl font-bold mt-1">${data.stats.groups || 0}</p>
            </div>
            <i class="fas fa-users text-3xl text-emerald-200/50"></i>
          </div>
        </div>
        <div class="stat-card bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 rounded-xl shadow-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-blue-100 text-sm">الطلاب</p>
              <p class="text-3xl font-bold mt-1">${data.stats.students || 0}</p>
            </div>
            <i class="fas fa-graduation-cap text-3xl text-blue-200/50"></i>
          </div>
        </div>
        <div class="stat-card bg-gradient-to-br from-purple-500 to-purple-600 text-white p-5 rounded-xl shadow-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-purple-100 text-sm">المواد الدراسية</p>
              <p class="text-3xl font-bold mt-1">${data.stats.curriculums || 0}</p>
            </div>
            <i class="fas fa-book text-3xl text-purple-200/50"></i>
          </div>
        </div>
        <div class="stat-card bg-gradient-to-br from-orange-500 to-orange-600 text-white p-5 rounded-xl shadow-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-orange-100 text-sm">طلبات معلقة</p>
              <p class="text-3xl font-bold mt-1">${data.stats.pending_requests || 0}</p>
            </div>
            <i class="fas fa-envelope text-3xl text-orange-200/50"></i>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div class="bg-white p-5 rounded-xl shadow">
          <h3 class="font-bold text-slate-700 mb-4"><i class="fas fa-chart-bar ml-2 text-emerald-600"></i> حالة الطلاب</h3>
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-slate-600"><i class="fas fa-check-circle text-green-500 ml-1"></i> موافق عليهم</span>
              <span class="font-bold text-green-600">${data.stats.approved || 0}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-600"><i class="fas fa-clock text-yellow-500 ml-1"></i> بانتظار</span>
              <span class="font-bold text-yellow-600">${data.stats.pending || 0}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-600"><i class="fas fa-pause-circle text-orange-500 ml-1"></i> مقيد</span>
              <span class="font-bold text-orange-600">${data.stats.restricted || 0}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-600"><i class="fas fa-times-circle text-red-500 ml-1"></i> مرفوض</span>
              <span class="font-bold text-red-600">${data.stats.rejected || 0}</span>
            </div>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow">
          <h3 class="font-bold text-slate-700 mb-4"><i class="fas fa-shield-alt ml-2 text-emerald-600"></i> الإشراف</h3>
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-slate-600"><i class="fas fa-reply text-blue-500 ml-1"></i> ردود تلقائية</span>
              <span class="font-bold">${data.stats.replies || 0}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-600"><i class="fas fa-ban text-red-500 ml-1"></i> كلمات محظورة</span>
              <span class="font-bold">${data.stats.banned_words || 0}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-600"><i class="fas fa-exclamation-triangle text-yellow-500 ml-1"></i> تحذيرات</span>
              <span class="font-bold">${data.stats.warnings || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white p-5 rounded-xl shadow">
        <h3 class="font-bold text-slate-700 mb-4"><i class="fas fa-bolt ml-2 text-emerald-600"></i> إجراءات سريعة</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onclick="switchTab('replies')" class="bg-blue-50 hover:bg-blue-100 text-blue-700 p-3 rounded-lg transition">
            <i class="fas fa-plus ml-1"></i> إضافة رد تلقائي
          </button>
          <button onclick="switchTab('curriculum')" class="bg-purple-50 hover:bg-purple-100 text-purple-700 p-3 rounded-lg transition">
            <i class="fas fa-book ml-1"></i> إضافة منهج
          </button>
          <button onclick="switchTab('banned')" class="bg-red-50 hover:bg-red-100 text-red-700 p-3 rounded-lg transition">
            <i class="fas fa-ban ml-1"></i> كلمة محظورة
          </button>
          <button onclick="switchTab('webhook')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-3 rounded-lg transition">
            <i class="fas fa-link ml-1"></i> فحص الويبهوك
          </button>
        </div>
      </div>
    </div>

    <!-- Tab: Settings -->
    <div class="tab-content" id="tab-settings">
      {/* قسم توكن البوت - منفصل ومميز */}
      <div class="bg-gradient-to-l from-emerald-50 to-teal-50 border-2 border-emerald-200 p-6 rounded-xl shadow mb-6">
        <h2 class="text-xl font-bold mb-2 text-emerald-800">
          <i class="fas fa-key ml-2"></i> توكن البوت (Bot Token)
        </h2>
        <p class="text-sm text-slate-600 mb-4">
          <i class="fas fa-info-circle ml-1 text-blue-500"></i>
          أدخل توكن البوت المُولّد من
          <a href="https://t.me/BotFather" target="_blank" class="text-blue-600 hover:underline font-bold">@BotFather</a>.
          يمكنك تعديله أو استبداله في أي وقت دون الحاجة لإعادة نشر التطبيق.
        </p>
        <div id="bot-info-card" class="hidden mb-4 bg-white border border-emerald-200 p-3 rounded-lg text-sm"></div>
        <form id="token-form" class="space-y-3">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">
              <i class="fas fa-shield-halved ml-1 text-emerald-600"></i> توكن البوت الحالي
            </label>
            <div class="flex gap-2">
              <input type="password" id="bot-token-input" name="bot_token" autocomplete="off"
                class="flex-1 px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm"
                placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ-1234567890" />
              <button type="button" onclick="toggleTokenVisibility()" class="bg-slate-200 hover:bg-slate-300 px-3 rounded-lg" title="إظهار/إخفاء">
                <i id="token-eye" class="fas fa-eye"></i>
              </button>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              تنسيق التوكن: <code class="bg-slate-100 px-1 rounded">رقم:نص</code> · يبقى مخفياً في قاعدة البيانات.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" onclick="testBotToken()" class="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-lg">
              <i class="fas fa-vial ml-1"></i> اختبار التوكن
            </button>
            <button type="submit" class="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-lg">
              <i class="fas fa-save ml-1"></i> حفظ التوكن
            </button>
            <button type="button" onclick="clearBotToken()" class="bg-red-100 hover:bg-red-200 text-red-700 px-5 py-2 rounded-lg">
              <i class="fas fa-trash ml-1"></i> حذف التوكن
            </button>
            <button type="button" onclick="switchTab('webhook')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-lg">
              <i class="fas fa-link ml-1"></i> ربط الويبهوك
            </button>
          </div>
        </form>
      </div>

      {/* الإعدادات العامة الأخرى */}
      <div class="bg-white p-6 rounded-xl shadow">
        <h2 class="text-xl font-bold mb-4 text-slate-800"><i class="fas fa-cog ml-2"></i> إعدادات البوت العامة</h2>
        <form id="settings-form" class="space-y-4"></form>
      </div>
    </div>

    <!-- Tab: Groups -->
    <div class="tab-content" id="tab-groups">
      <!-- إعدادات الحماية -->
      <div class="bg-white p-6 rounded-xl shadow mb-4">
        <h2 class="text-xl font-bold mb-4 text-slate-800">
          <i class="fas fa-shield-alt ml-2 text-emerald-600"></i> حماية إضافة البوت
        </h2>
        <div class="space-y-3">
          <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
            <input type="checkbox" id="sec-restrict" class="w-5 h-5 accent-emerald-600" onchange="saveGroupsSecurity()">
            <div class="flex-1">
              <div class="font-bold text-slate-800">منع إضافة البوت لأي مجموعة إلا من مالك البوت أو المشرفين المصرح لهم</div>
              <div class="text-xs text-slate-500">عند التفعيل، لن يُسمح لأي شخص آخر بإضافة البوت لمجموعة</div>
            </div>
          </label>
          <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
            <input type="checkbox" id="sec-autoleave" class="w-5 h-5 accent-emerald-600" onchange="saveGroupsSecurity()">
            <div class="flex-1">
              <div class="font-bold text-slate-800">مغادرة المجموعات غير المصرح بها تلقائياً</div>
              <div class="text-xs text-slate-500">إذا أُضيف البوت لمجموعة غير مصرح بها، يخرج منها تلقائياً</div>
            </div>
          </label>
        </div>
      </div>

      <!-- قائمة المجموعات -->
      <div class="bg-white p-6 rounded-xl shadow">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-slate-800"><i class="fas fa-users ml-2"></i> المجموعات</h2>
          <button onclick="loadGroups()" class="text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg">
            <i class="fas fa-rotate"></i> تحديث
          </button>
        </div>
        <div id="groups-list" class="space-y-3"></div>
      </div>
    </div>

    <!-- Tab: Students -->
    <div class="tab-content" id="tab-students">
      <div class="bg-white p-6 rounded-xl shadow">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-slate-800"><i class="fas fa-graduation-cap ml-2"></i> الطلاب</h2>
          <input id="student-search" type="text" placeholder="ابحث..."
            class="px-3 py-2 border rounded-lg text-sm">
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-100 text-slate-700">
              <tr>
                <th class="p-3 text-right">الاسم</th>
                <th class="p-3 text-right">الرقم الأكاديمي</th>
                <th class="p-3 text-right">المستوى</th>
                <th class="p-3 text-right">الهاتف</th>
                <th class="p-3 text-right">الحالة</th>
                <th class="p-3 text-right">الإجراءات</th>
              </tr>
            </thead>
            <tbody id="students-table" class="divide-y"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab: Curriculum -->
    <div class="tab-content" id="tab-curriculum">
      <div class="bg-white p-6 rounded-xl shadow">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-slate-800"><i class="fas fa-book ml-2"></i> المناهج الدراسية</h2>
          <button onclick="openCurriculumModal()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">
            <i class="fas fa-plus ml-1"></i> إضافة مادة
          </button>
        </div>
        <div id="curriculum-list" class="space-y-2"></div>
      </div>
    </div>

    <!-- Tab: Auto Replies -->
    <div class="tab-content" id="tab-replies">
      <div class="bg-white p-6 rounded-xl shadow">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-slate-800"><i class="fas fa-reply ml-2"></i> الردود التلقائية</h2>
          <button onclick="openReplyModal()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">
            <i class="fas fa-plus ml-1"></i> إضافة رد
          </button>
        </div>
        <div id="replies-list" class="space-y-2"></div>
      </div>
    </div>

    <!-- Tab: Banned Words -->
    <div class="tab-content" id="tab-banned">
      <div class="bg-white p-6 rounded-xl shadow">
        <h2 class="text-xl font-bold mb-4 text-slate-800"><i class="fas fa-ban ml-2"></i> الكلمات المحظورة</h2>
        <form id="banned-form" class="flex gap-2 mb-4">
          <input type="text" name="word" placeholder="كلمة جديدة..." required
            class="flex-1 px-3 py-2 border rounded-lg">
          <select name="severity" class="px-3 py-2 border rounded-lg">
            <option value="warn">تحذير</option>
            <option value="delete" selected>حذف</option>
            <option value="kick">طرد</option>
          </select>
          <button class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">
            <i class="fas fa-plus"></i> إضافة
          </button>
        </form>
        <div id="banned-list" class="flex flex-wrap gap-2"></div>
      </div>
    </div>

    <!-- Tab: Requests -->
    <div class="tab-content" id="tab-requests">
      <div class="bg-white p-6 rounded-xl shadow">
        <h2 class="text-xl font-bold mb-4 text-slate-800"><i class="fas fa-envelope ml-2"></i> الطلبات والاستفسارات</h2>
        <div id="requests-list" class="space-y-3"></div>
      </div>
    </div>

    <!-- Tab: Admins -->
    <div class="tab-content" id="tab-admins">
      <div class="bg-white p-6 rounded-xl shadow">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-slate-800"><i class="fas fa-user-shield ml-2"></i> المشرفون</h2>
          <button onclick="openAdminModal()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">
            <i class="fas fa-plus ml-1"></i> إضافة مشرف
          </button>
        </div>
        <div id="admins-list" class="space-y-2"></div>
      </div>
    </div>

    <!-- Tab: Broadcast (المراسلة) -->
    <div class="tab-content" id="tab-broadcast">
      <div class="bg-white p-4 md:p-6 rounded-xl shadow mb-4">
        <h2 class="text-xl font-bold mb-4 text-slate-800"><i class="fas fa-bullhorn ml-2"></i> رسالة جديدة / إذاعة</h2>
        <form id="broadcast-form" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold mb-1">عنوان داخلي (اختياري)</label>
            <input type="text" name="title" class="w-full px-3 py-2 border rounded-lg" placeholder="إذاعة أسبوعية...">
          </div>

          <div>
            <label class="block text-sm font-semibold mb-1">الجمهور المستهدف</label>
            <select name="target_type" id="broadcast-target" class="w-full px-3 py-2 border rounded-lg">
              <option value="all_users">📨 جميع المشتركين في الخاص</option>
              <option value="all_groups">👥 جميع المجموعات</option>
              <option value="all">🌐 الكل (مستخدمين + مجموعات)</option>
              <option value="specific">🎯 محدد (اختيار يدوي)</option>
            </select>
          </div>

          <div id="specific-targets-box" class="hidden bg-slate-50 p-3 rounded-lg border">
            <p class="text-sm font-semibold mb-2">اختر المستلمين:</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto" id="targets-checkboxes"></div>
          </div>

          <div>
            <label class="block text-sm font-semibold mb-1">نص الرسالة</label>
            <textarea name="message_text" rows="5" required class="w-full px-3 py-2 border rounded-lg" placeholder="اكتب نص الرسالة هنا... يدعم HTML البسيط: <b>عريض</b> <i>مائل</i>"></textarea>
          </div>

          <div>
            <label class="block text-sm font-semibold mb-1">مرفقات (اختياري)</label>
            <div class="flex flex-wrap gap-2 items-center">
              <input type="file" id="broadcast-file" class="text-sm">
              <button type="button" onclick="uploadBroadcastFile()" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm">
                <i class="fas fa-upload ml-1"></i> رفع المرفق
              </button>
            </div>
            <div id="broadcast-attachments" class="mt-2 flex flex-wrap gap-2"></div>
          </div>

          <div>
            <label class="block text-sm font-semibold mb-1">أزرار شفافة (اختياري)</label>
            <div id="broadcast-buttons" class="space-y-2"></div>
            <button type="button" onclick="addBroadcastButton()" class="mt-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-lg text-sm">
              <i class="fas fa-plus ml-1"></i> إضافة زر
            </button>
          </div>

          <div class="flex flex-wrap gap-2">
            <button type="submit" class="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-lg">
              <i class="fas fa-paper-plane ml-1"></i> إرسال
            </button>
          </div>
        </form>
      </div>

      <div class="bg-white p-4 md:p-6 rounded-xl shadow">
        <h3 class="font-bold text-slate-800 mb-3"><i class="fas fa-history ml-2"></i> سجل الإذاعات</h3>
        <div id="broadcast-history" class="space-y-2"></div>
      </div>
    </div>

    <!-- Tab: Contacts (جهات التواصل) -->
    <div class="tab-content" id="tab-contacts">
      <div class="bg-white p-4 md:p-6 rounded-xl shadow">
        <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h2 class="text-xl font-bold text-slate-800"><i class="fas fa-address-book ml-2"></i> جهات التواصل</h2>
          <button onclick="openContactModal()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">
            <i class="fas fa-plus ml-1"></i> إضافة جهة
          </button>
        </div>
        <p class="text-xs text-slate-500 mb-4">
          <i class="fas fa-info-circle ml-1 text-blue-500"></i>
          هذه الجهات تظهر في "نافذة التواصل مع الإدارة" داخل البوت كأزرار مباشرة (إدارة، مكتب الأكاديمية، الكنترول، إلخ).
        </p>
        <div id="contacts-list" class="space-y-2"></div>
      </div>
    </div>

    <!-- Tab: Unified Buttons (الأزرار الموحّدة) -->
    <div class="tab-content" id="tab-buttons">
      <div class="bg-gradient-to-l from-emerald-50 to-teal-50 border border-emerald-200 p-4 md:p-6 rounded-xl shadow mb-4">
        <h2 class="text-xl font-bold text-emerald-800 mb-2"><i class="fas fa-shapes ml-2"></i> إدارة أزرار البوت (واجهة موحّدة)</h2>
        <p class="text-sm text-slate-600 leading-relaxed">
          هنا تتحكم بكل الأزرار في مكان واحد. لكل زر اختَر:
          <b>المكان</b> (داخل القائمة الشفافة، أو على لوحة الكتابة الدائمة، أو كليهما)،
          <b>الإجراء</b> (مدمج، أمر مخصص، رابط، ...)،
          <b>الستايل</b> (لون، حجم، عرض كامل، أيقونة، إيموجي).
        </p>
      </div>

      <div class="bg-white p-4 md:p-6 rounded-xl shadow mb-4">
        <div class="flex flex-wrap gap-2 items-center justify-between mb-4">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="font-bold text-slate-800"><i class="fas fa-filter ml-2 text-emerald-600"></i> تصفية حسب المكان:</h3>
            <div class="inline-flex rounded-lg overflow-hidden border" id="buttons-filter">
              <button data-filter="all" class="filter-btn bg-emerald-500 text-white px-3 py-1 text-sm">الكل</button>
              <button data-filter="inline" class="filter-btn bg-white text-slate-700 px-3 py-1 text-sm">قائمة شفافة</button>
              <button data-filter="reply" class="filter-btn bg-white text-slate-700 px-3 py-1 text-sm">لوحة دائمة</button>
              <button data-filter="both" class="filter-btn bg-white text-slate-700 px-3 py-1 text-sm">كلاهما</button>
            </div>
          </div>
          <button onclick="openButtonModal()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">
            <i class="fas fa-plus ml-1"></i> إضافة زر جديد
          </button>
        </div>
        <div id="buttons-preview" class="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
          <p class="text-xs text-slate-500 mb-2"><i class="fas fa-eye ml-1"></i> معاينة سريعة:</p>
          <div id="buttons-preview-inline" class="mb-3"></div>
          <div id="buttons-preview-reply"></div>
        </div>
        <div id="buttons-list" class="space-y-2"></div>
      </div>
    </div>

    <!-- Tab: Custom Commands (الأوامر المخصصة) -->
    <div class="tab-content" id="tab-commands">
      <div class="bg-white p-4 md:p-6 rounded-xl shadow">
        <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h2 class="text-xl font-bold text-slate-800"><i class="fas fa-terminal ml-2"></i> الأوامر المخصصة</h2>
          <button onclick="openCommandModal()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">
            <i class="fas fa-plus ml-1"></i> أمر جديد
          </button>
        </div>
        <p class="text-xs text-slate-500 mb-4">
          <i class="fas fa-info-circle ml-1 text-blue-500"></i>
          أوامر مخصصة قابلة للاستدعاء عبر زر شفاف أو نص أمر مثل /rules، /about. يمكن ربطها بمرفقات وأزرار شفافة.
        </p>
        <div id="commands-list" class="space-y-2"></div>
      </div>
    </div>


    <!-- Tab: Grades (الدرجات - رفع متدفّق للملفات الكبيرة) -->
    <div class="tab-content" id="tab-grades">
      <!-- بطاقة إحصائيات -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div class="stat-card bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-4 rounded-xl shadow">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-emerald-100 text-xs">إجمالي السجلات</p>
              <p class="text-2xl font-bold mt-1" id="grades-stat-total">0</p>
            </div>
            <i class="fas fa-database text-2xl text-emerald-200/60"></i>
          </div>
        </div>
        <div class="stat-card bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-xl shadow">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-blue-100 text-xs">طلاب فريدون</p>
              <p class="text-2xl font-bold mt-1" id="grades-stat-students">0</p>
            </div>
            <i class="fas fa-user-graduate text-2xl text-blue-200/60"></i>
          </div>
        </div>
        <div class="stat-card bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-xl shadow">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-purple-100 text-xs">فصول دراسية</p>
              <p class="text-2xl font-bold mt-1" id="grades-stat-semesters">0</p>
            </div>
            <i class="fas fa-calendar-alt text-2xl text-purple-200/60"></i>
          </div>
        </div>
        <div class="stat-card bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-xl shadow">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-orange-100 text-xs">حالة الرفع</p>
              <p class="text-sm font-bold mt-1" id="grades-stat-job">جاهز</p>
            </div>
            <i class="fas fa-cloud-upload-alt text-2xl text-orange-200/60"></i>
          </div>
        </div>
      </div>

      <div class="bg-white p-4 md:p-6 rounded-xl shadow mb-4">
        <h2 class="text-xl font-bold text-slate-800 mb-3"><i class="fas fa-file-csv ml-2 text-green-600"></i> رفع ملف الدرجات (CSV حتى ~1GB)</h2>
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-xs text-slate-700 leading-relaxed">
          <p class="mb-1">
            <i class="fas fa-info-circle ml-1 text-blue-500"></i>
            <b>كيف يعمل:</b> الملف يُقرأ على شكل تيار (Streaming) داخل المتصفح ويُرسل إلى الخادم كدفعات صغيرة (chunks)
            بحجم 500 سجل افتراضياً، فلا تُحمَّل الذاكرة دفعة واحدة. آمن وسريع للملفات الضخمة.
          </p>
          <p>
            <b>الأعمدة المطلوبة (CSV بفاصلة منقوطة ;):</b>
            <code class="bg-slate-100 px-1 rounded text-[11px] break-all">الرقم الأكاديمي; اسم الطالب; الرقم السري; اسم الفرع; العام الدراسي; الفصل الدراسي; التخصص; المادة; حضور; مشاركة; تكاليف; نظري نصفي; عملي نصفي; نظري نهائي; عملي نهائي; المجموع; التقدير; مبقي; درجة النجاح; ...إلخ</code>
          </p>
        </div>
        <form id="grades-upload-form" class="space-y-3">
          <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input type="file" id="grades-csv" accept=".csv,text/csv" class="block flex-1 text-sm border rounded-lg px-3 py-2" required>
            <div class="flex items-center gap-2">
              <label class="text-xs whitespace-nowrap" title="عدد السجلات في كل دفعة. القيم الصغيرة (100-300) أكثر استقراراً للملفات الكبيرة جداً">حجم الدفعة:</label>
              <select id="grades-chunk-size" class="border rounded px-2 py-1 text-sm">
                <option value="100">100 (أكثر أماناً)</option>
                <option value="200" selected>200 (موصى به)</option>
                <option value="300">300</option>
                <option value="500">500</option>
                <option value="1000">1000 (قد يفشل للملفات الضخمة)</option>
              </select>
            </div>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" id="grades-replace" value="1">
            <span>استبدال جميع البيانات الحالية قبل الرفع (حذف ثم إدخال)</span>
          </label>
          <div class="flex flex-wrap gap-2">
            <button type="submit" id="grades-upload-btn" class="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-lg">
              <i class="fas fa-upload ml-1"></i> بدء الرفع
            </button>
            <button type="button" id="grades-cancel-btn" class="hidden bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-lg">
              <i class="fas fa-stop ml-1"></i> إلغاء
            </button>
            <button type="button" onclick="clearAllGrades()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-lg">
              <i class="fas fa-trash ml-1"></i> حذف كل الدرجات
            </button>
          </div>
        </form>

        <!-- شريط التقدم -->
        <div id="grades-progress-box" class="hidden mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div class="flex justify-between text-sm mb-2">
            <span class="font-bold" id="grades-progress-label">جاري الرفع...</span>
            <span id="grades-progress-percent" class="font-mono text-emerald-700">0%</span>
          </div>
          <div class="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div id="grades-progress-bar" class="bg-gradient-to-l from-emerald-500 to-teal-500 h-3 transition-all" style="width:0%"></div>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
            <div class="bg-white p-2 rounded border"><span class="text-slate-500">قُرئت:</span> <b id="grades-pg-read">0</b></div>
            <div class="bg-white p-2 rounded border"><span class="text-slate-500">رُفعت:</span> <b id="grades-pg-sent" class="text-emerald-600">0</b></div>
            <div class="bg-white p-2 rounded border"><span class="text-slate-500">فشلت:</span> <b id="grades-pg-failed" class="text-red-600">0</b></div>
            <div class="bg-white p-2 rounded border"><span class="text-slate-500">السرعة:</span> <b id="grades-pg-speed">0</b> صف/ث</div>
          </div>
          <p class="text-xs text-slate-500 mt-2" id="grades-pg-eta"></p>
        </div>

        <div id="grades-upload-result" class="mt-3 text-sm"></div>
      </div>

      <div class="bg-white p-4 md:p-6 rounded-xl shadow mb-4">
        <h3 class="font-bold text-slate-800 mb-3"><i class="fas fa-calendar-check ml-2"></i> الفصول المسموح بعرضها للطلاب</h3>
        <p class="text-xs text-slate-500 mb-3">
          الطلاب يرون فقط الفصول المفعّلة هنا. المشرفون يرون كل الفصول دائماً.
        </p>
        <div id="allowed-semesters-list" class="flex flex-wrap gap-2"></div>
      </div>

      <div class="bg-white p-4 md:p-6 rounded-xl shadow">
        <div class="flex justify-between items-center mb-3 flex-wrap gap-2">
          <h3 class="font-bold text-slate-800"><i class="fas fa-search ml-2"></i> سجلات الدرجات (آخر 1000)</h3>
          <input id="grades-search" type="text" placeholder="ابحث برقم أكاديمي أو اسم..."
            class="px-3 py-2 border rounded-lg text-sm">
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs md:text-sm">
            <thead class="bg-slate-100 text-slate-700">
              <tr>
                <th class="p-2 text-right">الرقم</th>
                <th class="p-2 text-right">الطالب</th>
                <th class="p-2 text-right">الفصل</th>
                <th class="p-2 text-right">المادة</th>
                <th class="p-2 text-right">المجموع</th>
                <th class="p-2 text-right">التقدير</th>
                <th class="p-2 text-right">إجراء</th>
              </tr>
            </thead>
            <tbody id="grades-table" class="divide-y"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab: Webhook -->
    <div class="tab-content" id="tab-webhook">
      <div class="bg-white p-6 rounded-xl shadow">
        <h2 class="text-xl font-bold mb-4 text-slate-800"><i class="fas fa-link ml-2"></i> إدارة الويبهوك</h2>
        <div id="webhook-info" class="bg-slate-50 p-4 rounded-lg mb-4 font-mono text-xs"></div>
        <div class="flex gap-2 flex-wrap">
          <button onclick="setupWebhook()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg">
            <i class="fas fa-sync ml-1"></i> تفعيل/تحديث الويبهوك
          </button>
          <button onclick="getWebhookInfo()" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">
            <i class="fas fa-info-circle ml-1"></i> معلومات الويبهوك
          </button>
          <button onclick="deleteWebhookConfirm()" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">
            <i class="fas fa-trash ml-1"></i> إزالة الويبهوك
          </button>
        </div>
      </div>
    </div>

    <!-- Tab: Texts Editor (محرر نصوص البوت الشامل) -->
    <div class="tab-content" id="tab-texts">
      <div class="bg-white p-5 rounded-xl shadow mb-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-bold text-slate-800"><i class="fas fa-language ml-2 text-emerald-600"></i> محرر نصوص البوت</h2>
            <p class="text-sm text-slate-500 mt-1">جميع النصوص التي يقدّمها البوت في مكان واحد — قابلة للتعديل لحظياً.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <input id="texts-search" type="text" placeholder="🔍 بحث في النصوص..." class="px-3 py-2 border rounded-lg text-sm w-56"/>
            <select id="texts-category" class="px-3 py-2 border rounded-lg text-sm">
              <option value="">📂 كل الفئات</option>
              <option value="welcome">ترحيب</option>
              <option value="menu">قوائم</option>
              <option value="grades">درجات</option>
              <option value="requests">طلبات</option>
              <option value="curriculum">مناهج</option>
              <option value="errors">أخطاء</option>
              <option value="moderation">إشراف</option>
              <option value="hints">تنبيهات</option>
              <option value="other">متفرقات</option>
            </select>
            <button onclick="loadBotTexts()" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm">
              <i class="fas fa-sync ml-1"></i> تحديث
            </button>
            <button onclick="resetBotTextsConfirm()" class="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-sm">
              <i class="fas fa-undo ml-1"></i> إعادة الافتراضات
            </button>
          </div>
        </div>
      </div>
      <div id="texts-grid" class="space-y-3"></div>
      <div id="texts-empty" class="hidden text-center text-slate-500 p-8">لا توجد نصوص مطابقة.</div>
    </div>

    <!-- Tab: Account -->
    <div class="tab-content" id="tab-account">
      <div class="bg-white p-6 rounded-xl shadow max-w-md">
        <h2 class="text-xl font-bold mb-4 text-slate-800"><i class="fas fa-user-cog ml-2"></i> إعدادات الحساب</h2>
        <form id="account-form" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold mb-1">كلمة المرور الحالية</label>
            <input type="password" name="current" required class="w-full px-3 py-2 border rounded-lg">
          </div>
          <div>
            <label class="block text-sm font-semibold mb-1">كلمة المرور الجديدة</label>
            <input type="password" name="new" required minlength="6" class="w-full px-3 py-2 border rounded-lg">
          </div>
          <div>
            <label class="block text-sm font-semibold mb-1">تأكيد كلمة المرور</label>
            <input type="password" name="confirm" required class="w-full px-3 py-2 border rounded-lg">
          </div>
          <button class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg w-full">
            <i class="fas fa-save ml-1"></i> حفظ
          </button>
        </form>
      </div>
    </div>

    <!-- Tab: Devices & Notifications -->
    <div class="tab-content" id="tab-devices">
      <div id="devices-content">
        <div class="text-center py-10 text-slate-500"><i class="fas fa-spinner fa-spin text-2xl"></i><p class="mt-2">جاري التحميل...</p></div>
      </div>
    </div>

    <!-- Tab: Admin Routing -->
    <div class="tab-content" id="tab-routing">
      <div id="routing-content">
        <div class="text-center py-10 text-slate-500"><i class="fas fa-spinner fa-spin text-2xl"></i><p class="mt-2">جاري التحميل...</p></div>
      </div>
    </div>

    <!-- Tab: Notifications Log -->
    <div class="tab-content" id="tab-notif-log">
      <div id="notif-log-content">
        <div class="text-center py-10 text-slate-500"><i class="fas fa-spinner fa-spin text-2xl"></i><p class="mt-2">جاري التحميل...</p></div>
      </div>
    </div>

    <!-- Tab: Academic Levels & Semesters -->
    <div class="tab-content" id="tab-academic">
      <div id="academic-content">
        <div class="text-center py-10 text-slate-500"><i class="fas fa-spinner fa-spin text-2xl"></i><p class="mt-2">جاري التحميل...</p></div>
      </div>
    </div>

  </main>
</div>

<!-- Modal -->
<div id="modal" class="hidden fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-3 backdrop-blur-sm">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden border border-slate-100">
    <div class="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
      <h3 id="modal-title" class="text-sm font-bold text-slate-800 flex items-center gap-2"></h3>
      <button onclick="closeModal()" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition">
        <i class="fas fa-times text-base"></i>
      </button>
    </div>
    <div id="modal-body" class="p-6 overflow-y-auto flex-1 text-sm leading-relaxed text-slate-700"></div>
  </div>
</div>

<!-- Toast -->
<div id="toast" class="fixed bottom-5 left-5 z-[200] hidden max-w-sm w-full">
  <div id="toast-msg" class="px-5 py-3.5 rounded-xl shadow-xl text-white font-bold text-xs flex items-center gap-2.5 border border-black/10"></div>
</div>

<!-- Sidebar Mobile Toggle Helper -->
<script>
  function toggleSidebar(forceState) {
    const sidebar = document.querySelector('aside.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;
    const isShowing = sidebar.classList.contains('show');
    const nextState = typeof forceState === 'boolean' ? forceState : !isShowing;
    if (nextState) {
      sidebar.classList.add('show');
      backdrop.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    } else {
      sidebar.classList.remove('show');
      backdrop.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) toggleSidebar(false);
  });
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth < 1024) setTimeout(() => toggleSidebar(false), 150);
      });
    });
  });
</script>

<script src="/static/admin.js"></script>
<script src="/static/admin-extra.js"></script>
<script src="/static/admin-texts.js"></script>
</body>
</html>`;
