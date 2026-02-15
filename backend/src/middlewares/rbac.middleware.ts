import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { UserRole } from '@prisma/client';
import prisma from '../lib/prisma.js';

/**
 * ========================================
 * RBAC CENTRALIZADO - DSICOLA
 * ========================================
 * 
 * Sistema de controle de acesso baseado em roles
 * Implementa regras institucionais profissionais
 */

/**
 * Roles que operam em nível global (sem instituição específica)
 */
export const ROLES_GLOBAIS: UserRole[] = ['SUPER_ADMIN', 'COMERCIAL'];

/**
 * Tipos de módulos do sistema
 */
export enum ModuloSistema {
  // SaaS Management (SUPER_ADMIN + COMERCIAL parcial)
  SAAS_MANAGEMENT = 'SAAS_MANAGEMENT',
  INSTITUICOES = 'INSTITUICOES',
  ASSINATURAS = 'ASSINATURAS',
  PLANOS_PRECOS = 'PLANOS_PRECOS',
  EMAILS = 'EMAILS',
  LOGS_GLOBAIS = 'LOGS_GLOBAIS',
  
  // Configuração Acadêmica (ADMIN_INSTITUICAO, SECRETARIA)
  CONFIGURACAO_ENSINOS = 'CONFIGURACAO_ENSINOS',
  CALENDARIO_ACADEMICO = 'CALENDARIO_ACADEMICO',
  PLANO_ENSINO = 'PLANO_ENSINO',
  DISTRIBUICAO_AULAS = 'DISTRIBUICAO_AULAS',
  ENCERRAMENTO_ACADEMICO = 'ENCERRAMENTO_ACADEMICO',
  
  // Operações Acadêmicas (PROFESSOR, SECRETARIA, ADMIN_INSTITUICAO)
  LANCAMENTO_AULAS = 'LANCAMENTO_AULAS',
  PRESENCAS = 'PRESENCAS',
  AVALIACOES = 'AVALIACOES',
  NOTAS = 'NOTAS',
  
  // Gestão Acadêmica (SECRETARIA, ADMIN_INSTITUICAO)
  ALUNOS = 'ALUNOS',
  MATRICULAS = 'MATRICULAS',
  DOCUMENTOS_ACADEMICOS = 'DOCUMENTOS_ACADEMICOS',
  
  // Consulta (ALUNO)
  CONSULTA_NOTAS = 'CONSULTA_NOTAS',
  CONSULTA_PRESENCAS = 'CONSULTA_PRESENCAS',
  CONSULTA_CALENDARIO = 'CONSULTA_CALENDARIO',
  CONSULTA_DOCUMENTOS = 'CONSULTA_DOCUMENTOS',
  
  // Biblioteca
  BIBLIOTECA = 'BIBLIOTECA',
  
  // Financeiro
  FINANCEIRO = 'FINANCEIRO',
  FORNECEDORES = 'FORNECEDORES',
  CONTRATOS_FORNECEDOR = 'CONTRATOS_FORNECEDOR',
  PAGAMENTOS_FORNECEDOR = 'PAGAMENTOS_FORNECEDOR',
}

/**
 * Matriz de permissões por role
 */
const PERMISSOES_POR_ROLE: Record<UserRole, ModuloSistema[]> = {
  SUPER_ADMIN: [
    ModuloSistema.SAAS_MANAGEMENT,
    ModuloSistema.INSTITUICOES,
    ModuloSistema.ASSINATURAS,
    ModuloSistema.PLANOS_PRECOS,
    ModuloSistema.EMAILS,
    ModuloSistema.LOGS_GLOBAIS,
    // Financeiro - SUPER_ADMIN pode visualizar para auditoria, mas NÃO pode executar pagamentos
    ModuloSistema.FINANCEIRO,
    ModuloSistema.FORNECEDORES,
    ModuloSistema.CONTRATOS_FORNECEDOR,
    ModuloSistema.PAGAMENTOS_FORNECEDOR,
    // SUPER_ADMIN NÃO tem acesso a módulos acadêmicos
  ],
  COMERCIAL: [
    // Equipe de vendas: apenas funções comerciais (não dados acadêmicos, não logs sensíveis)
    ModuloSistema.INSTITUICOES,
    ModuloSistema.ASSINATURAS,
    ModuloSistema.PLANOS_PRECOS,
    // COMERCIAL NÃO tem: SAAS_MANAGEMENT, EMAILS, LOGS_GLOBAIS, módulos acadêmicos
  ],
  ADMIN: [
    ModuloSistema.CONFIGURACAO_ENSINOS,
    ModuloSistema.CALENDARIO_ACADEMICO,
    ModuloSistema.PLANO_ENSINO,
    ModuloSistema.DISTRIBUICAO_AULAS,
    ModuloSistema.ENCERRAMENTO_ACADEMICO,
    ModuloSistema.LANCAMENTO_AULAS,
    ModuloSistema.PRESENCAS,
    ModuloSistema.AVALIACOES,
    ModuloSistema.NOTAS,
    ModuloSistema.ALUNOS,
    ModuloSistema.MATRICULAS,
    ModuloSistema.DOCUMENTOS_ACADEMICOS,
    // Financeiro
    ModuloSistema.FINANCEIRO,
    ModuloSistema.FORNECEDORES,
    ModuloSistema.CONTRATOS_FORNECEDOR,
    ModuloSistema.PAGAMENTOS_FORNECEDOR,
  ],
  DIRECAO: [
    ModuloSistema.CONFIGURACAO_ENSINOS,
    ModuloSistema.CALENDARIO_ACADEMICO,
    ModuloSistema.PLANO_ENSINO,
    ModuloSistema.DISTRIBUICAO_AULAS,
    ModuloSistema.ENCERRAMENTO_ACADEMICO,
    ModuloSistema.LANCAMENTO_AULAS,
    ModuloSistema.PRESENCAS,
    ModuloSistema.AVALIACOES,
    ModuloSistema.NOTAS,
    ModuloSistema.ALUNOS,
    ModuloSistema.MATRICULAS,
    ModuloSistema.DOCUMENTOS_ACADEMICOS,
  ],
  COORDENADOR: [
    ModuloSistema.CONFIGURACAO_ENSINOS,
    ModuloSistema.CALENDARIO_ACADEMICO,
    ModuloSistema.PLANO_ENSINO,
    ModuloSistema.DISTRIBUICAO_AULAS,
    ModuloSistema.LANCAMENTO_AULAS,
    ModuloSistema.PRESENCAS,
    ModuloSistema.AVALIACOES,
    ModuloSistema.NOTAS,
    ModuloSistema.ALUNOS,
    ModuloSistema.MATRICULAS,
    ModuloSistema.DOCUMENTOS_ACADEMICOS,
  ],
  SECRETARIA: [
    ModuloSistema.ALUNOS,
    ModuloSistema.MATRICULAS,
    ModuloSistema.DOCUMENTOS_ACADEMICOS,
    ModuloSistema.PRESENCAS, // Ver e ajustar
    ModuloSistema.NOTAS, // Ver e ajustar
    ModuloSistema.CALENDARIO_ACADEMICO, // Ajustar datas
    // SECRETARIA NÃO pode: aprovar plano, encerrar semestre, alterar notas diretamente
  ],
  PROFESSOR: [
    ModuloSistema.LANCAMENTO_AULAS, // Apenas suas aulas
    ModuloSistema.PRESENCAS, // Apenas suas aulas
    ModuloSistema.NOTAS, // Apenas suas avaliações
    ModuloSistema.PLANO_ENSINO, // Apenas leitura (aprovado)
    // PROFESSOR NÃO pode: configurar ensinos, calendário, criar plano, distribuir aulas
  ],
  ALUNO: [
    ModuloSistema.CONSULTA_NOTAS,
    ModuloSistema.CONSULTA_PRESENCAS,
    ModuloSistema.CONSULTA_CALENDARIO,
    ModuloSistema.CONSULTA_DOCUMENTOS,
    ModuloSistema.BIBLIOTECA, // Pode consultar e solicitar empréstimos
  ],
  AUDITOR: [
    // Apenas leitura em todos os módulos
    ModuloSistema.CONFIGURACAO_ENSINOS,
    ModuloSistema.CALENDARIO_ACADEMICO,
    ModuloSistema.PLANO_ENSINO,
    ModuloSistema.PRESENCAS,
    ModuloSistema.AVALIACOES,
    ModuloSistema.NOTAS,
    ModuloSistema.ALUNOS,
    ModuloSistema.MATRICULAS,
  ],
  POS: [
    ModuloSistema.FINANCEIRO, // POS: processar pagamentos, ver recibos
    ModuloSistema.ALUNOS, // Leitura limitada para buscar aluno ao processar
    ModuloSistema.MATRICULAS, // Leitura limitada
  ],
  RESPONSAVEL: [
    ModuloSistema.CONSULTA_NOTAS,
    ModuloSistema.CONSULTA_PRESENCAS,
    ModuloSistema.CONSULTA_CALENDARIO,
    ModuloSistema.CONSULTA_DOCUMENTOS,
  ],
  RH: [
    ModuloSistema.FINANCEIRO, // Folha de pagamento
    ModuloSistema.PRESENCAS,  // Frequência de funcionários
    ModuloSistema.FORNECEDORES,
    ModuloSistema.CONTRATOS_FORNECEDOR,
    ModuloSistema.PAGAMENTOS_FORNECEDOR,
  ],
  FINANCEIRO: [
    ModuloSistema.FINANCEIRO,
    ModuloSistema.FORNECEDORES,
    ModuloSistema.CONTRATOS_FORNECEDOR,
    ModuloSistema.PAGAMENTOS_FORNECEDOR,
    ModuloSistema.ALUNOS,   // Leitura limitada (mensalidades)
    ModuloSistema.MATRICULAS, // Leitura limitada
  ],
};

/**
 * Verificar se role tem acesso ao módulo
 */
const temAcessoAoModulo = (role: UserRole, modulo: ModuloSistema): boolean => {
  const permissoes = PERMISSOES_POR_ROLE[role] || [];
  return permissoes.includes(modulo);
};

/**
 * Verificar se role está bloqueada de módulos acadêmicos
 * SUPER_ADMIN e COMERCIAL operam em nível SaaS, não acessam dados acadêmicos das instituições
 */
const estaBloqueadoDeModulosAcademicos = (role: UserRole): boolean => {
  return role === 'SUPER_ADMIN' || role === 'COMERCIAL';
};

/**
 * Verificar se role está bloqueada de configuração de ensinos
 */
const estaBloqueadoDeConfiguracaoEnsino = (role: UserRole): boolean => {
  return role === 'PROFESSOR' || role === 'ALUNO' || role === 'RESPONSAVEL';
};

/**
 * Middleware RBAC principal
 * Valida acesso baseado em módulo e role
 */
export const authorizeModule = (modulo: ModuloSistema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Não autenticado', 401));
    }

    const userRoles = req.user.roles || [];

    // Verificar se algum role do usuário tem acesso
    const temAcesso = userRoles.some(role => temAcessoAoModulo(role, modulo));

    if (!temAcesso) {
      // Verificar bloqueios específicos
      const bloqueioAcademico = userRoles.some(role => {
        if (!estaBloqueadoDeModulosAcademicos(role)) return false;
        const modulosPermitidos = role === 'COMERCIAL'
          ? [ModuloSistema.INSTITUICOES, ModuloSistema.ASSINATURAS, ModuloSistema.PLANOS_PRECOS]
          : [ModuloSistema.SAAS_MANAGEMENT, ModuloSistema.INSTITUICOES, ModuloSistema.ASSINATURAS, ModuloSistema.PLANOS_PRECOS, ModuloSistema.EMAILS, ModuloSistema.LOGS_GLOBAIS];
        return !modulosPermitidos.includes(modulo);
      });

      if (bloqueioAcademico) {
        const msg = userRoles.includes('COMERCIAL')
          ? 'Acesso negado: perfil Comercial não acessa módulos acadêmicos. Use o painel comercial.'
          : 'Acesso negado: SUPER_ADMIN não pode acessar módulos acadêmicos. Use o painel de administração SaaS.';
        return next(new AppError(msg, 403));
      }

      const bloqueioConfiguracao = userRoles.some(role => 
        estaBloqueadoDeConfiguracaoEnsino(role) && 
        modulo === ModuloSistema.CONFIGURACAO_ENSINOS
      );

      if (bloqueioConfiguracao) {
        return next(new AppError(
          'Acesso negado: você não tem permissão para acessar Configuração de Ensinos. Acesso restrito à Administração Acadêmica.',
          403
        ));
      }

      return next(new AppError(
        'Acesso negado: você não tem permissão para esta ação.',
        403
      ));
    }

    next();
  };
};

/**
 * Middleware RBAC para rotas de Configuração de Ensinos
 * Bloqueia: PROFESSOR, ALUNO, RESPONSAVEL, SUPER_ADMIN
 * Permite: ADMIN, DIRECAO, COORDENADOR, SECRETARIA
 */
export const requireConfiguracaoEnsino = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Não autenticado', 401));
  }

  const userRoles = req.user.roles || [];
  const rolesPermitidos: UserRole[] = ['ADMIN', 'DIRECAO', 'COORDENADOR', 'SECRETARIA'];

  const temAcesso = userRoles.some(role => rolesPermitidos.includes(role));

  if (!temAcesso) {
    // Verificar bloqueios específicos
    if (userRoles.includes('SUPER_ADMIN')) {
      return next(new AppError(
        'Acesso negado: SUPER_ADMIN não pode acessar módulos acadêmicos. Use o painel de administração SaaS.',
        403
      ));
    }
    if (userRoles.includes('COMERCIAL')) {
      return next(new AppError(
        'Acesso negado: perfil Comercial não acessa Configuração de Ensinos. Use o painel comercial.',
        403
      ));
    }

    if (userRoles.includes('PROFESSOR')) {
      return next(new AppError(
        'Acesso negado: você não tem permissão para acessar Configuração de Ensinos. Acesso restrito à Administração Acadêmica.',
        403
      ));
    }

    return next(new AppError(
      'Acesso negado: você não tem permissão para esta ação.',
      403
    ));
  }

  next();
};

/**
 * Middleware RBAC para bloquear roles globais (SUPER_ADMIN, COMERCIAL) de rotas acadêmicas
 */
export const blockSuperAdminFromAcademic = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Não autenticado', 401));
  }

  const userRoles = req.user.roles || [];

  if (userRoles.includes('SUPER_ADMIN')) {
    return next(new AppError(
      'Acesso negado: SUPER_ADMIN não pode acessar módulos acadêmicos. Use o painel de administração SaaS.',
      403
    ));
  }
  if (userRoles.includes('COMERCIAL')) {
    return next(new AppError(
      'Acesso negado: perfil Comercial não acessa módulos acadêmicos. Use o painel comercial.',
      403
    ));
  }

  next();
};

/**
 * Middleware RBAC para garantir que usuário tem instituicaoId
 * (exceto SUPER_ADMIN que pode não ter)
 * FALLBACK: Professor sem instituicaoId no JWT pode ter instituicaoId do registro em professores
 */
export const requireInstitution = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Não autenticado', 401));
  }

  const userRoles = req.user.roles || [];

  // Roles globais podem não ter instituicaoId (gerenciam SaaS/comercial)
  if (userRoles.some(r => ROLES_GLOBAIS.includes(r))) {
    return next();
  }

  if (!req.user.instituicaoId) {
    // FALLBACK: Professor pode ter instituicaoId apenas no registro professores
    const isProfessor = userRoles.includes('PROFESSOR') && !userRoles.includes('ADMIN') && !userRoles.includes('SUPER_ADMIN');
    const userId = req.user.userId;
    if (isProfessor && userId) {
      try {
        const prof = await prisma.professor.findFirst({
          where: { userId },
          select: { instituicaoId: true },
        });
        if (prof?.instituicaoId) {
          (req.user as any).instituicaoId = prof.instituicaoId;
          if (process.env.NODE_ENV !== 'production') {
            console.log('[requireInstitution] Professor: usando instituicaoId do registro professores:', prof.instituicaoId);
          }
          return next();
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[requireInstitution] Fallback professor falhou:', e);
        }
      }
    }
    return next(new AppError(
      isProfessor
        ? 'Professor não cadastrado na instituição. Entre em contato com a administração para solicitar o cadastro.'
        : 'Usuário sem instituição associada. Entre em contato com o administrador.',
      403
    ));
  }

  next();
};

/**
 * Helper para verificar se usuário tem role específica
 */
export const hasRole = (req: Request, role: UserRole): boolean => {
  if (!req.user) return false;
  return req.user.roles?.includes(role) || false;
};

/**
 * Helper para verificar se usuário tem alguma das roles
 */
export const hasAnyRole = (req: Request, roles: UserRole[]): boolean => {
  if (!req.user) return false;
  return roles.some(role => req.user?.roles?.includes(role)) || false;
};

