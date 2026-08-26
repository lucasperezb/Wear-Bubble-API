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
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../../auth/auth.types';
import { AppConfigService } from '../../config/config.service';
import { ProductsService } from '../../products/products.service';
import { EmailService } from '../../email/email.service';
import { OrderEntity } from '../../orders/entities/order.entity';
import { OrderRecord, ShippingPackage } from '../../orders/order.types';
import { ShippingQuoteDto } from './dto/shipping-quote.dto';
import { GenerateShipmentDto } from './dto/generate-shipment.dto';
import { MelhorEnvioCredentialEntity } from './entities/melhor-envio-credential.entity';
import { MelhorEnvioWebhookEventEntity } from './entities/melhor-envio-webhook-event.entity';
import { OrderShipmentEntity } from './entities/order-shipment.entity';
import {
  MelhorEnvioApiError,
  MelhorEnvioCartResponse,
  MelhorEnvioPrintResponse,
  MelhorEnvioQuoteApiOption,
  MelhorEnvioStatePayload,
  MelhorEnvioTokenResponse,
  MelhorEnvioWebhookPayload,
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
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private readonly config: AppConfigService,
    @InjectRepository(MelhorEnvioCredentialEntity)
    private readonly credentials: Repository<MelhorEnvioCredentialEntity>,
    @InjectRepository(OrderShipmentEntity)
    private readonly shipments: Repository<OrderShipmentEntity>,
    @InjectRepository(MelhorEnvioWebhookEventEntity)
    private readonly webhookEvents: Repository<MelhorEnvioWebhookEventEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    private readonly products: ProductsService,
    private readonly email: EmailService,
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
        width: row.width,
        height: row.height,
        length: row.length,
        weight: row.weight,
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
          services: this.config.melhorEnvioAllowedServices.join(','),
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
          !option?.error &&
          this.isAllowedService(Number(option?.id)) &&
          Number(option?.custom_price ?? option?.price) >= 0,
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
        const packages = this.normalizePackages(option.packages, products);
        return {
          id: String(option.id),
          name: String(option.name || 'Entrega'),
          company: String(option.company?.name || 'Transportadora'),
          picture: option.company?.picture || null,
          price,
          carrierPrice,
          deliveryTime,
          packages,
          quoteToken: jwt.sign(
            {
              purpose: 'melhor-envio-quote',
              postalCode: dto.postalCode.replace(/\D/g, ''),
              serviceId: Number(option.id),
              name: String(option.name || 'Entrega'),
              company: String(option.company?.name || 'Transportadora'),
              price,
              carrierPrice,
              deliveryTime,
              packages,
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
        typeof payload.serviceId !== 'number' ||
        !this.isAllowedService(payload.serviceId)
      ) {
        throw new Error('Invalid quote');
      }
      return {
        serviceId: payload.serviceId,
        name: String(payload.name),
        company: String(payload.company),
        price: payload.price,
        carrierPrice: Number(payload.carrierPrice),
        deliveryTime: Number(payload.deliveryTime),
        packages: this.validateTokenPackages(payload.packages),
      };
    } catch {
      throw new BadRequestException(
        'A cotação de frete expirou. Calcule novamente.',
      );
    }
  }

  async createShipments(orderId: string, dto: GenerateShipmentDto) {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: { items: true },
    });
    if (!order) throw new BadRequestException('Pedido não encontrado.');
    if (order.status !== 'paid') {
      throw new BadRequestException(
        'A etiqueta só pode ser gerada após a confirmação do pagamento.',
      );
    }
    if (
      !order.shippingServiceId ||
      !this.isAllowedService(order.shippingServiceId)
    ) {
      throw new BadRequestException('O pedido não possui PAC ou SEDEX válido.');
    }
    const invoiceKey = String(dto.invoiceKey || '').replace(/\D/g, '');
    if (this.config.melhorEnvioRequireInvoice && invoiceKey.length !== 44) {
      throw new BadRequestException(
        'Informe a chave da NF-e antes de gerar a etiqueta.',
      );
    }
    this.assertSenderConfigured();
    const packages = this.orderPackages(order);
    const existing = await this.shipments.find({
      where: { orderId },
      order: { packageIndex: 'ASC' },
    });
    const byPackage = new Map(existing.map((row) => [row.packageIndex, row]));

    for (const [packageIndex, volume] of packages.entries()) {
      let shipment = byPackage.get(packageIndex);
      if (!shipment) {
        shipment = this.shipments.create({
          orderId,
          packageIndex,
          providerOrderId: null,
          status: 'draft',
          serviceId: order.shippingServiceId,
          serviceName:
            order.shippingServiceName ||
            this.serviceName(order.shippingServiceId),
          carrier: 'Correios',
          carrierPrice: this.packagePrice(
            order.shippingCarrierPrice,
            packages.length,
          ),
          invoiceKey: invoiceKey || null,
          volume,
          protocol: null,
          authorizationCode: null,
          tracking: null,
          trackingUrl: null,
          printUrl: null,
          lastError: null,
          attempts: 0,
          paidAt: null,
          generatedAt: null,
          postedAt: null,
          deliveredAt: null,
          canceledAt: null,
        });
        shipment = await this.shipments.save(shipment);
        byPackage.set(packageIndex, shipment);
      } else if (invoiceKey && !shipment.invoiceKey) {
        shipment.invoiceKey = invoiceKey;
        await this.shipments.save(shipment);
      }
      await this.advanceShipment(order, shipment);
    }
    return this.listShipments(orderId);
  }

  async listShipments(orderId: string) {
    const rows = await this.shipments.find({
      where: { orderId },
      order: { packageIndex: 'ASC' },
    });
    return rows.map((row) => this.shipmentRecord(row));
  }

  validateWebhookSignature(rawBody: Buffer, received?: string) {
    if (!received) throw new UnauthorizedException('Assinatura ausente.');
    const expected = createHmac('sha256', this.config.melhorEnvioClientSecret)
      .update(rawBody)
      .digest('base64');
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received.trim());
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new UnauthorizedException('Assinatura inválida.');
    }
  }

  async handleWebhook(rawBody: Buffer, signature?: string) {
    this.validateWebhookSignature(rawBody, signature);
    let payload: MelhorEnvioWebhookPayload;
    try {
      payload = JSON.parse(
        rawBody.toString('utf8'),
      ) as MelhorEnvioWebhookPayload;
    } catch {
      throw new BadRequestException('Webhook com JSON inválido.');
    }
    const event = String(payload.event || '');
    const providerOrderId = String(payload.data?.id || '');
    if (!event.startsWith('order.') || !providerOrderId) {
      return { received: true, verification: true };
    }
    const id = createHash('sha256').update(rawBody).digest('hex');
    if (await this.webhookEvents.exists({ where: { id } })) {
      return { received: true, duplicate: true };
    }
    const eventRow = await this.webhookEvents.save(
      this.webhookEvents.create({
        id,
        event,
        providerOrderId,
        payload: payload as unknown as Record<string, unknown>,
        processedAt: null,
      }),
    );
    await this.applyWebhookEvent(event, payload.data!);
    eventRow.processedAt = new Date();
    await this.webhookEvents.save(eventRow);
    if (event === 'order.released') {
      setImmediate(() => void this.completeReleasedShipment(providerOrderId));
    }
    return { received: true };
  }

  private async advanceShipment(
    order: OrderEntity,
    shipment: OrderShipmentEntity,
  ) {
    if (!shipment.providerOrderId) {
      shipment.attempts += 1;
      try {
        const cart = (await this.authorizedRequest(
          '/api/v2/me/cart',
          {
            method: 'POST',
            body: JSON.stringify(this.cartPayload(order, shipment)),
          },
          'Não foi possível criar a etiqueta no carrinho.',
        )) as MelhorEnvioCartResponse;
        if (!cart.id)
          throw new Error('O Melhor Envio não retornou o ID da etiqueta.');
        shipment.providerOrderId = cart.id;
        shipment.protocol = cart.protocol || null;
        shipment.authorizationCode = cart.authorization_code || null;
        shipment.status = cart.status || 'pending';
        shipment.carrierPrice = Number(cart.price) || shipment.carrierPrice;
        shipment.lastError = null;
        await this.shipments.save(shipment);
      } catch (error) {
        shipment.lastError = this.errorMessage(error);
        await this.shipments.save(shipment);
        throw error;
      }
    }
    if (['generated', 'posted', 'delivered'].includes(shipment.status)) return;
    if (!shipment.paidAt && shipment.providerOrderId) {
      try {
        await this.authorizedRequest(
          '/api/v2/me/shipment/checkout',
          {
            method: 'POST',
            body: JSON.stringify({ orders: [shipment.providerOrderId] }),
          },
          'Não foi possível comprar a etiqueta. Verifique o saldo da Melhor Carteira.',
        );
        shipment.status = 'released';
        shipment.paidAt = new Date();
        shipment.lastError = null;
        await this.shipments.save(shipment);
      } catch (error) {
        shipment.status = 'purchasing';
        shipment.lastError = this.errorMessage(error);
        await this.shipments.save(shipment);
        return;
      }
    }
    await this.generateAndPrint(shipment);
  }

  private async generateAndPrint(shipment: OrderShipmentEntity) {
    if (!shipment.providerOrderId || shipment.generatedAt) return;
    try {
      await this.authorizedRequest(
        '/api/v2/me/shipment/generate',
        {
          method: 'POST',
          body: JSON.stringify({ orders: [shipment.providerOrderId] }),
        },
        'Não foi possível gerar a etiqueta.',
      );
      shipment.status = 'generated';
      shipment.generatedAt = new Date();
      const printed = (await this.authorizedRequest(
        '/api/v2/me/shipment/print',
        {
          method: 'POST',
          body: JSON.stringify({
            mode: 'public',
            orders: [shipment.providerOrderId],
          }),
        },
        'A etiqueta foi gerada, mas não foi possível obter o link de impressão.',
      )) as MelhorEnvioPrintResponse;
      shipment.printUrl = printed.url || null;
      shipment.lastError = null;
      await this.shipments.save(shipment);
    } catch (error) {
      shipment.lastError = this.errorMessage(error);
      await this.shipments.save(shipment);
    }
  }

  private async completeReleasedShipment(providerOrderId: string) {
    const shipment = await this.shipments.findOneBy({ providerOrderId });
    if (!shipment) return;
    shipment.status = 'released';
    shipment.paidAt ||= new Date();
    await this.shipments.save(shipment);
    await this.generateAndPrint(shipment);
  }

  private async applyWebhookEvent(
    event: string,
    data: NonNullable<MelhorEnvioWebhookPayload['data']>,
  ) {
    if (!this.isUuid(String(data.id || ''))) return;
    const shipment = await this.shipments.findOneBy({
      providerOrderId: String(data.id),
    });
    if (!shipment) return;
    shipment.status = String(data.status || event.replace('order.', ''));
    shipment.protocol = data.protocol || shipment.protocol;
    shipment.authorizationCode =
      data.authorization_code || shipment.authorizationCode;
    shipment.tracking = data.tracking || shipment.tracking;
    shipment.trackingUrl = data.tracking_url || shipment.trackingUrl;
    shipment.paidAt = this.webhookDate(data.paid_at) || shipment.paidAt;
    shipment.generatedAt =
      this.webhookDate(data.generated_at) || shipment.generatedAt;
    shipment.postedAt = this.webhookDate(data.posted_at) || shipment.postedAt;
    shipment.deliveredAt =
      this.webhookDate(data.delivered_at) || shipment.deliveredAt;
    shipment.canceledAt =
      this.webhookDate(data.canceled_at) || shipment.canceledAt;
    shipment.lastError = null;
    await this.shipments.save(shipment);

    const order = await this.orders.findOne({
      where: { id: shipment.orderId },
      relations: { items: true },
    });
    if (!order) return;
    const previousStage = order.shipStage;
    const previousTracking = order.tracking;
    if (event === 'order.posted')
      order.shipStage = Math.max(order.shipStage, 3);
    if (event === 'order.delivered') {
      order.shipStage = 5;
      order.deliveredAt = shipment.deliveredAt || new Date();
    }
    if (shipment.tracking) order.tracking = shipment.tracking;
    await this.orders.save(order);
    if (
      previousStage !== order.shipStage ||
      previousTracking !== order.tracking
    ) {
      await this.email.sendShippingUpdate(this.orderEmailRecord(order));
    }
  }

  private cartPayload(order: OrderEntity, shipment: OrderShipmentEntity) {
    const sender = this.config.melhorEnvioSender;
    const volume = shipment.volume as unknown as ShippingPackage;
    const productQuantities = new Map(
      (volume.products || []).map((product) => [
        Number(product.id),
        Number(product.quantity),
      ]),
    );
    const selectedItems = (order.items || []).filter(
      (item) =>
        !productQuantities.size || productQuantities.has(item.productId || 0),
    );
    const products = selectedItems.map((item) => ({
      name: [item.productName, item.color, item.size]
        .filter(Boolean)
        .join(' - '),
      quantity: productQuantities.get(item.productId || 0) || item.quantity,
      unitary_value: Number(item.unitPrice),
    }));
    const insuranceValue =
      Number(volume.insuranceValue) ||
      products.reduce(
        (total, product) => total + product.unitary_value * product.quantity,
        0,
      );
    return {
      service: shipment.serviceId,
      from: {
        name: sender.name,
        company_document: sender.companyDocument,
        state_register: sender.stateRegister || 'ISENTO',
        phone: sender.phone,
        email: sender.email,
        address: sender.address,
        complement: sender.complement,
        number: sender.number,
        district: sender.district,
        city: sender.city,
        state_abbr: sender.state,
        country_id: 'BR',
        postal_code: sender.postalCode,
      },
      to: {
        name: order.customerName,
        document: order.customerTaxId.replace(/\D/g, ''),
        phone: order.customerPhone.replace(/\D/g, ''),
        email: order.customerEmail,
        address: order.shippingStreet,
        complement: order.shippingReference,
        number: order.shippingNumber,
        district: order.shippingNeighborhood,
        city: order.shippingCity,
        state_abbr: order.shippingState,
        country_id: 'BR',
        postal_code: order.shippingCep.replace(/\D/g, ''),
      },
      products,
      volumes: [
        {
          height: Number(volume.height),
          width: Number(volume.width),
          length: Number(volume.length),
          weight: Number(volume.weight),
        },
      ],
      options: {
        insurance_value: insuranceValue,
        receipt: false,
        own_hand: false,
        reverse: false,
        non_commercial: !shipment.invoiceKey,
        ...(shipment.invoiceKey
          ? { invoice: { key: shipment.invoiceKey } }
          : {}),
        tags: [{ tag: order.number, url: null }],
      },
    };
  }

  private orderPackages(order: OrderEntity): ShippingPackage[] {
    const stored = (order.shippingPackages ||
      []) as unknown as ShippingPackage[];
    if (stored.length) return stored;
    const rows = order.items || [];
    return [
      {
        height: Math.max(...rows.map((item) => item.product?.height || 4), 4),
        width: Math.max(...rows.map((item) => item.product?.width || 20), 20),
        length: Math.max(...rows.map((item) => item.product?.length || 25), 25),
        weight: Math.max(
          0.001,
          rows.reduce(
            (total, item) =>
              total + (item.product?.weight || 0.3) * item.quantity,
            0,
          ),
        ),
        insuranceValue: rows.reduce(
          (total, item) => total + Number(item.unitPrice) * item.quantity,
          0,
        ),
        products: rows.map((item) => ({
          id: String(item.productId || ''),
          quantity: item.quantity,
        })),
      },
    ];
  }

  private normalizePackages(
    packages: MelhorEnvioQuoteApiOption['packages'],
    products: Array<{
      id: string;
      width: number;
      height: number;
      length: number;
      weight: number;
      insurance_value: number;
      quantity: number;
    }>,
  ): ShippingPackage[] {
    if (Array.isArray(packages) && packages.length) {
      return packages.map((item) => ({
        height: Number(item.dimensions?.height) || 4,
        width: Number(item.dimensions?.width) || 20,
        length: Number(item.dimensions?.length) || 25,
        weight: Number(item.weight) || 0.3,
        insuranceValue: Number(item.insurance_value) || 0,
        products: (item.products || []).map((product) => ({
          id: String(product.id || ''),
          quantity: Number(product.quantity) || 1,
        })),
      }));
    }
    return [
      {
        height: Math.max(...products.map((item) => item.height)),
        width: Math.max(...products.map((item) => item.width)),
        length: Math.max(...products.map((item) => item.length)),
        weight: products.reduce(
          (total, item) => total + item.weight * item.quantity,
          0,
        ),
        insuranceValue: products.reduce(
          (total, item) => total + item.insurance_value * item.quantity,
          0,
        ),
        products: products.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
      },
    ];
  }

  private validateTokenPackages(value: unknown): ShippingPackage[] {
    if (!Array.isArray(value) || !value.length) {
      throw new BadRequestException(
        'A cotação não contém os volumes esperados.',
      );
    }
    return value.map((item) => {
      const row = item as Partial<ShippingPackage>;
      return {
        height: Math.max(1, Number(row.height) || 0),
        width: Math.max(1, Number(row.width) || 0),
        length: Math.max(1, Number(row.length) || 0),
        weight: Math.max(0.001, Number(row.weight) || 0),
        insuranceValue: Math.max(0, Number(row.insuranceValue) || 0),
        products: Array.isArray(row.products)
          ? row.products.map((product) => ({
              id: String(product.id),
              quantity: Math.max(1, Number(product.quantity) || 1),
            }))
          : [],
      };
    });
  }

  private shipmentRecord(row: OrderShipmentEntity) {
    return {
      id: row.id,
      packageIndex: row.packageIndex,
      providerOrderId: row.providerOrderId,
      status: row.status,
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      carrier: row.carrier,
      carrierPrice: row.carrierPrice,
      protocol: row.protocol,
      authorizationCode: row.authorizationCode,
      tracking: row.tracking,
      trackingUrl: row.trackingUrl,
      printUrl: row.printUrl,
      lastError: row.lastError,
      attempts: row.attempts,
      generatedAt: row.generatedAt?.toISOString() || null,
      postedAt: row.postedAt?.toISOString() || null,
      deliveredAt: row.deliveredAt?.toISOString() || null,
    };
  }

  private orderEmailRecord(row: OrderEntity): OrderRecord {
    return {
      id: row.id,
      customerId: row.customerUid || 'anon',
      number: row.number,
      date: row.orderedAt.getTime(),
      items: (row.items || []).map((item) => ({
        id: item.id,
        pid: item.productId || 0,
        name: item.productName,
        size: item.size,
        color: item.color,
        qty: item.quantity,
        price: item.unitPrice,
      })),
      total: row.total,
      method: row.method,
      coupon: row.couponCode,
      couponPct: row.couponPct,
      status: row.status,
      shipStage: row.shipStage,
      delivery: {
        name: row.customerName,
        email: row.customerEmail,
        taxId: row.customerTaxId,
        phone: row.customerPhone,
        cep: row.shippingCep,
        street: row.shippingStreet,
        neighborhood: row.shippingNeighborhood,
        number: row.shippingNumber,
        reference: row.shippingReference,
        city: row.shippingCity,
        state: row.shippingState,
      },
      shipping: {
        serviceId: row.shippingServiceId || 0,
        name: row.shippingServiceName || '',
        company: row.shippingCompany || 'Correios',
        price: row.shippingPrice,
        carrierPrice: row.shippingCarrierPrice,
        deliveryTime: row.shippingDeliveryTime || 0,
        packages: (row.shippingPackages || []) as unknown as ShippingPackage[],
      },
      ...(row.tracking ? { tracking: row.tracking } : {}),
    };
  }

  private assertSenderConfigured() {
    const sender = this.config.melhorEnvioSender;
    if (
      !sender.name ||
      sender.companyDocument.length !== 14 ||
      !sender.phone ||
      !sender.email ||
      !sender.address ||
      !sender.number ||
      !sender.district ||
      !sender.city ||
      sender.state.length !== 2 ||
      sender.postalCode.length !== 8
    ) {
      throw new ServiceUnavailableException(
        'Complete os dados MELHOR_ENVIO_SENDER_* antes de gerar etiquetas.',
      );
    }
  }

  private isAllowedService(serviceId: number) {
    return (this.config.melhorEnvioAllowedServices as number[]).includes(
      serviceId,
    );
  }

  private serviceName(serviceId: number) {
    return serviceId === 1 ? 'PAC' : 'SEDEX';
  }

  private packagePrice(total: number, count: number) {
    return Math.round((Number(total || 0) / Math.max(1, count)) * 100) / 100;
  }

  private webhookDate(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Erro desconhecido.';
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
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

  private async authorizedRequest(
    path: string,
    init: RequestInit,
    fallback = 'Não foi possível acessar o Melhor Envio.',
  ) {
    const credential = await this.credentials.findOneBy({ id: CREDENTIAL_ID });
    if (!credential) {
      throw new ServiceUnavailableException(
        'Melhor Envio ainda não foi autorizado.',
      );
    }
    let accessToken = await this.validAccessToken(credential);
    let response = await fetch(`${this.config.melhorEnvioBaseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': this.config.melhorEnvioUserAgent,
        ...init.headers,
      },
    });
    if (response.status === 401) {
      accessToken = await this.refreshAccessToken(credential, true);
      response = await fetch(`${this.config.melhorEnvioBaseUrl}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': this.config.melhorEnvioUserAgent,
          ...init.headers,
        },
      });
    }
    const data = (await response
      .json()
      .catch(() => ({}))) as MelhorEnvioApiError;
    if (!response.ok) {
      throw new ServiceUnavailableException(
        this.melhorEnvioError(data, fallback),
      );
    }
    return data;
  }

  private async validAccessToken(credential: MelhorEnvioCredentialEntity) {
    if (credential.expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
      return this.decrypt(credential.accessTokenEncrypted);
    }
    return this.refreshAccessToken(credential);
  }

  private async refreshAccessToken(
    credential: MelhorEnvioCredentialEntity,
    force = false,
  ) {
    if (!force && credential.expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
      return this.decrypt(credential.accessTokenEncrypted);
    }
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        const token = await this.requestToken({
          grant_type: 'refresh_token',
          client_id: this.config.melhorEnvioClientId,
          client_secret: this.config.melhorEnvioClientSecret,
          refresh_token: this.decrypt(credential.refreshTokenEncrypted),
        });
        await this.saveToken(token);
        return token.access_token!;
      })().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
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
