import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Briefcase, KeyRound, Trash2, Mail, Phone, Calendar, Building2, RefreshCw, Search } from 'lucide-react';
import { usersApi, authApi, instituicoesApi } from '@/services/api';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { toast } from 'sonner';
import { PasswordStrengthIndicator, isPasswordStrong } from '@/components/auth/PasswordStrengthIndicator';
import { useSafeMutation } from '@/hooks/useSafeMutation';

interface AdminInstituicao {
  id: string;
  nome_completo: string;
  nomeCompleto?: string;
  email: string;
  telefone?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  created_at?: string;
  createdAt?: string;
  instituicaoId?: string;
  instituicao_id?: string;
  instituicao?: {
    id: string;
    nome: string;
    subdominio: string;
  };
}

export const AdminsInstituicoesTab = () => {
  const [admins, setAdmins] = useState<AdminInstituicao[]>([]);
  const [instituicoes, setInstituicoes] = useState<Record<string, { id: string; nome: string; subdominio: string }>>({});
  const [loading, setLoading] = useState(true);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useSafeDialog(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useSafeDialog(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminInstituicao | null>(null);
  
  const [passwordFormData, setPasswordFormData] = useState({
    newPassword: '',
    confirmPassword: '',
    sendEmail: false,
  });
  const [searchAdmins, setSearchAdmins] = useState('');

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      // Buscar todos os administradores (role ADMIN)
      const allAdmins = await usersApi.getAll({ role: 'ADMIN' });
      
      // Buscar todas as instituições para mapear
      const allInstituicoes = await instituicoesApi.getAll();
      const instituicoesMap: Record<string, { id: string; nome: string; subdominio: string }> = {};
      
      (allInstituicoes || []).forEach((inst: any) => {
        instituicoesMap[inst.id] = {
          id: inst.id,
          nome: inst.nome,
          subdominio: inst.subdominio,
        };
      });

      // Mapear administradores com suas instituições
      const adminsWithInst = (allAdmins || []).map((admin: any) => ({
        id: admin.id,
        nome_completo: admin.nome_completo || admin.nomeCompleto || '',
        nomeCompleto: admin.nomeCompleto || admin.nome_completo || '',
        email: admin.email || '',
        telefone: admin.telefone || null,
        avatar_url: admin.avatar_url || admin.avatarUrl || null,
        avatarUrl: admin.avatarUrl || admin.avatar_url || null,
        created_at: admin.created_at || admin.createdAt,
        createdAt: admin.createdAt || admin.created_at,
        instituicaoId: admin.instituicaoId || admin.instituicao_id || null,
        instituicao_id: admin.instituicao_id || admin.instituicaoId || null,
        instituicao: admin.instituicao || (admin.instituicaoId ? instituicoesMap[admin.instituicaoId] : null) || (admin.instituicao_id ? instituicoesMap[admin.instituicao_id] : null),
      }));

      // Filtrar apenas admins com instituição (não órfãos)
      const adminsComInstituicao = adminsWithInst.filter((admin: AdminInstituicao) => 
        admin.instituicaoId || admin.instituicao_id
      );

      setAdmins(adminsComInstituicao);
      setInstituicoes(instituicoesMap);
    } catch (error) {
      console.error('Error fetching admins:', error);
      toast.error('Erro ao carregar administradores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // Password reset mutation
  const resetPasswordMutation = useSafeMutation({
    mutationFn: async (data: { userId: string; newPassword: string; sendEmail: boolean }) => {
      return await authApi.resetUserPassword(data.userId, data.newPassword, data.sendEmail);
    },
    onSuccess: () => {
      toast.success('Senha redefinida com sucesso!');
      setIsPasswordDialogOpen(false);
      setPasswordFormData({ newPassword: '', confirmPassword: '', sendEmail: false });
      setSelectedAdmin(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Erro ao redefinir senha');
    },
  });

  // Delete mutation
  const deleteAdminMutation = useSafeMutation({
    mutationFn: async (userId: string) => {
      return await usersApi.delete(userId);
    },
    onSuccess: () => {
      toast.success('Administrador excluído com sucesso!');
      setIsDeleteDialogOpen(false);
      setSelectedAdmin(null);
      fetchAdmins();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Erro ao excluir administrador');
    },
  });

  const handlePasswordReset = (admin: AdminInstituicao) => {
    setSelectedAdmin(admin);
    setPasswordFormData({ newPassword: '', confirmPassword: '', sendEmail: false });
    setIsPasswordDialogOpen(true);
  };

  const handleDeleteAdmin = (admin: AdminInstituicao) => {
    setSelectedAdmin(admin);
    setIsDeleteDialogOpen(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAdmin) return;

    // Validar senha forte
    if (!isPasswordStrong(passwordFormData.newPassword, true)) {
      toast.error('A senha deve conter pelo menos uma letra maiúscula e um caractere especial.');
      return;
    }

    if (passwordFormData.newPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    resetPasswordMutation.mutate({
      userId: selectedAdmin.id,
      newPassword: passwordFormData.newPassword,
      sendEmail: passwordFormData.sendEmail,
    });
  };

  const handleDeleteConfirm = () => {
    if (!selectedAdmin) return;
    deleteAdminMutation.mutate(selectedAdmin.id);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              👥 Administradores de Instituições
            </CardTitle>
            <CardDescription>
              Gerencie todos os administradores de todas as instituições cadastradas
            </CardDescription>
          </div>
          <Button variant="outline" onClick={fetchAdmins} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
        {admins.length > 0 && (
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, e-mail ou instituição..."
                value={searchAdmins}
                onChange={(e) => setSearchAdmins(e.target.value)}
                className="pl-9 max-w-md"
              />
              {searchAdmins && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchAdmins('')}
                >
                  ×
                </Button>
              )}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (() => {
          const q = searchAdmins.trim().toLowerCase();
          const filtered = q
            ? admins.filter(
                (admin) =>
                  (admin.nome_completo || admin.nomeCompleto || '').toLowerCase().includes(q) ||
                  (admin.email || '').toLowerCase().includes(q) ||
                  (admin.instituicao?.nome || '').toLowerCase().includes(q) ||
                  (admin.instituicao?.subdominio || '').toLowerCase().includes(q)
              )
            : admins;
          return filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{searchAdmins ? 'Nenhum administrador encontrado para a pesquisa' : 'Nenhum administrador encontrado'}</p>
              {searchAdmins && (
                <Button variant="link" className="mt-2" onClick={() => setSearchAdmins('')}>
                  Limpar pesquisa
                </Button>
              )}
            </div>
          ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Administrador</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Instituição</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={admin.avatar_url || admin.avatarUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(admin.nome_completo || admin.nomeCompleto || '')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{admin.nome_completo || admin.nomeCompleto}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {admin.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {admin.telefone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {admin.telefone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {admin.instituicao ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{admin.instituicao.nome}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {admin.instituicao.subdominio}.dsicola.com
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Badge variant="destructive">Sem Instituição</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatDate(admin.created_at || admin.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePasswordReset(admin)}
                          title="Alterar Senha"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAdmin(admin)}
                          title="Excluir"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          );
        })()}
      </CardContent>

      {/* Password Reset Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Senha do Administrador</DialogTitle>
            <DialogDescription>
              Redefina a senha do administrador {selectedAdmin?.nome_completo || selectedAdmin?.nomeCompleto} ({selectedAdmin?.email})
              {selectedAdmin?.instituicao && (
                <span className="block mt-1 text-sm">
                  Instituição: <strong>{selectedAdmin.instituicao.nome}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">Nova Senha *</Label>
              <Input
                id="new_password"
                type="password"
                value={passwordFormData.newPassword}
                onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
              {passwordFormData.newPassword && (
                <PasswordStrengthIndicator 
                  password={passwordFormData.newPassword} 
                  userRole="ADMIN"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirmar Senha *</Label>
              <Input
                id="confirm_password"
                type="password"
                value={passwordFormData.confirmPassword}
                onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                placeholder="Digite a senha novamente"
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="send_email"
                checked={passwordFormData.sendEmail}
                onChange={(e) => setPasswordFormData({ ...passwordFormData, sendEmail: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="send_email" className="text-sm font-normal cursor-pointer">
                Enviar e-mail com a nova senha
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={resetPasswordMutation.isPending || !passwordFormData.newPassword || !isPasswordStrong(passwordFormData.newPassword, true) || passwordFormData.newPassword !== passwordFormData.confirmPassword}
              >
                {resetPasswordMutation.isPending ? 'Alterando...' : 'Alterar Senha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o administrador <strong>{selectedAdmin?.nome_completo || selectedAdmin?.nomeCompleto}</strong> ({selectedAdmin?.email})?
              {selectedAdmin?.instituicao && (
                <span className="block mt-2">
                  Instituição: <strong>{selectedAdmin.instituicao.nome}</strong>
                </span>
              )}
              <br />
              <br />
              <span className="text-red-600 font-semibold">Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteAdminMutation.isPending}
            >
              {deleteAdminMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

