/**
 * Parse a decimal money string (e.g. "0.10", "1234.5", "42") into integer cents,
 * WITHOUT floating point. Rejects anything that isn't a clean money value.
 * Summing invoices then happens in integers, so 0.10 + 0.20 is exactly 30 cents.
 */
export function parseMoneyToCents(input: string): number {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) throw new Error(`invalid money value: ${JSON.stringify(input)}`);
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? '').padEnd(2, '0')); // "" -> "00", "5" -> "50"
  const cents = whole * 100 + frac;
  if (!Number.isSafeInteger(cents)) throw new Error('amount too large');
  return cents;
}

/** Render integer cents back to a decimal string for display. */
export function centsToString(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
