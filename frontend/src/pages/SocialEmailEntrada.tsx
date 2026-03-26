import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Shield } from 'lucide-react';
import axios from 'axios';

function getReturnPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/social';
  if (raw === '/social' || raw.startsWith('/post/')) return raw;
  return '/social';
}

const SocialEmailEntrada: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signInWithTokens } = useAuth();
  const returnTo = getReturnPath(searchParams.get('returnTo'));

  const [step, setStep] = useState<'email' | 'code' | '2fa'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [totp, setTotp] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    const e = email.trim().toLowerCase();
    if (!e) {
      toast.error('Indique o seu email.');
      return;
    }
    setBusy(true);
    try {
      const data = await authApi.requestEmailLoginCode(e);
      toast.success(
        data.message ||
          'Se este email estiver associado a uma conta neste endereço, receberá um código de verificação.',
      );
      setStep('code');
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        toast.error((err.response?.data as { message?: string })?.message || 'Muitas tentativas.');
      } else if (axios.isAxiosError(err) && err.response?.status === 502) {
        toast.error((err.response?.data as { message?: string })?.message || 'Falha ao enviar e-mail.');
      } else if (axios.isAxiosError(err) && err.response?.status === 400) {
        toast.error((err.response?.data as { message?: string })?.message || 'Não foi possível solicitar o código.');
      } else {
        toast.error('Não foi possível enviar o código.');
      }
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    const e = email.trim().toLowerCase();
    const c = code.replace(/\D/g, '').slice(0, 6);
    if (c.length !== 6) {
      toast.error('Introduza os 6 dígitos do código.');
      return;
    }
    setBusy(true);
    try {
      const data = await authApi.verifyEmailLoginCode(e, c);
      if (data.requiresTwoFactor && data.userId) {
        setPendingUserId(data.userId);
        setStep('2fa');
        toast.info('Introduza o código da aplicação de autenticação (2FA).');
        return;
      }
      if (data.accessToken && data.refreshToken) {
        await signInWithTokens(data.accessToken, data.refreshToken);
        navigate(returnTo, { replace: true });
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as {
          message?: string;
          reason?: string;
          redirectToSubdomain?: string;
        };
        if (err.response?.status === 403 && data?.reason === 'USE_SUBDOMAIN' && data?.redirectToSubdomain) {
          toast.info('Aceda pelo endereço da sua instituição.');
          window.location.href = `${data.redirectToSubdomain.replace(/\/$/, '')}/auth/entrada-social?returnTo=${encodeURIComponent(returnTo)}`;
          return;
        }
        const msg = data?.message;
        if (msg === 'MUST_CHANGE_PASSWORD' || err.response?.status === 403) {
          toast.error('É necessário atualizar a palavra-passe. Use o login completo.');
          navigate('/auth', { replace: true });
          return;
        }
        toast.error(msg || 'Código inválido ou expirado.');
      } else {
        toast.error('Código inválido ou expirado.');
      }
    } finally {
      setBusy(false);
    }
  };

  const submit2fa = async () => {
    const uid = pendingUserId;
    const t = totp.replace(/\D/g, '').slice(0, 6);
    if (!uid || t.length !== 6) {
      toast.error('Código inválido.');
      return;
    }
    setBusy(true);
    try {
      const data = await authApi.loginStep2(uid, t);
      if (data.accessToken && data.refreshToken) {
        await signInWithTokens(data.accessToken, data.refreshToken);
        navigate(returnTo, { replace: true });
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { message?: string; reason?: string; redirectToSubdomain?: string };
        if (err.response?.status === 403 && data?.reason === 'USE_SUBDOMAIN' && data?.redirectToSubdomain) {
          window.location.href = `${data.redirectToSubdomain.replace(/\/$/, '')}/auth/entrada-social?returnTo=${encodeURIComponent(returnTo)}`;
          return;
        }
        toast.error(data?.message || 'Código 2FA inválido.');
      } else {
        toast.error('Código 2FA inválido.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Entrar na Social</h1>
          <p className="text-sm text-muted-foreground">
            Se o seu email tiver conta <strong>nesta instituição</strong> (com palavra-passe definida),
            receberá um código. Aceda pelo endereço da escola (subdomínio ou domínio próprio). A Comunidade pública
            continua aberta sem login.
          </p>
        </div>

        {step === 'email' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="social-email">Email</Label>
              <Input
                id="social-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <Button className="w-full" onClick={() => void sendCode()} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar código
            </Button>
          </div>
        )}

        {step === 'code' && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/30 px-3 py-2">
              Não recebeu nada? Verifique o spam, o email correto e se está no <strong>site da sua instituição</strong>{' '}
              (noutro endereço a conta pode não existir). O email partilha o mesmo serviço de correio do resto do
              sistema; se o envio falhar, aparece uma mensagem de erro em vermelho.
            </p>
            <div className="space-y-2">
              <Label htmlFor="social-code">Código de 6 dígitos</Label>
              <Input
                id="social-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center font-mono text-lg tracking-[0.4em]"
              />
            </div>
            <Button className="w-full" onClick={() => void submitCode()} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Validar e entrar
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('email')}>
              Voltar
            </Button>
          </div>
        )}

        {step === '2fa' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="social-totp">Código 2FA (6 dígitos)</Label>
              <Input
                id="social-totp"
                inputMode="numeric"
                maxLength={6}
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center font-mono text-lg tracking-[0.4em]"
              />
            </div>
            <Button className="w-full" onClick={() => void submit2fa()} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/auth" className="underline underline-offset-2 hover:text-foreground">
            Login com email e palavra-passe
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SocialEmailEntrada;
