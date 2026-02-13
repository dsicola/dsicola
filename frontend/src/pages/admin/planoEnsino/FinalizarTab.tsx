import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { planoEnsinoApi } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Lock, Unlock, Printer, FileText, AlertCircle, BookOpen, Users, Calendar } from "lucide-react";
import jsPDF from "jspdf";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { WorkflowActions } from "@/components/workflow/WorkflowActions";
import { WorkflowStatusBadge } from "@/components/workflow/WorkflowStatusBadge";
import { useInstituicao } from "@/contexts/InstituicaoContext";

interface FinalizarTabProps {
  plano: any;
  planoId: string | null;
  context: any;
  onPlanoBloqueado: () => void;
}

export function FinalizarTab({ plano, planoId, context, onPlanoBloqueado }: FinalizarTabProps) {
  const queryClient = useQueryClient();
  const { planoEnsino: permissoesPlano, messages } = useRolePermissions();
  const { isSuperior, isSecundario } = useInstituicao();
  const periodoLabel = isSuperior ? "Semestre" : isSecundario ? "Trimestre" : "Período";
  const [showBloquearDialog, setShowBloquearDialog] = useSafeDialog(false);
  const [showDesbloquearDialog, setShowDesbloquearDialog] = useSafeDialog(false);

  // Buscar estatísticas de carga horária para validação
  const { data: stats } = useQuery({
    queryKey: ["plano-ensino-stats", planoId],
    queryFn: async () => {
      if (!planoId) return null;
      return await planoEnsinoApi.getStats(planoId);
    },
    enabled: !!planoId,
  });

  // Verificar se a carga horária está completa
  const cargaHorariaCompleta = stats?.status === "ok";

  const bloquearMutation = useMutation({
    mutationFn: async () => {
      if (!planoId) throw new Error("Plano não encontrado");
      return await planoEnsinoApi.bloquearPlano(planoId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      onPlanoBloqueado();
      toast({
        title: "Plano bloqueado",
        description: "O plano de ensino foi bloqueado e não pode mais ser editado.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao bloquear plano",
        variant: "destructive",
      });
    },
  });

  const desbloquearMutation = useMutation({
    mutationFn: async () => {
      if (!planoId) throw new Error("Plano não encontrado");
      return await planoEnsinoApi.desbloquearPlano(planoId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      toast({
        title: "Plano desbloqueado",
        description: "O plano de ensino foi desbloqueado e pode ser editado novamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao desbloquear plano",
        variant: "destructive",
      });
    },
  });

  const gerarPDF = () => {
    if (!plano) return;

    const doc = new jsPDF();
    let yPos = 20;

    // Cabeçalho
    doc.setFontSize(20);
    doc.text("PLANO DE ENSINO", 105, yPos, { align: "center" });
    yPos += 15;

    // Dados da instituição (se disponível)
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    yPos += 5;

    // Dados do plano
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Disciplina:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(plano.disciplina?.nome || "-", 70, yPos);
    yPos += 7;

    doc.setFont("helvetica", "bold");
    doc.text("Professor:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(plano.professor?.nomeCompleto || "-", 70, yPos);
    yPos += 7;

    if (plano.curso) {
      doc.setFont("helvetica", "bold");
      doc.text("Curso:", 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(plano.curso.nome || "-", 70, yPos);
      yPos += 7;
    }

    if (plano.classe) {
      doc.setFont("helvetica", "bold");
      doc.text("Classe:", 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(plano.classe.nome || "-", 70, yPos);
      yPos += 7;
    }

    doc.setFont("helvetica", "bold");
    doc.text("Ano Letivo:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(plano.anoLetivo?.toString() || "-", 70, yPos);
    yPos += 7;

    if (plano.turma) {
      doc.setFont("helvetica", "bold");
      doc.text("Turma:", 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(plano.turma.nome || "-", 70, yPos);
      yPos += 7;
    }

    doc.setFont("helvetica", "bold");
    doc.text("Carga Horária Total (da Disciplina):", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`${plano.cargaHorariaTotal || plano.disciplina?.cargaHoraria || 0} horas`, 70, yPos);
    yPos += 10;

    // Linha separadora
    doc.line(20, yPos, 190, yPos);
    yPos += 10;

    // Lista de aulas
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("AULAS PLANEJADAS", 20, yPos);
    yPos += 8;

    if (plano.aulas && plano.aulas.length > 0) {
      plano.aulas.forEach((aula: any, index: number) => {
        // Verificar se precisa de nova página
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const aulaText = `${aula.ordem}. ${aula.titulo}`;
        const lines = doc.splitTextToSize(aulaText, 170);
        doc.text(lines, 20, yPos);
        yPos += lines.length * 5 + 2;

        if (aula.descricao) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          const descLines = doc.splitTextToSize(aula.descricao, 170);
          doc.text(descLines, 25, yPos);
          yPos += descLines.length * 4;
        }

        doc.setFontSize(8);
        // CRÍTICO: Mostrar apenas o período correto baseado no tipo de instituição
        const periodoTexto = isSuperior 
          ? `${aula.trimestre}º Semestre`
          : isSecundario 
          ? `${aula.trimestre}º Trimestre`
          : `${aula.trimestre}º Período`;
        doc.text(
          `Tipo: ${aula.tipo === "TEORICA" ? "Teórica" : "Prática"} | ${periodoTexto} | Quantidade: ${aula.quantidadeAulas} aula(s) | Status: ${aula.status === "MINISTRADA" ? "Ministrada" : "Planejada"}`,
          25,
          yPos
        );
        yPos += 8;
      });
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Nenhuma aula planejada", 20, yPos);
      yPos += 8;
    }

    // Bibliografia (se houver)
    if (plano.bibliografias && plano.bibliografias.length > 0) {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      yPos += 5;
      doc.line(20, yPos, 190, yPos);
      yPos += 10;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("BIBLIOGRAFIA", 20, yPos);
      yPos += 8;

      plano.bibliografias.forEach((bib: any) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const bibText = `${bib.titulo}${bib.autor ? ` - ${bib.autor}` : ""}${bib.editora ? ` (${bib.editora})` : ""}${bib.ano ? `, ${bib.ano}` : ""}`;
        const bibLines = doc.splitTextToSize(bibText, 170);
        doc.text(bibLines, 25, yPos);
        yPos += bibLines.length * 4 + 3;
      });
    }

    // Salvar PDF
    doc.save(`Plano_Ensino_${plano.disciplina?.nome || "Plano"}_${plano.anoLetivo || ""}.pdf`);
  };

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
      {/* Resumo Final do Plano */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Resumo do Plano de Ensino</CardTitle>
              <CardDescription>
                Visualize todas as informações do plano antes de finalizar
              </CardDescription>
            </div>
            {plano.status && (
              <WorkflowStatusBadge status={plano.status as any} />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                <span>Disciplina:</span>
              </div>
              <p className="font-medium">{plano.disciplina?.nome || "-"}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Professor:</span>
              </div>
              <p className="font-medium">{plano.professor?.nomeCompleto || "-"}</p>
            </div>
            {plano.curso && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  <span>Curso:</span>
                </div>
                <p className="font-medium">{plano.curso.nome}</p>
              </div>
            )}
            {plano.classe && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  <span>Classe:</span>
                </div>
                <p className="font-medium">{plano.classe.nome}</p>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Ano Letivo:</span>
              </div>
              <p className="font-medium">{plano.anoLetivo}</p>
            </div>
            {plano.turma && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Turma:</span>
                </div>
                <p className="font-medium">{plano.turma.nome}</p>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Carga Horária Exigida</label>
                <p className="text-xl font-bold">{stats?.totalExigido || plano.disciplina?.cargaHoraria || 0}h</p>
                <p className="text-xs text-muted-foreground mt-1">Definida na Disciplina</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Carga Horária Planejada</label>
                <p className="text-xl font-bold">{stats?.totalPlanejado || 0}h</p>
                <p className="text-xs text-muted-foreground mt-1">Soma das aulas</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Bibliografias</label>
                <p className="text-xl font-bold">{plano.bibliografias?.length || 0}</p>
              </div>
            </div>
            {stats && stats.status !== "ok" && (
              <div className={`mt-4 p-3 rounded-md flex items-center gap-2 ${
                stats.status === "faltando"
                  ? "bg-yellow-50 border border-yellow-200"
                  : "bg-red-50 border border-red-200"
              }`}>
                <AlertCircle className={`h-5 w-5 ${
                  stats.status === "faltando" ? "text-yellow-600" : "text-red-600"
                }`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    stats.status === "faltando" ? "text-yellow-800" : "text-red-800"
                  }`}>
                    {stats.status === "faltando"
                      ? `Carga horária incompleta: faltam ${stats.diferenca} horas.`
                      : `Carga horária excedente: excede em ${Math.abs(stats.diferenca)} horas.`}
                  </p>
                  <p className={`text-xs mt-1 ${
                    stats.status === "faltando" ? "text-yellow-700" : "text-red-700"
                  }`}>
                    A carga horária planejada deve ser EXATAMENTE igual à carga horária exigida ({stats.totalExigido}h).
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workflow Actions */}
      {planoId && (
        <Card>
          <CardHeader>
            <CardTitle>Workflow de Aprovação</CardTitle>
            <CardDescription>
              Gerencie o fluxo de aprovação do plano de ensino
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status atual e fluxo */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status Atual</p>
                  <p className="text-lg font-bold mt-1">
                    {plano.status === 'RASCUNHO' && '📝 Rascunho'}
                    {plano.status === 'SUBMETIDO' && '📤 Submetido para Aprovação'}
                    {plano.status === 'APROVADO' && '✅ Aprovado'}
                    {plano.status === 'REJEITADO' && '❌ Rejeitado'}
                    {plano.status === 'BLOQUEADO' && '🔒 Bloqueado'}
                    {!plano.status && '📝 Rascunho'}
                  </p>
                </div>
                {plano.status && (
                  <WorkflowStatusBadge status={plano.status as any} />
                )}
              </div>
              
              {/* Guia do fluxo */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Fluxo de Aprovação:</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span className={`px-2 py-1 rounded ${(!plano.status || plano.status === 'RASCUNHO') ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted'}`}>
                    1. Rascunho
                  </span>
                  <span>→</span>
                  <span className={`px-2 py-1 rounded ${plano.status === 'SUBMETIDO' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted'}`}>
                    2. Submetido
                  </span>
                  <span>→</span>
                  <span className={`px-2 py-1 rounded ${plano.status === 'APROVADO' ? 'bg-green-600 text-white font-medium' : 'bg-muted'}`}>
                    3. Aprovado
                  </span>
                </div>
              </div>
            </div>

            {/* Ações disponíveis */}
            <div>
              <p className="text-sm font-medium mb-3">Ações Disponíveis:</p>
              {plano.status ? (
                <WorkflowActions
                  entidade="PlanoEnsino"
                  entidadeId={planoId}
                  statusAtual={plano.status as any}
                  onStatusChange={() => {
                    queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
                  }}
                  disabledByCargaHoraria={!cargaHorariaCompleta}
                />
              ) : (
                <WorkflowActions
                  entidade="PlanoEnsino"
                  entidadeId={planoId}
                  statusAtual="RASCUNHO"
                  onStatusChange={() => {
                    queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
                  }}
                  disabledByCargaHoraria={!cargaHorariaCompleta}
                />
              )}
            </div>

            {/* Aviso de carga horária incompleta/excedente */}
            {!cargaHorariaCompleta && stats && (
              <div className={`p-3 rounded-md ${
                stats.status === "faltando"
                  ? "bg-yellow-50 border border-yellow-200"
                  : "bg-red-50 border border-red-200"
              }`}>
                <div className="flex items-start gap-2">
                  <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                    stats.status === "faltando" ? "text-yellow-600" : "text-red-600"
                  }`} />
                  <div>
                    <p className={`text-sm font-semibold mb-1 ${
                      stats.status === "faltando" ? "text-yellow-800" : "text-red-800"
                    }`}>
                      {stats.status === "faltando" ? "⚠️ Carga horária incompleta" : "❌ Carga horária excedente"}
                    </p>
                    <p className={`text-sm ${
                      stats.status === "faltando" ? "text-yellow-700" : "text-red-700"
                    }`}>
                      {stats.status === "faltando"
                        ? `É necessário completar a carga horária do Plano de Ensino antes de submeter ou aprovar. Faltam ${stats.diferenca} horas. Acesse a aba "2. Planejar" para adicionar mais aulas.`
                        : `A carga horária planejada excede a carga horária exigida em ${Math.abs(stats.diferenca)} horas. Ajuste o planejamento na aba "2. Planejar" antes de submeter ou aprovar.`}
                    </p>
                    <p className={`text-xs mt-1 ${
                      stats.status === "faltando" ? "text-yellow-700" : "text-red-700"
                    }`}>
                      <strong>Regra SIGA/SIGAE:</strong> A carga horária planejada deve ser EXATAMENTE igual à carga horária exigida ({stats.totalExigido}h).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Instruções baseadas no status */}
            {(!plano.status || plano.status === 'RASCUNHO') && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Próximo passo:</strong> Clique em "Submeter para Aprovação" para enviar o plano para revisão.
                  Após submetido, um administrador poderá aprovar ou rejeitar o plano.
                </p>
              </div>
            )}
            
            {plano.status === 'SUBMETIDO' && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Status:</strong> O plano foi submetido e está aguardando aprovação.
                  {permissoesPlano.canApprove && (
                    <span className="block mt-1">Como administrador, você pode aprovar ou rejeitar este plano usando os botões acima.</span>
                  )}
                </p>
              </div>
            )}

            {plano.status === 'APROVADO' && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  <strong>✅ Plano Aprovado!</strong> O plano foi aprovado e está pronto para uso.
                </p>
              </div>
            )}

            {plano.status === 'REJEITADO' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">
                  <strong>❌ Plano Rejeitado</strong> O plano foi rejeitado. Você pode fazer as correções necessárias e submeter novamente.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bloqueio e Impressão */}
      <Card>
        <CardHeader>
          <CardTitle>Finalizar Plano de Ensino</CardTitle>
          <CardDescription>
            Bloqueie o plano para edição e gere o relatório final
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plano.bloqueado ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-5 w-5 text-yellow-600" />
                <p className="font-medium text-yellow-800">Plano Bloqueado</p>
              </div>
              <p className="text-sm text-yellow-700 mb-4">
                Este plano está bloqueado e não pode ser editado.
                {plano.dataBloqueio && (
                  <span className="block mt-1">
                    Bloqueado em: {new Date(plano.dataBloqueio).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </p>
              {permissoesPlano.canBlock && (
                <Button
                  variant="outline"
                  onClick={() => setShowDesbloquearDialog(true)}
                  disabled={desbloquearMutation.isPending}
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  Desbloquear Plano
                </Button>
              )}
              {!permissoesPlano.canBlock && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm font-medium">{messages.onlyAdminCanApprove}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <p className="font-medium text-blue-800">Plano Disponível para Edição</p>
              </div>
              <p className="text-sm text-blue-700 mb-4">
                O plano está disponível para edição. Após finalizar o planejamento, bloqueie o plano
                para impedir alterações.
              </p>
              {permissoesPlano.canBlock ? (
                <Button
                  onClick={() => setShowBloquearDialog(true)}
                  disabled={bloquearMutation.isPending || !cargaHorariaCompleta}
                  className="bg-yellow-600 hover:bg-yellow-700"
                  title={!cargaHorariaCompleta ? "Finalize a carga horária do Plano de Ensino para continuar" : undefined}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Bloquear Plano
                </Button>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm font-medium">{messages.onlyAdminCanApprove}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium mb-1">Relatório Final</h3>
                <p className="text-sm text-muted-foreground">
                  Gere um PDF com todas as informações do plano de ensino
                </p>
              </div>
              <Button onClick={gerarPDF} variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Plano de Ensino
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Confirmar Bloqueio */}
      <AlertDialog open={showBloquearDialog} onOpenChange={setShowBloquearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear Plano de Ensino</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja bloquear este plano? Após bloqueado, não será possível editar
              aulas, adicionar novas aulas ou modificar o plano. Apenas visualização e impressão
              estarão disponíveis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bloquearMutation.mutate();
                setShowBloquearDialog(false);
              }}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Confirmar Desbloqueio */}
      <AlertDialog open={showDesbloquearDialog} onOpenChange={setShowDesbloquearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desbloquear Plano de Ensino</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desbloquear este plano? Após desbloqueado, será possível
              editar aulas, adicionar novas aulas e modificar o plano novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                desbloquearMutation.mutate();
                setShowDesbloquearDialog(false);
              }}
            >
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

