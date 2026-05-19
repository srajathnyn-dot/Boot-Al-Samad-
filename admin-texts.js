// ============================================
// محرر نصوص البوت — Bot Texts Editor
// ============================================

(function () {
  const CATEGORIES = {
    welcome: { label: 'ترحيب', color: 'bg-emerald-100 text-emerald-700', icon: '🌹' },
    menu: { label: 'قوائم', color: 'bg-blue-100 text-blue-700', icon: '📋' },
    grades: { label: 'درجات', color: 'bg-purple-100 text-purple-700', icon: '📊' },
    requests: { label: 'طلبات', color: 'bg-amber-100 text-amber-700', icon: '📝' },
    curriculum: { label: 'مناهج', color: 'bg-indigo-100 text-indigo-700', icon: '📚' },
    errors: { label: 'أخطاء', color: 'bg-red-100 text-red-700', icon: '⚠️' },
    moderation: { label: 'إشراف', color: 'bg-orange-100 text-orange-700', icon: '🛡️' },
    hints: { label: 'تنبيهات', color: 'bg-yellow-100 text-yellow-700', icon: '💡' },
    other: { label: 'متفرقات', color: 'bg-slate-100 text-slate-700', icon: '📎' },
  };

  function _escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  async function loadBotTexts() {
    const cat = document.getElementById('texts-category')?.value || '';
    const q = (document.getElementById('texts-search')?.value || '').trim();
    const params = new URLSearchParams();
    if (cat) params.set('category', cat);
    if (q) params.set('q', q);
    const grid = document.getElementById('texts-grid');
    const empty = document.getElementById('texts-empty');
    if (!grid) return;
    grid.innerHTML = '<div class="text-center text-slate-400 p-6"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';
    try {
      const res = await axios.get('/admin/api/texts' + (params.toString() ? `?${params}` : ''));
      const texts = res.data.texts || [];
      if (!texts.length) {
        grid.innerHTML = '';
        empty?.classList.remove('hidden');
        return;
      }
      empty?.classList.add('hidden');
      // تجميع حسب الفئة
      const byCat = {};
      for (const t of texts) {
        if (!byCat[t.category]) byCat[t.category] = [];
        byCat[t.category].push(t);
      }
      let html = '';
      for (const [catKey, items] of Object.entries(byCat)) {
        const meta = CATEGORIES[catKey] || CATEGORIES.other;
        html += `<div class="mb-6">
          <h3 class="text-base font-bold text-slate-700 mb-3 flex items-center gap-2">
            <span>${meta.icon}</span>
            <span>${meta.label}</span>
            <span class="text-xs text-slate-400 font-normal">(${items.length})</span>
          </h3>
          <div class="space-y-3">`;
        for (const t of items) {
          const modifiedClass = (t.value !== t.default_value) ? 'modified' : '';
          let placeholders = [];
          try { placeholders = JSON.parse(t.placeholders || '[]'); } catch (_) {}
          const phHtml = placeholders.length
            ? `<div class="mt-2 flex flex-wrap gap-1">${placeholders.map(p => `<span class="key-code">${_escHtml(p)}</span>`).join('')}</div>`
            : '';
          html += `<div class="text-card ${modifiedClass}" data-text-id="${t.id}">
            <div class="flex items-start justify-between gap-2 mb-2 flex-wrap">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-slate-800 text-sm">${_escHtml(t.label)}</span>
                  <span class="cat-badge ${meta.color}">${meta.icon} ${meta.label}</span>
                  ${(t.value !== t.default_value) ? '<span class="cat-badge bg-amber-100 text-amber-700">⚠️ معدّل</span>' : ''}
                </div>
                ${t.description ? `<p class="text-xs text-slate-500 mt-1">${_escHtml(t.description)}</p>` : ''}
                <div class="mt-1"><span class="key-code">${_escHtml(t.key)}</span></div>
              </div>
            </div>
            <textarea id="text-val-${t.id}" placeholder="(فارغ = لا يُرسل)" dir="auto">${_escHtml(t.value)}</textarea>
            ${phHtml}
            <div class="flex justify-end gap-2 mt-2">
              <button onclick="resetBotText(${t.id})" class="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">
                <i class="fas fa-undo ml-1"></i> الافتراضي
              </button>
              <button onclick="saveBotText(${t.id})" class="text-xs px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold">
                <i class="fas fa-save ml-1"></i> حفظ
              </button>
            </div>
          </div>`;
        }
        html += '</div></div>';
      }
      grid.innerHTML = html;
    } catch (e) {
      grid.innerHTML = `<div class="bg-red-50 text-red-700 p-4 rounded-lg">❌ فشل التحميل: ${_escHtml(e.message || '')}</div>`;
    }
  }

  async function saveBotText(id) {
    const ta = document.getElementById(`text-val-${id}`);
    if (!ta) return;
    try {
      await axios.post(`/admin/api/texts/${id}`, { value: ta.value });
      if (typeof toast === 'function') toast('✅ تم حفظ النص');
      // إعادة تحميل بطيئة لتحديث حالة "معدّل"
      setTimeout(loadBotTexts, 400);
    } catch (e) {
      if (typeof toast === 'function') toast('فشل الحفظ', 'error');
    }
  }

  async function resetBotText(id) {
    if (!confirm('إعادة هذا النص إلى الافتراضي؟')) return;
    try {
      await axios.post(`/admin/api/texts/${id}/reset`);
      if (typeof toast === 'function') toast('✅ تمت إعادة النص للافتراضي');
      loadBotTexts();
    } catch (e) {
      if (typeof toast === 'function') toast('فشل', 'error');
    }
  }

  async function resetBotTextsConfirm() {
    if (!confirm('سيتم إعادة جميع النصوص إلى قيمها الافتراضية. متابعة؟')) return;
    try {
      await axios.post('/admin/api/texts/reset-all');
      if (typeof toast === 'function') toast('✅ تم إعادة كل النصوص');
      loadBotTexts();
    } catch (e) {
      if (typeof toast === 'function') toast('فشل', 'error');
    }
  }

  // ربط أحداث البحث والفلترة
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.getElementById('texts-search');
    const c = document.getElementById('texts-category');
    let debounce;
    if (s) s.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(loadBotTexts, 350);
    });
    if (c) c.addEventListener('change', loadBotTexts);
  });

  // تكامل مع switchTab
  const origSwitch = window.switchTab;
  if (typeof origSwitch === 'function') {
    window.switchTab = function (tab) {
      origSwitch.call(this, tab);
      if (tab === 'texts') loadBotTexts();
    };
  }

  // تصدير للنطاق العام
  window.loadBotTexts = loadBotTexts;
  window.saveBotText = saveBotText;
  window.resetBotText = resetBotText;
  window.resetBotTextsConfirm = resetBotTextsConfirm;
})();
