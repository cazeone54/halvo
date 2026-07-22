export const COMMISSION_PERCENT = 10;

export function calcCommissionCents(amountPaidCents: number): number {
  if (amountPaidCents <= 0) return 0;
  return Math.floor((amountPaidCents * COMMISSION_PERCENT) / 100);
}
