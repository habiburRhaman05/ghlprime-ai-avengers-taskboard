import fs from 'fs';
import {Pool} from 'pg';
const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL="([^"]+)"/);
if (!match) { console.error('No DATABASE_URL'); process.exit(1); }
const pool = new Pool({connectionString: match[1]});
async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema') ORDER BY schema_name");
    console.log('schemas:', res.rows.map(r => r.schema_name));
    const r2 = await client.query("SELECT to_regclass('portal.users') as has_users");
    console.log('has_users:', r2.rows[0].has_users);
    if (r2.rows[0].has_users) {
      const r3 = await client.query('SELECT id, role FROM portal.users');
      console.log('users:', JSON.stringify(r3.rows));
      const r4 = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='portal' AND table_name='users' ORDER BY ordinal_position");
      console.log('user columns:', r4.rows.map(r => r.column_name));
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
