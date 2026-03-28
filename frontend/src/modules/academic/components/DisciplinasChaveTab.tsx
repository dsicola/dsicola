import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiErrors';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { cursosApi, classesApi, disciplinasApi, academicProgressionApi } from '@/modules/academic/services/academicModule.service';

export const DisciplinasChaveTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { isSecundario } = useInstituicao();
  const [filtroCursoId, setFiltroCursoId] = useState<string>('');
  const [novaCursoId, setNovaCursoId] = useState<string>('__none__');
  const [novaClasseId, setNovaClasseId] = useState<string>('__none__');
  const [novaDisciplinaId, setNovaDisciplinaId] = useState<string>('');
  const [removerId, setRemoverId] = useState<string | null>(null);

  const { data: cursos = [] } = useQuery({
    queryKey: ['cursos-disciplinas-chave'],
    queryFn: async () => {
      const data = await cursosApi.getAll({ excludeTipo: 'classe', ativo: true });
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-disciplinas-chave'],
    queryFn: async () => {
      const data = await classesApi.getAll({ ativo: true });
      return Array.isArray(data) ? data : [];
    },
    enabled: isSecundario,
  });

  const { data: disciplinas = [] } = useQuery({
    queryKey: ['disciplinas-disciplinas-chave'],
    queryFn: async () => {
      const data = await disciplinasApi.getAll();
      return Array.isArray(data) ? data.filter((d: { ativa?: boolean }) => d.ativa !== false) : [];
    },
  });

  const { data: chaves = [], isLoading } = useQuery({
    queryKey: ['academic-disciplinas-chave', filtroCursoId],
    queryFn: () =>
      academicProgressionApi.disciplinasChave.list(
        filtroCursoId.trim() ? { cursoId: filtroCursoId } : undefined
      ),
  });

  const cursoParaForm = novaCursoId !== '__none__' ? novaCursoId : '';

  const disciplinasFiltradas = useMemo(() => {
    if (!cursoParaForm) return disciplinas as { id: string; nome: string; codigo?: string }[];
    return (disciplinas as { id: string; nome: string; codigo?: string; cursoId?: string | null }[]).filter(
      (d) => !d.cursoId || d.cursoId === cursoParaForm
    );
  }, [disciplinas, cursoParaForm]);

  const adicionarMutation = useMutation({
    mutationFn: () =>
      academicProgressionApi.disciplinasChave.create({
        cursoId: cursoParaForm,
        classeId: novaClasseId === '__none__' ? null : novaClasseId,
        disciplinaId: novaDisciplinaId,
      }),
    onSuccess: () => {
      toast.success('Disciplina chave registada.');
      setNovaDisciplinaId('');
      setNovaClasseId('__none__');
      queryClient.invalidateQueries({ queryKey: ['academic-disciplinas-chave'] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Não foi possível adicionar.')),
  });

  const removerMutation = useMutation({
    mutationFn: (id: string) => academicProgressionApi.disciplinasChave.remove(id),
    onSuccess: () => {
      toast.success('Removido.');
      setRemoverId(null);
      queryClient.invalidateQueries({ queryKey: ['academic-disciplinas-chave'] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Não foi possível remover.')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          Disciplinas chave
        </CardTitle>
        <CardDescription>
          Disciplinas cuja aprovação é obrigatória quando a regra de aprovação exige “disciplinas chave”. Configure
          primeiro as regras na aba homónima.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {cursos.length === 0 && (
          <p className="text-sm text-muted-foreground rounded-md border border-dashed p-4">
            Cadastre pelo menos um curso (área) na aba Cursos para configurar disciplinas chave.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-end">
          <div className="space-y-2 min-w-[220px]">
            <Label>Filtrar por curso</Label>
            <Select
              value={filtroCursoId || '__all__'}
              onValueChange={(v) => setFiltroCursoId(v === '__all__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os cursos</SelectItem>
                {cursos.map((c: { id: string; nome: string }) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
          <h3 className="text-sm font-medium">Adicionar disciplina chave</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Curso *</Label>
              <Select value={novaCursoId} onValueChange={setNovaCursoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o curso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione…</SelectItem>
                  {cursos.map((c: { id: string; nome: string }) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isSecundario && (
              <div className="space-y-2">
                <Label>Classe (opcional)</Label>
                <Select value={novaClasseId} onValueChange={setNovaClasseId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Todo o curso</SelectItem>
                    {classes.map((cl: { id: string; nome: string }) => (
                      <SelectItem key={cl.id} value={cl.id}>
                        {cl.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Disciplina *</Label>
              <Select value={novaDisciplinaId} onValueChange={setNovaDisciplinaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {disciplinasFiltradas.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.codigo ? `${d.codigo} · ` : ''}
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            disabled={!cursoParaForm || !novaDisciplinaId || adicionarMutation.isPending}
            onClick={() => adicionarMutation.mutate()}
          >
            {adicionarMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Adicionar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            A carregar…
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Curso</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Disciplina</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                      Nenhuma disciplina chave neste filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  chaves.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.curso?.nome || '—'}</TableCell>
                      <TableCell>{row.classe?.nome || '—'}</TableCell>
                      <TableCell>
                        {row.disciplina?.codigo ? `${row.disciplina.codigo} · ` : ''}
                        {row.disciplina?.nome || row.disciplinaId}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setRemoverId(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <AlertDialog open={!!removerId} onOpenChange={() => setRemoverId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover disciplina chave?</AlertDialogTitle>
              <AlertDialogDescription>Confirma a remoção desta configuração?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => removerId && removerMutation.mutate(removerId)}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
