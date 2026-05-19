// ============================================
// تدفق التحقق من الأعضاء الجدد (Join Flow)
// ============================================

import { Telegram, TgUser, getDisplayName, getFullName, escapeHtml } from '../utils/telegram';
import { getSetting, getSettings, logActivity } from '../utils/db';
import { getBotText } from '../utils/texts';
import { LEVELS, levelsKeyboard, yesNoKeyboard, ownerDecisionKeyboard } from './keyboards';
import { notifyAdmins, notifyHandledByAdmin } from '../utils/notifications';

// بدء جلسة الانضمام: السؤال الأول
export async function startJoinFlow(
  db: D1Database,
  tg: Telegram,
  user: TgUser,
  group_chat_id: number | null
) {
  // إنشاء أو تحديث جلسة الانضمام
  await db
    .prepare(
      `INSERT INTO join_sessions (telegram_user_id, group_id, step) VALUES (?, ?, 'is_student')
       ON CONFLICT(telegram_user_id, group_id) DO UPDATE SET step='is_student', updated_at=CURRENT_TIMESTAMP`
    )
    .bind(user.id, group_chat_id || 0)
    .run();

  const settings = await getSettings(db);
  const college = escapeHtml(settings.college_name || 'كلية الصماد للقرآن الكريم');
  const text = await getBotText(
    db,
    'join_welcome',
    { college },
    `🌹 <b>السلام عليكم ورحمة الله وبركاته</b>\n\nأهلاً بك في <b>${college}</b>\n\nقبل الموافقة على طلب انضمامك، نحتاج التحقق من بعض المعلومات.\n\n<b>السؤال الأول:</b>\n❓ هل أنت طالب في الكلية؟`
  );

  await tg.sendMessage(user.id, text, {
    reply_markup: yesNoKeyboard('join:is_student'),
  });
}

// معالجة إجابة "هل أنت طالب؟"
export async function handleIsStudentAnswer(
  db: D1Database,
  tg: Telegram,
  user: TgUser,
  answer: 'yes' | 'no',
  callback_query_id: string,
  message_id: number
) {
  await tg.answerCallbackQuery(callback_query_id);

  const session: any = await db
    .prepare('SELECT * FROM join_sessions WHERE telegram_user_id = ? ORDER BY id DESC LIMIT 1')
    .bind(user.id)
    .first();

  if (!session) {
    const msg = await getBotText(db, 'join_session_not_found', {}, '⚠️ لم يتم العثور على جلسة. يرجى إعادة طلب الانضمام.');
    await tg.sendMessage(user.id, msg);
    return;
  }

  if (answer === 'no') {
    // تحديث الجلسة وإرسال طلب للمالك
    await db
      .prepare("UPDATE join_sessions SET is_student=0, step='not_student', updated_at=CURRENT_TIMESTAMP WHERE id = ?")
      .bind(session.id)
      .run();

    const userMsg = await getBotText(
      db,
      'join_not_student_user',
      {},
      `📩 <b>شكراً لتواصلك معنا</b>\n\nسنقوم بإرسال طلبك إلى مالك المجموعة لمراجعته. سيتم التواصل معك في أقرب وقت إن شاء الله.`
    );
    await tg.editMessageText(user.id, message_id, userMsg);

    // إرسال للمالك وكل المشرفين المعنيين
    const display = getDisplayName(user);
    const full = getFullName(user);
    const ownerMsg = await getBotText(
      db,
      'join_not_student_owner',
      {
        full_name: escapeHtml(full),
        user_id: String(user.id),
        display: escapeHtml(display),
      },
      `📨 <b>طلب انضمام من شخص ليس طالباً في الكلية</b>\n\n👤 الاسم: <b>${escapeHtml(full)}</b>\n🆔 المعرف: <code>${user.id}</code>\n🔗 المستخدم: ${escapeHtml(display)}\n\nيرجى مراجعة الطلب والتواصل مع المستخدم إذا رغبت بالموافقة.`
    );
    const openBtn = await getBotText(db, 'btn_open_user_chat', {}, '💬 فتح محادثة مع المستخدم');
    await notifyAdmins(db, tg, {
      event_type: 'join_not_student',
      event_ref_id: user.id,
      title: '📨 طلب انضمام (ليس طالباً)',
      body: `${full} يطلب الانضمام (ليس طالباً)`,
      telegram_html: ownerMsg,
      telegram_reply_markup: {
        inline_keyboard: [[{ text: openBtn, url: `tg://user?id=${user.id}` }]],
      },
      url: '/admin/dashboard#students',
    });
    return;
  }

  // نعم - متابعة لسؤال المستوى
  await db
    .prepare("UPDATE join_sessions SET is_student=1, step='level', updated_at=CURRENT_TIMESTAMP WHERE id = ?")
    .bind(session.id)
    .run();

  const askLevelText = await getBotText(
    db,
    'join_ask_level',
    {},
    `🌹 <b>حياك الله أخي الطالب</b>\n\n📚 <b>ما هو المستوى الأكاديمي الذي تدرس فيه الآن؟</b>`
  );
  await tg.editMessageText(user.id, message_id, askLevelText, {
    reply_markup: {
      inline_keyboard: LEVELS.map((lvl) => [
        { text: `📖 المستوى ${lvl}`, callback_data: `join:level:${lvl}` },
      ]),
    },
  });
}

// معالجة اختيار المستوى
export async function handleLevelChoice(
  db: D1Database,
  tg: Telegram,
  user: TgUser,
  level: string,
  callback_query_id: string,
  message_id: number
) {
  await tg.answerCallbackQuery(callback_query_id, `تم اختيار المستوى ${level}`);

  await db
    .prepare(
      "UPDATE join_sessions SET level=?, step='data', updated_at=CURRENT_TIMESTAMP WHERE telegram_user_id = ?"
    )
    .bind(level, user.id)
    .run();

  const dataRequestText = await getBotText(
    db,
    'join_data_request',
    { level: escapeHtml(level) },
    `✅ تم اختيار: <b>المستوى ${escapeHtml(level)}</b>\n\n🌹 <b>حياك الله عزيزي الطالب</b>\n\n📋 ممكن ترسل لنا بياناتك التالية في رسالة واحدة:\n\n1️⃣ <b>الرقم الأكاديمي</b>\n2️⃣ <b>الاسم كاملاً</b>\n3️⃣ <b>رقم هاتفك</b> (يُستخدم للتواصل في الأمور الأكاديمية)\n\n<i>يمكنك إرسالها كالتالي:</i>\n<code>الرقم الأكاديمي: 12345\nالاسم: محمد أحمد علي\nالهاتف: 967xxxxxxxxx</code>`
  );
  await tg.editMessageText(user.id, message_id, dataRequestText);
}

// معالجة إرسال البيانات النصية من الطالب
export async function handleStudentData(
  db: D1Database,
  tg: Telegram,
  user: TgUser,
  text: string
): Promise<boolean> {
  // البحث عن جلسة في خطوة "data"
  const session: any = await db
    .prepare(
      "SELECT * FROM join_sessions WHERE telegram_user_id = ? AND step = 'data' ORDER BY id DESC LIMIT 1"
    )
    .bind(user.id)
    .first();

  if (!session) return false;

  // محاولة استخراج البيانات
  const lines = text.split(/\n|،|,/).map((l) => l.trim()).filter(Boolean);
  let academic_id = '';
  let full_name = '';
  let phone = '';

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/الرقم|أكاديمي|اكاديمي|academic|id/i.test(line)) {
      const m = line.match(/(\d+)/);
      if (m) academic_id = m[1];
    } else if (/الاسم|اسم|name/i.test(line)) {
      full_name = line.replace(/^[^:：]*[:：]\s*/, '').trim();
    } else if (/هاتف|جوال|رقم|phone|tel/i.test(line) && /\d/.test(line)) {
      const m = line.match(/[\d+\-\s]{7,}/);
      if (m) phone = m[0].replace(/\s/g, '');
    }
  }

  // إذا لم يتم استخراج البيانات بشكل سطور، جرب التحليل العام
  if (!academic_id || !full_name || !phone) {
    const numbers = text.match(/\d+/g) || [];
    if (numbers.length >= 1 && !academic_id) academic_id = numbers[0];
    if (numbers.length >= 2 && !phone) {
      // أطول رقم على الأرجح هو الهاتف
      phone = numbers.reduce((a, b) => (b.length > a.length ? b : a), '');
    }
    if (!full_name) {
      // الاسم على الأرجح هو النص بدون أرقام
      const nonNumeric = text
        .replace(/\d+/g, '')
        .replace(/[:：،,\n]/g, ' ')
        .replace(/(الرقم|أكاديمي|اكاديمي|الاسم|اسم|هاتف|جوال|الهاتف|رقم)/gi, '')
        .trim();
      if (nonNumeric.length > 2) full_name = nonNumeric.replace(/\s+/g, ' ');
    }
  }

  if (!academic_id || !full_name || !phone) {
    const parseFailed = await getBotText(
      db,
      'join_data_parse_failed',
      {},
      `⚠️ <b>لم نتمكن من استخراج جميع البيانات</b>\n\nيرجى إعادة الإرسال بالصيغة التالية:\n\n<code>الرقم الأكاديمي: 12345\nالاسم: محمد أحمد علي\nالهاتف: 967xxxxxxxxx</code>`
    );
    await tg.sendMessage(user.id, parseFailed);
    return true;
  }

  // حفظ البيانات وتحديث الجلسة
  await db
    .prepare(
      `UPDATE join_sessions SET full_name=?, academic_id=?, phone=?, raw_data=?, step='completed', updated_at=CURRENT_TIMESTAMP WHERE id = ?`
    )
    .bind(full_name, academic_id, phone, text, session.id)
    .run();

  // إنشاء/تحديث سجل الطالب
  await db
    .prepare(
      `INSERT INTO students (telegram_user_id, username, display_name, full_name, academic_id, phone, level, status, group_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
       ON CONFLICT(telegram_user_id, group_id) DO UPDATE SET
         username=excluded.username,
         display_name=excluded.display_name,
         full_name=excluded.full_name,
         academic_id=excluded.academic_id,
         phone=excluded.phone,
         level=excluded.level,
         status='pending'`
    )
    .bind(
      user.id,
      user.username || null,
      getDisplayName(user),
      full_name,
      academic_id,
      phone,
      session.level,
      session.group_id || 0
    )
    .run();

  // محاولة الموافقة على طلب الانضمام للمجموعة وتقييد العضو (Read-only)
  let added_to_group = false;
  if (session.group_id && session.group_id !== 0) {
    try {
      await tg.approveChatJoinRequest(session.group_id, user.id);
      added_to_group = true;

      // تقييد العضو - يستطيع القراءة فقط (لا يستطيع الإرسال)
      await tg.restrictChatMember(session.group_id, user.id, {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
      });
    } catch (e) {
      console.error('approve/restrict error:', e);
    }
  }

  // رسالة شكر للطالب
  const studentMsgVars = {
    academic_id: escapeHtml(academic_id),
    full_name: escapeHtml(full_name),
    phone: escapeHtml(phone),
    level: escapeHtml(session.level || ''),
  };
  const studentMsg = added_to_group
    ? await getBotText(
        db,
        'join_data_received_added',
        studentMsgVars,
        `✅ <b>شكراً لك على إرسال بياناتك</b>\n\n📋 <b>البيانات المستلمة:</b>\n▫️ الرقم الأكاديمي: <code>${escapeHtml(academic_id)}</code>\n▫️ الاسم: <b>${escapeHtml(full_name)}</b>\n▫️ الهاتف: <code>${escapeHtml(phone)}</code>\n▫️ المستوى: <b>${escapeHtml(session.level || '')}</b>\n\n🎉 <b>تمت إضافتك إلى المجموعة بنجاح</b>\n\n📖 يمكنك الآن الاطلاع على المحتوى. سيتم تفعيل صلاحيات المراسلة بعد موافقة المالك على بياناتك.`
      )
    : await getBotText(
        db,
        'join_data_received_pending',
        studentMsgVars,
        `✅ <b>شكراً لك على إرسال بياناتك</b>\n\n📋 <b>البيانات المستلمة:</b>\n▫️ الرقم الأكاديمي: <code>${escapeHtml(academic_id)}</code>\n▫️ الاسم: <b>${escapeHtml(full_name)}</b>\n▫️ الهاتف: <code>${escapeHtml(phone)}</code>\n▫️ المستوى: <b>${escapeHtml(session.level || '')}</b>\n\n⏳ سيتم مراجعة طلبك من قبل المالك في أقرب وقت إن شاء الله.`
      );
  await tg.sendMessage(user.id, studentMsg);

  // إرسال البيانات لكل المشرفين المعنيين مع أزرار القرار
  {
    const display = getDisplayName(user);
    const ownerVars = {
      full_name: escapeHtml(full_name),
      academic_id: escapeHtml(academic_id),
      level: escapeHtml(session.level || ''),
      phone: escapeHtml(phone),
      display: escapeHtml(display),
      user_id: String(user.id),
    };
    const ownerKey = added_to_group ? 'join_owner_new_student_added' : 'join_owner_new_student_pending';
    const fallbackAddedLine = added_to_group
      ? `✅ <b>وقد تم إضافته إلى المجموعة بدون صلاحيات المراسلة</b>\n\n`
      : `⏳ <b>لم تتم إضافته بعد للمجموعة</b>\n\n`;
    const ownerMsg = await getBotText(
      db,
      ownerKey,
      ownerVars,
      `📨 <b>طلب انضمام طالب جديد</b>\n\nتقدم الطالب <b>${escapeHtml(full_name)}</b> صاحب الرقم الأكاديمي <code>${escapeHtml(academic_id)}</code> الذي يدرس هذه السنة في <b>المستوى الأكاديمي ${escapeHtml(session.level || '')}</b>\n\n📞 وهذا رقمه الذي أرسله للتواصل معه: <code>${escapeHtml(phone)}</code>\n\n${fallbackAddedLine}🔗 معرف تلجرام: ${escapeHtml(display)} (<code>${user.id}</code>)\n\n<b>أرجو منك التحقق من البيانات واختيار ما يناسب:</b>`
    );

    await notifyAdmins(db, tg, {
      event_type: 'join_request',
      event_ref_id: user.id,
      title: '🎓 طلب انضمام جديد',
      body: `${full_name} — مستوى ${session.level || ''} — رقم ${academic_id}`,
      telegram_html: ownerMsg,
      telegram_reply_markup: ownerDecisionKeyboard(user.id, session.group_id || 0),
      url: '/admin/dashboard#students',
    });
  }

  await logActivity(db, 'join_data_submitted', `User ${user.id} submitted data`, user.id);
  return true;
}

// معالجة قرار المالك
export async function handleOwnerDecision(
  db: D1Database,
  tg: Telegram,
  decision: 'approve' | 'hold' | 'reject',
  student_user_id: number,
  group_chat_id: number,
  callback_query_id: string,
  owner_chat_id: number,
  owner_message_id: number,
  acting_admin?: TgUser
) {
  const owner_contact_url = (await getSetting(db, 'owner_contact_url')) || '';
  const owner_username = (await getSetting(db, 'owner_username')) || '';
  const contact_link = owner_contact_url || (owner_username ? `https://t.me/${owner_username.replace('@', '')}` : '');

  const student: any = await db
    .prepare('SELECT * FROM students WHERE telegram_user_id = ? AND group_id = ?')
    .bind(student_user_id, group_chat_id)
    .first();

  if (decision === 'approve') {
    // فتح صلاحيات المراسلة
    if (group_chat_id) {
      try {
        await tg.restrictChatMember(group_chat_id, student_user_id, {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
        });
      } catch (e) {
        console.error('approve restrict error:', e);
      }
    }

    await db
      .prepare("UPDATE students SET status='approved', approved_at=CURRENT_TIMESTAMP WHERE telegram_user_id=? AND group_id=?")
      .bind(student_user_id, group_chat_id)
      .run();

    await tg.answerCallbackQuery(callback_query_id, '✅ تمت الموافقة وتفعيل الصلاحيات');

    const fullName = escapeHtml(student?.full_name || '');
    const ownerApprovedMsg = await getBotText(
      db,
      'join_approved_owner_msg',
      { full_name: fullName },
      `✅ <b>تمت الموافقة</b>\n\nتم تفعيل صلاحيات المراسلة للطالب <b>${fullName}</b>.`
    );
    await tg.editMessageText(owner_chat_id, owner_message_id, ownerApprovedMsg);

    // إعلام الطالب
    const collegeName = escapeHtml((await getSetting(db, 'college_name')) || 'كلية الصماد للقرآن الكريم');
    const userApprovedMsg = await getBotText(
      db,
      'join_approved_user',
      { college: collegeName },
      `🎉 <b>تهانينا!</b>\n\nتمت الموافقة على بياناتك وتم تفعيل صلاحيات المراسلة في المجموعة.\n\n📖 بارك الله فيك وفي دراستك في <b>${collegeName}</b>.`
    );
    await tg.sendMessage(student_user_id, userApprovedMsg);

    await logActivity(db, 'student_approved', `Student ${student_user_id} approved`, student_user_id);
  } else if (decision === 'hold') {
    await db
      .prepare("UPDATE students SET status='restricted' WHERE telegram_user_id=? AND group_id=?")
      .bind(student_user_id, group_chat_id)
      .run();

    await tg.answerCallbackQuery(callback_query_id, '⏸️ تم الإيقاف، سيتم إعلام الطالب');

    const ownerHeldMsg = await getBotText(
      db,
      'join_held_owner_msg',
      {},
      `⏸️ <b>تم تأجيل الموافقة</b>\n\nتم إعلام الطالب بضرورة التواصل معك.`
    );
    await tg.editMessageText(owner_chat_id, owner_message_id, ownerHeldMsg);

    const contactBtnText = await getBotText(db, 'btn_contact_owner', {}, '💬 تواصل مع المالك');
    const contactBtn = contact_link
      ? { reply_markup: { inline_keyboard: [[{ text: contactBtnText, url: contact_link }]] } }
      : {};

    const userHeldMsg = await getBotText(
      db,
      'join_held_user',
      {},
      `⏸️ <b>عزيزي الطالب</b>\n\nلم يتم الموافقة على تفعيل المراسلة في القناة بعد. يرجى التواصل مع المالك للحصول على الموافقة.`
    );
    await tg.sendMessage(student_user_id, userHeldMsg, contactBtn);
  } else if (decision === 'reject') {
    // إزالة من المجموعة
    if (group_chat_id) {
      try {
        await tg.banChatMember(group_chat_id, student_user_id);
        // إزالة الحظر فوراً ليتمكن من العودة لاحقاً
        await tg.unbanChatMember(group_chat_id, student_user_id);
      } catch (e) {
        console.error('reject ban error:', e);
      }
    }

    await db
      .prepare("UPDATE students SET status='rejected' WHERE telegram_user_id=? AND group_id=?")
      .bind(student_user_id, group_chat_id)
      .run();

    await tg.answerCallbackQuery(callback_query_id, '🚫 تمت الإزالة من المجموعة');

    const ownerRejectedMsg = await getBotText(
      db,
      'join_rejected_owner_msg',
      {},
      `🚫 <b>تم رفض الطلب</b>\n\nتم إزالة الطالب من المجموعة وإرسال رسالة اعتذار له.`
    );
    await tg.editMessageText(owner_chat_id, owner_message_id, ownerRejectedMsg);

    const contactBtnText2 = await getBotText(db, 'btn_contact_owner', {}, '💬 تواصل مع المالك');
    const contactBtn = contact_link
      ? { reply_markup: { inline_keyboard: [[{ text: contactBtnText2, url: contact_link }]] } }
      : {};

    const userRejectedMsg = await getBotText(
      db,
      'join_rejected_user',
      {},
      `🙏 <b>نعتذر منك</b>\n\nتم إزالتك من المجموعة لأن البيانات التي أرسلتها غير صحيحة أو غير مطابقة.\n\nيرجى التواصل مع المالك إذا كنت تعتقد أن هذا خطأ.`
    );
    await tg.sendMessage(student_user_id, userRejectedMsg, contactBtn);
  }

  // === إعلام بقية المشرفين بأن مشرفاً قد تعامل مع الطلب ===
  if (acting_admin) {
    const decisionLabel =
      decision === 'approve' ? '✅ موافقة'
      : decision === 'hold' ? '⏸️ تأجيل'
      : '🚫 رفض';
    const adminName = getDisplayName(acting_admin);
    const studentName = student?.full_name || `#${student_user_id}`;
    try {
      await notifyHandledByAdmin(db, tg, {
        event_type: 'join_request',
        event_ref_id: student_user_id,
        handled_by_telegram_id: acting_admin.id,
        handled_by_name: adminName,
        summary: `طلب انضمام الطالب ${studentName} — ${decisionLabel}`,
      });
    } catch (_) {}
  }
}
