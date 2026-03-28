import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/academicProgression.repository.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../repositories/academicProgression.repository.js')>();
  return {
    ...mod,
    listarRegrasInstituicao: vi.fn(),
    listarDisciplinasChaveScope: vi.fn(),
    listDisciplinaIdsObrigatoriasMatrizCurricular: vi.fn(),
  };
});

import {
  listDisciplinaIdsObrigatoriasMatrizCurricular,
  listarDisciplinasChaveScope,
  listarRegrasInstituicao,
} from '../repositories/academicProgression.repository.js';
import type { RegraAprovacaoRow } from '../repositories/academicProgression.repository.js';
import { refinamentoRegrasInstitucionais } from '../services/progressaoAcademica.service.js';

function regra(
  partial: Pick<RegraAprovacaoRow, 'id' | 'cursoId' | 'classeId' | 'instituicaoId'> & {
    mediaMinima?: number | null;
    maxReprovacoes?: number | null;
    exigeDisciplinasChave?: boolean;
    exigeAprovacaoMatrizObrigatorias?: boolean;
  }
): RegraAprovacaoRow {
  return {
    ...partial,
    mediaMinima: partial.mediaMinima ?? null,
    maxReprovacoes: partial.maxReprovacoes ?? null,
    exigeDisciplinasChave: partial.exigeDisciplinasChave ?? false,
    exigeAprovacaoMatrizObrigatorias: partial.exigeAprovacaoMatrizObrigatorias ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as RegraAprovacaoRow;
}

const baselineAprovado = {
  statusFinal: 'APROVADO' as const,
  disciplinasReprovadas: 0,
  disciplinasTotal: 2,
  disciplinasNegativasPermitidas: 0,
};

const historicoMediasBaixas = [
  { disciplinaId: 'd1', situacaoAcademica: 'APROVADO', mediaFinal: 8 },
  { disciplinaId: 'd2', situacaoAcademica: 'APROVADO', mediaFinal: 10 },
];

describe('refinamentoRegrasInstitucionais', () => {
  beforeEach(() => {
    vi.mocked(listarRegrasInstituicao).mockReset();
    vi.mocked(listarDisciplinasChaveScope).mockReset();
    vi.mocked(listDisciplinaIdsObrigatoriasMatrizCurricular).mockReset();
  });

  it('reprova quando média geral está abaixo do mínimo da regra', async () => {
    vi.mocked(listarRegrasInstituicao).mockResolvedValue([
      regra({
        id: 'r1',
        instituicaoId: 'inst',
        cursoId: 'c1',
        classeId: 'cl1',
        mediaMinima: 12,
      }),
    ]);

    const out = await refinamentoRegrasInstitucionais(
      'inst',
      'c1',
      'cl1',
      baselineAprovado,
      historicoMediasBaixas
    );

    expect(out.statusFinal).toBe('REPROVADO');
    expect(out.mediaGeral).toBe(9);
    expect(out.motivosExtras?.some((m) => m.includes('mínimo'))).toBe(true);
    expect(out.regraAplicadaId).toBe('r1');
  });

  it('reprova quando reprovações excedem maxReprovacoes', async () => {
    vi.mocked(listarRegrasInstituicao).mockResolvedValue([
      regra({
        id: 'r2',
        instituicaoId: 'inst',
        cursoId: 'c1',
        classeId: null,
        maxReprovacoes: 1,
      }),
    ]);

    const out = await refinamentoRegrasInstitucionais(
      'inst',
      'c1',
      null,
      {
        ...baselineAprovado,
        disciplinasReprovadas: 3,
      },
      historicoMediasBaixas
    );

    expect(out.statusFinal).toBe('REPROVADO');
    expect(out.motivosExtras?.some((m) => m.includes('reprovações'))).toBe(true);
  });

  it('reprova quando disciplina obrigatória da matriz não está aprovada (regra exige matriz)', async () => {
    vi.mocked(listarRegrasInstituicao).mockResolvedValue([
      regra({
        id: 'r-matriz',
        instituicaoId: 'inst',
        cursoId: 'c1',
        classeId: 'cl1',
        exigeAprovacaoMatrizObrigatorias: true,
      }),
    ]);
    vi.mocked(listDisciplinaIdsObrigatoriasMatrizCurricular).mockResolvedValue(['d-matriz']);

    const out = await refinamentoRegrasInstitucionais('inst', 'c1', 'cl1', baselineAprovado, [
      { disciplinaId: 'd1', situacaoAcademica: 'APROVADO', mediaFinal: 15 },
    ]);

    expect(out.statusFinal).toBe('REPROVADO');
    expect(out.motivosExtras?.some((m) => m.includes('plano curricular'))).toBe(true);
    expect(listDisciplinaIdsObrigatoriasMatrizCurricular).toHaveBeenCalledWith('inst', 'c1', 'cl1');
  });

  it('reprova disciplina chave não aprovada quando exigido', async () => {
    vi.mocked(listarRegrasInstituicao).mockResolvedValue([
      regra({
        id: 'r3',
        instituicaoId: 'inst',
        cursoId: 'c1',
        classeId: 'cl1',
        exigeDisciplinasChave: true,
      }),
    ]);
    vi.mocked(listarDisciplinasChaveScope).mockResolvedValue([{ disciplinaId: 'd-chave' }]);

    const out = await refinamentoRegrasInstitucionais('inst', 'c1', 'cl1', baselineAprovado, [
      { disciplinaId: 'd1', situacaoAcademica: 'APROVADO', mediaFinal: 15 },
      { disciplinaId: 'd2', situacaoAcademica: 'REPROVADO', mediaFinal: 8 },
    ]);

    expect(out.statusFinal).toBe('REPROVADO');
    expect(out.motivosExtras?.some((m) => m.includes('Disciplina chave'))).toBe(true);
    expect(listarDisciplinasChaveScope).toHaveBeenCalledWith('inst', 'c1', 'cl1');
  });

  it('mantém APROVADO quando regras não configuradas para o contexto', async () => {
    vi.mocked(listarRegrasInstituicao).mockResolvedValue([
      regra({ id: 'outra', instituicaoId: 'inst', cursoId: 'cx', classeId: null, mediaMinima: 20 }),
    ]);

    const out = await refinamentoRegrasInstitucionais(
      'inst',
      'c1',
      'cl1',
      baselineAprovado,
      historicoMediasBaixas
    );

    expect(out.statusFinal).toBe('APROVADO');
    expect(out.regraAplicadaId).toBeNull();
  });

  it('não promove REPROVADO a APROVADO por refinamento (linha de segurança)', async () => {
    vi.mocked(listarRegrasInstituicao).mockResolvedValue([]);

    const out = await refinamentoRegrasInstitucionais(
      'inst',
      'c1',
      'cl1',
      {
        ...baselineAprovado,
        statusFinal: 'REPROVADO',
        disciplinasReprovadas: 2,
      },
      [{ disciplinaId: 'd1', situacaoAcademica: 'APROVADO', mediaFinal: 18 }]
    );

    expect(out.statusFinal).toBe('REPROVADO');
  });
});
