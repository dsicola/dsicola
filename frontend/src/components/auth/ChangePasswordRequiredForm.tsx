import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Lock, Loader2, ShieldAlert, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { authApi, clearTokens } from '@/services/api';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .refine((val) => /[A-Z]/.test(val), 'A senha deve conter pelo menos uma letra maiúscula')
    .refine((val) => /[!@#$%^&*(),.?":{}|<>\[\]\\\/_+\-=~`]/.test(val), 'A senha deve conter pelo menos um caractere especial'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

interface ChangePasswordRequiredFormProps {
  email: string;
}

export const ChangePasswordRequiredForm: React.FC<ChangePasswordRequiredFormProps> = ({ email }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const calculatePasswordStrength = (password: string): { strength: 'weak' | 'medium' | 'strong'; score: number } => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>\[\]\\\/_+\-=~`]/.test(password)) score += 1;

    if (score < 3) return { strength: 'weak', score };
    if (score < 5) return { strength: 'medium', score };
    return { strength: 'strong', score };
  };

  const passwordStrength = calculatePasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = passwordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      // Usar endpoint que não requer JWT, mas valida credenciais
      await authApi.changePasswordRequiredWithCredentials(
        email,
        currentPassword,
        newPassword,
        confirmPassword
      );

      toast.success('Senha alterada com sucesso! Redirecionando para login...');
      setLoading(false);
      clearTokens();
      setTimeout(() => {
        window.location.href = '/auth';
      }, 1000);
    } catch (err: any) {
      console.error('Erro ao alterar senha:', err);
      const errorMessage = err?.response?.data?.message || err?.message || 'Erro inesperado. Tente novamente.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md animate-scale-in border-0 shadow-lg">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
          <ShieldAlert className="h-8 w-8 text-amber-600" />
        </div>
        <CardTitle className="text-2xl font-bold">Alteração de Senha Obrigatória</CardTitle>
        <CardDescription>
          Por questões de segurança, você deve alterar sua senha antes de continuar
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant="default" className="mb-4 border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Importante:</strong> Esta é uma alteração obrigatória de senha. 
            Você não poderá acessar o sistema até alterar sua senha.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentPassword">Senha Atual</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                placeholder="Digite sua senha atual"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pl-10 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite sua nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
            {newPassword && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        passwordStrength.strength === 'weak'
                          ? 'bg-red-500 w-1/3'
                          : passwordStrength.strength === 'medium'
                          ? 'bg-yellow-500 w-2/3'
                          : 'bg-green-500 w-full'
                      }`}
                    />
                  </div>
                  <span className={`text-xs font-medium ${
                    passwordStrength.strength === 'weak'
                      ? 'text-red-600'
                      : passwordStrength.strength === 'medium'
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}>
                    {passwordStrength.strength === 'weak' ? 'Fraca' : passwordStrength.strength === 'medium' ? 'Média' : 'Forte'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className={newPassword.length >= 8 ? 'text-green-600' : ''}>
                    • Mínimo 8 caracteres {newPassword.length >= 8 && '✓'}
                  </p>
                  <p className={/[A-Z]/.test(newPassword) ? 'text-green-600' : ''}>
                    • Pelo menos 1 letra maiúscula {/[A-Z]/.test(newPassword) && '✓'}
                  </p>
                  <p className={/[!@#$%^&*(),.?":{}|<>\[\]\\\/_+\-=~`]/.test(newPassword) ? 'text-green-600' : ''}>
                    • Pelo menos 1 caractere especial {/[!@#$%^&*(),.?":{}|<>\[\]\\\/_+\-=~`]/.test(newPassword) && '✓'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirme sua nova senha"
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
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-600">As senhas não coincidem</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Alterando senha...
              </>
            ) : (
              'Alterar Senha'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

