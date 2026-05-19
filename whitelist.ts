// ============================================
// قائمة الأوامر المستثناة من فلاتر الإشراف (حذف روابط/إلخ)
// ============================================
// أوامر تلجرام للبوت بصيغة:  /command  أو  /command@bot_username
// يجب ألا تُحذف كرابط حتى لو طابقت نمط الرابط (@mention).
// ============================================

let _cache: { ts: number; cmds: Set<string> } | null = null;
const TTL_MS = 30_000; // 30 ثانية

export async function loadBotCommands(db: D1Database): Promise<Set<string>> {
  const now = Date.now();
  if (_cache && now - _cache.ts < TTL_MS) return _cache.cmds;
  const cmds = new Set<string>();
  // الأوامر من الجدول
  try {
    const r = await db
      .prepare('SELECT command FROM bot_command_whitelist WHERE is_active = 1')
      .all();
    for (const row of (r.results as any[]) || []) {
      const c = String(row.command || '').toLowerCase().replace(/^\//, '');
      if (c) cmds.add(c);
    }
  } catch (_) {}
  // الأوامر المخصصة من custom_commands (تبدأ بـ trigger_command)
  try {
    const r = await db
      .prepare('SELECT trigger_command FROM custom_commands WHERE is_active = 1')
      .all();
    for (const row of (r.results as any[]) || []) {
      const c = String(row.trigger_command || '').toLowerCase().replace(/^\//, '');
      if (c) cmds.add(c);
    }
  } catch (_) {}
  // أوامر افتراضية (احتياط في حال جدول فارغ)
  if (cmds.size === 0) {
    ['start', 'menu', 'help', 'id', 'me', 'cancel', 'admin', 'panel', 'stats'].forEach((c) =>
      cmds.add(c)
    );
  }
  _cache = { ts: now, cmds };
  return cmds;
}

// التحقق إذا كان النص يبدأ بأمر بوت معروف
// يدعم: /menu   /menu@bot_name   /menu arg
export async function isBotCommandMention(
  db: D1Database,
  text: string,
  botUsername?: string
): Promise<boolean> {
  if (!text || text[0] !== '/') return false;
  const cmds = await loadBotCommands(db);

  // استخراج اسم الأمر (قبل @ أو مسافة)
  const m = text.match(/^\/([a-zA-Z0-9_]+)(@[a-zA-Z0-9_]+)?(\s|$)/);
  if (!m) return false;
  const cmdName = m[1].toLowerCase();
  const mentionedBot = m[2] ? m[2].slice(1).toLowerCase() : null;

  // إذا تم استدعاء البوت بشكل خاص (مثل /menu@otherbot) → تجاهل
  if (mentionedBot && botUsername && mentionedBot !== botUsername.toLowerCase()) {
    return false;
  }
  return cmds.has(cmdName);
}

export function invalidateBotCommandsCache() {
  _cache = null;
}
