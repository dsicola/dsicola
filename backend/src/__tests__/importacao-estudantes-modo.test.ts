import { describe, it, expect } from 'vitest';
import { resolveModoImportacao } from '../utils/importacaoEstudantesModo.js';

describe('resolveModoImportacao', () => {
  it('prioriza modo explícito', () => {
    expect(resolveModoImportacao('flexivel', false)).toBe('flexivel');
    expect(resolveModoImportacao('seguro', true)).toBe('seguro');
  });

  it('legacy permissivo true → flexivel', () => {
    expect(resolveModoImportacao(undefined, true)).toBe('flexivel');
  });

  it('default seguro', () => {
    expect(resolveModoImportacao(undefined, undefined)).toBe('seguro');
    expect(resolveModoImportacao(undefined, false)).toBe('seguro');
    expect(resolveModoImportacao('', undefined)).toBe('seguro');
  });
});
