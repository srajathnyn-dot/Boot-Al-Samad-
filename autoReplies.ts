// ============================================
// الردود التلقائية على الكلمات المفتاحية
// مع دعم الملفات والأزرار الشفافة
// ============================================

import { Telegram, TgMessage, normalizeArabic } from '../utils/telegram';
import { loadAttachmentsFor, loadButtonsFor, buildInlineKeyboard } from '../utils/buttons';

export async function checkAutoReplies(
  db: D1Database,
  tg: Telegram,
  msg: TgMessage
): Promise<boolean> {
  const text = msg.text || msg.caption || '';
  if (!text || !msg.from || msg.from.is_bot) return false;

  const { results } = await db
    .prepare('SELECT * FROM auto_replies WHERE is_active = 1 ORDER BY id')
    .all();

  for (const rule of results as any[]) {
    const sensitive = !!rule.case_sensitive;
    // نستخدم تطبيع العربية إذا كان غير حساس لحالة الأحرف
    const haystack = sensitive ? text : normalizeArabic(text);
    const trigger = sensitive ? rule.trigger_text : normalizeArabic(rule.trigger_text);

    let matched = false;
    switch (rule.match_type) {
      case 'exact':
        matched = haystack.trim() === trigger.trim();
        break;
      case 'starts_with':
        matched = haystack.startsWith(trigger);
        break;
      case 'regex':
        try {
          const re = new RegExp(rule.trigger_text, sensitive ? '' : 'i');
          matched = re.test(text);
        } catch (_) {
          matched = false;
        }
        break;
      case 'contains':
      default:
        matched = haystack.includes(trigger);
        break;
    }

    if (matched) {
      try {
        await sendAutoReply(db, tg, msg.chat.id, rule, msg.message_id);
        return true;
      } catch (e) {
        console.error('auto reply send error:', e);
      }
    }
  }
  return false;
}

export async function sendAutoReply(
  db: D1Database,
  tg: Telegram,
  chat_id: number,
  rule: any,
  reply_to_message_id?: number
) {
  const attachments = await loadAttachmentsFor(db, 'reply', rule.id);
  const buttons = await loadButtonsFor(db, 'reply', rule.id);
  const replyMarkup = buildInlineKeyboard(buttons);
  const baseExtra: any = {};
  if (reply_to_message_id) baseExtra.reply_to_message_id = reply_to_message_id;
  if (replyMarkup) baseExtra.reply_markup = replyMarkup;

  if (attachments.length === 0) {
    // نص فقط
    await tg.sendMessage(chat_id, rule.reply_text, baseExtra);
    return;
  }

  // أول مرفق + caption يحتوي نص الرد
  const first = attachments[0];
  const firstExtra: any = { ...baseExtra };
  await tg.sendAttachment(chat_id, first, rule.reply_text, firstExtra);

  // باقي المرفقات بدون caption
  for (let i = 1; i < attachments.length; i++) {
    try {
      await tg.sendAttachment(chat_id, attachments[i], attachments[i].caption || '', {});
    } catch (_) {}
  }
}
