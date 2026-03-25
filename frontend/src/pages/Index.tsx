import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import VendasLanding from './VendasLanding';
import InstituicaoInstitutionalLanding from './InstituicaoInstitutionalLanding';

const Index: React.FC = () => {
  const { user, role, loading } = useAuth();
  const { instituicao, isMainDomain, isSuperAdmin, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();

  const isTenantPortal = Boolean(instituicao && !isMainDomain && !isSuperAdmin);

  useEffect(() => {
    if (!loading && user && role) {
      switch (role) {
        case 'SUPER_ADMIN':
        case 'COMERCIAL':
          navigate('/super-admin');
          break;
        case 'ADMIN':
          navigate('/admin-dashboard');
          break;
        case 'PROFESSOR':
          navigate('/painel-professor');
          break;
        case 'ALUNO':
          navigate('/painel-aluno');
          break;
        case 'SECRETARIA':
          navigate('/secretaria-dashboard');
          break;
        case 'DIRECAO':
        case 'COORDENADOR':
          navigate('/admin-dashboard');
          break;
        case 'AUDITOR':
          navigate('/admin-dashboard/auditoria');
          break;
        case 'RH':
          navigate('/admin-dashboard/recursos-humanos');
          break;
        case 'FINANCEIRO':
          navigate('/admin-dashboard/pagamentos');
          break;
        case 'POS':
          navigate('/ponto-de-venda');
          break;
        case 'RESPONSAVEL':
          navigate('/painel-responsavel');
          break;
        default:
          navigate('/acesso-negado');
      }
    }
  }, [user, role, loading, navigate]);

  if (loading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user && role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isTenantPortal) {
    return <InstituicaoInstitutionalLanding />;
  }

  return <VendasLanding />;
};

export default Index;
