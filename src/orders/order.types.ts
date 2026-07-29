export type OrderLine = {
  pid: number;
  name: string;
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
  deliveryTime: number;
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
  shipping?: OrderShipping;
  gateway?: string;
  pagbankCheckoutId?: string | null;
  pagbankPaymentId?: string | null;
  tracking?: string;
  paidAt?: number;
};
