import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Globe, ExternalLink, Pencil, Trash2, UserPlus, GraduationCap, School, KeyRound, Users, ChevronDown, ChevronUp, Search, Info } from 'lucide-react';
import { instituicoesApi, onboardingApi, usersApi, authApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { toast } from 'sonner';
import { OrphanAdminsManager } from './OrphanAdminsManager';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PasswordStrengthIndicator, isPasswordStrong } from '@/components/auth/PasswordStrengthIndicator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const { role, user } = useAuth();
  const userRoles: string[] = Array.isArray((user as { roles?: string[] })?.roles)
    ? (user as { roles: string[] }).roles
    : role
      ? [role]
      : [];
  const isSuperAdmin = role === 'SUPER_ADMIN';
  /** Alinhado ao backend: só SUPER_ADMIN pode DELETE /instituicoes/:id */
  const canDeleteInstituicao = userRoles.includes('SUPER_ADMIN');
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useSafeDialog(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useSafeDialog(false);
  const [isDeleteAdminDialogOpen, setIsDeleteAdminDialogOpen] = useSafeDialog(false);
  const [isDeleteInstituicaoDialogOpen, setIsDeleteInstituicaoDialogOpen] = useSafeDialog(false);
  const [instituicaoToDelete, setInstituicaoToDelete] = useState<Instituicao | null>(null);
  const [deleteInstituicaoAcceptedTerms, setDeleteInstituicaoAcceptedTerms] = useState(false);
  const [deleteInstituicaoJustificativa, setDeleteInstituicaoJustificativa] = useState('');
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
    
    // CRÍTICO: tipoAcademico obrigatório ao criar (igual ao onboarding)
    if (!editingInstituicao && (!formData.tipo_academico || (formData.tipo_academico !== 'SUPERIOR' && formData.tipo_academico !== 'SECUNDARIO'))) {
      toast.error('Selecione o tipo acadêmico (Ensino Superior ou Ensino Secundário).');
      return;
    }
    
    const payload: any = {
      nome: formData.nome,
      subdominio: formData.subdominio.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      logoUrl: formData.logo_url || null,
      emailContato: formData.email_contato || null,
      telefone: formData.telefone || null,
      endereco: formData.endereco || null,
      status: formData.status,
    };

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
    mutationFn: async ({ id, justificativa }: { id: string; justificativa: string }) => {
      return await instituicoesApi.delete(id, justificativa);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instituicoes'] });
      toast.success('Instituição excluída com sucesso!');
      fetchInstituicoes();
    },
    onError: (error: any) => {
      console.error('Error:', error);
      const msg = error?.response?.data?.message || error?.message || 'Erro ao excluir instituição';
      toast.error(msg);
    },
  });

  const handleDelete = (inst: Instituicao) => {
    setInstituicaoToDelete(inst);
    setIsDeleteInstituicaoDialogOpen(true);
  };
  const handleDeleteInstituicaoConfirm = () => {
    const just = deleteInstituicaoJustificativa.trim();
    if (!instituicaoToDelete || !deleteInstituicaoAcceptedTerms || just.length < 10) return;
    deleteInstituicaoMutation.mutate({ id: instituicaoToDelete.id, justificativa: just });
    setIsDeleteInstituicaoDialogOpen(false);
    setInstituicaoToDelete(null);
    setDeleteInstituicaoAcceptedTerms(false);
    setDeleteInstituicaoJustificativa('');
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
      const res = await usersApi.getAll({ role: 'ADMIN' });
      const allAdmins = res?.data ?? [];

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

  const renderInstituicaoActionButtons = (inst: Instituicao) => (
    <TooltipProvider>
      <div className="flex flex-wrap justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 touch-manipulation"
              onClick={() => window.open(`https://${inst.subdominio}.dsicola.com`, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Abrir site da instituição</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 touch-manipulation"
              onClick={() => handleOpenAdminDialog(inst)}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Adicionar administrador à instituição</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 touch-manipulation"
              onClick={() => toggleAdminsList(inst.id)}
            >
              {isAdminsListOpen[inst.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isAdminsListOpen[inst.id] ? 'Ocultar administradores' : 'Ver administradores'}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 touch-manipulation"
              onClick={() => handleEdit(inst)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Editar instituição</p>
          </TooltipContent>
        </Tooltip>
        {canDeleteInstituicao ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 touch-manipulation text-destructive hover:text-destructive"
                onClick={() => handleDelete(inst)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Excluir instituição (Super Admin)</p>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  );

  const renderAdminsExpansion = (inst: Instituicao) => (
    <div className="p-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
        <h4 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
          <Users className="h-4 w-4 shrink-0" />
          Administradores de {inst.nome}
        </h4>
        <Button variant="outline" size="sm" onClick={() => fetchAdminsForInstituicao(inst.id)} disabled={loadingAdmins[inst.id]}>
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
            <div key={admin.id} className="flex flex-col gap-3 p-3 border rounded-lg bg-background sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={admin.avatarUrl || admin.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(admin.nomeCompleto || admin.nome_completo || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">{admin.nomeCompleto || admin.nome_completo}</p>
                  <p className="text-sm text-muted-foreground truncate">{admin.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => handlePasswordReset(admin, inst)} title="Alterar Senha">
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
  );

  return (
    <div className="space-y-6">
      {/* Alerta de ADMINs órfãos — apenas SUPER_ADMIN (COMERCIAL não tem acesso a GET /profiles) */}
      {isSuperAdmin && <OrphanAdminsManager />}

      <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Instituições
            </CardTitle>
            <CardDescription>
              Gerencie todas as instituições cadastradas na plataforma DSICOLA.
              {role === 'COMERCIAL' && !canDeleteInstituicao ? (
                <span className="mt-1 block text-amber-800 dark:text-amber-200">
                  A exclusão definitiva de uma instituição só está disponível para perfil Super Administrador.
                </span>
              ) : null}
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
      <CardContent className="space-y-4">
        {canDeleteInstituicao ? (
          <Alert className="border-primary/25 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-foreground">Onde excluir uma instituição</AlertTitle>
            <AlertDescription className="mt-2 space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">1.</strong> Inicie sessão no <strong className="text-foreground">domínio principal</strong> da DSICOLA
                (ex.: <span className="font-mono text-xs">dsicola.com</span>), <strong className="text-foreground">não</strong> no site da escola (
                <span className="font-mono text-xs">escola.dsicola.com</span>), com um utilizador <strong className="text-foreground">Super Admin</strong>.
              </p>
              <p>
                <strong className="text-foreground">2.</strong> Vá ao painel <span className="font-mono text-xs">/super-admin</span> e abra o separador{' '}
                <strong className="text-foreground">Instituições</strong> (primeira fila de separadores — ícone de edifício).
              </p>
              <p>
                <strong className="text-foreground">3.</strong> Em telemóvel, use os <strong className="text-foreground">cartões</strong> abaixo: os botões de ação ficam sempre visíveis por baixo de cada escola (inclui o ícone vermelho do lixo).
                Em tablet ou computador, a mesma linha aparece na tabela na coluna <strong className="text-foreground">Ações</strong>.
              </p>
              <p>
                <strong className="text-foreground">4.</strong> Confirme, aceite os termos e escreva uma <strong className="text-foreground">justificativa com pelo menos 10 caracteres</strong>{' '}
                (obrigatório por auditoria). A operação não pode ser desfeita aqui.
              </p>
            </AlertDescription>
          </Alert>
        ) : null}
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
          <>
            <p className="text-xs text-muted-foreground md:hidden">
              Em ecrã pequeno cada escola aparece em cartão. As ações (site, admins, editar, excluir) ficam à vista por baixo, sem deslizar a
              tabela horizontalmente.
            </p>
            <div className="flex flex-col gap-3 md:hidden">
              {filtered.map((inst) => (
                <div key={`card-${inst.id}`} className="rounded-lg border bg-card shadow-sm overflow-hidden">
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {inst.logo_url ? (
                        <img src={inst.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-tight">{inst.nome}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-1 break-all">{inst.subdominio}.dsicola.com</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="gap-1">
                        {getTipoIcon(inst.tipo_instituicao)}
                        {getTipoLabel(inst.tipo_instituicao)}
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        {inst.tipo_academico === 'SUPERIOR' ? (
                          <GraduationCap className="h-3 w-3" />
                        ) : inst.tipo_academico === 'SECUNDARIO' ? (
                          <School className="h-3 w-3" />
                        ) : null}
                        {getTipoAcademicoLabel(inst.tipo_academico || inst.tipoAcademico)}
                      </Badge>
                      <Badge variant={inst.status === 'ativa' ? 'default' : 'secondary'}>
                        {inst.status === 'ativa' ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {inst.email_contato ? <p className="break-all">E-mail: {inst.email_contato}</p> : null}
                      <p className="tabular-nums">
                        Criado: {inst.created_at ? new Date(inst.created_at).toLocaleDateString('pt-BR') : '-'}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-border/70">{renderInstituicaoActionButtons(inst)}</div>
                  </div>
                  {isAdminsListOpen[inst.id] ? (
                    <div className="border-t bg-muted/30">{renderAdminsExpansion(inst)}</div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="hidden md:block rounded-md border overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tipo Acadêmico</TableHead>
                  <TableHead>Subdomínio</TableHead>
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
                    <TableCell className="text-right">{renderInstituicaoActionButtons(inst)}</TableCell>
                    </TableRow>
                    {/* Lista de Administradores Expandida */}
                    {isAdminsListOpen[inst.id] && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30 p-0">
                          {renderAdminsExpansion(inst)}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
            </div>
          </>
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

      {/* Delete Instituição Confirmation Dialog */}
      <AlertDialog open={isDeleteInstituicaoDialogOpen} onOpenChange={(open) => { setIsDeleteInstituicaoDialogOpen(open); if (!open) { setInstituicaoToDelete(null); setDeleteInstituicaoAcceptedTerms(false); setDeleteInstituicaoJustificativa(''); } }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir instituição</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Confirma a exclusão da instituição <strong>{instituicaoToDelete?.nome}</strong> ({instituicaoToDelete?.subdominio})?
                </p>
                <p className="text-red-600 font-semibold">
                  Operação irreversível. Todos os dados serão removidos permanentemente.
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50 p-4 text-sm">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">Termo de responsabilidade e conformidade</p>
                  <p className="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed">
                    Declaro que: (i) tenho competência e autoridade para realizar esta exclusão; (ii) estou ciente de que todos os dados associados — utilizadores, turmas, matrículas, alunos, comunicados, documentos e demais registos — serão eliminados de forma definitiva e irreversível; (iii) assumo integral responsabilidade por esta decisão e pelas suas consequências; (iv) a justificativa será registada para fins de auditoria e conformidade.
                  </p>
                </div>
                <div className="flex items-start space-x-2 pt-2">
                  <Checkbox
                    id="delete-terms"
                    checked={deleteInstituicaoAcceptedTerms}
                    onCheckedChange={(checked) => setDeleteInstituicaoAcceptedTerms(checked === true)}
                  />
                  <label htmlFor="delete-terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                    Li e aceito o termo de responsabilidade e conformidade
                  </label>
                </div>
                <div className="space-y-2 pt-2">
                  <Label htmlFor="delete-justificativa" className="text-sm font-medium">Justificativa da exclusão *</Label>
                  <Textarea
                    id="delete-justificativa"
                    placeholder="Descreva o motivo da exclusão (mín. 10 caracteres, será registado)"
                    value={deleteInstituicaoJustificativa}
                    onChange={(e) => setDeleteInstituicaoJustificativa(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInstituicaoConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteInstituicaoMutation.isPending || !deleteInstituicaoAcceptedTerms || deleteInstituicaoJustificativa.trim().length < 10}
            >
              {deleteInstituicaoMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
