import React, { useState, useRef, useEffect } from 'react';
import { authApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Shield, Loader2, AlertCircle } from 'lucide-react';

interface TwoFactorVerificationProps {
  userId: string;
  userEmail: string;
  onSuccess: (tokens: { accessToken: string; refreshToken: string; user: any }) => void;
  onCancel: () => void;
}

export const TwoFactorVerification: React.FC<TwoFactorVerificationProps> = ({
  userId,
  userEmail,
  onSuccess,
  onCancel,
}) => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus no input quando o componente montar
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-submit quando o token tiver 6 dígitos
  useEffect(() => {
    if (token.length === 6 && /^\d{6}$/.test(token)) {
      handleSubmit();
    }
  }, [token]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Validar formato
    if (!/^\d{6}$/.test(token)) {
      setError('O código deve ter exatamente 6 dígitos');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await authApi.loginStep2(userId, token);
      
      if (result.accessToken && result.refreshToken) {
        toast.success('Autenticação em dois fatores verificada com sucesso!');
        onSuccess(result);
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || 'Código 2FA inválido. Tente novamente.';
      setError(errorMessage);
      setToken(''); // Limpar o campo para nova tentativa
      inputRef.current?.focus();
      
      // Não mostrar toast de erro aqui - o erro já está sendo exibido no componente
    } finally {
      setLoading(false);
    }
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Apenas números
    if (value.length <= 6) {
      setToken(value);
      setError(null); // Limpar erro quando o usuário começar a digitar
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Autenticação em Dois Fatores</CardTitle>
        <CardDescription>
          Digite o código de 6 dígitos do seu aplicativo autenticador
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Código de Verificação</Label>
            <Input
              id="token"
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={token}
              onChange={handleTokenChange}
              placeholder="000000"
              className="text-center text-2xl tracking-widest font-mono"
              disabled={loading}
              autoComplete="one-time-code"
            />
            <p className="text-xs text-muted-foreground text-center">
              Abra seu aplicativo autenticador e digite o código de 6 dígitos
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || token.length !== 6}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Verificar'
              )}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Não consegue acessar seu aplicativo autenticador?{' '}
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => {
                  toast.info('Entre em contato com o administrador para resetar seu 2FA');
                }}
              >
                Solicitar reset
              </Button>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

