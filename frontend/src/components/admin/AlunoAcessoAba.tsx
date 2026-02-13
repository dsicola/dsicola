/**
 * Aba "Acesso ao Sistema" para gerenciar acesso de alunos
 * 
 * Visível apenas para ADMIN e SECRETARIA
 * Permite:
 * - Ver informações de acesso (email, status, último login)
 * - Criar conta de acesso
 * - Ativar/desativar conta
 * - Enviar link de redefinição de senha
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Lock, Unlock, Mail, UserCheck, UserX, RefreshCw, Shield } from 'lucide-react';
import { api } from '@/services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface AlunoAcessoAbaProps {
  alunoId: string;
  alunoEmail?: string;
}

export function AlunoAcessoAba({ alunoId, alunoEmail }: AlunoAcessoAbaProps) {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  // Buscar informações de acesso
  const { data: accessInfo, isLoading, refetch } = useQuery({
    queryKey: ['aluno-access', alunoId],
    queryFn: async () => {
      const response = await api.get(`/users/${alunoId}/access`);
      return response.data;
    },
    enabled: !!alunoId,
    retry: false,
  });

  // Criar conta de acesso
  const createAccessMutation = useMutation({
    mutationFn: async (sendEmail: boolean) => {
      const response = await api.post(`/users/${alunoId}/access`, { sendEmail });
      return response.data;
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
    onError: (error: any) => {
      const message = error.response?.data?.error || error.response?.data?.message || 'Erro ao criar conta de acesso';
      toast.error(message);
    },
  });

  // Ativar/desativar conta
  const toggleAccessMutation = useMutation({
    mutationFn: async (active: boolean) => {
      const response = await api.put(`/users/${alunoId}/access`, { active });
      return response.data;
    },
    onSuccess: (data) => {
      const message = data.accountStatus === 'Ativa' 
        ? 'Conta ativada com sucesso!' 
        : 'Conta desativada com sucesso!';
      toast.success(message);
      if (data.password) {
        setGeneratedPassword(data.password);
        setShowPassword(true);
      }
      refetch();
      queryClient.invalidateQueries({ queryKey: ['aluno-access', alunoId] });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.response?.data?.message || 'Erro ao alterar status da conta';
      toast.error(message);
    },
  });

  // Enviar link de redefinição
  const sendResetLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/users/${alunoId}/access/reset-password`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Link de redefinição de senha enviado com sucesso!');
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.response?.data?.message || 'Erro ao enviar link';
      toast.error(message);
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

  const hasAccess = accessInfo?.hasPassword || false;
  const accountStatus = accessInfo?.accountStatus || 'Inativa';
  const isActive = accountStatus === 'Ativa';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Acesso ao Sistema</CardTitle>
        </div>
        <CardDescription>
          Gerencie a conta de acesso do aluno ao sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Informações de Acesso */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email de Acesso</Label>
              <Input
                value={accessInfo?.email || alunoEmail || ''}
                disabled
                className="bg-muted"
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
              <Label>Role</Label>
              <Input
                value="ALUNO"
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Último Login</Label>
              <Input
                value={accessInfo?.lastLogin 
                  ? new Date(accessInfo.lastLogin).toLocaleString('pt-BR')
                  : 'Nunca acessou'}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        </div>

        {/* Senha Gerada (se mostrada) */}
        {showPassword && generatedPassword && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Senha gerada:</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={generatedPassword}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPassword);
                      toast.success('Senha copiada!');
                    }}
                  >
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  ⚠️ Guarde esta senha com segurança. Ela não será exibida novamente.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Ações */}
        <div className="space-y-4 pt-4 border-t">
          {!hasAccess ? (
            <div className="space-y-2">
              <Label>Ações Disponíveis</Label>
              <div className="flex flex-wrap gap-2">
                <Button
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

        {/* Informações Institucionais */}
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <p className="text-sm">
              <strong>Informação:</strong> A senha nunca é exibida por segurança. 
              Use "Enviar Link de Redefinição" para permitir que o aluno defina sua própria senha.
            </p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

