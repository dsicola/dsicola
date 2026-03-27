import prisma from '../lib/prisma.js';

export type VerificacaoPautaPublicaResponse = {
  valido: boolean;
  mensagem?: string;
  instituicao?: string;
  tipoPauta?: string;
  anoLetivo?: string;
  labelCursoClasse?: string;
  valorCursoClasse?: string;
  turma?: string;
  disciplina?: string;
  dataEmissao?: string;
};

/**
 * Consulta pública por código (multi-tenant: resposta só reflete o registo encontrado, sem dados de alunos).
 */
export async function verificarPautaDocumentoPublico(codigo: string): Promise<VerificacaoPautaPublicaResponse> {
  const c = codigo.toUpperCase().trim();
  if (!c) {
    return { valido: false, mensagem: 'Código não fornecido' };
  }

  const row = await prisma.pautaDocumentoEmissao.findFirst({
    where: { codigoVerificacao: c },
  });

  if (!row) {
    return { valido: false, mensagem: 'Pauta não encontrada ou código inválido' };
  }

  return {
    valido: true,
    instituicao: row.instituicaoNomeSnapshot ?? undefined,
    tipoPauta: row.tipoPauta,
    anoLetivo: row.anoLetivoLabel ?? undefined,
    labelCursoClasse: row.labelCursoClasse ?? undefined,
    valorCursoClasse: row.valorCursoClasse ?? undefined,
    turma: row.turmaNome ?? undefined,
    disciplina: row.disciplinaNome ?? undefined,
    dataEmissao: row.createdAt.toISOString(),
  };
}
