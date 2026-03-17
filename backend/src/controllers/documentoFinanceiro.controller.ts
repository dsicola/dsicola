/**
 * Controller para DocumentoFinanceiro (FT, PF, GR, NC)
 * Conformidade AGT - emissão de Pró-forma, Guia de Remessa, Nota de Crédito, Fatura a partir de Pró-forma
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import {
  criarProforma,
  criarGuiaRemessa,
  criarNotaCredito,
  criarFaturaBaseadaEmProforma,
  type LinhaDocumentoFiscal,
} from '../services/documentoFinanceiro.service.js';
import { gerarPdfDocumentoFinanceiro } from '../services/documentoFinanceiroPdf.service.js';

/**
 * Listar documentos financeiros (FT, PF, GR, NC) da instituição
 */
export const listar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { tipo, limit } = req.query as { tipo?: string; limit?: string | number };
    const limitStr = limit === undefined || limit === null ? '100' : String(limit);

    const where: Record<string, unknown> = { ...filter };
    if (tipo && ['FT', 'PF', 'GR', 'NC', 'RC'].includes(tipo)) {
      where.tipoDocumento = tipo;
    }

    const docs = await prisma.documentoFinanceiro.findMany({
      where,
      include: {
        linhas: { select: { descricao: true, quantidade: true, precoUnitario: true, valorTotal: true, taxaIVA: true, taxExemptionCode: true } },
      },
      orderBy: { dataDocumento: 'desc' },
      take: Math.min(parseInt(limitStr, 10) || 100, 500),
    });

    // Enriquecer entidade (aluno) se existir
    const entidadeIds = [...new Set(docs.map((d) => d.entidadeId).filter(Boolean))];
    const users =
      entidadeIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: entidadeIds as string[] } },
            select: { id: true, nomeCompleto: true, email: true, numeroIdentificacao: true, numeroIdentificacaoPublica: true },
          })
        : [];
    const entidadeMap = new Map(users.map((u) => [u.id, u]));

    const resultado = docs.map((d) => ({
      ...d,
      entidade: d.entidadeId ? entidadeMap.get(d.entidadeId) ?? null : null,
    }));

    res.json(resultado);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar documento por ID
 */
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const doc = await prisma.documentoFinanceiro.findFirst({
      where: { id, ...filter },
      include: {
        linhas: true,
        documentoBase: { select: { id: true, numeroDocumento: true, tipoDocumento: true } },
      },
    });

    if (!doc) {
      return res.status(404).json({ message: 'Documento não encontrado' });
    }

    if (doc.entidadeId) {
      const user = await prisma.user.findUnique({
        where: { id: doc.entidadeId },
        select: { id: true, nomeCompleto: true, email: true, numeroIdentificacao: true, numeroIdentificacaoPublica: true },
      });
      (doc as Record<string, unknown>).entidade = user;
    }

    res.json(doc);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar Pró-forma
 * POST /documentos-financeiros/proforma
 */
export const criarProformaAction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { entidadeId, linhas, moeda, valorDescontoGlobal } = req.body as {
      entidadeId: string;
      linhas: LinhaDocumentoFiscal[];
      moeda?: string;
      valorDescontoGlobal?: number;
    };

    if (!entidadeId || !linhas || !Array.isArray(linhas) || linhas.length === 0) {
      return res.status(400).json({ message: 'entidadeId e linhas são obrigatórios' });
    }

    const linhasValidas: LinhaDocumentoFiscal[] = linhas.map((l) => ({
      descricao: String(l.descricao || 'Item'),
      quantidade: Number(l.quantidade) || 1,
      precoUnitario: Number(l.precoUnitario) || 0,
      valorDesconto: l.valorDesconto != null ? Number(l.valorDesconto) : undefined,
      taxaIVA: l.taxaIVA != null ? Number(l.taxaIVA) : undefined,
      taxExemptionCode: l.taxExemptionCode ?? undefined,
    }));

    const id = await criarProforma(instituicaoId, entidadeId, linhasValidas, {
      moeda: moeda && ['AOA', 'USD', 'EUR'].includes(moeda) ? moeda : undefined,
      valorDescontoGlobal:
        valorDescontoGlobal != null && Number(valorDescontoGlobal) >= 0 ? Number(valorDescontoGlobal) : undefined,
    });

    const doc = await prisma.documentoFinanceiro.findUnique({
      where: { id },
      include: { linhas: true },
    });

    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar Guia de Remessa
 * POST /documentos-financeiros/guia-remessa
 */
export const criarGuiaRemessaAction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { entidadeId, linhas, moeda, valorDescontoGlobal } = req.body as {
      entidadeId: string;
      linhas: LinhaDocumentoFiscal[];
      moeda?: string;
      valorDescontoGlobal?: number;
    };

    if (!entidadeId || !linhas || !Array.isArray(linhas) || linhas.length === 0) {
      return res.status(400).json({ message: 'entidadeId e linhas são obrigatórios' });
    }

    const linhasValidas: LinhaDocumentoFiscal[] = linhas.map((l) => ({
      descricao: String(l.descricao || 'Item'),
      quantidade: Number(l.quantidade) || 1,
      precoUnitario: Number(l.precoUnitario) || 0,
      valorDesconto: l.valorDesconto != null ? Number(l.valorDesconto) : undefined,
      taxaIVA: l.taxaIVA != null ? Number(l.taxaIVA) : undefined,
      taxExemptionCode: l.taxExemptionCode ?? undefined,
    }));

    const id = await criarGuiaRemessa(instituicaoId, entidadeId, linhasValidas, {
      moeda: moeda && ['AOA', 'USD', 'EUR'].includes(moeda) ? moeda : undefined,
      valorDescontoGlobal:
        valorDescontoGlobal != null && Number(valorDescontoGlobal) >= 0 ? Number(valorDescontoGlobal) : undefined,
    });

    const doc = await prisma.documentoFinanceiro.findUnique({
      where: { id },
      include: { linhas: true },
    });

    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
};

/**
 * Gerar Fatura a partir de Pró-forma
 * POST /documentos-financeiros/fatura-de-proforma
 */
export const criarFaturaDeProformaAction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { proformaId } = req.body as { proformaId: string };

    if (!proformaId) {
      return res.status(400).json({ message: 'proformaId é obrigatório' });
    }

    const id = await criarFaturaBaseadaEmProforma(proformaId, instituicaoId);

    const doc = await prisma.documentoFinanceiro.findUnique({
      where: { id },
      include: { linhas: true, documentoBase: { select: { numeroDocumento: true } } },
    });

    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
};

/**
 * Download PDF do DocumentoFinanceiro (FT, NC, PF, GR)
 * GET /documentos-financeiros/:id/pdf
 * Conformidade AGT: texto fiscal [4 chars hash]-Processado por programa válido n31.1/AGT20
 */
export const downloadPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);
    const pdfBuffer = await gerarPdfDocumentoFinanceiro(id, instituicaoId);
    const doc = await prisma.documentoFinanceiro.findFirst({
      where: { id, instituicaoId },
      select: { numeroDocumento: true, tipoDocumento: true },
    });
    const filename = `${doc?.tipoDocumento || 'DOC'}-${doc?.numeroDocumento || id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Anular DocumentoFinanceiro (FT, RC, NC, PF, GR)
 * POST /documentos-financeiros/:id/anular
 * Conformidade AGT: marca estado como ESTORNADO
 */
export const anularDocumentoFinanceiroAction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);

    const { anularDocumentoFinanceiro } = await import('../services/documentoFinanceiro.service.js');
    await anularDocumentoFinanceiro(id, instituicaoId);

    const doc = await prisma.documentoFinanceiro.findUnique({
      where: { id },
      include: { linhas: true },
    });

    res.json(doc);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar Nota de Crédito
 * POST /documentos-financeiros/nota-credito
 */
export const criarNotaCreditoAction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { faturaId, valorCredito, motivo, moeda } = req.body as {
      faturaId: string;
      valorCredito: number;
      motivo: string;
      moeda?: string;
    };

    if (!faturaId || valorCredito == null || valorCredito <= 0) {
      return res.status(400).json({ message: 'faturaId e valorCredito (positivo) são obrigatórios' });
    }

    const id = await criarNotaCredito(
      faturaId,
      instituicaoId,
      Number(valorCredito),
      motivo || 'Ajuste de valor',
      { moeda: moeda && ['AOA', 'USD', 'EUR'].includes(moeda) ? moeda : undefined }
    );

    const doc = await prisma.documentoFinanceiro.findUnique({
      where: { id },
      include: { linhas: true, documentoBase: { select: { numeroDocumento: true } } },
    });

    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
};
