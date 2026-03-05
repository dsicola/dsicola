import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope, getInstituicaoIdFromAuth } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';
import { gerarXmlSaftAo } from '../services/saft.service.js';

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

    // Log de auditoria para conformidade fiscal (requisito 7)
    AuditService.logCreate(req, {
      modulo: ModuloAuditoria.SAFT,
      entidade: EntidadeAuditoria.SAFT_EXPORT,
      entidadeId: saftExport.id,
      dadosNovos: {
        saftExportId: saftExport.id,
        instituicaoId,
        periodoInicio: data.periodo_inicio,
        periodoFim: data.periodo_fim,
        arquivoNome: data.arquivo_nome,
        totalClientes: data.total_clientes,
        totalFaturas: data.total_faturas,
        valorTotal: data.valor_total || data.total_valor,
      },
    }).catch((err) => console.error('[SAFT] Erro ao registrar log de auditoria:', err));

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

/**
 * GET /saft-exports/export?instituicaoId=&ano=&mes=
 * Gera XML SAFT-AO a partir de DocumentoFinanceiro (fonte de verdade)
 * Regras: instituicaoId obrigatório, ano obrigatório, mes opcional (1-12)
 */
export const exportXml = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = getInstituicaoIdFromAuth(req);
    if (!instituicaoId) {
      throw new AppError('instituicaoId é obrigatório para exportação SAFT', 400);
    }

    const ano = parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : undefined;

    if (isNaN(ano) || ano < 2000 || ano > 2100) {
      throw new AppError('Ano inválido', 400);
    }
    if (mes !== undefined && (mes < 1 || mes > 12)) {
      throw new AppError('Mês deve ser entre 1 e 12', 400);
    }

    const xml = await gerarXmlSaftAo({ instituicaoId, ano, mes });

    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { nome: true },
    });
    const nomeLimpo = (instituicao?.nome || 'INSTITUICAO')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '-')
      .replace(/-+/g, '-');
    const filename = `saft-${nomeLimpo}-${ano}${mes ? `-${String(mes).padStart(2, '0')}` : ''}.xml`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xml);
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
