/**
 * Regras de conclusão do ciclo secundário (média por disciplina no tempo + média final do curso).
 * Execute: npx vitest run src/__tests__/pautaConclusaoCicloSecundario.test.ts
 */

import { describe, it, expect } from 'vitest';
import { calcularMediaFinalCursoSecundarioPorHistoricoDisciplinas } from '../services/pautaConclusaoCicloSecundario.service.js';

describe('calcularMediaFinalCursoSecundarioPorHistoricoDisciplinas', () => {
  it('SIMPLES: média aritmética das médias por disciplina (após média interna por nome)', () => {
    const m = calcularMediaFinalCursoSecundarioPorHistoricoDisciplinas(
      [
        { disciplinaNome: 'Matemática A', mediaFinal: 12, cargaHoraria: 120 },
        { disciplinaNome: 'Matemática A', mediaFinal: 14, cargaHoraria: 120 },
        { disciplinaNome: 'Física', mediaFinal: 11, cargaHoraria: 90 },
        { disciplinaNome: 'Física', mediaFinal: 13, cargaHoraria: 90 },
      ],
      'SIMPLES',
    );
    // MAT: (12+14)/2 = 13; FIS: (11+13)/2 = 12; curso = (13+12)/2 = 12.5
    expect(m).toBe(12.5);
  });

  it('PONDERADA_CARGA: usa carga horária por disciplina', () => {
    const m = calcularMediaFinalCursoSecundarioPorHistoricoDisciplinas(
      [
        { disciplinaNome: 'A', mediaFinal: 10, cargaHoraria: 100 },
        { disciplinaNome: 'B', mediaFinal: 20, cargaHoraria: 100 },
      ],
      'PONDERADA_CARGA',
    );
    expect(m).toBe(15);
  });

  it('ignora itens sem média ou nome vazio', () => {
    const m = calcularMediaFinalCursoSecundarioPorHistoricoDisciplinas(
      [
        { disciplinaNome: 'X', mediaFinal: null },
        { disciplinaNome: '', mediaFinal: 15 },
        { disciplinaNome: 'Y', mediaFinal: 12 },
      ],
      'SIMPLES',
    );
    expect(m).toBe(12);
  });

  it('sem dados válidos devolve null', () => {
    expect(calcularMediaFinalCursoSecundarioPorHistoricoDisciplinas([], 'SIMPLES')).toBeNull();
  });
});
