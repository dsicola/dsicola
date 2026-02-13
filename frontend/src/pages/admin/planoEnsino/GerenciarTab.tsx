import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { planoEnsinoApi } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Pencil, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { PeriodoAcademicoSelect } from "@/components/academico/PeriodoAcademicoSelect";

interface GerenciarTabProps {
  plano: any;
  planoId: string | null;
  permiteEdicao?: boolean;
}

export function GerenciarTab({ plano, planoId, permiteEdicao = true }: GerenciarTabProps) {
  const queryClient = useQueryClient();
  const { isSuperior, isSecundario } = useInstituicao();
  const [deletingAulaId, setDeletingAulaId] = useState<string | null>(null);
  
  // Definir label baseado no tipo de instituição
  const periodoLabel = isSuperior ? "Semestre" : isSecundario ? "Trimestre" : "Período";
  const [showEditDialog, setShowEditDialog] = useSafeDialog(false);
  const [editingAula, setEditingAula] = useState<any>(null);
  const [aulaForm, setAulaForm] = useState({
    titulo: "",
    descricao: "",
    tipo: "TEORICA" as "TEORICA" | "PRATICA",
    trimestre: "", // Não usar valor padrão hardcoded - será preenchido pelo PeriodoAcademicoSelect
    quantidadeAulas: "1",
  });

  // Estatísticas de carga horária
  const { data: stats } = useQuery({
    queryKey: ["plano-ensino-stats", planoId],
    queryFn: async () => {
      if (!planoId) return null;
      return await planoEnsinoApi.getStats(planoId);
    },
    enabled: !!planoId,
  });

  // Deletar aula
  const deleteAulaMutation = useMutation({
    mutationFn: async (aulaId: string) => {
      return await planoEnsinoApi.deleteAula(aulaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      queryClient.invalidateQueries({ queryKey: ["plano-ensino-stats"] });
      setDeletingAulaId(null);
      toast({
        title: "Aula excluída",
        description: "Aula planejada excluída com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir aula",
        variant: "destructive",
      });
    },
  });

  // Atualizar aula
  const updateAulaMutation = useMutation({
    mutationFn: async ({ aulaId, data }: { aulaId: string; data: any }) => {
      return await planoEnsinoApi.updateAula(aulaId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      queryClient.invalidateQueries({ queryKey: ["plano-ensino-stats"] });
      setShowEditDialog(false);
      setEditingAula(null);
      resetAulaForm();
      toast({
        title: "Aula atualizada",
        description: "Aula planejada atualizada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar aula",
        variant: "destructive",
      });
    },
  });

  // Reordenar aulas
  const reordenarMutation = useMutation({
    mutationFn: async (novaOrdem: string[]) => {
      if (!planoId) return;
      return await planoEnsinoApi.reordenarAulas(planoId, novaOrdem);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      queryClient.invalidateQueries({ queryKey: ["plano-ensino-stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao reordenar aulas",
        variant: "destructive",
      });
    },
  });

  const resetAulaForm = () => {
    setAulaForm({
      titulo: "",
      descricao: "",
      tipo: "TEORICA",
      trimestre: "", // Não usar valor padrão hardcoded
      quantidadeAulas: "1",
    });
    setEditingAula(null);
  };

  const handleEditAula = (aula: any) => {
    setEditingAula(aula);
    setAulaForm({
      titulo: aula.titulo,
      descricao: aula.descricao || "",
      tipo: aula.tipo,
      trimestre: aula.trimestre.toString(),
      quantidadeAulas: aula.quantidadeAulas.toString(),
    });
    setShowEditDialog(true);
  };

  const handleSubmitEdit = () => {
    if (!aulaForm.titulo.trim()) {
      toast({
        title: "Erro",
        description: "Título da aula é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!editingAula) return;

    updateAulaMutation.mutate({
      aulaId: editingAula.id,
      data: {
        titulo: aulaForm.titulo,
        descricao: aulaForm.descricao || undefined,
        tipo: aulaForm.tipo,
        trimestre: Number(aulaForm.trimestre),
        quantidadeAulas: Number(aulaForm.quantidadeAulas),
      },
    });
  };

  const handleMoverAula = (aulaId: string, direcao: "up" | "down") => {
    if (!plano?.aulas) return;

    const aulas = [...plano.aulas];
    const index = aulas.findIndex((a: any) => a.id === aulaId);
    if (index === -1) return;

    if (direcao === "up" && index > 0) {
      [aulas[index], aulas[index - 1]] = [aulas[index - 1], aulas[index]];
    } else if (direcao === "down" && index < aulas.length - 1) {
      [aulas[index], aulas[index + 1]] = [aulas[index + 1], aulas[index]];
    } else {
      return;
    }

    const novaOrdem = aulas.map((a: any) => a.id);
    reordenarMutation.mutate(novaOrdem);
  };

  const bloqueado = !permiteEdicao || plano?.bloqueado || false;

  if (!plano) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum plano de ensino encontrado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Plano de Ensino</CardTitle>
          <CardDescription>
            Edite, remova ou reordene as aulas planejadas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Carga Horária Exigida (da Disciplina)</label>
              <p className="text-2xl font-bold">{stats?.totalExigido || plano.disciplina?.cargaHoraria || plano.cargaHorariaTotal || 0}h</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Carga Horária Planejada (soma das aulas)</label>
              <p className="text-2xl font-bold">{stats?.totalPlanejado || 0}h</p>
            </div>
          </div>

          {stats && stats.status !== "ok" && (
            <div className={`p-4 rounded-md flex items-start gap-2 ${
              stats.status === "faltando"
                ? "bg-yellow-50 border border-yellow-200"
                : "bg-red-50 border border-red-200"
            }`}>
              <AlertCircle className={`h-5 w-5 mt-0.5 ${
                stats.status === "faltando" ? "text-yellow-600" : "text-red-600"
              }`} />
              <div>
                <p className={`text-sm font-medium ${
                  stats.status === "faltando" ? "text-yellow-800" : "text-red-800"
                }`}>
                  {stats.status === "faltando"
                    ? "Carga horária insuficiente"
                    : "Carga horária excedente"}
                </p>
                <p className={`text-xs mt-1 ${
                  stats.status === "faltando" ? "text-yellow-700" : "text-red-700"
                }`}>
                  {stats.status === "faltando"
                    ? `Faltam ${stats.diferenca} horas para completar a carga horária exigida.`
                    : `O planejamento excede a carga horária exigida em ${Math.abs(stats.diferenca)} horas.`}
                </p>
              </div>
            </div>
          )}

          {/* Lista de aulas para gerenciar */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-4">Aulas Planejadas</h3>
            {!plano.aulas || plano.aulas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma aula planejada. Use a aba "Planejar" para adicionar aulas.
              </div>
            ) : (
              <div className="space-y-2">
                {plano.aulas.map((aula: any, index: number) => (
                  <div
                    key={aula.id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {aula.ordem}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium">{aula.titulo}</h4>
                          {aula.descricao && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{aula.descricao}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline">
                              {aula.tipo === "TEORICA" ? "Teórica" : "Prática"}
                            </Badge>
                            {/* CRÍTICO: Mostrar apenas o período correto baseado no tipo de instituição */}
                            {isSuperior && (
                              <Badge variant="outline">
                                {aula.trimestre}º Semestre
                              </Badge>
                            )}
                            {isSecundario && (
                              <Badge variant="outline">
                                {aula.trimestre}º Trimestre
                              </Badge>
                            )}
                            {/* NUNCA mostrar período se tipo não foi determinado */}
                            <Badge variant="outline">
                              {aula.quantidadeAulas} {aula.quantidadeAulas === 1 ? "aula" : "aulas"}
                            </Badge>
                          </div>
                        </div>
                        {!bloqueado && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditAula(aula)}
                              title="Editar aula"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMoverAula(aula.id, "up")}
                              disabled={index === 0 || reordenarMutation.isPending}
                              title="Mover para cima"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMoverAula(aula.id, "down")}
                              disabled={index === plano.aulas.length - 1 || reordenarMutation.isPending}
                              title="Mover para baixo"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => setDeletingAulaId(aula.id)}
                              title="Excluir aula"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog Editar Aula */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Aula Planejada</DialogTitle>
            <DialogDescription>
              Atualize os dados da aula planejada
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={aulaForm.titulo}
                onChange={(e) => setAulaForm((prev) => ({ ...prev, titulo: e.target.value }))}
                placeholder="Ex: Introdução à Matéria"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={aulaForm.descricao}
                onChange={(e) => setAulaForm((prev) => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição do conteúdo da aula..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={aulaForm.tipo}
                  onValueChange={(value: "TEORICA" | "PRATICA") =>
                    setAulaForm((prev) => ({ ...prev, tipo: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEORICA">Teórica</SelectItem>
                    <SelectItem value="PRATICA">Prática</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <PeriodoAcademicoSelect
                  value={aulaForm.trimestre || ""}
                  onValueChange={(value) =>
                    setAulaForm((prev) => ({ ...prev, trimestre: value }))
                  }
                  anoLetivo={plano?.anoLetivo}
                  anoLetivoId={plano?.anoLetivoId}
                  label={periodoLabel}
                  required
                  useNumericValue={true}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Quantidade de Aulas *</Label>
              <Input
                type="number"
                min="1"
                value={aulaForm.quantidadeAulas}
                onChange={(e) =>
                  setAulaForm((prev) => ({ ...prev, quantidadeAulas: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setShowEditDialog(false);
              resetAulaForm();
            }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitEdit}
              disabled={
                !aulaForm.titulo.trim() ||
                updateAulaMutation.isPending
              }
            >
              {updateAulaMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Exclusão */}
      <AlertDialog
        open={!!deletingAulaId}
        onOpenChange={(open) => !open && setDeletingAulaId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta aula? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingAulaId(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingAulaId) {
                  deleteAulaMutation.mutate(deletingAulaId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

