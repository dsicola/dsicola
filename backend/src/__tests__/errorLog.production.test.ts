import { describe, it, expect, afterEach, vi } from 'vitest';

describe('verboseHttpErrorLogs', () => {
  const saved = { ...process.env };

  afterEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = saved.NODE_ENV;
    if (saved.LOG_ERROR_DETAILS_IN_PRODUCTION === undefined) {
      delete process.env.LOG_ERROR_DETAILS_IN_PRODUCTION;
    } else {
      process.env.LOG_ERROR_DETAILS_IN_PRODUCTION = saved.LOG_ERROR_DETAILS_IN_PRODUCTION;
    }
  });

  it('em produção omite detalhes salvo LOG_ERROR_DETAILS_IN_PRODUCTION', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.LOG_ERROR_DETAILS_IN_PRODUCTION;
    const { verboseHttpErrorLogs } = await import('../lib/logger.js');
    expect(verboseHttpErrorLogs()).toBe(false);

    process.env.LOG_ERROR_DETAILS_IN_PRODUCTION = 'true';
    vi.resetModules();
    const { verboseHttpErrorLogs: v2 } = await import('../lib/logger.js');
    expect(v2()).toBe(true);
  });

  it('fora de produção inclui detalhes', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.LOG_ERROR_DETAILS_IN_PRODUCTION;
    const { verboseHttpErrorLogs } = await import('../lib/logger.js');
    expect(verboseHttpErrorLogs()).toBe(true);
  });
});
