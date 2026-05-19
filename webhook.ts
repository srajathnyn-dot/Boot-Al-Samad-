// ============================================
// المعالج الرئيسي لـ Telegram Webhook
// ============================================

import { Telegram, TgUpdate, getDisplayName, escapeHtml, TG_ANONYMOUS_ADMIN_ID, TG_SERVICE_ID, isChannelAutoForward } from '../utils/telegram';
import { getSetting, setSetting, isAdmin, isOwner, upsertGroup, logActivity, upsertSubscriber } from '../utils/db';
import { moderateMessage } from './moderation';
import { checkAutoReplies } from './autoReplies';
import {
  showMainMenu,
  showCurriculumLevels,
  showCurriculumLevel,
  showCurriculumSemesterChoice,
  showCurriculumItem,
  showAbout,
  showContact,
  startRequest,
  handleRequestText,
  runCustomCommand,
} from './menu';
import {
  startJoinFlow,
  handleIsStudentAnswer,
  handleLevelChoice,
  handleStudentData,
  handleOwnerDecision,
} from './joinFlow';
import {
  startGradesQuery,
  handleGradesText,
  handleGradesToggle,
  handleGradesToggleAll,
  handleGradesShow,
  handleGradesShowAll,
} from './grades';
import { matchReplyKeyboardAction } from './keyboards';
import { notifyHandledByAdmin } from '../utils/notifications';
import { getBotText } from '../utils/texts';

export async function handleUpdate(update: TgUpdate, db: D1Database, tg: Telegram): Promise<void> {
  try {
    // 1) chat_join_request
    if (update.chat_join_request) {
      const req = update.chat_join_request;
      await upsertGroup(db, req.chat.id, req.chat.title, req.chat.type);
      await startJoinFlow(db, tg, req.from, req.chat.id);
      return;
    }

    // 2) my_chat_member - عند إضافة البوت لمجموعة أو إزالته
    if (update.my_chat_member) {
      const m = update.my_chat_member;
      const newStatus = m.new_chat_member?.status;
      const oldStatus = m.old_chat_member?.status;
      const isGroup = ['group', 'supergroup', 'channel'].includes(m.chat.type);

      // عند إزالة البوت أو حظره - نُعطّل المجموعة في قاعدة البيانات
      if (isGroup && (newStatus === 'left' || newStatus === 'kicked')) {
        try {
          await db
            .prepare('UPDATE groups SET is_active = 0 WHERE chat_id = ?')
            .bind(m.chat.id)
            .run();
        } catch (_) {}
        try {
          const owner_id = Number((await getSetting(db, 'owner_user_id')) || '0');
          if (owner_id) {
            await tg.sendToOwner(
              owner_id,
              `🚪 <b>غادر البوت مجموعة</b>\n\n` +
                `📛 الاسم: <b>${escapeHtml(m.chat.title || '')}</b>\n` +
                `🆔 المعرف: <code>${m.chat.id}</code>\n` +
                `📊 الحالة: ${newStatus}`
            );
          }
        } catch (_) {}
        return;
      }

      if (isGroup && (newStatus === 'administrator' || newStatus === 'member')) {
        // فحص الحماية: هل يُسمح بإضافة البوت لهذه المجموعة؟
        const restrictMode = (await getSetting(db, 'restrict_bot_to_admins_only')) === '1';
        const autoLeave = (await getSetting(db, 'auto_leave_unauthorized_groups')) === '1';
        const adderId = m.from?.id || 0;

        // فحص هل من أضاف البوت مالك أو مصرح
        let allowed = false;
        let reason = '';
        if (adderId) {
          const isAdminUser = await isAdmin(db, adderId);
          if (isAdminUser) {
            // فحص الصلاحية: هل لديه can_manage_groups أو هو owner؟
            try {
              const adminRow: any = await db
                .prepare('SELECT role, can_manage_groups FROM bot_admins WHERE telegram_user_id = ?')
                .bind(adderId)
                .first();
              if (adminRow && (adminRow.role === 'owner' || adminRow.can_manage_groups)) {
                allowed = true;
                reason = adminRow.role === 'owner' ? 'مالك' : 'مشرف مصرح';
              } else if (adminRow) {
                reason = `مشرف لكن بدون صلاحية إدارة المجموعات`;
              }
            } catch (_) {
              // إذا فشل الاستعلام (مثلاً العمود غير موجود) - نسمح للمشرفين
              allowed = true;
              reason = 'مشرف';
            }
          } else {
            reason = 'ليس مشرفاً';
          }
        }

        // أيضاً فحص قائمة المجموعات المسموحة (allowed_groups)
        if (!allowed) {
          try {
            const inWhitelist: any = await db
              .prepare('SELECT id FROM allowed_groups WHERE chat_id = ?')
              .bind(m.chat.id)
              .first();
            if (inWhitelist) {
              allowed = true;
              reason = 'في القائمة المسموحة';
            }
          } catch (_) {}
        }

        // المالك يستطيع دائماً (حتى لو الحماية معطلة)
        if (!restrictMode) {
          // إذا الحماية غير مفعلة، السماح للجميع
          allowed = true;
          if (!reason) reason = 'الحماية معطلة';
        }

        if (allowed) {
          // مسموح → سجل المجموعة بشكل طبيعي
          await upsertGroup(db, m.chat.id, m.chat.title, m.chat.type);
          try {
            await db
              .prepare('UPDATE groups SET added_by_user_id = ?, added_by_username = ?, is_active = 1 WHERE chat_id = ?')
              .bind(adderId || null, m.from?.username || null, m.chat.id)
              .run();
          } catch (_) {}

          const owner_id = Number((await getSetting(db, 'owner_user_id')) || '0');
          if (owner_id) {
            await tg.sendToOwner(
              owner_id,
              `🤖 <b>تم إضافة البوت إلى مجموعة جديدة</b>\n\n` +
                `📛 الاسم: <b>${escapeHtml(m.chat.title || '')}</b>\n` +
                `🆔 المعرف: <code>${m.chat.id}</code>\n` +
                `📋 النوع: ${m.chat.type}\n` +
                `📊 الحالة: ${newStatus}\n` +
                `👤 المُضيف: ${escapeHtml(m.from?.first_name || '')} (<code>${adderId}</code>) — ${reason}\n\n` +
                `يمكنك إدارة إعدادات هذه المجموعة من لوحة التحكم.`
            );
          }
        } else if (autoLeave) {
          // غير مسموح → البوت يغادر فوراً
          console.log(`Auto-leaving unauthorized group ${m.chat.id} (${m.chat.title}) - added by ${adderId} (${reason})`);
          try {
            await tg.sendMessage(
              m.chat.id,
              await getBotText(
                db,
                'group_unauthorized_added',
                {},
                '<b>لم يتم تصريح هذه المجموعة لاستضافة البوت.</b>\n\nسيغادر البوت المجموعة تلقائياً.\nللاستفسار، تواصل مع إدارة البوت.'
              )
            );
          } catch (_) {}
          try {
            await tg.leaveChat(m.chat.id);
          } catch (e: any) {
            console.error('leaveChat failed:', e?.message);
          }

          // إبلاغ المالك
          const owner_id = Number((await getSetting(db, 'owner_user_id')) || '0');
          if (owner_id) {
            await tg.sendToOwner(
              owner_id,
              `🚫 <b>منع إضافة البوت لمجموعة غير مصرح بها</b>\n\n` +
                `📛 المجموعة: <b>${escapeHtml(m.chat.title || '')}</b>\n` +
                `🆔 المعرف: <code>${m.chat.id}</code>\n` +
                `👤 المُضيف: ${escapeHtml(m.from?.first_name || '')} (<code>${adderId}</code>)\n` +
                `📝 السبب: ${reason || 'غير معروف'}\n\n` +
                `تم إخراج البوت تلقائياً من هذه المجموعة.`
            );
          }
          try {
            await logActivity(db, 'group_auto_leave', `chat=${m.chat.id} by=${adderId} reason=${reason}`, adderId);
          } catch (_) {}
        } else {
          // الحماية مفعّلة لكن auto_leave غير مفعّل → سجّل المجموعة كغير نشطة
          await upsertGroup(db, m.chat.id, m.chat.title, m.chat.type);
          try {
            await db
              .prepare('UPDATE groups SET is_active = 0 WHERE chat_id = ?')
              .bind(m.chat.id)
              .run();
          } catch (_) {}
          const owner_id = Number((await getSetting(db, 'owner_user_id')) || '0');
          if (owner_id) {
            await tg.sendToOwner(
              owner_id,
              `⚠️ <b>محاولة إضافة البوت لمجموعة غير مصرح بها</b>\n\n` +
                `📛 المجموعة: <b>${escapeHtml(m.chat.title || '')}</b>\n` +
                `🆔 المعرف: <code>${m.chat.id}</code>\n` +
                `👤 المُضيف: ${escapeHtml(m.from?.first_name || '')} (<code>${adderId}</code>)\n` +
                `📝 السبب: ${reason}\n\n` +
                `البوت في المجموعة لكنها معطلة. فعّلها من لوحة التحكم أو أزل البوت يدوياً.`
            );
          }
        }
      }
      return;
    }

    // 3) callback_query
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, db, tg);
      return;
    }

    // 4) message
    if (update.message) {
      await handleMessage(update.message, db, tg);
      return;
    }
  } catch (e: any) {
    console.error('handleUpdate error:', e?.message || e);
  }
}

async function handleMessage(msg: any, db: D1Database, tg: Telegram) {
  const isPrivate = msg.chat.type === 'private';
  const text = msg.text || msg.caption || '';

  // === دعم مجموعات نقاش القنوات (Linked Discussion Groups) ===
  // 1) إذا كانت رسالة من قناة معاد توجيهها تلقائياً → نسجل المجموعة فقط ولا نتفاعل
  if (isChannelAutoForward(msg)) {
    await upsertGroup(db, msg.chat.id, msg.chat.title, msg.chat.type);
    return;
  }

  // 2) إذا كانت من مشرف مجهول (sender_chat = chat) — نسمح بالرسالة لكن نستخدم chat_id كهوية بديلة
  // 3) إذا لم يكن هناك msg.from نهائياً (channel post في channel نفسها) — نتجاهل بهدوء
  if (!msg.from) {
    // ربما sender_chat (anonymous admin/channel) — نتجاهل لأن لا يوجد user_id حقيقي للتعامل معه
    if (msg.sender_chat) {
      await upsertGroup(db, msg.chat.id, msg.chat.title, msg.chat.type);
    }
    return;
  }

  // تسجيل المشترك إذا كان في الخاص
  if (isPrivate && !msg.from.is_bot) {
    await upsertSubscriber(db, msg.from);
  }

  // === التحقق من رد المشرف على طلب/استفسار (تابع لزر "الرد") ===
  if (isPrivate && text && !text.startsWith('/')) {
    const pendingReply = await getSetting(db, `pending_admin_reply_${msg.from.id}`);
    if (pendingReply) {
      await handleAdminReply(db, tg, msg, Number(pendingReply));
      return;
    }
  }

  // === الرسائل الخاصة (1-on-1) ===
  if (isPrivate) {
    // الأوامر
    if (text.startsWith('/start')) {
      // إذا كان هناك معرف ربط (deep link)
      const param = text.split(' ')[1];

      // Deep link: req_question | req_request - بدء طلب/سؤال
      if (param === 'req_question') {
        await startRequest(db, tg, msg.from.id, msg.from, 'question');
        return;
      }
      if (param === 'req_request') {
        await startRequest(db, tg, msg.from.id, msg.from, 'request');
        return;
      }
      // Deep link: contact - عرض جهات التواصل
      if (param === 'contact') {
        await showContact(db, tg, msg.from.id);
        return;
      }
      // Deep link: grades - بدء استعلام الدرجات
      if (param === 'grades') {
        await startGradesQuery(db, tg, msg.from.id, msg.from);
        return;
      }
      // Deep link: curriculum - عرض المناهج
      if (param === 'curriculum') {
        await showCurriculumLevels(tg, msg.from.id, undefined, db);
        return;
      }
      // Deep link: about - عرض معلومات الكلية
      if (param === 'about') {
        await showAbout(db, tg, msg.from.id);
        return;
      }

      // تسجيل المستخدم كمالك إذا كان هذا أول /start ولم يتم تعيين مالك
      const owner_id = await getSetting(db, 'owner_user_id');
      if (!owner_id || owner_id === '0' || owner_id === '') {
        await setSetting(db, 'owner_user_id', String(msg.from.id));
        if (msg.from.username) await setSetting(db, 'owner_username', '@' + msg.from.username);
        await setSetting(db, 'owner_contact_url', `tg://user?id=${msg.from.id}`);
        await db
          .prepare(
            `INSERT INTO bot_admins (telegram_user_id, username, full_name, role) VALUES (?, ?, ?, 'owner')
             ON CONFLICT(telegram_user_id) DO UPDATE SET role='owner'`
          )
          .bind(msg.from.id, msg.from.username || null, [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' '))
          .run();
        await tg.sendMessage(
          msg.from.id,
          await getBotText(
            db,
            'owner_first_register',
            {},
            '<b>مرحباً بك أيها المالك</b>\n\nتم تسجيلك كمالك للبوت تلقائياً (أنت أول من بدأ المحادثة).\n\n<b>يمكنك إدارة البوت من خلال:</b>\n• /admin — رابط لوحة التحكم الويب\n• /panel — رابط لوحة التحكم الويب\n• /menu — القائمة الرئيسية\n• /stats — إحصائيات البوت'
          )
        );
        await logActivity(db, 'owner_set', `Owner set to ${msg.from.id}`, msg.from.id);
        return;
      }

      await showMainMenu(db, tg, msg.from.id, msg.from);
      return;
    }

    if (text === '/menu') {
      await showMainMenu(db, tg, msg.from.id, msg.from);
      return;
    }

    if (text === '/cancel') {
      await db.prepare('DELETE FROM bot_settings WHERE key = ?').bind(`pending_request_${msg.from.id}`).run();
      await tg.sendMessage(
        msg.from.id,
        await getBotText(db, 'cmd_cancel_done', {}, 'تم إلغاء العملية.')
      );
      return;
    }

    if (text === '/help') {
      const baseHelp = await getBotText(
        db,
        'cmd_help_user',
        {},
        '<b>دليل الاستخدام</b>\n\nمرحباً بك في بوت كلية الصماد للقرآن الكريم.\n\n<b>الأوامر المتاحة:</b>\n• /start — بدء البوت\n• /menu — عرض القائمة الرئيسية\n• /help — هذه الرسالة\n• /cancel — إلغاء أي عملية حالية'
      );
      const adminExtra = (await isAdmin(db, msg.from.id))
        ? await getBotText(
            db,
            'cmd_help_admin_extra',
            {},
            '\n\n<b>أوامر الإدارة:</b>\n• /admin — لوحة الإدارة\n• /panel — رابط لوحة التحكم الويب\n• /stats — إحصائيات البوت\n• /id — معرفك ومعرف المحادثة'
          )
        : '';
      await tg.sendMessage(msg.from.id, baseHelp + adminExtra);
      return;
    }

    if (text === '/id') {
      const usernameLine = msg.from.username ? `<b>اسم المستخدم:</b> @${msg.from.username}\n` : '';
      await tg.sendMessage(
        msg.from.id,
        await getBotText(
          db,
          'cmd_id_private',
          {
            user_id: String(msg.from.id),
            chat_id: String(msg.chat.id),
            username_line: usernameLine,
            chat_type: msg.chat.type,
          },
          `<b>معرّفك:</b> <code>${msg.from.id}</code>\n<b>معرف المحادثة:</b> <code>${msg.chat.id}</code>\n${usernameLine}<b>نوع المحادثة:</b> ${msg.chat.type}`
        )
      );
      return;
    }

    if (text === '/me') {
      const student: any = await db.prepare('SELECT * FROM students WHERE telegram_user_id = ?').bind(msg.from.id).first();
      if (!student) {
        await tg.sendMessage(
          msg.from.id,
          await getBotText(db, 'cmd_me_not_found', {}, 'لم يتم العثور على بيانات مسجلة لك.')
        );
        return;
      }
      const statusText = student.status === 'approved' ? 'معتمد' : 'قيد المراجعة';
      await tg.sendMessage(
        msg.from.id,
        await getBotText(
          db,
          'cmd_me_profile',
          {
            full_name: escapeHtml(student.full_name),
            level: String(student.level || ''),
            academic_id: String(student.academic_id || 'غير مسجل'),
            status_text: statusText,
          },
          `<b>ملفك الشخصي</b>\n\n• الاسم: <b>${escapeHtml(student.full_name)}</b>\n• المستوى: ${student.level}\n• الرقم الأكاديمي: <code>${student.academic_id || 'غير مسجل'}</code>\n• الحالة: ${statusText}`
        )
      );
      return;
    }

    if (text === '/admin' || text === '/panel') {
      if (!(await isAdmin(db, msg.from.id))) {
        await tg.sendMessage(
          msg.from.id,
          await getBotText(db, 'cmd_admin_only', {}, 'هذا الأمر متاح فقط للمالك والمشرفين.')
        );
        return;
      }
      const panelUrl = await getPanelUrl(db);
      await tg.sendMessage(
        msg.from.id,
        await getBotText(
          db,
          'cmd_panel_link',
          {},
          '<b>لوحة التحكم</b>\n\nللدخول إلى لوحة التحكم الويب، اضغط الزر أدناه.\n\n<i>سجّل الدخول بحسابك الشخصي.</i>'
        ),
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'فتح لوحة التحكم', url: panelUrl }],
              [{ text: 'الإحصائيات', callback_data: 'admin:stats' }],
            ],
          },
        }
      );
      return;
    }

    if (text === '/stats' && (await isAdmin(db, msg.from.id))) {
      await sendStats(db, tg, msg.from.id);
      return;
    }

    // === التعامل مع بيانات الانضمام ===
    const session: any = await db
      .prepare(
        "SELECT * FROM join_sessions WHERE telegram_user_id = ? AND step = 'data' ORDER BY id DESC LIMIT 1"
      )
      .bind(msg.from.id)
      .first();
    if (session && text && !text.startsWith('/')) {
      const handled = await handleStudentData(db, tg, msg.from, text);
      if (handled) return;
    }

    // === مطابقة Reply Keyboard (الأزرار الدائمة) في الخاص - أولاً قبل أي جلسة ===
    // مهم: هذا يأتي قبل معالجة جلسة الدرجات لتفادي معاملة نص الزر كرقم أكاديمي
    if (text && !text.startsWith('/')) {
      const action = await matchReplyKeyboardAction(db, text);
      if (action) {
        // إلغاء أي جلسة درجات نشطة (لأن المستخدم اختار إجراءً جديداً)
        try {
          await db.prepare('DELETE FROM grades_sessions WHERE telegram_user_id = ?').bind(msg.from.id).run();
        } catch (_) {}
        // إلغاء أي طلب معلق (في bot_settings)
        try {
          await db.prepare("DELETE FROM bot_settings WHERE key = ?").bind(`pending_request_${msg.from.id}`).run();
        } catch (_) {}
        await dispatchBuiltinAction(db, tg, msg.from.id, msg.from, action.action_type, action.action_value);
        return;
      }
    }

    // === التعامل مع جلسة الاستعلام عن الدرجات ===
    if (text && !text.startsWith('/')) {
      const gradesHandled = await handleGradesText(db, tg, msg.from, text);
      if (gradesHandled) return;
    }

    // === التعامل مع طلبات/أسئلة معلقة ===
    if (text && !text.startsWith('/')) {
      const handled = await handleRequestText(db, tg, msg.from, text);
      if (handled) return;
    }

    // === الردود التلقائية في الخاص ===
    await checkAutoReplies(db, tg, msg);
    return;
  }

  // === الرسائل في المجموعات (group, supergroup, channel) ===
  // ملاحظة: لمجموعات نقاش القنوات (Linked Discussion Groups) — chat.type = 'supergroup'
  // ومجموعة النقاش تتصرف مثل أي supergroup عادية بالنسبة للبوت إذا كان مشرفاً.

  // تسجيل/تحديث المجموعة
  await upsertGroup(db, msg.chat.id, msg.chat.title, msg.chat.type);

  // إذا كان المرسل GroupAnonymousBot (مشرف مجهول) أو خدمة تيليجرام — نقبل الرسالة لكن نتعامل بحذر
  const isAnonymousAdminSender = msg.from.id === TG_ANONYMOUS_ADMIN_ID;
  const isServiceSender = msg.from.id === TG_SERVICE_ID;
  // إذا كان مرسلاً عبر service (نادر في رسائل عادية) — نتجاهل
  if (isServiceSender) return;

  // معالجة الإشراف (حذف، تحذير، طرد) - مهم: قبل أي رد
  // ملاحظة: لا نطبق الإشراف على المشرفين المجهولين لأنهم admins بالفعل
  if (!isAnonymousAdminSender) {
    const modResult = await moderateMessage(db, tg, msg);
    if (modResult.deleted) return;
  }

  const me = await getMe(tg);
  const botUsername = me?.username || '';
  const isBotMentioned = text && (
    text.includes('@' + botUsername) ||
    (msg.reply_to_message?.from?.username && msg.reply_to_message.from.username === botUsername) ||
    msg.reply_to_message?.from?.is_bot
  );

  // أوامر المجموعة
  // يعمل مع /menu أو /menu@bot_username
  const cmdName = text.startsWith('/') ? text.split(/[\s@]/)[0] : '';

  if (cmdName === '/menu' || cmdName === '/start') {
    // عرض القائمة الرئيسية في نفس المجموعة
    await showMainMenu(db, tg, msg.chat.id, msg.from);
    return;
  }

  if (cmdName === '/id') {
    await tg.sendMessage(
      msg.chat.id,
      await getBotText(
        db,
        'cmd_id_group',
        { user_id: String(msg.from.id), chat_id: String(msg.chat.id) },
        `<b>معرفك:</b> <code>${msg.from.id}</code>\n<b>معرف المجموعة:</b> <code>${msg.chat.id}</code>`
      ),
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  if (cmdName === '/help') {
    await tg.sendMessage(
      msg.chat.id,
      await getBotText(
        db,
        'cmd_help_group',
        { bot_username: botUsername },
        `<b>أوامر البوت في المجموعة:</b>\n\n• /menu — عرض القائمة الرئيسية\n• /id — معرفك ومعرف المجموعة\n• /help — هذه المساعدة\n\nيمكنك مناداة البوت بـ <code>@${botUsername}</code> أو الرد على إحدى رسائله.`
      ),
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  // الأوامر المخصصة (مثل /about /rules)
  if (cmdName) {
    const customCmd: any = await db
      .prepare('SELECT * FROM custom_commands WHERE trigger_command = ? AND is_active = 1')
      .bind(cmdName)
      .first();
    if (customCmd) {
      await runCustomCommand(db, tg, msg.chat.id, msg.from, { id: customCmd.id }, undefined, msg.message_id);
      return;
    }
  }

  // الردود التلقائية
  const replied = await checkAutoReplies(db, tg, msg);
  if (replied) return;

  // === مطابقة Reply Keyboard في المجموعات (نص مطابق لأحد الأزرار) ===
  if (text && !text.startsWith('/')) {
    const action = await matchReplyKeyboardAction(db, text);
    if (action) {
      // أزرار الإدارة فقط للمشرفين
      if (await isAdminOnlyAction(action.action_type, action.action_value)) {
        if (!(await isAdmin(db, msg.from.id))) {
          // تجاهل بصمت في المجموعات (لا نزعج المستخدمين)
          return;
        }
      }
      await dispatchBuiltinAction(db, tg, msg.chat.id, msg.from, action.action_type, action.action_value, msg.message_id);
      return;
    }
  }

  // إذا تم مناداة البوت أو الرد عليه - رد افتراضي بقائمة
  if (isBotMentioned && text && !text.startsWith('/')) {
    await showMainMenu(db, tg, msg.chat.id, msg.from);
    return;
  }
}

// === Helper: تحويل أمر/إجراء إلى استدعاء معالج بيلت-إن ===
async function dispatchBuiltinAction(
  db: D1Database,
  tg: Telegram,
  chat_id: number,
  user: any,
  action_type: string,
  action_value: string,
  reply_to_message_id?: number
) {
  if (action_type === 'builtin') {
    switch (action_value) {
      case 'main':
      case 'menu':
        await showMainMenu(db, tg, chat_id, user);
        return;
      case 'curriculum':
        await showCurriculumLevels(tg, chat_id, undefined, db);
        return;
      case 'question':
        await startRequest(db, tg, chat_id, user, 'question');
        return;
      case 'request':
        await startRequest(db, tg, chat_id, user, 'request');
        return;
      case 'contact':
        await showContact(db, tg, chat_id);
        return;
      case 'about':
        await showAbout(db, tg, chat_id);
        return;
      case 'grades':
        await startGradesQuery(db, tg, chat_id, user);
        return;
    }
  }
  if (action_type === 'command') {
    await runCustomCommand(db, tg, chat_id, user, { code: action_value }, undefined, reply_to_message_id);
    return;
  }
  if (action_type === 'curriculum') {
    await showCurriculumLevels(tg, chat_id, undefined, db);
    return;
  }
  // افتراضي
  await showMainMenu(db, tg, chat_id, user);
}

// === Helper: تحديد ما إذا كان الإجراء يتطلب صلاحيات مشرف ===
async function isAdminOnlyAction(action_type: string, action_value: string): Promise<boolean> {
  // الإجراءات الإدارية (مثل stats, broadcast, admin_panel) يمكن إضافتها هنا لاحقاً
  const adminActions = new Set(['stats', 'admin_panel', 'broadcast', 'manage']);
  return action_type === 'builtin' && adminActions.has(action_value);
}

// معالجة رد المشرف على طلب/استفسار
async function handleAdminReply(db: D1Database, tg: Telegram, msg: any, request_id: number) {
  const text = (msg.text || '').trim();
  if (text === '/cancel') {
    await db.prepare('DELETE FROM bot_settings WHERE key = ?').bind(`pending_admin_reply_${msg.from.id}`).run();
    await tg.sendMessage(
      msg.from.id,
      await getBotText(db, 'reply_cancelled', {}, 'تم إلغاء الرد.')
    );
    return;
  }

  // جلب الطلب
  const request: any = await db.prepare('SELECT * FROM requests WHERE id = ?').bind(request_id).first();
  if (!request) {
    await tg.sendMessage(
      msg.from.id,
      await getBotText(db, 'reply_request_missing', {}, 'الطلب لم يعد موجوداً.')
    );
    await db.prepare('DELETE FROM bot_settings WHERE key = ?').bind(`pending_admin_reply_${msg.from.id}`).run();
    return;
  }

  // حفظ الرد
  await db
    .prepare('INSERT INTO request_replies (request_id, reply_text, replied_by) VALUES (?, ?, ?)')
    .bind(request_id, text, msg.from.id)
    .run();
  await db
    .prepare("UPDATE requests SET status='answered', admin_response=?, responded_by=?, updated_at=CURRENT_TIMESTAMP WHERE id = ?")
    .bind(text, msg.from.id, request_id)
    .run();

  // إرسال الرد للمستخدم
  try {
    await tg.sendMessage(
      request.telegram_user_id,
      await getBotText(
        db,
        'reply_to_user',
        {
          request_id: String(request_id),
          original: escapeHtml(request.content),
          reply: escapeHtml(text),
        },
        `<b>رد على طلبك رقم ${request_id}</b>\n\n<b>طلبك السابق:</b>\n<i>${escapeHtml(request.content)}</i>\n\n<b>الرد:</b>\n${escapeHtml(text)}`
      ),
      {
        reply_markup: {
          inline_keyboard: [[{ text: 'القائمة الرئيسية', callback_data: 'menu:main' }]],
        },
      }
    );
    await tg.sendMessage(
      msg.from.id,
      await getBotText(db, 'reply_sent_to_user', {}, 'تم إرسال الرد للمستخدم بنجاح.')
    );
  } catch (e: any) {
    await tg.sendMessage(
      msg.from.id,
      await getBotText(
        db,
        'reply_send_failed',
        { error: e?.message || 'خطأ' },
        `تعذّر إرسال الرد للمستخدم: ${e?.message || 'خطأ'}\nقد يكون المستخدم حظر البوت. تم حفظ الرد في قاعدة البيانات.`
      )
    );
  }

  await db.prepare('DELETE FROM bot_settings WHERE key = ?').bind(`pending_admin_reply_${msg.from.id}`).run();
  await logActivity(db, 'admin_reply_sent', `request=${request_id}`, msg.from.id);

  // إعلام بقية المشرفين أن مشرفاً قد تعامل مع الطلب
  try {
    const requestType = request.type === 'question' ? 'question' : 'request';
    const summary = request.content?.substring(0, 80) || `طلب #${request_id}`;
    await notifyHandledByAdmin(db, tg, {
      event_type: requestType,
      event_ref_id: Number(request_id),
      handled_by_telegram_id: msg.from.id,
      handled_by_name: msg.from.first_name || msg.from.username || `#${msg.from.id}`,
      summary: `${requestType === 'question' ? 'سؤال' : 'طلب'} #${request_id}: ${summary}`,
    });
  } catch (_) {}
}

async function handleCallbackQuery(cq: any, db: D1Database, tg: Telegram) {
  const data: string = cq.data || '';
  const user = cq.from;
  const chat_id = cq.message?.chat?.id || user.id;
  const message_id = cq.message?.message_id;

  // === menu:* ===
  if (data === 'menu:main') {
    await tg.answerCallbackQuery(cq.id);
    await showMainMenu(db, tg, chat_id, user, message_id);
    return;
  }
  if (data === 'menu:grades') {
    await tg.answerCallbackQuery(cq.id);
    await startGradesQuery(db, tg, chat_id, user, message_id);
    return;
  }

  // === grade:tog:SEMESTER | grade:show ===
  if (data.startsWith('grade:tog:')) {
    const sem = decodeURIComponent(data.substring('grade:tog:'.length));
    await handleGradesToggle(db, tg, user, sem, cq.id, message_id);
    return;
  }
  if (data === 'grade:show') {
    await handleGradesShow(db, tg, user, cq.id, message_id);
    return;
  }
  if (data === 'grade:show_all') {
    await handleGradesShowAll(db, tg, user, cq.id, message_id);
    return;
  }
  if (data === 'grade:toggle_all') {
    await handleGradesToggleAll(db, tg, user, cq.id, message_id);
    return;
  }
  if (data === 'menu:curriculum') {
    await tg.answerCallbackQuery(cq.id);
    await showCurriculumLevels(tg, chat_id, message_id, db);
    return;
  }
  if (data === 'menu:about') {
    await tg.answerCallbackQuery(cq.id);
    await showAbout(db, tg, chat_id, message_id);
    return;
  }
  if (data === 'menu:contact') {
    await tg.answerCallbackQuery(cq.id);
    await showContact(db, tg, chat_id, message_id);
    return;
  }
  if (data === 'menu:question') {
    await tg.answerCallbackQuery(cq.id);
    await startRequest(db, tg, chat_id, user, 'question', message_id);
    return;
  }
  if (data === 'menu:request') {
    await tg.answerCallbackQuery(cq.id);
    await startRequest(db, tg, chat_id, user, 'request', message_id);
    return;
  }

  // === curr:lvl:LEVEL — اختيار مستوى → عرض اختيار الفصل ===
  if (data.startsWith('curr:lvl:')) {
    const level = decodeURIComponent(data.substring('curr:lvl:'.length));
    // الرد على الزر فوراً لإيقاف "spinner" التحميل في الواجهة
    try { await tg.answerCallbackQuery(cq.id, '⏳ جاري التحميل...'); } catch (_) {}
    try {
      await showCurriculumSemesterChoice(db, tg, chat_id, level, message_id);
    } catch (e: any) {
      console.error('showCurriculumSemesterChoice error:', e?.message || e);
      // كحل أخير، نرسل رسالة بدائل بسيطة لمنع تعليق المستخدم
      try {
        await tg.sendMessage(
          chat_id,
          await getBotText(
            db,
            'curriculum_level_load_error',
            {},
            'تعذّر تحميل فصول المستوى. يرجى المحاولة لاحقاً.'
          ),
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'رجوع للمستويات', callback_data: 'menu:curriculum' }],
                [{ text: 'القائمة الرئيسية', callback_data: 'menu:main' }],
              ],
            },
          }
        );
      } catch (_) {}
    }
    return;
  }

  // === curr:sem:LEVEL:SEMESTER — اختيار فصل → عرض المواد ===
  if (data.startsWith('curr:sem:')) {
    const rest = data.substring('curr:sem:'.length);
    const idx = rest.lastIndexOf(':');
    try { await tg.answerCallbackQuery(cq.id, '⏳ جاري التحميل...'); } catch (_) {}
    if (idx > 0) {
      const level = decodeURIComponent(rest.substring(0, idx));
      const semester = decodeURIComponent(rest.substring(idx + 1));
      try {
        await showCurriculumLevel(db, tg, chat_id, level, semester, message_id);
      } catch (e: any) {
        console.error('showCurriculumLevel error:', e?.message || e);
        try {
          await tg.sendMessage(
            chat_id,
            await getBotText(
              db,
              'curriculum_semester_load_error',
              {},
              'تعذّر تحميل مواد الفصل. يرجى المحاولة لاحقاً.'
            ),
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'رجوع لاختيار الفصل', callback_data: `curr:back-sem:${encodeURIComponent(level)}` }],
                  [{ text: 'القائمة الرئيسية', callback_data: 'menu:main' }],
                ],
              },
            }
          );
        } catch (_) {}
      }
    }
    return;
  }

  // === curr:sub:LEVEL:SEMESTER — رجوع للمواد من تفاصيل مادة ===
  if (data.startsWith('curr:sub:')) {
    const rest = data.substring('curr:sub:'.length);
    const idx = rest.lastIndexOf(':');
    if (idx > 0) {
      const level = decodeURIComponent(rest.substring(0, idx));
      const semester = decodeURIComponent(rest.substring(idx + 1));
      await tg.answerCallbackQuery(cq.id);
      await showCurriculumLevel(db, tg, chat_id, level, semester, message_id);
    } else {
      await tg.answerCallbackQuery(cq.id);
    }
    return;
  }

  // === curr:back-sem:LEVEL — رجوع لاختيار الفصل ===
  if (data.startsWith('curr:back-sem:')) {
    const level = decodeURIComponent(data.substring('curr:back-sem:'.length));
    await tg.answerCallbackQuery(cq.id);
    await showCurriculumSemesterChoice(db, tg, chat_id, level, message_id);
    return;
  }

  // === curr:item:ID ===
  if (data.startsWith('curr:item:')) {
    const id = Number(data.substring('curr:item:'.length));
    await tg.answerCallbackQuery(cq.id);
    await showCurriculumItem(db, tg, chat_id, id, message_id);
    return;
  }

  // === join:is_student:yes|no ===
  if (data.startsWith('join:is_student:')) {
    const ans = data.split(':')[2] as 'yes' | 'no';
    await handleIsStudentAnswer(db, tg, user, ans, cq.id, message_id);
    return;
  }

  // === join:level:LEVEL ===
  if (data.startsWith('join:level:')) {
    const level = data.substring('join:level:'.length);
    await handleLevelChoice(db, tg, user, level, cq.id, message_id);
    return;
  }

  // === dec:DECISION:STUDENT_ID:GROUP_ID ===
  if (data.startsWith('dec:')) {
    if (!(await isAdmin(db, user.id))) {
      await tg.answerCallbackQuery(cq.id, '⛔️ صلاحية للمالك فقط', true);
      return;
    }
    const parts = data.split(':');
    const decision = parts[1] as 'approve' | 'hold' | 'reject';
    const student_id = Number(parts[2]);
    const group_chat_id = Number(parts[3]);
    await handleOwnerDecision(db, tg, decision, student_id, group_chat_id, cq.id, chat_id, message_id, user);
    return;
  }

  // === admin:stats ===
  if (data === 'admin:stats') {
    if (!(await isAdmin(db, user.id))) {
      await tg.answerCallbackQuery(cq.id, '⛔️ صلاحية للمالك فقط', true);
      return;
    }
    await tg.answerCallbackQuery(cq.id);
    await sendStats(db, tg, chat_id);
    return;
  }

  // === req:reply:ID | req:close:ID ===
  if (data.startsWith('req:')) {
    if (!(await isAdmin(db, user.id))) {
      await tg.answerCallbackQuery(cq.id, '⛔️ صلاحية للمالك فقط', true);
      return;
    }
    const [, action, idStr] = data.split(':');
    const req_id = Number(idStr);
    if (action === 'close') {
      // جلب بيانات الطلب قبل الإغلاق لمعرفة نوعه
      const reqInfo: any = await db.prepare('SELECT type, content FROM requests WHERE id = ?').bind(req_id).first();
      await db.prepare("UPDATE requests SET status='closed', updated_at=CURRENT_TIMESTAMP WHERE id = ?").bind(req_id).run();
      await tg.answerCallbackQuery(cq.id, '✅ تم إغلاق الطلب');
      try {
        await tg.editMessageReplyMarkup(chat_id, message_id, { inline_keyboard: [] });
      } catch (_) {}
      // إعلام بقية المشرفين
      try {
        const requestType = reqInfo?.type === 'question' ? 'question' : 'request';
        const summary = reqInfo?.content?.substring(0, 80) || `#${req_id}`;
        await notifyHandledByAdmin(db, tg, {
          event_type: requestType,
          event_ref_id: req_id,
          handled_by_telegram_id: user.id,
          handled_by_name: user.first_name || user.username || `#${user.id}`,
          summary: `إغلاق ${requestType === 'question' ? 'سؤال' : 'طلب'} #${req_id}: ${summary}`,
        });
      } catch (_) {}
      return;
    }
    if (action === 'reply') {
      await tg.answerCallbackQuery(cq.id);
      await setSetting(db, `pending_admin_reply_${user.id}`, String(req_id));
      await tg.sendMessage(
        user.id,
        await getBotText(
          db,
          'reply_prompt',
          { request_id: String(req_id) },
          `<b>الرد على الطلب رقم ${req_id}</b>\n\nاكتب الآن نص الرد وسيتم إرساله إلى المستخدم.\n\nأرسل /cancel للإلغاء.`
        )
      );
      return;
    }
  }

  // افتراضي
  await tg.answerCallbackQuery(cq.id);
}

let _meCache: any = null;
async function getMe(tg: Telegram) {
  if (_meCache) return _meCache;
  try {
    _meCache = await tg.getMe();
  } catch (_) {
    _meCache = { username: 'bot' };
  }
  return _meCache;
}

async function getPanelUrl(db: D1Database): Promise<string> {
  const url = (await getSetting(db, 'panel_url')) || 'https://webapp.pages.dev/admin';
  return url;
}

async function sendStats(db: D1Database, tg: Telegram, chat_id: number) {
  const groupsCount: any = await db.prepare('SELECT COUNT(*) AS c FROM groups WHERE is_active=1').first();
  const studentsCount: any = await db.prepare('SELECT COUNT(*) AS c FROM students').first();
  const approvedCount: any = await db.prepare("SELECT COUNT(*) AS c FROM students WHERE status='approved'").first();
  const pendingCount: any = await db.prepare("SELECT COUNT(*) AS c FROM students WHERE status='pending'").first();
  const requestsCount: any = await db.prepare("SELECT COUNT(*) AS c FROM requests WHERE status='pending'").first();
  const repliesCount: any = await db.prepare('SELECT COUNT(*) AS c FROM auto_replies WHERE is_active=1').first();
  const banned: any = await db.prepare('SELECT COUNT(*) AS c FROM banned_words').first();

  const vars = {
    groups: String(groupsCount?.c || 0),
    students: String(studentsCount?.c || 0),
    approved: String(approvedCount?.c || 0),
    pending: String(pendingCount?.c || 0),
    requests: String(requestsCount?.c || 0),
    auto_replies: String(repliesCount?.c || 0),
    banned: String(banned?.c || 0),
  };
  await tg.sendMessage(
    chat_id,
    await getBotText(
      db,
      'stats_card',
      vars,
      `<b>إحصائيات البوت</b>\n\n• المجموعات النشطة: <b>${vars.groups}</b>\n• إجمالي الطلاب: <b>${vars.students}</b>\n• موافق عليهم: <b>${vars.approved}</b>\n• بانتظار الموافقة: <b>${vars.pending}</b>\n• طلبات معلقة: <b>${vars.requests}</b>\n• ردود تلقائية: <b>${vars.auto_replies}</b>\n• كلمات محظورة: <b>${vars.banned}</b>`
    )
  );
}
