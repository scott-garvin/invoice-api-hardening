import { z } from 'zod';

const money = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'must be a decimal money string like "12.34"');

// .strict() rejects unknown keys, so a client can't smuggle org_id, paid flags,
// or any other field into a write. No mass assignment.
export const createInvoiceSchema = z
  .object({
    clientId: z.string().uuid(),
    lineItems: z.array(money).min(1),
    status: z.enum(['draft', 'sent', 'paid']).optional(),
  })
  .strict();

export const patchInvoiceSchema = z
  .object({
    status: z.enum(['draft', 'sent', 'paid']).optional(),
    lineItems: z.array(money).min(1).optional(),
  })
  .strict();

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type PatchInvoiceInput = z.infer<typeof patchInvoiceSchema>;
