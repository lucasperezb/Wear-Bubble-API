import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export const ApiAuth = () =>
  applyDecorators(
    ApiCookieAuth('cookie'),
    ApiBearerAuth('bearer'),
    ApiUnauthorizedResponse({
      description: 'Token ausente, inválido ou expirado.',
    }),
  );
