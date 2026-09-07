import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query('truncate invoices, clients, users, organizations cascade');
const a = (await client.query(`insert into organizations (name) values ('Org A') returning id`)).rows[0].id;
const b = (await client.query(`insert into organizations (name) values ('Org B') returning id`)).rows[0].id;
await client.query(
  `insert into users (org_id, email, role) values ($1, 'admin@a.test', 'admin'), ($2, 'admin@b.test', 'admin')`,
  [a, b],
);
await client.query(`insert into clients (org_id, name) values ($1, 'Acme'), ($2, 'Globex')`, [a, b]);
await client.end();
console.log('seeded (before)');
