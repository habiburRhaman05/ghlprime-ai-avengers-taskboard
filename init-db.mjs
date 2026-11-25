import fs from 'fs';
import {Pool} from 'pg';
const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL=\"([^\"]+)\"/);
if (!match) { console.error('No DATABASE_URL'); process.exit(1); }
const pool = new Pool({connectionString: match[1]});
async function run() {
  const client = await pool.connect();
  try {
    // Apply migrations (002_storage.sql targets Supabase Storage, skipped for raw Postgres)
    const migrations = ['db/001_portal.sql', 'db/003_users_email.sql'];
    for (const file of migrations) {
      const sql = fs.readFileSync(file, 'utf8');
      await client.query(sql);
      console.log(`Applied ${file}`);
    }

    // Create super admin
    const superAdminId = '00000000-0000-0000-0000-000000000001';
    const superAdmin = await import('./lib/password.ts').then(m => m.hashPassword('Password123!'));
    await client.query(
      'INSERT INTO portal.users (id, name, role, email, password_hash) VALUES ($1, $2, $3, $4, $5)',
      [superAdminId, 'Platform Admin', 'super_admin', 'admin@ai-avengers.com', superAdmin]
    );
    console.log('Created super admin');

    // Create GHL Prime Team user
    const teamId = '00000000-0000-0000-0000-000000000002';
    const team = await import('./lib/password.ts').then(m => m.hashPassword('Password123!'));
    await client.query(
      'INSERT INTO portal.users (id, name, role, email, password_hash) VALUES ($1, $2, $3, $4, $5)',
      [teamId, 'GHL Prime Team', 'agency_member', 'team@ai-avengers.com', team]
    );
    console.log('Created team user');

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
run();