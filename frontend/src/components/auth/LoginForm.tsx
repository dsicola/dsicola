import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, api, API_URL } from '@/services/api';
import { getMessages } from '@/lib/messages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { GraduationCap, Mail, Lock, Loader2, ShieldAlert, Eye, EyeOff, LogIn } from 'lucide-react';
import { z } from 'zod';
import { TwoFactorVerification } from './TwoFactorVerification';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

interface LoginFormProps {
  oidcEnabled?: boolean;
  oidcProviderName?: string;
  onToggleMode: () => void;
  onForgotPassword: () => void;
  onPasswordRequired?: (email: string) => void;
}

interface LockoutState {
  isLocked: boolean;
  remainingSeconds: number;
  remainingAttempts: number;
}

interface TwoFactorState {
  required: boolean;
  userId?: string;
  userEmail?: string;
  user?: any;
}

export const LoginForm: React.FC<LoginFormProps> = ({ oidcEnabled, oidcProviderName, onToggleMode, onForgotPassword, onPasswordRequired }) => {
  const { t } = useTranslation();
  const msg = getMessages(t);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [twoFactorState, setTwoFactorState] = useState<TwoFactorState>({ required: false });
  const [lockoutState, setLockoutState] = useState<LockoutState>({
    isLocked: false,
    remainingSeconds: 0,
    remainingAttempts: 5,
  });
  const { signIn, signInWithTokens } = useAuth();

  // Check lockout status when email changes
  useEffect(() => {
    const checkLockout = async () => {
      if (!email || !z.string().email().safeParse(email).success) return;
      
      try {
        const response = await api.post('/auth/check-lockout', { email: email.toLowerCase() });
        const data = response.data;
        
        if (data.isLocked && data.remainingSeconds > 0) {
          setLockoutState({
            isLocked: true,
            remainingSeconds: data.remainingSeconds,
            remainingAttempts: 0,
          });
        } else {
          setLockoutState(prev => ({ 
            ...prev, 
            isLocked: false, 
            remainingSeconds: 0,
            remainingAttempts: data.remainingAttempts || 5
          }));
        }
      } catch (err: any) {
        // Silently ignore CORS/network errors for lockout check - not critical
        // Only log if it's not a CORS/network error
        if (err?.code !== 'ERR_NETWORK' && !err?.message?.includes('CORS')) {
          console.warn('Error checking lockout:', err);
        }
      }
    };

    const debounce = setTimeout(checkLockout, 500);
    return () => clearTimeout(debounce);
  }, [email]);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutState.remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setLockoutState(prev => {
        const newSeconds = prev.remainingSeconds - 1;
        if (newSeconds <= 0) {
          return { ...prev, isLocked: false, remainingSeconds: 0, remainingAttempts: 5 };
        }
        return { ...prev, remainingSeconds: newSeconds };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutState.remainingSeconds]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    // Check if account is locked
    if (lockoutState.isLocked) {
      toast.error(`Conta bloqueada. Aguarde ${formatTime(lockoutState.remainingSeconds)}`);
      return;
    }

    setLoading(true);
    try {
      // Fazer login direto na API para verificar se requer 2FA
      let loginResponse;
      try {
        loginResponse = await authApi.login(email, password);
      } catch (loginErr: any) {
        // ============================================================
        // POLÍTICA DE SEGURANÇA: Interceptar MUST_CHANGE_PASSWORD na primeira chamada
        // ============================================================
        const isMustChangePassword = 
          loginErr?.response?.status === 403 && (
            loginErr?.response?.data?.message === 'MUST_CHANGE_PASSWORD' ||
            loginErr?.response?.data?.error === 'MUST_CHANGE_PASSWORD' ||
            loginErr?.error === 'MUST_CHANGE_PASSWORD' ||
            loginErr?.message === 'MUST_CHANGE_PASSWORD'
          ) || (
            loginErr?.status === 403 && (
              loginErr?.error === 'MUST_CHANGE_PASSWORD' ||
              loginErr?.message === 'MUST_CHANGE_PASSWORD'
            )
          );
        
        if (isMustChangePassword) {
          setLoading(false);
          if (onPasswordRequired) {
            onPasswordRequired(email);
          }
          return;
        }
        // Se não for MUST_CHANGE_PASSWORD, propagar o erro para tratamento abaixo
        throw loginErr;
      }
      
      // Verificar se requer 2FA
      if (loginResponse.requiresTwoFactor && loginResponse.userId) {
        setTwoFactorState({
          required: true,
          userId: loginResponse.userId,
          userEmail: loginResponse.user?.email || email,
          user: loginResponse.user,
        });
        setLoading(false);
        return;
      }

      // Se não requer 2FA, usar signIn normal
      const { error } = await signIn(email, password);
      if (error) {
        // ============================================================
        // POLÍTICA DE SEGURANÇA: Interceptar MUST_CHANGE_PASSWORD
        // ============================================================
        if (error.code === 'MUST_CHANGE_PASSWORD' || error.message === 'MUST_CHANGE_PASSWORD') {
          setLoading(false);
          if (onPasswordRequired) {
            onPasswordRequired(email);
          }
          return;
        }

        // Check lockout status after failed attempt
        try {
          const response = await api.post('/auth/check-lockout', { email: email.toLowerCase() });
          const lockoutData = response.data;
          
          if (lockoutData.isLocked) {
            setLockoutState({
              isLocked: true,
              remainingSeconds: lockoutData.remainingSeconds,
              remainingAttempts: 0,
            });
            toast.error(msg.auth.accountLocked);
          } else {
            setLockoutState(prev => ({
              ...prev,
              remainingAttempts: lockoutData.remainingAttempts,
            }));
            
            // Mensagens de erro mais específicas
            if (error.message.includes('inválidos') || error.message.includes('inválido') ||
                error.message.includes('Credenciais inválidas') || error.message.includes('Invalid') ||
                error.message.includes('incorretos') || error.message.includes('incorreto')) {
              toast.error(msg.auth.invalidCredentials);
            } else if (error.message.includes('bloqueada') || error.message.includes('locked')) {
              toast.error(error.message);
            } else if (error.message.includes('Assinatura') || error.message.includes('expirada')) {
              toast.error(msg.auth.subscriptionExpired);
            } else {
              toast.error(msg.auth.loginError);
            }
          }
        } catch (lockoutErr) {
          // If lockout check fails, just show the original error
          toast.error(error.message || msg.auth.invalidCredentials);
        }
        setLoading(false);
      } else {
        setLockoutState({
          isLocked: false,
          remainingSeconds: 0,
          remainingAttempts: 5,
        });
        
        toast.success(msg.auth.loginSuccess);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Erro no login:', err);
      toast.error(msg.auth.unexpectedError);
      setLoading(false);
    }
  };

  const handleTwoFactorSuccess = async (tokens: { accessToken: string; refreshToken: string; user: any }) => {
    try {
      const { error } = await signInWithTokens(tokens.accessToken, tokens.refreshToken);
      if (error) {
        toast.error(error.message || 'Erro ao completar login após verificação 2FA');
        setTwoFactorState({ required: false });
        return;
      }
      toast.success(msg.auth?.loginSuccess || 'Login realizado com sucesso.');
    } catch (err) {
      console.error('Erro ao completar login após 2FA:', err);
      toast.error('Erro ao completar login após verificação 2FA');
      setTwoFactorState({ required: false });
    }
  };

  const handleTwoFactorCancel = () => {
    setTwoFactorState({ required: false });
    setPassword('');
  };

  // Se requer 2FA, mostrar componente de verificação
  if (twoFactorState.required && twoFactorState.userId) {
    return (
      <TwoFactorVerification
        userId={twoFactorState.userId}
        userEmail={twoFactorState.userEmail || email}
        onSuccess={handleTwoFactorSuccess}
        onCancel={handleTwoFactorCancel}
      />
    );
  }

  return (
    <Card className="w-full max-w-md animate-scale-in border-0 shadow-lg">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-glow">
          <GraduationCap className="h-8 w-8 text-primary-foreground" />
        </div>
        <CardTitle className="text-2xl font-bold">{t('auth.welcomeBack')}</CardTitle>
        <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        {lockoutState.isLocked && (
          <Alert variant="destructive" className="mb-4">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              {t('auth.accountLockedMessage')} <strong>{formatTime(lockoutState.remainingSeconds)}</strong>.
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={loading || lockoutState.isLocked}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                disabled={loading || lockoutState.isLocked}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm text-primary hover:underline"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || lockoutState.isLocked}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.loggingIn')}
              </>
            ) : lockoutState.isLocked ? (
              t('auth.accountLocked')
            ) : (
              t('auth.login')
            )}
          </Button>

          {oidcEnabled && !lockoutState.isLocked && (
            <div className="my-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t" />
                <span className="text-xs uppercase text-muted-foreground">{t('auth.or')}</span>
                <div className="flex-1 border-t" />
              </div>
              <a
                href={`${API_URL}/auth/oidc/login?returnUrl=${encodeURIComponent(`${window.location.origin}${window.location.pathname || '/auth'}`)}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 min-h-[44px] touch-manipulation"
              >
                <LogIn className="h-4 w-4 shrink-0" />
                {t('auth.loginWith')} {oidcProviderName || 'Google'}
              </a>
            </div>
          )}
        </form>
        
        {!lockoutState.isLocked && lockoutState.remainingAttempts < 5 && lockoutState.remainingAttempts > 0 && (
          <p className="mt-2 text-xs text-center text-amber-600">
            {t('auth.attemptsRemaining', { count: lockoutState.remainingAttempts })}
          </p>
        )}
        
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <button
              onClick={onToggleMode}
              className="font-medium text-primary hover:underline"
            >
              {t('auth.register')}
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
