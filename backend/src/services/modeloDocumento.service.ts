import prisma from '../lib/prisma.js';

export type TipoModeloDocumento =
  | 'CERTIFICADO'
  | 'DECLARACAO_MATRICULA'
  | 'DECLARACAO_FREQUENCIA'
  | 'MINI_PAUTA'
  | 'PAUTA_CONCLUSAO'
  | 'BOLETIM';

interface GetModeloDocumentoAtivoParams {
  instituicaoId: string;
  tipo: TipoModeloDocumento;
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
  cursoId?: string | null;
}

/** Constrói cláusula OR para tipoAcademico: matching null (ambos) + valor específico se fornecido */
function buildTipoAcademicoOr(tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null | undefined): Array<{ tipoAcademico: string | null }> {
  if (tipoAcademico === 'SUPERIOR' || tipoAcademico === 'SECUNDARIO') {
    return [{ tipoAcademico: null }, { tipoAcademico }];
  }
  // Quando instituição não tem tipoAcademico: aceitar null, SUPERIOR ou SECUNDARIO
  return [
    { tipoAcademico: null },
    { tipoAcademico: 'SUPERIOR' },
    { tipoAcademico: 'SECUNDARIO' },
  ];
}

/**
 * Busca o modelo de documento ativo mais específico possível, com fallback:
 * 1) Por curso (se cursoId informado)
 * 2) Por instituição + tipo/tipoAcademico
 * 3) Global (instituicaoId null)
 * Retorna null se não houver modelo configurado.
 */
export async function getModeloDocumentoAtivo(params: GetModeloDocumentoAtivoParams) {
  const { instituicaoId, tipo, tipoAcademico, cursoId } = params;
  const tipoAcadOr = buildTipoAcademicoOr(tipoAcademico);

  // 1) Modelo específico por curso (com instituicaoId para isolamento multi-tenant)
  if (cursoId) {
    const porCurso = await prisma.modeloDocumento.findFirst({
      where: {
        ativo: true,
        tipo,
        instituicaoId,
        cursoId,
        OR: tipoAcadOr,
      },
      include: { templateMappings: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (porCurso) return porCurso;
  }

  // 2) Modelo por instituição
  const porInstituicao = await prisma.modeloDocumento.findFirst({
    where: {
      ativo: true,
      tipo,
      instituicaoId,
      OR: tipoAcadOr,
    },
    include: { templateMappings: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (porInstituicao) return porInstituicao;

  // 3) Modelo global (sem instituição) – opcional
  const global = await prisma.modeloDocumento.findFirst({
    where: {
      ativo: true,
      tipo,
      instituicaoId: null,
      OR: tipoAcadOr,
    },
    include: { templateMappings: true },
    orderBy: { updatedAt: 'desc' },
  });

  return global ?? null;
}

