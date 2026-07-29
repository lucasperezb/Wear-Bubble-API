import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MelhorEnvioCredentialEntity } from './entities/melhor-envio-credential.entity';
import { MelhorEnvioController } from './melhor-envio.controller';
import { MelhorEnvioService } from './melhor-envio.service';
import { ProductsModule } from '../../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MelhorEnvioCredentialEntity]),
    ProductsModule,
  ],
  controllers: [MelhorEnvioController],
  providers: [MelhorEnvioService],
  exports: [MelhorEnvioService],
})
export class MelhorEnvioModule {}
