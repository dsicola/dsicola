import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Trash2, Loader2, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiErrors';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { cursosApi, classesApi, academicProgressionApi } from '@/modules/academic/services/academicModule.service';

function formatMedia(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—';
  return String(v);
}

export const RegrasAprovacaoTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { isSecundario } = useInstituicao();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removerId, setRemoverId] = useState<string | null>(null);

  const [formCursoId, setFormCursoId] = useState<string>('__none__');
  const [formClasseId, setFormClasseId] = useState<string>('__none__');
  const [mediaMinima, setMediaMinima] = useState<string>('');
  const [maxReprovacoes, setMaxReprovacoes] = useState<string>('');
  const [exigeDisciplinasChave, setExigeDisciplinasChave] = useState(false);

  const { data: cursos = [] } = useQuery({
    queryKey: ['cursos-regras-aprovacao'],
    queryFn: async () => {
      const data = await cursosApi.getAll({ excludeTipo: 'classe', ativo: true });
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-regras-aprovacao'],
    queryFn: async () => {
      const data = await classesApi.getAll({ ativo: true });
      return Array.isArray(data) ? data : [];
    },
    enabled: isSecundario,
  });

  const { data: regras = [], isLoading } = useQuery({
    queryKey: ['academic-regras-aprovacao'],
    queryFn: () => academicProgressionApi.regras.list(),
  });

  const criarMutation = useMutation({
    mutationFn: () =>
      academicProgressionApi.regras.create({
        cursoId: formCursoId === '__none__' ? null : formCursoId,
        classeId: formClasseId === '__none__' ? null : formClasseId,
        mediaMinima: mediaMinima.trim() === '' ? null : Number(mediaMinima),
        maxReprovacoes: maxReprovacoes.trim() === '' ? null : parseInt(maxReprovacoes, 10),
        exigeDisciplinasChave,
      }),
    onSuccess: () => {
      toast.success('Regra criada.');
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['academic-regras-aprovacao'] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Não foi possível criar a regra.')),
  });

  const removerMutation = useMutation({
    mutationFn: (id: string) => academicProgressionApi.regras.remove(id),
    onSuccess: () => {
      toast.success('Regra removida.');
      setRemoverId(null);
      queryClient.invalidateQueries({ queryKey: ['academic-regras-aprovacao'] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Não foi possível remover.')),
  });

  const resetForm = () => {
    setFormCursoId('__none__');
    setFormClasseId('__none__');
    setMediaMinima('');
    setMaxReprovacoes('');
    setExigeDisciplinasChave(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Regras de aprovação
          </CardTitle>
          <CardDescription>
            Define média mínima, limite de reprovações e se o motor deve exigir disciplinas chave. A regra mais
            específica (curso + classe) prevalece sobre a geral da instituição.
          </CardDescription>
        </div>
        <Button type="button" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
            Nova regra
        </Button>
      </CardHeader>
      <CardContent>
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
                  <TableHead>Escopo</TableHead>
                  <TableHead>Média mín.</TableHead>
                  <TableHead>Máx. reprovações</TableHead>
                  <TableHead>Exige disc. chave</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regras.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      Nenhuma regra configurada. A instituição usa apenas o critério padrão de disciplinas negativas.
                    </TableCell>
                  </TableRow>
                ) : (
                  regras.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-[240px]">
                        <div className="text-sm font-medium">
                          {!r.cursoId && !r.classeId && 'Instituição (geral)'}
                          {r.cursoId && !r.classeId && (r.curso?.nome || 'Curso')}
                          {r.cursoId && r.classeId && (
                            <span>
                              {(r.curso?.nome || 'Curso')} · {(r.classe?.nome || 'Classe')}
                            </span>
                          )}
                          {!r.cursoId && r.classeId && (r.classe?.nome || 'Classe')}
                        </div>
                      </TableCell>
                      <TableCell>{formatMedia(r.mediaMinima)}</TableCell>
                      <TableCell>{r.maxReprovacoes ?? '—'}</TableCell>
                      <TableCell>{r.exigeDisciplinasChave ? 'Sim' : 'Não'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setRemoverId(r.id)}
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova regra de aprovação</DialogTitle>
              <DialogDescription>
                Deixe curso e classe vazios para uma regra geral. Quanto mais campos preencher, mais específica fica a
                regra.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Curso (opcional)</Label>
                <Select value={formCursoId} onValueChange={setFormCursoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os cursos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Todos (instituição)</SelectItem>
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
                  <Select value={formClasseId} onValueChange={setFormClasseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Todas</SelectItem>
                      {classes.map((cl: { id: string; nome: string }) => (
                        <SelectItem key={cl.id} value={cl.id}>
                          {cl.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mediaMin">Média mínima (0–20)</Label>
                  <Input
                    id="mediaMin"
                    type="number"
                    min={0}
                    max={20}
                    step="0.01"
                    value={mediaMinima}
                    onChange={(e) => setMediaMinima(e.target.value)}
                    placeholder="Ex: 10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxRep">Máx. reprovações</Label>
                  <Input
                    id="maxRep"
                    type="number"
                    min={0}
                    max={50}
                    value={maxReprovacoes}
                    onChange={(e) => setMaxReprovacoes(e.target.value)}
                    placeholder="Ex: 2"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="exigeChave"
                  checked={exigeDisciplinasChave}
                  onCheckedChange={(v) => setExigeDisciplinasChave(v === true)}
                />
                <Label htmlFor="exigeChave" className="font-normal cursor-pointer">
                  Exigir aprovação em disciplinas chave
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={criarMutation.isPending}
                onClick={() => {
                  const mmFilled = mediaMinima.trim() !== '';
                  const mrFilled = maxReprovacoes.trim() !== '';
                  if (!exigeDisciplinasChave && !mmFilled && !mrFilled) {
                    toast.error(
                      'Defina média mínima, máximo de reprovações ou marque exigir disciplinas chave — caso contrário a regra não tem efeito.'
                    );
                    return;
                  }
                  const mm = mmFilled ? Number(mediaMinima) : null;
                  if (mm != null && (Number.isNaN(mm) || mm < 0 || mm > 20)) {
                    toast.error('Média mínima deve estar entre 0 e 20.');
                    return;
                  }
                  const mr = mrFilled ? parseInt(maxReprovacoes, 10) : null;
                  if (mr != null && (!Number.isFinite(mr) || mr < 0 || mr > 50)) {
                    toast.error('Máximo de reprovações inválido (0–50).');
                    return;
                  }
                  criarMutation.mutate();
                }}
              >
                {criarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!removerId} onOpenChange={() => setRemoverId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover regra?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Os alunos deixarão de ser avaliados com este critério extra.
              </AlertDialogDescription>
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
