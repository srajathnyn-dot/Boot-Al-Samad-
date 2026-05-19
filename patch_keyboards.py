#!/usr/bin/env python3
"""يحدّث mainMenuKeyboard و persistentReplyKeyboard لاستخدام unified_buttons."""
import os, re
PATH = os.path.join(os.path.dirname(__file__), '..', 'src', 'handlers', 'keyboards.ts')

with open(PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# === استبدال mainMenuKeyboard كامل ===
new_main = '''// قائمة البداية للمستخدم - تُبنى ديناميكياً من unified_buttons (placement = inline/both)
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
}'''

# Find the original mainMenuKeyboard block and replace
pattern = re.compile(
    r"// قائمة البداية للمستخدم[\s\S]*?\nexport async function mainMenuKeyboard[\s\S]*?\n\}\n",
    re.MULTILINE
)
m = pattern.search(content)
if not m:
    raise SystemExit('mainMenuKeyboard pattern not found')
content = content[:m.start()] + new_main + '\n' + content[m.end():]

# === تحديث persistentReplyKeyboard للقراءة من unified_buttons أيضاً ===
new_reply = '''// === Reply Keyboard (الأزرار الدائمة أسفل حقل الإدخال) ===
// يقرأ أولاً من unified_buttons (placement = reply/both) ثم يرجع إلى reply_keyboard_items
export async function persistentReplyKeyboard(db: D1Database, isAdminUser: boolean = false) {
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

    const visible = items.filter((it) => !it.is_admin_only || isAdminUser);
    if (visible.length === 0) {
      return {
        keyboard: [
          [{ text: '📚 المناهج' }, { text: '📊 الدرجات' }],
          [{ text: '❓ سؤال' }, { text: '📝 طلب' }],
          [{ text: '☎️ التواصل' }, { text: 'ℹ️ عن الكلية' }],
        ],
        resize_keyboard: true,
        is_persistent: true,
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
    return { keyboard: rows, resize_keyboard: true, is_persistent: true };
  } catch (_) {
    return {
      keyboard: [
        [{ text: '📚 المناهج' }, { text: '📊 الدرجات' }],
        [{ text: '❓ سؤال' }, { text: '📝 طلب' }],
        [{ text: '☎️ التواصل' }, { text: 'ℹ️ عن الكلية' }],
      ],
      resize_keyboard: true,
      is_persistent: true,
    };
  }
}'''

pattern2 = re.compile(
    r"// === Reply Keyboard[\s\S]*?\nexport async function persistentReplyKeyboard[\s\S]*?\n\}\n",
    re.MULTILINE
)
m2 = pattern2.search(content)
if not m2:
    raise SystemExit('persistentReplyKeyboard pattern not found')
content = content[:m2.start()] + new_reply + '\n' + content[m2.end():]

# === تحديث matchReplyKeyboardAction للقراءة من unified_buttons أيضاً ===
new_match = '''// مطابقة نص زر Reply Keyboard مع إجراء داخلي
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
}'''

pattern3 = re.compile(
    r"// مطابقة نص زر Reply Keyboard[\s\S]*?\nexport async function matchReplyKeyboardAction[\s\S]*?\n\}\n",
    re.MULTILINE
)
m3 = pattern3.search(content)
if not m3:
    raise SystemExit('matchReplyKeyboardAction pattern not found')
content = content[:m3.start()] + new_match + '\n' + content[m3.end():]

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print('OK keyboards patched')
