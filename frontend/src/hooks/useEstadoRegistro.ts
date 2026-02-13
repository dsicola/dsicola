import { useMemo } from 'react';

/**
 * Estados padronizados do sistema
 */
export type EstadoRegistro = 'RASCUNHO' | 'EM_REVISAO' | 'APROVADO' | 'ENCERRADO';

/**
 * Hook para verificar permissões de edição baseado no estado
 */
export function useEstadoRegistro(estado: EstadoRegistro | string | null | undefined) {
  const permiteEdicao = useMemo(() => {
    if (!estado) return true; // Se não tiver estado, permite (compatibilidade)
    return estado.toUpperCase() !== 'ENCERRADO';
  }, [estado]);

  const estaEncerrado = useMemo(() => {
    if (!estado) return false;
    return estado.toUpperCase() === 'ENCERRADO';
  }, [estado]);

  const mensagemBloqueio = useMemo(() => {
    if (estaEncerrado) {
      return 'Este registro está encerrado. Alterações não são permitidas.';
    }
    return null;
  }, [estaEncerrado]);

  return {
    permiteEdicao,
    estaEncerrado,
    mensagemBloqueio,
    estado: estado as EstadoRegistro | null,
  };
}

