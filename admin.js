// ============================================
// JavaScript للوحة التحكم
// ============================================

// إدارة التبويبات
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

  const titles = {
    'overview': 'النظرة العامة',
    'settings': 'إعدادات البوت',
    'groups': 'المجموعات',
    'students': 'الطلاب',
    'curriculum': 'المناهج الدراسية',
    'replies': 'الردود التلقائية',
    'banned': 'الكلمات المحظورة',
    'requests': 'الطلبات والاستفسارات',
    'broadcast': 'المراسلة والإذاعات',
    'contacts': 'جهات التواصل',
    'menu-items': 'قائمة البوت الرئيسية',
    'buttons': 'الأزرار الموحّدة',
    'commands': 'الأوامر المخصصة',
    'reply-keyboard': 'الأزرار الدائمة',
    'grades': 'الدرجات',
    'admins': 'المشرفون',
    'webhook': 'إدارة الويبهوك',
    'account': 'إعدادات الحساب',
    'devices': '🔔 الإشعارات والأجهزة',
    'routing': '📡 توجيه الإشعارات للمشرفين',
    'academic': '🎓 المستويات والفصول',
    'notif-log': '📜 سجل الإشعارات',
  };
  document.getElementById('page-title').textContent = titles[tab] || 'لوحة التحكم';

  // إغلاق الشريط الجانبي على الجوال عند التبديل (يستخدم toggleSidebar من admin-extra.js)
  if (window.innerWidth < 1024 && typeof toggleSidebar === 'function') {
    try { toggleSidebar(false); } catch (_) {}
  }

  // تحميل البيانات للتبويب
  if (tab === 'settings') loadSettings();
  if (tab === 'groups') loadGroups();
  if (tab === 'students') loadStudents();
  if (tab === 'curriculum') loadCurriculum();
  if (tab === 'replies') loadReplies();
  if (tab === 'banned') loadBanned();
  if (tab === 'requests') loadRequests();
  if (tab === 'broadcast') loadBroadcast();
  if (tab === 'contacts') loadContacts();
  if (tab === 'menu-items') loadMenuItems();
  if (tab === 'commands') loadCommands();
  if (tab === 'reply-keyboard') loadReplyKb();
  if (tab === 'buttons') loadUnifiedButtons();
  if (tab === 'grades') loadGradesTab();
  if (tab === 'admins') loadAdmins();
  if (tab === 'webhook') getWebhookInfo();
  if (tab === 'devices') loadDevices();
  if (tab === 'routing') loadAdminRouting();
  if (tab === 'academic') loadAcademic();
  if (tab === 'notif-log') loadNotificationsLog();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => switchTab(item.dataset.tab));
});

// ملاحظة: تبديل الشريط الجانبي على الجوال يتم في admin-extra.js عبر toggleSidebar()
// نتأكد فقط من إغلاق الشريط على الجوال عند تبديل التبويب
function _closeSidebarMobile() {
  if (window.innerWidth < 1024 && typeof toggleSidebar === 'function') {
    try { toggleSidebar(false); } catch (_) {}
  }
}

// Toast
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  const m = document.getElementById('toast-msg');
  const colors = { success: 'bg-emerald-500', error: 'bg-red-500', info: 'bg-blue-500' };
  m.className = `px-5 py-3 rounded-lg shadow-lg text-white ${colors[type] || colors.info}`;
  m.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// Modal
function openModal(title, body) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

// API helper
async function api(method, path, data) {
  try {
    const res = await axios({ method, url: '/admin/api' + path, data });
    return res.data;
  } catch (e) {
    toast(e.response?.data?.error || 'خطأ في الاتصال', 'error');
    throw e;
  }
}

// =========== Settings ===========
async function loadSettings() {
  // تحميل بيانات التوكن أولاً
  await loadBotToken();

  const data = await api('GET', '/settings');
  const fields = [
    { key: 'bot_name', label: 'اسم البوت', icon: 'robot' },
    { key: 'college_name', label: 'اسم الكلية', icon: 'mosque' },
    { key: 'owner_username', label: 'معرف المالك (مع @)', icon: 'at' },
    { key: 'owner_user_id', label: 'معرف المالك الرقمي (Telegram ID)', icon: 'id-card' },
    { key: 'owner_contact_url', label: 'رابط التواصل مع المالك', icon: 'link' },
    { key: 'welcome_message', label: 'رسالة الترحيب', icon: 'comment', textarea: true },
    { key: 'webhook_secret', label: 'سر الويبهوك', icon: 'key' },
    { key: 'panel_url', label: 'رابط لوحة التحكم العام', icon: 'globe' },
  ];
  const html = fields.map(f => `
    <div>
      <label class="block text-sm font-semibold text-slate-700 mb-1">
        <i class="fas fa-${f.icon} ml-1 text-emerald-600"></i> ${f.label}
      </label>
      ${f.textarea
        ? `<textarea name="${f.key}" rows="3" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">${(data.settings[f.key] || '').replace(/</g, '&lt;')}</textarea>`
        : `<input type="text" name="${f.key}" value="${(data.settings[f.key] || '').replace(/"/g, '&quot;')}" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">`}
    </div>
  `).join('');
  document.getElementById('settings-form').innerHTML = html + `
    <button class="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg">
      <i class="fas fa-save ml-1"></i> حفظ التغييرات
    </button>`;
  document.getElementById('settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = {};
    for (const [k, v] of fd.entries()) obj[k] = v;
    await api('POST', '/settings', obj);
    toast('تم الحفظ بنجاح');
  };
}

// =========== Bot Token Management ===========
async function loadBotToken() {
  try {
    const r = await api('GET', '/token');
    const input = document.getElementById('bot-token-input');
    const card = document.getElementById('bot-info-card');
    if (!input) return;
    if (r.has_token) {
      input.value = r.masked || '';
      input.dataset.masked = '1';
      if (card) {
        card.classList.remove('hidden');
        card.innerHTML = `
          <div class="flex items-center gap-2 text-emerald-700">
            <i class="fas fa-circle-check text-emerald-500"></i>
            <span class="font-bold">يوجد توكن محفوظ</span>
            <span class="text-xs text-slate-500">(${r.length} حرف${r.from_env ? ' · من متغيرات البيئة' : ''})</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">انقر على زر العين لإظهار التوكن، أو أدخل توكناً جديداً للاستبدال.</p>
        `;
      }
    } else {
      input.value = '';
      input.dataset.masked = '0';
      if (card) {
        card.classList.remove('hidden');
        card.innerHTML = `
          <div class="flex items-center gap-2 text-red-700">
            <i class="fas fa-triangle-exclamation text-red-500"></i>
            <span class="font-bold">لا يوجد توكن محفوظ</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">أدخل التوكن من BotFather لتفعيل البوت.</p>
        `;
      }
    }
  } catch (_) {}
}

function toggleTokenVisibility() {
  const input = document.getElementById('bot-token-input');
  const eye = document.getElementById('token-eye');
  if (!input) return;
  // إذا كانت القيمة مخفية بنقاط، اطلب التوكن الكامل من السيرفر؟ لا — نُبقي القناع لأمان أكبر، لكن نسمح فقط بالتبديل بين password/text
  if (input.type === 'password') {
    input.type = 'text';
    eye.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    eye.className = 'fas fa-eye';
  }
}

async function testBotToken() {
  const input = document.getElementById('bot-token-input');
  const token = (input.value || '').trim();
  if (!token || input.dataset.masked === '1') {
    return toast('أدخل التوكن الجديد قبل الاختبار', 'error');
  }
  toast('جاري الاختبار...', 'info');
  try {
    const res = await axios.post('/admin/api/token/test', { bot_token: token });
    if (res.data.ok) {
      const b = res.data.bot;
      toast(`✅ التوكن صالح: @${b.username}`, 'success');
      const card = document.getElementById('bot-info-card');
      if (card) {
        card.classList.remove('hidden');
        card.innerHTML = `
          <div class="flex items-center gap-2 text-emerald-700">
            <i class="fas fa-circle-check text-emerald-500"></i>
            <span class="font-bold">${escapeHtml(b.first_name)}</span>
            <span class="text-sm">@${escapeHtml(b.username)}</span>
            <code class="text-xs bg-slate-100 px-2 py-1 rounded">${b.id}</code>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            ${b.can_join_groups ? '✓ يستطيع الانضمام للمجموعات' : '✗ لا يستطيع الانضمام للمجموعات'} ·
            ${b.can_read_all_group_messages ? '✓ Privacy Mode مُعطل (يقرأ جميع الرسائل)' : '⚠️ Privacy Mode مُفعل (يقرأ الأوامر فقط — يُنصح بتعطيله من BotFather)'}
          </p>
          <p class="text-xs text-blue-600 mt-2"><i class="fas fa-info-circle"></i> اضغط زر "حفظ التوكن" لتأكيد الحفظ.</p>
        `;
      }
    } else {
      toast(res.data.error || 'التوكن غير صالح', 'error');
    }
  } catch (e) {
    toast(e.response?.data?.error || 'التوكن غير صالح', 'error');
  }
}

async function clearBotToken() {
  if (!confirm('هل أنت متأكد من حذف التوكن؟ سيتوقف البوت عن العمل حتى تضيف توكناً جديداً.')) return;
  try {
    await axios.delete('/admin/api/token');
    toast('تم حذف التوكن', 'success');
    document.getElementById('bot-token-input').value = '';
    loadBotToken();
  } catch (e) {
    toast('فشل الحذف', 'error');
  }
}

// معالج إرسال نموذج التوكن
document.addEventListener('DOMContentLoaded', () => {
  const tf = document.getElementById('token-form');
  if (tf) {
    tf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('bot-token-input');
      const token = (input.value || '').trim();
      if (!token) return toast('أدخل التوكن', 'error');
      if (input.dataset.masked === '1') {
        return toast('أدخل التوكن الجديد كاملاً (حالياً معروض بشكل مخفي)', 'info');
      }
      try {
        const res = await axios.post('/admin/api/token', { bot_token: token });
        if (res.data.ok) {
          toast(`✅ تم حفظ التوكن: @${res.data.bot.username}`, 'success');
          loadBotToken();
        } else {
          toast(res.data.error || 'فشل الحفظ', 'error');
        }
      } catch (e) {
        toast(e.response?.data?.error || 'فشل الحفظ', 'error');
      }
    });
  }
});

// =========== Groups ===========
async function loadGroups() {
  // تحميل إعدادات الحماية أولاً
  try {
    const sec = await api('GET', '/groups/security/settings');
    const restrictEl = document.getElementById('sec-restrict');
    const autoEl = document.getElementById('sec-autoleave');
    if (restrictEl) restrictEl.checked = !!sec.restrict_bot_to_admins_only;
    if (autoEl) autoEl.checked = !!sec.auto_leave_unauthorized_groups;
  } catch (_) {}

  const data = await api('GET', '/groups');
  if (!data.groups || !data.groups.length) {
    document.getElementById('groups-list').innerHTML = `<p class="text-slate-500 text-center py-8">لا توجد مجموعات بعد. أضف البوت إلى مجموعة وامنحه صلاحيات المشرف.</p>`;
    return;
  }
  document.getElementById('groups-list').innerHTML = data.groups.map(g => `
    <div class="border rounded-lg p-4 hover:bg-slate-50 transition ${g.is_active ? '' : 'opacity-70 bg-slate-50'}">
      <div class="flex justify-between items-start gap-3 flex-wrap">
        <div class="flex-1 min-w-0">
          <h4 class="font-bold text-slate-800 truncate">${escapeHtml(g.title || 'بدون اسم')}</h4>
          <p class="text-xs text-slate-500 mt-1">
            <code>${g.chat_id}</code> · ${g.type} · ${g.is_active ? '<span class="text-green-600">نشط</span>' : '<span class="text-red-600">غير نشط</span>'}
            ${g.added_by_user_id ? ` · أضافه: <code>${g.added_by_user_id}</code>` : ''}
          </p>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <button onclick="leaveGroup(${g.id}, '${escapeHtml(g.title || '').replace(/'/g, '')}')"
            class="bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg text-xs font-bold"
            title="إخراج البوت من هذه المجموعة">
            <i class="fas fa-door-open"></i> إخراج البوت
          </button>
          <button onclick="deleteGroupRecord(${g.id}, '${escapeHtml(g.title || '').replace(/'/g, '')}')"
            class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold"
            title="حذف المجموعة من قاعدة البيانات (لن يخرج البوت)">
            <i class="fas fa-trash"></i> حذف
          </button>
        </div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-sm">
        ${toggleBtn(g.id, 'delete_links', g.delete_links, 'حذف الروابط')}
        ${toggleBtn(g.id, 'delete_forwarded', g.delete_forwarded, 'حذف المحولة')}
        ${toggleBtn(g.id, 'delete_bad_words', g.delete_bad_words, 'كلمات محظورة')}
        ${toggleBtn(g.id, 'anti_spam', g.anti_spam, 'مكافحة السبام')}
        ${toggleBtn(g.id, 'welcome_enabled', g.welcome_enabled, 'الترحيب')}
        ${toggleBtn(g.id, 'join_verification', g.join_verification, 'التحقق من المنضمين')}
      </div>
      <div class="grid grid-cols-3 gap-2 mt-3 text-xs">
        <label class="block">
          <span class="text-slate-600">حد التحذيرات</span>
          <input type="number" min="1" value="${g.warn_threshold}" onchange="updateGroupField(${g.id}, 'warn_threshold', this.value)" class="w-full mt-1 px-2 py-1 border rounded">
        </label>
        <label class="block">
          <span class="text-slate-600">حد رسائل السبام</span>
          <input type="number" min="1" value="${g.spam_max_messages}" onchange="updateGroupField(${g.id}, 'spam_max_messages', this.value)" class="w-full mt-1 px-2 py-1 border rounded">
        </label>
        <label class="block">
          <span class="text-slate-600">نافذة السبام (ث)</span>
          <input type="number" min="1" value="${g.spam_window_seconds}" onchange="updateGroupField(${g.id}, 'spam_window_seconds', this.value)" class="w-full mt-1 px-2 py-1 border rounded">
        </label>
      </div>
    </div>
  `).join('');
}

async function leaveGroup(id, title) {
  if (!confirm(`هل أنت متأكد من إخراج البوت من المجموعة "${title}"؟\n\nسيتم إرسال رسالة وداع للمجموعة ثم خروج البوت تلقائياً.`)) return;
  try {
    const r = await api('POST', `/groups/${id}/leave`, {});
    if (r.ok) {
      toast(r.message || 'تم خروج البوت من المجموعة');
    } else {
      toast(r.error || 'فشلت العملية', 'error');
    }
    loadGroups();
  } catch (e) {
    toast('فشل: ' + (e?.message || 'خطأ غير معروف'), 'error');
  }
}

async function deleteGroupRecord(id, title) {
  if (!confirm(`حذف "${title}" من قاعدة البيانات؟ هذا لن يُخرج البوت من المجموعة.\n\nاستخدم "إخراج البوت" أولاً إذا كنت تريد المغادرة.`)) return;
  try {
    await api('DELETE', `/groups/${id}`);
    toast('تم الحذف');
    loadGroups();
  } catch (e) {
    toast('فشل الحذف', 'error');
  }
}

async function saveGroupsSecurity() {
  const restrict = document.getElementById('sec-restrict')?.checked ? 1 : 0;
  const autoLeave = document.getElementById('sec-autoleave')?.checked ? 1 : 0;
  try {
    await api('POST', '/groups/security/settings', {
      restrict_bot_to_admins_only: restrict,
      auto_leave_unauthorized_groups: autoLeave,
    });
    toast('تم حفظ إعدادات الحماية');
  } catch (e) {
    toast('فشل الحفظ', 'error');
  }
}
function toggleBtn(id, field, val, label) {
  const active = val === 1;
  return `<button onclick="toggleGroupField(${id}, '${field}', ${val})" class="${active ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-200'} border px-3 py-2 rounded-lg text-xs transition">
    <i class="fas fa-${active ? 'check' : 'times'} ml-1"></i> ${label}
  </button>`;
}
async function toggleGroupField(id, field, currentVal) {
  await api('POST', `/groups/${id}`, { [field]: currentVal ? 0 : 1 });
  loadGroups();
}
async function updateGroupField(id, field, val) {
  await api('POST', `/groups/${id}`, { [field]: Number(val) });
  toast('تم التحديث');
}

// =========== Students ===========
async function loadStudents() {
  const data = await api('GET', '/students');
  const search = (document.getElementById('student-search')?.value || '').toLowerCase();
  const filtered = search ? data.students.filter(s => 
    (s.full_name || '').toLowerCase().includes(search) ||
    (s.academic_id || '').includes(search) ||
    (s.phone || '').includes(search)
  ) : data.students;
  
  if (!filtered.length) {
    document.getElementById('students-table').innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500">لا يوجد طلاب</td></tr>`;
    return;
  }
  
  const statusBadge = {
    'pending': '<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs">انتظار</span>',
    'approved': '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">موافق</span>',
    'restricted': '<span class="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">مقيد</span>',
    'rejected': '<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">مرفوض</span>',
  };

  document.getElementById('students-table').innerHTML = filtered.map(s => `
    <tr class="hover:bg-slate-50">
      <td class="p-3">${escapeHtml(s.full_name || s.display_name || '-')}</td>
      <td class="p-3"><code class="text-xs">${escapeHtml(s.academic_id || '-')}</code></td>
      <td class="p-3">${escapeHtml(s.level || '-')}</td>
      <td class="p-3"><code class="text-xs">${escapeHtml(s.phone || '-')}</code></td>
      <td class="p-3">${statusBadge[s.status] || s.status}</td>
      <td class="p-3">
        <button onclick="deleteStudent(${s.id})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}
document.getElementById('student-search')?.addEventListener('input', () => loadStudents());
async function deleteStudent(id) {
  if (!confirm('هل أنت متأكد من حذف هذا الطالب؟')) return;
  await api('DELETE', `/students/${id}`);
  toast('تم الحذف');
  loadStudents();
}

// =========== Curriculum ===========
async function loadCurriculum() {
  const data = await api('GET', '/curriculum');
  if (!data.items.length) {
    document.getElementById('curriculum-list').innerHTML = `<p class="text-slate-500 text-center py-8">لا توجد مواد بعد.</p>`;
    return;
  }
  const grouped = {};
  data.items.forEach(it => {
    const lvl = it.level || 'الأول';
    const sem = it.semester || 'الأول';
    if (!grouped[lvl]) grouped[lvl] = {};
    if (!grouped[lvl][sem]) grouped[lvl][sem] = [];
    grouped[lvl][sem].push(it);
  });
  document.getElementById('curriculum-list').innerHTML = Object.keys(grouped).map(level => `
    <div class="border rounded-lg overflow-hidden mb-3">
      <div class="bg-emerald-50 px-4 py-2 font-bold text-emerald-700">📚 المستوى ${escapeHtml(level)}</div>
      ${Object.keys(grouped[level]).map(sem => `
        <div class="border-t">
          <div class="bg-sky-50 px-4 py-1.5 font-semibold text-sky-700 text-sm">🗓️ الفصل ${escapeHtml(sem)}</div>
          <div class="divide-y">
            ${grouped[level][sem].map(it => `
              <div class="p-3 flex justify-between items-center hover:bg-slate-50">
                <div class="flex-1">
                  <p class="font-semibold">${escapeHtml(it.subject_name)}</p>
                  ${it.description ? `<p class="text-xs text-slate-500">${escapeHtml(it.description)}</p>` : ''}
                  ${it.academic_year ? `<span class="inline-block text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded mt-1">📆 ${escapeHtml(it.academic_year)}</span>` : ''}
                  ${it.file_url ? `<br><a href="${escapeHtml(it.file_url)}" target="_blank" class="text-xs text-blue-500 hover:underline"><i class="fas fa-link"></i> ${escapeHtml((it.file_url||'').substring(0, 50))}...</a>` : ''}
                </div>
                <div class="flex gap-1">
                  <button onclick='editCurriculum(${JSON.stringify(it).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700 px-2"><i class="fas fa-edit"></i></button>
                  <button onclick="deleteCurriculum(${it.id})" class="text-red-500 hover:text-red-700 px-2"><i class="fas fa-trash"></i></button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

async function openCurriculumModal(item) {
  const it = item || { id: '', level: 'الأول', semester: 'الأول', academic_year: '', subject_name: '', description: '', file_url: '' };
  // جلب المستويات والفصول الديناميكية
  let levels = ['الأول', 'الثاني', 'الثالث', 'الرابع'];
  let semesters = ['الأول', 'الثاني'];
  try {
    const lv = await api('GET', '/academic/levels');
    const lvArr = lv?.items || lv?.levels || [];
    if (lvArr.length) levels = lvArr.map(l => l.name);
  } catch(_) {}
  try {
    const sm = await api('GET', '/academic/semesters');
    const smArr = sm?.items || sm?.semesters || [];
    if (smArr.length) semesters = smArr.map(s => s.short_name || s.name);
  } catch(_) {}
  openModal(it.id ? 'تعديل مادة' : 'إضافة مادة', `
    <form id="curr-form" class="space-y-3">
      <input type="hidden" name="id" value="${it.id || ''}">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-sm font-semibold mb-1">المستوى <span class="text-red-500">*</span></label>
          <select name="level" required class="w-full px-3 py-2 border rounded-lg">
            ${levels.map(l => `<option ${it.level === l ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">الفصل <span class="text-red-500">*</span></label>
          <select name="semester" required class="w-full px-3 py-2 border rounded-lg">
            ${semesters.map(s => `<option ${it.semester === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">📆 العام الدراسي (اختياري)</label>
        <input type="text" name="academic_year" value="${escapeHtml(it.academic_year || '')}" placeholder="مثال: 1446-1447هـ" class="w-full px-3 py-2 border rounded-lg">
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">اسم المادة <span class="text-red-500">*</span></label>
        <input type="text" name="subject_name" required value="${escapeHtml(it.subject_name)}" class="w-full px-3 py-2 border rounded-lg">
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">الوصف <span class="text-red-500">*</span></label>
        <textarea name="description" rows="2" required class="w-full px-3 py-2 border rounded-lg">${escapeHtml(it.description || '')}</textarea>
      </div>
      <div class="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
        <label class="block text-sm font-semibold mb-2">📎 الملف (مستند/فيديو/صورة) - اختياري</label>
        <input type="file" id="curr-file-input" accept="*/*" class="block w-full text-sm mb-2">
        <button type="button" onclick="uploadCurriculumFile()" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs">
          <i class="fas fa-upload ml-1"></i> رفع الملف للبوت
        </button>
        <div id="curr-file-result" class="mt-2 text-xs"></div>
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">🔗 رابط ملف خارجي (URL) - اختياري</label>
        <input type="url" name="file_url" value="${escapeHtml(it.file_url || '')}" class="w-full px-3 py-2 border rounded-lg" placeholder="https://drive.google.com/...">
        <p class="text-[11px] text-slate-500 mt-1">يمكنك الجمع بين الملف والرابط معاً.</p>
      </div>
      <button class="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg">
        <i class="fas fa-save ml-1"></i> حفظ
      </button>
    </form>
  `);
  document.getElementById('curr-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd);
    let savedId = obj.id;
    if (obj.id) {
      await api('POST', `/curriculum/${obj.id}`, obj);
    } else {
      const r = await api('POST', '/curriculum', obj);
      savedId = r.item?.id || r.id;
    }
    // إذا كان هناك مرفق منتظر، نربطه الآن بالمنهج
    if (savedId && window._pendingCurrAttachment) {
      const att = window._pendingCurrAttachment;
      try {
        await axios.post('/admin/api/attachments', {
          ...att,
          owner_type: 'curriculum',
          owner_id: Number(savedId),
        });
      } catch (_) {}
      window._pendingCurrAttachment = null;
    }
    closeModal();
    toast('تم الحفظ');
    loadCurriculum();
  };
}
async function uploadCurriculumFile() {
  const inp = document.getElementById('curr-file-input');
  const f = inp?.files?.[0];
  if (!f) return toast('اختر ملفاً أولاً', 'error');
  let fileType = 'document';
  if (f.type.startsWith('image/')) fileType = 'photo';
  else if (f.type.startsWith('video/')) fileType = 'video';
  else if (f.type.startsWith('audio/')) fileType = 'audio';
  const fd = new FormData();
  fd.append('file', f);
  fd.append('file_type', fileType);
  toast('جاري رفع الملف...', 'info');
  try {
    const res = await axios.post('/admin/api/upload-to-telegram', fd);
    if (res.data.ok && res.data.attachment) {
      window._pendingCurrAttachment = res.data.attachment;
      document.getElementById('curr-file-result').innerHTML = `
        <div class="bg-emerald-100 text-emerald-700 p-2 rounded">
          ✅ تم رفع: <b>${escapeHtml(res.data.attachment.file_name || fileType)}</b>
          <br><span class="text-[11px]">سيتم ربطه بالمادة عند الحفظ.</span>
        </div>`;
      toast('تم رفع الملف ✓');
    } else {
      toast(res.data.error || 'فشل الرفع', 'error');
    }
  } catch (e) {
    toast(e.response?.data?.error || 'فشل الرفع', 'error');
  }
}
function editCurriculum(it) { openCurriculumModal(it); }
async function deleteCurriculum(id) {
  if (!confirm('حذف هذه المادة؟')) return;
  await api('DELETE', `/curriculum/${id}`);
  toast('تم الحذف');
  loadCurriculum();
}

// =========== Auto Replies ===========
async function loadReplies() {
  const data = await api('GET', '/replies');
  if (!data.replies.length) {
    document.getElementById('replies-list').innerHTML = `<p class="text-slate-500 text-center py-8">لا توجد ردود تلقائية بعد.</p>`;
    return;
  }
  const matchLabels = { exact: 'مطابق تماماً', contains: 'يحتوي', starts_with: 'يبدأ بـ', regex: 'تعبير نمطي' };
  document.getElementById('replies-list').innerHTML = data.replies.map(r => `
    <div class="border rounded-lg p-3 hover:bg-slate-50">
      <div class="flex justify-between items-start gap-2">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">${matchLabels[r.match_type]}</span>
            <span class="font-bold">"${escapeHtml(r.trigger_text)}"</span>
            ${r.is_active ? '' : '<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">معطل</span>'}
          </div>
          <p class="text-sm text-slate-600">${escapeHtml(r.reply_text)}</p>
        </div>
        <div class="flex gap-1">
          <button onclick='editReply(${JSON.stringify(r).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700 px-2"><i class="fas fa-edit"></i></button>
          <button onclick="toggleReply(${r.id}, ${r.is_active})" class="text-${r.is_active ? 'orange' : 'green'}-500 hover:opacity-70 px-2">
            <i class="fas fa-${r.is_active ? 'pause' : 'play'}"></i>
          </button>
          <button onclick="deleteReply(${r.id})" class="text-red-500 hover:text-red-700 px-2"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>
  `).join('');
}
function openReplyModal(item) {
  const it = item || { id: '', trigger_text: '', match_type: 'contains', reply_text: '', case_sensitive: 0 };
  openModal(it.id ? 'تعديل رد تلقائي' : 'إضافة رد تلقائي', `
    <form id="reply-form" class="space-y-3">
      <input type="hidden" name="id" value="${it.id || ''}">
      <div>
        <label class="block text-sm font-semibold mb-1">🔑 الكلمة/العبارة المفتاحية <span class="text-red-500">*</span></label>
        <input type="text" name="trigger_text" required value="${escapeHtml(it.trigger_text)}" class="w-full px-3 py-2 border rounded-lg" placeholder="مثل: السلام عليكم">
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">🔍 نوع المطابقة</label>
        <select name="match_type" class="w-full px-3 py-2 border rounded-lg">
          <option value="contains" ${it.match_type === 'contains' ? 'selected' : ''}>يحتوي على</option>
          <option value="exact" ${it.match_type === 'exact' ? 'selected' : ''}>مطابق تماماً</option>
          <option value="starts_with" ${it.match_type === 'starts_with' ? 'selected' : ''}>يبدأ بـ</option>
          <option value="regex" ${it.match_type === 'regex' ? 'selected' : ''}>تعبير نمطي (Regex)</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">💬 نص الرد <span class="text-red-500">*</span></label>
        <textarea name="reply_text" rows="4" required class="w-full px-3 py-2 border rounded-lg" placeholder="الرد الذي سيرسله البوت...">${escapeHtml(it.reply_text)}</textarea>
        <p class="text-xs text-slate-500 mt-1">يمكنك استخدام HTML بسيط: &lt;b&gt;، &lt;i&gt;، &lt;code&gt;</p>
      </div>
      <label class="flex items-center gap-2">
        <input type="checkbox" name="case_sensitive" value="1" ${it.case_sensitive ? 'checked' : ''}>
        <span class="text-sm">🔡 حساس لحالة الأحرف</span>
      </label>
      ${it.id ? `
        <div class="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs text-slate-600">
          <i class="fas fa-info-circle text-blue-500"></i>
          بعد حفظ الرد، يمكنك إضافة <b>📎 ملف مرفق</b> أو <b>🔘 أزرار شفافة</b> من القائمة.
        </div>
      ` : `
        <div class="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
          <label class="block text-sm font-semibold mb-2">📎 ملف مرفق (اختياري)</label>
          <input type="file" id="reply-file-input" accept="*/*" class="block w-full text-sm mb-2">
          <button type="button" onclick="uploadReplyFile()" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs">
            <i class="fas fa-upload ml-1"></i> رفع الملف
          </button>
          <div id="reply-file-result" class="mt-2 text-xs"></div>
        </div>
      `}
      <button class="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg">
        <i class="fas fa-save ml-1"></i> حفظ
      </button>
    </form>
  `);
  document.getElementById('reply-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd);
    obj.case_sensitive = obj.case_sensitive ? 1 : 0;
    let savedId = obj.id;
    if (obj.id) {
      await api('POST', `/replies/${obj.id}`, obj);
    } else {
      const r = await api('POST', '/replies', obj);
      savedId = r.id || r.item?.id;
    }
    if (savedId && window._pendingReplyAttachment) {
      try {
        await axios.post('/admin/api/attachments', {
          ...window._pendingReplyAttachment,
          owner_type: 'reply',
          owner_id: Number(savedId),
        });
      } catch (_) {}
      window._pendingReplyAttachment = null;
    }
    closeModal();
    toast('تم الحفظ');
    loadReplies();
  };
}
async function uploadReplyFile() {
  const inp = document.getElementById('reply-file-input');
  const f = inp?.files?.[0];
  if (!f) return toast('اختر ملفاً أولاً', 'error');
  let fileType = 'document';
  if (f.type.startsWith('image/')) fileType = 'photo';
  else if (f.type.startsWith('video/')) fileType = 'video';
  else if (f.type.startsWith('audio/')) fileType = 'audio';
  const fd = new FormData();
  fd.append('file', f);
  fd.append('file_type', fileType);
  toast('جاري الرفع...', 'info');
  try {
    const res = await axios.post('/admin/api/upload-to-telegram', fd);
    if (res.data.ok && res.data.attachment) {
      window._pendingReplyAttachment = res.data.attachment;
      document.getElementById('reply-file-result').innerHTML = `
        <div class="bg-emerald-100 text-emerald-700 p-2 rounded">
          ✅ <b>${escapeHtml(res.data.attachment.file_name || fileType)}</b> سيُربط بالرد عند الحفظ.
        </div>`;
      toast('تم الرفع ✓');
    } else {
      toast(res.data.error || 'فشل', 'error');
    }
  } catch (e) {
    toast(e.response?.data?.error || 'فشل', 'error');
  }
}
function editReply(r) { openReplyModal(r); }
async function toggleReply(id, current) {
  await api('POST', `/replies/${id}`, { is_active: current ? 0 : 1 });
  loadReplies();
}
async function deleteReply(id) {
  if (!confirm('حذف هذا الرد؟')) return;
  await api('DELETE', `/replies/${id}`);
  toast('تم الحذف');
  loadReplies();
}

// =========== Banned Words ===========
async function loadBanned() {
  const data = await api('GET', '/banned');
  if (!data.words.length) {
    document.getElementById('banned-list').innerHTML = `<p class="text-slate-500">لا توجد كلمات محظورة بعد.</p>`;
    return;
  }
  const colors = { warn: 'yellow', delete: 'red', kick: 'purple' };
  document.getElementById('banned-list').innerHTML = data.words.map(w => `
    <span class="bg-${colors[w.severity]}-100 text-${colors[w.severity]}-700 px-3 py-2 rounded-full flex items-center gap-2 text-sm">
      <span>${escapeHtml(w.word)}</span>
      <span class="text-xs opacity-70">(${w.severity})</span>
      <button onclick="deleteBanned(${w.id})" class="hover:text-red-900"><i class="fas fa-times"></i></button>
    </span>
  `).join('');
}
document.getElementById('banned-form').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await api('POST', '/banned', Object.fromEntries(fd));
  e.target.reset();
  toast('تمت الإضافة');
  loadBanned();
};
async function deleteBanned(id) {
  await api('DELETE', `/banned/${id}`);
  loadBanned();
}

// =========== Requests ===========
async function loadRequests() {
  const data = await api('GET', '/requests');
  if (!data.requests.length) {
    document.getElementById('requests-list').innerHTML = `<p class="text-slate-500 text-center py-8">لا توجد طلبات.</p>`;
    return;
  }
  const typeIcons = { question: '❓', request: '📝', inquiry: '🔍', complaint: '⚠️' };
  const statusBadge = {
    'pending': '<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs">معلق</span>',
    'reviewing': '<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">قيد المراجعة</span>',
    'answered': '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">تم الرد</span>',
    'closed': '<span class="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs">مغلق</span>',
  };
  document.getElementById('requests-list').innerHTML = data.requests.map(r => `
    <div class="border rounded-lg p-4 ${r.status === 'pending' ? 'bg-yellow-50' : ''}">
      <div class="flex justify-between items-start mb-2">
        <div>
          <span class="text-2xl">${typeIcons[r.type] || '📨'}</span>
          <span class="font-bold">${escapeHtml(r.display_name || 'مستخدم')}</span>
          <span class="text-xs text-slate-500"><code>#${r.id}</code> · ${new Date(r.created_at).toLocaleString('ar')}</span>
        </div>
        ${statusBadge[r.status]}
      </div>
      <div class="bg-slate-50 p-3 rounded text-sm whitespace-pre-wrap mb-2">${escapeHtml(r.content)}</div>
      ${r.admin_response ? `<div class="bg-emerald-50 p-3 rounded text-sm mb-2"><b>الرد:</b> ${escapeHtml(r.admin_response)}</div>` : ''}
      <div class="flex gap-2">
        ${r.status !== 'closed' ? `<button onclick="closeRequest(${r.id})" class="bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded text-xs"><i class="fas fa-check"></i> إغلاق</button>` : ''}
        <button onclick="deleteRequest(${r.id})" class="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-xs"><i class="fas fa-trash"></i> حذف</button>
      </div>
    </div>
  `).join('');
}
async function closeRequest(id) {
  await api('POST', `/requests/${id}`, { status: 'closed' });
  toast('تم الإغلاق');
  loadRequests();
}
async function deleteRequest(id) {
  if (!confirm('حذف هذا الطلب؟')) return;
  await api('DELETE', `/requests/${id}`);
  loadRequests();
}

// =========== Admins ===========
async function loadAdmins() {
  const data = await api('GET', '/admins');
  document.getElementById('admins-list').innerHTML = data.admins.map(a => `
    <div class="border rounded-lg p-3 flex justify-between items-center">
      <div>
        <p class="font-bold">${escapeHtml(a.full_name || a.username || 'مشرف')}</p>
        <p class="text-xs text-slate-500"><code>${a.telegram_user_id}</code> · ${a.role === 'owner' ? '👑 مالك' : '🛡️ مشرف'}</p>
      </div>
      ${a.role !== 'owner' ? `<button onclick="deleteAdmin(${a.id})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>` : ''}
    </div>
  `).join('') || '<p class="text-slate-500 text-center py-4">لا يوجد مشرفون</p>';
}
function openAdminModal() {
  openModal('إضافة مشرف', `
    <form id="admin-form" class="space-y-3">
      <div>
        <label class="block text-sm font-semibold mb-1">معرف تلجرام (Telegram User ID)</label>
        <input type="number" name="telegram_user_id" required class="w-full px-3 py-2 border rounded-lg" placeholder="123456789">
        <p class="text-xs text-slate-500 mt-1">يمكن للمستخدم معرفته بإرسال /id للبوت</p>
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">الاسم الكامل</label>
        <input type="text" name="full_name" class="w-full px-3 py-2 border rounded-lg">
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">معرف المستخدم (اختياري)</label>
        <input type="text" name="username" class="w-full px-3 py-2 border rounded-lg" placeholder="username">
      </div>
      <button class="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg">
        <i class="fas fa-plus ml-1"></i> إضافة
      </button>
    </form>
  `);
  document.getElementById('admin-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('POST', '/admins', Object.fromEntries(fd));
    closeModal();
    toast('تمت الإضافة');
    loadAdmins();
  };
}
async function deleteAdmin(id) {
  if (!confirm('إزالة هذا المشرف؟')) return;
  await api('DELETE', `/admins/${id}`);
  loadAdmins();
}

// =========== Webhook ===========
async function getWebhookInfo() {
  const r = await api('GET', '/webhook/info');
  document.getElementById('webhook-info').innerHTML = `<pre class="whitespace-pre-wrap">${JSON.stringify(r.info, null, 2)}</pre>`;
}
async function setupWebhook() {
  const r = await api('POST', '/webhook/setup');
  if (r.ok) toast('تم تفعيل الويبهوك');
  else toast(r.error || 'فشل', 'error');
  getWebhookInfo();
}
async function deleteWebhookConfirm() {
  if (!confirm('إزالة الويبهوك؟ سيتوقف البوت عن الاستجابة.')) return;
  await api('POST', '/webhook/delete');
  toast('تم الحذف');
  getWebhookInfo();
}

// =========== Account ===========
document.getElementById('account-form').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  if (fd.get('new') !== fd.get('confirm')) {
    return toast('كلمتا المرور غير متطابقتين', 'error');
  }
  try {
    await api('POST', '/account/password', { current: fd.get('current'), new: fd.get('new') });
    toast('تم تغيير كلمة المرور');
    e.target.reset();
  } catch (_) {}
};

// =========== Helpers ===========
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// =========== Contacts (جهات التواصل) ===========
async function loadContacts() {
  const data = await api('GET', '/contacts');
  const list = document.getElementById('contacts-list');
  if (!data.contacts.length) {
    list.innerHTML = `<p class="text-slate-500 text-center py-8">لا توجد جهات بعد. أضف أول جهة تواصل.</p>`;
    return;
  }
  list.innerHTML = data.contacts.map(c => `
    <div class="border rounded-lg p-3 hover:bg-slate-50 flex justify-between items-center flex-wrap gap-2">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <i class="fas fa-${c.icon || 'user-tie'} text-emerald-600"></i>
          <span class="font-bold">${escapeHtml(c.title)}</span>
          ${c.is_active ? '' : '<span class="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-xs">معطّل</span>'}
        </div>
        ${c.description ? `<p class="text-xs text-slate-500">${escapeHtml(c.description)}</p>` : ''}
        <p class="text-xs text-blue-600 truncate"><i class="fas fa-link"></i> ${escapeHtml(c.contact_url || '')}</p>
      </div>
      <div class="flex gap-1">
        <button onclick='editContact(${JSON.stringify(c).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700 px-2"><i class="fas fa-edit"></i></button>
        <button onclick="deleteContact(${c.id})" class="text-red-500 hover:text-red-700 px-2"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}
function openContactModal(item) {
  const it = item || { id: '', title: '', description: '', contact_url: '', username: '', user_id: '', icon: 'user-tie', display_order: 0, is_active: 1 };
  const icons = ['user-tie', 'university', 'clipboard-list', 'graduation-cap', 'phone', 'envelope', 'mosque', 'book', 'robot'];
  openModal(it.id ? 'تعديل جهة التواصل' : 'إضافة جهة تواصل', `
    <form id="contact-form" class="space-y-3">
      <input type="hidden" name="id" value="${it.id || ''}">
      <div>
        <label class="block text-sm font-semibold mb-1">العنوان (مثل: إدارة البوت)</label>
        <input type="text" name="title" required value="${escapeHtml(it.title)}" class="w-full px-3 py-2 border rounded-lg">
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">الوصف</label>
        <input type="text" name="description" value="${escapeHtml(it.description || '')}" class="w-full px-3 py-2 border rounded-lg">
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">رابط التواصل (https://t.me/... أو tg://user?id=...)</label>
        <input type="text" name="contact_url" required value="${escapeHtml(it.contact_url || '')}" class="w-full px-3 py-2 border rounded-lg" placeholder="https://t.me/username">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-semibold mb-1">الأيقونة</label>
          <select name="icon" class="w-full px-3 py-2 border rounded-lg">
            ${icons.map(i => `<option value="${i}" ${it.icon === i ? 'selected' : ''}>${i}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">الترتيب</label>
          <input type="number" name="display_order" value="${it.display_order || 0}" class="w-full px-3 py-2 border rounded-lg">
        </div>
      </div>
      <label class="flex items-center gap-2">
        <input type="checkbox" name="is_active" value="1" ${it.is_active ? 'checked' : ''}>
        <span class="text-sm">مفعّل</span>
      </label>
      <button class="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg">
        <i class="fas fa-save ml-1"></i> حفظ
      </button>
    </form>
  `);
  document.getElementById('contact-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd);
    obj.is_active = obj.is_active ? 1 : 0;
    if (obj.id) await api('POST', `/contacts/${obj.id}`, obj);
    else await api('POST', '/contacts', obj);
    closeModal();
    toast('تم الحفظ');
    loadContacts();
  };
}
function editContact(c) { openContactModal(c); }
async function deleteContact(id) {
  if (!confirm('حذف هذه الجهة؟')) return;
  await api('DELETE', `/contacts/${id}`);
  toast('تم الحذف');
  loadContacts();
}

// =========== Menu Items (قائمة البوت الرئيسية) ===========
async function loadMenuItems() {
  const data = await api('GET', '/menu-items');
  const list = document.getElementById('menu-items-list');
  if (!data.items.length) {
    list.innerHTML = `<p class="text-slate-500 text-center py-8">لا توجد عناصر بعد.</p>`;
    return;
  }
  list.innerHTML = data.items.map(it => `
    <div class="border rounded-lg p-3 hover:bg-slate-50 flex justify-between items-center flex-wrap gap-2">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          ${it.icon ? `<i class="fas fa-${it.icon} text-emerald-600"></i>` : ''}
          <span class="font-bold">${escapeHtml(it.text)}</span>
          ${it.is_admin_only ? '<span class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">مشرفون فقط</span>' : ''}
          ${it.is_active ? '' : '<span class="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-xs">معطّل</span>'}
        </div>
        <p class="text-xs text-slate-500">إجراء: ${it.action_type} → <code>${escapeHtml(it.action_value)}</code> · ترتيب: ${it.display_order}</p>
      </div>
      <div class="flex gap-1">
        <button onclick='editMenuItem(${JSON.stringify(it).replace(/'/g, "&#39;")})' class="text-blue-500 px-2"><i class="fas fa-edit"></i></button>
        <button onclick="deleteMenuItem(${it.id})" class="text-red-500 px-2"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}
function openMenuItemModal(item) {
  const it = item || { id: '', text: '', icon: '', action_type: 'builtin', action_value: 'curriculum', display_order: 0, is_active: 1, is_admin_only: 0 };
  openModal(it.id ? 'تعديل عنصر القائمة' : 'إضافة عنصر للقائمة', `
    <form id="menuitem-form" class="space-y-3">
      <input type="hidden" name="id" value="${it.id || ''}">
      <div>
        <label class="block text-sm font-semibold mb-1">نص الزر</label>
        <input type="text" name="text" required value="${escapeHtml(it.text)}" class="w-full px-3 py-2 border rounded-lg" placeholder="📚 المناهج الدراسية">
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">الأيقونة (FontAwesome - بدون fa-)</label>
        <input type="text" name="icon" value="${escapeHtml(it.icon || '')}" class="w-full px-3 py-2 border rounded-lg" placeholder="book">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-semibold mb-1">نوع الإجراء</label>
          <select name="action_type" class="w-full px-3 py-2 border rounded-lg">
            <option value="builtin" ${it.action_type === 'builtin' ? 'selected' : ''}>مدمج</option>
            <option value="command" ${it.action_type === 'command' ? 'selected' : ''}>أمر مخصص</option>
            <option value="curriculum" ${it.action_type === 'curriculum' ? 'selected' : ''}>منهج</option>
            <option value="url" ${it.action_type === 'url' ? 'selected' : ''}>رابط</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">قيمة الإجراء</label>
          <input type="text" name="action_value" required value="${escapeHtml(it.action_value)}" class="w-full px-3 py-2 border rounded-lg" placeholder="curriculum / question / request / contact / about / grades">
        </div>
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">ترتيب العرض</label>
        <input type="number" name="display_order" value="${it.display_order || 0}" class="w-full px-3 py-2 border rounded-lg">
      </div>
      <div class="flex gap-4 flex-wrap">
        <label class="flex items-center gap-2">
          <input type="checkbox" name="is_active" value="1" ${it.is_active ? 'checked' : ''}>
          <span class="text-sm">مفعّل</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" name="is_admin_only" value="1" ${it.is_admin_only ? 'checked' : ''}>
          <span class="text-sm">للمشرفين فقط</span>
        </label>
      </div>
      <button class="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg">
        <i class="fas fa-save ml-1"></i> حفظ
      </button>
    </form>
  `);
  document.getElementById('menuitem-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd);
    obj.is_active = obj.is_active ? 1 : 0;
    obj.is_admin_only = obj.is_admin_only ? 1 : 0;
    if (obj.id) await api('POST', `/menu-items/${obj.id}`, obj);
    else await api('POST', '/menu-items', obj);
    closeModal();
    toast('تم الحفظ');
    loadMenuItems();
  };
}
function editMenuItem(it) { openMenuItemModal(it); }
async function deleteMenuItem(id) {
  if (!confirm('حذف هذا العنصر؟')) return;
  await api('DELETE', `/menu-items/${id}`);
  toast('تم الحذف');
  loadMenuItems();
}

// =========== Custom Commands ===========
async function loadCommands() {
  const data = await api('GET', '/commands');
  const list = document.getElementById('commands-list');
  if (!data.commands.length) {
    list.innerHTML = `<p class="text-slate-500 text-center py-8">لا توجد أوامر بعد.</p>`;
    return;
  }
  list.innerHTML = data.commands.map(cmd => `
    <div class="border rounded-lg p-3 hover:bg-slate-50">
      <div class="flex justify-between items-start gap-2 flex-wrap">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <code class="bg-slate-100 px-2 py-1 rounded text-xs">${escapeHtml(cmd.code)}</code>
            <span class="font-bold">${escapeHtml(cmd.title)}</span>
            ${cmd.trigger_command ? `<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">${escapeHtml(cmd.trigger_command)}</span>` : ''}
            ${cmd.is_admin_only ? '<span class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">مشرفون</span>' : ''}
            ${cmd.is_active ? '' : '<span class="bg-slate-200 px-2 py-0.5 rounded text-xs">معطّل</span>'}
          </div>
          <p class="text-sm text-slate-600 mt-1 line-clamp-2">${escapeHtml((cmd.response_text || '').substring(0, 200))}</p>
        </div>
        <div class="flex gap-1">
          <button onclick="manageOwnerAttachments('command', ${cmd.id}, ${JSON.stringify(cmd.title).replace(/'/g, "&#39;")})" class="text-purple-500 px-2" title="مرفقات"><i class="fas fa-paperclip"></i></button>
          <button onclick="manageOwnerButtons('command', ${cmd.id}, ${JSON.stringify(cmd.title).replace(/'/g, "&#39;")})" class="text-emerald-500 px-2" title="أزرار"><i class="fas fa-square-plus"></i></button>
          <button onclick='editCommand(${JSON.stringify(cmd).replace(/'/g, "&#39;")})' class="text-blue-500 px-2"><i class="fas fa-edit"></i></button>
          <button onclick="deleteCommand(${cmd.id})" class="text-red-500 px-2"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>
  `).join('');
}
function openCommandModal(item) {
  const it = item || { id: '', code: '', title: '', description: '', response_text: '', parse_mode: 'HTML', trigger_command: '', is_admin_only: 0, is_active: 1 };
  openModal(it.id ? 'تعديل أمر' : 'أمر مخصص جديد', `
    <form id="cmd-form" class="space-y-3">
      <input type="hidden" name="id" value="${it.id || ''}">
      <div>
        <label class="block text-sm font-semibold mb-1">المعرف الفريد (code)</label>
        <input type="text" name="code" required value="${escapeHtml(it.code)}" class="w-full px-3 py-2 border rounded-lg" placeholder="show_schedule">
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">العنوان</label>
        <input type="text" name="title" required value="${escapeHtml(it.title)}" class="w-full px-3 py-2 border rounded-lg">
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">أمر تشغيل اختياري (مثل /rules)</label>
        <input type="text" name="trigger_command" value="${escapeHtml(it.trigger_command || '')}" class="w-full px-3 py-2 border rounded-lg" placeholder="/rules">
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">نص الرد (يدعم HTML)</label>
        <textarea name="response_text" rows="6" required class="w-full px-3 py-2 border rounded-lg">${escapeHtml(it.response_text)}</textarea>
      </div>
      <div class="flex gap-4 flex-wrap">
        <label class="flex items-center gap-2">
          <input type="checkbox" name="is_active" value="1" ${it.is_active ? 'checked' : ''}>
          <span class="text-sm">مفعّل</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" name="is_admin_only" value="1" ${it.is_admin_only ? 'checked' : ''}>
          <span class="text-sm">للمشرفين فقط</span>
        </label>
      </div>
      <button class="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg">
        <i class="fas fa-save ml-1"></i> حفظ
      </button>
    </form>
  `);
  document.getElementById('cmd-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd);
    obj.is_active = obj.is_active ? 1 : 0;
    obj.is_admin_only = obj.is_admin_only ? 1 : 0;
    if (obj.id) await api('POST', `/commands/${obj.id}`, obj);
    else await api('POST', '/commands', obj);
    closeModal();
    toast('تم الحفظ');
    loadCommands();
  };
}
function editCommand(c) { openCommandModal(c); }
async function deleteCommand(id) {
  if (!confirm('حذف هذا الأمر؟')) return;
  await api('DELETE', `/commands/${id}`);
  toast('تم الحذف');
  loadCommands();
}

// =========== Reply Keyboard Items ===========
async function loadReplyKb() {
  const data = await api('GET', '/reply-keyboard');
  const list = document.getElementById('reply-kb-list');
  if (!data.items.length) {
    list.innerHTML = `<p class="text-slate-500 text-center py-8">لا توجد أزرار بعد.</p>`;
    return;
  }
  list.innerHTML = data.items.map(it => `
    <div class="border rounded-lg p-3 hover:bg-slate-50 flex justify-between items-center flex-wrap gap-2">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold">${escapeHtml(it.text)}</span>
          <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">صف ${it.row_index} · عمود ${it.col_index}</span>
          ${it.is_admin_only ? '<span class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">مشرفون</span>' : ''}
          ${it.is_active ? '' : '<span class="bg-slate-200 px-2 py-0.5 rounded text-xs">معطّل</span>'}
        </div>
        <p class="text-xs text-slate-500">إجراء: ${it.action_type} → <code>${escapeHtml(it.action_value)}</code></p>
      </div>
      <div class="flex gap-1">
        <button onclick='editReplyKb(${JSON.stringify(it).replace(/'/g, "&#39;")})' class="text-blue-500 px-2"><i class="fas fa-edit"></i></button>
        <button onclick="deleteReplyKb(${it.id})" class="text-red-500 px-2"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}
function openReplyKbModal(item) {
  const it = item || { id: '', text: '', action_type: 'builtin', action_value: 'curriculum', row_index: 0, col_index: 0, is_active: 1, is_admin_only: 0 };
  openModal(it.id ? 'تعديل زر' : 'إضافة زر دائم', `
    <form id="rkb-form" class="space-y-3">
      <input type="hidden" name="id" value="${it.id || ''}">
      <div>
        <label class="block text-sm font-semibold mb-1">نص الزر</label>
        <input type="text" name="text" required value="${escapeHtml(it.text)}" class="w-full px-3 py-2 border rounded-lg" placeholder="📚 المناهج">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-semibold mb-1">الإجراء</label>
          <select name="action_type" class="w-full px-3 py-2 border rounded-lg">
            <option value="builtin" ${it.action_type === 'builtin' ? 'selected' : ''}>مدمج</option>
            <option value="command" ${it.action_type === 'command' ? 'selected' : ''}>أمر</option>
            <option value="curriculum" ${it.action_type === 'curriculum' ? 'selected' : ''}>منهج</option>
            <option value="grades" ${it.action_type === 'grades' ? 'selected' : ''}>درجات</option>
            <option value="menu" ${it.action_type === 'menu' ? 'selected' : ''}>قائمة</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">القيمة</label>
          <input type="text" name="action_value" required value="${escapeHtml(it.action_value)}" class="w-full px-3 py-2 border rounded-lg">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-semibold mb-1">رقم الصف (Row)</label>
          <input type="number" name="row_index" value="${it.row_index || 0}" class="w-full px-3 py-2 border rounded-lg">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">رقم العمود (Col)</label>
          <input type="number" name="col_index" value="${it.col_index || 0}" class="w-full px-3 py-2 border rounded-lg">
        </div>
      </div>
      <div class="flex gap-4 flex-wrap">
        <label class="flex items-center gap-2">
          <input type="checkbox" name="is_active" value="1" ${it.is_active ? 'checked' : ''}>
          <span class="text-sm">مفعّل</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" name="is_admin_only" value="1" ${it.is_admin_only ? 'checked' : ''}>
          <span class="text-sm">للمشرفين فقط</span>
        </label>
      </div>
      <button class="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg">
        <i class="fas fa-save ml-1"></i> حفظ
      </button>
    </form>
  `);
  document.getElementById('rkb-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd);
    obj.is_active = obj.is_active ? 1 : 0;
    obj.is_admin_only = obj.is_admin_only ? 1 : 0;
    if (obj.id) await api('POST', `/reply-keyboard/${obj.id}`, obj);
    else await api('POST', '/reply-keyboard', obj);
    closeModal();
    toast('تم الحفظ');
    loadReplyKb();
  };
}
function editReplyKb(it) { openReplyKbModal(it); }
async function deleteReplyKb(id) {
  if (!confirm('حذف هذا الزر؟')) return;
  await api('DELETE', `/reply-keyboard/${id}`);
  toast('تم الحذف');
  loadReplyKb();
}

// =========== Broadcast (المراسلة) ===========
let broadcastAttachments = [];
let broadcastButtons = [];

async function loadBroadcast() {
  broadcastAttachments = [];
  broadcastButtons = [];
  document.getElementById('broadcast-attachments').innerHTML = '';
  document.getElementById('broadcast-buttons').innerHTML = '';

  // تحميل الجمهور المتاح للاختيار اليدوي
  const targetSelect = document.getElementById('broadcast-target');
  targetSelect.onchange = async () => {
    const box = document.getElementById('specific-targets-box');
    if (targetSelect.value === 'specific') {
      box.classList.remove('hidden');
      const r = await api('GET', '/targets');
      const all = [
        ...r.users.map(u => ({ chat_id: u.chat_id, label: '👤 ' + u.title, type: 'user' })),
        ...r.groups.map(g => ({ chat_id: g.chat_id, label: '👥 ' + g.title, type: 'group' })),
      ];
      document.getElementById('targets-checkboxes').innerHTML = all.map(t => `
        <label class="flex items-center gap-2 text-xs bg-white border rounded px-2 py-1">
          <input type="checkbox" name="target" value="${t.chat_id}">
          <span class="truncate">${escapeHtml(t.label)}</span>
        </label>
      `).join('') || '<p class="text-slate-500">لا توجد أهداف.</p>';
    } else {
      box.classList.add('hidden');
    }
  };

  // سجل الإذاعات
  const r = await api('GET', '/broadcasts');
  document.getElementById('broadcast-history').innerHTML = (r.broadcasts || []).map(b => `
    <div class="border rounded-lg p-3 flex justify-between items-center flex-wrap gap-2">
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm">${escapeHtml(b.title || '(بدون عنوان)')}</p>
        <p class="text-xs text-slate-500">${b.target_type} · ${new Date(b.created_at).toLocaleString('ar')} · أُرسلت: ${b.sent_count}/${b.total_targets} · فشل: ${b.failed_count}</p>
        <p class="text-xs text-slate-600 line-clamp-1 mt-1">${escapeHtml((b.message_text || '').substring(0, 100))}</p>
      </div>
      <button onclick="deleteBroadcast(${b.id})" class="text-red-500 px-2"><i class="fas fa-trash"></i></button>
    </div>
  `).join('') || '<p class="text-slate-500 text-center py-4">لا توجد إذاعات سابقة.</p>';
}

async function uploadBroadcastFile() {
  const fileInput = document.getElementById('broadcast-file');
  const file = fileInput.files[0];
  if (!file) return toast('اختر ملفاً أولاً', 'error');
  let fileType = 'document';
  if (file.type.startsWith('image/')) fileType = 'photo';
  else if (file.type.startsWith('video/')) fileType = 'video';
  else if (file.type.startsWith('audio/')) fileType = 'audio';

  const fd = new FormData();
  fd.append('file', file);
  fd.append('file_type', fileType);

  toast('جاري رفع الملف...', 'info');
  try {
    const res = await axios.post('/admin/api/upload-to-telegram', fd);
    if (res.data.ok && res.data.attachment) {
      broadcastAttachments.push(res.data.attachment);
      renderBroadcastAttachments();
      fileInput.value = '';
      toast('تم رفع الملف ✓');
    } else {
      toast(res.data.error || 'فشل الرفع', 'error');
    }
  } catch (e) {
    toast(e.response?.data?.error || 'فشل الرفع', 'error');
  }
}
function renderBroadcastAttachments() {
  document.getElementById('broadcast-attachments').innerHTML = broadcastAttachments.map((a, i) => `
    <span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs flex items-center gap-2">
      <i class="fas fa-paperclip"></i> ${escapeHtml(a.file_name || a.file_type)}
      <button onclick="removeBroadcastAttachment(${i})" class="hover:text-red-700"><i class="fas fa-times"></i></button>
    </span>
  `).join('');
}
function removeBroadcastAttachment(i) { broadcastAttachments.splice(i, 1); renderBroadcastAttachments(); }
function addBroadcastButton() {
  broadcastButtons.push({ text: '', url: '' });
  renderBroadcastButtons();
}
function renderBroadcastButtons() {
  document.getElementById('broadcast-buttons').innerHTML = broadcastButtons.map((b, i) => `
    <div class="flex gap-2 items-center">
      <input type="text" placeholder="نص الزر" value="${escapeHtml(b.text)}" oninput="broadcastButtons[${i}].text = this.value" class="flex-1 px-2 py-1 border rounded text-sm">
      <input type="url" placeholder="https://..." value="${escapeHtml(b.url)}" oninput="broadcastButtons[${i}].url = this.value" class="flex-1 px-2 py-1 border rounded text-sm">
      <button type="button" onclick="broadcastButtons.splice(${i},1); renderBroadcastButtons()" class="text-red-500 px-2"><i class="fas fa-times"></i></button>
    </div>
  `).join('');
}

document.getElementById('broadcast-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const targetType = fd.get('target_type');
  const target_ids = targetType === 'specific'
    ? Array.from(document.querySelectorAll('input[name="target"]:checked')).map(i => Number(i.value))
    : [];
  if (targetType === 'specific' && !target_ids.length) {
    return toast('اختر مستلماً واحداً على الأقل', 'error');
  }
  const validButtons = broadcastButtons.filter(b => b.text && b.url);
  const payload = {
    title: fd.get('title') || null,
    message_text: fd.get('message_text'),
    target_type: targetType,
    target_ids,
    attachments: broadcastAttachments,
    buttons: validButtons,
  };
  toast('جاري الإرسال...', 'info');
  try {
    const res = await axios.post('/admin/api/broadcasts', payload);
    if (res.data.ok) {
      toast(`تم الإرسال إلى ${res.data.sent}/${res.data.total} (فشل: ${res.data.failed})`, 'success');
      e.target.reset();
      broadcastAttachments = [];
      broadcastButtons = [];
      renderBroadcastAttachments();
      renderBroadcastButtons();
      loadBroadcast();
    } else {
      toast(res.data.error || 'فشل', 'error');
    }
  } catch (err) {
    toast(err.response?.data?.error || 'فشل الإرسال', 'error');
  }
});
async function deleteBroadcast(id) {
  if (!confirm('حذف هذه الإذاعة من السجل؟')) return;
  await api('DELETE', `/broadcasts/${id}`);
  loadBroadcast();
}

// =========== Reply to Request from Panel ===========
function openRequestReplyModal(req) {
  openModal(`الرد على الطلب #${req.id}`, `
    <div class="bg-slate-50 p-3 rounded mb-3 text-sm">
      <p class="font-bold text-slate-700">من: ${escapeHtml(req.display_name || 'مستخدم')}</p>
      <p class="text-slate-600 whitespace-pre-wrap">${escapeHtml(req.content)}</p>
    </div>
    <form id="req-reply-form" class="space-y-3">
      <textarea name="reply_text" rows="5" required class="w-full px-3 py-2 border rounded-lg" placeholder="اكتب الرد هنا..."></textarea>
      <button class="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg">
        <i class="fas fa-paper-plane ml-1"></i> إرسال الرد
      </button>
    </form>
  `);
  document.getElementById('req-reply-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await axios.post(`/admin/api/requests/${req.id}/reply`, {
        reply_text: fd.get('reply_text'),
      });
      if (res.data.ok) {
        toast(res.data.warning || 'تم إرسال الرد', 'success');
        closeModal();
        loadRequests();
      } else {
        toast(res.data.error || 'فشل', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.error || 'فشل الإرسال', 'error');
    }
  };
}

// تعزيز عرض الطلبات بزر "رد"
const _origLoadRequests = loadRequests;
loadRequests = async function() {
  const data = await api('GET', '/requests');
  if (!data.requests.length) {
    document.getElementById('requests-list').innerHTML = `<p class="text-slate-500 text-center py-8">لا توجد طلبات.</p>`;
    return;
  }
  const typeIcons = { question: '❓', request: '📝', inquiry: '🔍', complaint: '⚠️' };
  const statusBadge = {
    'pending': '<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs">معلق</span>',
    'reviewing': '<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">قيد المراجعة</span>',
    'answered': '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">تم الرد</span>',
    'closed': '<span class="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs">مغلق</span>',
  };
  document.getElementById('requests-list').innerHTML = data.requests.map(r => `
    <div class="border rounded-lg p-4 ${r.status === 'pending' ? 'bg-yellow-50' : ''}">
      <div class="flex justify-between items-start mb-2 flex-wrap gap-2">
        <div>
          <span class="text-2xl">${typeIcons[r.type] || '📨'}</span>
          <span class="font-bold">${escapeHtml(r.display_name || 'مستخدم')}</span>
          <span class="text-xs text-slate-500"><code>#${r.id}</code> · ${new Date(r.created_at).toLocaleString('ar')}</span>
        </div>
        ${statusBadge[r.status]}
      </div>
      <div class="bg-slate-50 p-3 rounded text-sm whitespace-pre-wrap mb-2">${escapeHtml(r.content)}</div>
      ${r.admin_response ? `<div class="bg-emerald-50 p-3 rounded text-sm mb-2"><b>الرد:</b> ${escapeHtml(r.admin_response)}</div>` : ''}
      <div class="flex gap-2 flex-wrap">
        ${r.status !== 'closed' && r.status !== 'answered' ? `<button onclick='openRequestReplyModal(${JSON.stringify(r).replace(/'/g, "&#39;")})' class="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded text-xs"><i class="fas fa-reply"></i> الرد</button>` : ''}
        ${r.status !== 'closed' ? `<button onclick="closeRequest(${r.id})" class="bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded text-xs"><i class="fas fa-check"></i> إغلاق</button>` : ''}
        <button onclick="deleteRequest(${r.id})" class="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-xs"><i class="fas fa-trash"></i> حذف</button>
      </div>
    </div>
  `).join('');
};

// =========== Owner Attachments / Buttons (لربط ملفات وأزرار بمنهج/أمر/رد) ===========
async function manageOwnerAttachments(ownerType, ownerId, ownerTitle) {
  const r = await axios.get(`/admin/api/attachments?owner_type=${ownerType}&owner_id=${ownerId}`);
  const list = (r.data.attachments || []);
  openModal(`📎 مرفقات: ${ownerTitle || ''}`, `
    <div class="space-y-2 mb-4" id="att-list">
      ${list.map(a => `
        <div class="flex justify-between items-center bg-slate-50 p-2 rounded">
          <span class="text-sm"><i class="fas fa-paperclip"></i> ${escapeHtml(a.file_name || a.file_type)} <span class="text-xs text-slate-500">(${a.file_type})</span></span>
          <button onclick="deleteOwnerAttachment(${a.id}, '${ownerType}', ${ownerId}, '${escapeHtml(ownerTitle).replace(/'/g, "")}')" class="text-red-500"><i class="fas fa-times"></i></button>
        </div>
      `).join('') || '<p class="text-slate-500 text-sm">لا توجد مرفقات.</p>'}
    </div>
    <hr class="mb-3">
    <h4 class="font-bold text-sm mb-2">رفع مرفق جديد</h4>
    <div class="space-y-2">
      <input type="file" id="att-file" class="block w-full text-sm">
      <input type="text" id="att-caption" placeholder="تعليق (اختياري)" class="w-full px-3 py-2 border rounded-lg text-sm">
      <button onclick="uploadOwnerAttachment('${ownerType}', ${ownerId}, '${escapeHtml(ownerTitle).replace(/'/g, "")}')" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg w-full text-sm">
        <i class="fas fa-upload ml-1"></i> رفع
      </button>
    </div>
  `);
}
async function uploadOwnerAttachment(ownerType, ownerId, ownerTitle) {
  const f = document.getElementById('att-file').files[0];
  if (!f) return toast('اختر ملفاً', 'error');
  const cap = document.getElementById('att-caption').value;
  let fileType = 'document';
  if (f.type.startsWith('image/')) fileType = 'photo';
  else if (f.type.startsWith('video/')) fileType = 'video';
  else if (f.type.startsWith('audio/')) fileType = 'audio';

  const fd = new FormData();
  fd.append('file', f);
  fd.append('file_type', fileType);
  fd.append('caption', cap);
  toast('جاري الرفع...', 'info');
  try {
    const res = await axios.post('/admin/api/upload-to-telegram', fd);
    if (!res.data.ok) return toast(res.data.error, 'error');
    // ربطه بالمالك
    await axios.post('/admin/api/attachments', {
      ...res.data.attachment,
      owner_type: ownerType,
      owner_id: ownerId,
    });
    toast('تم الرفع');
    manageOwnerAttachments(ownerType, ownerId, ownerTitle);
  } catch (e) {
    toast(e.response?.data?.error || 'فشل', 'error');
  }
}
async function deleteOwnerAttachment(id, ownerType, ownerId, ownerTitle) {
  if (!confirm('حذف هذا المرفق؟')) return;
  await axios.delete(`/admin/api/attachments/${id}`);
  manageOwnerAttachments(ownerType, ownerId, ownerTitle);
}

async function manageOwnerButtons(ownerType, ownerId, ownerTitle) {
  const r = await axios.get(`/admin/api/buttons?owner_type=${ownerType}&owner_id=${ownerId}`);
  const list = r.data.buttons || [];
  openModal(`🔘 أزرار شفافة: ${ownerTitle || ''}`, `
    <div class="space-y-2 mb-4">
      ${list.map(b => `
        <div class="flex justify-between items-center bg-slate-50 p-2 rounded text-sm">
          <span><b>${escapeHtml(b.text)}</b> · ${b.button_type === 'url' ? '🔗 ' + escapeHtml(b.url || '') : '⚡ ' + escapeHtml(b.callback_data || '')}</span>
          <button onclick="deleteOwnerButton(${b.id}, '${ownerType}', ${ownerId}, '${escapeHtml(ownerTitle).replace(/'/g, "")}')" class="text-red-500"><i class="fas fa-times"></i></button>
        </div>
      `).join('') || '<p class="text-slate-500 text-sm">لا توجد أزرار.</p>'}
    </div>
    <hr class="mb-3">
    <h4 class="font-bold text-sm mb-2">إضافة زر</h4>
    <form id="btn-form" class="space-y-2">
      <input type="text" name="text" placeholder="نص الزر" required class="w-full px-3 py-2 border rounded-lg text-sm">
      <select name="button_type" class="w-full px-3 py-2 border rounded-lg text-sm">
        <option value="url">رابط (URL)</option>
        <option value="callback">إجراء داخلي (Callback)</option>
      </select>
      <input type="text" name="url" placeholder="https://... (للنوع URL)" class="w-full px-3 py-2 border rounded-lg text-sm">
      <input type="text" name="callback_data" placeholder="callback_data (للنوع Callback)" class="w-full px-3 py-2 border rounded-lg text-sm">
      <div class="grid grid-cols-2 gap-2">
        <input type="number" name="row_index" placeholder="صف" value="0" class="w-full px-3 py-2 border rounded-lg text-sm">
        <input type="number" name="col_index" placeholder="عمود" value="0" class="w-full px-3 py-2 border rounded-lg text-sm">
      </div>
      <button class="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">
        <i class="fas fa-plus ml-1"></i> إضافة
      </button>
    </form>
  `);
  document.getElementById('btn-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd);
    obj.owner_type = ownerType;
    obj.owner_id = ownerId;
    await axios.post('/admin/api/buttons', obj);
    manageOwnerButtons(ownerType, ownerId, ownerTitle);
  };
}
async function deleteOwnerButton(id, ownerType, ownerId, ownerTitle) {
  if (!confirm('حذف هذا الزر؟')) return;
  await axios.delete(`/admin/api/buttons/${id}`);
  manageOwnerButtons(ownerType, ownerId, ownerTitle);
}

// أزرار لربط مرفقات وأزرار بالمناهج والردود التلقائية
const _origLoadCurriculum = loadCurriculum;
loadCurriculum = async function() {
  await _origLoadCurriculum();
  // إضافة أزرار "📎" و "🔘" لكل مادة
  document.querySelectorAll('#curriculum-list .divide-y > div').forEach(row => {
    const editBtn = row.querySelector('button[onclick^="editCurriculum"]');
    if (!editBtn) return;
    const m = editBtn.getAttribute('onclick').match(/editCurriculum\(({.+?})\)/);
    if (!m) return;
    try {
      const itemData = JSON.parse(m[1].replace(/&#39;/g, "'"));
      const buttonsContainer = editBtn.parentElement;
      if (!buttonsContainer.querySelector('.attach-btn')) {
        buttonsContainer.insertAdjacentHTML('afterbegin', `
          <button class="attach-btn text-purple-500 px-2" title="مرفقات" onclick="manageOwnerAttachments('curriculum', ${itemData.id}, '${escapeHtml(itemData.subject_name).replace(/'/g, '')}')"><i class="fas fa-paperclip"></i></button>
          <button class="text-emerald-500 px-2" title="أزرار شفافة" onclick="manageOwnerButtons('curriculum', ${itemData.id}, '${escapeHtml(itemData.subject_name).replace(/'/g, '')}')"><i class="fas fa-square-plus"></i></button>
        `);
      }
    } catch (_) {}
  });
};

const _origLoadReplies = loadReplies;
loadReplies = async function() {
  await _origLoadReplies();
  document.querySelectorAll('#replies-list > div').forEach(row => {
    const editBtn = row.querySelector('button[onclick^="editReply"]');
    if (!editBtn) return;
    const m = editBtn.getAttribute('onclick').match(/editReply\(({.+?})\)/);
    if (!m) return;
    try {
      const itemData = JSON.parse(m[1].replace(/&#39;/g, "'"));
      const buttonsContainer = editBtn.parentElement;
      if (!buttonsContainer.querySelector('.attach-btn')) {
        buttonsContainer.insertAdjacentHTML('afterbegin', `
          <button class="attach-btn text-purple-500 px-2" title="مرفقات" onclick="manageOwnerAttachments('reply', ${itemData.id}, '${escapeHtml(itemData.trigger_text).replace(/'/g, '')}')"><i class="fas fa-paperclip"></i></button>
          <button class="text-emerald-500 px-2" title="أزرار شفافة" onclick="manageOwnerButtons('reply', ${itemData.id}, '${escapeHtml(itemData.trigger_text).replace(/'/g, '')}')"><i class="fas fa-square-plus"></i></button>
        `);
      }
    } catch (_) {}
  });
};

// =========== Grades Tab ===========
async function loadGradesTab() {
  // إحصائيات
  try {
    const stats = await api('GET', '/grades/count');
    if (stats?.ok) {
      const elT = document.getElementById('grades-stat-total');
      const elS = document.getElementById('grades-stat-students');
      const elSe = document.getElementById('grades-stat-semesters');
      if (elT) elT.textContent = (stats.total || 0).toLocaleString('ar-EG');
      if (elS) elS.textContent = (stats.students || 0).toLocaleString('ar-EG');
      if (elSe) elSe.textContent = (stats.semesters || 0).toLocaleString('ar-EG');
    }
  } catch (_) {}

  // قائمة الفصول المسموح بها
  const semR = await api('GET', '/allowed-semesters');
  const list = document.getElementById('allowed-semesters-list');
  if (list) {
    list.innerHTML = (semR.semesters || []).map(s => `
      <label class="flex items-center gap-2 border rounded-full px-3 py-1 cursor-pointer ${s.is_allowed ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50'}">
        <input type="checkbox" ${s.is_allowed ? 'checked' : ''} onchange="toggleAllowedSemester(${s.id}, this.checked)">
        <span class="text-sm">${escapeHtml(s.semester)}</span>
      </label>
    `).join('') || '<p class="text-slate-500 text-sm">لا توجد فصول. ارفع ملف درجات أولاً.</p>';
  }

  // جدول الدرجات
  await loadGradesTable();
}
async function toggleAllowedSemester(id, checked) {
  await api('POST', `/allowed-semesters/${id}`, { is_allowed: checked ? 1 : 0 });
  toast('تم التحديث');
}
async function loadGradesTable() {
  const q = document.getElementById('grades-search')?.value || '';
  const r = await axios.get('/admin/api/grades' + (q ? `?q=${encodeURIComponent(q)}` : ''));
  const grades = r.data.grades || [];
  const tbody = document.getElementById('grades-table');
  if (!grades.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-500">لا توجد سجلات.</td></tr>';
    return;
  }
  tbody.innerHTML = grades.slice(0, 200).map(g => `
    <tr class="hover:bg-slate-50">
      <td class="p-2"><code class="text-xs">${escapeHtml(g.academic_id)}</code></td>
      <td class="p-2">${escapeHtml(g.student_name || '-')}</td>
      <td class="p-2">${escapeHtml(g.semester)}</td>
      <td class="p-2">${escapeHtml(g.subject_name)}</td>
      <td class="p-2 font-bold">${g.total_score || 0}</td>
      <td class="p-2">${escapeHtml(g.grade_label || '-')}</td>
      <td class="p-2"><button onclick="deleteGradeRow(${g.id})" class="text-red-500"><i class="fas fa-trash"></i></button></td>
    </tr>
  `).join('') + (grades.length > 200 ? `<tr><td colspan="7" class="text-center py-2 text-slate-500 text-xs">يُعرض 200 من ${grades.length}</td></tr>` : '');
}
document.getElementById('grades-search')?.addEventListener('input', () => {
  clearTimeout(window._gst);
  window._gst = setTimeout(loadGradesTable, 300);
});
async function deleteGradeRow(id) {
  if (!confirm('حذف هذا السجل؟')) return;
  await api('DELETE', `/grades/${id}`);
  loadGradesTable();
}

// ============================================
// رفع CSV للدرجات — Streaming Chunked Upload (يدعم ملفات ~1GB)
// قراءة الملف على شكل تيار + تجزئته إلى دفعات صغيرة + إرسالها متتالية للخادم
// ============================================
let _gradesUploadAbort = false;

document.getElementById('grades-upload-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileEl = document.getElementById('grades-csv');
  const file = fileEl.files[0];
  if (!file) return toast('اختر ملفاً', 'error');
  const replace = document.getElementById('grades-replace').checked;
  const chunkSize = Number(document.getElementById('grades-chunk-size')?.value || 500);

  const btn = document.getElementById('grades-upload-btn');
  const cancelBtn = document.getElementById('grades-cancel-btn');
  const box = document.getElementById('grades-progress-box');
  const bar = document.getElementById('grades-progress-bar');
  const pct = document.getElementById('grades-progress-percent');
  const lbl = document.getElementById('grades-progress-label');
  const elRead = document.getElementById('grades-pg-read');
  const elSent = document.getElementById('grades-pg-sent');
  const elFailed = document.getElementById('grades-pg-failed');
  const elSpeed = document.getElementById('grades-pg-speed');
  const elEta = document.getElementById('grades-pg-eta');
  const elStatJob = document.getElementById('grades-stat-job');

  _gradesUploadAbort = false;
  btn.disabled = true;
  btn.classList.add('opacity-60', 'cursor-not-allowed');
  cancelBtn.classList.remove('hidden');
  cancelBtn.onclick = () => { _gradesUploadAbort = true; toast('سيتم إيقاف الرفع...', 'info'); };
  box.classList.remove('hidden');
  bar.style.width = '0%'; pct.textContent = '0%';
  lbl.textContent = 'جاري التهيئة...';
  if (elStatJob) elStatJob.textContent = 'جارٍ الرفع';

  const startedAt = Date.now();
  let totalRead = 0, totalSent = 0, totalFailed = 0;
  const fileSize = file.size;

  try {
    // 1) init job
    const initR = await axios.post('/admin/api/grades/upload/init', { replace, total_chunks: 0 });
    if (!initR.data?.ok) throw new Error(initR.data?.error || 'فشل التهيئة');
    const token = initR.data.upload_token;

    // 2) stream-parse الملف
    const stream = file.stream();
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let leftover = '';
    let headers = null;
    let buffer = [];

    // خريطة تحويل الأعمدة من التنسيق الجديد إلى أسماء الحقول في قاعدة البيانات
    const headerMap = {
      'الرقم الأكاديمي': 'academic_id',
      'اسم الطالب': 'student_name',
      'الرقم السري': 'secret_code',
      'اسم الفرع': 'branch_name',
      'معرف الفرع': 'branch_id',
      'العام الدراسي': 'academic_year',
      'الفصل الدراسي': 'semester',
      'معرف الفصل': 'semester_id',
      'التخصص': 'specialization',
      'المادة': 'subject_name',
      'معرف المادة': 'subject_id',
      'المجموعة': 'group_name',
      'معرف المجموعة': 'group_id',
      'نوع السكن': 'housing_type',
      'مطلوب استبيان': 'survey_required',
      'المرفقات': 'attachments',
      'حضور': 'attendance_score',
      'مشاركة': 'participation_score',
      'تكاليف': 'assignments_score',
      'نظري نصفي': 'theory_midterm',
      'عملي نصفي': 'practical_midterm',
      'نظري نهائي': 'theory_final',
      'عملي نهائي': 'practical_final',
      'شفهي تلاوة نصفي': 'oral_recitation_mid',
      'شفهي حفظ نصفي': 'oral_memorize_mid',
      'شفهي تلاوة نهائي': 'oral_recitation_final',
      'شفهي حفظ نهائي': 'oral_memorize_final',
      'كتابة خطبة': 'khutbah_writing',
      'إلقاء في القاعة': 'hall_delivery',
      'الافتتاح': 'opening_score',
      'حركة اليدين': 'hand_movement',
      'الملابس': 'clothing_score',
      'درجة الصوت': 'voice_level',
      'الانسجام مع الموضوع': 'topic_consistency',
      'مستوى الثقة': 'confidence_level',
      'التأثير والاقناع': 'influence_score',
      'التحضير': 'preparation_score',
      'التلخيص': 'summarization_score',
      'وحدة الموضوع': 'topic_unity',
      'كتابة خطب': 'khutbah_writing2',
      'خاطر أو خطبة في مسجد': 'khutbah_in_mosque',
      'الترفيع': 'promotion_status',
      'المجموع': 'total_score',
      'التقدير': 'grade_label',
      'bitdaragat3': 'bitdaragat3',
      'id_daragat': 'id_daragat',
      'احتساب المادة': 'credit_hours',
      'مبقي': 'is_remaining',
      'درجة النجاح': 'passing_score',
      'تبع القرآن': 'follows_quran'
    };

    const flushChunk = async () => {
      if (!buffer.length) return;
      const slice = buffer; buffer = [];
      try {
        const r = await axios.post('/admin/api/grades/upload/chunk', { upload_token: token, rows: slice });
        if (r.data?.ok) {
          totalSent += r.data.inserted || 0;
          totalFailed += r.data.failed || 0;
        } else {
          totalFailed += slice.length;
        }
      } catch (err) {
        totalFailed += slice.length;
      }
    };

    const updateProgress = (bytesPos) => {
      const ratio = fileSize ? Math.min(100, Math.round((bytesPos / fileSize) * 100)) : 0;
      bar.style.width = ratio + '%';
      pct.textContent = ratio + '%';
      lbl.textContent = `جاري الرفع... (${ratio}%)`;
      elRead.textContent = totalRead.toLocaleString('ar-EG');
      elSent.textContent = totalSent.toLocaleString('ar-EG');
      elFailed.textContent = totalFailed.toLocaleString('ar-EG');
      const sec = (Date.now() - startedAt) / 1000;
      const speed = sec > 0 ? Math.round(totalRead / sec) : 0;
      elSpeed.textContent = speed.toLocaleString('ar-EG');
      if (speed > 0 && fileSize > 0) {
        const remaining = Math.max(0, fileSize - bytesPos);
        const etaSec = Math.round(remaining / Math.max(1, (bytesPos / Math.max(1, sec))));
        elEta.textContent = `الوقت المتبقّي تقريباً: ${etaSec} ثانية`;
      }
    };

    let bytesPos = 0;
    while (true) {
      if (_gradesUploadAbort) throw new Error('تم الإلغاء بواسطة المستخدم');
      const { value, done } = await reader.read();
      if (done) break;
      bytesPos += value.byteLength;
      const text = leftover + decoder.decode(value, { stream: true });
      const lines = text.split(/\r?\n/);
      leftover = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const cols = parseCSVLine(line);
        if (!headers) {
          headers = cols.map(h => {
            const trimmed = h.trim();
            return headerMap[trimmed] || trimmed;
          });
          continue;
        }
        const obj = {};
        headers.forEach((h, j) => { obj[h] = (cols[j] || '').trim(); });
        buffer.push(obj);
        totalRead++;
        if (buffer.length >= chunkSize) {
          await flushChunk();
          updateProgress(bytesPos);
        }
      }
      updateProgress(bytesPos);
    }
    // residue
    if (leftover.trim()) {
      const cols = parseCSVLine(leftover);
      if (headers) {
        const obj = {};
        headers.forEach((h, j) => { obj[h] = (cols[j] || '').trim(); });
        buffer.push(obj);
        totalRead++;
      } else {
        // في حال كان الملف سطراً واحداً فقط وهو الهيدر (نادر جداً)
        const potentialHeaders = cols.map(h => {
          const trimmed = h.trim();
          return headerMap[trimmed] || trimmed;
        });
        // لا نضيف كبيانات بل كأعمدة
        headers = potentialHeaders;
      }
    }
    await flushChunk();
    updateProgress(fileSize);

    // 3) finalize
    lbl.textContent = 'إنهاء وتجميع الفصول المسموح بها...';
    const finR = await axios.post('/admin/api/grades/upload/finalize', { upload_token: token });
    if (!finR.data?.ok) throw new Error(finR.data?.error || 'فشل الإنهاء');

    bar.style.width = '100%'; pct.textContent = '100%';
    lbl.textContent = '✅ اكتمل الرفع';
    if (elStatJob) elStatJob.textContent = 'مكتمل';
    document.getElementById('grades-upload-result').innerHTML = `
      <div class="bg-emerald-50 border border-emerald-300 p-3 rounded text-sm">
        ✅ تم رفع <b>${totalSent.toLocaleString('ar-EG')}</b> سجل من أصل <b>${totalRead.toLocaleString('ar-EG')}</b>
        (فشل: <b class="text-red-600">${totalFailed.toLocaleString('ar-EG')}</b>) في
        <b>${Math.round((Date.now()-startedAt)/1000)}</b> ثانية.
      </div>
    `;
    toast('اكتمل رفع الدرجات بنجاح');
    fileEl.value = '';
    setTimeout(() => loadGradesTab(), 600);
  } catch (err) {
    lbl.textContent = '❌ فشل الرفع';
    if (elStatJob) elStatJob.textContent = 'فشل';
    document.getElementById('grades-upload-result').innerHTML = `
      <div class="bg-red-50 border border-red-300 p-3 rounded text-sm text-red-700">
        ${escapeHtml(err.message || 'خطأ غير معروف')}
      </div>`;
    toast(err.message || 'فشل الرفع', 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-60', 'cursor-not-allowed');
    cancelBtn.classList.add('hidden');
  }
});

async function clearAllGrades() {
  if (!confirm('سيتم حذف جميع سجلات الدرجات. هل أنت متأكد؟')) return;
  try {
    await api('POST', '/grades/clear');
    toast('تم حذف جميع الدرجات');
    loadGradesTab();
  } catch (e) {
    toast('فشل الحذف', 'error');
  }
}

function parseCSVLine(line) {
  const result = [];
  let inQuotes = false;
  let cur = '';
  // تحديد الفاصل تلقائياً: إذا وجدنا فاصلة منقوطة نستخدمها، وإلا نستخدم الفاصلة العادية
  const delimiter = line.includes(';') ? ';' : ',';
  
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i+1] === '"' && inQuotes) { cur += '"'; i++; }
    else if (ch === '"') inQuotes = !inQuotes;
    else if (ch === delimiter && !inQuotes) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

// ============================================
// =========== Unified Buttons (الأزرار الموحّدة) ===========
// واجهة موحّدة لإدارة كل الأزرار: مكان (inline / reply / both)،
// إجراء (builtin / command / curriculum / grades / url / menu)،
// ستايل (لون، حجم، عرض كامل، أيقونة، إيموجي)، ترتيب صف/عمود.
// ============================================
let _btnFilter = 'all';
let _btnsCache = [];

async function loadUnifiedButtons() {
  const data = await api('GET', '/unified-buttons');
  _btnsCache = data.buttons || [];
  renderUnifiedButtons();
  renderUnifiedButtonsPreview();
}

function renderUnifiedButtons() {
  const list = document.getElementById('buttons-list');
  if (!list) return;
  let items = _btnsCache.slice();
  if (_btnFilter !== 'all') items = items.filter(b => b.placement === _btnFilter);
  if (!items.length) {
    list.innerHTML = `<p class="text-slate-500 text-center py-8">لا توجد أزرار في هذا التصنيف.</p>`;
    return;
  }
  const placementBadge = (p) => {
    const m = {
      'inline': '<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs"><i class="fas fa-eye-slash ml-1"></i>قائمة شفافة</span>',
      'reply':  '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs"><i class="fas fa-keyboard ml-1"></i>لوحة دائمة</span>',
      'both':   '<span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs"><i class="fas fa-layer-group ml-1"></i>كلاهما</span>',
    };
    return m[p] || '';
  };
  const colorChip = (c) => `<span class="inline-block w-3 h-3 rounded-full bg-${c}-500 align-middle ml-1"></span>`;
  list.innerHTML = items.map(b => `
    <div class="border rounded-lg p-3 hover:bg-slate-50 flex flex-wrap justify-between items-center gap-2">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          ${colorChip(b.color || 'emerald')}
          <span class="font-bold">${escapeHtml((b.emoji || '') + ' ' + b.text)}</span>
          ${placementBadge(b.placement)}
          ${b.full_width ? '<span class="bg-slate-200 px-2 py-0.5 rounded text-xs">عرض كامل</span>' : ''}
          ${b.is_admin_only ? '<span class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">مشرفون</span>' : ''}
          ${b.is_active ? '' : '<span class="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-xs">معطّل</span>'}
        </div>
        <p class="text-xs text-slate-500 mt-1">
          إجراء: <code class="bg-slate-100 px-1 rounded">${escapeHtml(b.action_type)}</code> →
          <code class="bg-slate-100 px-1 rounded">${escapeHtml(b.action_value)}</code>
          · ترتيب: ${b.display_order} · صف ${b.row_index} عمود ${b.col_index} · حجم ${b.size || 'md'}
        </p>
      </div>
      <div class="flex gap-1">
        <button onclick='editUnifiedButton(${JSON.stringify(b).replace(/'/g, "&#39;")})' class="text-blue-500 px-2" title="تعديل"><i class="fas fa-edit"></i></button>
        <button onclick="toggleUnifiedButton(${b.id}, ${b.is_active ? 0 : 1})" class="text-slate-600 px-2" title="تفعيل/تعطيل"><i class="fas fa-power-off"></i></button>
        <button onclick="deleteUnifiedButton(${b.id})" class="text-red-500 px-2" title="حذف"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function renderUnifiedButtonsPreview() {
  const inlineEl = document.getElementById('buttons-preview-inline');
  const replyEl = document.getElementById('buttons-preview-reply');
  if (!inlineEl || !replyEl) return;

  // Inline (الأزرار الشفافة) - تجميع حسب display_order
  const inlineBtns = _btnsCache.filter(b => (b.placement === 'inline' || b.placement === 'both') && b.is_active);
  inlineBtns.sort((a, b) => (a.display_order||0) - (b.display_order||0));
  inlineEl.innerHTML = inlineBtns.length
    ? `<div class="text-[11px] text-slate-500 mb-1">📲 قائمة شفافة (Inline):</div>
       <div class="flex flex-wrap gap-2">${inlineBtns.map(b => previewBtnHtml(b, 'inline')).join('')}</div>`
    : '<p class="text-xs text-slate-400">لا توجد أزرار شفافة مُفعّلة.</p>';

  // Reply (لوحة الكتابة) - تجميع حسب row_index
  const replyBtns = _btnsCache.filter(b => (b.placement === 'reply' || b.placement === 'both') && b.is_active);
  const rows = {};
  replyBtns.forEach(b => { (rows[b.row_index||0] = rows[b.row_index||0] || []).push(b); });
  Object.values(rows).forEach(r => r.sort((a, b) => (a.col_index||0) - (b.col_index||0)));
  const sortedKeys = Object.keys(rows).sort((a, b) => Number(a) - Number(b));
  replyEl.innerHTML = sortedKeys.length
    ? `<div class="text-[11px] text-slate-500 mb-1">⌨️ لوحة دائمة (Reply):</div>
       ${sortedKeys.map(k => `<div class="flex gap-1 mb-1">${rows[k].map(b => previewBtnHtml(b, 'reply')).join('')}</div>`).join('')}`
    : '<p class="text-xs text-slate-400">لا توجد أزرار دائمة مُفعّلة.</p>';
}

function previewBtnHtml(b, mode) {
  const c = b.color || 'emerald';
  const sizeCls = b.size === 'sm' ? 'text-xs px-2 py-1' : b.size === 'lg' ? 'text-base px-4 py-2' : 'text-sm px-3 py-1.5';
  const fw = b.full_width ? 'w-full' : '';
  const round = mode === 'reply' ? 'rounded-md' : 'rounded-full';
  return `<span class="inline-flex items-center gap-1 ${fw} ${round} ${sizeCls} bg-${c}-100 text-${c}-800 border border-${c}-300">
    ${b.emoji ? `<span>${escapeHtml(b.emoji)}</span>` : ''}
    <span>${escapeHtml(b.text)}</span>
  </span>`;
}

document.querySelectorAll('#buttons-filter .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    _btnFilter = btn.dataset.filter;
    document.querySelectorAll('#buttons-filter .filter-btn').forEach(b => {
      b.classList.remove('bg-emerald-500', 'text-white');
      b.classList.add('bg-white', 'text-slate-700');
    });
    btn.classList.remove('bg-white', 'text-slate-700');
    btn.classList.add('bg-emerald-500', 'text-white');
    renderUnifiedButtons();
  });
});

function editUnifiedButton(b) { openButtonModal(b); }

async function deleteUnifiedButton(id) {
  if (!confirm('حذف هذا الزر؟')) return;
  await api('DELETE', `/unified-buttons/${id}`);
  toast('تم الحذف');
  loadUnifiedButtons();
}

async function toggleUnifiedButton(id, active) {
  await api('POST', `/unified-buttons/${id}`, { is_active: active });
  toast(active ? 'تم التفعيل' : 'تم التعطيل');
  loadUnifiedButtons();
}

function openButtonModal(item) {
  const it = item || {
    id: '', text: '', emoji: '', icon: '', placement: 'inline',
    action_type: 'builtin', action_value: 'curriculum',
    row_index: 0, col_index: 0, display_order: 0,
    color: 'emerald', size: 'md', full_width: 0,
    is_active: 1, is_admin_only: 0, show_in_groups: 0
  };
  const colors = ['emerald','teal','blue','sky','indigo','purple','pink','rose','red','orange','amber','yellow','lime','slate','gray'];
  const colorOpts = colors.map(c => `<option value="${c}" ${it.color===c?'selected':''}>${c}</option>`).join('');
  openModal(it.id ? 'تعديل زر موحّد' : 'إضافة زر جديد', `
    <form id="ub-form" class="space-y-3">
      <input type="hidden" name="id" value="${it.id || ''}">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="md:col-span-2">
          <label class="block text-sm font-semibold mb-1">نص الزر *</label>
          <input type="text" name="text" required value="${escapeHtml(it.text)}" class="w-full px-3 py-2 border rounded-lg" placeholder="📚 المناهج">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">إيموجي (اختياري)</label>
          <input type="text" name="emoji" maxlength="6" value="${escapeHtml(it.emoji||'')}" class="w-full px-3 py-2 border rounded-lg text-center" placeholder="📚">
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label class="block text-sm font-semibold mb-1">المكان *</label>
          <select name="placement" class="w-full px-3 py-2 border rounded-lg">
            <option value="inline" ${it.placement==='inline'?'selected':''}>قائمة شفافة (Inline)</option>
            <option value="reply" ${it.placement==='reply'?'selected':''}>لوحة دائمة أسفل الكتابة</option>
            <option value="both" ${it.placement==='both'?'selected':''}>كلاهما</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">نوع الإجراء *</label>
          <select name="action_type" class="w-full px-3 py-2 border rounded-lg">
            <option value="builtin" ${it.action_type==='builtin'?'selected':''}>مدمج (curriculum/grades/...)</option>
            <option value="command" ${it.action_type==='command'?'selected':''}>أمر مخصّص (code)</option>
            <option value="curriculum" ${it.action_type==='curriculum'?'selected':''}>المناهج</option>
            <option value="grades" ${it.action_type==='grades'?'selected':''}>الدرجات</option>
            <option value="url" ${it.action_type==='url'?'selected':''}>رابط خارجي (URL)</option>
            <option value="menu" ${it.action_type==='menu'?'selected':''}>قائمة فرعية</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">قيمة الإجراء *</label>
          <input type="text" name="action_value" required value="${escapeHtml(it.action_value)}" class="w-full px-3 py-2 border rounded-lg" placeholder="curriculum / show_rules / https://...">
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label class="block text-sm font-semibold mb-1">اللون</label>
          <select name="color" class="w-full px-3 py-2 border rounded-lg">${colorOpts}</select>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">الحجم</label>
          <select name="size" class="w-full px-3 py-2 border rounded-lg">
            <option value="sm" ${it.size==='sm'?'selected':''}>صغير</option>
            <option value="md" ${it.size==='md'?'selected':''}>متوسط</option>
            <option value="lg" ${it.size==='lg'?'selected':''}>كبير</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">صف</label>
          <input type="number" name="row_index" value="${it.row_index||0}" class="w-full px-3 py-2 border rounded-lg">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">عمود / ترتيب</label>
          <input type="number" name="col_index" value="${it.col_index||0}" class="w-full px-3 py-2 border rounded-lg">
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1">الترتيب العام (Inline)</label>
        <input type="number" name="display_order" value="${it.display_order||0}" class="w-full px-3 py-2 border rounded-lg">
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <label class="flex items-center gap-2 border rounded-lg p-2"><input type="checkbox" name="full_width" value="1" ${it.full_width?'checked':''}> عرض كامل</label>
        <label class="flex items-center gap-2 border rounded-lg p-2"><input type="checkbox" name="is_active" value="1" ${it.is_active?'checked':''}> مفعّل</label>
        <label class="flex items-center gap-2 border rounded-lg p-2"><input type="checkbox" name="is_admin_only" value="1" ${it.is_admin_only?'checked':''}> للمشرفين فقط</label>
        <label class="flex items-center gap-2 border rounded-lg p-2"><input type="checkbox" name="show_in_groups" value="1" ${it.show_in_groups?'checked':''}> يظهر في المجموعات</label>
      </div>

      <button class="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg">
        <i class="fas fa-save ml-1"></i> حفظ
      </button>
    </form>
  `);
  document.getElementById('ub-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd);
    ['full_width','is_active','is_admin_only','show_in_groups'].forEach(k => obj[k] = obj[k] ? 1 : 0);
    ['row_index','col_index','display_order'].forEach(k => obj[k] = Number(obj[k] || 0));
    if (obj.id) { const id = obj.id; delete obj.id; await api('POST', `/unified-buttons/${id}`, obj); }
    else { delete obj.id; await api('POST', '/unified-buttons', obj); }
    closeModal();
    toast('تم الحفظ');
    loadUnifiedButtons();
  };
}

// ============================================
// 🔔 إشعارات Web Push + إدارة الأجهزة
// ============================================
let _pwaInstallPromptEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _pwaInstallPromptEvent = e;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.classList.remove('hidden');
});

async function triggerPwaInstall() {
  if (!_pwaInstallPromptEvent) {
    toast('التطبيق إما مثبت بالفعل أو لا يدعمه المتصفح', 'info');
    return;
  }
  _pwaInstallPromptEvent.prompt();
  const { outcome } = await _pwaInstallPromptEvent.userChoice;
  if (outcome === 'accepted') toast('تم تثبيت التطبيق ✅');
  _pwaInstallPromptEvent = null;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.classList.add('hidden');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function ensurePushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    toast('المتصفح لا يدعم الإشعارات', 'error');
    return null;
  }
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    toast('يجب السماح بالإشعارات', 'error');
    return null;
  }
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const pk = await api('GET', '/push/public-key');
    const vapidKey = pk?.key || pk?.public_key;
    if (!vapidKey) { toast('VAPID غير مهيأ — اضغط "تهيئة VAPID"', 'error'); return null; }
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }
  return sub;
}

async function enableThisDevice() {
  try {
    const sub = await ensurePushSubscription();
    if (!sub) return;
    const json = sub.toJSON();
    const label = `${navigator.platform || 'Browser'} · ${navigator.userAgent.split(') ')[0].split('(').pop() || 'device'}`;
    await api('POST', '/push/subscribe', {
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      label,
      ua: navigator.userAgent,
    });
    toast('تم تفعيل الإشعارات على هذا الجهاز ✅');
    loadDevices();
  } catch (e) {
    console.error(e);
    toast('فشل التفعيل: ' + (e.message || e), 'error');
  }
}

async function disableThisDevice() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api('POST', '/push/unsubscribe', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    toast('تم إيقاف الإشعارات على هذا الجهاز');
    loadDevices();
  } catch (e) {
    toast('فشل الإيقاف', 'error');
  }
}

async function initVapid() {
  if (!confirm('سيتم توليد مفاتيح VAPID جديدة. إذا كانت موجودة بالفعل، سيتم تجاوز الإجراء.')) return;
  try {
    const r = await api('POST', '/push/init');
    toast(r.created ? 'تم إنشاء مفاتيح VAPID ✅' : 'المفاتيح موجودة بالفعل');
    loadDevices();
  } catch (e) { toast('فشل: ' + (e.message || e), 'error'); }
}

async function sendTestPush() {
  try {
    const r = await api('POST', '/push/test', { title: '🔔 إشعار تجريبي', body: 'اختبار الإشعارات يعمل بنجاح!' });
    toast(`تم الإرسال إلى ${r.sent || 0} جهاز`);
  } catch (e) { toast('فشل: ' + (e.message || e), 'error'); }
}

async function loadDevices() {
  try {
    const [pk, mineRaw, allRaw] = await Promise.all([
      api('GET', '/push/public-key').catch(() => ({})),
      api('GET', '/push/devices').catch(() => ({})),
      api('GET', '/push/all-devices').catch(() => ({})),
    ]);
    const mine = { items: mineRaw?.items || mineRaw?.devices || [] };
    const all  = { items: allRaw?.items  || allRaw?.devices  || [] };
    const vapidKey = pk?.key || pk?.public_key;
    const vapidOk = !!vapidKey;
    const html = `
      <div class="bg-white rounded-xl shadow p-5 mb-4">
        <h3 class="font-bold mb-3"><i class="fas fa-key text-amber-500 ml-1"></i> حالة الإشعارات (VAPID)</h3>
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <span class="px-3 py-1 rounded-full text-sm ${vapidOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">
            ${vapidOk ? '✅ VAPID مهيأ' : '❌ VAPID غير مهيأ'}
          </span>
          ${vapidOk ? '' : `<button onclick="initVapid()" class="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm"><i class="fas fa-magic ml-1"></i> تهيئة VAPID</button>`}
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="enableThisDevice()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm">
            <i class="fas fa-bell ml-1"></i> تفعيل الإشعارات على هذا الجهاز
          </button>
          <button onclick="disableThisDevice()" class="bg-slate-400 hover:bg-slate-500 text-white px-3 py-2 rounded-lg text-sm">
            <i class="fas fa-bell-slash ml-1"></i> إيقاف على هذا الجهاز
          </button>
          <button onclick="sendTestPush()" class="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm">
            <i class="fas fa-paper-plane ml-1"></i> إرسال إشعار تجريبي
          </button>
          <button id="pwa-install-btn" onclick="triggerPwaInstall()" class="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-lg text-sm ${_pwaInstallPromptEvent ? '' : 'hidden'}">
            <i class="fas fa-download ml-1"></i> تثبيت كتطبيق
          </button>
        </div>
        <p class="text-xs text-slate-500 mt-3">💡 يمكنك تثبيت لوحة التحكم كتطبيق على الجوال أو الكمبيوتر عبر قائمة المتصفح ← "تثبيت التطبيق".</p>
      </div>

      <div class="bg-white rounded-xl shadow p-5 mb-4">
        <h3 class="font-bold mb-3"><i class="fas fa-mobile-alt text-emerald-500 ml-1"></i> أجهزتي (${mine.items?.length || 0})</h3>
        ${(mine.items || []).length === 0 ? '<p class="text-slate-500 text-sm">لا توجد أجهزة مسجلة لحسابك.</p>' :
          `<div class="divide-y">${mine.items.map(d => `
            <div class="py-2 flex flex-wrap justify-between items-center gap-2">
              <div class="flex-1 min-w-[180px]">
                <p class="font-semibold text-sm">${escapeHtml(d.label || 'جهاز')}</p>
                <p class="text-xs text-slate-500">${escapeHtml((d.endpoint || '').substring(0, 60))}...</p>
                <p class="text-[11px] text-slate-400">${d.created_at || ''}</p>
              </div>
              <div class="flex gap-1">
                <label class="inline-flex items-center gap-1 text-xs">
                  <input type="checkbox" ${d.enabled ? 'checked' : ''} onchange="toggleDevice(${d.id}, this.checked)">
                  مفعّل
                </label>
                <button onclick="deleteDevice(${d.id})" class="text-red-500 hover:text-red-700 px-2"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          `).join('')}</div>`}
      </div>

      <div class="bg-white rounded-xl shadow p-5">
        <h3 class="font-bold mb-3"><i class="fas fa-users-cog text-sky-500 ml-1"></i> جميع أجهزة المشرفين (${all.items?.length || 0})</h3>
        ${(all.items || []).length === 0 ? '<p class="text-slate-500 text-sm">لا توجد أجهزة مسجلة.</p>' :
          `<div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-slate-100"><tr>
            <th class="p-2 text-right">المشرف</th><th class="p-2 text-right">الجهاز</th>
            <th class="p-2 text-right">مفعّل</th><th class="p-2 text-right">إجراء</th>
          </tr></thead><tbody>
          ${all.items.map(d => `
            <tr class="border-b">
              <td class="p-2">${escapeHtml(d.username || d.user_id || '-')}</td>
              <td class="p-2"><span class="text-xs">${escapeHtml(d.label || 'جهاز')}</span></td>
              <td class="p-2">
                <label class="inline-flex items-center gap-1">
                  <input type="checkbox" ${d.enabled ? 'checked' : ''} onchange="toggleDevice(${d.id}, this.checked)">
                </label>
              </td>
              <td class="p-2"><button onclick="deleteDevice(${d.id})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></td>
            </tr>
          `).join('')}
          </tbody></table></div>`}
      </div>
    `;
    document.getElementById('devices-content').innerHTML = html;
  } catch (e) {
    document.getElementById('devices-content').innerHTML = `<div class="text-red-500">فشل التحميل: ${escapeHtml(e.message || '')}</div>`;
  }
}
async function toggleDevice(id, enabled) {
  try { await api('POST', `/push/devices/${id}`, { enabled: enabled ? 1 : 0 }); toast('تم التحديث'); }
  catch (e) { toast('فشل', 'error'); loadDevices(); }
}
async function deleteDevice(id) {
  if (!confirm('حذف هذا الجهاز؟')) return;
  try { await api('DELETE', `/push/devices/${id}`); toast('تم الحذف'); loadDevices(); }
  catch (e) { toast('فشل', 'error'); }
}

// ============================================
// 📡 توجيه الإشعارات للمشرفين
// ============================================
const EVENT_TYPES = [
  { key: 'join_request', label: '🚪 طلبات الانضمام' },
  { key: 'new_student', label: '🎓 طالب جديد' },
  { key: 'question', label: '❓ سؤال طالب' },
  { key: 'request', label: '📝 طلب جديد' },
  { key: 'moderation', label: '🛡️ إجراءات الإشراف' },
  { key: 'broadcast', label: '📣 الإذاعات' },
];
const CHANNELS = [
  { v: 'telegram', l: 'تيليجرام' },
  { v: 'webpush', l: 'إشعار ويب' },
  { v: 'both', l: 'كلاهما' },
  { v: 'none', l: 'إيقاف' },
];

async function loadAdminRouting() {
  try {
    const r0 = await api('GET', '/admin-routing').catch(() => ({}));
    const rmap = {};
    (r0.routing || r0.items || []).forEach(r => {
      const tid = r.telegram_user_id || r.telegram_id;
      rmap[tid] = rmap[tid] || {};
      rmap[tid][r.event_type] = r.channel;
    });
    const list = (r0.admins || []).map(a => ({
      telegram_id: a.telegram_user_id || a.telegram_id,
      username: a.username,
      name: a.full_name || a.name,
      role: a.role,
    }));
    const html = `
      <div class="bg-white rounded-xl shadow p-5">
        <h3 class="font-bold mb-3"><i class="fas fa-route text-sky-500 ml-1"></i> توجيه الإشعارات لكل مشرف</h3>
        <p class="text-xs text-slate-500 mb-4">حدد كيف يستلم كل مشرف كل نوع من الأحداث. الإعداد الافتراضي: <b>تيليجرام</b>.</p>
        ${list.length === 0 ? '<p class="text-slate-500">لا يوجد مشرفون.</p>' :
          `<div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-100">
                <tr>
                  <th class="p-2 text-right">المشرف</th>
                  ${EVENT_TYPES.map(e => `<th class="p-2 text-center">${e.label}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${list.map(a => `
                  <tr class="border-b">
                    <td class="p-2 font-semibold">${escapeHtml(a.username || a.name || a.telegram_id)}</td>
                    ${EVENT_TYPES.map(e => {
                      const cur = rmap[a.telegram_id]?.[e.key] || 'telegram';
                      return `<td class="p-1 text-center">
                        <select onchange="setAdminRouting('${a.telegram_id}','${e.key}',this.value)" class="text-xs border rounded px-1 py-1">
                          ${CHANNELS.map(c => `<option value="${c.v}" ${cur===c.v?'selected':''}>${c.l}</option>`).join('')}
                        </select>
                      </td>`;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`}
      </div>
    `;
    document.getElementById('routing-content').innerHTML = html;
  } catch (e) {
    document.getElementById('routing-content').innerHTML = `<div class="text-red-500">فشل التحميل: ${escapeHtml(e.message || '')}</div>`;
  }
}
async function setAdminRouting(tid, evt, channel) {
  try {
    if (channel === 'none') {
      await api('DELETE', `/admin-routing/${tid}/${evt}`);
    } else {
      await api('POST', '/admin-routing', { telegram_user_id: Number(tid), event_type: evt, channel });
    }
    toast('تم الحفظ');
  } catch (e) { toast('فشل', 'error'); }
}

// ============================================
// 🎓 إدارة المستويات والفصول
// ============================================
async function loadAcademic() {
  try {
    const [lvRaw, smRaw] = await Promise.all([
      api('GET', '/academic/levels'),
      api('GET', '/academic/semesters'),
    ]);
    const levels = { items: lvRaw?.items || lvRaw?.levels || [] };
    const semesters = { items: smRaw?.items || smRaw?.semesters || [] };
    const html = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl shadow p-5">
          <div class="flex justify-between items-center mb-3">
            <h3 class="font-bold"><i class="fas fa-layer-group text-emerald-500 ml-1"></i> المستويات الدراسية</h3>
            <button onclick="addLevel()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded text-sm"><i class="fas fa-plus ml-1"></i> إضافة</button>
          </div>
          <div class="divide-y">
            ${(levels.items || []).map(l => `
              <div class="py-2 flex justify-between items-center gap-2">
                <div class="flex-1 flex items-center gap-2">
                  <input value="${escapeHtml(l.name)}" id="lvl-${l.id}" class="flex-1 border rounded px-2 py-1 text-sm">
                  <input type="number" value="${l.display_order||0}" id="lvl-ord-${l.id}" class="w-16 border rounded px-2 py-1 text-sm">
                </div>
                <button onclick="saveLevel(${l.id})" class="text-blue-500 hover:text-blue-700 px-2"><i class="fas fa-save"></i></button>
                <button onclick="deleteLevel(${l.id})" class="text-red-500 hover:text-red-700 px-2"><i class="fas fa-trash"></i></button>
              </div>
            `).join('') || '<p class="text-slate-500 text-sm">لا توجد مستويات.</p>'}
          </div>
        </div>

        <div class="bg-white rounded-xl shadow p-5">
          <div class="flex justify-between items-center mb-3">
            <h3 class="font-bold"><i class="fas fa-calendar-alt text-sky-500 ml-1"></i> الفصول الدراسية</h3>
            <button onclick="addSemester()" class="bg-sky-500 hover:bg-sky-600 text-white px-3 py-1.5 rounded text-sm"><i class="fas fa-plus ml-1"></i> إضافة</button>
          </div>
          <div class="divide-y">
            ${(semesters.items || []).map(s => `
              <div class="py-2 flex justify-between items-center gap-2">
                <div class="flex-1 flex items-center gap-2">
                  <input value="${escapeHtml(s.name)}" id="sem-${s.id}" class="flex-1 border rounded px-2 py-1 text-sm">
                  <input type="number" value="${s.display_order||0}" id="sem-ord-${s.id}" class="w-16 border rounded px-2 py-1 text-sm">
                </div>
                <button onclick="saveSemester(${s.id})" class="text-blue-500 hover:text-blue-700 px-2"><i class="fas fa-save"></i></button>
                <button onclick="deleteSemester(${s.id})" class="text-red-500 hover:text-red-700 px-2"><i class="fas fa-trash"></i></button>
              </div>
            `).join('') || '<p class="text-slate-500 text-sm">لا توجد فصول.</p>'}
          </div>
        </div>
      </div>
    `;
    document.getElementById('academic-content').innerHTML = html;
  } catch (e) {
    document.getElementById('academic-content').innerHTML = `<div class="text-red-500">فشل التحميل: ${escapeHtml(e.message || '')}</div>`;
  }
}
async function addLevel() {
  const name = prompt('اسم المستوى الجديد:');
  if (!name) return;
  try { await api('POST', '/academic/levels', { name, display_order: 0 }); toast('تمت الإضافة'); loadAcademic(); }
  catch (e) { toast('فشل: ' + (e.message || ''), 'error'); }
}
async function saveLevel(id) {
  const name = document.getElementById(`lvl-${id}`).value;
  const display_order = Number(document.getElementById(`lvl-ord-${id}`).value || 0);
  try { await api('POST', `/academic/levels/${id}`, { name, display_order }); toast('تم الحفظ'); }
  catch (e) { toast('فشل', 'error'); }
}
async function deleteLevel(id) {
  if (!confirm('حذف هذا المستوى؟')) return;
  try { await api('DELETE', `/academic/levels/${id}`); toast('تم الحذف'); loadAcademic(); }
  catch (e) { toast('فشل', 'error'); }
}
async function addSemester() {
  const name = prompt('اسم الفصل الجديد:');
  if (!name) return;
  try { await api('POST', '/academic/semesters', { name, display_order: 0 }); toast('تمت الإضافة'); loadAcademic(); }
  catch (e) { toast('فشل: ' + (e.message || ''), 'error'); }
}
async function saveSemester(id) {
  const name = document.getElementById(`sem-${id}`).value;
  const display_order = Number(document.getElementById(`sem-ord-${id}`).value || 0);
  try { await api('POST', `/academic/semesters/${id}`, { name, display_order }); toast('تم الحفظ'); }
  catch (e) { toast('فشل', 'error'); }
}
async function deleteSemester(id) {
  if (!confirm('حذف هذا الفصل؟')) return;
  try { await api('DELETE', `/academic/semesters/${id}`); toast('تم الحذف'); loadAcademic(); }
  catch (e) { toast('فشل', 'error'); }
}

// ============================================
// 📜 سجل الإشعارات
// ============================================
async function loadNotificationsLog() {
  try {
    const r0 = await api('GET', '/notifications/log');
    const r = { items: r0?.items || r0?.log || [] };
    const html = `
      <div class="bg-white rounded-xl shadow p-5">
        <h3 class="font-bold mb-3"><i class="fas fa-history text-slate-500 ml-1"></i> آخر الإشعارات (${r.items?.length || 0})</h3>
        ${(r.items || []).length === 0 ? '<p class="text-slate-500">لا توجد إشعارات بعد.</p>' :
          `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead class="bg-slate-100"><tr>
              <th class="p-2 text-right">التاريخ</th>
              <th class="p-2 text-right">النوع</th>
              <th class="p-2 text-right">العنوان</th>
              <th class="p-2 text-right">تيليجرام</th>
              <th class="p-2 text-right">ويب</th>
            </tr></thead>
            <tbody>
              ${r.items.map(n => `
                <tr class="border-b">
                  <td class="p-2 text-xs whitespace-nowrap">${n.created_at}</td>
                  <td class="p-2"><span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">${escapeHtml(n.event_type)}</span></td>
                  <td class="p-2">${escapeHtml(n.title || '')}</td>
                  <td class="p-2 text-center">${n.telegram_sent || 0}</td>
                  <td class="p-2 text-center">${n.webpush_sent || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>`}
      </div>
    `;
    document.getElementById('notif-log-content').innerHTML = html;
  } catch (e) {
    document.getElementById('notif-log-content').innerHTML = `<div class="text-red-500">فشل التحميل: ${escapeHtml(e.message || '')}</div>`;
  }
}

// ============================================
// PWA Service Worker registration (silent)
// ============================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// تحميل أولي
document.addEventListener('DOMContentLoaded', () => {
  switchTab('overview');
});
