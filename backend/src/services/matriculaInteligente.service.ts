/**
 * Matrícula inteligente — sugestão de progressão, disciplinas em atraso e pré-requisitos.
 * Multi-tenant: sempre filtra por instituicaoId. Respeita tipoAcademico (SUPERIOR | SECUNDARIO).
 */

import prisma from '../lib/prisma.js';

export type DecisaoProgressaoSugerida = 'AVANCA' | 'REPETE' | 'AVANCA_CONDICIONADO';

export interface DisciplinaSugestaoItem {
  disciplinaId: string;
  nome: string;
  codigo: string | null;
  semestreCurso: number | null;
  obrigatoria: boolean;
  /** Só Ensino Superior quando configurado no CursoDisciplina */
  preRequisitoDisciplinaId: string | null;
  preRequisitoNome: string | null;
  elegivelParaMatricula: boolean;
  motivoBloqueio: string | null;
}

export interface PainelMatriculaInteligente {
  instituicaoId: string;
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO';
  alunoId: string;
  decisaoSugerida: DecisaoProgressaoSugerida;
  mensagensInstitucionais: string[];
  /** Pode subir de classe / ano curricular segundo regras globais (status + limite de atrasos configurado). */
  podeSubirNivel: boolean;
  classeOuAnoAtual: string;
  classeOuAnoSugerido: string;
  classeSugeridaId: string | null;
  statusFinalUltimaMatricula: string | null;
  disciplinasEmAtraso: DisciplinaSugestaoItem[];
  disciplinasNovasAnoSugeridas: DisciplinaSugestaoItem[];
  configuracao: {
    reprovacaoBloqueiaSubir: boolean;
    maxDisciplinasAtrasoSubir: number;
    usaPreRequisitos: boolean;
    disciplinasNegativasPermitidasStatusAno: number;
  };
}

async function loadParametrosProgressaoInteligente(instituicaoId: string) {
  const params = await prisma.parametrosSistema.findFirst({
    where: { instituicaoId },
  });
  return {
    disciplinasNegativasPermitidas: params?.disciplinasNegativasPermitidas ?? 0,
    progressaoReprovacaoBloqueiaSubirAnoClasse: params?.progressaoReprovacaoBloqueiaSubirAnoClasse ?? true,
    progressaoMaxDisciplinasAtrasoSubirAno: params?.progressaoMaxDisciplinasAtrasoSubirAno ?? 2,
    progressaoUsaPreRequisitos: params?.progressaoUsaPreRequisitos ?? true,
    quantidadeSemestresPorAno: params?.quantidadeSemestresPorAno ?? 2,
  };
}

function anoCurricularDoSemestre(semestre: number | null, semestresPorAno: number): number | null {
  if (semestre == null || semestre < 1) return null;
  const spy = semestresPorAno > 0 ? semestresPorAno : 2;
  return Math.ceil(semestre / spy);
}

function extrairOrdemSecundario(classeOuAnoCurso: string): number | null {
  const m = classeOuAnoCurso.match(/(\d{1,2})ª?\s*Classe/i) || classeOuAnoCurso.match(/^(\d{1,2})$/);
  return m ? parseInt(m[1], 10) : null;
}

function extrairAnoSuperior(classeOuAnoCurso: string): number | null {
  const m = classeOuAnoCurso.match(/(\d)º\s*Ano/i);
  return m ? parseInt(m[1], 10) : null;
}

async function resolverAnoLetivoIdParaHistorico(
  alunoId: string,
  matriculaRef: { anoLetivoId: string | null; anoLetivo: number | null },
  instituicaoId: string
): Promise<string | null> {
  if (matriculaRef.anoLetivoId) return matriculaRef.anoLetivoId;
  if (matriculaRef.anoLetivo != null) {
    const al = await prisma.anoLetivo.findFirst({
      where: { instituicaoId, ano: matriculaRef.anoLetivo },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (al) return al.id;
  }
  const h = await prisma.historicoAcademico.findFirst({
    where: { instituicaoId, alunoId },
    orderBy: { createdAt: 'desc' },
    select: { anoLetivoId: true },
  });
  return h?.anoLetivoId ?? null;
}

/** IDs de disciplinas com aproveitamento em qualquer ano (histórico). */
async function disciplinasAprovadasHistoricoAluno(alunoId: string, instituicaoId: string): Promise<Set<string>> {
  const rows = await prisma.historicoAcademico.findMany({
    where: {
      alunoId,
      instituicaoId,
      situacaoAcademica: 'APROVADO',
    },
    select: { disciplinaId: true },
  });
  return new Set(rows.map((r) => r.disciplinaId));
}

/**
 * Painel completo para secretaria: decisão sugerida, atrasos e UC do próximo nível com pré-requisitos.
 */
export async function obterPainelMatriculaInteligente(
  alunoId: string,
  instituicaoId: string
): Promise<PainelMatriculaInteligente | null> {
  const instituicao = await prisma.instituicao.findFirst({
    where: { id: instituicaoId },
    select: { tipoAcademico: true },
  });
  const tipoRaw = instituicao?.tipoAcademico;
  if (tipoRaw !== 'SUPERIOR' && tipoRaw !== 'SECUNDARIO') {
    return null;
  }
  const tipoAcademico = tipoRaw;

  const params = await loadParametrosProgressaoInteligente(instituicaoId);

  const ultimaMatricula = await prisma.matriculaAnual.findFirst({
    where: { alunoId, instituicaoId },
    orderBy: [{ anoLetivo: 'desc' }, { createdAt: 'desc' }],
    include: { classe: { select: { id: true, nome: true, ordem: true } } },
  });

  if (!ultimaMatricula) {
    return null;
  }

  const statusFinal = ultimaMatricula.statusFinal;
  const anoLetivoHistId = await resolverAnoLetivoIdParaHistorico(
    alunoId,
    { anoLetivoId: ultimaMatricula.anoLetivoId, anoLetivo: ultimaMatricula.anoLetivo },
    instituicaoId
  );

  const historicosAno = anoLetivoHistId
    ? await prisma.historicoAcademico.findMany({
        where: { alunoId, instituicaoId, anoLetivoId: anoLetivoHistId },
        include: {
          disciplina: { select: { id: true, nome: true, codigo: true, obrigatoria: true } },
        },
      })
    : [];

  const reprovados = historicosAno.filter((h) =>
    ['REPROVADO', 'REPROVADO_FALTA'].includes(h.situacaoAcademica)
  );
  const reprovadosObrig = reprovados.filter((h) => h.disciplina?.obrigatoria !== false);
  const countReprovObrig = reprovadosObrig.length;

  let podeSubirNivel = true;
  const mensagens: string[] = [];

  if (statusFinal === 'REPROVADO') {
    if (params.progressaoReprovacaoBloqueiaSubirAnoClasse) {
      podeSubirNivel = false;
      mensagens.push(
        'Instituição configurada para bloquear subida de nível quando o ano letivo foi fechado como REPROVADO. O estudante deve repetir o nível ou solicitar exceção administrativa (override), se permitido.'
      );
    } else if (countReprovObrig > params.progressaoMaxDisciplinasAtrasoSubirAno) {
      podeSubirNivel = false;
      mensagens.push(
        `Com a política de “reprovação não bloqueia subida”, o limite configurado é ${params.progressaoMaxDisciplinasAtrasoSubirAno} disciplina(s) obrigatória(s) em atraso. Encontradas: ${countReprovObrig}.`
      );
    } else {
      podeSubirNivel = true;
      mensagens.push(
        `Ano encerrado como REPROVADO, mas a instituição permite subir com até ${params.progressaoMaxDisciplinasAtrasoSubirAno} disciplina(s) obrigatória(s) em atraso (actuais: ${countReprovObrig}). Pode avançar de nível e cursar as disciplinas em atraso em paralelo (dependências), se o regulamento o permitir.`
      );
    }
  } else if (statusFinal === 'APROVADO') {
    mensagens.push(
      'Última matrícula anual encerrada como APROVADO. Pode prosseguir para o nível seguinte, desde que as regras de progressão sequencial e pré-requisitos sejam cumpridas.'
    );
  } else {
    mensagens.push(
      'O estado final do ano letivo (APROVADO/REPROVADO) ainda não está definido nesta matrícula. Use os dados do histórico e da pauta como referência até ao encerramento oficial.'
    );
    if (countReprovObrig > params.disciplinasNegativasPermitidas) {
      podeSubirNivel = false;
      mensagens.push(
        `Com base no histórico do período de referência, há ${countReprovObrig} disciplina(s) obrigatória(s) reprovada(s), acima do limite de ${params.disciplinasNegativasPermitidas} permitido para fechar o ano como apto a transitar.`
      );
    }
  }

  let decisaoSugerida: DecisaoProgressaoSugerida = 'AVANCA';
  if (!podeSubirNivel) {
    decisaoSugerida = 'REPETE';
  } else if (reprovadosObrig.length > 0) {
    decisaoSugerida = 'AVANCA_CONDICIONADO';
  }

  const aprovadasSet = await disciplinasAprovadasHistoricoAluno(alunoId, instituicaoId);

  const disciplinasEmAtraso: DisciplinaSugestaoItem[] = reprovadosObrig.map((h) => ({
    disciplinaId: h.disciplinaId,
    nome: h.disciplina?.nome ?? 'Disciplina',
    codigo: h.disciplina?.codigo ?? null,
    semestreCurso: null,
    obrigatoria: h.disciplina?.obrigatoria !== false,
    preRequisitoDisciplinaId: null,
    preRequisitoNome: null,
    elegivelParaMatricula: true,
    motivoBloqueio: null,
  }));

  let classeOuAnoSugerido = ultimaMatricula.classeOuAnoCurso;
  let classeSugeridaId: string | null = ultimaMatricula.classeId;

  if (podeSubirNivel) {
    if (tipoAcademico === 'SECUNDARIO' && ultimaMatricula.classeId) {
      const atual = await prisma.classe.findUnique({ where: { id: ultimaMatricula.classeId } });
      const ordemAtual = atual?.ordem ?? extrairOrdemSecundario(atual?.nome || ultimaMatricula.classeOuAnoCurso);
      if (ordemAtual != null) {
        const prox = await prisma.classe.findFirst({
          where: { instituicaoId, ordem: ordemAtual + 1 },
          orderBy: { nome: 'asc' },
        });
        if (prox) {
          classeOuAnoSugerido = prox.nome;
          classeSugeridaId = prox.id;
        }
      }
    } else if (tipoAcademico === 'SUPERIOR') {
      const anoAt = extrairAnoSuperior(ultimaMatricula.classeOuAnoCurso);
      if (anoAt != null && anoAt >= 1 && anoAt < 6) {
        const labels = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano'];
        classeOuAnoSugerido = labels[anoAt];
      }
    }
  }

  const disciplinasNovasAnoSugeridas: DisciplinaSugestaoItem[] = [];

  if (tipoAcademico === 'SUPERIOR' && ultimaMatricula.cursoId && podeSubirNivel) {
    const anoBase = extrairAnoSuperior(ultimaMatricula.classeOuAnoCurso);
    const anoProx =
      anoBase != null ? Math.min(6, anoBase + 1) : extrairAnoSuperior(classeOuAnoSugerido);

    if (anoProx != null) {
      const vinculos = await prisma.cursoDisciplina.findMany({
        where: {
          cursoId: ultimaMatricula.cursoId,
          obrigatoria: true,
          disciplina: { instituicaoId },
        },
        include: {
          disciplina: { select: { id: true, nome: true, codigo: true, obrigatoria: true } },
          preRequisitoDisciplina: { select: { id: true, nome: true } },
        },
      });

      for (const v of vinculos) {
        const anoUc = anoCurricularDoSemestre(v.semestre, params.quantidadeSemestresPorAno);
        if (anoUc !== anoProx) continue;
        if (aprovadasSet.has(v.disciplinaId)) continue;
        if (reprovados.some((r) => r.disciplinaId === v.disciplinaId)) continue;

        let elegivel = true;
        let motivoBloq: string | null = null;
        const preId = v.preRequisitoDisciplinaId;
        if (params.progressaoUsaPreRequisitos && preId) {
          if (!aprovadasSet.has(preId)) {
            elegivel = false;
            motivoBloq = `Pré-requisito não cumprido: é necessário aproveitamento em “${v.preRequisitoDisciplina?.nome ?? 'disciplina de apoio'}” antes de cursar esta unidade curricular.`;
          }
        }

        disciplinasNovasAnoSugeridas.push({
          disciplinaId: v.disciplina.id,
          nome: v.disciplina.nome,
          codigo: v.disciplina.codigo ?? null,
          semestreCurso: v.semestre ?? null,
          obrigatoria: v.obrigatoria,
          preRequisitoDisciplinaId: preId,
          preRequisitoNome: v.preRequisitoDisciplina?.nome ?? null,
          elegivelParaMatricula: elegivel,
          motivoBloqueio: motivoBloq,
        });
      }

      disciplinasNovasAnoSugeridas.sort(
        (a, b) => (a.semestreCurso ?? 99) - (b.semestreCurso ?? 99) || a.nome.localeCompare(b.nome)
      );
    }
  }

  if (tipoAcademico === 'SECUNDARIO' && classeSugeridaId && podeSubirNivel) {
    const planos = await prisma.planoEnsino.findMany({
      where: {
        instituicaoId,
        classeId: classeSugeridaId,
        disciplina: { instituicaoId, obrigatoria: { not: false } },
      },
      distinct: ['disciplinaId'],
      include: {
        disciplina: { select: { id: true, nome: true, codigo: true, obrigatoria: true } },
      },
    });

    for (const p of planos) {
      const d = p.disciplina;
      if (aprovadasSet.has(d.id)) continue;
      if (reprovados.some((r) => r.disciplinaId === d.id)) continue;
      disciplinasNovasAnoSugeridas.push({
        disciplinaId: d.id,
        nome: d.nome,
        codigo: d.codigo ?? null,
        semestreCurso: null,
        obrigatoria: d.obrigatoria !== false,
        preRequisitoDisciplinaId: null,
        preRequisitoNome: null,
        elegivelParaMatricula: true,
        motivoBloqueio: null,
      });
    }
    disciplinasNovasAnoSugeridas.sort((a, b) => a.nome.localeCompare(b.nome));
  }

  return {
    instituicaoId,
    tipoAcademico,
    alunoId,
    decisaoSugerida,
    mensagensInstitucionais: mensagens,
    podeSubirNivel,
    classeOuAnoAtual: ultimaMatricula.classeOuAnoCurso,
    classeOuAnoSugerido,
    classeSugeridaId,
    statusFinalUltimaMatricula: statusFinal,
    disciplinasEmAtraso,
    disciplinasNovasAnoSugeridas,
    configuracao: {
      reprovacaoBloqueiaSubir: params.progressaoReprovacaoBloqueiaSubirAnoClasse,
      maxDisciplinasAtrasoSubir: params.progressaoMaxDisciplinasAtrasoSubirAno,
      usaPreRequisitos: params.progressaoUsaPreRequisitos,
      disciplinasNegativasPermitidasStatusAno: params.disciplinasNegativasPermitidas,
    },
  };
}

/**
 * Conta disciplinas obrigatórias reprovadas no histórico do ano de referência da matrícula.
 */
export async function contarReprovacoesObrigatoriasNoAnoLetivo(
  alunoId: string,
  instituicaoId: string,
  matriculaReferencia: { anoLetivoId: string | null; anoLetivo: number | null }
): Promise<number> {
  const anoId = await resolverAnoLetivoIdParaHistorico(alunoId, matriculaReferencia, instituicaoId);
  if (!anoId) return 0;
  const rows = await prisma.historicoAcademico.findMany({
    where: {
      alunoId,
      instituicaoId,
      anoLetivoId: anoId,
      situacaoAcademica: { in: ['REPROVADO', 'REPROVADO_FALTA'] },
      disciplina: { obrigatoria: { not: false } },
    },
    select: { id: true },
  });
  return rows.length;
}
