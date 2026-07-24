export type OrderLine = {
  pid: number;
  name: string;
  size: string;
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
  status: 'pending' | 'paid' | 'canceled';
  shipStage: number;
  delivery?: OrderDelivery;
  gateway?: string;
  pagbankCheckoutId?: string | null;
  pagbankPaymentId?: string | null;
  tracking?: string;
  paidAt?: number;
};
