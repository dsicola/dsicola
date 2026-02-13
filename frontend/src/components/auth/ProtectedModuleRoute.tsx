import React from 'react';
import { Navigate } from 'react-router-dom';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface ProtectedModuleRouteProps {
  children: React.ReactNode;
  /**
   * Tipos acadêmicos permitidos para acessar esta rota
   * Se não especificado, a rota é acessível para todos os tipos
   */
  allowedTypes?: ('SECUNDARIO' | 'SUPERIOR')[];
  /**
   * Se true, redireciona para o dashboard apropriado ao invés de mostrar erro
   */
  redirectOnDeny?: boolean;
}

/**
 * Componente que protege rotas baseado no tipo acadêmico da instituição
 * Garante que apenas instituições do tipo correto possam acessar módulos específicos
 */
export const ProtectedModuleRoute: React.FC<ProtectedModuleRouteProps> = ({
  children,
  allowedTypes,
  redirectOnDeny = true,
}) => {
  const { tipoAcademico, loading } = useInstituicao();

  // Se ainda está carregando, não renderiza nada (evita flash)
  if (loading) {
    return null;
  }

  // Se não há restrição de tipo, permite acesso
  if (!allowedTypes || allowedTypes.length === 0) {
    return <>{children}</>;
  }

  // Se tipoAcademico não está definido, permite acesso (compatibilidade durante migração)
  if (!tipoAcademico) {
    return <>{children}</>;
  }

  // Verifica se o tipo acadêmico está permitido
  const isAllowed = allowedTypes.includes(tipoAcademico);

  if (!isAllowed) {
    if (redirectOnDeny) {
      // Redireciona para o dashboard apropriado baseado no tipo
      const redirectPath = tipoAcademico === 'SECUNDARIO' 
        ? '/admin-dashboard' 
        : '/admin-dashboard';
      return <Navigate to={redirectPath} replace />;
    }

    // Mostra mensagem de erro
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acesso Negado</AlertTitle>
            <AlertDescription className="mt-2">
              <p>
                Este módulo não está disponível para o tipo de instituição configurado.
                <br />
                <br />
                Tipo atual: <strong>{tipoAcademico === 'SECUNDARIO' ? 'Ensino Secundário' : 'Ensino Superior'}</strong>
                <br />
                Tipos permitidos: {allowedTypes.map(t => t === 'SECUNDARIO' ? 'Ensino Secundário' : 'Ensino Superior').join(', ')}
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

