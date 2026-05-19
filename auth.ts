// ============================================
// Authentication & Crypto Helpers (Web Crypto API)
// ============================================

// Hash كلمة المرور باستخدام SHA-256 + salt
export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(password + ':' + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const h = await hashPassword(password, salt);
  return h === expectedHash;
}

// إنشاء session token عشوائي
export function generateSessionId(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// إنشاء جلسة في قاعدة البيانات
export async function createSession(
  db: D1Database,
  user_id: number,
  ttlSeconds = 7 * 24 * 60 * 60
): Promise<string> {
  const sessionId = generateSessionId();
  const expires_at = Math.floor(Date.now() / 1000) + ttlSeconds;
  await db
    .prepare('INSERT INTO panel_sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, user_id, expires_at)
    .run();
  return sessionId;
}

export async function getSession(
  db: D1Database,
  sessionId: string
): Promise<{ user_id: number; username: string; role: string; full_name: string } | null> {
  const now = Math.floor(Date.now() / 1000);
  const r: any = await db
    .prepare(
      `SELECT s.user_id, s.expires_at, u.username, u.role, u.full_name
       FROM panel_sessions s JOIN panel_users u ON s.user_id = u.id
       WHERE s.id = ? AND s.expires_at > ?`
    )
    .bind(sessionId, now)
    .first();
  if (!r) return null;
  return {
    user_id: r.user_id,
    username: r.username,
    role: r.role,
    full_name: r.full_name,
  };
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM panel_sessions WHERE id = ?').bind(sessionId).run();
}

// تنظيف الجلسات المنتهية
export async function cleanupSessions(db: D1Database): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare('DELETE FROM panel_sessions WHERE expires_at < ?').bind(now).run();
}
