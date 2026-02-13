import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { trimestreApi, authApi, anoLetivoApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  BookOpen,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type StatusTrimestre = "PLANEJADO" | "ATIVO" | "ENCERRADO" | "CANCELADO";

interface Trimestre {
  id: string;
  anoLetivo: number;
  anoLetivoId?: string; // FK para AnoLetivo - retornado pelo backend
  numero: number;
  dataInicio: string;
  dataFim?: string | null;
  status: StatusTrimestre;
  ativadoEm?: string | null;
  ativadoPor?: string | null;
  observacoes?: string | null;
  usuarioAtivou?: {
    id: string;
    nomeCompleto?: string;
    email?: string;
  };
}

export function TrimestresTab() {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { user } = useAuth();
  const { isSuperior, isSecundario } = useInstituicao();
  
  // VALIDAÇÃO CRÍTICA: Trimestres são APENAS para Ensino Secundário
  if (isSuperior) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            Acesso Negado
          </CardTitle>
          <CardDescription className="text-red-600 dark:text-red-300">
            Trimestres são permitidos apenas para instituições de Ensino Secundário.
            Instituições de Ensino Superior devem usar Semestres.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  const [anoLetivo, setAnoLetivo] = useState<number>(new Date().getFullYear());
  const [anoLetivoSelecionado, setAnoLetivoSelecionado] = useState<{ id: string; ano: number; dataInicio: string; dataFim?: string; status: string } | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useSafeDialog(false);
  const [editDialogOpen, setEditDialogOpen] = useSafeDialog(false);
  const [ativarDialogOpen, setAtivarDialogOpen] = useSafeDialog(false);
  const [selectedTrimestre, setSelectedTrimestre] = useState<Trimestre | null>(null);
  const [formData, setFormData] = useState({
    anoLetivoId: "",
    numero: "1",
    dataInicio: "",
    dataFim: "",
    observacoes: "",
  });

  // Buscar anos letivos disponíveis
  const { data: anosLetivos = [], isLoading: isLoadingAnosLetivos } = useQuery({
    queryKey: ["anos-letivos", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  // Atualizar ano letivo selecionado quando anoLetivo mudar
  React.useEffect(() => {
    if (anosLetivos.length > 0 && anoLetivo) {
      const anoEncontrado = anosLetivos.find((al: any) => al.ano === anoLetivo);
      if (anoEncontrado) {
        setAnoLetivoSelecionado(anoEncontrado);
      } else {
        setAnoLetivoSelecionado(null);
      }
    }
  }, [anosLetivos, anoLetivo]);

  // Buscar trimestres
  const { data: trimestres = [], isLoading } = useQuery({
    queryKey: ["trimestres", instituicaoId, anoLetivo],
    queryFn: async () => {
      return await trimestreApi.getAll({ anoLetivo });
    },
    enabled: !!instituicaoId && !!anoLetivo,
  });

  // Mutation para criar trimestre
  const createMutation = useSafeMutation({
    mutationFn: async (data: {
      anoLetivo?: number;
      anoLetivoId?: string;
      numero: number;
      dataInicio: string;
      dataFim?: string;
      observacoes?: string;
    }) => {
      return await trimestreApi.create(data);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Trimestre criado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["trimestres"] });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || "Erro ao criar trimestre.",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar trimestre
  const updateMutation = useSafeMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await trimestreApi.update(id, data);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Trimestre atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["trimestres"] });
      setEditDialogOpen(false);
      setSelectedTrimestre(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || "Erro ao atualizar trimestre.",
        variant: "destructive",
      });
    },
  });

  // Mutation para ativar trimestre
  const ativarMutation = useSafeMutation({
    mutationFn: async (data: { trimestreId?: string; anoLetivo?: number; numero?: number }) => {
      return await trimestreApi.ativar(data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Sucesso!",
        description: `Trimestre ativado com sucesso. ${data.alunosAtualizados || 0} aluno(s) atualizado(s) para "Cursando".`,
      });
      queryClient.invalidateQueries({ queryKey: ["trimestres"] });
      queryClient.invalidateQueries({ queryKey: ["trimestre-atual"] });
      setAtivarDialogOpen(false);
      setSelectedTrimestre(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || "Erro ao ativar trimestre.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      anoLetivoId: anoLetivoSelecionado?.id || "",
      numero: "1",
      dataInicio: "",
      dataFim: "",
      observacoes: "",
    });
  };

  const handleCreate = () => {
    const anoLetivoEscolhido = anosLetivos.find((al: any) => al.id === formData.anoLetivoId);
    
    if (!anoLetivoEscolhido) {
      toast({
        title: "Erro",
        description: "É necessário selecionar um ano letivo antes de criar um trimestre.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.dataInicio) {
      toast({
        title: "Erro",
        description: "Data de início é obrigatória.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      anoLetivoId: anoLetivoEscolhido.id, // Priorizar anoLetivoId quando disponível
      anoLetivo: anoLetivoEscolhido.ano, // Mantido para compatibilidade
      numero: parseInt(formData.numero),
      dataInicio: formData.dataInicio,
      dataFim: formData.dataFim || undefined,
      observacoes: formData.observacoes || undefined,
    });
  };

  const handleEdit = (trimestre: Trimestre) => {
    setSelectedTrimestre(trimestre);
    setFormData({
      numero: trimestre.numero.toString(),
      dataInicio: trimestre.dataInicio ? format(new Date(trimestre.dataInicio), "yyyy-MM-dd") : "",
      dataFim: trimestre.dataFim ? format(new Date(trimestre.dataFim), "yyyy-MM-dd") : "",
      observacoes: trimestre.observacoes || "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedTrimestre) return;

    const updateData: any = {};
    if (formData.dataInicio) updateData.dataInicio = formData.dataInicio;
    if (formData.dataFim !== undefined) updateData.dataFim = formData.dataFim || null;
    if (formData.observacoes !== undefined) updateData.observacoes = formData.observacoes || null;

    updateMutation.mutate({
      id: selectedTrimestre.id,
      data: updateData,
    });
  };

  const handleAtivar = (trimestre: Trimestre) => {
    setSelectedTrimestre(trimestre);
    setAtivarDialogOpen(true);
  };

  const confirmarAtivar = () => {
    if (!selectedTrimestre) return;

    ativarMutation.mutate({
      trimestreId: selectedTrimestre.id,
    });
  };

  const getStatusBadge = (status: StatusTrimestre) => {
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
            <XCircle className="h-3 w-3 mr-1" />
            Encerrado
          </Badge>
        );
      case "CANCELADO":
        return (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelado
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const podeEditar = (trimestre: Trimestre) => {
    return trimestre.status === "PLANEJADO";
  };

  const podeAtivar = (trimestre: Trimestre) => {
    return trimestre.status === "PLANEJADO";
  };

  // Buscar perfil completo com roles
  const { data: profileData } = useQuery({
    queryKey: ["user-profile-trimestres"],
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
          <h2 className="text-2xl font-bold">Gerenciamento de Trimestres</h2>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie os trimestres letivos da instituição
          </p>
        </div>
        {podeGerenciar && (
          <Button 
            onClick={() => {
              setFormData({
                anoLetivoId: anoLetivoSelecionado?.id || "",
                numero: "1",
                dataInicio: "",
                dataFim: "",
                observacoes: "",
              });
              setCreateDialogOpen(true);
            }} 
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Criar Trimestre
          </Button>
        )}
      </div>

      {/* Filtro por Ano Letivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ano Letivo</CardTitle>
          <CardDescription>
            Selecione o ano letivo para visualizar e gerenciar os trimestres
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="space-y-2 flex-1">
              <Label htmlFor="anoLetivo">Ano Letivo *</Label>
              <Select
                value={anoLetivo?.toString() || ""}
                onValueChange={(value) => {
                  const ano = parseInt(value);
                  setAnoLetivo(ano);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ano letivo" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingAnosLetivos ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Carregando...</div>
                  ) : anosLetivos.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum ano letivo cadastrado</div>
                  ) : (
                    anosLetivos.map((al: any) => (
                      <SelectItem key={al.id} value={al.ano.toString()}>
                        {al.ano} - {al.status === 'ATIVO' ? '🟢 Ativo' : al.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {anoLetivoSelecionado && (
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2 text-sm">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="font-medium">Ano Letivo {anoLetivoSelecionado.ano}</span>
                    <Badge variant={anoLetivoSelecionado.status === 'ATIVO' ? 'default' : 'outline'}>
                      {anoLetivoSelecionado.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Período: {format(new Date(anoLetivoSelecionado.dataInicio), "dd/MM/yyyy", { locale: ptBR })} 
                    {anoLetivoSelecionado.dataFim && ` - ${format(new Date(anoLetivoSelecionado.dataFim), "dd/MM/yyyy", { locale: ptBR })}`}
                  </div>
                </div>
              )}
              {!anoLetivoSelecionado && anoLetivo && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Ano letivo {anoLetivo} não encontrado. É necessário criar o ano letivo primeiro.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Ativação Automática:</strong> Trimestres com status "Planejado" podem ser ativados
          automaticamente quando a data de início chegar. Você também pode ativá-los manualmente
          a qualquer momento.
        </AlertDescription>
      </Alert>

      {/* Lista de Trimestres */}
      <Card>
        <CardHeader>
          <CardTitle>Trimestres - {anoLetivo}</CardTitle>
          <CardDescription>
            {trimestres.length === 0
              ? "Nenhum trimestre cadastrado para este ano letivo"
              : `${trimestres.length} trimestre(s) encontrado(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : trimestres.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {anoLetivoSelecionado 
                  ? `Nenhum trimestre cadastrado para o ano letivo ${anoLetivoSelecionado.ano}`
                  : "Selecione um ano letivo para visualizar os trimestres"}
              </p>
              {podeGerenciar && anoLetivoSelecionado && (
                <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Primeiro Trimestre
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trimestre</TableHead>
                    <TableHead>Data de Início</TableHead>
                    <TableHead>Data de Fim</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ativado Em</TableHead>
                    <TableHead>Ativado Por</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trimestres.map((trimestre) => (
                    <TableRow key={trimestre.id}>
                      <TableCell className="font-medium">
                        {trimestre.numero}º Trimestre
                      </TableCell>
                      <TableCell>
                        {format(new Date(trimestre.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {trimestre.dataFim
                          ? format(new Date(trimestre.dataFim), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(trimestre.status)}</TableCell>
                      <TableCell>
                        {trimestre.ativadoEm
                          ? format(new Date(trimestre.ativadoEm), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {trimestre.usuarioAtivou
                          ? trimestre.usuarioAtivou.nomeCompleto ||
                            trimestre.usuarioAtivou.email ||
                            "Sistema"
                          : trimestre.ativadoEm
                          ? "Sistema (Automático)"
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {podeAtivar(trimestre) && podeGerenciar && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleAtivar(trimestre)}
                              className="gap-1"
                            >
                              <Play className="h-3 w-3" />
                              Ativar
                            </Button>
                          )}
                          {podeEditar(trimestre) && podeGerenciar && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(trimestre)}
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

      {/* Dialog Criar Trimestre */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Trimestre</DialogTitle>
            <DialogDescription>
              Crie um novo trimestre. O trimestre pode ser ativado manualmente quando necessário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-anoLetivo">Ano Letivo *</Label>
              <Select
                value={formData.anoLetivoId}
                onValueChange={(value) => setFormData({ ...formData, anoLetivoId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ano letivo" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingAnosLetivos ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Carregando...</div>
                  ) : anosLetivos.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum ano letivo cadastrado</div>
                  ) : (
                    anosLetivos.map((al: any) => (
                      <SelectItem key={al.id} value={al.id}>
                        {al.ano} - {al.status === 'ATIVO' ? '🟢 Ativo' : al.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecione o ano letivo para o qual deseja criar o trimestre.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-numero">Número do Trimestre *</Label>
              <Input
                id="create-numero"
                type="number"
                min="1"
                value={formData.numero}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                placeholder="Ex: 1, 2, 3..."
                required
              />
              <p className="text-xs text-muted-foreground">
                Informe o número do trimestre (ex: 1 para 1º Trimestre, 2 para 2º Trimestre, 3 para 3º Trimestre)
              </p>
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
              <Label htmlFor="create-data-fim">Data de Fim (Opcional)</Label>
              <Input
                id="create-data-fim"
                type="date"
                value={formData.dataFim}
                onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-observacoes">Observações (Opcional)</Label>
              <Input
                id="create-observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações sobre o trimestre"
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
              disabled={createMutation.isPending || !formData.dataInicio || !formData.anoLetivoId}
            >
              {createMutation.isPending ? "Criando..." : "Criar Trimestre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Trimestre */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Trimestre</DialogTitle>
            <DialogDescription>
              Edite as informações do {selectedTrimestre?.numero}º Trimestre de {selectedTrimestre?.anoLetivo}.
              Apenas trimestres com status "Planejado" podem ser editados.
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
              <Label htmlFor="edit-data-fim">Data de Fim (Opcional)</Label>
              <Input
                id="edit-data-fim"
                type="date"
                value={formData.dataFim}
                onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-observacoes">Observações (Opcional)</Label>
              <Input
                id="edit-observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações sobre o trimestre"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedTrimestre(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !formData.dataInicio}
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
            <DialogTitle>Ativar Trimestre</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja ativar o {selectedTrimestre?.numero}º Trimestre de {selectedTrimestre?.anoLetivo}?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Ao ativar o trimestre:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>O status será alterado para "Ativo"</li>
                  <li>Alunos com status "Matriculado" serão atualizados para "Cursando"</li>
                  <li>Presenças poderão ser registradas</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAtivarDialogOpen(false);
              setSelectedTrimestre(null);
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

