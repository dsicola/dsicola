/**
 * Controller para geração de documentos de teste AGT via API.
 */
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { gerarDocumentosTesteAgt } from '../services/seedDocumentosTesteAgt.service.js';
import prisma from '../lib/prisma.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** POST /agt/gerar-testes-completo - Gera documentos AGT para os 2 meses (Janeiro e Fevereiro 2026) */
export async function gerarTestesAgtCompleto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let instituicaoId: string;

    if (req.user?.roles?.includes('SUPER_ADMIN')) {
      const bodyId = req.body?.instituicaoId as string;
      if (!bodyId || !UUID_REGEX.test(bodyId)) {
        throw new AppError(
          'SUPER_ADMIN deve indicar instituicaoId no body (ex: { "instituicaoId": "uuid-da-instituicao" })',
          400
        );
      }
      instituicaoId = bodyId;
    } else {
      instituicaoId = requireTenantScope(req);
    }

    const inst = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { id: true, nome: true },
    });
    if (!inst) {
      throw new AppError('Instituição não encontrada', 404);
    }

    await gerarDocumentosTesteAgt(instituicaoId, '2026-01-15');
    await gerarDocumentosTesteAgt(instituicaoId, '2026-02-15');

    res.status(200).json({
      success: true,
      mensagem: `Documentos AGT criados para ${inst.nome} (Janeiro e Fevereiro 2026). Aceda a Documentos Fiscais → Lista e exporte o SAF-T.`,
    });
  } catch (error) {
    next(error);
  }
}
