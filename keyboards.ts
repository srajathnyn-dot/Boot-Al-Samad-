// ============================================
// أزرار وقوائم تفاعلية - ديناميكية من قاعدة البيانات
// ============================================

export const LEVELS = ['الأول', 'الثاني', 'الثالث', 'الرابع'];

// قائمة البداية للمستخدم - تُبنى ديناميكياً من unified_buttons (placement = inline/both)
// مع الرجوع إلى main_menu_items لو فارغ، ثم إلى قائمة افتراضية.
export async function mainMenuKeyboard(db: D1Database, isAdminUser: boolean = false) {
  let items: any[] = [];

  // 1) الجدول الموحّد الجديد
  try {
    const r = await db
      .prepare(
        `SELECT * FROM unified_buttons
         WHERE is_active = 1 AND (placement = 'inline' OR placement = 'both')
         ORDER BY display_order, row_index, col_index, id`
      )
      .all();
    items = (r.results || []) as any[];
  } catch (_) {}

  // 2) احتياط: الجدول القديم
  if (items.length === 0) {
    try {
      const r = await db
        .prepare('SELECT * FROM main_menu_items WHERE is_active = 1 ORDER BY display_order, id')
        .all();
      items = (r.results || []) as any[];
    } catch (_) {}
  }

  const visible = items.filter((it) => !it.is_admin_only || isAdminUser);
  if (visible.length === 0) {
    return {
      inline_keyboard: [
        [{ text: '📚 المناهج الدراسية', callback_data: 'menu:curriculum' }],
        [{ text: '📊 الاستعلام عن الدرجات', callback_data: 'menu:grades' }],
        [{ text: '❓ تقديم سؤال أو استفسار', callback_data: 'menu:question' }],
        [{ text: '📝 تقديم طلب', callback_data: 'menu:request' }],
        [{ text: '☎️ التواصل مع الإدارة', callback_data: 'menu:contact' }],
        [{ text: 'ℹ️ عن الكلية', callback_data: 'menu:about' }],
      ],
    };
  }

  const buildBtn = (it: any) => {
    const display = (it.emoji ? it.emoji + ' ' : '') + (it.text || '');
    if (it.action_type === 'url') return { text: display, url: it.action_value };
    let cb = '';
    if (it.action_type === 'command') cb = `cmdcode:${it.action_value}`;
    else if (it.action_type === 'curriculum') cb = 'menu:curriculum';
    else cb = `menu:${it.action_value}`;
    return { text: display, callback_data: cb };
  };

  // إذا كانت row_index غير محددة لأي زر فكلٌ في صف
  const useGrid = visible.some((it) => Number(it.row_index) > 0 || Number(it.col_index) > 0);
  if (!useGrid) {
    return { inline_keyboard: visible.map((it) => [buildBtn(it)]) };
  }

  const grid = new Map<number, any[]>();
  for (const it of visible) {
    const r = Number(it.row_index || 0);
    if (!grid.has(r)) grid.set(r, []);
    grid.get(r)!.push(it);
  }
  const sortedRows = [...grid.entries()].sort((a, b) => a[0] - b[0]);
  const rows: any[][] = [];
  for (const [, arr] of sortedRows) {
    arr.sort((a, b) => Number(a.col_index || 0) - Number(b.col_index || 0));
    let current: any[] = [];
    for (const it of arr) {
      if (Number(it.full_width)) {
        if (current.length) { rows.push(current); current = []; }
        rows.push([buildBtn(it)]);
      } else {
        current.push(buildBtn(it));
      }
    }
    if (current.length) rows.push(current);
  }
  return { inline_keyboard: rows };
}

// قائمة المستويات الأكاديمية
export function levelsKeyboard(prefix: string) {
  return {
    inline_keyboard: LEVELS.map((lvl) => [
      { text: `📖 المستوى ${lvl}`, callback_data: `${prefix}:${lvl}` },
    ]).concat([[{ text: '🔙 رجوع', callback_data: 'menu:main' }]]),
  };
}

// نعم / لا
export function yesNoKeyboard(prefix: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ نعم', callback_data: `${prefix}:yes` },
        { text: '❌ لا', callback_data: `${prefix}:no` },
      ],
    ],
  };
}

// أزرار قرار المالك على طلب الانضمام
export function ownerDecisionKeyboard(student_user_id: number, group_chat_id: number) {
  return {
    inline_keyboard: [
      [{ text: '✅ تم التحقق والموافقة', callback_data: `dec:approve:${student_user_id}:${group_chat_id}` }],
      [{ text: '⏸️ لم تتم الموافقة (تواصل مع المالك)', callback_data: `dec:hold:${student_user_id}:${group_chat_id}` }],
      [{ text: '🚫 رفض الطلب وإزالة من المجموعة', callback_data: `dec:reject:${student_user_id}:${group_chat_id}` }],
    ],
  };
}

// زر للعودة لقائمة الإدارة
export function backToAdminKeyboard() {
  return { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu:main' }]] };
}

// === Reply Keyboard (الأزرار الدائمة أسفل حقل الإدخال) ===
// يقرأ أولاً من unified_buttons (placement = reply/both) ثم يرجع إلى reply_keyboard_items
// inGroup: عند true يفلتر فقط الأزرار التي show_in_groups=1
export async function persistentReplyKeyboard(db: D1Database, isAdminUser: boolean = false, inGroup: boolean = false) {
  try {
    let items: any[] = [];

    // 1) جدول الأزرار الموحّد
    try {
      const r = await db
        .prepare(
          `SELECT * FROM unified_buttons
           WHERE is_active = 1 AND (placement = 'reply' OR placement = 'both')
           ORDER BY row_index, col_index, id`
        )
        .all();
      items = (r.results || []) as any[];
    } catch (_) {}

    // 2) الجدول القديم
    if (items.length === 0) {
      try {
        const r = await db
          .prepare('SELECT * FROM reply_keyboard_items WHERE is_active = 1 ORDER BY row_index, col_index, id')
          .all();
        items = (r.results || []) as any[];
      } catch (_) {}
    }

    // تصفية الأزرار بناءً على الصلاحيات ومكان الظهور (خاص أو مجموعات)
    const visible = items.filter((it) => {
      if (it.is_admin_only && !isAdminUser) return false;
      // في المجموعات: إذا الحقل show_in_groups موجود ومضبوط على 0 فقط نخفي
      // إذا كان NULL/undefined (مثل reply_keyboard_items القديم) نعرض دائماً
      if (inGroup && it.show_in_groups !== undefined && it.show_in_groups !== null && Number(it.show_in_groups) === 0) return false;
      return true;
    });

    if (visible.length === 0) {
      return {
        keyboard: [
          [{ text: '📚 المناهج' }, { text: '📊 الدرجات' }],
          [{ text: '❓ سؤال' }, { text: '📝 طلب' }],
          [{ text: '☎️ التواصل' }, { text: 'ℹ️ عن الكلية' }],
        ],
        resize_keyboard: true,
        is_persistent: true,
        input_field_placeholder: 'اختر من القائمة بالأسفل أو اكتب...'
      };
    }

    // تجميع حسب row_index
    const grid = new Map<number, any[]>();
    for (const it of visible) {
      const r = Number(it.row_index || 0);
      if (!grid.has(r)) grid.set(r, []);
      const display = (it.emoji ? it.emoji + ' ' : '') + (it.text || '');
      grid.get(r)!.push({ text: display, _full: Number(it.full_width || 0), _col: Number(it.col_index || 0) });
    }
    const sortedRows = [...grid.entries()].sort((a, b) => a[0] - b[0]);
    const rows: any[][] = [];
    for (const [, arr] of sortedRows) {
      arr.sort((a, b) => a._col - b._col);
      let current: any[] = [];
      for (const it of arr) {
        const btn = { text: it.text };
        if (it._full) {
          if (current.length) { rows.push(current); current = []; }
          rows.push([btn]);
        } else {
          current.push(btn);
        }
      }
      if (current.length) rows.push(current);
    }
    return { 
      keyboard: rows, 
      resize_keyboard: true, 
      is_persistent: true,
      input_field_placeholder: 'اختر من القائمة بالأسفل أو اكتب...'
    };
  } catch (_) {
    return {
      keyboard: [
        [{ text: '📚 المناهج' }, { text: '📊 الدرجات' }],
        [{ text: '❓ سؤال' }, { text: '📝 طلب' }],
        [{ text: '☎️ التواصل' }, { text: 'ℹ️ عن الكلية' }],
      ],
      resize_keyboard: true,
      is_persistent: true,
      input_field_placeholder: 'اختر من القائمة بالأسفل أو اكتب...'
    };
  }
}

// مطابقة نص زر Reply Keyboard مع إجراء داخلي
export async function matchReplyKeyboardAction(
  db: D1Database,
  text: string
): Promise<{ action_type: string; action_value: string } | null> {
  if (!text) return null;
  const trimmed = text.trim();
  // 1) الجدول الموحّد - نطابق سواءً مع نص خام أو مع emoji+text
  try {
    const r: any = await db
      .prepare(
        `SELECT action_type, action_value, emoji, text FROM unified_buttons
         WHERE is_active = 1 AND (placement = 'reply' OR placement = 'both')`
      )
      .all();
    for (const row of (r.results || []) as any[]) {
      const composed = ((row.emoji ? row.emoji + ' ' : '') + (row.text || '')).trim();
      if (composed === trimmed || (row.text || '').trim() === trimmed) {
        return { action_type: row.action_type, action_value: row.action_value };
      }
    }
  } catch (_) {}
  // 2) الجدول القديم
  try {
    const r: any = await db
      .prepare('SELECT action_type, action_value FROM reply_keyboard_items WHERE text = ? AND is_active = 1 LIMIT 1')
      .bind(trimmed)
      .first();
    if (r) return { action_type: r.action_type, action_value: r.action_value };
  } catch (_) {}
  // 3) افتراضات
  const defaults: Record<string, { action_type: string; action_value: string }> = {
    '📚 المناهج': { action_type: 'builtin', action_value: 'curriculum' },
    '📊 الدرجات': { action_type: 'builtin', action_value: 'grades' },
    '❓ سؤال': { action_type: 'builtin', action_value: 'question' },
    '📝 طلب': { action_type: 'builtin', action_value: 'request' },
    '☎️ التواصل': { action_type: 'builtin', action_value: 'contact' },
    'ℹ️ عن الكلية': { action_type: 'builtin', action_value: 'about' },
  };
  return defaults[trimmed] || null;
}

// قائمة منهج المستوى (تظهر المواد)
export function curriculumLevelKeyboard(items: any[], level: string) {
  const buttons: any[][] = items.map((it) => [
    { text: `📕 ${it.subject_name}`, callback_data: `curr:item:${it.id}` },
  ]);
  buttons.push([{ text: '🔙 رجوع للمستويات', callback_data: 'menu:curriculum' }]);
  return { inline_keyboard: buttons };
}

// زر الرد على طلب/سؤال
export function requestActionKeyboard(request_id: number) {
  return {
    inline_keyboard: [
      [{ text: '✍️ الرد على المستخدم', callback_data: `req:reply:${request_id}` }],
      [{ text: '✅ تم العلم وإغلاق', callback_data: `req:close:${request_id}` }],
    ],
  };
}

// لوحة جهات التواصل
export async function contactsKeyboard(db: D1Database) {
  const { results } = await db
    .prepare('SELECT * FROM contacts WHERE is_active = 1 ORDER BY display_order, id')
    .all();
  const items = (results || []) as any[];
  const rows: any[][] = [];
  for (const c of items) {
    const url = c.contact_url || '';
    if (url) {
      rows.push([{ text: `${iconEmoji(c.icon)} ${c.title}`, url }]);
    }
  }
  rows.push([{ text: '🔙 القائمة الرئيسية', callback_data: 'menu:main' }]);
  return { inline_keyboard: rows };
}

function iconEmoji(icon?: string): string {
  const map: Record<string, string> = {
    'robot': '🤖',
    'university': '🏛️',
    'clipboard-list': '📋',
    'user-tie': '👔',
    'phone': '☎️',
    'envelope': '✉️',
    'graduation-cap': '🎓',
    'mosque': '🕌',
    'book': '📚',
  };
  return icon && map[icon] ? map[icon] : '👤';
}
