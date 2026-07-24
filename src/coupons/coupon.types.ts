export type CouponRecord = {
  code: string;
  pct: number;
  active: boolean;
  expiresAt: number | null;
  maxUses: number | null;
  minSubtotal: number;
  assignedTo: string;
  uses: number;
  createdAt: number;
};
