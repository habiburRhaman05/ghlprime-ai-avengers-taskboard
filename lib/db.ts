import 'server-only';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string, values: unknown[] = [],
): Promise<{ rows: T[] }> {
  const result = await pool.query<T & QueryResultRow>(sql, values);
  return { rows: result.rows };
}

export async function transaction<T>(work: (client: { query: typeof query }) => Promise<T>): Promise<T> {
  const connection: PoolClient = await pool.connect();
  try {
    await connection.query('BEGIN');
    const result = await work({ query: async <R extends Record<string, unknown>>(sql: string, values: unknown[] = []) => {
      const result = await connection.query<R & QueryResultRow>(sql, values);
      return { rows: result.rows };
    } });
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}
