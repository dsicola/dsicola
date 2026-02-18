/**
 * Comprovante de Admissão - Impressão PDF
 * RBAC: ADMIN, RH
 */
import { Request, Response, NextFunction } from 'express';
import { requireTenantScope } from '../middlewares/auth.js';
import { gerarPDFComprovanteAdmissao } from '../services/comprovanteAdmissao.service.js';
import { AuditService } from '../services/audit.service.js';
import prisma from '../lib/prisma.js';

export const imprimir = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id: funcionarioId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    // Obter nome do operador
    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: { nomeCompleto: true },
    });
    const operadorNome = userProfile?.nomeCompleto || req.user?.email || 'Sistema';

    const { pdfBuffer, numeroDocumento } = await gerarPDFComprovanteAdmissao(
      funcionarioId,
      instituicaoId,
      userId,
      operadorNome
    );

    // Auditoria
    AuditService.log(req, {
      modulo: 'RECURSOS_HUMANOS',
      acao: 'GENERATE_REPORT',
      entidade: 'COMPROVANTE_ADMISSAO',
      entidadeId: numeroDocumento,
      dadosNovos: { funcionarioId, numeroDocumento },
      observacao: `Comprovante de admissão ${numeroDocumento} impresso`,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="comprovante-admissao-${numeroDocumento}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
