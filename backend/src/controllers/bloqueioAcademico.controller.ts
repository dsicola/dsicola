import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { 
  buscarConfiguracaoBloqueioAcademico,
  verificarBloqueioAcademico,
  TipoOperacaoBloqueada 
} from '../services/bloqueioAcademico.service.js';
import prisma from '../lib/prisma.js';

/**
 * Controller para Configurações de Bloqueio Acadêmico
 * REGRA: Configurações avançadas por instituição
 */

/**
 * Obter configuração de bloqueio acadêmico
 * GET /api/bloqueio-academico/configuracao
 */
export const obterConfiguracaoController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const instituicaoId = requireTenantScope(req);

    const configuracao = await buscarConfiguracaoBloqueioAcademico(instituicaoId);

    res.json({
      success: true,
      data: configuracao
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar configuração de bloqueio acadêmico
 * PUT /api/bloqueio-academico/configuracao
 * REGRA: Apenas administradores podem atualizar
 */
export const atualizarConfiguracaoController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const usuarioId = req.user?.userId;

    if (!usuarioId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Verificar se usuário é administrador (ajustar conforme sistema de roles)
    if (!usuarioId) {
      throw new AppError('Usuário não autenticado', 401);
    }
    
    const usuario = await prisma.user.findUnique({
      where: { id: usuarioId },
      include: { roles: true }
    });

    const isAdmin = usuario?.roles.some(r => 
      r.role === 'ADMIN' || 
      r.role === 'COORDENADOR' ||
      r.role === 'DIRECAO' ||
      r.role === 'SUPER_ADMIN'
    );

    if (!isAdmin) {
      throw new AppError('Apenas administradores podem atualizar configurações de bloqueio acadêmico', 403);
    }

    // Validação de campos
    const {
      bloquearMatriculaPorFinanceiro,
      bloquearDocumentosPorFinanceiro,
      bloquearCertificadosPorFinanceiro,
      permitirAulasComBloqueioFinanceiro,
      permitirAvaliacoesComBloqueioFinanceiro,
      mensagemBloqueioMatricula,
      mensagemBloqueioDocumentos,
      mensagemBloqueioCertificados
    } = req.body;

    // Salvar configuração no banco
    const updateData: any = {};
    
    if (bloquearMatriculaPorFinanceiro !== undefined) {
      updateData.bloquearMatriculaPorFinanceiro = bloquearMatriculaPorFinanceiro;
    }
    if (bloquearDocumentosPorFinanceiro !== undefined) {
      updateData.bloquearDocumentosPorFinanceiro = bloquearDocumentosPorFinanceiro;
    }
    if (bloquearCertificadosPorFinanceiro !== undefined) {
      updateData.bloquearCertificadosPorFinanceiro = bloquearCertificadosPorFinanceiro;
    }
    if (permitirAulasComBloqueioFinanceiro !== undefined) {
      updateData.permitirAulasComBloqueioFinanceiro = permitirAulasComBloqueioFinanceiro;
    }
    if (permitirAvaliacoesComBloqueioFinanceiro !== undefined) {
      updateData.permitirAvaliacoesComBloqueioFinanceiro = permitirAvaliacoesComBloqueioFinanceiro;
    }
    if (mensagemBloqueioMatricula !== undefined) {
      updateData.mensagemBloqueioMatricula = mensagemBloqueioMatricula || null;
    }
    if (mensagemBloqueioDocumentos !== undefined) {
      updateData.mensagemBloqueioDocumentos = mensagemBloqueioDocumentos || null;
    }
    if (mensagemBloqueioCertificados !== undefined) {
      updateData.mensagemBloqueioCertificados = mensagemBloqueioCertificados || null;
    }

    // Verificar se configuração existe, se não, criar
    const configuracaoExistente = await prisma.configuracaoInstituicao.findUnique({
      where: { instituicaoId }
    });

    if (!configuracaoExistente) {
      // Criar configuração se não existir
      await prisma.configuracaoInstituicao.create({
        data: {
          instituicaoId,
          ...updateData
        }
      });
    } else {
      // Atualizar configuração existente
      await prisma.configuracaoInstituicao.update({
        where: { instituicaoId },
        data: updateData
      });
    }

    // Buscar configuração atualizada
    const configuracao = await buscarConfiguracaoBloqueioAcademico(instituicaoId);

    res.json({
      success: true,
      message: 'Configuração atualizada com sucesso',
      data: configuracao
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verificar bloqueio para operação específica
 * POST /api/bloqueio-academico/verificar
 */
export const verificarBloqueioOperacaoController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { alunoId, tipoOperacao } = req.body;

    if (!alunoId) {
      throw new AppError('ID do aluno é obrigatório', 400);
    }

    if (!tipoOperacao || !Object.values(TipoOperacaoBloqueada).includes(tipoOperacao)) {
      throw new AppError('Tipo de operação inválido', 400);
    }

    const resultado = await verificarBloqueioAcademico(
      alunoId,
      instituicaoId,
      tipoOperacao as TipoOperacaoBloqueada
    );

    res.json({
      success: true,
      data: {
        bloqueado: resultado.bloqueado,
        motivo: resultado.motivo,
        tipoOperacao: resultado.tipoOperacao,
        situacaoFinanceira: resultado.situacaoFinanceira ? {
          temMensalidadesPendentes: resultado.situacaoFinanceira.temMensalidadesPendentes,
          mensalidadesPendentes: resultado.situacaoFinanceira.mensalidadesPendentes,
          valorTotalDevido: resultado.situacaoFinanceira.valorTotalDevido.toString(),
          situacaoRegular: resultado.situacaoFinanceira.situacaoRegular
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
};

