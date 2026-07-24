import 'dotenv/config';
import { DataSourceOptions } from 'typeorm';
import { ProfileEntity } from '../account/entities/profile.entity';
import { DeletionReportEntity } from '../account/entities/deletion-report.entity';
import { AddressEntity } from '../account/entities/address.entity';
import { UserEntity } from '../users/entities/user.entity';
import { LoginCodeEntity } from '../auth/entities/login-code.entity';
import { CouponEntity } from '../coupons/entities/coupon.entity';
import { EventEntity } from '../events/entities/event.entity';
import { LeadEntity } from '../leads/entities/lead.entity';
import { OrderCounterEntity } from '../orders/entities/order-counter.entity';
import { OrderItemEntity } from '../orders/entities/order-item.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { ProductColorEntity } from '../products/entities/product-color.entity';
import { ProductEntity } from '../products/entities/product.entity';

const booleanEnv = (value: string | undefined, fallback: boolean) =>
  value === undefined ? fallback : value === 'true';

const ormconfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5433,
  username: process.env.DB_USER || 'bubble',
  password: process.env.DB_PASSWORD || 'bubble',
  database: process.env.DB_NAME || 'bubble_store',
  entities: [
    UserEntity,
    LoginCodeEntity,
    ProfileEntity,
    AddressEntity,
    DeletionReportEntity,
    ProductEntity,
    ProductColorEntity,
    OrderEntity,
    OrderItemEntity,
    OrderCounterEntity,
    CouponEntity,
    EventEntity,
    LeadEntity,
  ],
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  synchronize: booleanEnv(process.env.DB_SYNCHRONIZE, false),
  logging: booleanEnv(process.env.DB_LOGGING, false),
};

export default ormconfig;
