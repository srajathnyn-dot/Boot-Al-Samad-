#!/usr/bin/env python3
"""
يستبدل تبويبَي 'قائمة البوت' و 'الأزرار الدائمة' بتبويب موحّد 'الأزرار',
ويستبدل تبويب الدرجات بنسخة محسّنة تدعم الرفع المتدفّق للملفات الكبيرة.
"""
import os, re

PATH = os.path.join(os.path.dirname(__file__), '..', 'src', 'admin', 'dashboard.tsx')

with open(PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# ========== 1) Sidebar links ==========
old_nav = (
    '      <a class="nav-item block px-4 py-3 rounded-lg cursor-pointer" data-tab="menu-items">\n'
    '        <i class="fas fa-list ml-2 w-5"></i> قائمة البوت\n'
    '      </a>\n'
    '      <a class="nav-item block px-4 py-3 rounded-lg cursor-pointer" data-tab="commands">\n'
    '        <i class="fas fa-terminal ml-2 w-5"></i> الأوامر المخصصة\n'
    '      </a>\n'
    '      <a class="nav-item block px-4 py-3 rounded-lg cursor-pointer" data-tab="reply-keyboard">\n'
    '        <i class="fas fa-keyboard ml-2 w-5"></i> الأزرار الدائمة\n'
    '      </a>\n'
)
new_nav = (
    '      <a class="nav-item block px-4 py-3 rounded-lg cursor-pointer" data-tab="buttons">\n'
    '        <i class="fas fa-shapes ml-2 w-5"></i> الأزرار (موحّد)\n'
    '      </a>\n'
    '      <a class="nav-item block px-4 py-3 rounded-lg cursor-pointer" data-tab="commands">\n'
    '        <i class="fas fa-terminal ml-2 w-5"></i> الأوامر المخصصة\n'
    '      </a>\n'
)
if old_nav not in content:
    raise SystemExit('Sidebar block not found verbatim')
content = content.replace(old_nav, new_nav, 1)

# ========== 2) Replace Menu-Items + Reply-Keyboard tab content with unified Buttons tab ==========
new_buttons_tab = '''    <!-- Tab: Unified Buttons (الأزرار الموحّدة) -->
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
'''

# Match Menu-Items tab block
pattern_mi = re.compile(
    r'    <!-- Tab: Menu Items[\s\S]*?</div>\n    </div>\n',
    re.MULTILINE
)
m = pattern_mi.search(content)
if not m:
    raise SystemExit('Menu Items tab block not found')
content = content[:m.start()] + new_buttons_tab + content[m.end():]

# Remove Reply Keyboard tab block (since unified)
pattern_rk = re.compile(
    r'    <!-- Tab: Reply Keyboard[\s\S]*?</div>\n    </div>\n',
    re.MULTILINE
)
m2 = pattern_rk.search(content)
if not m2:
    raise SystemExit('Reply Keyboard tab block not found')
content = content[:m2.start()] + content[m2.end():]

# ========== 3) Improve Grades tab: streaming upload + progress bar ==========
new_grades_tab = '''    <!-- Tab: Grades (الدرجات - رفع متدفّق للملفات الكبيرة) -->
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
            <b>الأعمدة المطلوبة:</b>
            <code class="bg-slate-100 px-1 rounded text-[11px] break-all">academic_id, student_name, college, level, semester, subject_name, attendance_score, participation_score, assignments_score, midterm_score, final_score, total_score, grade_label, credit_hours, is_remaining</code>
          </p>
        </div>
        <form id="grades-upload-form" class="space-y-3">
          <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input type="file" id="grades-csv" accept=".csv,text/csv" class="block flex-1 text-sm border rounded-lg px-3 py-2" required>
            <div class="flex items-center gap-2">
              <label class="text-xs whitespace-nowrap">حجم الدفعة:</label>
              <select id="grades-chunk-size" class="border rounded px-2 py-1 text-sm">
                <option value="200">200</option>
                <option value="500" selected>500</option>
                <option value="1000">1000</option>
                <option value="2000">2000</option>
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
'''

# Match old Grades tab block
pattern_gr = re.compile(
    r'    <!-- Tab: Grades[\s\S]*?</div>\n    </div>\n',
    re.MULTILINE
)
m3 = pattern_gr.search(content)
if not m3:
    raise SystemExit('Grades tab block not found')
content = content[:m3.start()] + new_grades_tab + content[m3.end():]

# ========== 4) Polish CSS - improve overall design (mobile responsiveness + better visuals) ==========
old_css_block = '''<style>
  body { font-family: 'Tajawal', sans-serif; background: #f1f5f9; }
  .sidebar { background: linear-gradient(180deg, #064e3b 0%, #065f46 100%); }
  .nav-item { transition: all 0.2s; }
  .nav-item:hover, .nav-item.active { background: rgba(255,255,255,0.15); }
  .stat-card { transition: transform 0.2s; }
  .stat-card:hover { transform: translateY(-3px); }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
  /* Mobile responsiveness */
  @media (max-width: 767px) {
    aside.sidebar { position: fixed; top: 0; right: 0; bottom: 0; height: 100vh; z-index: 60; overflow-y: auto; box-shadow: -4px 0 16px rgba(0,0,0,0.2); }
    aside.sidebar.hidden { display: none; }
    aside.sidebar:not(.hidden) { display: block; }
    main { width: 100%; padding: 0.75rem !important; }
    .stat-card { padding: 1rem !important; }
    table { font-size: 0.75rem; }
    h1, h2 { font-size: 1.05rem !important; }
    #modal > div { max-width: 95% !important; max-height: 95vh !important; }
    #modal input, #modal textarea, #modal select { font-size: 16px !important; /* تجنب الزووم تلقائي على iOS */ }
  }
  /* خلفية شفافة لإغلاق الشريط الجانبي على الجوال */
  .sidebar-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 55; }
</style>'''

new_css_block = '''<style>
  :root { --brand:#059669; --brand-d:#047857; --brand-l:#10b981; --bg:#f1f5f9; }
  * { -webkit-tap-highlight-color: transparent; }
  body { font-family: 'Tajawal', sans-serif; background: var(--bg); }
  .sidebar {
    background: linear-gradient(180deg, #064e3b 0%, #065f46 50%, #047857 100%);
    box-shadow: -4px 0 24px rgba(0,0,0,0.08);
  }
  .nav-item { transition: all .25s ease; border-radius: 10px; }
  .nav-item:hover { background: rgba(255,255,255,0.10); transform: translateX(-2px); }
  .nav-item.active {
    background: linear-gradient(90deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05));
    border-right: 3px solid #6ee7b7;
    box-shadow: inset 0 0 16px rgba(110,231,183,0.10);
  }
  .stat-card { transition: transform .25s ease, box-shadow .25s ease; }
  .stat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px -8px rgba(0,0,0,0.18); }
  .tab-content { display: none; animation: fadeIn .25s ease both; }
  .tab-content.active { display: block; }
  @keyframes fadeIn { from { opacity:0; transform: translateY(4px);} to { opacity:1; transform: none; } }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #64748b; }

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
  .placement-badge {
    font-size: 10px; padding: 2px 6px; border-radius: 4px;
    font-weight: 600;
  }

  /* Filter buttons */
  .filter-btn { transition: all .2s; }

  /* Toast positioning - safe insets */
  #toast { padding-top: env(safe-area-inset-top, 0); }

  /* === Mobile responsiveness (تحسين شامل) === */
  @media (max-width: 1023px) {
    /* hide desktop sidebar on tablet+phone — fixed instead */
    aside.sidebar.desktop-only { display: none; }
  }
  @media (max-width: 767px) {
    aside.sidebar {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: 80vw; max-width: 280px; height: 100vh; z-index: 60;
      overflow-y: auto; box-shadow: -4px 0 16px rgba(0,0,0,0.2);
      transform: translateX(100%); transition: transform .3s ease;
    }
    aside.sidebar.show { transform: translateX(0); }
    main { width: 100%; padding: 0.75rem !important; }
    .stat-card { padding: 1rem !important; }
    table { font-size: 0.75rem; }
    h1 { font-size: 1.15rem !important; }
    h2 { font-size: 1.05rem !important; }
    #modal > div { max-width: 95% !important; max-height: 95vh !important; }
    #modal input, #modal textarea, #modal select { font-size: 16px !important; /* تجنب الزووم تلقائي على iOS */ }
  }
  @media (min-width: 768px) {
    aside.sidebar { display: block !important; transform: none !important; }
  }

  /* خلفية شفافة لإغلاق الشريط الجانبي على الجوال */
  .sidebar-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.4);
    z-index: 55; backdrop-filter: blur(2px);
  }
  .sidebar-backdrop.hidden { display: none; }
</style>'''

if old_css_block not in content:
    raise SystemExit('CSS block not found')
content = content.replace(old_css_block, new_css_block, 1)

# ========== 5) Replace mobile-toggle button (better) and add backdrop ==========
old_mt = '''<!-- Mobile Toggle -->
<button id="mobile-toggle" class="md:hidden fixed bottom-4 left-4 bg-emerald-600 text-white p-3 rounded-full shadow-lg z-50">
  <i class="fas fa-bars"></i>
</button>'''
new_mt = '''<!-- Mobile Toggle + Backdrop -->
<button id="mobile-toggle" aria-label="فتح القائمة" class="md:hidden fixed top-3 right-3 bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-full shadow-lg z-50">
  <i class="fas fa-bars"></i>
</button>
<div id="sidebar-backdrop" class="sidebar-backdrop hidden md:hidden" onclick="toggleSidebar(false)"></div>'''
if old_mt in content:
    content = content.replace(old_mt, new_mt, 1)

# Add desktop-only class to default sidebar markup (so it shows on desktop, hidden on mobile by JS)
content = content.replace(
    '<aside class="sidebar w-64 text-white flex-shrink-0 hidden md:block">',
    '<aside class="sidebar w-64 text-white flex-shrink-0">',
    1
)

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print('OK dashboard patched')
