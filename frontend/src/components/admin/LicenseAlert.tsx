import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Clock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { differenceInDays, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface LicenseAlertProps {
  instituicaoId?: string;
}

// API for assinaturas
const assinaturasApi = {
  // Para SUPER_ADMIN: pode especificar instituicaoId
  // Para outros usuários: usar /current que pega do token
  getByInstituicao: async (instituicaoId?: string, isSuperAdmin?: boolean) => {
    if (isSuperAdmin && instituicaoId) {
      // SUPER_ADMIN pode especificar instituição
      const response = await api.get(`/assinaturas/instituicao/${instituicaoId}`);
      return response.data;
    } else {
      // Usuários normais: usar rota /current que pega do token
      const response = await api.get('/assinaturas/instituicao/current');
      return response.data;
    }
  },
};

export function LicenseAlert({ instituicaoId }: LicenseAlertProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN') || false;
  
  const { data: assinatura, isLoading } = useQuery({
    queryKey: ["assinatura-check", instituicaoId, isSuperAdmin],
    queryFn: async () => {
      try {
        // Se for SUPER_ADMIN e tiver instituicaoId, usar com parâmetro
        // Caso contrário, usar /current que pega do token
        const data = await assinaturasApi.getByInstituicao(instituicaoId, isSuperAdmin);
        return data;
      } catch (error) {
        // Silenciosamente retornar null em caso de erro (pode ser permissão insuficiente)
        console.warn('[LicenseAlert] Erro ao buscar assinatura:', error);
        return null;
      }
    },
    // Habilitar apenas se for SUPER_ADMIN com instituicaoId OU se não for SUPER_ADMIN (usa /current)
    enabled: (isSuperAdmin && !!instituicaoId) || (!isSuperAdmin),
  });

  if (isLoading || !assinatura) return null;

  const today = new Date();
  const dataFim = assinatura.dataFim || assinatura.data_fim ? parseISO(assinatura.dataFim || assinatura.data_fim) : null;
  const proximoPagamento = assinatura.dataProximoPagamento || assinatura.data_proximo_pagamento 
    ? parseISO(assinatura.dataProximoPagamento || assinatura.data_proximo_pagamento) 
    : null;

  const handleRenovar = () => {
    if (isSuperAdmin) {
      navigate('/superadmin-dashboard?tab=assinaturas');
    } else {
      navigate('/admin-dashboard/minha-assinatura');
    }
  };

  // Check if license is expired
  if (assinatura.status === 'expirada' || assinatura.status === 'cancelada') {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Licença Expirada!</AlertTitle>
        <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
          <span>
            A licença desta instituição está expirada. Renove para continuar utilizando o sistema.
          </span>
          <Button size="sm" variant="outline" className="ml-4 shrink-0" onClick={handleRenovar}>
            <CreditCard className="h-4 w-4 mr-2" />
            Renovar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Check if license expires soon (within 30 days)
  if (dataFim) {
    const diasRestantes = differenceInDays(dataFim, today);
    
    if (diasRestantes <= 0) {
      return (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Licença Expirada!</AlertTitle>
          <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
            <span>A licença expirou. Renove imediatamente para continuar utilizando o sistema.</span>
            <Button size="sm" variant="outline" className="ml-4 shrink-0" onClick={handleRenovar}>
              <CreditCard className="h-4 w-4 mr-2" />
              Renovar
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
    
    if (diasRestantes <= 30) {
      return (
        <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
          <Clock className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-600">Licença Expira em Breve</AlertTitle>
          <AlertDescription className="flex items-center justify-between flex-wrap gap-2 text-yellow-600">
            <span>
              A licença expira em {diasRestantes} dias ({dataFim.toLocaleDateString('pt-AO')}).
              Renove para evitar interrupções no serviço.
            </span>
            <Button size="sm" variant="outline" className="ml-4 shrink-0 border-yellow-600 text-yellow-600 hover:bg-yellow-500/20" onClick={handleRenovar}>
              <CreditCard className="h-4 w-4 mr-2" />
              Renovar
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
  }

  // Check if payment is overdue
  if (proximoPagamento && differenceInDays(today, proximoPagamento) > 0) {
    return (
      <Alert className="mb-6 border-orange-500/50 bg-orange-500/10">
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        <AlertTitle className="text-orange-600">Pagamento Pendente</AlertTitle>
        <AlertDescription className="flex items-center justify-between flex-wrap gap-2 text-orange-600">
          <span>
            O pagamento da assinatura está atrasado desde {proximoPagamento.toLocaleDateString('pt-AO')}.
            Regularize para evitar suspensão.
          </span>
          <Button size="sm" variant="outline" className="ml-4 shrink-0 border-orange-600 text-orange-600 hover:bg-orange-500/20" onClick={handleRenovar}>
            <CreditCard className="h-4 w-4 mr-2" />
            Renovar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

// Hook to check license status
export function useLicenseStatus(instituicaoId?: string) {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN') || false;
  
  const { data, isLoading } = useQuery({
    queryKey: ["license-status", instituicaoId, isSuperAdmin],
    queryFn: async () => {
      try {
        // Se for SUPER_ADMIN e tiver instituicaoId, usar com parâmetro
        // Caso contrário, usar /current que pega do token
        const assinatura = await assinaturasApi.getByInstituicao(instituicaoId, isSuperAdmin);
        if (!assinatura) return { isValid: true, status: 'unknown' };

        const today = new Date();
        const dataFim = assinatura.dataFim || assinatura.data_fim ? parseISO(assinatura.dataFim || assinatura.data_fim) : null;
        
        if (assinatura.status === 'expirada' || assinatura.status === 'cancelada') {
          return { isValid: false, status: 'expired', daysRemaining: 0 };
        }

        if (dataFim) {
          const diasRestantes = differenceInDays(dataFim, today);
          if (diasRestantes <= 0) {
            return { isValid: false, status: 'expired', daysRemaining: 0 };
          }
          if (diasRestantes <= 30) {
            return { isValid: true, status: 'expiring_soon', daysRemaining: diasRestantes };
          }
        }

        return { isValid: true, status: 'active', daysRemaining: null };
      } catch (error) {
        // Silenciosamente retornar unknown em caso de erro
        console.warn('[useLicenseStatus] Erro ao buscar assinatura:', error);
        return { isValid: true, status: 'unknown' };
      }
    },
    // Habilitar apenas se for SUPER_ADMIN com instituicaoId OU se não for SUPER_ADMIN (usa /current)
    enabled: (isSuperAdmin && !!instituicaoId) || (!isSuperAdmin),
  });

  return { ...data, isLoading };
}
