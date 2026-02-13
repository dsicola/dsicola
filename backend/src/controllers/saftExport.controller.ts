import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    
    const exports = await prisma.saftExport.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(exports);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    const saftExport = await prisma.saftExport.findFirst({
      where: { id, ...filter },
    });
    
    if (!saftExport) {
      throw new AppError('Exportação SAFT não encontrada', 404);
    }
    
    res.json(saftExport);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO MULTI-TENANT: Rejeitar explicitamente instituicaoId do body (segurança)
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição. O sistema usa a instituição do usuário autenticado.', 400);
    }

    const data = req.body;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    
    const saftExport = await prisma.saftExport.create({
      data: {
        instituicaoId,
        usuarioId: userId || data.usuario_id,
        usuarioNome: req.user?.email || data.usuario_nome,
        usuarioEmail: req.user?.email || data.usuario_email,
        periodoInicio: new Date(data.periodo_inicio),
        periodoFim: new Date(data.periodo_fim),
        arquivoNome: data.arquivo_nome,
        totalClientes: data.total_clientes,
        totalProdutos: data.total_produtos,
        totalFaturas: data.total_faturas,
        totalDocumentos: data.total_documentos,
        valorTotal: data.valor_total || data.total_valor,
        status: data.status || 'gerado',
      },
    });
    
    res.status(201).json(saftExport);
  } catch (error) {
    next(error);
  }
};

export const generate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dataInicio, dataFim, tipoExportacao } = req.body;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    
    // Generate SAFT-AO XML (simplified - real implementation would be more complex)
    const saftExport = await prisma.saftExport.create({
      data: {
        instituicaoId,
        usuarioId: userId,
        usuarioNome: req.user?.email,
        usuarioEmail: req.user?.email,
        periodoInicio: new Date(dataInicio),
        periodoFim: new Date(dataFim),
        arquivoNome: `saft-${Date.now()}.xml`,
        status: 'gerado',
      },
    });
    
    res.status(201).json(saftExport);
  } catch (error) {
    next(error);
  }
};

export const download = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    const saftExport = await prisma.saftExport.findFirst({
      where: { id, ...filter },
    });
    
    if (!saftExport) {
      throw new AppError('Exportação não encontrada', 404);
    }
    
    // In a real implementation, this would generate and return the XML file
    res.json({ message: 'Download disponível', arquivoUrl: saftExport.arquivoUrl });
  } catch (error) {
    next(error);
  }
};
