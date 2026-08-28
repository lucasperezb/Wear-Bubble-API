export type OrderLine = {
  id?: number;
  pid: number;
  productColorId?: number | null;
  name: string;
  image?: string | null;
  size: string;
  color: string;
  qty: number;
  price: number;
};

export type OrderDelivery = {
  name: string;
  email: string;
  taxId: string;
  phone: string;
  cep: string;
  street: string;
  neighborhood: string;
  number: string;
  reference: string;
  city: string;
  state: string;
};

export type OrderShipping = {
  serviceId: number;
  name: string;
  company: string;
  price: number;
  carrierPrice?: number;
  deliveryTime: number;
  packages?: ShippingPackage[];
};

export type ShippingPackage = {
  height: number;
  width: number;
  length: number;
  weight: number;
  insuranceValue: number;
  products: Array<{ id: string; quantity: number }>;
};

export type OrderRecord = {
  id: string;
  customerId: string;
  number: string;
  date: number;
  items: OrderLine[];
  total: number;
  method: string;
  coupon: string | null;
  couponPct: number;
  status: 'pending' | 'paid' | 'canceled' | 'expired' | 'stock_conflict';
  inventoryStatus?: 'none' | 'reserved' | 'committed' | 'released' | 'conflict';
  paymentStatus?:
    | 'pending'
    | 'authorized'
    | 'confirmed'
    | 'refund_pending'
    | 'refunded'
    | 'failed';
  stockConflictReason?: string | null;
  shipStage: number;
  delivery?: OrderDelivery;
  shipping?: OrderShipping;
  gateway?: string;
  asaasCustomerId?: string | null;
  asaasPaymentId?: string | null;
  tracking?: string;
  paidAt?: number;
  deliveredAt?: number;
  storeCreditCode?: string | null;
  storeCreditAmount?: number;
};
