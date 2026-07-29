import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigService } from '../config/config.service';
import { EmailService } from '../email/email.service';
import { ProfileEntity } from '../account/entities/profile.entity';
import { AddressEntity } from '../account/entities/address.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import { OrderDelivery, OrderRecord } from '../orders/order.types';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import {
  CheckoutCustomerDto,
  CreateCheckoutDto,
} from './dto/create-checkout.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { MelhorEnvioService } from '../integrations/melhor-envio/melhor-envio.service';

@Injectable()
export class PaymentsService {
  private cachedPublicKey = '';

  constructor(
    private readonly config: AppConfigService,
    private readonly orders: OrdersService,
    private readonly products: ProductsService,
    private readonly email: EmailService,
    @InjectRepository(ProfileEntity)
    private readonly profiles: Repository<ProfileEntity>,
    @InjectRepository(AddressEntity)
    private readonly addresses: Repository<AddressEntity>,
    private readonly users: UsersService,
    private readonly melhorEnvio: MelhorEnvioService,
  ) {}

  async publicKey() {
    if (!this.config.pagbankToken)
      throw new ServiceUnavailableException(
        'PAGBANK_TOKEN nao configurado no backend.',
      );
    if (this.config.pagbankPublicKey)
      return {
        publicKey: this.config.pagbankPublicKey,
        environment: this.config.pagbankEnv,
      };
    if (this.cachedPublicKey)
      return {
        publicKey: this.cachedPublicKey,
        environment: this.config.pagbankEnv,
      };

    let response = await fetch(
      `${this.config.pagbankBaseUrl}/public-keys/card`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${this.config.pagbankToken}`,
          accept: 'application/json',
        },
      },
    );
    if (response.status === 404) {
      response = await fetch(`${this.config.pagbankBaseUrl}/public-keys`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.pagbankToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ type: 'card' }),
      });
    }
    const data = (await response.json().catch(() => ({}))) as Record<
      string,
      any
    >;
    if (!response.ok)
      throw new ServiceUnavailableException(
        this.pagbankError(data, 'Nao foi possivel obter a chave publica.'),
      );
    this.cachedPublicKey = String(
      data.public_key || data.publicKey || data.key || '',
    );
    if (!this.cachedPublicKey)
      throw new ServiceUnavailableException(
        'PagBank nao retornou a chave publica.',
      );
    return {
      publicKey: this.cachedPublicKey,
      environment: this.config.pagbankEnv,
    };
  }

  async status(orderId: string) {
    const order = await this.orders.findEntity(orderId);
    if (!order) throw new BadRequestException('Pedido inexistente.');
    if (
      order.status === 'pending' &&
      order.pagbankCheckoutId &&
      this.config.pagbankToken
    ) {
      const response = await fetch(
        `${this.config.pagbankBaseUrl}/orders/${encodeURIComponent(order.pagbankCheckoutId)}`,
        {
          headers: {
            authorization: `Bearer ${this.config.pagbankToken}`,
            accept: 'application/json',
          },
        },
      );
      if (response.ok) {
        const gatewayOrder = (await response
          .json()
          .catch(() => ({}))) as Record<string, any>;
        const charges = Array.isArray(gatewayOrder?.charges)
          ? gatewayOrder.charges
          : [];
        const paid = charges.find(
          (charge) => String(charge?.status || '').toUpperCase() === 'PAID',
        );
        const canceled = charges.find((charge) =>
          ['DECLINED', 'CANCELED', 'CANCELLED'].includes(
            String(charge?.status || '').toUpperCase(),
          ),
        );
        if (paid) await this.markOrderPaid(order, paid.id || null);
        else if (canceled) {
          order.status = 'canceled';
          order.pagbankPaymentId = canceled.id || null;
          await this.orders.saveEntity(order);
        }
      }
    }
    return {
      orderId: order.id,
      number: order.number,
      status: order.status,
      total: order.total,
    };
  }

  async checkout(user: AuthenticatedUser | undefined, dto: CreateCheckoutDto) {
    if (!this.config.pagbankToken)
      throw new ServiceUnavailableException(
        'PAGBANK_TOKEN nao configurado no backend.',
      );
    const items = Array.isArray(dto?.items) ? dto.items : [];
    if (!items.length) throw new BadRequestException('Carrinho vazio.');
    const method = this.normalizeMethod(dto.method);
    if (method !== 'Pix' && !dto.encryptedCard)
      throw new BadRequestException(
        'Os dados criptografados do cartao sao obrigatorios.',
      );
    if (dto.existingOrderId) {
      if (method === 'Pix')
        throw new BadRequestException('Este Pix ja foi gerado.');
      return this.payExistingOrderWithCard(dto);
    }
    const customer = await this.resolveCustomer(user, dto.customer);
    if (!dto.shippingQuoteToken)
      throw new BadRequestException('Selecione uma opcao de entrega.');
    const shipping = this.melhorEnvio.verifyQuoteToken(
      dto.shippingQuoteToken,
      customer.delivery.cep,
    );
    const order = await this.orders.createPending(
      customer.uid,
      {
        items,
        method: method,
        coupon: dto.coupon,
        bundle: dto.bundle,
      },
      customer.delivery,
      shipping,
    );
    const payload = this.orderPayload(
      customer.delivery,
      order,
      method,
      dto.encryptedCard,
      dto.installments,
    );

    try {
      const response = await fetch(`${this.config.pagbankBaseUrl}/orders`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.pagbankToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
          'x-idempotency-key': order.id,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as Record<
        string,
        any
      >;
      if (!response.ok) {
        throw new ServiceUnavailableException(
          this.pagbankError(
            data,
            'Nao foi possivel processar o pagamento no PagBank.',
          ),
        );
      }

      const savedOrder = await this.orders.findEntity(order.id);
      if (savedOrder) {
        savedOrder.gateway = 'pagbank';
        savedOrder.pagbankCheckoutId = data?.id || null;
        const charge = Array.isArray(data?.charges) ? data.charges[0] : null;
        savedOrder.pagbankPaymentId = charge?.id || null;
        const chargeStatus = String(charge?.status || '').toUpperCase();
        if (chargeStatus === 'PAID') {
          await this.markOrderPaid(savedOrder, charge?.id || null);
        } else if (
          ['DECLINED', 'CANCELED', 'CANCELLED'].includes(chargeStatus)
        ) {
          savedOrder.status = 'canceled';
          await this.orders.saveEntity(savedOrder);
        } else {
          await this.orders.saveEntity(savedOrder);
        }
      }

      if (method === 'Pix') {
        const qrCode = Array.isArray(data?.qr_codes) ? data.qr_codes[0] : null;
        if (!qrCode?.text)
          throw new ServiceUnavailableException(
            'PagBank nao retornou o codigo Pix.',
          );
        const links = Array.isArray(qrCode.links) ? qrCode.links : [];
        const image = links.find(
          (link) =>
            String(link.rel || '').toUpperCase() === 'QRCODE.PNG' ||
            String(link.media || '').toLowerCase() === 'image/png',
        )?.href;
        await this.email.sendOrderCreated(order);
        return {
          orderId: order.id,
          number: order.number,
          total: order.total,
          paymentStatus: 'WAITING',
          pix: {
            text: qrCode.text,
            image: image || null,
            expiresAt: qrCode.expiration_date || null,
          },
        };
      }

      const charge = Array.isArray(data?.charges) ? data.charges[0] : null;
      if (
        !['PAID', 'DECLINED', 'CANCELED', 'CANCELLED'].includes(
          String(charge?.status || '').toUpperCase(),
        )
      ) {
        await this.email.sendOrderCreated(order);
      }
      return {
        orderId: order.id,
        number: order.number,
        total: order.total,
        paymentStatus: String(charge?.status || 'WAITING').toUpperCase(),
        message:
          charge?.payment_response?.message ||
          (charge?.status === 'DECLINED'
            ? 'Pagamento nao autorizado.'
            : 'Pagamento processado.'),
        pagbankCheckoutId: data?.id || null,
      };
    } catch (error) {
      await this.orders.rollbackPending(order);
      throw error;
    }
  }

  private async payExistingOrderWithCard(dto: CreateCheckoutDto) {
    const orderRow = await this.orders.findEntity(dto.existingOrderId!);
    if (!orderRow || !orderRow.pagbankCheckoutId)
      throw new BadRequestException('Pedido pendente nao encontrado.');
    if (orderRow.status !== 'pending')
      throw new BadRequestException('Este pedido nao esta mais pendente.');
    const order = this.orders.toRecord(orderRow);
    const cardTotal =
      order.method === 'Pix'
        ? Math.round((order.total / (1 - this.config.pixDiscount)) * 100) / 100
        : order.total;
    const cardOrder = { ...order, total: cardTotal };
    const chargePayload = this.cardCharge(
      cardOrder,
      dto.encryptedCard!,
      dto.installments,
    );
    const response = await fetch(
      `${this.config.pagbankBaseUrl}/orders/${encodeURIComponent(orderRow.pagbankCheckoutId)}/pay`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.pagbankToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
          'x-idempotency-key': `${order.id}-card`,
        },
        body: JSON.stringify({ charges: [chargePayload] }),
      },
    );
    const data = (await response.json().catch(() => ({}))) as Record<
      string,
      any
    >;
    if (!response.ok)
      throw new ServiceUnavailableException(
        this.pagbankError(
          data,
          'Nao foi possivel trocar o pagamento para cartao.',
        ),
      );

    const charge = Array.isArray(data?.charges)
      ? data.charges[0]
      : String(data?.id || '').startsWith('CHAR_')
        ? data
        : null;
    const chargeStatus = String(charge?.status || 'WAITING').toUpperCase();
    orderRow.pagbankPaymentId = charge?.id || null;
    if (chargeStatus === 'PAID') {
      orderRow.method = 'Cartao de credito';
      orderRow.total = cardTotal;
      await this.markOrderPaid(orderRow, charge?.id || null);
    } else if (['DECLINED', 'CANCELED', 'CANCELLED'].includes(chargeStatus)) {
      await this.orders.saveEntity(orderRow);
    } else {
      orderRow.method = 'Cartao de credito';
      orderRow.total = cardTotal;
      await this.orders.saveEntity(orderRow);
    }
    return {
      orderId: order.id,
      number: order.number,
      total: cardTotal,
      paymentStatus: chargeStatus,
      message:
        charge?.payment_response?.message ||
        (chargeStatus === 'DECLINED'
          ? 'Pagamento nao autorizado.'
          : 'Pagamento processado.'),
      pagbankCheckoutId: orderRow.pagbankCheckoutId,
    };
  }

  async pagbankWebhook(
    dto: PaymentWebhookDto,
    rawBody?: Buffer,
    signature?: string,
  ) {
    this.assertPagbankSignature(rawBody, signature);
    const orderId = this.findOrderId(dto);
    if (!orderId) throw new BadRequestException('reference_id ausente.');
    const orderRow = await this.orders.findEntity(orderId);
    const order = orderRow ? this.orders.toRecord(orderRow) : undefined;
    if (!order || !orderRow)
      throw new BadRequestException('Pedido inexistente.');
    if (order.status === 'paid') return { ok: true };

    const status = this.findPagbankStatus(dto);
    if (status === 'PAID') {
      await this.markPaid(orderRow, dto);
      return { ok: true };
    }
    if (['CANCELED', 'CANCELLED', 'DECLINED'].includes(status)) {
      orderRow.status = 'canceled';
      await this.orders.saveEntity(orderRow);
    }
    return { ok: true };
  }

  private orderPayload(
    customer: OrderDelivery,
    order: OrderRecord,
    method: string,
    encryptedCard?: string,
    installmentsValue?: number,
  ) {
    const amount = Math.round(order.total * 100);
    const phoneDigits = customer.phone.replace(/\D/g, '');
    const payload: Record<string, unknown> = {
      reference_id: order.id,
      customer: {
        name: customer.name.slice(0, 120),
        email: customer.email,
        tax_id: customer.taxId.replace(/\D/g, ''),
        ...(phoneDigits.length >= 10
          ? {
              phones: [
                {
                  country: '55',
                  area: phoneDigits.slice(0, 2),
                  number: phoneDigits.slice(2),
                  type: phoneDigits.length === 11 ? 'MOBILE' : 'HOME',
                },
              ],
            }
          : {}),
      },
      items: [
        {
          reference_id: order.number,
          name: `Pedido ${order.number} - Bubble`,
          quantity: 1,
          unit_amount: amount,
        },
      ],
      shipping: {
        address: {
          street: customer.street.slice(0, 160),
          number: customer.number.slice(0, 20),
          complement: customer.reference.slice(0, 40) || undefined,
          locality: customer.neighborhood.slice(0, 60) || 'Centro',
          city: customer.city.slice(0, 90),
          region_code: customer.state,
          country: 'BRA',
          postal_code: customer.cep.replace(/\D/g, ''),
        },
      },
    };
    if (this.isPublicHttpUrl(this.config.pagbankWebhookUrl)) {
      payload.notification_urls = [this.config.pagbankWebhookUrl];
    }
    if (method === 'Pix') {
      payload.qr_codes = [
        {
          amount: { value: amount },
          expiration_date: new Date(Date.now() + 30 * 60_000).toISOString(),
        },
      ];
    } else {
      payload.charges = [
        this.cardCharge(order, encryptedCard!, installmentsValue),
      ];
    }
    return payload;
  }

  private cardCharge(
    order: OrderRecord,
    encryptedCard: string,
    installmentsValue?: number,
  ) {
    return {
      reference_id: order.id,
      description: `Pedido ${order.number} Bubble`.slice(0, 64),
      amount: {
        value: Math.round(order.total * 100),
        currency: 'BRL',
      },
      payment_method: {
        type: 'CREDIT_CARD',
        installments: Math.max(
          1,
          Math.min(
            Number(this.config.pagbankInstallments),
            Number(installmentsValue) || 1,
          ),
        ),
        capture: true,
        soft_descriptor: 'BUBBLE',
        card: { encrypted: encryptedCard },
      },
    };
  }

  private async resolveCustomer(
    authenticated: AuthenticatedUser | undefined,
    input?: CheckoutCustomerDto,
  ): Promise<{ uid: string; delivery: OrderDelivery }> {
    if (authenticated) {
      const [profile, address] = await Promise.all([
        this.profiles.findOneBy({ uid: authenticated.uid }),
        this.addresses.findOne({
          where: { userUid: authenticated.uid },
          order: { isDefault: 'DESC', createdAt: 'ASC' },
        }),
      ]);
      const delivery = this.normalizeDelivery(input, {
        name:
          profile?.name ||
          authenticated.email.split('@')[0] ||
          'Cliente Bubble',
        email: authenticated.email,
        taxId: profile?.taxId || '',
        phone: profile?.phone || '',
        cep: address?.cep || '',
        street: address?.street || '',
        neighborhood: address?.neighborhood || '',
        number: address?.number || '',
        reference: address?.reference || '',
        city: address?.city || '',
        state: address?.state || '',
      });
      return { uid: authenticated.uid, delivery };
    }

    if (!input)
      throw new BadRequestException(
        'Informe o e-mail e o endereco para continuar sem conta.',
      );
    const delivery = this.normalizeDelivery(input);
    let user = await this.users.findByEmail(delivery.email);
    if (!user) {
      user = await this.users.save(
        this.users.create({
          uid: randomUUID(),
          email: delivery.email,
          passwordHash: await bcrypt.hash(randomUUID(), 10),
          role: 'customer',
          marketingOptIn: false,
          emailVerified: false,
        }),
      );
      await this.profiles.save(
        this.profiles.create({
          uid: user.uid,
          name: delivery.name,
          email: delivery.email,
          taxId: delivery.taxId,
          phone: delivery.phone,
        }),
      );
      await this.addresses.save(
        this.addresses.create({
          userUid: user.uid,
          label: 'Principal',
          cep: delivery.cep,
          street: delivery.street,
          neighborhood: delivery.neighborhood,
          number: delivery.number,
          reference: delivery.reference,
          city: delivery.city,
          state: delivery.state,
          isDefault: true,
        }),
      );
    }
    return { uid: user.uid, delivery };
  }

  private normalizeDelivery(
    input?: CheckoutCustomerDto,
    fallback?: OrderDelivery,
  ): OrderDelivery {
    const value = { ...fallback, ...input };
    const delivery = {
      name: String(value.name || '').trim(),
      email: String(value.email || '')
        .trim()
        .toLowerCase(),
      taxId: String(value.taxId || '').trim(),
      phone: String(value.phone || '').trim(),
      cep: String(value.cep || '').trim(),
      street: String(value.street || '').trim(),
      neighborhood: String(value.neighborhood || '').trim(),
      number: String(value.number || '').trim(),
      reference: String(value.reference || '').trim(),
      city: String(value.city || '').trim(),
      state: String(value.state || '')
        .trim()
        .toUpperCase(),
    };
    if (
      !delivery.name ||
      !delivery.email ||
      !delivery.taxId ||
      !delivery.cep ||
      !delivery.street ||
      !delivery.number ||
      !delivery.city ||
      !delivery.state
    ) {
      throw new BadRequestException(
        'Preencha os dados obrigatorios de entrega.',
      );
    }
    if (!this.isValidCpf(delivery.taxId))
      throw new BadRequestException('Informe um CPF valido.');
    return delivery;
  }

  private isValidCpf(value: string) {
    const cpf = value.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    const digit = (length: number) => {
      const sum = cpf
        .slice(0, length)
        .split('')
        .reduce(
          (total, number, index) =>
            total + Number(number) * (length + 1 - index),
          0,
        );
      const remainder = (sum * 10) % 11;
      return remainder === 10 ? 0 : remainder;
    };
    return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
  }

  private async markPaid(
    orderRow: import('../orders/entities/order.entity').OrderEntity,
    dto: PaymentWebhookDto,
  ) {
    const charge = dto.charges?.find(
      (item) => String(item.status || '').toUpperCase() === 'PAID',
    );
    await this.markOrderPaid(orderRow, charge?.id || dto.id || null);
  }

  private async markOrderPaid(
    orderRow: import('../orders/entities/order.entity').OrderEntity,
    paymentId: string | null,
  ) {
    if (orderRow.status === 'paid') return;
    const order = this.orders.toRecord(orderRow);
    for (const line of order.items || []) {
      const productRow = await this.products.findEntity(Number(line.pid));
      if (productRow) {
        productRow.stock = Math.max(0, productRow.stock - line.qty);
        await this.products.saveEntity(productRow);
      }
    }
    orderRow.status = 'paid';
    orderRow.shipStage = Math.max(order.shipStage || 0, 1);
    orderRow.paidAt = new Date();
    orderRow.pagbankPaymentId = paymentId;
    await this.orders.saveEntity(orderRow);
    await this.email.sendPaymentConfirmed(this.orders.toRecord(orderRow));
  }

  private assertPagbankSignature(rawBody?: Buffer, signature?: string) {
    if (!this.config.pagbankToken)
      throw new ServiceUnavailableException(
        'PAGBANK_TOKEN nao configurado no backend.',
      );
    if (!rawBody || !signature)
      throw new UnauthorizedException('Assinatura PagBank ausente.');
    const expected = createHash('sha256')
      .update(`${this.config.pagbankToken}-${rawBody.toString('utf8')}`)
      .digest('hex');
    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);
    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      throw new UnauthorizedException('Assinatura PagBank invalida.');
    }
  }

  private pagbankError(data: Record<string, any>, fallback: string) {
    const errors = Array.isArray(data?.error_messages)
      ? data.error_messages
      : Array.isArray(data?.errors)
        ? data.errors
        : [];
    const first = errors[0] || {};
    const message =
      first.description || first.message || data?.message || fallback;
    const field = first.parameter_name || first.parameter || '';
    return field ? `${message} Campo: ${field}.` : String(message);
  }

  private findOrderId(dto: PaymentWebhookDto) {
    return (
      dto.reference_id ||
      dto.orderId ||
      dto.charges?.find((charge) => charge.reference_id)?.reference_id ||
      null
    );
  }

  private findPagbankStatus(dto: PaymentWebhookDto) {
    const paidCharge = dto.charges?.find(
      (charge) => String(charge.status || '').toUpperCase() === 'PAID',
    );
    return String(paidCharge?.status || dto.status || '').toUpperCase();
  }

  private normalizeMethod(method?: CreateCheckoutDto['method']) {
    return String(method || '')
      .toLowerCase()
      .includes('pix')
      ? 'Pix'
      : 'Cartao de credito';
  }

  private isPublicHttpUrl(value: string) {
    try {
      const url = new URL(value);
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        !['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)
      );
    } catch {
      return false;
    }
  }
}
