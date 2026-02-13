import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';

/**
 * Hook para verificar permissões baseado no perfil do usuário
 * Implementa a matriz de permissões institucional
 */
export function useRolePermissions() {
  const { user, role } = useAuth();

  const isProfessor = useMemo(() => role === 'PROFESSOR', [role]);
  const isSecretaria = useMemo(() => role === 'SECRETARIA', [role]);
  const isAdmin = useMemo(() => role === 'ADMIN' || role === 'SUPER_ADMIN', [role]);

  /**
   * PLANO DE ENSINO
   */
  const planoEnsino = useMemo(() => ({
    // ADMIN: criar / editar / aprovar
    // SECRETARIA: criar / editar (antes de aprovado)
    // PROFESSOR: APENAS visualizar plano aprovado
    canCreate: !isProfessor, // ADMIN e SECRETARIA podem criar
    canEdit: (estado: string | null | undefined) => {
      if (isAdmin) return true;
      if (isProfessor) return false; // PROFESSOR não pode editar
      if (isSecretaria) {
        // SECRETARIA só pode editar se não estiver aprovado/encerrado
        return estado !== 'APROVADO' && estado !== 'ENCERRADO';
      }
      return false;
    },
    canApprove: isAdmin, // Apenas ADMIN pode aprovar
    canBlock: isAdmin, // Apenas ADMIN pode bloquear/encerrar
    canView: true, // Todos podem visualizar
    canViewOnlyApproved: isProfessor, // PROFESSOR só vê aprovado
  }), [isProfessor, isSecretaria, isAdmin]);

  /**
   * DISTRIBUIÇÃO DE AULAS (CALENDÁRIO)
   */
  const calendario = useMemo(() => ({
    // ADMIN: criar / editar / aprovar
    // SECRETARIA: APENAS consultar (não pode editar)
    // PROFESSOR: APENAS visualizar
    canCreate: isAdmin, // Apenas ADMIN pode criar
    canEdit: isAdmin, // Apenas ADMIN pode editar
    canView: true, // Todos podem visualizar
  }), [isAdmin]);

  /**
   * LANÇAMENTO DE AULAS
   */
  const lancamentoAulas = useMemo(() => ({
    // PROFESSOR: registrar aula realizada
    // SECRETARIA: APENAS consultar (não pode lançar)
    // ADMIN: auditoria
    canCreate: !isSecretaria, // SECRETARIA não pode criar
    canEdit: !isSecretaria, // SECRETARIA não pode editar/deletar
    canView: true, // Todos podem visualizar
  }), [isSecretaria]);

  /**
   * CONTROLE DE PRESENÇAS
   */
  const presencas = useMemo(() => ({
    // PROFESSOR: lançar presenças SOMENTE das suas aulas
    // SECRETARIA: APENAS consultar (não pode alterar)
    // ADMIN: auditoria
    canCreate: !isSecretaria, // SECRETARIA não pode criar
    canEdit: !isSecretaria, // SECRETARIA não pode editar
    canView: true, // Todos podem visualizar
  }), [isSecretaria]);

  /**
   * AVALIAÇÕES E NOTAS
   */
  const avaliacoes = useMemo(() => ({
    // PROFESSOR: criar avaliações em seus planos
    // SECRETARIA: criar/editar avaliações
    // ADMIN: auditoria
    canCreate: true, // Todos podem criar (validação de vínculo no backend)
    canEdit: (estado: string | null | undefined) => {
      if (isAdmin) return true;
      if (isProfessor) return true; // Validação de vínculo no backend
      if (isSecretaria) return true; // SECRETARIA pode editar
      return false;
    },
    canClose: isAdmin, // Apenas ADMIN pode fechar/encerrar
    canView: true,
  }), [isProfessor, isSecretaria, isAdmin]);

  const notas = useMemo(() => ({
    // PROFESSOR: lançar notas em suas avaliações
    // SECRETARIA: APENAS consultar (não pode alterar)
    // ADMIN: auditoria
    canCreate: !isSecretaria, // SECRETARIA não pode criar
    canEdit: !isSecretaria, // SECRETARIA não pode editar
    canView: true, // Todos podem visualizar
  }), [isSecretaria]);

  /**
   * FINANCEIRO / PAGAMENTOS
   */
  const financeiro = useMemo(() => ({
    // SECRETARIA: APENAS consultar (não pode registrar pagamentos)
    // POS: pode registrar pagamentos
    // ADMIN: pode tudo
    canCreate: !isSecretaria, // SECRETARIA não pode criar/registrar pagamentos
    canEdit: !isSecretaria, // SECRETARIA não pode editar pagamentos
    canView: true, // Todos podem visualizar
  }), [isSecretaria]);

  /**
   * Mensagens de erro padronizadas
   */
  const messages = useMemo(() => ({
    actionNotAllowed: 'Ação não permitida para o seu perfil.',
    professorOnlyView: 'Professores só podem visualizar planos aprovados.',
    secretariaCannotApprove: 'Secretaria não pode aprovar ou encerrar registros.',
    secretariaCannotEdit: 'Secretaria não pode alterar dados lançados por professores. Apenas consulta é permitida.',
    secretariaCannotEditCalendar: 'Secretaria não pode editar calendário acadêmico. Apenas consulta é permitida.',
    secretariaCannotRegisterPayment: 'Secretaria não pode registrar pagamentos. Encaminhe o aluno ao POS.',
    recordClosed: 'Este registro está encerrado. Alterações não são permitidas.',
    recordApproved: 'Este registro está aprovado. Alterações não são permitidas.',
    onlyAdminCanApprove: 'Apenas administradores podem aprovar ou encerrar registros.',
  }), []);

  return {
    isProfessor,
    isSecretaria,
    isAdmin,
    planoEnsino,
    calendario,
    lancamentoAulas,
    presencas,
    avaliacoes,
    notas,
    financeiro,
    messages,
  };
}

