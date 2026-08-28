import { BadRequestException } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { StoreCreditAllocationEntity } from './entities/store-credit-allocation.entity';

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
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue(credit),
      findOneBy: jest.fn().mockResolvedValue(credit),
      save: jest.fn().mockImplementation((value) => Promise.resolve(value)),
    };
    repository.manager = {
      transaction: jest.fn().mockImplementation((callback) => {
        const allocationRepository = {
          find: jest.fn().mockResolvedValue([]),
          create: jest.fn((value) => value),
          save: jest.fn().mockImplementation((value) => Promise.resolve(value)),
        };
        return callback({
          getRepository: (entity) =>
            entity === StoreCreditAllocationEntity
              ? allocationRepository
              : repository,
        });
      }),
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

  it('reserves the account balance across multiple credits', async () => {
    const first = {
      ...activeCredit(),
      id: 'credit-1',
      balance: 30,
      initialAmount: 30,
      expiresAt: new Date(Date.now() + 86_400_000),
    };
    const second = {
      ...activeCredit(),
      id: 'credit-2',
      code: 'WB-SECOND',
      balance: 50,
      initialAmount: 50,
      expiresAt: new Date(Date.now() + 2 * 86_400_000),
    };
    const allocations: Array<Record<string, any>> = [];
    const allocationRepository = {
      create: jest.fn((value) => value),
      save: jest.fn().mockImplementation((value) => {
        allocations.push(value);
        return Promise.resolve(value);
      }),
    };
    const repository: Record<string, any> = {
      find: jest.fn().mockResolvedValue([first, second]),
      save: jest.fn().mockImplementation((value) => Promise.resolve(value)),
    };
    repository.manager = {
      transaction: jest.fn().mockImplementation((callback) =>
        callback({
          getRepository: (entity) =>
            entity === StoreCreditAllocationEntity
              ? allocationRepository
              : repository,
        }),
      ),
    };
    const service = new CreditsService(repository as never);

    await expect(service.reserveBalance('customer-1', 60)).resolves.toEqual({
      code: expect.any(String),
      amount: 60,
    });
    expect(first.balance).toBe(0);
    expect(first.status).toBe('used');
    expect(second.balance).toBe(20);
    expect(allocations.map((item) => item.amount)).toEqual([30, 30]);
    expect(allocations[0].reservationId).toBe(allocations[1].reservationId);
  });

  it('restores an automatic reservation to its source credit', async () => {
    const credit = {
      ...activeCredit(),
      id: 'credit-1',
      initialAmount: 50,
      balance: 10,
    };
    const allocation = {
      reservationId: 'e65054ce-45ca-43c5-b584-e98bbf86e021',
      creditId: credit.id,
      amount: 40,
      releasedAmount: 0,
      createdAt: new Date(),
    };
    const allocationRepository = {
      find: jest.fn().mockResolvedValue([allocation]),
      save: jest.fn().mockImplementation((value) => Promise.resolve(value)),
    };
    const repository: Record<string, any> = {
      findOne: jest.fn().mockResolvedValue(credit),
      save: jest.fn().mockImplementation((value) => Promise.resolve(value)),
    };
    repository.manager = {
      transaction: jest.fn().mockImplementation((callback) =>
        callback({
          getRepository: (entity) =>
            entity === StoreCreditAllocationEntity
              ? allocationRepository
              : repository,
        }),
      ),
    };
    const service = new CreditsService(repository as never);

    await service.release(allocation.reservationId, 15);

    expect(credit.balance).toBe(25);
    expect(allocation.releasedAmount).toBe(15);
    expect(credit.status).toBe('active');
  });
});
