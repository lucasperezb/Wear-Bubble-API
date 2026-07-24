import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupSwagger } from '../src/config/swagger.config';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/health (GET)', () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    return request(server).get('/api/health').expect(200).expect({
      ok: true,
      service: 'bubble-store-backend',
      framework: 'nestjs',
    });
  });

  it('/api/docs (GET)', () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    return request(server).get('/api/docs').expect(200);
  });

  it('/api/docs-json (GET)', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/api/docs-json').expect(200);

    expect(response.body.info.title).toBe('Bubble Store API');
    expect(response.body.paths['/api/auth/login']).toBeDefined();
    expect(response.body.components.securitySchemes.cookie).toBeDefined();
    expect(response.body.components.securitySchemes.bearer).toBeDefined();
  });
});
