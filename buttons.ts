// ============================================
// مساعدة بناء الأزرار الشفافة من قاعدة البيانات
// ============================================

export interface InlineButtonRow {
  id: number;
  text: string;
  button_type: 'url' | 'callback' | 'command';
  url?: string;
  callback_data?: string;
  command_id?: number;
  row_index: number;
  col_index: number;
  is_admin_only: number;
  is_active: number;
}

// بناء reply_markup من صفوف الأزرار
export function buildInlineKeyboard(
  buttons: InlineButtonRow[],
  appendBack?: { text: string; callback_data: string }
): { inline_keyboard: any[][] } | undefined {
  if (!buttons || buttons.length === 0) {
    if (appendBack) return { inline_keyboard: [[appendBack]] };
    return undefined;
  }
  // ترتيب حسب row ثم col
  const sorted = [...buttons].sort((a, b) => a.row_index - b.row_index || a.col_index - b.col_index);
  const grid: Map<number, any[]> = new Map();
  for (const b of sorted) {
    if (!b.is_active) continue;
    const btn: any = { text: b.text };
    if (b.button_type === 'url' && b.url) btn.url = b.url;
    else if (b.button_type === 'command' && b.command_id) btn.callback_data = `cmd:${b.command_id}`;
    else btn.callback_data = b.callback_data || `btn:${b.id}`;
    if (!grid.has(b.row_index)) grid.set(b.row_index, []);
    grid.get(b.row_index)!.push(btn);
  }
  const rows = [...grid.entries()].sort((a, b) => a[0] - b[0]).map(([_, r]) => r);
  if (appendBack) rows.push([appendBack]);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

// تحميل أزرار مرتبطة بكيان (رد/منهج/أمر/قائمة)
export async function loadButtonsFor(
  db: D1Database,
  owner_type: string,
  owner_id: number
): Promise<InlineButtonRow[]> {
  const { results } = await db
    .prepare(
      'SELECT * FROM inline_buttons WHERE owner_type = ? AND owner_id = ? AND is_active = 1 ORDER BY row_index, col_index, id'
    )
    .bind(owner_type, owner_id)
    .all();
  return (results || []) as any;
}

// تحميل المرفقات لكيان معيّن
export interface AttachmentRow {
  id: number;
  file_type: string;
  file_id: string;
  file_name?: string;
  caption?: string;
  display_order: number;
}

export async function loadAttachmentsFor(
  db: D1Database,
  owner_type: string,
  owner_id: number
): Promise<AttachmentRow[]> {
  const { results } = await db
    .prepare(
      'SELECT * FROM attachments WHERE owner_type = ? AND owner_id = ? ORDER BY display_order, id'
    )
    .bind(owner_type, owner_id)
    .all();
  return (results || []) as any;
}
