import 'reflect-metadata';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { setupSwagger } from './config/swagger.config';
import { AuthTokenService } from './auth/auth-token.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const env = app.get(AppConfigService);
  const auth = app.get(AuthTokenService);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/auth')) {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization || '';
    const cookies = req.cookies as Record<string, string | undefined>;
    const token =
      cookies.bubble_token ||
      (typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice(7)
        : null);
    if (token) {
      try {
        req.user = auth.verify(token);
      } catch {
        req.user = undefined;
      }
    }
    next();
  });
  app.enableCors({ origin: env.frontendOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          message: 'Revise os campos informados e tente novamente.',
          errors: validationMessages(errors),
        }),
    }),
  );
  app.setGlobalPrefix('api');

  setupSwagger(app);

  await app.listen(env.port);
  console.log(`Wear Bubble API NestJS: http://localhost:${env.port}/api`);
  console.log(`Swagger: http://localhost:${env.port}/api/docs`);
  console.log(`Front-end autorizado: ${env.frontendOrigins.join(', ')}`);
  console.log(`Gerente: ${env.managerEmail}`);
}

void bootstrap();

function validationMessages(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints || {}).map(
      (message) => `${field}: ${message}`,
    );
    return [...own, ...validationMessages(error.children || [], field)];
  });
}
