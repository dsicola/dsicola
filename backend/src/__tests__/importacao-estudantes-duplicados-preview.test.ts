import { describe, it, expect } from 'vitest';
import type { LinhaImportacaoPreview } from '../services/importacaoEstudantesExcel.service.js';
import { marcarDuplicadosDocumentoETelefoneNoPreview } from '../services/importacaoEstudantesDuplicadosPreview.service.js';

describe('marcarDuplicadosDocumentoETelefoneNoPreview', () => {
  it('invalida BI repetido', () => {
    const dados: LinhaImportacaoPreview[] = [
      { linha: 2, nomeCompleto: 'A', classe: '10', valido: true, bi: '123LA045' },
      { linha: 3, nomeCompleto: 'B', classe: '10', valido: true, bi: '123la045' },
    ];
    const r = marcarDuplicadosDocumentoETelefoneNoPreview(dados);
    expect(r.validos).toBe(0);
    expect(r.erros).toBe(2);
    expect(dados.every((d) => !d.valido)).toBe(true);
  });

  it('mantém únicos', () => {
    const dados: LinhaImportacaoPreview[] = [
      { linha: 2, nomeCompleto: 'A', classe: '10', valido: true, bi: '111' },
      { linha: 3, nomeCompleto: 'B', classe: '10', valido: true, bi: '222' },
    ];
    const r = marcarDuplicadosDocumentoETelefoneNoPreview(dados);
    expect(r.validos).toBe(2);
    expect(dados.every((d) => d.valido)).toBe(true);
  });
});
