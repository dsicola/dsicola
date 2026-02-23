import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { mensalidadesApi, profilesApi, userRolesApi, matriculasApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useAuth } from "@/contexts/AuthContext";
import { isStaffWithFallback } from "@/utils/roleLabels";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Filter,
  Plus,
  RefreshCw,
  FileText,
  Download,
} from "lucide-react";
import { downloadMapaAtrasos, downloadRelatorioReceitas, type RelatorioReceitasData, type ReciboData, extrairNomeTurmaRecibo, formatAnoFrequenciaSuperior } from "@/utils/pdfGenerator";
import { PrintReceiptDialog } from "@/components/secretaria/PrintReceiptDialog";
import { useNavigate } from "react-router-dom";

interface Mensalidade {
  id: string;
  aluno_id: string;
  valor: number;
  valor_desconto?: number;
  valor_multa?: number;
  valor_juros?: number;
  status: string;
  data_vencimento: string;
  data_pagamento: string | null;
  forma_pagamento?: string | null;
  multa: boolean;
  percentual_multa: number;
  mes_referencia: number;
  ano_referencia: number;
  curso_nome?: string | null;
  turma_nome?: string | null;
  ano_letivo?: number | null;
  ano_frequencia?: string | null;
  classe_frequencia?: string | null;
  recibo_numero?: string | null;
  comprovativo?: string | null;
  observacoes: string | null;
  created_at: string;
  profiles?: {
    nome_completo: string;
    email: string;
    numero_identificacao: string | null;
    numero_identificacao_publica: string | null;
  };
  aluno?: {
    id: string;
    nome_completo: string;
    email: string;
    numero_identificacao: string | null;
    numero_identificacao_publica: string | null;
  };
  curso?: { id: string; nome: string; codigo?: string } | null;
}

interface Aluno {
  id: string;
  nome_completo: string;
  email: string;
  numero_identificacao: string | null;
  numero_identificacao_publica: string | null;
}

export default function GestaoFinanceira() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { config, tipoAcademico } = useInstituicao();
  const { instituicaoId, shouldFilter, isSuperAdmin } = useTenantFilter();
  const { role } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [mesFilter, setMesFilter] = useState<string>("todos");
  const [showGerarDialog, setShowGerarDialog] = useSafeDialog(false);
  const [showPagarDialog, setShowPagarDialog] = useSafeDialog(false);
  const [selectedMensalidade, setSelectedMensalidade] = useState<Mensalidade | null>(null);
  const [novoValor, setNovoValor] = useState("50000");
  const [novoMes, setNovoMes] = useState(new Date().getMonth() + 1);
  const [novoAno, setNovoAno] = useState(new Date().getFullYear());
  const [formaPagamento, setFormaPagamento] = useState("Transferência Bancária");
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [showPrintDialog, setShowPrintDialog] = useSafeDialog(false);
  const [printReciboData, setPrintReciboData] = useState<ReciboData | null>(null);

  // Fetch mensalidades with student profiles
  const { data: mensalidades, isLoading, error } = useQuery({
    queryKey: ["mensalidades", instituicaoId],
    queryFn: async () => {
      try {
        // CRITICAL: Do NOT send instituicaoId from frontend - it comes from token
        // The backend will automatically filter by the user's instituicaoId from the token
        const params: any = {};
        
        // Debug log
        console.log('[GestaoFinanceira] ===== INÍCIO DA BUSCA =====');
        console.log('[GestaoFinanceira] Fetching mensalidades with params:', params);
        console.log('[GestaoFinanceira] instituicaoId from hook:', instituicaoId);
        console.log('[GestaoFinanceira] isSuperAdmin:', isSuperAdmin);
        console.log('[GestaoFinanceira] Query enabled:', !!instituicaoId || isSuperAdmin);
        
        // Get mensalidades - backend filters by instituicaoId from token automatically
        const mensalidadesData = await mensalidadesApi.getAll(params);
        
        // Debug log
        console.log('[GestaoFinanceira] Received mensalidades:', mensalidadesData?.length || 0);
        if (mensalidadesData && mensalidadesData.length > 0) {
          console.log('[GestaoFinanceira] Mensalidades IDs:', mensalidadesData.map((m: any) => m.id).join(', '));
          console.log('[GestaoFinanceira] Mensalidades alunos:', mensalidadesData.map((m: any) => `${m.aluno?.nome_completo || 'N/A'} (${m.mes_referencia}/${m.ano_referencia})`).join(', '));
        } else {
          console.warn('[GestaoFinanceira] ⚠️  NENHUMA MENSALIDADE RECEBIDA!');
          console.warn('[GestaoFinanceira] Verifique:');
          console.warn('[GestaoFinanceira]   1. Se o token tem instituicaoId correto');
          console.warn('[GestaoFinanceira]   2. Se há mensalidades para esta instituição no banco');
          console.warn('[GestaoFinanceira]   3. Se o usuário tem permissão para ver mensalidades');
        }
        console.log('[GestaoFinanceira] ===== FIM DA BUSCA =====\n');

        // Return empty array if no data (this is valid - means no mensalidades exist yet)
        if (!mensalidadesData || mensalidadesData.length === 0) {
          return [] as Mensalidade[];
        }

        // Get unique aluno IDs (only if we need to fetch profiles)
        const alunoIds = [...new Set(mensalidadesData.map((m: any) => m.aluno_id ?? m.alunoId) || [])].filter(Boolean) as string[];
        
        // Try to get profiles, but don't fail if it doesn't work - backend already provides aluno data
        let profilesMap = new Map();
        if (alunoIds.length > 0) {
          try {
            const profilesData = await profilesApi.getByIds(alunoIds);
            profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]) || []);
          } catch (profileError) {
            console.warn('[GestaoFinanceira] Error fetching profiles, using aluno data from backend:', profileError);
            // Continue without profiles - backend already provides aluno data
          }
        }

        // Enriquecer com curso/turma/classe a partir das matrículas (alunoId vs aluno_id)
        const matriculasData = await matriculasApi.getAll().catch(() => []);
        const alunoInfoMap = new Map<string, { curso_nome: string; turma_nome: string; anoFrequencia?: string | null; classeFrequencia?: string | null }>();
        matriculasData?.forEach((m: any) => {
          const aid = m.aluno_id ?? m.alunoId;
          if (aid && m.turma && !alunoInfoMap.has(aid)) {
            alunoInfoMap.set(aid, {
              curso_nome: m.turma?.curso?.nome || 'N/A',
              turma_nome: extrairNomeTurmaRecibo(m.turma?.nome) || m.turma?.nome || 'N/A',
              anoFrequencia: formatAnoFrequenciaSuperior(m.turma),
              classeFrequencia: m.turma?.classe?.nome ?? null,
            });
          }
        });

        // Combine data - backend already provides aluno, profiles + curso/turma/classe
        return mensalidadesData.map((m: any) => {
          const aid = m.aluno_id ?? m.alunoId ?? m.aluno?.id;
          const info = alunoInfoMap.get(aid);
          return {
            ...m,
            profiles: profilesMap.get(aid) || null,
            curso_nome: info?.curso_nome ?? m.curso_nome ?? m.curso?.nome ?? null,
            turma_nome: info?.turma_nome ?? m.turma_nome ?? null,
            ano_frequencia: info?.anoFrequencia ?? m.ano_frequencia ?? null,
            classe_frequencia: info?.classeFrequencia ?? m.classe_nome ?? null,
          };
        }) as Mensalidade[];
      } catch (err) {
        console.error('[GestaoFinanceira] Error fetching mensalidades:', err);
        // Return empty array on error to prevent UI breakage
        return [] as Mensalidade[];
      }
    },
    enabled: !!instituicaoId || isSuperAdmin || isStaffWithFallback(role),
    retry: 2,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch all students for generating new mensalidades
  const { data: alunos } = useQuery({
    queryKey: ["alunos-financeiro", instituicaoId],
    enabled: !!instituicaoId || isSuperAdmin || isStaffWithFallback(role),
    queryFn: async () => {
      // Get alunos from current institution
      const rolesData = await userRolesApi.getByRole(
        "ALUNO",
        shouldFilter && instituicaoId ? instituicaoId : undefined
      );

      const userIds = rolesData?.map((r: any) => r.user_id) || [];
      
      if (userIds.length === 0) return [] as Aluno[];

      const profilesData = await profilesApi.getByIds(userIds);

      return profilesData as Aluno[];
    },
  });

  // Generate mensalidades for all students - valores vêm automaticamente do curso
  const gerarMensalidadesMutation = useMutation({
    mutationFn: async ({ mes, ano, valorPadrao }: { mes: number; ano: number; valorPadrao: number }) => {
      // Calcular data de vencimento (dia 5 do mês seguinte)
      const dataVencimento = new Date(ano, mes, 5);
      const dataVencimentoStr = dataVencimento.toISOString().split('T')[0];

      // Chamar endpoint do backend que busca valores automaticamente do curso
      const result = await mensalidadesApi.gerarParaTodos({
        mesReferencia: mes,
        anoReferencia: ano,
        dataVencimento: dataVencimentoStr,
        valorPadrao: valorPadrao, // Usado apenas se aluno não tiver curso
      });

      return result.count || 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["mensalidades"] });
      queryClient.invalidateQueries({ queryKey: ["mensalidades-secretaria"] });
      setShowGerarDialog(false);
      toast({
        title: "Mensalidades geradas",
        description: `${count} mensalidades foram geradas automaticamente com o valor do curso de cada aluno.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar mensalidades",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mark payment as paid
  const marcarPagoMutation = useMutation({
    mutationFn: async ({ id, formaPagamento, dataPagamento }: { id: string; formaPagamento: string; dataPagamento: string }) => {
      const response = await mensalidadesApi.update(id, {
        status: "Pago",
        dataPagamento,
        formaPagamento,
      });
      return { response, formaPagamento, dataPagamento };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mensalidades"] });
      queryClient.invalidateQueries({ queryKey: ["mensalidades-secretaria"] });
      setShowPagarDialog(false);

      const { response, formaPagamento, dataPagamento } = result;
      const reciboNumero = response?.recibo_numero || response?.comprovativo || `RCB-${Date.now()}`;
      const reciboData: ReciboData | null = selectedMensalidade
        ? {
            instituicao: {
              nome: config?.nome_instituicao || "Instituição",
              nif: (config as { nif?: string })?.nif ?? null,
              logoUrl: config?.logo_url,
              email: config?.email,
              telefone: config?.telefone,
              endereco: config?.endereco,
              tipoAcademico: tipoAcademico ?? (config as { tipo_academico?: string })?.tipo_academico ?? null,
            },
            aluno: {
              nome: selectedMensalidade.aluno?.nome_completo || selectedMensalidade.profiles?.nome_completo || "N/A",
              numeroId: selectedMensalidade.aluno?.numero_identificacao_publica ?? selectedMensalidade.profiles?.numero_identificacao_publica,
              bi: selectedMensalidade.aluno?.numero_identificacao ?? selectedMensalidade.profiles?.numero_identificacao,
              email: selectedMensalidade.aluno?.email ?? selectedMensalidade.profiles?.email,
              curso: response?.curso?.nome ?? selectedMensalidade.curso_nome,
              turma: selectedMensalidade.turma_nome,
              anoLetivo: selectedMensalidade.ano_letivo ?? null,
              anoFrequencia: selectedMensalidade.ano_frequencia ?? null,
              classeFrequencia: selectedMensalidade.classe_frequencia ?? null,
              tipoAcademico: tipoAcademico ?? (config as { tipo_academico?: string })?.tipo_academico ?? null,
            },
            pagamento: {
              valor: Number(response?.valor ?? selectedMensalidade.valor ?? 0),
              valorDesconto: Number(response?.valor_desconto ?? selectedMensalidade.valor_desconto ?? 0),
              valorMulta: Number(response?.valor_multa ?? selectedMensalidade.valor_multa ?? 0),
              valorJuros: Number(response?.valor_juros ?? selectedMensalidade.valor_juros ?? 0),
              mesReferencia: response?.mes_referencia ?? selectedMensalidade.mes_referencia ?? 1,
              anoReferencia: response?.ano_referencia ?? selectedMensalidade.ano_referencia ?? new Date().getFullYear(),
              dataPagamento: dataPagamento,
              formaPagamento: formaPagamento,
              reciboNumero,
            },
          }
        : null;
      if (reciboData) {
        setPrintReciboData(reciboData);
        setShowPrintDialog(true);
      }
      setSelectedMensalidade(null);
      setFormaPagamento("Transferência Bancária");
      setDataPagamento(new Date().toISOString().split('T')[0]);
      toast({
        title: "Pagamento registrado",
        description: `Recibo gerado: ${reciboNumero}. Imprima o recibo.`,
      });
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
    // Use aluno data (from backend) as primary, profiles as fallback
    const alunoNome = m.aluno?.nome_completo || m.profiles?.nome_completo || '';
    const alunoEmail = m.aluno?.email || m.profiles?.email || '';
    const alunoNumero = m.aluno?.numero_identificacao || m.profiles?.numero_identificacao || '';
    const alunoNumeroPub = m.aluno?.numero_identificacao_publica ?? m.profiles?.numero_identificacao_publica ?? '';
    
    const searchLower = String(searchTerm ?? '').toLowerCase();
    const matchesSearch =
      String(alunoNome ?? '').toLowerCase().includes(searchLower) ||
      String(alunoEmail ?? '').toLowerCase().includes(searchLower) ||
      String(alunoNumero ?? '').toLowerCase().includes(searchLower) ||
      String(alunoNumeroPub ?? '').toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === "todos" || m.status === statusFilter;
    const matchesMes = mesFilter === "todos" || m.mes_referencia === parseInt(mesFilter);

    return matchesSearch && matchesStatus && matchesMes;
  });

  const stats = {
    total: mensalidades?.length || 0,
    pendentes: mensalidades?.filter((m) => m.status === "Pendente").length || 0,
    pagos: mensalidades?.filter((m) => m.status === "Pago").length || 0,
    atrasados: mensalidades?.filter((m) => m.status === "Atrasado").length || 0,
    valorTotal: mensalidades?.reduce((acc, m) => 
      acc + Number(m.valor) 
      - Number(m.valor_desconto || 0)
      + Number(m.valor_multa || 0)
      + Number(m.valor_juros || 0), 0) || 0,
    valorRecebido: mensalidades?.filter((m) => m.status === "Pago").reduce((acc, m) => 
      acc + Number(m.valor) 
      - Number(m.valor_desconto || 0)
      + Number(m.valor_multa || 0)
      + Number(m.valor_juros || 0), 0) || 0,
    totalMultas: mensalidades?.reduce((acc, m) => acc + Number(m.valor_multa || 0), 0) || 0,
    totalJuros: mensalidades?.reduce((acc, m) => acc + Number(m.valor_juros || 0), 0) || 0,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pago":
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20"><CheckCircle className="h-3 w-3 mr-1" /> Pago</Badge>;
      case "Pendente":
        return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      case "Atrasado":
        return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20"><AlertTriangle className="h-3 w-3 mr-1" /> Atrasado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

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

  const atrasadasParaMapa = mensalidades?.filter((m) => m.status === "Atrasado") || [];
  const handleDownloadMapaAtrasos = async () => {
    try {
      if (atrasadasParaMapa.length === 0) {
        toast({ title: "Sem dados", description: "Não há mensalidades em atraso para exportar.", variant: "destructive" });
        return;
      }
      await downloadMapaAtrasos({
        instituicao: {
          nome: config?.nome_instituicao || "Instituição",
          nif: (config as { nif?: string })?.nif ?? null,
        },
        mensalidades: atrasadasParaMapa.map((m) => {
          const venc = new Date(m.data_vencimento);
          const hoje = new Date();
          const diasAtraso = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
          const aluno = m.profiles || m.aluno;
          return {
            alunoNome: aluno?.nome_completo || "Aluno",
            numeroId: aluno?.numero_identificacao_publica ?? undefined,
            mesReferencia: m.mes_referencia,
            anoReferencia: m.ano_referencia,
            valor: Number(m.valor),
            valorMulta: Number(m.valor_multa || 0),
            dataVencimento: m.data_vencimento,
            diasAtraso,
          };
        }),
      });
      toast({ title: "Mapa exportado", description: "O mapa de propinas em atraso foi baixado." });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível gerar o mapa.", variant: "destructive" });
    }
  };

  const handleDownloadRelatorioReceitas = (periodo: 'MENSAL' | 'ANUAL', mes?: number, ano?: number) => {
    const targetAno = ano ?? new Date().getFullYear();
    const targetMes = mes ?? new Date().getMonth() + 1;
    const lista = mensalidades || [];
    const getMesNome = (m: number) => {
      const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      return meses[m - 1] || "";
    };

    let filtered = lista;
    let detalhesPorMes: RelatorioReceitasData['detalhesPorMes'] = [];

    if (periodo === 'MENSAL') {
      filtered = lista.filter((m) => m.mes_referencia === targetMes && m.ano_referencia === targetAno);
    } else {
      filtered = lista.filter((m) => m.ano_referencia === targetAno);
      const byMes = new Map<string, { esperado: number; recebido: number; pendente: number; atrasado: number }>();
      filtered.forEach((m) => {
        const key = `${getMesNome(m.mes_referencia)}/${m.ano_referencia}`;
        const val = byMes.get(key) || { esperado: 0, recebido: 0, pendente: 0, atrasado: 0 };
        const v = Number(m.valor) - Number(m.valor_desconto || 0) + Number(m.valor_multa || 0) + Number(m.valor_juros || 0);
        val.esperado += v;
        if (m.status === 'Pago') val.recebido += v;
        else if (m.status === 'Atrasado') val.atrasado += v;
        else val.pendente += v;
        byMes.set(key, val);
      });
      detalhesPorMes = Array.from(byMes.entries()).map(([mesAno, vals]) => ({
        mesAno,
        ...vals,
      }));
    }

    const totalEsperado = filtered.reduce((s, m) => s + Number(m.valor) - Number(m.valor_desconto || 0) + Number(m.valor_multa || 0) + Number(m.valor_juros || 0), 0);
    const pagos = filtered.filter((m) => m.status === 'Pago');
    const pendentes = filtered.filter((m) => m.status === 'Pendente');
    const atrasados = filtered.filter((m) => m.status === 'Atrasado');
    const totalRecebido = pagos.reduce((s, m) => s + Number(m.valor) - Number(m.valor_desconto || 0) + Number(m.valor_multa || 0) + Number(m.valor_juros || 0), 0);
    const totalPendente = pendentes.reduce((s, m) => s + Number(m.valor), 0);
    const totalAtrasado = atrasados.reduce((s, m) => s + Number(m.valor) + Number(m.valor_multa || 0) + Number(m.valor_juros || 0), 0);

    const data: RelatorioReceitasData = {
      instituicao: { nome: config?.nome_instituicao || "Instituição", nif: (config as { nif?: string })?.nif ?? null },
      periodo,
      mesAno: periodo === 'MENSAL' ? `${getMesNome(targetMes)}/${targetAno}` : undefined,
      ano: periodo === 'ANUAL' ? targetAno : undefined,
      resumo: {
        totalEsperado,
        totalRecebido,
        totalPendente,
        totalAtrasado,
        quantidadePagos: pagos.length,
        quantidadePendentes: pendentes.length,
        quantidadeAtrasados: atrasados.length,
      },
      detalhesPorMes: periodo === 'ANUAL' ? detalhesPorMes : undefined,
    };
    downloadRelatorioReceitas(data);
    toast({ title: "Relatório gerado", description: `Relatório ${periodo === 'MENSAL' ? 'mensal' : 'anual'} de receitas baixado.` });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin-dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{t('pages.gestaoFinanceira')}</h1>
            <p className="text-muted-foreground">
              {t('pages.gestaoFinanceiraDesc')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => handleDownloadRelatorioReceitas('MENSAL')}
              disabled={!mensalidades?.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Rel. Receitas Mês
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDownloadRelatorioReceitas('ANUAL')}
              disabled={!mensalidades?.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Rel. Receitas Ano
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadMapaAtrasos}
              disabled={atrasadasParaMapa.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Mapa de Atrasos (PDF)
            </Button>
            <Button onClick={() => setShowGerarDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Gerar Mensalidades
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Mensalidades</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.valorTotal)} em mensalidades
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats.pendentes}</div>
              <p className="text-xs text-muted-foreground">aguardando pagamento</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagos</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.pagos}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.valorRecebido)} recebidos
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.atrasados}</div>
              <p className="text-xs text-muted-foreground">com multa aplicada</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Mensalidades</CardTitle>
            <CardDescription>
              Lista de todas as mensalidades registradas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, email ou matrícula..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={mesFilter} onValueChange={setMesFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os meses</SelectItem>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mes) => (
                    <SelectItem key={mes} value={mes.toString()}>
                      {getMesNome(mes)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin inline-block mr-2" />
                Carregando mensalidades...
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-5 w-5 text-destructive inline-block mr-2" />
                <span className="text-destructive">Erro ao carregar mensalidades. Tente novamente.</span>
              </div>
            ) : filteredMensalidades && filteredMensalidades.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Referência</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Multa</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMensalidades.map((mensalidade) => (
                      <TableRow key={mensalidade.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{mensalidade.aluno?.nome_completo || mensalidade.profiles?.nome_completo || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground">
                              {mensalidade.aluno?.numero_identificacao_publica || mensalidade.profiles?.numero_identificacao_publica || mensalidade.aluno?.email || mensalidade.profiles?.email || ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getMesNome(mensalidade.mes_referencia)}/{mensalidade.ano_referencia}
                        </TableCell>
                        <TableCell>{formatCurrency(Number(mensalidade.valor) - Number(mensalidade.valor_desconto || 0))}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {Number(mensalidade.valor_multa || 0) > 0 && (
                              <div className="text-destructive text-sm">
                                Multa: {formatCurrency(Number(mensalidade.valor_multa))}
                              </div>
                            )}
                            {Number(mensalidade.valor_juros || 0) > 0 && (
                              <div className="text-destructive text-sm">
                                Juros: {formatCurrency(Number(mensalidade.valor_juros))}
                              </div>
                            )}
                            {Number(mensalidade.valor_multa || 0) === 0 && Number(mensalidade.valor_juros || 0) === 0 && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(
                            Number(mensalidade.valor) 
                            - Number(mensalidade.valor_desconto || 0)
                            + Number(mensalidade.valor_multa || 0)
                            + Number(mensalidade.valor_juros || 0)
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(mensalidade.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getStatusBadge(mensalidade.status)}</TableCell>
                        <TableCell className="text-right">
                          {mensalidade.status !== "Pago" && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedMensalidade(mensalidade);
                                setShowPagarDialog(true);
                              }}
                            >
                              Marcar Pago
                            </Button>
                          )}
                          {mensalidade.status === "Pago" && mensalidade.data_pagamento && (
                            <span className="text-sm text-muted-foreground">
                              Pago em {format(new Date(mensalidade.data_pagamento), "dd/MM/yyyy")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium text-lg">Nenhuma mensalidade encontrada</p>
                <p className="text-sm mt-2">
                  {(!mensalidades || mensalidades.length === 0) 
                    ? "Nenhuma mensalidade foi gerada ainda. Use o botão 'Gerar Mensalidades' acima para criar mensalidades para todos os alunos ativos."
                    : "Nenhuma mensalidade corresponde aos filtros selecionados. Tente ajustar os filtros."}
                </p>
                {(!mensalidades || mensalidades.length === 0) && alunos && alunos.length > 0 && (
                  <p className="text-xs mt-2 text-muted-foreground">
                    {alunos.length} aluno{alunos.length !== 1 ? 's' : ''} ativo{alunos.length !== 1 ? 's' : ''} encontrado{alunos.length !== 1 ? 's' : ''} para gerar mensalidades.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog: Gerar Mensalidades */}
        <Dialog open={showGerarDialog} onOpenChange={setShowGerarDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerar Mensalidades</DialogTitle>
              <DialogDescription>
                Gere mensalidades para todos os estudantes ativos do sistema.
                O valor será definido pelo curso de cada estudante.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor Padrão (para estudantes sem curso)</Label>
                <Input
                  id="valor"
                  type="number"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Este valor será usado apenas para estudantes sem matrícula em curso.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mês de Referência</Label>
                  <Select
                    value={novoMes.toString()}
                    onValueChange={(v) => setNovoMes(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mes) => (
                        <SelectItem key={mes} value={mes.toString()}>
                          {getMesNome(mes)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Select
                    value={novoAno.toString()}
                    onValueChange={(v) => setNovoAno(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026].map((ano) => (
                        <SelectItem key={ano} value={ano.toString()}>
                          {ano}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Serão geradas mensalidades para {alunos?.length || 0} estudantes.
                O valor será baseado no curso de cada estudante. Vencimento: dia 5 do mês seguinte.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGerarDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() =>
                  gerarMensalidadesMutation.mutate({
                    valorPadrao: parseFloat(novoValor),
                    mes: novoMes,
                    ano: novoAno,
                  })
                }
                disabled={gerarMensalidadesMutation.isPending}
              >
                {gerarMensalidadesMutation.isPending ? "Gerando..." : "Gerar Mensalidades"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Confirmar Pagamento */}
        <Dialog open={showPagarDialog} onOpenChange={setShowPagarDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
              <DialogDescription>
                Registrar pagamento da mensalidade de{" "}
                <strong>{selectedMensalidade?.profiles?.nome_completo}</strong> referente a{" "}
                <strong>
                  {selectedMensalidade && getMesNome(selectedMensalidade.mes_referencia)}/
                  {selectedMensalidade?.ano_referencia}
                </strong>
              </DialogDescription>
            </DialogHeader>
            {selectedMensalidade && (
              <div className="space-y-4 py-4">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Valor total:</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      Number(selectedMensalidade.valor) +
                        Number(selectedMensalidade.valor_multa || 0)
                    )}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="data">Data do Pagamento</Label>
                  <Input
                    id="data"
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forma">Forma de Pagamento</Label>
                  <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Caixa">Caixa</SelectItem>
                      <SelectItem value="Transferência Bancária">Transferência Bancária</SelectItem>
                      <SelectItem value="Multicaixa">Multicaixa Express</SelectItem>
                      <SelectItem value="Depósito Bancário">Depósito Bancário</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPagarDialog(false)}>
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
                {marcarPagoMutation.isPending ? "Processando..." : "Confirmar Pagamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <PrintReceiptDialog
          open={showPrintDialog}
          onOpenChange={setShowPrintDialog}
          reciboData={printReciboData}
        />
      </div>
    </DashboardLayout>
  );
}
