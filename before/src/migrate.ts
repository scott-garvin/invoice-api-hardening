import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(here, '..', 'schema.sql'), 'utf8');

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(schema);
await client.end();
console.log('migrated (before)');
