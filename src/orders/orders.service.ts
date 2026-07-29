import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AppConfigService } from '../config/config.service';
import { CouponsService } from '../coupons/coupons.service';
import { EmailService } from '../email/email.service';
import { ProductsService } from '../products/products.service';
import { CouponRecord } from '../coupons/coupon.types';
import { OrderDelivery, OrderRecord, OrderShipping } from './order.types';
import { CreateOrderDto } from './dto/create-order.dto';
import { ShipOrderDto } from './dto/ship-order.dto';
import { OrderCounterEntity } from './entities/order-counter.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderEntity } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    private readonly config: AppConfigService,
    private readonly products: ProductsService,
    private readonly coupons: CouponsService,
    private readonly email: EmailService,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItems: Repository<OrderItemEntity>,
    @InjectRepository(OrderCounterEntity)
    private readonly counters: Repository<OrderCounterEntity>,
  ) {}

  async create(uid: string, dto: CreateOrderDto) {
    const order = await this.createPending(uid, dto);
    return { orderId: order.id, number: order.number, total: order.total };
  }

  async createPending(
    uid: string,
    dto: CreateOrderDto,
    delivery?: OrderDelivery,
    shipping?: OrderShipping,
  ): Promise<OrderRecord> {
    const items = Array.isArray(dto?.items) ? dto.items : [];
    if (!items.length) throw new BadRequestException('Carrinho vazio.');
    const method = dto?.method === 'Pix' ? 'Pix' : 'Cartao de credito';
    const bundleCounts = new Map<string, number>();
    for (const item of items)
      if (item.bundle)
        bundleCounts.set(item.bundle, (bundleCounts.get(item.bundle) || 0) + 1);

    let subtotal = 0;
    let bundleSubtotal = 0;
    const lines: OrderRecord['items'] = [];
    for (const item of items) {
      const row = await this.products.findEntity(Number(item.pid));
      const product = row ? this.products.toRecord(row) : undefined;
      if (!product)
        throw new BadRequestException(`Produto ${item.pid} inexistente.`);
      if (!product.active)
        throw new BadRequestException(`${product.name} indisponivel.`);
      const qty = Math.max(
        1,
        Math.min(10, parseInt(String(item.qty), 10) || 1),
      );
      const size = String(item.size || 'U').trim().toUpperCase();
      const color = String(item.color || '').trim();
      if (!product.sizes.includes(size))
        throw new BadRequestException(
          `Tamanho ${size} indisponivel para ${product.name}.`,
        );
      const hasVariantStock = product.colors.some(
        (option) => (option.sizes || []).length > 0,
      );
      const selectedColor = product.colors.find(
        (option) => option.n.toLocaleLowerCase('pt-BR') === color.toLocaleLowerCase('pt-BR'),
      );
      const variantQuantity = selectedColor?.sizes?.find(
        (option) => option.size.toUpperCase() === size,
      )?.q;
      if (hasVariantStock && (!selectedColor || variantQuantity === undefined))
        throw new BadRequestException(
          `Selecione uma cor e tamanho disponiveis para ${product.name}.`,
        );
      const available = hasVariantStock ? Number(variantQuantity) || 0 : product.stock;
      if (available < qty)
        throw new BadRequestException(
          `Estoque insuficiente de ${product.name} na cor ${selectedColor?.n || color}, tamanho ${size}.`,
        );
      const lineTotal = product.price * qty;
      subtotal += lineTotal;
      if (
        dto.bundle ||
        (item.bundle && (bundleCounts.get(item.bundle) || 0) >= 2)
      )
        bundleSubtotal += lineTotal;
      lines.push({
        pid: product.id,
        name: product.name,
        size,
        color: selectedColor?.n || color,
        qty,
        price: product.price,
      });
    }
    subtotal -= bundleSubtotal * this.config.bundleDiscount;

    const couponCode =
      String(dto?.coupon || '')
        .trim()
        .toUpperCase() || null;
    let couponPct = 0;
    let coupon: CouponRecord | null = null;
    if (couponCode) {
      coupon = await this.coupons.getActive(couponCode);
      if (coupon.minSubtotal && subtotal < coupon.minSubtotal)
        throw new BadRequestException(
          `Cupom exige compra minima de R$ ${coupon.minSubtotal}.`,
        );
      couponPct = Math.min(90, Math.max(0, Number(coupon.pct) || 0));
      subtotal *= 1 - couponPct / 100;
    }
    const productTotal =
      Math.round(
        subtotal * (method === 'Pix' ? 1 - this.config.pixDiscount : 1) * 100,
      ) / 100;
    const shippingPrice = this.config.freeShippingEnabled
      ? 0
      : productTotal >= 299
        ? 0
        : Math.max(0, Number(shipping?.price) || 0);
    const total = Math.round((productTotal + shippingPrice) * 100) / 100;
    const order: OrderRecord = {
      id: randomUUID(),
      customerId: uid,
      number: await this.nextOrderNumber(),
      date: Date.now(),
      items: lines,
      total,
      method,
      coupon: couponCode,
      couponPct,
      status: 'pending',
      shipStage: 0,
      ...(delivery ? { delivery } : {}),
      ...(shipping ? { shipping: { ...shipping, price: shippingPrice } } : {}),
    };
    await this.orders.save(
      this.orders.create({
        id: order.id,
        customerUid: uid,
        number: order.number,
        orderedAt: new Date(order.date),
        customerName: delivery?.name || '',
        customerEmail: delivery?.email || '',
        customerTaxId: delivery?.taxId || '',
        customerPhone: delivery?.phone || '',
        shippingCep: delivery?.cep || '',
        shippingStreet: delivery?.street || '',
        shippingNeighborhood: delivery?.neighborhood || '',
        shippingNumber: delivery?.number || '',
        shippingReference: delivery?.reference || '',
        shippingCity: delivery?.city || '',
        shippingState: delivery?.state || '',
        shippingServiceId: shipping?.serviceId || null,
        shippingServiceName: shipping?.name || null,
        shippingCompany: shipping?.company || null,
        shippingPrice,
        shippingDeliveryTime: shipping?.deliveryTime || null,
        items: lines.map((line) =>
          this.orderItems.create({
            productId: line.pid,
            productName: line.name,
            size: line.size,
            color: line.color,
            quantity: line.qty,
            unitPrice: line.price,
          }),
        ),
        total: order.total,
        method: order.method,
        couponCode: order.coupon,
        couponPct: order.couponPct,
        status: order.status,
        shipStage: order.shipStage,
        gateway: null,
        pagbankCheckoutId: null,
        pagbankPaymentId: null,
        tracking: null,
        paidAt: null,
      }),
    );
    if (coupon) await this.coupons.increment(coupon.code, 1);
    return order;
  }

  async rollbackPending(order: OrderRecord) {
    const row = await this.orders.findOneBy({ id: order.id });
    if (!row || row.status !== 'pending') return;
    await this.orders.delete({ id: order.id });
    if (order.coupon) await this.coupons.increment(order.coupon, -1);
  }

  async listMine(uid: string) {
    return (
      await this.orders.find({
        where: { customerUid: uid },
        order: { orderedAt: 'DESC' },
      })
    ).map((row) => this.toRecord(row));
  }

  async listAll() {
    return (await this.orders.find({ order: { orderedAt: 'DESC' } })).map(
      (row) => this.toRecord(row),
    );
  }

  async ship(id: string, dto: ShipOrderDto) {
    const row = await this.orders.findOneBy({ id });
    if (!row) throw new NotFoundException('Pedido nao encontrado.');
    const previousStage = row.shipStage;
    const previousTracking = row.tracking;
    row.shipStage = Math.max(
      0,
      Math.min(5, parseInt(String(dto?.shipStage), 10) || 0),
    );
    if (dto.tracking !== undefined) row.tracking = String(dto.tracking);
    await this.orders.save(row);
    const order = this.toRecord(row);
    if (previousStage !== row.shipStage || previousTracking !== row.tracking) {
      await this.email.sendShippingUpdate(order);
    }
    return order;
  }

  findEntity(id: string) {
    return this.orders.findOneBy({ id });
  }

  saveEntity(row: OrderEntity) {
    return this.orders.save(row);
  }

  toRecord(row: OrderEntity): OrderRecord {
    return {
      id: row.id,
      customerId: row.customerUid || 'anon',
      number: row.number,
      date: row.orderedAt.getTime(),
      items: (row.items || []).map((item) => ({
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
      ...(row.shippingServiceId
        ? {
            shipping: {
              serviceId: row.shippingServiceId,
              name: row.shippingServiceName || '',
              company: row.shippingCompany || '',
              price: row.shippingPrice,
              deliveryTime: row.shippingDeliveryTime || 0,
            },
          }
        : {}),
      ...(row.gateway ? { gateway: row.gateway } : {}),
      ...(row.pagbankCheckoutId
        ? { pagbankCheckoutId: row.pagbankCheckoutId }
        : {}),
      ...(row.pagbankPaymentId
        ? { pagbankPaymentId: row.pagbankPaymentId }
        : {}),
      ...(row.tracking ? { tracking: row.tracking } : {}),
      ...(row.paidAt ? { paidAt: row.paidAt.getTime() } : {}),
    };
  }

  private async nextOrderNumber() {
    const counter =
      (await this.counters.findOneBy({ key: 'orders' })) ||
      this.counters.create({ key: 'orders', value: 0 });
    counter.value += 1;
    await this.counters.save(counter);
    return `B${String(counter.value).padStart(5, '0')}`;
  }
}
