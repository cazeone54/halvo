import { MIN_CHARGE_CENTS } from "@/lib/fees";

export type CouponDiscount = {
  percent_off: number | null;
  amount_off_cents: number | null;
};

// Pure — floors at the Stripe minimum so a coupon can never zero out a charge.
export function applyCouponDiscount(amountCents: number, coupon: CouponDiscount): number {
  let discounted = amountCents;
  if (coupon.percent_off) {
    discounted = Math.round(amountCents * (1 - coupon.percent_off / 100));
  } else if (coupon.amount_off_cents) {
    discounted = amountCents - coupon.amount_off_cents;
  }
  return Math.max(discounted, MIN_CHARGE_CENTS);
}
