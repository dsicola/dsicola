import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import {
  periodoLancamentoNotasApi,
  anoLetivoApi,
} from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Calendar,
  Lock,
  Unlock,
  Edit,
  AlertCircle,
  Info,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type StatusPeriodo = "ABERTO" | "FECHADO" | "EXPIRADO";

interface PeriodoLancamentoNotas {
  id: string;
  anoLetivoId: string;
  tipoPeriodo: string;
  numeroPeriodo: number;
  dataInicio: string;
  dataFim: string;
  status: string;
  statusComputado?: StatusPeriodo;
  motivoReabertura?: string | null;
  reabertoEm?: string | null;
  reabertoPorUser?: {
    id: string;
    nomeCompleto?: string;
    email?: string;
  } | null;
  anoLetivo?: {
    id: string;
    ano: number;
  };
}

export function PeriodoLancamentoNotasTab() {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { user, role } = useAuth();
  const { isSuperior, isSecundario } = useInstituicao();
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  const [createDialogOpen, setCreateDialogOpen] = useSafeDialog(false);
  const [editDialogOpen, setEditDialogOpen] = useSafeDialog(false);
  const [reabrirDialogOpen, setReabrirDialogOpen] = useSafeDialog(false);
  const [selectedPeriodo, setSelectedPeriodo] = useState<PeriodoLancamentoNotas | null>(null);

  const tipoPadrao = isSuperior ? "SEMESTRE" : isSecundario ? "TRIMESTRE" : "SEMESTRE";
  const [formData, setFormData] = useState({
    anoLetivoId: "",
    tipoPeriodo: tipoPadrao as "SEMESTRE" | "TRIMESTRE",
    numeroPeriodo: "1",
    dataInicio: "",
    dataFim: "",
  });
  const [reabrirForm, setReabrirForm] = useState({
    motivoReabertura: "",
    dataFimNova: "",
  });

  // Buscar anos letivos
  const { data: anosLetivos = [], isLoading: isLoadingAnos } = useQuery({
    queryKey: ["anos-letivos", instituicaoId],
    queryFn: () => anoLetivoApi.getAll(),
    enabled: !!instituicaoId,
  });

  // Buscar períodos
  const { data: periodos = [], isLoading: isLoadingPeriodos } = useQuery({
    queryKey: ["periodos-lancamento-notas", instituicaoId],
    queryFn: () => periodoLancamentoNotasApi.listar(),
    enabled: !!instituicaoId,
  });

  const resetForm = () => {
    setFormData({
      anoLetivoId: "",
      tipoPeriodo: tipoPadrao,
      numeroPeriodo: "1",
      dataInicio: "",
      dataFim: "",
    });
    setReabrirForm({ motivoReabertura: "", dataFimNova: "" });
    setSelectedPeriodo(null);
  };

  const createMutation = useSafeMutation({
    mutationFn: (data: {
      anoLetivoId: string;
      tipoPeriodo: "SEMESTRE" | "TRIMESTRE";
      numeroPeriodo: number;
      dataInicio: string;
      dataFim: string;
    }) => periodoLancamentoNotasApi.criar(data),
    onSuccess: () => {
      toast({
        title: "Período criado",
        description: "A janela de lançamento de notas foi criada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["periodos-lancamento-notas"] });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || "Erro ao criar período.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useSafeMutation({
    mutationFn: ({ id, data }: { id: string; data: { dataInicio?: string; dataFim?: string; status?: string } }) =>
      periodoLancamentoNotasApi.atualizar(id, data),
    onSuccess: () => {
      toast({
        title: "Período atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["periodos-lancamento-notas"] });
      setEditDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || "Erro ao atualizar período.",
        variant: "destructive",
      });
    },
  });

  const reabrirMutation = useSafeMutation({
    mutationFn: ({ id, data }: { id: string; data: { motivoReabertura?: string; dataFimNova?: string } }) =>
      periodoLancamentoNotasApi.reabrir(id, data),
    onSuccess: () => {
      toast({
        title: "Período reaberto",
        description: "A janela de lançamento foi reaberta. O ato foi registrado em auditoria.",
      });
      queryClient.invalidateQueries({ queryKey: ["periodos-lancamento-notas"] });
      setReabrirDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || "Erro ao reabrir período.",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!formData.anoLetivoId || !formData.dataInicio || !formData.dataFim) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha Ano Letivo, Data Início e Data Fim.",
        variant: "destructive",
      });
      return;
    }
    if (new Date(formData.dataFim) <= new Date(formData.dataInicio)) {
      toast({
        title: "Datas inválidas",
        description: "A data fim deve ser posterior à data início.",
        variant: "destructive",
      });
      return;
    }
    const num = parseInt(formData.numeroPeriodo, 10);
    if (isNaN(num) || num < 1) {
      toast({
        title: "Número inválido",
        description: "O número do período deve ser 1, 2 ou 3.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      anoLetivoId: formData.anoLetivoId,
      tipoPeriodo: formData.tipoPeriodo,
      numeroPeriodo: num,
      dataInicio: formData.dataInicio,
      dataFim: formData.dataFim,
    });
  };

  const handleUpdate = () => {
    if (!selectedPeriodo) return;
    const data: { dataInicio?: string; dataFim?: string } = {};
    if (formData.dataInicio) data.dataInicio = formData.dataInicio;
    if (formData.dataFim) data.dataFim = formData.dataFim;
    if (Object.keys(data).length === 0) return;
    const inicio = data.dataInicio || selectedPeriodo.dataInicio;
    const fim = data.dataFim || selectedPeriodo.dataFim;
    if (new Date(fim) <= new Date(inicio)) {
      toast({
        title: "Datas inválidas",
        description: "A data fim deve ser posterior à data início.",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({ id: selectedPeriodo.id, data });
  };

  const handleReabrir = () => {
    if (!selectedPeriodo) return;
    const motivo = reabrirForm.motivoReabertura.trim();
    if (!motivo) {
      toast({
        title: "Motivo obrigatório",
        description: "Informe o motivo da reabertura para fins de auditoria.",
        variant: "destructive",
      });
      return;
    }
    reabrirMutation.mutate({
      id: selectedPeriodo.id,
      data: {
        motivoReabertura: motivo,
        dataFimNova: reabrirForm.dataFimNova || undefined,
      },
    });
  };

  const handleFecharPeriodo = (p: PeriodoLancamentoNotas) => {
    const status = (p.statusComputado || p.status) as string;
    if (status !== "ABERTO") return;
    updateMutation.mutate({
      id: p.id,
      data: { status: "FECHADO" },
    });
  };

  const getStatusBadge = (p: PeriodoLancamentoNotas) => {
    const status = (p.statusComputado || p.status) as StatusPeriodo;
    if (status === "ABERTO") {
      return (
        <Badge className="bg-green-600 hover:bg-green-600">
          <Unlock className="h-3 w-3 mr-1" />
          Aberto
        </Badge>
      );
    }
    if (status === "FECHADO") {
      return (
        <Badge variant="secondary">
          <Lock className="h-3 w-3 mr-1" />
          Fechado
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <AlertCircle className="h-3 w-3 mr-1" />
        Expirado
      </Badge>
    );
  };

  const getPeriodoLabel = (p: PeriodoLancamentoNotas) => {
    const tipo = p.tipoPeriodo === "SEMESTRE" ? "Semestre" : "Trimestre";
    return `${p.anoLetivo?.ano || "—"} • ${tipo} ${p.numeroPeriodo}`;
  };

  const toDateInputValue = (value: string | Date): string => {
    if (!value) return "";
    const d = typeof value === "string" ? new Date(value) : value;
    return d.toISOString().slice(0, 10);
  };

  const numeroOptions =
    formData.tipoPeriodo === "SEMESTRE"
      ? [
          { value: "1", label: "1º Semestre" },
          { value: "2", label: "2º Semestre" },
        ]
      : [
          { value: "1", label: "1º Trimestre" },
          { value: "2", label: "2º Trimestre" },
          { value: "3", label: "3º Trimestre" },
        ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Períodos de Lançamento de Notas
              </CardTitle>
              <CardDescription className="mt-1">
                Configure as janelas em que as notas podem ser lançadas. Sem período aberto, o lançamento é bloqueado. O período fecha automaticamente na data fim definida.
              </CardDescription>
            </div>
            {isAdmin && (
              <Button
                onClick={() => {
                  resetForm();
                  setFormData((prev) => ({ ...prev, tipoPeriodo: tipoPadrao, numeroPeriodo: "1" }));
                  setCreateDialogOpen(true);
                }}
                className="shrink-0"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Período
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Regra:</strong> O lançamento de notas só é permitido quando existir um período <strong>ABERTO</strong> e a data atual estiver entre início e fim.
              Sem períodos configurados ou com todos fechados/expirados, o lançamento é bloqueado. O período fecha automaticamente na data fim. Reabertura apenas para <strong>ADMIN</strong>, com log de auditoria.
            </AlertDescription>
          </Alert>

          {isLoadingPeriodos ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : periodos.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/30">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-medium">Nenhum período configurado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crie um período para controlar quando as notas podem ser lançadas.
              </p>
              {isAdmin && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    resetForm();
                    setFormData((prev) => ({ ...prev, tipoPeriodo: tipoPadrao, numeroPeriodo: "1" }));
                    setCreateDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeiro período
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Data Início</TableHead>
                    <TableHead>Data Fim</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodos.map((p: PeriodoLancamentoNotas) => {
                    const status = (p.statusComputado || p.status) as StatusPeriodo;
                    const podeReabrir = isAdmin && status !== "ABERTO";
                    const podeFechar = isAdmin && status === "ABERTO";
                    const podeEditar = isAdmin;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{getPeriodoLabel(p)}</TableCell>
                        <TableCell>
                          {format(new Date(p.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(p.dataFim), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getStatusBadge(p)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {podeEditar && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedPeriodo(p);
                                setFormData({
                                  ...formData,
                                  anoLetivoId: p.anoLetivoId,
                                  tipoPeriodo: p.tipoPeriodo as "SEMESTRE" | "TRIMESTRE",
                                  numeroPeriodo: String(p.numeroPeriodo),
                                  dataInicio: toDateInputValue(p.dataInicio),
                                  dataFim: toDateInputValue(p.dataFim),
                                });
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            )}
                            {podeFechar && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleFecharPeriodo(p)}
                                disabled={updateMutation.isPending}
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                            )}
                            {podeReabrir && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedPeriodo(p);
                                  setReabrirForm({ motivoReabertura: "", dataFimNova: "" });
                                  setReabrirDialogOpen(true);
                                }}
                              >
                                <Unlock className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Criar */}
      <Dialog open={createDialogOpen} onOpenChange={(v) => setCreateDialogOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Período de Lançamento</DialogTitle>
            <DialogDescription>
              Defina a janela em que as notas poderão ser lançadas ou alteradas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Ano Letivo *</Label>
              <Select
                value={formData.anoLetivoId}
                onValueChange={(v) => setFormData({ ...formData, anoLetivoId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ano letivo" />
                </SelectTrigger>
                <SelectContent>
                  {anosLetivos.map((al: any) => (
                    <SelectItem key={al.id} value={al.id}>
                      {al.ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isLoadingAnos && anosLetivos.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Cadastre um ano letivo na aba &quot;Anos Letivos&quot; primeiro.
                </p>
              )}
            </div>
            <div>
              <Label>Tipo de Período</Label>
              <Select
                value={formData.tipoPeriodo}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    tipoPeriodo: v as "SEMESTRE" | "TRIMESTRE",
                    numeroPeriodo: "1",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEMESTRE">Semestre</SelectItem>
                  <SelectItem value="TRIMESTRE">Trimestre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Número</Label>
              <Select
                value={formData.numeroPeriodo}
                onValueChange={(v) => setFormData({ ...formData, numeroPeriodo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {numeroOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data Início *</Label>
              <Input
                type="date"
                value={formData.dataInicio}
                onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
              />
            </div>
            <div>
              <Label>Data Fim *</Label>
              <Input
                type="date"
                value={formData.dataFim}
                onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar */}
      <Dialog open={editDialogOpen} onOpenChange={(v) => setEditDialogOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Período</DialogTitle>
            <DialogDescription>
              {selectedPeriodo && getPeriodoLabel(selectedPeriodo)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Data Início</Label>
              <Input
                type="date"
                value={formData.dataInicio}
                onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
              />
            </div>
            <div>
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={formData.dataFim}
                onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Reabrir */}
      <Dialog open={reabrirDialogOpen} onOpenChange={(v) => setReabrirDialogOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reabrir Período</DialogTitle>
            <DialogDescription>
              Apenas ADMIN pode reabrir. O ato será registrado em auditoria.
              {selectedPeriodo && (
                <span className="block mt-2 font-medium">
                  {getPeriodoLabel(selectedPeriodo)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Motivo da reabertura (obrigatório para auditoria)</Label>
              <Textarea
                placeholder="Ex: Correção de notas a pedido da coordenação"
                value={reabrirForm.motivoReabertura}
                onChange={(e) =>
                  setReabrirForm({ ...reabrirForm, motivoReabertura: e.target.value })
                }
                rows={3}
              />
            </div>
            <div>
              <Label>Nova data fim (opcional)</Label>
              <Input
                type="date"
                value={reabrirForm.dataFimNova}
                onChange={(e) =>
                  setReabrirForm({ ...reabrirForm, dataFimNova: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReabrirDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleReabrir} disabled={reabrirMutation.isPending}>
              {reabrirMutation.isPending ? "Reabrindo..." : "Reabrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
