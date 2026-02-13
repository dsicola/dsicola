import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnoLetivoAtivo } from '@/hooks/useAnoLetivoAtivo';
import { useAuth } from '@/contexts/AuthContext';
import { AvisoInstitucional } from './AvisoInstitucional';

interface AnoLetivoAtivoGuardProps {
  children: React.ReactNode;
  showAlert?: boolean; // Se true, mostra alerta inline; se false, bloqueia completamente
  disableChildren?: boolean; // Se true, desabilita children quando não há ano letivo ativo
  message?: string; // Mensagem customizada
}

/**
 * Componente guard que verifica se existe Ano Letivo ATIVO
 * Se não houver, mostra mensagem bloqueando ações acadêmicas
 */
export function AnoLetivoAtivoGuard({ 
  children, 
  showAlert = false, 
  disableChildren = false,
  message = "Não existe Ano Letivo ativo. Crie ou ative um Ano Letivo antes de realizar operações acadêmicas."
}: AnoLetivoAtivoGuardProps) {
  const { hasAnoLetivoAtivo, isLoading, anoLetivoAtivo } = useAnoLetivoAtivo();
  const { role } = useAuth();
  const navigate = useNavigate();

  // SUPER_ADMIN não precisa de Ano Letivo - sempre permitir acesso
  const isSuperAdmin = role === 'SUPER_ADMIN';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Se for SUPER_ADMIN, sempre permitir acesso sem verificar ano letivo
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  if (!hasAnoLetivoAtivo) {
    // Sempre mostrar aviso institucional quando não há ano letivo ativo
    // NUNCA bloquear children - apenas informar e orientar
    if (showAlert) {
      return (
        <div className="space-y-4">
          <AvisoInstitucional 
            tipo="ano-letivo"
            mensagem={message}
            variant="warning"
          />
          {/* NUNCA bloquear children - apenas informar */}
          {children}
        </div>
      );
    }

    // Se showAlert=false mas disableChildren=false, apenas mostrar children
    // Ano Letivo é contexto, não bloqueio - permitir operações estruturais
    if (!disableChildren) {
      return <>{children}</>;
    }
    
    // Apenas se explicitamente solicitado para bloquear (raro - apenas para operações críticas)
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <AvisoInstitucional 
          tipo="ano-letivo"
          mensagem={message}
          variant="warning"
        />
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Hook que retorna props para desabilitar ações quando não há ano letivo ativo
 */
export function useAnoLetivoAtivoProps() {
  const { hasAnoLetivoAtivo, anoLetivoAtivo, isLoading } = useAnoLetivoAtivo();
  const { role } = useAuth();
  
  // SUPER_ADMIN não precisa de Ano Letivo - sempre permitir ações
  const isSuperAdmin = role === 'SUPER_ADMIN';

  // Ano Letivo é contexto, não bloqueio - sempre permitir ações
  // disabled apenas para indicar visualmente que não há ano letivo ativo
  return {
    disabled: false, // NUNCA bloquear - apenas informar
    title: isSuperAdmin || hasAnoLetivoAtivo
      ? undefined
      : 'Não existe Ano Letivo ativo. As operações continuarão funcionando normalmente.',
    anoLetivoAtivo,
    hasAnoLetivoAtivo: isSuperAdmin ? true : hasAnoLetivoAtivo,
  };
}

