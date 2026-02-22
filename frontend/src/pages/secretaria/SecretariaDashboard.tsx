import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useAuth } from "@/contexts/AuthContext";
import { isStaffWithFallback } from "@/utils/roleLabels";
import { useNavigate } from "react-router-dom";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import {
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Filter,
  FileText,
  User,
  Users,
  Receipt,
  Download,
  BarChart3,
  TrendingUp,
  Mail,
  Target,
  FileSpreadsheet,
  Printer,
  Plus,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { FinancialCharts } from "@/components/secretaria/FinancialCharts";
import { PrintReceiptDialog } from "@/components/secretaria/PrintReceiptDialog";
import { 
  ReciboData, 
  gerarReciboPDF, 
  gerarRelatorioPDF,
  gerarCodigoRecibo,
  extrairNomeTurmaRecibo,
  formatAnoFrequenciaSuperior,
} from "@/utils/pdfGenerator";
import { 
  mensalidadesApi, 
  metasFinanceirasApi, 
  alunosApi, 
  matriculasApi, 
  matriculasAnuaisApi,
  profilesApi,
  cursosApi,
  anoLetivoApi
} from "@/services/api";
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";

interface Mensalidade {
  id: string;
  aluno_id: string;
  valor: number;
  status: string;
  data_vencimento: string;
  data_pagamento: string | null;
  multa: boolean;
  valor_multa: number;
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

interface Aluno {
  id: string;
  nome_completo: string;
  email: string;
  numero_identificacao: string | null;
  numero_identificacao_publica: string | null;
}

export default function SecretariaDashboard() {
  const queryClient = useQueryClient();
  const { config, tipoAcademico } = useInstituicao();
  const { instituicaoId, shouldFilter, isSuperAdmin } = useTenantFilter();
  const { financeiro, messages } = useRolePermissions();
  const { hasAnoLetivoAtivo, anoLetivo } = useAnoLetivoAtivo();
  
  // Debug log (only in development)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[SecretariaDashboard] Tenant filter:', { instituicaoId, shouldFilter, isSuperAdmin });
  }
  const { signOut, role } = useAuth();
  const navigate = useNavigate();
  const isSecretaria = role === 'SECRETARIA';
  const isFinanceiro = role === 'FINANCEIRO';
  const basePath = isSecretaria ? '/secretaria-dashboard' : '/admin-dashboard';
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [formaPagamentoFilter, setFormaPagamentoFilter] = useState<string>("todos");
  const [mesFilter, setMesFilter] = useState<string>("todos");
  const [showPagamentoDialog, setShowPagamentoDialog] = useSafeDialog(false);
  const [showHistoricoDialog, setShowHistoricoDialog] = useSafeDialog(false);
  const [showGerarDialog, setShowGerarDialog] = useSafeDialog(false);
  const [selectedMensalidade, setSelectedMensalidade] = useState<Mensalidade | null>(null);
  const [selectedAlunoId, setSelectedAlunoId] = useState<string | null>(null);
  const [selectedAlunoNome, setSelectedAlunoNome] = useState<string>("");
  const [formaPagamento, setFormaPagamento] = useState("Transferência Bancária");
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [showPrintDialog, setShowPrintDialog] = useSafeDialog(false);
  const [printReciboData, setPrintReciboData] = useState<ReciboData | null>(null);
  const [novoMes, setNovoMes] = useState(new Date().getMonth() + 1);
  const [novoAno, setNovoAno] = useState(new Date().getFullYear());

  // Fetch all students for generating new mensalidades
  const { data: alunos } = useQuery({
    queryKey: ["alunos-pagamentos", instituicaoId],
    queryFn: async () => {
      const params = shouldFilter && instituicaoId ? { instituicaoId } : undefined;
      const data = await alunosApi.getAll(params);
      return data as (Aluno & { instituicao_id: string | null })[];
    },
    enabled: !!instituicaoId || isSuperAdmin || isStaffWithFallback(role),
  });

  // Fetch mensalidades with profiles, curso and turma
  const { data: mensalidades, isLoading, error } = useQuery({
    queryKey: ["mensalidades-secretaria", instituicaoId],
    queryFn: async () => {
      try {
        // CRITICAL: Do NOT send instituicaoId from frontend - it comes from token
        // The backend will automatically filter by the user's instituicaoId from the token
        const params: any = {};
        
        console.log('[SecretariaDashboard] Fetching mensalidades with params:', params);
        console.log('[SecretariaDashboard] instituicaoId from hook:', instituicaoId);
        console.log('[SecretariaDashboard] isSuperAdmin:', isSuperAdmin);
        
        const mensalidadesData = await mensalidadesApi.getAll(params);
        
        console.log('[SecretariaDashboard] Received mensalidades:', mensalidadesData?.length || 0);
        
        // Return empty array if no data (this is valid - means no mensalidades exist yet)
        if (!mensalidadesData || mensalidadesData.length === 0) {
          console.log('[SecretariaDashboard] No mensalidades found');
          return [] as Mensalidade[];
        }

        const alunoIds = [...new Set(mensalidadesData.map((m: any) => m.aluno_id))];
        
        if (alunoIds.length === 0) {
          console.log('[SecretariaDashboard] No aluno IDs found in mensalidades');
          return [] as Mensalidade[];
        }

        // Fetch profiles for all alunos
        const profilesData = await profilesApi.getAll();
        const profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]) || []);

        // Fetch matriculas (turma) e matriculas anuais (inscrição) para curso/turma
        const [matriculasData, matriculasAnuaisData] = await Promise.all([
          matriculasApi.getAll(),
          matriculasAnuaisApi.getAll({ status: 'ATIVA' }).catch(() => []),
        ]);
        
        // Mapa: Matricula em turma (turma.curso, turma.nome) – prioridade
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
            const anoFreq = formatAnoFrequenciaSuperior(turma);
            const classeFreq = turma?.classe?.nome ?? null;
            const anoL =
              m.ano_letivo ?? m.anoLetivo ?? m.anoLetivoRef?.ano ?? null;
            alunoInfoMap.set(aid, {
              curso_nome: turma?.curso?.nome || 'N/A',
              turma_nome: extrairNomeTurmaRecibo(turma?.nome) || turma?.nome || 'N/A',
              anoFrequencia: anoFreq,
              classeFrequencia: classeFreq,
              anoLetivo: anoL,
            });
          }
        });
        // Fallback: MatriculaAnual (inscrito) – curso da inscrição
        (matriculasAnuaisData as any[])?.forEach((ma: any) => {
          const aid = ma.aluno_id ?? ma.alunoId;
          if (aid && !alunoInfoMap.has(aid)) {
            const cursoNome = ma.curso?.nome ?? 'N/A';
            alunoInfoMap.set(aid, {
              curso_nome: cursoNome,
              turma_nome: ma.classeOuAnoCurso ?? ma.classe_ou_ano_curso ?? '-',
              classeFrequencia: ma.classe?.nome ?? ma.classeOuAnoCurso ?? ma.classe_ou_ano_curso ?? null,
              anoFrequencia: ma.nivelEnsino === 'SUPERIOR' ? (ma.classeOuAnoCurso ?? ma.classe_ou_ano_curso) : null,
              anoLetivo: ma.ano_letivo ?? ma.anoLetivo ?? ma.anoLetivoRef?.ano ?? null,
            });
          }
        });

        const result = mensalidadesData.map((m: any) => {
          const aid = m.aluno_id ?? m.alunoId ?? m.aluno?.id;
          return {
            ...m,
            profiles: profilesMap.get(aid),
            curso_nome: alunoInfoMap.get(aid)?.curso_nome ?? (m as { curso_nome?: string })?.curso_nome ?? m.curso?.nome ?? null,
            turma_nome: alunoInfoMap.get(aid)?.turma_nome ?? (m as { turma_nome?: string })?.turma_nome ?? null,
            ano_frequencia: alunoInfoMap.get(aid)?.anoFrequencia ?? (m as { ano_frequencia?: string })?.ano_frequencia ?? null,
            classe_frequencia: alunoInfoMap.get(aid)?.classeFrequencia ?? (m as { classe_nome?: string })?.classe_nome ?? null,
            ano_letivo: alunoInfoMap.get(aid)?.anoLetivo,
          };
        }) as Mensalidade[];

        console.log('[SecretariaDashboard] Processed mensalidades:', result.length);
        return result;
      } catch (err) {
        console.error('[SecretariaDashboard] Error fetching mensalidades:', err);
        // Return empty array on error to prevent UI breakage
        return [] as Mensalidade[];
      }
    },
    enabled: !!instituicaoId || isSuperAdmin || isStaffWithFallback(role),
    retry: 2,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch monthly goals
  const { data: metas } = useQuery({
    queryKey: ["metas-financeiras"],
    queryFn: async () => {
      const currentYear = new Date().getFullYear();
      const data = await metasFinanceirasApi.getAll({ ano: currentYear });
      return data;
    },
  });

  // Fetch total de alunos
  const { data: totalAlunos = 0 } = useQuery({
    queryKey: ["total-alunos-secretaria", instituicaoId],
    queryFn: async () => {
      try {
        const data = await alunosApi.getAll();
        return (data || []).length;
      } catch (error) {
        return 0;
      }
    },
    enabled: !!instituicaoId || isSuperAdmin || isStaffWithFallback(role),
  });

  // Fetch matrículas recentes (últimas 24h)
  const { data: matriculasRecentes = [] } = useQuery({
    queryKey: ["matriculas-recentes-secretaria", instituicaoId],
    queryFn: async () => {
      try {
        const hoje = new Date();
        const ontem = new Date(hoje);
        ontem.setDate(ontem.getDate() - 1);
        
        const data = await matriculasApi.getAll();
        return (data || []).filter((m: any) => {
          const dataMatricula = new Date(m.createdAt || m.created_at || m.dataMatricula || m.data_matricula);
          return dataMatricula >= ontem;
        }).slice(0, 10);
      } catch (error) {
        return [];
      }
    },
    enabled: !!instituicaoId || isSuperAdmin || isStaffWithFallback(role),
  });

  // Fetch pagamentos recentes (últimas 24h)
  const { data: pagamentosRecentes = [] } = useQuery({
    queryKey: ["pagamentos-recentes-secretaria", mensalidades],
    queryFn: async () => {
      if (!mensalidades) return [];
      try {
        const hoje = new Date();
        const ontem = new Date(hoje);
        ontem.setDate(ontem.getDate() - 1);
        
        return mensalidades.filter((m: any) => {
          if (m.status !== 'Pago' || !m.data_pagamento) return false;
          const dataPagamento = new Date(m.data_pagamento);
          return dataPagamento >= ontem;
        }).slice(0, 10);
      } catch (error) {
        return [];
      }
    },
    enabled: !!mensalidades,
  });

  // Fetch historico for selected student
  const { data: historicoAluno } = useQuery({
    queryKey: ["historico-aluno", selectedAlunoId],
    queryFn: async () => {
      if (!selectedAlunoId) return [];
      const data = await mensalidadesApi.getAll({ alunoId: selectedAlunoId });
      return data;
    },
    enabled: !!selectedAlunoId,
  });

  // Generate mensalidades for all students - valores vêm automaticamente do curso
  const gerarMensalidadesMutation = useMutation({
    mutationFn: async ({ mes, ano }: { mes: number; ano: number }) => {
      // Calcular data de vencimento (dia 5 do mês seguinte)
      const dataVencimento = new Date(ano, mes, 5);
      const dataVencimentoStr = dataVencimento.toISOString().split('T')[0];

      // Chamar endpoint do backend que busca valores automaticamente do curso
      const result = await mensalidadesApi.gerarParaTodos({
        mesReferencia: mes,
        anoReferencia: ano,
        dataVencimento: dataVencimentoStr,
      });

      return result.count || 0;
    },
    onSuccess: (count) => {
      setShowGerarDialog(false);
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: ["mensalidades-secretaria"] });
      });
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

  // Mark payment - recibo gerado pelo backend ao confirmar
  const marcarPagoMutation = useMutation({
    mutationFn: async ({ id, formaPagamento, dataPagamento }: { id: string; formaPagamento: string; dataPagamento: string }) => {
      // Não enviar reciboNumero - backend emite ao confirmar
      const response = await mensalidadesApi.update(id, {
        status: "Pago",
        dataPagamento,
        formaPagamento,
      });

      const reciboNumero = response?.comprovativo || response?.recibo_numero || `RCB-${Date.now()}`;
      return { reciboNumero, mensalidadeId: id };
    },
    onSuccess: async ({ reciboNumero }) => {
      // Invalidar em microtask - UI (toast, dialog) atualiza antes do refetch
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: ["mensalidades-secretaria"] });
        queryClient.invalidateQueries({ queryKey: ["historico-aluno"] });
      });
      
      if (selectedMensalidade) {
        const reciboData: ReciboData = {
          instituicao: {
            nome: config?.nome_instituicao || 'Universidade',
            nif: (config as { nif?: string })?.nif ?? null,
            logoUrl: config?.logo_url,
            email: config?.email,
            telefone: config?.telefone,
            endereco: config?.endereco,
            tipoAcademico: tipoAcademico ?? config?.tipo_academico ?? null,
          },
          aluno: {
            nome: (selectedMensalidade.profiles?.nome_completo ?? selectedMensalidade.aluno?.nome_completo) || 'N/A',
            numeroId: selectedMensalidade.profiles?.numero_identificacao_publica ?? selectedMensalidade.aluno?.numero_identificacao_publica ?? null,
            bi: selectedMensalidade.profiles?.numero_identificacao ?? selectedMensalidade.aluno?.numero_identificacao ?? null,
            email: selectedMensalidade.profiles?.email ?? selectedMensalidade.aluno?.email ?? null,
            curso: selectedMensalidade.curso_nome,
            turma: selectedMensalidade.turma_nome,
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
      toast({
        title: "Pagamento registrado",
        description: `Recibo gerado: ${reciboNumero}`,
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
    const searchLower = String(searchTerm ?? '').toLowerCase();
    const numPub = m.profiles?.numero_identificacao_publica ?? m.aluno?.numero_identificacao_publica ?? '';
    const matchesSearch =
      String(m.profiles?.nome_completo ?? m.aluno?.nome_completo ?? '').toLowerCase().includes(searchLower) ||
      String(m.profiles?.email ?? m.aluno?.email ?? '').toLowerCase().includes(searchLower) ||
      String(numPub).toLowerCase().includes(searchLower) ||
      String(m.profiles?.numero_identificacao ?? m.aluno?.numero_identificacao ?? '').toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === "todos" || m.status === statusFilter;
    const matchesFormaPagamento = formaPagamentoFilter === "todos" || m.forma_pagamento === formaPagamentoFilter;
    const matchesMes = mesFilter === "todos" || m.mes_referencia === parseInt(mesFilter);

    return matchesSearch && matchesStatus && matchesFormaPagamento && matchesMes;
  });

  const stats = {
    total: mensalidades?.length || 0,
    pendentes: mensalidades?.filter((m) => m.status === "Pendente").length || 0,
    pagos: mensalidades?.filter((m) => m.status === "Pago").length || 0,
    atrasados: mensalidades?.filter((m) => m.status === "Atrasado").length || 0,
    valorRecebido: mensalidades?.filter((m) => m.status === "Pago").reduce((acc, m) => acc + Number(m.valor), 0) || 0,
    valorPendente: mensalidades?.filter((m) => m.status !== "Pago").reduce((acc, m) => acc + Number(m.valor) + Number(m.valor_multa || 0), 0) || 0,
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

  const handleGerarRecibo = async (mensalidade: Mensalidade) => {
    const reciboData: ReciboData = {
      instituicao: {
        nome: config?.nome_instituicao || 'Universidade',
        nif: (config as { nif?: string })?.nif ?? null,
        logoUrl: config?.logo_url,
        email: config?.email,
        telefone: config?.telefone,
        endereco: config?.endereco,
        tipoAcademico: tipoAcademico ?? config?.tipo_academico ?? null,
      },
      aluno: {
        nome: (mensalidade.profiles?.nome_completo ?? mensalidade.aluno?.nome_completo) || 'N/A',
        numeroId: mensalidade.profiles?.numero_identificacao_publica ?? mensalidade.aluno?.numero_identificacao_publica ?? null,
        bi: mensalidade.profiles?.numero_identificacao ?? mensalidade.aluno?.numero_identificacao ?? null,
        email: mensalidade.profiles?.email ?? mensalidade.aluno?.email ?? null,
        curso: mensalidade.curso_nome,
        turma: mensalidade.turma_nome,
        anoLetivo: mensalidade.ano_letivo ?? null,
        anoFrequencia: mensalidade.ano_frequencia ?? null,
        classeFrequencia: mensalidade.classe_frequencia ?? null,
        tipoAcademico: tipoAcademico ?? config?.tipo_academico ?? null,
      },
      pagamento: {
        valor: Number(mensalidade.valor),
        valorDesconto: Number(mensalidade.valor_desconto || 0),
        valorMulta: Number(mensalidade.valor_multa || 0),
        valorJuros: Number(mensalidade.valor_juros || 0),
        mesReferencia: mensalidade.mes_referencia,
        anoReferencia: mensalidade.ano_referencia,
        dataPagamento: mensalidade.data_pagamento || new Date().toISOString(),
        formaPagamento: mensalidade.forma_pagamento || 'N/A',
        reciboNumero: mensalidade.recibo_numero || `REC-${mensalidade.id.substring(0, 8)}`,
      },
    };
    setPrintReciboData(reciboData);
    setShowPrintDialog(true);
  };

  const handleExportarRelatorio = async () => {
    try {
      const pagos = mensalidades?.filter(m => m.status === 'Pago') || [];
      const totalRecebido = pagos.reduce((acc, m) => 
        acc + Number(m.valor) 
        - Number(m.valor_desconto || 0)
        + Number(m.valor_multa || 0)
        + Number(m.valor_juros || 0), 0);
      
      const totalMultas = mensalidades?.reduce((acc, m) => acc + Number(m.valor_multa || 0), 0) || 0;
      const totalJuros = mensalidades?.reduce((acc, m) => acc + Number(m.valor_juros || 0), 0) || 0;
      
      await gerarRelatorioPDF({
        instituicao: {
          nome: config?.nome_instituicao || 'Universidade',
        },
        titulo: 'Relatório Financeiro',
        periodo: `${new Date().toLocaleDateString('pt-AO')}`,
        dados: [
          { label: 'Total de Mensalidades', valor: mensalidades?.length || 0 },
          { label: 'Pagamentos Realizados', valor: stats.pagos },
          { label: 'Pendentes', valor: stats.pendentes },
          { label: 'Atrasados', valor: stats.atrasados },
          { label: 'Total Recebido', valor: formatCurrency(totalRecebido) },
          { label: 'Total Pendente', valor: formatCurrency(stats.valorPendente) },
          { label: 'Total de Multas', valor: formatCurrency(totalMultas) },
          { label: 'Total de Juros', valor: formatCurrency(totalJuros) },
        ],
        tabela: {
          headers: ['Estudante', 'Curso', 'Turma', 'Referência', 'Valor', 'Status'],
          rows: (filteredMensalidades || []).slice(0, 50).map(m => [
            m.profiles?.nome_completo || 'N/A',
            m.curso_nome || '-',
            m.turma_nome || '-',
            `${getMesNome(m.mes_referencia)}/${m.ano_referencia}`,
            formatCurrency(Number(m.valor)),
            m.status
          ])
        }
      });
      toast({
        title: "Relatório exportado",
        description: "O relatório PDF foi baixado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: "Ocorreu um erro ao gerar o relatório.",
        variant: "destructive",
      });
    }
  };

  const handleExportarExcel = () => {
    try {
      const data = (filteredMensalidades || []).map(m => ({
        'Estudante': m.profiles?.nome_completo ?? m.aluno?.nome_completo ?? 'N/A',
        'Nº': m.profiles?.numero_identificacao_publica ?? m.aluno?.numero_identificacao_publica ?? '-',
        'Curso': m.curso_nome || '-',
        'Turma': m.turma_nome || '-',
        'Referência': `${getMesNome(m.mes_referencia)}/${m.ano_referencia}`,
        'Valor': Number(m.valor),
        'Multa': Number(m.valor_multa || 0),
        'Total': Number(m.valor) + Number(m.valor_multa || 0),
        'Vencimento': format(new Date(m.data_vencimento), "dd/MM/yyyy"),
        'Status': m.status,
        'Data Pagamento': m.data_pagamento ? format(new Date(m.data_pagamento), "dd/MM/yyyy") : '-',
        'Forma Pagamento': m.forma_pagamento || '-',
        'Recibo': m.recibo_numero || '-',
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mensalidades");
      XLSX.writeFile(wb, `relatorio-mensalidades-${Date.now()}.xlsx`);

      toast({
        title: "Relatório exportado",
        description: "O arquivo Excel foi baixado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: "Ocorreu um erro ao gerar o Excel.",
        variant: "destructive",
      });
    }
  };

  const handleEnviarLembretes = async () => {
    try {
      await mensalidadesApi.enviarLembretes(instituicaoId || undefined);
      toast({
        title: "Lembretes enviados",
        description: "Os lembretes foram enviados para os estudantes em atraso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao enviar lembretes",
        description: "Ocorreu um erro ao enviar os lembretes.",
        variant: "destructive",
      });
    }
  };

  // Calculate current month goal progress
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const currentMeta = metas?.find(m => m.mes === currentMonth);
  const currentMonthReceived = mensalidades
    ?.filter(m => m.status === 'Pago' && m.mes_referencia === currentMonth && m.ano_referencia === currentYear)
    .reduce((acc, m) => acc + Number(m.valor), 0) || 0;
  const metaProgress = currentMeta?.valor_meta ? (currentMonthReceived / Number(currentMeta.valor_meta)) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold">Painel Administrativo</h1>
            <p className="text-muted-foreground">
              Operação administrativa rápida e segura
            </p>
          </div>
        </div>

        {/* TOPO — STATUS */}
        {hasAnoLetivoAtivo && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Ano Letivo Ativo</CardDescription>
                <CardTitle className="text-2xl">{anoLetivo || '-'}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total de Estudantes</CardDescription>
                <CardTitle className="text-2xl">{totalAlunos}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Matrículas do Dia</CardDescription>
                <CardTitle className="text-2xl">{matriculasRecentes.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* AÇÕES RÁPIDAS */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>
              {isFinanceiro ? 'Operações financeiras' : 'Operações administrativas frequentes'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {!isFinanceiro && (
                <>
                  <Button 
                    variant="outline" 
                    className="h-auto flex-col items-start p-4"
                    onClick={() => navigate(`${basePath}/criar-aluno`)}
                  >
                    <User className="h-5 w-5 mb-2" />
                    <span className="font-medium">Matricular Estudante</span>
                    <span className="text-xs text-muted-foreground">Nova matrícula</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto flex-col items-start p-4"
                    onClick={() => navigate(isSecretaria ? `${basePath}/alunos?tab=alunos` : `${basePath}/gestao-alunos?tab=alunos`)}
                  >
                    <Users className="h-5 w-5 mb-2" />
                    <span className="font-medium">Transferência</span>
                    <span className="text-xs text-muted-foreground">Transferir aluno</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto flex-col items-start p-4"
                    onClick={() => navigate(`${basePath}/documentos-alunos`)}
                  >
                    <FileText className="h-5 w-5 mb-2" />
                    <span className="font-medium">Emitir Documento</span>
                    <span className="text-xs text-muted-foreground">Certificados e declarações</span>
                  </Button>
                </>
              )}
              {financeiro.canCreate && (
                <Button 
                  variant="outline" 
                  className="h-auto flex-col items-start p-4"
                  onClick={() => setShowPagamentoDialog(true)}
                >
                  <Receipt className="h-5 w-5 mb-2" />
                  <span className="font-medium">Registrar Pagamento</span>
                  <span className="text-xs text-muted-foreground">Mensalidades</span>
                </Button>
              )}
              {isFinanceiro && (
                <Button 
                  variant="outline" 
                  className="h-auto flex-col items-start p-4"
                  onClick={() => navigate('/admin-dashboard/gestao-financeira')}
                >
                  <BarChart3 className="h-5 w-5 mb-2" />
                  <span className="font-medium">Relatórios Financeiros</span>
                  <span className="text-xs text-muted-foreground">Receitas, atrasos, exportar PDF</span>
                </Button>
              )}
              {isFinanceiro && financeiro.canCreate && (
                <Button 
                  variant="outline" 
                  className="h-auto flex-col items-start p-4"
                  onClick={() => setShowGerarDialog(true)}
                >
                  <Plus className="h-5 w-5 mb-2" />
                  <span className="font-medium">Gerar Mensalidades</span>
                  <span className="text-xs text-muted-foreground">Lançar novas mensalidades</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* LISTAS PRINCIPAIS */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Matrículas Recentes — oculto para FINANCEIRO (sem acesso a gestao-alunos) */}
          {!isFinanceiro && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Matrículas Recentes</CardTitle>
                <CardDescription>Últimas 24 horas</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate(isSecretaria ? `${basePath}/matriculas` : `${basePath}/gestao-alunos`)}>
                Ver todas
              </Button>
            </CardHeader>
            <CardContent>
              {matriculasRecentes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma matrícula registrada nas últimas 24 horas.
                </p>
              ) : (
                <div className="space-y-2">
                  {matriculasRecentes.slice(0, 5).map((matricula: any) => (
                    <div key={matricula.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">
                          {matricula.aluno?.nomeCompleto || matricula.aluno?.nome_completo || 'Estudante'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {matricula.turma?.nome || '-'} • {format(new Date(matricula.createdAt || matricula.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant="default">Nova</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Pagamentos Recentes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pagamentos Recentes</CardTitle>
                <CardDescription>Últimas 24 horas</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate(isSecretaria ? '/secretaria-dashboard' : '/admin-dashboard/pagamentos')}>
                Ver todos
              </Button>
            </CardHeader>
            <CardContent>
              {pagamentosRecentes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum pagamento registrado nas últimas 24 horas.
                </p>
              ) : (
                <div className="space-y-2">
                  {pagamentosRecentes.slice(0, 5).map((mensalidade: any) => (
                    <div key={mensalidade.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{mensalidade.profiles?.nome_completo || 'Estudante'}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(Number(mensalidade.valor))} • {format(new Date(mensalidade.data_pagamento), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant="default" className="bg-green-500/10 text-green-500">
                        Pago
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.valorRecebido)}</div>
              <p className="text-xs text-muted-foreground">{stats.pagos} pagamentos realizados</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pendentes}</div>
              <p className="text-xs text-muted-foreground">aguardando pagamento</p>
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">A Receber</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.valorPendente)}</div>
              <p className="text-xs text-muted-foreground">em aberto</p>
            </CardContent>
          </Card>
        </div>

        {/* Meta Progress */}
        {currentMeta && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Meta do Mês ({getMesNome(currentMonth)})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Progress value={Math.min(metaProgress, 100)} className="flex-1" />
                <span className="text-sm font-medium">
                  {formatCurrency(currentMonthReceived)} / {formatCurrency(Number(currentMeta.valor_meta))}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for different views */}
        <Tabs defaultValue="mensalidades" className="space-y-4">
          <TabsList>
            <TabsTrigger value="mensalidades">
              <DollarSign className="h-4 w-4 mr-2" />
              Mensalidades
            </TabsTrigger>
            <TabsTrigger value="graficos">
              <BarChart3 className="h-4 w-4 mr-2" />
              Gráficos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mensalidades">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Mensalidades</CardTitle>
                <CardDescription>
                  Gerencie pagamentos dos estudantes com informações de curso e turma
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-wrap gap-4 mb-6">
                  <div className="flex-1 min-w-[250px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nome, matrícula ou email..."
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
                  <Select value={formaPagamentoFilter} onValueChange={setFormaPagamentoFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Forma Pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas Formas</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Transferência Bancária">Transferência</SelectItem>
                      <SelectItem value="Multicaixa">Multicaixa</SelectItem>
                      <SelectItem value="Depósito Bancário">Depósito</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
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

                {/* Table */}
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
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Estudante</TableHead>
                          <TableHead>Nº</TableHead>
                          <TableHead>Curso</TableHead>
                          <TableHead>Turma</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Mês Ref.</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMensalidades.map((mensalidade) => (
                          <TableRow key={mensalidade.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{mensalidade.profiles?.nome_completo}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {mensalidade.profiles?.numero_identificacao_publica ?? mensalidade.aluno?.numero_identificacao_publica ?? '-'}
                            </TableCell>
                            <TableCell>{mensalidade.curso_nome}</TableCell>
                            <TableCell>{mensalidade.turma_nome}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{formatCurrency(Number(mensalidade.valor) - Number(mensalidade.valor_desconto || 0))}</p>
                                {Number(mensalidade.valor_desconto || 0) > 0 && (
                                  <p className="text-xs text-green-600">
                                    -{formatCurrency(Number(mensalidade.valor_desconto))} desconto
                                  </p>
                                )}
                                {Number(mensalidade.valor_multa || 0) > 0 && (
                                  <p className="text-xs text-destructive">
                                    +{formatCurrency(Number(mensalidade.valor_multa))} multa
                                  </p>
                                )}
                                {Number(mensalidade.valor_juros || 0) > 0 && (
                                  <p className="text-xs text-destructive">
                                    +{formatCurrency(Number(mensalidade.valor_juros))} juros
                                  </p>
                                )}
                                <p className="font-semibold text-primary border-t pt-1 mt-1">
                                  Total: {formatCurrency(
                                    Number(mensalidade.valor) 
                                    - Number(mensalidade.valor_desconto || 0)
                                    + Number(mensalidade.valor_multa || 0)
                                    + Number(mensalidade.valor_juros || 0)
                                  )}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getMesNome(mensalidade.mes_referencia)}/{mensalidade.ano_referencia}
                            </TableCell>
                            <TableCell>
                              {format(new Date(mensalidade.data_vencimento), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell>{getStatusBadge(mensalidade.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedAlunoId(mensalidade.aluno_id);
                                    setSelectedAlunoNome(mensalidade.profiles?.nome_completo || '');
                                    setShowHistoricoDialog(true);
                                  }}
                                  title="Ver histórico"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                                {mensalidade.status !== "Pago" ? (
                                  // SECRETARIA não pode registrar pagamentos - apenas consulta
                                  financeiro.canCreate ? (
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedMensalidade(mensalidade);
                                        setShowPagamentoDialog(true);
                                      }}
                                    >
                                      Marcar como Pago
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled
                                      title={messages.secretariaCannotRegisterPayment}
                                    >
                                      Consultar apenas
                                    </Button>
                                  )
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleGerarRecibo(mensalidade)}
                                    title="🖨 Imprimir Comprovante"
                                  >
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">Nenhuma mensalidade encontrada</p>
                    <p className="text-sm mt-1">
                      {mensalidades && mensalidades.length === 0 
                        ? "Não há mensalidades cadastradas. Use o botão 'Gerar Mensalidades' para criar."
                        : "Nenhuma mensalidade corresponde aos filtros selecionados."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="graficos">
            {mensalidades && <FinancialCharts mensalidades={mensalidades} />}
          </TabsContent>
        </Tabs>

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

        {/* Dialog: Registrar Pagamento */}
        <Dialog open={showPagamentoDialog} onOpenChange={setShowPagamentoDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Marcar como Pago</DialogTitle>
              <DialogDescription>
                Informe os dados do pagamento
              </DialogDescription>
            </DialogHeader>
            {selectedMensalidade && (
              <div className="space-y-4 py-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="font-medium">{selectedMensalidade.profiles?.nome_completo}</p>
                  <p className="text-sm text-muted-foreground">
                    Curso: {selectedMensalidade.curso_nome} | Turma: {selectedMensalidade.turma_nome}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Referência: {getMesNome(selectedMensalidade.mes_referencia)}/{selectedMensalidade.ano_referencia}
                  </p>
                  <p className="text-lg font-bold">
                    Total: {formatCurrency(Number(selectedMensalidade.valor) + Number(selectedMensalidade.valor_multa || 0))}
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
                {marcarPagoMutation.isPending ? "Processando..." : "Confirmar Pagamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Histórico do Estudante */}
        <Dialog open={showHistoricoDialog} onOpenChange={setShowHistoricoDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Histórico de Pagamentos</DialogTitle>
              <DialogDescription>
                {selectedAlunoNome}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              {historicoAluno && historicoAluno.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referência</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoAluno.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          {getMesNome(m.mes_referencia)}/{m.ano_referencia}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(Number(m.valor))}
                          {m.multa && (
                            <span className="text-xs text-destructive block">
                              +{formatCurrency(Number(m.valor_multa))} multa
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(m.status)}</TableCell>
                        <TableCell>
                          {m.data_pagamento
                            ? format(new Date(m.data_pagamento), "dd/MM/yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {m.status === "Pago" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const mensalidadeComProfile = {
                                  ...m,
                                  profiles: mensalidades?.find(msg => msg.id === m.id)?.profiles,
                                  curso_nome: mensalidades?.find(msg => msg.aluno_id === m.aluno_id)?.curso_nome,
                                  turma_nome: mensalidades?.find(msg => msg.aluno_id === m.aluno_id)?.turma_nome,
                                } as Mensalidade;
                                handleGerarRecibo(mensalidadeComProfile);
                              }}
                              title="Imprimir Comprovante"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum histórico encontrado
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Print Receipt Dialog */}
      <PrintReceiptDialog
        open={showPrintDialog}
        onOpenChange={setShowPrintDialog}
        reciboData={printReciboData}
      />
    </DashboardLayout>
  );
}