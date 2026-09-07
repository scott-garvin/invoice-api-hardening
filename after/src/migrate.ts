import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// Runs as the superuser so it can create the app_user role and load RLS.
const adminUrl = process.env.ADMIN_DATABASE_URL;
if (!adminUrl) throw new Error('ADMIN_DATABASE_URL is required for migrations');

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(here, '..', 'schema.sql'), 'utf8');

const client = new pg.Client({ connectionString: adminUrl });
await client.connect();
await client.query(schema);
await client.end();
console.log('migrated');
