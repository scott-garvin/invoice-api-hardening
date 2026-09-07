// ⚠️  INTENTIONALLY VULNERABLE. This is the original AI-built MVP, kept as the
// "before" in a hardening demo. Do not run it against anything real. The fixes
// live in ../../after. See the repo README for the vuln-by-vuln walkthrough.

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './db';

// Hardcoded secret, checked into the repo. No token expiry either.
const JWT_SECRET = 'dev-secret';

interface User {
  userId: string;
  orgId: string;
  role: string;
}
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function signToken(u: User): string {
  return jwt.sign(u, JWT_SECRET); // no expiresIn
}

function auth(req: Request, res: Response, next: NextFunction): void {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, JWT_SECRET) as User;
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(auth);

  // Any authenticated user can read ANY invoice by id — no org check at all.
  app.get('/invoices/:id', async (req: Request, res: Response): Promise<void> => {
    const r = await pool.query('select * from invoices where id = $1', [req.params.id]);
    if (!r.rows[0]) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(r.rows[0]);
  });

  // Search builds SQL by string concatenation.
  app.get('/invoices', async (req: Request, res: Response): Promise<void> => {
    const q = typeof req.query.client === 'string' ? req.query.client : '';
    const sql = `select i.* from invoices i join clients c on c.id = i.client_id where c.name like '%${q}%'`;
    const r = await pool.query(sql);
    res.json(r.rows);
  });

  // Totals summed as floats; the org can be supplied by the caller.
  app.post('/invoices', async (req: Request, res: Response): Promise<void> => {
    const { clientId, lineItems, orgId } = req.body;
    const total = (lineItems as number[]).reduce((a, b) => a + b, 0);
    const r = await pool.query(
      'insert into invoices (org_id, client_id, amount) values ($1, $2, $3) returning *',
      [orgId ?? req.user!.orgId, clientId, total],
    );
    res.status(201).json(r.rows[0]);
  });

  // Whatever keys the client sends get written straight into the row.
  app.patch('/invoices/:id', async (req: Request, res: Response): Promise<void> => {
    const keys = Object.keys(req.body);
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = keys.map((k) => req.body[k]);
    values.push(req.params.id);
    const r = await pool.query(`update invoices set ${sets} where id = $${values.length} returning *`, values);
    res.json(r.rows[0]);
  });

  // No role check — any authenticated user can delete anything they can reach.
  app.delete('/invoices/:id', async (req: Request, res: Response): Promise<void> => {
    await pool.query('delete from invoices where id = $1', [req.params.id]);
    res.status(204).end();
  });

  return app;
}
