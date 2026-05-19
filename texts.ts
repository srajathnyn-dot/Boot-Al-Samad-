// ============================================
// Helper لجلب نصوص البوت من جدول bot_texts
// مع دعم استبدال المتغيرات {name}, {college}, ...
// ============================================

const _cache = new Map<string, { value: string; expires: number }>();
const CACHE_TTL_MS = 30_000;

export async function getBotText(
  db: D1Database,
  key: string,
  vars: Record<string, string | number> = {},
  fallback: string = ''
): Promise<string> {
  const now = Date.now();
  let value: string;

  const c = _cache.get(key);
  if (c && c.expires > now) {
    value = c.value;
  } else {
    try {
      const row: any = await db
        .prepare('SELECT value FROM bot_texts WHERE key = ? AND is_active = 1 LIMIT 1')
        .bind(key)
        .first();
      value = row?.value ?? fallback;
      _cache.set(key, { value, expires: now + CACHE_TTL_MS });
    } catch (_) {
      value = fallback;
    }
  }

  if (!value) return fallback;
  // استبدال المتغيرات
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`\\{${k}\\}`, 'g');
    value = value.replace(re, String(v ?? ''));
  }
  // دعم \n الحرفية المخزّنة كنص
  value = value.replace(/\\n/g, '\n');
  return value;
}

// مسح ذاكرة الكاش (يستدعى بعد تحديث نص في اللوحة)
export function clearBotTextsCache() {
  _cache.clear();
}
