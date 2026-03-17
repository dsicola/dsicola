import prisma from '../lib/prisma.js';

export type TipoModeloDocumento =
  | 'CERTIFICADO'
  | 'DECLARACAO_MATRICULA'
  | 'DECLARACAO_FREQUENCIA'
  | 'MINI_PAUTA'
  | 'PAUTA_CONCLUSAO';

interface GetModeloDocumentoAtivoParams {
  instituicaoId: string;
  tipo: TipoModeloDocumento;
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
  cursoId?: string | null;
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

  // 1) Modelo específico por curso (com instituicaoId para isolamento multi-tenant)
  if (cursoId) {
    const porCurso = await prisma.modeloDocumento.findFirst({
      where: {
        ativo: true,
        tipo,
        instituicaoId,
        cursoId,
        OR: [
          { tipoAcademico: null },
          { tipoAcademico: tipoAcademico ?? undefined },
        ],
      },
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
      OR: [
        { tipoAcademico: null },
        { tipoAcademico: tipoAcademico ?? undefined },
      ],
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (porInstituicao) return porInstituicao;

  // 3) Modelo global (sem instituição) – opcional
  const global = await prisma.modeloDocumento.findFirst({
    where: {
      ativo: true,
      tipo,
      instituicaoId: null,
      OR: [
        { tipoAcademico: null },
        { tipoAcademico: tipoAcademico ?? undefined },
      ],
    },
    orderBy: { updatedAt: 'desc' },
  });

  return global ?? null;
}

