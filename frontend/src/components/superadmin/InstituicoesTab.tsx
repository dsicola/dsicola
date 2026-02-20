import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Globe, ExternalLink, Pencil, Trash2, UserPlus, GraduationCap, School, KeyRound, Users, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { instituicoesApi, onboardingApi, usersApi, authApi } from '@/services/api';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { toast } from 'sonner';
import { OrphanAdminsManager } from './OrphanAdminsManager';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PasswordStrengthIndicator, isPasswordStrong } from '@/components/auth/PasswordStrengthIndicator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Instituicao {
  id: string;
  nome: string;
  subdominio: string;
  logo_url: string | null;
  email_contato: string | null;
  telefone: string | null;
  endereco: string | null;
  status: string;
  tipo_instituicao: string;
  tipo_academico?: 'SECUNDARIO' | 'SUPERIOR' | null;
  tipoAcademico?: 'SECUNDARIO' | 'SUPERIOR' | null; // Aceita também camelCase do backend
  created_at: string;
  createdAt?: string; // Aceita também camelCase do backend
}

export const InstituicoesTab = () => {
  const queryClient = useQueryClient();
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useSafeDialog(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useSafeDialog(false);
  const [isDeleteAdminDialogOpen, setIsDeleteAdminDialogOpen] = useSafeDialog(false);
  const [isAdminsListOpen, setIsAdminsListOpen] = useState<Record<string, boolean>>({});
  const [instituicaoAdmins, setInstituicaoAdmins] = useState<Record<string, any[]>>({});
  const [loadingAdmins, setLoadingAdmins] = useState<Record<string, boolean>>({});
  const [editingInstituicao, setEditingInstituicao] = useState<Instituicao | null>(null);
  const [selectedInstituicao, setSelectedInstituicao] = useState<Instituicao | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    subdominio: '',
    logo_url: '',
    email_contato: '',
    telefone: '',
    endereco: '',
    status: 'ativa',
    tipo_academico: '' as 'SECUNDARIO' | 'SUPERIOR' | '',
  });
  const [adminFormData, setAdminFormData] = useState({
    nome_completo: '',
    email: '',
    password: '',
  });
  
  const [passwordFormData, setPasswordFormData] = useState({
    newPassword: '',
    confirmPassword: '',
    sendEmail: false,
  });

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchInstituicoes, setSearchInstituicoes] = useState('');

  // Normaliza dados da API para formato consistente
  const normalizeInstituicao = (inst: any): Instituicao => {
    return {
      ...inst,
      logo_url: inst.logo_url || inst.logoUrl || null,
      email_contato: inst.email_contato ?? inst.emailContato ?? null,
      telefone: inst.telefone ?? null,
      endereco: inst.endereco ?? null,
      tipo_instituicao: inst.tipo_instituicao || inst.tipoInstituicao || 'EM_CONFIGURACAO',
      tipo_academico: inst.tipo_academico ?? inst.tipoAcademico ?? null,
      tipoAcademico: inst.tipo_academico ?? inst.tipoAcademico ?? null,
      created_at: inst.created_at || inst.createdAt || new Date().toISOString(),
    };
  };

  const fetchInstituicoes = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await instituicoesApi.getAll();
      const normalized = (data || []).map(normalizeInstituicao);
      setInstituicoes(normalized);
    } catch (error: any) {
      console.error('Error fetching instituicoes:', error);
      const errorMessage = error?.message || 'Erro desconhecido';
      setFetchError(`Falha na comunicação com o servidor: ${errorMessage}`);
      toast.error('Falha ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstituicoes();
  }, []);

  // Create/Update mutation - protegida contra unmount
  const saveInstituicaoMutation = useSafeMutation({
    mutationFn: async (payload: { isEdit: boolean; id?: string; data: any }) => {
      if (payload.isEdit && payload.id) {
        return await instituicoesApi.update(payload.id, payload.data);
      } else {
        return await instituicoesApi.create(payload.data);
      }
    },
    onSuccess: (data, variables) => {
      if (!variables.isEdit && data) {
        const normalized = normalizeInstituicao(data);
        setInstituicoes(prev => [normalized, ...prev]);
      }
      queryClient.invalidateQueries({ queryKey: ['instituicoes'] });
      toast.success(`Instituição ${variables.isEdit ? 'atualizada' : 'criada'} com sucesso!`);
      setIsDialogOpen(false);
      resetForm();
      fetchInstituicoes();
    },
    onError: (error: any) => {
      if (error.response?.data?.message?.includes('subdomínio')) {
        toast.error('Este subdomínio já está em uso. Escolha outro.');
      } else {
        toast.error(`Erro ao salvar instituição: ${error.message || 'Tente novamente'}`);
      }
    },
  });

  // Create admin mutation - protegida contra unmount
  const createAdminMutation = useSafeMutation({
    mutationFn: async (data: {
      instituicaoId: string;
      emailAdmin: string;
      senhaAdmin: string;
      nomeAdmin: string;
    }) => {
      return await onboardingApi.criarAdminInstituicao(data);
    },
    onSuccess: (_, variables) => {
      toast.success(`Admin "${variables.nomeAdmin}" criado para ${selectedInstituicao?.nome}!`);
      setIsAdminDialogOpen(false);
      setAdminFormData({ nome_completo: '', email: '', password: '' });
      setSelectedInstituicao(null);
      queryClient.invalidateQueries({ queryKey: ['instituicoes'] });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Erro ao criar administrador';
      toast.error(errorMessage);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (saveInstituicaoMutation.isPending) return;
    
    const payload: any = {
      nome: formData.nome,
      subdominio: formData.subdominio.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      logoUrl: formData.logo_url || null,
      emailContato: formData.email_contato || null,
      telefone: formData.telefone || null,
      endereco: formData.endereco || null,
      status: formData.status,
    };

    // CRÍTICO: Incluir tipoAcademico se fornecido (permite atualizar instituições antigas)
    if (formData.tipo_academico && (formData.tipo_academico === 'SUPERIOR' || formData.tipo_academico === 'SECUNDARIO')) {
      payload.tipoAcademico = formData.tipo_academico;
    }

    saveInstituicaoMutation.mutate({
      isEdit: !!editingInstituicao,
      id: editingInstituicao?.id,
      data: payload,
    });
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstituicao) return;
    
    if (createAdminMutation.isPending) return;
    
    // Validar força da senha para ADMIN
    if (adminFormData.password) {
      const isStrong = isPasswordStrong(adminFormData.password, false, 'ADMIN');
      if (!isStrong) {
        toast.error("Senha muito fraca. Utilize letras maiúsculas, números e símbolos.");
        return;
      }
    }
    
    createAdminMutation.mutate({
      instituicaoId: selectedInstituicao.id,
      emailAdmin: adminFormData.email,
      senhaAdmin: adminFormData.password,
      nomeAdmin: adminFormData.nome_completo,
    });
  };

  const handleEdit = (inst: Instituicao) => {
    setEditingInstituicao(inst);
    setFormData({
      nome: inst.nome,
      subdominio: inst.subdominio,
      logo_url: inst.logo_url || '',
      email_contato: inst.email_contato || '',
      telefone: inst.telefone || '',
      endereco: inst.endereco || '',
      status: inst.status,
      tipo_academico: (inst.tipo_academico || inst.tipoAcademico || '') as 'SECUNDARIO' | 'SUPERIOR' | '',
    });
    setIsDialogOpen(true);
  };

  // Delete mutation - protegida contra unmount
  const deleteInstituicaoMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      return await instituicoesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instituicoes'] });
      toast.success('Instituição excluída com sucesso!');
      fetchInstituicoes();
    },
    onError: (error: any) => {
      console.error('Error:', error);
      toast.error('Erro ao excluir instituição');
    },
  });

  const handleDelete = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta instituição?')) return;
    deleteInstituicaoMutation.mutate(id);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      subdominio: '',
      logo_url: '',
      email_contato: '',
      telefone: '',
      endereco: '',
      status: 'ativa',
      tipo_academico: '',
    });
    setEditingInstituicao(null);
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'UNIVERSIDADE':
        return 'Ensino Superior';
      case 'ENSINO_MEDIO':
        return 'Ensino Secundário';
      case 'MISTA':
        return 'Instituição Mista';
      case 'EM_CONFIGURACAO':
        return 'Em Configuração';
      default:
        return tipo;
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'UNIVERSIDADE':
        return <GraduationCap className="h-3 w-3" />;
      case 'ENSINO_MEDIO':
        return <School className="h-3 w-3" />;
      case 'MISTA':
        return <Building2 className="h-3 w-3" />;
      default:
        return <Building2 className="h-3 w-3" />;
    }
  };

  const getTipoAcademicoLabel = (tipo: 'SECUNDARIO' | 'SUPERIOR' | null | undefined) => {
    if (!tipo) return 'Não identificado';
    return tipo === 'SECUNDARIO' ? 'Ensino Secundário' : 'Ensino Superior';
  };

  const handleOpenDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenAdminDialog = (inst: Instituicao) => {
    setSelectedInstituicao(inst);
    setAdminFormData({ nome_completo: '', email: '', password: '' });
    setIsAdminDialogOpen(true);
  };

  // Buscar administradores de uma instituição
  const fetchAdminsForInstituicao = async (instituicaoId: string) => {
    setLoadingAdmins(prev => ({ ...prev, [instituicaoId]: true }));
    try {
      // SUPER_ADMIN pode buscar todos os admins, depois filtramos por instituicaoId no frontend
      const allAdmins = await usersApi.getAll({ role: 'ADMIN' });
      
      // Filtrar apenas os admins desta instituição
      const filteredAdmins = (allAdmins || []).filter((admin: any) => 
        admin.instituicaoId === instituicaoId || admin.instituicao_id === instituicaoId
      );
      
      setInstituicaoAdmins(prev => ({ ...prev, [instituicaoId]: filteredAdmins }));
    } catch (error: any) {
      console.error('Error fetching admins:', error);
      toast.error('Erro ao carregar administradores');
      setInstituicaoAdmins(prev => ({ ...prev, [instituicaoId]: [] }));
    } finally {
      setLoadingAdmins(prev => ({ ...prev, [instituicaoId]: false }));
    }
  };

  const toggleAdminsList = (instituicaoId: string) => {
    const isOpen = isAdminsListOpen[instituicaoId];
    setIsAdminsListOpen(prev => ({ ...prev, [instituicaoId]: !isOpen }));
    
    if (!isOpen && !instituicaoAdmins[instituicaoId]) {
      fetchAdminsForInstituicao(instituicaoId);
    }
  };

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

  // Delete admin mutation
  const deleteAdminMutation = useSafeMutation({
    mutationFn: async (userId: string) => {
      return await usersApi.delete(userId);
    },
    onSuccess: (_, userId) => {
      toast.success('Administrador excluído com sucesso!');
      setIsDeleteAdminDialogOpen(false);
      setSelectedAdmin(null);
      // Atualizar lista de admins
      if (selectedInstituicao) {
        setInstituicaoAdmins(prev => ({
          ...prev,
          [selectedInstituicao.id]: (prev[selectedInstituicao.id] || []).filter((a: any) => a.id !== userId)
        }));
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Erro ao excluir administrador');
    },
  });

  const handlePasswordReset = (admin: any, instituicao: Instituicao) => {
    setSelectedAdmin(admin);
    setSelectedInstituicao(instituicao);
    setPasswordFormData({ newPassword: '', confirmPassword: '', sendEmail: false });
    setIsPasswordDialogOpen(true);
  };

  const handleDeleteAdmin = (admin: any, instituicao: Instituicao) => {
    setSelectedAdmin(admin);
    setSelectedInstituicao(instituicao);
    setIsDeleteAdminDialogOpen(true);
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

  return (
    <div className="space-y-6">
      {/* Alerta de ADMINs órfãos */}
      <OrphanAdminsManager />

      <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              🏫 Instituições
            </CardTitle>
            <CardDescription>
              Gerencie todas as instituições cadastradas na plataforma DSICOLA
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Nova Instituição
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingInstituicao ? 'Editar Instituição' : 'Nova Instituição'}
                </DialogTitle>
                <DialogDescription>
                  {editingInstituicao 
                    ? 'Atualize os dados da instituição' 
                    : 'Preencha os dados para criar uma nova instituição'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da Instituição *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Universidade LUAS"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subdominio">Subdomínio *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="subdominio"
                      value={formData.subdominio}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        subdominio: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') 
                      })}
                      placeholder="Ex: uniluas"
                      required
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">.dsicola.com</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo_url">URL do Logo</Label>
                  <Input
                    id="logo_url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://..."
                    type="url"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_contato">E-mail de Contato</Label>
                  <Input
                    id="email_contato"
                    value={formData.email_contato}
                    onChange={(e) => setFormData({ ...formData, email_contato: e.target.value })}
                    placeholder="contato@instituicao.com"
                    type="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="+244 xxx xxx xxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_academico">Tipo Acadêmico *</Label>
                  <Select 
                    value={formData.tipo_academico} 
                    onValueChange={(value) => setFormData({ ...formData, tipo_academico: value as 'SECUNDARIO' | 'SUPERIOR' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo acadêmico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPERIOR">Ensino Superior</SelectItem>
                      <SelectItem value="SECUNDARIO">Ensino Secundário</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {editingInstituicao 
                      ? 'Atualize o tipo acadêmico da instituição. Isso afetará quais campos são exibidos (Semestre vs Trimestre, Curso vs Classe).'
                      : 'Selecione o tipo acadêmico da instituição. Isso determinará quais campos serão exibidos (Semestre vs Trimestre, Curso vs Classe).'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="inativa">Inativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saveInstituicaoMutation.isPending}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saveInstituicaoMutation.isPending}>
                    {saveInstituicaoMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Salvando...
                      </span>
                    ) : editingInstituicao ? 'Atualizar' : 'Criar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {instituicoes.length > 0 && (
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, subdomínio ou e-mail..."
                value={searchInstituicoes}
                onChange={(e) => setSearchInstituicoes(e.target.value)}
                className="pl-9"
              />
              {searchInstituicoes && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchInstituicoes('')}
                >
                  ×
                </Button>
              )}
            </div>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : fetchError ? (
          <div className="text-center py-8">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-destructive opacity-50" />
            <p className="text-destructive font-medium mb-2">Erro ao carregar instituições</p>
            <p className="text-sm text-muted-foreground mb-4">{fetchError}</p>
            <Button variant="outline" onClick={fetchInstituicoes}>
              Tentar Novamente
            </Button>
          </div>
        ) : (() => {
          const q = searchInstituicoes.trim().toLowerCase();
          const filtered = q
            ? instituicoes.filter(
                (inst) =>
                  (inst.nome || '').toLowerCase().includes(q) ||
                  (inst.subdominio || '').toLowerCase().includes(q) ||
                  (inst.email_contato || '').toLowerCase().includes(q) ||
                  (inst.tipo_instituicao || '').toLowerCase().includes(q) ||
                  (inst.tipo_academico || inst.tipoAcademico || '').toLowerCase().includes(q)
              )
            : instituicoes;
          return filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{searchInstituicoes ? 'Nenhuma instituição encontrada para a pesquisa' : 'Nenhuma instituição cadastrada'}</p>
            {searchInstituicoes && (
              <Button variant="link" className="mt-2" onClick={() => setSearchInstituicoes('')}>
                Limpar pesquisa
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto -mx-1 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tipo Acadêmico</TableHead>
                  <TableHead>🌐 Subdomínio</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inst) => (
                  <React.Fragment key={inst.id}>
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {inst.logo_url && (
                            <img 
                              src={inst.logo_url} 
                              alt={inst.nome} 
                              className="h-8 w-8 rounded object-cover"
                            />
                          )}
                          {inst.nome}
                        </div>
                      </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {getTipoIcon(inst.tipo_instituicao)}
                        {getTipoLabel(inst.tipo_instituicao)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        {inst.tipo_academico === 'SUPERIOR' ? (
                          <GraduationCap className="h-3 w-3" />
                        ) : inst.tipo_academico === 'SECUNDARIO' ? (
                          <School className="h-3 w-3" />
                        ) : null}
                        {getTipoAcademicoLabel(inst.tipo_academico || inst.tipoAcademico)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">
                          {inst.subdominio}.dsicola.com
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{inst.email_contato || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={inst.status === 'ativa' ? 'default' : 'secondary'}>
                        {inst.status === 'ativa' ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inst.created_at ? new Date(inst.created_at).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(`https://${inst.subdominio}.dsicola.com`, '_blank')}
                            title="Abrir site"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenAdminDialog(inst)}
                            title="Adicionar Admin"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleAdminsList(inst.id)}
                            title="Ver Administradores"
                          >
                            {isAdminsListOpen[inst.id] ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(inst)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(inst.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {/* Lista de Administradores Expandida */}
                    {isAdminsListOpen[inst.id] && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30 p-0">
                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Administradores de {inst.nome}
                              </h4>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchAdminsForInstituicao(inst.id)}
                                disabled={loadingAdmins[inst.id]}
                              >
                                {loadingAdmins[inst.id] ? 'Carregando...' : 'Atualizar'}
                              </Button>
                            </div>
                            {loadingAdmins[inst.id] ? (
                              <div className="flex items-center justify-center py-4">
                                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                              </div>
                            ) : !instituicaoAdmins[inst.id] || instituicaoAdmins[inst.id].length === 0 ? (
                              <div className="text-center py-4 text-muted-foreground">
                                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Nenhum administrador encontrado</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {instituicaoAdmins[inst.id].map((admin: any) => (
                                  <div
                                    key={admin.id}
                                    className="flex items-center justify-between p-3 border rounded-lg bg-background"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-10 w-10">
                                        <AvatarImage src={admin.avatarUrl || admin.avatar_url} />
                                        <AvatarFallback className="bg-primary/10 text-primary">
                                          {getInitials(admin.nomeCompleto || admin.nome_completo || '')}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p className="font-medium">{admin.nomeCompleto || admin.nome_completo}</p>
                                        <p className="text-sm text-muted-foreground">{admin.email}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handlePasswordReset(admin, inst)}
                                        title="Alterar Senha"
                                      >
                                        <KeyRound className="h-4 w-4 mr-2" />
                                        Alterar Senha
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteAdmin(admin, inst)}
                                        title="Excluir"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Excluir
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        );
        })()}
      </CardContent>
      </Card>

      {/* Admin Creation Dialog */}
      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Administrador</DialogTitle>
            <DialogDescription>
              Criar um novo administrador para {selectedInstituicao?.nome}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin_nome">Nome Completo *</Label>
              <Input
                id="admin_nome"
                value={adminFormData.nome_completo}
                onChange={(e) => setAdminFormData({ ...adminFormData, nome_completo: e.target.value })}
                placeholder="Nome do administrador"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_email">E-mail *</Label>
              <Input
                id="admin_email"
                type="email"
                value={adminFormData.email}
                onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                placeholder="admin@instituicao.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_password">Senha *</Label>
              <Input
                id="admin_password"
                type="password"
                value={adminFormData.password}
                onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                placeholder="Mínimo 8 caracteres com maiúscula e símbolo"
                minLength={8}
                required
              />
              {adminFormData.password && (
                <PasswordStrengthIndicator 
                  password={adminFormData.password} 
                  userRole="ADMIN"
                />
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAdminDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={
                  createAdminMutation.isPending || 
                  (adminFormData.password && !isPasswordStrong(adminFormData.password, false, 'ADMIN'))
                }
              >
                {createAdminMutation.isPending ? 'Criando...' : 'Criar Admin'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Senha do Administrador</DialogTitle>
            <DialogDescription>
              Redefina a senha do administrador {selectedAdmin?.nomeCompleto || selectedAdmin?.nome_completo} ({selectedAdmin?.email})
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

      {/* Delete Admin Confirmation Dialog */}
      <AlertDialog open={isDeleteAdminDialogOpen} onOpenChange={setIsDeleteAdminDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o administrador <strong>{selectedAdmin?.nomeCompleto || selectedAdmin?.nome_completo}</strong> ({selectedAdmin?.email})?
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
    </div>
  );
};
