// ============================================
// admin-extra.js
// 1) واجهة الأزرار الموحّدة (Unified Buttons) — استبدال menu-items + reply-keyboard
// 2) الرفع المتدفّق لملفات CSV الكبيرة للدرجات (Streaming chunked upload)
// 3) محرّر الأوامر المخصّصة الموسّع (مع ربط زر/مكان)
// ============================================

// ---------- Helpers ----------
function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ====================================================================
// (1) Unified Buttons — التبويب الموحّد
// ====================================================================
const COLOR_PALETTE = [
  { key: 'emerald',  bg: '#059669', tw: 'bg-emerald-500' },
  { key: 'teal',     bg: '#0d9488', tw: 'bg-teal-500' },
  { key: 'sky',      bg: '#0284c7', tw: 'bg-sky-500' },
  { key: 'blue',     bg: '#2563eb', tw: 'bg-blue-500' },
  { key: 'indigo',   bg: '#4f46e5', tw: 'bg-indigo-500' },
  { key: 'purple',   bg: '#7c3aed', tw: 'bg-purple-500' },
  { key: 'rose',     bg: '#e11d48', tw: 'bg-rose-500' },
  { key: 'red',      bg: '#dc2626', tw: 'bg-red-500' },
  { key: 'amber',    bg: '#d97706', tw: 'bg-amber-500' },
  { key: 'orange',   bg: '#ea580c', tw: 'bg-orange-500' },
  { key: 'slate',    bg: '#475569', tw: 'bg-slate-600' },
  { key: 'gray',     bg: '#52525b', tw: 'bg-gray-600' },
];
const SIZE_OPTIONS = [
  { key: 'sm', label: 'صغير' },
  { key: 'md', label: 'وسط' },
  { key: 'lg', label: 'كبير' },
];
const PLACEMENTS = [
  { key: 'inline', label: 'قائمة شفافة (داخل الرسالة)', icon: 'fa-square-caret-down', desc: 'تظهر مع رسالة البوت كأزرار شفافة' },
  { key: 'reply',  label: 'لوحة دائمة (تحت الكتابة)',   icon: 'fa-keyboard',          desc: 'أزرار تظهر دائماً أسفل حقل إدخال الرسائل' },
  { key: 'both',   label: 'كلاهما',                     icon: 'fa-shapes',            desc: 'يظهر في القائمة الشفافة وفي اللوحة الدائمة' },
];
const ACTION_TYPES = [
  { key: 'builtin',    label: 'مدمج', placeholder: 'curriculum / grades / question / request / contact / about' },
  { key: 'command',    label: 'أمر مخصص (code)', placeholder: 'rules / about_college' },
  { key: 'curriculum', label: 'فتح المناهج', placeholder: 'curriculum' },
  { key: 'grades',     label: 'فتح الدرجات', placeholder: 'grades' },
  { key: 'menu',       label: 'فتح القائمة الرئيسية', placeholder: 'main' },
  { key: 'url',        label: 'رابط خارجي (URL)', placeholder: 'https://example.com' },
];

let _buttonsCache = [];
let _buttonsFilter = 'all';
let _customCommandsCache = [];

async function loadButtons() {
  try {
    const r = await axios.get('/admin/api/unified-buttons');
    _buttonsCache = r.data.buttons || [];
  } catch (e) {
    _buttonsCache = [];
  }
  // Cache custom commands for quick selection
  try {
    const c = await axios.get('/admin/api/commands');
    _customCommandsCache = c.data.commands || c.data.items || [];
  } catch (_) { _customCommandsCache = []; }

  renderButtonsList();
  renderButtonsPreview();

  // Setup filter handlers (idempotent)
  document.querySelectorAll('#buttons-filter .filter-btn').forEach((btn) => {
    btn.onclick = () => {
      _buttonsFilter = btn.dataset.filter;
      document.querySelectorAll('#buttons-filter .filter-btn').forEach((b) => {
        b.classList.remove('bg-emerald-500', 'text-white');
        b.classList.add('bg-white', 'text-slate-700');
      });
      btn.classList.add('bg-emerald-500', 'text-white');
      btn.classList.remove('bg-white', 'text-slate-700');
      renderButtonsList();
      renderButtonsPreview();
    };
  });
}

function _filterButtons() {
  if (_buttonsFilter === 'all') return _buttonsCache;
  if (_buttonsFilter === 'inline') return _buttonsCache.filter((b) => b.placement === 'inline' || b.placement === 'both');
  if (_buttonsFilter === 'reply')  return _buttonsCache.filter((b) => b.placement === 'reply'  || b.placement === 'both');
  if (_buttonsFilter === 'both')   return _buttonsCache.filter((b) => b.placement === 'both');
  return _buttonsCache;
}

function _placementBadge(p) {
  if (p === 'inline') return '<span class="placement-badge bg-blue-100 text-blue-700"><i class="fas fa-square-caret-down"></i> قائمة شفافة</span>';
  if (p === 'reply')  return '<span class="placement-badge bg-emerald-100 text-emerald-700"><i class="fas fa-keyboard"></i> لوحة دائمة</span>';
  if (p === 'both')   return '<span class="placement-badge bg-purple-100 text-purple-700"><i class="fas fa-shapes"></i> كلاهما</span>';
  return '';
}

function renderButtonsList() {
  const list = document.getElementById('buttons-list');
  if (!list) return;
  const items = _filterButtons();
  if (!items.length) {
    list.innerHTML = '<p class="text-slate-500 text-center py-8">لا توجد أزرار. اضغط <b>إضافة زر جديد</b> للبدء.</p>';
    return;
  }
  list.innerHTML = items.map((b) => {
    const color = COLOR_PALETTE.find((c) => c.key === b.color) || COLOR_PALETTE[0];
    return `
    <div class="border rounded-lg p-3 hover:bg-slate-50 flex justify-between items-start flex-wrap gap-2">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-white text-sm font-bold" style="background:${color.bg}">
            ${b.emoji ? _esc(b.emoji) + ' ' : ''}${_esc(b.text)}
          </span>
          ${_placementBadge(b.placement)}
          ${b.is_admin_only ? '<span class="placement-badge bg-orange-100 text-orange-700">مشرفون فقط</span>' : ''}
          ${b.is_active ? '' : '<span class="placement-badge bg-slate-200 text-slate-600">معطّل</span>'}
          ${b.full_width ? '<span class="placement-badge bg-slate-100 text-slate-600">عرض كامل</span>' : ''}
        </div>
        <p class="text-xs text-slate-500">
          إجراء: <b>${_esc(b.action_type)}</b> →
          <code class="bg-slate-100 px-1 rounded">${_esc(b.action_value)}</code>
          · ترتيب: ${b.display_order || 0}
          ${b.placement !== 'inline' ? `· صف ${b.row_index || 0}/عمود ${b.col_index || 0}` : ''}
        </p>
      </div>
      <div class="flex gap-1 flex-shrink-0">
        <button onclick='editButton(${JSON.stringify(b).replace(/'/g, "&#39;")})' class="text-blue-500 px-2" title="تعديل">
          <i class="fas fa-edit"></i>
        </button>
        <button onclick="toggleButtonActive(${b.id}, ${b.is_active ? 0 : 1})" class="text-${b.is_active ? 'orange' : 'green'}-500 px-2" title="${b.is_active ? 'تعطيل' : 'تفعيل'}">
          <i class="fas fa-${b.is_active ? 'pause' : 'play'}"></i>
        </button>
        <button onclick="deleteButton(${b.id})" class="text-red-500 px-2" title="حذف">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>`;
  }).join('');
}

function renderButtonsPreview() {
  const inlineBox = document.getElementById('buttons-preview-inline');
  const replyBox = document.getElementById('buttons-preview-reply');
  if (!inlineBox || !replyBox) return;

  const inlineItems = _buttonsCache
    .filter((b) => b.is_active && (b.placement === 'inline' || b.placement === 'both'))
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  const replyItems = _buttonsCache
    .filter((b) => b.is_active && (b.placement === 'reply' || b.placement === 'both'))
    .sort((a, b) => ((a.row_index || 0) * 100 + (a.col_index || 0)) - ((b.row_index || 0) * 100 + (b.col_index || 0)));

  // Render inline preview
  if (!inlineItems.length) {
    inlineBox.innerHTML = '<p class="text-xs text-slate-400 italic">لا توجد أزرار شفافة مفعّلة</p>';
  } else {
    inlineBox.innerHTML = `
      <div class="text-xs text-slate-600 mb-1 font-bold"><i class="fas fa-square-caret-down ml-1 text-blue-500"></i> القائمة الشفافة (داخل الرسالة):</div>
      <div class="bg-white border rounded-lg p-3">
        ${inlineItems.map((b) => {
          const color = COLOR_PALETTE.find((c) => c.key === b.color) || COLOR_PALETTE[0];
          const sizeCls = b.size === 'sm' ? 'text-xs px-3 py-1' : b.size === 'lg' ? 'text-base px-5 py-3' : 'text-sm px-4 py-2';
          return `<span class="preview-inline-btn ${sizeCls}" style="background:${color.bg}">${b.emoji ? _esc(b.emoji) + ' ' : ''}${_esc(b.text)}</span>`;
        }).join('')}
      </div>`;
  }

  // Render reply preview as keyboard rows
  if (!replyItems.length) {
    replyBox.innerHTML = '<p class="text-xs text-slate-400 italic">لا توجد أزرار دائمة مفعّلة</p>';
  } else {
    const rows = new Map();
    for (const b of replyItems) {
      const r = b.row_index || 0;
      if (!rows.has(r)) rows.set(r, []);
      rows.get(r).push(b);
    }
    const sorted = [...rows.entries()].sort((a, b) => a[0] - b[0]);
    replyBox.innerHTML = `
      <div class="text-xs text-slate-600 mb-1 font-bold"><i class="fas fa-keyboard ml-1 text-emerald-500"></i> اللوحة الدائمة (تحت الكتابة):</div>
      <div class="bg-slate-100 border rounded-lg p-2 space-y-1">
        ${sorted.map(([_, arr]) => `
          <div class="flex flex-wrap gap-1 justify-center">
            ${arr.map((b) => `<span class="preview-reply-btn flex-1 text-center">${b.emoji ? _esc(b.emoji) + ' ' : ''}${_esc(b.text)}</span>`).join('')}
          </div>
        `).join('')}
      </div>`;
  }
}

function openButtonModal(item) {
  const it = item || {
    id: '', text: '', icon: '', emoji: '', placement: 'inline',
    action_type: 'builtin', action_value: 'curriculum',
    row_index: 0, col_index: 0, display_order: 0,
    color: 'emerald', size: 'md', full_width: 0,
    is_active: 1, is_admin_only: 0, show_in_groups: 0,
  };

  const colorOptions = COLOR_PALETTE.map((c) =>
    `<label class="cursor-pointer">
       <input type="radio" name="color" value="${c.key}" ${it.color === c.key ? 'checked' : ''} class="sr-only peer">
       <span class="block w-8 h-8 rounded-lg border-2 border-transparent peer-checked:border-slate-900 peer-checked:scale-110 transition" style="background:${c.bg}"></span>
     </label>`
  ).join('');

  const sizeOptions = SIZE_OPTIONS.map((s) =>
    `<label class="cursor-pointer flex-1">
       <input type="radio" name="size" value="${s.key}" ${it.size === s.key ? 'checked' : ''} class="sr-only peer">
       <span class="block text-center px-3 py-2 border rounded-lg text-sm peer-checked:bg-emerald-500 peer-checked:text-white peer-checked:border-emerald-500">${s.label}</span>
     </label>`
  ).join('');

  const placementOptions = PLACEMENTS.map((p) =>
    `<label class="cursor-pointer flex-1 min-w-[140px]">
       <input type="radio" name="placement" value="${p.key}" ${it.placement === p.key ? 'checked' : ''} class="sr-only peer" onchange="onPlacementChange()">
       <span class="block px-3 py-3 border-2 rounded-lg text-center peer-checked:border-emerald-500 peer-checked:bg-emerald-50">
         <i class="fas ${p.icon} text-lg block mb-1"></i>
         <span class="text-xs font-bold block">${p.label}</span>
         <span class="text-[10px] text-slate-500 block mt-1">${p.desc}</span>
       </span>
     </label>`
  ).join('');

  const actionTypeOptions = ACTION_TYPES.map((a) =>
    `<option value="${a.key}" ${it.action_type === a.key ? 'selected' : ''}>${a.label}</option>`
  ).join('');

  // commands list helper
  const cmdsList = [
    { v: 'curriculum', l: 'فتح المناهج' },
    { v: 'grades', l: 'فتح الدرجات' },
    { v: 'question', l: 'تقديم سؤال' },
    { v: 'request', l: 'تقديم طلب' },
    { v: 'contact', l: 'التواصل' },
    { v: 'about', l: 'عن الكلية' },
    { v: 'main', l: 'القائمة الرئيسية' },
    ..._customCommandsCache.map(c => ({ v: c.code, l: `/${c.code} — ${c.title || ''}` }))
  ].map(o => `<option value="${_esc(o.v)}">${_esc(o.l)}</option>`).join('');

  openModal(it.id ? 'تعديل زر' : 'إضافة زر جديد', `
    <form id="btn-form" class="space-y-4">
      <input type="hidden" name="id" value="${it.id || ''}">

      <!-- Section 1: Content -->
      <fieldset class="border rounded-lg p-3">
        <legend class="px-2 text-sm font-bold text-emerald-700"><i class="fas fa-pencil ml-1"></i> المحتوى</legend>
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-3 sm:col-span-1">
            <label class="block text-xs font-semibold mb-1">إيموجي</label>
            <input type="text" name="emoji" maxlength="4" value="${_esc(it.emoji || '')}" class="w-full px-2 py-2 border rounded-lg text-center text-lg" placeholder="📚">
          </div>
          <div class="col-span-3 sm:col-span-2">
            <label class="block text-xs font-semibold mb-1">نص الزر <span class="text-red-500">*</span></label>
            <input type="text" name="text" required value="${_esc(it.text)}" class="w-full px-3 py-2 border rounded-lg" placeholder="المناهج الدراسية">
          </div>
        </div>
      </fieldset>

      <!-- Section 2: Placement -->
      <fieldset class="border rounded-lg p-3">
        <legend class="px-2 text-sm font-bold text-emerald-700"><i class="fas fa-location-dot ml-1"></i> مكان الظهور</legend>
        <div class="flex flex-wrap gap-2">${placementOptions}</div>
      </fieldset>

      <!-- Section 3: Action -->
      <fieldset class="border rounded-lg p-3">
        <legend class="px-2 text-sm font-bold text-emerald-700"><i class="fas fa-bolt ml-1"></i> الإجراء</legend>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold mb-1">نوع الإجراء</label>
            <select name="action_type" id="bf-action-type" class="w-full px-3 py-2 border rounded-lg" onchange="onActionTypeChange()">
              ${actionTypeOptions}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold mb-1">القيمة <span class="text-red-500">*</span></label>
            <input type="text" name="action_value" id="bf-action-value" required value="${_esc(it.action_value)}" class="w-full px-3 py-2 border rounded-lg" list="bf-cmd-list">
            <datalist id="bf-cmd-list">${cmdsList}</datalist>
            <p class="text-[10px] text-slate-500 mt-1" id="bf-action-hint"></p>
          </div>
        </div>
      </fieldset>

      <!-- Section 4: Style -->
      <fieldset class="border rounded-lg p-3">
        <legend class="px-2 text-sm font-bold text-emerald-700"><i class="fas fa-palette ml-1"></i> الستايل</legend>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-semibold mb-1">اللون</label>
            <div class="flex flex-wrap gap-2">${colorOptions}</div>
          </div>
          <div>
            <label class="block text-xs font-semibold mb-1">الحجم</label>
            <div class="flex gap-2">${sizeOptions}</div>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" name="full_width" value="1" ${it.full_width ? 'checked' : ''}>
            <span>زر بعرض كامل (يأخذ صفاً منفرداً)</span>
          </label>
        </div>
      </fieldset>

      <!-- Section 5: Order/Position -->
      <fieldset class="border rounded-lg p-3" id="bf-position-fs">
        <legend class="px-2 text-sm font-bold text-emerald-700"><i class="fas fa-sort ml-1"></i> الترتيب والموقع</legend>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-semibold mb-1">ترتيب العرض</label>
            <input type="number" name="display_order" value="${it.display_order || 0}" class="w-full px-3 py-2 border rounded-lg">
          </div>
          <div>
            <label class="block text-xs font-semibold mb-1">رقم الصف</label>
            <input type="number" name="row_index" value="${it.row_index || 0}" class="w-full px-3 py-2 border rounded-lg">
          </div>
          <div>
            <label class="block text-xs font-semibold mb-1">رقم العمود</label>
            <input type="number" name="col_index" value="${it.col_index || 0}" class="w-full px-3 py-2 border rounded-lg">
          </div>
        </div>
      </fieldset>

      <!-- Section 6: Visibility -->
      <fieldset class="border rounded-lg p-3">
        <legend class="px-2 text-sm font-bold text-emerald-700"><i class="fas fa-eye ml-1"></i> الظهور</legend>
        <div class="flex gap-4 flex-wrap">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" value="1" ${it.is_active ? 'checked' : ''}>
            <span>مفعّل</span>
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_admin_only" value="1" ${it.is_admin_only ? 'checked' : ''}>
            <span>للمشرفين فقط</span>
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" name="show_in_groups" value="1" ${it.show_in_groups ? 'checked' : ''}>
            <span>إظهار في المجموعات</span>
          </label>
        </div>
      </fieldset>

      <button class="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-lg font-bold">
        <i class="fas fa-save ml-1"></i> حفظ
      </button>
    </form>
  `);

  // Initial dynamic helpers
  setTimeout(() => { onActionTypeChange(); onPlacementChange(); }, 0);

  document.getElementById('btn-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd);
    obj.is_active = obj.is_active ? 1 : 0;
    obj.is_admin_only = obj.is_admin_only ? 1 : 0;
    obj.show_in_groups = obj.show_in_groups ? 1 : 0;
    obj.full_width = obj.full_width ? 1 : 0;
    obj.display_order = Number(obj.display_order || 0);
    obj.row_index = Number(obj.row_index || 0);
    obj.col_index = Number(obj.col_index || 0);
    try {
      if (obj.id) {
        await axios.post(`/admin/api/unified-buttons/${obj.id}`, obj);
      } else {
        await axios.post('/admin/api/unified-buttons', obj);
      }
      closeModal();
      toast('تم الحفظ');
      loadButtons();
    } catch (err) {
      toast(err.response?.data?.error || 'فشل الحفظ', 'error');
    }
  };
}

function onActionTypeChange() {
  const t = document.getElementById('bf-action-type')?.value;
  const hint = document.getElementById('bf-action-hint');
  const a = ACTION_TYPES.find((x) => x.key === t);
  const valInp = document.getElementById('bf-action-value');
  if (a && valInp && hint) {
    valInp.placeholder = a.placeholder;
    if (t === 'command') {
      hint.textContent = 'أدخل code الأمر المخصّص (يُمكن اختياره من القائمة).';
    } else if (t === 'url') {
      hint.textContent = 'أدخل رابطاً يبدأ بـ https://';
    } else if (t === 'builtin') {
      hint.textContent = 'القيم الجاهزة: curriculum / grades / question / request / contact / about';
    } else {
      hint.textContent = '';
    }
  }
}

function onPlacementChange() {
  const placement = document.querySelector('input[name=placement]:checked')?.value;
  const fs = document.getElementById('bf-position-fs');
  if (!fs) return;
  const labels = fs.querySelectorAll('label');
  // إن كان inline فقط، الصف/العمود غير مهمّان (ترتيب فقط)
  if (placement === 'inline') {
    labels[1].style.opacity = '0.5';
    labels[2].style.opacity = '0.5';
  } else {
    labels[1].style.opacity = '1';
    labels[2].style.opacity = '1';
  }
}

function editButton(b) { openButtonModal(b); }
async function deleteButton(id) {
  if (!confirm('حذف هذا الزر؟')) return;
  try {
    await axios.delete(`/admin/api/unified-buttons/${id}`);
    toast('تم الحذف');
    loadButtons();
  } catch (e) { toast('فشل الحذف', 'error'); }
}
async function toggleButtonActive(id, newVal) {
  try {
    await axios.post(`/admin/api/unified-buttons/${id}`, { is_active: newVal });
    loadButtons();
  } catch (e) { toast('فشل', 'error'); }
}

// ====================================================================
// (2) Streaming Grades CSV Upload
// ====================================================================
let _gradesUploadCancelled = false;
let _gradesUploadInProgress = false;

async function loadGradesStats() {
  try {
    const r = await axios.get('/admin/api/grades/count');
    if (r.data.ok) {
      const total = document.getElementById('grades-stat-total');
      const stu = document.getElementById('grades-stat-students');
      const sem = document.getElementById('grades-stat-semesters');
      if (total) total.textContent = r.data.total.toLocaleString('ar');
      if (stu) stu.textContent = r.data.students.toLocaleString('ar');
      if (sem) sem.textContent = r.data.semesters.toLocaleString('ar');
    }
  } catch (_) {}
}

// CSV streaming parser using FileReader on slices (works for files up to ~1GB safely)
async function* csvLineStream(file, chunkBytes = 2 * 1024 * 1024) {
  const decoder = new TextDecoder('utf-8');
  let offset = 0;
  let leftover = '';
  while (offset < file.size) {
    if (_gradesUploadCancelled) return;
    const slice = file.slice(offset, offset + chunkBytes);
    const buf = await slice.arrayBuffer();
    const text = decoder.decode(buf, { stream: offset + chunkBytes < file.size });
    offset += chunkBytes;
    const combined = leftover + text;
    const lines = combined.split(/\r?\n/);
    leftover = lines.pop() || '';
    for (const ln of lines) {
      if (ln.length) yield ln;
    }
  }
  if (leftover.length) yield leftover;
}

function parseCsvLine(line, sep) {
  // CSV parser supporting quoted fields and configurable separator (default ',' or ';')
  const SEP = sep || ',';
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === SEP) { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// Detect separator (',' or ';') by counting on the header line
function detectCsvSeparator(line) {
  if (!line) return ',';
  const semi = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  const tab = (line.match(/\t/g) || []).length;
  if (semi >= comma && semi > 0) return ';';
  if (tab > comma && tab > semi) return '\t';
  return ',';
}

// خريطة شاملة لأسماء الأعمدة العربية إلى الإنجليزية
// تدعم تنسيق ملف الدرجات الفعلي: "الرقم الأكاديمي;اسم الطالب;الرقم السري;اسم الفرع;معرف الفرع;..."
const ARABIC_COLUMN_MAP = {
  // الرقم/الهوية
  'الرقم الأكاديمي': 'academic_id',
  'الرقم الاكاديمي': 'academic_id',
  'الرقم السري': 'secret_code',
  'اسم الطالب': 'student_name',
  'الكلية': 'college',
  // الفرع
  'اسم الفرع': 'branch_name',
  'الفرع': 'branch_name',
  'معرف الفرع': 'branch_id',
  'id_الفرع': 'branch_id',
  // العام/الفصل
  'العام الدراسي': 'academic_year',
  'الفصل الدراسي': 'semester',
  'معرف الفصل': 'semester_id',
  'id_الفصل الدراسي': 'semester_id',
  'المستوى': 'level',
  'التخصص': 'specialization',
  // المادة
  'المادة': 'subject_name',
  'اسم المادة': 'subject_name',
  'معرف المادة': 'subject_id',
  'id_المادة': 'subject_id',
  // المجموعة
  'المجموعة': 'group_name',
  'الشعبة': 'group_name',
  'معرف المجموعة': 'group_id',
  'id_الشعبة': 'group_id',
  // معلومات إضافية
  'نوع السكن': 'housing_type',
  'مطلوب استبيان': 'survey_required',
  'الزامية الاستبيان': 'survey_required',
  'المرفقات': 'attachments',
  'مرفقات': 'attachments',
  // الدرجات الأساسية
  'حضور': 'attendance_score',
  'الحضور': 'attendance_score',
  'مشاركة': 'participation_score',
  'المشاركة': 'participation_score',
  'تكاليف': 'assignments_score',
  'التكاليف': 'assignments_score',
  'الواجبات': 'assignments_score',
  // النصفي/النهائي - نظري وعملي
  'نظري نصفي': 'theory_midterm',
  'النصفي نظري': 'theory_midterm',
  'عملي نصفي': 'practical_midterm',
  'النصفي عملي': 'practical_midterm',
  'نظري نهائي': 'theory_final',
  'النهائي نظري': 'theory_final',
  'عملي نهائي': 'practical_final',
  'النهائي عملي': 'practical_final',
  'النصفي': 'midterm_score',
  'النهائي': 'final_score',
  // الشفهي
  'شفهي تلاوة نصفي': 'oral_recitation_mid',
  'الشفهي تلاوة نصفي': 'oral_recitation_mid',
  'شفهي حفظ نصفي': 'oral_memorize_mid',
  'الشفهي حفظ نصفي': 'oral_memorize_mid',
  'شفهي تلاوة نهائي': 'oral_recitation_final',
  'الشفهي تلاوة نهائي': 'oral_recitation_final',
  'شفهي حفظ نهائي': 'oral_memorize_final',
  'الشفهي حفظ نهائي': 'oral_memorize_final',
  // الخطبة
  'كتابة خطبة': 'khutbah_writing',
  'كتابة الخطبة': 'khutbah_writing',
  'إلقاء في القاعة': 'hall_delivery',
  'الإلقاء بقاعة الدرس': 'hall_delivery',
  'الالقاء بقاعة الدرس': 'hall_delivery',
  // معايير الإلقاء
  'الافتتاح': 'opening_score',
  'الافتتاحية': 'opening_score',
  'حركة اليدين': 'hand_movement',
  'الملابس': 'clothing_score',
  'الزي': 'clothing_score',
  'درجة الصوت': 'voice_level',
  'مستوى الصوت': 'voice_level',
  'الانسجام مع الموضوع': 'topic_consistency',
  'الترابط مع الموضوع': 'topic_consistency',
  'مستوى الثقة': 'confidence_level',
  'الثقة بالنفس': 'confidence_level',
  'التأثير والاقناع': 'influence_score',
  'التأثير والإقناع': 'influence_score',
  'التأثير في المتلقي': 'influence_score',
  'التحضير': 'preparation_score',
  'التحضير الجيد': 'preparation_score',
  'التلخيص': 'summarization_score',
  'وحدة الموضوع': 'topic_unity',
  'كتابة خطب': 'khutbah_writing2',
  'كتابة الخطبة 2': 'khutbah_writing2',
  'خاطر أو خطبة في مسجد': 'khutbah_in_mosque',
  'خطر أو خطبة في مسجد': 'khutbah_in_mosque',
  'الخطابة في المسجد': 'khutbah_in_mosque',
  // النتيجة
  'الترفيع': 'promotion_status',
  'المجموع': 'total_score',
  'التقدير': 'grade_label',
  'الساعات المعتمدة': 'credit_hours',
  'bitdaragat3': 'bitdaragat3',
  'id_daragat': 'id_daragat',
  'احتساب المادة': 'subject_counted',
  'مبقي': 'is_remaining',
  'درجة النجاح': 'passing_score',
  'تبع القرآن': 'follows_quran',
  'تتبع القرآن': 'follows_quran',
};

function normalizeHeader(h) {
  if (!h) return '';
  // Remove BOM, trim, and any non-printable characters
  let s = String(h).replace(/^\uFEFF/, '').replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
  
  // Try direct map first (Arabic preserved as-is)
  if (ARABIC_COLUMN_MAP[s]) return ARABIC_COLUMN_MAP[s];
  
  // Try cleaning common Arabic variations (spaces, different 'alef', etc.)
  const clean = s.replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
  for (const [key, val] of Object.entries(ARABIC_COLUMN_MAP)) {
    const cleanKey = key.replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
    if (clean === cleanKey) return val;
  }

  // Fallback: lowercase for ASCII headers
  const low = s.toLowerCase();
  if (ARABIC_COLUMN_MAP[low]) return ARABIC_COLUMN_MAP[low];
  return low;
}

function _setProgress(pct, label, stats) {
  const bar = document.getElementById('grades-progress-bar');
  const pctEl = document.getElementById('grades-progress-percent');
  const lab = document.getElementById('grades-progress-label');
  if (bar) bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  if (pctEl) pctEl.textContent = `${pct.toFixed(1)}%`;
  if (lab && label) lab.textContent = label;
  if (stats) {
    const r = document.getElementById('grades-pg-read');
    const s = document.getElementById('grades-pg-sent');
    const f = document.getElementById('grades-pg-failed');
    const sp = document.getElementById('grades-pg-speed');
    const eta = document.getElementById('grades-pg-eta');
    if (r) r.textContent = stats.read.toLocaleString('ar');
    if (s) s.textContent = stats.sent.toLocaleString('ar');
    if (f) f.textContent = stats.failed.toLocaleString('ar');
    if (sp) sp.textContent = stats.speed.toLocaleString('ar');
    if (eta) eta.textContent = stats.eta;
  }
}

async function startGradesUpload(e) {
  e.preventDefault();
  if (_gradesUploadInProgress) return toast('هناك عملية رفع جارية', 'error');

  const fileInp = document.getElementById('grades-csv');
  const file = fileInp.files[0];
  if (!file) return toast('اختر ملف CSV', 'error');

  const replace = document.getElementById('grades-replace').checked;
  const chunkSize = Number(document.getElementById('grades-chunk-size').value || 500);
  const maxMB = 1024;
  if (file.size > maxMB * 1024 * 1024) {
    return toast(`الملف يتجاوز ${maxMB}MB`, 'error');
  }

  // UI: lock form, show progress
  _gradesUploadCancelled = false;
  _gradesUploadInProgress = true;
  document.getElementById('grades-upload-btn').disabled = true;
  document.getElementById('grades-cancel-btn').classList.remove('hidden');
  document.getElementById('grades-progress-box').classList.remove('hidden');
  document.getElementById('grades-upload-result').innerHTML = '';
  document.getElementById('grades-stat-job').textContent = 'يقرأ...';

  const startedAt = Date.now();
  let read = 0, sent = 0, failed = 0;

  // 1) init upload session
  let token;
  try {
    const r = await axios.post('/admin/api/grades/upload/init', { replace, total_chunks: 0 });
    token = r.data.upload_token;
    if (!token) throw new Error('فشل بدء الرفع');
  } catch (err) {
    toast(err.response?.data?.error || 'فشل بدء الرفع', 'error');
    _resetGradesUploadUI();
    return;
  }

  // 2) stream CSV → batch → POST chunks (مع إعادة محاولة ومعالجة قوية للأخطاء)
  try {
    let header = null;
    let csvSep = ','; // فاصل CSV المحفوظ في scope الدالة بدلاً من this
    let buffer = [];
    let pendingChunks = 0;       // عدد الـ chunks الجارية حالياً
    const MAX_CONCURRENT = 2;    // الحد الأقصى للـ chunks المتوازية (لا نحمّل الـDB أكثر مما تستوعب)
    const MAX_RETRIES = 5;       // عدد محاولات الإعادة لكل chunk
    const RETRY_DELAY_MS = 1500; // مهلة بين المحاولات (تتضاعف)
    let chunkSeq = 0;
    let lastFlushError = null;

    // وظيفة الانتظار حتى ينخفض عدد الـ chunks المتوازية
    const waitForSlot = async () => {
      while (pendingChunks >= MAX_CONCURRENT && !_gradesUploadCancelled) {
        await new Promise((r) => setTimeout(r, 50));
      }
    };

    // الإرسال مع retry تلقائي عند فشل الشبكة
    const sendChunkWithRetry = async (rows, seq) => {
      let attempt = 0;
      let delay = RETRY_DELAY_MS;
      while (attempt < MAX_RETRIES) {
        if (_gradesUploadCancelled) return { inserted: 0, failed: rows.length };
        try {
          const r = await axios.post('/admin/api/grades/upload/chunk',
            { upload_token: token, rows },
            { timeout: 120000 }  // 2 دقيقة timeout لكل chunk
          );
          return { inserted: r.data.inserted || 0, failed: r.data.failed || 0 };
        } catch (err) {
          attempt++;
          lastFlushError = err;
          const status = err.response?.status;
          // إذا الخطأ 4xx (ما عدا 429) → لا نعيد المحاولة
          if (status && status >= 400 && status < 500 && status !== 429) {
            console.error(`[chunk ${seq}] HTTP ${status}:`, err.response?.data);
            return { inserted: 0, failed: rows.length };
          }
          // 5xx, 429, network → retry مع backoff
          if (attempt < MAX_RETRIES) {
            console.warn(`[chunk ${seq}] فشلت المحاولة ${attempt}/${MAX_RETRIES}، إعادة بعد ${delay}ms`);
            await new Promise((r) => setTimeout(r, delay));
            delay = Math.min(delay * 2, 15000); // exponential backoff (حد أقصى 15ث)
          }
        }
      }
      console.error(`[chunk ${seq}] فشل نهائي بعد ${MAX_RETRIES} محاولات`);
      return { inserted: 0, failed: rows.length };
    };

    // إرسال chunk (غير متزامن - يعمل في الخلفية مع إدارة عدد المتوازي)
    const flushChunk = async (rowsToSend) => {
      if (!rowsToSend.length || _gradesUploadCancelled) return;
      const seq = ++chunkSeq;
      pendingChunks++;
      try {
        const res = await sendChunkWithRetry(rowsToSend, seq);
        sent += res.inserted;
        failed += res.failed;
      } finally {
        pendingChunks--;
      }
      // تحديث شريط التقدم بعد كل chunk
      const pct = (bytesProcessed / file.size) * 100;
      const elapsed = Math.max(0.1, (Date.now() - startedAt) / 1000);
      const speed = Math.round(read / elapsed);
      const eta = pct > 0 && pct < 100
        ? `الوقت المتبقّي: ~${Math.max(0, Math.round((100 - pct) / Math.max(0.1, pct / elapsed)))} ثانية`
        : '';
      _setProgress(Math.min(99.5, pct), 'جاري الرفع...', { read, sent, failed, speed, eta });
    };

    // إرسال buffer (يحجز slot ثم يبدأ الإرسال بدون انتظار النتيجة)
    const flush = async () => {
      if (!buffer.length || _gradesUploadCancelled) return;
      const rows = buffer.splice(0);
      // ننتظر حتى يتوفر slot قبل بدء chunk جديد
      await waitForSlot();
      if (_gradesUploadCancelled) return;
      // ابدأ الإرسال في الخلفية (بدون await هنا)
      flushChunk(rows).catch((e) => console.error('flushChunk error:', e));
    };

    // قراءة الملف بشرائح (نقرأ شريحة أكبر للحصول على إنتاجية أعلى)
    let bytesProcessed = 0;
    const decoder = new TextDecoder('utf-8');
    const SLICE = 2 * 1024 * 1024; // 2MB لكل قراءة
    let offset = 0;
    let leftover = '';

    while (offset < file.size) {
      if (_gradesUploadCancelled) break;
      const slice = file.slice(offset, offset + SLICE);
      const buf = await slice.arrayBuffer();
      const isLast = (offset + SLICE >= file.size);
      const text = decoder.decode(buf, { stream: !isLast });
      offset += SLICE;
      bytesProcessed = Math.min(offset, file.size);
      const combined = leftover + text;
      const lines = combined.split(/\r?\n/);
      leftover = isLast ? '' : (lines.pop() || '');

      for (const ln of lines) {
        if (!ln.trim()) continue;
        if (!header) {
          // اكتشاف الفاصل من سطر الترويسة
          csvSep = detectCsvSeparator(ln);
          header = parseCsvLine(ln, csvSep).map((h) => normalizeHeader(h));
          continue;
        }
        const cols = parseCsvLine(ln, csvSep);
        const obj = {};
        for (let i = 0; i < header.length; i++) {
          const key = header[i];
          if (!key) continue;
          obj[key] = cols[i] != null ? String(cols[i]).trim() : '';
        }
        // تطبيع قيمة "مبقي"
        if (obj.is_remaining != null && obj.is_remaining !== '') {
          const v = String(obj.is_remaining).trim().toLowerCase();
          obj.is_remaining = (v === '1' || v === 'true' || v === 'نعم' || v === 'yes') ? 1 : 0;
        }
        buffer.push(obj);
        read++;
        if (buffer.length >= chunkSize) {
          await flush();
        }
      }
      // تحديث شريط التقدم بين الشرائح (نسبة البايتات)
      const pct = (bytesProcessed / file.size) * 100;
      const elapsed = Math.max(0.1, (Date.now() - startedAt) / 1000);
      const speed = Math.round(read / elapsed);
      _setProgress(Math.min(99, pct), 'يقرأ ويرفع...', { read, sent, failed, speed, eta: '' });
    }

    // معالجة آخر سطر متبقٍ
    if (leftover && leftover.trim() && !_gradesUploadCancelled) {
      const cols = parseCsvLine(leftover, csvSep);
      if (header) {
        const obj = {};
        for (let i = 0; i < header.length; i++) {
          const key = header[i];
          if (!key) continue;
          obj[key] = cols[i] != null ? String(cols[i]).trim() : '';
        }
        if (obj.is_remaining != null && obj.is_remaining !== '') {
          const v = String(obj.is_remaining).trim().toLowerCase();
          obj.is_remaining = (v === '1' || v === 'true' || v === 'نعم' || v === 'yes') ? 1 : 0;
        }
        buffer.push(obj);
        read++;
      }
    }
    if (buffer.length && !_gradesUploadCancelled) await flush();

    // ⏳ الانتظار حتى تنتهي كل الـ chunks الجارية في الخلفية
    while (pendingChunks > 0 && !_gradesUploadCancelled) {
      await new Promise((r) => setTimeout(r, 100));
      // تحديث الشريط بدون تحريك النسبة
      const elapsed = Math.max(0.1, (Date.now() - startedAt) / 1000);
      const speed = Math.round(read / elapsed);
      _setProgress(99.5, `إنهاء... (متبقي ${pendingChunks} دفعة)`, {
        read, sent, failed, speed, eta: ''
      });
    }

    if (_gradesUploadCancelled) {
      toast('تم إلغاء الرفع', 'info');
      document.getElementById('grades-upload-result').innerHTML =
        `<div class="bg-orange-50 text-orange-800 border border-orange-200 p-3 rounded-lg">
           ⚠️ تم إلغاء العملية. تم إدراج ${sent.toLocaleString('ar')} سجل قبل الإلغاء.
         </div>`;
    } else {
      // 3) finalize
      const fr = await axios.post('/admin/api/grades/upload/finalize', { upload_token: token });
      _setProgress(100, 'اكتمل!', { read, sent, failed, speed: 0, eta: '' });
      document.getElementById('grades-stat-job').textContent = 'مكتمل ✓';
      document.getElementById('grades-upload-result').innerHTML =
        `<div class="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-lg">
           ✅ <b>اكتمل الرفع.</b> قُرِئ: ${read.toLocaleString('ar')} · أُدرج: ${sent.toLocaleString('ar')} · فشل: ${failed.toLocaleString('ar')}.
         </div>`;
      toast('تم رفع الدرجات بنجاح ✓');
      await loadGradesStats();
      await loadGradesTable();
      await loadAllowedSemesters();
    }
  } catch (err) {
    document.getElementById('grades-upload-result').innerHTML =
      `<div class="bg-red-50 text-red-800 border border-red-200 p-3 rounded-lg">
         ❌ خطأ: ${_esc(err.message || 'فشل غير معروف')}
       </div>`;
    toast('فشل الرفع', 'error');
  } finally {
    _resetGradesUploadUI();
  }
}

function _resetGradesUploadUI() {
  _gradesUploadInProgress = false;
  document.getElementById('grades-upload-btn').disabled = false;
  document.getElementById('grades-cancel-btn').classList.add('hidden');
}

function cancelGradesUpload() {
  _gradesUploadCancelled = true;
  toast('سيتم الإلغاء بعد الدفعة الحالية...', 'info');
}

async function clearAllGrades() {
  if (!confirm('سيتم حذف جميع الدرجات المخزّنة. متأكد؟')) return;
  try {
    await axios.post('/admin/api/grades/clear');
    toast('تم حذف كل الدرجات');
    await loadGradesStats();
    await loadGradesTable();
    await loadAllowedSemesters();
  } catch (e) { toast('فشل', 'error'); }
}

async function loadGradesTable(q) {
  const search = q != null ? q : (document.getElementById('grades-search')?.value || '');
  const r = await axios.get('/admin/api/grades' + (search ? `?q=${encodeURIComponent(search)}` : ''));
  const rows = r.data.grades || [];
  const tbl = document.getElementById('grades-table');
  if (!tbl) return;
  if (!rows.length) {
    tbl.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-500">لا توجد سجلات</td></tr>';
    return;
  }
  tbl.innerHTML = rows.map((g) => `
    <tr class="hover:bg-slate-50">
      <td class="p-2 font-mono text-xs">${_esc(g.academic_id)}</td>
      <td class="p-2">${_esc(g.student_name || '-')}</td>
      <td class="p-2">${_esc(g.semester)}</td>
      <td class="p-2">${_esc(g.subject_name)}</td>
      <td class="p-2 font-mono">${Number(g.total_score || 0).toFixed(1)}</td>
      <td class="p-2"><span class="bg-slate-100 px-2 py-0.5 rounded text-xs">${_esc(g.grade_label || '-')}</span></td>
      <td class="p-2"><button onclick="deleteGrade(${g.id})" class="text-red-500"><i class="fas fa-trash"></i></button></td>
    </tr>
  `).join('');
}

async function deleteGrade(id) {
  if (!confirm('حذف هذا السجل؟')) return;
  await axios.delete(`/admin/api/grades/${id}`);
  loadGradesTable();
  loadGradesStats();
}

async function loadAllowedSemesters() {
  try {
    const r = await axios.get('/admin/api/allowed-semesters');
    const list = r.data.semesters || [];
    const box = document.getElementById('allowed-semesters-list');
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<p class="text-slate-500 text-sm">لا توجد فصول. ارفع ملف درجات لإنشاء قائمة الفصول تلقائياً.</p>';
      return;
    }
    box.innerHTML = list.map((s) => `
      <label class="cursor-pointer">
        <input type="checkbox" ${s.is_allowed ? 'checked' : ''} onchange="toggleSemester(${s.id}, this.checked ? 1 : 0)" class="sr-only peer">
        <span class="px-3 py-1.5 rounded-full text-sm border-2 inline-block transition
          peer-checked:bg-emerald-500 peer-checked:text-white peer-checked:border-emerald-500
          bg-slate-100 text-slate-600 border-slate-200">
          ${_esc(s.semester)}
        </span>
      </label>
    `).join('');
  } catch (_) {}
}

async function toggleSemester(id, val) {
  try {
    await axios.post(`/admin/api/allowed-semesters/${id}`, { is_allowed: val });
    toast(val ? 'تم تفعيل الفصل' : 'تم تعطيل الفصل');
  } catch (e) { toast('فشل', 'error'); }
}

async function loadGradesTabExtra() {
  await Promise.all([loadGradesStats(), loadGradesTable(), loadAllowedSemesters()]);
  // form binding
  const form = document.getElementById('grades-upload-form');
  if (form && !form._bound) {
    form._bound = true;
    form.addEventListener('submit', startGradesUpload);
  }
  const cancelBtn = document.getElementById('grades-cancel-btn');
  if (cancelBtn && !cancelBtn._bound) { cancelBtn._bound = true; cancelBtn.onclick = cancelGradesUpload; }
  const search = document.getElementById('grades-search');
  if (search && !search._bound) {
    search._bound = true;
    let t;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => loadGradesTable(search.value), 350);
    });
  }
}

// ====================================================================
// (3) Hook into switchTab to load new tabs
// ====================================================================
(function hookSwitchTab() {
  if (typeof window === 'undefined') return;
  const orig = window.switchTab;
  if (!orig) return;
  window.switchTab = function (tab) {
    orig.call(this, tab);
    if (tab === 'buttons') loadButtons();
    if (tab === 'grades') loadGradesTabExtra();
  };

  // ربط زر فتح/إغلاق الشريط الجانبي على الجوال
  // نستخدم delegate لضمان العمل حتى لو تم تحديث الـ DOM
  document.addEventListener('click', (e) => {
    const mobToggle = e.target.closest('#mobile-toggle');
    if (mobToggle) {
      e.preventDefault();
      e.stopPropagation();
      window.toggleSidebar();
    }
  });

  // ربط نقر الخلفية لإغلاق الشريط
  const bd = document.getElementById('sidebar-backdrop');
  if (bd && !bd._bound) {
    bd._bound = true;
    bd.addEventListener('click', () => toggleSidebar(false));
  }
})();

// إتاحة الدالة على window حتى يستطيع admin.js استدعاؤها
window.toggleSidebar = function (forceOpen) {
  const aside = document.querySelector('aside.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!aside) return;
  const isOpen = aside.classList.contains('show');
  const willOpen = (forceOpen === true) ? true
                  : (forceOpen === false) ? false
                  : !isOpen;
  if (willOpen) {
    aside.classList.add('show');
    if (backdrop) backdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  } else {
    aside.classList.remove('show');
    if (backdrop) backdrop.classList.add('hidden');
    document.body.style.overflow = '';
  }
};

// إغلاق تلقائي عند نقر زر تنقل من القائمة على الجوال/التابلت
document.addEventListener('click', (e) => {
  const a = e.target.closest('aside.sidebar .nav-item');
  if (a && window.innerWidth < 1024) {
    setTimeout(() => window.toggleSidebar(false), 50);
  }
});

// إغلاق الشريط عند الضغط على Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && window.innerWidth < 1024) {
    window.toggleSidebar(false);
  }
});
