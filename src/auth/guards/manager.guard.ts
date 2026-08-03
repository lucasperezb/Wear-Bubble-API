import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ManagerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.user) throw new UnauthorizedException('Login necessário.');
    if (req.user.role !== 'manager')
      throw new ForbiddenException('Acesso restrito ao gerente.');
    return true;
  }
}
