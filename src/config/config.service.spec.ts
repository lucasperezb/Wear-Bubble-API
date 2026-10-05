import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './config.service';

describe('AppConfigService Asaas configuration', () => {
  const createConfig = (values: Record<string, string>) =>
    new AppConfigService({
      get: (key: string) => values[key],
    } as ConfigService);

  it('normalizes escaped and invisible characters in the API key', () => {
    const config = createConfig({
      ASAAS_ENV: 'production',
      ASAAS_API_KEY: " '\\$aact_prod_test\u200B' ",
    });

    expect(config.asaasApiKey).toBe('$aact_prod_test');
    expect(config.asaasApiKeyDiagnostics).toEqual({
      configured: true,
      environment: 'production',
      baseUrl: 'https://api.asaas.com/v3',
      expectedPrefix: '$aact_prod_',
      prefixValid: true,
      length: 15,
    });
  });

  it('reports a key from the wrong environment without exposing it', () => {
    const config = createConfig({
      ASAAS_ENV: 'production',
      ASAAS_API_KEY: '$aact_hmlg_test',
    });

    expect(config.asaasApiKeyDiagnostics.prefixValid).toBe(false);
  });
});

describe('AppConfigService free shipping campaign', () => {
  const createConfig = (values: Record<string, string>) =>
    new AppConfigService({
      get: (key: string) => values[key],
    } as ConfigService);

  afterEach(() => jest.useRealTimers());

  it('gives free shipping on any value during October 2026 (Brasília)', () => {
    const config = createConfig({ FREE_SHIPPING_MINIMUM: '299' });
    jest.useFakeTimers().setSystemTime(new Date('2026-10-01T03:00:00Z'));
    expect(config.freeShippingMinimum).toBe(0);
    jest.setSystemTime(new Date('2026-11-01T02:59:59Z'));
    expect(config.freeShippingMinimum).toBe(0);
  });

  it('returns to the normal minimum outside the campaign', () => {
    const config = createConfig({ FREE_SHIPPING_MINIMUM: '299' });
    jest.useFakeTimers().setSystemTime(new Date('2026-10-01T02:59:59Z'));
    expect(config.freeShippingMinimum).toBe(299);
    jest.setSystemTime(new Date('2026-11-01T03:00:00Z'));
    expect(config.freeShippingMinimum).toBe(299);
  });

  it('accepts custom campaign dates and a zero minimum', () => {
    const config = createConfig({
      FREE_SHIPPING_MINIMUM: '0',
      FREE_SHIPPING_PROMO_STARTS_AT: '2030-01-01T00:00:00-03:00',
      FREE_SHIPPING_PROMO_ENDS_AT: '2030-01-31T23:59:59-03:00',
    });
    jest.useFakeTimers().setSystemTime(new Date('2026-10-15T12:00:00Z'));
    expect(config.freeShippingPromoActive()).toBe(false);
    expect(config.freeShippingMinimum).toBe(0);
  });
});
