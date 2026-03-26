/**
 * Aba "Acesso ao Sistema" para gerenciar acesso de alunos
 *
 * Visível apenas para ADMIN e SECRETARIA (rota protegida no backend).
 * Permite:
 * - Ver informações de acesso (email, status, último login)
 * - Criar conta de acesso
 * - Ativar/desativar conta
 * - Enviar link de redefinição de senha
 *
 * Contrato da API: GET/POST/PUT /users/:userId/access (ver user-access.controller no backend).
 * Importante: a prop `alunoId` é o ID do utilizador (User), o mesmo usado em rotas /users/:id.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Loader2,
  Lock,
  Unlock,
  Mail,
  UserCheck,
  UserX,
  RefreshCw,
  Shield,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '@/services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getApiErrorMessage } from '@/utils/apiErrors';

/** Resposta de GET /users/:id/access — manter sincronizado com user-access.controller.ts */
export interface AlunoAccessInfo {
  userId: string;
  email: string | null;
  accountStatus: string;
  role: string;
  lastLogin: string | null;
  hasPassword: boolean;
  createdAt: string;
}

interface AlunoAcessoAbaProps {
  /** ID do utilizador (User), não ID de matrícula ou de outra entidade */
  alunoId: string;
  alunoEmail?: string;
}

export function AlunoAcessoAba({ alunoId, alunoEmail }: AlunoAcessoAbaProps) {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const {
    data: accessInfo,
    isLoading,
    isError,
    error: accessQueryError,
    refetch,
  } = useQuery({
    queryKey: ['aluno-access', alunoId],
    queryFn: async () => {
      const response = await api.get<AlunoAccessInfo>(`/users/${alunoId}/access`);
      return response.data;
    },
    enabled: !!alunoId,
    retry: false,
  });

  const createAccessMutation = useMutation({
    mutationFn: async (sendEmail: boolean) => {
      const response = await api.post(`/users/${alunoId}/access`, { sendEmail });
      return response.data as {
        password?: string;
        sendEmail?: boolean;
        message?: string;
      };
    },
    onSuccess: (data) => {
      toast.success('Conta de acesso criada com sucesso!');
      if (data.password && !data.sendEmail) {
        setGeneratedPassword(data.password);
        setShowPassword(true);
      }
      refetch();
      queryClient.invalidateQueries({ queryKey: ['aluno-access', alunoId] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Erro ao criar conta de acesso'));
    },
  });

  const toggleAccessMutation = useMutation({
    mutationFn: async (active: boolean) => {
      const response = await api.put(`/users/${alunoId}/access`, { active });
      return response.data as { accountStatus?: string; password?: string };
    },
    onSuccess: (data) => {
      const message =
        data.accountStatus === 'Ativa' ? 'Conta ativada com sucesso!' : 'Conta desativada com sucesso!';
      toast.success(message);
      if (data.password) {
        setGeneratedPassword(data.password);
        setShowPassword(true);
      }
      refetch();
      queryClient.invalidateQueries({ queryKey: ['aluno-access', alunoId] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Erro ao alterar status da conta'));
    },
  });

  const sendResetLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/users/${alunoId}/access/reset-password`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Link de redefinição de senha enviado com sucesso!');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['aluno-access', alunoId] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Erro ao enviar link'));
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Acesso ao Sistema</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="space-y-3">
              <p>
                {getApiErrorMessage(
                  accessQueryError,
                  'Não foi possível carregar os dados de acesso. Verifique permissões e ligação.',
                )}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const hasAccess = accessInfo?.hasPassword ?? false;
  const accountStatus = accessInfo?.accountStatus ?? 'Inativa';
  const isActive = accountStatus === 'Ativa';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Acesso ao Sistema</CardTitle>
        </div>
        <CardDescription>
          Crie a conta, envie credenciais e redefinição de senha. O envio automático segue as configurações da instituição
          (email e, em planos superiores, SMS/Telegram) em Notificações.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email de Acesso</Label>
              <Input
                value={accessInfo?.email || alunoEmail || ''}
                disabled
                className="bg-muted"
                readOnly
              />
            </div>
            <div className="space-y-2">
              <Label>Status da Conta</Label>
              <div>
                <Badge variant={isActive ? 'default' : 'secondary'} className="text-sm">
                  {isActive ? (
                    <>
                      <UserCheck className="h-3 w-3 mr-1" />
                      Ativa
                    </>
                  ) : (
                    <>
                      <UserX className="h-3 w-3 mr-1" />
                      Inativa
                    </>
                  )}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Perfil no sistema</Label>
              <Input value={accessInfo?.role ?? 'ALUNO'} disabled className="bg-muted" readOnly />
            </div>
            <div className="space-y-2">
              <Label>Último Login</Label>
              <Input
                value={
                  accessInfo?.lastLogin ? new Date(accessInfo.lastLogin).toLocaleString('pt-BR') : 'Nunca acessou'
                }
                disabled
                className="bg-muted"
                readOnly
              />
            </div>
          </div>
        </div>

        {showPassword && generatedPassword && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Senha gerada:</p>
                <div className="flex items-center gap-2">
                  <Input value={generatedPassword} readOnly className="font-mono" />
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(generatedPassword);
                        toast.success('Senha copiada!');
                      } catch {
                        toast.error('Não foi possível copiar. Copie manualmente.');
                      }
                    }}
                  >
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Guarde esta senha com segurança. Ela não será exibida novamente.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 pt-4 border-t">
          {!hasAccess ? (
            <div className="space-y-2">
              <Label>Ações Disponíveis</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => createAccessMutation.mutate(true)}
                  disabled={createAccessMutation.isPending}
                >
                  {createAccessMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Criar Conta e Enviar Email
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => createAccessMutation.mutate(false)}
                  disabled={createAccessMutation.isPending}
                >
                  {createAccessMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Criar Conta (sem email)
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Ações Disponíveis</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={isActive ? 'destructive' : 'default'}
                  onClick={() => toggleAccessMutation.mutate(!isActive)}
                  disabled={toggleAccessMutation.isPending}
                >
                  {toggleAccessMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : isActive ? (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Desativar Conta
                    </>
                  ) : (
                    <>
                      <Unlock className="h-4 w-4 mr-2" />
                      Ativar Conta
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => sendResetLinkMutation.mutate()}
                  disabled={sendResetLinkMutation.isPending}
                >
                  {sendResetLinkMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Enviar Link de Redefinição
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <p className="text-sm">
              <strong>Informação:</strong> A senha não é mostrada de rotina por segurança. Use &quot;Enviar Link de
              Redefinição&quot; para o aluno definir a própria senha.
            </p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
