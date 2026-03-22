/**
 * Labels para entidades da fila offline.
 * Respeita multi-tenant e dois tipos de instituição:
 * - Ensino Superior: Cursos, disciplinas, semestres
 * - Ensino Secundário: Classes, trimestres
 *
 * Entidade `course` na fila: o rótulo traduzido por tipo (Curso vs Classe) é aplicado em
 * OfflineQueueDrawer via i18n (`institution.queueEntityCourse`).
 */
import type { QueueEntity, QueueStatus } from '@/services/offlineQueue';

const ENTITY_LABELS: Record<QueueEntity, string> = {
  student: 'Estudante',
  grade: 'Nota',
  payment: 'Pagamento',
  document: 'Documento',
  class: 'Classe',
  course: 'Curso',
  enrollment: 'Matrícula',
  other: 'Outro',
};

const METHOD_LABELS: Record<string, string> = {
  post: 'Criar',
  put: 'Atualizar',
  patch: 'Atualizar',
  delete: 'Eliminar',
};

export function getEntityLabel(entity: QueueEntity): string {
  return ENTITY_LABELS[entity] ?? 'Outro';
}

export function getMethodLabel(method: string): string {
  return METHOD_LABELS[(method || 'post').toLowerCase()] ?? 'Enviar';
}

export function getStatusLabel(status?: QueueStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Em espera';
    case 'ERROR':
      return 'Erro (será reenviado)';
    case 'FAILED':
      return 'Falha definitiva';
    case 'SYNCED':
      return 'Sincronizado';
    default:
      return 'Em espera';
  }
}
