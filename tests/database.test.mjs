import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('the migration seeds projects and preserves task invariants', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL('../db/001_portal.sql', import.meta.url), 'utf8'));
    const { rows } = await db.query('SELECT name,id FROM portal.projects ORDER BY name');
    assert.deepEqual(rows.map(({ name }) => name), ['AI Avengers', 'Insurance Defender', 'Shading Director']);
    const project = rows[0].id;
    const user = '00000000-0000-4000-8000-000000000001';
    await db.query("INSERT INTO portal.users VALUES ($1,'Test client','client_admin')", [user]);
    const now = '2026-11-23T12:00:00Z';
    const insert = (due, request, sameProject = project) => db.query(
      `INSERT INTO portal.tasks (project_id,created_by,request_id,title,instructions,created_at,due_at)
       VALUES ($1,$2,$3,'Test task','Write an update',$4,$5)
       RETURNING id,number,assignee,status`,
      [sameProject, user, request, now, due],
    );
    const tooSoon = '10000000-0000-4000-8000-000000000001';
    await assert.rejects(insert('2026-11-24T11:59:59.999Z', tooSoon), { code: '23514' });
    const valid = '10000000-0000-4000-8000-000000000002';
    const { rows: [task] } = await insert('2026-11-24T12:00:00Z', valid);
    await db.exec(await readFile(new URL('../db/005_task_resources.sql', import.meta.url), 'utf8'));
    await db.query(`INSERT INTO portal.task_resources (task_id,created_by,kind,label,account_email,encrypted_password)
      VALUES ($1,$2,'access','Synthetic platform','test@example.invalid','v1.synthetic')`, [task.id, user]);
    await db.query(`INSERT INTO portal.task_resources (task_id,created_by,kind,label,url)
      VALUES ($1,$2,'media_link','Synthetic video','https://example.invalid/video')`, [task.id, user]);
    await assert.rejects(db.query(`INSERT INTO portal.task_resources (task_id,created_by,kind,label)
      VALUES ($1,$2,'media_link','Missing URL')`, [task.id, user]), { code: '23514' });
    await assert.rejects(db.query(`INSERT INTO portal.task_resources (task_id,created_by,kind,label,url,encrypted_password)
      VALUES ($1,$2,'media_link','Video','https://example.invalid/video','secret')`, [task.id, user]), { code: '23514' });
    assert.equal(task.assignee, 'GHL Prime Team');
    assert.equal(task.status, 'assigned');
    await assert.rejects(insert('2026-11-25T12:00:00Z', valid), { code: '23505' });
    await assert.rejects(db.query("UPDATE portal.tasks SET status='blocked' WHERE id=$1", [task.id]), { code: '23514' });
    await assert.rejects(db.query("UPDATE portal.tasks SET assignee='Unknown' WHERE id=$1", [task.id]), { code: '23514' });
    await db.query("UPDATE portal.tasks SET status='blocked',blocker='client',blocker_note='Send the logo' WHERE id=$1", [task.id]);
    const another = '10000000-0000-4000-8000-000000000003';
    const { rows: [next] } = await insert('2026-11-25T12:00:00Z', another, rows[1].id);
    assert(BigInt(next.number) > BigInt(task.number));

    await db.query('INSERT INTO portal.memberships VALUES ($1,$2)', [project, user]);
    const projectsFor = (id, role) => db.query(
      `SELECT p.id FROM portal.projects p WHERE $2::text <> 'client_admin' OR EXISTS
        (SELECT 1 FROM portal.memberships m WHERE m.project_id=p.id AND m.user_id::text=$1::text)
       ORDER BY p.name`, [id, role]);
    assert.equal((await projectsFor('prisma-text-id', 'super_admin')).rows.length, 3);
    assert.equal((await projectsFor('synthetic-agency-id', 'agency_member')).rows.length, 3);
    assert.deepEqual((await projectsFor(user, 'client_admin')).rows, [{ id: project }]);
    assert.deepEqual((await projectsFor('prisma-text-id', 'client_admin')).rows, []);
    const visible = () => db.query(
      `SELECT t.id FROM portal.tasks t WHERE EXISTS (
        SELECT 1 FROM portal.memberships m WHERE m.project_id=t.project_id AND m.user_id=$1)`, [user]);
    assert.deepEqual((await visible()).rows, [{ id: task.id }]);
    await db.query('DELETE FROM portal.memberships WHERE project_id=$1 AND user_id=$2', [project, user]);
    assert.deepEqual((await visible()).rows, []);
  } finally {
    await db.close();
  }
});

test('Prisma accounts receive matching portal profiles without replacing an existing profile', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL('../db/001_portal.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../db/003_users_email.sql', import.meta.url), 'utf8'));
    await db.exec('CREATE TABLE public."User" (id text PRIMARY KEY, name text, role text, email text, password_hash text)');
    const hash = 'a'.repeat(65);
    await db.query('INSERT INTO public."User" VALUES ($1,$2,$3,$4,$5)', ['synthetic-id', 'Synthetic admin', 'super_admin', 'test@example.invalid', hash]);
    const migration = await readFile(new URL('../db/004_prisma_portal_profiles.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    const { rows } = await db.query('SELECT name,role::text,email FROM portal.users');
    assert.deepEqual(rows, [{ name: 'Synthetic admin', role: 'super_admin', email: 'test@example.invalid' }]);
  } finally {
    await db.close();
  }
});

test('default all-project clients get memberships for existing and future projects, and revocations remain effective', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL('../db/001_portal.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../db/006_default_all_projects.sql', import.meta.url), 'utf8'));
    const allClient = '10000000-0000-4000-8000-000000000001';
    const limitedClient = '10000000-0000-4000-8000-000000000002';
    await db.query(`INSERT INTO portal.users (id,name,role,all_projects) VALUES ($1,'Synthetic all','client_admin',true),($2,'Synthetic limited','client_admin',false)`, [allClient, limitedClient]);
    let result = await db.query('SELECT project_id FROM portal.memberships WHERE user_id=$1 ORDER BY project_id', [allClient]);
    assert.equal(result.rows.length, 3);
    const revoked = result.rows[0].project_id;
    await db.query('DELETE FROM portal.memberships WHERE user_id=$1 AND project_id=$2', [allClient, revoked]);
    const future = (await db.query("INSERT INTO portal.projects (name,slug) VALUES ('Synthetic new','synthetic-new') RETURNING id")).rows[0].id;
    result = await db.query('SELECT project_id FROM portal.memberships WHERE user_id=$1', [allClient]);
    assert.equal(result.rows.length, 3);
    assert(result.rows.some(row => row.project_id === future));
    assert(!result.rows.some(row => row.project_id === revoked));
    assert.equal((await db.query('SELECT * FROM portal.memberships WHERE user_id=$1', [limitedClient])).rows.length, 0);
    await db.query('UPDATE portal.users SET all_projects=false WHERE id=$1', [allClient]);
    const later = (await db.query("INSERT INTO portal.projects (name,slug) VALUES ('Synthetic later','synthetic-later') RETURNING id")).rows[0].id;
    assert.equal((await db.query('SELECT * FROM portal.memberships WHERE user_id=$1 AND project_id=$2', [allClient, later])).rows.length, 0);
    await assert.rejects(db.query("INSERT INTO portal.users (id,name,role,all_projects) VALUES ('10000000-0000-4000-8000-000000000003','Synthetic agency','agency_member',true)"), { code: '23514' });
  } finally { await db.close(); }
});
