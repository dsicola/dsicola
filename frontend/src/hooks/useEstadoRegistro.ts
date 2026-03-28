import { useMemo } from 'react';

/**
 * Estados padronizados do sistema
 */
export type EstadoRegistro = 'RASCUNHO' | 'EM_REVISAO' | 'APROVADO' | 'ENCERRADO';

/** Alinhado a backend/src/middlewares/estado.middleware.ts (APROVADO e ENCERRADO bloqueiam edição). */
export function useEstadoRegistro(estado: EstadoRegistro | string | null | undefined) {
  const upper = estado?.toUpperCase();

  const permiteEdicao = useMemo(() => {
    if (!estado) return true;
    return upper !== 'ENCERRADO' && upper !== 'APROVADO';
  }, [estado, upper]);

  const estaEncerrado = useMemo(() => upper === 'ENCERRADO', [upper]);

  const estaAprovado = useMemo(() => upper === 'APROVADO', [upper]);

  const mensagemBloqueio = useMemo(() => {
    if (estaAprovado) {
      return 'Este Plano de Ensino está APROVADO e é imutável. Para alterar regras acadêmicas, crie uma nova versão do plano.';
    }
    if (estaEncerrado) {
      return 'Este registro está encerrado. Alterações não são permitidas.';
    }
    return null;
  }, [estaAprovado, estaEncerrado]);

  return {
    permiteEdicao,
    estaEncerrado,
    estaAprovado,
    mensagemBloqueio,
    estado: estado as EstadoRegistro | null,
  };
}

