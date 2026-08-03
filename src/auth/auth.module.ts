import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileEntity } from '../account/entities/profile.entity';
import { LeadEntity } from '../leads/entities/lead.entity';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { LoginCodeEntity } from './entities/login-code.entity';
import { PasswordResetTokenEntity } from './entities/password-reset-token.entity';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([
      ProfileEntity,
      LeadEntity,
      LoginCodeEntity,
      PasswordResetTokenEntity,
    ]),
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthTokenService],
  exports: [AuthTokenService],
})
export class AuthModule {}
