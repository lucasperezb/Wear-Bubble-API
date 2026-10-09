import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as dns } from 'node:dns';
import { Resolver as DnsResolver } from 'node:dns/promises';
import disposableDomains from 'disposable-email-domains';

type Resolver = {
  resolveMx: (domain: string) => Promise<unknown[]>;
  resolve4: (domain: string) => Promise<unknown[]>;
  resolve6: (domain: string) => Promise<unknown[]>;
};
type LookupKind = keyof Resolver;

/** Reserva quando o DNS do servidor não responde (Google e Cloudflare). */
function publicResolver(): Resolver {
  const resolver = new DnsResolver({ timeout: 2_000, tries: 1 });
  resolver.setServers(['8.8.8.8', '1.1.1.1']);
  return resolver;
}

/** Códigos de DNS que significam "este domínio não existe / não tem registro". */
const MISSING = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN']);
const LOOKUP_TIMEOUT_MS = 3_000;
const CACHE_TTL_MS = 60 * 60_000;

/**
 * Recusa e-mails que não servem para uma conta real: domínios descartáveis
 * (mailinator, 10minutemail…) e domínios que não recebem e-mail. Se o DNS do
 * servidor falhar, tenta pelos DNS públicos; se nenhum responder (timeout,
 * rede), deixa passar, para nunca barrar uma cliente real por instabilidade.
 */
@Injectable()
export class EmailPolicyService {
  private readonly disposable = new Set<string>(disposableDomains);
  private readonly cache = new Map<string, { ok: boolean; at: number }>();
  /** Consultados em ordem até um responder. Substituível nos testes. */
  resolvers: Resolver[] = [dns, publicResolver()];

  async assertAcceptable(email: string) {
    const domain = this.domainOf(email);
    if (!domain) {
      throw new BadRequestException('Informe um e-mail válido.');
    }
    if (this.isDisposable(domain)) {
      throw new BadRequestException(
        'E-mails temporários não são aceitos. Use um e-mail permanente.',
      );
    }
    if (!(await this.receivesMail(domain))) {
      throw new BadRequestException(
        'Não encontramos o domínio deste e-mail. Confira se foi digitado corretamente.',
      );
    }
  }

  /** Também pega subdomínios: x.mailinator.com conta como mailinator.com. */
  isDisposable(domain: string) {
    const parts = domain.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      if (this.disposable.has(parts.slice(i).join('.'))) return true;
    }
    return false;
  }

  private domainOf(email: string) {
    const value = String(email || '')
      .trim()
      .toLowerCase();
    const at = value.lastIndexOf('@');
    const domain = at > 0 ? value.slice(at + 1) : '';
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : '';
  }

  private async receivesMail(domain: string) {
    const cached = this.cache.get(domain);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.ok;
    // Sem MX, o próprio registro A/AAAA vale como servidor de e-mail (RFC 5321).
    const ok =
      (await this.has('resolveMx', domain)) ||
      (await this.has('resolve4', domain)) ||
      (await this.has('resolve6', domain));
    this.cache.set(domain, { ok, at: Date.now() });
    return ok;
  }

  /**
   * true se há registro; false só quando algum DNS responde que não existe.
   * Sem resposta de nenhum DNS, considera que existe (não bloqueia).
   */
  private async has(kind: LookupKind, domain: string) {
    for (const resolver of this.resolvers) {
      let timer: NodeJS.Timeout | undefined;
      try {
        const records = await Promise.race([
          resolver[kind](domain),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  Object.assign(new Error('timeout'), { code: 'TIMEOUT' }),
                ),
              LOOKUP_TIMEOUT_MS,
            );
          }),
        ]);
        return records.length > 0;
      } catch (error) {
        if (MISSING.has((error as { code?: string }).code || '')) return false;
      } finally {
        clearTimeout(timer);
      }
    }
    return true;
  }
}
