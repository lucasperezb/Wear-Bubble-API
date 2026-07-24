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
}
