/**
 * Testes do OpenAPI/Swagger: spec é gerada e tem estrutura mínima.
 * Não depende de Prisma nem do servidor.
 */
import { describe, it, expect } from 'vitest';
import type swaggerJsdoc from 'swagger-jsdoc';
import { spec } from '../lib/swagger.js';

type OpenAPISpec = swaggerJsdoc.OAS3Definition;

describe('OpenAPI / Swagger', () => {
  it('spec existe e é objeto', () => {
    expect(spec).toBeDefined();
    expect(typeof spec).toBe('object');
  });

  it('spec tem openapi 3.0.0', () => {
    expect((spec as OpenAPISpec).openapi).toBe('3.0.0');
  });

  it('spec tem info (title, version)', () => {
    const s = spec as OpenAPISpec;
    expect(s.info).toBeDefined();
    expect(s.info?.title).toBe('DSICOLA API');
    expect(s.info?.version).toBe('1.0.0');
  });

  it('spec tem path /health (get)', () => {
    const s = spec as OpenAPISpec;
    expect(s.paths).toBeDefined();
    expect(s.paths!['/health']).toBeDefined();
    expect(s.paths!['/health'].get).toBeDefined();
    expect(s.paths!['/health'].get?.summary).toBeDefined();
  });

  it('spec tem securityScheme bearerAuth', () => {
    const s = spec as OpenAPISpec;
    const bearerAuth = s.components?.securitySchemes?.bearerAuth;
    expect(bearerAuth).toBeDefined();
    expect(bearerAuth && 'bearerFormat' in bearerAuth ? bearerAuth.bearerFormat : undefined).toBe('JWT');
  });
});
