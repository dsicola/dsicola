import { useState, useEffect } from 'react';
import { assinaturasApi, instituicoesApi, planosApi, planosPrecosApi, pagamentosInstituicaoApi } from '@/services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SmartSearch, type SmartSearchItem } from '@/components/common/SmartSearch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  Edit, 
  Building, 
  CreditCard, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Send,
  Eye,
  RefreshCw,
  Search
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';

/** Opções de período de assinatura (alinhadas ao backend: mesma contagem de dias) */
const PERIODO_OPCOES = [
  { value: 'mensal', label: 'Mensal (30 dias)', dias: 30 },
  { value: 'bimestral', label: 'Bimestral (2 meses / 60 dias)', dias: 60 },
  { value: 'trimestral', label: 'Trimestral (3 meses / 90 dias)', dias: 90 },
  { value: 'semestral', label: 'Semestral (6 meses / 180 dias)', dias: 180 },
  { value: 'anual', label: 'Anual (12 meses / 365 dias)', dias: 365 },
] as const;

interface Assinatura {
  id: string;
  instituicao_id: string;
  plano_id: string;
  tipo?: string; // 'DEMO' ou 'PAGA'
  tipo_periodo?: string; // mensal | bimestral | trimestral | semestral | anual (contagem de dias)
  tipoPeriodo?: string;
  status: string;
  data_inicio: string;
  data_fim: string | null;
  data_proximo_pagamento: string | null;
  valor_atual: number;
  observacoes: string | null;
  iban: string | null;
  multicaixa_numero: string | null;
  instrucoes_pagamento: string | null;
  dias_carencia_analise: number;
  instituicao?: { id: string; nome: string; subdominio: string; email_contato: string | null };
  plano?: { id: string; nome: string; preco_mensal: number };
}

interface Instituicao {
  id: string;
  nome: string;
  subdominio: string;
  email_contato?: string | null;
  emailContato?: string | null;
  tipoAcademico?: 'SECUNDARIO' | 'SUPERIOR' | null;
  tipo_academico?: 'SECUNDARIO' | 'SUPERIOR' | null; // backwards compat
}

interface Plano {
  id: string;
  nome: string;
  preco_mensal: number;
}

interface Pagamento {
  id: string;
  instituicao_id: string;
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
  data_analise: string | null;
  analisado_por: string | null;
  instituicao?: { nome: string };
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ativa: { label: 'Ativa', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle className="h-4 w-4" /> },
  em_analise: { label: 'Em Análise', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <Clock className="h-4 w-4" /> },
  trial: { label: 'Trial', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: <Clock className="h-4 w-4" /> },
  suspensa: { label: 'Suspensa', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <AlertCircle className="h-4 w-4" /> },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-4 w-4" /> },
  expirada: { label: 'Expirada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-4 w-4" /> },
};

export function AssinaturasTab() {
  const queryClient = useQueryClient();
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [pagamentosPendentes, setPagamentosPendentes] = useState<Pagamento[]>([]);
  const [todosPagamentos, setTodosPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useSafeDialog(false);
  const [viewProofDialogOpen, setViewProofDialogOpen] = useSafeDialog(false);
  const [editingAssinatura, setEditingAssinatura] = useState<Assinatura | null>(null);
  const [selectedPagamento, setSelectedPagamento] = useState<Pagamento | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Filters
  const [filtroStatus, setFiltroStatus] = useState<string>('all');
  const [filtroInstituicao, setFiltroInstituicao] = useState<string>('');
  const [filtroBuscaAssinaturas, setFiltroBuscaAssinaturas] = useState<string>('');
  const [filtroStatusAssinatura, setFiltroStatusAssinatura] = useState<string>('all');

  // Calculate expiring subscriptions (within 5 days)
  const assinaturasExpirando = assinaturas.filter(a => {
    if (a.status !== 'ativa' || !a.data_proximo_pagamento) return false;
    const diasRestantes = differenceInDays(new Date(a.data_proximo_pagamento), new Date());
    return diasRestantes >= 0 && diasRestantes <= 5;
  });

  const getDiasRestantes = (dataProximoPagamento: string | null): number | null => {
    if (!dataProximoPagamento) return null;
    return differenceInDays(new Date(dataProximoPagamento), new Date());
  };

  const [formData, setFormData] = useState({
    instituicao_id: '',
    plano_id: '',
    tipo: 'PAGA', // 'DEMO' ou 'PAGA'
    tipo_periodo: 'mensal' as string, // mensal | bimestral | trimestral | semestral | anual
    duracaoDias: '30', // Para DEMO: 30 ou 60 dias
    status: 'ativa',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: '',
    data_proximo_pagamento: '',
    valor_atual: '',
    observacoes: '',
    iban: '',
    multicaixa_numero: '',
    instrucoes_pagamento: '',
    dias_carencia_analise: '3',
  });

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [justificativaOverride, setJustificativaOverride] = useState('');
  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN');

  // Buscar tipo acadêmico da instituição selecionada (API retorna camelCase: tipoAcademico)
  const instituicaoSelecionada = instituicoes.find(i => i.id === formData.instituicao_id);
  const tipoAcademico = instituicaoSelecionada?.tipoAcademico ?? instituicaoSelecionada?.tipo_academico;
  const planoSelecionado = planos.find(p => p.id === formData.plano_id);
  
  // Buscar preço automático quando instituição e plano forem selecionados
  const { data: precoAutomatico, isLoading: loadingPreco } = useQuery({
    queryKey: ['preco-automatico', formData.plano_id, tipoAcademico],
    queryFn: async () => {
      if (!formData.plano_id || !tipoAcademico || formData.tipo === 'DEMO') {
        return null;
      }
      try {
        return await planosPrecosApi.getPreco({
          planoId: formData.plano_id,
          tipoInstituicao: tipoAcademico,
        });
      } catch {
        return null;
      }
    },
    enabled: !!formData.plano_id && !!tipoAcademico && formData.tipo !== 'DEMO',
  });

  // Atualizar valor_atual automaticamente quando preço for encontrado
  useEffect(() => {
    const valorBaseAutomatico =
      precoAutomatico?.valorMensal ??
      planoSelecionado?.preco_mensal;

    // Em criação de nova assinatura, preencher automaticamente com o valor do plano
    // (ou preço configurado por tipo de instituição), mas sem sobrescrever edições manuais
    // nem valores existentes em assinaturas já criadas.
    if (!editingAssinatura && valorBaseAutomatico != null && !isEditingPrice && formData.tipo !== 'DEMO') {
      setFormData(prev => ({
        ...prev,
        valor_atual: valorBaseAutomatico.toString(),
      }));
    }
  }, [precoAutomatico, planoSelecionado, isEditingPrice, formData.tipo, editingAssinatura]);

  // Resetar override quando mudar tipo, plano ou instituição
  useEffect(() => {
    setIsEditingPrice(false);
    setJustificativaOverride('');
  }, [formData.tipo, formData.plano_id, formData.instituicao_id]);

  const [paymentConfirmData, setPaymentConfirmData] = useState({
    data_pagamento: format(new Date(), 'yyyy-MM-dd'),
    nova_data_vencimento: '',
    observacoes: '',
  });

  const normalizePagamento = (raw: any): Pagamento => ({
    id: raw.id,
    instituicao_id: raw.instituicaoId ?? raw.instituicao_id,
    valor: Number(raw.valor ?? 0),
    data_pagamento: raw.dataPagamento ?? raw.data_pagamento ? String(raw.dataPagamento ?? raw.data_pagamento) : null,
    data_vencimento: raw.dataVencimento ?? raw.data_vencimento ? String(raw.dataVencimento ?? raw.data_vencimento) : '-',
    forma_pagamento: raw.formaPagamento ?? raw.forma_pagamento ?? '-',
    status: raw.status ?? 'pendente',
    comprovativo_texto: raw.comprovativoTexto ?? raw.comprovativo_texto ?? null,
    comprovativo_url: raw.comprovativoUrl ?? raw.comprovativo_url ?? null,
    telefone_contato: raw.telefoneContato ?? raw.telefone_contato ?? null,
    observacoes: raw.observacoes ?? null,
    created_at: raw.createdAt ?? raw.created_at ?? '',
    data_analise: raw.dataPagamento ?? raw.data_pagamento ?? null,
    analisado_por: null,
    instituicao: raw.instituicao ? { nome: raw.instituicao.nome } : undefined,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assinaturasData, instituicoesData, planosData, pagamentosData] = await Promise.all([
        assinaturasApi.getAll(),
        instituicoesApi.getAll(),
        planosApi.getAll({ ativo: true }),
        pagamentosInstituicaoApi.getAll(),
      ]);

      setAssinaturas(assinaturasData || []);
      setInstituicoes(instituicoesData || []);
      setPlanos(planosData || []);
      const pagamentos = (pagamentosData || []).map(normalizePagamento);
      setTodosPagamentos(pagamentos);
      setPagamentosPendentes(pagamentos.filter(p => /pendente/i.test(String(p.status ?? ''))));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cleanup é gerenciado automaticamente pelo useSafeDialog

  const handleOpenDialog = (assinatura?: Assinatura) => {
    if (assinatura) {
      setEditingAssinatura(assinatura);
      // Calcular duração se for DEMO
      let duracaoDias = '30';
      if ((assinatura as any).tipo === 'DEMO' && assinatura.data_fim && assinatura.data_inicio) {
        const inicio = new Date(assinatura.data_inicio);
        const fim = new Date(assinatura.data_fim);
        const dias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        if (dias === 30 || dias === 60) {
          duracaoDias = String(dias);
        }
      }
      
      const tipoPeriodo = (assinatura as any).tipo_periodo ?? (assinatura as any).tipoPeriodo ?? 'mensal';
      setFormData({
        instituicao_id: assinatura.instituicao_id,
        plano_id: assinatura.plano_id,
        tipo: (assinatura as any).tipo || 'PAGA',
        tipo_periodo: tipoPeriodo,
        duracaoDias,
        status: assinatura.status,
        data_inicio: assinatura.data_inicio,
        data_fim: assinatura.data_fim || '',
        data_proximo_pagamento: assinatura.data_proximo_pagamento || '',
        valor_atual: String(assinatura.valor_atual),
        observacoes: assinatura.observacoes || '',
        iban: assinatura.iban || '',
        multicaixa_numero: assinatura.multicaixa_numero || '',
        instrucoes_pagamento: assinatura.instrucoes_pagamento || '',
        dias_carencia_analise: String(assinatura.dias_carencia_analise || 3),
      });
    } else {
      const today = new Date();
      const nextPaymentDate = addDays(today, 30);
      const dataFimMensal = format(addDays(today, 30), 'yyyy-MM-dd');
      
      setEditingAssinatura(null);
      setFormData({
        instituicao_id: '',
        plano_id: '',
        tipo: 'PAGA',
        tipo_periodo: 'mensal',
        duracaoDias: '30',
        status: 'ativa',
        data_inicio: format(today, 'yyyy-MM-dd'),
        data_fim: dataFimMensal,
        data_proximo_pagamento: format(nextPaymentDate, 'yyyy-MM-dd'),
        valor_atual: '',
        observacoes: '',
        iban: '',
        multicaixa_numero: '',
        instrucoes_pagamento: '',
        dias_carencia_analise: '3',
      });
    }
    setDialogOpen(true);
  };

  const handlePlanoChange = (planoId: string) => {
    const plano = planos.find(p => p.id === planoId);
    setFormData(prev => ({
      ...prev,
      plano_id: planoId,
      valor_atual: plano ? String(plano.preco_mensal) : prev.valor_atual,
    }));
  };

  const normalizeSearch = (s: string) =>
    s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

  const searchInstituicoes = async (term: string): Promise<SmartSearchItem[]> => {
    const list = editingAssinatura ? instituicoes : instituicoesSemAssinatura;
    const n = normalizeSearch(term);
    const filtered = !n ? list : list.filter(
      inst => normalizeSearch(inst.nome).includes(n) || normalizeSearch(inst.subdominio).includes(n)
    );
    return filtered.map(inst => ({ id: inst.id, nome: inst.nome, complemento: inst.subdominio }));
  };

  const searchPlanos = async (term: string): Promise<SmartSearchItem[]> => {
    const n = normalizeSearch(term);
    const filtered = !n ? planos : planos.filter(
      p => normalizeSearch(p.nome).includes(n) || normalizeSearch(String(p.preco_mensal)).includes(n)
    );
    return filtered.map(p => ({ id: p.id, nome: p.nome, complemento: `${formatCurrency(p.preco_mensal)}/mês` }));
  };

  // Create/Update mutation - protegida contra unmount
  const saveAssinaturaMutation = useSafeMutation({
    mutationFn: async (payload: { isEdit: boolean; id?: string; data: any }) => {
      if (payload.isEdit && payload.id) {
        return await assinaturasApi.update(payload.id, payload.data);
      } else {
        return await assinaturasApi.create(payload.data);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assinaturas'] });
      const tipoMensagem = variables.data.tipo === 'DEMO' 
        ? `Assinatura DEMO de ${variables.data.duracaoDias} dias ${variables.isEdit ? 'atualizada' : 'criada'} com sucesso!${!variables.isEdit ? ' A instituição já pode acessar o sistema.' : ''}`
        : `Assinatura ${variables.isEdit ? 'atualizada' : 'criada'} com sucesso!`;
      toast({ 
        title: variables.isEdit ? 'Sucesso!' : 'Assinatura criada!', 
        description: tipoMensagem 
      });
      setDialogOpen(false);
      fetchData();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Erro desconhecido';
      
      if (errorMessage.includes('já possui')) {
        toast({ 
          title: 'Erro ao criar assinatura', 
          description: 'Esta instituição já possui uma assinatura. Use a opção "Editar" para modificar.',
          variant: 'destructive' 
        });
      } else if (errorMessage.includes('Duração do DEMO')) {
        toast({ 
          title: 'Duração inválida', 
          description: errorMessage,
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: 'Erro ao salvar assinatura', 
          description: errorMessage,
          variant: 'destructive' 
        });
      }
    },
  });

  // Confirm payment mutation - protegida contra unmount
  const confirmPaymentMutation = useSafeMutation({
    mutationFn: async (data: { assinaturaId: string; novaDataVencimento: string }) => {
      return await assinaturasApi.update(data.assinaturaId, {
        status: 'ativa',
        dataProximoPagamento: data.novaDataVencimento,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assinaturas'] });
      toast({ title: '✅ Pagamento confirmado! Assinatura reativada.' });
      setPaymentDialogOpen(false);
      setViewProofDialogOpen(false);
      fetchData();
    },
    onError: (error: any) => {
      console.error('Error confirming payment:', error);
      toast({ 
        title: 'Erro ao confirmar pagamento', 
        description: error?.response?.data?.message || 'Erro ao confirmar pagamento',
        variant: 'destructive' 
      });
    },
  });

  // Reject payment mutation - protegida contra unmount
  const rejectPaymentMutation = useSafeMutation({
    mutationFn: async (assinaturaId: string) => {
      return await assinaturasApi.update(assinaturaId, {
        status: 'suspensa',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assinaturas'] });
      toast({ title: 'Pagamento rejeitado.' });
      setViewProofDialogOpen(false);
      fetchData();
    },
    onError: (error: any) => {
      console.error('Error rejecting payment:', error);
      toast({ 
        title: 'Erro ao rejeitar pagamento', 
        description: error?.response?.data?.message || 'Erro ao rejeitar pagamento',
        variant: 'destructive' 
      });
    },
  });

  const handleSubmit = async () => {
    // Validações frontend
    if (!formData.instituicao_id) {
      toast({ 
        title: 'Campo obrigatório', 
        description: 'Selecione uma instituição',
        variant: 'destructive' 
      });
      return;
    }

    if (!formData.plano_id) {
      toast({ 
        title: 'Campo obrigatório', 
        description: 'Selecione um plano',
        variant: 'destructive' 
      });
      return;
    }

    if (formData.tipo === 'DEMO' && !formData.duracaoDias) {
      toast({ 
        title: 'Campo obrigatório', 
        description: 'Selecione a duração do DEMO (30 ou 60 dias)',
        variant: 'destructive' 
      });
      return;
    }

    const payload: any = {
      instituicaoId: formData.instituicao_id,
      planoId: formData.plano_id,
      tipo: formData.tipo,
      tipoPeriodo: formData.tipo_periodo || 'mensal',
      status: formData.status,
      observacoes: formData.observacoes || null,
      iban: formData.iban || null,
      multicaixaNumero: formData.multicaixa_numero || null,
      instrucoesPagamento: formData.instrucoes_pagamento || null,
      diasCarenciaAnalise: parseInt(formData.dias_carencia_analise) || 3,
    };

    // Adicionar valorAtual apenas se for diferente do automático (override)
    if (formData.tipo === 'DEMO') {
      payload.valorAtual = 0; // DEMO sempre 0
    } else if (isEditingPrice && justificativaOverride.trim()) {
      // Override manual: enviar valor e justificativa
      payload.valorAtual = parseFloat(formData.valor_atual) || 0;
      payload.justificativaOverride = justificativaOverride.trim();
    } else {
      // Preço automático: não enviar valorAtual, backend calculará
      // Mas enviar se for diferente do automático
      const valorAutomatico = precoAutomatico?.valorMensal || 0;
      const valorFornecido = parseFloat(formData.valor_atual) || 0;
      if (Math.abs(valorFornecido - valorAutomatico) > 0.01) {
        // Valores diferentes, mas sem justificativa - erro
        toast({
          title: 'Erro de validação',
          description: 'Para alterar o valor padrão, é necessário justificar o override',
          variant: 'destructive',
        });
        return;
      }
      // Valores iguais, deixar backend calcular
    }

    // Para DEMO, enviar duração e deixar backend calcular datas
    if (formData.tipo === 'DEMO') {
const duracaoDias = parseInt(formData.duracaoDias) || 30;
      if (duracaoDias !== 30 && duracaoDias !== 60) {
        toast({
          title: 'Duração inválida',
          description: 'A duração do DEMO deve ser 30 ou 60 dias',
          variant: 'destructive'
        });
        return;
      }
      payload.duracaoDias = duracaoDias;
      // Backend calculará dataInicio e dataFim automaticamente
    } else {
      // Para PAGA, usar datas fornecidas
      payload.dataInicio = formData.data_inicio;
      payload.dataFim = formData.data_fim || null;
      payload.dataProximoPagamento = formData.data_proximo_pagamento || null;
    }

    // Usar mutation segura
    saveAssinaturaMutation.mutate({
      isEdit: !!editingAssinatura,
      id: editingAssinatura?.id,
      data: payload,
    });
  };

  const handleOpenPaymentConfirm = (pagamento: Pagamento) => {
    setSelectedPagamento(pagamento);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setPaymentConfirmData({
      data_pagamento: format(new Date(), 'yyyy-MM-dd'),
      nova_data_vencimento: format(nextMonth, 'yyyy-MM-dd'),
      observacoes: '',
    });
    setPaymentDialogOpen(true);
  };

  const handleViewProof = (pagamento: Pagamento) => {
    setSelectedPagamento(pagamento);
    setViewProofDialogOpen(true);
  };

  const handleConfirmPayment = () => {
    if (!selectedPagamento) return;

    // Usar mutation segura
    confirmPaymentMutation.mutate({
      instituicaoId: selectedPagamento.instituicao_id,
      novaDataVencimento: paymentConfirmData.nova_data_vencimento,
    });
  };

  const handleRejectPayment = () => {
    if (!selectedPagamento) return;

    // Usar mutation segura
    rejectPaymentMutation.mutate(selectedPagamento.instituicao_id);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return format(new Date(date), 'dd/MM/yyyy', { locale: pt });
  };

  const instituicoesSemAssinatura = instituicoes.filter(
    inst => !assinaturas.some(a => a.instituicao_id === inst.id)
  );

  const filteredPagamentos = todosPagamentos.filter(p => {
    if (filtroStatus !== 'all' && String(p.status ?? '').toLowerCase() !== filtroStatus.toLowerCase()) return false;
    if (filtroInstituicao && !String(p.instituicao?.nome ?? '').toLowerCase().includes(String(filtroInstituicao ?? '').toLowerCase())) return false;
    return true;
  });

  const buscaLower = filtroBuscaAssinaturas.trim().toLowerCase();
  const filteredAssinaturas = assinaturas.filter(a => {
    if (filtroStatusAssinatura !== 'all' && a.status !== filtroStatusAssinatura) return false;
    if (!buscaLower) return true;
    const nome = (a.instituicao?.nome ?? '').toLowerCase();
    const sub = (a.instituicao?.subdominio ?? '').toLowerCase();
    const planoNome = (a.plano?.nome ?? '').toLowerCase();
    return nome.includes(buscaLower) || sub.includes(buscaLower) || planoNome.includes(buscaLower);
  });

  if (loading) return <div className="p-4">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Assinaturas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure o período da licença (30, 60, 90, 180 ou 365 dias) em <strong>Nova Assinatura</strong> ou <strong>Editar</strong> → Tipo de Período. A contagem é a mesma na área da instituição (Faturas e Pagamentos).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen} modal={false}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} disabled={instituicoesSemAssinatura.length === 0 && !editingAssinatura}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Assinatura
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-w-2xl max-h-[90vh] overflow-y-auto"
              onPointerDownOutside={(e) => {
                if ((e.target as HTMLElement)?.closest?.('[role="listbox"]')) e.preventDefault();
              }}
            >
              <DialogHeader>
                <DialogTitle>{editingAssinatura ? 'Editar Assinatura' : 'Nova Assinatura'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Instituição *</Label>
                  <SmartSearch
                    placeholder="Digite o nome da instituição, subdomínio ou identificação..."
                    value={(() => {
                      const inst = (editingAssinatura ? instituicoes : instituicoesSemAssinatura).find(i => i.id === formData.instituicao_id);
                      return inst ? `${inst.nome} (${inst.subdominio})` : '';
                    })()}
                    selectedId={formData.instituicao_id || undefined}
                    onSelect={(item) => setFormData(prev => ({ ...prev, instituicao_id: item?.id ?? '' }))}
                    searchFn={searchInstituicoes}
                    getDisplayName={(item) => item.nome}
                    getSubtitle={(item) => item.complemento}
                    emptyMessage="Nenhuma instituição encontrada."
                    disabled={!!editingAssinatura}
                    minSearchLength={1}
                    silent
                  />
                  {!editingAssinatura && instituicoesSemAssinatura.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Todas as instituições já possuem assinatura
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Licença *</Label>
                  <Select 
                    value={formData.tipo} 
                    onValueChange={v => {
                      setFormData({ 
                        ...formData, 
                        tipo: v,
                        // Limpar data_fim quando mudar para DEMO
                        data_fim: v === 'DEMO' ? '' : formData.data_fim,
                        data_proximo_pagamento: v === 'DEMO' ? '' : formData.data_proximo_pagamento,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PAGA">Paga</SelectItem>
                      <SelectItem value="DEMO">Demo (30 ou 60 dias)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.tipo === 'DEMO' && (
                  <div className="space-y-2">
                    <Label>Duração do Demo *</Label>
                    <Select 
                      value={formData.duracaoDias} 
                      onValueChange={v => setFormData({ ...formData, duracaoDias: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 dias</SelectItem>
                        <SelectItem value="60">60 dias</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800">
                      <p className="text-xs text-purple-900 dark:text-purple-200 font-medium mb-1">
                        📋 Informações do DEMO:
                      </p>
                      <ul className="text-xs text-purple-800 dark:text-purple-300 space-y-1 list-disc list-inside">
                        <li>A licença começará <strong>imediatamente</strong></li>
                        <li>Expirará automaticamente em <strong>{formData.duracaoDias} dias</strong></li>
                        <li>Após expiração, a instituição será <strong>bloqueada automaticamente</strong></li>
                        <li>Pode ser convertida para PAGA a qualquer momento</li>
                      </ul>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Plano *</Label>
                  <SmartSearch
                    placeholder="Digite o nome do plano, preço ou identificação..."
                    value={(() => {
                      const p = planos.find(pl => pl.id === formData.plano_id);
                      return p ? `${p.nome} - ${formatCurrency(p.preco_mensal)}/mês` : '';
                    })()}
                    selectedId={formData.plano_id || undefined}
                    onSelect={(item) => {
                      if (item) handlePlanoChange(item.id);
                      else setFormData(prev => ({ ...prev, plano_id: '', valor_atual: '' }));
                    }}
                    searchFn={searchPlanos}
                    getDisplayName={(item) => item.nome}
                    getSubtitle={(item) => item.complemento}
                    emptyMessage="Nenhum plano encontrado. Crie um plano primeiro."
                    minSearchLength={1}
                    silent
                  />
                  {planos.length === 0 && (
                    <p className="text-xs text-yellow-600">
                      ⚠️ É necessário criar pelo menos um plano antes de criar uma assinatura
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.tipo === 'PAGA' && (
                  <>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                      <p className="text-sm font-medium text-foreground">Onde configurar o período da licença</p>
                      <p className="text-xs text-muted-foreground">
                        O <strong>tipo de período</strong> define a duração da assinatura (30, 60, 90, 180 ou 365 dias). 
                        A data fim é calculada automaticamente e pode ser ajustada manualmente. A contagem é a mesma na área da instituição (Faturas e Pagamentos).
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de Período *</Label>
                      <Select
                        value={formData.tipo_periodo}
                        onValueChange={v => {
                          const opcao = PERIODO_OPCOES.find(p => p.value === v);
                          const dataInicio = formData.data_inicio ? new Date(formData.data_inicio) : new Date();
                          const novaDataFim = opcao ? format(addDays(dataInicio, opcao.dias), 'yyyy-MM-dd') : formData.data_fim;
                          setFormData({
                            ...formData,
                            tipo_periodo: v,
                            data_fim: novaDataFim,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o período" />
                        </SelectTrigger>
                        <SelectContent>
                          {PERIODO_OPCOES.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Mensal (30 dias), Bimestral (60), Trimestral (90), Semestral (180), Anual (365). Alinhado ao backend e à exibição para a instituição.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data Início</Label>
                        <Input
                          type="date"
                          value={formData.data_inicio}
                          onChange={e => {
                            const opcao = PERIODO_OPCOES.find(p => p.value === formData.tipo_periodo);
                            const novaDataFim = opcao && e.target.value
                              ? format(addDays(new Date(e.target.value), opcao.dias), 'yyyy-MM-dd')
                              : formData.data_fim;
                            setFormData({ ...formData, data_inicio: e.target.value, data_fim: novaDataFim });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data Fim (pode ajustar manualmente)</Label>
                        <Input
                          type="date"
                          value={formData.data_fim}
                          onChange={e => setFormData({ ...formData, data_fim: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Campo de Valor Mensal com preço automático */}
                    {(() => {
                      const valorRecomendado =
                        formData.tipo !== 'DEMO'
                          ? (precoAutomatico?.valorMensal ?? planoSelecionado?.preco_mensal)
                          : null;
                      const emModoAutomatico =
                        !isEditingPrice && formData.tipo !== 'DEMO' && valorRecomendado != null;
                      return (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Label>Valor Mensal *</Label>
                              {formData.tipo !== 'DEMO' && (
                                <span
                                  className={cn(
                                    'rounded-full px-2 py-0.5 text-xs font-medium',
                                    emModoAutomatico
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                  )}
                                >
                                  {emModoAutomatico ? 'Automático' : 'Manual'}
                                </span>
                              )}
                            </div>
                            {isSuperAdmin && !isEditingPrice && formData.tipo !== 'DEMO' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditingPrice(true)}
                              >
                                ✎ Ajustar valor manualmente
                              </Button>
                            )}
                          </div>
                          {loadingPreco ? (
                            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                              <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                              A obter preço recomendado...
                            </div>
                          ) : (
                            <>
                              <Input
                                type="number"
                                value={formData.valor_atual}
                                onChange={e =>
                                  setFormData(prev => ({ ...prev, valor_atual: e.target.value }))
                                }
                                disabled={!isEditingPrice && formData.tipo !== 'DEMO'}
                                className={
                                  !isEditingPrice && formData.tipo !== 'DEMO'
                                    ? 'bg-muted font-medium'
                                    : ''
                                }
                                required
                              />
                              {!isEditingPrice &&
                                formData.tipo !== 'DEMO' &&
                                valorRecomendado != null && (
                                  <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Valor recomendado
                                    </p>
                                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                                      {formatCurrency(valorRecomendado)}/mês
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {precoAutomatico ? (
                                        <>
                                          Plano &quot;{precoAutomatico.planoNome}&quot; ·{' '}
                                          {tipoAcademico === 'SECUNDARIO'
                                            ? 'Ensino Secundário'
                                            : 'Ensino Superior'}
                                        </>
                                      ) : (
                                        <>Preço base do plano selecionado</>
                                      )}
                                    </p>
                                  </div>
                                )}
                              {isEditingPrice && (
                                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                                  <Label className="text-sm font-medium text-amber-900 dark:text-amber-100">
                                    Justificativa do valor manual *
                                  </Label>
                                  <Textarea
                                    value={justificativaOverride}
                                    onChange={e => setJustificativaOverride(e.target.value)}
                                    placeholder="Indique o motivo para alterar o valor recomendado..."
                                    rows={3}
                                    className="resize-none text-sm"
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    {valorRecomendado != null && (
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                          setIsEditingPrice(false);
                                          setJustificativaOverride('');
                                          setFormData(prev => ({
                                            ...prev,
                                            valor_atual: valorRecomendado.toString(),
                                          }));
                                        }}
                                      >
                                        Usar valor recomendado
                                      </Button>
                                    )}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setIsEditingPrice(false);
                                        setJustificativaOverride('');
                                        if (valorRecomendado != null) {
                                          setFormData(prev => ({
                                            ...prev,
                                            valor_atual: valorRecomendado.toString(),
                                          }));
                                        }
                                      }}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}

                {formData.tipo === 'PAGA' && (
                  <div className="space-y-2">
                    <Label>Próximo Pagamento</Label>
                    <Input
                      type="date"
                      value={formData.data_proximo_pagamento}
                      onChange={e => setFormData({ ...formData, data_proximo_pagamento: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.observacoes}
                    onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSubmit}
                    disabled={!formData.instituicao_id || !formData.plano_id || (formData.tipo === 'DEMO' && !formData.duracaoDias)}
                    className="flex-1"
                  >
                    {editingAssinatura ? 'Atualizar' : 'Criar'} Assinatura
                  </Button>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                </div>
                {(!formData.instituicao_id || !formData.plano_id || (formData.tipo === 'DEMO' && !formData.duracaoDias)) && (
                  <p className="text-xs text-muted-foreground text-center">
                    Preencha todos os campos obrigatórios (*) para continuar
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assinaturas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assinaturas.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {assinaturas.filter(a => a.status === 'ativa').length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">DEMOs Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {assinaturas.filter(a => (a as any).tipo === 'DEMO' && a.status === 'ativa').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {assinaturas.filter(a => (a as any).tipo === 'DEMO' && a.status === 'expirada').length} expiradas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expirando</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {assinaturasExpirando.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pagamentos Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {pagamentosPendentes.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assinaturas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assinaturas">Assinaturas</TabsTrigger>
          <TabsTrigger value="pagamentos">
            Pagamentos Pendentes
            {pagamentosPendentes.length > 0 && (
              <Badge className="ml-2" variant="destructive">{pagamentosPendentes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="assinaturas">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Procurar por instituição ou plano..."
                    value={filtroBuscaAssinaturas}
                    onChange={e => setFiltroBuscaAssinaturas(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filtroStatusAssinatura} onValueChange={setFiltroStatusAssinatura}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instituição</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Expira/Vencimento</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssinaturas.map(assinatura => {
                    const diasRestantes = getDiasRestantes(assinatura.data_proximo_pagamento);
                    return (
                      <TableRow key={assinatura.id}>
                        <TableCell className="font-medium">
                          {assinatura.instituicao?.nome || '-'}
                          {assinatura.instituicao?.subdominio && (
                            <span className="text-xs text-muted-foreground block">
                              {assinatura.instituicao.subdominio}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{assinatura.plano?.nome || '-'}</TableCell>
                        <TableCell>
                          {(assinatura as any).tipo === 'DEMO' ? (
                            <Badge variant="outline" className="text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/30">
                              🎯 DEMO
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30">
                              💳 PAGA
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {(assinatura as any).tipo === 'DEMO'
                            ? (() => {
                                const d = (assinatura as any).duracaoDias;
                                return d ? `${d} dias` : '—';
                              })()
                            : (() => {
                                const tp = (assinatura as any).tipo_periodo ?? (assinatura as any).tipoPeriodo;
                                const op = PERIODO_OPCOES.find(p => p.value === tp);
                                return op ? op.label : (tp || 'Mensal');
                              })()}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig[assinatura.status]?.color}>
                            {statusConfig[assinatura.status]?.icon}
                            <span className="ml-1">{statusConfig[assinatura.status]?.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(assinatura.valor_atual)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {(assinatura as any).tipo === 'DEMO' && assinatura.data_fim ? (
                              <>
                                <div className="font-medium text-purple-700 dark:text-purple-300">
                                  {formatDate(assinatura.data_fim)}
                                </div>
                                {(() => {
                                  const diasDemo = differenceInDays(new Date(assinatura.data_fim!), new Date());
                                  if (diasDemo >= 0) {
                                    return (
                                      <Badge variant="outline" className="text-purple-600 border-purple-300 w-fit">
                                        {diasDemo} {diasDemo === 1 ? 'dia restante' : 'dias restantes'}
                                      </Badge>
                                    );
                                  } else {
                                    return (
                                      <Badge variant="destructive" className="w-fit">
                                        Expirado
                                      </Badge>
                                    );
                                  }
                                })()}
                              </>
                            ) : (
                              <>
                                <div>{formatDate(assinatura.data_proximo_pagamento)}</div>
                                {diasRestantes !== null && diasRestantes <= 5 && diasRestantes >= 0 && (
                                  <Badge variant="outline" className="text-yellow-600 w-fit">
                                    ⚠️ {diasRestantes} {diasRestantes === 1 ? 'dia' : 'dias'} para vencer
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(assinatura)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamentos">
          <Card>
            <CardContent className="pt-6">
              {pagamentosPendentes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum pagamento pendente</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instituição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Forma Pagamento</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagamentosPendentes.map(pagamento => (
                      <TableRow key={pagamento.id}>
                        <TableCell className="font-medium">
                          {pagamento.instituicao?.nome || '-'}
                        </TableCell>
                        <TableCell>{formatCurrency(pagamento.valor)}</TableCell>
                        <TableCell>{formatDate(pagamento.data_vencimento)}</TableCell>
                        <TableCell>{pagamento.forma_pagamento}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleViewProof(pagamento)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenPaymentConfirm(pagamento)}>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por instituição..."
                    value={filtroInstituicao}
                    onChange={e => setFiltroInstituicao(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Rejeitado">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instituição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Forma</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPagamentos.map(pagamento => (
                    <TableRow key={pagamento.id}>
                      <TableCell className="font-medium">
                        {pagamento.instituicao?.nome || '-'}
                      </TableCell>
                      <TableCell>{formatCurrency(pagamento.valor)}</TableCell>
                      <TableCell>
                        <Badge variant={pagamento.status === 'Pago' ? 'default' : pagamento.status === 'Rejeitado' ? 'destructive' : 'secondary'}>
                          {pagamento.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(pagamento.data_pagamento)}</TableCell>
                      <TableCell>{pagamento.forma_pagamento}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Confirm Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                value={paymentConfirmData.data_pagamento}
                onChange={e => setPaymentConfirmData({ ...paymentConfirmData, data_pagamento: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nova Data de Vencimento</Label>
              <Input
                type="date"
                value={paymentConfirmData.nova_data_vencimento}
                onChange={e => setPaymentConfirmData({ ...paymentConfirmData, nova_data_vencimento: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={paymentConfirmData.observacoes}
                onChange={e => setPaymentConfirmData({ ...paymentConfirmData, observacoes: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleConfirmPayment} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Pagamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Proof Dialog */}
      <Dialog open={viewProofDialogOpen} onOpenChange={setViewProofDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comprovativo de Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Instituição</Label>
                <p className="font-medium">{selectedPagamento?.instituicao?.nome}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Valor</Label>
                <p className="font-medium">{selectedPagamento && formatCurrency(selectedPagamento.valor)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Forma Pagamento</Label>
                <p className="font-medium">{selectedPagamento?.forma_pagamento}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Telefone</Label>
                <p className="font-medium">{selectedPagamento?.telefone_contato || '-'}</p>
              </div>
            </div>
            {selectedPagamento?.comprovativo_texto && (
              <div>
                <Label className="text-muted-foreground">Descrição</Label>
                <p className="mt-1 p-3 bg-muted rounded-md text-sm">{selectedPagamento.comprovativo_texto}</p>
              </div>
            )}
            {selectedPagamento?.comprovativo_url && (
              <div>
                <Label className="text-muted-foreground">Comprovativo</Label>
                <a
                  href={selectedPagamento.comprovativo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-2"
                >
                  <img
                    src={selectedPagamento.comprovativo_url}
                    alt="Comprovativo"
                    className="max-h-64 rounded-md border"
                  />
                </a>
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleConfirmPayment} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                Aprovar
              </Button>
              <Button onClick={handleRejectPayment} variant="destructive" className="flex-1">
                <XCircle className="h-4 w-4 mr-2" />
                Rejeitar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
