import { useEffect, useState } from 'react';
import { GraduationCap, Shield } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { ChangePasswordRequiredForm } from '@/components/auth/ChangePasswordRequiredForm';
import { LanguageSelector } from '@/components/LanguageSelector';
import { authApi } from '@/services/api';

type AuthMode = 'login' | 'register' | 'forgot' | 'change-password-required';

interface TenantAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nome para o título do modal */
  displayName: string;
  logoUrl?: string | null;
  /** Portal super-admin (hostname principal) — ícone e cópia diferentes */
  isSuperAdminContext?: boolean;
}

/**
 * Acesso (login / registo) em modal para a landing institucional — mesmo fluxo que /auth, sem sair da página.
 */
export function TenantAuthDialog({
  open,
  onOpenChange,
  displayName,
  logoUrl,
  isSuperAdminContext = false,
}: TenantAuthDialogProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [passwordRequiredEmail, setPasswordRequiredEmail] = useState('');
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [oidcProviderName, setOidcProviderName] = useState<string | undefined>();

  useEffect(() => {
    if (!open) {
      setAuthMode('login');
      setPasswordRequiredEmail('');
    }
  }, [open]);

  useEffect(() => {
    authApi
      .getAuthConfig()
      .then((c) => {
        setOidcEnabled(!!c.oidcEnabled);
        setOidcProviderName(c.oidcProviderName);
      })
      .catch(() => {});
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[min(90vh,800px)] overflow-y-auto p-0 gap-0 border-border/80 sm:rounded-2xl"
        data-dsicola
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Acesso — {displayName}</DialogTitle>
        </DialogHeader>
        <div className="relative flex items-start justify-between gap-2 border-b border-border/60 px-4 py-3 pr-14">
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-10 w-auto object-contain shrink-0" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                {isSuperAdminContext ? (
                  <Shield className="h-5 w-5 text-primary" />
                ) : (
                  <GraduationCap className="h-5 w-5 text-primary" />
                )}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground">Entrar ou criar conta</p>
            </div>
          </div>
          <div className="absolute right-10 top-3">
            <LanguageSelector />
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {authMode === 'login' || authMode === 'register' ? (
            <Tabs
              value={authMode === 'register' ? 'register' : 'login'}
              onValueChange={(v) => setAuthMode(v === 'register' ? 'register' : 'login')}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Registar</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="mt-0 outline-none">
                <LoginForm
                  oidcEnabled={oidcEnabled}
                  oidcProviderName={oidcProviderName}
                  onToggleMode={() => setAuthMode('register')}
                  onForgotPassword={() => setAuthMode('forgot')}
                  onPasswordRequired={(email) => {
                    setPasswordRequiredEmail(email);
                    setAuthMode('change-password-required');
                  }}
                />
              </TabsContent>
              <TabsContent value="register" className="mt-0 outline-none">
                <RegisterForm onToggleMode={() => setAuthMode('login')} />
              </TabsContent>
            </Tabs>
          ) : null}
          {authMode === 'forgot' && <ForgotPasswordForm onBack={() => setAuthMode('login')} />}
          {authMode === 'change-password-required' && (
            <ChangePasswordRequiredForm email={passwordRequiredEmail} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
