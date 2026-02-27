import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { mensalidadesApi, profilesApi, matriculasApi, matriculasAnuaisApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  DollarSign,
  CheckCircle,
  Clock,
  Search,
  Receipt,
  AlertTriangle,
  CreditCard,
  LogOut,
  Calendar,
  Filter,
} from "lucide-react";
import { 
  ReciboData, 
  gerarCodigoRecibo,
  extrairNomeTurmaRecibo,
  formatAnoFrequenciaSuperior,
  getInstituicaoForRecibo,
} from "@/utils/pdfGenerator";
import { recibosApi } from "@/services/api";
import { PrintReceiptDialog } from "@/components/secretaria/PrintReceiptDialog";

interface Mensalidade {
  id: string;
  aluno_id: string;
  valor: number;
  status: string;
  data_vencimento: string;
  data_pagamento: string | null;
  multa: boolean;
  valor_multa: number;
  valor_juros?: number;
  valor_desconto?: number;
  mes_referencia: number;
  ano_referencia: number;
  forma_pagamento: string | null;
  recibo_numero: string | null;
  profiles?: {
    nome_completo: string;
    email: string;
    numero_identificacao: string | null;
    numero_identificacao_publica: string | null;
  };
  /** Aluno da API (fallback quando profiles não tem numero_identificacao_publica) */
  aluno?: {
    nome_completo: string;
    email: string;
    numero_identificacao: string | null;
    numero_identificacao_publica: string | null;
  } | null;
  curso_nome?: string;
  turma_nome?: string;
  ano_frequencia?: string | null;
  classe_frequencia?: string | null;
  ano_letivo?: number | null;
}

export default function POSDashboard() {
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const { config, instituicao: instituicaoContext, isSecundario, tipoAcademico } = useInstituicao();
  const navigate = useNavigate();
  
  // Terminologia adaptada para ensino médio
  const termoEstudante = isSecundario ? "Estudante" : "Aluno";
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showPagamentoDialog, setShowPagamentoDialog] = useSafeDialog(false);
  const [selectedMensalidade, setSelectedMensalidade] = useState<Mensalidade | null>(null);
  const [formaPagamento, setFormaPagamento] = useState("Transferência Bancária");
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [showPrintDialog, setShowPrintDialog] = useSafeDialog(false);
  const [printReciboData, setPrintReciboData] = useState<ReciboData | null>(null);
  
  // Filtros de data
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // Fetch pending mensalidades filtered by institution
  // Note: Backend automatically filters by instituicaoId from token, no need to pass it
  const { data: mensalidades, isLoading } = useQuery({
    queryKey: ["mensalidades-pos", user?.id],
    queryFn: async () => {
      // Backend will automatically filter by instituicaoId from JWT token
      const mensalidadesRes = await mensalidadesApi.getAll();
      const mensalidadesData = mensalidadesRes?.data ?? [];
      const pendingMensalidades = mensalidadesData.filter(
        (m: any) => m.status === "Pendente" || m.status === "Atrasado"
      );

      const alunoIds = [...new Set(pendingMensalidades.map((m: any) => m.aluno_id) || [])] as string[];
      
      if (alunoIds.length === 0) return [] as Mensalidade[];

      // Fetch profiles for each aluno
      const profilesData = await Promise.all(
        alunoIds.map((id: string) => profilesApi.getById(id).catch(() => null))
      );
      
      const profilesMap = new Map(
        profilesData.filter(Boolean).map((p: any) => [p.id, p])
      );

      const matriculasRes = await matriculasApi.getAll().catch(() => ({ data: [] }));
      const matriculasData = matriculasRes?.data ?? [];
      const alunoInfoMap = new Map<string, {
        curso_nome: string;
        turma_nome: string;
        anoFrequencia?: string | null;
        classeFrequencia?: string | null;
        anoLetivo?: number | null;
      }>();
      matriculasData?.forEach((m: any) => {
        const aid = m.aluno_id ?? m.alunoId;
        if (aid && m.turma && !alunoInfoMap.has(aid)) {
          const turma = m.turma;
          alunoInfoMap.set(aid, {
            curso_nome: turma?.curso?.nome || 'N/A',
            turma_nome: extrairNomeTurmaRecibo(turma?.nome) || turma?.nome || 'N/A',
            anoFrequencia: formatAnoFrequenciaSuperior(turma),
            classeFrequencia: turma?.classe?.nome ?? null,
            anoLetivo: m.ano_letivo ?? m.anoLetivo ?? m.anoLetivoRef?.ano ?? null,
          });
        }
      });

      return pendingMensalidades.map((m: any) => {
        const aid = m.aluno_id ?? m.alunoId ?? m.aluno?.id;
        return {
          ...m,
          profiles: profilesMap.get(aid),
          curso_nome: alunoInfoMap.get(aid)?.curso_nome ?? m.curso_nome ?? m.curso?.nome ?? null,
          turma_nome: alunoInfoMap.get(aid)?.turma_nome ?? m.turma_nome ?? null,
          ano_frequencia: alunoInfoMap.get(aid)?.anoFrequencia ?? m.ano_frequencia ?? null,
          classe_frequencia: alunoInfoMap.get(aid)?.classeFrequencia ?? m.classe_nome ?? null,
          ano_letivo: alunoInfoMap.get(aid)?.anoLetivo,
        };
      }) as Mensalidade[];
    },
    enabled: !!user, // Enable query when user is loaded
  });

  // Mark payment
  const marcarPagoMutation = useMutation({
    mutationFn: async ({ id, formaPagamento, dataPagamento }: { id: string; formaPagamento: string; dataPagamento: string }) => {
      if (!selectedMensalidade) {
        throw new Error("Mensalidade não selecionada");
      }

      const valorTotal =
        Number(selectedMensalidade.valor || 0)
        - Number(selectedMensalidade.valor_desconto || 0)
        + Number(selectedMensalidade.valor_multa || 0)
        + Number(selectedMensalidade.valor_juros || 0);

      // Módulo FINANCEIRO emite recibo ao confirmar pagamento
      const response = await mensalidadesApi.registrarPagamento(id, {
        valor: valorTotal,
        formaPagamento: formaPagamento,
        dataPagamento: dataPagamento,
      });

      const reciboNumero = response?.mensalidade?.comprovativo || response?.recibo_numero || `RCB-${Date.now()}`;
      const reciboId = response?.reciboId ?? response?.recibo_id;
      return { reciboNumero, response, reciboId, dataPagamento, formaPagamento };
    },
    onSuccess: async ({ reciboNumero, reciboId, dataPagamento, formaPagamento }) => {
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: ["mensalidades-pos"] });
      });

      if (reciboId && selectedMensalidade) {
        try {
          const reciboRes = await recibosApi.getById(reciboId);
          const pdfData = (reciboRes as { pdfData?: ReciboData })?.pdfData;
          if (pdfData) {
            setPrintReciboData(pdfData);
            setShowPrintDialog(true);
            setShowPagamentoDialog(false);
            setSelectedMensalidade(null);
            toast({ title: "Pagamento registrado", description: `Recibo gerado: ${reciboNumero}` });
            return;
          }
        } catch (_) { /* fallback to local */ }
      }

      if (selectedMensalidade) {
        const instituicao = getInstituicaoForRecibo({ config, instituicao: instituicaoContext, tipoAcademico });
        const reciboData: ReciboData = {
          instituicao,
          aluno: {
            nome: (selectedMensalidade.profiles?.nome_completo ?? selectedMensalidade.aluno?.nome_completo) || 'N/A',
            numeroId: selectedMensalidade.profiles?.numero_identificacao_publica ?? selectedMensalidade.aluno?.numero_identificacao_publica ?? null,
            bi: selectedMensalidade.profiles?.numero_identificacao ?? selectedMensalidade.aluno?.numero_identificacao ?? null,
            email: selectedMensalidade.profiles?.email ?? selectedMensalidade.aluno?.email ?? null,
            curso: selectedMensalidade.curso_nome ?? undefined,
            turma: selectedMensalidade.turma_nome ?? undefined,
            anoLetivo: selectedMensalidade.ano_letivo ?? null,
            anoFrequencia: selectedMensalidade.ano_frequencia ?? null,
            classeFrequencia: selectedMensalidade.classe_frequencia ?? null,
            tipoAcademico: tipoAcademico ?? config?.tipo_academico ?? null,
          },
          pagamento: {
            valor: Number(selectedMensalidade.valor),
            valorDesconto: Number(selectedMensalidade.valor_desconto || 0),
            valorMulta: Number(selectedMensalidade.valor_multa || 0),
            valorJuros: Number(selectedMensalidade.valor_juros || 0),
            mesReferencia: selectedMensalidade.mes_referencia,
            anoReferencia: selectedMensalidade.ano_referencia,
            dataPagamento: dataPagamento,
            formaPagamento: formaPagamento,
            reciboNumero: reciboNumero,
          },
        };
        setPrintReciboData(reciboData);
        setShowPrintDialog(true);
      }
      setShowPagamentoDialog(false);
      setSelectedMensalidade(null);
      toast({ title: "Pagamento registrado", description: `Recibo gerado: ${reciboNumero}` });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao registrar pagamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredMensalidades = mensalidades?.filter((m) => {
    const searchLower = String(searchTerm ?? '').toLowerCase();
    const nome = m.profiles?.nome_completo ?? m.aluno?.nome_completo ?? '';
    const numPub = m.profiles?.numero_identificacao_publica ?? m.aluno?.numero_identificacao_publica ?? '';
    const numId = m.profiles?.numero_identificacao ?? m.aluno?.numero_identificacao ?? '';
    const matchesSearch =
      String(nome).toLowerCase().includes(searchLower) ||
      String(numPub).toLowerCase().includes(searchLower) ||
      String(numId).toLowerCase().includes(searchLower);

    // Filtro de data de vencimento
    let matchesDate = true;
    if (dataInicio) {
      matchesDate = matchesDate && m.data_vencimento >= dataInicio;
    }
    if (dataFim) {
      matchesDate = matchesDate && m.data_vencimento <= dataFim;
    }

    return matchesSearch && matchesDate;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-AO", {
      style: "currency",
      currency: "AOA",
    }).format(value);
  };

  const getMesNome = (mes: number) => {
    const meses = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return meses[mes - 1] || "";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pendente":
        return <Badge className="bg-yellow-500/10 text-yellow-500"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      case "Atrasado":
        return <Badge className="bg-destructive/10 text-destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Atrasado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const stats = {
    pendentes: mensalidades?.filter((m) => m.status === "Pendente").length || 0,
    atrasados: mensalidades?.filter((m) => m.status === "Atrasado").length || 0,
    totalPendente: mensalidades?.reduce((acc, m) => 
      acc + Number(m.valor) 
      - Number(m.valor_desconto || 0)
      + Number(m.valor_multa || 0)
      + Number(m.valor_juros || 0), 0) || 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-primary" />
              Ponto de Venda - Pagamentos Rápidos
            </h1>
            <p className="text-muted-foreground mt-1">
              Registre pagamentos de forma rápida e eficiente
            </p>
          </div>
          <Button 
            variant="destructive" 
            onClick={async () => {
              await signOut();
              navigate('/auth');
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendentes}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.atrasados}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatCurrency(stats.totalPendente)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <Label htmlFor="search-aluno">Buscar {termoEstudante}</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search-aluno"
                    placeholder="Nome ou número de identificação..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="data-inicio">Data Início (Vencimento)</Label>
                <div className="relative mt-1">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="data-inicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="data-fim">Data Fim (Vencimento)</Label>
                <div className="relative mt-1">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="data-fim"
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            {(dataInicio || dataFim || searchTerm) && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-4"
                onClick={() => {
                  setDataInicio("");
                  setDataFim("");
                  setSearchTerm("");
                }}
              >
                Limpar Filtros
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pagamentos Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{termoEstudante}</TableHead>
                    <TableHead>Nº</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMensalidades?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {searchTerm ? "Nenhum resultado encontrado" : "Nenhum pagamento pendente"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMensalidades?.slice(0, 20).map((mensalidade) => (
                      <TableRow key={mensalidade.id}>
                        <TableCell className="font-medium">
                          {mensalidade.profiles?.nome_completo || 'N/A'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {mensalidade.profiles?.numero_identificacao_publica || '-'}
                        </TableCell>
                        <TableCell>
                          {getMesNome(mensalidade.mes_referencia)}/{mensalidade.ano_referencia}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{formatCurrency(Number(mensalidade.valor) - Number(mensalidade.valor_desconto || 0))}</div>
                            {Number(mensalidade.valor_desconto || 0) > 0 && (
                              <div className="text-xs text-green-600">
                                - {formatCurrency(Number(mensalidade.valor_desconto))} (desconto)
                              </div>
                            )}
                            {Number(mensalidade.valor_multa || 0) > 0 && (
                              <div className="text-xs text-destructive">
                                + {formatCurrency(Number(mensalidade.valor_multa))} (multa)
                              </div>
                            )}
                            {Number(mensalidade.valor_juros || 0) > 0 && (
                              <div className="text-xs text-destructive">
                                + {formatCurrency(Number(mensalidade.valor_juros))} (juros)
                              </div>
                            )}
                            <div className="font-semibold text-primary border-t pt-1 mt-1">
                              Total: {formatCurrency(
                                Number(mensalidade.valor) 
                                - Number(mensalidade.valor_desconto || 0)
                                + Number(mensalidade.valor_multa || 0)
                                + Number(mensalidade.valor_juros || 0)
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(mensalidade.status)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedMensalidade(mensalidade);
                              setShowPagamentoDialog(true);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Pagar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPagamentoDialog} onOpenChange={setShowPagamentoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          {selectedMensalidade && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p><strong>{termoEstudante}:</strong> {selectedMensalidade.profiles?.nome_completo}</p>
                <p><strong>Referência:</strong> {getMesNome(selectedMensalidade.mes_referencia)}/{selectedMensalidade.ano_referencia}</p>
                <p><strong>Valor:</strong> {formatCurrency(Number(selectedMensalidade.valor))}</p>
                {Number(selectedMensalidade.valor_desconto || 0) > 0 && (
                  <p className="text-green-600"><strong>Desconto:</strong> -{formatCurrency(Number(selectedMensalidade.valor_desconto || 0))}</p>
                )}
                {selectedMensalidade.multa && selectedMensalidade.valor_multa > 0 && (
                  <p className="text-destructive"><strong>Multa:</strong> {formatCurrency(Number(selectedMensalidade.valor_multa))}</p>
                )}
                {Number(selectedMensalidade.valor_juros || 0) > 0 && (
                  <p className="text-destructive"><strong>Juros:</strong> {formatCurrency(Number(selectedMensalidade.valor_juros || 0))}</p>
                )}
                <p className="text-lg font-bold">
                  <strong>Total:</strong> {formatCurrency(
                    Number(selectedMensalidade.valor)
                    - Number(selectedMensalidade.valor_desconto || 0)
                    + Number(selectedMensalidade.valor_multa || 0)
                    + Number(selectedMensalidade.valor_juros || 0)
                  )}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Transferência Bancária">Transferência Bancária</SelectItem>
                    <SelectItem value="Multicaixa Express">Multicaixa Express</SelectItem>
                    <SelectItem value="Depósito">Depósito</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Numerário">Numerário</SelectItem>
                    <SelectItem value="Caixa">Caixa</SelectItem>
                    <SelectItem value="TPA">TPA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data do Pagamento</Label>
                <Input
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPagamentoDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedMensalidade) {
                  marcarPagoMutation.mutate({
                    id: selectedMensalidade.id,
                    formaPagamento,
                    dataPagamento,
                  });
                }
              }}
              disabled={marcarPagoMutation.isPending}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Receipt Dialog */}
      <PrintReceiptDialog
        open={showPrintDialog}
        onOpenChange={setShowPrintDialog}
        reciboData={printReciboData}
      />
    </DashboardLayout>
  );
}
