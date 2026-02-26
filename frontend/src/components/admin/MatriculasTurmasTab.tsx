import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { matriculasApi, alunosApi, turmasApi, matriculasAnuaisApi, relatoriosApi, anoLetivoApi, planoEnsinoApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { AnoLetivoAtivoGuard } from "@/components/academico/AnoLetivoAtivoGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ResponsiveTable } from "@/components/common/ResponsiveTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Search, GraduationCap, Users, Printer, AlertCircle, FileText, ArrowRightLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { PrintMatriculaDialog } from "@/components/secretaria/PrintMatriculaDialog";
import { MatriculaReciboData, gerarCodigoMatricula, getNumeroPublicoAluno } from "@/utils/pdfGenerator";
import { AxiosError } from "axios";
import { getApiErrorMessage } from "@/utils/apiErrors";
import { SmartSearch } from "@/components/common/SmartSearch";
import { useAlunoSearch } from "@/hooks/useSmartSearch";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MatriculaTurma {
  id: string;
  status: string;
  created_at: string;
  aluno: {
    id: string;
    nomeCompleto: string;
    email: string;
    numeroIdentificacao: string | null;
    numeroIdentificacaoPublica: string | null;
  } | null;
  turma: {
    id: string;
    nome: string;
    ano: number;
    semestre: string;
    curso: { nome: string } | null;
    classe?: { nome: string } | null;
    anoLetivoRef?: { ano: number } | null;
  } | null;
  anoLetivoRef?: { ano: number } | null;
}

interface Aluno {
  id: string;
  nomeCompleto?: string;
  nome_completo?: string; // Suporte para ambos os formatos
  email?: string;
  numeroIdentificacao?: string | null;
  numero_identificacao?: string | null; // Suporte para ambos os formatos
  numeroIdentificacaoPublica?: string | null;
  numero_identificacao_publica?: string | null; // Suporte para ambos os formatos
}

interface Turma {
  id: string;
  nome: string;
  ano: number | null;
  semestre: number | null;
  anoLetivoId?: string;
  cursoId?: string | null;
  classeId?: string | null;
  curso: { nome: string } | null;
  classe?: { nome: string } | null;
}

interface MatriculaAnual {
  id: string;
  alunoId: string;
  instituicaoId: string;
  anoLetivo?: number | null;
  anoLetivoId?: string | null;
  nivelEnsino: 'SECUNDARIO' | 'SUPERIOR';
  classeOuAnoCurso: string;
  cursoId?: string | null;
  classeId?: string | null;
  status: string;
}

export function MatriculasTurmasTab() {
  const { config, instituicao, isSecundario } = useInstituicao();
  const { user } = useAuth();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const { searchAlunos } = useAlunoSearch();
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useSafeDialog(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTurma, setFilterTurma] = useState<string>("all");
  const [showPrintDialog, setShowPrintDialog] = useSafeDialog(false);
  const [printMatriculaData, setPrintMatriculaData] = useState<MatriculaReciboData | null>(null);
  const [listaAdmitidosDialogOpen, setListaAdmitidosDialogOpen] = useSafeDialog(false);
  const [listaAdmitidosAnoLetivoId, setListaAdmitidosAnoLetivoId] = useState<string>("");
  const [listaAdmitidosTurmaId, setListaAdmitidosTurmaId] = useState<string>("");
  const [transferDialogOpen, setTransferDialogOpen] = useSafeDialog(false);
  const [transferMatricula, setTransferMatricula] = useState<MatriculaTurma | null>(null);
  const [transferNovaTurmaId, setTransferNovaTurmaId] = useState<string>("");
  const [formData, setFormData] = useState({
    aluno_id: "",
    turma_id: "",
    status: "Ativa", // Valores do enum: Ativa, Trancada, Concluida, Cancelada
  });

  const queryClient = useQueryClient();

  // Fetch matriculas anuais (para Ano de Frequência no comprovativo)
  const { data: matriculasAnuais = [] } = useQuery({
    queryKey: ["matriculas-anuais-turmas", instituicaoId],
    queryFn: async () => {
      const response = await matriculasAnuaisApi.getAll({});
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  // Fetch matriculas
  const { data: matriculas = [], isLoading } = useQuery({
    queryKey: ["matriculas-turmas", instituicaoId],
    queryFn: async () => {
      const response = await matriculasApi.getAll({});
      const data = response?.data ?? [];
      // Debug: verificar estrutura dos dados
      if (data.length > 0 && process.env.NODE_ENV !== 'production') {
        console.log('[MatriculasTurmasTab] Primeira matrícula:', data[0]);
      }
      return data;
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  // Fetch alunos
  const { data: alunos = [] } = useQuery({
    queryKey: ["alunos-para-matricula", instituicaoId],
    queryFn: async () => {
      const response = await alunosApi.getAll({ instituicaoId: instituicaoId || undefined });
      return response?.data ?? [];
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  // Buscar matrícula anual ativa do aluno selecionado
  const { data: matriculaAnual } = useQuery<MatriculaAnual | null>({
    queryKey: ["matricula-anual-ativa", formData.aluno_id, instituicaoId],
    queryFn: async () => {
      if (!formData.aluno_id) return null;
      const response = await matriculasAnuaisApi.getAtivaByAluno(formData.aluno_id);
      return (response as MatriculaAnual) || null;
    },
    enabled: !!formData.aluno_id && (!!instituicaoId || isSuperAdmin),
  });

  // Matrícula anual do aluno em transferência (para turmas compatíveis)
  const alunoIdTransferencia = transferMatricula?.aluno?.id ?? (transferMatricula as { alunoId?: string })?.alunoId ?? "";
  const { data: matriculaAnualTransferencia } = useQuery<MatriculaAnual | null>({
    queryKey: ["matricula-anual-ativa-transferencia", alunoIdTransferencia, instituicaoId],
    queryFn: async () => {
      if (!alunoIdTransferencia) return null;
      const response = await matriculasAnuaisApi.getAtivaByAluno(alunoIdTransferencia);
      return (response as MatriculaAnual) || null;
    },
    enabled: !!alunoIdTransferencia && (!!instituicaoId || isSuperAdmin),
  });

  // Fetch turmas - agora filtradas pela matrícula anual
  const { data: turmas = [] } = useQuery({
    queryKey: ["turmas-para-matricula", instituicaoId, matriculaAnual?.anoLetivoId, matriculaAnual?.cursoId, matriculaAnual?.classeId],
    queryFn: async () => {
      const response = await turmasApi.getAll({ instituicaoId: instituicaoId || undefined });
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  // Anos letivos (para Lista Admitidos)
  const { data: anosLetivos = [] } = useQuery({
    queryKey: ["anos-letivos-lista-admitidos", instituicaoId],
    queryFn: () => anoLetivoApi.getAll(),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  // Turmas filtradas por ano (para Lista Admitidos)
  const { data: turmasParaAdmitidos = [] } = useQuery({
    queryKey: ["turmas-lista-admitidos", instituicaoId, listaAdmitidosAnoLetivoId],
    queryFn: async () => {
      const response = await turmasApi.getAll({
        anoLetivoId: listaAdmitidosAnoLetivoId || undefined,
      });
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!listaAdmitidosAnoLetivoId && (!!instituicaoId || isSuperAdmin),
  });

  const imprimirListaAdmitidosMutation = useSafeMutation({
    mutationFn: async () => {
      if (!listaAdmitidosAnoLetivoId || !listaAdmitidosTurmaId) {
        throw new Error("Selecione o ano letivo e a turma");
      }
      const turma = (turmasParaAdmitidos as Turma[]).find((t: Turma) => t.id === listaAdmitidosTurmaId);
      await relatoriosApi.imprimirListaAdmitidos({
        anoLetivoId: listaAdmitidosAnoLetivoId,
        turmaId: listaAdmitidosTurmaId,
        cursoId: turma?.cursoId ?? undefined,
        classeId: turma?.classeId ?? undefined,
      });
    },
    onSuccess: () => {
      toast.success("Lista de admitidos gerada com sucesso!");
      setListaAdmitidosDialogOpen(false);
      setListaAdmitidosAnoLetivoId("");
      setListaAdmitidosTurmaId("");
    },
    onError: (error: Error) => {
      toast.error(getApiErrorMessage(error, "Erro ao gerar lista. Tente novamente."));
    },
  });

  const roles = (user as { roles?: string[] })?.roles ?? [];
  const canImprimirListaAdmitidos = roles.some((r: string) => ["ADMIN", "SUPER_ADMIN", "SECRETARIA"].includes(r));

  // Filtrar turmas compatíveis com a matrícula anual
  const turmasCompatíveis = useMemo(() => {
    if (!matriculaAnual || !turmas || turmas.length === 0) {
      return [];
    }

    return turmas.filter((turma: Turma) => {
      // 1. Mesma instituição
      // (validação já feita no backend através do filter)

      // 2. Mesmo ano letivo
      if (matriculaAnual.anoLetivoId && turma.anoLetivoId !== matriculaAnual.anoLetivoId) {
        return false;
      }

      // 3. Para Ensino Superior: mesmo curso
      if (matriculaAnual.nivelEnsino === 'SUPERIOR' && matriculaAnual.cursoId) {
        if (turma.cursoId !== matriculaAnual.cursoId) {
          return false;
        }
      }

      // 4. Para Ensino Secundário: mesma classe (se a turma tiver classe)
      if (matriculaAnual.nivelEnsino === 'SECUNDARIO' && matriculaAnual.classeId) {
        if (turma.classeId && turma.classeId !== matriculaAnual.classeId) {
          return false;
        }
      }

      return true;
    });
  }, [turmas, matriculaAnual]);

  // Turmas disponíveis para transferência (compatíveis, excluindo a atual)
  const turmasParaTransferencia = useMemo(() => {
    if (!matriculaAnualTransferencia || !turmas || turmas.length === 0 || !transferMatricula?.turma?.id) {
      return [];
    }
    const turmaAtualId = transferMatricula.turma.id;
    return turmas.filter((turma: Turma) => {
      if (turma.id === turmaAtualId) return false;
      if (matriculaAnualTransferencia.anoLetivoId && turma.anoLetivoId !== matriculaAnualTransferencia.anoLetivoId) {
        return false;
      }
      if (matriculaAnualTransferencia.nivelEnsino === "SUPERIOR" && matriculaAnualTransferencia.cursoId) {
        if (turma.cursoId !== matriculaAnualTransferencia.cursoId) return false;
      }
      if (matriculaAnualTransferencia.nivelEnsino === "SECUNDARIO" && matriculaAnualTransferencia.classeId) {
        if (turma.classeId && turma.classeId !== matriculaAnualTransferencia.classeId) return false;
      }
      return true;
    });
  }, [turmas, matriculaAnualTransferencia, transferMatricula]);

  const createMutation = useSafeMutation({
    mutationFn: async (data: typeof formData) => {
      await matriculasApi.create({
        alunoId: data.aluno_id,
        turmaId: data.turma_id,
        status: data.status, // Já está no formato correto do enum (Ativa, Trancada, Concluida, Cancelada)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas-turmas"] });
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      toast.success("Aluno matriculado na turma com sucesso!");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      let errorMessage = "Erro ao matricular estudante. Por favor, tente novamente.";
      
      // Tratar AxiosError
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const responseData = error.response?.data;
        
        // Tratar especificamente o erro 409 (Conflict)
        if (status === 409) {
          errorMessage = responseData?.message || 
            responseData?.error || 
            "Este aluno já está matriculado nesta turma.";
        } else {
          errorMessage = getApiErrorMessage(error, errorMessage);
        }
      } else if (error instanceof Error) {
        if (error.message.includes("duplicate") || 
            error.message.includes("unique") ||
            error.message.includes("já está matriculado") ||
            error.message.includes("já matriculado")) {
          errorMessage = "Este aluno já está matriculado nesta turma.";
        } else {
          errorMessage = getApiErrorMessage(error, errorMessage);
        }
      }
      
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await matriculasApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas-turmas"] });
      setDeleteDialogOpen(false);
      setDeletingId(null);
      toast.success("Matrícula removida com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(getApiErrorMessage(error, "Erro ao remover matrícula. Tente novamente."));
    },
  });

  const transferMutation = useSafeMutation({
    mutationFn: async ({ matriculaId, novaTurmaId }: { matriculaId: string; novaTurmaId: string }) => {
      await matriculasApi.update(matriculaId, { turmaId: novaTurmaId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas-turmas"] });
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      setTransferDialogOpen(false);
      setTransferMatricula(null);
      setTransferNovaTurmaId("");
      toast.success("Estudante transferido para a nova turma com sucesso!");
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Erro ao transferir estudante. Tente novamente."));
    },
  });

  const resetForm = () => {
    setFormData({
      aluno_id: "",
      turma_id: "",
      status: "Ativa",
    });
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.aluno_id || !formData.turma_id) {
      toast.error("Selecione um estudante e uma turma");
      return;
    }

    createMutation.mutate(formData);
  };

  const filteredMatriculas = matriculas?.filter((m: MatriculaTurma) => {
    const matchesSearch =
      m.aluno?.nomeCompleto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.aluno?.numeroIdentificacaoPublica?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.aluno?.numeroIdentificacao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.turma?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTurma = filterTurma === "all" || m.turma?.id === filterTurma;
    return matchesSearch && matchesTurma;
  });

  // Removido: filtragem manual de alunos - agora usa SmartSearch

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Ativa":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ativa</Badge>;
      case "Trancada":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Trancada</Badge>;
      case "Concluida":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Concluída</Badge>;
      case "Cancelada":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handlePrintMatricula = async (matricula: MatriculaTurma) => {
    // Para ensino secundário, obter disciplinas da turma via planos de ensino
    let disciplinasTurma: string[] = [];
    const turmaId = matricula.turma?.id;
    if (isSecundario && turmaId) {
      try {
        const planos = await planoEnsinoApi.getAll({ turmaId });
        const nomes = (planos || [])
          .map((p: any) => (p.disciplina?.nome || '').trim())
          .filter(Boolean) as string[];
        // Remover duplicados (mesma disciplina em vários trimestres)
        disciplinasTurma = Array.from(
          new Map(nomes.map((n) => [n.toLowerCase(), n])).values()
        ).sort((a, b) => a.localeCompare(b, 'pt'));
      } catch {
        // Ignorar erro – comprovante será gerado sem disciplinas
      }
    }
    const anoLetivoNum = (matricula as any).anoLetivoRef?.ano
      ?? matricula.turma?.anoLetivoRef?.ano
      ?? (matricula.turma?.ano && matricula.turma.ano > 2000 ? matricula.turma.ano : null)
      ?? new Date().getFullYear();
    const inst = (matricula as any)?.turma?.instituicao;
    const cfg = inst?.configuracao;
    const reciboData: MatriculaReciboData = {
      instituicao: {
        nome: cfg?.nomeInstituicao || inst?.nome || config?.nome_instituicao || instituicao?.nome || 'Instituição',
        nif: (config as { nif?: string })?.nif ?? null,
        logoUrl: (cfg?.logoUrl || inst?.logoUrl || config?.logo_url || instituicao?.logo_url) ?? null,
        email: (cfg?.email || inst?.emailContato || config?.email || instituicao?.email_contato) ?? null,
        telefone: (cfg?.telefone || inst?.telefone || config?.telefone || instituicao?.telefone) ?? null,
        endereco: (cfg?.endereco || inst?.endereco || config?.endereco || instituicao?.endereco) ?? null,
      },
      aluno: {
        nome: matricula.aluno?.nomeCompleto || 'N/A',
        numeroId: (() => {
          const fromMatricula = getNumeroPublicoAluno(matricula.aluno as Record<string, unknown>);
          if (fromMatricula) return fromMatricula;
          const alunoEnriquecido = (alunos as any[])?.find((a: any) => a.id === matricula.aluno?.id);
          return getNumeroPublicoAluno(alunoEnriquecido as Record<string, unknown>) ?? null;
        })(),
        bi: matricula.aluno?.numeroIdentificacao,
        email: matricula.aluno?.email,
      },
      matricula: {
        curso: isSecundario
          ? (matricula.turma?.curso?.nome ?? (() => {
              const ma = (matriculasAnuais as any[]).find((m: any) => (m.alunoId || m.aluno_id) === matricula.aluno?.id && (m.anoLetivoId === matricula.anoLetivoId || m.ano_letivo_id === matricula.anoLetivoId));
              return (ma as { curso?: { nome?: string } })?.curso?.nome ?? 'N/A';
            })())
          : (matricula.turma?.curso?.nome || 'N/A'),
        turma: matricula.turma?.nome || 'N/A',
        turno: (matricula.turma as { turno?: { nome?: string } })?.turno?.nome ?? null,
        disciplina: disciplinasTurma.length > 0 ? disciplinasTurma.join(', ') : 'Matrícula em Turma',
        disciplinas: disciplinasTurma.length > 0 ? disciplinasTurma : undefined,
        ano: matricula.turma?.ano || new Date().getFullYear(),
        semestre: matricula.turma?.semestre || '1',
        dataMatricula: matricula.dataMatricula || matricula.data_matricula || matricula.createdAt || matricula.created_at,
        reciboNumero: gerarCodigoMatricula(),
        tipoAcademico: isSecundario ? 'SECUNDARIO' : 'SUPERIOR',
        anoFrequencia: !isSecundario
          ? (() => {
              const ma = (matriculasAnuais as any[]).find(
                (m: any) =>
                  (m.alunoId || m.aluno_id) === matricula.aluno?.id &&
                  (m.anoLetivoId === matricula.anoLetivoId || m.ano_letivo_id === matricula.anoLetivoId)
              );
              return ma?.classeOuAnoCurso ?? ma?.classe_ou_ano_curso ?? null;
            })()
          : null,
        classeFrequencia: isSecundario
          ? ((matricula.turma as { classe?: { nome: string } })?.classe?.nome ??
            (() => {
              const ma = (matriculasAnuais as any[]).find(
                (m: any) =>
                  (m.alunoId || m.aluno_id) === matricula.aluno?.id &&
                  (m.anoLetivoId === matricula.anoLetivoId || m.ano_letivo_id === matricula.anoLetivoId)
              );
              return ma?.classeOuAnoCurso ?? ma?.classe_ou_ano_curso ?? null;
            })())
          : null,
        anoLetivoNumero: isSecundario ? (anoLetivoNum > 2000 ? anoLetivoNum : new Date().getFullYear()) : undefined,
      },
      pagamento: (() => {
        const taxa = Number(
          (isSecundario
            ? (matricula.turma as { classe?: { taxaMatricula?: number | null } })?.classe?.taxaMatricula
            : (matricula.turma as { curso?: { taxaMatricula?: number | null } })?.curso?.taxaMatricula) ??
          config?.taxaMatriculaPadrao ?? 0
        ) || 0;
        const mens = Number(
          (isSecundario
            ? (matricula.turma as { classe?: { valorMensalidade?: number } })?.classe?.valorMensalidade
            : (matricula.turma as { curso?: { valorMensalidade?: number } })?.curso?.valorMensalidade) ??
          config?.mensalidadePadrao ?? 0
        ) || 0;
        return {
          taxaMatricula: taxa,
          mensalidade: mens,
          totalPago: taxa + mens,
          formaPagamento: 'Transferência Bancária',
        };
      })(),
      encarregado: undefined,
      operador: user?.nome_completo ?? (user as { nomeCompleto?: string })?.nomeCompleto ?? null,
    };
    setPrintMatriculaData(reciboData);
    setShowPrintDialog(true);
  };

    return (
      <AnoLetivoAtivoGuard showAlert={true} disableChildren={false}>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 mb-6">
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar aluno ou turma..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
                <Select value={filterTurma} onValueChange={setFilterTurma}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Selecione uma opção..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Turmas</SelectItem>
                    {turmas && turmas.map((turma: Turma) => (
                      <SelectItem key={turma.id} value={turma.id}>
                        {turma.nome} ({turma.ano})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              {canImprimirListaAdmitidos && (
                <Dialog open={listaAdmitidosDialogOpen} onOpenChange={(open) => {
                  if (!open) {
                    setListaAdmitidosAnoLetivoId("");
                    setListaAdmitidosTurmaId("");
                  }
                  setListaAdmitidosDialogOpen(open);
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto" title="Imprimir lista de estudantes admitidos por ano letivo e turma">
                      <FileText className="h-4 w-4 mr-2" />
                      Lista Admitidos
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Imprimir Lista de Estudantes Admitidos</DialogTitle>
                      <DialogDescription>
                        Selecione o ano letivo e a turma para gerar o PDF da lista de admitidos.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Ano Letivo *</Label>
                        <Select
                          value={listaAdmitidosAnoLetivoId}
                          onValueChange={(v) => {
                            setListaAdmitidosAnoLetivoId(v);
                            setListaAdmitidosTurmaId("");
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o ano letivo" />
                          </SelectTrigger>
                          <SelectContent>
                            {(anosLetivos as { id: string; ano: number }[]).map((al) => (
                              <SelectItem key={al.id} value={al.id}>
                                {al.ano}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Turma *</Label>
                        <Select
                          value={listaAdmitidosTurmaId}
                          onValueChange={setListaAdmitidosTurmaId}
                          disabled={!listaAdmitidosAnoLetivoId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a turma" />
                          </SelectTrigger>
                          <SelectContent>
                            {(turmasParaAdmitidos as Turma[]).map((t: Turma) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.nome} {isSecundario ? (t.classe?.nome ? `(${t.classe.nome})` : "") : (t.curso?.nome ? `(${t.curso.nome})` : "")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => setListaAdmitidosDialogOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={() => imprimirListaAdmitidosMutation.mutate()}
                          disabled={
                            !listaAdmitidosAnoLetivoId ||
                            !listaAdmitidosTurmaId ||
                            imprimirListaAdmitidosMutation.isPending
                          }
                        >
                          {imprimirListaAdmitidosMutation.isPending ? "Gerando PDF..." : "Gerar PDF"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                if (!open) resetForm();
                setIsDialogOpen(open);
              }}>
                <DialogTrigger asChild>
                  <Button onClick={() => resetForm()} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Matricular em Turma
                  </Button>
                </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Matricular Estudante em Turma
                </DialogTitle>
                <DialogDescription>
                  Vincule um aluno a uma turma para permitir acesso às disciplinas e frequência.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Aluno *</Label>
                  <SmartSearch
                    placeholder="Digite o nome do estudante, email, BI ou número de identificação..."
                    value={alunos?.find((a: Aluno) => a.id === formData.aluno_id)?.nomeCompleto || 
                           alunos?.find((a: Aluno) => a.id === formData.aluno_id)?.nome_completo}
                    selectedId={formData.aluno_id}
                    onSelect={(item) => {
                      if (item) {
                        setFormData(prev => ({ ...prev, aluno_id: item.id, turma_id: '' }));
                      } else {
                        setFormData(prev => ({ ...prev, aluno_id: '', turma_id: '' }));
                      }
                    }}
                    searchFn={searchAlunos}
                    emptyMessage="Nenhum aluno encontrado"
                    required
                  />
                </div>

                {/* Exibir dados da Matrícula Anual (somente leitura) */}
                {formData.aluno_id && !matriculaAnual && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Este aluno não possui uma matrícula anual ativa. É necessário cadastrar uma matrícula anual antes de matricular em turma.
                    </AlertDescription>
                  </Alert>
                )}

                {matriculaAnual && (
                  <div className="space-y-3 p-3 bg-muted/50 rounded-md border">
                    <Label className="text-sm font-semibold">Dados da Matrícula Anual (somente leitura)</Label>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Ano Letivo:</span>
                        <p className="font-medium">{matriculaAnual.anoLetivo || 'N/A'}</p>
                      </div>
                      {matriculaAnual.nivelEnsino === 'SUPERIOR' ? (
                        <div>
                          <span className="text-muted-foreground">Ano do Curso:</span>
                          <p className="font-medium">{matriculaAnual.classeOuAnoCurso || 'N/A'}</p>
                        </div>
                      ) : (
                        <div>
                          <span className="text-muted-foreground">Classe:</span>
                          <p className="font-medium">{matriculaAnual.classeOuAnoCurso || 'N/A'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Turma *</Label>
                  {!formData.aluno_id ? (
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um estudante primeiro" />
                      </SelectTrigger>
                    </Select>
                  ) : !matriculaAnual ? (
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="Matrícula anual não encontrada" />
                      </SelectTrigger>
                    </Select>
                  ) : turmasCompatíveis.length === 0 ? (
                    <div className="space-y-2">
                      <Select disabled>
                        <SelectTrigger>
                          <SelectValue placeholder="Nenhuma turma compatível encontrada" />
                        </SelectTrigger>
                      </Select>
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Não há turmas compatíveis com esta matrícula anual. Verifique se existem turmas para o ano letivo {matriculaAnual.anoLetivo}, {matriculaAnual.nivelEnsino === 'SUPERIOR' ? 'curso selecionado' : 'classe selecionada'}.
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <Select
                      value={formData.turma_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, turma_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma opção..." />
                      </SelectTrigger>
                      <SelectContent>
                        {turmasCompatíveis.map((turma: Turma) => (
                          <SelectItem key={turma.id} value={turma.id}>
                            {turma.nome} - {isSecundario ? (turma.classe?.nome ?? '-') : (turma.curso?.nome ?? '-')} ({turma.ano}{!isSecundario && turma.semestre ? `/${turma.semestre}` : ''})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativa">Ativa</SelectItem>
                      <SelectItem value="Trancada">Trancada</SelectItem>
                      <SelectItem value="Concluida">Concluída</SelectItem>
                      <SelectItem value="Cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Salvando..." : "Matricular"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredMatriculas?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma matrícula em turma encontrada</p>
            <p className="text-sm">Use o botão acima para matricular estudantes em turmas</p>
          </div>
        ) : (
          <ResponsiveTable
            columns={[
              {
                key: 'aluno',
                label: 'Aluno',
                priority: 'high',
                render: (_, row: MatriculaTurma) => (
                  <span className="font-medium">
                    {row.aluno?.nomeCompleto || "N/A"}
                  </span>
                ),
              },
              {
                key: 'bi',
                label: 'BI',
                priority: 'medium',
                render: (_, row: MatriculaTurma) => (
                  <span className="text-muted-foreground">
                    {row.aluno?.numeroIdentificacao || "-"}
                  </span>
                ),
              },
              {
                key: 'turma',
                label: 'Turma',
                priority: 'high',
                render: (_, row: MatriculaTurma) => row.turma?.nome || "N/A",
              },
              {
                key: 'curso',
                label: isSecundario ? 'Classe' : 'Curso',
                priority: 'medium',
                render: (_, row: MatriculaTurma) => (isSecundario ? row.turma?.classe?.nome : row.turma?.curso?.nome) || "N/A",
              },
              {
                key: 'anoSem',
                label: isSecundario ? 'Ano/Trim' : 'Ano/Sem',
                priority: 'low',
                render: (_, row: MatriculaTurma) => {
                  const ano = row.turma?.ano ?? row.turma?.anoLetivoRef?.ano ?? "N/A";
                  const t = row.turma as { trimestre?: number; trimestreRef?: { numero: number } } | undefined;
                  const periodo = isSecundario
                    ? (t?.trimestre ?? t?.trimestreRef?.numero ?? "N/A")
                    : row.turma?.semestre ?? "N/A";
                  return `${ano}/${periodo}`;
                },
              },
              {
                key: 'status',
                label: 'Status',
                priority: 'high',
                render: (_, row: MatriculaTurma) => getStatusBadge(row.status),
              },
              {
                key: 'acoes',
                label: 'Ações',
                className: 'text-right',
                priority: 'high',
                render: (_, row: MatriculaTurma) => (
                  <div className="flex justify-end gap-1 md:gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 md:h-9 md:w-9"
                      onClick={() => {
                        setTransferMatricula(row);
                        setTransferNovaTurmaId("");
                        setTransferDialogOpen(true);
                      }}
                      title="Mudar para outra turma"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 md:h-9 md:w-9"
                      onClick={() => handlePrintMatricula(row)}
                      title="Imprimir comprovante"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 md:h-9 md:w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setDeletingId(row.id);
                        setDeleteDialogOpen(true);
                      }}
                      title="Remover matrícula"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ),
              },
            ]}
            data={filteredMatriculas || []}
            keyExtractor={(row: MatriculaTurma) => row.id}
            emptyMessage="Nenhuma matrícula encontrada"
          />
        )}

        <PrintMatriculaDialog
          open={showPrintDialog}
          onOpenChange={setShowPrintDialog}
          matriculaData={printMatriculaData}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Remoção</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover esta matrícula? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deletingId) {
                    deleteMutation.mutate(deletingId);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Removendo...' : 'Remover'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Transferir para outra turma */}
        <Dialog
          open={transferDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setTransferMatricula(null);
              setTransferNovaTurmaId("");
            }
            setTransferDialogOpen(open);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Mudar para outra turma
              </DialogTitle>
              <DialogDescription>
                Transfira o estudante para uma turma compatível com a matrícula anual.
              </DialogDescription>
            </DialogHeader>
            {transferMatricula && (
              <div className="space-y-4 pt-2">
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-sm font-medium">Estudante: {transferMatricula.aluno?.nomeCompleto ?? "N/A"}</p>
                  <p className="text-sm text-muted-foreground">
                    Turma atual: {transferMatricula.turma?.nome ?? "N/A"} (
                    {(isSecundario ? transferMatricula.turma?.classe?.nome : transferMatricula.turma?.curso?.nome) ?? "-"})
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Nova turma *</Label>
                  {turmasParaTransferencia.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma turma compatível disponível para transferência.
                    </p>
                  ) : (
                    <Select
                      value={transferNovaTurmaId}
                      onValueChange={setTransferNovaTurmaId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a nova turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {turmasParaTransferencia.map((turma: Turma) => (
                          <SelectItem key={turma.id} value={turma.id}>
                            {turma.nome} - {isSecundario ? (turma.classe?.nome ?? "-") : (turma.curso?.nome ?? "-")} ({turma.ano}
                            {!isSecundario && turma.semestre ? `/${turma.semestre}` : ""})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    disabled={!transferNovaTurmaId || transferMutation.isPending}
                    onClick={() => {
                      if (transferMatricula?.id && transferNovaTurmaId) {
                        transferMutation.mutate({ matriculaId: transferMatricula.id, novaTurmaId: transferNovaTurmaId });
                      }
                    }}
                  >
                    {transferMutation.isPending ? "Transferindo..." : "Transferir"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
    </AnoLetivoAtivoGuard>
  );
}