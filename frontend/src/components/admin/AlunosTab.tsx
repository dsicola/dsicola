import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { alunosApi, cursosApi, turmasApi, matriculasApi } from "@/services/api";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { useListQuery } from "@/hooks/useListQuery";
import { ListToolbar } from "@/components/common/ListToolbar";
import { PaginationControls } from "@/components/common/PaginationControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/common/ResponsiveTable";
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
import { toast } from "sonner";
import { Plus, Eye, Pencil, Trash2, Search, UserX } from "lucide-react";
import { ExportButtons } from "@/components/common/ExportButtons";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ViewAlunoDialog } from "./ViewAlunoDialog";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { SmartSearch } from "@/components/common/SmartSearch";
import { useAlunoSearch } from "@/hooks/useSmartSearch";

interface Aluno {
  id: string;
  nome_completo: string;
  email: string;
  telefone: string | null;
  numero_identificacao: string | null;
  numero_identificacao_publica: string | null;
  avatar_url: string | null;
  data_nascimento: string | null;
  status_aluno: string | null;
  nome_pai: string | null;
  nome_mae: string | null;
  morada: string | null;
  profissao: string | null;
  genero: string | null;
  cidade: string | null;
  pais: string | null;
  codigo_postal: string | null;
  tipo_sanguineo: string | null;
}

interface Turma {
  id: string;
  nome: string;
  ano: number;
  semestre: string;
  curso: { id: string; nome: string } | null;
}

interface Curso {
  id: string;
  nome: string;
}

interface Matricula {
  aluno_id: string;
  turma: {
    id: string;
    nome: string;
    ano: number;
    curso: { id: string; nome: string } | null;
  } | null;
}

export function AlunosTab() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSecretaria = location.pathname.includes('secretaria');
  const createAlunoUrl = isSecretaria ? '/secretaria-dashboard/criar-aluno' : '/admin-dashboard/criar-aluno';
  const [selectedAlunoId, setSelectedAlunoId] = useState<string | null>(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useSafeDialog(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useSafeDialog(false);
  const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
  const [selectedAlunos, setSelectedAlunos] = useState<string[]>([]);
  const [viewingAluno, setViewingAluno] = useState<Aluno | null>(null);
  const [showViewDialog, setShowViewDialog] = useSafeDialog(false);

  const queryClient = useQueryClient();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const { isSecundario, tipoAcademico } = useInstituicao();
  const { searchAlunos } = useAlunoSearch();

  // Listagem paginada server-side
  const list = useListQuery({
    endpoint: alunosApi.getList,
    queryKey: ["estudantes-list"],
    defaultFilters: { status: "Ativo" },
    pageSize: 10,
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const { data: alunos, meta, isLoading, page, setPage, searchInput, setSearchInput, filters, updateFilter, clearFilters } = list;
  const paginatedAlunos = alunos as Aluno[];
  const selectedCurso = filters.cursoId || "all";
  const selectedTurma = filters.turmaId || "all";

  // Fetch turmas
  const { data: turmas = [] } = useQuery({
    queryKey: ["turmas-select"],
    queryFn: async () => {
      const response = await turmasApi.getAll();
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  // Fetch cursos - filtrados por tipo acadêmico
  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-select", tipoAcademico],
    queryFn: async () => {
      const response = await cursosApi.getAll();
      let cursos = Array.isArray(response) ? response : (response?.data || []);
      
      // Aplicar filtro por tipo acadêmico
      if (tipoAcademico === 'SUPERIOR') {
        // Ensino Superior: excluir cursos do tipo 'classe'
        cursos = cursos.filter((c: any) => c.tipo !== 'classe' && c.tipo !== 'Classe');
      } else if (tipoAcademico === 'SECUNDARIO') {
        // Ensino Secundário: incluir todos os cursos (classes e áreas de estudo)
        // Não filtrar por tipo
      }
      
      return cursos;
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  // Fetch matriculas
  const { data: matriculas = [] } = useQuery({
    queryKey: ["matriculas-alunos", instituicaoId],
    queryFn: async () => {
      const response = await matriculasApi.getAll({});
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  // Helper: dados vêm do backend (turma/curso na resposta)
  const getStudentCurso = (aluno: Aluno & { turma?: { curso?: { nome: string } } }) => aluno.turma?.curso?.nome ?? null;
  const getStudentTurma = (aluno: Aluno & { turma?: { nome: string } }) => aluno.turma?.nome ?? null;

  // Deactivate mutation - protegida contra unmount
  const deactivateMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await alunosApi.deactivate(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estudantes-list"] });
      queryClient.invalidateQueries({ queryKey: ["alunos"] });
      list.invalidate();
      toast.success("Estudante desativado com sucesso!");
      setDeactivateDialogOpen(false);
      setSelectedAluno(null);
    },
    onError: (error: Error) => {
      toast.error("Erro ao desativar estudante", {
        description: error.message,
        duration: 5000,
      });
    },
  });

  // Delete mutation - protegida contra unmount
  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await alunosApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estudantes-list"] });
      queryClient.invalidateQueries({ queryKey: ["alunos"] });
      list.invalidate();
      toast.success("Estudante excluído permanentemente!");
      setDeleteDialogOpen(false);
      setSelectedAluno(null);
    },
    onError: (error: Error) => {
      const errorMessage = error.message;
      
      if (errorMessage.includes("Forbidden") || errorMessage.includes("Admin access required")) {
        toast.error("Acesso negado", {
          description: "Apenas administradores podem excluir estudantes.",
          duration: 5000,
        });
      } else if (errorMessage.includes("Sessão não encontrada")) {
        toast.error("Sessão expirada", {
          description: "Por favor, faça login novamente.",
          duration: 5000,
        });
      } else {
        toast.error("Erro ao excluir estudante", {
          description: errorMessage,
          duration: 5000,
        });
      }
      setDeleteDialogOpen(false);
      setSelectedAluno(null);
    },
  });

  const filteredTurmas = selectedCurso === "all"
    ? turmas
    : turmas?.filter((t: Turma) => t.curso?.id === selectedCurso);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAlunos(paginatedAlunos?.map((a: Aluno) => a.id) || []);
    } else {
      setSelectedAlunos([]);
    }
  };

  const handleSelectAluno = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedAlunos(prev => [...prev, id]);
    } else {
      setSelectedAlunos(prev => prev.filter(aId => aId !== id));
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "Ativo":
        return <Badge variant="default" className="bg-green-500">Ativo</Badge>;
      case "Inativo":
        return <Badge variant="secondary">Inativo</Badge>;
      case "Inativo por inadimplência":
        return <Badge variant="destructive">Inadimplente</Badge>;
      default:
        return <Badge variant="default" className="bg-green-500">Ativo</Badge>;
    }
  };

  const exportData = paginatedAlunos?.map((a: Aluno) => [
    a.numero_identificacao_publica || '-',
    a.numero_identificacao || '-',
    a.nome_completo,
    getStudentCurso(a) || '-',
    getStudentTurma(a) || '-',
    a.nome_pai || '-',
    a.telefone || '-',
  ]) || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Curso</span>
              <Select value={selectedCurso} onValueChange={(value) => {
                updateFilter("cursoId", value === "all" ? undefined : value);
                updateFilter("turmaId", undefined);
              }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Selecione uma opção..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Cursos</SelectItem>
                  {cursos && cursos.map((curso: Curso) => (
                    <SelectItem key={curso.id} value={curso.id}>
                      {curso.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Turma</span>
              <Select value={selectedTurma} onValueChange={(v) => updateFilter("turmaId", v === "all" ? undefined : v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Selecione uma opção..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Turmas</SelectItem>
                  {filteredTurmas && filteredTurmas.map((turma: Turma) => (
                    <SelectItem key={turma.id} value={turma.id}>
                      {turma.nome} ({turma.ano})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 w-full sm:w-auto">
            <div className="hidden sm:block">
              <ExportButtons
                titulo="Relatório de Estudantes"
                colunas={['Nº ID', 'BI', 'Nome', 'Curso', 'Turma', 'Encarregado', 'Telefone']}
                dados={exportData}
              />
            </div>
            <Button onClick={() => navigate(createAlunoUrl)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Criar Novo
            </Button>
          </div>
        </div>

        {/* Search and Actions Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <Select defaultValue="action">
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Selecionar Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="action">Selecionar Ação</SelectItem>
              <SelectItem value="delete">Excluir Selecionados</SelectItem>
              <SelectItem value="deactivate">Desativar Selecionados</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex flex-1 flex-wrap items-center gap-2 max-w-2xl">
            <ListToolbar
              searchValue={searchInput}
              onSearchChange={setSearchInput}
              searchPlaceholder="Buscar por nome, email ou nº..."
              filters={[
                {
                  key: "status",
                  label: "Status",
                  value: filters.status || "Ativo",
                  onValueChange: (v) => updateFilter("status", v === "all" ? undefined : v),
                  options: [
                    { value: "Ativo", label: "Ativos" },
                    { value: "Inativo", label: "Inativos" },
                    { value: "all", label: "Todos" },
                  ],
                },
              ]}
              onClearFilters={clearFilters}
              hasActiveFilters={!!(filters.status || filters.cursoId || filters.turmaId || searchInput)}
              pageSize={filters.pageSize ?? 10}
              onPageSizeChange={(n) => updateFilter("pageSize", n)}
            />
          </div>
          <div className="w-full sm:w-96">
            <SmartSearch
              placeholder="Digite o nome do estudante, email, BI ou número de identificação..."
              value={selectedAlunoId ? (paginatedAlunos?.find((a: Aluno) => a.id === selectedAlunoId)?.nome_completo || "") : searchInput}
              selectedId={selectedAlunoId || undefined}
              onSelect={(item) => {
                if (item) {
                  setSelectedAlunoId(item.id);
                  setSearchInput(item.nomeCompleto || item.nome || "");
                } else {
                  setSelectedAlunoId(null);
                  setSearchInput("");
                }
              }}
              onClear={() => {
                setSelectedAlunoId(null);
                setSearchInput("");
              }}
              searchFn={searchAlunos}
              emptyMessage="Nenhum estudante encontrado"
              minSearchLength={2}
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={selectedAlunos.length === paginatedAlunos?.length && paginatedAlunos?.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Nº ID</TableHead>
                <TableHead>BI</TableHead>
                <TableHead>Nome Completo</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Encarregado</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAlunos?.map((aluno: Aluno) => (
                <TableRow key={aluno.id}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedAlunos.includes(aluno.id)}
                      onCheckedChange={(checked) => handleSelectAluno(aluno.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="text-primary font-medium">
                    {aluno.numero_identificacao_publica || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {aluno.numero_identificacao || '-'}
                  </TableCell>
                  <TableCell className="text-primary font-medium hover:underline cursor-pointer">
                    {aluno.nome_completo}
                  </TableCell>
                  <TableCell>
                    {getStudentCurso(aluno) || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {getStudentTurma(aluno) || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>{aluno.nome_pai || '-'}</TableCell>
                  <TableCell>{aluno.telefone || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          setViewingAluno(aluno);
                          setShowViewDialog(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                        onClick={() => {
                          setSelectedAluno(aluno);
                          setDeactivateDialogOpen(true);
                        }}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        onClick={() => {
                          const editUrl = isSecretaria 
                            ? `/secretaria-dashboard/editar-aluno/${aluno.id}` 
                            : `/admin-dashboard/editar-aluno/${aluno.id}`;
                          navigate(editUrl);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setSelectedAluno(aluno);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!paginatedAlunos || paginatedAlunos.length === 0) && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum estudante encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <PaginationControls
          page={page}
          pageSize={meta.pageSize}
          total={meta.total}
          onPageChange={setPage}
          isLoading={isLoading}
        />

        {/* Deactivate Dialog */}
        <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desativar Estudante</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja desativar o estudante "{selectedAluno?.nome_completo}"?
                O estudante não poderá acessar o sistema enquanto estiver desativado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedAluno && deactivateMutation.mutate(selectedAluno.id)}
              >
                Desativar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Estudante Permanentemente</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir permanentemente o estudante "{selectedAluno?.nome_completo}"?
                Esta ação não pode ser desfeita e todos os dados do estudante serão removidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => selectedAluno && deleteMutation.mutate(selectedAluno.id)}
              >
                Excluir Permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ViewAlunoDialog
          open={showViewDialog}
          onOpenChange={setShowViewDialog}
          aluno={viewingAluno}
        />
      </CardContent>
    </Card>
  );
}