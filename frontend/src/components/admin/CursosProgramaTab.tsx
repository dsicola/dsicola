import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Search, ArrowUpDown, GraduationCap, Lock, BookOpen, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ExportButtons } from "@/components/common/ExportButtons";
import { toast } from 'sonner';
import { z } from 'zod';
import { useTenantFilter, useCurrentInstituicaoId } from '@/hooks/useTenantFilter';
import { cursosApi, disciplinasApi, classesApi } from '@/services/api';
import { PeriodoAcademicoSelect } from '@/components/academico/PeriodoAcademicoSelect';
import { useAnoLetivoAtivo } from '@/hooks/useAnoLetivoAtivo';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { DURACOES_CURSO_SUPERIOR, GRAUS_CURSO_SUPERIOR } from '@/constants/cursoAcademico';

interface CursoPrograma {
  id: string;
  nome: string;
  codigo: string;
  descricao: string | null;
  cargaHoraria: number; // Backend retorna camelCase
  valorMensalidade: number; // Backend retorna camelCase
  taxaMatricula?: number | null; // Taxa de matrícula (cadastrada pelo admin, carrega na matrícula)
  valorBata?: number | null;
  exigeBata?: boolean;
  valorPasse?: number | null;
  exigePasse?: boolean;
  valorEmissaoDeclaracao?: number | null;
  valorEmissaoCertificado?: number | null;
  tipo: string | null;
  grau: string | null;
  duracao: string | null;
  modeloPauta?: string | null; // PADRAO | CONCLUSAO - pauta conclusão do curso
  ativo: boolean;
  createdAt: string; // Backend retorna camelCase
}

const cursoSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100),
  codigo: z.string().min(2, 'Código deve ter pelo menos 2 caracteres').max(20),
  descricao: z.string().max(500).optional(),
  carga_horaria: z.number().min(1, 'Carga horária deve ser maior que 0').max(10000),
  valor_mensalidade: z.number().min(0, 'Valor deve ser maior ou igual a 0'),
  taxa_matricula: z.number().min(0, 'Taxa de matrícula deve ser maior ou igual a 0').optional(),
  valor_bata: z.number().min(0).optional(),
  exige_bata: z.boolean().optional(),
  valor_passe: z.number().min(0).optional(),
  exige_passe: z.boolean().optional(),
  valor_emissao_declaracao: z.number().min(0).optional(),
  valor_emissao_certificado: z.number().min(0).optional(),
  tipo: z.string().optional(),
  grau: z.string().optional(),
  duracao: z.string().optional(),
  modelo_pauta: z.enum(['PADRAO', 'CONCLUSAO']).optional(),
  ativo: z.boolean(),
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
  }).format(value);
};

export const CursosProgramaTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [cursos, setCursos] = useState<CursoPrograma[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [editingCurso, setEditingCurso] = useState<CursoPrograma | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useSafeDialog(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const {
    isSuperior: ctxSuperior,
    isSecundario: ctxSecundario,
    tipoAcademico,
    isUniversidade,
    loading: instituicaoLoading,
    config,
    instituicao,
  } = useInstituicao();

  /** Alinha formulário e tabela ao tenant: evita mostrar “duração/grau” no secundário se o contexto ainda não sincronizou só com o JWT. */
  const tipoEfetivo = useMemo<'SUPERIOR' | 'SECUNDARIO' | null>(() => {
    if (tipoAcademico === 'SUPERIOR' || tipoAcademico === 'SECUNDARIO') return tipoAcademico;
    if (ctxSuperior) return 'SUPERIOR';
    if (ctxSecundario) return 'SECUNDARIO';
    const instTa = instituicao?.tipo_academico;
    if (instTa === 'SUPERIOR' || instTa === 'SECUNDARIO') return instTa;
    const cfgTa =
      config?.tipo_academico ??
      (config as { tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' } | null)?.tipoAcademico ??
      null;
    if (cfgTa === 'SUPERIOR' || cfgTa === 'SECUNDARIO') return cfgTa;
    return null;
  }, [tipoAcademico, ctxSuperior, ctxSecundario, instituicao?.tipo_academico, config]);

  const isSuperior = tipoEfetivo === 'SUPERIOR';
  const isSecundario = tipoEfetivo === 'SECUNDARIO';
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    descricao: '',
    carga_horaria: 3000,
    valor_mensalidade: 50000,
    taxa_matricula: 45000 as number | undefined,
    valor_bata: undefined as number | undefined,
    exige_bata: false,
    valor_passe: undefined as number | undefined,
    exige_passe: false,
    valor_emissao_declaracao: undefined as number | undefined,
    valor_emissao_certificado: undefined as number | undefined,
    tipo: 'geral',
    grau: '',
    duracao: '',
    modelo_pauta: 'PADRAO' as 'PADRAO' | 'CONCLUSAO',
    ativo: true,
  });
  const [filterAtivo, setFilterAtivo] = useState<string>('todos');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Estados para gerenciar disciplinas do curso
  const [disciplinasDialogOpen, setDisciplinasDialogOpen] = useSafeDialog(false);
  const [selectedCursoId, setSelectedCursoId] = useState<string | null>(null);
  const [selectedCursoNome, setSelectedCursoNome] = useState<string>('');
  const [vinculoDisciplinaDialogOpen, setVinculoDisciplinaDialogOpen] = useSafeDialog(false);
  const [deleteVinculoDialogOpen, setDeleteVinculoDialogOpen] = useSafeDialog(false);
  const [deletingVinculo, setDeletingVinculo] = useState<{
    disciplinaId: string;
    classeId?: string | null;
  } | null>(null);
  const [vinculoFormData, setVinculoFormData] = useState({
    disciplinaId: '',
    classeId: '' as string,
    semestre: undefined as number | undefined, // Não usar valor padrão hardcoded
    trimestre: undefined as number | undefined, // Não usar valor padrão hardcoded
    cargaHoraria: undefined as number | undefined,
    obrigatoria: true,
    preRequisitoDisciplinaId: '' as string,
  });

  const { instituicaoId, shouldFilter } = useTenantFilter();
  const currentInstituicaoId = useCurrentInstituicaoId();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();

  const fetchCursos = async () => {
    try {
      // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
      // O backend usa req.user.instituicaoId do JWT token automaticamente
      const data = await cursosApi.getAll({ 
        excludeTipo: 'classe'
      });
      setCursos(data || []);
    } catch (error) {
      console.error('Erro ao buscar cursos:', error);
      toast.error('Não foi possível carregar os cursos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (instituicaoId || !shouldFilter) {
      fetchCursos();
    }
  }, [sortOrder, instituicaoId, shouldFilter]);

  const filteredCursos = cursos.filter((curso) => {
    const matchesSearch =
      curso.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      curso.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAtivo =
      filterAtivo === 'todos' ||
      (filterAtivo === 'ativo' && curso.ativo) ||
      (filterAtivo === 'inativo' && !curso.ativo);
    return matchesSearch && matchesAtivo;
  });

  const sortedCursos = [...filteredCursos].sort((a, b) => {
    const comparison = a.nome.localeCompare(b.nome);
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const getTipoLabel = (tipo: string | null) => {
    switch (tipo) {
      case 'tecnico': return 'Técnico';
      case 'outro': return 'Outro';
      default: return 'Geral';
    }
  };

  const exportData = sortedCursos.map(c => [
    c.codigo,
    c.nome,
    getTipoLabel(c.tipo),
    `${c.cargaHoraria}h`,
    formatCurrency(Number(c.valorMensalidade)),
    c.ativo ? 'Ativo' : 'Inativo',
  ]);

  const openDialog = (curso?: CursoPrograma) => {
    if (curso) {
      setEditingCurso(curso);
      setFormData({
        nome: curso.nome,
        codigo: curso.codigo,
        descricao: curso.descricao || '',
        carga_horaria: curso.cargaHoraria,
        valor_mensalidade: Number(curso.valorMensalidade),
        taxa_matricula: curso.taxaMatricula != null ? Number(curso.taxaMatricula) : undefined,
        valor_bata: curso.valorBata != null ? Number(curso.valorBata) : undefined,
        exige_bata: curso.exigeBata ?? false,
        valor_passe: curso.valorPasse != null ? Number(curso.valorPasse) : undefined,
        exige_passe: curso.exigePasse ?? false,
        valor_emissao_declaracao: curso.valorEmissaoDeclaracao != null ? Number(curso.valorEmissaoDeclaracao) : undefined,
        valor_emissao_certificado: curso.valorEmissaoCertificado != null ? Number(curso.valorEmissaoCertificado) : undefined,
        tipo: curso.tipo || 'geral',
        grau: isSuperior ? (curso.grau || 'Licenciatura') : '',
        duracao: isSuperior ? curso.duracao || '4 anos' : '',
        modelo_pauta: (curso as { modeloPauta?: string }).modeloPauta === 'CONCLUSAO' || (curso as { modeloPauta?: string }).modeloPauta === 'SAUDE' ? 'CONCLUSAO' : 'PADRAO',
        ativo: curso.ativo ?? true,
      });
    } else {
      setEditingCurso(null);
      setFormData({ 
        nome: '', 
        codigo: '', 
        descricao: '', 
        carga_horaria: 3000, 
        valor_mensalidade: isSuperior ? 50000 : 0,
        taxa_matricula: isSuperior ? 45000 : undefined,
        valor_bata: undefined,
        exige_bata: false,
        valor_passe: undefined,
        exige_passe: false,
        valor_emissao_declaracao: undefined,
        valor_emissao_certificado: undefined,
        tipo: 'geral',
        grau: isSuperior ? 'Licenciatura' : '',
        duracao: isSuperior ? '4 anos' : '',
        modelo_pauta: 'PADRAO',
        ativo: true 
      });
    }
    setErrors({});
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      // Validação manual adicional para campos condicionais
      const manualErrors: Record<string, string> = {};
      
      if (isSuperior) {
        if (!formData.duracao || !DURACOES_CURSO_SUPERIOR.includes(formData.duracao as (typeof DURACOES_CURSO_SUPERIOR)[number])) {
          manualErrors.duracao = 'Selecione a duração nominal do curso (1 a 6 anos)';
        }
        if (!formData.grau || !GRAUS_CURSO_SUPERIOR.includes(formData.grau as (typeof GRAUS_CURSO_SUPERIOR)[number])) {
          manualErrors.grau = 'Selecione o grau académico';
        }
        // Mensalidade obrigatória e > 0 para Ensino Superior
        if (!formData.valor_mensalidade || formData.valor_mensalidade <= 0) {
          manualErrors.valor_mensalidade = 'Valor da mensalidade é obrigatório e deve ser maior que zero';
        }
      }
      
      // Carga horária obrigatória e > 0
      if (!formData.carga_horaria || formData.carga_horaria <= 0) {
        manualErrors.carga_horaria = 'Carga horária é obrigatória e deve ser maior que zero';
      }
      
      if (Object.keys(manualErrors).length > 0) {
        setErrors(manualErrors);
        setSubmitting(false);
        return;
      }

      const validatedData = cursoSchema.parse({
        ...formData,
        carga_horaria: Number(formData.carga_horaria),
        valor_mensalidade: Number(formData.valor_mensalidade),
        taxa_matricula: formData.taxa_matricula != null ? Number(formData.taxa_matricula) : undefined,
        modelo_pauta: formData.modelo_pauta,
        ativo: formData.ativo,
      });

      // Multi-tenant: NUNCA enviar instituicaoId ou tipo de instituição do frontend
      // O backend usa o do usuário autenticado e o tipo é herdado automaticamente
      const dataToSave: any = {
        nome: validatedData.nome,
        codigo: validatedData.codigo,
        descricao: validatedData.descricao || null,
        cargaHoraria: validatedData.carga_horaria,
        valorMensalidade: validatedData.valor_mensalidade,
        ativo: validatedData.ativo,
      };
      if (validatedData.taxa_matricula !== undefined && validatedData.taxa_matricula >= 0) {
        dataToSave.taxaMatricula = validatedData.taxa_matricula;
      }
      if (validatedData.valor_bata !== undefined && validatedData.valor_bata >= 0) dataToSave.valorBata = validatedData.valor_bata;
      if (validatedData.exige_bata !== undefined) dataToSave.exigeBata = validatedData.exige_bata;
      if (validatedData.valor_passe !== undefined && validatedData.valor_passe >= 0) dataToSave.valorPasse = validatedData.valor_passe;
      if (validatedData.exige_passe !== undefined) dataToSave.exigePasse = validatedData.exige_passe;
      if (validatedData.valor_emissao_declaracao !== undefined && validatedData.valor_emissao_declaracao >= 0) dataToSave.valorEmissaoDeclaracao = validatedData.valor_emissao_declaracao;
      if (validatedData.valor_emissao_certificado !== undefined && validatedData.valor_emissao_certificado >= 0) dataToSave.valorEmissaoCertificado = validatedData.valor_emissao_certificado;

      // Campos específicos por tipo de instituição
      if (isSuperior) {
        dataToSave.grau = validatedData.grau!;
        dataToSave.duracao = validatedData.duracao!;
        if (validatedData.tipo) {
          dataToSave.tipo = validatedData.tipo;
        }
      } else if (isSecundario) {
        // Ensino Secundário: curso = área/opção; duração do percurso é pelas Classes e ciclo (config. instituição)
        dataToSave.valorMensalidade = 0;
      }

      // Modelo de pauta: PADRAO | CONCLUSAO (pauta conclusão do curso)
      if (formData.modelo_pauta) {
        dataToSave.modeloPauta = formData.modelo_pauta;
      }

      if (editingCurso) {
        await cursosApi.update(editingCurso.id, dataToSave, { expectedUpdatedAt: (editingCurso as any)?.updatedAt });
        toast.success('Curso atualizado com sucesso!');
      } else {
        await cursosApi.create(dataToSave);
        toast.success('Curso cadastrado com sucesso!');
      }

      setIsDialogOpen(false);
      fetchCursos();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else if (error?.response?.status === 409 || error?.message?.includes('duplicate')) {
        toast.error('Já existe um curso com este código. Por favor, use um código diferente.');
        setErrors({ codigo: 'Este código já está em uso' });
      } else {
        console.error('Erro ao salvar curso:', error);
        toast.error('Não foi possível salvar o curso. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;

    try {
      await cursosApi.delete(deletingId);
      queryClient.invalidateQueries({ queryKey: ['cursos'] });
      toast.success('Curso excluído com sucesso!');
      fetchCursos();
      setDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (error) {
      console.error('Erro ao excluir curso:', error);
      toast.error('Erro ao excluir curso. Verifique se não há dependências.');
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  // ============== GERENCIAMENTO DE DISCIPLINAS DO CURSO ==============
  
  // Abrir dialog de disciplinas do curso
  const openDisciplinasDialog = (curso: CursoPrograma) => {
    setSelectedCursoId(curso.id);
    setSelectedCursoNome(curso.nome);
    setDisciplinasDialogOpen(true);
  };

  // Buscar disciplinas do curso selecionado
  const { data: disciplinasDoCurso = [], isLoading: loadingDisciplinas, refetch: refetchDisciplinas } = useQuery({
    queryKey: ['curso-disciplinas', selectedCursoId],
    queryFn: async () => {
      if (!selectedCursoId) return [];
      const data = await cursosApi.listarDisciplinas(selectedCursoId);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedCursoId && disciplinasDialogOpen,
  });

  // Buscar todas as disciplinas disponíveis para vincular
  const { data: disciplinasDisponiveis = [], isLoading: loadingDisciplinasDisponiveis } = useQuery({
    queryKey: ['disciplinas-disponiveis', instituicaoId, tipoAcademico],
    queryFn: async () => {
      const data = await disciplinasApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: vinculoDisciplinaDialogOpen && disciplinasDialogOpen,
  });

  const { data: classesInstituicao = [] } = useQuery({
    queryKey: ['classes-vinculo-curso', instituicaoId],
    queryFn: async () => {
      const data = await classesApi.getAll({ ativo: true });
      return Array.isArray(data) ? data : [];
    },
    enabled: isSecundario && vinculoDisciplinaDialogOpen && disciplinasDialogOpen && !!instituicaoId,
  });

  // Filtrar disciplinas já vinculadas (por disciplina + classe no secundário)
  const disciplinasNaoVinculadas = disciplinasDisponiveis.filter((disc: any) => {
    const alvoClasse = isSecundario ? vinculoFormData.classeId?.trim() || null : null;
    return !disciplinasDoCurso.some((vinculo: any) => {
      if (vinculo.disciplina?.id !== disc.id) return false;
      if (!isSecundario) return true;
      return (vinculo.classeId ?? null) === alvoClasse;
    });
  });

  // Abrir dialog para vincular disciplina
  const openVinculoDisciplinaDialog = () => {
    setVinculoFormData({
      disciplinaId: '',
      classeId: '',
      semestre: undefined, // Não usar valor padrão hardcoded
      trimestre: undefined, // Não usar valor padrão hardcoded
      cargaHoraria: undefined,
      obrigatoria: true,
      preRequisitoDisciplinaId: '',
    });
    setVinculoDisciplinaDialogOpen(true);
  };

  // Vincular disciplina ao curso
  const handleVincularDisciplina = async () => {
    if (!selectedCursoId || !vinculoFormData.disciplinaId) {
      toast.error('Selecione uma disciplina');
      return;
    }

    try {
      const preId =
        isSuperior && vinculoFormData.preRequisitoDisciplinaId?.trim()
          ? vinculoFormData.preRequisitoDisciplinaId.trim()
          : undefined;
      if (preId === vinculoFormData.disciplinaId) {
        toast.error('Pré-requisito não pode ser a própria disciplina.');
        return;
      }
      await cursosApi.vincularDisciplina(selectedCursoId, {
        disciplinaId: vinculoFormData.disciplinaId,
        semestre: isSuperior ? vinculoFormData.semestre : undefined,
        trimestre: isSecundario ? vinculoFormData.trimestre : undefined,
        cargaHoraria: vinculoFormData.cargaHoraria,
        obrigatoria: vinculoFormData.obrigatoria,
        preRequisitoDisciplinaId: preId ?? null,
        classeId:
          isSecundario && vinculoFormData.classeId?.trim()
            ? vinculoFormData.classeId.trim()
            : null,
      });
      
      toast.success('Disciplina vinculada com sucesso!');
      setVinculoDisciplinaDialogOpen(false);
      refetchDisciplinas();
      queryClient.invalidateQueries({ queryKey: ['curso-disciplinas', selectedCursoId] });
    } catch (error: any) {
      console.error('Erro ao vincular disciplina:', error);
      toast.error(error?.response?.data?.message || 'Erro ao vincular disciplina');
    }
  };

  // Desvincular disciplina do curso
  const handleDesvincularDisciplina = async () => {
    if (!selectedCursoId || !deletingVinculo) return;

    try {
      await cursosApi.desvincularDisciplina(selectedCursoId, deletingVinculo.disciplinaId, {
        classeId: deletingVinculo.classeId ?? undefined,
      });
      toast.success('Disciplina desvinculada com sucesso!');
      setDeleteVinculoDialogOpen(false);
      setDeletingVinculo(null);
      refetchDisciplinas();
      queryClient.invalidateQueries({ queryKey: ['curso-disciplinas', selectedCursoId] });
    } catch (error: any) {
      console.error('Erro ao desvincular disciplina:', error);
      toast.error(error?.response?.data?.message || 'Erro ao desvincular disciplina');
      setDeleteVinculoDialogOpen(false);
      setDeletingVinculo(null);
    }
  };

  // Confirmar desvincular disciplina
  const confirmDesvincularDisciplina = (disciplinaId: string, classeId?: string | null) => {
    setDeletingVinculo({ disciplinaId, classeId: classeId ?? null });
    setDeleteVinculoDialogOpen(true);
  };

  const handleAtualizarPreRequisito = async (
    disciplinaAlvoId: string,
    preRequisitoId: string | null,
    classeIdVinculo?: string | null
  ) => {
    if (!selectedCursoId) return;
    try {
      await cursosApi.atualizarVinculoDisciplina(
        selectedCursoId,
        disciplinaAlvoId,
        {
          preRequisitoDisciplinaId: preRequisitoId,
        },
        { classeId: classeIdVinculo ?? undefined }
      );
      toast.success('Pré-requisito atualizado.');
      refetchDisciplinas();
      queryClient.invalidateQueries({ queryKey: ['curso-disciplinas', selectedCursoId] });
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Erro ao atualizar pré-requisito');
    }
  };

  return (
    <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Cursos
              </CardTitle>
              <CardDescription>
                Gerencie os cursos e programas de formação
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <ExportButtons
                titulo="Relatório de Cursos"
                colunas={['Código', 'Nome', 'Modalidade', 'Carga Horária', 'Mensalidade', 'Status']}
                dados={exportData}
              />
              <Button onClick={() => openDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Curso
              </Button>
            </div>
          </div>
        </CardHeader>
      <CardContent>
        <div className="bg-muted/50 p-4 rounded-lg mb-6">
          <p className="text-sm text-muted-foreground">
            {isSecundario 
              ? 'Cadastre aqui as ÁREAS/OPÇÕES do Ensino Secundário (ex: Ciências Humanas, Informática). A mensalidade e o tempo do percurso até a conclusão definem-se pelas Classes e pelo ciclo de conclusão nas configurações da instituição, não por “duração do curso” como no superior.'
              : 'Cadastre aqui os cursos/programas de formação oferecidos pela instituição (ex: Enfermagem, Ciências Humanas, Administração). Defina a duração nominal (1 a 6 anos) e o grau para fins cadastrais e documentais.'
            }
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterAtivo} onValueChange={setFilterAtivo}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            <ArrowUpDown className="mr-2 h-4 w-4" />
            {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : sortedCursos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? 'Nenhum curso encontrado' : 'Nenhum curso cadastrado. Clique em "Novo Curso" para adicionar.'}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  {isSuperior && <TableHead>Grau</TableHead>}
                  {isSuperior && <TableHead>Duração</TableHead>}
                  <TableHead>Carga Horária</TableHead>
                  {isSuperior && <TableHead>Mensalidade</TableHead>}
                  {isSecundario && <TableHead className="text-muted-foreground">Mensalidade (na Classe)</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCursos.map((curso) => (
                  <TableRow key={curso.id} className={!curso.ativo ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{curso.codigo}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {curso.nome}
                        {(curso.modeloPauta === 'CONCLUSAO' || curso.modeloPauta === 'SAUDE') && (
                          <Badge variant="secondary" className="text-xs">Conclusão</Badge>
                        )}
                      </div>
                    </TableCell>
                    {isSuperior && (
                      <TableCell>
                        <Badge variant="outline">
                          {curso.grau ?? '—'}
                        </Badge>
                      </TableCell>
                    )}
                    {isSuperior && (
                      <TableCell>{curso.duracao ?? '—'}</TableCell>
                    )}
                    <TableCell>{curso.cargaHoraria}h</TableCell>
                    {isSuperior && (
                      <TableCell className="font-medium text-green-600">
                        {formatCurrency(Number(curso.valorMensalidade))}
                      </TableCell>
                    )}
                    {isSecundario && (
                      <TableCell className="text-muted-foreground text-sm">
                        Definida na Classe
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant={curso.ativo ? 'default' : 'destructive'}>
                        {curso.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDisciplinasDialog(curso)}
                            >
                              <BookOpen className="h-4 w-4 text-primary" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Gerenciar disciplinas do curso</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDialog(curso)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Editar curso</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(curso.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Excluir curso</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {isSecundario
                  ? editingCurso
                    ? 'Editar área ou opção'
                    : 'Nova área ou opção'
                  : editingCurso
                    ? 'Editar Curso'
                    : 'Novo Curso'}
              </DialogTitle>
              <DialogDescription>
                {isSecundario
                  ? 'Área ou opção de formação (ex.: Ciências, Informática). Valores mensais definem-se na Classe, não aqui.'
                  : 'Cadastre um curso ou programa de formação (ex.: Enfermagem, Administração, Ciências Humanas).'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {/* Mostrar loading apenas se o contexto ainda estiver carregando */}
                {instituicaoLoading && (
                  <div className="text-xs text-muted-foreground py-2">
                    Carregando informações da instituição...
                  </div>
                )}
                {/* Primeira linha: Nome e Código */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">
                      {isSecundario ? 'Nome da área ou opção *' : 'Nome do Curso *'}
                    </Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) =>
                        setFormData({ ...formData, nome: e.target.value })
                      }
                      placeholder={
                        isSecundario
                          ? 'Ex.: Ciências, Informática'
                          : 'Ex: Enfermagem, Administração'
                      }
                      required
                    />
                    {errors.nome && (
                      <p className="text-sm text-destructive">{errors.nome}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código do Curso *</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) =>
                        setFormData({ ...formData, codigo: e.target.value })
                      }
                      placeholder="Ex: ENF, ADM, CH"
                      required
                    />
                    {errors.codigo && (
                      <p className="text-sm text-destructive">{errors.codigo}</p>
                    )}
                  </div>
                </div>
                
                {/* Segunda linha: Tipo de Instituição (read-only) */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Tipo de Instituição
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  </Label>
                  {(() => {
                    const tipoAtual = tipoEfetivo;
                    if (tipoAtual === 'SUPERIOR' || tipoAtual === 'SECUNDARIO') {
                      const label = tipoAtual === 'SUPERIOR'
                        ? 'Ensino Superior'
                        : 'Ensino Secundário';
                      
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge 
                              variant="outline" 
                              className="bg-primary/10 border-primary/30 text-primary font-semibold px-4 py-2 text-sm"
                            >
                              <Lock className="h-3.5 w-3.5 mr-2" />
                              {label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Definido nas configurações da instituição; não editável aqui.
                            </span>
                          </div>
                        </div>
                      );
                    }
                    
                    // Fallback: se não houver tipo definido (caso raro em produção)
                    // Este caso só deve ocorrer durante carregamento inicial ou configuração incompleta
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className="bg-muted/50 border-muted-foreground/30 text-muted-foreground px-4 py-2 text-sm"
                          >
                            <Lock className="h-3.5 w-3.5 mr-2" />
                            A ser identificado automaticamente
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          O tipo de instituição será identificado automaticamente com base na estrutura acadêmica criada (cursos, disciplinas, semestres, trimestres, classes).
                        </p>
                      </div>
                    );
                  })()}
                </div>
                
                {/* Terceira linha: Grau e Duração (horizontal) */}
                {isSuperior && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="grau">Grau / Nível Acadêmico *</Label>
                      <Select
                        value={formData.grau}
                        onValueChange={(value) => {
                          setFormData({ ...formData, grau: value });
                          if (errors.grau) {
                            setErrors({ ...errors, grau: '' });
                          }
                        }}
                        required
                      >
                        <SelectTrigger className={errors.grau ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Selecione o grau acadêmico" />
                        </SelectTrigger>
                        <SelectContent>
                          {GRAUS_CURSO_SUPERIOR.map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.grau && (
                        <p className="text-sm text-destructive">{errors.grau}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duracao">Duração nominal do curso *</Label>
                      <Select
                        value={formData.duracao}
                        onValueChange={(value) => {
                          setFormData({ ...formData, duracao: value });
                          if (errors.duracao) {
                            setErrors({ ...errors, duracao: '' });
                          }
                        }}
                        required
                      >
                        <SelectTrigger className={errors.duracao ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Selecione a duração" />
                        </SelectTrigger>
                        <SelectContent>
                          {DURACOES_CURSO_SUPERIOR.map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.duracao && (
                        <p className="text-sm text-destructive">{errors.duracao}</p>
                      )}
                    </div>
                  </div>
                )}
                
                {isSecundario && (
                  <Collapsible defaultOpen className="group rounded-md border border-border/60 bg-muted/20">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40 rounded-md transition-colors">
                      <span className="text-foreground/90">Guia — Ensino Secundário (área ou opção)</span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3 pt-0">
                      <div className="space-y-3 text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
                        <p>
                          <strong className="text-foreground/90">O que é este registo.</strong>{' '}
                          No secundário trata-se apenas da <strong>área ou opção</strong> de formação (ex.: Ciências
                          Humanas, Informática, Enfermagem enquanto ramo). Serve para agrupar disciplinas e regras
                          pedagógicas; não substitui a Classe nem a turma.
                        </p>
                        <p>
                          <strong className="text-foreground/90">Duração em anos.</strong>{' '}
                          <strong>Não existe “duração do curso” em anos neste ecrã</strong> — esse conceito
                          aplica-se ao <strong>Ensino Superior</strong>. No secundário, o tempo até à conclusão do
                          percurso organiza-se pelas <strong>Classes</strong> (ex.: 10.ª, 11.ª, 12.ª) e pela
                          definição do <strong>ciclo de conclusão</strong> nas configurações académicas.
                        </p>
                        <p>
                          <strong className="text-foreground/90">Configurações da instituição.</strong>{' '}
                          Ajuste o <strong>ciclo secundário</strong>, <strong>hora-aula</strong> e restantes parâmetros
                          gerais em{' '}
                          <Link
                            to="/admin-dashboard/configuracoes"
                            className="text-primary font-medium underline-offset-4 hover:underline"
                          >
                            Configurações da instituição
                          </Link>
                          .
                        </p>
                        <p>
                          <strong className="text-foreground/90">Mensalidade e taxas.</strong>{' '}
                          A <strong>mensalidade</strong> é definida na <strong>Classe</strong> (e contexto de
                          matrícula/turma), <strong>não neste registo</strong>. Aqui pode manter carga horária,
                          disciplinas vinculadas, pautas e itens opcionais (bata, passe, taxas de documentos) quando
                          fizer sentido para esta área/opção.
                        </p>
                        <ul className="list-disc space-y-1 pl-4">
                          <li>
                            Preencha <strong>nome</strong> e <strong>código</strong> de forma clara para relatórios e
                            filtros.
                          </li>
                          <li>
                            <strong>Carga horária total</strong>: somatório previsto ao longo do percurso associado a
                            esta área/opção (alinhado às disciplinas).
                          </li>
                        </ul>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                
                {/* Quarta linha: Carga Horária e Mensalidade (horizontal) */}
                <div className={`grid gap-4 ${isSuperior ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="space-y-2">
                    <Label htmlFor="carga_horaria">Carga Horária Total (horas) *</Label>
                    <Input
                      id="carga_horaria"
                      type="number"
                      min="1"
                      value={formData.carga_horaria}
                      onChange={(e) => {
                        setFormData({ ...formData, carga_horaria: parseInt(e.target.value) || 0 });
                        if (errors.carga_horaria) {
                          setErrors({ ...errors, carga_horaria: '' });
                        }
                      }}
                      placeholder="Ex: 3000"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Carga horária total do curso (somatório de todas as disciplinas ao longo do curso).
                    </p>
                    {errors.carga_horaria && (
                      <p className="text-sm text-destructive">{errors.carga_horaria}</p>
                    )}
                  </div>
                  {isSuperior && (
                    <>
                    <div className="space-y-2">
                      <Label htmlFor="valor_mensalidade">Valor da Mensalidade (Kz) *</Label>
                      <Input
                        id="valor_mensalidade"
                        type="number"
                        min="1"
                        value={formData.valor_mensalidade}
                        onChange={(e) => {
                          setFormData({ ...formData, valor_mensalidade: parseInt(e.target.value) || 0 });
                          if (errors.valor_mensalidade) {
                            setErrors({ ...errors, valor_mensalidade: '' });
                          }
                        }}
                        placeholder="Ex: 50000"
                        required
                      />
                      {errors.valor_mensalidade && (
                        <p className="text-sm text-destructive">{errors.valor_mensalidade}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxa_matricula">Taxa de Matrícula (Kz)</Label>
                      <Input
                        id="taxa_matricula"
                        type="number"
                        min="0"
                        value={formData.taxa_matricula ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFormData({ ...formData, taxa_matricula: v === '' ? undefined : parseFloat(v) || 0 });
                        }}
                        placeholder="Ex: 45000 (usado no recibo de matrícula)"
                      />
                      <p className="text-xs text-muted-foreground">
                        Valor carregado automaticamente na matrícula do estudante.
                      </p>
                    </div>
                    </>
                  )}
                </div>

                {/* Itens obrigatórios e taxas específicas por curso */}
                <Separator className="my-4" />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Itens obrigatórios e taxas por curso</Label>
                  <p className="text-xs text-muted-foreground">
                    Cursos que exigem bata (ex: Enfermagem), passe ou têm valores específicos para emissão de documentos.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="exige_bata"
                        checked={formData.exige_bata}
                        onCheckedChange={(checked) => setFormData({ ...formData, exige_bata: !!checked })}
                      />
                      <Label htmlFor="exige_bata">Exige bata</Label>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Valor (Kz)"
                      value={formData.valor_bata ?? ''}
                      onChange={(e) => setFormData({ ...formData, valor_bata: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
                      disabled={!formData.exige_bata}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="exige_passe"
                        checked={formData.exige_passe}
                        onCheckedChange={(checked) => setFormData({ ...formData, exige_passe: !!checked })}
                      />
                      <Label htmlFor="exige_passe">Exige passe</Label>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Valor (Kz)"
                      value={formData.valor_passe ?? ''}
                      onChange={(e) => setFormData({ ...formData, valor_passe: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
                      disabled={!formData.exige_passe}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valor_emissao_declaracao">Emissão declaração (Kz)</Label>
                    <Input
                      id="valor_emissao_declaracao"
                      type="number"
                      min="0"
                      placeholder="Sobrescreve padrão"
                      value={formData.valor_emissao_declaracao ?? ''}
                      onChange={(e) => setFormData({ ...formData, valor_emissao_declaracao: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valor_emissao_certificado">Emissão certificado (Kz)</Label>
                    <Input
                      id="valor_emissao_certificado"
                      type="number"
                      min="0"
                      placeholder="Sobrescreve padrão"
                      value={formData.valor_emissao_certificado ?? ''}
                      onChange={(e) => setFormData({ ...formData, valor_emissao_certificado: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                
                {/* Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) =>
                      setFormData({ ...formData, descricao: e.target.value })
                    }
                    placeholder="Descrição do curso..."
                    rows={3}
                  />
                </div>

                {/* Modelo de Pauta - define se o curso usa mini pauta padrão ou pauta de conclusão */}
                <div className="space-y-2">
                  <Label htmlFor="modelo_pauta">Modelo de Pauta</Label>
                  <Select
                    value={formData.modelo_pauta}
                    onValueChange={(v: 'PADRAO' | 'CONCLUSAO') => setFormData({ ...formData, modelo_pauta: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PADRAO">Padrão (mini pauta por disciplina)</SelectItem>
                      <SelectItem value="CONCLUSAO">Conclusão (pauta conclusão do curso)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Cada curso pode escolher o modelo da sua mini pauta. Se não escolher, o sistema usa o modelo
                    <strong> Padrão</strong> (mini pauta por disciplina). Use o modelo
                    <strong> Conclusão</strong> para cursos que devem emitir pauta de conclusão do curso (todas as disciplinas em colunas).
                  </p>
                </div>
                
                {/* Curso ativo */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ativo"
                    checked={formData.ativo}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, ativo: checked as boolean })
                    }
                  />
                  <Label htmlFor="ativo" className="text-sm font-normal cursor-pointer">
                    Curso ativo
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Salvando...' : editingCurso ? 'Salvar' : 'Cadastrar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este curso? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de Disciplinas do Curso */}
        <Dialog open={disciplinasDialogOpen} onOpenChange={setDisciplinasDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Disciplinas do Curso: {selectedCursoNome}
              </DialogTitle>
              <DialogDescription>
                Gerencie as disciplinas vinculadas a este curso. Disciplinas institucionais podem ser vinculadas a vários cursos.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-muted-foreground">
                  {loadingDisciplinas 
                    ? 'Carregando disciplinas...' 
                    : `${disciplinasDoCurso.length} disciplina(s) vinculada(s)`
                  }
                </div>
                <Button onClick={openVinculoDisciplinaDialog} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Disciplina
                </Button>
              </div>

              {loadingDisciplinas ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : disciplinasDoCurso.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma disciplina vinculada. Clique em "Adicionar Disciplina" para vincular.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome da Disciplina</TableHead>
                        {isSuperior && <TableHead>Semestre</TableHead>}
                        {isSecundario && <TableHead>Classe</TableHead>}
                        {isSecundario && <TableHead>Trimestre</TableHead>}
                        <TableHead>Carga Horária</TableHead>
                        <TableHead>Obrigatória</TableHead>
                        {isSuperior && <TableHead className="min-w-[200px]">Pré-requisito (UC)</TableHead>}
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disciplinasDoCurso.map((vinculo: any) => (
                        <TableRow key={vinculo.id}>
                          <TableCell className="font-medium">
                            {vinculo.disciplina?.codigo || '—'}
                          </TableCell>
                          <TableCell>{vinculo.disciplina?.nome || 'N/A'}</TableCell>
                          {isSuperior && (
                            <TableCell>
                              {vinculo.semestre ? `${vinculo.semestre}º Semestre` : '—'}
                            </TableCell>
                          )}
                          {isSecundario && (
                            <TableCell className="text-muted-foreground text-sm">
                              {vinculo.classe?.nome ?? 'Todas as classes'}
                            </TableCell>
                          )}
                          {isSecundario && (
                            <TableCell>
                              {vinculo.trimestre ? `${vinculo.trimestre}º Trimestre` : '—'}
                            </TableCell>
                          )}
                          <TableCell>
                            {vinculo.cargaHoraria || vinculo.disciplina?.cargaHoraria || 0}h
                          </TableCell>
                          <TableCell>
                            <Badge variant={vinculo.obrigatoria ? 'default' : 'outline'}>
                              {vinculo.obrigatoria ? 'Sim' : 'Não'}
                            </Badge>
                          </TableCell>
                          {isSuperior && (
                            <TableCell>
                              <Select
                                value={vinculo.preRequisitoDisciplinaId || '__none__'}
                                onValueChange={(v) => {
                                  const alvo = vinculo.disciplina?.id;
                                  if (!alvo) return;
                                  handleAtualizarPreRequisito(
                                    alvo,
                                    v === '__none__' ? null : v,
                                    vinculo.classeId ?? null
                                  );
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Nenhum" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Nenhum</SelectItem>
                                  {disciplinasDoCurso
                                    .filter((x: any) => x.disciplina?.id !== vinculo.disciplina?.id)
                                    .map((x: any) => (
                                      <SelectItem key={x.disciplina.id} value={x.disciplina.id}>
                                        {x.disciplina.codigo ? `${x.disciplina.codigo} — ` : ''}
                                        {x.disciplina.nome}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      confirmDesvincularDisciplina(
                                        vinculo.disciplina?.id,
                                        vinculo.classeId ?? null
                                      )
                                    }
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Desvincular disciplina do curso</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDisciplinasDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para Vincular Disciplina */}
        <Dialog open={vinculoDisciplinaDialogOpen} onOpenChange={setVinculoDisciplinaDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Vincular Disciplina ao Curso</DialogTitle>
              <DialogDescription>
                Selecione uma disciplina para vincular a este curso.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="disciplina">Disciplina *</Label>
                <Select
                  value={vinculoFormData.disciplinaId}
                  onValueChange={(value) => {
                    setVinculoFormData({ ...vinculoFormData, disciplinaId: value });
                    // Buscar carga horária da disciplina selecionada
                    const disciplina = disciplinasNaoVinculadas.find((d: any) => d.id === value);
                    if (disciplina?.cargaHoraria) {
                      setVinculoFormData((prev) => ({ ...prev, cargaHoraria: disciplina.cargaHoraria }));
                    }
                  }}
                  disabled={loadingDisciplinasDisponiveis}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    {disciplinasNaoVinculadas.map((disciplina: any) => (
                      <SelectItem key={disciplina.id} value={disciplina.id}>
                        {disciplina.codigo ? `${disciplina.codigo} - ` : ''}{disciplina.nome} ({disciplina.cargaHoraria}h)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {disciplinasNaoVinculadas.length === 0 && !loadingDisciplinasDisponiveis && (
                  <p className="text-sm text-muted-foreground">
                    Todas as disciplinas já estão vinculadas a este curso ou não há disciplinas disponíveis.
                  </p>
                )}
              </div>

              {isSecundario && (
                <div className="space-y-2">
                  <Label>Escopo da classe (opcional)</Label>
                  <p className="text-xs text-muted-foreground">
                    «Todas as classes» aplica a disciplina a toda a área. Escolha uma classe para um vínculo só
                    naquela série.
                  </p>
                  <Select
                    value={vinculoFormData.classeId || '__todas__'}
                    onValueChange={(v) =>
                      setVinculoFormData({
                        ...vinculoFormData,
                        classeId: v === '__todas__' ? '' : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__todas__">Todas as classes (área inteira)</SelectItem>
                      {(classesInstituicao as { id: string; nome: string; codigo?: string }[]).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.codigo ? `${c.codigo} — ` : ''}
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isSuperior && (
                <div className="space-y-2">
                  <Label htmlFor="semestre">Semestre</Label>
                  <PeriodoAcademicoSelect
                    value={vinculoFormData.semestre?.toString() || ''}
                    onValueChange={(value) =>
                      setVinculoFormData({ ...vinculoFormData, semestre: Number(value) })
                    }
                    anoLetivo={anoLetivoAtivo?.ano}
                    anoLetivoId={anoLetivoAtivo?.id}
                    label="Semestre"
                    useNumericValue={true}
                  />
                </div>
              )}

              {isSuperior && (
                <div className="space-y-2">
                  <Label>Pré-requisito (opcional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Disciplina aprovada no mesmo curso antes de cursar a que está a vincular.
                  </p>
                  <Select
                    value={vinculoFormData.preRequisitoDisciplinaId || '__none__'}
                    onValueChange={(v) =>
                      setVinculoFormData({
                        ...vinculoFormData,
                        preRequisitoDisciplinaId: v === '__none__' ? '' : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {disciplinasDisponiveis
                        .filter((d: any) => d.id !== vinculoFormData.disciplinaId)
                        .map((d: any) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.codigo ? `${d.codigo} — ` : ''}
                            {d.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isSecundario && (
                <div className="space-y-2">
                  <PeriodoAcademicoSelect
                    value={vinculoFormData.trimestre?.toString() || ""}
                    onValueChange={(value) => setVinculoFormData({ ...vinculoFormData, trimestre: Number(value) })}
                    anoLetivo={anoLetivoAtivo?.ano}
                    anoLetivoId={anoLetivoAtivo?.id}
                    label="Trimestre"
                    useNumericValue={true}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="cargaHoraria">Carga Horária (horas)</Label>
                <Input
                  id="cargaHoraria"
                  type="number"
                  min="1"
                  value={vinculoFormData.cargaHoraria || ''}
                  onChange={(e) => setVinculoFormData({ 
                    ...vinculoFormData, 
                    cargaHoraria: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  placeholder="Usa carga horária da disciplina se não informado"
                />
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para usar a carga horária padrão da disciplina.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="obrigatoria"
                  checked={vinculoFormData.obrigatoria}
                  onCheckedChange={(checked) => 
                    setVinculoFormData({ ...vinculoFormData, obrigatoria: checked as boolean })
                  }
                />
                <Label htmlFor="obrigatoria" className="text-sm font-normal cursor-pointer">
                  Disciplina obrigatória no curso
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setVinculoDisciplinaDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleVincularDisciplina} 
                disabled={!vinculoFormData.disciplinaId || loadingDisciplinasDisponiveis}
              >
                Vincular
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação para Desvincular Disciplina */}
        <AlertDialog open={deleteVinculoDialogOpen} onOpenChange={setDeleteVinculoDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Desvinculação</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja desvincular esta disciplina do curso? Esta ação não pode ser desfeita.
                {deletingVinculo?.classeId != null && (
                  <span className="block mt-2 text-sm">
                    Esta linha refere-se a um vínculo específico de uma classe.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingVinculo(null)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDesvincularDisciplina}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Desvincular
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
