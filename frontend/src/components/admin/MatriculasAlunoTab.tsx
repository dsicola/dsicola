import { useState, useEffect, Fragment, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { matriculasDisciplinasApi, alunoDisciplinasApi, userRolesApi, profilesApi, matriculasApi, disciplinasApi, utilsApi, matriculasAnuaisApi, semestreApi, trimestreApi, anoLetivoApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { SmartSearch } from "@/components/common/SmartSearch";
import { useAlunoSearch } from "@/hooks/useSmartSearch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Plus, Pencil, Trash2, BookOpen, Search, GraduationCap, AlertCircle, Printer, CheckCircle2, ChevronRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { PrintMatriculaDialog } from "@/components/secretaria/PrintMatriculaDialog";
import { MatriculaReciboData, gerarCodigoMatricula } from "@/utils/pdfGenerator";
import { AxiosError } from "axios";

interface Matricula {
  id: string;
  ano: number;
  semestre: string;
  status: string;
  created_at: string;
  matriculaAnualId?: string | null;
  aluno: {
    id: string;
    nome_completo: string;
    email: string;
    numero_identificacao_publica?: string | null;
  } | null;
  disciplina: {
    id: string;
    nome: string;
    curso: { id: string; nome: string } | null;
  } | null;
  turma: {
    id: string;
    nome: string;
    curso?: { id: string; nome: string } | null;
    classe?: { id: string; nome: string } | null;
    turno?: {
      id: string;
      nome: string;
    } | null;
  } | null;
}

interface MatriculaAnual {
  id: string;
  alunoId: string;
  anoLetivo: number;
  anoLetivoId?: string; // FK para AnoLetivo - retornado pelo backend
  classeOuAnoCurso: string;
  status: 'ATIVA' | 'CONCLUIDA' | 'CANCELADA';
  curso?: {
    id: string;
    nome: string;
  } | null;
  classe?: {
    id: string;
    nome: string;
  } | null;
}

interface MatriculasAgrupadas {
  alunoId: string;
  alunoNome: string;
  matriculaAnual: MatriculaAnual | null;
  turmaNome: string | null;
  cursoNome: string | null;
  classeOuAno: string | null;
  turnoNome: string | null;
  totalDisciplinas: number;
  trimestres: number[];
  statusGeral: string;
  matriculas: Matricula[];
}

interface Aluno {
  id: string;
  nome_completo: string;
  email?: string;
  numero_identificacao?: string | null;
  numero_identificacao_publica?: string | null;
}

interface AlunoTurma {
  turma_id: string;
  turma: {
    id: string;
    nome: string;
    curso_id: string;
    curso: { id: string; nome: string } | null;
  } | null;
}

interface Disciplina {
  id: string;
  nome: string;
  curso_id: string;
  curso: { id: string; nome: string } | null;
}

export function MatriculasAlunoTab() {
  const { config, instituicao, isSecundario } = useInstituicao();
  const { user } = useAuth();
  const { instituicaoId, shouldFilter, isSuperAdmin } = useTenantFilter();
  const { searchAlunos } = useAlunoSearch();
  
  const periodoLabel = isSecundario ? "Trimestre" : "Semestre";
  const periodoLabelPlural = isSecundario ? "Trimestres" : "Semestres";
  
  // Declarar formData ANTES das queries que o utilizam
  const [formData, setFormData] = useState({
    aluno_id: "",
    disciplina_id: "",
    turma_id: "",
    ano: new Date().getFullYear().toString(),
    semestre: "",
    status: "Cursando",
  });
  
  // Buscar ano letivo ativo para filtrar períodos
  const { data: anoLetivoAtivo } = useQuery({
    queryKey: ["ano-letivo-ativo", instituicaoId],
    queryFn: async () => {
      const anos = await anoLetivoApi.getAll({ status: "ATIVO" });
      return Array.isArray(anos) && anos.length > 0 ? anos[0] : null;
    },
    enabled: !!instituicaoId,
  });

  // Buscar semestres (Ensino Superior) - do ano letivo selecionado ou ativo
  const { data: semestres = [] } = useQuery({
    queryKey: ["semestres-matricula", instituicaoId, formData.ano, anoLetivoAtivo?.id],
    queryFn: async () => {
      if (anoLetivoAtivo?.id) {
        return await semestreApi.getAll({ anoLetivoId: anoLetivoAtivo.id });
      }
      if (formData.ano) {
        return await semestreApi.getAll({ anoLetivo: Number(formData.ano) });
      }
      return await semestreApi.getAll();
    },
    enabled: !isSecundario && !!instituicaoId && (!!formData.ano || !!anoLetivoAtivo),
  });

  // Buscar trimestres (Ensino Secundário) - do ano letivo selecionado ou ativo
  const { data: trimestres = [] } = useQuery({
    queryKey: ["trimestres-matricula", instituicaoId, formData.ano, anoLetivoAtivo?.id],
    queryFn: async () => {
      if (anoLetivoAtivo?.id) {
        return await trimestreApi.getAll({ anoLetivoId: anoLetivoAtivo.id });
      }
      if (formData.ano) {
        return await trimestreApi.getAll({ anoLetivo: Number(formData.ano) });
      }
      return await trimestreApi.getAll();
    },
    enabled: isSecundario && !!instituicaoId && (!!formData.ano || !!anoLetivoAtivo),
  });

  // Construir periodoOptions dinamicamente do banco (sem valores hardcoded)
  const periodoOptions = [
    { value: "todos", label: `Todos os ${periodoLabel}s` },
    ...(isSecundario 
      ? trimestres.map((t: any) => ({
          value: t.numero.toString(),
          label: `${t.numero}º ${periodoLabel}`,
        }))
      : semestres.map((s: any) => ({
          value: s.numero.toString(),
          label: `${s.numero}º ${periodoLabel}`,
        }))
    ),
  ];
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [editingMatricula, setEditingMatricula] = useState<Matricula | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAno, setFilterAno] = useState<string>("all");
  const [filterSemestre, setFilterSemestre] = useState<string>("all");
  const [selectedAlunoTurma, setSelectedAlunoTurma] = useState<AlunoTurma | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useSafeDialog(false);
  const [printMatriculaData, setPrintMatriculaData] = useState<MatriculaReciboData | null>(null);
  const [matriculaMode, setMatriculaMode] = useState<"automatica" | "manual">("automatica");
  const [selectedDisciplinas, setSelectedDisciplinas] = useState<Set<string>>(new Set());
  const [expandedAlunoId, setExpandedAlunoId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  
  // Buscar anos letivos do banco (SEM valores hardcoded)
  const { data: anosLetivos = [] } = useQuery({
    queryKey: ["anos-letivos-matriculas-aluno", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });
  
  // Extrair apenas os anos numéricos dos anos letivos cadastrados
  const years = useMemo(() => {
    return anosLetivos.map((al: any) => al.ano).sort((a: number, b: number) => b - a);
  }, [anosLetivos]);

  const { data: matriculas, isLoading, error: errorMatriculas } = useQuery<Matricula[], AxiosError>({
    queryKey: ["aluno_disciplinas", instituicaoId],
    queryFn: async () => {
      try {
        const data = await matriculasDisciplinasApi.getAll();
        
        // Garantir que é um array
        if (!Array.isArray(data)) {
          console.warn('[MatriculasAlunoTab] Dados retornados não são um array:', data);
          return [];
        }
        
        // Normalizar dados do backend (nomeCompleto -> nome_completo, etc)
        return data.map((m: any) => ({
          ...m,
          aluno: m.aluno ? {
            ...m.aluno,
            nome_completo: m.aluno.nomeCompleto || m.aluno.nome_completo,
            numero_identificacao_publica: m.aluno.numeroIdentificacaoPublica || m.aluno.numero_identificacao_publica,
          } : null,
        })) as Matricula[];
      } catch (error) {
        // Log detalhado do erro para debug
        console.error('[MatriculasAlunoTab] Erro ao buscar matrículas:', error);
        
        if (error instanceof AxiosError) {
          const status = error.response?.status;
          const responseData = error.response?.data;
          
          console.error('[MatriculasAlunoTab] Status HTTP:', status);
          console.error('[MatriculasAlunoTab] Response data:', responseData);
          
          // Se for 400 (Bad Request), tentar extrair detalhes
          if (status === 400) {
            const details = responseData?.details || responseData?.error || error.message;
            console.error('[MatriculasAlunoTab] Detalhes do erro 400:', details);
          }
          
          // Se for 401 ou 403, pode ser problema de autenticação
          if (status === 401 || status === 403) {
            throw new Error('Sem permissão para acessar matrículas. Verifique se está autenticado.');
          }
        }
        
        // Re-lançar o erro para ser tratado pelo onError
        throw error;
      }
    },
    enabled: true, // Sempre habilitar - backend decide se retorna dados ou array vazio
    retry: (failureCount, error) => {
      // Não tentar novamente se for erro 400 (Bad Request) ou 401/403 (Auth)
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        if (status === 400 || status === 401 || status === 403) {
          return false;
        }
      }
      // Tentar no máximo 1 vez para outros erros
      return failureCount < 1;
    },
  });

  // Tratar erros do useQuery (React Query v5 não suporta onError em useQuery)
  useEffect(() => {
    if (errorMatriculas) {
      let errorMessage = "Erro ao carregar matrículas. Por favor, recarregue a página ou tente novamente mais tarde.";
      let errorDetails: string | null = null;
      
      if (errorMatriculas instanceof AxiosError) {
        const status = errorMatriculas.response?.status;
        const responseData = errorMatriculas.response?.data;
        
        // Extrair mensagem de erro e detalhes
        const responseMessage = (responseData as any)?.message;
        const responseError = (responseData as any)?.error;
        errorMessage = responseMessage || responseError || errorMatriculas.message || errorMessage;
        
        // Adicionar detalhes se disponíveis
        const responseDetails = (responseData as any)?.details;
        if (responseDetails) {
          if (typeof responseDetails === 'string') {
            errorDetails = responseDetails;
          } else if (typeof responseDetails === 'object') {
            errorDetails = JSON.stringify(responseDetails);
          }
        }
        
        // Mensagens específicas por status
        if (status === 400) {
          errorMessage = errorDetails 
            ? `Parâmetros inválidos: ${errorDetails}`
            : 'Parâmetros inválidos na requisição. Verifique os filtros aplicados.';
        } else if (status === 401) {
          errorMessage = 'Não autenticado. Por favor, faça login novamente.';
        } else if (status === 403) {
          errorMessage = 'Sem permissão para acessar matrículas.';
        } else if (status === 404) {
          errorMessage = 'Rota não encontrada.';
        } else if (status && status >= 500) {
          errorMessage = 'Erro no servidor. Tente novamente mais tarde.';
        }
      } else if (errorMatriculas && typeof errorMatriculas === 'object' && 'message' in errorMatriculas) {
        errorMessage = String((errorMatriculas as any).message);
      }
      
      console.error('[MatriculasAlunoTab] Erro tratado:', {
        errorMessage,
        errorDetails,
        originalError: errorMatriculas
      });
      
      toast.error(errorMessage);
    }
  }, [errorMatriculas]);

  const { data: alunos } = useQuery({
    queryKey: ["alunos-select", instituicaoId],
    queryFn: async () => {
      const alunoRoles = await userRolesApi.getByRole("ALUNO", instituicaoId);
      if (!alunoRoles || alunoRoles.length === 0) return [];

      const alunoIds = alunoRoles.map((r: any) => r.user_id || r.userId);
      const profiles = await profilesApi.getByIds(alunoIds);
      
      if (shouldFilter && instituicaoId) {
        return profiles.filter((p: any) => p.instituicao_id === instituicaoId) as Aluno[];
      }
      return profiles as Aluno[];
    },
  });

  const { data: alunoInadimplente, isLoading: isLoadingInadimplencia } = useQuery({
    queryKey: ["aluno-inadimplencia", formData.aluno_id],
    queryFn: async () => {
      if (!formData.aluno_id) return false;
      const result = await utilsApi.verificarInadimplencia(formData.aluno_id);
      return result?.inadimplente || false;
    },
    enabled: !!formData.aluno_id,
  });

  // Verificar matrícula anual ativa do aluno
  const { data: matriculaAnualAtiva, isLoading: isLoadingMatriculaAnual } = useQuery({
    queryKey: ["matricula-anual-ativa", formData.aluno_id, formData.ano],
    queryFn: async () => {
      if (!formData.aluno_id) return null;
      const matriculas = await matriculasAnuaisApi.getByAluno(formData.aluno_id);
      const ativa = matriculas?.find((m: any) => 
        m.status === 'ATIVA' && m.anoLetivo === parseInt(formData.ano)
      );
      return ativa || null;
    },
    enabled: !!formData.aluno_id && !!formData.ano,
  });

  const { data: alunoTurmaData, isLoading: isLoadingAlunoTurma } = useQuery({
    queryKey: ["aluno-turma", formData.aluno_id],
    queryFn: async () => {
      if (!formData.aluno_id) return null;
      const matriculasData = await matriculasApi.getByAlunoId(formData.aluno_id);
      // Buscar matrícula ativa (comparar com "Ativa" ou "ativa" para compatibilidade)
      const matriculaAtiva = matriculasData?.find((m: any) => 
        m.status === "Ativa" || m.status === "ativa" || m.status?.toLowerCase() === "ativa"
      );
      if (!matriculaAtiva || !matriculaAtiva.turma) return null;
      
      // Normalizar estrutura da turma - garantir que curso_id está presente
      const turma = matriculaAtiva.turma;
      const cursoId = turma.curso_id || turma.curso?.id;
      
      if (!cursoId) return null;
      
      return {
        turma_id: matriculaAtiva.turma_id || turma.id,
        turma: {
          ...turma,
          curso_id: cursoId,
          curso: turma.curso || { id: cursoId, nome: turma.curso?.nome || '' },
        },
      } as AlunoTurma;
    },
    enabled: !!formData.aluno_id,
  });

  const { data: disciplinasFiltradas, isLoading: isLoadingDisciplinas } = useQuery({
    queryKey: [
      "disciplinas-matricula", 
      instituicaoId, 
      selectedAlunoTurma?.turma?.curso_id || selectedAlunoTurma?.turma?.curso?.id || alunoTurmaData?.turma?.curso_id || alunoTurmaData?.turma?.curso?.id,
      matriculaAnualAtiva?.id,
      matriculaMode
    ],
    queryFn: async () => {
      // Get curso_id from múltiplas fontes possíveis
      const cursoId = selectedAlunoTurma?.turma?.curso_id 
        || selectedAlunoTurma?.turma?.curso?.id
        || alunoTurmaData?.turma?.curso_id
        || alunoTurmaData?.turma?.curso?.id;
      
      console.log('[disciplinasFiltradas] Buscando disciplinas (modo manual):', {
        cursoId,
        selectedAlunoTurma: selectedAlunoTurma?.turma,
        alunoTurmaData: alunoTurmaData?.turma
      });
      
      const params: any = {};
      
      // Se houver curso específico, filtrar por ele; senão, carregar todas da instituição
      if (cursoId) {
        params.cursoId = cursoId;
      }
      
      // Backend já filtra por instituição automaticamente, mas podemos passar para SUPER_ADMIN
      if (isSuperAdmin && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      
      try {
        const data = await disciplinasApi.getAll(params);
        const disciplinasArray = Array.isArray(data) ? data as Disciplina[] : [];
        console.log('[disciplinasFiltradas] Disciplinas encontradas:', disciplinasArray.length);
        return disciplinasArray;
      } catch (error) {
        console.error('[disciplinasFiltradas] Erro ao buscar disciplinas:', error);
        return [];
      }
    },
    enabled: !!matriculaAnualAtiva && matriculaMode === "manual", // Só carregar se houver matrícula anual ativa e modo manual
    staleTime: 30000, // Cache por 30 segundos
  });

  // Buscar disciplinas do período para matrícula automática
  // IMPORTANTE: Esta query deve ser habilitada sempre que houver aluno, turma e matrícula anual
  // Não depende apenas do modo automático, pois também é usada para validação
  const { data: disciplinasDoPeriodo, isLoading: isLoadingDisciplinasPeriodo } = useQuery({
    queryKey: [
      "disciplinas-periodo", 
      formData.aluno_id, 
      formData.ano, 
      formData.semestre, 
      selectedAlunoTurma?.turma?.curso_id || selectedAlunoTurma?.turma?.curso?.id,
      matriculaAnualAtiva?.id,
      matriculaMode
    ],
    queryFn: async () => {
      // Validar pré-requisitos
      if (!formData.aluno_id || !matriculaAnualAtiva) {
        console.log('[disciplinasDoPeriodo] Pré-requisitos não atendidos:', {
          aluno_id: formData.aluno_id,
          matriculaAnualAtiva: !!matriculaAnualAtiva
        });
        return [];
      }
      
      // Obter cursoId de múltiplas fontes possíveis
      const cursoId = selectedAlunoTurma?.turma?.curso_id 
        || selectedAlunoTurma?.turma?.curso?.id
        || alunoTurmaData?.turma?.curso_id
        || alunoTurmaData?.turma?.curso?.id;
      
      if (!cursoId) {
        console.log('[disciplinasDoPeriodo] CursoId não encontrado:', {
          selectedAlunoTurma: selectedAlunoTurma?.turma,
          alunoTurmaData: alunoTurmaData?.turma
        });
        return [];
      }
      
      console.log('[disciplinasDoPeriodo] Buscando disciplinas:', {
        cursoId,
        semestre: formData.semestre,
        ano: formData.ano,
        isSecundario
      });
      
      const params: any = { cursoId };
      if (isSuperAdmin && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      
      try {
        const todasDisciplinas = await disciplinasApi.getAll(params);
        const disciplinasArray = Array.isArray(todasDisciplinas) ? todasDisciplinas as Disciplina[] : [];
        
        console.log('[disciplinasDoPeriodo] Disciplinas encontradas (total):', disciplinasArray.length);
        
        // Se "todos" foi selecionado, retornar todas as disciplinas
        if (formData.semestre === "todos" || !formData.semestre) {
          console.log('[disciplinasDoPeriodo] Retornando todas as disciplinas (todos os períodos)');
          return disciplinasArray;
        }
        
        // Filtrar por período baseado no nível de ensino
        const semestreNum = parseInt(formData.semestre);
        if (isNaN(semestreNum)) {
          // Se não for um número válido, retornar todas as disciplinas
          console.log('[disciplinasDoPeriodo] Semestre inválido, retornando todas');
          return disciplinasArray;
        }
        
        if (isSecundario) {
          // Para secundário: filtrar por trimestresOferecidos
          const disciplinasFiltradas = disciplinasArray.filter((d: any) => {
            const trimestres = d.trimestres_oferecidos || d.trimestresOferecidos || [];
            const inclui = Array.isArray(trimestres) && trimestres.includes(semestreNum);
            if (!inclui) {
              console.log(`[disciplinasDoPeriodo] Disciplina ${d.nome} não oferecida no trimestre ${semestreNum}`, {
                trimestres,
                trimestresOferecidos: d.trimestresOferecidos,
                trimestres_oferecidos: d.trimestres_oferecidos
              });
            }
            return inclui;
          });
          console.log('[disciplinasDoPeriodo] Disciplinas filtradas (secundário):', disciplinasFiltradas.length);
          return disciplinasFiltradas;
        } else {
          // Para superior: NÃO filtrar por semestre na Disciplina
          // REGRA SIGA/SIGAE: Disciplina não possui semestre - o semestre pertence ao PlanoEnsino
          // Retornar todas as disciplinas do curso, independente do semestre selecionado
          // O semestre será aplicado na matrícula (AlunoDisciplina), não na Disciplina
          console.log('[disciplinasDoPeriodo] Retornando todas as disciplinas (superior - semestre não filtra)');
          return disciplinasArray;
        }
      } catch (error) {
        console.error('[disciplinasDoPeriodo] Erro ao buscar disciplinas:', error);
        return [];
      }
    },
    enabled: !!formData.aluno_id 
      && !!(selectedAlunoTurma?.turma?.curso_id || selectedAlunoTurma?.turma?.curso?.id || alunoTurmaData?.turma?.curso_id || alunoTurmaData?.turma?.curso?.id)
      && !!matriculaAnualAtiva
      && matriculaMode === "automatica",
    staleTime: 30000, // Cache por 30 segundos
  });

  useEffect(() => {
    if (alunoTurmaData) {
      setSelectedAlunoTurma(alunoTurmaData);
      setFormData(prev => ({
        ...prev,
        turma_id: alunoTurmaData.turma_id || "",
        disciplina_id: "",
      }));
    } else if (formData.aluno_id && !isLoadingAlunoTurma) {
      setSelectedAlunoTurma(null);
      setFormData(prev => ({
        ...prev,
        turma_id: "",
        disciplina_id: "",
      }));
    }
  }, [alunoTurmaData, formData.aluno_id, isLoadingAlunoTurma]);

  // Resetar disciplinas selecionadas quando aluno ou período mudar
  useEffect(() => {
    setSelectedDisciplinas(new Set());
  }, [formData.aluno_id, formData.ano, formData.semestre, matriculaMode]);

  const createMutation = useSafeMutation({
    mutationFn: async (data: typeof formData) => {
      await alunoDisciplinasApi.create({
        alunoId: data.aluno_id,
        disciplinaId: data.disciplina_id,
        turmaId: data.turma_id || undefined,
        ano: parseInt(data.ano),
        semestre: data.semestre,
        status: data.status,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["aluno_disciplinas"] });
      toast.success("Matrícula criada com sucesso!");
      
      const aluno = alunos?.find(a => a.id === data.aluno_id);
      const disciplina = disciplinasFiltradas?.find(d => d.id === data.disciplina_id);
      
      if (aluno && disciplina) {
        const reciboData: MatriculaReciboData = {
          instituicao: {
            nome: config?.nome_instituicao || instituicao?.nome || 'Universidade',
            nif: (config as { nif?: string })?.nif ?? null,
            logoUrl: config?.logo_url,
            email: config?.email,
            telefone: config?.telefone,
            endereco: config?.endereco,
          },
          aluno: {
            nome: aluno.nome_completo,
            numeroId: aluno.numero_identificacao_publica,
            bi: aluno.numero_identificacao,
            email: aluno.email,
          },
          matricula: {
            curso: disciplina.curso?.nome || 'N/A',
            turma: selectedAlunoTurma?.turma?.nome || 'N/A',
            disciplina: disciplina.nome,
            disciplinas: [disciplina.nome],
            ano: parseInt(data.ano),
            semestre: data.semestre,
            dataMatricula: new Date().toISOString(),
            reciboNumero: gerarCodigoMatricula(),
            tipoAcademico: isSecundario ? 'SECUNDARIO' : 'SUPERIOR',
            anoFrequencia: !isSecundario ? (matriculaAnualAtiva?.classeOuAnoCurso ?? matriculaAnualAtiva?.classe_ou_ano_curso ?? null) : null,
            classeFrequencia: isSecundario ? (matriculaAnualAtiva?.classeOuAnoCurso ?? matriculaAnualAtiva?.classe_ou_ano_curso ?? selectedAlunoTurma?.turma?.classe?.nome ?? null) : null,
          },
          operador: user?.nome_completo ?? (user as { nomeCompleto?: string })?.nomeCompleto ?? null,
        };
        setPrintMatriculaData(reciboData);
        setShowPrintDialog(true);
      }
      
      resetForm();
    },
    onError: (error: unknown) => {
      let errorMessage = "Erro ao criar matrícula. Por favor, tente novamente.";
      
      // Tratar AxiosError
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const responseData = error.response?.data;
        
        // Tratar especificamente o erro 409 (Conflict)
        if (status === 409) {
          errorMessage = responseData?.message || 
            responseData?.error || 
            "Este aluno já está matriculado nesta disciplina para este período.";
        } else {
          // Para outros erros, tentar extrair a mensagem do backend
          errorMessage = responseData?.message || 
                        responseData?.error || 
                        error.message || 
                        errorMessage;
        }
      } else if (error instanceof Error) {
        // Verificar se a mensagem contém palavras-chave relacionadas a duplicação
        if (error.message.includes("duplicate") || 
            error.message.includes("unique") ||
            error.message.includes("já está matriculado") ||
            error.message.includes("já matriculado")) {
          errorMessage = "Este aluno já está matriculado nesta disciplina para este período.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
    },
  });

  const updateMutation = useSafeMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      await alunoDisciplinasApi.update(id, {
        status: data.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aluno_disciplinas"] });
      toast.success("Matrícula atualizada com sucesso!");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar matrícula: " + error.message);
    },
  });

  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await alunoDisciplinasApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aluno_disciplinas"] });
      toast.success("Matrícula cancelada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao cancelar matrícula: " + error.message);
    },
  });

  const bulkCreateMutation = useSafeMutation({
    mutationFn: async (data: {
      alunoId: string;
      ano: number;
      semestre: string;
      status?: string;
      disciplinaIds?: string[];
    }) => {
      // Validar dados antes de enviar
      if (data.disciplinaIds && data.disciplinaIds.length === 0) {
        throw new Error('Selecione pelo menos uma disciplina');
      }
      return await alunoDisciplinasApi.createBulk(data);
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ["aluno_disciplinas"] });
      queryClient.invalidateQueries({ queryKey: ["disciplinas-periodo"] });
      const total = response?.total || 0;
      const duplicadas = response?.duplicadas || 0;
      if (duplicadas > 0) {
        toast.success(`${total} matrícula(s) criada(s) com sucesso. ${duplicadas} disciplina(s) já estavam matriculadas.`);
      } else {
        toast.success(`${total} matrícula(s) criada(s) com sucesso!`);
      }
      
      // Preparar dados para impressão
      const aluno = alunos?.find(a => a.id === variables.alunoId);
      const matriculasCriadas = response?.matriculas || [];
      const disciplinasMatriculadas = matriculasCriadas
        .map((m: any) => m.disciplina?.nome)
        .filter(Boolean) as string[];
      
      if (aluno && disciplinasMatriculadas.length > 0) {
        const reciboData: MatriculaReciboData = {
            instituicao: {
              nome: config?.nome_instituicao || instituicao?.nome || 'Instituição',
              nif: (config as { nif?: string })?.nif ?? null,
              logoUrl: config?.logo_url,
              email: config?.email,
              telefone: config?.telefone,
              endereco: config?.endereco,
            },
          aluno: {
            nome: aluno.nome_completo,
            numeroId: aluno.numero_identificacao_publica,
            bi: aluno.numero_identificacao,
            email: aluno.email,
          },
          matricula: {
            curso: selectedAlunoTurma?.turma?.curso?.nome || 'N/A',
            turma: selectedAlunoTurma?.turma?.nome || 'N/A',
            disciplina: disciplinasMatriculadas.join(', '),
            disciplinas: disciplinasMatriculadas,
            ano: variables.ano,
            semestre: variables.semestre,
            dataMatricula: new Date().toISOString(),
            reciboNumero: gerarCodigoMatricula(),
            tipoAcademico: isSecundario ? 'SECUNDARIO' : 'SUPERIOR',
            anoFrequencia: !isSecundario ? (matriculaAnualAtiva?.classeOuAnoCurso ?? matriculaAnualAtiva?.classe_ou_ano_curso ?? null) : null,
            classeFrequencia: isSecundario ? (matriculaAnualAtiva?.classeOuAnoCurso ?? matriculaAnualAtiva?.classe_ou_ano_curso ?? selectedAlunoTurma?.turma?.classe?.nome ?? null) : null,
          },
          operador: user?.nome_completo ?? (user as { nomeCompleto?: string })?.nomeCompleto ?? null,
        };
        setPrintMatriculaData(reciboData);
        setShowPrintDialog(true);
      }
      
      resetForm();
    },
    onError: (error: unknown) => {
      let errorMessage = "Erro ao criar matrículas em lote. Por favor, tente novamente.";
      
      if (error instanceof AxiosError) {
        const responseData = error.response?.data;
        errorMessage = responseData?.message || 
                      responseData?.error || 
                      error.message || 
                      errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    },
  });

  const resetForm = () => {
    setFormData({
      aluno_id: "",
      disciplina_id: "",
      turma_id: "",
      ano: new Date().getFullYear().toString(),
      semestre: "todos", // Valor padrão seguro: "todos" em vez de valor hardcoded
      status: "Matriculado",
    });
    setEditingMatricula(null);
    setSelectedAlunoTurma(null);
    setMatriculaMode("automatica");
    setSelectedDisciplinas(new Set());
    setIsDialogOpen(false);
  };

  const handleEdit = (matricula: Matricula) => {
    setEditingMatricula(matricula);
    setFormData({
      aluno_id: matricula.aluno?.id || "",
      disciplina_id: matricula.disciplina?.id || "",
      turma_id: matricula.turma?.id || "",
      ano: matricula.ano.toString(),
      semestre: matricula.semestre,
      status: matricula.status,
    });
    setIsDialogOpen(true);
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.aluno_id) {
      toast.error("Selecione um estudante");
      return;
    }

    if (!editingMatricula && alunoInadimplente) {
      toast.error("Este aluno possui mensalidades em atraso. Regularize a situação financeira antes de efetuar a matrícula.");
      return;
    }

    if (editingMatricula) {
      updateMutation.mutate({ id: editingMatricula.id, data: formData });
    } else {
      // Verificar se "todos" foi selecionado
      const isTodosPeriodos = formData.semestre === "todos";
      
      // Modo automático ou manual
      if (matriculaMode === "automatica") {
        // Matrícula automática em todas as disciplinas do período
        bulkCreateMutation.mutate({
          alunoId: formData.aluno_id,
          ano: parseInt(formData.ano),
          semestre: formData.semestre, // Pode ser "todos" ou um período específico
          status: formData.status,
        });
      } else {
        // Modo manual: verificar se há disciplinas selecionadas
        if (selectedDisciplinas.size === 0) {
          toast.error("Selecione pelo menos uma disciplina");
          return;
        }
        // Matrícula manual nas disciplinas selecionadas
        bulkCreateMutation.mutate({
          alunoId: formData.aluno_id,
          ano: parseInt(formData.ano),
          semestre: formData.semestre, // Pode ser "todos" ou um período específico
          status: formData.status,
          disciplinaIds: Array.from(selectedDisciplinas),
        });
      }
    }
  };

  // Buscar matrículas anuais para os alunos
  const { data: todasMatriculasAnuais } = useQuery({
    queryKey: ["matriculas-anuais-todas"],
    queryFn: async () => {
      const data = await matriculasAnuaisApi.getAll({});
      return Array.isArray(data) ? data as any[] : [];
    },
  });

  // Buscar matrículas regulares para obter dados de turma e turno
  const { data: matriculasRegulares } = useQuery({
    queryKey: ["matriculas-regulares-turno", instituicaoId],
    queryFn: async () => {
      if (!instituicaoId && shouldFilter) return [];
      try {
        const data = await matriculasApi.getAll({});
        return Array.isArray(data) ? data as any[] : [];
      } catch {
        return [];
      }
    },
    enabled: !!instituicaoId || !shouldFilter,
  });

  // Agrupar matrículas por aluno
  const agruparMatriculasPorAluno = (matriculas: Matricula[]): MatriculasAgrupadas[] => {
    if (!matriculas || matriculas.length === 0) return [];

    const agrupadasMap = new Map<string, MatriculasAgrupadas>();

    matriculas.forEach((matricula) => {
      const alunoId = matricula.aluno?.id;
      if (!alunoId) return;

      if (!agrupadasMap.has(alunoId)) {
        // Buscar matrícula anual do aluno para o ano da matrícula
        const matriculaAnual = todasMatriculasAnuais?.find((ma: any) => {
          const maAlunoId = ma.alunoId || ma.aluno_id;
          const maAnoLetivo = ma.anoLetivo || ma.ano_letivo;
          return maAlunoId === alunoId && maAnoLetivo === matricula.ano;
        }) || null;

        const turma = matricula.turma;
        const cursoNome = matricula.disciplina?.curso?.nome || turma?.curso?.nome || matriculaAnual?.curso?.nome || null;
        const classeOuAno = matriculaAnual?.classeOuAnoCurso || turma?.classe?.nome || null;

        // Buscar turno através da matrícula regular (Matricula) do aluno
        const matriculaRegular = matriculasRegulares?.find((mr: any) => {
          const mrAlunoId = mr.alunoId || mr.aluno?.id || mr.alunoId;
          return mrAlunoId === alunoId;
        });
        const turnoNome = matriculaRegular?.turma?.turno?.nome || null;

        agrupadasMap.set(alunoId, {
          alunoId,
          alunoNome: matricula.aluno?.nome_completo || "N/A",
          matriculaAnual: matriculaAnual ? {
            id: matriculaAnual.id,
            alunoId: matriculaAnual.alunoId || matriculaAnual.aluno_id,
            anoLetivo: matriculaAnual.anoLetivo || matriculaAnual.ano_letivo,
            classeOuAnoCurso: matriculaAnual.classeOuAnoCurso || matriculaAnual.classe_ou_ano_curso,
            status: matriculaAnual.status,
            curso: matriculaAnual.curso || null,
            classe: matriculaAnual.classe || null,
          } : null,
          turmaNome: turma?.nome || null,
          cursoNome,
          classeOuAno,
          turnoNome,
          totalDisciplinas: 0,
          trimestres: [],
          statusGeral: matricula.status,
          matriculas: [],
        });
      }

      const grupo = agrupadasMap.get(alunoId)!;
      grupo.matriculas.push(matricula);
      
      // Adicionar trimestre se não existir
      const trimestreNum = parseInt(matricula.semestre);
      if (!isNaN(trimestreNum) && !grupo.trimestres.includes(trimestreNum)) {
        grupo.trimestres.push(trimestreNum);
      }

      // Atualizar status geral (priorizar "Matriculado" sobre outros)
      if (matricula.status === "Matriculado" || matricula.status === "Cursando") {
        grupo.statusGeral = "Matriculado";
      } else if (grupo.statusGeral !== "Matriculado" && matricula.status) {
        grupo.statusGeral = matricula.status;
      }
    });

    // Calcular totais e ordenar trimestres
    const agrupadas = Array.from(agrupadasMap.values());
    agrupadas.forEach((grupo) => {
      grupo.totalDisciplinas = grupo.matriculas.length;
      grupo.trimestres.sort((a, b) => a - b);
    });

    return agrupadas;
  };

  // Filtrar matrículas
  const filteredMatriculas = matriculas?.filter((matricula) => {
    const matchesSearch =
      matricula.aluno?.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      matricula.disciplina?.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAno = filterAno === "all" || matricula.ano.toString() === filterAno;
    const matchesSemestre = filterSemestre === "all" || matricula.semestre === filterSemestre;
    return matchesSearch && matchesAno && matchesSemestre;
  }) || [];

  // Agrupar matrículas filtradas por aluno
  const matriculasAgrupadas = agruparMatriculasPorAluno(filteredMatriculas);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Matriculado":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Matriculado</Badge>;
      case "Pendente":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pendente</Badge>;
      case "Trancado":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Trancado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };


  const hasNoDisciplinas = formData.aluno_id && !isLoadingAlunoTurma && !isLoadingDisciplinas && 
    (!disciplinasFiltradas || disciplinasFiltradas.length === 0);

  const noTurmaForAluno = formData.aluno_id && !isLoadingAlunoTurma && !selectedAlunoTurma;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar aluno ou disciplina..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterAno} onValueChange={setFilterAno}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Anos</SelectItem>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSemestre} onValueChange={setFilterSemestre}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder={periodoLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {periodoOptions.slice(1).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Matrícula
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  {editingMatricula ? "Editar Matrícula" : "Nova Matrícula em Disciplina"}
                </DialogTitle>
                <DialogDescription>
                  {editingMatricula 
                    ? "Atualize as informações da matrícula" 
                    : "Selecione o estudante e a disciplina para efetuar a matrícula"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingMatricula && (
                  <>
                    <div className="space-y-2">
                      <Label>Estudante</Label>
                      <SmartSearch
                        placeholder="Digite o nome do estudante, email, BI ou número de identificação..."
                        value={alunos?.find((a: Aluno) => a.id === formData.aluno_id)?.nome_completo || ""}
                        selectedId={formData.aluno_id}
                        onSelect={(item) => {
                          if (item) {
                            setFormData(prev => ({
                              ...prev,
                              aluno_id: item.id,
                              disciplina_id: "",
                              turma_id: "",
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              aluno_id: "",
                              disciplina_id: "",
                              turma_id: "",
                            }));
                          }
                        }}
                        searchFn={searchAlunos}
                        emptyMessage="Nenhum aluno encontrado"
                        required
                      />
                    </div>

                    {isLoadingMatriculaAnual ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Verificando matrícula anual...
                        </AlertDescription>
                      </Alert>
                    ) : !matriculaAnualAtiva && formData.aluno_id && formData.ano ? (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Este aluno não possui matrícula anual ativa para o ano letivo {formData.ano}. É necessário matricular o aluno anualmente antes de matricular em disciplinas.
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    {noTurmaForAluno && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Este aluno não está matriculado em nenhuma turma. Matricule-o primeiro em uma turma.
                        </AlertDescription>
                      </Alert>
                    )}

                    {alunoInadimplente && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Este aluno possui mensalidades em atraso. Regularize a situação financeira.
                        </AlertDescription>
                      </Alert>
                    )}

                    {selectedAlunoTurma && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">
                          <strong>Turma:</strong> {selectedAlunoTurma.turma?.nome}
                        </p>
                        <p className="text-sm">
                          <strong>Curso:</strong> {selectedAlunoTurma.turma?.curso?.nome}
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Modalidade de Matrícula</Label>
                        <RadioGroup
                          value={matriculaMode}
                          onValueChange={(value) => {
                            setMatriculaMode(value as "automatica" | "manual");
                            setSelectedDisciplinas(new Set());
                            setFormData({ ...formData, disciplina_id: "" });
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="automatica" id="automatica" />
                            <Label htmlFor="automatica" className="font-normal cursor-pointer">
                              Matricular em todas as disciplinas do período
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="manual" id="manual" />
                            <Label htmlFor="manual" className="font-normal cursor-pointer">
                              Selecionar disciplinas manualmente
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {matriculaMode === "automatica" ? (
                        <div className="space-y-2">
                          {isLoadingDisciplinasPeriodo ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              Carregando disciplinas do período...
                            </div>
                          ) : disciplinasDoPeriodo && disciplinasDoPeriodo.length > 0 ? (
                            <div className="p-4 bg-muted rounded-lg">
                              <p className="text-sm font-medium mb-2">
                                {formData.semestre === "todos" 
                                  ? <>Serão matriculadas <strong>{disciplinasDoPeriodo.length}</strong> disciplina(s) em todos os {isSecundario ? "trimestres" : "semestres"} de {formData.ano}:</>
                                  : <>Serão matriculadas <strong>{disciplinasDoPeriodo.length}</strong> disciplina(s) do {periodoLabel.toLowerCase()} {formData.semestre} de {formData.ano}:</>}
                              </p>
                              <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                                {disciplinasDoPeriodo.map((disc: any) => (
                                  <li key={disc.id} className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    {disc.nome}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : formData.semestre === "todos" ? (
                            <div className="p-4 bg-muted rounded-lg">
                              <p className="text-sm font-medium mb-2">
                                Serão matriculadas todas as disciplinas disponíveis em todos os {isSecundario ? "trimestres" : "semestres"} de {formData.ano}.
                              </p>
                              {!isLoadingDisciplinasPeriodo && disciplinasDoPeriodo && disciplinasDoPeriodo.length === 0 && (
                                <Alert className="mt-2">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    Nenhuma disciplina encontrada para o curso {selectedAlunoTurma?.turma?.curso?.nome || 'selecionado'}. 
                                    Verifique se há disciplinas vinculadas ao curso em <strong>Acadêmica → Cursos → [Curso] → Disciplinas</strong>.
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          ) : matriculaAnualAtiva ? (
                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                {!selectedAlunoTurma?.turma?.curso_id && !selectedAlunoTurma?.turma?.curso?.id
                                  ? `Nenhuma turma/curso selecionado. Selecione um aluno que esteja matriculado em uma turma.`
                                  : !isLoadingDisciplinasPeriodo && (!disciplinasDoPeriodo || disciplinasDoPeriodo.length === 0)
                                    ? `Nenhuma disciplina encontrada para este ${periodoLabel.toLowerCase()} ${formData.semestre} de ${formData.ano}. ${isSecundario ? 'Verifique se as disciplinas estão configuradas para serem oferecidas neste trimestre (campo "Trimestres Oferecidos").' : 'Todas as disciplinas do curso estarão disponíveis para matrícula independente do semestre selecionado. Verifique se há disciplinas vinculadas ao curso.'}`
                                    : `Carregando disciplinas...`}
                              </AlertDescription>
                            </Alert>
                          ) : null}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Disciplinas Disponíveis</Label>
                            {disciplinasFiltradas && disciplinasFiltradas.length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (selectedDisciplinas.size === disciplinasFiltradas.length) {
                                    setSelectedDisciplinas(new Set());
                                  } else {
                                    setSelectedDisciplinas(new Set(disciplinasFiltradas.map(d => d.id)));
                                  }
                                }}
                              >
                                {selectedDisciplinas.size === disciplinasFiltradas.length
                                  ? "Desselecionar todas"
                                  : "Selecionar todas"}
                              </Button>
                            )}
                          </div>
                          {isLoadingDisciplinas ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              Carregando disciplinas...
                            </div>
                          ) : disciplinasFiltradas && disciplinasFiltradas.length > 0 ? (
                            <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                              {disciplinasFiltradas.map((disc) => {
                                const isChecked = selectedDisciplinas.has(disc.id);
                                return (
                                  <div 
                                    key={disc.id} 
                                    className="flex items-center space-x-2"
                                  >
                                    <Checkbox
                                      id={`disciplina-checkbox-${disc.id}`}
                                      checked={isChecked}
                                      onCheckedChange={(checked) => {
                                        // Usar função de atualização funcional para garantir estado correto
                                        setSelectedDisciplinas((prev) => {
                                          const newSet = new Set(prev);
                                          if (checked === true) {
                                            newSet.add(disc.id);
                                          } else if (checked === false) {
                                            newSet.delete(disc.id);
                                          }
                                          return newSet;
                                        });
                                      }}
                                    />
                                    <Label
                                      htmlFor={`disciplina-checkbox-${disc.id}`}
                                      className="text-sm font-normal cursor-pointer flex-1"
                                    >
                                      {disc.nome}
                                    </Label>
                                  </div>
                                );
                              })}
                              {selectedDisciplinas.size > 0 && (
                                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                                  {selectedDisciplinas.size} disciplina(s) selecionada(s)
                                </p>
                              )}
                            </div>
                          ) : matriculaAnualAtiva ? (
                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                Nenhuma disciplina encontrada{selectedAlunoTurma?.turma?.curso?.nome ? ` para o curso ${selectedAlunoTurma.turma.curso.nome}` : ''}.
                              </AlertDescription>
                            </Alert>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Ano</Label>
                        <Select value={formData.ano} onValueChange={(v) => setFormData({ ...formData, ano: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {years.map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{periodoLabel}</Label>
                        <Select value={formData.semestre} onValueChange={(v) => setFormData({ ...formData, semestre: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {periodoOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Matriculado">Matriculado</SelectItem>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Trancado">Trancado</SelectItem>
                      <SelectItem value="Concluído">Concluído</SelectItem>
                      <SelectItem value="Cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={
                      createMutation.isPending || 
                      updateMutation.isPending ||
                      bulkCreateMutation.isPending ||
                      isLoadingMatriculaAnual ||
                      (!editingMatricula && (
                        !matriculaAnualAtiva ||
                        noTurmaForAluno || 
                        alunoInadimplente ||
                        (matriculaMode === "automatica" && formData.semestre !== "todos" && (isLoadingDisciplinasPeriodo || (disciplinasDoPeriodo !== undefined && disciplinasDoPeriodo.length === 0))) ||
                        (matriculaMode === "automatica" && formData.semestre === "todos" && (isLoadingDisciplinasPeriodo || (disciplinasDoPeriodo !== undefined && disciplinasDoPeriodo.length === 0))) ||
                        (matriculaMode === "manual" && selectedDisciplinas.size === 0)
                      ))
                    }
                  >
                    {editingMatricula 
                      ? "Salvar" 
                      : matriculaMode === "automatica"
                        ? formData.semestre === "todos"
                          ? `Matricular em todas as disciplinas (todos os ${isSecundario ? "trimestres" : "semestres"})`
                          : `Matricular em ${disciplinasDoPeriodo?.length || 0} disciplina(s)`
                        : formData.semestre === "todos"
                          ? `Matricular em ${selectedDisciplinas.size} disciplina(s) (todos os ${isSecundario ? "trimestres" : "semestres"})`
                          : `Matricular em ${selectedDisciplinas.size} disciplina(s)`}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Carregando matrículas...</span>
          </div>
        ) : errorMatriculas ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="text-destructive font-medium mb-2">Erro ao carregar matrículas</p>
                <p className="text-sm text-muted-foreground mb-3">
                  {errorMatriculas instanceof AxiosError
                    ? (() => {
                        const responseData = errorMatriculas.response?.data;
                        const status = errorMatriculas.response?.status;
                        
                        // Mensagens específicas por status
                        if (status === 400) {
                          const details = (responseData as any)?.details;
                          if (details) {
                            if (typeof details === 'object' && 'campo' in details) {
                              return `Parâmetro inválido: ${(details as any).campo} - ${(details as any).motivo || 'valor inválido'}`;
                            }
                            return `Parâmetro inválido: ${typeof details === 'string' ? details : JSON.stringify(details)}`;
                          }
                          return (responseData as any)?.error || 'Parâmetros inválidos na requisição';
                        }
                        
                        return (responseData as any)?.message || 
                               (responseData as any)?.error || 
                               errorMatriculas.message ||
                               `Erro ${status ? `(${status})` : ''} ao carregar dados`;
                      })()
                    : errorMatriculas && typeof errorMatriculas === 'object' && 'message' in errorMatriculas
                    ? String((errorMatriculas as any).message)
                    : "Por favor, recarregue a página ou tente novamente mais tarde."}
                </p>
                {errorMatriculas instanceof AxiosError && (errorMatriculas.response?.data as any)?.details && (
                  <div className="mb-3 p-2 bg-background rounded border text-xs font-mono text-muted-foreground">
                    <strong>Detalhes:</strong> {JSON.stringify((errorMatriculas.response.data as any).details, null, 2)}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["aluno_disciplinas"] })}
                  >
                    Tentar novamente
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.reload()}
                  >
                    Recarregar página
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : matriculasAgrupadas && matriculasAgrupadas.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Ano / Classe</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead className="text-center">Disciplinas</TableHead>
                  <TableHead className="text-center">{periodoLabel}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matriculasAgrupadas.map((grupo) => {
                  const isExpanded = expandedAlunoId === grupo.alunoId;
                  const disciplinasUnicas = Array.from(
                    new Map(grupo.matriculas.map(m => [m.disciplina?.id, m.disciplina])).values()
                  ).filter(Boolean);

                  const handleToggleExpand = () => {
                    setExpandedAlunoId(isExpanded ? null : grupo.alunoId);
                  };

                  const handlePrint = (matricula?: Matricula) => {
                    const matriculaParaImprimir = matricula || grupo.matriculas[0];
                    if (!matriculaParaImprimir?.aluno || !matriculaParaImprimir?.disciplina) return;
                    
                    const alunoCompleto = alunos?.find(a => a.id === matriculaParaImprimir.aluno?.id);
                    
                    const reciboData: MatriculaReciboData = {
            instituicao: {
              nome: config?.nome_instituicao || instituicao?.nome || 'Instituição',
              nif: (config as { nif?: string })?.nif ?? null,
              logoUrl: config?.logo_url,
              email: config?.email,
              telefone: config?.telefone,
              endereco: config?.endereco,
            },
                      aluno: {
                        nome: matriculaParaImprimir.aluno.nome_completo,
                        numeroId: matriculaParaImprimir.aluno.numero_identificacao_publica || alunoCompleto?.numero_identificacao_publica,
                        bi: alunoCompleto?.numero_identificacao || matriculaParaImprimir.aluno.numero_identificacao_publica,
                        email: matriculaParaImprimir.aluno.email || alunoCompleto?.email,
                      },
                      matricula: {
                        curso: matriculaParaImprimir.disciplina?.curso?.nome || matriculaParaImprimir.turma?.curso?.nome || grupo.cursoNome || 'N/A',
                        turma: matriculaParaImprimir.turma?.nome || grupo.turmaNome || 'N/A',
                        disciplina: matricula ? matricula.disciplina?.nome || 'N/A' : disciplinasUnicas.map((d: any) => d.nome).join(', '),
                        disciplinas: matricula ? [matricula.disciplina?.nome].filter(Boolean) : disciplinasUnicas.map((d: any) => d.nome),
                        ano: matriculaParaImprimir.ano,
                        semestre: matricula ? matriculaParaImprimir.semestre : grupo.trimestres.join(','),
                        dataMatricula: matriculaParaImprimir.dataMatricula || matriculaParaImprimir.data_matricula || matriculaParaImprimir.createdAt || matriculaParaImprimir.created_at,
                        reciboNumero: gerarCodigoMatricula(),
                        tipoAcademico: isSecundario ? 'SECUNDARIO' : 'SUPERIOR',
                        anoFrequencia: !isSecundario ? (grupo.matriculaAnual?.classeOuAnoCurso ?? grupo.classeOuAno ?? null) : null,
                        classeFrequencia: isSecundario ? (grupo.matriculaAnual?.classeOuAnoCurso ?? grupo.classeOuAno ?? matriculaParaImprimir.turma?.classe?.nome ?? null) : null,
                      },
                      operador: user?.nome_completo ?? (user as { nomeCompleto?: string })?.nomeCompleto ?? null,
                    };
                    setPrintMatriculaData(reciboData);
                    setShowPrintDialog(true);
                  };

                  return (
                    <Fragment key={grupo.alunoId}>
                      <TableRow 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={handleToggleExpand}
                      >
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleExpand();
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">
                          {grupo.alunoNome}
                        </TableCell>
                        <TableCell>
                          {grupo.classeOuAno || grupo.matriculas[0]?.ano || "—"}
                        </TableCell>
                        <TableCell>
                          {grupo.cursoNome || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-medium">
                            {grupo.totalDisciplinas}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1 text-sm font-medium">
                            {grupo.trimestres.length > 0 ? (
                              grupo.trimestres.map((t, idx) => (
                                <span key={`${grupo.alunoId}-trimestre-${t}`}>
                                  {t}{idx < grupo.trimestres.length - 1 && ' | '}
                                </span>
                              ))
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(grupo.statusGeral)}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handlePrint()}
                              title="Imprimir comprovativo"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${grupo.alunoId}-expanded`}>
                          <TableCell colSpan={8} className="bg-muted/30 p-0">
                            <div className="p-6 space-y-6 animate-in slide-in-from-top-2 duration-200">
                              {/* Dados Acadêmicos */}
                              <div className="space-y-4">
                                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                  <BookOpen className="h-4 w-4" />
                                  Dados Acadêmicos
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Nome do Estudante</p>
                                    <p className="font-medium">{grupo.alunoNome}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Ano / Classe</p>
                                    <p className="font-medium">{grupo.classeOuAno || grupo.matriculas[0]?.ano || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Curso</p>
                                    <p className="font-medium">{grupo.cursoNome || "—"}</p>
                                  </div>
                                  {grupo.turmaNome && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Turma</p>
                                      <p className="font-medium">{grupo.turmaNome}</p>
                                    </div>
                                  )}
                                  {grupo.turnoNome && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Turno</p>
                                      <p className="font-medium">{grupo.turnoNome}</p>
                                    </div>
                                  )}
                                  {grupo.matriculaAnual && (
                                    <>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Ano Letivo</p>
                                        <p className="font-medium">{grupo.matriculaAnual.anoLetivo}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Status da Matrícula</p>
                                        <Badge variant={grupo.matriculaAnual.status === 'ATIVA' ? 'default' : 'secondary'}>
                                          {grupo.matriculaAnual.status === 'ATIVA' ? 'Ativa' : grupo.matriculaAnual.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada'}
                                        </Badge>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Lista de Disciplinas */}
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                    <GraduationCap className="h-4 w-4" />
                                    Disciplinas Matriculadas ({grupo.totalDisciplinas})
                                  </h4>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {periodoLabelPlural}: {grupo.trimestres.map(t => `${t}º`).join(', ')}
                                  </div>
                                </div>
                                <div className="border rounded-lg divide-y">
                                  {disciplinasUnicas.map((disciplina: any) => {
                                    const matriculasDisciplina = grupo.matriculas.filter(m => m.disciplina?.id === disciplina.id);
                                    const trimestresDisc = Array.from(new Set(matriculasDisciplina.map(m => parseInt(m.semestre)))).sort();
                                    
                                    return (
                                      <div key={disciplina.id} className="p-4 hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1">
                                            <p className="font-medium">{disciplina.nome}</p>
                                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                              <span>{periodoLabelPlural}: {trimestresDisc.map(t => `${t}º`).join(', ')}</span>
                                              <span>Ano: {matriculasDisciplina[0]?.ano}</span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {getStatusBadge(matriculasDisciplina[0]?.status || 'Matriculado')}
                                            <div className="flex gap-1">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handlePrint(matriculasDisciplina[0])}
                                                title="Imprimir matrícula"
                                              >
                                                <Printer className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleEdit(matriculasDisciplina[0])}
                                                title="Editar matrícula"
                                              >
                                                <Pencil className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => {
                                                  if (confirm(`Tem certeza que deseja cancelar a matrícula de ${grupo.alunoNome} em ${disciplina.nome}?`)) {
                                                    deleteMutation.mutate(matriculasDisciplina[0]?.id);
                                                  }
                                                }}
                                                title="Cancelar matrícula"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Sem matrículas em disciplinas</h3>
            <p className="text-muted-foreground">
              {searchTerm || filterAno !== "all" || filterSemestre !== "all"
                ? "Nenhuma matrícula encontrada com os filtros aplicados. Tente ajustar os filtros de busca."
                : "Não há matrículas em disciplinas cadastradas. Clique em 'Nova Matrícula' para adicionar."}
            </p>
          </div>
        )}
      </CardContent>

      {printMatriculaData && (
        <PrintMatriculaDialog
          open={showPrintDialog}
          onOpenChange={setShowPrintDialog}
          matriculaData={printMatriculaData}
        />
      )}
    </Card>
  );
}
