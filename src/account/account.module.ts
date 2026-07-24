import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AddressEntity } from './entities/address.entity';
import { DeletionReportEntity } from './entities/deletion-report.entity';
import { ProfileEntity } from './entities/profile.entity';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([
      ProfileEntity,
      AddressEntity,
      DeletionReportEntity,
    ]),
  ],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
