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
    const value = this.config.get<string>('JWT_SECRET');
    if (value) return value;
    if (this.isProduction) {
      throw new Error(
        'JWT_SECRET não configurado. A API não pode iniciar em produção sem esse segredo.',
      );
    }
    return 'dev-secret-troque-em-producao';
  }

  get loginCodeSecret() {
    const value = this.config.get<string>('LOGIN_CODE_SECRET');
    if (value) return value;
    if (this.isProduction) {
      throw new Error(
        'LOGIN_CODE_SECRET não configurado. A API não pode iniciar em produção sem esse segredo.',
      );
    }
    return this.jwtSecret;
  }

  get managerEmail() {
    return (
      this.config.get<string>('MANAGER_EMAIL') || 'gerente@wearbubble.com.br'
    ).toLowerCase();
  }

  get pixDiscount() {
    return Number(this.config.get('PIX_DISCOUNT')) || 0.05;
  }

  get bundleDiscount() {
    return Number(this.config.get('BUNDLE_DISCOUNT')) || 0.05;
  }

  get inventoryReservationMinutes() {
    return Math.max(
      1,
      Number(this.config.get('INVENTORY_RESERVATION_MINUTES')) || 15,
    );
  }

  get freeShippingMinimum() {
    return Math.max(0, Number(this.config.get('FREE_SHIPPING_MINIMUM')) || 199);
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
      this.config.get<string>('SMTP_USER') || 'gerente@wearbubble.com.br'
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

  get smtpConfigured() {
    return Boolean(
      this.smtpHost &&
      this.smtpPort &&
      this.smtpUser &&
      this.smtpPassword &&
      this.smtpFromEmail,
    );
  }

  get isProduction() {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Fail fast on boot instead of silently serving sandbox/test behavior
   * (fake Asaas charges, fake Melhor Envio tracking codes) to real customers.
   */
  assertProductionReadiness() {
    if (!this.isProduction) return;
    const problems: string[] = [];
    try {
      void this.jwtSecret;
    } catch (error) {
      problems.push((error as Error).message);
    }
    try {
      void this.loginCodeSecret;
    } catch (error) {
      problems.push((error as Error).message);
    }
    if (this.asaasEnv !== 'production') {
      problems.push(
        'ASAAS_ENV não está definido como "production" — pagamentos cairiam no sandbox do Asaas.',
      );
    }
    if (this.melhorEnvioEnv !== 'production') {
      problems.push(
        'MELHOR_ENVIO_ENV não está definido como "production" — etiquetas e códigos de rastreio de devolução seriam simulados (sandbox) e enviados a clientes reais.',
      );
    }
    const managerEmailConfigured = this.config.get<string>('MANAGER_EMAIL');
    if (!managerEmailConfigured) {
      // The role assigned at registration is decided by comparing the new
      // account's email to this value — if it's left at its documented
      // default (also shipped in .env.example), anyone can register with
      // that exact address and get role:'manager' immediately.
      problems.push(
        'MANAGER_EMAIL não está configurado — o e-mail padrão é público (está no .env.example) e permitiria virar gerente só se cadastrando com ele.',
      );
    }
    if (problems.length) {
      throw new Error(
        `Configuração de produção inválida:\n- ${problems.join('\n- ')}`,
      );
    }
  }

  get storeUrl() {
    return this.config.get<string>('STORE_URL') || this.frontendOrigin;
  }

  get asaasApiKey() {
    return (this.config.get<string>('ASAAS_API_KEY') || '')
      .trim()
      .replace(/^(["'])(.*)\1$/s, '$2')
      .replace(/^\\(?=\$aact_)/, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, '');
  }

  get asaasApiKeyDiagnostics() {
    const key = this.asaasApiKey;
    const expectedPrefix =
      this.asaasEnv === 'production' ? '$aact_prod_' : '$aact_hmlg_';
    return {
      configured: Boolean(key),
      environment: this.asaasEnv,
      baseUrl: this.asaasBaseUrl,
      expectedPrefix,
      prefixValid: key.startsWith(expectedPrefix),
      length: key.length,
    };
  }

  get asaasEnv() {
    return this.config.get('ASAAS_ENV') === 'production'
      ? 'production'
      : 'sandbox';
  }

  get asaasBaseUrl() {
    return this.asaasEnv === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3';
  }

  get asaasWebhookToken() {
    return (this.config.get<string>('ASAAS_WEBHOOK_TOKEN') || '').trim();
  }

  get asaasInstallments() {
    return String(Number(this.config.get('ASAAS_INSTALLMENTS')) || 3);
  }

  get asaasUserAgent() {
    return (
      this.config.get<string>('ASAAS_USER_AGENT') ||
      `WearBubble/2.1 (${this.asaasEnv})`
    ).trim();
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

  get melhorEnvioAllowedServices() {
    const configured =
      this.config.get<string>('MELHOR_ENVIO_ALLOWED_SERVICES') || '1,2';
    return configured
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => value === 1 || value === 2);
  }

  get melhorEnvioRequireInvoice() {
    const configured = this.config.get<string>('MELHOR_ENVIO_REQUIRE_INVOICE');
    return configured === undefined
      ? this.melhorEnvioEnv === 'production'
      : configured === 'true';
  }

  get melhorEnvioSender() {
    return {
      name: (this.config.get<string>('MELHOR_ENVIO_SENDER_NAME') || '').trim(),
      companyDocument: (
        this.config.get<string>('MELHOR_ENVIO_SENDER_COMPANY_DOCUMENT') || ''
      ).replace(/\D/g, ''),
      stateRegister: (
        this.config.get<string>('MELHOR_ENVIO_SENDER_STATE_REGISTER') || ''
      ).trim(),
      phone: (
        this.config.get<string>('MELHOR_ENVIO_SENDER_PHONE') || ''
      ).replace(/\D/g, ''),
      email: (
        this.config.get<string>('MELHOR_ENVIO_SENDER_EMAIL') || ''
      ).trim(),
      address: (
        this.config.get<string>('MELHOR_ENVIO_SENDER_ADDRESS') || ''
      ).trim(),
      number: (
        this.config.get<string>('MELHOR_ENVIO_SENDER_NUMBER') || ''
      ).trim(),
      complement: (
        this.config.get<string>('MELHOR_ENVIO_SENDER_COMPLEMENT') || ''
      ).trim(),
      district: (
        this.config.get<string>('MELHOR_ENVIO_SENDER_DISTRICT') || ''
      ).trim(),
      city: (this.config.get<string>('MELHOR_ENVIO_SENDER_CITY') || '').trim(),
      state: (this.config.get<string>('MELHOR_ENVIO_SENDER_STATE') || '')
        .trim()
        .toUpperCase(),
      postalCode: this.melhorEnvioOriginPostalCode,
    };
  }
}
