import { describe, it, expect } from 'vitest';
import { TipoAcademico } from '@prisma/client';
import { avaliarRegrasMatriculaImportacaoSemAluno } from '../services/importacaoEstudantesMatricula.service.js';

const turmaSuperiorOk = {
  id: 't1',
  nome: 'Eng — 1º Ano A',
  cursoId: 'c1',
  classeId: null as string | null,
  capacidade: 40,
  matriculasCount: 10,
  classe: null,
  curso: { nome: 'Engenharia' },
};

describe('avaliarRegrasMatriculaImportacaoSemAluno', () => {
  it('sem avisos: superior, período ok, vagas, ano inferível', () => {
    const r = avaliarRegrasMatriculaImportacaoSemAluno({
      tipoAcademicoInstituicao: TipoAcademico.SUPERIOR,
      classeRawExcel: '1º Ano',
      turma: turmaSuperiorOk,
      periodoLetivoOk: true,
    });
    expect(r).toEqual([]);
  });

  it('turma cheia', () => {
    const r = avaliarRegrasMatriculaImportacaoSemAluno({
      tipoAcademicoInstituicao: TipoAcademico.SUPERIOR,
      classeRawExcel: '1º Ano',
      turma: { ...turmaSuperiorOk, matriculasCount: 40 },
      periodoLetivoOk: true,
    });
    expect(r.some((x) => x.includes('vagas'))).toBe(true);
  });

  it('fora do período letivo', () => {
    const r = avaliarRegrasMatriculaImportacaoSemAluno({
      tipoAcademicoInstituicao: TipoAcademico.SECUNDARIO,
      classeRawExcel: '10ª Classe',
      turma: {
        id: 't2',
        nome: '10A',
        cursoId: null,
        classeId: 'cl1',
        capacidade: 30,
        matriculasCount: 5,
        classe: { nome: '10ª Classe' },
        curso: null,
      },
      periodoLetivoOk: false,
      mensagemPeriodoLetivo: 'Fora do período.',
    });
    expect(r).toContain('Fora do período.');
  });
});
