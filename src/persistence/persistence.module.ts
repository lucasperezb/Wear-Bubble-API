import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import ormconfig from './typeorm.config';
import { AdvisoryLockService } from './advisory-lock.service';

@Global()
@Module({
  imports: [TypeOrmModule.forRoot(ormconfig)],
  providers: [AdvisoryLockService],
  exports: [TypeOrmModule, AdvisoryLockService],
})
export class PersistenceModule {}
