import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { AddressEntity } from '../account/entities/address.entity';
import { ProfileEntity } from '../account/entities/profile.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import { AppConfigService } from '../config/config.service';
import { AdvisoryLockService } from '../persistence/advisory-lock.service';
import { EmailService } from '../email/email.service';
import { EmailGuardService } from '../email/email-guard.service';
import { EmailPolicyService } from '../email/email-policy.service';
import { FraudService } from '../fraud/fraud.service';
import { MelhorEnvioService } from '../integrations/melhor-envio/melhor-envio.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrderDelivery, OrderRecord } from '../orders/order.types';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';
import {
  CheckoutCustomerDto,
  CreateCheckoutDto,
} from './dto/create-checkout.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';

type AsaasPayment = {
  id?: string;
  customer?: string;
  status?: string;
  billingType?: string;
  externalReference?: string;
  value?: number;
  installmentNumber?: number;
  invoiceUrl?: string;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly orders: OrdersService,
    private readonly inventory: InventoryService,
    private readonly email: EmailService,
    @InjectRepository(ProfileEntity)
    private readonly profiles: Repository<ProfileEntity>,
    @InjectRepository(AddressEntity)
    private readonly addresses: Repository<AddressEntity>,
    private readonly users: UsersService,
    private readonly melhorEnvio: MelhorEnvioService,
    private readonly locks: AdvisoryLockService,
    private readonly fraud: FraudService,
    private readonly emailGuard: EmailGuardService,
    private readonly emailPolicy: EmailPolicyService,
  ) {}

  async status(orderId: string) {
    let order = await this.orders.findEntity(orderId);
    if (!order) throw new BadRequestException('Pedido inexistente.');
    if (
      ['pending', 'expired'].includes(order.status) &&
      order.asaasPaymentId &&
      this.config.asaasApiKey
    ) {
      const response = await this.asaasRequest(
        `/payments/${encodeURIComponent(order.asaasPaymentId)}`,
      );
      if (response.ok) {
        const payment = (await this.readJson(response)) as AsaasPayment;
        if (this.isPaid(payment.status, payment.billingType)) {
          await this.markOrderPaid(order, payment.id || null);
          order = (await this.orders.findEntity(orderId)) || order;
        } else if (this.isCanceled(payment.status)) {
          order.asaasPaymentId = payment.id || order.asaasPaymentId;
          await this.orders.saveEntity(order);
          await this.inventory.cancelPendingOrder(order.id);
          await this.orders.releaseStoreCredit(order);
          order = (await this.orders.findEntity(orderId)) || order;
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

  cancelOrder(orderId: string, options: { refundedExternally?: boolean } = {}) {
    // Mesma chave do pagamento: impede dois cancelamentos simultâneos (estoque
    // e crédito devolvidos duas vezes) e cancelamento durante um pagamento.
    return this.locks.withLock(`order:${orderId}`, () =>
      this.cancelOrderLocked(orderId, options),
    );
  }

  private async cancelOrderLocked(
    orderId: string,
    options: { refundedExternally?: boolean },
  ) {
    const orderRow = await this.orders.findEntity(orderId);
    if (!orderRow) throw new BadRequestException('Pedido inexistente.');
    if (orderRow.status === 'canceled') {
      return {
        order: this.orders.toRecord(orderRow),
        cancellation: {
          alreadyCanceled: true,
          paymentId: orderRow.asaasPaymentId,
          status: 'REFUNDED',
        },
      };
    }
    if (orderRow.status !== 'paid') {
      throw new BadRequestException(
        'Somente pedidos com pagamento confirmado podem ser cancelados.',
      );
    }
    if (orderRow.gateway === 'store_credit') {
      await this.inventory.restockCanceledOrder(orderRow.id, true);
      orderRow.status = 'canceled';
      orderRow.inventoryStatus = 'released';
      orderRow.paymentStatus = 'refunded';
      // Snapshot antes de liberar o crédito, que zera storeCreditAmount.
      const canceledRecord = this.orders.toRecord(orderRow);
      const storeCredit = Number(orderRow.storeCreditAmount) || 0;
      await this.orders.releaseStoreCredit(orderRow);
      await this.email.sendOrderCanceled(canceledRecord, {
        amount: 0,
        storeCredit,
        pending: false,
      });
      return {
        order: this.orders.toRecord(orderRow),
        cancellation: { status: 'STORE_CREDIT_RESTORED' },
      };
    }
    if (options.refundedExternally) {
      return this.cancelWithManualRefund(orderRow);
    }
    if (orderRow.gateway !== 'asaas' || !orderRow.asaasPaymentId) {
      throw new BadRequestException(
        'Pedido sem identificador de cobrança do Asaas.',
      );
    }
    this.assertConfigured();

    const paymentId = orderRow.asaasPaymentId;
    const url = `/payments/${encodeURIComponent(paymentId)}/refund`;
    this.logger.log(
      JSON.stringify({
        event: 'asaas.refund.request',
        environment: this.config.asaasEnv,
        method: 'POST',
        paymentId,
      }),
    );
    const response = await this.asaasRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        description: `Cancelamento do pedido ${orderRow.number}`,
      }),
    });
    const data = await this.readJson(response);
    const cancellation = {
      responseStatus: response.status,
      paymentId: String(data?.id || paymentId),
      status: String(data?.status || 'REFUND_REQUESTED').toUpperCase(),
      value: data?.value ?? Number(orderRow.total),
    };
    this.logger.log(
      JSON.stringify({
        event: 'asaas.refund.response',
        environment: this.config.asaasEnv,
        ...cancellation,
      }),
    );
    if (!response.ok) {
      throw new ServiceUnavailableException(
        this.asaasError(data, 'Não foi possível estornar a cobrança no Asaas.'),
      );
    }

    await this.inventory.restockCanceledOrder(
      orderRow.id,
      cancellation.status === 'REFUNDED',
    );
    orderRow.status = 'canceled';
    orderRow.inventoryStatus = 'released';
    orderRow.paymentStatus =
      cancellation.status === 'REFUNDED' ? 'refunded' : 'refund_pending';
    // Snapshot antes de liberar o crédito, que zera storeCreditAmount.
    const canceledRecord = this.orders.toRecord(orderRow);
    const storeCredit = Number(orderRow.storeCreditAmount) || 0;
    await this.orders.releaseStoreCredit(orderRow);
    await this.email.sendOrderCanceled(canceledRecord, {
      amount: Number(cancellation.value) || Number(orderRow.total),
      storeCredit,
      pending: orderRow.paymentStatus === 'refund_pending',
    });
    return { order: this.orders.toRecord(orderRow), cancellation };
  }

  /**
   * Cancelamento com estorno manual, feito pelo gerente fora do sistema (que
   * pode demorar). Não consulta o Asaas: o pedido sai do faturamento na hora
   * e fica como refund_pending até o webhook PAYMENT_REFUNDED concluí-lo.
   */
  private async cancelWithManualRefund(
    orderRow: import('../orders/entities/order.entity').OrderEntity,
  ) {
    this.logger.log(
      JSON.stringify({
        event: 'order.cancel.manual_refund',
        orderId: orderRow.id,
        paymentId: orderRow.asaasPaymentId,
      }),
    );
    await this.inventory.restockCanceledOrder(orderRow.id, false);
    orderRow.status = 'canceled';
    orderRow.inventoryStatus = 'released';
    orderRow.paymentStatus = 'refund_pending';
    const canceledRecord = this.orders.toRecord(orderRow);
    const storeCredit = Number(orderRow.storeCreditAmount) || 0;
    await this.orders.releaseStoreCredit(orderRow);
    await this.email.sendOrderCanceled(canceledRecord, {
      amount: Number(orderRow.total),
      storeCredit,
      pending: true,
    });
    return {
      order: this.orders.toRecord(orderRow),
      cancellation: { status: 'MANUAL_REFUND', refundedExternally: true },
    };
  }

  async refundOrderAmount(
    orderId: string,
    amount: number,
    description: string,
  ) {
    const order = await this.orders.findEntity(orderId);
    if (!order) throw new BadRequestException('Pedido inexistente.');
    if (order.gateway !== 'asaas' || !order.asaasPaymentId) {
      throw new BadRequestException('Pedido sem pagamento Asaas para estorno.');
    }
    this.assertConfigured();
    const value =
      Math.round(Math.min(Number(order.total), Number(amount)) * 100) / 100;
    if (value <= 0) throw new BadRequestException('Valor de estorno inválido.');
    const response = await this.asaasRequest(
      `/payments/${encodeURIComponent(order.asaasPaymentId)}/refund`,
      {
        method: 'POST',
        body: JSON.stringify({ value, description: description.slice(0, 500) }),
      },
    );
    const data = await this.readJson(response);
    if (!response.ok) {
      throw new ServiceUnavailableException(
        this.asaasError(data, 'Não foi possível solicitar o estorno no Asaas.'),
      );
    }
    return {
      paymentId: order.asaasPaymentId,
      value,
      status: data?.status || 'REFUND_REQUESTED',
    };
  }

  async checkout(
    user: AuthenticatedUser | undefined,
    dto: CreateCheckoutDto,
    remoteIp: string,
  ) {
    this.assertConfigured();
    const items = Array.isArray(dto?.items) ? dto.items : [];
    if (!items.length) throw new BadRequestException('Carrinho vazio.');
    const method = this.normalizeMethod(dto.method);
    if (method !== 'Pix' && !dto.card) {
      throw new BadRequestException('Os dados do cartão são obrigatórios.');
    }
    if (dto.existingOrderId) {
      if (method === 'Pix') {
        throw new BadRequestException('Este Pix já foi gerado.');
      }
      return this.payExistingOrderWithCard(user, dto, remoteIp);
    }

    const customer = await this.resolveCustomer(user, dto.customer);
    if (!dto.shippingQuoteToken) {
      throw new BadRequestException('Selecione uma opção de entrega.');
    }
    const shipping = this.melhorEnvio.verifyQuoteToken(
      dto.shippingQuoteToken,
      customer.delivery.cep,
    );
    const order = await this.orders.createPending(
      customer.uid,
      {
        items,
        method,
        coupon: dto.coupon,
        expectedFreeShipping: dto.expectedFreeShipping,
      },
      customer.delivery,
      shipping,
      Boolean(user),
    );
    let paymentCreated = false;

    try {
      if (order.total === 0) {
        const savedOrder = await this.orders.findEntity(order.id);
        if (!savedOrder) {
          throw new ServiceUnavailableException('Pedido não foi persistido.');
        }
        savedOrder.gateway = 'store_credit';
        // Persistir antes: commitOrder recarrega o pedido do banco e só
        // grava status/estoque, então o gateway se perderia.
        await this.orders.saveEntity(savedOrder);
        await this.markOrderPaid(savedOrder, null);
        return {
          orderId: order.id,
          number: order.number,
          total: 0,
          paymentStatus: 'RECEIVED',
          message: 'Pedido pago integralmente com Crédito Wear Bubble.',
        };
      }
      const asaasCustomerId = await this.findOrCreateAsaasCustomer(
        customer.uid,
        customer.delivery,
      );
      const payload = this.paymentPayload(
        asaasCustomerId,
        customer.delivery,
        order,
        method,
        dto,
        remoteIp,
      );
      const response = await this.asaasRequest('/payments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const payment = (await this.readJson(response)) as AsaasPayment &
        Record<string, any>;
      if (method !== 'Pix') {
        await this.fraud.recordCardAttempt({
          customerUid: customer.uid,
          email: customer.delivery.email,
          taxId: customer.delivery.taxId,
          card: dto.card,
          approved: response.ok && !this.isCanceled(payment.status),
          ip: remoteIp,
        });
      }
      if (!response.ok) {
        throw new ServiceUnavailableException(
          this.asaasError(
            payment,
            'Não foi possível processar o pagamento no Asaas.',
          ),
        );
      }
      if (!payment.id) {
        throw new ServiceUnavailableException(
          'Asaas não retornou o identificador da cobrança.',
        );
      }
      paymentCreated = true;

      const savedOrder = await this.orders.findEntity(order.id);
      if (savedOrder) {
        savedOrder.gateway = 'asaas';
        savedOrder.asaasCustomerId = asaasCustomerId;
        savedOrder.asaasPaymentId = payment.id;
        if (this.isPaid(payment.status, payment.billingType)) {
          // Persistir antes: commitOrder recarrega o pedido do banco e
          // perderia gateway/asaasCustomerId, impedindo o estorno depois.
          await this.orders.saveEntity(savedOrder);
          await this.markOrderPaid(savedOrder, payment.id);
        } else if (this.isCanceled(payment.status)) {
          await this.orders.saveEntity(savedOrder);
          await this.inventory.cancelPendingOrder(savedOrder.id);
          await this.orders.releaseStoreCredit(savedOrder);
        } else {
          await this.orders.saveEntity(savedOrder);
        }
      }

      if (method === 'Pix') {
        const qrResponse = await this.asaasRequest(
          `/payments/${encodeURIComponent(payment.id)}/pixQrCode`,
        );
        const qrCode = await this.readJson(qrResponse);
        if (!qrResponse.ok || !qrCode?.payload) {
          throw new ServiceUnavailableException(
            this.asaasError(qrCode, 'Asaas não retornou o código Pix.'),
          );
        }
        await this.sendOrderCreated(order, user, remoteIp);
        return {
          orderId: order.id,
          number: order.number,
          total: order.total,
          paymentStatus: String(payment.status || 'PENDING').toUpperCase(),
          pix: {
            text: String(qrCode.payload),
            image: qrCode.encodedImage
              ? `data:image/png;base64,${qrCode.encodedImage}`
              : null,
            expiresAt: qrCode.expirationDate || null,
          },
        };
      }

      if (
        !this.isPaid(payment.status, payment.billingType) &&
        !this.isCanceled(payment.status)
      ) {
        await this.sendOrderCreated(order, user, remoteIp);
      }
      return {
        orderId: order.id,
        number: order.number,
        total: order.total,
        paymentStatus: String(payment.status || 'PENDING').toUpperCase(),
        message: this.isPaid(payment.status, payment.billingType)
          ? 'Pagamento confirmado.'
          : 'Pagamento em processamento.',
        asaasPaymentId: payment.id,
      };
    } catch (error) {
      if (!paymentCreated) await this.orders.rollbackPending(order);
      throw error;
    }
  }

  private async payExistingOrderWithCard(
    user: AuthenticatedUser | undefined,
    dto: CreateCheckoutDto,
    remoteIp: string,
  ) {
    // Serialize concurrent attempts (double-click, client retry) to switch
    // the same pending order to card — without this, two near-simultaneous
    // calls can both pass the "still pending" check, both delete the old
    // Pix charge and create a new Asaas payment, and only the last DB write
    // links an order to its charge, leaving the other orphaned.
    return this.locks.withLock(`order:${dto.existingOrderId}`, () =>
      this.payExistingOrderWithCardLocked(user, dto, remoteIp),
    );
  }

  private async payExistingOrderWithCardLocked(
    user: AuthenticatedUser | undefined,
    dto: CreateCheckoutDto,
    remoteIp: string,
  ) {
    const orderRow = await this.orders.findEntity(dto.existingOrderId!);
    if (!orderRow || !orderRow.asaasCustomerId || !orderRow.asaasPaymentId) {
      throw new BadRequestException('Pedido pendente não encontrado.');
    }
    if (orderRow.status !== 'pending') {
      throw new BadRequestException('Este pedido não está mais pendente.');
    }
    const claimedEmail = String(dto.customer?.email || '')
      .trim()
      .toLowerCase();
    const owns = user
      ? user.uid === orderRow.customerUid
      : Boolean(claimedEmail) &&
        claimedEmail === (orderRow.customerEmail || '').toLowerCase();
    if (!owns) {
      throw new BadRequestException('Pedido pendente não encontrado.');
    }
    const order = this.orders.toRecord(orderRow);
    if (!order.delivery) {
      throw new BadRequestException('Dados do comprador não encontrados.');
    }
    const shippingPrice = Number(order.shipping?.price || 0);
    const creditAmount = Number(order.storeCreditAmount || 0);
    const pixProductTotal = Math.max(
      0,
      order.total + creditAmount - shippingPrice,
    );
    const cardTotal =
      order.method === 'Pix'
        ? Math.max(
            0,
            Math.round(
              (pixProductTotal / (1 - this.config.pixDiscount) +
                shippingPrice -
                creditAmount) *
                100,
            ) / 100,
          )
        : order.total;
    const cardOrder = { ...order, total: cardTotal };

    const deleteResponse = await this.asaasRequest(
      `/payments/${encodeURIComponent(orderRow.asaasPaymentId)}`,
      { method: 'DELETE' },
    );
    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      const error = await this.readJson(deleteResponse);
      throw new ServiceUnavailableException(
        this.asaasError(error, 'Não foi possível substituir a cobrança Pix.'),
      );
    }

    const response = await this.asaasRequest('/payments', {
      method: 'POST',
      body: JSON.stringify(
        this.paymentPayload(
          orderRow.asaasCustomerId,
          order.delivery,
          cardOrder,
          'Cartão de crédito',
          dto,
          remoteIp,
        ),
      ),
    });
    const payment = (await this.readJson(response)) as AsaasPayment &
      Record<string, any>;
    await this.fraud.recordCardAttempt({
      customerUid: orderRow.customerUid,
      email: order.delivery.email,
      taxId: order.delivery.taxId,
      card: dto.card,
      approved: response.ok && !this.isCanceled(payment.status),
      ip: remoteIp,
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        this.asaasError(
          payment,
          'Não foi possível trocar o pagamento para cartão.',
        ),
      );
    }
    if (!payment.id) {
      throw new ServiceUnavailableException(
        'Asaas não retornou o identificador da cobrança.',
      );
    }

    orderRow.asaasPaymentId = payment.id;
    orderRow.method = 'Cartão de crédito';
    orderRow.total = cardTotal;
    if (this.isPaid(payment.status, payment.billingType)) {
      await this.markOrderPaid(orderRow, payment.id);
    } else {
      await this.orders.saveEntity(orderRow);
    }
    return {
      orderId: order.id,
      number: order.number,
      total: cardTotal,
      paymentStatus: String(payment.status || 'PENDING').toUpperCase(),
      message: this.isPaid(payment.status, payment.billingType)
        ? 'Pagamento confirmado.'
        : 'Pagamento em processamento.',
      asaasPaymentId: payment.id,
    };
  }

  async asaasWebhook(dto: PaymentWebhookDto, token?: string) {
    this.assertAsaasWebhookToken(token);
    const orderId = dto.payment?.externalReference;
    if (!orderId) throw new BadRequestException('externalReference ausente.');
    const orderRow = await this.orders.findEntity(orderId);
    if (!orderRow) throw new BadRequestException('Pedido inexistente.');
    if (
      dto.payment?.id &&
      orderRow.asaasPaymentId &&
      dto.payment.id !== orderRow.asaasPaymentId
    ) {
      return { ok: true };
    }

    const event = String(dto.event || '').toUpperCase();
    const status = String(dto.payment?.status || '').toUpperCase();
    const paymentId = dto.payment?.id || null;
    if (
      ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event) ||
      this.isPaid(status, dto.payment?.billingType)
    ) {
      if (
        event === 'PAYMENT_CONFIRMED' &&
        String(dto.payment?.billingType || '').toUpperCase() === 'PIX'
      ) {
        return { ok: true };
      }
      await this.markOrderPaid(orderRow, paymentId);
      return { ok: true };
    }
    if (
      (event === 'PAYMENT_REFUNDED' || status === 'REFUNDED') &&
      orderRow.status === 'canceled' &&
      orderRow.paymentStatus === 'refund_pending'
    ) {
      // Conclui um estorno que o Asaas aceitou como pendente no cancelamento.
      // Um pedido ainda pago não é cancelado aqui: isso é decisão do gerente.
      await this.inventory.markRefunded(orderRow.id);
      return { ok: true };
    }
    if (
      (event === 'PAYMENT_DELETED' || status === 'DELETED') &&
      ['pending', 'expired'].includes(orderRow.status)
    ) {
      // Only a never-committed order can be safely canceled here. A
      // `paid`/`stock_conflict` order already has its own
      // cancel/refund flow (cancelOrder / refundStockConflict) — running
      // it through cancelPendingOrder as well would overwrite
      // paymentStatus (e.g. 'refund_pending' → 'failed') and strand it
      // outside the automatic refund process.
      orderRow.asaasPaymentId = paymentId || orderRow.asaasPaymentId;
      await this.orders.saveEntity(orderRow);
      await this.inventory.cancelPendingOrder(orderRow.id);
      await this.orders.releaseStoreCredit(orderRow);
    }
    return { ok: true };
  }

  private paymentPayload(
    asaasCustomerId: string,
    customer: OrderDelivery,
    order: OrderRecord,
    method: string,
    dto: CreateCheckoutDto,
    remoteIp: string,
  ) {
    const payload: Record<string, unknown> = {
      customer: asaasCustomerId,
      billingType: method === 'Pix' ? 'PIX' : 'CREDIT_CARD',
      value: order.total,
      dueDate: new Date().toISOString().slice(0, 10),
      description: `Pedido ${order.number} - Wear Bubble`.slice(0, 500),
      externalReference: order.id,
    };
    if (method !== 'Pix') {
      const installments = Math.max(
        1,
        Math.min(
          Number(this.config.asaasInstallments),
          Number(dto.installments) || 1,
        ),
      );
      payload.creditCard = dto.card;
      payload.creditCardHolderInfo = {
        name: customer.name,
        email: customer.email,
        cpfCnpj: customer.taxId.replace(/\D/g, ''),
        postalCode: customer.cep.replace(/\D/g, ''),
        addressNumber: customer.number,
        addressComplement: customer.reference || null,
        mobilePhone: customer.phone.replace(/\D/g, '') || undefined,
      };
      payload.remoteIp = this.normalizeRemoteIp(remoteIp);
      if (installments > 1) {
        payload.installmentCount = installments;
        payload.installmentValue =
          Math.round((order.total / installments) * 100) / 100;
      }
    }
    return payload;
  }

  private async findOrCreateAsaasCustomer(
    uid: string,
    customer: OrderDelivery,
  ) {
    const cpfCnpj = customer.taxId.replace(/\D/g, '');
    const search = await this.asaasRequest(
      `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`,
    );
    const searchData = await this.readJson(search);
    if (!search.ok) {
      throw new ServiceUnavailableException(
        this.asaasError(
          searchData,
          'Não foi possível consultar o cliente no Asaas.',
        ),
      );
    }
    const existing = Array.isArray(searchData?.data)
      ? searchData.data[0]
      : null;
    if (existing?.id) return String(existing.id);

    const response = await this.asaasRequest('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: customer.name,
        cpfCnpj,
        email: customer.email,
        mobilePhone: customer.phone.replace(/\D/g, '') || undefined,
        address: customer.street,
        addressNumber: customer.number,
        complement: customer.reference || undefined,
        province: customer.neighborhood || undefined,
        postalCode: customer.cep.replace(/\D/g, ''),
        externalReference: uid,
        notificationDisabled: true,
      }),
    });
    const data = await this.readJson(response);
    if (!response.ok || !data?.id) {
      throw new ServiceUnavailableException(
        this.asaasError(data, 'Não foi possível criar o cliente no Asaas.'),
      );
    }
    return String(data.id);
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

    if (!input) {
      throw new BadRequestException(
        'Informe o e-mail e o endereço para continuar sem conta.',
      );
    }
    const delivery = this.normalizeDelivery(input);
    await this.emailPolicy.assertAcceptable(delivery.email);
    let user = await this.users.findByEmail(delivery.email);
    if (user && user.emailVerified) {
      throw new BadRequestException(
        'Este e-mail já tem uma conta na Wear Bubble. Faça login para continuar a compra.',
      );
    }
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
        'Preencha os dados obrigatórios de entrega.',
      );
    }
    if (!this.isValidCpf(delivery.taxId)) {
      throw new BadRequestException('Informe um CPF válido.');
    }
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

  /**
   * "Pedido recebido". Para compras sem conta o envio passa pelo limite por
   * destinatário/IP, sem nunca barrar a compra em si.
   */
  private async sendOrderCreated(
    order: OrderRecord,
    user: AuthenticatedUser | undefined,
    remoteIp: string,
  ) {
    const email = order.delivery?.email;
    if (!email) return;
    if (
      !user &&
      !(await this.emailGuard.allow(email, remoteIp, 'order-created'))
    ) {
      return;
    }
    await this.email.sendOrderCreated(order);
  }

  private async markOrderPaid(
    orderRow: import('../orders/entities/order.entity').OrderEntity,
    paymentId: string | null,
  ) {
    if (
      orderRow.status === 'paid' &&
      orderRow.inventoryStatus === 'committed'
    ) {
      return true;
    }
    const result = await this.inventory.commitOrder(orderRow.id, paymentId);
    if (!result.committed) {
      await this.refundStockConflict(result.order);
      return false;
    }
    // Marca o pedido para revisão antes de o painel e o e-mail o exibirem.
    await this.fraud.evaluatePaidOrder(result.order);
    const record = this.orders.toRecord(result.order);
    await this.email.sendPaymentConfirmed(record);
    return true;
  }

  private async refundStockConflict(
    order: import('../orders/entities/order.entity').OrderEntity,
  ) {
    if (order.paymentStatus === 'refunded') return;
    if (!(await this.inventory.claimStockConflictRefund(order.id))) return;
    // Capturado antes de liberar o crédito, que zera storeCreditAmount.
    const storeCredit = Number(order.storeCreditAmount) || 0;
    if (order.storeCreditCode && order.storeCreditAmount > 0) {
      await this.orders.releaseStoreCredit(order);
    }
    if (order.gateway === 'store_credit') {
      await this.inventory.markRefunded(order.id);
      await this.notifyStockConflictRefund(order.id, 0, storeCredit);
      return;
    }
    if (order.gateway !== 'asaas' || !order.asaasPaymentId) {
      await this.inventory.releaseStockConflictRefundClaim(order.id);
      return;
    }
    try {
      const response = await this.asaasRequest(
        `/payments/${encodeURIComponent(order.asaasPaymentId)}/refund`,
        {
          method: 'POST',
          body: JSON.stringify({
            description: `Estorno automático por conflito de estoque no pedido ${order.number}`,
          }),
        },
      );
      const data = await this.readJson(response);
      if (!response.ok) {
        this.logger.error(
          `Falha no estorno automático do pedido ${order.number}: ${this.asaasError(data, 'erro desconhecido')}`,
        );
        await this.inventory.releaseStockConflictRefundClaim(order.id);
        return;
      }
      await this.inventory.markRefunded(order.id);
      await this.notifyStockConflictRefund(
        order.id,
        Number(data?.value) || Number(order.total),
        storeCredit,
      );
    } catch (error) {
      this.logger.error(
        `Falha no estorno automático do pedido ${order.number}.`,
        error,
      );
      await this.inventory.releaseStockConflictRefundClaim(order.id);
    }
  }

  private async notifyStockConflictRefund(
    orderId: string,
    amount: number,
    storeCredit: number,
  ) {
    // Falhas aqui não podem cair no catch do estorno, que liberaria a
    // reivindicação e permitiria um segundo estorno.
    try {
      const row = await this.orders.findEntity(orderId);
      if (!row) return;
      await this.email.sendStockConflictRefund(
        { ...this.orders.toRecord(row), storeCreditAmount: storeCredit },
        { amount, storeCredit, pending: false },
      );
    } catch (error) {
      this.logger.error(
        `Falha ao avisar o cliente do estorno do pedido ${orderId}.`,
        error,
      );
    }
  }

  private asaasRequest(path: string, init: RequestInit = {}) {
    return fetch(`${this.config.asaasBaseUrl}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': this.config.asaasUserAgent,
        access_token: this.config.asaasApiKey,
        ...(init.headers || {}),
      },
    });
  }

  private async readJson(response: Response): Promise<Record<string, any>> {
    return (await response.json().catch(() => ({}))) as Record<string, any>;
  }

  private assertConfigured() {
    if (!this.config.asaasApiKey) {
      throw new ServiceUnavailableException(
        'ASAAS_API_KEY não configurada no backend.',
      );
    }
  }

  private assertAsaasWebhookToken(received?: string) {
    const configured = this.config.asaasWebhookToken;
    if (!configured) {
      throw new ServiceUnavailableException(
        'ASAAS_WEBHOOK_TOKEN não configurado no backend.',
      );
    }
    if (!received) throw new UnauthorizedException('Token Asaas ausente.');
    const expectedBuffer = Buffer.from(configured);
    const receivedBuffer = Buffer.from(received);
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new UnauthorizedException('Token Asaas inválido.');
    }
  }

  private asaasError(data: Record<string, any>, fallback: string) {
    const errors = Array.isArray(data?.errors) ? data.errors : [];
    const first = errors[0] || {};
    return String(
      first.description || first.message || data?.message || fallback,
    );
  }

  private isPaid(status?: string, billingType?: string) {
    const normalized = String(status || '').toUpperCase();
    if (['RECEIVED', 'RECEIVED_IN_CASH'].includes(normalized)) return true;
    return (
      normalized === 'CONFIRMED' &&
      String(billingType || '').toUpperCase() !== 'PIX'
    );
  }

  private isCanceled(status?: string) {
    return [
      'REFUNDED',
      'REFUND_REQUESTED',
      'DELETED',
      'DECLINED',
      'CANCELED',
      'CANCELLED',
    ].includes(String(status || '').toUpperCase());
  }

  private normalizeMethod(method?: CreateCheckoutDto['method']) {
    return String(method || '')
      .toLowerCase()
      .includes('pix')
      ? 'Pix'
      : 'Cartão de crédito';
  }

  private normalizeRemoteIp(value: string) {
    return (
      value
        .replace(/^::ffff:/, '')
        .split(',')[0]
        .trim() || '127.0.0.1'
    );
  }
}
