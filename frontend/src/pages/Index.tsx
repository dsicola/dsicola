import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import VendasLanding from './VendasLanding';

const Index: React.FC = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

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

  // If user is logged in, redirect will happen
  // If not logged in or still loading, show sales landing page
  if (!loading && !user) {
    return <VendasLanding />;
  }

  // Show loading state while checking auth
  return <VendasLanding />;
};

export default Index;
