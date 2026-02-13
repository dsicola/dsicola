import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { userRolesApi, profilesApi, usersApi } from "@/services/api";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useTenantFilter, useCurrentInstituicaoId } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Plus, Pencil, Trash2, CreditCard, Copy } from "lucide-react";
import { PasswordStrengthIndicator, isPasswordStrong } from "@/components/auth/PasswordStrengthIndicator";

interface POSUser {
  id: string;
  nome_completo: string;
  email: string;
  telefone: string | null;
  status_aluno: string | null;
  created_at: string;
}

export function POSTab() {
  const queryClient = useQueryClient();
  const { config } = useInstituicao();
  const { instituicaoId, shouldFilter } = useTenantFilter();
  const currentInstituicaoId = useCurrentInstituicaoId();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useSafeDialog(false);
  const [showDeleteDialog, setShowDeleteDialog] = useSafeDialog(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useSafeDialog(false);
  const [editingUser, setEditingUser] = useState<POSUser | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; senha: string } | null>(null);
  
  const [formData, setFormData] = useState({
    nome_completo: "",
    email: "",
    telefone: "",
    senha: "",
  });

  // Fetch POS users
  const { data: posUsers, isLoading } = useQuery({
    queryKey: ["pos-users", instituicaoId],
    queryFn: async () => {
      const params: any = { role: "POS" };
      // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
      // O backend usa req.user.instituicaoId do JWT token automaticamente
      const rolesData = await userRolesApi.getAll(params);
      
      const userIds = rolesData?.map((r: any) => r.user_id) || [];
      
      if (userIds.length === 0) return [] as POSUser[];

      const profilesData = await profilesApi.getByIds(userIds);

      return profilesData as POSUser[];
    },
  });

  // Create POS user
  const createMutation = useSafeMutation({
    mutationFn: async (data: typeof formData) => {
      const senha = data.senha;
      
      // Create user with POS role via users API
      await usersApi.create({
        email: data.email,
        password: senha,
        nomeCompleto: data.nome_completo,
        role: "POS",
        instituicaoId: currentInstituicaoId || undefined,
      });

      return { email: data.email, senha };
    },
    onSuccess: (creds) => {
      queryClient.invalidateQueries({ queryKey: ["pos-users"] });
      setCredentials(creds);
      setShowDialog(false);
      setShowCredentialsDialog(true);
      resetForm();
      toast({
        title: "Usuário POS criado",
        description: "O usuário do ponto de venda foi criado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.response?.data?.error || error.message,
        variant: "destructive",
      });
    },
  });

  // Update POS user
  const updateMutation = useSafeMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      await profilesApi.update(data.id, {
        nomeCompleto: data.nome_completo,
        telefone: data.telefone || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-users"] });
      setShowDialog(false);
      resetForm();
      toast({
        title: "Dados atualizados",
        description: "Os dados foram atualizados com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.response?.data?.error || error.message,
        variant: "destructive",
      });
    },
  });

  // Deactivate POS user
  const deactivateMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await profilesApi.update(id, { status: "Inativo" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-users"] });
      setShowDeleteDialog(false);
      setDeletingId(null);
      toast({
        title: "Usuário desativado",
        description: "O usuário foi desativado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao desativar",
        description: error.response?.data?.error || error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      nome_completo: "",
      email: "",
      telefone: "",
      senha: "",
    });
    setEditingUser(null);
  };

  const handleEdit = (user: POSUser) => {
    setEditingUser(user);
    setFormData({
      nome_completo: user.nome_completo,
      email: user.email,
      telefone: user.telefone || "",
      senha: "",
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (editingUser) {
      updateMutation.mutate({ ...formData, id: editingUser.id });
    } else {
      // Validar senha forte para POS
      if (!isPasswordStrong(formData.senha, false, 'POS')) {
        toast({
          title: "Erro",
          description: "A senha deve conter pelo menos uma letra maiúscula e um caractere especial.",
          variant: "destructive",
        });
        return;
      }
      if (formData.senha.length < 6) {
        toast({
          title: "Erro",
          description: "A senha deve ter no mínimo 6 caracteres.",
          variant: "destructive",
        });
        return;
      }
      createMutation.mutate(formData);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Texto copiado para a área de transferência.",
    });
  };

  const filteredUsers = posUsers?.filter((u) =>
    u.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Funcionários POS (Ponto de Venda)
            </CardTitle>
            <CardDescription>
              Gerencie os usuários com acesso ao módulo de pagamentos rápidos
            </CardDescription>
          </div>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Funcionário POS
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : filteredUsers && filteredUsers.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredUsers.map((user) => (
                <Card key={user.id} className="relative">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{user.nome_completo}</h4>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        {user.telefone && (
                          <p className="text-sm text-muted-foreground">{user.telefone}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Cadastrado em {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant={user.status_aluno === "Inativo" ? "destructive" : "default"}>
                        {user.status_aluno === "Inativo" ? "Inativo" : "Ativo"}
                      </Badge>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => {
                          setDeletingId(user.id);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum funcionário POS cadastrado
            </div>
          )}
        </div>
      </CardContent>

      {/* Dialog: Criar/Editar */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar Funcionário POS" : "Novo Funcionário POS"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Atualize os dados do funcionário"
                : "Preencha os dados para criar um novo acesso ao módulo de pagamentos"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                value={formData.nome_completo}
                onChange={(e) => setFormData(prev => ({ ...prev, nome_completo: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                disabled={!!editingUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="senha">Senha *</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.senha}
                  onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))}
                />
                {formData.senha && (
                  <PasswordStrengthIndicator 
                    password={formData.senha} 
                    userRole="POS"
                  />
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createMutation.isPending || 
                updateMutation.isPending || 
                (!editingUser && (formData.senha.length < 6 || !isPasswordStrong(formData.senha, false, 'POS')))
              }
            >
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Credenciais */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credenciais de Acesso</DialogTitle>
            <DialogDescription>
              Anote ou copie as credenciais abaixo. A senha não poderá ser visualizada novamente.
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-4 py-4">
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-mono">{credentials.email}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(credentials.email)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Senha</p>
                    <p className="font-mono font-bold">{credentials.senha}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(credentials.senha)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowCredentialsDialog(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Desativação */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Funcionário POS</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar este funcionário? Ele não poderá mais acessar o sistema de pagamentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deactivateMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}