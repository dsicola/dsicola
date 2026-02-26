import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { turmasApi, cursosApi, classesApi, turnosApi, usersApi, anoLetivoApi } from '@/services/api';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Pencil, Trash2, Search, ArrowUpDown, Filter, Calendar, Sun, Sunset, Moon, Clock, Loader2 } from 'lucide-react';
import { ExportButtons } from "@/components/common/ExportButtons";
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiErrors';
import { z } from 'zod';
import { useTenantFilter, useCurrentInstituicaoId } from '@/hooks/useTenantFilter';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { RelatorioTurmasTurnoDialog } from './RelatorioTurmasTurnoDialog';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { PeriodoAcademicoSelect } from '@/components/academico/PeriodoAcademicoSelect';
import { AnoLetivoSelect } from '@/components/academico/AnoLetivoSelect';
import { useAnoLetivoAtivo } from '@/hooks/useAnoLetivoAtivo';
import { AnoLetivoAtivoGuard } from '@/components/academico/AnoLetivoAtivoGuard';

interface Curso {
  id: string;
  nome: string;
  codigo: string;
  tipo?: string;
}

interface Professor {
  id: string;
  nome_completo: string;
  email: string;
}

interface Turno {
  id: string;
  nome: string;
  horaInicio: string | null;
  horaFim: string | null;
}

interface Turma {
  id: string;
  nome: string;
  curso_id?: string;
  classe_id?: string;
  cursoId?: string;
  classeId?: string;
  curso_estudo_id?: string | null;
  professor_id?: string;
  professorId?: string;
  turno_id?: string;
  turnoId?: string;
  ano: number;
  semestre: string;
  horario: string | null;
  sala: string | null;
  turno: string | null;
  created_at: string;
  curso?: Curso;
  classe?: any;
  curso_estudo?: Curso;
  professor?: Professor;
}

// Schema condicional baseado no tipo de instituição
const createTurmaSchema = (isSecundario: boolean) => {
  const baseSchema = {
    nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
    ano: z.number().min(2020, 'Ano mínimo é 2020').max(2100, 'Ano máximo é 2100'),
    horario: z.string().max(100).optional(),
    sala: z.string().max(50).optional(),
    turno: z.string().optional(),
  };

  if (isSecundario) {
    // Ensino Secundário: classe_id obrigatório, semestre NÃO existe
    return z.object({
      ...baseSchema,
      classe_id: z.string().uuid('Selecione uma classe'),
      curso_estudo_id: z.string().uuid('Selecione um curso de estudo').optional().nullable(),
    });
  } else {
    // Ensino Superior: curso_id obrigatório, semestre obrigatório
    return z.object({
      ...baseSchema,
      curso_id: z.string().uuid('Selecione um curso'),
      semestre: z.string().min(1, 'Selecione um semestre'),
    });
  }
};

export const TurmasTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [editingTurma, setEditingTurma] = useState<Turma | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCurso, setFilterCurso] = useState<string>('all');
  const [filterCursoEstudo, setFilterCursoEstudo] = useState<string>('all');
  const [filterAno, setFilterAno] = useState<string>('all');
  const [filterTurno, setFilterTurno] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [formData, setFormData] = useState({
    nome: '',
    curso_id: '', // Para Ensino Superior: curso; Para Ensino Secundário: curso de estudo (área)
    classe_id: '', // Para Ensino Secundário: classe (ano) - FK (obrigatório)
    // NOTA: Campo "classe" (string) foi removido - usar apenas classe_id (Select de classes cadastradas)
    // professor_id REMOVIDO: professor é vinculado via Plano de Ensino
    turno_id: '',
    anoLetivoId: '', // ID do ano letivo (obrigatório)
    ano: new Date().getFullYear(), // Mantido para compatibilidade
    semestre: '', // Para Ensino Superior: semestre (obrigatório) - NUNCA para Ensino Secundário
    semestreId: '', // ID do semestre (opcional, se usar UUID)
    horario: '',
    sala: '',
    turno: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useSafeDialog(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { instituicaoId, shouldFilter } = useTenantFilter();
  const currentInstituicaoId = useCurrentInstituicaoId();
  const { tipoAcademico, isSecundario } = useInstituicao();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();
  
  // Use tipoAcademico as primary source
  const isSecundarioType = isSecundario;
  
  const periodoLabel = isSecundarioType ? 'Ano' : 'Ano/Sem';
  const cursoLabel = isSecundarioType ? 'Classe' : 'Curso';

  // Fetch turnos - sempre carregar automaticamente
  const { data: turnos = [], refetch: refetchTurnos } = useQuery({
    queryKey: ['turnos-turmas', instituicaoId],
    queryFn: async () => {
      // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
      // O backend usa req.user.instituicaoId do JWT token automaticamente
      const response = await turnosApi.getAll({ ativo: true });
      return Array.isArray(response) ? response : (response?.data || []);
    }
  });

  // Fetch classes (apenas para Ensino Secundário)
  // Sempre carregar automaticamente quando for secundário e tiver instituicaoId
  const { data: classes = [], refetch: refetchClasses } = useQuery({
    queryKey: ['classes-turmas', currentInstituicaoId, tipoAcademico],
    queryFn: async () => {
      if (!isSecundario) return [];
      // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
      // O backend usa req.user.instituicaoId do JWT token automaticamente
      const response = await classesApi.getAll();
      return Array.isArray(response) ? response : [];
    },
    enabled: isSecundario && !!currentInstituicaoId
  });

  // Fetch cursos (para Ensino Secundário: cursos de estudo/área; para Ensino Superior: cursos)
  // Sempre carregar automaticamente quando tiver instituicaoId
  const { data: cursos = [], isLoading: isLoadingCursos, refetch: refetchCursos } = useQuery({
    queryKey: ['cursos-turmas', currentInstituicaoId || instituicaoId, tipoAcademico, isSecundario],
    queryFn: async () => {
      const params: Record<string, any> = {};
      const idToUse = currentInstituicaoId || instituicaoId;
      if (idToUse) {
        // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
        // O backend usa req.user.instituicaoId do JWT token automaticamente
      }
      const response = await cursosApi.getAll(params);
      let data = Array.isArray(response) ? response : (response?.data || []);
      
      if (isSecundario) {
        // Ensino Secundário: retornar todos os cursos (são os cursos de estudo/área)
        // Filtrar apenas cursos do tipo 'classe' (esses devem ser classes, não cursos)
        // Incluir cursos ativos ou sem campo ativo (null/undefined)
        return data.filter((c: Curso) => {
          const curso = c as any;
          return c.tipo !== 'classe' && (curso.ativo === true || curso.ativo === null || curso.ativo === undefined);
        });
      } else {
        // Ensino Superior: usar cursosApi e filtrar cursos do tipo 'classe'
        // Incluir cursos ativos ou sem campo ativo (null/undefined)
        return data.filter((c: Curso) => {
          const curso = c as any;
          return c.tipo !== 'classe' && (curso.ativo === true || curso.ativo === null || curso.ativo === undefined);
        });
      }
    },
    enabled: !!(currentInstituicaoId || instituicaoId)
  });

  // Fetch professores - sempre carregar automaticamente
  const { data: professores = [], refetch: refetchProfessores } = useQuery({
    queryKey: ['professores-turmas', instituicaoId],
    queryFn: async () => {
      const params: Record<string, any> = { role: 'PROFESSOR' };
      if (shouldFilter && instituicaoId) {
        // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
        // O backend usa req.user.instituicaoId do JWT token automaticamente
      }
      const response = await usersApi.getAll(params);
      return (response?.data ?? []);
    }
  });

  // Fetch anos letivos - sempre carregar automaticamente
  // Removido: busca manual de anos letivos - usar AnoLetivoSelect que já faz isso

  // Fetch turmas
  const { data: turmas = [], isLoading } = useQuery({
    queryKey: ['turmas', instituicaoId, sortOrder],
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (shouldFilter && instituicaoId) {
        // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
        // O backend usa req.user.instituicaoId do JWT token automaticamente
      }
      const response = await turmasApi.getAll(params);
      let data = Array.isArray(response) ? response : (response?.data || []);
      // Sort by ano
      data.sort((a: Turma, b: Turma) => {
        return sortOrder === 'asc' ? a.ano - b.ano : b.ano - a.ano;
      });
      return data;
    }
  });

  // Create mutation - protegida contra unmount
  const createMutation = useSafeMutation({
    mutationFn: async (data: any) => {
      // Multi-tenant: NUNCA enviar instituicaoId do frontend - o backend usa o do token JWT
      const { instituicaoId: _, ...cleanData } = data;
      await turmasApi.create(cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas'] });
      toast.success('Turma cadastrada com sucesso!');
      // Fechamento explícito após sucesso
      setIsDialogOpen(false);
      // Resetar formulário apenas após sucesso
      setEditingTurma(null);
      setFormData({
        nome: '',
        curso_id: '',
        classe_id: '',
        classe: '',
        turno_id: '',
        anoLetivoId: '',
        ano: new Date().getFullYear(),
        semestre: '', // Não usar valor padrão hardcoded
        semestreId: '',
        horario: '',
        sala: '',
        turno: '',
      });
    },
    onError: (error: any) => {
      // NÃO fechar modal em caso de erro - manter estado para correção
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Erro ao cadastrar turma';
      toast.error(errorMessage);
    }
  });

  // Update mutation - protegida contra unmount
  const updateMutation = useSafeMutation({
    mutationFn: async ({ id, ...data }: any) => {
      // Multi-tenant: NUNCA enviar instituicaoId do frontend - o backend usa o do token JWT
      const { instituicaoId: _, ...cleanData } = data;
      await turmasApi.update(id, cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas'] });
      toast.success('Turma atualizada com sucesso!');
      // Fechamento explícito após sucesso
      setIsDialogOpen(false);
      // Resetar formulário apenas após sucesso
      setEditingTurma(null);
      setFormData({
        nome: '',
        curso_id: '',
        classe_id: '',
        classe: '',
        turno_id: '',
        anoLetivoId: '',
        ano: new Date().getFullYear(),
        semestre: '', // Não usar valor padrão hardcoded
        semestreId: '',
        horario: '',
        sala: '',
        turno: '',
      });
    },
    onError: (error: any) => {
      // NÃO fechar modal em caso de erro - manter estado para correção
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Erro ao atualizar turma';
      toast.error(errorMessage);
    }
  });

  // Delete mutation - protegida contra unmount
  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await turmasApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas'] });
      // Fechamento explícito após sucesso
      setDeleteDialogOpen(false);
      setDeletingId(null);
      toast.success('Turma excluída com sucesso!');
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Erro ao excluir turma. Tente novamente.'));
      // Fechamento explícito mesmo em caso de erro
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  });

  // Anos únicos para filtro
  const anosUnicos: number[] = (Array.from(new Set(turmas.map((t: Turma) => t.ano))) as number[]).sort((a: number, b: number) => b - a);

  const filteredTurmas = turmas.filter((turma: Turma) => {
    const matchesSearch = turma.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const turmaCursoId = turma.curso_id || turma.cursoId;
    const turmaClasseId = turma.classe_id || turma.classeId;
    const matchesCurso = filterCurso === 'all' || 
      (isSecundario ? turmaClasseId === filterCurso : turmaCursoId === filterCurso);
    const matchesAno = filterAno === 'all' || turma.ano.toString() === filterAno;
    const matchesTurno = filterTurno === 'all' || turma.turno === filterTurno;
    return matchesSearch && matchesCurso && matchesAno && matchesTurno;
  });

  const openDialog = (turma?: Turma) => {
    if (turma) {
      setEditingTurma(turma);
      const turmaData = turma as any;
      setFormData({
        nome: turma.nome,
        curso_id: turma.curso_id || turmaData.cursoId || '',
        classe_id: turmaData.classe_id || turmaData.classeId || '',
        // NOTA: Campo "classe" (string) foi removido - usar apenas classe_id (FK)
        turno_id: turmaData.turno_id || turmaData.turnoId || '',
        anoLetivoId: turmaData.anoLetivoId || turmaData.anoLetivoRef?.id || '',
        ano: turma.ano,
        semestre: turma.semestre?.toString() || '', // Não usar valor padrão hardcoded
        semestreId: turmaData.semestreId || '',
        horario: turma.horario || '',
        sala: turma.sala || '',
        turno: turma.turno || '',
      });
    } else {
      // Buscar ano letivo ativo para seleção padrão
      // Usar anoLetivoAtivo do hook em vez de buscar manualmente
      setEditingTurma(null);
      setFormData({
        nome: '',
        curso_id: '',
        classe_id: '',
        // NOTA: Campo "classe" (string) foi removido - usar apenas classe_id (FK)
        // professor_id REMOVIDO: professor é vinculado via Plano de Ensino
        turno_id: '',
        anoLetivoId: anoLetivoAtivo?.id || '',
        ano: anoLetivoAtivo?.ano || new Date().getFullYear(),
        semestre: '',
        horario: '',
        sala: '',
        turno: '',
      });
    }
    setErrors({});
    setIsDialogOpen(true);
    
    // Recarregar automaticamente todos os dados quando abrir o diálogo
    refetchTurnos();
    refetchCursos();
    if (isSecundario) {
      refetchClasses();
    }
    refetchProfessores();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      // Validação manual para campos obrigatórios
      const errors: Record<string, string> = {};
      if (!formData.nome) errors.nome = 'Nome é obrigatório';
      // professor_id REMOVIDO: professor é vinculado via Plano de Ensino
      
      // REGRA: Ano Letivo é OBRIGATÓRIO para Turma (NÍVEL 3)
      if (!formData.anoLetivoId) {
        errors.anoLetivoId = 'Ano Letivo é obrigatório para criar Turma';
      }
      
      // CRÍTICO: Validação condicional por tipo de instituição
      if (isSecundario) {
        // Ensino Secundário: classe_id é obrigatório, curso_id é opcional (área)
        if (!formData.classe_id) {
          errors.classe_id = 'Classe é obrigatória. Selecione uma classe cadastrada.';
        }
        // NOTA: Campo "classe" (string) foi removido - usar apenas classe_id (Select)
      } else {
        // Ensino Superior: curso_id é obrigatório
        if (!formData.curso_id) {
          errors.curso_id = 'Curso é obrigatório. Selecione um curso cadastrado.';
        }
        // Ensino Superior: semestre é obrigatório
        if (!formData.semestre) {
          errors.semestre = 'Semestre é obrigatório. Selecione um semestre cadastrado.';
        }
      }
      
      if (Object.keys(errors).length > 0) {
        setErrors(errors);
        return;
      }

      // Payload com anoLetivoId obrigatório
      // REGRA: Turma NÃO envia professorId ou disciplinaId - esses vínculos são feitos via Plano de Ensino
      const payload: any = {
        nome: formData.nome,
        anoLetivoId: formData.anoLetivoId, // OBRIGATÓRIO
        ano: Number(formData.ano), // Ano numérico (compatibilidade)
        sala: formData.sala || null,
        capacidade: 40,
      };

      if (isSecundario) {
        // Ensino Secundário: classeId obrigatório, cursoId opcional (área)
        // CRÍTICO: NÃO enviar semestre nem semestreId - backend rejeita esses campos
        payload.classeId = formData.classe_id;
        if (formData.curso_id && formData.curso_id !== 'none') {
          payload.cursoId = formData.curso_id; // Curso de estudo (área)
        }
      } else {
        // Ensino Superior: cursoId e semestre obrigatórios
        payload.cursoId = formData.curso_id;
        payload.semestre = formData.semestre ? Number(formData.semestre) : null;
        if (formData.semestreId) payload.semestreId = formData.semestreId;
      }

      // Turno: usar turnoId se disponível, senão usar turno (string)
      if (formData.turno_id) {
        payload.turnoId = formData.turno_id;
      } else if (formData.turno) {
        payload.turno = formData.turno;
      }

      if (formData.horario) {
        payload.horario = formData.horario;
      }

      if (editingTurma) {
        // Para update, só enviar anoLetivoId se estiver sendo alterado
        const updatePayload: any = { ...payload };
        if (formData.anoLetivoId) {
          updatePayload.anoLetivoId = formData.anoLetivoId;
        }
        updateMutation.mutate({
          id: editingTurma.id,
          ...updatePayload,
        });
      } else {
        // Multi-tenant: NUNCA enviar instituicaoId do frontend - o backend usa o do token JWT
        createMutation.mutate({
          ...payload,
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const getTurnoIcon = (turnoNome: string | null | any) => {
    if (!turnoNome) return null;
    // Handle case where turnoNome might be an object with a 'nome' property
    const nome = typeof turnoNome === 'string' ? turnoNome : (turnoNome?.nome || String(turnoNome));
    if (!nome || typeof nome !== 'string') return null;
    const nomeLower = nome.toLowerCase();
    if (nomeLower.includes('manhã') || nomeLower.includes('manha')) return <Sun className="h-3 w-3" />;
    if (nomeLower.includes('tarde')) return <Sunset className="h-3 w-3" />;
    if (nomeLower.includes('noite')) return <Moon className="h-3 w-3" />;
    return <Clock className="h-3 w-3" />;
  };

  const getTurnoBadgeColor = (turnoNome: string | null | any) => {
    if (!turnoNome) return '';
    // Handle case where turnoNome might be an object with a 'nome' property
    const nome = typeof turnoNome === 'string' ? turnoNome : (turnoNome?.nome || String(turnoNome));
    if (!nome || typeof nome !== 'string') return 'bg-gray-500';
    const nomeLower = nome.toLowerCase();
    if (nomeLower.includes('manhã') || nomeLower.includes('manha')) return 'bg-amber-500';
    if (nomeLower.includes('tarde')) return 'bg-orange-500';
    if (nomeLower.includes('noite')) return 'bg-indigo-500';
    return 'bg-gray-500';
  };

  const exportData = filteredTurmas.map((t: Turma) => [
    t.nome,
    t.curso?.nome || '-',
    t.professor?.nome_completo || '-',
    isSecundario ? `${t.ano}` : `${t.ano}/${t.semestre}`,
    t.turno || '-',
    t.horario || '-',
    t.sala || '-'
  ]);

  return (
    <AnoLetivoAtivoGuard showAlert={true} disableChildren={false}>
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>{isSecundario ? 'Classes/Turmas' : 'Turmas'}</CardTitle>
            <CardDescription>
              Gerencie as turmas e classes do sistema
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ExportButtons
              titulo={isSecundario ? "Relatório de Classes" : "Relatório de Turmas"}
              colunas={[isSecundario ? 'Classe' : 'Turma', cursoLabel, 'Professor', periodoLabel, 'Turno', 'Horário', 'Sala']}
              dados={exportData}
            />
            <RelatorioTurmasTurnoDialog />
            <Button 
              onClick={() => openDialog()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Turma
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterCurso} onValueChange={setFilterCurso}>
            <SelectTrigger className="w-full lg:w-[200px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Selecione uma opção..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isSecundario ? "Todas as classes" : "Todos os cursos"}</SelectItem>
              {cursos.map((curso: Curso) => (
                <SelectItem key={curso.id} value={curso.id}>
                  {curso.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterAno} onValueChange={setFilterAno}>
            <SelectTrigger className="w-full lg:w-[150px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {anosUnicos.map((ano: number) => (
                <SelectItem key={ano} value={ano.toString()}>
                  {ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterTurno} onValueChange={setFilterTurno}>
            <SelectTrigger className="w-full lg:w-[150px]">
              <Clock className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Selecione uma opção..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os turnos</SelectItem>
              {turnos.map((turno: Turno) => (
                <SelectItem key={turno.id} value={turno.nome}>
                  {turno.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            <ArrowUpDown className="mr-2 h-4 w-4" />
            {sortOrder === 'desc' ? 'Mais recente' : 'Mais antigo'}
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredTurmas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm || filterCurso !== 'all' || filterAno !== 'all'
              ? 'Nenhuma turma encontrada'
              : 'Nenhuma turma cadastrada'}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>{cursoLabel}</TableHead>
                  <TableHead>Professor</TableHead>
                  <TableHead>{periodoLabel}</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Sala</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTurmas.map((turma: Turma) => (
                  <TableRow key={turma.id}>
                    <TableCell className="font-medium">{turma.nome}</TableCell>
                    <TableCell>
                      {isSecundario 
                        ? (turma.classe?.nome || turma.curso?.nome || '-')
                        : (turma.curso?.nome || '-')
                      }
                    </TableCell>
                    <TableCell>{turma.professor?.nome_completo || turma.professor?.nomeCompleto || '-'}</TableCell>
                    <TableCell>
                      {isSecundario ? turma.ano : `${turma.ano}/${turma.semestre}º`}
                    </TableCell>
                    <TableCell>
                      {turma.turno ? (
                        <Badge className={getTurnoBadgeColor(turma.turno)}>
                          {getTurnoIcon(turma.turno)}
                          <span className="ml-1">
                            {typeof turma.turno === 'string' ? turma.turno : (turma.turno?.nome || String(turma.turno))}
                          </span>
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{turma.sala || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDialog(turma)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(turma.id)}
                        disabled={deleteMutation.isPending}
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

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingTurma 
                  ? (isSecundario ? 'Editar Classe/Turma' : 'Editar Turma')
                  : 'Nova Turma'}
              </DialogTitle>
              <DialogDescription>
                {isSecundario 
                  ? 'Preencha os dados da classe/turma abaixo.'
                  : 'Preencha os dados da turma abaixo.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">{isSecundario ? 'Turma' : 'Nome da Turma'}</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) =>
                      setFormData({ ...formData, nome: e.target.value })
                    }
                    placeholder={isSecundario ? "Ex: 10ª A" : "Ex: Turma A - Engenharia"}
                  />
                  {errors.nome && (
                    <p className="text-sm text-destructive">{errors.nome}</p>
                  )}
                </div>
                {isSecundario ? (
                  <>
                    {/* CRÍTICO: Ensino Secundário - APENAS campo Classe (Select de classes cadastradas) */}
                    <div className="space-y-2">
                      <Label htmlFor="classe_id">Classe (Ano) *</Label>
                      <Select
                        value={formData.classe_id}
                        onValueChange={(value) =>
                          setFormData({ ...formData, classe_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a classe (ano)..." />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.length === 0 ? (
                            <div className="p-2 text-center text-sm text-muted-foreground">
                              Nenhuma classe cadastrada. Cadastre classes em Configuração de Ensino → Classes.
                            </div>
                          ) : (
                            classes.map((classe: any) => (
                              <SelectItem key={classe.id} value={classe.id}>
                                {classe.nome}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {errors.classe_id && (
                        <p className="text-sm text-destructive">{errors.classe_id}</p>
                      )}
                      {classes.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          Não há classes cadastradas. Cadastre classes em Configuração de Ensino → Classes.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="curso_id">Curso de Estudo (Área/Opção)</Label>
                      <Select
                        value={formData.curso_id || 'none'}
                        onValueChange={(value) =>
                          setFormData({ ...formData, curso_id: value === 'none' ? '' : value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o curso de estudo (opcional)..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {isLoadingCursos ? (
                            <div className="p-2 flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm text-muted-foreground">Carregando cursos...</span>
                            </div>
                          ) : cursos.length === 0 ? (
                            <div className="p-2 text-center text-sm text-muted-foreground">
                              Nenhum curso de estudo cadastrado
                            </div>
                          ) : (
                            cursos.map((curso: Curso) => (
                              <SelectItem key={curso.id} value={curso.id}>
                                {curso.nome}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {errors.curso_id && (
                        <p className="text-sm text-destructive">{errors.curso_id}</p>
                      )}
                      {!isLoadingCursos && cursos.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          Não há cursos de estudo cadastrados. Cadastre cursos em Gestão Académica → Cursos.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="curso_id">Curso *</Label>
                    <Select
                      value={formData.curso_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, curso_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o curso..." />
                      </SelectTrigger>
                      <SelectContent>
                        {cursos.map((curso: Curso) => (
                          <SelectItem key={curso.id} value={curso.id}>
                            {curso.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.curso_id && (
                      <p className="text-sm text-destructive">{errors.curso_id}</p>
                    )}
                  </div>
                )}
                {/* Campo Professor REMOVIDO: professor é vinculado via Plano de Ensino */}
                <div className="space-y-2">
                  <Label>Professor</Label>
                  <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                    O professor será vinculado através de um Plano de Ensino. Crie a turma primeiro e depois crie o Plano de Ensino vinculando o professor e a disciplina.
                  </div>
                </div>
                <div className={isSecundario ? "" : "grid grid-cols-2 gap-4"}>
                  <AnoLetivoSelect
                    value={formData.ano}
                    onValueChange={(ano) => {
                      setFormData({
                        ...formData,
                        ano: ano,
                      });
                    }}
                    onIdChange={(id) => {
                      setFormData({
                        ...formData,
                        anoLetivoId: id,
                      });
                    }}
                    label="Ano Letivo"
                    required
                    showStatus={true}
                  />
                  {errors.anoLetivoId && (
                    <p className="text-sm text-destructive">{errors.anoLetivoId}</p>
                  )}
                  {!isSecundario && (
                    <PeriodoAcademicoSelect
                      value={formData.semestreId || formData.semestre}
                      onValueChange={(value) => {
                        // Se o valor é um ID (UUID), usar semestreId, senão usar semestre (número)
                        if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                          setFormData({ ...formData, semestreId: value, semestre: '' });
                        } else {
                          setFormData({ ...formData, semestre: value, semestreId: '' });
                        }
                      }}
                      anoLetivo={anoLetivoAtivo?.ano}
                      anoLetivoId={formData.anoLetivoId || anoLetivoAtivo?.id}
                      label="Semestre"
                      useNumericValue={true}
                    />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="turno">Turno</Label>
                    <Select
                      value={formData.turno_id || formData.turno}
                      onValueChange={(value) => {
                        // Verificar se é um ID (UUID) ou nome
                        const turno = turnos.find((t: Turno) => t.id === value || t.nome === value);
                        if (turno) {
                          setFormData({ ...formData, turno_id: turno.id, turno: turno.nome });
                        } else {
                          setFormData({ ...formData, turno: value, turno_id: '' });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o turno" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        {turnos.map((turno: Turno) => {
                          const nomeLower = turno.nome.toLowerCase();
                          let Icon = Clock;
                          if (nomeLower.includes('manhã') || nomeLower.includes('manha')) Icon = Sun;
                          else if (nomeLower.includes('tarde')) Icon = Sunset;
                          else if (nomeLower.includes('noite')) Icon = Moon;
                          
                          return (
                            <SelectItem key={turno.id} value={turno.id}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {turno.nome}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sala">Sala (opcional)</Label>
                    <Input
                      id="sala"
                      value={formData.sala}
                      onChange={(e) =>
                        setFormData({ ...formData, sala: e.target.value })
                      }
                      placeholder="Ex: Sala 101"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horario">Horário (opcional)</Label>
                  <Input
                    id="horario"
                    value={formData.horario}
                    onChange={(e) =>
                      setFormData({ ...formData, horario: e.target.value })
                    }
                    placeholder="Ex: Seg/Qua 19h"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Salvar
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
                Tem certeza que deseja excluir esta turma? Esta ação não pode ser desfeita.
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
    </AnoLetivoAtivoGuard>
  );
};