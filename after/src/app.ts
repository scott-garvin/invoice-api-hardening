import express from 'express';
import { invoices } from './invoices';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/invoices', invoices);
  return app;
}
