import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeletionReportEntity } from '../account/entities/deletion-report.entity';
import { ProfileEntity } from '../account/entities/profile.entity';
import { AddressEntity } from '../account/entities/address.entity';
import { CouponEntity } from '../coupons/entities/coupon.entity';
import { EventEntity } from '../events/entities/event.entity';
import { LeadEntity } from '../leads/entities/lead.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(EventEntity)
    private readonly events: Repository<EventEntity>,
    private readonly users: UsersService,
    @InjectRepository(LeadEntity)
    private readonly leads: Repository<LeadEntity>,
    @InjectRepository(CouponEntity)
    private readonly coupons: Repository<CouponEntity>,
    @InjectRepository(DeletionReportEntity)
    private readonly reports: Repository<DeletionReportEntity>,
    @InjectRepository(ProfileEntity)
    private readonly profiles: Repository<ProfileEntity>,
    @InjectRepository(AddressEntity)
    private readonly addresses: Repository<AddressEntity>,
  ) {}

  async databaseDump() {
    const [
      products,
      orders,
      events,
      users,
      leads,
      coupons,
      reports,
      profiles,
      addresses,
    ] = await Promise.all([
      this.products.find(),
      this.orders.find(),
      this.events.find(),
      this.users.findAll(),
      this.leads.find(),
      this.coupons.find(),
      this.reports.find(),
      this.profiles.find(),
      this.addresses.find({ order: { isDefault: 'DESC' } }),
    ]);
    const primaryAddress = new Map<string, AddressEntity>();
    for (const address of addresses)
      if (!primaryAddress.has(address.userUid))
        primaryAddress.set(address.userUid, address);
    const mask = (email?: string) =>
      email ? `${email[0]}***@${email.split('@')[1]}` : '';
    return {
      products: products.map((row) => ({
        id: row.id,
        name: row.name,
        cat: row.cat,
        sub: row.sub,
        price: row.price,
        tag: row.tag,
        icon: row.icon,
        rating: row.rating,
        reviews: row.reviews,
        stock: row.stock,
        active: row.active,
        sizes: row.sizes,
        material: row.material,
        pair: row.pairId || 0,
        sports: row.sports,
        colors: row.colors.map((color) => ({ n: color.name, h: color.hex })),
        desc: row.desc,
        image: row.image,
      })),
      orders: orders.map((row) => ({
        id: row.id,
        customerId: row.customerUid || 'anon',
        number: row.number,
        date: row.orderedAt.getTime(),
        items: row.items.map((item) => ({
          pid: item.productId || 0,
          name: item.productName,
          size: item.size,
          qty: item.quantity,
          price: item.unitPrice,
        })),
        total: row.total,
        method: row.method,
        coupon: row.couponCode,
        couponPct: row.couponPct,
        status: row.status,
        shipStage: row.shipStage,
        gateway: row.gateway,
        pagbankCheckoutId: row.pagbankCheckoutId,
        pagbankPaymentId: row.pagbankPaymentId,
        tracking: row.tracking,
        paidAt: row.paidAt?.getTime(),
      })),
      events: events.map((row) => ({
        type: row.type,
        pid: row.productId,
        ts: row.occurredAt.getTime(),
        actor: row.actorLabel,
      })),
      users: users.map((user) => ({
        uid: user.uid,
        role: user.role,
        marketingOptIn: user.marketingOptIn,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.getTime(),
      })),
      leads: leads.map((lead) => ({
        hash: lead.hash,
        email: lead.email,
        consent: lead.consent,
        source: lead.source,
        joinedAt: lead.joinedAt.getTime(),
      })),
      coupons: coupons.map((coupon) => ({
        code: coupon.code,
        pct: coupon.pct,
        active: coupon.active,
        expiresAt: coupon.expiresAt?.getTime() || null,
        maxUses: coupon.maxUses,
        minSubtotal: coupon.minSubtotal,
        assignedTo: coupon.assignedTo,
        uses: coupon.uses,
        createdAt: coupon.createdAt.getTime(),
      })),
      deletion_reports: reports.map((report) => ({
        protocol: report.protocol,
        date: report.requestedAt.getTime(),
        maskedId: report.maskedId,
      })),
      pii_vault: profiles.map((profile) => ({
        uid: profile.uid,
        name: profile.name,
        email: mask(profile.email),
        city: primaryAddress.get(profile.uid)?.city || '',
      })),
    };
  }
}
