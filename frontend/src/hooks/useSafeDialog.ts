import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook global para gerenciar dialogs/portals de forma segura
 * 
 * Funcionalidades:
 * - Controla montagem/desmontagem de forma segura
 * - Previne desmontagem dupla usando refs
 * - Fecha dialog automaticamente antes de mudança de rota
 * - Garante cleanup adequado no unmount
 * 
 * @param initialOpen - Estado inicial do dialog (padrão: false)
 * @returns [open, setOpen, openDialog, closeDialog, toggleDialog]
 * 
 * @example
 * const [dialogOpen, setDialogOpen, openDialog, closeDialog] = useSafeDialog();
 * 
 * <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 *   <DialogContent>...</DialogContent>
 * </Dialog>
 */
export function useSafeDialog(initialOpen: boolean = false) {
  const [open, setOpenState] = useState<boolean>(initialOpen);
  const location = useLocation();
  const previousLocationRef = useRef<string>(location.pathname);
  const isUnmountingRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  // Função para fechar dialog de forma segura
  const closeDialog = useCallback(() => {
    if (isUnmountingRef.current || !mountedRef.current) {
      return; // Já está sendo desmontado, não fazer nada
    }
    
    setOpenState(false);
  }, []);

  // Função para abrir dialog de forma segura
  const openDialog = useCallback(() => {
    if (isUnmountingRef.current || !mountedRef.current) {
      return; // Componente está sendo desmontado, não abrir
    }
    
    setOpenState(true);
  }, []);

  // Função para alternar estado do dialog
  const toggleDialog = useCallback(() => {
    if (isUnmountingRef.current || !mountedRef.current) {
      return;
    }
    
    setOpenState(prev => !prev);
  }, []);

  // Wrapper para setOpen que previne atualizações durante desmontagem
  const setOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    if (isUnmountingRef.current || !mountedRef.current) {
      return; // Componente está sendo desmontado, não atualizar estado
    }
    
    setOpenState(value);
  }, []);

  // Detectar mudança de rota e fechar dialog automaticamente
  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousLocationRef.current;

    // Se a rota mudou e o dialog está aberto, fechar imediatamente
    // MAS apenas se o componente ainda estiver montado
    if (currentPath !== previousPath && open && mountedRef.current && !isUnmountingRef.current) {
      // Usar closeDialog que já verifica se está montado
      closeDialog();
    }

    previousLocationRef.current = currentPath;
  }, [location.pathname, open, closeDialog]);

  // Cleanup no unmount - APENAS marcar como desmontando
  // NUNCA chamar setOpenState no cleanup - isso causa Node.removeChild
  useEffect(() => {
    mountedRef.current = true;
    isUnmountingRef.current = false;
    
    return () => {
      // Marcar como desmontando ANTES de qualquer operação
      // NÃO fechar dialog aqui - o React já está desmontando o componente
      // Fechar aqui causaria tentativa de remover nó já removido
      isUnmountingRef.current = true;
      mountedRef.current = false;
    };
  }, []); // Apenas no mount/unmount

  return [open, setOpen, openDialog, closeDialog, toggleDialog] as const;
}
