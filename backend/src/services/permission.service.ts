import { Request } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { UserRole } from '@prisma/client';
import { AuditService } from './audit.service.js';

export type TipoPermissao = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'CLOSE' | 'REOPEN' | 'BLOCK' | 'EXPORT';
export type ModuloPermissao = 'CALENDARIO_ACADEMICO' | 'PLANO_ENSINO' | 'DISTRIBUICAO_AULAS' | 'LANCAMENTO_AULAS' | 'PRESENCAS' | 'AVALIACOES_NOTAS' | 'USUARIOS' | 'TURMAS' | 'DISCIPLINAS' | 'CURSOS' | 'MATRICULAS' | 'FINANCEIRO';

export interface ContextoPermissao {
  cursoId?: string;
  disciplinaId?: string;
  turmaId?: string;
  anoLetivo?: number;
}

export interface EstadoWorkflow {
  status?: string;
  bloqueado?: boolean;
}

/**
 * Serviço centralizado de permissões (RBAC + Contexto + Workflow)
 * Controla acesso baseado em:
 * 1. Perfil do usuário (Role)
 * 2. Contexto académico (curso, disciplina, turma)
 * 3. Estado do workflow (status do registro)
 */
export class PermissionService {
  /**
   * Verificar se usuário tem permissão para ação
   */
  static async checkPermission(
    req: Request,
    modulo: ModuloPermissao,
    acao: TipoPermissao,
    recurso: string,
    contexto?: ContextoPermissao,
    estadoWorkflow?: EstadoWorkflow
  ): Promise<boolean> {
    if (!req.user) {
      return false;
    }

    // SUPER_ADMIN tem acesso total
    if (req.user.roles.includes('SUPER_ADMIN')) {
      return true;
    }

    // AUDITOR só tem permissão READ
    if (req.user.roles.includes('AUDITOR') && acao !== 'READ') {
      return false;
    }

    // Verificar permissão baseada em role
    const hasRolePermission = await this.checkRolePermission(
      req.user.roles,
      modulo,
      acao,
      recurso,
      contexto
    );

    if (!hasRolePermission) {
      return false;
    }

    // Verificar contexto académico
    if (contexto) {
      const hasContext = await this.checkContext(req, contexto);
      if (!hasContext) {
        return false;
      }
    }

    // Verificar estado do workflow
    if (estadoWorkflow) {
      const hasWorkflow = await this.checkWorkflowState(req, modulo, acao, estadoWorkflow);
      if (!hasWorkflow) {
        return false;
      }
    }

    return true;
  }

  /**
   * Verificar permissão baseada em role
   */
  private static async checkRolePermission(
    roles: UserRole[],
    modulo: ModuloPermissao,
    acao: TipoPermissao,
    recurso: string,
    contexto?: ContextoPermissao
  ): Promise<boolean> {
    // Buscar permissão (se tabela existir, caso contrário usar lógica hardcoded)
    // TODO: Implementar busca em tabela quando migration for criada
    // Por enquanto, usar lógica baseada em roles
    
    // Verificar permissões básicas por role
    if (this.hasBasicPermission(roles, modulo, acao)) {
      return true;
    }

    // Tentar buscar permissão na tabela (pode não existir ainda)
    try {
      // Verificar se tabela existe
      const permission = await (prisma as any).permission?.findFirst({
        where: {
          modulo: modulo as any,
          acao: acao as any,
          recurso,
          ativo: true,
        },
      include: {
        rolePermissions: {
          where: {
            role: { in: roles },
          },
        },
      },
    });

    if (!permission || permission.rolePermissions.length === 0) {
      return false;
    }

    // Verificar restrições contextuais na role_permission
    for (const rolePerm of permission.rolePermissions) {
      if (rolePerm.contextos) {
        const contextos = rolePerm.contextos as any;
        if (contexto) {
          // Verificar se contexto está permitido
          if (contextos.cursoId && !contextos.cursoId.includes(contexto.cursoId)) {
            continue;
          }
          if (contextos.disciplinaId && !contextos.disciplinaId.includes(contexto.disciplinaId)) {
            continue;
          }
          if (contextos.turmaId && !contextos.turmaId.includes(contexto.turmaId)) {
            continue;
          }
        }
      }
      return true; // Permissão encontrada e contexto válido
    }

    return false;
    } catch (error) {
      // Se tabela não existir ou houver erro, usar fallback
      return false;
    }
  }

  /**
   * Verificar permissões básicas por role (fallback se tabela não existir)
   */
  private static hasBasicPermission(
    roles: UserRole[],
    modulo: ModuloPermissao,
    acao: TipoPermissao
  ): boolean {
    // ADMIN, DIRECAO têm acesso total
    if (roles.some(r => ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].includes(r))) {
      return true;
    }

    // AUDITOR só pode ler
    if (roles.includes('AUDITOR')) {
      return acao === 'READ';
    }

    // Regras específicas por módulo e role
    switch (modulo) {
      case 'PLANO_ENSINO':
        if (roles.includes('PROFESSOR')) {
          return ['CREATE', 'UPDATE', 'READ', 'SUBMIT'].includes(acao);
        }
        if (roles.includes('COORDENADOR')) {
          return ['READ', 'APPROVE', 'REJECT'].includes(acao);
        }
        break;

      case 'LANCAMENTO_AULAS':
        if (roles.includes('PROFESSOR')) {
          return ['CREATE', 'READ'].includes(acao);
        }
        break;

      case 'PRESENCAS':
        if (roles.includes('PROFESSOR')) {
          return ['CREATE', 'UPDATE', 'READ'].includes(acao);
        }
        break;

      case 'AVALIACOES_NOTAS':
        if (roles.includes('PROFESSOR')) {
          return ['CREATE', 'UPDATE', 'READ', 'CLOSE'].includes(acao);
        }
        if (roles.includes('ALUNO')) {
          return acao === 'READ';
        }
        break;

      case 'CALENDARIO_ACADEMICO':
        if (roles.some(r => ['ADMIN', 'DIRECAO', 'SECRETARIA'].includes(r))) {
          return ['CREATE', 'UPDATE', 'DELETE', 'READ'].includes(acao);
        }
        return acao === 'READ';
    }

    return false;
  }

  /**
   * Verificar contexto académico do usuário
   * Professores só podem atuar em disciplinas/turmas atribuídas
   * Coordenadores só podem atuar em cursos sob coordenação
   */
  private static async checkContext(req: Request, contexto: ContextoPermissao): Promise<boolean> {
    if (!req.user) {
      return false;
    }

    const { cursoId, disciplinaId, turmaId, anoLetivo } = contexto;

    // ADMIN, DIRECAO, SECRETARIA têm acesso total ao contexto
    if (req.user.roles.some(r => ['ADMIN', 'DIRECAO', 'SECRETARIA'].includes(r))) {
      return true;
    }

    // Verificar contexto do usuário
    const userContexts = await prisma.userContext.findMany({
      where: {
        userId: req.user.userId,
        ativo: true,
        instituicaoId: req.user.instituicaoId || undefined,
        ...(anoLetivo && { anoLetivo }),
      },
    });

    if (userContexts.length === 0) {
      return false;
    }

    // PROFESSOR: verificar se tem atribuição para disciplina/turma
    if (req.user.roles.includes('PROFESSOR')) {
      const hasDisciplina = !disciplinaId || userContexts.some(
        uc => uc.tipo === 'PROFESSOR_DISCIPLINA' && uc.disciplinaId === disciplinaId
      );
      const hasTurma = !turmaId || userContexts.some(
        uc => uc.tipo === 'PROFESSOR_TURMA' && uc.turmaId === turmaId
      );
      return hasDisciplina && hasTurma;
    }

    // COORDENADOR: verificar se coordena o curso
    if (req.user.roles.includes('COORDENADOR')) {
      if (!cursoId) {
        return true; // Sem curso específico, pode acessar
      }
      return userContexts.some(
        uc => uc.tipo === 'COORDENADOR_CURSO' && uc.cursoId === cursoId
      );
    }

    return true;
  }

  /**
   * Verificar estado do workflow
   * Nenhuma ação fora do estado permitido deve ser aceita
   */
  private static async checkWorkflowState(
    req: Request,
    modulo: ModuloPermissao,
    acao: TipoPermissao,
    estado: EstadoWorkflow
  ): Promise<boolean> {
    if (!estado.status) {
      return true; // Sem estado específico, permitir
    }

    const { status, bloqueado } = estado;

    // Regras específicas por módulo e ação
    switch (modulo) {
      case 'PLANO_ENSINO':
        return this.checkPlanoEnsinoWorkflow(req, acao, status, bloqueado);

      case 'LANCAMENTO_AULAS':
        return this.checkLancamentoAulasWorkflow(req, acao, status);

      case 'PRESENCAS':
        return this.checkPresencasWorkflow(req, acao, status);

      case 'AVALIACOES_NOTAS':
        return this.checkAvaliacoesWorkflow(req, acao, status, bloqueado);

      case 'CALENDARIO_ACADEMICO':
        return this.checkCalendarioWorkflow(req, acao, status);

      default:
        return true;
    }
  }

  /**
   * Workflow específico: PLANO DE ENSINO
   */
  private static checkPlanoEnsinoWorkflow(
    req: Request,
    acao: TipoPermissao,
    status: string,
    bloqueado?: boolean
  ): boolean {
    // Se bloqueado, só ADMIN/DIRECAO pode reabrir
    const acaoStr = acao as string;
    if (bloqueado && acaoStr !== 'REOPEN') {
      if (req.user?.roles.some(r => ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].includes(r))) {
        return acaoStr === 'REOPEN';
      }
      return false;
    }

    switch (status) {
      case 'RASCUNHO':
        // UPDATE, SUBMIT permitidos para criador (professor)
        if (['UPDATE', 'SUBMIT'].includes(acao)) {
          return true;
        }
        // DELETE permitido para professor ou ADMIN
        if (acao === 'DELETE') {
          return req.user?.roles.some(r => ['PROFESSOR', 'ADMIN', 'DIRECAO', 'SUPER_ADMIN'].includes(r)) || false;
        }
        return false;

      case 'SUBMETIDO':
        // Apenas leitura para professor
        // APPROVE/REJECT para COORDENADOR/DIRECAO/ADMIN
        if (['APPROVE', 'REJECT'].includes(acao)) {
          return req.user?.roles.some(r => ['COORDENADOR', 'DIRECAO', 'ADMIN', 'SUPER_ADMIN'].includes(r)) || false;
        }
        if (acao === 'REOPEN') {
          return req.user?.roles.some(r => ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].includes(r)) || false;
        }
        return acao === 'READ';

      case 'APROVADO':
        // Bloqueado - apenas ADMIN/DIRECAO pode reabrir
        if (acao === 'REOPEN') {
          return req.user?.roles.some(r => ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].includes(r)) || false;
        }
        return acao === 'READ' || acao === 'CLOSE';

      case 'REJEITADO':
        // Pode voltar para RASCUNHO
        if (acao === 'UPDATE') {
          return req.user?.roles.some(r => ['PROFESSOR', 'ADMIN', 'DIRECAO', 'SUPER_ADMIN'].includes(r)) || false;
        }
        return acao === 'READ';

      default:
        return false;
    }
  }

  /**
   * Workflow específico: LANÇAMENTO DE AULAS
   */
  private static checkLancamentoAulasWorkflow(
    req: Request,
    acao: TipoPermissao,
    status: string
  ): boolean {
    if (status === 'MINISTRADA') {
      // Aula já lançada - bloqueado para edição
      // Apenas ADMIN/DIRECAO pode reabrir
      if (acao === 'REOPEN') {
        return req.user?.roles.some(r => ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].includes(r)) || false;
      }
      return acao === 'READ';
    }

    // Aula planejada - pode lançar
    return acao === 'CREATE' || acao === 'READ';
  }

  /**
   * Workflow específico: PRESENÇAS
   */
  private static checkPresencasWorkflow(
    req: Request,
    acao: TipoPermissao,
    status: string
  ): boolean {
    // Presenças podem ser editadas até fechamento do trimestre
    // Por enquanto, permitir UPDATE para professor
    // TODO: Verificar se trimestre está fechado
    if (['CREATE', 'UPDATE'].includes(acao)) {
      return req.user?.roles.some(r => ['PROFESSOR', 'ADMIN', 'DIRECAO', 'SECRETARIA', 'SUPER_ADMIN'].includes(r)) || false;
    }
    return acao === 'READ';
  }

  /**
   * Workflow específico: AVALIAÇÕES / NOTAS
   */
  private static checkAvaliacoesWorkflow(
    req: Request,
    acao: TipoPermissao,
    status: string,
    bloqueado?: boolean
  ): boolean {
    if (status === 'FECHADA' || bloqueado) {
      // Avaliação fechada - apenas ADMIN/DIRECAO pode reabrir
      if (acao === 'REOPEN') {
        return req.user?.roles.some(r => ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].includes(r)) || false;
      }
      return acao === 'READ';
    }

    // Avaliação aberta
    if (['CREATE', 'UPDATE'].includes(acao)) {
      return req.user?.roles.some(r => ['PROFESSOR', 'ADMIN', 'DIRECAO', 'SECRETARIA', 'SUPER_ADMIN'].includes(r)) || false;
    }

    if (acao === 'CLOSE') {
      return req.user?.roles.some(r => ['PROFESSOR', 'ADMIN', 'DIRECAO', 'SUPER_ADMIN'].includes(r)) || false;
    }

    return acao === 'READ';
  }

  /**
   * Workflow específico: CALENDÁRIO ACADÉMICO
   */
  private static checkCalendarioWorkflow(
    req: Request,
    acao: TipoPermissao,
    status: string
  ): boolean {
    // CREATE/UPDATE/DELETE apenas para ADMIN/DIRECAO
    if (['CREATE', 'UPDATE', 'DELETE'].includes(acao)) {
      return req.user?.roles.some(r => ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].includes(r)) || false;
    }

    // Ativar/Desativar apenas DIRECAO
    if (['CLOSE', 'REOPEN'].includes(acao)) {
      return req.user?.roles.some(r => ['DIRECAO', 'SUPER_ADMIN'].includes(r)) || false;
    }

    return acao === 'READ';
  }

  /**
   * Require permission - lança erro se não tiver permissão
   */
  static async requirePermission(
    req: Request,
    modulo: ModuloPermissao,
    acao: TipoPermissao,
    recurso: string,
    contexto?: ContextoPermissao,
    estadoWorkflow?: EstadoWorkflow
  ): Promise<void> {
    const hasPermission = await this.checkPermission(req, modulo, acao, recurso, contexto, estadoWorkflow);

    if (!hasPermission) {
      // Registrar tentativa de acesso bloqueado
      await AuditService.logAccessBlocked(req, {
        modulo,
        acao,
        recurso,
        motivo: 'Permissão insuficiente',
      });

      throw new AppError(
        `Acesso negado: você não tem permissão para ${acao} em ${modulo}/${recurso}`,
        403
      );
    }
  }
}

