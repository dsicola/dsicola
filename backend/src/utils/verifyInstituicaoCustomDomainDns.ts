/**
 * Verificação opcional de DNS para domínio próprio da instituição.
 * CUSTOM_DOMAIN_DNS_TARGETS: CSV de alvos esperados (ex.: cname.vercel-dns.com,76.76.21.21).
 */

import dns from 'node:dns/promises';
import { normalizeInstituicaoCustomDomainHost } from './instituicaoCustomDomain.js';

export interface DnsVerifyResultDto {
  configuredOnServer: boolean;
  ok: boolean;
  message: string;
  records: string[];
}

function normalizeExpectedList(): string[] {
  return (process.env.CUSTOM_DOMAIN_DNS_TARGETS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/\.$/, ''))
    .filter(Boolean);
}

function matchesExpected(value: string, expected: string[]): boolean {
  const v = value.toLowerCase().replace(/\.$/, '');
  return expected.some((e) => {
    if (v === e) return true;
    if (e.length > 0 && v.endsWith(`.${e}`)) return true;
    return false;
  });
}

export async function verifyInstituicaoCustomDomainDns(hostnameRaw: string): Promise<DnsVerifyResultDto> {
  const normalized =
    normalizeInstituicaoCustomDomainHost(hostnameRaw) ||
    hostnameRaw.toLowerCase().split(':')[0].replace(/^https?:\/\//, '').split('/')[0].trim();

  const expected = normalizeExpectedList();
  const records: string[] = [];

  if (expected.length === 0) {
    return {
      configuredOnServer: false,
      ok: true,
      message:
        'Verificação automática não configurada no servidor. Defina CUSTOM_DOMAIN_DNS_TARGETS ou confirme o DNS com o suporte.',
      records: [],
    };
  }

  let ok = false;

  try {
    const cnames = await dns.resolveCname(normalized);
    for (const c of cnames) {
      const cl = c.replace(/\.$/, '');
      records.push(`CNAME → ${cl}`);
      if (matchesExpected(cl, expected)) ok = true;
    }
  } catch {
    // NXDOMAIN / ENODATA / não é CNAME
  }

  if (!ok) {
    try {
      const ips = await dns.resolve4(normalized);
      for (const ip of ips) {
        records.push(`A → ${ip}`);
        if (expected.includes(ip.toLowerCase())) ok = true;
      }
    } catch {
      // ignore
    }
  }

  if (!ok) {
    try {
      const ips = await dns.resolve6(normalized);
      for (const ip of ips) {
        records.push(`AAAA → ${ip}`);
        if (expected.includes(ip.toLowerCase())) ok = true;
      }
    } catch {
      // ignore
    }
  }

  if (records.length === 0) {
    return {
      configuredOnServer: true,
      ok: false,
      message:
        'Sem registos DNS públicos visíveis (ainda não configurado, propagação em curso, ou nome incorrecto).',
      records: [],
    };
  }

  return {
    configuredOnServer: true,
    ok,
    message: ok
      ? 'DNS público corresponde a um dos destinos configurados na plataforma.'
      : 'DNS não corresponde aos valores esperados. Ajuste CNAME/A no registo do domínio e confirme no painel do hosting.',
    records,
  };
}
