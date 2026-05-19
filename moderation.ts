// ============================================
// نظام الإشراف (حذف، تحذير، طرد)
// ============================================

import { Telegram, TgMessage, hasLink, isForwarded, containsBannedWord, escapeHtml, getDisplayName } from '../utils/telegram';
import { getGroupSettings, getSetting, isAdmin, logActivity } from '../utils/db';
import { getBotText } from '../utils/texts';
import { isBotCommandMention } from '../utils/whitelist';

export interface ModerationResult {
  deleted: boolean;
  warned: boolean;
  reason?: string;
}

// كاش معرف البوت لتجنب استدعاء getMe في كل رسالة
let _botUsernameCache: { ts: number; name: string } | null = null;
async function getBotUsername(db: D1Database, tg: Telegram): Promise<string> {
  const now = Date.now();
  if (_botUsernameCache && now - _botUsernameCache.ts < 5 * 60_000) {
    return _botUsernameCache.name;
  }
  // أولاً جرب من الإعدادات (سريع)
  let name = (await getSetting(db, 'bot_username')) || '';
  if (!name) {
    try {
      const me: any = await tg.getMe();
      name = me?.username || '';
      if (name) {
        try {
          await db
            .prepare(
              "INSERT INTO bot_settings (key,value) VALUES ('bot_username', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
            )
            .bind(name)
            .run();
        } catch (_) {}
      }
    } catch (_) {}
  }
  _botUsernameCache = { ts: now, name };
  return name;
}

export async function moderateMessage(
  db: D1Database,
  tg: Telegram,
  msg: TgMessage
): Promise<ModerationResult> {
  if (!msg.from || !msg.chat) return { deleted: false, warned: false };
  if (msg.from.is_bot) return { deleted: false, warned: false };

  // الإشراف يعمل فقط في المجموعات والقنوات
  if (msg.chat.type === 'private') return { deleted: false, warned: false };

  // عدم إشراف على المالك أو المشرفين
  if (await isAdmin(db, msg.from.id)) {
    return { deleted: false, warned: false };
  }

  // التأكد من أن المجموعة مسجلة - إذا لم تكن موجودة نضيفها بإعدادات افتراضية
  let group: any = await getGroupSettings(db, msg.chat.id);
  if (!group) {
    try {
      await db
        .prepare(
          `INSERT INTO groups (chat_id, title, type, is_active, delete_links, delete_forwarded, delete_bad_words, anti_spam, spam_max_messages, spam_window_seconds, warn_threshold)
           VALUES (?, ?, ?, 1, 1, 1, 1, 1, 5, 10, 3)
           ON CONFLICT(chat_id) DO NOTHING`
        )
        .bind(msg.chat.id, msg.chat.title || null, msg.chat.type)
        .run();
      group = await getGroupSettings(db, msg.chat.id);
    } catch (_) {}
  }
  // حتى لو لم نتمكن من إنشاء سجل، نطبق الفلترة بإعدادات افتراضية على المجموعات
  if (!group) {
    group = {
      is_active: 1,
      delete_links: 1,
      delete_forwarded: 1,
      delete_bad_words: 1,
      anti_spam: 1,
      spam_max_messages: 5,
      spam_window_seconds: 10,
      warn_threshold: 3,
    };
  }
  if (!group.is_active) return { deleted: false, warned: false };

  const text = msg.text || msg.caption || '';
  const entities = msg.entities || msg.caption_entities;

  // 1) فحص الرسائل المحولة
  if (group.delete_forwarded && isForwarded(msg)) {
    try {
      await tg.deleteMessage(msg.chat.id, msg.message_id);
      await warnUser(db, tg, msg.chat.id, msg.from.id, getDisplayName(msg.from), 'إرسال رسالة محولة', group.warn_threshold);
      await logActivity(db, 'msg_deleted_forwarded', `User ${msg.from.id} in group ${msg.chat.id}`, msg.from.id);
      return { deleted: true, warned: true, reason: 'forwarded' };
    } catch (e) {
      console.error('delete forwarded error:', e);
    }
  }

  // 2) فحص الروابط (مع استثناء أوامر البوت مثل /menu@bot_username)
  if (group.delete_links && text && hasLink(text, entities)) {
    // استثناء أوامر البوت المعروفة (whitelist) — الأمر بحد ذاته هو الرسالة كاملة
    const excludeBotCmds = ((await getSetting(db, 'exclude_bot_commands_from_link_delete')) ?? '1') !== '0';
    let isBotCmd = false;
    if (excludeBotCmds) {
      const botUsername = await getBotUsername(db, tg);
      isBotCmd = await isBotCommandMention(db, text.trim(), botUsername);
      // اعتبار النص الكامل عبارة عن أمر فقط إذا بدأ بـ / ولم يحتوي على روابط فعلية (entities من نوع url)
      // نتحقق أيضاً أن الـ entities لا تحتوي على روابط حقيقية (للحفاظ على الأمان)
      if (isBotCmd && entities && entities.length) {
        const hasRealUrl = entities.some((e) => e.type === 'url' || e.type === 'text_link');
        if (hasRealUrl) isBotCmd = false;
      }
    }
    if (!isBotCmd) {
      try {
        await tg.deleteMessage(msg.chat.id, msg.message_id);
        await warnUser(db, tg, msg.chat.id, msg.from.id, getDisplayName(msg.from), 'إرسال رابط', group.warn_threshold);
        await logActivity(db, 'msg_deleted_link', `User ${msg.from.id} in group ${msg.chat.id}`, msg.from.id);
        return { deleted: true, warned: true, reason: 'link' };
      } catch (e) {
        console.error('delete link error:', e);
      }
    }
  }

  // 3) فحص الكلمات المحظورة (يفحص النص أو caption) - يعمل دائماً للمجموعات النشطة
  // ملاحظة: نتجاهل علم delete_bad_words ونعتمد قائمة الكلمات لتفعيل أوسع
  if (text) {
    const { results: bannedWords } = await db.prepare('SELECT word, severity FROM banned_words').all();
    const found = containsBannedWord(text, bannedWords as any);
    if (found) {
      let deletedOk = false;
      try {
        await tg.deleteMessage(msg.chat.id, msg.message_id);
        deletedOk = true;
      } catch (e: any) {
        console.error('delete badword error:', e?.message || e);
        // لو فشل الحذف، أبلغ المالك بأن البوت يحتاج صلاحية حذف الرسائل
        try {
          const ownerId = Number((await db.prepare("SELECT value FROM bot_settings WHERE key='owner_user_id'").first() as any)?.value || 0);
          if (ownerId) {
            const ownerMsg = await getBotText(
              db,
              'mod_delete_failed_owner',
              {
                group: escapeHtml(msg.chat.title || String(msg.chat.id)),
                word: escapeHtml(found.word),
              },
              `⚠️ تعذّر حذف رسالة مخالفة في المجموعة <b>${escapeHtml(msg.chat.title || String(msg.chat.id))}</b>.\nيرجى التأكد من أن البوت مشرف بصلاحية حذف الرسائل.\nالكلمة: "${escapeHtml(found.word)}"`
            );
            await tg.sendMessage(ownerId, ownerMsg);
          }
        } catch (_) {}
      }

      try {
        if (found.severity === 'kick') {
          try {
            await tg.banChatMember(msg.chat.id, msg.from.id);
            const kickMsg = await getBotText(
              db,
              'mod_kicked_member',
              { display: escapeHtml(getDisplayName(msg.from)) },
              `🚫 <b>تم طرد العضو</b> ${escapeHtml(getDisplayName(msg.from))} لاستخدامه كلمة محظورة.`
            );
            await tg.sendMessage(msg.chat.id, kickMsg);
          } catch (_) {}
        } else {
          await warnUser(db, tg, msg.chat.id, msg.from.id, getDisplayName(msg.from), `كلمة محظورة: "${found.word}"`, group.warn_threshold);
        }
      } catch (_) {}

      await logActivity(db, 'msg_deleted_badword', `User ${msg.from.id} word=${found.word} deleted=${deletedOk}`, msg.from.id);
      if (deletedOk) {
        return { deleted: true, warned: true, reason: `banned_word:${found.word}` };
      }
    }
  }

  // 4) فحص السبام (تكرار الرسائل)
  if (group.anti_spam) {
    const now = Math.floor(Date.now() / 1000);
    const window = group.spam_window_seconds || 10;
    const max = group.spam_max_messages || 5;

    // تسجيل الرسالة الحالية
    await db
      .prepare('INSERT INTO user_messages (telegram_user_id, group_id, message_id, sent_at) VALUES (?, ?, ?, ?)')
      .bind(msg.from.id, msg.chat.id, msg.message_id, now)
      .run();

    // عدّ رسائل المستخدم في النافذة الزمنية
    const r: any = await db
      .prepare(
        'SELECT COUNT(*) AS c FROM user_messages WHERE telegram_user_id = ? AND group_id = ? AND sent_at > ?'
      )
      .bind(msg.from.id, msg.chat.id, now - window)
      .first();

    if (r && r.c > max) {
      try {
        await tg.deleteMessage(msg.chat.id, msg.message_id);
        await warnUser(db, tg, msg.chat.id, msg.from.id, getDisplayName(msg.from), `سبام: ${r.c} رسائل في ${window}ث`, group.warn_threshold);
        await logActivity(db, 'msg_deleted_spam', `User ${msg.from.id} count=${r.c}`, msg.from.id);
        return { deleted: true, warned: true, reason: 'spam' };
      } catch (e) {
        console.error('spam delete error:', e);
      }
    }

    // تنظيف الرسائل القديمة (اختياري - كل فترة)
    if (Math.random() < 0.05) {
      await db
        .prepare('DELETE FROM user_messages WHERE sent_at < ?')
        .bind(now - 3600)
        .run();
    }
  }

  return { deleted: false, warned: false };
}

// تحذير مستخدم
export async function warnUser(
  db: D1Database,
  tg: Telegram,
  chat_id: number,
  user_id: number,
  display: string,
  reason: string,
  threshold: number
) {
  // إضافة تحذير
  await db
    .prepare('INSERT INTO warnings (telegram_user_id, group_id, reason, warned_by) VALUES (?, ?, ?, 0)')
    .bind(user_id, chat_id, reason)
    .run();

  // عدّ التحذيرات
  const r: any = await db
    .prepare('SELECT COUNT(*) AS c FROM warnings WHERE telegram_user_id = ? AND group_id = ?')
    .bind(user_id, chat_id)
    .first();

  const count = r?.c || 0;

  // تحديث عدّاد الطالب إن وجد
  await db
    .prepare('UPDATE students SET warns_count = ? WHERE telegram_user_id = ? AND group_id = ?')
    .bind(count, user_id, chat_id)
    .run();

  // إرسال رسالة تحذير في المجموعة
  try {
    if (count >= threshold) {
      // تجاوز الحد - كتم لمدة ساعة
      const until = Math.floor(Date.now() / 1000) + 3600;
      await tg.restrictChatMember(
        chat_id,
        user_id,
        {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_polls: false,
          can_send_other_messages: false,
        },
        until
      );

      const muteMsg = await getBotText(
        db,
        'mod_muted_member',
        {
          display: escapeHtml(display),
          count: String(count),
          threshold: String(threshold),
          reason: escapeHtml(reason),
        },
        `🔇 <b>تم كتم العضو</b>\n\nالعضو ${escapeHtml(display)} تجاوز الحد المسموح من التحذيرات (${count}/${threshold})\n\n📌 السبب الأخير: ${escapeHtml(reason)}\n⏰ مدة الكتم: ساعة واحدة`
      );
      await tg.sendMessage(chat_id, muteMsg);

      // إعادة العداد للصفر
      await db
        .prepare('DELETE FROM warnings WHERE telegram_user_id = ? AND group_id = ?')
        .bind(user_id, chat_id)
        .run();
      await db
        .prepare('UPDATE students SET warns_count = 0 WHERE telegram_user_id = ? AND group_id = ?')
        .bind(user_id, chat_id)
        .run();
    } else {
      const warnMsg = await getBotText(
        db,
        'mod_warning_member',
        {
          display: escapeHtml(display),
          reason: escapeHtml(reason),
          count: String(count),
          threshold: String(threshold),
        },
        `⚠️ <b>تحذير للعضو</b> ${escapeHtml(display)}\n\n📌 السبب: ${escapeHtml(reason)}\n🔢 التحذيرات: <b>${count}/${threshold}</b>\n\n⛔️ عند تجاوز الحد سيتم كتمك تلقائياً.`
      );
      await tg.sendMessage(chat_id, warnMsg);
    }
  } catch (e) {
    console.error('warn message error:', e);
  }
}
