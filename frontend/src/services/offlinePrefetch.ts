/**
 * Prefetch de endpoints críticos após login para popular o cache offline.
 * Quando o utilizador ficar sem rede, terá dados em cache para consulta.
 */

import { api } from './api';
import { mensalidadesApi, alunosApi, cursosApi, classesApi, turmasApi, anoLetivoApi } from './api';

/** Endpoints a prefetchar por role (em background, sem bloquear) */
export async function prefetchForOffline(role: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const prefetch = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch {
      // Ignorar erros - prefetch é best-effort
    }
  };

  // Instituição: comum a todos os perfis autenticados
  prefetch(() => api.get('/instituicoes/me'));

  // Ano letivo: GET /anos-letivos só autoriza staff; ALUNO/RESPONSAVEL usam /anos-letivos/ativo
  const rolesListaAnosLetivos = new Set([
    'ADMIN',
    'SECRETARIA',
    'DIRECAO',
    'COORDENADOR',
    'PROFESSOR',
    'POS',
    'FINANCEIRO',
    'SUPER_ADMIN',
  ]);
  if (rolesListaAnosLetivos.has(role)) {
    prefetch(() => anoLetivoApi.getAll());
  } else {
    prefetch(() => anoLetivoApi.getAtivo());
  }

  switch (role) {
    case 'ADMIN':
    case 'SECRETARIA':
    case 'DIRECAO':
    case 'COORDENADOR':
    case 'FINANCEIRO':
      await Promise.all([
        prefetch(() => mensalidadesApi.getAll()),
        prefetch(() => alunosApi.getList({ page: 1, pageSize: 50 })),
        prefetch(() => turmasApi.getAll()),
      ]);
      if (role === 'ADMIN' || role === 'DIRECAO' || role === 'COORDENADOR') {
        prefetch(() => cursosApi.getAll());
        prefetch(() => classesApi.getAll());
      }
      break;
    case 'ALUNO':
      prefetch(() => mensalidadesApi.getMinhasMensalidades());
      break;
    default:
      break;
  }
}
