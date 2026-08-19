import 'dotenv/config';
import { DataSourceOptions } from 'typeorm';
import { ProfileEntity } from '../account/entities/profile.entity';
import { DeletionReportEntity } from '../account/entities/deletion-report.entity';
import { AddressEntity } from '../account/entities/address.entity';
import { UserEntity } from '../users/entities/user.entity';
import { LoginCodeEntity } from '../auth/entities/login-code.entity';
import { PasswordResetTokenEntity } from '../auth/entities/password-reset-token.entity';
import { CouponEntity } from '../coupons/entities/coupon.entity';
import { EventEntity } from '../events/entities/event.entity';
import { LeadEntity } from '../leads/entities/lead.entity';
import { OrderCounterEntity } from '../orders/entities/order-counter.entity';
import { OrderItemEntity } from '../orders/entities/order-item.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { ProductColorEntity } from '../products/entities/product-color.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { ProductImageEntity } from '../products/entities/product-image.entity';
import { ProductShowcaseEntity } from '../products/entities/product-showcase.entity';
import { MelhorEnvioCredentialEntity } from '../integrations/melhor-envio/entities/melhor-envio-credential.entity';
import { ReturnRequestEntity } from '../returns/entities/return-request.entity';
import { ReturnItemEntity } from '../returns/entities/return-item.entity';
import { ReturnEventEntity } from '../returns/entities/return-event.entity';
import { StoreCreditEntity } from '../returns/entities/store-credit.entity';
import { HeroConfigEntity } from '../hero/entities/hero-config.entity';
import { HeroSlideEntity } from '../hero/entities/hero-slide.entity';

const booleanEnv = (value: string | undefined, fallback: boolean) =>
  value === undefined ? fallback : value === 'true';

const databaseUrl =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
const databaseSsl = booleanEnv(process.env.DB_SSL, false);

const ormconfig: DataSourceOptions = {
  type: 'postgres',
  ...(databaseUrl
    ? { url: databaseUrl }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5433,
        username: process.env.DB_USER || 'bubble',
        password: process.env.DB_PASSWORD || 'bubble',
        database: process.env.DB_NAME || 'bubble_store',
      }),
  ssl: databaseSsl ? { rejectUnauthorized: false } : false,
  entities: [
    UserEntity,
    LoginCodeEntity,
    PasswordResetTokenEntity,
    ProfileEntity,
    AddressEntity,
    DeletionReportEntity,
    ProductEntity,
    ProductColorEntity,
    ProductImageEntity,
    ProductShowcaseEntity,
    OrderEntity,
    OrderItemEntity,
    OrderCounterEntity,
    CouponEntity,
    EventEntity,
    LeadEntity,
    MelhorEnvioCredentialEntity,
    ReturnRequestEntity,
    ReturnItemEntity,
    ReturnEventEntity,
    StoreCreditEntity,
    HeroConfigEntity,
    HeroSlideEntity,
  ],
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  migrationsRun: booleanEnv(process.env.DB_MIGRATIONS_RUN, false),
  synchronize: booleanEnv(process.env.DB_SYNCHRONIZE, false),
  logging: booleanEnv(process.env.DB_LOGGING, false),
};

export default ormconfig;
