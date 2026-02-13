import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { ChangePasswordRequiredForm } from '@/components/auth/ChangePasswordRequiredForm';
import { GraduationCap, Shield } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot' | 'change-password-required';

const Auth: React.FC = () => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [passwordRequiredEmail, setPasswordRequiredEmail] = useState<string>('');
  const { user, role, loading } = useAuth();
  const { instituicao, configuracao, isMainDomain, isSuperAdmin } = useTenant();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      if (role) {
        // Redirecionar para o dashboard apropriado
        // O ProtectedRoute irá verificar o onboarding e redirecionar se necessário
        switch (role) {
          case 'SUPER_ADMIN':
            navigate('/super-admin', { replace: true });
            break;
          case 'ADMIN':
            navigate('/admin-dashboard', { replace: true });
            break;
          case 'PROFESSOR':
            navigate('/painel-professor', { replace: true });
            break;
          case 'ALUNO':
            navigate('/painel-aluno', { replace: true });
            break;
          case 'SECRETARIA':
            navigate('/secretaria-dashboard', { replace: true });
            break;
          case 'POS':
            navigate('/ponto-de-venda', { replace: true });
            break;
          case 'RESPONSAVEL':
            navigate('/painel-responsavel', { replace: true });
            break;
          default:
            navigate('/acesso-negado', { replace: true });
        }
      } else {
        navigate('/acesso-negado', { replace: true });
      }
    }
  }, [user, role, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center">
            <GraduationCap className="h-8 w-8 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Determine branding based on tenant
  // Priorizar configuração, depois instituição
  const displayName = configuracao?.nome_instituicao || configuracao?.nomeInstituicao || instituicao?.nome || (isMainDomain ? 'DSICOLA' : 'Universidade');
  // Priorizar logo da configuração, depois da instituição
  const logoUrl = configuracao?.logo_url || instituicao?.logo_url;
  const imagemCapaUrl = configuracao?.imagem_capa_login_url || configuracao?.imagemCapaLoginUrl;
  const isSuperAdminLogin = isMainDomain || isSuperAdmin;

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Logo and Institution Name */}
          <div className="text-center mb-8">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={displayName}
                className="h-16 w-auto mx-auto mb-4 object-contain"
              />
            ) : (
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary">
                {isSuperAdminLogin ? (
                  <Shield className="h-8 w-8 text-primary-foreground" />
                ) : (
                  <GraduationCap className="h-8 w-8 text-primary-foreground" />
                )}
              </div>
            )}
            <h1 className="text-2xl font-bold text-foreground">
              {displayName}
            </h1>
            {instituicao && (
              <p className="text-sm text-muted-foreground mt-1">
                Powered by <span className="font-semibold">DSICOLA</span>
              </p>
            )}
            {isSuperAdminLogin && !instituicao && (
              <p className="text-sm text-muted-foreground mt-1">
                Plataforma de Gestão Acadêmica
              </p>
            )}
            {instituicao && (
              <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full">
                <span className="text-xs font-mono text-primary">
                  {instituicao.subdominio}.dsicola.com
                </span>
              </div>
            )}
          </div>
          
          {authMode === 'login' && (
            <LoginForm 
              onToggleMode={() => setAuthMode('register')} 
              onForgotPassword={() => setAuthMode('forgot')}
              onPasswordRequired={(email) => {
                setPasswordRequiredEmail(email);
                setAuthMode('change-password-required');
              }}
            />
          )}
          {authMode === 'register' && (
            <RegisterForm onToggleMode={() => setAuthMode('login')} />
          )}
          {authMode === 'forgot' && (
            <ForgotPasswordForm onBack={() => setAuthMode('login')} />
          )}
          {authMode === 'change-password-required' && (
            <ChangePasswordRequiredForm email={passwordRequiredEmail} />
          )}
        </div>
      </div>

      {/* Right side - Hero */}
      <div 
        className="hidden lg:flex lg:flex-1 items-center justify-center p-12 relative overflow-hidden"
        style={{
          backgroundImage: imagemCapaUrl ? `url(${imagemCapaUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Overlay */}
        <div className={`absolute inset-0 ${imagemCapaUrl ? 'bg-black/50' : 'gradient-hero'}`} />
        
        <div className="relative z-10 max-w-md text-center text-white animate-fade-in">
          {logoUrl ? (
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm p-4">
              <img 
                src={logoUrl} 
                alt={displayName}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm">
              {isSuperAdminLogin ? (
                <Shield className="h-10 w-10" />
              ) : (
                <GraduationCap className="h-10 w-10" />
              )}
            </div>
          )}
          <h2 className="text-4xl font-bold mb-2">{displayName}</h2>
          <p className="text-lg opacity-90 mb-6">
            {isSuperAdminLogin 
              ? 'Portal de Administração Global' 
              : 'Sistema de Gestão Acadêmica'
            }
          </p>
          {instituicao && (
            <div className="text-sm opacity-75 space-y-1">
              {instituicao.email_contato && <p>{instituicao.email_contato}</p>}
              {instituicao.telefone && <p>{instituicao.telefone}</p>}
              {instituicao.endereco && <p>{instituicao.endereco}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
