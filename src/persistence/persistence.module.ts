import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import ormconfig from './typeorm.config';

@Global()
@Module({
  imports: [TypeOrmModule.forRoot(ormconfig)],
  exports: [TypeOrmModule],
})
export class PersistenceModule {}
