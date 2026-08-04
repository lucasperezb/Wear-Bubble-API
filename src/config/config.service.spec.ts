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
