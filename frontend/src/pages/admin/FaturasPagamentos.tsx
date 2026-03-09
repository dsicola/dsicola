import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { format, differenceInDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { 
  CreditCard, 
  Calendar, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Upload,
  FileText,
  Phone,
  Mail,
  Building,
  Timer,
  AlertTriangle,
  Eye,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { ExportButtons } from '@/components/common/ExportButtons';
import { assinaturasApi, pagamentosInstituicaoApi, storageApi, configuracoesLandingApi, API_URL } from '@/services/api';

interface Assinatura {
  id: string;
  status: string;
  data_inicio: string;
  data_proximo_pagamento: string | null;
  valor_atual: number;
  iban: string | null;
  multicaixa_numero: string | null;
  instrucoes_pagamento: string | null;
  dias_carencia_analise: number;
  tipo_periodo: string;
  plano: { nome: string; preco_mensal: number } | null;
}

const PERIODO_LABELS: Record<string, string> = {
  mensal: 'Mensal',
  bimestral: 'Bimestral (2 meses)',
  trimestral: 'Trimestral (3 meses)',
  semestral: 'Semestral (6 meses)',
  anual: 'Anual (12 meses)',
};

/** Contagem de dias por período (alinhada ao backend: dataFim e exibição corretas) */
const PERIODO_DIAS: Record<string, number> = {
  mensal: 30,
  bimestral: 60,
  trimestral: 90,
  semestral: 180,
  anual: 365,
};

interface Pagamento {
  id: string;
  valor: number;
  data_pagamento: string | null;
  data_vencimento: string;
  forma_pagamento: string;
  status: string;
  comprovativo_texto: string | null;
  comprovativo_url: string | null;
  telefone_contato: string | null;
  observacoes: string | null;
  created_at: string;
}

export default function FaturasPagamentos() {
  const { t } = useTranslation();
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [comprovativoTexto, setComprovativoTexto] = useState('');
  const [telefoneContato, setTelefoneContato] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [viewProofDialogOpen, setViewProofDialogOpen] = useSafeDialog(false);
  const [selectedPagamento, setSelectedPagamento] = useState<Pagamento | null>(null);
  const [signedComprovativoUrl, setSignedComprovativoUrl] = useState<string | null>(null);
  const { toast } = useToast();

  // Obter URL assinada ao abrir comprovativo (evita TOKEN_MISSING em nova aba)
  useEffect(() => {
    if (!viewProofDialogOpen || !selectedPagamento?.comprovativo_url) {
      setSignedComprovativoUrl(null);
      return;
    }
    const rawUrl = selectedPagamento.comprovativo_url.startsWith('/')
      ? `${(API_URL || '').replace(/\/$/, '')}${selectedPagamento.comprovativo_url}`
      : selectedPagamento.comprovativo_url;
    if (!rawUrl.includes('/uploads/comprovativos/')) {
      setSignedComprovativoUrl(rawUrl);
      return;
    }
    storageApi.getComprovativoSignedUrl(rawUrl)
      .then(setSignedComprovativoUrl)
      .catch(() => setSignedComprovativoUrl(rawUrl));
  }, [viewProofDialogOpen, selectedPagamento?.comprovativo_url, API_URL]);

  // Coordenadas bancárias globais (fallback quando assinatura não tem)
  const { data: coordenadasGlobais } = useQuery({
    queryKey: ['coordenadas-bancarias'],
    queryFn: () => configuracoesLandingApi.getCoordenadasBancarias(),
  });
  const { user } = useAuth();
  const { instituicao } = useInstituicao();

  // Normaliza resposta da API (camelCase) para o formato esperado pelo componente (snake_case)
  const normalizePagamento = (raw: any): Pagamento => ({
    id: raw.id,
    valor: Number(raw.valor ?? 0),
    data_pagamento: raw.dataPagamento ?? raw.data_pagamento ?? null,
    data_vencimento: raw.dataVencimento ?? raw.data_vencimento ?? '-',
    forma_pagamento: raw.formaPagamento ?? raw.forma_pagamento ?? '-',
    status: raw.status ?? 'pendente',
    comprovativo_texto: raw.comprovativoTexto ?? raw.comprovativo_texto ?? null,
    comprovativo_url: raw.comprovativoUrl ?? raw.comprovativo_url ?? null,
    telefone_contato: raw.telefoneContato ?? raw.telefone_contato ?? null,
    observacoes: raw.observacoes ?? null,
    created_at: raw.createdAt ?? raw.created_at ?? '',
  });

  const normalizeAssinatura = (raw: any): Assinatura | null => {
    if (!raw) return null;
    return {
      id: raw.id,
      status: raw.status,
      data_inicio: raw.data_inicio ?? raw.dataInicio,
      data_proximo_pagamento: raw.data_proximo_pagamento ?? raw.dataProximoPagamento,
      valor_atual: raw.valor_atual ?? raw.valorAtual ?? 0,
      iban: raw.iban,
      multicaixa_numero: raw.multicaixa_numero ?? raw.multicaixaNumero,
      instrucoes_pagamento: raw.instrucoes_pagamento ?? raw.instrucoesPagamento,
      dias_carencia_analise: raw.dias_carencia_analise ?? raw.diasCarenciaAnalise ?? 0,
      tipo_periodo: raw.tipo_periodo ?? raw.tipoPeriodo ?? 'mensal',
      plano: raw.plano,
    };
  };

  const fetchData = async () => {
    try {
      // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
      // O backend usa req.user.instituicaoId do JWT token automaticamente
      const assinaturaData = await assinaturasApi.getByInstituicao();
      setAssinatura(normalizeAssinatura(assinaturaData));

      const pagamentosData = await pagamentosInstituicaoApi.getByInstituicao();
      setPagamentos((pagamentosData || []).map((p: any) => normalizePagamento(p)));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.instituicao_id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast({ title: 'Formato não suportado. Use PDF, JPG, PNG ou DOCX.', variant: 'destructive' });
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({ title: 'Arquivo muito grande. Máximo 10MB.', variant: 'destructive' });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleEnviarComprovativo = async () => {
    if (!user?.instituicao_id || !assinatura) {
      toast({ title: 'Erro: Dados não disponíveis', variant: 'destructive' });
      return;
    }

    if (!file && !comprovativoTexto.trim()) {
      toast({ title: 'Por favor, anexe um arquivo ou preencha os detalhes do comprovativo', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    try {
      let comprovativoUrl: string | null = null;

      if (file) {
        setUploadProgress(20);
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.instituicao_id}/${Date.now()}.${fileExt}`;
        
        const uploadResult = await storageApi.upload('comprovativos', fileName, file);
        comprovativoUrl = uploadResult.url;
        setUploadProgress(60);
      }

      setUploadProgress(80);

      const valor = assinatura.valor_atual != null ? Number(assinatura.valor_atual) : undefined;
      if (valor == null || Number.isNaN(valor)) {
        toast({ title: 'Não foi possível obter o valor da assinatura. Tente recarregar a página.', variant: 'destructive' });
        return;
      }

      const dataVencimento = assinatura.data_proximo_pagamento
        ? (typeof assinatura.data_proximo_pagamento === 'string'
            ? assinatura.data_proximo_pagamento
            : new Date(assinatura.data_proximo_pagamento).toISOString().split('T')[0])
        : new Date().toISOString().split('T')[0];

      await pagamentosInstituicaoApi.create({
        instituicao_id: user.instituicao_id,
        assinatura_id: assinatura.id,
        valor,
        data_vencimento: dataVencimento,
        forma_pagamento: 'Multicaixa Express / IBAN',
        status: 'Pendente',
        comprovativo_texto: comprovativoTexto || null,
        comprovativo_url: comprovativoUrl,
        telefone_contato: telefoneContato || null,
        observacoes: observacoes || null,
      });

      setUploadProgress(90);

      await assinaturasApi.update(assinatura.id, { status: 'em_analise' });

      setUploadProgress(100);

      toast({ title: 'Comprovativo enviado com sucesso! Aguarde a análise.' });
      setDialogOpen(false);
      setComprovativoTexto('');
      setTelefoneContato('');
      setObservacoes('');
      setFile(null);
      fetchData();
    } catch (error: any) {
      console.error('Error:', error);
      const msg = error?.response?.data?.message || error?.message || 'Erro ao enviar comprovativo';
      toast({ title: 'Erro ao enviar comprovativo', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) return '-';
    return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return format(new Date(date), 'dd/MM/yyyy', { locale: pt });
  };

  const getDaysRemaining = () => {
    if (!assinatura?.data_proximo_pagamento) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(assinatura.data_proximo_pagamento);
    dueDate.setHours(0, 0, 0, 0);
    return differenceInDays(dueDate, today);
  };

  const getTotalPeriodDays = () => {
    if (!assinatura?.tipo_periodo) return 30;
    return PERIODO_DIAS[assinatura.tipo_periodo] || 30;
  };

  const daysRemaining = getDaysRemaining();
  const totalPeriodDays = getTotalPeriodDays();
  const daysUsed = totalPeriodDays - (daysRemaining || 0);
  const progressPercentage = totalPeriodDays > 0 ? Math.min(100, Math.max(0, (daysUsed / totalPeriodDays) * 100)) : 0;
  const isExpired = daysRemaining !== null && daysRemaining < 0;
  const isWarning = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 5;
  const isInAnalysis = assinatura?.status === 'em_analise';

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'ativa':
        return { label: 'Ativa', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle className="h-4 w-4" /> };
      case 'em_analise':
        return { label: 'Em Análise', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <Clock className="h-4 w-4" /> };
      case 'suspensa':
        return { label: 'Suspensa', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <AlertCircle className="h-4 w-4" /> };
      case 'cancelada':
        return { label: 'Cancelada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <AlertCircle className="h-4 w-4" /> };
      case 'trial':
        return { label: 'Trial', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: <Clock className="h-4 w-4" /> };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', icon: <Clock className="h-4 w-4" /> };
    }
  };

  const getPaymentStatusConfig = (status: string) => {
    switch (status) {
      case 'Pago':
        return { label: 'Pago', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
      case 'Pendente':
        return { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' };
      case 'Em Análise':
        return { label: 'Em Análise', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400' };
    }
  };

  const hasPendingPayment = pagamentos.some(p => p.status === 'Pendente');

  const exportColunas = ['Data', 'Valor', 'Forma de Pagamento', 'Status', 'Vencimento', 'Data Pagamento'];
  const exportDados = pagamentos.map(p => [
    formatDate(p.created_at),
    formatCurrency(p.valor),
    p.forma_pagamento,
    p.status,
    formatDate(p.data_vencimento),
    formatDate(p.data_pagamento),
  ]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t('pages.minhaAssinatura')}</h1>
            <p className="text-muted-foreground">{t('pages.minhaAssinaturaDesc')}</p>
          </div>
        </div>

        {/* Countdown Card */}
        {assinatura && (
          <Card className={`${isExpired ? 'border-destructive bg-destructive/5' : isWarning ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10' : isInAnalysis ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-green-500 bg-green-50 dark:bg-green-900/10'}`}>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${isExpired ? 'bg-destructive/20' : isWarning ? 'bg-yellow-200 dark:bg-yellow-900/30' : isInAnalysis ? 'bg-blue-200 dark:bg-blue-900/30' : 'bg-green-200 dark:bg-green-900/30'}`}>
                      <Timer className={`h-8 w-8 ${isExpired ? 'text-destructive' : isWarning ? 'text-yellow-600 dark:text-yellow-400' : isInAnalysis ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`} />
                    </div>
                    <div>
                      {isInAnalysis ? (
                        <>
                          <h3 className="text-xl font-bold text-blue-700 dark:text-blue-400">🕓 Pagamento em Análise</h3>
                          <p className="text-blue-600 dark:text-blue-300">
                            Seu comprovativo está sendo analisado. Você pode continuar usando o sistema por até {assinatura.dias_carencia_analise || 3} dias.
                          </p>
                        </>
                      ) : isExpired ? (
                        <>
                          <h3 className="text-xl font-bold text-destructive">⚠️ Assinatura Expirada</h3>
                          <p className="text-destructive/80">
                            Sua assinatura venceu há {Math.abs(daysRemaining!)} dia(s). Aguardando renovação.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <h3 className={`text-xl font-bold ${isWarning ? 'text-yellow-700 dark:text-yellow-400' : 'text-green-700 dark:text-green-400'}`}>
                              {isWarning ? '⚠️' : '✅'} Dias Restantes: {daysRemaining} de {totalPeriodDays}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              {PERIODO_LABELS[assinatura.tipo_periodo] || 'Mensal'}
                            </Badge>
                          </div>
                          <p className={isWarning ? 'text-yellow-600 dark:text-yellow-300' : 'text-green-600 dark:text-green-300'}>
                            {isWarning 
                              ? `Atenção! Restam apenas ${daysRemaining} dia(s) para o vencimento.`
                              : `Vence em ${formatDate(assinatura.data_proximo_pagamento)} • ${daysUsed} dia(s) usado(s)`
                            }
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {!isInAnalysis && !isExpired && daysRemaining !== null && (
                  <div className="space-y-2">
                    <Progress 
                      value={progressPercentage} 
                      className={`h-2 ${isWarning ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Início: {formatDate(assinatura.data_inicio)}</span>
                      <span>Vencimento: {formatDate(assinatura.data_proximo_pagamento)}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {!hasPendingPayment && !isInAnalysis && assinatura && (
                <div className="flex justify-end mt-4">
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant={isExpired ? "destructive" : "default"}>
                        <Upload className="h-4 w-4 mr-2" />
                        Enviar Comprovativo
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Enviar Comprovativo de Pagamento</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Arquivo do Comprovativo</Label>
                          <Input type="file" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png,.docx" />
                          {file && <p className="text-sm text-muted-foreground">{file.name}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Detalhes do Comprovativo</Label>
                          <Textarea 
                            value={comprovativoTexto}
                            onChange={(e) => setComprovativoTexto(e.target.value)}
                            placeholder="Ex: Transferência realizada em 15/01/2024 às 14:30..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Telefone de Contato</Label>
                          <Input 
                            value={telefoneContato}
                            onChange={(e) => setTelefoneContato(e.target.value)}
                            placeholder="+244 9XX XXX XXX"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Observações</Label>
                          <Textarea 
                            value={observacoes}
                            onChange={(e) => setObservacoes(e.target.value)}
                            placeholder="Observações adicionais..."
                          />
                        </div>
                        {uploadProgress > 0 && (
                          <Progress value={uploadProgress} className="h-2" />
                        )}
                        <Button 
                          onClick={handleEnviarComprovativo} 
                          disabled={submitting}
                          className="w-full"
                        >
                          {submitting ? 'Enviando...' : 'Enviar Comprovativo'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Subscription Status Card */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Status da Assinatura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {assinatura ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Plano:</span>
                    <Badge variant="outline" className="text-lg">
                      {assinatura.plano?.nome || 'N/A'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    {(() => {
                      const statusConfig = getStatusConfig(assinatura.status);
                      return (
                        <Badge className={statusConfig.color}>
                          <span className="flex items-center gap-1">
                            {statusConfig.icon}
                            {statusConfig.label}
                          </span>
                        </Badge>
                      );
                    })()}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-bold text-lg">{formatCurrency(assinatura.valor_atual)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Período:</span>
                    <span>{PERIODO_LABELS[assinatura.tipo_periodo] || assinatura.tipo_periodo}</span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Nenhuma assinatura encontrada</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Dados de Pagamento
              </CardTitle>
              <CardDescription>Coordenadas bancárias para transferência ou depósito</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const banco = coordenadasGlobais?.banco;
                const iban = assinatura?.iban ?? coordenadasGlobais?.iban;
                const nib = coordenadasGlobais?.nib;
                const titular = coordenadasGlobais?.titular;
                const multicaixa = assinatura?.multicaixa_numero;
                const instrucoes = assinatura?.instrucoes_pagamento ?? coordenadasGlobais?.instrucoes;
                const restricao = coordenadasGlobais?.restricao;
                const temAlgum = banco || iban || nib || titular || multicaixa || instrucoes;
                if (!temAlgum) {
                  return (
                    <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        As coordenadas bancárias ainda não foram configuradas.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        O Super-admin pode configurá-las na aba Landing ou ao criar/editar a assinatura.
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    {restricao && (
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-md px-3 py-2">
                        ⚠️ {restricao}
                      </p>
                    )}
                    <div className="grid gap-3 text-sm">
                      {banco && <div><span className="text-muted-foreground">Banco:</span> <span className="font-medium">{banco}</span></div>}
                      {iban && <div><span className="text-muted-foreground">IBAN:</span> <span className="font-mono">{iban}</span></div>}
                      {nib && <div><span className="text-muted-foreground">NIB:</span> <span className="font-mono">{nib}</span></div>}
                      {titular && <div><span className="text-muted-foreground">Titular:</span> {titular}</div>}
                      {multicaixa && <div><span className="text-muted-foreground">Multicaixa Express:</span> <span className="font-mono">{multicaixa}</span></div>}
                      {instrucoes && <div className="pt-2 border-t"><span className="text-muted-foreground">Instruções:</span> <p className="mt-1 text-muted-foreground">{instrucoes}</p></div>}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Payment History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Histórico de Pagamentos
              </CardTitle>
              <CardDescription>Seus comprovantes enviados e status</CardDescription>
            </div>
            <ExportButtons
              titulo="Histórico de Pagamentos"
              colunas={exportColunas}
              dados={exportDados}
            />
          </CardHeader>
          <CardContent>
            {pagamentos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground space-y-4">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum pagamento registrado</p>
                {assinatura && !hasPendingPayment && !isInAnalysis && (
                  <Button variant="outline" onClick={() => setDialogOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar Comprovativo
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Forma de Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead className="w-[80px]">Comprovativo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagamentos.map((pagamento) => {
                    const statusConfig = getPaymentStatusConfig(pagamento.status);
                    const temComprovativo = !!(pagamento.comprovativo_url || pagamento.comprovativo_texto);
                    return (
                      <TableRow key={pagamento.id}>
                        <TableCell>{formatDate(pagamento.created_at)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(pagamento.valor)}</TableCell>
                        <TableCell>{pagamento.forma_pagamento}</TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(pagamento.data_vencimento)}</TableCell>
                        <TableCell>{formatDate(pagamento.data_pagamento)}</TableCell>
                        <TableCell>
                          {temComprovativo ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => {
                                setSelectedPagamento(pagamento);
                                setViewProofDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog Ver Comprovativo */}
        <Dialog open={viewProofDialogOpen} onOpenChange={setViewProofDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Comprovativo de Pagamento</DialogTitle>
            </DialogHeader>
            {selectedPagamento && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Valor</Label>
                    <p className="font-medium">{formatCurrency(selectedPagamento.valor)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Forma Pagamento</Label>
                    <p className="font-medium">{selectedPagamento.forma_pagamento}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <p className="font-medium">{selectedPagamento.status}</p>
                  </div>
                  {selectedPagamento.telefone_contato && (
                    <div>
                      <Label className="text-muted-foreground">Telefone</Label>
                      <p className="font-medium">{selectedPagamento.telefone_contato}</p>
                    </div>
                  )}
                </div>
                {selectedPagamento.comprovativo_texto && (
                  <div>
                    <Label className="text-muted-foreground">Descrição</Label>
                    <p className="mt-1 p-3 bg-muted rounded-md text-sm">{selectedPagamento.comprovativo_texto}</p>
                  </div>
                )}
                {selectedPagamento.comprovativo_url && (
                  <div>
                    <Label className="text-muted-foreground">Comprovativo</Label>
                    {signedComprovativoUrl ? (
                      <a
                        href={signedComprovativoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-2"
                      >
                        {selectedPagamento.comprovativo_url.match(/\.(pdf|docx)$/i) ? (
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Abrir ficheiro
                          </Button>
                        ) : (
                          <img
                            src={signedComprovativoUrl}
                            alt="Comprovativo"
                            className="max-h-64 rounded-md border object-contain"
                          />
                        )}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2">A carregar...</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
