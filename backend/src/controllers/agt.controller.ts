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

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    let ano1 = anoAtual;
    let mes1Num = mesAtual - 2;
    if (mes1Num <= 0) {
      mes1Num += 12;
      ano1--;
    }
    let ano2 = anoAtual;
    let mes2Num = mesAtual - 1;
    if (mes2Num <= 0) {
      mes2Num += 12;
      ano2--;
    }
    const mes1 = `${ano1}-${String(mes1Num).padStart(2, '0')}-15`;
    const mes2 = `${ano2}-${String(mes2Num).padStart(2, '0')}-15`;

    await gerarDocumentosTesteAgt(instituicaoId, mes1);
    await gerarDocumentosTesteAgt(instituicaoId, mes2);

    const nomesMeses: Record<number, string> = {
      1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho',
      7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro',
    };

    res.status(200).json({
      success: true,
      mensagem: `Documentos AGT criados para ${inst.nome} (${nomesMeses[mes1Num]} ${ano1} e ${nomesMeses[mes2Num]} ${ano2}). Aceda a Documentos Fiscais → Lista e exporte o SAF-T.`,
    });
  } catch (error) {
    next(error);
  }
}
