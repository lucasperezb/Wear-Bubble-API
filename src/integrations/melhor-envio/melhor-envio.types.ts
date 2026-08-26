export type MelhorEnvioTokenResponse = {
  token_type?: string;
  expires_in?: number;
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  message?: string;
};

export type MelhorEnvioStatePayload = {
  purpose: 'melhor-envio-oauth';
  uid: string;
  nonce: string;
};

export type MelhorEnvioQuoteApiOption = {
  id?: number;
  name?: string;
  price?: string | number;
  custom_price?: string | number;
  delivery_time?: number;
  custom_delivery_time?: number;
  error?: string;
  company?: {
    id?: number;
    name?: string;
    picture?: string;
  };
  packages?: Array<{
    dimensions?: { height?: number; width?: number; length?: number };
    weight?: string | number;
    insurance_value?: string | number;
    products?: Array<{ id?: string; quantity?: number }>;
  }>;
};

export type MelhorEnvioApiError = {
  message?: string;
  error?: string;
  errors?: Record<string, string[] | string>;
};

export type MelhorEnvioCartResponse = MelhorEnvioApiError & {
  id?: string;
  protocol?: string;
  status?: string;
  price?: string | number;
  tracking?: string;
  authorization_code?: string;
};

export type MelhorEnvioPrintResponse = MelhorEnvioApiError & {
  url?: string;
};

export type MelhorEnvioWebhookPayload = {
  event?: string;
  data?: {
    id?: string;
    protocol?: string;
    status?: string;
    tracking?: string | null;
    tracking_url?: string | null;
    authorization_code?: string | null;
    paid_at?: string | null;
    generated_at?: string | null;
    posted_at?: string | null;
    delivered_at?: string | null;
    canceled_at?: string | null;
  };
};
