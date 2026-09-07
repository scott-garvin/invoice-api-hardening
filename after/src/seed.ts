import { pathToFileURL } from 'node:url';
import pg from 'pg';

const adminUrl = process.env.ADMIN_DATABASE_URL;

// Deterministic fixtures so tests can reference them directly.
export const FIXTURES = {
  orgA: '00000000-0000-0000-0000-0000000000aa',
  orgB: '00000000-0000-0000-0000-0000000000bb',
  adminA: '10000000-0000-0000-0000-0000000000aa',
  viewerA: '20000000-0000-0000-0000-0000000000aa',
  adminB: '10000000-0000-0000-0000-0000000000bb',
  clientA: '30000000-0000-0000-0000-0000000000aa',
  clientB: '30000000-0000-0000-0000-0000000000bb',
} as const;

// Seeds as the superuser (bypasses RLS) so it can create rows across both orgs.
export async function seed(): Promise<void> {
  if (!adminUrl) throw new Error('ADMIN_DATABASE_URL is required for seeding');
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query('truncate invoices, clients, users, organizations cascade');
    await client.query(`insert into organizations (id, name) values ($1, 'Org A'), ($2, 'Org B')`, [
      FIXTURES.orgA,
      FIXTURES.orgB,
    ]);
    await client.query(
      `insert into users (id, org_id, email, role) values
         ($1, $2, 'admin@a.test', 'admin'),
         ($3, $2, 'viewer@a.test', 'viewer'),
         ($4, $5, 'admin@b.test', 'admin')`,
      [FIXTURES.adminA, FIXTURES.orgA, FIXTURES.viewerA, FIXTURES.adminB, FIXTURES.orgB],
    );
    await client.query(`insert into clients (id, org_id, name) values ($1, $2, 'Acme'), ($3, $4, 'Globex')`, [
      FIXTURES.clientA,
      FIXTURES.orgA,
      FIXTURES.clientB,
      FIXTURES.orgB,
    ]);
  } finally {
    await client.end();
  }
}

// Run directly: `tsx src/seed.ts`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed()
    .then(() => console.log('seeded'))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
