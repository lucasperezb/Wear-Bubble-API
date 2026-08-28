import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileEntity } from '../account/entities/profile.entity';
import { AddressEntity } from '../account/entities/address.entity';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([ProfileEntity, AddressEntity]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
