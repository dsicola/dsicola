import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { disciplinasApi, cursosApi } from '@/services/api';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveTable } from '@/components/common/ResponsiveTable';
import { ResponsiveForm } from '@/components/common/ResponsiveForm';
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
import { Plus, Pencil, Trash2, Search, ArrowUpDown, Filter, Loader2, BookOpen, GraduationCap, Clock, FileText } from 'lucide-react';
import { ExportButtons } from "@/components/common/ExportButtons";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';
import { z } from 'zod';
import { getApiErrorMessage } from '@/utils/apiErrors';
import { useTenantFilter, useCurrentInstituicaoId } from '@/hooks/useTenantFilter';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

interface Curso {
  id: string;
  nome: string;
  codigo: string;
  tipo?: string;
}

interface Disciplina {
  id: string;
  nome: string;
  // Removido: curso_id - Disciplina é estrutural e independente
  carga_horaria: number;
  created_at: string;
  // Removido: curso - vínculo é feito via CursoDisciplina
  tipo_disciplina?: string;
  trimestres_oferecidos?: number[];
  obrigatoria?: boolean;
}

// Schema base - será ajustado dinamicamente conforme tipo acadêmico
// NOVO MODELO: Disciplina é ESTRUTURAL - não possui semestre nem classe
// Semestre pertence ao PlanoEnsino (ENSINO_SUPERIOR)
// Classe pertence ao PlanoEnsino (ENSINO_SECUNDARIO)
const createDisciplinaSchema = (isSecundario: boolean) => {
  const baseSchema = {
    nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100),
    carga_horaria: z.number().min(1, 'Carga horária deve ser maior que 0').max(1000),
    tipo_disciplina: z.enum(['teórica', 'prática', 'mista']).optional(),
    trimestres_oferecidos: z.array(z.number()).optional(),
    obrigatoria: z.boolean().optional(),
    // Removido: curso_id - Disciplina é estrutural e independente
    // O vínculo com curso deve ser feito via Matriz Curricular (CursoDisciplina)
  };

  // Disciplina é ESTRUTURAL: semestre e classe pertencem ao PlanoEnsino
  // Não incluir semestre nem classe_id no schema de Disciplina
  return z.object(baseSchema);
};

export const DisciplinasTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [editingDisciplina, setEditingDisciplina] = useState<Disciplina | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useSafeDialog(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCurso, setFilterCurso] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [formData, setFormData] = useState({
    nome: '',
    curso_id: '',
    carga_horaria: 60,
    tipo_disciplina: 'teórica' as 'teórica' | 'prática' | 'mista',
    trimestres_oferecidos: [] as number[], // Não usar valores padrão hardcoded
    obrigatoria: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { instituicaoId, shouldFilter } = useTenantFilter();
  const currentInstituicaoId = useCurrentInstituicaoId();
  const { tipoAcademico, isSecundario } = useInstituicao();
  
  // Use tipoAcademico as primary source - if null, default to SUPERIOR (most common case)
  const isSecundarioType = isSecundario === true;
  
  const cursoLabel = isSecundarioType ? 'Classe' : 'Curso';

  // Classes não são mais necessárias no cadastro de Disciplina
  // Classe pertence ao PlanoEnsino, não à Disciplina

  // Fetch cursos (para Ensino Secundário: cursos de área/opção; para Ensino Superior: cursos)
  const { data: cursos = [], isLoading: isLoadingCursos } = useQuery({
    queryKey: ['cursos-disciplinas', instituicaoId, tipoAcademico, isSecundario],
    queryFn: async () => {
      // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
      // O backend usa req.user.instituicaoId do JWT token automaticamente
      const response = await cursosApi.getAll();
      let data = Array.isArray(response) ? response : (response?.data || []);
      // Para Ensino Superior, filtrar cursos do tipo 'classe' (esses devem ser classes)
      if (!isSecundarioType) {
        data = data.filter((c: Curso) => c.tipo !== 'classe');
      }
      // Para Ensino Secundário, retornar todos os cursos (representam áreas/opções)
      return data;
    },
    enabled: true, // Sempre habilitar a query
  });

  // Fetch disciplinas
  // Backend already filters by tipoAcademico (SECUNDARIO uses classeId, SUPERIOR uses cursoId)
  const { data: disciplinas = [], isLoading, error: errorDisciplinas } = useQuery({
    queryKey: ['disciplinas', instituicaoId, tipoAcademico, sortOrder],
    queryFn: async () => {
      try {
        // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
        // O backend usa req.user.instituicaoId do JWT token automaticamente
        console.log('[DisciplinasTab] Buscando disciplinas...', {
          instituicaoId,
          tipoAcademico,
          isSecundarioType,
        });
        
        let response;
        try {
          response = await disciplinasApi.getAll();
          console.log('[DisciplinasTab] Resposta do backend:', {
            responseType: Array.isArray(response) ? 'array' : typeof response,
            responseLength: Array.isArray(response) ? response.length : (response?.data?.length || 0),
            response,
          });
        } catch (apiError: any) {
          console.error('[DisciplinasTab] ❌ Erro na API:', {
            message: apiError.message,
            status: apiError.response?.status,
            statusText: apiError.response?.statusText,
            data: apiError.response?.data,
            error: apiError.response?.data?.error,
            fullError: apiError,
          });
          throw apiError;
        }
        
        let data = Array.isArray(response) ? response : (response?.data || []);
        
        console.log('[DisciplinasTab] Dados antes da normalização:', {
          count: data.length,
          firstItem: data[0] || null,
        });
        
        // NOVO MODELO: Disciplina é estrutural e independente
        // Não normalizar cursoId/curso_id - disciplina não possui vínculo direto com curso
        // O vínculo é feito via CursoDisciplina (Matriz Curricular)
        data = data.map((d: any) => {
          const normalized = {
            ...d,
            // Removido: curso_id e curso - não pertencem mais à Disciplina
          };
          return normalized;
        });
        
        // Debug: verificar se há disciplinas e seus campos
        if (data.length > 0) {
          console.log('[DisciplinasTab] ✅ Disciplinas carregadas:', data.length);
          console.log('[DisciplinasTab] Primeira disciplina:', {
            id: data[0].id,
            nome: data[0].nome,
            // Removido: curso_id e curso - não pertencem mais à Disciplina
          });
        } else {
          console.warn('[DisciplinasTab] ⚠️ Nenhuma disciplina retornada do backend', {
            response,
            tipoAcademico,
            isSecundarioType,
          });
        }
        
        // Backend already filters correctly by tipoAcademico, so we trust its response
        // Just sort the data
        data.sort((a: Disciplina, b: Disciplina) => {
          const cmp = a.nome.localeCompare(b.nome);
          return sortOrder === 'asc' ? cmp : -cmp;
        });
        
        return data;
      } catch (error: any) {
        console.error('[DisciplinasTab] ❌ Erro ao buscar disciplinas:', error);
        throw error;
      }
    },
    enabled: true, // Always enable the query
    retry: 1,
  });
  
  // Log de erro se houver
  if (errorDisciplinas) {
    console.error('[DisciplinasTab] Erro na query de disciplinas:', errorDisciplinas);
  }

  // Create mutation - protegida contra unmount
  const createMutation = useSafeMutation({
    mutationFn: async (data: any) => {
      await disciplinasApi.create(data);
    },
    onSuccess: async () => {
      // Invalidar todas as queries relacionadas a disciplinas
      await queryClient.invalidateQueries({ queryKey: ['disciplinas'], exact: false });
      // Forçar refetch explícito para garantir que os dados sejam recarregados
      await queryClient.refetchQueries({ queryKey: ['disciplinas'], exact: false });
      // Também resetar o formulário
      setFormData({
        nome: '',
        curso_id: '',
        carga_horaria: 60,
        tipo_disciplina: 'teórica',
        trimestres_oferecidos: [],
        obrigatoria: true,
      });
      setEditingDisciplina(null);
      toast.success('Disciplina cadastrada com sucesso!');
      // Fechamento explícito após sucesso
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Erro ao cadastrar disciplina. Tente novamente.'));
    }
  });

  // Update mutation - protegida contra unmount
  const updateMutation = useSafeMutation({
    mutationFn: async ({ id, ...data }: any) => {
      await disciplinasApi.update(id, data);
    },
    onSuccess: async () => {
      // Invalidar todas as queries relacionadas a disciplinas
      await queryClient.invalidateQueries({ queryKey: ['disciplinas'], exact: false });
      // Forçar refetch explícito para garantir que os dados sejam recarregados
      await queryClient.refetchQueries({ queryKey: ['disciplinas'], exact: false });
      // Também resetar o formulário
      setFormData({
        nome: '',
        curso_id: '',
        carga_horaria: 60,
        tipo_disciplina: 'teórica',
        trimestres_oferecidos: [],
        obrigatoria: true,
      });
      setEditingDisciplina(null);
      toast.success('Disciplina atualizada com sucesso!');
      // Fechamento explícito após sucesso
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Erro ao atualizar disciplina. Tente novamente.'));
    }
  });

  // Delete mutation - protegida contra unmount
  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await disciplinasApi.delete(id);
    },
    onSuccess: async () => {
      // Invalidar todas as queries relacionadas a disciplinas
      await queryClient.invalidateQueries({ queryKey: ['disciplinas'], exact: false });
      // Forçar refetch explícito para garantir que os dados sejam recarregados
      await queryClient.refetchQueries({ queryKey: ['disciplinas'], exact: false });
      // Fechamento explícito após sucesso
      setDeleteDialogOpen(false);
      setDeletingId(null);
      toast.success('Disciplina excluída com sucesso!');
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Erro ao excluir disciplina. Tente novamente.'));
      // Em caso de erro, também fechar explicitamente
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  });

  const filteredDisciplinas = disciplinas.filter(
    (d: Disciplina) => {
      // NOVO MODELO: Disciplina é estrutural e independente - não filtrar por curso
      // O vínculo com curso é feito via Matriz Curricular (CursoDisciplina)
      // Filtro por curso removido - disciplinas são institucionais
      const matchesSearch = d.nome.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    }
  );
  
  // Debug: sempre logar informações importantes
  console.log('[DisciplinasTab] Estado atual:', {
    totalDisciplinas: disciplinas.length,
    filteredDisciplinas: filteredDisciplinas.length,
    filterCurso,
    searchTerm,
    isSecundarioType,
    tipoAcademico,
    isLoading,
    disciplinasSample: disciplinas.length > 0 ? disciplinas.slice(0, 2).map(d => ({
      id: d.id,
      nome: d.nome,
      curso_id: d.curso_id,
      curso: d.curso,
    })) : [],
  });
  
  // Debug: verificar filtros quando há disciplinas mas nenhuma passa
  if (disciplinas.length > 0 && filteredDisciplinas.length === 0) {
    console.warn('[DisciplinasTab] ⚠️ Disciplinas existem mas nenhuma passou no filtro:', {
      totalDisciplinas: disciplinas.length,
      filterCurso,
      searchTerm,
      isSecundarioType,
      primeiraDisciplina: disciplinas[0] ? {
        nome: disciplinas[0].nome,
        // Removido: curso_id - Disciplina é estrutural e independente
        curso: disciplinas[0].curso,
      } : null,
      todasDisciplinas: disciplinas.map(d => ({
        nome: d.nome,
        curso_id: d.curso_id,
      })),
    });
  }

  const openDialog = (disciplina?: Disciplina) => {
    if (disciplina) {
      setEditingDisciplina(disciplina);
      // Normalizar campos caso venham do backend em camelCase
      const disciplinaNormalizada = disciplina as any;
      setFormData({
        nome: disciplina.nome,
        // Removido: curso_id - Disciplina é estrutural e independente
        carga_horaria: disciplina.carga_horaria,
        tipo_disciplina: (disciplina.tipo_disciplina as 'teórica' | 'prática' | 'mista') || 'teórica',
        trimestres_oferecidos: disciplina.trimestres_oferecidos || [],
        obrigatoria: disciplina.obrigatoria ?? true,
      });
    } else {
      setEditingDisciplina(null);
      setFormData({ 
        nome: '', 
        // Removido: curso_id - Disciplina é estrutural e independente
        carga_horaria: 60,
        tipo_disciplina: 'teórica',
        trimestres_oferecidos: [],
        obrigatoria: true,
      });
    }
    setErrors({});
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[DisciplinasTab] handleSubmit chamado', { formData, editingDisciplina, isSecundarioType });
    
    setErrors({});

    // DISCIPLINA é ESTRUTURAL - não possui semestre nem classe
    // Semestre pertence ao PlanoEnsino (ENSINO_SUPERIOR)
    // Classe pertence ao PlanoEnsino (ENSINO_SECUNDARIO)

    // Validação básica do nome
    if (!formData.nome || formData.nome.trim().length < 3) {
      setErrors({ nome: 'Nome deve ter pelo menos 3 caracteres' });
      toast.error('Nome deve ter pelo menos 3 caracteres');
      return;
    }

    try {
      // Criar schema dinâmico baseado no tipo acadêmico
      const schema = createDisciplinaSchema(isSecundarioType);
      
      // Preparar dados para validação
      // DISCIPLINA é ESTRUTURAL - não incluir semestre nem classe_id
      const dataToValidate: any = {
        nome: formData.nome,
        carga_horaria: Number(formData.carga_horaria),
      };
      
      // Removido: validação de curso_id - Disciplina é estrutural e independente
      
      // Campos específicos do Ensino Secundário (se aplicável)
      if (isSecundarioType) {
        if (formData.tipo_disciplina) {
          dataToValidate.tipo_disciplina = formData.tipo_disciplina;
        }
        if (formData.trimestres_oferecidos && formData.trimestres_oferecidos.length > 0) {
          dataToValidate.trimestres_oferecidos = formData.trimestres_oferecidos;
        }
        if (formData.obrigatoria !== undefined) {
          dataToValidate.obrigatoria = formData.obrigatoria;
        }
      }
      
      const validatedData = schema.parse(dataToValidate);

      console.log('[DisciplinasTab] Dados validados:', validatedData);

      // Preparar dados conforme tipo acadêmico
      const payload: any = {
        nome: validatedData.nome.trim(),
        cargaHoraria: validatedData.carga_horaria,
      };

      // DISCIPLINA é ESTRUTURAL - não enviar semestre, classeId nem cursoId
      // Semestre pertence ao PlanoEnsino (ENSINO_SUPERIOR)
      // Classe pertence ao PlanoEnsino (ENSINO_SECUNDARIO)
      // CursoId não pertence à Disciplina - vínculo deve ser feito via Matriz Curricular (CursoDisciplina)
      // Removido: envio de cursoId (legacy)
      
      // Campos específicos do Ensino Secundário (se aplicável)
      if (isSecundarioType) {
        if (formData.tipo_disciplina) {
          payload.tipoDisciplina = formData.tipo_disciplina;
        }
        if (formData.trimestres_oferecidos && formData.trimestres_oferecidos.length > 0) {
          payload.trimestresOferecidos = formData.trimestres_oferecidos;
        }
        if (formData.obrigatoria !== undefined) {
          payload.obrigatoria = formData.obrigatoria;
        }
      }

      console.log('[DisciplinasTab] Payload preparado:', payload);

      if (editingDisciplina) {
        console.log('[DisciplinasTab] Atualizando disciplina:', editingDisciplina.id);
        updateMutation.mutate({
          id: editingDisciplina.id,
          ...payload,
        });
      } else {
        console.log('[DisciplinasTab] Criando nova disciplina');
        // Multi-tenant: NUNCA enviar instituicaoId do frontend - o backend usa o do token JWT
        createMutation.mutate({
          ...payload,
        });
      }
    } catch (error) {
      console.error('[DisciplinasTab] Erro no handleSubmit:', error);
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        toast.error('Erro de validação. Verifique os campos preenchidos.');
      } else {
        toast.error(getApiErrorMessage(error, 'Erro ao processar formulário. Tente novamente.'));
      }
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  // DISCIPLINA é ESTRUTURAL - semestre e classe pertencem ao PlanoEnsino
  // REMOVIDO: d.curso?.nome (legacy) - Disciplina não possui cursoId direto
  // O vínculo com curso é feito via CursoDisciplina (Matriz Curricular)
  const exportData = filteredDisciplinas.map((d: Disciplina) => [
    d.nome,
    // Curso removido: Disciplina pode estar vinculada a múltiplos cursos via CursoDisciplina
    '-', // Placeholder - curso não é mais parte direta da disciplina
    `${d.carga_horaria}h`
  ]);

  return (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Disciplinas
              </CardTitle>
              <CardDescription>
                Gerencie as disciplinas do sistema
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <ExportButtons
                titulo="Relatório de Disciplinas"
                colunas={['Disciplina', 'Carga Horária']}
                dados={exportData}
              />
              <Button 
                onClick={() => openDialog()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Disciplina
              </Button>
            </div>
          </div>
        </CardHeader>
      <CardContent className="pt-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-muted/30 rounded-lg border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome da disciplina..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 bg-background"
            />
          </div>
          {/* Removido: Filtro por curso - Disciplina é estrutural e independente
              O vínculo com curso é feito via Matriz Curricular (CursoDisciplina)
              Para ver disciplinas de um curso específico, acesse a Matriz Curricular do curso */}
          <Button
            variant="outline"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="h-10"
          >
            <ArrowUpDown className="mr-2 h-4 w-4" />
            {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <Skeleton className="h-6 w-32" />
              </div>
              <div className="p-4 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 flex-1" />
                    <Skeleton className="h-12 w-32" />
                    <Skeleton className="h-12 w-24" />
                    <Skeleton className="h-12 w-28" />
                    <Skeleton className="h-12 w-20" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : filteredDisciplinas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="p-4 rounded-full bg-muted mb-4">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
            {searchTerm || filterCurso !== 'all'
              ? 'Nenhuma disciplina encontrada'
              : 'Nenhuma disciplina cadastrada'}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              {searchTerm || filterCurso !== 'all'
                ? 'Tente ajustar os filtros de busca para encontrar o que procura.'
                : 'Comece cadastrando sua primeira disciplina clicando no botão acima.'}
            </p>
            {!searchTerm && filterCurso === 'all' && (
              <Button 
                onClick={() => openDialog()} 
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Primeira Disciplina
              </Button>
            )}
          </div>
        ) : (
          <ResponsiveTable
            columns={[
              {
                key: 'nome',
                label: 'Nome da Disciplina',
                priority: 'high',
                render: (_, row: Disciplina) => (
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-primary/10">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium">{row.nome}</span>
                    {isSecundarioType && row.obrigatoria === false && (
                      <Badge variant="outline" className="ml-2 text-xs">Opcional</Badge>
                    )}
                  </div>
                ),
              },
              // Removido: coluna "Curso (legacy)" - Disciplina é estrutural e independente
              // O vínculo com curso é feito via Matriz Curricular (CursoDisciplina)
              // Para ver os cursos vinculados, acesse a Matriz Curricular do curso
              ...(isSecundarioType ? [{
                key: 'tipo',
                label: 'Tipo',
                priority: 'low' as const,
                render: (_, row: Disciplina) => (
                  <Badge variant="secondary" className="capitalize">
                    {row.tipo_disciplina || 'teórica'}
                  </Badge>
                ),
              }] : []),
              ...(isSecundarioType ? [{
                key: 'trimestres',
                label: 'Trimestres',
                priority: 'low' as const,
                render: (_, row: Disciplina) => (
                  <div className="flex gap-1 flex-wrap">
                    {row.trimestres_oferecidos?.map(t => (
                      <Badge key={t} variant="outline" className="text-xs">
                        {t}º
                      </Badge>
                    )) || (
                      <>
                        <Badge variant="outline" className="text-xs">1º</Badge>
                        <Badge variant="outline" className="text-xs">2º</Badge>
                        <Badge variant="outline" className="text-xs">3º</Badge>
                      </>
                    )}
                  </div>
                ),
              }] : []),
              {
                key: 'carga_horaria',
                label: 'Carga Horária',
                priority: 'medium',
                render: (_, row: Disciplina) => (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{row.carga_horaria}h</span>
                  </div>
                ),
              },
              {
                key: 'acoes',
                label: 'Ações',
                className: 'text-right',
                priority: 'high',
                render: (_, row: Disciplina) => (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDialog(row)}
                      className="h-8 w-8 md:h-9 md:w-9 hover:bg-primary/10 hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(row.id)}
                      disabled={deleteMutation.isPending}
                      className="h-8 w-8 md:h-9 md:w-9 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ),
              },
            ]}
            data={filteredDisciplinas}
            keyExtractor={(row: Disciplina) => row.id}
            emptyMessage="Nenhuma disciplina encontrada"
          />
        )}

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
            <DialogHeader className="pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-2xl">
                {editingDisciplina ? 'Editar Disciplina' : 'Nova Disciplina'}
              </DialogTitle>
                  <DialogDescription className="mt-1">
                    {editingDisciplina 
                      ? 'Atualize as informações da disciplina' 
                      : 'Preencha os dados para cadastrar uma nova disciplina'}
              </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-6 py-6">
                {/* Seção: Informações Básicas */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      Informações Básicas
                    </h3>
                  </div>
                  <div className="space-y-4">
                <div className="space-y-2">
                      <Label htmlFor="nome" className="text-sm font-medium">
                        Nome da Disciplina <span className="text-destructive">*</span>
                      </Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) =>
                      setFormData({ ...formData, nome: e.target.value })
                    }
                        placeholder="Ex: Cálculo I, Português, Matemática..."
                        className="h-10"
                  />
                  {errors.nome && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <span>•</span> {errors.nome}
                        </p>
                  )}
                    </div>
                  </div>
                </div>

                <Separator />
                {/* Seção: Vinculação Acadêmica */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <GraduationCap className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      Informações sobre Disciplina Estrutural
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {/* DISCIPLINA é ESTRUTURAL - não possui semestre nem classe */}
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                        <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">📚 Disciplina Estrutural</p>
                        <p className="text-blue-800 dark:text-blue-200 mb-2">
                          A disciplina é estrutural e pode ser usada em vários cursos, anos e contextos.
                        </p>
                        <p className="text-blue-800 dark:text-blue-200 text-xs">
                          {isSecundarioType 
                            ? '• Classe e trimestre pertencem ao Plano de Ensino, não à disciplina.'
                            : '• Semestre pertence ao Plano de Ensino, não à disciplina.'
                          }
                        </p>
                        <p className="text-blue-800 dark:text-blue-200 text-xs">
                          • Após criar a disciplina, configure o Plano de Ensino para definir o semestre/classe.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Seção: Carga Horária */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Clock className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      Carga Horária
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="carga_horaria" className="text-sm font-medium">
                        Carga Horária (horas) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="carga_horaria"
                        type="number"
                        min="1"
                        value={formData.carga_horaria}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            carga_horaria: parseInt(e.target.value) || 0,
                          });
                          if (errors.carga_horaria) {
                            setErrors({ ...errors, carga_horaria: '' });
                          }
                        }}
                        placeholder="Ex: 60, 90, 120..."
                        className="h-10"
                        required
                      />
                      {errors.carga_horaria && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <span>•</span> {errors.carga_horaria}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ensino Secundário specific fields */}
                {isSecundarioType && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <FileText className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                          Configurações Adicionais (Ensino Secundário)
                        </h3>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Tipo de Disciplina</Label>
                          <Select
                            value={formData.tipo_disciplina}
                            onValueChange={(value: 'teórica' | 'prática' | 'mista') =>
                              setFormData({ ...formData, tipo_disciplina: value })
                            }
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Selecione uma opção..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="teórica">Teórica</SelectItem>
                              <SelectItem value="prática">Prática</SelectItem>
                              <SelectItem value="mista">Mista</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Trimestres Oferecidos</Label>
                          <div className="flex gap-4 p-4 rounded-lg border bg-muted/30">
                            {[1, 2, 3].map((trimestre) => (
                              <div key={trimestre} className="flex items-center gap-2">
                                <Checkbox
                                  id={`trim-${trimestre}`}
                                  checked={formData.trimestres_oferecidos.includes(trimestre)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setFormData({
                                        ...formData,
                                        trimestres_oferecidos: [...formData.trimestres_oferecidos, trimestre].sort(),
                                      });
                                    } else {
                                      setFormData({
                                        ...formData,
                                        trimestres_oferecidos: formData.trimestres_oferecidos.filter(t => t !== trimestre),
                                      });
                                    }
                                  }}
                                />
                                <Label htmlFor={`trim-${trimestre}`} className="font-normal cursor-pointer">
                                  {trimestre}º Trimestre
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                          <Checkbox
                            id="obrigatoria"
                            checked={formData.obrigatoria}
                            onCheckedChange={(checked) =>
                              setFormData({ ...formData, obrigatoria: checked as boolean })
                            }
                          />
                          <Label htmlFor="obrigatoria" className="font-normal cursor-pointer">
                            Disciplina obrigatória
                          </Label>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <DialogFooter className="border-t pt-4 mt-4 flex-col sm:flex-row gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="h-10 w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="h-10 min-w-[120px] w-full sm:w-auto"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingDisciplina ? 'Salvar Alterações' : 'Cadastrar Disciplina'}
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
                Tem certeza que deseja excluir esta disciplina? Esta ação não pode ser desfeita.
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
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};