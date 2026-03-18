/**
 * Impressão de Pauta (Provisória e Definitiva) - PDF A4
 * GET /pautas/:planoEnsinoId/imprimir
 */
import prisma from '../lib/prisma.js';
import PDFDocument from 'pdfkit';
import { AppError } from '../middlewares/errorHandler.js';
import { consolidarPlanoEnsino } from './frequencia.service.js';
import crypto from 'crypto';

export type TipoPauta = 'PROVISORIA' | 'DEFINITIVA';

export async function gerarPDFPauta(
  planoEnsinoId: string,
  instituicaoId: string,
  tipoPauta: TipoPauta,
  operadorNome: string,
  professorNome: string,
  secretariaNome?: string
): Promise<Buffer> {
  const planoEnsino = await prisma.planoEnsino.findFirst({
    where: { id: planoEnsinoId, instituicaoId },
    include: {
      disciplina: true,
      turma: { include: { curso: true, classe: true, anoLetivoRef: true } },
      professor: { include: { user: { select: { nomeCompleto: true } } } },
      instituicao: { select: { nome: true, logoUrl: true, tipoAcademico: true, configuracao: { select: { nif: true } } } },
    },
  });

  if (!planoEnsino) {
    throw new AppError('Plano de ensino não encontrado ou acesso negado', 404);
  }

  const pautaStatusAtual = planoEnsino.pautaStatus ?? 'RASCUNHO';
  if (tipoPauta === 'DEFINITIVA' && pautaStatusAtual !== 'FECHADA') {
    throw new AppError('Impressão Definitiva permitida apenas quando a pauta está fechada (status FECHADA)', 400);
  }

  const consolidacao = await consolidarPlanoEnsino(
    planoEnsinoId,
    instituicaoId,
    planoEnsino.instituicao?.tipoAcademico ?? null
  );

  const anoLetivo = planoEnsino.turma?.anoLetivoRef?.ano?.toString() ?? '-';
  // Superior: só Curso. Secundário: só Classe. Inferir de turma.classeId se tipoAcademico não definido.
  const t = planoEnsino.turma;
  const inst = planoEnsino.instituicao;
  const isSecundario = inst?.tipoAcademico === 'SECUNDARIO' || (!!t?.classeId && inst?.tipoAcademico !== 'SUPERIOR');
  const labelCursoClasse = isSecundario ? 'Classe' : 'Curso';
  const valorCursoClasse = isSecundario ? (t?.classe?.nome ?? '-') : (t?.curso?.nome ?? '-');
  const turmaNome = planoEnsino.turma?.nome ?? '-';
  const disciplinaNome = planoEnsino.disciplina?.nome ?? '-';
  const profNome = professorNome || planoEnsino.professor?.user?.nomeCompleto || '-';
  const nif = planoEnsino.instituicao?.configuracao?.nif ?? '';
  const dataEmissao = new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const codigoVerificacao = crypto.randomBytes(4).toString('hex').toUpperCase();

  const tipoAcademico = (inst?.tipoAcademico ?? null) as 'SUPERIOR' | 'SECUNDARIO' | null;
  const cursoId = t?.cursoId ?? null;

  // Se existir modelo importado do governo (MINI_PAUTA), usar o template HTML e preencher com dados reais
  const { getModeloDocumentoAtivo } = await import('./modeloDocumento.service.js');
  const modeloCustom = await getModeloDocumentoAtivo({
    instituicaoId,
    tipo: 'MINI_PAUTA',
    tipoAcademico: tipoAcademico ?? undefined,
    cursoId,
  });

  const varsPautaReais = {
    consolidacao,
    instituicaoNome: planoEnsino.instituicao?.nome ?? 'Instituição',
    logoUrl: planoEnsino.instituicao?.logoUrl,
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
  };

  if (modeloCustom?.htmlTemplate?.trim()) {
    try {
      const { montarVarsPauta } = await import('./pautaTemplate.service.js');
      const { preencherTemplateHtmlGenerico } = await import('./documentoTemplateGeneric.service.js');
      const { gerarPDFCertificadoSuperior } = await import('./certificadoSuperior.service.js');
      const vars = montarVarsPauta(varsPautaReais);
      const html = preencherTemplateHtmlGenerico(modeloCustom.htmlTemplate, vars);
      const landscape = (modeloCustom as { orientacaoPagina?: string | null }).orientacaoPagina === 'PAISAGEM';
      const pdf = await gerarPDFCertificadoSuperior(html, { landscape });
      if (pdf) return pdf;
    } catch (err) {
      console.error('[pautaPrint] Erro ao usar modelo HTML importado, fallback para padrão:', err);
    }
  } else if (modeloCustom?.excelTemplateBase64?.trim()) {
    try {
      const { montarVarsPauta } = await import('./pautaTemplate.service.js');
      const { fillExcelTemplate } = await import('./excelTemplate.service.js');
      const { excelBufferToPdf } = await import('./excelToPdf.service.js');
      const vars = montarVarsPauta(varsPautaReais);
      const excelBuffer = fillExcelTemplate(modeloCustom.excelTemplateBase64, vars);
      const landscape = (modeloCustom as { orientacaoPagina?: string | null }).orientacaoPagina === 'PAISAGEM';
      const pdf = await excelBufferToPdf(excelBuffer, { landscape });
      if (pdf) return pdf;
    } catch (err) {
      console.error('[pautaPrint] Erro ao usar modelo Excel importado, fallback para padrão:', err);
    }
  }

  let logoBuf: Buffer | null = null;
  if (planoEnsino.instituicao?.logoUrl) {
    try {
      const axios = (await import('axios')).default;
      const imgRes = await axios.get(planoEnsino.instituicao.logoUrl, { responseType: 'arraybuffer' });
      logoBuf = Buffer.from(imgRes.data);
    } catch {
      /* ignorar */
    }
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    if (logoBuf) {
      doc.image(logoBuf, 50, 50, { width: 36, height: 36 });
    }
    doc.fontSize(18).font('Helvetica-Bold').text(planoEnsino.instituicao?.nome ?? 'Instituição', { align: 'center' });
    if (nif) doc.fontSize(10).font('Helvetica').text(`NIF: ${nif}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).font('Helvetica-Bold').text(`PAUTA - ${tipoPauta === 'DEFINITIVA' ? 'DEFINITIVA' : 'PROVISÓRIA'}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica');
    doc.text(`Ano Letivo: ${anoLetivo}`);
    doc.text(`${labelCursoClasse}: ${valorCursoClasse}`);
    doc.text(`Turma: ${turmaNome}`);
    doc.text(`Disciplina: ${disciplinaNome}`);
    doc.text(`Professor: ${profNome}`);
    doc.text(`Data de emissão: ${dataEmissao}`);
    doc.text(`Código de verificação: ${codigoVerificacao}`);
    doc.moveDown(2);

    const colW = { num: 20, numProc: 50, nome: 110, aval: 90, exame: 42, media: 42, resultado: 65 };
    const startX = 50;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Nº', startX, doc.y);
    doc.text('Nº Proc.', startX + colW.num, doc.y);
    doc.text('Nome', startX + colW.num + colW.numProc, doc.y);
    doc.text('Avaliações', startX + colW.num + colW.numProc + colW.nome, doc.y);
    doc.text('Exame', startX + colW.num + colW.numProc + colW.nome + colW.aval, doc.y);
    doc.text('Média', startX + colW.num + colW.numProc + colW.nome + colW.aval + colW.exame, doc.y);
    doc.text('Resultado', startX + colW.num + colW.numProc + colW.nome + colW.aval + colW.exame + colW.media, doc.y);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(9);
    consolidacao.alunos.forEach((a, i) => {
      if (doc.y > 720) {
        doc.addPage();
        doc.y = 50;
      }
      const numProc = (a.numeroIdentificacaoPublica ?? '-').toString().slice(0, 10);
      const avalStr = (a.notas as any)?.notasPorAvaliacao
        ? (a.notas as any).notasPorAvaliacao.map((n: any) => n.nota != null ? Number(n.nota).toFixed(1) : '-').join(' | ')
        : '-';
      const exameVal = (a.notas as any)?.detalhes?.notas_utilizadas?.find((n: any) =>
        String(n.tipo ?? '').toLowerCase().includes('exame') || String(n.tipo ?? '').toLowerCase().includes('recurso')
      );
      const exameStr = exameVal != null ? Number(exameVal.valor).toFixed(1) : '-';
      const mediaStr = (a.notas as any)?.mediaFinal != null ? Number((a.notas as any).mediaFinal).toFixed(1) : '-';
      const resultado = a.situacaoAcademica === 'APROVADO' ? 'Aprovado' : a.situacaoAcademica === 'REPROVADO' ? 'Reprovado' : a.situacaoAcademica === 'REPROVADO_FALTA' ? 'Rep. Falta' : 'Em curso';
      const isNegativo = ['REPROVADO', 'REPROVADO_FALTA'].includes(a.situacaoAcademica ?? '');

      doc.text(String(i + 1), startX, doc.y);
      doc.text(numProc, startX + colW.num, doc.y, { width: colW.numProc });
      doc.text((a.nomeCompleto ?? '').slice(0, 22), startX + colW.num + colW.numProc, doc.y, { width: colW.nome });
      doc.text((avalStr ?? '-').slice(0, 16), startX + colW.num + colW.numProc + colW.nome, doc.y, { width: colW.aval });
      doc.text(exameStr, startX + colW.num + colW.numProc + colW.nome + colW.aval, doc.y);
      doc.text(mediaStr, startX + colW.num + colW.numProc + colW.nome + colW.aval + colW.exame, doc.y);
      if (isNegativo) {
        doc.fillColor('red').font('Helvetica-Bold');
      }
      doc.text(resultado, startX + colW.num + colW.numProc + colW.nome + colW.aval + colW.exame + colW.media, doc.y);
      if (isNegativo) {
        doc.fillColor('black').font('Helvetica');
      }
      doc.moveDown(0.4);
    });

    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica-Bold').text(`Total de estudantes: ${consolidacao.alunos.length}`, { align: 'right' });
    doc.moveDown(2);

    doc.fontSize(9).font('Helvetica');
    doc.text('_________________________________', 50, doc.y);
    doc.text('Assinatura do Professor', 50, doc.y + 15);
    doc.moveDown(2);
    doc.text('_________________________________', 50, doc.y);
    doc.text('Assinatura da Secretaria', 50, doc.y + 15);
    doc.moveDown(2);

    doc.fontSize(8).text(`Documento gerado em ${new Date().toLocaleString('pt-AO')} - Código: ${codigoVerificacao}`, { align: 'center' });

    doc.end();
  });

  return Buffer.concat(chunks);
}

/** Dados fictícios para pré-visualização da pauta (multi-tenant, respeita tipoAcademico) */
interface AlunoPreviewItem {
  alunoId: string;
  nomeCompleto: string;
  numeroIdentificacaoPublica: string;
  frequencia: unknown;
  notas: unknown;
  situacaoAcademica: 'APROVADO' | 'REPROVADO' | 'REPROVADO_FALTA' | string;
}
const ALUNOS_PREVIEW: AlunoPreviewItem[] = [
  { alunoId: 'preview-1', nomeCompleto: 'Maria João Silva', numeroIdentificacaoPublica: '2024001', frequencia: {} as any, notas: { notasPorAvaliacao: [{ nota: 14 }], mediaFinal: 14, detalhes: { notas_utilizadas: [{ tipo: 'Exame', valor: 15 }] } }, situacaoAcademica: 'APROVADO' as const },
  { alunoId: 'preview-2', nomeCompleto: 'José Carlos Santos', numeroIdentificacaoPublica: '2024002', frequencia: {} as any, notas: { notasPorAvaliacao: [{ nota: 12 }, { nota: 13 }], mediaFinal: 12.5, detalhes: { notas_utilizadas: [{ tipo: 'Exame', valor: 12 }] } }, situacaoAcademica: 'APROVADO' as const },
  { alunoId: 'preview-3', nomeCompleto: 'Ana Paula Ferreira', numeroIdentificacaoPublica: '2024003', frequencia: {} as any, notas: { notasPorAvaliacao: [{ nota: 8 }], mediaFinal: 9, detalhes: { notas_utilizadas: [{ tipo: 'Exame', valor: 10 }] } }, situacaoAcademica: 'REPROVADO' as const },
  { alunoId: 'preview-4', nomeCompleto: 'Pedro Manuel Costa', numeroIdentificacaoPublica: '2024004', frequencia: {} as any, notas: { notasPorAvaliacao: [{ nota: 16 }, { nota: 15 }], mediaFinal: 15.5, detalhes: { notas_utilizadas: [{ tipo: 'Exame', valor: 16 }] } }, situacaoAcademica: 'APROVADO' as const },
  { alunoId: 'preview-5', nomeCompleto: 'Luísa Maria Oliveira', numeroIdentificacaoPublica: '2024005', frequencia: {} as any, notas: { notasPorAvaliacao: [{ nota: 10 }], mediaFinal: 11, detalhes: { notas_utilizadas: [{ tipo: 'Recurso', valor: 12 }] } }, situacaoAcademica: 'APROVADO' as const },
];

const CONSOLIDACAO_PREVIEW = {
  planoEnsinoId: 'preview',
  disciplina: { id: 'preview', nome: 'Matemática', cargaHoraria: 60 },
  totalAulasPlanejadas: 60,
  totalAulasMinistradas: 55,
  alunos: ALUNOS_PREVIEW,
} as any;

export type PautaPreviewResult = { formato: 'PDF'; buffer: Buffer } | { formato: 'EXCEL'; buffer: Buffer };

/**
 * Gera pré-visualização da mini pauta (dados fictícios).
 * Quando o modelo é Excel, retorna Excel; quando HTML ou padrão, retorna PDF.
 * Multi-tenant: instituicaoId do JWT. Respeita tipoAcademico (SUPERIOR/SECUNDARIO).
 */
export async function gerarPDFPautaPreview(
  instituicaoId: string,
  tipoPauta: TipoPauta,
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null
): Promise<PautaPreviewResult> {
  const instituicao = await prisma.instituicao.findFirst({
    where: { id: instituicaoId },
    select: { nome: true, logoUrl: true, tipoAcademico: true, configuracao: { select: { nif: true } } },
  });

  if (!instituicao) {
    throw new AppError('Instituição não encontrada', 404);
  }

  const effTipo = tipoAcademico ?? instituicao.tipoAcademico ?? 'SUPERIOR';
  const isSecundario = effTipo === 'SECUNDARIO';
  const labelCursoClasse = isSecundario ? 'Classe' : 'Curso';
  const valorCursoClasse = isSecundario ? '12ª Classe' : 'Licenciatura em Informática';
  const turmaNome = 'Turma A';
  const disciplinaNome = 'Matemática';
  const profNome = 'Prof. Exemplo';
  const anoLetivo = new Date().getFullYear().toString();
  const nif = instituicao.configuracao?.nif ?? '';
  const dataEmissao = new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const codigoVerificacao = 'PREVIEW';

  // Se existir modelo importado (MINI_PAUTA), usar no preview
  const { getModeloDocumentoAtivo } = await import('./modeloDocumento.service.js');
  const modeloCustom = await getModeloDocumentoAtivo({
    instituicaoId,
    tipo: 'MINI_PAUTA',
    tipoAcademico: effTipo,
    cursoId: null,
  });
  const consolidacaoPreview = {
    alunos: ALUNOS_PREVIEW.map((a, i) => ({
      alunoId: `preview-${i}`,
      nomeCompleto: a.nomeCompleto,
      numeroIdentificacaoPublica: a.numeroIdentificacaoPublica,
      frequencia: { totalAulas: 0, presencas: 0, faltas: 0, faltasJustificadas: 0, percentualFrequencia: 0, situacao: 'REGULAR' as const },
      notas: a.notas,
      situacaoAcademica: a.situacaoAcademica,
    })),
  } as unknown as import('./frequencia.service.js').ConsolidacaoPlanoEnsino;

  const varsPauta = {
    consolidacao: consolidacaoPreview,
    instituicaoNome: instituicao.nome ?? 'Instituição',
    logoUrl: instituicao.logoUrl,
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
  };

  if (modeloCustom?.htmlTemplate?.trim()) {
    try {
      const { montarVarsPauta } = await import('./pautaTemplate.service.js');
      const { preencherTemplateHtmlGenerico } = await import('./documentoTemplateGeneric.service.js');
      const { gerarPDFCertificadoSuperior } = await import('./certificadoSuperior.service.js');
      const vars = montarVarsPauta(varsPauta);
      const html = preencherTemplateHtmlGenerico(modeloCustom.htmlTemplate, vars);
      const landscape = (modeloCustom as { orientacaoPagina?: string | null }).orientacaoPagina === 'PAISAGEM';
      const pdf = await gerarPDFCertificadoSuperior(html, { landscape });
      if (pdf) return { formato: 'PDF', buffer: pdf };
    } catch (err) {
      console.error('[pautaPrint] Preview com modelo HTML importado falhou:', err);
      throw new AppError('Erro ao gerar preview do modelo importado.', 500);
    }
  } else if (modeloCustom?.excelTemplateBase64?.trim()) {
    try {
      const { montarVarsPauta } = await import('./pautaTemplate.service.js');
      const { fillExcelTemplate } = await import('./excelTemplate.service.js');
      const { excelBufferToPdf } = await import('./excelToPdf.service.js');
      const vars = montarVarsPauta(varsPauta);
      const excelBuffer = fillExcelTemplate(modeloCustom.excelTemplateBase64, vars);
      const landscape = (modeloCustom as { orientacaoPagina?: string | null }).orientacaoPagina === 'PAISAGEM';
      const pdf = await excelBufferToPdf(excelBuffer, { landscape });
      if (pdf) return { formato: 'PDF' as const, buffer: pdf };
      return { formato: 'EXCEL' as const, buffer: excelBuffer };
    } catch (err) {
      console.error('[pautaPrint] Preview com modelo Excel importado falhou:', err);
      throw new AppError('Erro ao gerar preview do modelo importado.', 500);
    }
  }

  // Sem modelo importado: não gerar preview fictício
  throw new AppError(
    'Nenhum modelo importado para Mini Pauta. Importe um em Configurações > Modelos de Documentos para visualizar.',
    404
  );
}
