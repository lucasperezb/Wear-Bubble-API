import { BadRequestException } from '@nestjs/common';
import { CreditsService } from './credits.service';

describe('CreditsService', () => {
  const activeCredit = () => ({
    code: 'WB-ABC123',
    customerUid: 'customer-1',
    initialAmount: 100,
    balance: 100,
    status: 'active',
    expiresAt: new Date(Date.now() + 86_400_000),
  });

  function transactionalRepository(credit: ReturnType<typeof activeCredit>) {
    const repository: Record<string, any> = {
      findOne: jest.fn().mockResolvedValue(credit),
      findOneBy: jest.fn().mockResolvedValue(credit),
      save: jest.fn().mockImplementation((value) => Promise.resolve(value)),
    };
    repository.manager = {
      transaction: jest
        .fn()
        .mockImplementation((callback) =>
          callback({ getRepository: () => repository }),
        ),
    };
    return repository;
  }

  it('reserves only the order value and keeps the remainder active', async () => {
    const credit = activeCredit();
    const repository = transactionalRepository(credit);
    const service = new CreditsService(repository as never);

    await expect(
      service.reserve('customer-1', 'wb-abc123', 35.5),
    ).resolves.toEqual({
      code: 'WB-ABC123',
      amount: 35.5,
    });
    expect(credit.balance).toBe(64.5);
    expect(credit.status).toBe('active');
  });

  it('rejects a credit that belongs to another account', async () => {
    const repository = {
      findOneBy: jest.fn().mockResolvedValue(activeCredit()),
      save: jest.fn(),
    };
    const service = new CreditsService(repository as never);

    await expect(
      service.validate('customer-2', 'WB-ABC123'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('restores a reserved amount without exceeding the original balance', async () => {
    const credit = { ...activeCredit(), balance: 20, status: 'active' };
    const repository = transactionalRepository(credit);
    const service = new CreditsService(repository as never);

    await service.release('WB-ABC123', 90);
    expect(credit.balance).toBe(100);
    expect(repository.save).toHaveBeenCalled();
  });
});
