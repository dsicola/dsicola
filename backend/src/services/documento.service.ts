/**
 * Serviço de Emissão de Documentos Oficiais
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
import { AuditService } from './audit.service.js';
import { ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from './audit.service.js';

export const TIPOS_DOCUMENTO_OFICIAIS = [
  'DECLARACAO_MATRICULA',
  'DECLARACAO_FREQUENCIA',
  'HISTORICO',
  'CERTIFICADO',
] as const;

export type TipoDocumentoOficial = (typeof TIPOS_DOCUMENTO_OFICIAIS)[number];

export interface ContextoEmissao {
  matriculaId?: string;
  anoLetivoId?: string;
  observacao?: string;
}

function formatarDataCurta(d: Date): string {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[d.getMonth()]}/${d.getFullYear()}`;
}

/** Obtém valor por caminho (ex: student.fullName). Usado com payloadToTemplateData + templateMappings. */
function getValueByPathForTemplate(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[p];
  }
  if (current == null || current === undefined) return '';
  return String(current);
}

/** Disciplina para Histórico Escolar (tabela de notas) */
export interface DisciplinaHistorico {
  /** Para agrupar linhas no PDF (secundário) */
  disciplinaId?: string;
  disciplinaNome: string;
  anoLetivo: number;
  cargaHoraria: number;
  mediaFinal: number | null;
  situacao: string; // APROVADO, REPROVADO, REPROVADO_FALTA, EQUIVALENTE
  origemEquivalencia?: boolean;
  /** Ensino secundário: ex. 10, 11, 12 — permite grelha 10ª/11ª/12ª no histórico final */
  classeOrdem?: number | null;
}

export interface PayloadDocumento {
  instituicao: {
    nome: string;
    nif?: string;
    endereco?: string;
    telefone?: string;
    email?: string;
    logoUrl?: string;
    imagemFundoDocumentoUrl?: string;
    /** Certificado Superior (Angola) */
    ministerioSuperior?: string;
    decretoCriacao?: string;
    nomeChefeDaa?: string;
    nomeDirectorGeral?: string;
    localidadeCertificado?: string;
    cargoAssinatura1?: string;
    cargoAssinatura2?: string;
    textoFechoCertificado?: string;
    textoRodapeCertificado?: string;
    biComplementarCertificado?: string;
    labelMediaFinalCertificado?: string;
    labelValoresCertificado?: string;
    /** Certificado Ensino Secundário (Angola - II Ciclo) */
    republicaAngola?: string;
    governoProvincia?: string;
    escolaNomeNumero?: string;
    ensinoGeral?: string;
    tituloCertificadoSecundario?: string;
    textoFechoCertificadoSecundario?: string;
    cargoAssinatura1Secundario?: string;
    cargoAssinatura2Secundario?: string;
    nomeAssinatura1Secundario?: string;
    nomeAssinatura2Secundario?: string;
    labelResultadoFinalSecundario?: string;
  };
  estudante: {
    nomeCompleto: string;
    numeroEstudante: string | null;
    documentoId?: string;
    /** B.I. / número de identificação (para certificado ensino superior) */
    bi?: string | null;
    dataNascimento?: Date | null;
    /** Filiação (certificados Angola) */
    nomePai?: string | null;
    nomeMae?: string | null;
    /** Local de nascimento (cidade, município, província) */
    localNascimento?: string | null;
    /** Filiação formatada (ex.: filho(a) de X e de Y) */
    filiacao?: string | null;
    email?: string | null;
    telefone?: string | null;
    endereco?: string | null;
  };
  contextoAcademico: {
    tipo: 'SUPERIOR' | 'SECUNDARIO' | null;
    cursoId?: string | null;
    curso?: string;
    classe?: string;
    anoFrequencia?: string;
    turma?: string;
    anoLetivo?: number;
    semestre?: string;
    /** Opção do curso (ex.: Geografia) */
    opcaoCurso?: string;
    /** Licenciatura: nota TFC e Defesa */
    notaTfc?: number | null;
    notaDefesa?: number | null;
    dataTfc?: string | null;
    dataDefesa?: string | null;
  };
  /** Disciplinas c/ notas (apenas para HISTORICO e CERTIFICADO) */
  disciplinas?: DisciplinaHistorico[];
  documento: {
    tipo: TipoDocumentoOficial;
    numero: string;
    dataEmissao: Date;
    codigoVerificacao?: string;
  };
}

/**
 * Gera numeração sequencial por instituição, sem colisões em concorrência
 * Formato: DOC-2026-000123 ou DECL-2026-000123
 */
/**
 * Verifica se o aluno está em alguma turma do professor (PlanoEnsino + Matrícula ativa).
 * professorId = professores.id (não users.id).
 */
export async function alunoNaTurmaDoProfessor(
  professorId: string,
  alunoId: string,
  instituicaoId: string
): Promise<boolean> {
  const planos = await prisma.planoEnsino.findMany({
    where: { professorId, instituicaoId, turmaId: { not: null } },
    select: { turmaId: true },
  });
  const turmaIds = planos.map((p) => p.turmaId).filter((id): id is string => id != null);
  if (turmaIds.length === 0) return false;
  const matricula = await prisma.matricula.findFirst({
    where: {
      alunoId,
      turmaId: { in: turmaIds },
      status: 'Ativa',
    },
  });
  return !!matricula;
}

/**
 * Retorna IDs de alunos que estão em turmas do professor (para listagem filtrada).
 */
export async function getAlunoIdsDaTurmaDoProfessor(
  professorId: string,
  instituicaoId: string
): Promise<string[]> {
  const planos = await prisma.planoEnsino.findMany({
    where: { professorId, instituicaoId, turmaId: { not: null } },
    select: { turmaId: true },
  });
  const turmaIds = planos.map((p) => p.turmaId).filter((id): id is string => id != null);
  if (turmaIds.length === 0) return [];
  const matriculas = await prisma.matricula.findMany({
    where: { turmaId: { in: turmaIds }, status: 'Ativa' },
    select: { alunoId: true },
    distinct: ['alunoId'],
  });
  return matriculas.map((m) => m.alunoId);
}

export async function getProximoNumeroDocumento(
  instituicaoId: string,
  tipo: TipoDocumentoOficial,
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
  tipo: TipoDocumentoOficial,
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
    return { valido: false, erro: 'Estudante não encontrado ou não pertence à sua instituição. Verifique se o aluno está matriculado.' };
  }

  const matriculaAtiva = aluno.matriculasAnuais[0];

  // 2. Bloqueio financeiro por tipo
  const tipoBloqueio = tipo === 'CERTIFICADO' || tipo === 'HISTORICO' ? TipoOperacaoBloqueada.DOCUMENTOS : TipoOperacaoBloqueada.DOCUMENTOS;
  const bloqueioCert = tipo === 'CERTIFICADO' ? TipoOperacaoBloqueada.CERTIFICADOS : null;

  const bloqueio = bloqueioCert
    ? await verificarBloqueioAcademico(alunoId, instituicaoId, TipoOperacaoBloqueada.CERTIFICADOS)
    : await verificarBloqueioAcademico(alunoId, instituicaoId, TipoOperacaoBloqueada.DOCUMENTOS);

  if (bloqueio.bloqueado) {
    return { valido: false, erro: bloqueio.motivo || 'Emissão bloqueada: o aluno tem pendências financeiras. Regularize a situação antes de emitir o certificado.' };
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
      return { valido: false, erro: validacao.erros[0] || 'O aluno ainda não concluiu o curso/classe. O certificado só pode ser emitido após a conclusão oficial.' };
    }
    return { valido: true };
  }

  return { valido: true };
}

/** Dados de exemplo para pré-visualização (vêm do sistema em produção) */
const MOCK_ESTUDANTE = {
  nomeCompleto: 'João Paulo Viti Crijostomo',
  numeroEstudante: '2024-001234',
  bi: '005266958HO046',
  dataNascimento: new Date('1993-07-02'),
  nomePai: 'Estevão Kaiumbuca Crijostomo',
  nomeMae: 'Henriqueta Graça Viti',
  localNascimento: 'Huambo, Huambo',
  filiacao: 'filho(a) de Estevão Kaiumbuca Crijostomo e de Henriqueta Graça Viti',
};

const MOCK_DISCIPLINAS: DisciplinaHistorico[] = [
  { disciplinaNome: 'L. Portuguesa', anoLetivo: 2012, cargaHoraria: 0, mediaFinal: 15, situacao: 'APROVADO' },
  { disciplinaNome: 'L. Portuguesa', anoLetivo: 2013, cargaHoraria: 0, mediaFinal: 13, situacao: 'APROVADO' },
  { disciplinaNome: 'L. Portuguesa', anoLetivo: 2014, cargaHoraria: 0, mediaFinal: 13, situacao: 'APROVADO' },
  { disciplinaNome: 'Matemática', anoLetivo: 2012, cargaHoraria: 0, mediaFinal: 13, situacao: 'APROVADO' },
  { disciplinaNome: 'Matemática', anoLetivo: 2013, cargaHoraria: 0, mediaFinal: 13, situacao: 'APROVADO' },
  { disciplinaNome: 'Introdução ao Direito', anoLetivo: 2012, cargaHoraria: 0, mediaFinal: 16, situacao: 'APROVADO' },
  { disciplinaNome: 'Introdução ao Direito', anoLetivo: 2013, cargaHoraria: 0, mediaFinal: 13, situacao: 'APROVADO' },
  { disciplinaNome: 'Introdução ao Direito', anoLetivo: 2014, cargaHoraria: 0, mediaFinal: 12, situacao: 'APROVADO' },
  { disciplinaNome: 'Geografia', anoLetivo: 2012, cargaHoraria: 0, mediaFinal: 14, situacao: 'APROVADO' },
  { disciplinaNome: 'Geografia', anoLetivo: 2013, cargaHoraria: 0, mediaFinal: 14, situacao: 'APROVADO' },
  { disciplinaNome: 'Geografia', anoLetivo: 2014, cargaHoraria: 0, mediaFinal: 14, situacao: 'APROVADO' },
];

/**
 * Monta payload para pré-visualização com dados de exemplo (dados reais vêm do sistema)
 * Apenas informações institucionais são configuráveis; notas, ano, dados pessoais = sistema
 */
export async function montarPayloadPrevisualizacao(
  tipo: TipoDocumentoOficial,
  instituicaoId: string,
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO',
  configOverride?: Partial<PayloadDocumento['instituicao']>
): Promise<PayloadDocumento> {
  const [instituicao, config] = await Promise.all([
    prisma.instituicao.findUniqueOrThrow({
      where: { id: instituicaoId },
      select: { nome: true, endereco: true, telefone: true, emailContato: true, logoUrl: true },
    }),
    prisma.configuracaoInstituicao.findUnique({
      where: { instituicaoId },
      select: {
        logoUrl: true,
        imagemFundoDocumentoUrl: true,
        ministerioSuperior: true, decretoCriacao: true, nomeChefeDaa: true, nomeDirectorGeral: true,
        localidadeCertificado: true, cargoAssinatura1: true, cargoAssinatura2: true,
        textoFechoCertificado: true, textoRodapeCertificado: true, biComplementarCertificado: true,
        labelMediaFinalCertificado: true, labelValoresCertificado: true,
        republicaAngola: true, governoProvincia: true, escolaNomeNumero: true, ensinoGeral: true,
        tituloCertificadoSecundario: true, textoFechoCertificadoSecundario: true,
        cargoAssinatura1Secundario: true, cargoAssinatura2Secundario: true,
        nomeAssinatura1Secundario: true, nomeAssinatura2Secundario: true,
        labelResultadoFinalSecundario: true,
      },
    }),
  ]);

  const inst = { ...instituicao, ...config };
  const merged = configOverride ? { ...inst, ...configOverride } : inst;

  const instituicaoPayload: PayloadDocumento['instituicao'] = {
    nome: merged.nome || 'Instituição',
    endereco: merged.endereco ?? undefined,
    telefone: merged.telefone ?? undefined,
    email: merged.emailContato ?? undefined,
    logoUrl: merged.logoUrl ?? undefined,
    imagemFundoDocumentoUrl: (merged as any).imagemFundoDocumentoUrl ?? undefined,
    ministerioSuperior: merged.ministerioSuperior ?? undefined,
    decretoCriacao: merged.decretoCriacao ?? undefined,
    nomeChefeDaa: merged.nomeChefeDaa ?? undefined,
    nomeDirectorGeral: merged.nomeDirectorGeral ?? undefined,
    localidadeCertificado: merged.localidadeCertificado ?? undefined,
    cargoAssinatura1: merged.cargoAssinatura1 ?? undefined,
    cargoAssinatura2: merged.cargoAssinatura2 ?? undefined,
    textoFechoCertificado: merged.textoFechoCertificado ?? undefined,
    textoRodapeCertificado: merged.textoRodapeCertificado ?? undefined,
    biComplementarCertificado: merged.biComplementarCertificado ?? undefined,
    labelMediaFinalCertificado: merged.labelMediaFinalCertificado ?? undefined,
    labelValoresCertificado: merged.labelValoresCertificado ?? undefined,
    republicaAngola: merged.republicaAngola ?? undefined,
    governoProvincia: merged.governoProvincia ?? undefined,
    escolaNomeNumero: merged.escolaNomeNumero ?? undefined,
    ensinoGeral: merged.ensinoGeral ?? undefined,
    tituloCertificadoSecundario: merged.tituloCertificadoSecundario ?? undefined,
    textoFechoCertificadoSecundario: merged.textoFechoCertificadoSecundario ?? undefined,
    cargoAssinatura1Secundario: merged.cargoAssinatura1Secundario ?? undefined,
    cargoAssinatura2Secundario: merged.cargoAssinatura2Secundario ?? undefined,
    nomeAssinatura1Secundario: merged.nomeAssinatura1Secundario ?? undefined,
    nomeAssinatura2Secundario: merged.nomeAssinatura2Secundario ?? undefined,
    labelResultadoFinalSecundario: merged.labelResultadoFinalSecundario ?? undefined,
  };

  const anoLetivo = new Date().getFullYear();
  const cursoSuperior = 'Licenciatura em Direito';
  const classeSecundario = '12ª Classe';
  const opcaoCurso = tipoAcademico === 'SECUNDARIO' ? 'Ciências Económicas e Jurídicas' : 'Direito';

  return {
    instituicao: instituicaoPayload,
    estudante: MOCK_ESTUDANTE,
    contextoAcademico: {
      tipo: tipoAcademico,
      curso: tipoAcademico === 'SUPERIOR' ? cursoSuperior : undefined,
      classe: tipoAcademico === 'SECUNDARIO' ? classeSecundario : undefined,
      anoLetivo,
      opcaoCurso,
    },
    disciplinas: (tipo === 'CERTIFICADO' ? MOCK_DISCIPLINAS : undefined) as DisciplinaHistorico[] | undefined,
    documento: {
      tipo,
      numero: 'PREV-000001',
      dataEmissao: new Date(),
      codigoVerificacao: 'PREVIEW-XXXX',
    },
  };
}

/**
 * Monta payload do documento a partir de dados reais do banco
 */
export async function montarPayloadDocumento(
  tipo: TipoDocumentoOficial,
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
      select: {
        logoUrl: true,
        imagemFundoDocumentoUrl: true,
        nif: true,
        cnpj: true,
        ministerioSuperior: true,
        decretoCriacao: true,
        nomeChefeDaa: true,
        nomeDirectorGeral: true,
        localidadeCertificado: true,
        cargoAssinatura1: true,
        cargoAssinatura2: true,
        textoFechoCertificado: true,
        textoRodapeCertificado: true,
        biComplementarCertificado: true,
        labelMediaFinalCertificado: true,
        labelValoresCertificado: true,
        republicaAngola: true,
        governoProvincia: true,
        escolaNomeNumero: true,
        ensinoGeral: true,
        tituloCertificadoSecundario: true,
        textoFechoCertificadoSecundario: true,
        cargoAssinatura1Secundario: true,
        cargoAssinatura2Secundario: true,
        nomeAssinatura1Secundario: true,
        nomeAssinatura2Secundario: true,
        labelResultadoFinalSecundario: true,
      },
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
      nomePai: true,
      nomeMae: true,
      cidade: true,
      provincia: true,
      pais: true,
      email: true,
      telefone: true,
      morada: true,
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

  let opcaoCurso = '';
  if (matriculaAnual) {
    curso = matriculaAnual.curso?.nome ?? '';
    classe = matriculaAnual.classe?.nome ?? matriculaAnual.classeOuAnoCurso ?? '';
    anoFrequencia = matriculaAnual.classeOuAnoCurso ?? '';
    anoLetivo = matriculaAnual.anoLetivoRef?.ano ?? matriculaAnual.anoLetivo ?? undefined;
    const match = curso.match(/na opção de\s+(.+?)(?:,|$)/i) || curso.match(/opção[:\s]+(.+?)(?:,|$)/i);
    if (match) opcaoCurso = match[1].trim();
  }

  const turmaMat = await prisma.matricula.findFirst({
    where: { alunoId, turma: { instituicaoId } },
    include: { turma: { include: { curso: true, classe: true } } },
  });
  turma = turmaMat?.turma?.nome ?? '';
  // Fallback curso/classe da turma quando matrícula anual não tiver
  if (!curso && turmaMat?.turma?.curso?.nome) {
    curso = turmaMat.turma.curso.nome;
  }
  if (!classe && turmaMat?.turma?.classe?.nome) {
    classe = turmaMat.turma.classe.nome;
  }

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
      disciplinaId: item.disciplina?.id,
      disciplinaNome: item.disciplina?.nome ?? item.equivalencia?.disciplinaOrigem?.nome ?? 'Disciplina',
      anoLetivo: item.anoLetivo?.ano ?? new Date().getFullYear(),
      cargaHoraria: Number(item.cargaHoraria ?? item.disciplina?.cargaHoraria ?? 0),
      mediaFinal: item.mediaFinal != null ? Number(item.mediaFinal) : null,
      situacao: item.situacaoAcademica ?? (item.origemEquivalencia ? 'APROVADO' : 'N/A'),
      origemEquivalencia: item.origemEquivalencia ?? false,
      classeOrdem: item.classe?.ordem != null ? Number(item.classe.ordem) : null,
    }));
  }

  const localNascimento = [aluno.cidade, aluno.provincia, aluno.pais]
    .filter(Boolean)
    .join(', ') || undefined;
  const filiacao =
    aluno.nomePai && aluno.nomeMae
      ? `filho(a) de ${aluno.nomePai} e de ${aluno.nomeMae}`
      : aluno.nomePai
        ? `filho(a) de ${aluno.nomePai}`
        : aluno.nomeMae
          ? `filho(a) de ${aluno.nomeMae}`
          : undefined;

  let notaTfc: number | null = null;
  let notaDefesa: number | null = null;
  let dataTfc: string | null = null;
  let dataDefesa: string | null = null;
  if (tipoAcademico === 'SUPERIOR' && (tipo === 'HISTORICO' || tipo === 'CERTIFICADO')) {
    const conclusao = await prisma.conclusaoCurso.findFirst({
      where: { alunoId, instituicaoId, status: 'CONCLUIDO' },
      orderBy: { dataConclusao: 'desc' },
    });
    if (conclusao) {
      notaTfc = conclusao.notaTfc != null ? Number(conclusao.notaTfc) : null;
      notaDefesa = conclusao.notaDefesa != null ? Number(conclusao.notaDefesa) : null;
      dataTfc = conclusao.dataTfc ? formatarDataCurta(conclusao.dataTfc) : null;
      dataDefesa = conclusao.dataDefesa ? formatarDataCurta(conclusao.dataDefesa) : null;
    }
  }

  return {
    instituicao: {
      nome: instituicao.nome,
      nif: config?.nif ?? config?.cnpj ?? undefined,
      endereco: instituicao.endereco ?? undefined,
      telefone: instituicao.telefone ?? undefined,
      email: instituicao.emailContato ?? undefined,
      logoUrl: config?.logoUrl ?? instituicao.logoUrl ?? undefined,
      imagemFundoDocumentoUrl: config?.imagemFundoDocumentoUrl ?? undefined,
      ministerioSuperior: config?.ministerioSuperior ?? undefined,
      decretoCriacao: config?.decretoCriacao ?? undefined,
      nomeChefeDaa: config?.nomeChefeDaa ?? undefined,
      nomeDirectorGeral: config?.nomeDirectorGeral ?? undefined,
      localidadeCertificado: config?.localidadeCertificado ?? undefined,
      cargoAssinatura1: config?.cargoAssinatura1 ?? undefined,
      cargoAssinatura2: config?.cargoAssinatura2 ?? undefined,
      textoFechoCertificado: config?.textoFechoCertificado ?? undefined,
      textoRodapeCertificado: config?.textoRodapeCertificado ?? undefined,
      biComplementarCertificado: config?.biComplementarCertificado ?? undefined,
      labelMediaFinalCertificado: config?.labelMediaFinalCertificado ?? undefined,
      labelValoresCertificado: config?.labelValoresCertificado ?? undefined,
      republicaAngola: config?.republicaAngola ?? undefined,
      governoProvincia: config?.governoProvincia ?? undefined,
      escolaNomeNumero: config?.escolaNomeNumero ?? undefined,
      ensinoGeral: config?.ensinoGeral ?? undefined,
      tituloCertificadoSecundario: config?.tituloCertificadoSecundario ?? undefined,
      textoFechoCertificadoSecundario: config?.textoFechoCertificadoSecundario ?? undefined,
      cargoAssinatura1Secundario: config?.cargoAssinatura1Secundario ?? undefined,
      cargoAssinatura2Secundario: config?.cargoAssinatura2Secundario ?? undefined,
      nomeAssinatura1Secundario: config?.nomeAssinatura1Secundario ?? undefined,
      nomeAssinatura2Secundario: config?.nomeAssinatura2Secundario ?? undefined,
      labelResultadoFinalSecundario: config?.labelResultadoFinalSecundario ?? undefined,
    },
    estudante: {
      nomeCompleto: aluno.nomeCompleto,
      numeroEstudante: aluno.numeroIdentificacaoPublica ?? aluno.numeroIdentificacao,
      bi: aluno.numeroIdentificacao ?? undefined,
      dataNascimento: aluno.dataNascimento,
      nomePai: aluno.nomePai ?? undefined,
      nomeMae: aluno.nomeMae ?? undefined,
      localNascimento: localNascimento ?? undefined,
      filiacao,
      email: aluno.email ?? undefined,
      telefone: aluno.telefone ?? undefined,
      endereco: aluno.morada ?? undefined,
    },
    contextoAcademico: {
      tipo: tipoAcademico,
      curso,
      classe,
      anoFrequencia,
      turma,
      anoLetivo,
      semestre,
      opcaoCurso: opcaoCurso || undefined,
      notaTfc: notaTfc ?? undefined,
      notaDefesa: notaDefesa ?? undefined,
      dataTfc: dataTfc ?? undefined,
      dataDefesa: dataDefesa ?? undefined,
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

type HistoricoPivotRowPdf = {
  nome: string;
  ch: number;
  porOrdem: Map<number, number | null>;
  situacoes: Set<string>;
  equiv: boolean;
};

function mediaDasNotasHistorico(vals: (number | null | undefined)[]): number | null {
  const n = vals.filter((v) => v != null && !Number.isNaN(Number(v))).map((v) => Number(v));
  if (n.length === 0) return null;
  return Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 10) / 10;
}

function resumoSituacaoHistorico(sits: Set<string>, equiv: boolean): string {
  if (equiv) return 'Equiv.';
  const u = [...sits];
  if (u.some((s) => /REPROV/i.test(s))) return 'Rep.';
  if (u.some((s) => /APROV/i.test(s))) return 'Apr.';
  return (u[0] || '—').slice(0, 12);
}

function agruparHistoricoSecundarioPorDisciplina(disciplinas: DisciplinaHistorico[]): {
  ordens: number[];
  linhas: HistoricoPivotRowPdf[];
} {
  const map = new Map<string, HistoricoPivotRowPdf>();
  for (const d of disciplinas) {
    const key = (d.disciplinaId && String(d.disciplinaId)) || `nome:${d.disciplinaNome}`;
    if (!map.has(key)) {
      map.set(key, {
        nome: d.disciplinaNome,
        ch: d.cargaHoraria || 0,
        porOrdem: new Map(),
        situacoes: new Set(),
        equiv: !!d.origemEquivalencia,
      });
    }
    const g = map.get(key)!;
    g.equiv = g.equiv || !!d.origemEquivalencia;
    if (d.situacao) g.situacoes.add(String(d.situacao));
    g.ch = Math.max(g.ch, d.cargaHoraria || 0);
    const ord = d.classeOrdem;
    if (ord != null && ord > 0) {
      const mf = d.mediaFinal != null ? Number(d.mediaFinal) : null;
      g.porOrdem.set(ord, mf);
    }
  }
  const ordensSet = new Set<number>();
  for (const g of map.values()) {
    for (const o of g.porOrdem.keys()) ordensSet.add(o);
  }
  const ordens = [...ordensSet].sort((a, b) => a - b);
  const linhas = [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  return { ordens, linhas };
}

function usarGrelhaClasseNoHistorico(
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null | undefined,
  disciplinas: DisciplinaHistorico[],
): boolean {
  if (tipoAcademico !== 'SECUNDARIO') return false;
  return disciplinas.some((d) => d.classeOrdem != null && Number(d.classeOrdem) > 0);
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

    // Curso e Classe: mostrar ambos quando existirem (Secundário tem curso+classe, Superior só curso)
    if (payload.contextoAcademico.curso) {
      doc.text(`Curso: ${payload.contextoAcademico.curso}`, { align: 'justify' });
    }
    if (payload.contextoAcademico.classe) {
      doc.text(`Classe: ${payload.contextoAcademico.classe}`, { align: 'justify' });
    }
    if (!payload.contextoAcademico.curso && !payload.contextoAcademico.classe) {
      doc.text(`Curso: N/A`, { align: 'justify' });
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
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text('Histórico final — disciplinas', { align: 'left' });
      doc.font('Helvetica').fontSize(8).fillColor('#444').text('Notas e situação conforme registos oficiais.', { align: 'left' });
      doc.fillColor('#000');
      doc.moveDown(0.55);

      const margem = 50;
      const dir = 545;
      const lineH = 13;
      const newPageY = () => {
        doc.addPage();
        return margem;
      };

      if (usarGrelhaClasseNoHistorico(payload.contextoAcademico.tipo, payload.disciplinas)) {
        const { ordens, linhas } = agruparHistoricoSecundarioPorDisciplina(payload.disciplinas);
        const colDisc = 118;
        const colOrd = 32;
        const colMed = 40;
        const colCh = 30;
        const colSit = 44;
        let y = doc.y;
        const fs = 7.5;
        doc.font('Helvetica-Bold').fontSize(fs);
        let x = margem;
        doc.text('Disciplina', x, y, { width: colDisc });
        x += colDisc;
        for (const o of ordens) {
          doc.text(`${o}ª`, x, y, { width: colOrd, align: 'center' });
          x += colOrd;
        }
        doc.text('Média', x, y, { width: colMed, align: 'center' });
        x += colMed;
        doc.text('CH', x, y, { width: colCh, align: 'center' });
        x += colCh;
        doc.text('Sit.', x, y, { width: colSit, align: 'center' });
        y += lineH + 2;
        doc.moveTo(margem, y).lineTo(dir, y).strokeColor('#333').lineWidth(0.45).stroke();
        doc.strokeColor('#000').lineWidth(1);
        y += 5;
        doc.font('Helvetica');
        for (const row of linhas) {
          if (y > 720) y = newPageY();
          x = margem;
          const etiqueta = row.equiv ? `${row.nome.substring(0, 32)} (equiv.)` : row.nome.substring(0, 36);
          doc.text(etiqueta, x, y, { width: colDisc - 2 });
          x += colDisc;
          for (const o of ordens) {
            const v = row.porOrdem.get(o);
            doc.text(v != null ? String(v) : '—', x, y, { width: colOrd, align: 'center' });
            x += colOrd;
          }
          const celulas = ordens.map((o) => row.porOrdem.get(o) ?? null);
          const mediaLinha = mediaDasNotasHistorico(celulas);
          doc.text(mediaLinha != null ? String(mediaLinha) : '—', x, y, { width: colMed, align: 'center' });
          x += colMed;
          doc.text(row.ch > 0 ? String(row.ch) : '—', x, y, { width: colCh, align: 'center' });
          x += colCh;
          doc.text(resumoSituacaoHistorico(row.situacoes, row.equiv), x, y, { width: colSit, align: 'center' });
          y += lineH;
        }
        doc.y = y;
      } else {
        const colW = { disc: 198, ano: 48, ch: 40, nota: 44, sit: 92 };
        let y = doc.y;
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text('Disciplina', margem, y, { width: colW.disc });
        doc.text('Ano lect.', margem + colW.disc, y, { width: colW.ano, align: 'center' });
        doc.text('CH', margem + colW.disc + colW.ano, y, { width: colW.ch, align: 'center' });
        doc.text('Nota', margem + colW.disc + colW.ano + colW.ch, y, { width: colW.nota, align: 'center' });
        doc.text('Situação', margem + colW.disc + colW.ano + colW.ch + colW.nota, y, { width: colW.sit, align: 'left' });
        y += lineH + 2;
        doc.moveTo(margem, y).lineTo(dir, y).strokeColor('#333').lineWidth(0.45).stroke();
        doc.strokeColor('#000').lineWidth(1);
        y += 5;
        doc.font('Helvetica').fontSize(8);
        const lista = [...payload.disciplinas].sort((a, b) => {
          const na = a.disciplinaNome || '';
          const nb = b.disciplinaNome || '';
          if (na !== nb) return na.localeCompare(nb, 'pt');
          return (b.anoLetivo || 0) - (a.anoLetivo || 0);
        });
        for (const d of lista) {
          if (y > 720) y = newPageY();
          const rowY = y;
          const dn = (d.disciplinaNome || '').substring(0, 42);
          doc.text(dn, margem, rowY, { width: colW.disc - 2 });
          doc.text(String(d.anoLetivo), margem + colW.disc, rowY, { width: colW.ano, align: 'center' });
          doc.text(String(d.cargaHoraria ?? '—'), margem + colW.disc + colW.ano, rowY, { width: colW.ch, align: 'center' });
          doc.text(d.mediaFinal != null ? d.mediaFinal.toFixed(1) : '—', margem + colW.disc + colW.ano + colW.ch, rowY, {
            width: colW.nota,
            align: 'center',
          });
          const sit = d.origemEquivalencia ? 'Equiv.' : d.situacao || '—';
          doc.text(String(sit).substring(0, 18), margem + colW.disc + colW.ano + colW.ch + colW.nota, rowY, {
            width: colW.sit,
            align: 'left',
          });
          y += lineH;
        }
        doc.y = y;
      }
      doc.font('Helvetica').fontSize(10).fillColor('#000');
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
 * Gera PDF a partir do payload, usando modelo importado se existir.
 * Multi-tenant: instituicaoId obrigatório. Respeita tipoAcademico (SUPERIOR/SECUNDARIO).
 */
async function gerarPDFDocumentoComModelo(
  payload: PayloadDocumento,
  tipo: TipoDocumentoOficial,
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null,
  instituicaoId: string,
  cursoId?: string | null
): Promise<Buffer> {
  const tipoDoc = tipo as 'CERTIFICADO' | 'DECLARACAO_MATRICULA' | 'DECLARACAO_FREQUENCIA';
  const isCertOuDecl = (tipo === 'CERTIFICADO' || tipo === 'DECLARACAO_MATRICULA' || tipo === 'DECLARACAO_FREQUENCIA') &&
    (tipoAcademico === 'SUPERIOR' || tipoAcademico === 'SECUNDARIO');

  if (isCertOuDecl) {
    const pSecMedia =
      tipoAcademico === 'SECUNDARIO'
        ? await prisma.parametrosSistema.findUnique({
            where: { instituicaoId },
            select: { secundarioMediaFinalCursoTipo: true },
          })
        : null;
    const templateOptsCert =
      tipoAcademico === 'SECUNDARIO'
        ? {
            secundarioMediaFinalCursoTipo:
              pSecMedia?.secundarioMediaFinalCursoTipo === 'PONDERADA_CARGA'
                ? ('PONDERADA_CARGA' as const)
                : ('SIMPLES' as const),
          }
        : undefined;

    const { getModeloDocumentoAtivo } = await import('./modeloDocumento.service.js');
    const modeloCustom = await getModeloDocumentoAtivo({
      instituicaoId,
      tipo: tipoDoc,
      tipoAcademico: tipoAcademico ?? undefined,
      cursoId: cursoId ?? null,
    });

    if (modeloCustom) {
      try {
        const pdfBase64 = (modeloCustom as { pdfTemplateBase64?: string | null }).pdfTemplateBase64;
        const pdfMode = (modeloCustom as { pdfTemplateMode?: string | null }).pdfTemplateMode;
        const pdfMappingJson = (modeloCustom as { pdfMappingJson?: string | null }).pdfMappingJson;
        if (pdfBase64 && pdfBase64.trim().length > 0 && pdfMappingJson?.trim()) {
          const { payloadToTemplateData } = await import('./documentoTemplateGeneric.service.js');
          const { fillPdfFormFields, fillPdfWithCoordinates } = await import('./pdfTemplate.service.js');
          const data = payloadToTemplateData(payload, tipoDoc, tipoAcademico!, templateOptsCert) as Record<
            string,
            unknown
          >;
          let mapping: unknown;
          try {
            mapping = JSON.parse(pdfMappingJson);
          } catch {
            throw new Error('pdfMappingJson inválido');
          }
          if (pdfMode === 'COORDINATES') {
            const buf = await fillPdfWithCoordinates(pdfBase64, data, mapping as { items: Array<{ pageIndex: number; x: number; y: number; campo: string; fontSize?: number }> });
            return buf;
          }
          const buf = await fillPdfFormFields(pdfBase64, data, mapping as Record<string, string>);
          return buf;
        }
        const docxBase64 = (modeloCustom as { docxTemplateBase64?: string | null }).docxTemplateBase64;
        if (docxBase64 && docxBase64.trim().length > 0) {
          const { payloadToTemplateData } = await import('./documentoTemplateGeneric.service.js');
          const { renderTemplate } = await import('./templateRender.service.js');
          const { gerarPDFCertificadoSuperior } = await import('./certificadoSuperior.service.js');
          const data = payloadToTemplateData(payload, tipoDoc, tipoAcademico!, templateOptsCert);
          const { buffer, format } = await renderTemplate({
            modeloDocumentoId: modeloCustom.id,
            instituicaoId,
            data: data as Record<string, unknown>,
            outputFormat: 'pdf',
          });
          if (format === 'pdf') return buffer;
          const { docxBufferToPdf } = await import('./docxToPdf.service.js');
          const landscape = (modeloCustom as { orientacaoPagina?: string | null }).orientacaoPagina === 'PAISAGEM';
          const pdf = await docxBufferToPdf(buffer, { landscape });
          if (pdf) return pdf;
          const mammoth = await import('mammoth');
          const { value: html } = await mammoth.default.convertToHtml({ buffer });
          const pdfFallback = await gerarPDFCertificadoSuperior(html || '', { landscape });
          if (pdfFallback) return pdfFallback;
        }
        const { montarVarsBasicas, preencherTemplateHtmlGenerico, payloadToTemplateData } = await import('./documentoTemplateGeneric.service.js');
        const { gerarPDFCertificadoSuperior } = await import('./certificadoSuperior.service.js');
        const mappings = (modeloCustom as { templateMappings?: { campoTemplate: string; campoSistema: string }[] }).templateMappings;
        let vars: Record<string, string>;
        if (mappings?.length) {
          const data = payloadToTemplateData(payload, tipoDoc, tipoAcademico!, templateOptsCert) as Record<
            string,
            unknown
          >;
          vars = {};
          for (const m of mappings) {
            vars[m.campoTemplate] = getValueByPathForTemplate(data, m.campoSistema) ?? '';
          }
        } else {
          vars = montarVarsBasicas(payload, tipoDoc, tipoAcademico!);
        }
        const html = preencherTemplateHtmlGenerico(modeloCustom.htmlTemplate, vars);
        const landscape = (modeloCustom as { orientacaoPagina?: string | null }).orientacaoPagina === 'PAISAGEM';
        const pdf = await gerarPDFCertificadoSuperior(html, { landscape });
        return pdf ?? (await geraDocumentoPDF(payload));
      } catch (err) {
        console.error('[documento.service] Erro ao usar modelo importado, fallback para padrão:', err);
      }
    }
  }

  if (tipo === 'CERTIFICADO' && tipoAcademico === 'SUPERIOR') {
    try {
      const { preencherTemplateCertificadoSuperior, gerarPDFCertificadoSuperior } = await import('./certificadoSuperior.service.js');
      const html = await preencherTemplateCertificadoSuperior(payload, {});
      const pdfSuperior = await gerarPDFCertificadoSuperior(html);
      return pdfSuperior ?? (await geraDocumentoPDF(payload));
    } catch {
      return geraDocumentoPDF(payload);
    }
  }
  if (tipo === 'CERTIFICADO' && tipoAcademico === 'SECUNDARIO') {
    try {
      const { preencherTemplateCertificadoSecundario, gerarPDFCertificadoSecundario } = await import('./certificadoSecundario.service.js');
      const paramsCert = await prisma.parametrosSistema.findUnique({
        where: { instituicaoId },
        select: { secundarioMediaFinalCursoTipo: true },
      });
      const tipoMediaCert =
        paramsCert?.secundarioMediaFinalCursoTipo === 'PONDERADA_CARGA' ? 'PONDERADA_CARGA' : 'SIMPLES';
      const html = await preencherTemplateCertificadoSecundario(payload, {
        tipoMediaFinalCurso: tipoMediaCert,
      });
      const pdfSec = await gerarPDFCertificadoSecundario(html);
      return pdfSec ?? (await geraDocumentoPDF(payload));
    } catch {
      return geraDocumentoPDF(payload);
    }
  }
  if ((tipo === 'DECLARACAO_MATRICULA' || tipo === 'DECLARACAO_FREQUENCIA') && (tipoAcademico === 'SUPERIOR' || tipoAcademico === 'SECUNDARIO')) {
    try {
      const { preencherTemplateDeclaracao, gerarPDFDeclaracao } = await import('./declaracao.service.js');
      const html = await preencherTemplateDeclaracao(payload, tipo, tipoAcademico, {});
      const pdfDecl = await gerarPDFDeclaracao(html);
      return pdfDecl ?? (await geraDocumentoPDF(payload));
    } catch {
      return geraDocumentoPDF(payload);
    }
  }
  return geraDocumentoPDF(payload);
}

/**
 * Regenera PDF a partir do payload guardado (download).
 * Usa o mesmo template que a emissão (modelo importado ou padrão).
 * Multi-tenant: instituicaoId do documento.
 */
export async function regenerarPDFfromPayload(
  payload: PayloadDocumento,
  instituicaoId: string
): Promise<Buffer> {
  const tipo = payload.documento.tipo;
  const tipoAcademico = payload.contextoAcademico?.tipo ?? null;
  const cursoId = (payload.contextoAcademico as any)?.cursoId ?? null;
  return gerarPDFDocumentoComModelo(payload, tipo, tipoAcademico, instituicaoId, cursoId);
}

/**
 * Gera documento oficial: valida, monta payload, gera PDF, persiste
 */
export async function geraDocumento(
  tipo: TipoDocumentoOficial,
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

  let cursoId: string | null = null;
  if (contexto?.matriculaId) {
    const [mat, matAnual] = await Promise.all([
      prisma.matricula.findFirst({
        where: { id: contexto.matriculaId },
        include: { turma: { select: { cursoId: true } } },
      }),
      prisma.matriculaAnual.findFirst({
        where: { id: contexto.matriculaId },
        select: { cursoId: true },
      }),
    ]);
    cursoId = mat?.turma?.cursoId ?? matAnual?.cursoId ?? null;
  }

  if (payload.contextoAcademico && cursoId) {
    (payload.contextoAcademico as any).cursoId = cursoId;
  }

  const pdfBuffer = await gerarPDFDocumentoComModelo(
    payload,
    tipo,
    tipoAcademico,
    instituicaoId,
    cursoId
  );

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

  await AuditService.log(null, {
    modulo: ModuloAuditoria.DOCUMENTOS_OFICIAIS,
    entidade: EntidadeAuditoria.DOCUMENTO_EMITIDO,
    acao: AcaoAuditoria.CREATE,
    entidadeId: documento.id,
    instituicaoId,
    dadosNovos: {
      tipoDocumento: tipo,
      numeroDocumento,
      alunoId,
      emitidoPorId,
      documentoId: documento.id,
    },
    observacao: `Documento ${tipo} nº ${numeroDocumento} emitido`,
  }).catch((err) => console.error('[documento.service] Erro ao registrar auditoria:', err));

  return {
    id: documento.id,
    numeroDocumento,
    codigoVerificacao,
    pdfBuffer,
  };
}
