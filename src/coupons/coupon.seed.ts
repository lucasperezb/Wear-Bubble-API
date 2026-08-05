import { CouponRecord } from './coupon.types';

export const seedCoupons: CouponRecord[] = [
  {
    code: 'BUBBLE10',
    pct: 10,
    active: true,
    expiresAt: null,
    maxUses: null,
    maxUsesPerCustomer: 1,
    minSubtotal: 0,
    assignedTo: 'Clube Bubble',
    uses: 0,
    createdAt: Date.now(),
  },
];
