import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { assinaturasApi, pagamentoLicencaApi, documentoFiscalApi, configuracoesLandingApi, storageApi } from "@/services/api";
import { ArrowLeft, CreditCard, Calendar, CheckCircle2, Clock, XCircle, Plus, AlertTriangle, Download, Upload, FileText, Info } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { downloadDocumentoFiscalLicenca, DocumentoFiscalLicencaData } from "@/utils/pdfGenerator";
import { ConfirmacaoResponsabilidadeDialog } from "@/components/common/ConfirmacaoResponsabilidadeDialog";

interface Pagamento {
  id: string;
  plano: string;
  valor: number;
  periodo: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  metodo: string;
  referencia?: string;
  comprovativoUrl?: string | null;
  criadoEm: string;
  pagoEm?: string;
  observacoes?: string;
}

export default function MinhaLicenca() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [tipoPagamento, setTipoPagamento] = useState<'manual' | 'online'>('manual');
  const [comprovativoFile, setComprovativoFile] = useState<File | null>(null);
  const [comprovativoDialogOpen, setComprovativoDialogOpen] = useSafeDialog(false);
  const [comprovativoPagamentoId, setComprovativoPagamentoId] = useState<string | null>(null);
  const [uploadingComprovativo, setUploadingComprovativo] = useState(false);
  const [criticoCancelarPagamentoId, setCriticoCancelarPagamentoId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    plano: '',
    periodo: '',
    metodo: 'TRANSFERENCIA' as 'TRANSFERENCIA' | 'DEPOSITO' | 'MULTICAIXA' | 'AIRTM' | 'RODETPAY' | 'CASH' | 'MOBILE_MONEY',
    referencia: '',
    observacoes: '',
    gateway: 'STRIPE' as 'STRIPE' | 'PAYPAL' | 'TAZAPAY',
  });

  // Buscar assinatura atual
  const { data: assinatura, isLoading: loadingAssinatura } = useQuery({
    queryKey: ["minha-assinatura"],
    queryFn: async () => {
      // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
      // O backend usa req.user.instituicaoId do JWT token automaticamente
      return await assinaturasApi.getByInstituicao();
    },
  });

  // Buscar histórico de pagamentos
  const { data: pagamentos = [], isLoading: loadingPagamentos } = useQuery({
    queryKey: ["pagamentos-licenca", instituicaoId],
    queryFn: async () => {
      return await pagamentoLicencaApi.getHistorico();
    },
    enabled: !!instituicaoId,
  });

  // Coordenadas bancárias (para pagamento manual)
  const { data: coordenadasBancarias } = useQuery({
    queryKey: ["coordenadas-bancarias"],
    queryFn: () => configuracoesLandingApi.getCoordenadasBancarias(),
    enabled: dialogOpen && tipoPagamento === "manual",
  });

  // Mutation para criar pagamento manual
  const criarPagamentoMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      pagamentoLicencaApi.criar({
        plano: data.plano as 'BASIC' | 'PRO' | 'ENTERPRISE',
        periodo: data.periodo as 'MENSAL' | 'SEMESTRAL' | 'ANUAL',
        metodo: data.metodo as any,
        referencia: data.referencia || undefined,
        observacoes: data.observacoes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-licenca"] });
      queryClient.invalidateQueries({ queryKey: ["minha-assinatura"] });
      toast({
        title: "Sucesso",
        description: "Pagamento criado com sucesso. Aguarde a confirmação do administrador.",
      });
      setDialogOpen(false);
      setTipoPagamento('manual');
      setComprovativoFile(null);
      setFormData({
        plano: '',
        periodo: '',
        metodo: 'TRANSFERENCIA',
        referencia: '',
        observacoes: '',
        gateway: 'STRIPE',
      });
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível criar pagamento",
        description: error?.response?.data?.message || "Não foi possível criar o pagamento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutation para criar pagamento online
  const criarPagamentoOnlineMutation = useMutation({
    mutationFn: (data: { plano: string; periodo: string; gateway: string }) =>
      pagamentoLicencaApi.criarOnline({
        plano: data.plano as 'BASIC' | 'PRO' | 'ENTERPRISE',
        periodo: data.periodo as 'MENSAL' | 'SEMESTRAL' | 'ANUAL',
        gateway: data.gateway as 'STRIPE' | 'PAYPAL' | 'TAZAPAY',
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-licenca"] });
      queryClient.invalidateQueries({ queryKey: ["minha-assinatura"] });
      
      // Se tiver redirectUrl, redirecionar
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else if (data.clientSecret) {
        // Para Stripe, usar clientSecret
        toast({
          title: "Redirecionando para pagamento...",
          description: "Você será redirecionado para finalizar o pagamento.",
        });
        // Aqui poderia integrar com Stripe Elements
        // Por enquanto, mostrar mensagem
      }
      
      setDialogOpen(false);
      setTipoPagamento('manual');
      setFormData({
        plano: '',
        periodo: '',
        metodo: 'TRANSFERENCIA',
        referencia: '',
        observacoes: '',
        gateway: 'STRIPE',
      });
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível criar pagamento",
        description: error?.response?.data?.message || "Não foi possível criar o pagamento online. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutation para cancelar pagamento
  const cancelarPagamentoMutation = useMutation({
    mutationFn: (pagamentoId: string) =>
      pagamentoLicencaApi.cancelar(pagamentoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-licenca"] });
      toast({
        title: "Sucesso",
        description: "Pagamento cancelado com sucesso",
      });
      setCriticoCancelarPagamentoId(null);
    },
    onError: (error: any) => {
      setCriticoCancelarPagamentoId(null);
      toast({
        title: "Não foi possível cancelar",
        description: error?.response?.data?.message || "Não foi possível cancelar o pagamento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'AOA',
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Pago</Badge>;
      case 'PENDING':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'FAILED':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case 'CANCELLED':
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleCriarPagamento = async () => {
    if (!formData.plano || !formData.periodo) {
      toast({
        title: "Atenção",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (tipoPagamento === 'online') {
      toast({
        title: "Pagamento Online Indisponível",
        description: "Pagamento automático estará disponível em breve. Utilize os métodos de pagamento manual.",
        variant: "destructive",
      });
      return;
    }

    let comprovativoUrl: string | undefined;
    if (comprovativoFile) {
      try {
        const fileExt = comprovativoFile.name.split('.').pop();
        const fileName = `licenca/${instituicaoId || 'inst'}/${Date.now()}.${fileExt}`;
        const uploadResult = await storageApi.upload('comprovativos', fileName, comprovativoFile);
        comprovativoUrl = uploadResult.url;
      } catch (err: any) {
        toast({
          title: "Não foi possível enviar comprovativo",
          description: err?.response?.data?.message || "Tente novamente.",
          variant: "destructive",
        });
        return;
      }
    }

    criarPagamentoMutation.mutate({
      ...formData,
      comprovativoUrl,
    });
    setComprovativoFile(null);
  };

  const handleCancelarPagamento = (pagamentoId: string) => {
    setCriticoCancelarPagamentoId(pagamentoId);
  };

  // Handler para baixar recibo/fatura
  const handleDownloadDocumento = async (pagamento: Pagamento) => {
    try {
      // Buscar dados do documento fiscal
      const dados = await documentoFiscalApi.getByPagamento(pagamento.id);

      // Preparar dados para geração de PDF
      const documentoData: DocumentoFiscalLicencaData = {
        tipo: dados.documento.tipo,
        numeroDocumento: dados.documento.numeroDocumento,
        instituicao: {
          nome: dados.instituicao.nome,
          logoUrl: dados.instituicao.logoUrl || null,
          email: dados.instituicao.emailContato || null,
          telefone: dados.instituicao.telefone || null,
          endereco: dados.instituicao.endereco || null,
          nif: dados.instituicao.configuracao?.nif || null,
        },
        plano: {
          nome: dados.planoSnapshot?.nome || dados.pagamento.plano,
        },
        valor: Number(dados.pagamento.valor),
        moeda: dados.documento.moeda,
        periodo: dados.pagamento.periodo,
        metodo: dados.pagamento.metodo,
        referencia: dados.pagamento.referencia || null,
        dataEmissao: dados.documento.dataEmissao || new Date().toISOString(),
        dataPagamento: dados.pagamento.pagoEm || new Date().toISOString(),
      };

      await downloadDocumentoFiscalLicenca(documentoData);

      toast({
        title: "Sucesso",
        description: "Documento fiscal baixado com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Não foi possível baixar",
        description: error?.response?.data?.message || "Não foi possível baixar o documento fiscal. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin-dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <CreditCard className="h-8 w-8" />
              Minha Licença
            </h1>
            <p className="text-muted-foreground">
              Visualize sua licença atual e gerencie pagamentos
            </p>
          </div>
        </div>

        {/* Licença Atual */}
        {loadingAssinatura ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Carregando informações da licença...</p>
            </CardContent>
          </Card>
        ) : assinatura ? (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Licença Atual</CardTitle>
                  <CardDescription>Informações da sua assinatura</CardDescription>
                </div>
                <Badge variant={assinatura.status === 'ativa' ? 'default' : 'destructive'}>
                  {assinatura.status?.toUpperCase() || 'ATIVA'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label className="text-muted-foreground">Plano</Label>
                  <p className="text-lg font-semibold">{assinatura.plano?.nome || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data de Expiração</Label>
                  <p className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {assinatura.dataFim
                      ? format(new Date(assinatura.dataFim), "dd/MM/yyyy", { locale: ptBR })
                      : "Sem data de expiração"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Próximo Pagamento</Label>
                  <p className="text-lg font-semibold">
                    {assinatura.dataProximoPagamento
                      ? format(new Date(assinatura.dataProximoPagamento), "dd/MM/yyyy", { locale: ptBR })
                      : "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma assinatura encontrada. Entre em contato com o suporte.
            </AlertDescription>
          </Alert>
        )}

        {/* Instruções claras para pagamento */}
        {assinatura && (
          <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Como pagar a licença
              </CardTitle>
              <CardDescription>
                Siga estes passos para renovar ou efetuar o pagamento da sua licença
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li><strong className="text-foreground">Realize a transferência ou depósito</strong> para as coordenadas bancárias (clique em "Novo Pagamento" para ver os dados).</li>
                <li><strong className="text-foreground">Clique em "Novo Pagamento"</strong> e preencha o plano e período.</li>
                <li><strong className="text-foreground">Anexe o comprovativo</strong> (PDF ou imagem) do pagamento efetuado.</li>
                <li><strong className="text-foreground">Informe a referência</strong> ou ID da transação, se tiver.</li>
                <li><strong className="text-foreground">Aguarde a confirmação</strong> — o administrador validará e sua licença será renovada automaticamente.</li>
              </ol>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                ⚠️ Só aceitamos transferência pelo ATM ou Depósito na Conta.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Histórico de Pagamentos */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Histórico de Pagamentos</CardTitle>
                <CardDescription>Visualize todos os seus pagamentos de licença</CardDescription>
              </div>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Pagamento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingPagamentos ? (
              <p className="text-center text-muted-foreground py-8">Carregando pagamentos...</p>
            ) : pagamentos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum pagamento encontrado. Clique em "Novo Pagamento" para criar um.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plano</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Pago em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagamentos.map((pagamento: Pagamento) => (
                      <TableRow key={pagamento.id}>
                        <TableCell className="font-medium">{pagamento.plano}</TableCell>
                        <TableCell>{pagamento.periodo}</TableCell>
                        <TableCell>{formatCurrency(pagamento.valor)}</TableCell>
                        <TableCell>{pagamento.metodo}</TableCell>
                        <TableCell>{getStatusBadge(pagamento.status)}</TableCell>
                        <TableCell>
                          {format(new Date(pagamento.criadoEm), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {pagamento.pagoEm
                            ? format(new Date(pagamento.pagoEm), "dd/MM/yyyy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {pagamento.status === 'PENDING' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setComprovativoPagamentoId(pagamento.id);
                                    setComprovativoFile(null);
                                    setComprovativoDialogOpen(true);
                                  }}
                                  disabled={uploadingComprovativo}
                                >
                                  <Upload className="h-3 w-3 mr-1" />
                                  {pagamento.comprovativoUrl ? "Alterar" : "Enviar"} Comprovativo
                                </Button>
                                {pagamento.comprovativoUrl && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      const url = pagamento.comprovativoUrl!;
                                      try {
                                        const signed = url.includes('/uploads/comprovativos/')
                                          ? await storageApi.getComprovativoSignedUrl(url)
                                          : url;
                                        window.open(signed, '_blank');
                                      } catch {
                                        toast({ title: 'Não foi possível abrir comprovativo', description: 'Não foi possível obter o link seguro. Tente novamente.', variant: 'destructive' });
                                      }
                                    }}
                                  >
                                    <FileText className="h-3 w-3 mr-1" />
                                    Ver
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelarPagamento(pagamento.id)}
                                  disabled={cancelarPagamentoMutation.isPending}
                                >
                                  Cancelar
                                </Button>
                              </>
                            )}
                            {pagamento.status === 'PAID' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadDocumento(pagamento)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Baixar Recibo
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

        {/* Dialog Novo Pagamento */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Novo Pagamento de Licença</DialogTitle>
              <DialogDescription>
                Escolha o método de pagamento e preencha os dados
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Tipo de Pagamento */}
              <div className="space-y-2">
                <Label>Tipo de Pagamento *</Label>
                <Select
                  value={tipoPagamento}
                  onValueChange={(value: 'manual' | 'online') => {
                    setTipoPagamento(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Pagamento Manual</SelectItem>
                    <SelectItem value="online">Pagamento Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plano">Plano *</Label>
                <Select
                  value={formData.plano}
                  onValueChange={(value) => setFormData({ ...formData, plano: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASIC">BASIC</SelectItem>
                    <SelectItem value="PRO">PRO</SelectItem>
                    <SelectItem value="ENTERPRISE">ENTERPRISE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="periodo">Período *</Label>
                <Select
                  value={formData.periodo}
                  onValueChange={(value) => setFormData({ ...formData, periodo: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MENSAL">Mensal</SelectItem>
                    <SelectItem value="SEMESTRAL">Semestral</SelectItem>
                    <SelectItem value="ANUAL">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Campos condicionais baseados no tipo */}
              {tipoPagamento === 'manual' ? (
                <>
                  {coordenadasBancarias && (coordenadasBancarias.banco || coordenadasBancarias.iban || coordenadasBancarias.nib || coordenadasBancarias.titular) && (
                    <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4 space-y-2">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 rounded-md px-3 py-2">
                        ⚠️ {coordenadasBancarias.restricao || 'Só aceitamos transferência pelo ATM ou Depósito na Conta'}
                      </p>
                      <p className="text-sm font-semibold text-green-800 dark:text-green-200 flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Coordenadas Bancárias para Pagamento
                      </p>
                      <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                        {coordenadasBancarias.banco && <p><span className="text-muted-foreground">Banco:</span> {coordenadasBancarias.banco}</p>}
                        {coordenadasBancarias.iban && <p><span className="text-muted-foreground">IBAN:</span> <span className="font-mono">{coordenadasBancarias.iban}</span></p>}
                        {coordenadasBancarias.nib && <p><span className="text-muted-foreground">NIB:</span> <span className="font-mono">{coordenadasBancarias.nib}</span></p>}
                        {coordenadasBancarias.titular && <p><span className="text-muted-foreground">Titular:</span> {coordenadasBancarias.titular}</p>}
                        {coordenadasBancarias.instrucoes && <p className="mt-2 pt-2 border-t border-green-200 dark:border-green-800 text-xs">{coordenadasBancarias.instrucoes}</p>}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="metodo">Método de Pagamento *</Label>
                    <Select
                      value={formData.metodo}
                      onValueChange={(value) => setFormData({ ...formData, metodo: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRANSFERENCIA">Transferência Bancária</SelectItem>
                        <SelectItem value="DEPOSITO">Depósito</SelectItem>
                        <SelectItem value="MULTICAIXA">Multicaixa (Manual)</SelectItem>
                        <SelectItem value="AIRTM">Airtm</SelectItem>
                        <SelectItem value="RODETPAY">RodetPay</SelectItem>
                        <SelectItem value="CASH">Dinheiro</SelectItem>
                        <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="comprovativo">Comprovativo de Pagamento (recomendado)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="comprovativo"
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={(e) => setComprovativoFile(e.target.files?.[0] || null)}
                        className="max-w-xs"
                      />
                      {comprovativoFile && (
                        <span className="text-sm text-muted-foreground truncate max-w-[120px]">{comprovativoFile.name}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">PDF, JPG ou PNG. Máx. 10MB.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="referencia">Referência / ID da Transação (opcional)</Label>
                    <Input
                      id="referencia"
                      value={formData.referencia}
                      onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
                      placeholder="Número de referência do pagamento ou ID da transação"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações (opcional)</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      placeholder="Observações adicionais sobre o pagamento"
                      rows={3}
                    />
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Após realizar o pagamento, anexe o comprovativo e informe a referência.
                      O administrador confirmará e sua licença será renovada automaticamente.
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <>
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Pagamento Automático (Cartão / Online)</strong>
                      <br />
                      Este método estará disponível em breve.
                      <br />
                      Por favor, utilize os métodos de pagamento manual disponíveis acima.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2 opacity-50 pointer-events-none">
                    <Label htmlFor="gateway">Gateway de Pagamento *</Label>
                    <Select
                      value={formData.gateway}
                      onValueChange={(value: 'STRIPE' | 'PAYPAL' | 'TAZAPAY') => setFormData({ ...formData, gateway: value })}
                      disabled
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STRIPE">Stripe</SelectItem>
                        <SelectItem value="PAYPAL">PayPal</SelectItem>
                        <SelectItem value="TAZAPAY">Tazapay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCriarPagamento}
                disabled={
                  (tipoPagamento === 'manual' ? criarPagamentoMutation.isPending : true) ||
                  !formData.plano ||
                  !formData.periodo ||
                  tipoPagamento === 'online' // Sempre desabilitado para online
                }
              >
                {tipoPagamento === 'manual'
                  ? criarPagamentoMutation.isPending
                    ? "Criando..."
                    : "Criar Pagamento"
                  : "Indisponível"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Enviar Comprovativo (para pagamentos PENDING existentes) */}
        <Dialog open={comprovativoDialogOpen} onOpenChange={setComprovativoDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Enviar Comprovativo de Pagamento</DialogTitle>
              <DialogDescription>
                Anexe o comprovativo da transferência ou depósito para agilizar a confirmação.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="comprovativo-existente">Comprovativo (PDF, JPG ou PNG)</Label>
                <Input
                  id="comprovativo-existente"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => setComprovativoFile(e.target.files?.[0] || null)}
                />
                {comprovativoFile && (
                  <p className="text-sm text-muted-foreground">{comprovativoFile.name}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setComprovativoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!comprovativoPagamentoId || !comprovativoFile) {
                    toast({
                      title: "Selecione um ficheiro",
                      variant: "destructive",
                    });
                    return;
                  }
                  setUploadingComprovativo(true);
                  try {
                    const fileExt = comprovativoFile.name.split('.').pop();
                    const fileName = `licenca/${instituicaoId || 'inst'}/${Date.now()}.${fileExt}`;
                    const uploadResult = await storageApi.upload('comprovativos', fileName, comprovativoFile);
                    await pagamentoLicencaApi.enviarComprovativo(comprovativoPagamentoId, uploadResult.url);
                    queryClient.invalidateQueries({ queryKey: ["pagamentos-licenca"] });
                    toast({ title: "Comprovativo enviado com sucesso!" });
                    setComprovativoDialogOpen(false);
                    setComprovativoFile(null);
                    setComprovativoPagamentoId(null);
                  } catch (err: any) {
                    toast({
                      title: "Não foi possível enviar comprovativo",
                      description: err?.response?.data?.message || "Tente novamente.",
                      variant: "destructive",
                    });
                  } finally {
                    setUploadingComprovativo(false);
                  }
                }}
                disabled={!comprovativoFile || uploadingComprovativo}
              >
                {uploadingComprovativo ? "Enviando..." : "Enviar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmacaoResponsabilidadeDialog
          open={criticoCancelarPagamentoId !== null}
          onOpenChange={(open) => {
            if (!open) setCriticoCancelarPagamentoId(null);
          }}
          title="Cancelar pedido de pagamento de licença"
          description="O registo pendente deixará de aguardar confirmação manual. Não afecta pagamentos já marcados como pagos."
          avisoInstitucional="O cancelamento deve estar alinhado com a tesouraria e com a política de assinaturas; reabertura de linhas de pagamento ou condonações especiais só com autorização registada da administração ou superintendência financeira."
          pontosAtencao={[
            "Se já enviou comprovativo, confirme com o financeiro antes de cancelar.",
            "Pode ser necessário criar um novo pedido após o cancelamento.",
          ]}
          confirmLabel="Cancelar pagamento"
          confirmVariant="destructive"
          checkboxLabel="Confirmo que o cancelamento é deliberate e autorizado."
          isLoading={cancelarPagamentoMutation.isPending}
          onConfirm={() => {
            if (criticoCancelarPagamentoId) cancelarPagamentoMutation.mutate(criticoCancelarPagamentoId);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
