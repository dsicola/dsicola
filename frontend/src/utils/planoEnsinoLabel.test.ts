import { describe, it, expect } from 'vitest';
import { labelPlanoEnsino } from './planoEnsinoLabel';

describe('labelPlanoEnsino', () => {
  it('superior: disciplina, professor, semestre', () => {
    expect(
      labelPlanoEnsino(
        {
          disciplina: { nome: 'Álgebra' },
          professor: { user: { nomeCompleto: 'Prof. A' } },
          semestre: 1,
        },
        false,
      ),
    ).toBe('Álgebra · Prof. A · S1');
  });

  it('secundário: inclui classe ou classeOuAno', () => {
    expect(
      labelPlanoEnsino(
        {
          disciplina: { nome: 'Física' },
          classe: { nome: '11ª Classe A' },
          professor: { user: { nomeCompleto: 'Prof. B' } },
        },
        true,
      ),
    ).toBe('Física · 11ª Classe A · Prof. B');
    expect(
      labelPlanoEnsino(
        {
          disciplina: { nome: 'Química' },
          classeOuAno: '12.ª Classe',
          professor: { user: { nomeCompleto: 'Prof. C' } },
        },
        true,
      ),
    ).toBe('Química · 12.ª Classe · Prof. C');
  });
});
