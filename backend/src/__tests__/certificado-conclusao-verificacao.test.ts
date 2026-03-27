/**
 * Verificação pública do certificado de conclusão (secundário) — código único e resposta sem dados completos.
 *
 * Execute: npx vitest run src/__tests__/certificado-conclusao-verificacao.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindFirst = vi.fn();
const mockFindUnique = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  default: {
    certificado: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import {
  verificarCertificadoConclusaoPorCodigo,
  gerarCodigoVerificacaoCertificadoUnico,
} from '../services/certificadoConclusaoVerificacao.service.js';

describe('certificadoConclusaoVerificacao — verificarCertificadoConclusaoPorCodigo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('código vazio → válido false', async () => {
    const r = await verificarCertificadoConclusaoPorCodigo('  ');
    expect(r.valido).toBe(false);
    if (!r.valido) expect(r.mensagem).toMatch(/não fornecido/i);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('código inexistente → válido false', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const r = await verificarCertificadoConclusaoPorCodigo('ABCDEF00');
    expect(r.valido).toBe(false);
    if (!r.valido) expect(r.mensagem).toMatch(/não encontrado|código inválido/i);
  });

  it('código válido → instituição, nome parcial (2 primeiros nomes), n.º e data', async () => {
    mockFindFirst.mockResolvedValueOnce({
      numeroCertificado: 'CERT-2024-001',
      dataEmissao: new Date('2024-06-15T10:00:00.000Z'),
      instituicao: { nome: 'Escola Teste Lda' },
      conclusaoCurso: {
        aluno: { nomeCompleto: 'Maria João Paula Ferreira' },
      },
    });

    const r = await verificarCertificadoConclusaoPorCodigo('a1b2c3d4');

    expect(r.valido).toBe(true);
    if (r.valido) {
      expect(r.tipo).toBe('CERTIFICADO_CONCLUSAO_SECUNDARIO');
      expect(r.instituicao).toBe('Escola Teste Lda');
      expect(r.nomeParcial).toBe('Maria João ***');
      expect(r.numeroCertificado).toBe('CERT-2024-001');
      expect(r.dataEmissao).toBe('2024-06-15T10:00:00.000Z');
    }

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { codigoVerificacao: 'A1B2C3D4' },
      })
    );
  });

  it('titular com um só nome → parcial com ***', async () => {
    mockFindFirst.mockResolvedValueOnce({
      numeroCertificado: 'N1',
      dataEmissao: new Date(),
      instituicao: { nome: 'Inst' },
      conclusaoCurso: {
        aluno: { nomeCompleto: 'Cher' },
      },
    });

    const r = await verificarCertificadoConclusaoPorCodigo('XYZ');
    expect(r.valido).toBe(true);
    if (r.valido) expect(r.nomeParcial).toBe('Cher ***');
  });
});

describe('certificadoConclusaoVerificacao — gerarCodigoVerificacaoCertificadoUnico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devolve código quando não há colisão', async () => {
    mockFindFirst.mockResolvedValue(null);
    const code = await gerarCodigoVerificacaoCertificadoUnico();
    expect(code).toMatch(/^[0-9A-F]{8}$/);
    expect(mockFindFirst).toHaveBeenCalled();
  });
});
