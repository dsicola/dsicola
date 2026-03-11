import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { encerramentosApi, anoLetivoApi, semestreApi, trimestreApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileLock,
  History,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnoLetivoAtivoGuard } from "@/components/academico/AnoLetivoAtivoGuard";
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";

type StatusEncerramento = "ABERTO" | "EM_ENCERRAMENTO" | "ENCERRADO" | "REABERTO";
type TipoPeriodo = "TRIMESTRE_1" | "TRIMESTRE_2" | "TRIMESTRE_3" | "SEMESTRE_1" | "SEMESTRE_2" | "ANO";

interface Encerramento {
  id: string;
  instituicaoId: string;
  anoLetivo: number;
  periodo: TipoPeriodo;
  status: StatusEncerramento;
  encerradoPor?: string | null;
  encerradoEm?: string | null;
  justificativa?: string | null;
  reabertoPor?: string | null;
  reabertoEm?: string | null;
  justificativaReabertura?: string | null;
  usuarioEncerrou?: {
    nomeCompleto: string;
  };
  usuarioReabriu?: {
    nomeCompleto: string;
  };
}

export function EncerramentosAcademicosTab() {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { tipoAcademico, isSuperior, isSecundario } = useInstituicao();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();

  // Buscar anos letivos disponíveis
  const { data: anosLetivos = [], isLoading: isLoadingAnosLetivos } = useQuery({
    queryKey: ["anos-letivos-encerramentos", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  const [anoLetivo, setAnoLetivo] = useState<number>(anoLetivoAtivo?.ano || new Date().getFullYear());
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [dialogType, setDialogType] = useState<"encerrar" | "reabrir" | null>(null);
  const [selectedPeriodo, setSelectedPeriodo] = useState<TipoPeriodo | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [erroEncerrarDialogOpen, setErroEncerrarDialogOpen] = useState(false);
  const [erroEncerrarData, setErroEncerrarData] = useState<{ message: string; erros: string[] } | null>(null);

  // Atualizar ano letivo quando ano letivo ativo estiver disponível
  useEffect(() => {
    if (anoLetivoAtivo?.ano && !anoLetivo) {
      setAnoLetivo(anoLetivoAtivo.ano);
    }
  }, [anoLetivoAtivo?.ano]);

  // Buscar semestres do ano letivo (apenas Ensino Superior)
  const { data: semestres = [], isLoading: isLoadingSemestres } = useQuery({
    queryKey: ["semestres-encerramentos", instituicaoId, anoLetivo],
    queryFn: async () => {
      if (isSuperior && anoLetivo) {
        return await semestreApi.getAll({ anoLetivo });
      }
      return [];
    },
    enabled: isSuperior && !!instituicaoId && !!anoLetivo,
  });

  // Buscar trimestres do ano letivo (apenas Ensino Secundário)
  const { data: trimestres = [], isLoading: isLoadingTrimestres } = useQuery({
    queryKey: ["trimestres-encerramentos", instituicaoId, anoLetivo],
    queryFn: async () => {
      if (isSecundario && anoLetivo) {
        return await trimestreApi.getAll({ anoLetivo });
      }
      return [];
    },
    enabled: isSecundario && !!instituicaoId && !!anoLetivo,
  });

  // Buscar status de encerramentos
  const { data: encerramentos = [], isLoading } = useQuery({
    queryKey: ["encerramentos", instituicaoId, anoLetivo],
    queryFn: async () => {
      return await encerramentosApi.getStatus({ anoLetivo });
    },
    enabled: !!instituicaoId,
  });

  // Mutation para encerrar - protegida contra unmount
  const encerrarMutation = useSafeMutation({
    mutationFn: (data: { anoLetivo: number; periodo: TipoPeriodo; justificativa?: string }) =>
      encerramentosApi.encerrar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["encerramentos"] });
      toast({
        title: "Período encerrado",
        description: "O período foi encerrado com sucesso",
      });
      // Fechamento explícito após sucesso
      setDialogOpen(false);
      setJustificativa("");
    },
    onError: (error: any) => {
      const data = error?.response?.data;
      if (data?.code === "PRE_REQUISITOS_PENDENTES" && data?.erros?.length) {
        setErroEncerrarData({ message: data.message || "Pré-requisitos pendentes", erros: data.erros });
        setErroEncerrarDialogOpen(true);
        toast({
          title: "Não foi possível encerrar",
          description: "Complete os pré-requisitos para continuar. Verifique os detalhes no painel.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Não foi possível encerrar",
          description: data?.message || "Não foi possível encerrar o período. Verifique os pré-requisitos.",
          variant: "destructive",
        });
      }
    },
  });

  // Mutation para reabrir - protegida contra unmount
  const reabrirMutation = useSafeMutation({
    mutationFn: (data: {
      anoLetivo: number;
      periodo: TipoPeriodo;
      justificativaReabertura: string;
    }) => encerramentosApi.reabrir(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["encerramentos"] });
      toast({
        title: "Período reaberto",
        description: "O período foi reaberto com sucesso",
      });
      // Fechamento explícito após sucesso
      setDialogOpen(false);
      setJustificativa("");
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível reabrir",
        description: error?.response?.data?.message || "Não foi possível reabrir o período. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: StatusEncerramento) => {
    switch (status) {
      case "ABERTO":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Aberto</Badge>;
      case "EM_ENCERRAMENTO":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Em Encerramento</Badge>;
      case "ENCERRADO":
        return <Badge variant="destructive">Encerrado</Badge>;
      case "REABERTO":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">Reaberto</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPeriodoLabel = (periodo: TipoPeriodo) => {
    switch (periodo) {
      case "TRIMESTRE_1":
        return "1º Trimestre";
      case "TRIMESTRE_2":
        return "2º Trimestre";
      case "TRIMESTRE_3":
        return "3º Trimestre";
      case "SEMESTRE_1":
        return "1º Semestre";
      case "SEMESTRE_2":
        return "2º Semestre";
      case "ANO":
        return "Ano Letivo";
      default:
        return periodo;
    }
  };

  // Construir períodos dinamicamente baseado nos dados do banco (SEM valores hardcoded)
  // REGRA GLOBAL: Todos os períodos devem vir do banco de dados
  const periodos: TipoPeriodo[] = useMemo(() => {
    const periodosList: TipoPeriodo[] = [];
    
    if (isSecundario) {
      // Ensino Secundário: adicionar trimestres cadastrados no banco
      trimestres.forEach((trimestre: any) => {
        const periodoKey = `TRIMESTRE_${trimestre.numero}` as TipoPeriodo;
        if (['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3'].includes(periodoKey)) {
          periodosList.push(periodoKey);
        }
      });
    } else if (isSuperior) {
      // Ensino Superior: adicionar semestres cadastrados no banco
      semestres.forEach((semestre: any) => {
        const periodoKey = `SEMESTRE_${semestre.numero}` as TipoPeriodo;
        if (['SEMESTRE_1', 'SEMESTRE_2'].includes(periodoKey)) {
          periodosList.push(periodoKey);
        }
      });
    } else {
      // Tipo não identificado: adicionar todos os períodos cadastrados (compatibilidade)
      trimestres.forEach((trimestre: any) => {
        const periodoKey = `TRIMESTRE_${trimestre.numero}` as TipoPeriodo;
        if (['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3'].includes(periodoKey)) {
          periodosList.push(periodoKey);
        }
      });
      semestres.forEach((semestre: any) => {
        const periodoKey = `SEMESTRE_${semestre.numero}` as TipoPeriodo;
        if (['SEMESTRE_1', 'SEMESTRE_2'].includes(periodoKey)) {
          periodosList.push(periodoKey);
        }
      });
    }
    
    // Sempre adicionar "ANO" (ano letivo completo)
    periodosList.push("ANO");
    
    return periodosList;
  }, [isSecundario, isSuperior, trimestres, semestres]);

  const handleEncerrar = (periodo: TipoPeriodo) => {
    setDialogType("encerrar");
    setSelectedPeriodo(periodo);
    setDialogOpen(true);
  };

  const handleReabrir = (periodo: TipoPeriodo) => {
    setDialogType("reabrir");
    setSelectedPeriodo(periodo);
    setDialogOpen(true);
  };

  const handleConfirmar = () => {
    if (!selectedPeriodo) return;

    if (dialogType === "encerrar") {
      encerrarMutation.mutate({
        anoLetivo,
        periodo: selectedPeriodo,
        justificativa: justificativa || undefined,
      });
    } else if (dialogType === "reabrir") {
      if (!justificativa.trim()) {
        toast({
          title: "Atenção",
          description: "A justificativa é obrigatória para reabrir o período.",
          variant: "destructive",
        });
        return;
      }
      reabrirMutation.mutate({
        anoLetivo,
        periodo: selectedPeriodo,
        justificativaReabertura: justificativa,
      });
    }
  };

  return (
    <AnoLetivoAtivoGuard showAlert={true} disableChildren={false}>
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileLock className="h-5 w-5" />
            Encerramentos Académicos
          </CardTitle>
          <CardDescription>
            {isSecundario 
              ? "Controle o fechamento formal de trimestres e ano letivo"
              : isSuperior
              ? "Controle o fechamento formal de semestres e ano letivo"
              : "Controle o fechamento formal de períodos acadêmicos e ano letivo"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="space-y-2 flex-1">
                <Label>Ano Letivo *</Label>
                <Select
                  value={anoLetivo?.toString() || ""}
                  onValueChange={(value) => {
                    const anoSelecionado = anosLetivos.find((al: any) => al.ano.toString() === value);
                    setAnoLetivo(anoSelecionado ? anoSelecionado.ano : Number(value));
                  }}
                  disabled={isLoadingAnosLetivos || anosLetivos.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingAnosLetivos ? "Carregando..." : anosLetivos.length === 0 ? "Nenhum ano letivo cadastrado" : "Selecione o ano letivo"} />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingAnosLetivos ? (
                      <SelectItem value="loading" disabled>Carregando...</SelectItem>
                    ) : anosLetivos.length === 0 ? (
                      <SelectItem value="empty" disabled>Nenhum ano letivo cadastrado</SelectItem>
                    ) : (
                      anosLetivos.map((al: any) => (
                        <SelectItem key={al.id} value={al.ano.toString()}>
                          {al.ano} - {al.status === 'ATIVO' ? '🟢 Ativo' : al.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Após encerrar um período, não será possível editar notas, presenças ou lançar novas aulas.
                A reabertura requer justificativa e permissões administrativas.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status dos Períodos</CardTitle>
          <CardDescription>
            Visualize e gerencie o status de encerramento de cada período
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Encerrado Por</TableHead>
                    <TableHead>Data Encerramento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodos.map((periodo) => {
                    const encerramento = encerramentos.find(
                      (e: Encerramento) => e.periodo === periodo && e.anoLetivo === anoLetivo
                    );
                    const status = encerramento?.status || "ABERTO";

                    return (
                      <TableRow key={periodo}>
                        <TableCell className="font-medium">
                          {getPeriodoLabel(periodo)}
                        </TableCell>
                        <TableCell>{getStatusBadge(status as StatusEncerramento)}</TableCell>
                        <TableCell>
                          {encerramento?.usuarioEncerrou?.nomeCompleto || "-"}
                        </TableCell>
                        <TableCell>
                          {encerramento?.encerradoEm
                            ? format(new Date(encerramento.encerradoEm), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {status === "ENCERRADO" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReabrir(periodo)}
                              >
                                <Unlock className="h-4 w-4 mr-2" />
                                Reabrir
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleEncerrar(periodo)}
                                disabled={status === "EM_ENCERRAMENTO"}
                              >
                                <Lock className="h-4 w-4 mr-2" />
                                Encerrar
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

      {/* Histórico de Reaberturas */}
      {encerramentos.some((e: Encerramento) => e.status === "REABERTO") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Reaberturas
            </CardTitle>
            <CardDescription>
              Períodos que foram reabertos após encerramento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {encerramentos
                .filter((e: Encerramento) => e.status === "REABERTO")
                .map((encerramento: Encerramento) => (
                  <Alert key={encerramento.id}>
                    <Unlock className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <div className="font-semibold">
                          {getPeriodoLabel(encerramento.periodo)} - {encerramento.anoLetivo}
                        </div>
                        <div className="text-sm">
                          Reaberto por: {encerramento.usuarioReabriu?.nomeCompleto || "N/A"}
                        </div>
                        <div className="text-sm">
                          Data:{" "}
                          {encerramento.reabertoEm
                            ? format(new Date(encerramento.reabertoEm), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })
                            : "N/A"}
                        </div>
                        {encerramento.justificativaReabertura && (
                          <div className="text-sm mt-2">
                            <strong>Justificativa:</strong> {encerramento.justificativaReabertura}
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de pré-requisitos pendentes (encerramento bloqueado) */}
      <Dialog open={erroEncerrarDialogOpen} onOpenChange={setErroEncerrarDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Não foi possível encerrar</DialogTitle>
            <DialogDescription>
              {erroEncerrarData?.message || "Complete os pré-requisitos para continuar."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Para encerrar o período, complete as aulas e presenças no painel do professor e feche todas as avaliações.
              </AlertDescription>
            </Alert>
            {erroEncerrarData?.erros && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Detalhes:</Label>
                <div className="rounded-md border bg-muted/30 p-3 max-h-64 overflow-y-auto">
                  <ul className="space-y-1.5 text-sm">
                    {erroEncerrarData.erros.map((erro, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-destructive mt-0.5">•</span>
                        <span>{erro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setErroEncerrarDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "encerrar" ? "Encerrar Período" : "Reabrir Período"}
            </DialogTitle>
            <DialogDescription>
              {dialogType === "encerrar"
                ? `Tem certeza que deseja encerrar o ${selectedPeriodo ? getPeriodoLabel(selectedPeriodo) : ""} de ${anoLetivo}? Após o encerramento, não será possível editar notas, presenças ou lançar novas aulas.`
                : `Tem certeza que deseja reabrir o ${selectedPeriodo ? getPeriodoLabel(selectedPeriodo) : ""} de ${anoLetivo}? Esta ação requer justificativa e será registrada para auditoria.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                {dialogType === "reabrir" ? "Justificativa da Reabertura *" : "Justificativa (opcional)"}
              </Label>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder={
                  dialogType === "reabrir"
                    ? "Explique o motivo da reabertura do período..."
                    : "Justificativa para o encerramento (opcional)..."
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmar}
              variant={dialogType === "encerrar" ? "destructive" : "default"}
              disabled={
                encerrarMutation.isPending ||
                reabrirMutation.isPending ||
                (dialogType === "reabrir" && !justificativa.trim())
              }
            >
              {(encerrarMutation.isPending || reabrirMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {dialogType === "encerrar" ? "Confirmar Encerramento" : "Confirmar Reabertura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </AnoLetivoAtivoGuard>
  );
}

