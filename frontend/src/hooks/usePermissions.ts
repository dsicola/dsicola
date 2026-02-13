import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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
 * Hook para verificar permissões no frontend
 * NUNCA substitui validação do backend - apenas para UI
 */
export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = useMemo(() => {
    return (
      modulo: ModuloPermissao,
      acao: TipoPermissao,
      contexto?: ContextoPermissao,
      estadoWorkflow?: EstadoWorkflow
    ): boolean => {
      if (!user?.roles || user.roles.length === 0) {
        return false;
      }

      const roles = user.roles;

      // SUPER_ADMIN tem acesso total
      if (roles.includes('SUPER_ADMIN')) {
        return true;
      }

      // AUDITOR só pode ler
      if (roles.includes('AUDITOR') && acao !== 'READ') {
        return false;
      }

      // Verificar permissões básicas por role
      return hasBasicPermission(roles, modulo, acao, estadoWorkflow);
    };
  }, [user]);

  const can = useMemo(() => {
    return {
      // Calendário Acadêmico
      criarCalendario: () => hasPermission('CALENDARIO_ACADEMICO', 'CREATE'),
      editarCalendario: () => hasPermission('CALENDARIO_ACADEMICO', 'UPDATE'),
      ativarCalendario: () => hasPermission('CALENDARIO_ACADEMICO', 'CLOSE'),

      // Plano de Ensino
      criarPlano: (contexto?: ContextoPermissao) => hasPermission('PLANO_ENSINO', 'CREATE', contexto),
      editarPlano: (contexto?: ContextoPermissao, estado?: EstadoWorkflow) => 
        hasPermission('PLANO_ENSINO', 'UPDATE', contexto, estado),
      submeterPlano: (contexto?: ContextoPermissao, estado?: EstadoWorkflow) => 
        hasPermission('PLANO_ENSINO', 'SUBMIT', contexto, estado),
      aprovarPlano: (contexto?: ContextoPermissao, estado?: EstadoWorkflow) => 
        hasPermission('PLANO_ENSINO', 'APPROVE', contexto, estado),
      rejeitarPlano: (contexto?: ContextoPermissao, estado?: EstadoWorkflow) => 
        hasPermission('PLANO_ENSINO', 'REJECT', contexto, estado),
      reabrirPlano: (contexto?: ContextoPermissao, estado?: EstadoWorkflow) => 
        hasPermission('PLANO_ENSINO', 'REOPEN', contexto, estado),

      // Lançamento de Aulas
      lancarAula: (contexto?: ContextoPermissao, estado?: EstadoWorkflow) => 
        hasPermission('LANCAMENTO_AULAS', 'CREATE', contexto, estado),
      editarAulaLancada: (contexto?: ContextoPermissao, estado?: EstadoWorkflow) => 
        hasPermission('LANCAMENTO_AULAS', 'UPDATE', contexto, estado),

      // Presenças
      lancarPresenca: (contexto?: ContextoPermissao) => 
        hasPermission('PRESENCAS', 'CREATE', contexto),
      editarPresenca: (contexto?: ContextoPermissao, estado?: EstadoWorkflow) => 
        hasPermission('PRESENCAS', 'UPDATE', contexto, estado),

      // Avaliações e Notas
      criarAvaliacao: (contexto?: ContextoPermissao) => 
        hasPermission('AVALIACOES_NOTAS', 'CREATE', contexto),
      lancarNotas: (contexto?: ContextoPermissao, estado?: EstadoWorkflow) => 
        hasPermission('AVALIACOES_NOTAS', 'UPDATE', contexto, estado),
      fecharAvaliacao: (contexto?: ContextoPermissao, estado?: EstadoWorkflow) => 
        hasPermission('AVALIACOES_NOTAS', 'CLOSE', contexto, estado),
      visualizarNotas: (contexto?: ContextoPermissao) => 
        hasPermission('AVALIACOES_NOTAS', 'READ', contexto),
    };
  }, [hasPermission]);

  return {
    hasPermission,
    can,
    roles: user?.roles || [],
  };
}

/**
 * Verificar permissões básicas por role (lógica simplificada para frontend)
 */
function hasBasicPermission(
  roles: string[],
  modulo: ModuloPermissao,
  acao: TipoPermissao,
  estadoWorkflow?: EstadoWorkflow
): boolean {
  // ADMIN, DIRECAO têm acesso total
  if (roles.some(r => ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].includes(r))) {
    return true;
  }

  // Regras específicas por módulo e role
  switch (modulo) {
    case 'PLANO_ENSINO':
      if (roles.includes('PROFESSOR')) {
        // Professor só pode editar em RASCUNHO
        if (estadoWorkflow?.status && estadoWorkflow.status !== 'RASCUNHO' && acao === 'UPDATE') {
          return false;
        }
        return ['CREATE', 'UPDATE', 'READ', 'SUBMIT'].includes(acao);
      }
      if (roles.includes('COORDENADOR')) {
        // Coordenador só pode aprovar/rejeitar em SUBMETIDO
        if (['APPROVE', 'REJECT'].includes(acao)) {
          return estadoWorkflow?.status === 'SUBMETIDO';
        }
        return ['READ'].includes(acao);
      }
      break;

    case 'LANCAMENTO_AULAS':
      if (roles.includes('PROFESSOR')) {
        // Não pode editar aula já lançada
        if (estadoWorkflow?.status === 'MINISTRADA' && acao === 'UPDATE') {
          return false;
        }
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
        // Não pode editar avaliação fechada
        if (estadoWorkflow?.status === 'FECHADA' && ['UPDATE', 'CREATE'].includes(acao)) {
          return false;
        }
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

