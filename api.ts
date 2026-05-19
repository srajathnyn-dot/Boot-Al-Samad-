// ============================================
// API Endpoints للوحة التحكم
// ============================================

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSession } from '../utils/auth';
import { Telegram } from '../utils/telegram';
import { hashPassword, verifyPassword } from '../utils/auth';
import { getSetting, setSetting, logActivity } from '../utils/db';
import { ensureVapidKeys, getVapidPublicKey, sendWebPushToUser } from '../utils/webpush';

type Env = {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  PANEL_SALT?: string;
};

const api = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// ====== Auth Middleware ======
api.use('*', async (c, next) => {
  const sessionId = getCookie(c, 'session');
  if (!sessionId) return c.json({ error: 'غير مسجل دخول' }, 401);
  const user = await getSession(c.env.DB, sessionId);
  if (!user) return c.json({ error: 'انتهت الجلسة' }, 401);
  c.set('user', user);
  await next();
});

// ====== Settings ======
api.get('/settings', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT key, value FROM bot_settings').all();
  const settings: any = {};
  for (const r of results as any[]) settings[r.key] = r.value;
  return c.json({ settings });
});

api.post('/settings', async (c) => {
  const body: any = await c.req.json();
  for (const k in body) {
    if (k.startsWith('pending_') || k === 'webhook_secret' && !body[k]) continue;
    await setSetting(c.env.DB, k, String(body[k] || ''));
  }

  // ===== مزامنة المالك تلقائياً =====
  // عند تغيير owner_user_id في الإعدادات، نضمن أن:
  // 1) المستخدم الجديد يصبح owner في bot_admins
  // 2) كل المشرفين الآخرين يصبحون admin عاديين (إزالة role='owner' من الباقي)
  // 3) معرف المستخدم (username) و contact_url يحدّثان أيضاً
  try {
    const ownerIdStr = String(body.owner_user_id || '').trim();
    const ownerUsername = String(body.owner_username || '').trim();
    if (ownerIdStr && /^\d+$/.test(ownerIdStr)) {
      const ownerId = Number(ownerIdStr);
      // أزل role='owner' من جميع السجلات الأخرى
      await c.env.DB
        .prepare("UPDATE bot_admins SET role = 'admin' WHERE telegram_user_id != ? AND role = 'owner'")
        .bind(ownerId)
        .run();
      // أدرج أو حدّث المالك الجديد
      await c.env.DB
        .prepare(
          `INSERT INTO bot_admins (telegram_user_id, username, role, can_manage_groups)
           VALUES (?, ?, 'owner', 1)
           ON CONFLICT(telegram_user_id) DO UPDATE SET
             role = 'owner',
             can_manage_groups = 1,
             username = COALESCE(NULLIF(excluded.username, ''), username)`
        )
        .bind(ownerId, ownerUsername.replace(/^@/, '') || null)
        .run();
      // ضمان owner_contact_url
      if (!body.owner_contact_url) {
        await setSetting(c.env.DB, 'owner_contact_url', `tg://user?id=${ownerId}`);
      }
    }
  } catch (e: any) {
    console.error('owner sync failed:', e?.message || e);
  }

  await logActivity(c.env.DB, 'settings_updated', JSON.stringify(Object.keys(body)));
  return c.json({ ok: true });
});

// ====== Stats ======
api.get('/stats', async (c) => {
  const db = c.env.DB;
  const stats: any = {};
  const queries = [
    ['groups', 'SELECT COUNT(*) AS c FROM groups WHERE is_active = 1'],
    ['students', 'SELECT COUNT(*) AS c FROM students'],
    ['curriculums', 'SELECT COUNT(*) AS c FROM curriculums WHERE is_active = 1'],
    ['pending_requests', "SELECT COUNT(*) AS c FROM requests WHERE status='pending'"],
    ['approved', "SELECT COUNT(*) AS c FROM students WHERE status='approved'"],
    ['pending', "SELECT COUNT(*) AS c FROM students WHERE status='pending'"],
    ['restricted', "SELECT COUNT(*) AS c FROM students WHERE status='restricted'"],
    ['rejected', "SELECT COUNT(*) AS c FROM students WHERE status='rejected'"],
    ['replies', 'SELECT COUNT(*) AS c FROM auto_replies WHERE is_active = 1'],
    ['banned_words', 'SELECT COUNT(*) AS c FROM banned_words'],
    ['warnings', 'SELECT COUNT(*) AS c FROM warnings'],
  ];
  for (const [key, sql] of queries) {
    const r: any = await db.prepare(sql).first();
    stats[key] = r?.c || 0;
  }
  return c.json({ stats });
});

// ====== Groups ======
api.get('/groups', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM groups ORDER BY id DESC').all();
  return c.json({ groups: results });
});

api.post('/groups/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  const allowed = [
    'is_active', 'delete_links', 'delete_forwarded', 'delete_bad_words',
    'anti_spam', 'spam_max_messages', 'spam_window_seconds', 'warn_threshold',
    'welcome_enabled', 'join_verification',
  ];
  const sets: string[] = [];
  const values: any[] = [];
  for (const k of allowed) {
    if (k in body) {
      sets.push(`${k} = ?`);
      values.push(Number(body[k]));
    }
  }
  if (!sets.length) return c.json({ ok: true });
  values.push(id);
  await c.env.DB.prepare(`UPDATE groups SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  return c.json({ ok: true });
});

api.delete('/groups/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// ====== إزالة البوت من مجموعة (leaveChat) ======
api.post('/groups/:id/leave', async (c) => {
  const id = Number(c.req.param('id'));
  const group: any = await c.env.DB
    .prepare('SELECT chat_id, title FROM groups WHERE id = ?')
    .bind(id)
    .first();
  if (!group) return c.json({ ok: false, error: 'المجموعة غير موجودة' }, 404);

  const token = c.env.TELEGRAM_BOT_TOKEN || (await getSetting(c.env.DB, 'bot_token')) || '';
  if (!token) return c.json({ ok: false, error: 'لم يتم تكوين token البوت' }, 400);

  const tg = new Telegram(token);

  // محاولة إرسال إشعار للمجموعة قبل المغادرة
  try {
    await tg.sendMessage(
      Number(group.chat_id),
      `👋 <b>وداعاً!</b>\n\nتمت إزالة البوت من هذه المجموعة بواسطة الإدارة.`
    );
  } catch (_) {}

  // محاولة المغادرة
  let success = false;
  let error = '';
  try {
    await tg.leaveChat(Number(group.chat_id));
    success = true;
  } catch (e: any) {
    error = e?.message || 'فشلت المغادرة';
  }

  // تعطيل المجموعة في قاعدة البيانات
  try {
    await c.env.DB
      .prepare('UPDATE groups SET is_active = 0 WHERE id = ?')
      .bind(id)
      .run();
  } catch (_) {}

  await logActivity(c.env.DB, 'group_leave',
    `chat=${group.chat_id} title=${group.title} success=${success} error=${error}`);

  if (success) return c.json({ ok: true, message: 'تم خروج البوت من المجموعة بنجاح' });
  return c.json({ ok: false, error: `فشلت المغادرة: ${error}. تم تعطيل المجموعة في قاعدة البيانات.` }, 200);
});

// ====== إدارة المجموعات المسموح إضافة البوت إليها (whitelist) ======
api.get('/allowed-groups', async (c) => {
  try {
    const { results } = await c.env.DB
      .prepare('SELECT * FROM allowed_groups ORDER BY id DESC')
      .all();
    return c.json({ groups: results });
  } catch (e: any) {
    return c.json({ groups: [], error: e?.message }, 200);
  }
});

api.post('/allowed-groups', async (c) => {
  const body: any = await c.req.json();
  const chat_id = body.chat_id ? Number(body.chat_id) : null;
  const title = String(body.title || '').trim();
  const notes = String(body.notes || '').trim() || null;
  if (!chat_id && !title) return c.json({ error: 'يجب توفير معرف المجموعة أو اسمها' }, 400);
  try {
    const user = c.get('user');
    const r = await c.env.DB
      .prepare('INSERT INTO allowed_groups (chat_id, title, added_by, notes) VALUES (?, ?, ?, ?)')
      .bind(chat_id, title || null, user?.id || null, notes)
      .run();
    return c.json({ ok: true, id: r.meta.last_row_id });
  } catch (e: any) {
    return c.json({ error: e?.message }, 400);
  }
});

api.delete('/allowed-groups/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.prepare('DELETE FROM allowed_groups WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// ====== إعدادات الحماية (سويتش سريع) ======
api.get('/groups/security/settings', async (c) => {
  const restrict = (await getSetting(c.env.DB, 'restrict_bot_to_admins_only')) || '0';
  const autoLeave = (await getSetting(c.env.DB, 'auto_leave_unauthorized_groups')) || '0';
  return c.json({
    restrict_bot_to_admins_only: restrict === '1' ? 1 : 0,
    auto_leave_unauthorized_groups: autoLeave === '1' ? 1 : 0,
  });
});

api.post('/groups/security/settings', async (c) => {
  const body: any = await c.req.json();
  if ('restrict_bot_to_admins_only' in body) {
    await setSetting(c.env.DB, 'restrict_bot_to_admins_only', body.restrict_bot_to_admins_only ? '1' : '0');
  }
  if ('auto_leave_unauthorized_groups' in body) {
    await setSetting(c.env.DB, 'auto_leave_unauthorized_groups', body.auto_leave_unauthorized_groups ? '1' : '0');
  }
  return c.json({ ok: true });
});

// ====== Students ======
api.get('/students', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM students ORDER BY id DESC LIMIT 500').all();
  return c.json({ students: results });
});

api.delete('/students/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.prepare('DELETE FROM students WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// ====== Curriculum ======
api.get('/curriculum', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM curriculums ORDER BY level, semester, display_order, id'
  ).all();
  return c.json({ items: results });
});

api.post('/curriculum', async (c) => {
  const body: any = await c.req.json();
  const r = await c.env.DB
    .prepare(
      'INSERT INTO curriculums (level, semester, academic_year, subject_name, description, file_url, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
    )
    .bind(
      body.level,
      body.semester || 'الأول',
      body.academic_year || null,
      body.subject_name,
      body.description || null,
      body.file_url || null,
      Number(body.display_order || 0)
    )
    .run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});

api.post('/curriculum/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  await c.env.DB
    .prepare(
      'UPDATE curriculums SET level=?, semester=?, academic_year=?, subject_name=?, description=?, file_url=? WHERE id = ?'
    )
    .bind(
      body.level,
      body.semester || 'الأول',
      body.academic_year || null,
      body.subject_name,
      body.description || null,
      body.file_url || null,
      id
    )
    .run();
  return c.json({ ok: true });
});

api.delete('/curriculum/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM curriculums WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

// ====== Auto Replies ======
api.get('/replies', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM auto_replies ORDER BY id DESC').all();
  return c.json({ replies: results });
});

api.post('/replies', async (c) => {
  const body: any = await c.req.json();
  const r = await c.env.DB
    .prepare(
      'INSERT INTO auto_replies (trigger_text, match_type, reply_text, case_sensitive, is_active) VALUES (?, ?, ?, ?, 1)'
    )
    .bind(
      body.trigger_text,
      body.match_type || 'contains',
      body.reply_text,
      Number(body.case_sensitive || 0)
    )
    .run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});

api.post('/replies/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  const fields = ['trigger_text', 'match_type', 'reply_text', 'is_active', 'case_sensitive'];
  const sets: string[] = [];
  const values: any[] = [];
  for (const f of fields) {
    if (f in body) {
      sets.push(`${f} = ?`);
      values.push(['is_active', 'case_sensitive'].includes(f) ? Number(body[f]) : body[f]);
    }
  }
  if (!sets.length) return c.json({ ok: true });
  values.push(id);
  await c.env.DB.prepare(`UPDATE auto_replies SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  return c.json({ ok: true });
});

api.delete('/replies/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM auto_replies WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

// ====== Banned Words ======
api.get('/banned', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM banned_words ORDER BY id DESC').all();
  return c.json({ words: results });
});

api.post('/banned', async (c) => {
  const body: any = await c.req.json();
  await c.env.DB
    .prepare('INSERT INTO banned_words (word, severity) VALUES (?, ?)')
    .bind(body.word, body.severity || 'delete')
    .run();
  return c.json({ ok: true });
});

api.delete('/banned/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM banned_words WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

// ====== Requests ======
api.get('/requests', async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT * FROM requests ORDER BY id DESC LIMIT 200')
    .all();
  return c.json({ requests: results });
});

api.post('/requests/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  if (body.status) {
    await c.env.DB.prepare('UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(body.status, id).run();
  }
  return c.json({ ok: true });
});

api.delete('/requests/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM requests WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

// ====== Admins ======
api.get('/admins', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM bot_admins ORDER BY id DESC').all();
  return c.json({ admins: results });
});

api.post('/admins', async (c) => {
  const body: any = await c.req.json();
  await c.env.DB
    .prepare(
      `INSERT INTO bot_admins (telegram_user_id, username, full_name, role) VALUES (?, ?, ?, 'admin')
       ON CONFLICT(telegram_user_id) DO UPDATE SET username=excluded.username, full_name=excluded.full_name`
    )
    .bind(Number(body.telegram_user_id), body.username || null, body.full_name || null)
    .run();
  return c.json({ ok: true });
});

api.delete('/admins/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.prepare("DELETE FROM bot_admins WHERE id = ? AND role != 'owner'").bind(id).run();
  return c.json({ ok: true });
});

// ====== Bot Token Management ======
api.get('/token', async (c) => {
  const token = (await getSetting(c.env.DB, 'bot_token')) || '';
  // إخفاء التوكن جزئياً لأسباب أمنية (إظهار آخر 4 أحرف فقط)
  const masked = token
    ? token.slice(0, 8) + '••••••••••••••••••' + token.slice(-4)
    : '';
  return c.json({
    has_token: !!token,
    masked,
    length: token.length,
    from_env: !!c.env.TELEGRAM_BOT_TOKEN,
  });
});

api.post('/token/test', async (c) => {
  const body: any = await c.req.json();
  const token = (body.bot_token || '').trim();
  if (!token) return c.json({ ok: false, error: 'يرجى إدخال التوكن' }, 400);
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    return c.json({ ok: false, error: 'تنسيق التوكن غير صحيح. يجب أن يكون: أرقام:حروف' }, 400);
  }
  try {
    const tg = new Telegram(token);
    const info: any = await tg.getMe();
    return c.json({
      ok: true,
      bot: {
        id: info.id,
        username: info.username,
        first_name: info.first_name,
        can_join_groups: info.can_join_groups,
        can_read_all_group_messages: info.can_read_all_group_messages,
      },
    });
  } catch (e: any) {
    return c.json({ ok: false, error: e?.message || 'التوكن غير صالح' }, 400);
  }
});

api.post('/token', async (c) => {
  const body: any = await c.req.json();
  const token = (body.bot_token || '').trim();
  if (!token) return c.json({ ok: false, error: 'يرجى إدخال التوكن' }, 400);
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    return c.json({ ok: false, error: 'تنسيق التوكن غير صحيح' }, 400);
  }
  // التحقق من صلاحية التوكن قبل الحفظ
  try {
    const tg = new Telegram(token);
    const info: any = await tg.getMe();
    await setSetting(c.env.DB, 'bot_token', token);
    await setSetting(c.env.DB, 'bot_username', info.username || '');
    await setSetting(c.env.DB, 'bot_id', String(info.id || ''));
    await logActivity(c.env.DB, 'bot_token_updated', `bot=@${info.username}`);
    return c.json({
      ok: true,
      bot: { id: info.id, username: info.username, first_name: info.first_name },
    });
  } catch (e: any) {
    return c.json({ ok: false, error: 'التوكن غير صالح: ' + (e?.message || '') }, 400);
  }
});

api.delete('/token', async (c) => {
  await setSetting(c.env.DB, 'bot_token', '');
  await logActivity(c.env.DB, 'bot_token_deleted', '');
  return c.json({ ok: true });
});

// ====== Webhook Management ======
api.get('/webhook/info', async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN || (await getSetting(c.env.DB, 'bot_token')) || '';
  if (!token) return c.json({ info: { error: 'لم يتم إعداد توكن البوت' } });
  try {
    const tg = new Telegram(token);
    const info = await tg.getWebhookInfo();
    return c.json({ info });
  } catch (e: any) {
    return c.json({ info: { error: e?.message || 'فشل' } });
  }
});

api.post('/webhook/setup', async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN || (await getSetting(c.env.DB, 'bot_token')) || '';
  if (!token) return c.json({ ok: false, error: 'لم يتم إعداد توكن البوت' }, 400);
  const url = new URL(c.req.url);
  const base = (await getSetting(c.env.DB, 'panel_url')) || `${url.protocol}//${url.host}`;
  const webhookUrl = `${base.replace(/\/$/, '')}/telegram/webhook`;
  const secret = (await getSetting(c.env.DB, 'webhook_secret')) || 'sammad-secret';
  try {
    const tg = new Telegram(token);
    await tg.setWebhook(webhookUrl, secret, true);
    await setSetting(c.env.DB, 'webhook_url', webhookUrl);
    return c.json({ ok: true, url: webhookUrl });
  } catch (e: any) {
    return c.json({ ok: false, error: e?.message }, 500);
  }
});

api.post('/webhook/delete', async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN || (await getSetting(c.env.DB, 'bot_token')) || '';
  if (!token) return c.json({ ok: false, error: 'لم يتم إعداد توكن' }, 400);
  try {
    const tg = new Telegram(token);
    await tg.deleteWebhook(false);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ ok: false, error: e?.message }, 500);
  }
});

// ====== Contacts (جهات التواصل المتعددة) ======
api.get('/contacts', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM contacts ORDER BY display_order, id').all();
  return c.json({ contacts: results });
});

api.post('/contacts', async (c) => {
  const body: any = await c.req.json();
  const r = await c.env.DB
    .prepare(
      'INSERT INTO contacts (title, description, contact_url, username, user_id, icon, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      body.title,
      body.description || null,
      body.contact_url,
      body.username || null,
      body.user_id ? Number(body.user_id) : null,
      body.icon || 'user-tie',
      Number(body.display_order || 0),
      body.is_active ?? 1
    )
    .run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});

api.post('/contacts/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  const fields = ['title', 'description', 'contact_url', 'username', 'user_id', 'icon', 'display_order', 'is_active'];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const f of fields) {
    if (f in body) {
      sets.push(`${f} = ?`);
      const isNum = ['user_id', 'display_order', 'is_active'].includes(f);
      vals.push(isNum ? (body[f] === '' || body[f] === null ? null : Number(body[f])) : body[f]);
    }
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  await c.env.DB.prepare(`UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  return c.json({ ok: true });
});

api.delete('/contacts/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM contacts WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

// ====== Main Menu Items (أزرار القائمة الرئيسية) ======
api.get('/menu-items', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM main_menu_items ORDER BY display_order, id').all();
  return c.json({ items: results });
});

api.post('/menu-items', async (c) => {
  const body: any = await c.req.json();
  const r = await c.env.DB
    .prepare(
      'INSERT INTO main_menu_items (text, icon, action_type, action_value, display_order, is_active, is_admin_only) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      body.text,
      body.icon || null,
      body.action_type || 'builtin',
      body.action_value,
      Number(body.display_order || 0),
      Number(body.is_active ?? 1),
      Number(body.is_admin_only ?? 0)
    )
    .run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});

api.post('/menu-items/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  const fields = ['text', 'icon', 'action_type', 'action_value', 'display_order', 'is_active', 'is_admin_only'];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const f of fields) {
    if (f in body) {
      sets.push(`${f} = ?`);
      const isNum = ['display_order', 'is_active', 'is_admin_only'].includes(f);
      vals.push(isNum ? Number(body[f]) : body[f]);
    }
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  await c.env.DB.prepare(`UPDATE main_menu_items SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  return c.json({ ok: true });
});

api.delete('/menu-items/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM main_menu_items WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

// ====== Inline Buttons (الأزرار الشفافة) ======
api.get('/buttons', async (c) => {
  const ownerType = c.req.query('owner_type');
  const ownerId = c.req.query('owner_id');
  let sql = 'SELECT * FROM inline_buttons';
  const binds: any[] = [];
  if (ownerType && ownerId) {
    sql += ' WHERE owner_type = ? AND owner_id = ?';
    binds.push(ownerType, Number(ownerId));
  }
  sql += ' ORDER BY owner_type, owner_id, row_index, col_index, id';
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({ buttons: results });
});

api.post('/buttons', async (c) => {
  const body: any = await c.req.json();
  const r = await c.env.DB
    .prepare(
      'INSERT INTO inline_buttons (owner_type, owner_id, text, button_type, url, callback_data, command_id, row_index, col_index, is_admin_only, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      body.owner_type || 'standalone',
      Number(body.owner_id || 0),
      body.text,
      body.button_type || 'callback',
      body.url || null,
      body.callback_data || null,
      body.command_id ? Number(body.command_id) : null,
      Number(body.row_index || 0),
      Number(body.col_index || 0),
      Number(body.is_admin_only ?? 0),
      Number(body.is_active ?? 1)
    )
    .run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});

api.post('/buttons/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  const fields = ['owner_type', 'owner_id', 'text', 'button_type', 'url', 'callback_data', 'command_id', 'row_index', 'col_index', 'is_admin_only', 'is_active'];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const f of fields) {
    if (f in body) {
      sets.push(`${f} = ?`);
      const isNum = ['owner_id', 'command_id', 'row_index', 'col_index', 'is_admin_only', 'is_active'].includes(f);
      vals.push(isNum ? (body[f] === '' || body[f] === null ? null : Number(body[f])) : body[f]);
    }
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  await c.env.DB.prepare(`UPDATE inline_buttons SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  return c.json({ ok: true });
});

api.delete('/buttons/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM inline_buttons WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

// ====== Attachments (المرفقات) ======
api.get('/attachments', async (c) => {
  const ownerType = c.req.query('owner_type');
  const ownerId = c.req.query('owner_id');
  let sql = 'SELECT * FROM attachments';
  const binds: any[] = [];
  if (ownerType && ownerId) {
    sql += ' WHERE owner_type = ? AND owner_id = ?';
    binds.push(ownerType, Number(ownerId));
  }
  sql += ' ORDER BY display_order, id';
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({ attachments: results });
});

api.post('/attachments', async (c) => {
  const body: any = await c.req.json();
  if (!body.file_id || !body.owner_type || body.owner_id === undefined) {
    return c.json({ ok: false, error: 'بيانات ناقصة' }, 400);
  }
  const r = await c.env.DB
    .prepare(
      'INSERT INTO attachments (owner_type, owner_id, file_type, file_id, file_unique_id, file_name, mime_type, file_size, caption, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      body.owner_type,
      Number(body.owner_id),
      body.file_type || 'document',
      body.file_id,
      body.file_unique_id || null,
      body.file_name || null,
      body.mime_type || null,
      body.file_size ? Number(body.file_size) : null,
      body.caption || null,
      Number(body.display_order || 0)
    )
    .run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});

api.delete('/attachments/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM attachments WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

// ====== Custom Commands (أوامر مخصصة) ======
api.get('/commands', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM custom_commands ORDER BY id DESC').all();
  return c.json({ commands: results });
});

api.post('/commands', async (c) => {
  const body: any = await c.req.json();
  const r = await c.env.DB
    .prepare(
      'INSERT INTO custom_commands (code, title, description, response_text, parse_mode, is_admin_only, is_active, trigger_command) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      body.code,
      body.title,
      body.description || null,
      body.response_text,
      body.parse_mode || 'HTML',
      Number(body.is_admin_only ?? 0),
      Number(body.is_active ?? 1),
      body.trigger_command || null
    )
    .run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});

api.post('/commands/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  const fields = ['code', 'title', 'description', 'response_text', 'parse_mode', 'is_admin_only', 'is_active', 'trigger_command'];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const f of fields) {
    if (f in body) {
      sets.push(`${f} = ?`);
      const isNum = ['is_admin_only', 'is_active'].includes(f);
      vals.push(isNum ? Number(body[f]) : body[f]);
    }
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  await c.env.DB.prepare(`UPDATE custom_commands SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  return c.json({ ok: true });
});

api.delete('/commands/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM custom_commands WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

// ====== Subscribers (مشتركو البوت) ======
api.get('/subscribers', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM bot_subscribers ORDER BY id DESC LIMIT 1000').all();
  return c.json({ subscribers: results });
});

// ====== Targets API (للاستخدام في الإذاعات) ======
api.get('/targets', async (c) => {
  const groups = (await c.env.DB.prepare("SELECT chat_id, title, type FROM groups WHERE is_active = 1 ORDER BY title").all()).results;
  const subs = (await c.env.DB.prepare("SELECT telegram_user_id AS chat_id, COALESCE(first_name || ' ' || COALESCE(last_name,''), username, telegram_user_id) AS title, 'private' AS type FROM bot_subscribers WHERE is_active = 1 ORDER BY id DESC LIMIT 500").all()).results;
  return c.json({ groups, users: subs });
});

// ====== Broadcasts (الإذاعات / المراسلة) ======
api.get('/broadcasts', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM broadcasts ORDER BY id DESC LIMIT 100').all();
  return c.json({ broadcasts: results });
});

api.post('/broadcasts', async (c) => {
  const user = c.get('user');
  const body: any = await c.req.json();
  if (!body.message_text) return c.json({ ok: false, error: 'النص مطلوب' }, 400);

  const targetType = body.target_type || 'all_users';
  const targetIds = body.target_ids ? JSON.stringify(body.target_ids) : null;

  // إنشاء سجل إذاعة
  const ins = await c.env.DB
    .prepare(
      'INSERT INTO broadcasts (title, message_text, parse_mode, target_type, target_ids, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      body.title || null,
      body.message_text,
      body.parse_mode || 'HTML',
      targetType,
      targetIds,
      'sending',
      user?.user_id || null
    )
    .run();

  const broadcastId = Number(ins.meta.last_row_id);

  // جلب التوكن
  const token = c.env.TELEGRAM_BOT_TOKEN || (await getSetting(c.env.DB, 'bot_token')) || '';
  if (!token) {
    await c.env.DB.prepare("UPDATE broadcasts SET status='failed' WHERE id=?").bind(broadcastId).run();
    return c.json({ ok: false, error: 'لا يوجد توكن للبوت' }, 400);
  }
  const tg = new Telegram(token);

  // جمع المستهدفين
  let targets: number[] = [];
  if (targetType === 'all_users') {
    const r = await c.env.DB.prepare('SELECT telegram_user_id FROM bot_subscribers WHERE is_active=1').all();
    targets = (r.results as any[]).map((x) => Number(x.telegram_user_id));
  } else if (targetType === 'all_groups') {
    const r = await c.env.DB.prepare('SELECT chat_id FROM groups WHERE is_active=1').all();
    targets = (r.results as any[]).map((x) => Number(x.chat_id));
  } else if (targetType === 'all') {
    const r1 = await c.env.DB.prepare('SELECT telegram_user_id FROM bot_subscribers WHERE is_active=1').all();
    const r2 = await c.env.DB.prepare('SELECT chat_id FROM groups WHERE is_active=1').all();
    targets = [
      ...(r1.results as any[]).map((x) => Number(x.telegram_user_id)),
      ...(r2.results as any[]).map((x) => Number(x.chat_id)),
    ];
  } else if (targetType === 'specific') {
    targets = (body.target_ids || []).map((x: any) => Number(x));
  }

  // بناء أزرار شفافة (إن وُجدت)
  const buttons = body.buttons || []; // [{text, url}|{text, callback_data}]
  let reply_markup: any = undefined;
  if (Array.isArray(buttons) && buttons.length) {
    reply_markup = { inline_keyboard: buttons.map((b: any) => [b]) };
  }

  // إرسال
  let sent = 0,
    failed = 0;
  const attachments: any[] = body.attachments || [];

  for (const chatId of targets) {
    try {
      if (attachments.length === 0) {
        await tg.sendMessage(chatId, body.message_text, { parse_mode: body.parse_mode || 'HTML', reply_markup });
      } else {
        const first = attachments[0];
        await tg.sendAttachment(chatId, first, body.message_text, { parse_mode: body.parse_mode || 'HTML', reply_markup });
        for (let i = 1; i < attachments.length; i++) {
          await tg.sendAttachment(chatId, attachments[i], attachments[i].caption || '', {});
        }
      }
      sent++;
    } catch (e) {
      failed++;
    }
    // تأخير بسيط لتجنب limit
    await new Promise((r) => setTimeout(r, 35));
  }

  await c.env.DB
    .prepare(
      "UPDATE broadcasts SET status='completed', total_targets=?, sent_count=?, failed_count=?, sent_at=CURRENT_TIMESTAMP WHERE id=?"
    )
    .bind(targets.length, sent, failed, broadcastId)
    .run();

  await logActivity(c.env.DB, 'broadcast_sent', `id=${broadcastId} sent=${sent} failed=${failed}`, user?.user_id);
  return c.json({ ok: true, id: broadcastId, sent, failed, total: targets.length });
});

api.delete('/broadcasts/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM broadcasts WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

// إرسال رسالة فردية مباشرة (نص + ملفات + أزرار) لمستلم واحد
api.post('/send-direct', async (c) => {
  const body: any = await c.req.json();
  if (!body.chat_id || !body.message_text) return c.json({ ok: false, error: 'البيانات ناقصة' }, 400);

  const token = c.env.TELEGRAM_BOT_TOKEN || (await getSetting(c.env.DB, 'bot_token')) || '';
  if (!token) return c.json({ ok: false, error: 'لا يوجد توكن للبوت' }, 400);
  const tg = new Telegram(token);

  let reply_markup: any = undefined;
  const buttons = body.buttons || [];
  if (Array.isArray(buttons) && buttons.length) {
    reply_markup = { inline_keyboard: buttons.map((b: any) => [b]) };
  }

  try {
    const attachments = body.attachments || [];
    if (attachments.length === 0) {
      await tg.sendMessage(Number(body.chat_id), body.message_text, { reply_markup });
    } else {
      await tg.sendAttachment(Number(body.chat_id), attachments[0], body.message_text, { reply_markup });
      for (let i = 1; i < attachments.length; i++) {
        await tg.sendAttachment(Number(body.chat_id), attachments[i], attachments[i].caption || '', {});
      }
    }
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ ok: false, error: e?.message || 'فشل الإرسال' }, 500);
  }
});

// ====== Reply to Request from Panel ======
api.post('/requests/:id/reply', async (c) => {
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  const replyText = (body.reply_text || '').trim();
  if (!replyText) return c.json({ ok: false, error: 'النص مطلوب' }, 400);

  const request: any = await c.env.DB.prepare('SELECT * FROM requests WHERE id = ?').bind(id).first();
  if (!request) return c.json({ ok: false, error: 'الطلب غير موجود' }, 404);

  const token = c.env.TELEGRAM_BOT_TOKEN || (await getSetting(c.env.DB, 'bot_token')) || '';
  if (!token) return c.json({ ok: false, error: 'لا يوجد توكن' }, 400);
  const tg = new Telegram(token);

  // حفظ الرد
  await c.env.DB
    .prepare('INSERT INTO request_replies (request_id, reply_text, replied_by) VALUES (?, ?, ?)')
    .bind(id, replyText, c.get('user')?.user_id || 0)
    .run();
  await c.env.DB
    .prepare("UPDATE requests SET status='answered', admin_response=?, updated_at=CURRENT_TIMESTAMP WHERE id = ?")
    .bind(replyText, id)
    .run();

  // إرسال للمستخدم
  try {
    const escapeHtml = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await tg.sendMessage(
      Number(request.telegram_user_id),
      `📨 <b>رد على طلبك #${id}</b>\n\n` +
        `<b>طلبك السابق:</b>\n<i>${escapeHtml(request.content || '')}</i>\n\n` +
        `<b>الرد:</b>\n${escapeHtml(replyText)}`,
      { reply_markup: { inline_keyboard: [[{ text: '🏠 القائمة الرئيسية', callback_data: 'menu:main' }]] } }
    );
    await logActivity(c.env.DB, 'panel_reply_sent', `request=${id}`);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ ok: true, warning: 'تم حفظ الرد لكن تعذّر إرساله: ' + (e?.message || '') });
  }
});

// قائمة الردود لطلب معين
api.get('/requests/:id/replies', async (c) => {
  const id = Number(c.req.param('id'));
  const { results } = await c.env.DB
    .prepare('SELECT * FROM request_replies WHERE request_id = ? ORDER BY id ASC')
    .bind(id)
    .all();
  return c.json({ replies: results });
});

// ====== Upload File to Telegram (للحصول على file_id) ======
api.post('/upload-to-telegram', async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN || (await getSetting(c.env.DB, 'bot_token')) || '';
  if (!token) return c.json({ ok: false, error: 'لا يوجد توكن للبوت' }, 400);

  // معرف المالك أو المشرف الحالي لاستقبال الرسالة
  const ownerId = Number((await getSetting(c.env.DB, 'owner_user_id')) || '0');
  if (!ownerId) return c.json({ ok: false, error: 'يجب أن يبدأ المالك المحادثة مع البوت أولاً' }, 400);

  const form = await c.req.formData();
  const file = form.get('file') as File | null;
  const caption = (form.get('caption') as string) || '';
  const fileType = (form.get('file_type') as string) || 'document';
  if (!file) return c.json({ ok: false, error: 'لم يتم رفع ملف' }, 400);

  // إعداد FormData لـ telegram
  const tgForm = new FormData();
  tgForm.append('chat_id', String(ownerId));
  if (caption) tgForm.append('caption', caption);
  tgForm.append('disable_notification', 'true');

  let method = 'sendDocument';
  let fieldName = 'document';
  if (fileType === 'photo') { method = 'sendPhoto'; fieldName = 'photo'; }
  else if (fileType === 'video') { method = 'sendVideo'; fieldName = 'video'; }
  else if (fileType === 'audio') { method = 'sendAudio'; fieldName = 'audio'; }
  else if (fileType === 'voice') { method = 'sendVoice'; fieldName = 'voice'; }
  else if (fileType === 'animation') { method = 'sendAnimation'; fieldName = 'animation'; }

  tgForm.append(fieldName, file, file.name);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      body: tgForm,
    });
    const data: any = await res.json();
    if (!data.ok) return c.json({ ok: false, error: data.description || 'فشل الرفع' }, 400);

    const msg = data.result;
    let attachment: any = {
      file_type: fileType,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      caption: caption || null,
    };
    if (fileType === 'photo' && msg.photo) {
      const p = msg.photo[msg.photo.length - 1];
      attachment.file_id = p.file_id;
      attachment.file_unique_id = p.file_unique_id;
    } else if (msg[fileType]) {
      attachment.file_id = msg[fileType].file_id;
      attachment.file_unique_id = msg[fileType].file_unique_id;
    }
    return c.json({ ok: true, attachment });
  } catch (e: any) {
    return c.json({ ok: false, error: e?.message || 'فشل الرفع' }, 500);
  }
});

// ====== Account ======
api.post('/account/password', async (c) => {
  const user = c.get('user');
  const body: any = await c.req.json();
  const salt = c.env.PANEL_SALT || 'sammad2026';

  const row: any = await c.env.DB
    .prepare('SELECT password_hash FROM panel_users WHERE id = ?')
    .bind(user.user_id)
    .first();
  if (!row) return c.json({ error: 'غير موجود' }, 404);

  const ok = await verifyPassword(body.current, salt, row.password_hash);
  if (!ok) return c.json({ error: 'كلمة المرور الحالية غير صحيحة' }, 400);

  const newHash = await hashPassword(body.new, salt);
  await c.env.DB
    .prepare('UPDATE panel_users SET password_hash = ? WHERE id = ?')
    .bind(newHash, user.user_id)
    .run();
  return c.json({ ok: true });
});

// ====== Reply Keyboard Items (الأزرار الدائمة) ======
api.get('/reply-keyboard', async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT * FROM reply_keyboard_items ORDER BY row_index, col_index, id')
    .all();
  return c.json({ items: results });
});

api.post('/reply-keyboard', async (c) => {
  const body: any = await c.req.json();
  const r = await c.env.DB
    .prepare(
      'INSERT INTO reply_keyboard_items (text, action_type, action_value, row_index, col_index, is_active, is_admin_only) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      body.text,
      body.action_type || 'builtin',
      body.action_value,
      Number(body.row_index || 0),
      Number(body.col_index || 0),
      Number(body.is_active ?? 1),
      Number(body.is_admin_only ?? 0)
    )
    .run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});

api.post('/reply-keyboard/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  const fields = ['text', 'action_type', 'action_value', 'row_index', 'col_index', 'is_active', 'is_admin_only'];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const f of fields) {
    if (f in body) {
      sets.push(`${f} = ?`);
      const isNum = ['row_index', 'col_index', 'is_active', 'is_admin_only'].includes(f);
      vals.push(isNum ? Number(body[f]) : body[f]);
    }
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  await c.env.DB.prepare(`UPDATE reply_keyboard_items SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  return c.json({ ok: true });
});

api.delete('/reply-keyboard/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM reply_keyboard_items WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

// ====== Grades (الدرجات) ======
api.get('/grades', async (c) => {
  const search = c.req.query('q') || '';
  let sql = 'SELECT * FROM grades';
  const binds: any[] = [];
  if (search) {
    sql += ' WHERE academic_id LIKE ? OR student_name LIKE ?';
    binds.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY academic_id, semester, subject_name LIMIT 1000';
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({ grades: results });
});

api.delete('/grades/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM grades WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

api.post('/grades/clear', async (c) => {
  await c.env.DB.prepare('DELETE FROM grades').run();
  await logActivity(c.env.DB, 'grades_cleared', '');
  return c.json({ ok: true });
});

// رفع CSV للدرجات (parsing CSV server-side via JSON payload)
api.post('/grades/upload', async (c) => {
  const body: any = await c.req.json();
  const rows: any[] = body.rows || [];
  const replace = !!body.replace;
  if (!Array.isArray(rows) || rows.length === 0) {
    return c.json({ ok: false, error: 'لا توجد بيانات لرفعها' }, 400);
  }

  if (replace) {
    await c.env.DB.prepare('DELETE FROM grades').run();
  }

  let inserted = 0;
  let failed = 0;
  // batch insert
  const stmt = c.env.DB.prepare(
    `INSERT INTO grades (academic_id, student_name, college, level, semester, subject_name,
       attendance_score, participation_score, assignments_score, midterm_score, final_score,
       total_score, grade_label, credit_hours, is_remaining) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const r of rows) {
    try {
      if (!r.academic_id || !r.semester || !r.subject_name) { failed++; continue; }
      await stmt.bind(
        String(r.academic_id),
        r.student_name || null,
        r.college || null,
        r.level || null,
        String(r.semester),
        String(r.subject_name),
        Number(r.attendance_score || 0),
        Number(r.participation_score || 0),
        Number(r.assignments_score || 0),
        Number(r.midterm_score || 0),
        Number(r.final_score || 0),
        Number(r.total_score || 0),
        r.grade_label || null,
        Number(r.credit_hours || 1),
        Number(r.is_remaining || 0)
      ).run();
      inserted++;
    } catch (_) {
      failed++;
    }
  }

  // إعادة بناء قائمة الفصول التلقائياً
  const semsR = await c.env.DB.prepare('SELECT DISTINCT semester FROM grades ORDER BY semester').all();
  for (const row of (semsR.results as any[]) || []) {
    await c.env.DB
      .prepare('INSERT OR IGNORE INTO allowed_semesters (semester, is_allowed) VALUES (?, 1)')
      .bind(row.semester).run();
  }

  await logActivity(c.env.DB, 'grades_uploaded', `inserted=${inserted} failed=${failed}`);
  return c.json({ ok: true, inserted, failed, total: rows.length });
});

// ====== Allowed Semesters (الفصول المسموح بها للطلاب) ======
api.get('/allowed-semesters', async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT * FROM allowed_semesters ORDER BY semester').all();
  return c.json({ semesters: results });
});

api.post('/allowed-semesters/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  await c.env.DB
    .prepare('UPDATE allowed_semesters SET is_allowed=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .bind(Number(body.is_allowed ? 1 : 0), id).run();
  return c.json({ ok: true });
});

// ====== Bot Stats Health (current bot info) ======
api.get('/bot-info', async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN || (await getSetting(c.env.DB, 'bot_token')) || '';
  if (!token) return c.json({ ok: false, error: 'لا يوجد توكن' });
  try {
    const tg = new Telegram(token);
    const me = await tg.getMe();
    return c.json({ ok: true, me });
  } catch (e: any) {
    return c.json({ ok: false, error: e?.message });
  }
});


// ============================================
// ====== Unified Buttons (الأزرار الموحدة) ======
// واجهة موحدة تستبدل main_menu_items + reply_keyboard_items
// placement: 'inline' | 'reply' | 'both'
// ============================================
api.get('/unified-buttons', async (c) => {
  const placement = c.req.query('placement') || '';
  let sql = 'SELECT * FROM unified_buttons';
  const binds: any[] = [];
  if (placement) {
    sql += ' WHERE placement = ? OR placement = ?';
    binds.push(placement, 'both');
  }
  sql += ' ORDER BY display_order, row_index, col_index, id';
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({ buttons: results });
});

api.post('/unified-buttons', async (c) => {
  const b: any = await c.req.json();
  const r = await c.env.DB.prepare(
    `INSERT INTO unified_buttons
      (text, icon, emoji, placement, action_type, action_value, row_index, col_index,
       display_order, color, size, full_width, is_active, is_admin_only, show_in_groups)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    String(b.text || ''),
    b.icon || null,
    b.emoji || null,
    b.placement || 'inline',
    b.action_type || 'builtin',
    String(b.action_value || ''),
    Number(b.row_index || 0),
    Number(b.col_index || 0),
    Number(b.display_order || 0),
    b.color || 'emerald',
    b.size || 'md',
    Number(b.full_width ? 1 : 0),
    Number(b.is_active ? 1 : 0),
    Number(b.is_admin_only ? 1 : 0),
    Number(b.show_in_groups ? 1 : 0)
  ).run();
  await logActivity(c.env.DB, 'unified_button_created', JSON.stringify({ id: r.meta.last_row_id, text: b.text }));
  return c.json({ ok: true, id: r.meta.last_row_id });
});

api.post('/unified-buttons/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const b: any = await c.req.json();
  const fields: string[] = [];
  const binds: any[] = [];
  const allow = ['text','icon','emoji','placement','action_type','action_value',
                 'row_index','col_index','display_order','color','size','full_width',
                 'is_active','is_admin_only','show_in_groups'];
  for (const k of allow) {
    if (k in b) {
      fields.push(`${k}=?`);
      const v = b[k];
      if (['row_index','col_index','display_order','full_width','is_active','is_admin_only','show_in_groups'].includes(k)) {
        binds.push(Number(v ? v : 0));
      } else {
        binds.push(v == null ? null : String(v));
      }
    }
  }
  if (!fields.length) return c.json({ ok: false, error: 'لا تغييرات' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  binds.push(id);
  await c.env.DB.prepare(`UPDATE unified_buttons SET ${fields.join(', ')} WHERE id=?`).bind(...binds).run();
  return c.json({ ok: true });
});

api.delete('/unified-buttons/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.prepare('DELETE FROM unified_buttons WHERE id=?').bind(id).run();
  return c.json({ ok: true });
});

api.post('/unified-buttons/reorder', async (c) => {
  const body: any = await c.req.json();
  const items: any[] = body.items || [];
  for (const it of items) {
    await c.env.DB.prepare(
      'UPDATE unified_buttons SET display_order=?, row_index=?, col_index=? WHERE id=?'
    ).bind(
      Number(it.display_order || 0),
      Number(it.row_index || 0),
      Number(it.col_index || 0),
      Number(it.id)
    ).run();
  }
  return c.json({ ok: true, updated: items.length });
});

// ============================================
// ====== Streaming Grades Upload (CSV ضخم) ======
// خطوات: init -> chunk (متعددة) -> finalize
// ============================================
api.post('/grades/upload/init', async (c) => {
  const body: any = await c.req.json().catch(() => ({}));
  const totalChunks = Number(body.total_chunks || 0);
  const replace = body.replace ? 1 : 0;
  const token = `up_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await c.env.DB.prepare(
    `INSERT INTO grades_upload_jobs
      (upload_token, status, total_chunks, replace_mode)
     VALUES (?, 'running', ?, ?)`
  ).bind(token, totalChunks, replace).run();
  if (replace) {
    try { await c.env.DB.prepare('DELETE FROM grades').run(); } catch (_) {}
  }
  return c.json({ ok: true, upload_token: token });
});

api.post('/grades/upload/chunk', async (c) => {
  const body: any = await c.req.json();
  const token = String(body.upload_token || '');
  const rows: any[] = body.rows || [];
  if (!token) return c.json({ ok: false, error: 'upload_token مفقود' }, 400);
  if (!rows.length) return c.json({ ok: true, inserted: 0, failed: 0 });

  let inserted = 0, failed = 0;
  // BATCH = حجم الـ statements داخل D1.batch()
  // D1 يقبل حتى 100 statement لكن مع أعمدة كثيرة (50+) نقلل لـ 25 للأمان
  const BATCH = 25;

  // Helpers لتطبيع القيم
  const num = (v: any, def = 0) => {
    if (v == null || v === '') return def;
    const n = Number(String(v).replace(/,/g, '.'));
    return isNaN(n) ? def : n;
  };
  const boolish = (v: any): number => {
    if (v == null) return 0;
    const s = String(v).trim().toLowerCase();
    if (s === '1' || s === 'true' || s === 'yes' || s === 'نعم') return 1;
    return 0;
  };
  // حساب المجموع التلقائي إذا لم يكن موجوداً
  const computeTotal = (r: any): number => {
    const t = num(r.total_score, NaN);
    if (!isNaN(t) && t > 0) return t;
    // مجموع المكونات: حضور + مشاركة + تكاليف + نصفي + نهائي + شفهي + خطابة
    let sum = 0;
    sum += num(r.attendance_score) + num(r.participation_score) + num(r.assignments_score);
    sum += num(r.midterm_score) + num(r.final_score);
    sum += num(r.theory_midterm) + num(r.practical_midterm) + num(r.theory_final) + num(r.practical_final);
    sum += num(r.oral_recitation_mid) + num(r.oral_memorize_mid) + num(r.oral_recitation_final) + num(r.oral_memorize_final);
    return sum;
  };
  // تحديد is_remaining من حقل "مبقي" أو من إجمالي < درجة النجاح
  const computeIsRemaining = (r: any, total: number): number => {
    if (r.is_remaining != null && r.is_remaining !== '') return boolish(r.is_remaining);
    const passing = num(r.passing_score, 50);
    return total < passing ? 1 : 0;
  };

  // عمود grade_label تلقائي إن لم يكن موجوداً
  const computeGradeLabel = (r: any, total: number): string => {
    if (r.grade_label) return String(r.grade_label);
    if (total >= 90) return 'ممتاز';
    if (total >= 80) return 'جيد جداً';
    if (total >= 70) return 'جيد';
    if (total >= 60) return 'مقبول';
    if (total >= 50) return 'ضعيف';
    return 'راسب';
  };

  const insertSql = `INSERT INTO grades
    (academic_id, student_name, college, level, semester, subject_name,
     attendance_score, participation_score, assignments_score, midterm_score, final_score,
     total_score, grade_label, credit_hours, is_remaining,
     secret_code, branch_name, branch_id, academic_year, semester_id, specialization,
     subject_id, group_name, group_id, housing_type, survey_required, attachments,
     theory_midterm, practical_midterm, theory_final, practical_final,
     oral_recitation_mid, oral_memorize_mid, oral_recitation_final, oral_memorize_final,
     khutbah_writing, hall_delivery, opening_score, hand_movement, clothing_score,
     voice_level, topic_consistency, confidence_level, influence_score, preparation_score,
     summarization_score, topic_unity, khutbah_writing2, khutbah_in_mosque,
     promotion_status, bitdaragat3, id_daragat, passing_score, follows_quran)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?)`;

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const stmts: D1PreparedStatement[] = [];
    for (const r of slice) {
      try {
        if (!r.academic_id || !r.semester || !r.subject_name) { failed++; continue; }
        const total = computeTotal(r);
        const isRem = computeIsRemaining(r, total);
        const gradeLabel = computeGradeLabel(r, total);
        stmts.push(
          c.env.DB.prepare(insertSql).bind(
            String(r.academic_id),
            r.student_name || null,
            r.college || null,
            r.level || null,
            String(r.semester),
            String(r.subject_name),
            num(r.attendance_score),
            num(r.participation_score),
            num(r.assignments_score),
            num(r.midterm_score),
            num(r.final_score),
            total,
            gradeLabel,
            num(r.credit_hours, 1),
            isRem,
            r.secret_code || null,
            r.branch_name || null,
            r.branch_id || null,
            r.academic_year || null,
            r.semester_id || null,
            r.specialization || null,
            r.subject_id || null,
            r.group_name || null,
            r.group_id || null,
            r.housing_type || null,
            r.survey_required || null,
            r.attachments || null,
            num(r.theory_midterm),
            num(r.practical_midterm),
            num(r.theory_final),
            num(r.practical_final),
            num(r.oral_recitation_mid),
            num(r.oral_memorize_mid),
            num(r.oral_recitation_final),
            num(r.oral_memorize_final),
            num(r.khutbah_writing),
            num(r.hall_delivery),
            num(r.opening_score),
            num(r.hand_movement),
            num(r.clothing_score),
            num(r.voice_level),
            num(r.topic_consistency),
            num(r.confidence_level),
            num(r.influence_score),
            num(r.preparation_score),
            num(r.summarization_score),
            num(r.topic_unity),
            num(r.khutbah_writing2),
            num(r.khutbah_in_mosque),
            r.promotion_status || null,
            r.bitdaragat3 || null,
            r.id_daragat || null,
            num(r.passing_score, 50),
            r.follows_quran || null
          )
        );
      } catch (_) { failed++; }
    }
    if (stmts.length) {
      try {
        await c.env.DB.batch(stmts);
        inserted += stmts.length;
      } catch (e) {
        for (const s of stmts) {
          try { await s.run(); inserted++; } catch (_) { failed++; }
        }
      }
    }
  }

  await c.env.DB.prepare(
    `UPDATE grades_upload_jobs
     SET inserted_rows = inserted_rows + ?, failed_rows = failed_rows + ?,
         received_chunks = received_chunks + 1, total_rows = total_rows + ?
     WHERE upload_token = ?`
  ).bind(inserted, failed, rows.length, token).run();

  return c.json({ ok: true, inserted, failed });
});

api.post('/grades/upload/finalize', async (c) => {
  const body: any = await c.req.json();
  const token = String(body.upload_token || '');
  if (!token) return c.json({ ok: false, error: 'upload_token مفقود' }, 400);

  const semsR = await c.env.DB.prepare('SELECT DISTINCT semester FROM grades ORDER BY semester').all();
  for (const row of (semsR.results as any[]) || []) {
    await c.env.DB
      .prepare('INSERT OR IGNORE INTO allowed_semesters (semester, is_allowed) VALUES (?, 1)')
      .bind(row.semester).run();
  }

  await c.env.DB.prepare(
    "UPDATE grades_upload_jobs SET status='completed', finished_at=CURRENT_TIMESTAMP WHERE upload_token=?"
  ).bind(token).run();

  const job: any = await c.env.DB
    .prepare('SELECT * FROM grades_upload_jobs WHERE upload_token=?')
    .bind(token).first();

  await logActivity(c.env.DB, 'grades_uploaded',
    `token=${token} inserted=${job?.inserted_rows} failed=${job?.failed_rows}`);
  return c.json({ ok: true, job });
});

api.get('/grades/upload/status', async (c) => {
  const token = c.req.query('token') || '';
  if (!token) return c.json({ ok: false, error: 'token مفقود' }, 400);
  const job: any = await c.env.DB
    .prepare('SELECT * FROM grades_upload_jobs WHERE upload_token=?')
    .bind(token).first();
  return c.json({ ok: true, job });
});

api.get('/grades/count', async (c) => {
  const r: any = await c.env.DB.prepare('SELECT COUNT(*) AS c FROM grades').first();
  const semsR: any = await c.env.DB.prepare('SELECT COUNT(DISTINCT semester) AS c FROM grades').first();
  const stuR: any = await c.env.DB.prepare('SELECT COUNT(DISTINCT academic_id) AS c FROM grades').first();
  return c.json({ ok: true, total: r?.c || 0, semesters: semsR?.c || 0, students: stuR?.c || 0 });
});

// ============================================
// ====== Bot Texts (محرر نصوص البوت) ======
// ============================================
api.get('/texts', async (c) => {
  const category = c.req.query('category') || '';
  const q = c.req.query('q') || '';
  let sql = 'SELECT id, key, category, label, default_value, value, description, placeholders, supports_html, is_active, updated_at FROM bot_texts WHERE 1=1';
  const params: any[] = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (q) { sql += ' AND (label LIKE ? OR key LIKE ? OR value LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY category, id';
  const stmt = c.env.DB.prepare(sql);
  const { results } = params.length ? await stmt.bind(...params).all() : await stmt.all();
  return c.json({ ok: true, texts: results || [] });
});

api.post('/texts/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  const newValue = String(body.value ?? '');
  await c.env.DB.prepare(
    'UPDATE bot_texts SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(newValue, id).run();
  await logActivity(c.env.DB, 'bot_text_updated', `id=${id}`);
  return c.json({ ok: true });
});

api.post('/texts/:id/reset', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.prepare(
    'UPDATE bot_texts SET value = default_value, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(id).run();
  await logActivity(c.env.DB, 'bot_text_reset', `id=${id}`);
  return c.json({ ok: true });
});

api.post('/texts/reset-all', async (c) => {
  await c.env.DB.prepare(
    'UPDATE bot_texts SET value = default_value, updated_at = CURRENT_TIMESTAMP'
  ).run();
  await logActivity(c.env.DB, 'bot_texts_reset_all', '');
  return c.json({ ok: true });
});

// ============================================
// ====== Academic Levels & Semesters ======
// ============================================
api.get('/academic/levels', async (c) => {
  try {
    const { results } = await c.env.DB
      .prepare('SELECT * FROM academic_levels ORDER BY display_order, id')
      .all();
    return c.json({ levels: results });
  } catch (e: any) {
    return c.json({ levels: [], error: e?.message }, 200);
  }
});

api.post('/academic/levels', async (c) => {
  const body: any = await c.req.json();
  const name = String(body.name || '').trim();
  if (!name) return c.json({ error: 'الاسم مطلوب' }, 400);
  const r = await c.env.DB
    .prepare(
      `INSERT INTO academic_levels (name, display_order, is_active)
       VALUES (?, ?, 1)
       ON CONFLICT(name) DO UPDATE SET display_order=excluded.display_order, is_active=1`
    )
    .bind(name, Number(body.display_order || 0))
    .run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});

api.post('/academic/levels/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  const sets: string[] = [];
  const vals: any[] = [];
  if ('name' in body) { sets.push('name = ?'); vals.push(String(body.name)); }
  if ('display_order' in body) { sets.push('display_order = ?'); vals.push(Number(body.display_order)); }
  if ('is_active' in body) { sets.push('is_active = ?'); vals.push(Number(body.is_active)); }
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  await c.env.DB.prepare(`UPDATE academic_levels SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  return c.json({ ok: true });
});

api.delete('/academic/levels/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.prepare('DELETE FROM academic_levels WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

api.get('/academic/semesters', async (c) => {
  try {
    const { results } = await c.env.DB
      .prepare('SELECT * FROM academic_semesters ORDER BY display_order, id')
      .all();
    return c.json({ semesters: results });
  } catch (e: any) {
    return c.json({ semesters: [], error: e?.message }, 200);
  }
});

api.post('/academic/semesters', async (c) => {
  const body: any = await c.req.json();
  const name = String(body.name || '').trim();
  const short_name = String(body.short_name || '').trim();
  if (!name || !short_name) return c.json({ error: 'الاسم والاسم المختصر مطلوبان' }, 400);
  const r = await c.env.DB
    .prepare(
      `INSERT INTO academic_semesters (name, short_name, level_name, display_order, is_active)
       VALUES (?, ?, ?, ?, 1)`
    )
    .bind(name, short_name, body.level_name || null, Number(body.display_order || 0))
    .run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});

api.post('/academic/semesters/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  const sets: string[] = [];
  const vals: any[] = [];
  for (const k of ['name', 'short_name', 'level_name', 'display_order', 'is_active']) {
    if (k in body) {
      sets.push(`${k} = ?`);
      vals.push(k === 'display_order' || k === 'is_active' ? Number(body[k]) : body[k]);
    }
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  await c.env.DB
    .prepare(`UPDATE academic_semesters SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...vals)
    .run();
  return c.json({ ok: true });
});

api.delete('/academic/semesters/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.prepare('DELETE FROM academic_semesters WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// ============================================
// ====== Web Push (VAPID + Devices) ======
// ============================================

// مفتاح VAPID العام (يحتاج إليه المتصفح لتسجيل الـ subscription)
api.get('/push/public-key', async (c) => {
  try {
    const key = await getVapidPublicKey(c.env.DB);
    return c.json({ public_key: key });
  } catch (e: any) {
    return c.json({ error: e?.message }, 500);
  }
});

// تسجيل جهاز/متصفح جديد للإشعارات
api.post('/push/subscribe', async (c) => {
  const user = c.get('user');
  const body: any = await c.req.json();
  const endpoint = String(body.endpoint || '');
  // قبول p256dh من كل من body.keys.p256dh أو body.p256dh مباشرة (تتوافق مع الواجهة)
  const p256dh = String(body.keys?.p256dh || body.p256dh || '');
  const auth = String(body.keys?.auth || body.auth || '');
  const deviceLabel = String(body.device_label || body.label || '');
  const userAgent = String(body.user_agent || body.ua || '');
  if (!endpoint || !p256dh || !auth) {
    return c.json({ error: 'بيانات الاشتراك غير مكتملة' }, 400);
  }

  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';

  // إنشاء أو تحديث
  await c.env.DB
    .prepare(
      `INSERT INTO push_devices (panel_user_id, endpoint, p256dh_key, auth_key, device_label, user_agent, ip_address, is_enabled, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(endpoint) DO UPDATE SET
         panel_user_id=excluded.panel_user_id,
         p256dh_key=excluded.p256dh_key,
         auth_key=excluded.auth_key,
         device_label=COALESCE(NULLIF(excluded.device_label,''), device_label),
         user_agent=excluded.user_agent,
         ip_address=excluded.ip_address,
         is_enabled=1,
         last_used_at=CURRENT_TIMESTAMP`
    )
    .bind(user.user_id, endpoint, p256dh, auth, deviceLabel || null, userAgent || null, ip || null)
    .run();

  const r: any = await c.env.DB
    .prepare('SELECT id FROM push_devices WHERE endpoint = ?')
    .bind(endpoint)
    .first();
  return c.json({ ok: true, device_id: r?.id });
});

// إلغاء اشتراك (إزالة)
api.post('/push/unsubscribe', async (c) => {
  const body: any = await c.req.json();
  const endpoint = String(body.endpoint || '');
  if (!endpoint) return c.json({ error: 'endpoint مفقود' }, 400);
  await c.env.DB.prepare('DELETE FROM push_devices WHERE endpoint = ?').bind(endpoint).run();
  return c.json({ ok: true });
});

// قائمة الأجهزة المسجلة (لمستخدم اللوحة الحالي)
api.get('/push/devices', async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB
    .prepare(
      `SELECT id, endpoint, device_label AS label, user_agent, ip_address, is_enabled AS enabled, last_used_at, created_at
       FROM push_devices WHERE panel_user_id = ? ORDER BY created_at DESC`
    )
    .bind(user.user_id)
    .all();
  return c.json({ devices: results, items: results });
});

// قائمة كل الأجهزة لكل المستخدمين (للمالك)
api.get('/push/all-devices', async (c) => {
  const user = c.get('user');
  // فقط المالك يستطيع رؤية الكل
  if (user.role !== 'owner') return c.json({ devices: [], items: [] });
  const { results } = await c.env.DB
    .prepare(
      `SELECT pd.id, pd.endpoint, pd.device_label AS label, pd.user_agent, pd.ip_address,
              pd.is_enabled AS enabled, pd.last_used_at, pd.created_at, pd.panel_user_id AS user_id,
              pu.username, pu.full_name AS panel_full_name
       FROM push_devices pd
       LEFT JOIN panel_users pu ON pu.id = pd.panel_user_id
       ORDER BY pd.created_at DESC`
    )
    .all();
  return c.json({ devices: results, items: results });
});

// تفعيل/تعطيل جهاز
api.post('/push/devices/:id', async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  const body: any = await c.req.json();
  // المالك يستطيع تعديل أي جهاز، غيره فقط أجهزته
  let where = 'id = ?';
  const args: any[] = [id];
  if (user.role !== 'owner') {
    where += ' AND panel_user_id = ?';
    args.push(user.user_id);
  }
  const sets: string[] = [];
  const vals: any[] = [];
  // قبول 'enabled' أو 'is_enabled' من الواجهة
  if ('is_enabled' in body || 'enabled' in body) {
    sets.push('is_enabled = ?');
    vals.push(Number(body.is_enabled ?? body.enabled));
  }
  if ('device_label' in body || 'label' in body) {
    sets.push('device_label = ?');
    vals.push(String(body.device_label || body.label || ''));
  }
  if (!sets.length) return c.json({ ok: true });
  await c.env.DB
    .prepare(`UPDATE push_devices SET ${sets.join(', ')} WHERE ${where}`)
    .bind(...vals, ...args)
    .run();
  return c.json({ ok: true });
});

// حذف جهاز
api.delete('/push/devices/:id', async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  if (user.role === 'owner') {
    await c.env.DB.prepare('DELETE FROM push_devices WHERE id = ?').bind(id).run();
  } else {
    await c.env.DB
      .prepare('DELETE FROM push_devices WHERE id = ? AND panel_user_id = ?')
      .bind(id, user.user_id)
      .run();
  }
  return c.json({ ok: true });
});

// إرسال إشعار اختبار للمستخدم الحالي
api.post('/push/test', async (c) => {
  const user = c.get('user');
  const r = await sendWebPushToUser(c.env.DB, user.user_id, {
    title: '🔔 إشعار اختبار',
    body: 'إذا وصلك هذا الإشعار، فالنظام يعمل بشكل صحيح!',
    url: '/admin/dashboard',
  });
  return c.json({ ok: true, ...r });
});

// قائمة سجل الإشعارات
api.get('/notifications/log', async (c) => {
  const { results } = await c.env.DB
    .prepare(
      `SELECT n.*, ba.username AS handled_by_username, ba.full_name AS handled_by_name
       FROM notifications_log n
       LEFT JOIN bot_admins ba ON ba.telegram_user_id = n.handled_by_admin
       ORDER BY n.id DESC LIMIT 200`
    )
    .all();
  return c.json({ log: results });
});

// ============================================
// ====== Admin Routing (per-admin event channel) ======
// ============================================
api.get('/admin-routing', async (c) => {
  // قائمة كل المشرفين + المالك + توجيهاتهم
  const { results: admins } = await c.env.DB
    .prepare(
      `SELECT telegram_user_id, username, full_name, role FROM bot_admins ORDER BY role, id`
    )
    .all();
  const { results: routing } = await c.env.DB
    .prepare('SELECT * FROM admin_routing')
    .all();
  return c.json({ admins, routing });
});

api.post('/admin-routing', async (c) => {
  const body: any = await c.req.json();
  const telegram_user_id = Number(body.telegram_user_id);
  const event_type = String(body.event_type || 'all');
  const channel = String(body.channel || 'telegram'); // telegram | webpush | both | none
  const is_active = Number(body.is_active ?? 1);
  if (!telegram_user_id) return c.json({ error: 'telegram_user_id مفقود' }, 400);
  await c.env.DB
    .prepare(
      `INSERT INTO admin_routing (telegram_user_id, event_type, channel, is_active, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(telegram_user_id, event_type) DO UPDATE SET
         channel=excluded.channel,
         is_active=excluded.is_active,
         updated_at=CURRENT_TIMESTAMP`
    )
    .bind(telegram_user_id, event_type, channel, is_active)
    .run();
  return c.json({ ok: true });
});

api.delete('/admin-routing/:telegram_user_id/:event_type', async (c) => {
  const telegram_user_id = Number(c.req.param('telegram_user_id'));
  const event_type = c.req.param('event_type');
  await c.env.DB
    .prepare('DELETE FROM admin_routing WHERE telegram_user_id = ? AND event_type = ?')
    .bind(telegram_user_id, event_type)
    .run();
  return c.json({ ok: true });
});

// ============================================
// ====== Bot Command Whitelist (link-deletion exclusions) ======
// ============================================
api.get('/bot-commands', async (c) => {
  try {
    const { results: builtin } = await c.env.DB
      .prepare('SELECT * FROM bot_command_whitelist ORDER BY id')
      .all();
    const { results: custom } = await c.env.DB
      .prepare('SELECT trigger_command FROM custom_commands WHERE is_active = 1')
      .all();
    return c.json({ builtin, custom });
  } catch (e: any) {
    return c.json({ builtin: [], custom: [], error: e?.message });
  }
});

// تهيئة مفتاح VAPID (يستدعى مرة واحدة من الـ JS)
api.post('/push/init', async (c) => {
  await ensureVapidKeys(c.env.DB);
  const pub = await getVapidPublicKey(c.env.DB);
  return c.json({ ok: true, public_key: pub });
});

// تحديث رابط ربط الـ panel_user بـ telegram_user_id (للوحدة)
api.post('/account/telegram-link', async (c) => {
  const user = c.get('user');
  const body: any = await c.req.json();
  const tid = Number(body.telegram_user_id || 0);
  if (!tid) return c.json({ error: 'telegram_user_id مفقود' }, 400);
  // محاولة إضافة العمود إذا لم يكن موجوداً
  try {
    await c.env.DB.prepare('ALTER TABLE panel_users ADD COLUMN telegram_user_id INTEGER').run();
  } catch (_) {}
  try {
    await c.env.DB
      .prepare('UPDATE panel_users SET telegram_user_id = ? WHERE id = ?')
      .bind(tid, user.user_id)
      .run();
  } catch (e: any) {
    return c.json({ error: e?.message }, 500);
  }
  return c.json({ ok: true });
});

// تحديث الإعدادات الجديدة (Web Push & Multi-admin)
// (تُستخدم نقطة `/settings` العامة، لا نحتاج لـ endpoint منفصل)

export default api;
