// ============================================
// القوائم التفاعلية للمستخدم
// ============================================

import { Telegram, TgUser, escapeHtml, getDisplayName } from '../utils/telegram';
import { getSetting, getSettings, isAdmin } from '../utils/db';
import { getBotText } from '../utils/texts';
import { notifyAdmins } from '../utils/notifications';
import {
  mainMenuKeyboard,
  levelsKeyboard,
  curriculumLevelKeyboard,
  backToAdminKeyboard,
  requestActionKeyboard,
  contactsKeyboard,
  persistentReplyKeyboard,
} from './keyboards';
import { loadAttachmentsFor, loadButtonsFor, buildInlineKeyboard } from '../utils/buttons';

// عرض القائمة الرئيسية
export async function showMainMenu(
  db: D1Database,
  tg: Telegram,
  chat_id: number,
  user: TgUser,
  edit_message_id?: number
) {
  const settings = await getSettings(db);
  const display = getDisplayName(user);
  const isAdminUser = await isAdmin(db, user.id);
  const isPrivate = chat_id === user.id;
  const college = settings.college_name || 'كلية الصماد للقرآن الكريم';
  const textKey = isPrivate ? 'welcome_private' : 'welcome_group';
  const text = await getBotText(db, textKey, {
    name: escapeHtml(display),
    college: escapeHtml(college),
  }, `🌹 <b>مرحباً ${escapeHtml(display)}</b>\n\nأهلاً بك في بوت <b>${escapeHtml(college)}</b>\n\nاختر من الخدمات في القائمة بالأسفل ⬇️`);

  // ملاحظة: editMessageText لا يدعم reply_keyboard - فقط inline_keyboard.
  // لذا في الخاص: نتجاهل edit_message_id ونرسل رسالة جديدة بالقائمة الثابتة (Reply Keyboard).
  // في المجموعات: نستخدم inline_keyboard لأن Reply Keyboard لكل مستخدم في المجموعة لا تُعرض لجميع الأعضاء.

  if (isPrivate) {
    // في الخاص: القائمة الثابتة (Reply Keyboard) فقط - بدون inline لتفادي التشتت
    const persistKb = await persistentReplyKeyboard(db, isAdminUser, false);
    await tg.sendMessage(chat_id, text, { reply_markup: persistKb });
  } else {
    // في المجموعات: نرسل inline keyboard للقائمة الرئيسية
    // ثم نرسل القائمة الثابتة (Reply Keyboard) برسالة منفصلة مع selective=true
    // بحيث تظهر فقط للمستخدم الذي طلبها (لا تشوش على باقي الأعضاء)
    const kb = await mainMenuKeyboard(db, isAdminUser);
    if (edit_message_id) {
      try {
        await tg.editMessageText(chat_id, edit_message_id, text, { reply_markup: kb });
      } catch (_) {
        try { await tg.sendMessage(chat_id, text, { reply_markup: kb }); } catch (__) {}
      }
    } else {
      try { await tg.sendMessage(chat_id, text, { reply_markup: kb }); } catch (_) {}
    }

    // إرسال القائمة الثابتة في المجموعة بشكل selective (تظهر للمستخدم فقط)
    try {
      const persistKb: any = await persistentReplyKeyboard(db, isAdminUser, true);
      if (persistKb && persistKb.keyboard) {
        persistKb.selective = true;
        const replyKbText = await getBotText(
          db,
          'group_reply_kb_hint',
          { name: escapeHtml(display) },
          'استخدم الأزرار بالأسفل ⬇️'
        );
        await tg.sendMessage(chat_id, replyKbText, {
          reply_markup: persistKb,
          reply_to_message_id: undefined,
        });
      }
    } catch (e: any) {
      console.warn('group persistent keyboard send failed:', e?.message || e);
    }
  }
}

// عرض المستويات لاختيار منهج (ديناميكي من جدول academic_levels)
export async function showCurriculumLevels(
  tg: Telegram,
  chat_id: number,
  edit_message_id?: number,
  db?: D1Database
) {
  let text = `📚 <b>المناهج الدراسية</b>\n\nاختر المستوى الأكاديمي:`;
  // محاولة قراءة العنوان من bot_texts
  if (db) {
    try {
      text = await getBotText(db, 'curriculum_levels_title', {}, text);
    } catch (_) {}
  }
  // محاولة قراءة المستويات من قاعدة البيانات
  let levels: string[] = [];
  if (db) {
    try {
      const r = await db
        .prepare(
          'SELECT name FROM academic_levels WHERE is_active = 1 ORDER BY display_order, id'
        )
        .all();
      levels = ((r.results as any[]) || [])
        .map((x: any) => String(x.name || '').trim())
        .filter(Boolean);
    } catch (_) {}
    // إذا لم نجد مستويات نشطة، نأخذ كل المستويات
    if (levels.length === 0) {
      try {
        const r = await db
          .prepare('SELECT name FROM academic_levels ORDER BY display_order, id')
          .all();
        levels = ((r.results as any[]) || [])
          .map((x: any) => String(x.name || '').trim())
          .filter(Boolean);
      } catch (_) {}
    }
    // كحل أخير: نأخذ المستويات الموجودة فعلياً في المناهج
    if (levels.length === 0) {
      try {
        const r = await db
          .prepare("SELECT DISTINCT level FROM curriculums WHERE level IS NOT NULL AND level != '' ORDER BY level")
          .all();
        levels = ((r.results as any[]) || [])
          .map((x: any) => String(x.level || '').trim())
          .filter(Boolean);
      } catch (_) {}
    }
  }
  // إذا فشل كل شيء، نستخدم القيم الافتراضية
  if (levels.length === 0) {
    levels = ['الأول', 'الثاني', 'الثالث', 'الرابع'];
  }
  // إزالة التكرارات
  levels = Array.from(new Set(levels));

  const kb = {
    inline_keyboard: levels
      .map((lvl) => [{ text: `📖 المستوى ${lvl}`, callback_data: `curr:lvl:${encodeURIComponent(lvl)}` }])
      .concat([[{ text: '🔙 رجوع', callback_data: 'menu:main' }]]),
  };
  if (edit_message_id) {
    try {
      await tg.editMessageText(chat_id, edit_message_id, text, { reply_markup: kb });
      return;
    } catch (_) {
      // قد تفشل لأن الرسالة الأصلية صورة - نرسل رسالة جديدة
    }
  }
  await tg.sendMessage(chat_id, text, { reply_markup: kb });
}

// عرض اختيار الفصل الدراسي بعد اختيار المستوى
export async function showCurriculumSemesterChoice(
  db: D1Database,
  tg: Telegram,
  chat_id: number,
  level: string,
  edit_message_id?: number
) {
  // جلب الفصول المتاحة لهذا المستوى من المناهج الفعلية + الجدول
  const semesters: { short: string; name: string; hasItems: boolean }[] = [];
  const seen = new Set<string>();

  // 1) أولاً نأخذ كل القيم المميزة من المناهج النشطة للمستوى
  //    نحاول قراءة عمود semester وإذا لم يكن موجوداً نتجاهل بهدوء
  let fromCurriculums: string[] = [];
  let hasSemesterColumn = true;
  try {
    const r = await db
      .prepare(
        `SELECT DISTINCT semester FROM curriculums
         WHERE level = ? AND is_active = 1 AND semester IS NOT NULL AND semester != ''`
      )
      .bind(level)
      .all();
    fromCurriculums = ((r.results as any[]) || [])
      .map((x: any) => String(x.semester || '').trim())
      .filter(Boolean);
  } catch (e: any) {
    console.warn('showCurriculumSemesterChoice: curriculums.semester query failed:', e?.message || e);
    hasSemesterColumn = false;
    // محاولة عمود بديل أو ببساطة جلب أي مناهج للمستوى (بدون فلتر فصل)
    try {
      const r = await db
        .prepare(`SELECT id FROM curriculums WHERE level = ? AND is_active = 1 LIMIT 1`)
        .bind(level)
        .all();
      if ((r.results as any[])?.length) {
        // يوجد مواد لكن بدون عمود semester → اعتبر كلها "الأول"
        fromCurriculums = ['الأول'];
      }
    } catch (_) {}
  }

  // 2) جلب تعاريف الفصول الديناميكية
  let semDef: any[] = [];
  try {
    const r2 = await db
      .prepare(
        `SELECT short_name, name FROM academic_semesters
         WHERE is_active = 1 AND (level_name IS NULL OR level_name = '' OR level_name = ?)
         ORDER BY display_order, id`
      )
      .bind(level)
      .all();
    semDef = (r2.results as any[]) || [];
  } catch (_) {}

  // إذا لا توجد تعاريف نشطة، نسحب كل التعاريف
  if (semDef.length === 0) {
    try {
      const r3 = await db
        .prepare(
          `SELECT short_name, name FROM academic_semesters
           WHERE (level_name IS NULL OR level_name = '' OR level_name = ?)
           ORDER BY display_order, id`
        )
        .bind(level)
        .all();
      semDef = (r3.results as any[]) || [];
    } catch (_) {}
  }

  // 3) دمج: نضع الفصول التي تحوي مواد أولاً
  for (const s of fromCurriculums) {
    if (seen.has(s)) continue;
    seen.add(s);
    const def = semDef.find((d: any) => d.short_name === s);
    semesters.push({ short: s, name: def?.name || `الفصل الدراسي ${s}`, hasItems: true });
  }
  // 4) ثم نضيف فصولاً من التعاريف حتى لو ما عندها مواد (للسماح بالاختيار)
  for (const d of semDef) {
    const sn = String(d.short_name || '').trim();
    if (!sn || seen.has(sn)) continue;
    seen.add(sn);
    semesters.push({ short: sn, name: String(d.name || `الفصل الدراسي ${sn}`), hasItems: false });
  }

  // 5) كحل أخير: إذا ما زلنا فارغين، نستخدم القيم الافتراضية
  if (semesters.length === 0) {
    semesters.push(
      { short: 'الأول', name: 'الفصل الدراسي الأول', hasItems: false },
      { short: 'الثاني', name: 'الفصل الدراسي الثاني', hasItems: false }
    );
  }

  // نعرض دائماً قائمة الاختيار حتى لو فصل واحد - لضمان استجابة واضحة للمستخدم
  const baseText =
    `📚 <b>المستوى ${escapeHtml(level)}</b>\n\n` +
    `📅 اختر الفصل الدراسي الذي تريد عرض مناهجه:`;
  let text = baseText;
  try {
    text = await getBotText(db, 'curriculum_semester_choice', { level: escapeHtml(level) }, baseText);
  } catch (_) {}

  const rows = semesters.map((s) => [
    {
      text: `📅 ${s.name}${s.hasItems ? '' : ' (لا توجد مواد بعد)'}`,
      callback_data: `curr:sem:${encodeURIComponent(level)}:${encodeURIComponent(s.short)}`,
    },
  ]);
  // عرض كل الفصول فقط إذا فيه أكثر من فصل
  if (semesters.length > 1) {
    rows.push([{ text: '📚 عرض كل الفصول', callback_data: `curr:sem:${encodeURIComponent(level)}:__all__` }]);
  }
  rows.push([{ text: '🔙 رجوع للمستويات', callback_data: 'menu:curriculum' }]);
  const kb = { inline_keyboard: rows };

  if (edit_message_id) {
    try {
      await tg.editMessageText(chat_id, edit_message_id, text, { reply_markup: kb });
      return;
    } catch (_) {
      // قد تفشل لأن الرسالة الأصلية تحوي مرفقاً - نرسل رسالة جديدة
    }
  }
  try {
    await tg.sendMessage(chat_id, text, { reply_markup: kb });
  } catch (e: any) {
    console.error('showCurriculumSemesterChoice sendMessage failed, retrying without HTML:', e?.message || e);
    // محاولة أخيرة بدون HTML لتفادي أي خطأ تنسيق
    try {
      await tg.sendMessage(chat_id, `المستوى ${level}\n\nاختر الفصل الدراسي:`, {
        reply_markup: kb,
        parse_mode: undefined,
      });
    } catch (e2: any) {
      console.error('showCurriculumSemesterChoice fallback failed:', e2?.message || e2);
    }
  }
}

// عرض مواد المستوى — مع فلتر اختياري للفصل الدراسي
export async function showCurriculumLevel(
  db: D1Database,
  tg: Telegram,
  chat_id: number,
  level: string,
  semester?: string,
  edit_message_id?: number
) {
  let query: string;
  let bindArgs: any[];
  if (semester && semester !== '__all__') {
    query =
      'SELECT id, subject_name, description, semester FROM curriculums WHERE level = ? AND semester = ? AND is_active = 1 ORDER BY display_order, id';
    bindArgs = [level, semester];
  } else {
    query =
      'SELECT id, subject_name, description, semester FROM curriculums WHERE level = ? AND is_active = 1 ORDER BY semester, display_order, id';
    bindArgs = [level];
  }
  let results: any[] = [];
  try {
    const r = await db.prepare(query).bind(...bindArgs).all();
    results = (r.results as any[]) || [];
  } catch (e: any) {
    console.warn('showCurriculumLevel: semester column query failed, fallback:', e?.message || e);
    // عمود semester غير موجود — استعلام بدون فلتر الفصل
    try {
      const r2 = await db
        .prepare('SELECT id, subject_name, description FROM curriculums WHERE level = ? AND is_active = 1 ORDER BY display_order, id')
        .bind(level)
        .all();
      results = ((r2.results as any[]) || []).map((x: any) => ({ ...x, semester: 'الأول' }));
    } catch (_) {
      results = [];
    }
  }

  const backBtnText = await getBotText(db, 'btn_back_to_levels', {}, '🔙 رجوع');
  // عنوان فرعي يشمل الفصل الدراسي إذا تم تحديده
  const semesterLabel =
    semester && semester !== '__all__'
      ? `\n📅 الفصل: <b>${escapeHtml(semester === 'الأول' ? 'الأول' : semester === 'الثاني' ? 'الثاني' : semester)}</b>`
      : '';

  // زر الرجوع المناسب: إذا في فصل محدد ≠ all → رجوع للفصول؛ خلاف ذلك → رجوع للمستويات
  const backToSemestersCb = `curr:back-sem:${encodeURIComponent(level)}`;
  const backRow =
    semester && semester !== '__all__'
      ? [{ text: backBtnText, callback_data: backToSemestersCb }]
      : [{ text: backBtnText, callback_data: 'menu:curriculum' }];

  if (!results || results.length === 0) {
    const baseText = await getBotText(
      db,
      'curriculum_level_empty',
      { level: escapeHtml(level) },
      `📚 <b>المستوى ${escapeHtml(level)}</b>\n\n⚠️ لا توجد مواد متاحة حالياً لهذا المستوى.\n\nسيتم إضافتها قريباً إن شاء الله.`
    );
    const text = baseText + semesterLabel;
    // أضف زر الرجوع للقائمة الرئيسية للتأكد من عدم تعليق المستخدم
    const backKb = {
      inline_keyboard: [
        backRow,
        [{ text: '🏠 القائمة الرئيسية', callback_data: 'menu:main' }],
      ],
    };
    if (edit_message_id) {
      try {
        await tg.editMessageText(chat_id, edit_message_id, text, { reply_markup: backKb });
        return;
      } catch (_) {}
    }
    await tg.sendMessage(chat_id, text, { reply_markup: backKb });
    return;
  }

  // إذا كان "كل الفصول" ولا يوجد فلتر، نضمّن اسم الفصل قبل كل مادة
  const showSemInList = !semester || semester === '__all__';
  const items = (results as any[])
    .map(
      (r: any, i: number) =>
        `${i + 1}. <b>${escapeHtml(r.subject_name)}</b>` +
        (showSemInList && r.semester ? ` <i>(${escapeHtml(r.semester)})</i>` : '') +
        (r.description ? `\n   <i>${escapeHtml(r.description)}</i>` : '')
    )
    .join('\n\n');
  const text =
    (await getBotText(
      db,
      'curriculum_level_title',
      {
        level: escapeHtml(level),
        count: String(results.length),
        items,
      },
      `📚 <b>منهج المستوى ${escapeHtml(level)}</b>\n\n📖 المواد المتاحة (${results.length}):\n\n${items}\n\nاضغط على المادة للحصول على تفاصيلها:`
    )) + semesterLabel;

  const baseKb = curriculumLevelKeyboard(results as any[], level);
  // استبدال آخر صف (رجوع للمستويات) بصف الرجوع المناسب
  const inline = baseKb.inline_keyboard.slice(0, -1);
  inline.push(backRow);
  const kb = { inline_keyboard: inline };
  if (edit_message_id) {
    try {
      await tg.editMessageText(chat_id, edit_message_id, text, { reply_markup: kb });
      return;
    } catch (_) {}
  }
  await tg.sendMessage(chat_id, text, { reply_markup: kb });
}

// عرض مادة محددة - مع المرفقات والأزرار الشفافة
export async function showCurriculumItem(
  db: D1Database,
  tg: Telegram,
  chat_id: number,
  item_id: number,
  edit_message_id?: number
) {
  const item: any = await db
    .prepare('SELECT * FROM curriculums WHERE id = ?')
    .bind(item_id)
    .first();

  if (!item) {
    const notFound = await getBotText(db, 'curriculum_item_not_found', {}, '⚠️ المادة غير موجودة.');
    await tg.sendMessage(chat_id, notFound);
    return;
  }

  const descriptionPart = item.description ? `📝 <b>الوصف:</b>\n${escapeHtml(item.description)}\n\n` : '';
  const fileLinkPart = item.file_url ? `🔗 <b>رابط المنهج:</b>\n${escapeHtml(item.file_url)}` : '';
  const text = await getBotText(
    db,
    'curriculum_item_template',
    {
      subject: escapeHtml(item.subject_name),
      level: escapeHtml(item.level),
      description: descriptionPart,
      file_link: fileLinkPart,
    },
    `📕 <b>${escapeHtml(item.subject_name)}</b>\n📚 المستوى: <b>${escapeHtml(item.level)}</b>\n\n${descriptionPart}${fileLinkPart}`
  );

  // تحميل المرفقات والأزرار
  const attachments = await loadAttachmentsFor(db, 'curriculum', item.id);
  const customButtons = await loadButtonsFor(db, 'curriculum', item.id);

  // أزرار الرجوع الافتراضية
  const backSubjectsText = await getBotText(db, 'btn_back_to_subjects', {}, '🔙 رجوع للمواد');
  const backMainText = await getBotText(db, 'menu_back_to_main', {}, '🏠 القائمة الرئيسية');
  const baseRows: any[][] = [
    [{ text: backSubjectsText, callback_data: `curr:sub:${encodeURIComponent(item.level)}:${encodeURIComponent(item.semester || '__all__')}` }],
    [{ text: backMainText, callback_data: 'menu:main' }],
  ];

  // دمج الأزرار المخصصة فوق أزرار الرجوع
  const customKb = buildInlineKeyboard(customButtons);
  const inlineKeyboard = customKb ? [...customKb.inline_keyboard, ...baseRows] : baseRows;
  const kb = { inline_keyboard: inlineKeyboard };

  // حذف الرسالة السابقة إذا كنا سنرسل مرفقات (لا يمكن تعديل رسالة نصية لتصبح صورة)
  if (attachments.length > 0 && edit_message_id) {
    try { await tg.deleteMessage(chat_id, edit_message_id); } catch (_) {}
  }

  if (attachments.length === 0) {
    if (edit_message_id) {
      try {
        await tg.editMessageText(chat_id, edit_message_id, text, { reply_markup: kb });
        return;
      } catch (_) {}
    }
    await tg.sendMessage(chat_id, text, { reply_markup: kb });
    return;
  }

  // إرسال أول مرفق مع نص المادة + الأزرار
  const first = attachments[0];
  await tg.sendAttachment(chat_id, first, text, { reply_markup: kb });

  // باقي المرفقات (إن وُجدت)
  for (let i = 1; i < attachments.length; i++) {
    try {
      await tg.sendAttachment(chat_id, attachments[i], attachments[i].caption || '', {});
    } catch (_) {}
  }
}

// عرض معلومات الكلية
export async function showAbout(
  db: D1Database,
  tg: Telegram,
  chat_id: number,
  edit_message_id?: number
) {
  const settings = await getSettings(db);
  const college = escapeHtml(settings.college_name || 'كلية الصماد للقرآن الكريم');
  const text = await getBotText(
    db,
    'about_default_full',
    { college },
    `ℹ️ <b>عن ${college}</b>\n\n🕌 <b>كلية الصماد للقرآن الكريم</b>\n\nصرح علمي قرآني يهتم بتدريس وتحفيظ القرآن الكريم وعلومه، وإعداد كوادر مؤهلة في خدمة كتاب الله تعالى.\n\n📚 المستويات الأكاديمية: من الأول حتى الرابع\n🎓 تخصصات: علوم القرآن، التفسير، التجويد، القراءات، الفقه، العقيدة، الحديث\n\n🤖 هذا البوت لخدمة طلاب الكلية وتسهيل التواصل والوصول للمناهج.`
  );

  const backText = await getBotText(db, 'btn_back_to_levels', {}, '🔙 القائمة الرئيسية');
  const kb = { inline_keyboard: [[{ text: backText, callback_data: 'menu:main' }]] };

  if (edit_message_id) {
    try {
      await tg.editMessageText(chat_id, edit_message_id, text, { reply_markup: kb });
      return;
    } catch (_) {}
  }
  await tg.sendMessage(chat_id, text, { reply_markup: kb });
}

// طلب التواصل مع الإدارة - يدعم جهات اتصال متعددة من قاعدة البيانات
export async function showContact(
  db: D1Database,
  tg: Telegram,
  chat_id: number,
  edit_message_id?: number
) {
  const settings = await getSettings(db);
  const customContact = await getSetting(db, 'contact_message');
  const contact_text = customContact || await getBotText(
    db,
    'contact_intro_default',
    {},
    `☎️ <b>التواصل مع الإدارة</b>\n\nاختر الجهة التي تريد التواصل معها مباشرة:`
  );

  const kb = await contactsKeyboard(db);

  if (edit_message_id) {
    try {
      await tg.editMessageText(chat_id, edit_message_id, contact_text, { reply_markup: kb });
      return;
    } catch (_) {}
  }
  await tg.sendMessage(chat_id, contact_text, { reply_markup: kb });
}

// تنفيذ أمر مخصص من قاعدة البيانات (callback أو command)
export async function runCustomCommand(
  db: D1Database,
  tg: Telegram,
  chat_id: number,
  user: TgUser,
  identifier: { id?: number; code?: string },
  edit_message_id?: number,
  reply_to_message_id?: number
) {
  let cmd: any;
  if (identifier.id) {
    cmd = await db.prepare('SELECT * FROM custom_commands WHERE id = ? AND is_active = 1').bind(identifier.id).first();
  } else if (identifier.code) {
    cmd = await db.prepare('SELECT * FROM custom_commands WHERE code = ? AND is_active = 1').bind(identifier.code).first();
  }
  if (!cmd) {
    const msg = await getBotText(db, 'cmd_not_available', {}, '⚠️ الأمر غير متاح حالياً.');
    await tg.sendMessage(chat_id, msg);
    return;
  }
  if (cmd.is_admin_only) {
    const isAdminUser = await isAdmin(db, user.id);
    if (!isAdminUser) {
      const msg = await getBotText(db, 'cmd_admin_only', {}, '⛔️ هذا الأمر مخصص للمشرفين فقط.');
      await tg.sendMessage(chat_id, msg);
      return;
    }
  }

  const attachments = await loadAttachmentsFor(db, 'command', cmd.id);
  const buttons = await loadButtonsFor(db, 'command', cmd.id);
  const customKb = buildInlineKeyboard(buttons, { text: '🔙 القائمة الرئيسية', callback_data: 'menu:main' });
  const extra: any = {};
  if (customKb) extra.reply_markup = customKb;
  if (reply_to_message_id) extra.reply_to_message_id = reply_to_message_id;

  if (attachments.length === 0) {
    if (edit_message_id) {
      try {
        await tg.editMessageText(chat_id, edit_message_id, cmd.response_text, extra);
        return;
      } catch (_) {}
    }
    await tg.sendMessage(chat_id, cmd.response_text, extra);
    return;
  }

  if (edit_message_id) {
    try { await tg.deleteMessage(chat_id, edit_message_id); } catch (_) {}
  }
  await tg.sendAttachment(chat_id, attachments[0], cmd.response_text, extra);
  for (let i = 1; i < attachments.length; i++) {
    try { await tg.sendAttachment(chat_id, attachments[i], attachments[i].caption || '', {}); } catch (_) {}
  }
}

// بدء طلب سؤال أو طلب
// إذا كان المستخدم في مجموعة، نوجهه للخاص (لخصوصية المحادثة)
export async function startRequest(
  db: D1Database,
  tg: Telegram,
  chat_id: number,
  user: TgUser,
  type: 'question' | 'request',
  edit_message_id?: number
) {
  const label = type === 'question' ? 'السؤال أو الاستفسار' : 'الطلب';

  // إذا كان في مجموعة، نوجه المستخدم لمحادثة البوت في الخاص
  if (chat_id !== user.id) {
    // نضع الحالة في الخاص
    await db
      .prepare(
        `INSERT INTO bot_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
      )
      .bind(`pending_request_${user.id}`, type)
      .run();

    // نحاول إرسال للخاص
    const cancelBtnText = await getBotText(db, 'btn_cancel_inline', {}, '❌ إلغاء');
    const formTitleText = await getBotText(
      db,
      'request_form_title',
      { label },
      `📝 <b>تقديم ${label}</b>\n\nيرجى الآن كتابة ${label} في رسالة واحدة وسيتم إرساله إلى الإدارة للرد عليك.\n\n<i>أرسل /cancel للإلغاء.</i>`
    );
    let privateOk = false;
    try {
      await tg.sendMessage(user.id, formTitleText, {
        reply_markup: { inline_keyboard: [[{ text: cancelBtnText, callback_data: 'menu:main' }]] },
      });
      privateOk = true;
    } catch (_) {}

    const me = await tg.getMe().catch(() => ({ username: 'bot' } as any));
    const startUrl = `https://t.me/${me?.username || 'bot'}?start=req_${type}`;
    const displayName = escapeHtml(getDisplayName(user));
    const groupText = privateOk
      ? await getBotText(
          db,
          'request_redirect_to_pm',
          { display: displayName, label },
          `📩 ${displayName} — تم إرسال نموذج تقديم ${label} لك في الخاص. يرجى متابعة المحادثة هناك.`
        )
      : await getBotText(
          db,
          'request_open_private_first',
          { display: displayName },
          `📩 ${displayName} — يرجى فتح محادثة خاصة مع البوت أولاً ثم اضغط الزر للبدء.`
        );

    const openPrivateText = await getBotText(db, 'btn_open_private', {}, '✉️ افتح المحادثة الخاصة');
    const backMenuText = await getBotText(db, 'btn_back_menu', {}, '🔙 القائمة');
    const groupKb = {
      inline_keyboard: [
        [{ text: openPrivateText, url: startUrl }],
        [{ text: backMenuText, callback_data: 'menu:main' }],
      ],
    };

    if (edit_message_id) {
      try {
        await tg.editMessageText(chat_id, edit_message_id, groupText, { reply_markup: groupKb });
        return;
      } catch (_) {}
    }
    await tg.sendMessage(chat_id, groupText, { reply_markup: groupKb });
    return;
  }

  // محادثة خاصة - وضع الحالة وعرض النص
  await db
    .prepare(
      `INSERT INTO bot_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
    )
    .bind(`pending_request_${user.id}`, type)
    .run();

  const text = await getBotText(
    db,
    'request_form_title',
    { label },
    `📝 <b>تقديم ${label}</b>\n\nيرجى الآن كتابة ${label} في رسالة واحدة وسيتم إرساله إلى الإدارة للرد عليك.\n\n<i>أرسل /cancel للإلغاء.</i>`
  );

  const cancelText = await getBotText(db, 'btn_cancel_inline', {}, '❌ إلغاء');
  const kb = { inline_keyboard: [[{ text: cancelText, callback_data: 'menu:main' }]] };

  if (edit_message_id) {
    try {
      await tg.editMessageText(chat_id, edit_message_id, text, { reply_markup: kb });
      return;
    } catch (_) {}
  }
  await tg.sendMessage(chat_id, text, { reply_markup: kb });
}

// معالجة استلام نص الطلب/السؤال
export async function handleRequestText(
  db: D1Database,
  tg: Telegram,
  user: TgUser,
  text: string
): Promise<boolean> {
  const pending = await getSetting(db, `pending_request_${user.id}`);
  if (!pending) return false;

  if (text.trim() === '/cancel' || text.trim() === 'إلغاء') {
    await db.prepare('DELETE FROM bot_settings WHERE key = ?').bind(`pending_request_${user.id}`).run();
    const cancelMsg = await getBotText(db, 'request_cancelled_op', {}, '❌ تم إلغاء العملية.');
    await tg.sendMessage(user.id, cancelMsg);
    return true;
  }

  // حفظ الطلب
  const result = await db
    .prepare(
      `INSERT INTO requests (telegram_user_id, username, display_name, type, content) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(user.id, user.username || null, getDisplayName(user), pending, text)
    .run();

  const request_id = result.meta.last_row_id;

  // مسح حالة الانتظار
  await db.prepare('DELETE FROM bot_settings WHERE key = ?').bind(`pending_request_${user.id}`).run();

  // تأكيد للمستخدم
  const kindText = pending === 'question' ? 'سؤالك' : 'طلبك';
  const userOkMsg = await getBotText(
    db,
    'request_sent_user_ok',
    { kind: kindText, id: String(request_id) },
    `✅ <b>تم إرسال ${kindText} بنجاح</b>\n\n🆔 رقم المرجع: <code>#${request_id}</code>\n📨 سيتم الرد عليك في أقرب وقت إن شاء الله.`
  );
  const backMainText3 = await getBotText(db, 'menu_back_to_main', {}, '🏠 القائمة الرئيسية');
  await tg.sendMessage(user.id, userOkMsg, {
    reply_markup: { inline_keyboard: [[{ text: backMainText3, callback_data: 'menu:main' }]] },
  });

  // إرسال لكل المشرفين المعنيين
  {
    const display = getDisplayName(user);
    const typeLabel = pending === 'question' ? '❓ سؤال' : '📝 طلب';
    const ownerNotify = await getBotText(
      db,
      'request_owner_notify',
      {
        type_label: typeLabel,
        id: String(request_id),
        display: escapeHtml(display),
        user_id: String(user.id),
        content: escapeHtml(text),
      },
      `📨 <b>${typeLabel} جديد</b> #${request_id}\n\n👤 من: ${escapeHtml(display)} (<code>${user.id}</code>)\n\n📋 <b>المحتوى:</b>\n${escapeHtml(text)}`
    );
    const shortBody = text.length > 100 ? text.substring(0, 97) + '...' : text;
    await notifyAdmins(db, tg, {
      event_type: pending === 'question' ? 'question' : 'request',
      event_ref_id: Number(request_id),
      title: pending === 'question' ? '❓ سؤال جديد' : '📝 طلب جديد',
      body: `من ${display}: ${shortBody}`,
      telegram_html: ownerNotify,
      telegram_reply_markup: requestActionKeyboard(Number(request_id)),
      url: '/admin/dashboard#requests',
    });
  }
  return true;
}
