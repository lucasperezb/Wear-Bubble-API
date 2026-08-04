import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PersistenceModule } from './persistence/persistence.module';
import { AccountModule } from './account/account.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CouponsModule } from './coupons/coupons.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { LeadsModule } from './leads/leads.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';
import { MelhorEnvioModule } from './integrations/melhor-envio/melhor-envio.module';
import { ReturnsModule } from './returns/returns.module';
import { CreditsModule } from './credits/credits.module';

@Module({
  imports: [
    AppConfigModule,
    PersistenceModule,
    UsersModule,
    HealthModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    CouponsModule,
    LeadsModule,
    EventsModule,
    AccountModule,
    PaymentsModule,
    MelhorEnvioModule,
    ReturnsModule,
    CreditsModule,
    AdminModule,
  ],
})
export class AppModule {}
