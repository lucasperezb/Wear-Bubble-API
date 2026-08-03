import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get port() {
    return Number(this.config.get('PORT')) || 4007;
  }

  get frontendOrigin() {
    return (
      this.config.get<string>('FRONTEND_ORIGIN') || 'http://localhost:4000'
    );
  }

  get frontendOrigins() {
    return this.frontendOrigin
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get jwtSecret() {
    return (
      this.config.get<string>('JWT_SECRET') || 'dev-secret-troque-em-producao'
    );
  }

  get loginCodeSecret() {
    return this.config.get<string>('LOGIN_CODE_SECRET') || this.jwtSecret;
  }

  get managerEmail() {
    return (
      this.config.get<string>('MANAGER_EMAIL') || 'gerente@bubble.com.br'
    ).toLowerCase();
  }

  get pixDiscount() {
    return Number(this.config.get('PIX_DISCOUNT')) || 0.05;
  }

  get bundleDiscount() {
    return Number(this.config.get('BUNDLE_DISCOUNT')) || 0.05;
  }

  get freeShippingEnabled() {
    return this.config.get<string>('FREE_SHIPPING_ENABLED') !== 'false';
  }

  get supabaseUrl() {
    return (this.config.get<string>('SUPABASE_URL') || '').replace(/\/$/, '');
  }

  get supabaseServiceRoleKey() {
    return (this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  }

  get supabaseStorageBucket() {
    return (
      this.config.get<string>('SUPABASE_STORAGE_BUCKET') || 'product-images'
    ).trim();
  }

  get supabaseStorageConfigured() {
    return Boolean(this.supabaseUrl && this.supabaseServiceRoleKey);
  }

  get smtpHost() {
    return this.config.get<string>('SMTP_HOST') || 'smtp.hostinger.com';
  }

  get smtpPort() {
    return Number(this.config.get('SMTP_PORT')) || 465;
  }

  get smtpSecure() {
    const value = this.config.get<string>('SMTP_SECURE');
    return value === undefined ? this.smtpPort === 465 : value === 'true';
  }

  get smtpUser() {
    return (
      this.config.get<string>('SMTP_USER') || 'contato@wearbubble.com.br'
    ).trim();
  }

  get smtpPassword() {
    return this.config.get<string>('SMTP_PASSWORD') || '';
  }

  get smtpFromEmail() {
    return (this.config.get<string>('SMTP_FROM_EMAIL') || this.smtpUser).trim();
  }

  get smtpFromName() {
    return this.config.get<string>('SMTP_FROM_NAME') || 'Wear Bubble';
  }

  get storeUrl() {
    return this.config.get<string>('STORE_URL') || this.frontendOrigin;
  }

  get pagbankToken() {
    return (this.config.get<string>('PAGBANK_TOKEN') || '')
      .trim()
      .replace(/^["']|["']$/g, '');
  }

  get pagbankPublicKey() {
    return (this.config.get<string>('PAGBANK_PUBLIC_KEY') || '').trim();
  }

  get pagbankEnv() {
    return this.config.get('PAGBANK_ENV') === 'production'
      ? 'production'
      : 'sandbox';
  }

  get pagbankBaseUrl() {
    return this.pagbankEnv === 'production'
      ? 'https://api.pagseguro.com'
      : 'https://sandbox.api.pagseguro.com';
  }

  get pagbankWebhookUrl() {
    return (
      this.config.get<string>('PAGBANK_WEBHOOK_URL') ||
      `${this.storeUrl.replace(/\/$/, '')}/api/payment/webhook/pagbank`
    );
  }

  get pagbankInstallments() {
    return String(Number(this.config.get('PAGBANK_INSTALLMENTS')) || 3);
  }

  get melhorEnvioEnv() {
    return this.config.get('MELHOR_ENVIO_ENV') === 'production'
      ? 'production'
      : 'sandbox';
  }

  get melhorEnvioBaseUrl() {
    return (
      this.config.get<string>('MELHOR_ENVIO_BASE_URL') ||
      (this.melhorEnvioEnv === 'production'
        ? 'https://melhorenvio.com.br'
        : 'https://sandbox.melhorenvio.com.br')
    ).replace(/\/$/, '');
  }

  get melhorEnvioClientId() {
    return (this.config.get<string>('MELHOR_ENVIO_CLIENT_ID') || '').trim();
  }

  get melhorEnvioClientSecret() {
    return (this.config.get<string>('MELHOR_ENVIO_CLIENT_SECRET') || '').trim();
  }

  get melhorEnvioRedirectUri() {
    return (this.config.get<string>('MELHOR_ENVIO_REDIRECT_URI') || '').trim();
  }

  get melhorEnvioUserAgent() {
    return (
      this.config.get<string>('MELHOR_ENVIO_USER_AGENT') ||
      'Wear Bubble (contato@wearbubble.com.br)'
    ).trim();
  }

  get melhorEnvioTokenEncryptionKey() {
    return (
      this.config.get<string>('MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY') || ''
    ).trim();
  }

  get melhorEnvioOriginPostalCode() {
    return (
      this.config.get<string>('MELHOR_ENVIO_ORIGIN_POSTAL_CODE') || ''
    ).replace(/\D/g, '');
  }
}
