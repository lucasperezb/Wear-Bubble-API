import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../../auth/auth.types';
import { AppConfigService } from '../../config/config.service';
import { ProductsService } from '../../products/products.service';
import { ShippingQuoteDto } from './dto/shipping-quote.dto';
import { MelhorEnvioCredentialEntity } from './entities/melhor-envio-credential.entity';
import {
  MelhorEnvioApiError,
  MelhorEnvioQuoteApiOption,
  MelhorEnvioStatePayload,
  MelhorEnvioTokenResponse,
} from './melhor-envio.types';

const CREDENTIAL_ID = 'primary';
const OAUTH_SCOPES = [
  'cart-read',
  'cart-write',
  'orders-read',
  'purchases-read',
  'shipping-calculate',
  'shipping-cancel',
  'shipping-checkout',
  'shipping-companies',
  'shipping-generate',
  'shipping-preview',
  'shipping-print',
  'shipping-tracking',
  'ecommerce-shipping',
].join(' ');

@Injectable()
export class MelhorEnvioService {
  constructor(
    private readonly config: AppConfigService,
    @InjectRepository(MelhorEnvioCredentialEntity)
    private readonly credentials: Repository<MelhorEnvioCredentialEntity>,
    private readonly products: ProductsService,
  ) {}

  authorizationUrl(user: AuthenticatedUser) {
    this.assertConfigured();
    const state = jwt.sign(
      {
        purpose: 'melhor-envio-oauth',
        uid: user.uid,
        nonce: randomUUID(),
      } satisfies MelhorEnvioStatePayload,
      this.config.jwtSecret,
      { expiresIn: '10m', issuer: 'wearbubble' },
    );
    const url = new URL(
      '/oauth/authorize',
      `${this.config.melhorEnvioBaseUrl}/`,
    );
    url.searchParams.set('client_id', this.config.melhorEnvioClientId);
    url.searchParams.set('redirect_uri', this.config.melhorEnvioRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', OAUTH_SCOPES);
    return url.toString();
  }

  async completeAuthorization(code: string, state: string) {
    this.assertConfigured();
    this.verifyState(state);
    const token = await this.requestToken({
      grant_type: 'authorization_code',
      client_id: this.config.melhorEnvioClientId,
      client_secret: this.config.melhorEnvioClientSecret,
      redirect_uri: this.config.melhorEnvioRedirectUri,
      code,
    });
    await this.saveToken(token);
    return {
      connected: true,
      environment: this.config.melhorEnvioEnv,
      expiresAt: new Date(
        Date.now() + Number(token.expires_in || 2592000) * 1000,
      ).toISOString(),
    };
  }

  async status() {
    const credential = await this.credentials.findOneBy({ id: CREDENTIAL_ID });
    return {
      configured: Boolean(
        this.config.melhorEnvioClientId &&
        this.config.melhorEnvioClientSecret &&
        this.config.melhorEnvioRedirectUri &&
        this.config.melhorEnvioTokenEncryptionKey,
      ),
      connected: Boolean(credential),
      environment: this.config.melhorEnvioEnv,
      expiresAt: credential?.expiresAt?.toISOString() || null,
    };
  }

  async quote(dto: ShippingQuoteDto) {
    if (this.config.melhorEnvioOriginPostalCode.length !== 8) {
      throw new ServiceUnavailableException(
        'CEP de origem do Melhor Envio não configurado.',
      );
    }
    const products: Array<{
      id: string;
      width: number;
      height: number;
      length: number;
      weight: number;
      insurance_value: number;
      quantity: number;
    }> = [];
    for (const item of dto.items) {
      const row = await this.products.findEntity(item.pid);
      if (!row || !row.active) {
        throw new BadRequestException(`Produto ${item.pid} indisponível.`);
      }
      products.push({
        id: String(row.id),
        width: 20,
        height: 4,
        length: 25,
        weight: 0.3,
        insurance_value: Number(row.price),
        quantity: item.qty,
      });
    }
    const response = await this.authorizedRequest(
      '/api/v2/me/shipment/calculate',
      {
        method: 'POST',
        body: JSON.stringify({
          from: { postal_code: this.config.melhorEnvioOriginPostalCode },
          to: { postal_code: dto.postalCode.replace(/\D/g, '') },
          products,
          options: { receipt: false, own_hand: false },
        }),
      },
    );
    if (!Array.isArray(response)) {
      throw new ServiceUnavailableException(
        'O Melhor Envio retornou uma cotação inválida.',
      );
    }
    return (response as MelhorEnvioQuoteApiOption[])
      .filter(
        (option) =>
          !option?.error && Number(option?.custom_price ?? option?.price) >= 0,
      )
      .sort(
        (a, b) =>
          Number(a.custom_price ?? a.price) - Number(b.custom_price ?? b.price),
      )
      .map((option) => {
        const carrierPrice = Number(option.custom_price ?? option.price);
        const price = carrierPrice;
        const deliveryTime = Number(
          option.custom_delivery_time ?? option.delivery_time,
        );
        return {
          id: String(option.id),
          name: String(option.name || 'Entrega'),
          company: String(option.company?.name || 'Transportadora'),
          picture: option.company?.picture || null,
          price,
          deliveryTime,
          quoteToken: jwt.sign(
            {
              purpose: 'melhor-envio-quote',
              postalCode: dto.postalCode.replace(/\D/g, ''),
              serviceId: Number(option.id),
              name: String(option.name || 'Entrega'),
              company: String(option.company?.name || 'Transportadora'),
              price,
              deliveryTime,
            },
            this.config.jwtSecret,
            { expiresIn: '15m', issuer: 'wearbubble' },
          ),
        };
      });
  }

  verifyQuoteToken(token: string, postalCode: string) {
    try {
      const payload = jwt.verify(token, this.config.jwtSecret, {
        issuer: 'wearbubble',
      });
      if (
        typeof payload === 'string' ||
        payload.purpose !== 'melhor-envio-quote' ||
        payload.postalCode !== postalCode.replace(/\D/g, '') ||
        typeof payload.price !== 'number' ||
        typeof payload.serviceId !== 'number'
      ) {
        throw new Error('Invalid quote');
      }
      return {
        serviceId: payload.serviceId,
        name: String(payload.name),
        company: String(payload.company),
        price: payload.price,
        deliveryTime: Number(payload.deliveryTime),
      };
    } catch {
      throw new BadRequestException(
        'A cotação de frete expirou. Calcule novamente.',
      );
    }
  }

  private verifyState(state: string) {
    try {
      const payload = jwt.verify(state, this.config.jwtSecret, {
        issuer: 'wearbubble',
      });
      if (
        typeof payload === 'string' ||
        payload.purpose !== 'melhor-envio-oauth' ||
        typeof payload.uid !== 'string' ||
        typeof payload.nonce !== 'string'
      ) {
        throw new Error('Invalid state payload');
      }
    } catch {
      throw new UnauthorizedException(
        'Autorização do Melhor Envio expirada ou inválida.',
      );
    }
  }

  private async requestToken(
    payload: Record<string, string>,
  ): Promise<MelhorEnvioTokenResponse> {
    let response: Response;
    try {
      response = await fetch(`${this.config.melhorEnvioBaseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': this.config.melhorEnvioUserAgent,
        },
        body: new URLSearchParams(payload).toString(),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Não foi possível acessar o Melhor Envio.',
      );
    }
    const data = (await response
      .json()
      .catch(() => ({}))) as MelhorEnvioTokenResponse;
    if (!response.ok) {
      throw new BadRequestException(
        data.error_description ||
          data.message ||
          data.error ||
          'O Melhor Envio recusou a autorização.',
      );
    }
    if (!data.access_token || !data.refresh_token) {
      throw new ServiceUnavailableException(
        'O Melhor Envio não retornou os tokens esperados.',
      );
    }
    return data;
  }

  private async saveToken(token: MelhorEnvioTokenResponse) {
    const expiresAt = new Date(
      Date.now() + Number(token.expires_in || 2592000) * 1000,
    );
    const credential =
      (await this.credentials.findOneBy({ id: CREDENTIAL_ID })) ||
      this.credentials.create({ id: CREDENTIAL_ID });
    credential.accessTokenEncrypted = this.encrypt(token.access_token!);
    credential.refreshTokenEncrypted = this.encrypt(token.refresh_token!);
    credential.tokenType = token.token_type || 'Bearer';
    credential.scope = token.scope || null;
    credential.expiresAt = expiresAt;
    await this.credentials.save(credential);
  }

  private encrypt(value: string) {
    const key = this.encryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  private decrypt(value: string) {
    const [version, iv, tag, ciphertext] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !ciphertext) {
      throw new ServiceUnavailableException('Token do Melhor Envio inválido.');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private async authorizedRequest(path: string, init: RequestInit) {
    const credential = await this.credentials.findOneBy({ id: CREDENTIAL_ID });
    if (!credential) {
      throw new ServiceUnavailableException(
        'Melhor Envio ainda não foi autorizado.',
      );
    }
    const response = await fetch(`${this.config.melhorEnvioBaseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.decrypt(credential.accessTokenEncrypted)}`,
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': this.config.melhorEnvioUserAgent,
        ...init.headers,
      },
    });
    const data = (await response
      .json()
      .catch(() => ({}))) as MelhorEnvioApiError;
    if (!response.ok) {
      throw new ServiceUnavailableException(
        this.melhorEnvioError(
          data,
          'Não foi possível calcular o frete no Melhor Envio.',
        ),
      );
    }
    return data;
  }

  private melhorEnvioError(data: MelhorEnvioApiError, fallback: string) {
    const details = Object.entries(data?.errors || {})
      .flatMap(([field, messages]) => {
        const values = Array.isArray(messages) ? messages : [messages];
        return values.filter(Boolean).map((message) => `${field}: ${message}`);
      })
      .join(' ');
    const message = data?.message || data?.error || fallback;
    return details ? `${message} ${details}` : message;
  }

  private encryptionKey() {
    if (!this.config.melhorEnvioTokenEncryptionKey) {
      throw new ServiceUnavailableException(
        'MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY não configurada.',
      );
    }
    return createHash('sha256')
      .update(this.config.melhorEnvioTokenEncryptionKey, 'utf8')
      .digest();
  }

  private assertConfigured() {
    if (
      !this.config.melhorEnvioClientId ||
      !this.config.melhorEnvioClientSecret ||
      !this.config.melhorEnvioRedirectUri
    ) {
      throw new ServiceUnavailableException(
        'Credenciais do Melhor Envio não configuradas no backend.',
      );
    }
    this.encryptionKey();
  }
}
