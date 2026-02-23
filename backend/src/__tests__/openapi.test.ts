/**
 * Testes do OpenAPI/Swagger: spec é gerada e tem estrutura mínima.
 * Não depende de Prisma nem do servidor.
 */
import { describe, it, expect } from 'vitest';
import { spec } from '../lib/swagger.js';

describe('OpenAPI / Swagger', () => {
  it('spec existe e é objeto', () => {
    expect(spec).toBeDefined();
    expect(typeof spec).toBe('object');
  });

  it('spec tem openapi 3.0.0', () => {
    expect(spec.openapi).toBe('3.0.0');
  });

  it('spec tem info (title, version)', () => {
    expect(spec.info).toBeDefined();
    expect(spec.info?.title).toBe('DSICOLA API');
    expect(spec.info?.version).toBe('1.0.0');
  });

  it('spec tem path /health (get)', () => {
    expect(spec.paths).toBeDefined();
    expect(spec.paths['/health']).toBeDefined();
    expect(spec.paths['/health'].get).toBeDefined();
    expect(spec.paths['/health'].get?.summary).toBeDefined();
  });

  it('spec tem securityScheme bearerAuth', () => {
    expect(spec.components?.securitySchemes?.bearerAuth).toBeDefined();
    expect(spec.components?.securitySchemes?.bearerAuth?.bearerFormat).toBe('JWT');
  });
});
