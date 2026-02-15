import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Plus, Briefcase, Edit, Trash2, KeyRound, Mail, Phone, Calendar } from 'lucide-react';
import { usersApi, authApi } from '@/services/api';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { toast } from 'sonner';
import { PasswordStrengthIndicator, isPasswordStrong } from '@/components/auth/PasswordStrengthIndicator';
import { useSafeMutation } from '@/hooks/useSafeMutation';

interface ComercialUser {
  id: string;
  nome_completo: string;
  nomeCompleto?: string;
  email: string;
  telefone?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  created_at?: string;
  createdAt?: string;
}

export const EquipeComercialTab = () => {
  const [users, setUsers] = useState<ComercialUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useSafeDialog(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useSafeDialog(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useSafeDialog(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useSafeDialog(false);
  const [selectedUser, setSelectedUser] = useState<ComercialUser | null>(null);

  const [createFormData, setCreateFormData] = useState({
    email: '',
    password: '',
    nome_completo: '',
  });

  const [editFormData, setEditFormData] = useState({
    email: '',
    nome_completo: '',
    telefone: '',
  });

  const [passwordFormData, setPasswordFormData] = useState({
    newPassword: '',
    confirmPassword: '',
    sendEmail: false,
  });

  const fetchComerciais = async () => {
    try {
      setLoading(true);
      const allUsers = await usersApi.getAll({ role: 'COMERCIAL' });

      const comerciais = (allUsers || []).map((user: any) => ({
        id: user.id,
        nome_completo: user.nome_completo || user.nomeCompleto || '',
        nomeCompleto: user.nomeCompleto || user.nome_completo || '',
        email: user.email || '',
        telefone: user.telefone || null,
        avatar_url: user.avatar_url || user.avatarUrl || null,
        avatarUrl: user.avatarUrl || user.avatar_url || null,
        created_at: user.created_at || user.createdAt,
        createdAt: user.createdAt || user.created_at,
      }));

      setUsers(comerciais);
    } catch (error) {
      console.error('Erro ao carregar equipe comercial:', error);
      toast.error('Erro ao carregar equipe comercial');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComerciais();
  }, []);

  const createMutation = useSafeMutation({
    mutationFn: async (data: { email: string; password: string; nome_completo: string }) => {
      return await usersApi.create({
        email: data.email,
        password: data.password,
        nomeCompleto: data.nome_completo,
        role: 'COMERCIAL',
        instituicaoId: undefined, // COMERCIAL não tem instituição
      });
    },
    onSuccess: () => {
      toast.success('Usuário Comercial criado com sucesso!');
      setIsCreateDialogOpen(false);
      setCreateFormData({ email: '', password: '', nome_completo: '' });
      fetchComerciais();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Erro ao criar usuário comercial');
    },
  });

  const updateMutation = useSafeMutation({
    mutationFn: async (data: { id: string; email?: string; nomeCompleto?: string; telefone?: string }) => {
      const updateData: any = {};
      if (data.email) updateData.email = data.email;
      if (data.nomeCompleto) updateData.nomeCompleto = data.nomeCompleto;
      if (data.telefone !== undefined) updateData.telefone = data.telefone || null;

      return await usersApi.update(data.id, updateData);
    },
    onSuccess: () => {
      toast.success('Usuário atualizado com sucesso!');
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      fetchComerciais();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Erro ao atualizar');
    },
  });

  const resetPasswordMutation = useSafeMutation({
    mutationFn: async (data: { userId: string; newPassword: string; sendEmail: boolean }) => {
      return await authApi.resetUserPassword(data.userId, data.newPassword, data.sendEmail);
    },
    onSuccess: () => {
      toast.success('Senha redefinida com sucesso!');
      setIsPasswordDialogOpen(false);
      setPasswordFormData({ newPassword: '', confirmPassword: '', sendEmail: false });
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Erro ao redefinir senha');
    },
  });

  const deleteMutation = useSafeMutation({
    mutationFn: async (userId: string) => {
      return await usersApi.delete(userId);
    },
    onSuccess: () => {
      toast.success('Usuário excluído com sucesso!');
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchComerciais();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Erro ao excluir');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordStrong(createFormData.password, true)) {
      toast.error('A senha deve conter pelo menos uma letra maiúscula e um caractere especial.');
      return;
    }

    if (createFormData.password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    createMutation.mutate(createFormData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (editFormData.email && !emailRegex.test(editFormData.email)) {
      toast.error('Email inválido');
      return;
    }

    updateMutation.mutate({
      id: selectedUser.id,
      email: editFormData.email,
      nomeCompleto: editFormData.nome_completo,
      telefone: editFormData.telefone,
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

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
      userId: selectedUser.id,
      newPassword: passwordFormData.newPassword,
      sendEmail: passwordFormData.sendEmail,
    });
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
              Equipe Comercial
            </CardTitle>
            <CardDescription>
              Gerencie os usuários com perfil Comercial (onboarding, assinaturas, pagamentos)
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Comercial
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Usuário Comercial</DialogTitle>
                <DialogDescription>
                  Crie um novo usuário com perfil Comercial. Ele poderá criar instituições, gerenciar assinaturas e confirmar pagamentos.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome_completo">Nome Completo *</Label>
                  <Input
                    id="nome_completo"
                    value={createFormData.nome_completo}
                    onChange={(e) => setCreateFormData({ ...createFormData, nome_completo: e.target.value })}
                    placeholder="Nome do vendedor"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                    placeholder="vendedor@empresa.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={createFormData.password}
                    onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required
                  />
                  {createFormData.password && (
                    <PasswordStrengthIndicator password={createFormData.password} userRole="COMERCIAL" />
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createMutation.isPending ||
                      !createFormData.password ||
                      !isPasswordStrong(createFormData.password, true)
                    }
                  >
                    {createMutation.isPending ? 'Criando...' : 'Criar Comercial'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum usuário Comercial encontrado</p>
            <p className="text-sm mt-2">Clique em &quot;Novo Comercial&quot; para adicionar o primeiro</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url || user.avatarUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(user.nome_completo || user.nomeCompleto || '')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.nome_completo || user.nomeCompleto}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.telefone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {user.telefone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                        <Briefcase className="h-3 w-3 mr-1" />
                        COMERCIAL
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatDate(user.created_at || user.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setEditFormData({
                              email: user.email || '',
                              nome_completo: user.nome_completo || user.nomeCompleto || '',
                              telefone: user.telefone || '',
                            });
                            setIsEditDialogOpen(true);
                          }}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setPasswordFormData({ newPassword: '', confirmPassword: '', sendEmail: false });
                            setIsPasswordDialogOpen(true);
                          }}
                          title="Alterar Senha"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsDeleteDialogOpen(true);
                          }}
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
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário Comercial</DialogTitle>
            <DialogDescription>Atualize as informações do usuário</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_nome_completo">Nome Completo *</Label>
              <Input
                id="edit_nome_completo"
                value={editFormData.nome_completo}
                onChange={(e) => setEditFormData({ ...editFormData, nome_completo: e.target.value })}
                placeholder="Nome"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_email">E-mail *</Label>
              <Input
                id="edit_email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                placeholder="email@empresa.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_telefone">Telefone</Label>
              <Input
                id="edit_telefone"
                type="tel"
                value={editFormData.telefone}
                onChange={(e) => setEditFormData({ ...editFormData, telefone: e.target.value })}
                placeholder="+244 900 000 000"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>Redefina a senha de {selectedUser?.nome_completo || selectedUser?.nomeCompleto}</DialogDescription>
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
                <PasswordStrengthIndicator password={passwordFormData.newPassword} userRole="COMERCIAL" />
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
                disabled={
                  resetPasswordMutation.isPending ||
                  !passwordFormData.newPassword ||
                  !isPasswordStrong(passwordFormData.newPassword, true) ||
                  passwordFormData.newPassword !== passwordFormData.confirmPassword
                }
              >
                {resetPasswordMutation.isPending ? 'Alterando...' : 'Alterar Senha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{' '}
              <strong>{selectedUser?.nome_completo || selectedUser?.nomeCompleto}</strong> ({selectedUser?.email})?
              <br />
              <br />
              <span className="text-red-600 font-semibold">Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUser && deleteMutation.mutate(selectedUser.id)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
