import { Router } from 'express';
import type { Request, Response } from 'express';
import { withTenant } from './db';
import { requireAuth, requireRole } from './auth';
import { createInvoiceSchema, patchInvoiceSchema } from './validation';
import { parseMoneyToCents, centsToString } from './money';

export const invoices = Router();

interface InvoiceRow {
  id: string;
  client_id: string;
  amount_cents: string;
  status: string;
  created_at: Date;
}

function view(row: InvoiceRow) {
  return {
    id: row.id,
    clientId: row.client_id,
    amount: centsToString(Number(row.amount_cents)),
    status: row.status,
    createdAt: row.created_at,
  };
}

invoices.use(requireAuth);

// Create — org_id comes from the authenticated user, NEVER from the request body.
invoices.post('/', requireRole('admin', 'member'), async (req: Request, res: Response): Promise<void> => {
  const parsed = createInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid input', details: parsed.error.issues });
    return;
  }
  const { clientId, lineItems, status } = parsed.data;
  const amountCents = lineItems.reduce((sum, s) => sum + parseMoneyToCents(s), 0); // integer math, exact
  const orgId = req.user!.orgId;
  try {
    const row = await withTenant(orgId, async (c) => {
      const r = await c.query<InvoiceRow>(
        `insert into invoices (org_id, client_id, amount_cents, status)
         values ($1, $2, $3, coalesce($4, 'draft')) returning *`,
        [orgId, clientId, amountCents, status ?? null],
      );
      return r.rows[0];
    });
    res.status(201).json(view(row));
  } catch {
    // e.g. a client_id from another org: the FK + RLS reject it
    res.status(400).json({ error: 'could not create invoice' });
  }
});

// Read one — RLS makes another org's invoice invisible, so this is a 404, not a leak.
invoices.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const row = await withTenant(req.user!.orgId, async (c) => {
    const r = await c.query<InvoiceRow>('select * from invoices where id = $1', [req.params.id]);
    return r.rows[0];
  });
  if (!row) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(view(row));
});

// List / search — the client filter is PARAMETERIZED, never string-concatenated.
invoices.get('/', async (req: Request, res: Response): Promise<void> => {
  const clientName = typeof req.query.client === 'string' ? req.query.client : null;
  const rows = await withTenant(req.user!.orgId, async (c) => {
    if (clientName) {
      const r = await c.query<InvoiceRow>(
        `select i.* from invoices i
           join clients cl on cl.id = i.client_id
          where cl.name ilike '%' || $1 || '%'
          order by i.created_at desc`,
        [clientName],
      );
      return r.rows;
    }
    const r = await c.query<InvoiceRow>('select * from invoices order by created_at desc');
    return r.rows;
  });
  res.json(rows.map(view));
});

// Update — validated allowlist (no mass assignment); RLS scopes it to the org.
invoices.patch('/:id', requireRole('admin', 'member'), async (req: Request, res: Response): Promise<void> => {
  const parsed = patchInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid input', details: parsed.error.issues });
    return;
  }
  const setClauses: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.status !== undefined) {
    values.push(parsed.data.status);
    setClauses.push(`status = $${values.length}`);
  }
  if (parsed.data.lineItems !== undefined) {
    values.push(parsed.data.lineItems.reduce((s, x) => s + parseMoneyToCents(x), 0));
    setClauses.push(`amount_cents = $${values.length}`);
  }
  if (setClauses.length === 0) {
    res.status(400).json({ error: 'nothing to update' });
    return;
  }
  values.push(req.params.id);
  const row = await withTenant(req.user!.orgId, async (c) => {
    const r = await c.query<InvoiceRow>(
      `update invoices set ${setClauses.join(', ')} where id = $${values.length} returning *`,
      values,
    );
    return r.rows[0];
  });
  if (!row) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(view(row));
});

// Delete — admin only, RLS-scoped.
invoices.delete('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const deleted = await withTenant(req.user!.orgId, async (c) => {
    const r = await c.query('delete from invoices where id = $1 returning id', [req.params.id]);
    return r.rowCount ?? 0;
  });
  if (!deleted) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.status(204).end();
});
