import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { anoLetivoApi, authApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Edit,
  Play,
  AlertCircle,
  Info,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type StatusAnoLetivo = "PLANEJADO" | "ATIVO" | "ENCERRADO";

interface AnoLetivo {
  id: string;
  ano: number;
  dataInicio: string;
  dataFim: string;
  status: StatusAnoLetivo;
  ativadoEm?: string | null;
  ativadoPor?: string | null;
  encerradoEm?: string | null;
  encerradoPor?: string | null;
  observacoes?: string | null;
  usuarioAtivou?: {
    id: string;
    nomeCompleto?: string;
    email?: string;
  };
  usuarioEncerrou?: {
    id: string;
    nomeCompleto?: string;
    email?: string;
  };
}

export function AnosLetivosTab() {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { user } = useAuth();
  
  const [createDialogOpen, setCreateDialogOpen] = useSafeDialog(false);
  const [editDialogOpen, setEditDialogOpen] = useSafeDialog(false);
  const [ativarDialogOpen, setAtivarDialogOpen] = useSafeDialog(false);
  const [selectedAnoLetivo, setSelectedAnoLetivo] = useState<AnoLetivo | null>(null);
  const [formData, setFormData] = useState({
    ano: new Date().getFullYear().toString(),
    dataInicio: "",
    dataFim: "",
    observacoes: "",
  });

  // Buscar anos letivos
  const { data: anosLetivos = [], isLoading } = useQuery({
    queryKey: ["anos-letivos", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  // Mutation para criar ano letivo
  const createMutation = useSafeMutation({
    mutationFn: async (data: {
      ano: number;
      dataInicio: string;
      dataFim: string;
      observacoes?: string;
    }) => {
      return await anoLetivoApi.create(data);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Ano letivo criado com sucesso. Lembre-se de ativá-lo para começar a usar.",
      });
      queryClient.invalidateQueries({ queryKey: ["anos-letivos"] });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || "Erro ao criar ano letivo.",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar ano letivo
  const updateMutation = useSafeMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await anoLetivoApi.update(id, data);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Ano letivo atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["anos-letivos"] });
      setEditDialogOpen(false);
      setSelectedAnoLetivo(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || "Erro ao atualizar ano letivo.",
        variant: "destructive",
      });
    },
  });

  // Mutation para ativar ano letivo
  const ativarMutation = useSafeMutation({
    mutationFn: async (data: { anoLetivoId: string }) => {
      return await anoLetivoApi.ativar(data);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Ano letivo ativado com sucesso.",
      });
      // CRÍTICO: Invalidar ambas as queries para atualizar o cache
      queryClient.invalidateQueries({ queryKey: ["anos-letivos"] });
      queryClient.invalidateQueries({ queryKey: ["ano-letivo-ativo"] });
      setAtivarDialogOpen(false);
      setSelectedAnoLetivo(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || "Erro ao ativar ano letivo.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      ano: new Date().getFullYear().toString(),
      dataInicio: "",
      dataFim: "",
      observacoes: "",
    });
  };

  const handleCreate = () => {
    if (!formData.dataInicio || !formData.dataFim) {
      toast({
        title: "Erro",
        description: "Data de início e data de fim são obrigatórias.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      ano: parseInt(formData.ano),
      dataInicio: formData.dataInicio,
      dataFim: formData.dataFim,
      observacoes: formData.observacoes || undefined,
    });
  };

  const handleEdit = (anoLetivo: AnoLetivo) => {
    setSelectedAnoLetivo(anoLetivo);
    setFormData({
      ano: anoLetivo.ano.toString(),
      dataInicio: anoLetivo.dataInicio ? format(new Date(anoLetivo.dataInicio), "yyyy-MM-dd") : "",
      dataFim: anoLetivo.dataFim ? format(new Date(anoLetivo.dataFim), "yyyy-MM-dd") : "",
      observacoes: anoLetivo.observacoes || "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedAnoLetivo) return;

    const updateData: any = {};
    if (formData.dataInicio) updateData.dataInicio = formData.dataInicio;
    if (formData.dataFim) updateData.dataFim = formData.dataFim;
    if (formData.observacoes !== undefined) updateData.observacoes = formData.observacoes || null;

    updateMutation.mutate({
      id: selectedAnoLetivo.id,
      data: updateData,
    });
  };

  const handleAtivar = (anoLetivo: AnoLetivo) => {
    setSelectedAnoLetivo(anoLetivo);
    setAtivarDialogOpen(true);
  };

  const confirmarAtivar = () => {
    if (!selectedAnoLetivo) return;

    ativarMutation.mutate({
      anoLetivoId: selectedAnoLetivo.id,
    });
  };

  const getStatusBadge = (status: StatusAnoLetivo) => {
    switch (status) {
      case "PLANEJADO":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            Planejado
          </Badge>
        );
      case "ATIVO":
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Ativo
          </Badge>
        );
      case "ENCERRADO":
        return (
          <Badge variant="destructive">
            <Lock className="h-3 w-3 mr-1" />
            Encerrado
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const podeEditar = (anoLetivo: AnoLetivo) => {
    return anoLetivo.status === "PLANEJADO";
  };

  const podeAtivar = (anoLetivo: AnoLetivo) => {
    return anoLetivo.status === "PLANEJADO";
  };

  // Buscar perfil completo com roles
  const { data: profileData } = useQuery({
    queryKey: ["user-profile-anos-letivos"],
    queryFn: async () => {
      try {
        return await authApi.getProfile();
      } catch {
        return null;
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Verificar permissões
  const userRoles = profileData?.roles || [];
  const podeGerenciar = userRoles.some((role) =>
    ["ADMIN", "DIRECAO", "SUPER_ADMIN"].includes(role)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Gerenciamento de Anos Letivos</h2>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie os anos letivos da instituição
          </p>
        </div>
        {podeGerenciar && (
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Criar Ano Letivo
          </Button>
        )}
      </div>

      {/* Informações */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Ativação Manual:</strong> Anos letivos devem ser ativados manualmente quando
          estiverem prontos para uso. Após a ativação, você poderá criar semestres ou trimestres
          para o ano letivo.
        </AlertDescription>
      </Alert>

      {/* Lista de Anos Letivos */}
      <Card>
        <CardHeader>
          <CardTitle>Anos Letivos</CardTitle>
          <CardDescription>
            {anosLetivos.length === 0
              ? "Nenhum ano letivo cadastrado"
              : `${anosLetivos.length} ano(s) letivo(s) encontrado(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : anosLetivos.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Nenhum ano letivo cadastrado
              </p>
              {podeGerenciar && (
                <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Primeiro Ano Letivo
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ano</TableHead>
                    <TableHead>Data de Início</TableHead>
                    <TableHead>Data de Fim</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ativado Em</TableHead>
                    <TableHead>Ativado Por</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anosLetivos.map((anoLetivo) => (
                    <TableRow key={anoLetivo.id}>
                      <TableCell className="font-medium">
                        {anoLetivo.ano}
                      </TableCell>
                      <TableCell>
                        {format(new Date(anoLetivo.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(anoLetivo.dataFim), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{getStatusBadge(anoLetivo.status)}</TableCell>
                      <TableCell>
                        {anoLetivo.ativadoEm
                          ? format(new Date(anoLetivo.ativadoEm), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {anoLetivo.usuarioAtivou
                          ? anoLetivo.usuarioAtivou.nomeCompleto ||
                            anoLetivo.usuarioAtivou.email ||
                            "Sistema"
                          : anoLetivo.ativadoEm
                          ? "Sistema (Automático)"
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {podeAtivar(anoLetivo) && podeGerenciar && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleAtivar(anoLetivo)}
                              className="gap-1"
                            >
                              <Play className="h-3 w-3" />
                              Ativar
                            </Button>
                          )}
                          {podeEditar(anoLetivo) && podeGerenciar && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(anoLetivo)}
                              className="gap-1"
                            >
                              <Edit className="h-3 w-3" />
                              Editar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Criar Ano Letivo */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Ano Letivo</DialogTitle>
            <DialogDescription>
              Crie um novo ano letivo. O ano letivo deve ser ativado manualmente quando estiver
              pronto para uso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-ano">Ano *</Label>
              <Input
                id="create-ano"
                type="number"
                value={formData.ano}
                onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                min={2020}
                max={2100}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-data-inicio">Data de Início *</Label>
              <Input
                id="create-data-inicio"
                type="date"
                value={formData.dataInicio}
                onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-data-fim">Data de Fim *</Label>
              <Input
                id="create-data-fim"
                type="date"
                value={formData.dataFim}
                onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-observacoes">Observações (Opcional)</Label>
              <Input
                id="create-observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações sobre o ano letivo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateDialogOpen(false);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !formData.dataInicio || !formData.dataFim}
            >
              {createMutation.isPending ? "Criando..." : "Criar Ano Letivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Ano Letivo */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Ano Letivo</DialogTitle>
            <DialogDescription>
              Edite as informações do ano letivo {selectedAnoLetivo?.ano}.
              Apenas anos letivos com status "Planejado" podem ser editados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-data-inicio">Data de Início *</Label>
              <Input
                id="edit-data-inicio"
                type="date"
                value={formData.dataInicio}
                onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-data-fim">Data de Fim *</Label>
              <Input
                id="edit-data-fim"
                type="date"
                value={formData.dataFim}
                onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-observacoes">Observações (Opcional)</Label>
              <Input
                id="edit-observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações sobre o ano letivo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedAnoLetivo(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !formData.dataInicio || !formData.dataFim}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Ativação */}
      <Dialog open={ativarDialogOpen} onOpenChange={setAtivarDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Ativar Ano Letivo</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja ativar o ano letivo {selectedAnoLetivo?.ano}?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Ao ativar o ano letivo:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>O status será alterado para "Ativo"</li>
                  <li>Você poderá criar semestres ou trimestres para este ano</li>
                  <li>O ano letivo ficará disponível para uso no sistema</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAtivarDialogOpen(false);
              setSelectedAnoLetivo(null);
            }}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarAtivar}
              disabled={ativarMutation.isPending}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {ativarMutation.isPending ? "Ativando..." : "Confirmar Ativação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

