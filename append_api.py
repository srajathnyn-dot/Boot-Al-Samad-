#!/usr/bin/env python3
"""يقص 'export default api;' من نهاية api.ts ويُلحق التوسعة قبله."""
import os
PATH = os.path.join(os.path.dirname(__file__), '..', 'src', 'admin', 'api.ts')

ADDITION = '''
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
  const BATCH = 50;
  const insertSql = `INSERT INTO grades
    (academic_id, student_name, college, level, semester, subject_name,
     attendance_score, participation_score, assignments_score, midterm_score, final_score,
     total_score, grade_label, credit_hours, is_remaining)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const stmts: D1PreparedStatement[] = [];
    for (const r of slice) {
      try {
        if (!r.academic_id || !r.semester || !r.subject_name) { failed++; continue; }
        stmts.push(
          c.env.DB.prepare(insertSql).bind(
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

'''

with open(PATH, 'r', encoding='utf-8') as f:
    content = f.read()

marker = 'export default api;'
if marker not in content:
    raise SystemExit('marker not found')

idx = content.rfind(marker)
new_content = content[:idx] + ADDITION + '\n' + content[idx:]

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(new_content)

print('OK appended', len(ADDITION), 'chars')
