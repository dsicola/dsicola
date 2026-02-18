/**
 * Módulo Completo de Horários - DSICOLA
 * Integração: Ano Letivo, Turma, Plano de Ensino, Professor, Disciplina
 * RBAC: ADMIN, SECRETARIA (criar, editar, aprovar, excluir) | PROFESSOR (apenas visualizar próprios)
 */
import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { turmasApi, horariosApi, planoEnsinoApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Clock, Loader2, Edit, Trash2, Calendar, Printer, CheckCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useInstituicao } from '@/contexts/InstituicaoContext';

// Backend: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
const DIAS_SEMANA_NUM = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_SEMANA_FORM = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

/** Converte dia selecionado no form (Segunda=0) para backend (1=Seg) */
const formIndexToBackendDia = (idx: number): number => (idx === 6 ? 0 : idx + 1);
/** Converte backend dia (1=Seg) para índice no form */
const backendDiaToFormIndex = (dia: number): number => (dia === 0 ? 6 : dia - 1);

interface Turma {
  id: string;
  nome: string;
  ano: number;
  semestre?: number | string;
  turno?: string;
  curso_id?: string;
  cursos?: { id: string; nome: string };
}

interface PlanoEnsino {
  id: string;
  disciplinaId: string;
  professorId: string;
  disciplina?: { nome: string };
  professor?: { user?: { nomeCompleto?: string } };
}

interface Horario {
  id: string;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  sala?: string;
  status?: string;
  disciplina?: { nome: string };
  professor?: { user?: { nomeCompleto?: string } };
  turma?: { nome: string };
}

export const HorariosTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { isSecundario } = useInstituicao();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const printRef = useRef<HTMLDivElement>(null);
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [editingHorario, setEditingHorario] = useState<Horario | null>(null);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [formData, setFormData] = useState({
    dia_semana: '',
    hora_inicio: '',
    hora_fim: '',
    plano_ensino_id: '',
    sala: ''
  });

  const labels = { turma: isSecundario ? 'Classe' : 'Turma' };

  const { data: turmas = [], isLoading: turmasLoading } = useQuery({
    queryKey: ['admin-turmas-horarios', instituicaoId],
    queryFn: async () => {
      const r = await turmasApi.getAll({ instituicaoId: instituicaoId || undefined });
      return Array.isArray(r) ? r : (r?.data || []);
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const selectedTurmaData = turmas.find((t: Turma) => t.id === selectedTurma);

  const { data: planosRaw = [], isLoading: planosLoading } = useQuery({
    queryKey: ['planos-por-turma', selectedTurma],
    queryFn: async () => {
      const r = await planoEnsinoApi.getAll({ turmaId: selectedTurma });
      return Array.isArray(r) ? r : [r];
    },
    enabled: !!selectedTurma,
  });

  const planos = Array.isArray(planosRaw) ? planosRaw : [planosRaw];

  const { data: horariosResponse, isLoading: horariosLoading } = useQuery({
    queryKey: ['turma-horarios', selectedTurma],
    queryFn: () => horariosApi.getAll({ turmaId: selectedTurma, page: 1, pageSize: 200 }),
    enabled: !!selectedTurma,
  });

  const horarios: Horario[] = Array.isArray(horariosResponse)
    ? horariosResponse
    : (horariosResponse?.data || []);

  const createHorarioMutation = useSafeMutation({
    mutationFn: async (data: { planoEnsinoId: string; turmaId: string; diaSemana: number; horaInicio: string; horaFim: string; sala?: string }) => {
      await horariosApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-horarios'] });
      toast.success('Horário adicionado com sucesso!');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao adicionar horário');
    },
  });

  const updateHorarioMutation = useSafeMutation({
    mutationFn: async ({ id, ...data }: { id: string; diaSemana?: number; horaInicio?: string; horaFim?: string; sala?: string }) => {
      await horariosApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-horarios'] });
      toast.success('Horário atualizado!');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar');
    },
  });

  const deleteHorarioMutation = useSafeMutation({
    mutationFn: (id: string) => horariosApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-horarios'] });
      toast.success('Horário excluído');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Apenas horários em rascunho podem ser excluídos');
    },
  });

  const aprovarMutation = useSafeMutation({
    mutationFn: (id: string) => horariosApi.aprovar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-horarios'] });
      toast.success('Horário aprovado');
    },
  });

  const resetForm = () => {
    setFormData({ dia_semana: '', hora_inicio: '', hora_fim: '', plano_ensino_id: '', sala: '' });
    setEditingHorario(null);
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dia_semana || !formData.hora_inicio || !formData.hora_fim) {
      toast.error('Preencha dia, hora início e hora fim');
      return;
    }
    if (!editingHorario && !formData.plano_ensino_id) {
      toast.error('Selecione o Plano de Ensino (Disciplina - Professor)');
      return;
    }

    const idx = DIAS_SEMANA_FORM.indexOf(formData.dia_semana);
    const diaSemana = formIndexToBackendDia(idx >= 0 ? idx : 0);

    if (editingHorario) {
      updateHorarioMutation.mutate({
        id: editingHorario.id,
        diaSemana,
        horaInicio: formData.hora_inicio,
        horaFim: formData.hora_fim,
        sala: formData.sala || undefined,
      });
    } else {
      createHorarioMutation.mutate({
        planoEnsinoId: formData.plano_ensino_id,
        turmaId: selectedTurma,
        diaSemana,
        horaInicio: formData.hora_inicio,
        horaFim: formData.hora_fim,
        sala: formData.sala || undefined,
      });
    }
  };

  const handleEdit = (horario: Horario) => {
    const idx = backendDiaToFormIndex(horario.diaSemana ?? 1);
    setFormData({
      dia_semana: DIAS_SEMANA_FORM[idx] ?? 'Segunda-feira',
      hora_inicio: (horario.horaInicio || horario.hora_inicio || '').slice(0, 5),
      hora_fim: (horario.horaFim || horario.hora_fim || '').slice(0, 5),
      plano_ensino_id: '',
      sala: horario.sala || '',
    });
    setEditingHorario(horario);
    setDialogOpen(true);
  };

  const getDiaBadgeColor = (dia: string) => {
    const c: Record<string, string> = {
      'Segunda-feira': 'bg-blue-500', 'Terça-feira': 'bg-green-500', 'Quarta-feira': 'bg-yellow-500',
      'Quinta-feira': 'bg-purple-500', 'Sexta-feira': 'bg-pink-500', 'Sábado': 'bg-orange-500', 'Domingo': 'bg-red-500',
    };
    return c[dia] || 'bg-gray-500';
  };

  const horariosByDay = DIAS_SEMANA_NUM.reduce((acc, dia) => {
    acc[dia] = horarios.filter((h: Horario) => {
      const d = h.diaSemana ?? (h as any).dia_semana;
      const diaNum = typeof d === 'number' ? d : parseInt(String(d), 10);
      return DIAS_SEMANA_NUM[diaNum] === dia;
    });
    return acc;
  }, {} as Record<string, Horario[]>);

  const [loadingPrint, setLoadingPrint] = useState(false);
  const handlePrint = async () => {
    if (!selectedTurma) return;
    setLoadingPrint(true);
    try {
      const blob = await horariosApi.imprimirTurma(selectedTurma);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.open(url, '_blank');
      toast.success('Horário aberto em nova aba');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao imprimir');
    } finally {
      setLoadingPrint(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Selecione a {labels.turma}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {turmasLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : turmas.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma {labels.turma.toLowerCase()} cadastrada.</p>
          ) : (
            <Select value={selectedTurma} onValueChange={setSelectedTurma}>
              <SelectTrigger className="w-full md:w-[400px]">
                <SelectValue placeholder="Selecione uma opção..." />
              </SelectTrigger>
              <SelectContent>
                {turmas.map((turma: Turma) => (
                  <SelectItem key={turma.id} value={turma.id}>
                    {turma.nome} - {turma.cursos?.nome} ({isSecundario ? turma.ano : `${turma.semestre ?? '-'}/${turma.ano}`})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedTurma && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Grade Horária
                </CardTitle>
                <CardDescription>Gerencie os horários da turma (Plano de Ensino obrigatório)</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {horarios.length > 0 && (
                  <Button variant="outline" onClick={handlePrint} disabled={loadingPrint}>
                    {loadingPrint ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
                    Imprimir Horário
                  </Button>
                )}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={resetForm}>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Horário
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingHorario ? 'Editar Horário' : 'Adicionar Horário'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Dia da Semana *</Label>
                        <Select value={formData.dia_semana} onValueChange={(v) => setFormData((p) => ({ ...p, dia_semana: v }))}>
                          <SelectTrigger><SelectValue placeholder="Selecione o dia" /></SelectTrigger>
                          <SelectContent>
                            {DIAS_SEMANA_FORM.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Hora Início *</Label>
                          <Input type="time" value={formData.hora_inicio} onChange={(e) => setFormData((p) => ({ ...p, hora_inicio: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Hora Fim *</Label>
                          <Input type="time" value={formData.hora_fim} onChange={(e) => setFormData((p) => ({ ...p, hora_fim: e.target.value }))} required />
                        </div>
                      </div>
                      {!editingHorario && (
                        <div className="space-y-2">
                          <Label>Plano de Ensino (Disciplina - Professor) *</Label>
                          <Select value={formData.plano_ensino_id} onValueChange={(v) => setFormData((p) => ({ ...p, plano_ensino_id: v }))}>
                            <SelectTrigger><SelectValue placeholder="Selecione disciplina e professor" /></SelectTrigger>
                            <SelectContent>
                              {planosLoading ? (
                                <SelectItem value="_">Carregando...</SelectItem>
                              ) : planos.length === 0 ? (
                                <SelectItem value="_" disabled>Nenhum plano vinculado a esta turma</SelectItem>
                              ) : (
                                planos.map((plano: PlanoEnsino) => (
                                  <SelectItem key={plano.id} value={plano.id}>
                                    {plano.disciplina?.nome ?? 'Disciplina'} - {plano.professor?.user?.nomeCompleto ?? 'Professor'}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Sala</Label>
                        <Input value={formData.sala} onChange={(e) => setFormData((p) => ({ ...p, sala: e.target.value }))} placeholder="Ex: A101" />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                        <Button type="submit" disabled={createHorarioMutation.isPending || updateHorarioMutation.isPending}>
                          {(createHorarioMutation.isPending || updateHorarioMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          {editingHorario ? 'Atualizar' : 'Adicionar'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {horariosLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : horarios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum horário cadastrado. Cadastre planos de ensino na turma e adicione horários.</p>
              </div>
            ) : (
              <div className="space-y-4" ref={printRef}>
                {DIAS_SEMANA_NUM.map((dia) => {
                  const diaHorarios = horariosByDay[dia] || [];
                  if (diaHorarios.length === 0) return null;
                  return (
                    <div key={dia} className="space-y-2">
                      <Badge className={getDiaBadgeColor(dia)}>{dia}</Badge>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Horário</TableHead>
                              <TableHead>Disciplina</TableHead>
                              <TableHead>Professor</TableHead>
                              <TableHead>Sala</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {[...diaHorarios].sort((a, b) => (a.horaInicio || a.hora_inicio || '').localeCompare(b.horaInicio || b.hora_fim || '')).map((h: Horario) => (
                              <TableRow key={h.id}>
                                <TableCell>{(h.horaInicio || (h as any).hora_inicio || '').slice(0, 5)} - {(h.horaFim || (h as any).hora_fim || '').slice(0, 5)}</TableCell>
                                <TableCell>{h.disciplina?.nome || (h as any).disciplinas?.nome || '-'}</TableCell>
                                <TableCell>{h.professor?.user?.nomeCompleto || '-'}</TableCell>
                                <TableCell>{h.sala || '-'}</TableCell>
                                <TableCell>
                                  {h.status === 'APROVADO' ? (
                                    <Badge variant="default" className="bg-green-600">Aprovado</Badge>
                                  ) : h.status === 'INATIVO' ? (
                                    <Badge variant="secondary">Inativo</Badge>
                                  ) : (
                                    <Badge variant="outline">Rascunho</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    {h.status === 'RASCUNHO' && (
                                      <Button variant="ghost" size="icon" onClick={() => aprovarMutation.mutate(h.id)} disabled={aprovarMutation.isPending} title="Aprovar">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(h)}><Edit className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={h.status !== 'RASCUNHO'} title={h.status !== 'RASCUNHO' ? 'Apenas rascunhos podem ser excluídos' : 'Excluir'}>
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Excluir horário?</AlertDialogTitle>
                                          <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteHorarioMutation.mutate(h.id)}>Excluir</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
