import { describe, expect, it } from 'vitest';
import type { RegraAprovacaoRow } from '../repositories/academicProgression.repository.js';
import { selecionarRegraMaisEspecifica } from '../repositories/academicProgression.repository.js';

function regra(
  partial: Pick<RegraAprovacaoRow, 'id' | 'cursoId' | 'classeId' | 'instituicaoId'>
): RegraAprovacaoRow {
  return {
    ...partial,
    mediaMinima: null,
    maxReprovacoes: null,
    exigeDisciplinasChave: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as RegraAprovacaoRow;
}

describe('selecionarRegraMaisEspecifica', () => {
  const curso = 'c1';
  const classe = 'cl1';

  it('prefere curso + classe sobre só curso', () => {
    const linhas = [
      regra({ id: 'r1', instituicaoId: 'i', cursoId: curso, classeId: null }),
      regra({ id: 'r2', instituicaoId: 'i', cursoId: curso, classeId: classe }),
    ];
    expect(selecionarRegraMaisEspecifica(linhas, curso, classe)?.id).toBe('r2');
  });

  it('prefere só curso sobre regra só de instituição', () => {
    const linhas = [
      regra({ id: 'geral', instituicaoId: 'i', cursoId: null, classeId: null }),
      regra({ id: 'curso', instituicaoId: 'i', cursoId: curso, classeId: null }),
    ];
    expect(selecionarRegraMaisEspecifica(linhas, curso, classe)?.id).toBe('curso');
  });

  it('exclui regra cujo curso não coincide', () => {
    const linhas = [
      regra({ id: 'outro', instituicaoId: 'i', cursoId: 'cx', classeId: classe }),
      regra({ id: 'ok', instituicaoId: 'i', cursoId: curso, classeId: classe }),
    ];
    expect(selecionarRegraMaisEspecifica(linhas, curso, classe)?.id).toBe('ok');
  });

  it('exclui regra cuja classe não coincide', () => {
    const linhas = [
      regra({ id: 'outra', instituicaoId: 'i', cursoId: curso, classeId: 'cx' }),
    ];
    expect(selecionarRegraMaisEspecifica(linhas, curso, classe)).toBeNull();
  });

  it('retorna null se nenhuma regra aplicável', () => {
    expect(selecionarRegraMaisEspecifica([], curso, classe)).toBeNull();
  });
});
