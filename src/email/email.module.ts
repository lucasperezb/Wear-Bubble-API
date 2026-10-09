import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailGuardService } from './email-guard.service';
import { EmailPolicyService } from './email-policy.service';
import { EmailService } from './email.service';
import { EmailSendLogEntity } from './entities/email-send-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmailSendLogEntity])],
  providers: [EmailService, EmailGuardService, EmailPolicyService],
  exports: [EmailService, EmailGuardService, EmailPolicyService],
})
export class EmailModule {}
