import { describe, it, expect } from 'vitest';
import {
  normalizarDocumentoIdentificacao,
  normalizarTelefoneParaDedupe,
} from '../utils/importacaoEstudantesNormalizacao.js';

describe('importacaoEstudantesNormalizacao', () => {
  it('normaliza BI', () => {
    expect(normalizarDocumentoIdentificacao('  123456789LA045  ')).toBe('123456789LA045');
    expect(normalizarDocumentoIdentificacao('abc\ndef')).toBe('ABC DEF');
  });

  it('extrai dígitos do telefone', () => {
    expect(normalizarTelefoneParaDedupe('+244 923 456 789')).toBe('244923456789');
  });
});
