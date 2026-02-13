import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';

/**
 * Buscar documento fiscal por ID do pagamento
 */
export const getByPagamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pagamentoId } = req.params;
    const filter = addInstitutionFilter(req);

    // Buscar pagamento com documento fiscal
    const pagamento = await prisma.pagamentoLicenca.findFirst({
      where: {
        id: pagamentoId,
        ...filter,
      },
      include: {
        documentoFiscal: true,
        instituicao: {
          include: {
            configuracao: {
              select: {
                nif: true,
              },
            },
          },
        },
        assinatura: {
          include: {
            plano: true,
          },
        },
      },
    });

    if (!pagamento) {
      throw new AppError('Pagamento não encontrado ou não pertence à sua instituição', 404);
    }

    // VALIDAÇÃO: Só pode acessar documento se pagamento estiver PAID
    if (pagamento.status !== 'PAID') {
      throw new AppError(
        'Documento fiscal só está disponível para pagamentos com status PAID',
        400
      );
    }

    if (!pagamento.documentoFiscal) {
      throw new AppError('Documento fiscal não encontrado para este pagamento', 404);
    }

    res.json({
      documento: pagamento.documentoFiscal,
      pagamento: {
        id: pagamento.id,
        plano: pagamento.plano,
        valor: pagamento.valor,
        periodo: pagamento.periodo,
        metodo: pagamento.metodo,
        referencia: pagamento.referencia,
        pagoEm: pagamento.pagoEm,
      },
      instituicao: pagamento.instituicao ? {
        id: pagamento.instituicao.id,
        nome: pagamento.instituicao.nome,
        logoUrl: pagamento.instituicao.logoUrl,
        emailContato: pagamento.instituicao.emailContato,
        telefone: pagamento.instituicao.telefone,
        endereco: pagamento.instituicao.endereco,
        configuracao: pagamento.instituicao.configuracao,
      } : null,
      planoSnapshot: pagamento.assinatura?.plano,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar documentos fiscais
 * Instituição vê apenas os seus
 * SUPER_ADMIN vê todos
 */
export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);

    const documentos = await prisma.documentoFiscal.findMany({
      where: filter,
      include: {
        pagamentoLicenca: {
          select: {
            id: true,
            plano: true,
            valor: true,
            periodo: true,
            status: true,
            metodo: true,
            pagoEm: true,
            instituicao: {
              select: {
                id: true,
                nome: true,
                subdominio: true,
              },
            },
          },
        },
      },
      orderBy: {
        dataEmissao: 'desc',
      },
    });

    res.json(documentos);
  } catch (error) {
    next(error);
  }
};

