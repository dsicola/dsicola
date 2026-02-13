import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, Loader2, KeyRound, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { PasswordStrengthIndicator, isPasswordStrong, requiresStrongPassword } from '@/components/auth/PasswordStrengthIndicator';
import { getAccessToken } from '@/services/api';
import { authApi } from '@/services/api';
import { getRolesFromToken } from '@/utils/jwt';
import { UserRole } from '@/types/auth';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [userRoles, setUserRoles] = useState<UserRole[] | null>(null);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check if user has a valid session or token in URL
    const checkSession = async () => {
      const token = getAccessToken();
      const urlToken = searchParams.get('token');
      const tokenToUse = urlToken || token;
      
      if (tokenToUse) {
        setValidSession(true);
        // Extrair roles do token para mostrar requisitos corretos de senha
        const roles = getRolesFromToken(tokenToUse);
        setUserRoles(roles);
      }
      setCheckingSession(false);
    };

    checkSession();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que as senhas coincidem
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem. Por favor, verifique e tente novamente.');
      return;
    }

    // Validar força da senha baseado nas roles do usuário
    const needsStrongPassword = requiresStrongPassword(userRoles || undefined);
    const isStrong = isPasswordStrong(password, false, userRoles || undefined);
    
    if (!isStrong) {
      if (needsStrongPassword) {
        toast.error('A senha deve conter pelo menos uma letra maiúscula e um caractere especial');
      } else {
        toast.error('A senha deve ter no mínimo 6 caracteres');
      }
      return;
    }

    // Obter token da URL ou do localStorage
    const urlToken = searchParams.get('token');
    const token = urlToken || getAccessToken();

    if (!token) {
      toast.error('Token de redefinição não encontrado. Solicite um novo link.');
      return;
    }

    setLoading(true);
    try {
      await authApi.confirmResetPassword(token, password, confirmPassword);
      setSuccess(true);
      toast.success('Senha redefinida com sucesso!');
      // Sign out and redirect to login after 3 seconds
      setTimeout(async () => {
        await signOut();
        navigate('/auth');
      }, 3000);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Erro ao redefinir senha. Tente novamente.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  if (!validSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
              <KeyRound className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold">Link inválido</CardTitle>
            <CardDescription>
              Este link de recuperação é inválido ou expirou. 
              Solicite um novo link de recuperação.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/auth')}>
              Ir para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-bold">Senha redefinida!</CardTitle>
            <CardDescription>
              Sua senha foi alterada com sucesso. 
              Você será redirecionado para o login em instantes...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/auth')}>
              Ir para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-scale-in border-0 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-glow">
            <KeyRound className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Criar nova senha</CardTitle>
          <CardDescription>
            Digite sua nova senha abaixo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={loading}
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
              <PasswordStrengthIndicator password={password} userRole={userRoles || undefined} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não conferem</p>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !isPasswordStrong(password, false, userRoles || undefined) || password !== confirmPassword || password.length < 6}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redefinindo...
                </>
              ) : (
                'Redefinir senha'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
