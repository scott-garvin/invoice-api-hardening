import { signToken, type Role } from './auth';
import { FIXTURES } from './seed';

// Demo helper: mint a bearer token for a seeded fixture user.
//   tsx src/mint-token.ts adminA | viewerA | adminB
const who = process.argv[2] ?? 'adminA';

const users: Record<string, { userId: string; orgId: string; role: Role }> = {
  adminA: { userId: FIXTURES.adminA, orgId: FIXTURES.orgA, role: 'admin' },
  viewerA: { userId: FIXTURES.viewerA, orgId: FIXTURES.orgA, role: 'viewer' },
  adminB: { userId: FIXTURES.adminB, orgId: FIXTURES.orgB, role: 'admin' },
};

const u = users[who];
if (!u) {
  console.error(`unknown user "${who}" (try: ${Object.keys(users).join(', ')})`);
  process.exit(1);
}
console.log(signToken(u));
