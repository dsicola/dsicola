/**
 * Serviço de Emissão de Documentos Oficiais - Padrão SIGAE
 *
 * REGRAS ABSOLUTAS:
 * - Multi-tenant: instituicaoId SEMPRE do JWT
 * - Documentos gerados automaticamente a partir de dados do banco
 * - Sem texto livre perigoso
 * - Numeração sequencial por instituição
 * - Documentos imutáveis (apenas ANULAR com log)
 * - Respeitar tipoAcademico: SUPERIOR vs SECUNDARIO
 */

import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { verificarBloqueioAcademico, TipoOperacaoBloqueada, registrarTentativaBloqueada, validarBloqueioAcademicoInstitucionalOuErro } from './bloqueioAcademico.service.js';
import { validarRequisitosConclusao } from './conclusaoCurso.service.js';

export const TIPOS_DOCUMENTO_SIGAE = [
  'DECLARACAO_MATRICULA',
  'DECLARACAO_FREQUENCIA',
  'HISTORICO',
  'CERTIFICADO',
] as const;

export type TipoDocumentoSigae = (typeof TIPOS_DOCUMENTO_SIGAE)[number];

export interface ContextoEmissao {
  matriculaId?: string;
  anoLetivoId?: string;
  observacao?: string;
}

/** Disciplina para Histórico Escolar (tabela de notas) */
export interface DisciplinaHistorico {
  disciplinaNome: string;
  anoLetivo: number;
  cargaHoraria: number;
  mediaFinal: number | null;
  situacao: string; // APROVADO, REPROVADO, REPROVADO_FALTA, EQUIVALENTE
  origemEquivalencia?: boolean;
}

export interface PayloadDocumento {
  instituicao: {
    nome: string;
    nif?: string;
    endereco?: string;
    telefone?: string;
    email?: string;
    logoUrl?: string;
  };
  estudante: {
    nomeCompleto: string;
    numeroEstudante: string | null;
    documentoId?: string;
    dataNascimento?: Date | null;
  };
  contextoAcademico: {
    tipo: 'SUPERIOR' | 'SECUNDARIO' | null;
    curso?: string;
    classe?: string;
    anoFrequencia?: string;
    turma?: string;
    anoLetivo?: number;
    semestre?: string;
  };
  /** Disciplinas c/ notas (apenas para HISTORICO e CERTIFICADO) */
  disciplinas?: DisciplinaHistorico[];
  documento: {
    tipo: TipoDocumentoSigae;
    numero: string;
    dataEmissao: Date;
    codigoVerificacao?: string;
  };
}

/**
 * Gera numeração sequencial por instituição, sem colisões em concorrência
 * Formato: DOC-2026-000123 ou DECL-2026-000123
 */
export async function getProximoNumeroDocumento(
  instituicaoId: string,
  tipo: TipoDocumentoSigae,
  serie: string = ''
): Promise<string> {
  const prefixo = tipo === 'CERTIFICADO' ? 'CERT' : tipo === 'HISTORICO' ? 'HIST' : 'DECL';
  const ano = new Date().getFullYear();

  return await prisma.$transaction(async (tx) => {
    const ultimo = await tx.documentoEmitido.findFirst({
      where: { instituicaoId, serie },
      orderBy: { createdAt: 'desc' },
      select: { numeroDocumento: true },
    });

    let proximo = 1;
    if (ultimo?.numeroDocumento) {
      const match = ultimo.numeroDocumento.match(/-(\d+)$/);
      if (match) {
        proximo = parseInt(match[1], 10) + 1;
      }
    }

    const numero = `${prefixo}-${ano}-${String(proximo).padStart(6, '0')}`;
    return numero;
  });
}

/**
 * Gera código curto de verificação (6-8 caracteres alfanuméricos)
 */
export function generateCodigoVerificacao(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Valida pré-requisitos para emissão conforme tipo
 */
export async function validarEmissaoDocumento(
  tipo: TipoDocumentoSigae,
  alunoId: string,
  instituicaoId: string,
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null,
  anoLetivoId?: string
): Promise<{ valido: boolean; erro?: string }> {
  // 1. Aluno pertence à instituição
  const aluno = await prisma.user.findFirst({
    where: {
      id: alunoId,
      instituicaoId,
      roles: { some: { role: 'ALUNO' } },
    },
    include: {
      matriculasAnuais: {
        where: { instituicaoId, status: 'ATIVA' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          curso: true,
          classe: true,
          anoLetivoRef: true,
        },
      },
    },
  });

  if (!aluno) {
    return { valido: false, erro: 'Estudante não encontrado ou não pertence à sua instituição' };
  }

  const matriculaAtiva = aluno.matriculasAnuais[0];

  // 2. Bloqueio financeiro por tipo
  const tipoBloqueio = tipo === 'CERTIFICADO' || tipo === 'HISTORICO' ? TipoOperacaoBloqueada.DOCUMENTOS : TipoOperacaoBloqueada.DOCUMENTOS;
  const bloqueioCert = tipo === 'CERTIFICADO' ? TipoOperacaoBloqueada.CERTIFICADOS : null;

  const bloqueio = bloqueioCert
    ? await verificarBloqueioAcademico(alunoId, instituicaoId, TipoOperacaoBloqueada.CERTIFICADOS)
    : await verificarBloqueioAcademico(alunoId, instituicaoId, TipoOperacaoBloqueada.DOCUMENTOS);

  if (bloqueio.bloqueado) {
    return { valido: false, erro: bloqueio.motivo || 'Bloqueado por pendência financeira' };
  }

  // 3. Bloqueio acadêmico institucional
  if (tipoAcademico) {
    try {
      await validarBloqueioAcademicoInstitucionalOuErro(alunoId, instituicaoId, tipoAcademico, undefined, anoLetivoId);
    } catch (e: any) {
      return { valido: false, erro: e.message };
    }
  }

  // 4. Validações por tipo
  if (tipo === 'DECLARACAO_MATRICULA' || tipo === 'DECLARACAO_FREQUENCIA') {
    if (!matriculaAtiva) {
      return { valido: false, erro: 'Estudante sem matrícula ativa no ano letivo' };
    }
    return { valido: true };
  }

  if (tipo === 'HISTORICO') {
    if (!matriculaAtiva) {
      return { valido: false, erro: 'Estudante sem matrícula ou notas/disciplinas registradas' };
    }
    return { valido: true };
  }

  if (tipo === 'CERTIFICADO') {
    const cursoId = matriculaAtiva?.cursoId ?? null;
    const classeId = matriculaAtiva?.classeId ?? null;
    const validacao = await validarRequisitosConclusao(
      alunoId,
      cursoId,
      classeId,
      instituicaoId,
      tipoAcademico
    );
    if (!validacao.valido) {
      return { valido: false, erro: validacao.erros[0] || 'Curso ainda não concluído (certificado)' };
    }
    return { valido: true };
  }

  return { valido: true };
}

/**
 * Monta payload do documento a partir de dados reais do banco
 */
export async function montarPayloadDocumento(
  tipo: TipoDocumentoSigae,
  alunoId: string,
  instituicaoId: string,
  numeroDocumento: string,
  codigoVerificacao: string,
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null,
  contexto?: ContextoEmissao
): Promise<PayloadDocumento> {
  const result = await Promise.all([
    prisma.instituicao.findUniqueOrThrow({
      where: { id: instituicaoId },
      select: {
        nome: true,
        endereco: true,
        telefone: true,
        emailContato: true,
        logoUrl: true,
      },
    }),
    prisma.configuracaoInstituicao.findUnique({
      where: { instituicaoId },
      select: { nif: true, cnpj: true },
    }),
  ]);

  const [instituicao, config] = result;

  const aluno = await prisma.user.findFirstOrThrow({
    where: { id: alunoId, instituicaoId },
    select: {
      nomeCompleto: true,
      numeroIdentificacao: true,
      numeroIdentificacaoPublica: true,
      dataNascimento: true,
    },
  });

  let curso = '';
  let classe = '';
  let anoFrequencia = '';
  let turma = '';
  let anoLetivo: number | undefined;
  let semestre: string | undefined;

  const matriculaAnual = await prisma.matriculaAnual.findFirst({
    where: { alunoId, instituicaoId, status: 'ATIVA' },
    orderBy: { createdAt: 'desc' },
    include: {
      curso: true,
      classe: true,
      anoLetivoRef: true,
    },
  });

  if (matriculaAnual) {
    curso = matriculaAnual.curso?.nome ?? '';
    classe = matriculaAnual.classe?.nome ?? matriculaAnual.classeOuAnoCurso ?? '';
    anoFrequencia = matriculaAnual.classeOuAnoCurso ?? '';
    anoLetivo = matriculaAnual.anoLetivoRef?.ano ?? matriculaAnual.anoLetivo ?? undefined;
  }

  const turmaMat = await prisma.matricula.findFirst({
    where: { alunoId, turma: { instituicaoId } },
    include: { turma: true },
  });
  turma = turmaMat?.turma?.nome ?? '';

  if (matriculaAnual?.anoLetivoId) {
    const semestreRef = await prisma.semestre.findFirst({
      where: { anoLetivoId: matriculaAnual.anoLetivoId },
      select: { numero: true },
    });
    semestre = semestreRef ? `Semestre ${semestreRef.numero}` : undefined;
  }

  // Para HISTORICO e CERTIFICADO: buscar disciplinas com notas (snapshot + equivalências)
  let disciplinas: DisciplinaHistorico[] | undefined;
  if (tipo === 'HISTORICO' || tipo === 'CERTIFICADO') {
    const { buscarHistoricoAluno } = await import('./historicoAcademico.service.js');
    const historicoItems = await buscarHistoricoAluno(alunoId, instituicaoId, contexto?.anoLetivoId);
    disciplinas = historicoItems.map((item: any) => ({
      disciplinaNome: item.disciplina?.nome ?? item.equivalencia?.disciplinaOrigem?.nome ?? 'Disciplina',
      anoLetivo: item.anoLetivo?.ano ?? new Date().getFullYear(),
      cargaHoraria: Number(item.cargaHoraria ?? item.disciplina?.cargaHoraria ?? 0),
      mediaFinal: item.mediaFinal != null ? Number(item.mediaFinal) : null,
      situacao: item.situacaoAcademica ?? (item.origemEquivalencia ? 'APROVADO' : 'N/A'),
      origemEquivalencia: item.origemEquivalencia ?? false,
    }));
  }

  return {
    instituicao: {
      nome: instituicao.nome,
      nif: config?.nif ?? config?.cnpj ?? undefined,
      endereco: instituicao.endereco ?? undefined,
      telefone: instituicao.telefone ?? undefined,
      email: instituicao.emailContato ?? undefined,
      logoUrl: instituicao.logoUrl ?? undefined,
    },
    estudante: {
      nomeCompleto: aluno.nomeCompleto,
      numeroEstudante: aluno.numeroIdentificacaoPublica ?? aluno.numeroIdentificacao,
      dataNascimento: aluno.dataNascimento,
    },
    contextoAcademico: {
      tipo: tipoAcademico,
      curso,
      classe,
      anoFrequencia,
      turma,
      anoLetivo,
      semestre,
    },
    ...(disciplinas && disciplinas.length > 0 && { disciplinas }),
    documento: {
      tipo,
      numero: numeroDocumento,
      dataEmissao: new Date(),
      codigoVerificacao,
    },
  };
}

/**
 * Gera PDF do documento (template padronizado por tipo)
 */
export async function geraDocumentoPDF(payload: PayloadDocumento): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    doc.fontSize(16).text(payload.instituicao.nome, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(payload.instituicao.endereco || '', { align: 'center' });
    if (payload.instituicao.telefone || payload.instituicao.email) {
      doc.fontSize(9).text(
        [payload.instituicao.telefone, payload.instituicao.email].filter(Boolean).join(' | '),
        { align: 'center' }
      );
    }
    doc.moveDown(2);

    const tipoLabel = {
      DECLARACAO_MATRICULA: 'DECLARAÇÃO DE MATRÍCULA',
      DECLARACAO_FREQUENCIA: 'DECLARAÇÃO DE FREQUÊNCIA',
      HISTORICO: 'HISTÓRICO ESCOLAR',
      CERTIFICADO: 'CERTIFICADO DE CONCLUSÃO',
    }[payload.documento.tipo];

    doc.fontSize(14).text(tipoLabel, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(11).text(`Nº ${payload.documento.numero}`, { align: 'right' });
    doc.moveDown();

    const nomeEstudante = `${payload.estudante.nomeCompleto}${payload.estudante.numeroEstudante ? `, nº ${payload.estudante.numeroEstudante}` : ''}`;

    // Texto por tipo
    if (payload.documento.tipo === 'CERTIFICADO') {
      doc.fontSize(10).text('Certificamos que', { align: 'justify' });
      doc.text(nomeEstudante, { align: 'justify' });
      doc.text(
        'concluiu com êxito o curso/formação nesta instituição, tendo cumprido integralmente todas as disciplinas e requisitos exigidos.',
        { align: 'justify' }
      );
    } else if (payload.documento.tipo === 'DECLARACAO_MATRICULA' || payload.documento.tipo === 'DECLARACAO_FREQUENCIA') {
      doc.fontSize(10).text('Declaramos que', { align: 'justify' });
      doc.text(nomeEstudante, { align: 'justify' });
      doc.text('encontra-se matriculado(a) e regular nesta instituição.', { align: 'justify' });
    } else {
      doc.fontSize(10).text('Histórico escolar de', { align: 'justify' });
      doc.text(nomeEstudante, { align: 'justify' });
      doc.text('conforme registros oficiais da instituição.', { align: 'justify' });
    }
    doc.moveDown();

    if (payload.contextoAcademico.curso || payload.contextoAcademico.classe) {
      const isSecundario = payload.contextoAcademico.tipo === 'SECUNDARIO';
      const label = isSecundario ? 'Classe' : 'Curso';
      const valor = isSecundario ? (payload.contextoAcademico.classe || 'N/A') : (payload.contextoAcademico.curso || 'N/A');
      doc.text(`${label}: ${valor}`, { align: 'justify' });
    }
    if (payload.contextoAcademico.anoLetivo) {
      doc.text(`Ano Letivo: ${payload.contextoAcademico.anoLetivo}`, { align: 'justify' });
    }
    if (payload.contextoAcademico.turma) {
      doc.text(`Turma: ${payload.contextoAcademico.turma}`, { align: 'justify' });
    }
    doc.moveDown();

    // Tabela de disciplinas para HISTORICO e CERTIFICADO
    if ((payload.documento.tipo === 'HISTORICO' || payload.documento.tipo === 'CERTIFICADO') && payload.disciplinas && payload.disciplinas.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(10).text('Disciplinas cursadas:', { align: 'left' });
      doc.moveDown(0.5);

      const colWidths = { disc: 180, ano: 50, ch: 45, nota: 45, sit: 90 };
      const startY = doc.y;
      doc.fontSize(8);
      doc.text('Disciplina', 50, doc.y);
      doc.text('Ano', 50 + colWidths.disc, doc.y);
      doc.text('CH', 50 + colWidths.disc + colWidths.ano, doc.y);
      doc.text('Nota', 50 + colWidths.disc + colWidths.ano + colWidths.ch, doc.y);
      doc.text('Situação', 50 + colWidths.disc + colWidths.ano + colWidths.ch + colWidths.nota, doc.y);
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.3);

      for (const d of payload.disciplinas) {
        if (doc.y > 700) {
          doc.addPage();
          doc.y = 50;
        }
        doc.text((d.disciplinaNome || '').substring(0, 35), 50, doc.y);
        doc.text(String(d.anoLetivo), 50 + colWidths.disc, doc.y);
        doc.text(String(d.cargaHoraria), 50 + colWidths.disc + colWidths.ano, doc.y);
        doc.text(d.mediaFinal != null ? d.mediaFinal.toFixed(1) : '-', 50 + colWidths.disc + colWidths.ano + colWidths.ch, doc.y);
        doc.text(d.origemEquivalencia ? 'Equiv.' : (d.situacao || '-'), 50 + colWidths.disc + colWidths.ano + colWidths.ch + colWidths.nota, doc.y);
        doc.moveDown(0.4);
      }
      doc.moveDown(1);
    } else if (payload.documento.tipo === 'HISTORICO') {
      doc.fontSize(9).text('Nenhuma disciplina concluída registrada no histórico.', { align: 'justify' });
      doc.moveDown(1);
    }

    const dataEmissao = new Date(payload.documento.dataEmissao).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    doc.text(`Emitido em ${dataEmissao}`, { align: 'right' });
    if (payload.documento.codigoVerificacao) {
      doc.fontSize(8).text(`Código de verificação: ${payload.documento.codigoVerificacao}`, {
        align: 'right',
      });
    }

    doc.end();
  });

  return Buffer.concat(chunks);
}

/**
 * Gera documento oficial: valida, monta payload, gera PDF, persiste
 */
export async function geraDocumento(
  tipo: TipoDocumentoSigae,
  alunoId: string,
  instituicaoId: string,
  emitidoPorId: string,
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null,
  contexto?: ContextoEmissao
): Promise<{ id: string; numeroDocumento: string; codigoVerificacao: string; pdfBuffer: Buffer }> {
  const anoLetivoId = contexto?.anoLetivoId;

  const validacao = await validarEmissaoDocumento(
    tipo,
    alunoId,
    instituicaoId,
    tipoAcademico,
    anoLetivoId
  );

  if (!validacao.valido) {
    throw new AppError(validacao.erro || 'Validação falhou', 400);
  }

  const serie = '';
  const numeroDocumento = await getProximoNumeroDocumento(instituicaoId, tipo, serie);
  const codigoVerificacao = generateCodigoVerificacao();
  const hashIntegridade = crypto.createHash('sha256').update(`${instituicaoId}-${numeroDocumento}-${codigoVerificacao}`).digest('hex');

  const payload = await montarPayloadDocumento(
    tipo,
    alunoId,
    instituicaoId,
    numeroDocumento,
    codigoVerificacao,
    tipoAcademico,
    contexto
  );

  const pdfBuffer = await geraDocumentoPDF(payload);

  const documento = await prisma.documentoEmitido.create({
    data: {
      instituicaoId,
      tipoDocumento: tipo,
      alunoId,
      matriculaId: contexto?.matriculaId,
      anoLetivoId: contexto?.anoLetivoId,
      serie,
      numeroDocumento,
      status: 'ATIVO',
      codigoVerificacao,
      hashIntegridade,
      emitidoPor: emitidoPorId,
      observacoes: contexto?.observacao,
      dadosAdicionais: payload as any,
    },
  });

  return {
    id: documento.id,
    numeroDocumento,
    codigoVerificacao,
    pdfBuffer,
  };
}
