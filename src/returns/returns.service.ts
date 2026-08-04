import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { EmailService } from '../email/email.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { ProductsService } from '../products/products.service';
import { CreditsService } from '../credits/credits.service';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import {
  ResolveReturnRequestDto,
  UpdateReturnRequestDto,
} from './dto/update-return-request.dto';
import { ReturnEventEntity } from './entities/return-event.entity';
import { ReturnItemEntity } from './entities/return-item.entity';
import {
  ReturnRequestEntity,
  ReturnStatus,
} from './entities/return-request.entity';
import { StoreCreditEntity } from './entities/store-credit.entity';

const statusLabels: Record<ReturnStatus, string> = {
  requested: 'Solicitação recebida',
  approved: 'Solicitação aprovada',
  awaiting_posting: 'Código de postagem disponível',
  returning: 'Produto em retorno',
  received: 'Produto recebido',
  inspecting: 'Produto em inspeção',
  completed: 'Processo concluído',
  rejected: 'Solicitação não aprovada',
  canceled: 'Solicitação cancelada',
};

@Injectable()
export class ReturnsService {
  constructor(
    @InjectRepository(ReturnRequestEntity)
    private readonly requests: Repository<ReturnRequestEntity>,
    @InjectRepository(ReturnItemEntity)
    private readonly returnItems: Repository<ReturnItemEntity>,
    @InjectRepository(ReturnEventEntity)
    private readonly events: Repository<ReturnEventEntity>,
    @InjectRepository(StoreCreditEntity)
    private readonly credits: Repository<StoreCreditEntity>,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly products: ProductsService,
    private readonly creditBalances: CreditsService,
    private readonly email: EmailService,
  ) {}

  async create(customerUid: string, dto: CreateReturnRequestDto) {
    const order = await this.orders.findEntity(dto.orderId);
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    if (order.customerUid !== customerUid) {
      throw new ForbiddenException('Este pedido não pertence à sua conta.');
    }
    if (order.status !== 'paid' || order.shipStage !== 5) {
      throw new BadRequestException(
        'A solicitação fica disponível depois que o pedido é entregue.',
      );
    }
    const deliveredAt = order.deliveredAt || order.updatedAt;
    const elapsedDays = Math.floor(
      (Date.now() - deliveredAt.getTime()) / 86_400_000,
    );
    if (dto.kind === 'return' && elapsedDays > 7) {
      throw new BadRequestException(
        'O prazo de 7 dias para devolução por arrependimento terminou.',
      );
    }
    if (dto.kind === 'exchange' && elapsedDays > 30) {
      throw new BadRequestException('O prazo de 30 dias para troca terminou.');
    }

    const requestedIds = new Set(dto.items.map((item) => item.orderItemId));
    if (requestedIds.size !== dto.items.length) {
      throw new BadRequestException('Não repita uma peça na solicitação.');
    }
    const existing = await this.requests.find({ where: { orderId: order.id } });
    const unavailable = new Map<number, number>();
    for (const request of existing) {
      if (['rejected', 'canceled'].includes(request.status)) continue;
      for (const item of request.items || []) {
        unavailable.set(
          item.orderItemId,
          (unavailable.get(item.orderItemId) || 0) + item.quantity,
        );
      }
    }

    const grossItems = order.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const netItems = Math.max(
      0,
      order.total +
        Number(order.storeCreditAmount || 0) -
        Number(order.shippingPrice || 0),
    );
    const discountFactor =
      grossItems > 0 ? Math.min(1, netItems / grossItems) : 1;
    const selected: ReturnItemEntity[] = [];
    for (const input of dto.items) {
      const item = order.items.find((line) => line.id === input.orderItemId);
      if (!item) {
        throw new BadRequestException('Uma das peças não pertence ao pedido.');
      }
      const available = item.quantity - (unavailable.get(item.id) || 0);
      if (input.quantity > available) {
        throw new BadRequestException(
          `Quantidade indisponível para devolução de ${item.productName}.`,
        );
      }
      selected.push(
        this.returnItems.create({
          orderItemId: item.id,
          quantity: input.quantity,
          unitRefundValue:
            Math.round(item.unitPrice * discountFactor * 100) / 100,
          condition: 'pending',
        }),
      );
    }

    const autoApproved = dto.kind === 'return' && elapsedDays <= 7;
    const request = this.requests.create({
      protocol: this.protocol(),
      orderId: order.id,
      customerUid,
      kind: dto.kind,
      reason: dto.reason,
      details: String(dto.details || '').trim(),
      status: autoApproved ? 'approved' : 'requested',
      publicNote: autoApproved
        ? 'Sua devolução foi aprovada. O código de postagem será disponibilizado em breve.'
        : '',
      postingCode: null,
      returnTracking: null,
      postingExpiresAt: null,
      resolution: null,
      resolutionAmount: 0,
      creditCode: null,
      approvedAt: autoApproved ? new Date() : null,
      postedAt: null,
      receivedAt: null,
      resolvedAt: null,
      items: selected,
      events: [
        this.event(
          'requested',
          'Solicitação recebida',
          'Recebemos sua solicitação e registramos os itens selecionados.',
          'customer',
        ),
        ...(autoApproved
          ? [
              this.event(
                'approved',
                'Devolução aprovada',
                'O pedido está dentro do prazo de arrependimento.',
                'system',
              ),
            ]
          : []),
      ],
    });
    const saved = await this.requests.save(request);
    await this.notify(saved);
    return this.toRecord(saved, true);
  }

  async listMine(customerUid: string) {
    const rows = await this.requests.find({
      where: { customerUid },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => this.toRecord(row, true));
  }

  async listAll() {
    const rows = await this.requests.find({ order: { createdAt: 'DESC' } });
    return rows.map((row) => this.toRecord(row, false));
  }

  async listCredits(customerUid: string) {
    const rows = await this.credits.find({
      where: { customerUid },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => this.creditRecord(row));
  }

  async update(id: string, dto: UpdateReturnRequestDto) {
    const row = await this.get(id);
    if (['completed', 'rejected', 'canceled'].includes(row.status)) {
      throw new BadRequestException('Esta solicitação já foi encerrada.');
    }
    if (dto.itemId && dto.condition) {
      const item = row.items.find((entry) => entry.id === dto.itemId);
      if (!item) throw new BadRequestException('Item da devolução inválido.');
      item.condition = dto.condition;
      await this.returnItems.save(item);
    }
    if (dto.publicNote !== undefined) row.publicNote = dto.publicNote.trim();
    if (dto.postingCode !== undefined)
      row.postingCode = dto.postingCode.trim() || null;
    if (dto.returnTracking !== undefined)
      row.returnTracking = dto.returnTracking.trim() || null;
    if (dto.postingExpiresAt !== undefined) {
      row.postingExpiresAt = dto.postingExpiresAt
        ? new Date(dto.postingExpiresAt)
        : null;
    }
    if (dto.status) {
      row.status = dto.status as ReturnStatus;
      const now = new Date();
      if (row.status === 'approved') row.approvedAt ||= now;
      if (row.status === 'awaiting_posting') {
        row.approvedAt ||= now;
        if (!row.postingCode) {
          throw new BadRequestException('Informe o código de postagem.');
        }
      }
      if (row.status === 'returning') row.postedAt ||= now;
      if (row.status === 'received') row.receivedAt ||= now;
      await this.addEvent(
        row,
        row.status,
        statusLabels[row.status],
        row.publicNote,
        'manager',
      );
    }
    const saved = await this.requests.save(row);
    await this.notify(saved);
    return this.toRecord(saved, false);
  }

  async cancel(customerUid: string, id: string) {
    const row = await this.get(id);
    if (row.customerUid !== customerUid) throw new ForbiddenException();
    if (!['requested', 'approved'].includes(row.status)) {
      throw new BadRequestException(
        'Esta solicitação não pode mais ser cancelada.',
      );
    }
    row.status = 'canceled';
    await this.addEvent(
      row,
      'canceled',
      statusLabels.canceled,
      'Cancelada pelo cliente.',
      'customer',
    );
    await this.requests.save(row);
    return this.toRecord(row, true);
  }

  async resolve(id: string, dto: ResolveReturnRequestDto) {
    const row = await this.get(id);
    if (!['received', 'inspecting'].includes(row.status)) {
      throw new BadRequestException(
        'Registre o recebimento antes de concluir o processo.',
      );
    }
    if (row.items.some((item) => item.condition === 'pending')) {
      throw new BadRequestException(
        'Conclua a inspeção de todas as peças antes da resolução.',
      );
    }
    if (row.kind === 'exchange' && dto.resolution !== 'credit') {
      throw new BadRequestException(
        'Trocas são concluídas com Crédito Wear Bubble.',
      );
    }
    const order = await this.orders.findEntity(row.orderId);
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    const calculated = this.calculatedAmount(row, order);
    const amount =
      Math.round(Math.min(calculated, Number(dto.amount) || calculated) * 100) /
      100;
    if (amount <= 0)
      throw new BadRequestException('Valor de resolução inválido.');

    if (dto.resolution === 'refund') {
      const originalValue =
        Number(order.total) + Number(order.storeCreditAmount || 0);
      const creditAmount = order.storeCreditCode
        ? Math.min(
            Number(order.storeCreditAmount || 0),
            Math.round(
              ((amount * Number(order.storeCreditAmount || 0)) /
                Math.max(originalValue, 0.01)) *
                100,
            ) / 100,
          )
        : 0;
      const cashAmount = Math.max(
        0,
        Math.round((amount - creditAmount) * 100) / 100,
      );
      if (cashAmount > 0) {
        await this.payments.refundOrderAmount(
          row.orderId,
          cashAmount,
          `Devolução ${row.protocol}`,
        );
      }
      if (creditAmount > 0 && order.storeCreditCode) {
        await this.creditBalances.release(order.storeCreditCode, creditAmount);
      }
    } else {
      const code = this.creditCode();
      const credit = this.credits.create({
        code,
        customerUid: row.customerUid,
        returnRequestId: row.id,
        initialAmount: amount,
        balance: amount,
        status: 'active',
        expiresAt: new Date(Date.now() + 180 * 86_400_000),
      });
      await this.credits.save(credit);
      row.creditCode = code;
    }

    for (const returned of row.items) {
      if (returned.condition !== 'resellable') continue;
      const original = order.items.find(
        (item) => item.id === returned.orderItemId,
      );
      if (!original?.productId) continue;
      const product = await this.products.findEntity(original.productId);
      if (!product) continue;
      product.stock += returned.quantity;
      await this.products.saveEntity(product);
    }
    row.status = 'completed';
    row.resolution = dto.resolution;
    row.resolutionAmount = amount;
    row.publicNote = dto.publicNote?.trim() || row.publicNote;
    row.resolvedAt = new Date();
    await this.addEvent(
      row,
      'completed',
      dto.resolution === 'credit'
        ? 'Crédito Wear Bubble disponível'
        : 'Estorno solicitado ao Asaas',
      dto.resolution === 'credit'
        ? `Crédito ${row.creditCode} gerado no valor aprovado.`
        : 'O valor foi devolvido aos meios de pagamento usados na compra.',
      'manager',
    );
    const saved = await this.requests.save(row);
    await this.notify(saved);
    return this.toRecord(saved, false);
  }

  private calculatedAmount(
    row: ReturnRequestEntity,
    order: import('../orders/entities/order.entity').OrderEntity,
  ) {
    let amount = row.items.reduce(
      (sum, item) => sum + item.unitRefundValue * item.quantity,
      0,
    );
    const returned = new Map(
      row.items.map((item) => [item.orderItemId, item.quantity]),
    );
    const fullOrder = order.items.every(
      (item) => (returned.get(item.id) || 0) === item.quantity,
    );
    if (row.kind === 'return' && fullOrder)
      amount += Number(order.shippingPrice || 0);
    return Math.round(amount * 100) / 100;
  }

  private async get(id: string) {
    const row = await this.requests.findOneBy({ id });
    if (!row) throw new NotFoundException('Solicitação não encontrada.');
    return row;
  }

  private async addEvent(
    row: ReturnRequestEntity,
    status: string,
    label: string,
    message: string,
    actor: 'customer' | 'manager' | 'system',
  ) {
    const saved = await this.events.save(
      this.events.create({
        requestId: row.id,
        status,
        label,
        message,
        actorType: actor,
        visibleToCustomer: true,
        occurredAt: new Date(),
      }),
    );
    row.events = [...(row.events || []), saved];
  }

  private event(
    status: string,
    label: string,
    message: string,
    actorType: 'customer' | 'manager' | 'system',
  ) {
    return this.events.create({
      status,
      label,
      message,
      actorType,
      visibleToCustomer: true,
      occurredAt: new Date(),
    });
  }

  private async notify(row: ReturnRequestEntity) {
    const order = await this.orders.findEntity(row.orderId);
    if (!order?.customerEmail) return;
    await this.email.sendReturnUpdate(
      order.customerEmail,
      order.customerName,
      row.protocol,
      statusLabels[row.status],
      row.publicNote,
    );
  }

  private toRecord(row: ReturnRequestEntity, customerView: boolean) {
    const events = [...(row.events || [])]
      .filter((event) => !customerView || event.visibleToCustomer)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    return {
      id: row.id,
      protocol: row.protocol,
      orderId: row.orderId,
      customerUid: row.customerUid,
      kind: row.kind,
      reason: row.reason,
      details: row.details,
      status: row.status,
      publicNote: row.publicNote,
      postingCode: row.postingCode,
      returnTracking: row.returnTracking,
      postingExpiresAt: row.postingExpiresAt?.getTime() || null,
      resolution: row.resolution,
      resolutionAmount: row.resolutionAmount,
      creditCode: row.creditCode,
      requestedAt: row.createdAt.getTime(),
      approvedAt: row.approvedAt?.getTime() || null,
      postedAt: row.postedAt?.getTime() || null,
      receivedAt: row.receivedAt?.getTime() || null,
      resolvedAt: row.resolvedAt?.getTime() || null,
      items: row.items.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        unitRefundValue: item.unitRefundValue,
        condition: item.condition,
      })),
      events: events.map((event) => ({
        id: event.id,
        status: event.status,
        label: event.label,
        message: event.message,
        occurredAt: event.occurredAt.getTime(),
      })),
    };
  }

  private creditRecord(row: StoreCreditEntity) {
    return {
      id: row.id,
      code: row.code,
      initialAmount: row.initialAmount,
      balance: row.balance,
      status: row.status,
      expiresAt: row.expiresAt.getTime(),
      returnRequestId: row.returnRequestId,
    };
  }

  private protocol() {
    return `TD-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private creditCode() {
    return `WB-${randomBytes(5).toString('hex').toUpperCase()}`;
  }
}
