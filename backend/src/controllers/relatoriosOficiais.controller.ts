import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import prisma from '../lib/prisma.js';
import { 
  gerarHistoricoAcademico, 
  gerarPauta, 
  gerarCertificado,
  gerarBoletimAluno
} from '../services/relatoriosOficiais.service.js';
import { 
  verificarBloqueioAcademico, 
  TipoOperacaoBloqueada,
  registrarTentativaBloqueada,
  validarBloqueioAcademicoInstitucionalOuErro
} from '../services/bloqueioAcademico.service.js';

/**
 * Controller para Relatórios Oficiais
 * REGRA ABSOLUTA: Relatórios são SOMENTE leitura e derivados
 * Nenhum relatório pode ser editado manualmente
 * Todas as decisões devem ser feitas no backend
 */

/**
 * Gerar Histórico Acadêmico
 * GET /api/relatorios-oficiais/historico/:alunoId
 */
export const gerarHistoricoAcademicoController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { alunoId } = req.params;
    const usuarioId = req.user?.userId;

    if (!usuarioId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    if (!alunoId) {
      throw new AppError('ID do aluno é obrigatório', 400);
    }

    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno
    const tipoAcademico = req.user?.tipoAcademico || null;
    await validarBloqueioAcademicoInstitucionalOuErro(
      alunoId,
      instituicaoId,
      tipoAcademico
    );

    // Gerar histórico acadêmico (derivado de matrículas, planos, avaliações)
    const historico = await gerarHistoricoAcademico(alunoId, instituicaoId, usuarioId, tipoAcademico);

    res.json({
      success: true,
      data: historico
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gerar Pauta
 * GET /api/relatorios-oficiais/pauta/:planoEnsinoId
 * REGRA: Gerada apenas após fechamento do plano de ensino
 */
export const gerarPautaController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { planoEnsinoId } = req.params;
    const usuarioId = req.user?.userId;

    if (!usuarioId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    if (!planoEnsinoId) {
      throw new AppError('ID do plano de ensino é obrigatório', 400);
    }

    // REGRA SIGA/SIGAE: PROFESSOR só pode ver pautas dos seus próprios planos de ensino
    // ADMIN/COORDENADOR/DIRETOR podem ver qualquer pauta
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    if (isProfessor) {
      if (!req.professor?.id) {
        throw new AppError('Professor não identificado. Middleware resolveProfessor deve ser aplicado.', 500);
      }

      // Validar que o plano de ensino pertence ao professor autenticado
      const planoEnsino = await prisma.planoEnsino.findFirst({
        where: {
          id: planoEnsinoId,
          professorId: req.professor.id,
          instituicaoId,
        },
        select: { id: true },
      });

      if (!planoEnsino) {
        throw new AppError('Plano de ensino não encontrado ou você não tem permissão para visualizar esta pauta. Você só pode visualizar pautas dos seus próprios planos de ensino.', 403);
      }
    }

    // Obter tipoAcademico do JWT (req.user.tipoAcademico) - NUNCA buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;

    // Gerar pauta (apenas após fechamento do plano)
    const pauta = await gerarPauta(planoEnsinoId, instituicaoId, usuarioId, tipoAcademico);

    res.json({
      success: true,
      data: pauta
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gerar Boletim do Aluno
 * GET /api/relatorios-oficiais/boletim/:alunoId
 * REGRA: Documento somente leitura, derivado de dados reais
 * REGRA: Validar plano ativo, aulas registradas, frequência mínima
 */
export const gerarBoletimAlunoController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { alunoId } = req.params;
    const { anoLetivoId } = req.query;
    const usuarioId = req.user?.userId;

    if (!usuarioId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    if (!alunoId) {
      throw new AppError('ID do aluno é obrigatório', 400);
    }

    // Obter tipoAcademico do JWT (req.user.tipoAcademico)
    const tipoAcademico = req.user?.tipoAcademico || null;

    // Gerar boletim (documento somente leitura, derivado de dados reais)
    const boletim = await gerarBoletimAluno(
      alunoId,
      instituicaoId,
      usuarioId,
      anoLetivoId as string | undefined,
      tipoAcademico
    );

    res.json({
      success: true,
      data: boletim
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gerar Certificado
 * POST /api/relatorios-oficiais/certificado
 * REGRA: Só permitir se situação acadêmica e financeira estiverem regulares
 */
export const gerarCertificadoController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { alunoId, cursoId } = req.body;
    const usuarioId = req.user?.userId;

    if (!usuarioId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    if (!alunoId) {
      throw new AppError('ID do aluno é obrigatório', 400);
    }

    if (!cursoId) {
      throw new AppError('ID do curso é obrigatório', 400);
    }

    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno
    const tipoAcademico = req.user?.tipoAcademico || null;
    await validarBloqueioAcademicoInstitucionalOuErro(
      alunoId,
      instituicaoId,
      tipoAcademico
    );

    // Gerar certificado (com verificação de bloqueio acadêmico)
    const certificado = await gerarCertificado(alunoId, cursoId, null, instituicaoId, usuarioId, tipoAcademico ?? undefined);

    res.json({
      success: true,
      data: certificado
    });
  } catch (error) {
    // Se for erro de bloqueio, já foi registrado no log de auditoria
    next(error);
  }
};

/**
 * Verificar bloqueio acadêmico do aluno
 * GET /api/relatorios-oficiais/bloqueio/:alunoId
 */
export const verificarBloqueioController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { alunoId } = req.params;
    const { tipoOperacao } = req.query;

    if (!alunoId) {
      throw new AppError('ID do aluno é obrigatório', 400);
    }

    // Tipo de operação padrão: verificar todos os tipos
    const tiposOperacao = tipoOperacao 
      ? [tipoOperacao as TipoOperacaoBloqueada]
      : Object.values(TipoOperacaoBloqueada);

    // Verificar bloqueios para cada tipo de operação
    const resultados = await Promise.all(
      tiposOperacao.map(tipo => 
        verificarBloqueioAcademico(alunoId, instituicaoId, tipo)
      )
    );

    // Consolidar resultados
    const bloqueios = resultados.map(r => ({
      tipoOperacao: r.tipoOperacao,
      bloqueado: r.bloqueado,
      motivo: r.motivo,
      situacaoFinanceira: r.situacaoFinanceira ? {
        temMensalidadesPendentes: r.situacaoFinanceira.temMensalidadesPendentes,
        mensalidadesPendentes: r.situacaoFinanceira.mensalidadesPendentes,
        valorTotalDevido: r.situacaoFinanceira.valorTotalDevido.toString(),
        situacaoRegular: r.situacaoFinanceira.situacaoRegular
      } : null
    }));

    res.json({
      success: true,
      data: {
        alunoId,
        bloqueios,
        temBloqueio: bloqueios.some(b => b.bloqueado)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obter situação financeira do aluno
 * GET /api/relatorios-oficiais/situacao-financeira/:alunoId
 */
export const obterSituacaoFinanceiraController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { alunoId } = req.params;

    if (!alunoId) {
      throw new AppError('ID do aluno é obrigatório', 400);
    }

    // Verificar bloqueio (isso também verifica situação financeira)
    const resultado = await verificarBloqueioAcademico(
      alunoId,
      instituicaoId,
      TipoOperacaoBloqueada.MATRICULA
    );

    if (!resultado.situacaoFinanceira) {
      throw new AppError('Não foi possível obter situação financeira do aluno', 500);
    }

    res.json({
      success: true,
      data: {
        alunoId,
        situacaoRegular: resultado.situacaoFinanceira.situacaoRegular,
        temMensalidadesPendentes: resultado.situacaoFinanceira.temMensalidadesPendentes,
        mensalidadesPendentes: resultado.situacaoFinanceira.mensalidadesPendentes,
        valorTotalDevido: resultado.situacaoFinanceira.valorTotalDevido.toString(),
        diasMaiorAtraso: resultado.situacaoFinanceira.diasMaiorAtraso
      }
    });
  } catch (error) {
    next(error);
  }
};

