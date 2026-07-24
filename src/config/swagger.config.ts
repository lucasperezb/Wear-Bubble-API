import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Bubble Store API')
    .setDescription('Documentação e ambiente de testes da API Bubble Store.')
    .setVersion('2.0')
    .addCookieAuth('bubble_token', { type: 'apiKey', in: 'cookie' }, 'cookie')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    customSiteTitle: 'Bubble Store API',
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
    },
  });
}
