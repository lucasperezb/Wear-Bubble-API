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
    name?: string;
    picture?: string;
  };
};

export type MelhorEnvioApiError = {
  message?: string;
  error?: string;
  errors?: Record<string, string[] | string>;
};
