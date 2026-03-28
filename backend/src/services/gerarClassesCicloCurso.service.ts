import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

export type GerarClassesCicloResultado = {
  criadas: number;
  classes: { id: string; nome: string; codigo: string; ordem: number }[];
  ordensJaExistentes: number[];
};

/** Linha mostrada na pré-visualização e usada na persistência. */
export type LinhaGeracaoCiclo = {
  ordem: number;
  nome: string;
  codigo: string;
  cargaHoraria: number;
  valorMensalidade: number;
  taxaMatricula: number | null;
  valorBata: number | null;
  exigeBata: boolean;
  valorPasse: number | null;
  exigePasse: boolean;
  valorEmissaoDeclaracao: number | null;
  valorEmissaoCertificado: number | null;
};

export type PrevisualizarGeracaoCicloResultado = {
  cursoNome: string;
  duracaoCicloAnos: number;
  ordensJaExistentes: number[];
  linhas: LinhaGeracaoCiclo[];
  totalACriar: number;
  classeModelo: { id: string; nome: string; codigo: string } | null;
};

type ClienteDb = {
  classe: {
    findFirst: (args: {
      where: Prisma.ClasseWhereInput;
    }) => Promise<{ codigo: string } | null>;
  };
};

function normalizarBaseCodigoCurso(codigoCurso: string): string {
  return (
    codigoCurso
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '')
      .toUpperCase()
      .slice(0, 24) || 'CURSO'
  );
}

function nomeClasseGerada(
  ordem: number,
  cursoNome: string,
  anoInicialPercurso: number | null
): string {
  if (anoInicialPercurso != null) {
    return `${anoInicialPercurso + ordem - 1}.ª — ${cursoNome}`;
  }
  return `${ordem}.º ano — ${cursoNome}`;
}

/** Garante código único na instituição (mesmo algoritmo em preview e na transação). */
async function resolverCodigoUnico(
  db: ClienteDb,
  instituicaoId: string,
  baseCodigo: string,
  ordem: number
): Promise<string> {
  let codigo = `${baseCodigo}-C${ordem}`;
  let sufixo = 0;
  while (
    await db.classe.findFirst({
      where: { instituicaoId, codigo },
    })
  ) {
    sufixo += 1;
    codigo = `${baseCodigo}-C${ordem}-${sufixo}`;
    if (sufixo > 80) {
      throw new AppError('Não foi possível gerar código único para uma das classes', 400);
    }
  }
  return codigo;
}

export type SnapshotClasseModelo = {
  id: string;
  nome: string;
  codigo: string;
  cargaHoraria: number;
  valorMensalidade: Prisma.Decimal;
  taxaMatricula: Prisma.Decimal | null;
  valorBata: Prisma.Decimal | null;
  exigeBata: boolean;
  valorPasse: Prisma.Decimal | null;
  exigePasse: boolean;
  valorEmissaoDeclaracao: Prisma.Decimal | null;
  valorEmissaoCertificado: Prisma.Decimal | null;
};

export async function obterClasseModeloInstituicao(
  instituicaoId: string,
  classeModeloId: string
): Promise<SnapshotClasseModelo> {
  const m = await prisma.classe.findFirst({
    where: { id: classeModeloId, instituicaoId },
    select: {
      id: true,
      nome: true,
      codigo: true,
      cargaHoraria: true,
      valorMensalidade: true,
      taxaMatricula: true,
      valorBata: true,
      exigeBata: true,
      valorPasse: true,
      exigePasse: true,
      valorEmissaoDeclaracao: true,
      valorEmissaoCertificado: true,
    },
  });
  if (!m) {
    throw new AppError('Classe modelo não encontrada nesta instituição', 404);
  }
  return m;
}

function montarLinhaComTemplate(params: {
  ordem: number;
  nome: string;
  codigo: string;
  valorMensalidadeEfectivo: number;
  modelo: SnapshotClasseModelo | null;
}): LinhaGeracaoCiclo {
  const { ordem, nome, codigo, valorMensalidadeEfectivo, modelo } = params;
  const dec = (v: Prisma.Decimal | null | undefined) =>
    v == null ? null : Math.max(0, Number(v));
  return {
    ordem,
    nome,
    codigo,
    cargaHoraria: modelo?.cargaHoraria ?? 0,
    valorMensalidade: valorMensalidadeEfectivo,
    taxaMatricula: modelo?.taxaMatricula != null ? dec(modelo.taxaMatricula) : null,
    valorBata: modelo?.valorBata != null ? dec(modelo.valorBata) : null,
    exigeBata: modelo?.exigeBata ?? false,
    valorPasse: modelo?.valorPasse != null ? dec(modelo.valorPasse) : null,
    exigePasse: modelo?.exigePasse ?? false,
    valorEmissaoDeclaracao:
      modelo?.valorEmissaoDeclaracao != null ? dec(modelo.valorEmissaoDeclaracao) : null,
    valorEmissaoCertificado:
      modelo?.valorEmissaoCertificado != null ? dec(modelo.valorEmissaoCertificado) : null,
  };
}

type ContextoGeracao = {
  curso: { id: string; nome: string; codigo: string; duracaoCicloAnos: number | null };
  dur: number;
  ordensACriar: number[];
  ordensJaExistentes: number[];
  baseCodigo: string;
  activasNoCurso: number;
};

async function resolverContextoGeracao(
  instituicaoId: string,
  cursoId: string
): Promise<ContextoGeracao> {
  const curso = await prisma.curso.findFirst({
    where: { id: cursoId, instituicaoId },
    select: { id: true, nome: true, codigo: true, duracaoCicloAnos: true },
  });
  if (!curso) {
    throw new AppError('Curso não encontrado nesta instituição', 404);
  }
  const dur = curso.duracaoCicloAnos;
  if (dur == null || dur < 1) {
    throw new AppError(
      'Defina primeiro a duração do ciclo (anos / número de classes) nesta área ou opção.',
      400
    );
  }

  const vinculadas = await prisma.classe.findMany({
    where: { instituicaoId, cursoId },
    select: { ordem: true },
  });
  const ordensOcupadas = new Set(
    vinculadas.map((c) => c.ordem).filter((o) => Number.isInteger(o) && o >= 1 && o <= dur)
  );
  const ordensACriar: number[] = [];
  for (let o = 1; o <= dur; o++) {
    if (!ordensOcupadas.has(o)) ordensACriar.push(o);
  }
  const ordensJaExistentes = [...ordensOcupadas].sort((a, b) => a - b);
  const baseCodigo = normalizarBaseCodigoCurso(curso.codigo);
  const activasNoCurso = await prisma.classe.count({
    where: { instituicaoId, cursoId, ativo: true },
  });

  if (ordensACriar.length > 0 && activasNoCurso + ordensACriar.length > dur) {
    throw new AppError(
      'Não é possível gerar todas as classes: ultrapassaria a duração do ciclo definida no curso. Desative classes em excesso ou aumente a duração.',
      400
    );
  }

  return { curso, dur, ordensACriar, ordensJaExistentes, baseCodigo, activasNoCurso };
}

/**
 * Pré-visualização sem escrita — útil para UX e conferência institucional.
 */
export async function previsualizarGeracaoCicloCursoSecundario(params: {
  instituicaoId: string;
  cursoId: string;
  valorMensalidadePadrao: number;
  anoInicialPercurso?: number | null;
  modelo: SnapshotClasseModelo | null;
}): Promise<PrevisualizarGeracaoCicloResultado> {
  const { instituicaoId, cursoId, valorMensalidadePadrao, anoInicialPercurso, modelo } = params;

  if (!Number.isFinite(valorMensalidadePadrao) || valorMensalidadePadrao <= 0) {
    throw new AppError('Valor de mensalidade deve ser maior que zero para a pré-visualização', 400);
  }
  if (
    anoInicialPercurso != null &&
    (!Number.isInteger(anoInicialPercurso) || anoInicialPercurso < 1 || anoInicialPercurso > 30)
  ) {
    throw new AppError('Ano inicial do percurso deve ser um inteiro entre 1 e 30 ou vazio', 400);
  }

  const ctx = await resolverContextoGeracao(instituicaoId, cursoId);
  const anoIni = anoInicialPercurso ?? null;
  const linhas: LinhaGeracaoCiclo[] = [];

  const vm =
    modelo && Number(modelo.valorMensalidade) > 0
      ? Number(modelo.valorMensalidade)
      : valorMensalidadePadrao;

  for (const ordem of ctx.ordensACriar) {
    const nome = nomeClasseGerada(ordem, ctx.curso.nome, anoIni);
    const codigo = await resolverCodigoUnico(prisma, instituicaoId, ctx.baseCodigo, ordem);
    linhas.push(
      montarLinhaComTemplate({
        ordem,
        nome,
        codigo,
        valorMensalidadeEfectivo: vm,
        modelo,
      })
    );
  }

  return {
    cursoNome: ctx.curso.nome,
    duracaoCicloAnos: ctx.dur,
    ordensJaExistentes: ctx.ordensJaExistentes,
    linhas,
    totalACriar: linhas.length,
    classeModelo:
      modelo != null
        ? { id: modelo.id, nome: modelo.nome, codigo: modelo.codigo }
        : null,
  };
}

function dadosCreateFromLinha(
  instituicaoId: string,
  cursoId: string,
  linha: LinhaGeracaoCiclo
): Prisma.ClasseUncheckedCreateInput {
  return {
    nome: linha.nome,
    codigo: linha.codigo,
    instituicaoId,
    cursoId,
    ordem: linha.ordem,
    ativo: true,
    cargaHoraria: linha.cargaHoraria,
    valorMensalidade: linha.valorMensalidade,
    taxaMatricula: linha.taxaMatricula,
    valorBata: linha.valorBata,
    exigeBata: linha.exigeBata,
    valorPasse: linha.valorPasse,
    exigePasse: linha.exigePasse,
    valorEmissaoDeclaracao: linha.valorEmissaoDeclaracao,
    valorEmissaoCertificado: linha.valorEmissaoCertificado,
  };
}

/**
 * Persiste as classes em falta; deve usar os mesmos parâmetros que a pré-visualização aceita pelo utilizador.
 */
export async function gerarClassesCicloCursoSecundario(params: {
  instituicaoId: string;
  cursoId: string;
  valorMensalidadePadrao: number;
  anoInicialPercurso?: number | null;
  modelo: SnapshotClasseModelo | null;
}): Promise<GerarClassesCicloResultado> {
  const preview = await previsualizarGeracaoCicloCursoSecundario(params);

  if (preview.linhas.length === 0) {
    return { criadas: 0, classes: [], ordensJaExistentes: preview.ordensJaExistentes };
  }

  const criadas: GerarClassesCicloResultado['classes'] = [];

  await prisma.$transaction(async (tx) => {
    for (const linha of preview.linhas) {
      const row = await tx.classe.create({
        data: dadosCreateFromLinha(params.instituicaoId, params.cursoId, linha),
        select: { id: true, nome: true, codigo: true, ordem: true },
      });
      criadas.push(row);
    }
  });

  return {
    criadas: criadas.length,
    classes: criadas,
    ordensJaExistentes: preview.ordensJaExistentes,
  };
}
