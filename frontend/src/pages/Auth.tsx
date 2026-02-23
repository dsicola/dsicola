import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { LanguageSelector } from '@/components/LanguageSelector';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { ChangePasswordRequiredForm } from '@/components/auth/ChangePasswordRequiredForm';
import { GraduationCap, Shield } from 'lucide-react';
import { authApi } from '@/services/api';
import { toast } from 'sonner';

type AuthMode = 'login' | 'register' | 'forgot' | 'change-password-required';

interface AuthConfig {
  oidcEnabled: boolean;
  oidcProviderName?: string;
}

const Auth: React.FC = () => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [passwordRequiredEmail, setPasswordRequiredEmail] = useState<string>('');
  const [authConfig, setAuthConfig] = useState<AuthConfig>({ oidcEnabled: false });
  const [oidcProcessing, setOidcProcessing] = useState(false);
  const { user, role, loading, signInWithTokens } = useAuth();
  const { instituicao, configuracao, isMainDomain, isSuperAdmin } = useTenant();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Carregar config de auth (OIDC disponível?)
  useEffect(() => {
    authApi.getAuthConfig().then((config) => {
      setAuthConfig({ oidcEnabled: config.oidcEnabled || false, oidcProviderName: config.oidcProviderName });
    }).catch(() => { /* ignorar */ });
  }, []);

  // Tratar callback OIDC (tokens no hash)
  useEffect(() => {
    if (oidcProcessing || loading) return;
    const oidcParam = searchParams.get('oidc');
    const oidcError = searchParams.get('oidc_error');
    if (oidcError) {
      toast.error(decodeURIComponent(oidcError));
      setSearchParams({}, { replace: true });
      return;
    }
    // Ler tokens de query params (primário - mais fiável em redirects cross-origin) ou hash
    const hash = window.location.hash;
    const hashParams = hash ? new URLSearchParams(hash.replace('#', '')) : null;
    const accessToken = searchParams.get('access_token') || hashParams?.get('access_token');
    const refreshToken = searchParams.get('refresh_token') || hashParams?.get('refresh_token');
    if (oidcParam === '1' && accessToken && refreshToken) {
      const tokenA = accessToken.trim();
      const tokenR = refreshToken.trim();
      setOidcProcessing(true);
      signInWithTokens(tokenA, tokenR).then(({ error }) => {
        setOidcProcessing(false);
        if (error) {
          toast.error(error.message);
        }
        setSearchParams({}, { replace: true });
        window.history.replaceState(null, '', window.location.pathname);
      });
    }
  }, [searchParams, loading, oidcProcessing, signInWithTokens, setSearchParams]);

  useEffect(() => {
    if (!loading && user) {
      if (role) {
        // Redirecionar para o dashboard apropriado
        // O ProtectedRoute irá verificar o onboarding e redirecionar se necessário
        switch (role) {
          case 'SUPER_ADMIN':
          case 'COMERCIAL':
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
          case 'RH':
            navigate('/admin-dashboard/recursos-humanos', { replace: true });
            break;
          case 'FINANCEIRO':
            navigate('/admin-dashboard/pagamentos', { replace: true });
            break;
          case 'POS':
            navigate('/ponto-de-venda', { replace: true });
            break;
          case 'RESPONSAVEL':
            navigate('/painel-responsavel', { replace: true });
            break;
          case 'DIRECAO':
          case 'COORDENADOR':
            navigate('/admin-dashboard', { replace: true });
            break;
          case 'AUDITOR':
            navigate('/admin-dashboard/auditoria', { replace: true });
            break;
          default:
            navigate('/acesso-negado', { replace: true });
        }
      } else {
        navigate('/acesso-negado', { replace: true });
      }
    }
  }, [user, role, loading, navigate]);

  if (loading || oidcProcessing) {
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
    <div className="min-h-screen flex w-full overflow-x-hidden">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-background min-w-0 relative">
        <div className="absolute top-4 right-4">
          <LanguageSelector />
        </div>
        <div className="w-full max-w-md px-1 sm:px-0">
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
              oidcEnabled={authConfig.oidcEnabled}
              oidcProviderName={authConfig.oidcProviderName}
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
