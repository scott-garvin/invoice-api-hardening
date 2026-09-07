import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { signToken } from '../src/auth';
import { seed, FIXTURES } from '../src/seed';
import { parseMoneyToCents } from '../src/money';

const app = createApp();

const tokens = {
  adminA: signToken({ userId: FIXTURES.adminA, orgId: FIXTURES.orgA, role: 'admin' }),
  viewerA: signToken({ userId: FIXTURES.viewerA, orgId: FIXTURES.orgA, role: 'viewer' }),
  adminB: signToken({ userId: FIXTURES.adminB, orgId: FIXTURES.orgB, role: 'admin' }),
};
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

function createInvoice(token: string, clientId: string, lineItems: string[]) {
  return request(app).post('/invoices').set(bearer(token)).send({ clientId, lineItems });
}

beforeAll(async () => {
  await seed();
});

describe('tenant isolation (Postgres RLS)', () => {
  it("org A cannot read org B's invoice — 404, not a leak", async () => {
    const created = await createInvoice(tokens.adminB, FIXTURES.clientB, ['100.00']);
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    const asA = await request(app).get(`/invoices/${id}`).set(bearer(tokens.adminA));
    expect(asA.status).toBe(404);

    const asB = await request(app).get(`/invoices/${id}`).set(bearer(tokens.adminB));
    expect(asB.status).toBe(200);
  });
});

describe('money is exact', () => {
  it('0.10 + 0.20 totals exactly 0.30', async () => {
    const r = await createInvoice(tokens.adminA, FIXTURES.clientA, ['0.10', '0.20']);
    expect(r.status).toBe(201);
    expect(r.body.amount).toBe('0.30');
  });

  it('the naive float approach the before/ app ships would have drifted', () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the bug
    expect(parseMoneyToCents('0.10') + parseMoneyToCents('0.20')).toBe(30); // the fix
  });
});

describe('authorization', () => {
  it('a viewer cannot delete', async () => {
    const created = await createInvoice(tokens.adminA, FIXTURES.clientA, ['5.00']);
    const del = await request(app).delete(`/invoices/${created.body.id}`).set(bearer(tokens.viewerA));
    expect(del.status).toBe(403);
  });

  it('an admin can delete', async () => {
    const created = await createInvoice(tokens.adminA, FIXTURES.clientA, ['5.00']);
    const del = await request(app).delete(`/invoices/${created.body.id}`).set(bearer(tokens.adminA));
    expect(del.status).toBe(204);
  });
});

describe('no mass assignment', () => {
  it('rejects unknown fields such as org_id', async () => {
    const r = await request(app)
      .post('/invoices')
      .set(bearer(tokens.adminA))
      .send({ clientId: FIXTURES.clientA, lineItems: ['1.00'], orgId: FIXTURES.orgB });
    expect(r.status).toBe(400);
  });
});

describe('sql injection', () => {
  it('treats an injection payload as literal search data', async () => {
    await createInvoice(tokens.adminA, FIXTURES.clientA, ['1.00']);
    const attack = await request(app)
      .get('/invoices')
      .query({ client: "Acme'; drop table invoices; --" })
      .set(bearer(tokens.adminA));
    expect(attack.status).toBe(200); // no 500, nothing executed
    expect(Array.isArray(attack.body)).toBe(true);

    // table still exists: a normal search still returns rows
    const ok = await request(app).get('/invoices').query({ client: 'Acme' }).set(bearer(tokens.adminA));
    expect(ok.status).toBe(200);
    expect(ok.body.length).toBeGreaterThan(0);
  });
});

describe('auth', () => {
  it('rejects a request with no token', async () => {
    const r = await request(app).get('/invoices');
    expect(r.status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    const good = tokens.adminA;
    const tampered = `${good.slice(0, -2)}${good.endsWith('A') ? 'BB' : 'AA'}`;
    const r = await request(app).get('/invoices').set(bearer(tampered));
    expect(r.status).toBe(401);
  });
});
