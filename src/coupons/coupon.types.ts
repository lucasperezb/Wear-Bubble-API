export type CouponRecord = {
  code: string;
  pct: number;
  minimumCharge: boolean;
  active: boolean;
  expiresAt: number | null;
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  minSubtotal: number;
  assignedTo: string;
  uses: number;
  createdAt: number;
};
