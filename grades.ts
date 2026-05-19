// ============================================
// نظام الاستعلام عن الدرجات
// مشتق من ملف بايثون الأصلي وتم تحويله للعمل على Cloudflare Workers + D1
// ============================================

import { Telegram, TgUser, escapeHtml } from '../utils/telegram';
import { getSetting, isAdmin } from '../utils/db';
import { getBotText } from '../utils/texts';

export interface GradeRow {
  id: number;
  academic_id: string;
  student_name: string;
  college: string;
  level: string;
  semester: string;
  subject_name: string;
  attendance_score: number;
  participation_score: number;
  assignments_score: number;
  midterm_score: number;
  final_score: number;
  total_score: number;
  grade_label: string;
  credit_hours: number;
  is_remaining: number;
  // حقول إضافية (موسعة)
  secret_code?: string;
  branch_name?: string;
  academic_year?: string;
  specialization?: string;
  group_name?: string;
  theory_midterm?: number;
  practical_midterm?: number;
  theory_final?: number;
  practical_final?: number;
  oral_recitation_mid?: number;
  oral_memorize_mid?: number;
  oral_recitation_final?: number;
  oral_memorize_final?: number;
  promotion_status?: string;
  bitdaragat3?: string;
  passing_score?: number;
  follows_quran?: string;
}

// حساب المعدل المرجّح
export function calculateWeightedGpa(rows: GradeRow[]): { total: number; avg: number; grade: string } {
  let totalWeighted = 0;
  let totalHours = 0;
  for (const r of rows) {
    const hours = Number(r.credit_hours) || 1;
    const total = Number(r.total_score) || 0;
    const percent = (total / (hours * 100)) * 100;
    totalWeighted += percent * hours;
    totalHours += hours;
  }
  const avg = totalHours > 0 ? totalWeighted / totalHours : 0;
  let grade = 'راسب';
  if (avg >= 90) grade = 'ممتاز';
  else if (avg >= 80) grade = 'جيد جداً';
  else if (avg >= 70) grade = 'جيد';
  else if (avg >= 60) grade = 'مقبول';
  else if (avg >= 50) grade = 'ضعيف';
  return {
    total: Math.round(totalWeighted * 100) / 100,
    avg: Math.round(avg * 100) / 100,
    grade,
  };
}

// تلخيص حالة النقل (مبقي)
export function summarizeTransferStatus(rows: GradeRow[]): string | null {
  const remaining = rows.filter((r) => r.is_remaining);
  let totalHours = 0;
  for (const r of remaining) totalHours += Number(r.credit_hours) || 1;
  if (totalHours === 0) return null;
  const count = Math.floor(totalHours);
  if (totalHours <= 5) {
    return count === 1 ? `منقول بـ 1 مادة` : `منقول بـ ${count} مواد`;
  }
  return 'باقي للإعادة';
}

// قائمة الفصول المسموحة (للمستخدمين العاديين)
async function getAllowedSemesters(db: D1Database): Promise<string[]> {
  try {
    const { results } = await db
      .prepare('SELECT semester FROM allowed_semesters WHERE is_allowed = 1')
      .all();
    return ((results as any[]) || []).map((r) => r.semester);
  } catch (_) {
    return [];
  }
}

// بدء عملية الاستعلام عن الدرجات
export async function startGradesQuery(
  db: D1Database,
  tg: Telegram,
  chat_id: number,
  user: TgUser,
  edit_message_id?: number
) {
  // الاستعلام يجب أن يكون في الخاص لخصوصية الدرجات
  if (chat_id !== user.id) {
    const me = await tg.getMe().catch(() => ({ username: 'bot' } as any));
    const startUrl = `https://t.me/${me?.username || 'bot'}?start=grades`;
    const text = await getBotText(
      db,
      'grades_private_only',
      {},
      `📊 <b>الاستعلام عن الدرجات</b>\n\nلخصوصية بياناتك، يرجى فتح محادثة خاصة مع البوت لإكمال الاستعلام.`
    );
    const kb = {
      inline_keyboard: [
        [{ text: '✉️ افتح المحادثة الخاصة', url: startUrl }],
        [{ text: '🔙 القائمة', callback_data: 'menu:main' }],
      ],
    };
    if (edit_message_id) {
      try {
        await tg.editMessageText(chat_id, edit_message_id, text, { reply_markup: kb });
        return;
      } catch (_) {}
    }
    await tg.sendMessage(chat_id, text, { reply_markup: kb });
    return;
  }

  // وضع المستخدم في حالة "بانتظار الرقم الأكاديمي"
  try {
    await db
      .prepare(
        `INSERT INTO grades_sessions (telegram_user_id, step, academic_id, selected_semesters, available_semesters, updated_at)
         VALUES (?, 'waiting_academic_id', NULL, '[]', '[]', CURRENT_TIMESTAMP)
         ON CONFLICT(telegram_user_id) DO UPDATE SET
           step='waiting_academic_id',
           academic_id=NULL,
           selected_semesters='[]',
           available_semesters='[]',
           updated_at=CURRENT_TIMESTAMP`
      )
      .bind(user.id)
      .run();
  } catch (e: any) {
    console.error('grades_sessions init failed:', e?.message || e);
    // محاولة بديلة: حذف ثم إدراج
    try {
      await db.prepare('DELETE FROM grades_sessions WHERE telegram_user_id = ?').bind(user.id).run();
      await db
        .prepare(
          `INSERT INTO grades_sessions (telegram_user_id, step, selected_semesters, available_semesters)
           VALUES (?, 'waiting_academic_id', '[]', '[]')`
        )
        .bind(user.id)
        .run();
    } catch (e2: any) {
      console.error('grades_sessions fallback init failed:', e2?.message || e2);
    }
  }

  // الأولوية الآن لـ bot_texts (محرر النصوص في اللوحة)
  // مع الإبقاء على grades_intro_message في bot_settings كتوافق رجعي فقط
  const introFromTexts = await getBotText(db, 'grades_intro', {}, '');
  const introFromSettings = await getSetting(db, 'grades_intro_message');
  const intro =
    introFromTexts ||
    introFromSettings ||
    '📊 <b>الاستعلام عن الدرجات</b>\n\nمن فضلك أدخل رقمك الأكاديمي للاطلاع على درجاتك:';

  const cancelText = await getBotText(db, 'btn_cancel', {}, '❌ إلغاء');
  const kb = {
    inline_keyboard: [[{ text: cancelText, callback_data: 'menu:main' }]],
  };

  if (edit_message_id) {
    try {
      await tg.editMessageText(chat_id, edit_message_id, intro, { reply_markup: kb });
      return;
    } catch (_) {}
  }
  await tg.sendMessage(chat_id, intro, { reply_markup: kb });
}

// التحقق من رد المستخدم في حالة "بانتظار الرقم الأكاديمي"
export async function handleGradesText(
  db: D1Database,
  tg: Telegram,
  user: TgUser,
  text: string
): Promise<boolean> {
  let session: any = null;
  try {
    session = await db
      .prepare('SELECT * FROM grades_sessions WHERE telegram_user_id = ?')
      .bind(user.id)
      .first();
  } catch (e) {
    console.error('grades_sessions read error:', e);
  }
  if (!session) return false;

  const trimmed = text.trim();

  if (trimmed === '/cancel' || trimmed === 'إلغاء') {
    try {
      await db.prepare('DELETE FROM grades_sessions WHERE telegram_user_id = ?').bind(user.id).run();
    } catch (_) {}
    try {
      await tg.sendMessage(
        user.id,
        await getBotText(db, 'grades_cancelled', {}, '❌ تم إلغاء عملية الاستعلام.')
      );
    } catch (_) {}
    return true;
  }

  if (session.step === 'waiting_academic_id') {
    // تطبيع الأرقام (دعم الأرقام العربية والفارسية)
    const normalizedDigits = trimmed
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    const academic_id = normalizedDigits.replace(/[\s\-_]/g, '');

    if (!/^[0-9]{3,20}$/.test(academic_id)) {
      try {
        await tg.sendMessage(
          user.id,
          await getBotText(
            db,
            'grades_invalid_id',
            {},
            '⚠️ <b>يجب أن يكون الرقم الأكاديمي أرقاماً فقط.</b>\n\nيرجى إعادة إرسال الرقم بشكل صحيح، أو إرسال /cancel للإلغاء.'
          )
        );
      } catch (e: any) {
        console.error('grades_invalid_id send failed:', e?.message);
      }
      return true;
    }

    // البحث عن سجلات الطالب - دعم صيغ متعددة (مع/بدون أصفار بادئة)
    let results: any[] = [];
    try {
      const variants = Array.from(new Set([
        academic_id,
        academic_id.replace(/^0+/, ''),
        '0' + academic_id,
      ]));
      const placeholders = variants.map(() => '?').join(',');
      const r = await db
        .prepare(`SELECT * FROM grades WHERE academic_id IN (${placeholders})`)
        .bind(...variants)
        .all();
      results = (r.results as any[]) || [];
    } catch (e: any) {
      console.error('grades search error:', e?.message || e);
      try {
        await tg.sendMessage(
          user.id,
          await getBotText(
            db,
            'grades_error',
            {},
            '❌ حدث خطأ أثناء البحث عن بياناتك. يرجى المحاولة لاحقاً أو إرسال /cancel للإلغاء.'
          )
        );
      } catch (_) {}
      return true;
    }

    if (!results || results.length === 0) {
      try {
        await tg.sendMessage(
          user.id,
          await getBotText(
            db,
            'grades_not_found',
            {},
            '❌ <b>لا توجد بيانات لهذا الرقم الأكاديمي.</b>\n\n• تأكد من إدخال الرقم الأكاديمي بشكل صحيح.\n• إذا كنت متأكداً من رقمك، تواصل مع الإدارة.\n\nيمكنك إعادة المحاولة بإرسال الرقم مرة أخرى، أو إرسال /cancel للإلغاء.'
          )
        );
      } catch (e: any) {
        console.error('grades_not_found send failed:', e?.message);
      }
      return true;
    }

    // استخراج الفصول الفريدة (مع تطبيع)
    const allSemesters = Array.from(
      new Set(
        (results as any[])
          .map((r) => (r.semester == null ? '' : String(r.semester).trim()))
          .filter(Boolean)
      )
    ).sort() as string[];

    let semesters = allSemesters;
    let isAdminUser = false;
    try { isAdminUser = await isAdmin(db, user.id); } catch (_) {}

    if (!isAdminUser) {
      const allowed = await getAllowedSemesters(db);
      if (allowed.length > 0) {
        semesters = allSemesters.filter((s) => allowed.includes(s));
        if (semesters.length === 0) semesters = allSemesters;
      }
    }

    if (semesters.length === 0) {
      try {
        await tg.sendMessage(
          user.id,
          await getBotText(
            db,
            'grades_no_semesters',
            {},
            '⚠️ لا توجد فصول دراسية متاحة لعرضها حالياً.\n\nيرجى التواصل مع الإدارة.'
          )
        );
      } catch (_) {}
      try {
        await db.prepare('DELETE FROM grades_sessions WHERE telegram_user_id = ?').bind(user.id).run();
      } catch (_) {}
      return true;
    }

    // الرقم الأكاديمي الفعلي من قاعدة البيانات
    const actualAcademicId = String((results[0] as any).academic_id || academic_id);

    // الانتقال لمرحلة اختيار الفصول
    try {
      await db
        .prepare(
          `UPDATE grades_sessions
           SET step='choosing_semesters',
               academic_id=?,
               available_semesters=?,
               selected_semesters=?,
               updated_at=CURRENT_TIMESTAMP
           WHERE telegram_user_id=?`
        )
        .bind(
          actualAcademicId,
          JSON.stringify(semesters),
          semesters.length === 1 ? JSON.stringify(semesters) : '[]',
          user.id
        )
        .run();
    } catch (e: any) {
      console.error('grades_sessions update failed:', e?.message);
      try {
        await tg.sendMessage(
          user.id,
          '❌ حدث خطأ في حفظ الجلسة. يرجى المحاولة مرة أخرى.'
        );
      } catch (_) {}
      return true;
    }

    // إذا فصل واحد فقط → عرض النتائج مباشرة
    if (semesters.length === 1) {
      await handleGradesShow(db, tg, user, '', 0);
      return true;
    }

    try {
      await sendSemestersKeyboard(db, tg, user.id, semesters, []);
    } catch (e: any) {
      console.error('sendSemestersKeyboard failed:', e?.message || e, 'semesters=', semesters);
      // كحل أخير: نعرض النتائج لكل الفصول مباشرة بدلاً من قائمة اختيار
      try {
        await db
          .prepare(
            `UPDATE grades_sessions SET selected_semesters = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_user_id = ?`
          )
          .bind(JSON.stringify(semesters), user.id)
          .run();
        await tg.sendMessage(
          user.id,
          'سيتم عرض نتائج جميع الفصول لتعذّر عرض قائمة الاختيار…'
        );
        await handleGradesShow(db, tg, user, '', 0);
      } catch (e2: any) {
        console.error('grades fallback show all failed:', e2?.message || e2);
        try {
          await tg.sendMessage(
            user.id,
            '❌ تعذر عرض قائمة الفصول. حاول مجدداً لاحقاً.'
          );
        } catch (_) {}
      }
    }
    return true;
  }

  // إذا كان في مرحلة اختيار الفصول وأرسل نصاً، نوضح له
  if (session.step === 'choosing_semesters') {
    try {
      await tg.sendMessage(
        user.id,
        '👆 يرجى استخدام الأزرار أعلاه لاختيار الفصل الدراسي وعرض النتائج.\n\nأو أرسل /cancel للإلغاء.'
      );
    } catch (_) {}
    return true;
  }

  return false;
}

// إرسال لوحة اختيار الفصول
async function sendSemestersKeyboard(
  db: D1Database,
  tg: Telegram,
  chat_id: number,
  available: string[],
  selected: string[],
  edit_message_id?: number
) {
  // ضمان أن كل القيم نصوص نظيفة وغير فارغة لتفادي أخطاء callback_data
  const cleanAvailable = (available || [])
    .map((s) => (s == null ? '' : String(s).trim()))
    .filter(Boolean);
  const cleanSelected = (selected || [])
    .map((s) => (s == null ? '' : String(s).trim()))
    .filter(Boolean);

  // Telegram callback_data له حد أقصى 64 بايت — نستخدم index بدلاً من النص الكامل
  // لتجنب أي مشكلة عند تشفير الفصول الطويلة
  const rows: any[] = cleanAvailable.map((s, idx) => {
    const isSel = cleanSelected.includes(s);
    return [
      {
        text: `${isSel ? '✅' : '📅'} ${s}`,
        callback_data: `grade:tog:${idx}`,
      },
    ];
  });

  // زر "اختيار/إلغاء كل الفصول"
  const allSelected = cleanAvailable.length > 0 && cleanSelected.length === cleanAvailable.length;
  rows.push([
    {
      text: allSelected ? '◻️ إلغاء اختيار الكل' : '☑️ اختيار كل الفصول',
      callback_data: 'grade:toggle_all',
    },
  ]);
  rows.push([{ text: '📊 عرض كل الفصول', callback_data: 'grade:show_all' }]);
  rows.push([{ text: '📤 عرض النتيجة (المختار)', callback_data: 'grade:show' }]);
  rows.push([{ text: '❌ إلغاء', callback_data: 'menu:main' }]);

  const baseText =
    `📅 <b>اختر الفصل/الفصول التي تريد عرض درجاتها:</b>\n\n` +
    `يمكنك اختيار فصل أو أكثر، ثم اضغط <b>"عرض النتيجة"</b>،\n` +
    `أو اضغط <b>"📊 عرض كل الفصول"</b> مباشرة.\n\n` +
    `<i>المختار حالياً: ${cleanSelected.length} من ${cleanAvailable.length} فصل</i>`;
  let text = baseText;
  try {
    text = await getBotText(
      db,
      'grades_choose_semesters',
      { selected: String(cleanSelected.length), total: String(cleanAvailable.length) },
      baseText
    );
  } catch (_) {}

  const reply_markup = { inline_keyboard: rows };

  if (edit_message_id) {
    try {
      await tg.editMessageText(chat_id, edit_message_id, text, { reply_markup });
      return;
    } catch (_) {
      // ربما الرسالة السابقة لا تقبل التعديل — نرسل جديدة
    }
  }
  try {
    await tg.sendMessage(chat_id, text, { reply_markup });
  } catch (e: any) {
    console.error('sendSemestersKeyboard HTML send failed, retrying plain:', e?.message || e);
    // محاولة بدون HTML لتفادي أخطاء parse_mode
    try {
      await tg.sendMessage(
        chat_id,
        `اختر الفصل الدراسي:\n\nالمختار حالياً: ${cleanSelected.length} من ${cleanAvailable.length}`,
        { reply_markup, parse_mode: undefined }
      );
    } catch (e2: any) {
      console.error('sendSemestersKeyboard plain send failed:', e2?.message || e2);
      throw e2;
    }
  }
}

// اختيار/إلغاء كل الفصول دفعة واحدة
export async function handleGradesToggleAll(
  db: D1Database,
  tg: Telegram,
  user: TgUser,
  cb_id: string,
  message_id: number
) {
  const session: any = await db
    .prepare('SELECT * FROM grades_sessions WHERE telegram_user_id = ?')
    .bind(user.id)
    .first();
  if (!session) {
    await tg.answerCallbackQuery(cb_id, '⚠️ انتهت الجلسة - ابدأ من جديد', true);
    return;
  }
  let available: string[] = [];
  let selected: string[] = [];
  try { available = JSON.parse(session.available_semesters || '[]'); } catch (_) {}
  try { selected = JSON.parse(session.selected_semesters || '[]'); } catch (_) {}
  const allSelected = available.length > 0 && selected.length === available.length;
  selected = allSelected ? [] : [...available];
  await db
    .prepare(
      'UPDATE grades_sessions SET selected_semesters=?, updated_at=CURRENT_TIMESTAMP WHERE telegram_user_id=?'
    )
    .bind(JSON.stringify(selected), user.id)
    .run();
  await tg.answerCallbackQuery(cb_id);
  await sendSemestersKeyboard(db, tg, user.id, available, selected, message_id);
}

// عرض كل الفصول مباشرة (شورت-كت)
export async function handleGradesShowAll(
  db: D1Database,
  tg: Telegram,
  user: TgUser,
  cb_id: string,
  message_id: number
) {
  const session: any = await db
    .prepare('SELECT * FROM grades_sessions WHERE telegram_user_id = ?')
    .bind(user.id)
    .first();
  if (!session) {
    await tg.answerCallbackQuery(cb_id, '⚠️ انتهت الجلسة - ابدأ من جديد', true);
    return;
  }
  let available: string[] = [];
  try { available = JSON.parse(session.available_semesters || '[]'); } catch (_) {}
  if (available.length === 0) {
    await tg.answerCallbackQuery(cb_id, '⚠️ لا توجد فصول متاحة', true);
    return;
  }
  await db
    .prepare(
      'UPDATE grades_sessions SET selected_semesters=?, updated_at=CURRENT_TIMESTAMP WHERE telegram_user_id=?'
    )
    .bind(JSON.stringify(available), user.id)
    .run();
  await handleGradesShow(db, tg, user, cb_id, message_id);
}

// التعامل مع تبديل اختيار فصل
// semesterOrIndex: قد يكون اسم الفصل (للتوافق) أو رقم index ضمن available
export async function handleGradesToggle(
  db: D1Database,
  tg: Telegram,
  user: TgUser,
  semesterOrIndex: string,
  cb_id: string,
  message_id: number
) {
  const session: any = await db
    .prepare('SELECT * FROM grades_sessions WHERE telegram_user_id = ?')
    .bind(user.id)
    .first();
  if (!session) {
    await tg.answerCallbackQuery(cb_id, '⚠️ انتهت الجلسة - ابدأ من جديد', true);
    return;
  }

  let selected: string[] = [];
  let available: string[] = [];
  try { selected = JSON.parse(session.selected_semesters || '[]'); } catch (_) {}
  try { available = JSON.parse(session.available_semesters || '[]'); } catch (_) {}

  // التعرف هل المرسل index رقمي أم اسم الفصل
  let semester = semesterOrIndex;
  if (/^\d+$/.test(semesterOrIndex)) {
    const idx = parseInt(semesterOrIndex, 10);
    if (idx >= 0 && idx < available.length) {
      semester = available[idx];
    } else {
      await tg.answerCallbackQuery(cb_id, '⚠️ خيار غير صالح، أعد المحاولة', true);
      return;
    }
  }

  if (selected.includes(semester)) {
    selected = selected.filter((s) => s !== semester);
  } else {
    selected.push(semester);
  }

  await db
    .prepare(
      'UPDATE grades_sessions SET selected_semesters=?, updated_at=CURRENT_TIMESTAMP WHERE telegram_user_id=?'
    )
    .bind(JSON.stringify(selected), user.id)
    .run();

  await tg.answerCallbackQuery(cb_id);
  await sendSemestersKeyboard(db, tg, user.id, available, selected, message_id);
}

// عرض النتيجة
export async function handleGradesShow(
  db: D1Database,
  tg: Telegram,
  user: TgUser,
  cb_id: string,
  message_id: number
) {
  let session: any = null;
  try {
    session = await db
      .prepare('SELECT * FROM grades_sessions WHERE telegram_user_id = ?')
      .bind(user.id)
      .first();
  } catch (e: any) {
    console.error('handleGradesShow session read error:', e?.message);
  }

  if (!session || !session.academic_id) {
    if (cb_id) {
      try { await tg.answerCallbackQuery(cb_id, '⚠️ انتهت الجلسة - ابدأ من جديد', true); } catch (_) {}
    } else {
      try {
        await tg.sendMessage(
          user.id,
          await getBotText(db, 'grades_session_expired', {}, '⚠️ انتهت الجلسة - ابدأ من جديد عبر القائمة.')
        );
      } catch (_) {}
    }
    return;
  }

  let selected: string[] = [];
  try { selected = JSON.parse(session.selected_semesters || '[]'); } catch (_) {}

  if (selected.length === 0) {
    const need = await getBotText(db, 'grades_need_choose', {}, 'الرجاء اختيار فصل واحد على الأقل لعرض النتائج.');
    if (cb_id) {
      try { await tg.answerCallbackQuery(cb_id, need, true); } catch (_) {}
    } else {
      try { await tg.sendMessage(user.id, need); } catch (_) {}
    }
    return;
  }

  if (cb_id) {
    const preparing = await getBotText(db, 'grades_preparing', {}, '📊 جاري إعداد النتيجة...');
    try { await tg.answerCallbackQuery(cb_id, preparing); } catch (_) {}
  }

  const academic_id = session.academic_id;
  // جلب جميع السجلات لهذه الفصول
  let allRows: GradeRow[] = [];
  try {
    const placeholders = selected.map(() => '?').join(',');
    const { results: rawRows } = await db
      .prepare(
        `SELECT * FROM grades WHERE academic_id = ? AND semester IN (${placeholders})`
      )
      .bind(academic_id, ...selected)
      .all();
    allRows = ((rawRows as any[]) || []) as GradeRow[];
  } catch (e: any) {
    console.error('grades query failed:', e?.message);
    try {
      await tg.sendMessage(
        user.id,
        await getBotText(db, 'grades_fetch_error', {}, '❌ حدث خطأ في جلب الدرجات. حاول مجدداً لاحقاً.')
      );
    } catch (_) {}
    return;
  }

  if (allRows.length === 0) {
    try {
      await tg.sendMessage(
        user.id,
        await getBotText(db, 'grades_no_match', {}, '❌ لا توجد بيانات متطابقة لهذه الفصول.')
      );
    } catch (_) {}
    // مسح الجلسة
    try {
      await db.prepare('DELETE FROM grades_sessions WHERE telegram_user_id=?').bind(user.id).run();
    } catch (_) {}
    return;
  }

  const studentName = allRows[0].student_name || 'الطالب';
  const college = allRows[0].college || '—';

  // عنوان النتيجة
  await tg.sendMessage(
    user.id,
    await getBotText(
      db,
      'grades_header',
      {
        name: escapeHtml(studentName),
        academic_id: escapeHtml(academic_id),
        college: escapeHtml(college),
        count: String(selected.length),
      },
      `👤 <b>الطالب:</b> ${escapeHtml(studentName)}\n🎓 <b>الرقم الأكاديمي:</b> <code>${escapeHtml(academic_id)}</code>\n🏛️ <b>الكلية:</b> ${escapeHtml(college)}\n🗓️ <b>عدد الفصول المختارة:</b> ${selected.length}`
    )
  );

  // عرض كل فصل
  for (const semester of selected) {
    const semRows = allRows.filter((r) => r.semester === semester);
    if (semRows.length === 0) continue;

    let msg = `📅 <b>${escapeHtml(semester)}</b>\n` + `━━━━━━━━━━━━━━━━━━━\n\n`;
    for (const r of semRows) {
      const status = r.is_remaining ? '❌ راسب' : '✅ ناجح';
      const passing = Number(r.passing_score) || 50;
      msg += `📘 <b>${escapeHtml(r.subject_name)}</b>\n`;

      // عرض الدرجات التفصيلية فقط للقيم > 0
      const lines: string[] = [];
      if (Number(r.attendance_score)) lines.push(`🎓 الحضور: ${r.attendance_score}`);
      if (Number(r.participation_score)) lines.push(`🤝 المشاركة: ${r.participation_score}`);
      if (Number(r.assignments_score)) lines.push(`📂 التكاليف: ${r.assignments_score}`);
      if (Number(r.midterm_score)) lines.push(`✍️ النصفي: ${r.midterm_score}`);
      if (Number(r.final_score)) lines.push(`📝 النهائي: ${r.final_score}`);
      if (Number(r.theory_midterm)) lines.push(`📖 النصفي نظري: ${r.theory_midterm}`);
      if (Number(r.practical_midterm)) lines.push(`🧪 النصفي عملي: ${r.practical_midterm}`);
      if (Number(r.theory_final)) lines.push(`📖 النهائي نظري: ${r.theory_final}`);
      if (Number(r.practical_final)) lines.push(`🧪 النهائي عملي: ${r.practical_final}`);
      if (Number(r.oral_recitation_mid)) lines.push(`🎤 شفهي تلاوة (نصفي): ${r.oral_recitation_mid}`);
      if (Number(r.oral_memorize_mid)) lines.push(`🧠 شفهي حفظ (نصفي): ${r.oral_memorize_mid}`);
      if (Number(r.oral_recitation_final)) lines.push(`🎤 شفهي تلاوة (نهائي): ${r.oral_recitation_final}`);
      if (Number(r.oral_memorize_final)) lines.push(`🧠 شفهي حفظ (نهائي): ${r.oral_memorize_final}`);
      if (lines.length) msg += lines.join('\n') + '\n';

      msg +=
        `📊 المجموع: <b>${r.total_score ?? 0}</b> / 100\n` +
        `🎯 درجة النجاح: ${passing}\n` +
        `🏅 التقدير: ${escapeHtml(r.grade_label || '—')}\n` +
        `📌 النتيجة: <b>${status}</b>\n\n`;
    }

    // قسم رسائل طويلة لتجنب تجاوز 4096 حرف
    if (msg.length > 3500) {
      const chunks = msg.match(/[\s\S]{1,3500}/g) || [msg];
      for (const ch of chunks) await tg.sendMessage(user.id, ch);
    } else {
      await tg.sendMessage(user.id, msg);
    }

    // ملخص الفصل
    const summary = summarizeTransferStatus(semRows);
    if (summary) {
      await tg.sendMessage(user.id, `❗ <b>حالة الفصل:</b> ${escapeHtml(summary)}`);
    } else {
      const { total, avg, grade } = calculateWeightedGpa(semRows);
      await tg.sendMessage(
        user.id,
        `✅ <b>نتيجة الفصل ${escapeHtml(semester)}:</b>\n` +
          `📚 المجموع: <b>${total}</b>\n` +
          `📈 المعدل: <b>${avg}</b>\n` +
          `🎖️ التقدير: <b>${escapeHtml(grade)}</b>`
      );
    }
  }

  // النتيجة النهائية
  const overall = summarizeTransferStatus(allRows);
  const kb = { inline_keyboard: [[{ text: '🏠 القائمة الرئيسية', callback_data: 'menu:main' }]] };
  if (overall) {
    await tg.sendMessage(
      user.id,
      `❗ <b>الحالة النهائية:</b> ${escapeHtml(overall)}`,
      { reply_markup: kb }
    );
  } else {
    const { total, avg, grade } = calculateWeightedGpa(allRows);
    await tg.sendMessage(
      user.id,
      `✅ <b>النتيجة النهائية:</b>\n` +
        `📚 المجموع النهائي: <b>${total}</b>\n` +
        `📈 المعدل العام: <b>${avg}</b>\n` +
        `🎖️ التقدير العام: <b>${escapeHtml(grade)}</b>`,
      { reply_markup: kb }
    );
  }

  // مسح الجلسة
  await db.prepare('DELETE FROM grades_sessions WHERE telegram_user_id=?').bind(user.id).run();
}
