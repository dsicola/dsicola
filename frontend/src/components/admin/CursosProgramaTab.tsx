import React, { useState, useEffect } from 'react';
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
import { Plus, Pencil, Trash2, Search, ArrowUpDown, GraduationCap, Lock, BookOpen } from 'lucide-react';
import { ExportButtons } from "@/components/common/ExportButtons";
import { toast } from 'sonner';
import { z } from 'zod';
import { useTenantFilter, useCurrentInstituicaoId } from '@/hooks/useTenantFilter';
import { cursosApi, disciplinasApi } from '@/services/api';
import { PeriodoAcademicoSelect } from '@/components/academico/PeriodoAcademicoSelect';
import { useAnoLetivoAtivo } from '@/hooks/useAnoLetivoAtivo';
import { useInstituicao } from '@/contexts/InstituicaoContext';

interface CursoPrograma {
  id: string;
  nome: string;
  codigo: string;
  descricao: string | null;
  cargaHoraria: number; // Backend retorna camelCase
  valorMensalidade: number; // Backend retorna camelCase
  tipo: string | null;
  grau: string | null;
  duracao: string | null;
  ativo: boolean;
  createdAt: string; // Backend retorna camelCase
}

const cursoSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100),
  codigo: z.string().min(2, 'Código deve ter pelo menos 2 caracteres').max(20),
  descricao: z.string().max(500).optional(),
  carga_horaria: z.number().min(1, 'Carga horária deve ser maior que 0').max(10000),
  valor_mensalidade: z.number().min(0, 'Valor deve ser maior ou igual a 0'),
  tipo: z.string().optional(),
  grau: z.string().optional(),
  duracao: z.string().min(1, 'Duração é obrigatória').optional(),
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
  const { isSuperior, isSecundario, tipoAcademico, isUniversidade, loading: instituicaoLoading, config, instituicao } = useInstituicao();
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    descricao: '',
    carga_horaria: 3000,
    valor_mensalidade: 50000,
    tipo: 'geral',
    grau: 'Licenciatura',
    duracao: '4 anos',
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
  const [deletingVinculoDisciplinaId, setDeletingVinculoDisciplinaId] = useState<string | null>(null);
  const [vinculoFormData, setVinculoFormData] = useState({
    disciplinaId: '',
    semestre: undefined as number | undefined, // Não usar valor padrão hardcoded
    trimestre: undefined as number | undefined, // Não usar valor padrão hardcoded
    cargaHoraria: undefined as number | undefined,
    obrigatoria: true,
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
      toast.error('Erro ao carregar cursos');
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
        tipo: curso.tipo || 'geral',
        grau: isSuperior ? (curso.grau || 'Licenciatura') : '',
        duracao: curso.duracao || '4 anos',
        ativo: curso.ativo ?? true,
      });
    } else {
      setEditingCurso(null);
      setFormData({ 
        nome: '', 
        codigo: '', 
        descricao: '', 
        carga_horaria: 3000, 
        valor_mensalidade: 50000, 
        tipo: 'geral',
        grau: isSuperior ? 'Licenciatura' : '',
        duracao: '4 anos',
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
      
      // Duração é obrigatória para ambos os tipos
      if (!formData.duracao || formData.duracao.trim() === '') {
        manualErrors.duracao = 'Duração do curso é obrigatória';
      }
      
      if (isSuperior) {
        // Ensino Superior: grau é obrigatório
        if (!formData.grau || formData.grau.trim() === '') {
          manualErrors.grau = 'Grau acadêmico é obrigatório para Ensino Superior';
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
      
      // Campos específicos por tipo de instituição
      if (isSuperior) {
        // Ensino Superior: grau e duracao são obrigatórios
        if (validatedData.grau) {
          dataToSave.grau = validatedData.grau;
        }
        if (validatedData.duracao) {
          dataToSave.duracao = validatedData.duracao;
        }
        if (validatedData.tipo) {
          dataToSave.tipo = validatedData.tipo;
        }
      } else if (isSecundario) {
        // Ensino Secundário: Curso SEM mensalidade (mensalidade está na Classe)
        // Duração pode ser enviada (é obrigatória)
        if (validatedData.duracao) {
          dataToSave.duracao = validatedData.duracao;
        }
        // Não enviar grau ou tipo
        // Mensalidade sempre será 0 (definido pelo backend)
        dataToSave.valorMensalidade = 0;
      }

      if (editingCurso) {
        await cursosApi.update(editingCurso.id, dataToSave);
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
        toast.error('Erro ao salvar curso');
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

  // Filtrar disciplinas já vinculadas
  const disciplinasNaoVinculadas = disciplinasDisponiveis.filter((disc: any) => 
    !disciplinasDoCurso.some((vinculo: any) => vinculo.disciplina?.id === disc.id)
  );

  // Abrir dialog para vincular disciplina
  const openVinculoDisciplinaDialog = () => {
    setVinculoFormData({
      disciplinaId: '',
      semestre: undefined, // Não usar valor padrão hardcoded
      trimestre: undefined, // Não usar valor padrão hardcoded
      cargaHoraria: undefined,
      obrigatoria: true,
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
      await cursosApi.vincularDisciplina(selectedCursoId, {
        disciplinaId: vinculoFormData.disciplinaId,
        semestre: isSuperior ? vinculoFormData.semestre : undefined,
        trimestre: isSecundario ? vinculoFormData.trimestre : undefined,
        cargaHoraria: vinculoFormData.cargaHoraria,
        obrigatoria: vinculoFormData.obrigatoria,
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
    if (!selectedCursoId || !deletingVinculoDisciplinaId) return;

    try {
      await cursosApi.desvincularDisciplina(selectedCursoId, deletingVinculoDisciplinaId);
      toast.success('Disciplina desvinculada com sucesso!');
      setDeleteVinculoDialogOpen(false);
      setDeletingVinculoDisciplinaId(null);
      refetchDisciplinas();
      queryClient.invalidateQueries({ queryKey: ['curso-disciplinas', selectedCursoId] });
    } catch (error: any) {
      console.error('Erro ao desvincular disciplina:', error);
      toast.error(error?.response?.data?.message || 'Erro ao desvincular disciplina');
      setDeleteVinculoDialogOpen(false);
      setDeletingVinculoDisciplinaId(null);
    }
  };

  // Confirmar desvincular disciplina
  const confirmDesvincularDisciplina = (disciplinaId: string) => {
    setDeletingVinculoDisciplinaId(disciplinaId);
    setDeleteVinculoDialogOpen(true);
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
              ? 'Cadastre aqui as ÁREAS/OPÇÕES do Ensino Secundário (ex: Ciências Humanas, Enfermagem, Informática). A mensalidade é definida na Classe (10ª, 11ª, 12ª Classe).'
              : 'Cadastre aqui os cursos/programas de formação oferecidos pela instituição (ex: Enfermagem, Ciências Humanas, Administração).'
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
                    <TableCell>{curso.nome}</TableCell>
                    {isSuperior && (
                      <TableCell>
                        <Badge variant="outline">
                          {curso.grau || 'Licenciatura'}
                        </Badge>
                      </TableCell>
                    )}
                    {isSuperior && (
                      <TableCell>{curso.duracao || '4 anos'}</TableCell>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDisciplinasDialog(curso)}
                        title="Gerenciar Disciplinas"
                      >
                        <BookOpen className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDialog(curso)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(curso.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
                {editingCurso ? 'Editar Curso' : 'Novo Curso'}
              </DialogTitle>
              <DialogDescription>
                {isSecundario 
                  ? 'Cadastre a ÁREA/OPÇÃO do Ensino Secundário (ex: Ciências Humanas, Enfermagem, Informática). A mensalidade é definida na Classe.'
                  : 'Cadastre um curso/programa de formação (ex: Enfermagem, Administração, Ciências Humanas).'
                }
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
                    <Label htmlFor="nome">Nome do Curso *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) =>
                        setFormData({ ...formData, nome: e.target.value })
                      }
                      placeholder="Ex: Enfermagem, Administração"
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
                
                {/* Segunda linha: Tipo de Instituição (read-only) - UX SIGA/SIGAA */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Tipo de Instituição
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  </Label>
                  {(() => {
                    // Obter tipoAcademico do contexto com prioridade clara
                    // Prioridade: tipoAcademico do hook > isSuperior/isSecundario > instituicao > config
                    let tipoAtual: 'SUPERIOR' | 'SECUNDARIO' | null = null;
                    
                    // Primeira prioridade: tipoAcademico direto do hook
                    if (tipoAcademico === 'SUPERIOR' || tipoAcademico === 'SECUNDARIO') {
                      tipoAtual = tipoAcademico;
                    }
                    // Segunda prioridade: flags booleanas do hook
                    else if (isSuperior) {
                      tipoAtual = 'SUPERIOR';
                    }
                    else if (isSecundario) {
                      tipoAtual = 'SECUNDARIO';
                    }
                    // Terceira prioridade: dados da instituição
                    else if (instituicao?.tipo_academico === 'SUPERIOR' || instituicao?.tipo_academico === 'SECUNDARIO') {
                      tipoAtual = instituicao.tipo_academico;
                    }
                    // Quarta prioridade: dados da configuração
                    else if (config?.tipo_academico === 'SUPERIOR' || config?.tipo_academico === 'SECUNDARIO') {
                      tipoAtual = config.tipo_academico;
                    }
                    
                    // Sempre exibir o tipo quando disponível no contexto
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
                            <span className="text-xs text-muted-foreground font-medium">
                              (definido pela instituição)
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            O tipo de instituição é herdado automaticamente da configuração institucional e não pode ser alterado no nível do curso.
                          </p>
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
                          <SelectItem value="Licenciatura">Licenciatura</SelectItem>
                          <SelectItem value="Bacharelato">Bacharelato</SelectItem>
                          <SelectItem value="Mestrado">Mestrado</SelectItem>
                          <SelectItem value="Doutorado">Doutorado</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.grau && (
                        <p className="text-sm text-destructive">{errors.grau}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duracao">Duração do Curso *</Label>
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
                          <SelectItem value="1 ano">1 ano</SelectItem>
                          <SelectItem value="2 anos">2 anos</SelectItem>
                          <SelectItem value="3 anos">3 anos</SelectItem>
                          <SelectItem value="4 anos">4 anos</SelectItem>
                          <SelectItem value="5 anos">5 anos</SelectItem>
                          <SelectItem value="6 anos">6 anos</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.duracao && (
                        <p className="text-sm text-destructive">{errors.duracao}</p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Duração para Ensino Secundário (sem grau) */}
                {isSecundario && (
                  <div className="space-y-2">
                    <Label htmlFor="duracao">Duração do Curso *</Label>
                    <Input
                      id="duracao"
                      value={formData.duracao}
                      onChange={(e) => {
                        setFormData({ ...formData, duracao: e.target.value });
                        if (errors.duracao) {
                          setErrors({ ...errors, duracao: '' });
                        }
                      }}
                      placeholder="Ex: 3 anos, 4 anos"
                      className={errors.duracao ? 'border-destructive' : ''}
                      required
                    />
                    {errors.duracao && (
                      <p className="text-sm text-destructive">{errors.duracao}</p>
                    )}
                  </div>
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
                  )}
                </div>
                
                {isSecundario && (
                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="text-sm text-muted-foreground">
                      <strong>Nota:</strong> No Ensino Secundário, a mensalidade é definida na <strong>Classe</strong> (ex: 10ª, 11ª, 12ª Classe), não no Curso. 
                      O Curso representa apenas a ÁREA/OPÇÃO (ex: Ciências Humanas, Enfermagem).
                    </p>
                  </div>
                )}
                
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
                        {isSecundario && <TableHead>Trimestre</TableHead>}
                        <TableHead>Carga Horária</TableHead>
                        <TableHead>Obrigatória</TableHead>
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
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => confirmDesvincularDisciplina(vinculo.disciplina?.id)}
                              title="Desvincular"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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

              {isSuperior && (
                <div className="space-y-2">
                  <Label htmlFor="semestre">Semestre</Label>
                  <Select
                    value={vinculoFormData.semestre?.toString()}
                    onValueChange={(value) => setVinculoFormData({ ...vinculoFormData, semestre: parseInt(value) })}
                  >
                    <PeriodoAcademicoSelect
                      value={vinculoFormData.semestre?.toString() || ""}
                      onValueChange={(value) => setVinculoFormData({ ...vinculoFormData, semestre: Number(value) })}
                      anoLetivo={anoLetivoAtivo?.ano}
                      anoLetivoId={anoLetivoAtivo?.id}
                      label="Semestre"
                      useNumericValue={true}
                    />
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
                {disciplinasDoCurso.some((v: any) => v.disciplina?.id === deletingVinculoDisciplinaId && 
                  v.planoEnsino && v.planoEnsino.length > 0) && (
                  <span className="block mt-2 text-amber-600 font-semibold">
                    ⚠️ Esta disciplina possui planos de ensino vinculados e não poderá ser desvinculada.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingVinculoDisciplinaId(null)}>
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
