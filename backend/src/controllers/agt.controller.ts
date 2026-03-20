/**
 * Controller para geração de documentos fiscais (amostra certificação AGT) via API.
 */
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { gerarDocumentosCertificacaoAgt } from '../services/certificacaoAgtDocumentos.service.js';
import prisma from '../lib/prisma.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** POST /agt/gerar-certificacao-completo — pacote AGT em dois meses (documentos fiscais reais). */
export async function gerarCertificacaoAgtCompleto(
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

    // 1.ª: remove o último lote de certificação AGT e cria lote novo; 2.ª: mesmo lote, outro mês
    const r1 = await gerarDocumentosCertificacaoAgt(instituicaoId, mes1, { substituirPacoteAnterior: true });
    await gerarDocumentosCertificacaoAgt(instituicaoId, mes2, {
      substituirPacoteAnterior: false,
      certificacaoAgtLoteId: r1.certificacaoAgtLoteId,
    });

    const nomesMeses: Record<number, string> = {
      1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho',
      7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro',
    };

    res.status(200).json({
      success: true,
      mensagem: `Documentos fiscais (certificação AGT) criados para ${inst.nome} (${nomesMeses[mes1Num]} ${ano1} e ${nomesMeses[mes2Num]} ${ano2}). O lote anterior do assistente AGT foi substituído; restante faturação não é apagada. Aceda a Documentos Fiscais → Lista e exporte o SAF-T.`,
      certificacaoAgtLoteId: r1.certificacaoAgtLoteId,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /agt/gerar-certificacao-minimo
 * Uma única execução no mês anterior ao atual, sem segunda pró-forma (pontos 3+12 = mesma PF na carta).
 * Cobre todos os pontos 1–11 da notificação num único lote; aluno com NIF + 2 consumidores sem NIF (9–10).
 * A AGT pede PDFs em dois meses: volte a correr este botão noutro mês ou use "Gerar todos AGT".
 */
export async function gerarCertificacaoAgtMinimo(
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
    let mes1Num = mesAtual - 1;
    if (mes1Num <= 0) {
      mes1Num = 12;
      ano1--;
    }
    const mesStr = `${ano1}-${String(mes1Num).padStart(2, '0')}-15`;

    const r = await gerarDocumentosCertificacaoAgt(instituicaoId, mesStr, {
      incluirSegundaProforma: false,
      substituirPacoteAnterior: true,
    });

    const nomesMeses: Record<number, string> = {
      1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho',
      7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro',
    };

    res.status(200).json({
      success: true,
      mensagem: `Pacote mínimo AGT: ${r.mensagem} (${nomesMeses[mes1Num]} ${ano1}). O lote anterior do assistente AGT foi removido e substituído por este (documentos fiscais reais). Um aluno com NIF + pontos 1–11; pontos 9–10 usam 2 perfis sem NIF. Para dois meses no ofício, execute de novo mais tarde ou use "Gerar todos AGT".`,
      certificacaoAgtLoteId: r.certificacaoAgtLoteId,
    });
  } catch (error) {
    next(error);
  }
}
