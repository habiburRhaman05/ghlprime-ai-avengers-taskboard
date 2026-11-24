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

test('the project vault preserves legacy access and leaves media on its task', async () => {
  const db = new PGlite();
  try {
    for (const file of ['001_portal.sql', '005_task_resources.sql']) {
      await db.exec(await readFile(new URL('../db/' + file, import.meta.url), 'utf8'));
    }
    const { rows: [project, other] } = await db.query('SELECT id FROM portal.projects ORDER BY slug');
    const { rows: [user] } = await db.query(
      "INSERT INTO portal.users (id,name,role) VALUES (gen_random_uuid(),'Synthetic admin','super_admin') RETURNING id",
    );
    const { rows: [task] } = await db.query(
      `INSERT INTO portal.tasks (project_id,created_by,request_id,title,instructions,due_at,access_label,access_url)
       VALUES ($1,$2,gen_random_uuid(),'Synthetic task','Write an update',statement_timestamp() + interval '24 hours',
         'Original invite','https://example.invalid/invite') RETURNING id`,
      [project.id, user.id],
    );
    const { rows: [resource] } = await db.query(
      `INSERT INTO portal.task_resources (task_id,created_by,kind,label,url,account_email,note,encrypted_password)
       VALUES ($1,$2,'access','Synthetic platform','https://example.invalid/vault','test@example.invalid','Synthetic note','v1.synthetic')
       RETURNING id,label,url,account_email,note,encrypted_password,created_at`,
      [task.id, user.id],
    );
    await db.query(`INSERT INTO portal.task_resources (task_id,created_by,kind,label,url)
      VALUES ($1,$2,'media_link','Synthetic video','https://example.invalid/video')`, [task.id, user.id]);

    await db.exec(await readFile(new URL('../db/007_project_access_vault.sql', import.meta.url), 'utf8'));

    const vaultFor = id => db.query(
      'SELECT id,label,url,account_email,note,encrypted_password,created_at,legacy_task_id,created_by FROM portal.project_access_items WHERE project_id=$1',
      [id],
    );
    const { rows: entries } = await vaultFor(project.id);
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.find(item => item.id === resource.id), { ...resource, legacy_task_id: task.id, created_by: user.id });
    const invite = entries.find(item => item.label === 'Original invite');
    assert.equal(invite.url, 'https://example.invalid/invite');
    assert.equal(invite.created_by, user.id);
    assert.equal(invite.encrypted_password, null);
    assert.equal((await vaultFor(other.id)).rows.length, 0);
    assert.deepEqual((await db.query('SELECT kind,label,url FROM portal.task_resources WHERE task_id=$1', [task.id])).rows,
      [{ kind: 'media_link', label: 'Synthetic video', url: 'https://example.invalid/video' }]);
    assert.deepEqual((await db.query('SELECT access_label,access_url FROM portal.tasks WHERE id=$1', [task.id])).rows,
      [{ access_label: null, access_url: null }]);
    await assert.rejects(db.query(`INSERT INTO portal.task_resources (task_id,created_by,kind,label)
      VALUES ($1,$2,'access','Old path')`, [task.id, user.id]), { code: '23514' });
    await assert.rejects(db.query(`UPDATE portal.tasks SET access_label='Old path',access_url='https://example.invalid/old'
      WHERE id=$1`, [task.id]), { code: '23514' });
    await db.query('DELETE FROM portal.tasks WHERE id=$1', [task.id]);
    assert.equal((await vaultFor(project.id)).rows.length, 2);
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
