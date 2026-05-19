// ============================================
// نظام الإشعارات الموحّد (Telegram + Web Push)
// يستخدم لتوجيه أحداث البوت لكل المشرفين المعنيين
// ============================================

import { Telegram, escapeHtml } from './telegram';
import { getSetting } from './db';
import { sendWebPushToUser } from './webpush';

export type EventType =
  | 'join_request'
  | 'join_not_student'
  | 'question'
  | 'request'
  | 'moderation'
  | 'system';

export interface NotifyOptions {
  event_type: EventType;
  event_ref_id?: number;
  title: string;
  body: string;            // النص الذي يظهر في إشعار الويب (نص بسيط)
  telegram_html?: string;  // نسخة HTML للتلجرام (إذا اختلفت)
  telegram_reply_markup?: any;
  url?: string;            // رابط فتحه في لوحة التحكم عند الضغط
  data?: any;              // بيانات إضافية للحفظ
}

// إرسال إشعار لكل المشرفين المعنيين
export async function notifyAdmins(
  db: D1Database,
  tg: Telegram,
  opts: NotifyOptions
): Promise<{ telegram_sent: number; webpush_sent: number; log_id: number }> {
  const html = opts.telegram_html || opts.body;

  // 1) جلب كل المشرفين (المالك + bot_admins)
  const adminIds = await getAllAdminTelegramIds(db);

  // 2) لكل مشرف: تحديد قناة التوصيل
  let telegramSent = 0;
  let webpushSent = 0;

  for (const adminId of adminIds) {
    const channel = await getRoutingChannel(db, adminId, opts.event_type);
    if (channel === 'none') continue;

    // (أ) Telegram
    if (channel === 'telegram' || channel === 'both') {
      try {
        await tg.sendMessage(adminId, html, {
          reply_markup: opts.telegram_reply_markup,
        });
        telegramSent++;
      } catch (e: any) {
        console.error('notify telegram error:', adminId, e?.message);
      }
    }

    // (ب) Web Push
    if (channel === 'webpush' || channel === 'both') {
      try {
        const panelUserId = await getPanelUserIdForAdmin(db, adminId);
        if (panelUserId) {
          const r = await sendWebPushToUser(db, panelUserId, {
            title: opts.title,
            body: opts.body,
            url: opts.url || '/admin/dashboard',
            event_type: opts.event_type,
            event_ref_id: opts.event_ref_id,
          });
          webpushSent += r.sent;
        }
      } catch (e: any) {
        console.error('notify webpush error:', adminId, e?.message);
      }
    }
  }

  // 3) حفظ السجل
  let log_id = 0;
  try {
    const r = await db
      .prepare(
        `INSERT INTO notifications_log (event_type, event_ref_id, title, body, data_json, pushed_to_count, telegram_sent_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        opts.event_type,
        opts.event_ref_id ?? null,
        opts.title,
        opts.body,
        opts.data ? JSON.stringify(opts.data) : null,
        webpushSent,
        telegramSent
      )
      .run();
    log_id = Number(r.meta.last_row_id) || 0;
  } catch (e) {
    console.error('notify log error:', e);
  }

  return { telegram_sent: telegramSent, webpush_sent: webpushSent, log_id };
}

// إعلام جميع المشرفين الآخرين بأن مشرفاً قام بالرد/التعامل مع الحدث
export async function notifyHandledByAdmin(
  db: D1Database,
  tg: Telegram,
  opts: {
    event_type: EventType;
    event_ref_id: number;
    handled_by_telegram_id: number;
    handled_by_name: string;
    summary: string;
  }
): Promise<void> {
  // تحديث سجل الإشعار
  try {
    await db
      .prepare(
        `UPDATE notifications_log
         SET handled_by_admin=?, handled_at=CURRENT_TIMESTAMP
         WHERE event_type=? AND event_ref_id=? AND handled_by_admin IS NULL`
      )
      .bind(opts.handled_by_telegram_id, opts.event_type, opts.event_ref_id)
      .run();
  } catch (_) {}

  const adminIds = await getAllAdminTelegramIds(db);
  const others = adminIds.filter((id) => id !== opts.handled_by_telegram_id);

  const text =
    `ℹ️ <b>تم التعامل مع الطلب</b>\n\n` +
    `قام المشرف <b>${escapeHtml(opts.handled_by_name)}</b> بالرد/التعامل مع:\n` +
    `<i>${escapeHtml(opts.summary)}</i>\n\n` +
    `لا داعي للرد عليه مرة أخرى. ✅`;

  const plain = `قام ${opts.handled_by_name} بالتعامل مع: ${opts.summary}`;

  for (const adminId of others) {
    const channel = await getRoutingChannel(db, adminId, opts.event_type);
    if (channel === 'none') continue;

    if (channel === 'telegram' || channel === 'both') {
      try {
        await tg.sendMessage(adminId, text);
      } catch (_) {}
    }

    if (channel === 'webpush' || channel === 'both') {
      try {
        const panelUserId = await getPanelUserIdForAdmin(db, adminId);
        if (panelUserId) {
          await sendWebPushToUser(db, panelUserId, {
            title: '✅ تم التعامل',
            body: plain,
            url: '/admin/dashboard',
            event_type: 'system',
          });
        }
      } catch (_) {}
    }
  }
}

// === Helpers ===

async function getAllAdminTelegramIds(db: D1Database): Promise<number[]> {
  const ids = new Set<number>();
  // المالك من الإعدادات
  const ownerId = Number((await getSetting(db, 'owner_user_id')) || '0');
  if (ownerId) ids.add(ownerId);
  // كل bot_admins
  try {
    const r = await db.prepare('SELECT telegram_user_id FROM bot_admins').all();
    for (const row of (r.results as any[]) || []) {
      if (row.telegram_user_id) ids.add(Number(row.telegram_user_id));
    }
  } catch (_) {}
  return [...ids];
}

// قناة التوصيل لمشرف معين لنوع حدث معين
// إذا لم يوجد إعداد محدد → نستخدم 'telegram' افتراضياً
async function getRoutingChannel(
  db: D1Database,
  telegramUserId: number,
  eventType: string
): Promise<'telegram' | 'webpush' | 'both' | 'none'> {
  try {
    // 1) محاولة قراءة الإعداد لهذا النوع بالضبط
    const exact: any = await db
      .prepare(
        'SELECT channel, is_active FROM admin_routing WHERE telegram_user_id = ? AND event_type = ?'
      )
      .bind(telegramUserId, eventType)
      .first();
    if (exact) {
      if (!exact.is_active) return 'none';
      return (exact.channel as any) || 'telegram';
    }
    // 2) محاولة قراءة الإعداد العام 'all'
    const generic: any = await db
      .prepare(
        "SELECT channel, is_active FROM admin_routing WHERE telegram_user_id = ? AND event_type = 'all'"
      )
      .bind(telegramUserId)
      .first();
    if (generic) {
      if (!generic.is_active) return 'none';
      return (generic.channel as any) || 'telegram';
    }
  } catch (_) {}
  // افتراضي: telegram فقط
  return 'telegram';
}

// محاولة ربط telegram_user_id بـ panel_users.id
// نخزن الربط في حقل panel_users.telegram_user_id إذا كان موجوداً
// إذا لم يكن، نعتمد على panel_users.username == bot_admins.username كتقريب
async function getPanelUserIdForAdmin(
  db: D1Database,
  telegramUserId: number
): Promise<number | null> {
  // الأسلوب 1: عمود مباشر إذا وُجد
  try {
    const r: any = await db
      .prepare('SELECT id FROM panel_users WHERE telegram_user_id = ?')
      .bind(telegramUserId)
      .first();
    if (r) return Number(r.id);
  } catch (_) {
    // العمود قد لا يكون موجوداً
  }
  // الأسلوب 2: مطابقة بـ username
  try {
    const admin: any = await db
      .prepare('SELECT username FROM bot_admins WHERE telegram_user_id = ?')
      .bind(telegramUserId)
      .first();
    if (admin?.username) {
      const r: any = await db
        .prepare('SELECT id FROM panel_users WHERE username = ?')
        .bind(admin.username)
        .first();
      if (r) return Number(r.id);
    }
  } catch (_) {}
  return null;
}
