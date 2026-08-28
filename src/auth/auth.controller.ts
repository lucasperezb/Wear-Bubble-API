import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { ApiAuth } from './decorators/api-auth.decorator';
import { AuthGuard } from './guards/auth.guard';
import { AuthenticatedUser } from './auth.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordResetDto } from './dto/password-reset.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { RequestLoginCodeDto } from './dto/request-login-code.dto';
import { VerifyLoginCodeDto } from './dto/verify-login-code.dto';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.register(dto, res);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto, res);
  }

  @Post('code/request')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestLoginCode(@Body() dto: RequestLoginCodeDto) {
    return this.auth.requestLoginCode(dto);
  }

  @Post('code/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyLoginCode(
    @Body() dto: VerifyLoginCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.verifyLoginCode(dto, res);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    return this.auth.logout(res);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiAuth()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.uid, user.email, user.role);
  }

  @Get('session')
  session(@CurrentUser() user: AuthenticatedUser | undefined) {
    return user ? this.auth.me(user.uid, user.email, user.role) : null;
  }

  @Post('password-reset')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  passwordReset(@Body() dto: PasswordResetDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.auth.confirmPasswordReset(dto.token, dto.password);
  }
}
