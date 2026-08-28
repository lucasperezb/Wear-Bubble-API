import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { AppConfigService } from '../config/config.service';
import { OrderItemEntity } from '../orders/entities/order-item.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { ProductColorEntity } from '../products/entities/product-color.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { InventoryMovementEntity } from './entities/inventory-movement.entity';
import { InventoryReservationEntity } from './entities/inventory-reservation.entity';

type InventoryLine = {
  item: OrderItemEntity;
  productId: number;
  productColorId: number | null;
  size: string;
  quantity: number;
};

type InventoryGroup = {
  key: string;
  productId: number;
  productColorId: number | null;
  size: string;
  quantity: number;
  items: InventoryLine[];
};

@Injectable()
export class InventoryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InventoryService.name);
  private expirationTimer?: NodeJS.Timeout;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit() {
    this.expirationTimer = setInterval(
      () => void this.releaseExpiredReservations(),
      60_000,
    );
    this.expirationTimer.unref();
  }

  onModuleDestroy() {
    if (this.expirationTimer) clearInterval(this.expirationTimer);
  }

  async reserveOrder(orderId: string) {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      if (order.inventoryStatus === 'reserved') return;
      if (order.status !== 'pending') {
        throw new BadRequestException('O pedido não aceita uma nova reserva.');
      }
      const context = await this.lockInventoryContext(manager, orderId);
      const reserved = await this.activeReservedQuantities(
        manager,
        context.groups,
        orderId,
      );
      for (const group of context.groups) {
        const physical = this.physicalQuantity(
          group,
          context.products,
          context.colors,
        );
        const available = physical - (reserved.get(group.key) || 0);
        if (available < group.quantity) {
          throw new BadRequestException(
            `Estoque insuficiente de ${context.products.get(group.productId)?.name || group.productId}` +
              `${group.productColorId ? ` na cor ${context.colors.get(group.productColorId)?.name || ''}` : ''}, tamanho ${group.size}.`,
          );
        }
      }

      const expiresAt = new Date(
        Date.now() + this.config.inventoryReservationMinutes * 60_000,
      );
      const reservations = context.lines.map((line) =>
        manager.create(InventoryReservationEntity, {
          orderId,
          orderItemId: line.item.id,
          productId: line.productId,
          productColorId: line.productColorId,
          size: line.size,
          quantity: line.quantity,
          status: 'active',
          expiresAt,
          committedAt: null,
          releasedAt: null,
        }),
      );
      await manager.save(reservations);
      order.inventoryStatus = 'reserved';
      order.stockConflictReason = null;
      await manager.save(order);
    });
  }

  async commitOrder(orderId: string, paymentId: string | null) {
    const committed = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      if (order.status === 'paid' && order.inventoryStatus === 'committed') {
        return true;
      }
      if (!['pending', 'expired'].includes(order.status)) {
        return false;
      }
      const context = await this.lockInventoryContext(manager, orderId);
      for (const group of context.groups) {
        const physical = this.physicalQuantity(
          group,
          context.products,
          context.colors,
        );
        if (physical < group.quantity) {
          const product = context.products.get(group.productId);
          order.status = 'stock_conflict';
          order.inventoryStatus = 'conflict';
          order.paymentStatus = 'refund_pending';
          order.asaasPaymentId = paymentId || order.asaasPaymentId;
          order.stockConflictReason =
            `Pagamento confirmado sem estoque para ${product?.name || group.productId}` +
            `${group.productColorId ? ` / ${context.colors.get(group.productColorId)?.name || ''}` : ''} / ${group.size}.`;
          await manager.update(
            InventoryReservationEntity,
            { orderId },
            { status: 'conflict' },
          );
          await manager.save(order);
          return false;
        }
      }

      for (const group of context.groups) {
        const product = context.products.get(group.productId)!;
        if (group.productColorId) {
          const color = context.colors.get(group.productColorId)!;
          color.sizeStock = {
            ...color.sizeStock,
            [group.size]: Number(color.sizeStock[group.size]) - group.quantity,
          };
          await manager.save(color);
        }
        product.stock -= group.quantity;
        await manager.save(product);
      }
      for (const line of context.lines) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(InventoryMovementEntity)
          .values({
            idempotencyKey: `order:${orderId}:sale:${line.item.id}`,
            orderId,
            orderItemId: line.item.id,
            productId: line.productId,
            productColorId: line.productColorId,
            size: line.size,
            quantity: -line.quantity,
            type: 'sale',
            reason: 'Pagamento confirmado',
          })
          .orIgnore()
          .execute();
      }
      const now = new Date();
      await manager.update(
        InventoryReservationEntity,
        { orderId },
        { status: 'committed', committedAt: now },
      );
      order.status = 'paid';
      order.inventoryStatus = 'committed';
      order.paymentStatus = 'confirmed';
      order.stockConflictReason = null;
      order.shipStage = Math.max(order.shipStage || 0, 1);
      order.paidAt ||= now;
      order.asaasPaymentId = paymentId || order.asaasPaymentId;
      await manager.save(order);
      return true;
    });
    return {
      committed,
      order: await this.dataSource.getRepository(OrderEntity).findOneByOrFail({
        id: orderId,
      }),
    };
  }

  async cancelPendingOrder(
    orderId: string,
    status: 'canceled' | 'expired' = 'canceled',
  ) {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      if (order.status === 'paid' || order.status === 'stock_conflict') {
        throw new BadRequestException('O pedido pago precisa ser estornado.');
      }
      if (order.status === 'canceled') return;
      const now = new Date();
      await manager.update(
        InventoryReservationEntity,
        { orderId, status: 'active' },
        { status: 'released', releasedAt: now },
      );
      order.status = status;
      order.inventoryStatus = 'released';
      order.paymentStatus = 'failed';
      await manager.save(order);
    });
  }

  async restockCanceledOrder(orderId: string, refunded = false) {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const context = await this.lockInventoryContext(manager, orderId);
      for (const line of context.lines) {
        const idempotencyKey = `order:${orderId}:cancellation:${line.item.id}`;
        const exists = await manager.exists(InventoryMovementEntity, {
          where: { idempotencyKey },
        });
        if (exists) continue;
        const product = context.products.get(line.productId)!;
        const saleMovementExists = await manager.exists(
          InventoryMovementEntity,
          {
            where: {
              idempotencyKey: `order:${orderId}:sale:${line.item.id}`,
            },
          },
        );
        if (line.productColorId && saleMovementExists) {
          const color = context.colors.get(line.productColorId)!;
          color.sizeStock = {
            ...color.sizeStock,
            [line.size]:
              Number(color.sizeStock[line.size] || 0) + line.quantity,
          };
          await manager.save(color);
        }
        product.stock += line.quantity;
        await manager.save(product);
        await manager.save(
          manager.create(InventoryMovementEntity, {
            idempotencyKey,
            orderId,
            orderItemId: line.item.id,
            productId: line.productId,
            productColorId: line.productColorId,
            size: line.size,
            quantity: line.quantity,
            type: 'cancellation',
            reason: 'Cancelamento do pedido',
          }),
        );
      }
      order.status = 'canceled';
      order.inventoryStatus = 'released';
      order.paymentStatus = refunded ? 'refunded' : 'refund_pending';
      if (refunded) order.refundedAt ||= new Date();
      await manager.save(order);
    });
  }

  async restockReturn(
    returnId: string,
    orderId: string,
    returnedItems: Array<{ orderItemId: number; quantity: number }>,
  ) {
    await this.dataSource.transaction(async (manager) => {
      await this.lockOrder(manager, orderId);
      const context = await this.lockInventoryContext(manager, orderId);
      const byId = new Map(context.lines.map((line) => [line.item.id, line]));
      for (const returned of returnedItems) {
        const line = byId.get(returned.orderItemId);
        if (!line || returned.quantity > line.quantity) {
          throw new BadRequestException('Item de devolução inválido.');
        }
        const idempotencyKey = `return:${returnId}:restock:${line.item.id}`;
        if (
          await manager.exists(InventoryMovementEntity, {
            where: { idempotencyKey },
          })
        ) {
          continue;
        }
        const product = context.products.get(line.productId)!;
        const saleMovementExists = await manager.exists(
          InventoryMovementEntity,
          {
            where: {
              idempotencyKey: `order:${orderId}:sale:${line.item.id}`,
            },
          },
        );
        if (line.productColorId && saleMovementExists) {
          const color = context.colors.get(line.productColorId)!;
          color.sizeStock = {
            ...color.sizeStock,
            [line.size]:
              Number(color.sizeStock[line.size] || 0) + returned.quantity,
          };
          await manager.save(color);
        }
        product.stock += returned.quantity;
        await manager.save(product);
        await manager.save(
          manager.create(InventoryMovementEntity, {
            idempotencyKey,
            orderId,
            orderItemId: line.item.id,
            productId: line.productId,
            productColorId: line.productColorId,
            size: line.size,
            quantity: returned.quantity,
            type: 'return',
            reason: `Devolução revendível ${returnId}`,
          }),
        );
      }
    });
  }

  async markRefunded(orderId: string) {
    await this.dataSource.getRepository(OrderEntity).update(orderId, {
      paymentStatus: 'refunded',
      refundedAt: new Date(),
    });
  }

  async claimStockConflictRefund(orderId: string) {
    const result = await this.dataSource.getRepository(OrderEntity).update(
      {
        id: orderId,
        status: 'stock_conflict',
        paymentStatus: 'refund_pending',
        refundRequestedAt: IsNull(),
      },
      { refundRequestedAt: new Date() },
    );
    return Boolean(result.affected);
  }

  async releaseStockConflictRefundClaim(orderId: string) {
    await this.dataSource
      .getRepository(OrderEntity)
      .update(
        { id: orderId, paymentStatus: 'refund_pending' },
        { refundRequestedAt: null },
      );
  }

  async reservationSnapshot(productIds: number[]) {
    if (!productIds.length) {
      return {
        byProduct: new Map<number, number>(),
        byVariant: new Map<string, number>(),
      };
    }
    const rows = await this.dataSource
      .getRepository(InventoryReservationEntity)
      .createQueryBuilder('reservation')
      .select('reservation.product_id', 'productId')
      .addSelect('reservation.product_color_id', 'productColorId')
      .addSelect('reservation.size', 'size')
      .addSelect('SUM(reservation.quantity)', 'quantity')
      .where('reservation.product_id IN (:...productIds)', { productIds })
      .andWhere('reservation.status = :status', { status: 'active' })
      .andWhere('reservation.expires_at > now()')
      .groupBy('reservation.product_id')
      .addGroupBy('reservation.product_color_id')
      .addGroupBy('reservation.size')
      .getRawMany<{
        productId: string;
        productColorId: string | null;
        size: string;
        quantity: string;
      }>();
    const byProduct = new Map<number, number>();
    const byVariant = new Map<string, number>();
    for (const row of rows) {
      const productId = Number(row.productId);
      const quantity = Number(row.quantity) || 0;
      byProduct.set(productId, (byProduct.get(productId) || 0) + quantity);
      byVariant.set(
        variantKey(
          productId,
          row.productColorId ? Number(row.productColorId) : null,
          row.size,
        ),
        quantity,
      );
    }
    return { byProduct, byVariant };
  }

  async releaseExpiredReservations() {
    if (!this.dataSource.isInitialized) return;
    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.query(`
          UPDATE inventory_reservations
          SET status = 'released', released_at = now(), updated_at = now()
          WHERE status = 'active' AND expires_at <= now()
        `);
        await manager.query(`
          UPDATE orders o
          SET status = 'expired', inventory_status = 'released', updated_at = now()
          WHERE o.status = 'pending'
            AND o.inventory_status = 'reserved'
            AND NOT EXISTS (
              SELECT 1 FROM inventory_reservations r
              WHERE r.order_id = o.id AND r.status = 'active' AND r.expires_at > now()
            )
        `);
      });
    } catch (error) {
      this.logger.error('Falha ao liberar reservas expiradas.', error);
    }
  }

  private async lockOrder(manager: EntityManager, orderId: string) {
    const order = await manager
      .getRepository(OrderEntity)
      .createQueryBuilder('order')
      .where('order.id = :orderId', { orderId })
      .setLock('pessimistic_write')
      .getOne();
    if (!order) throw new BadRequestException('Pedido inexistente.');
    return order;
  }

  private async lockInventoryContext(manager: EntityManager, orderId: string) {
    const items = await manager.getRepository(OrderItemEntity).find({
      where: { orderId },
      order: { id: 'ASC' },
    });
    const lines = items.map((item) => {
      if (!item.productId) {
        throw new BadRequestException(
          `O item ${item.id} não possui produto vinculado.`,
        );
      }
      return {
        item,
        productId: item.productId,
        productColorId: item.productColorId,
        size: normalizeSize(item.size),
        quantity: item.quantity,
      };
    });
    const productIds = [...new Set(lines.map((line) => line.productId))].sort(
      (a, b) => a - b,
    );
    const colorIds = [
      ...new Set(
        lines
          .map((line) => line.productColorId)
          .filter((id): id is number => id !== null),
      ),
    ].sort((a, b) => a - b);
    const productRows = productIds.length
      ? await manager
          .getRepository(ProductEntity)
          .createQueryBuilder('product')
          .where({ id: In(productIds) })
          .orderBy('product.id', 'ASC')
          .setLock('pessimistic_write')
          .getMany()
      : [];
    const colorRows = colorIds.length
      ? await manager
          .getRepository(ProductColorEntity)
          .createQueryBuilder('color')
          .where({ id: In(colorIds) })
          .orderBy('color.id', 'ASC')
          .setLock('pessimistic_write')
          .getMany()
      : [];
    const products = new Map(productRows.map((row) => [row.id, row]));
    const colors = new Map(colorRows.map((row) => [row.id, row]));
    if (
      products.size !== productIds.length ||
      colors.size !== colorIds.length
    ) {
      throw new BadRequestException('Uma variante do pedido não existe mais.');
    }
    return { lines, groups: groupInventoryLines(lines), products, colors };
  }

  private async activeReservedQuantities(
    manager: EntityManager,
    groups: InventoryGroup[],
    excludedOrderId: string,
  ) {
    const productIds = [...new Set(groups.map((group) => group.productId))];
    if (!productIds.length) return new Map<string, number>();
    const rows = await manager
      .getRepository(InventoryReservationEntity)
      .createQueryBuilder('reservation')
      .select('reservation.product_id', 'productId')
      .addSelect('reservation.product_color_id', 'productColorId')
      .addSelect('reservation.size', 'size')
      .addSelect('SUM(reservation.quantity)', 'quantity')
      .where('reservation.product_id IN (:...productIds)', { productIds })
      .andWhere('reservation.status = :status', { status: 'active' })
      .andWhere('reservation.expires_at > now()')
      .andWhere('reservation.order_id <> :excludedOrderId', {
        excludedOrderId,
      })
      .groupBy('reservation.product_id')
      .addGroupBy('reservation.product_color_id')
      .addGroupBy('reservation.size')
      .getRawMany<{
        productId: string;
        productColorId: string | null;
        size: string;
        quantity: string;
      }>();
    return new Map(
      rows.map((row) => [
        variantKey(
          Number(row.productId),
          row.productColorId ? Number(row.productColorId) : null,
          row.size,
        ),
        Number(row.quantity),
      ]),
    );
  }

  private physicalQuantity(
    group: InventoryGroup,
    products: Map<number, ProductEntity>,
    colors: Map<number, ProductColorEntity>,
  ) {
    if (!group.productColorId) return products.get(group.productId)?.stock || 0;
    const color = colors.get(group.productColorId);
    if (!color || color.productId !== group.productId) {
      throw new BadRequestException(
        'A cor selecionada não pertence ao produto.',
      );
    }
    const value = color.sizeStock[group.size];
    if (value === undefined) {
      throw new BadRequestException(
        `O tamanho ${group.size} não existe para a cor ${color.name}.`,
      );
    }
    return Number(value) || 0;
  }
}

export function groupInventoryLines(lines: InventoryLine[]) {
  const groups = new Map<string, InventoryGroup>();
  for (const line of lines) {
    const key = variantKey(line.productId, line.productColorId, line.size);
    const group = groups.get(key) || {
      key,
      productId: line.productId,
      productColorId: line.productColorId,
      size: normalizeSize(line.size),
      quantity: 0,
      items: [],
    };
    group.quantity += line.quantity;
    group.items.push(line);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function normalizeSize(size: string) {
  return String(size || 'U')
    .trim()
    .toUpperCase();
}

function variantKey(
  productId: number,
  productColorId: number | null,
  size: string,
) {
  return `${productId}:${productColorId || 0}:${normalizeSize(size)}`;
}
