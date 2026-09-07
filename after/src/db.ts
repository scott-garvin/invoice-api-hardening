import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

export const pool = new pg.Pool({ connectionString: url });

/**
 * Run `fn` inside a transaction with the tenant's org_id set LOCAL to that
 * transaction. Using set_config(..., true) scopes the setting to the
 * transaction, so a pooled connection can never leak one tenant's context into
 * the next request that borrows it — the classic connection-pool + RLS footgun.
 * The RLS policies read current_setting('app.org_id').
 */
export async function withTenant<T>(
  orgId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1, $2, true)', ['app.org_id', orgId]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}
