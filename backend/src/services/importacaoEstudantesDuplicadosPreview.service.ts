import type { LinhaImportacaoPreview } from './importacaoEstudantesExcel.service.js';
import { normalizarDocumentoIdentificacao, normalizarTelefoneParaDedupe } from '../utils/importacaoEstudantesNormalizacao.js';

/**
 * Marca linhas com BI ou telefone repetido no próprio Excel (segunda passagem).
 */
export function marcarDuplicadosDocumentoETelefoneNoPreview(dados: LinhaImportacaoPreview[]): {
  validos: number;
  erros: number;
} {
  const biMap = new Map<string, number[]>();
  const telMap = new Map<string, number[]>();

  for (const d of dados) {
    if (d.bi?.trim()) {
      const k = normalizarDocumentoIdentificacao(d.bi);
      if (!biMap.has(k)) biMap.set(k, []);
      biMap.get(k)!.push(d.linha);
    }
    if (d.telefone?.trim()) {
      const tk = normalizarTelefoneParaDedupe(d.telefone);
      if (tk.length >= 9) {
        if (!telMap.has(tk)) telMap.set(tk, []);
        telMap.get(tk)!.push(d.linha);
      }
    }
  }

  const motivos = new Map<number, string[]>();
  const addMotivo = (linha: number, msg: string) => {
    if (!motivos.has(linha)) motivos.set(linha, []);
    motivos.get(linha)!.push(msg);
  };

  for (const [, linhas] of biMap) {
    if (linhas.length > 1) {
      for (const l of linhas) addMotivo(l, 'BI/NIF duplicado no ficheiro');
    }
  }
  for (const [, linhas] of telMap) {
    if (linhas.length > 1) {
      for (const l of linhas) addMotivo(l, 'Telefone duplicado no ficheiro');
    }
  }

  let validos = 0;
  let erros = 0;
  for (const d of dados) {
    const ms = motivos.get(d.linha);
    if (ms?.length) {
      d.valido = false;
      d.erro = [...new Set(ms)].join('; ');
      d.turmaId = null;
      d.turmaResolvidaNome = null;
      d.avisosMatriculaSeguro = undefined;
    }
    if (d.valido) validos++;
    else erros++;
  }

  return { validos, erros };
}
