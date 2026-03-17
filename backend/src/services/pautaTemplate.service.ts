/**
 * Variáveis e preenchimento de templates HTML para Mini Pauta.
 * Usado quando a instituição importa um modelo oficial do governo.
 * Placeholders: {{NOME_INSTITUICAO}}, {{ANO_LETIVO}}, {{TURMA}}, {{DISCIPLINA}}, {{TABELA_ALUNOS}}, etc.
 */
import type { ConsolidacaoPlanoEnsino } from './frequencia.service.js';

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface VarsPautaParams {
  consolidacao: ConsolidacaoPlanoEnsino;
  instituicaoNome: string;
  logoUrl?: string | null;
  nif: string;
  anoLetivo: string;
  labelCursoClasse: string;
  valorCursoClasse: string;
  turmaNome: string;
  disciplinaNome: string;
  profNome: string;
  dataEmissao: string;
  codigoVerificacao: string;
  tipoPauta: 'PROVISORIA' | 'DEFINITIVA';
}

/**
 * Monta variáveis para template HTML de mini pauta.
 * Gera TABELA_ALUNOS como HTML de linhas <tr> para injetar no template do governo.
 */
export function montarVarsPauta(params: VarsPautaParams): Record<string, string> {
  const {
    consolidacao,
    instituicaoNome,
    logoUrl,
    nif,
    anoLetivo,
    labelCursoClasse,
    valorCursoClasse,
    turmaNome,
    disciplinaNome,
    profNome,
    dataEmissao,
    codigoVerificacao,
    tipoPauta,
  } = params;

  const logoImg =
    logoUrl && logoUrl.startsWith('http')
      ? `<img src="${logoUrl.replace(/"/g, '&quot;')}" alt="Logo" style="max-height:48px;" />`
      : '';

  const linhas: string[] = [];
  consolidacao.alunos.forEach((a, i) => {
    const numProc = escapeHtml((a.numeroIdentificacaoPublica ?? '-').toString().slice(0, 15));
    const avalStr = (a.notas as any)?.notasPorAvaliacao
      ? (a.notas as any).notasPorAvaliacao
          .map((n: any) => (n.nota != null ? Number(n.nota).toFixed(1) : '-'))
          .join(' | ')
      : '-';
    const exameVal = (a.notas as any)?.detalhes?.notas_utilizadas?.find(
      (n: any) =>
        String(n.tipo ?? '').toLowerCase().includes('exame') ||
        String(n.tipo ?? '').toLowerCase().includes('recurso')
    );
    const exameStr = exameVal != null ? Number(exameVal.valor).toFixed(1) : '-';
    const mediaStr =
      (a.notas as any)?.mediaFinal != null
        ? Number((a.notas as any).mediaFinal).toFixed(1)
        : '-';
    const resultado =
      a.situacaoAcademica === 'APROVADO'
        ? 'Aprovado'
        : a.situacaoAcademica === 'REPROVADO'
          ? 'Reprovado'
          : a.situacaoAcademica === 'REPROVADO_FALTA'
            ? 'Rep. Falta'
            : 'Em curso';

    const neg = ['REPROVADO', 'REPROVADO_FALTA'].includes(a.situacaoAcademica ?? '')
      ? ' style="color:red;font-weight:bold"'
      : '';
    linhas.push(
      `<tr><td>${i + 1}</td><td>${numProc}</td><td>${escapeHtml((a.nomeCompleto ?? '').slice(0, 50))}</td><td>${escapeHtml(avalStr)}</td><td>${exameStr}</td><td>${mediaStr}</td><td${neg}>${escapeHtml(resultado)}</td></tr>`
    );
  });

  const tabelaAlunos = linhas.join('\n');

  return {
    NOME_INSTITUICAO: escapeHtml(instituicaoNome),
    LOGO_IMG: logoImg,
    NIF: escapeHtml(nif),
    ANO_LETIVO: escapeHtml(anoLetivo),
    LABEL_CURSO_CLASSE: escapeHtml(labelCursoClasse),
    VALOR_CURSO_CLASSE: escapeHtml(valorCursoClasse),
    CURSO_CLASSE: escapeHtml(`${labelCursoClasse}: ${valorCursoClasse}`),
    TURMA: escapeHtml(turmaNome),
    DISCIPLINA: escapeHtml(disciplinaNome),
    PROFESSOR: escapeHtml(profNome),
    DATA_EMISSAO: escapeHtml(dataEmissao),
    CODIGO_VERIFICACAO: escapeHtml(codigoVerificacao),
    TIPO_PAUTA: tipoPauta === 'DEFINITIVA' ? 'DEFINITIVA' : 'PROVISÓRIA',
    TABELA_ALUNOS: tabelaAlunos,
    TOTAL_ESTUDANTES: String(consolidacao.alunos.length),
  };
}
