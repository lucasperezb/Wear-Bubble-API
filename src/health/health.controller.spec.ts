import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns the service status', () => {
    expect(controller.health()).toEqual({
      ok: true,
      service: 'bubble-store-backend',
      framework: 'nestjs',
    });
  });
});
