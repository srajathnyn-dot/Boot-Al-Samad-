// ============================================
// Database Helper Functions
// ============================================

export interface BotSettings {
  bot_name: string;
  college_name: string;
  owner_username: string;
  owner_user_id: string;
  owner_contact_url: string;
  welcome_message: string;
  webhook_secret: string;
  default_language: string;
  [key: string]: string;
}

export async function getSettings(db: D1Database): Promise<BotSettings> {
  const { results } = await db.prepare('SELECT key, value FROM bot_settings').all();
  const obj: any = {};
  for (const r of results as any[]) {
    obj[r.key] = r.value;
  }
  return obj as BotSettings;
}

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const r: any = await db.prepare('SELECT value FROM bot_settings WHERE key = ?').bind(key).first();
  return r?.value ?? null;
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      'INSERT INTO bot_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP'
    )
    .bind(key, value)
    .run();
}

export async function logActivity(
  db: D1Database,
  action: string,
  details: string,
  user_id?: number
): Promise<void> {
  try {
    await db
      .prepare('INSERT INTO activity_log (action, details, user_id) VALUES (?, ?, ?)')
      .bind(action, details, user_id || null)
      .run();
  } catch (e) {
    console.error('logActivity error:', e);
  }
}

// التحقق من أن المستخدم مالك أو مشرف
export async function isAdmin(db: D1Database, telegram_user_id: number): Promise<boolean> {
  const owner_id = await getSetting(db, 'owner_user_id');
  if (owner_id && Number(owner_id) === telegram_user_id) return true;

  const r: any = await db
    .prepare('SELECT id FROM bot_admins WHERE telegram_user_id = ?')
    .bind(telegram_user_id)
    .first();
  return !!r;
}

export async function isOwner(db: D1Database, telegram_user_id: number): Promise<boolean> {
  const owner_id = await getSetting(db, 'owner_user_id');
  if (owner_id && Number(owner_id) === telegram_user_id) return true;
  const r: any = await db
    .prepare("SELECT id FROM bot_admins WHERE telegram_user_id = ? AND role = 'owner'")
    .bind(telegram_user_id)
    .first();
  return !!r;
}

// تسجيل/تحديث المجموعة
export async function upsertGroup(
  db: D1Database,
  chat_id: number,
  title: string | undefined,
  type: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO groups (chat_id, title, type) VALUES (?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET title=excluded.title, type=excluded.type`
    )
    .bind(chat_id, title || null, type)
    .run();
}

export async function getGroupSettings(db: D1Database, chat_id: number): Promise<any> {
  return await db.prepare('SELECT * FROM groups WHERE chat_id = ?').bind(chat_id).first();
}

// تسجيل/تحديث مشترك في البوت (يستخدم الخاص)
export async function upsertSubscriber(
  db: D1Database,
  user: { id: number; username?: string; first_name?: string; last_name?: string; language_code?: string }
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO bot_subscribers (telegram_user_id, username, first_name, last_name, language_code, last_seen_at, is_active)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
         ON CONFLICT(telegram_user_id) DO UPDATE SET
           username=excluded.username,
           first_name=excluded.first_name,
           last_name=excluded.last_name,
           language_code=excluded.language_code,
           last_seen_at=CURRENT_TIMESTAMP,
           is_active=1`
      )
      .bind(user.id, user.username || null, user.first_name || null, user.last_name || null, user.language_code || null)
      .run();
  } catch (e) {
    console.error('upsertSubscriber error:', e);
  }
}
