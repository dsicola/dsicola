import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cursosApi, disciplinasApi } from '@/services/api';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Plus, Trash2, Search, BookOpen, Clock, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { Badge } from '@/components/ui/badge';
import { PeriodoAcademicoSelect } from '@/components/academico/PeriodoAcademicoSelect';
import { useAnoLetivoAtivo } from '@/hooks/useAnoLetivoAtivo';

interface Curso {
  id: string;
  nome: string;
  codigo: string;
}

interface Disciplina {
  id: string;
  nome: string;
  codigo?: string;
  cargaHoraria: number;
}

interface VinculoDisciplina {
  id: string;
  disciplinaId: string;
  disciplina: Disciplina;
  semestre?: number | null;
  trimestre?: number | null;
  cargaHoraria?: number | null;
  obrigatoria: boolean;
}

export const MatrizCurricularTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [cursoSelecionado, setCursoSelecionado] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState<string>('');
  const [semestre, setSemestre] = useState<number | undefined>(undefined);
  const [trimestre, setTrimestre] = useState<number | undefined>(undefined);
  const [cargaHoraria, setCargaHoraria] = useState<number | undefined>(undefined);
  const [obrigatoria, setObrigatoria] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');

  const { isSuperior, isSecundario, tipoAcademico } = useInstituicao();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();

  // Buscar todos os cursos
  const { data: cursos = [], isLoading: loadingCursos } = useQuery({
    queryKey: ['cursos-matriz'],
    queryFn: async () => {
      const data = await cursosApi.getAll({ excludeTipo: 'classe', ativo: true });
      return Array.isArray(data) ? data : [];
    },
  });

  // Buscar disciplinas disponíveis (todas da instituição)
  const { data: disciplinasDisponiveis = [], isLoading: loadingDisciplinas } = useQuery({
    queryKey: ['disciplinas-disponiveis-matriz'],
    queryFn: async () => {
      const data = await disciplinasApi.getAll();
      return Array.isArray(data) ? data.filter((d: any) => d.ativa !== false) : [];
    },
  });

  // Buscar disciplinas vinculadas ao curso selecionado
  const { data: disciplinasVinculadas = [], isLoading: loadingVinculos, refetch: refetchVinculos } = useQuery({
    queryKey: ['disciplinas-curso', cursoSelecionado],
    queryFn: async () => {
      if (!cursoSelecionado) return [];
      const data = await cursosApi.listarDisciplinas(cursoSelecionado);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!cursoSelecionado,
  });

  // Mutação para vincular disciplina
  const vincularMutation = useMutation({
    mutationFn: async (data: {
      disciplinaId: string;
      semestre?: number;
      trimestre?: number;
      cargaHoraria?: number;
      obrigatoria?: boolean;
    }) => {
      if (!cursoSelecionado) throw new Error('Selecione um curso primeiro');
      return cursosApi.vincularDisciplina(cursoSelecionado, data);
    },
    onSuccess: () => {
      toast.success('Disciplina vinculada ao curso com sucesso!');
      setIsDialogOpen(false);
      setDisciplinaSelecionada('');
      setSemestre(undefined);
      setTrimestre(undefined);
      setCargaHoraria(undefined);
      setObrigatoria(true);
      refetchVinculos();
      queryClient.invalidateQueries({ queryKey: ['disciplinas-curso', cursoSelecionado] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Erro ao vincular disciplina';
      toast.error(message);
    },
  });

  // Mutação para desvincular disciplina
  const desvincularMutation = useMutation({
    mutationFn: async (disciplinaId: string) => {
      if (!cursoSelecionado) throw new Error('Selecione um curso primeiro');
      return cursosApi.desvincularDisciplina(cursoSelecionado, disciplinaId);
    },
    onSuccess: () => {
      toast.success('Disciplina desvinculada do curso com sucesso!');
      refetchVinculos();
      queryClient.invalidateQueries({ queryKey: ['disciplinas-curso', cursoSelecionado] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Erro ao desvincular disciplina';
      toast.error(message);
    },
  });

  // Obter disciplinas já vinculadas (para filtrar do select)
  const disciplinasJaVinculadas = disciplinasVinculadas.map((v: VinculoDisciplina) => v.disciplinaId);
  const disciplinasParaAdicionar = disciplinasDisponiveis.filter(
    (d: Disciplina) => !disciplinasJaVinculadas.includes(d.id)
  );

  // Filtrar disciplinas por busca
  const disciplinasFiltradas = disciplinasParaAdicionar.filter((d: Disciplina) =>
    d.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.codigo && d.codigo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Filtrar disciplinas vinculadas por busca
  const vinculosFiltrados = disciplinasVinculadas.filter((v: VinculoDisciplina) =>
    v.disciplina.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.disciplina.codigo && v.disciplina.codigo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleVincular = () => {
    if (!disciplinaSelecionada) {
      toast.error('Selecione uma disciplina');
      return;
    }

    if (isSuperior && !semestre) {
      toast.error('Informe o semestre para Ensino Superior');
      return;
    }

    if (isSecundario && !trimestre) {
      toast.error('Informe o trimestre para Ensino Secundário');
      return;
    }

    const disciplina = disciplinasDisponiveis.find((d: Disciplina) => d.id === disciplinaSelecionada);
    const cargaHorariaFinal = cargaHoraria || disciplina?.cargaHoraria || 0;

    vincularMutation.mutate({
      disciplinaId: disciplinaSelecionada,
      ...(isSuperior && { semestre }),
      ...(isSecundario && { trimestre }),
      cargaHoraria: cargaHorariaFinal,
      obrigatoria,
    });
  };

  const cursoAtual = cursos.find((c: Curso) => c.id === cursoSelecionado);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          Matriz Curricular - Estrutura do Curso
        </CardTitle>
        <CardDescription>
          Vincule disciplinas aos cursos e defina a estrutura curricular. Uma disciplina pode pertencer a vários cursos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Seleção de Curso */}
        <div className="mb-6 space-y-2">
          <Label htmlFor="curso-select">Selecione o Curso *</Label>
          {loadingCursos ? (
            <div className="text-sm text-muted-foreground">Carregando cursos...</div>
          ) : (
            <Select value={cursoSelecionado} onValueChange={setCursoSelecionado}>
              <SelectTrigger id="curso-select" className="w-full">
                <SelectValue placeholder="Selecione um curso para gerenciar a matriz curricular" />
              </SelectTrigger>
              <SelectContent>
                {cursos.map((curso: Curso) => (
                  <SelectItem key={curso.id} value={curso.id}>
                    {curso.codigo} - {curso.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {!cursoSelecionado ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Selecione um curso acima para gerenciar sua matriz curricular</p>
          </div>
        ) : (
          <>
            {/* Busca */}
            <div className="mb-4 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar disciplinas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Disciplina
              </Button>
            </div>

            {/* Lista de Disciplinas Vinculadas */}
            {loadingVinculos ? (
              <div className="text-center py-8 text-muted-foreground">Carregando disciplinas...</div>
            ) : vinculosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm
                  ? 'Nenhuma disciplina encontrada'
                  : 'Nenhuma disciplina vinculada a este curso. Clique em "Adicionar Disciplina" para começar.'}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Disciplina</TableHead>
                      {isSuperior && <TableHead>Semestre</TableHead>}
                      {isSecundario && <TableHead>Trimestre</TableHead>}
                      <TableHead>Carga Horária</TableHead>
                      <TableHead>Obrigatória</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vinculosFiltrados.map((vinculo: VinculoDisciplina) => (
                      <TableRow key={vinculo.id}>
                        <TableCell className="font-medium">
                          {vinculo.disciplina.codigo || '-'}
                        </TableCell>
                        <TableCell>{vinculo.disciplina.nome}</TableCell>
                        {isSuperior && (
                          <TableCell>
                            {vinculo.semestre ? (
                              <Badge variant="outline">{vinculo.semestre}º Semestre</Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        )}
                        {isSecundario && (
                          <TableCell>
                            {vinculo.trimestre ? (
                              <Badge variant="outline">{vinculo.trimestre}º Trimestre</Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {vinculo.cargaHoraria || vinculo.disciplina.cargaHoraria}h
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={vinculo.obrigatoria ? 'default' : 'secondary'}>
                            {vinculo.obrigatoria ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => desvincularMutation.mutate(vinculo.disciplinaId)}
                            disabled={desvincularMutation.isPending}
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

            {/* Estatísticas */}
            {vinculosFiltrados.length > 0 && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Total de disciplinas: <strong>{vinculosFiltrados.length}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Carga horária total: <strong>
                      {vinculosFiltrados.reduce(
                        (sum, v: VinculoDisciplina) =>
                          sum + (v.cargaHoraria || v.disciplina.cargaHoraria || 0),
                        0
                      )}h
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Dialog para adicionar disciplina */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Adicionar Disciplina ao Curso</DialogTitle>
              <DialogDescription>
                {cursoAtual && (
                  <>Vincular disciplina ao curso <strong>{cursoAtual.codigo} - {cursoAtual.nome}</strong></>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Seleção de Disciplina */}
              <div className="space-y-2">
                <Label htmlFor="disciplina-select">Disciplina *</Label>
                {loadingDisciplinas ? (
                  <div className="text-sm text-muted-foreground">Carregando disciplinas...</div>
                ) : (
                  <Select value={disciplinaSelecionada} onValueChange={setDisciplinaSelecionada}>
                    <SelectTrigger id="disciplina-select">
                      <SelectValue placeholder="Selecione uma disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      {disciplinasFiltradas.map((disciplina: Disciplina) => (
                        <SelectItem key={disciplina.id} value={disciplina.id}>
                          {disciplina.codigo && `${disciplina.codigo} - `}
                          {disciplina.nome} ({disciplina.cargaHoraria}h)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {disciplinasFiltradas.length === 0 && !loadingDisciplinas && (
                  <p className="text-sm text-muted-foreground">
                    {disciplinasJaVinculadas.length > 0
                      ? 'Todas as disciplinas já estão vinculadas a este curso'
                      : 'Nenhuma disciplina disponível'}
                  </p>
                )}
              </div>

              {/* Semestre (Ensino Superior) */}
              {isSuperior && (
                <div className="space-y-2">
                  <PeriodoAcademicoSelect
                    value={semestre?.toString() || ""}
                    onValueChange={(value) => setSemestre(Number(value))}
                    anoLetivo={anoLetivoAtivo?.ano}
                    anoLetivoId={anoLetivoAtivo?.id}
                    label="Semestre *"
                    required
                    useNumericValue={true}
                  />
                </div>
              )}

              {/* Trimestre (Ensino Secundário) */}
              {isSecundario && (
                <div className="space-y-2">
                  <PeriodoAcademicoSelect
                    value={trimestre?.toString() || ""}
                    onValueChange={(value) => setTrimestre(Number(value))}
                    anoLetivo={anoLetivoAtivo?.ano}
                    anoLetivoId={anoLetivoAtivo?.id}
                    label="Trimestre *"
                    required
                    useNumericValue={true}
                  />
                </div>
              )}

              {/* Carga Horária */}
              <div className="space-y-2">
                <Label htmlFor="carga-horaria">
                  Carga Horária (opcional - usa da disciplina se não informado)
                </Label>
                <Input
                  id="carga-horaria"
                  type="number"
                  min="1"
                  value={cargaHoraria || ''}
                  onChange={(e) =>
                    setCargaHoraria(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  placeholder="Ex: 60"
                />
                {disciplinaSelecionada && (
                  <p className="text-xs text-muted-foreground">
                    Carga horária padrão da disciplina:{' '}
                    {disciplinasDisponiveis.find((d: Disciplina) => d.id === disciplinaSelecionada)
                      ?.cargaHoraria || 0}h
                  </p>
                )}
              </div>

              {/* Obrigatória */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="obrigatoria"
                  checked={obrigatoria}
                  onCheckedChange={(checked) => setObrigatoria(checked as boolean)}
                />
                <Label htmlFor="obrigatoria" className="text-sm font-normal cursor-pointer">
                  Disciplina obrigatória
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleVincular}
                disabled={
                  vincularMutation.isPending ||
                  !disciplinaSelecionada ||
                  (isSuperior && !semestre) ||
                  (isSecundario && !trimestre)
                }
              >
                {vincularMutation.isPending ? 'Vinculando...' : 'Vincular'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

