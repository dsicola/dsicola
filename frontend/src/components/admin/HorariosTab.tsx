import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { turmasApi, disciplinasApi, horariosApi } from '@/services/api';
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
import { Plus, Clock, Loader2, Edit, Trash2, Calendar, Printer, Sun, Sunset, Moon } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useInstituicao } from '@/contexts/InstituicaoContext';

const DIAS_SEMANA = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo'
];

interface Turma {
  id: string;
  nome: string;
  ano: number;
  semestre: string;
  turno?: string;
  curso_id?: string;
  cursos?: { id: string; nome: string };
  profiles?: { nome_completo: string };
}

interface Disciplina {
  id: string;
  nome: string;
}

interface Horario {
  id: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fim: string;
  sala?: string;
  disciplina_id?: string;
  disciplinas?: { nome: string };
}

export const HorariosTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { instituicao, isSecundario } = useInstituicao();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const printRef = useRef<HTMLDivElement>(null);
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [editingHorario, setEditingHorario] = useState<Horario | null>(null);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [formData, setFormData] = useState({
    dia_semana: '',
    hora_inicio: '',
    hora_fim: '',
    turma_destino: '',
    disciplina_id: ''
  });

  const labels = {
    turma: isSecundario ? 'Classe' : 'Turma',
  };

  // Fetch turmas
  const { data: turmas = [], isLoading: turmasLoading } = useQuery({
    queryKey: ['admin-turmas-horarios', instituicaoId],
    queryFn: async () => {
      const response = await turmasApi.getAll({ instituicaoId: instituicaoId || undefined });
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const selectedTurmaData = turmas.find((t: Turma) => t.id === selectedTurma);

  // Fetch disciplinas for the selected turma's course
  const { data: disciplinas = [] } = useQuery({
    queryKey: ['curso-disciplinas', selectedTurmaData?.curso_id],
    queryFn: async () => {
      const response = await disciplinasApi.getAll({ cursoId: selectedTurmaData?.curso_id });
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!selectedTurmaData?.curso_id
  });

  // Fetch horarios for selected turma
  const { data: horarios = [], isLoading: horariosLoading } = useQuery({
    queryKey: ['turma-horarios', selectedTurma],
    queryFn: async () => {
      const response = await horariosApi.getAll({ turmaId: selectedTurma });
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!selectedTurma
  });

  const createHorarioMutation = useSafeMutation({
    mutationFn: async (data: { turmaId: string; disciplinaId?: string; diaSemana: number; horaInicio: string; horaFim: string; sala?: string }) => {
      await horariosApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-horarios'] });
      toast.success('Horário adicionado com sucesso!');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar horário: ' + error.message);
    }
  });

  const updateHorarioMutation = useSafeMutation({
    mutationFn: async ({ id, ...data }: { id: string; disciplinaId?: string; diaSemana?: number; horaInicio?: string; horaFim?: string; sala?: string }) => {
      await horariosApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-horarios'] });
      toast.success('Horário atualizado com sucesso!');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar horário: ' + error.message);
    }
  });

  const deleteHorarioMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await horariosApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-horarios'] });
      toast.success('Horário excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir horário: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      dia_semana: '',
      hora_inicio: '',
      hora_fim: '',
      turma_destino: '',
      disciplina_id: ''
    });
    setEditingHorario(null);
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.dia_semana || !formData.hora_inicio || !formData.hora_fim) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const turmaSelecionada = turmas.find((t: Turma) => t.id === formData.turma_destino);
    const salaNome = turmaSelecionada ? turmaSelecionada.nome : undefined;

    const diaSemanaIndex = DIAS_SEMANA.indexOf(formData.dia_semana);
    const payload = {
      turmaId: selectedTurma,
      diaSemana: diaSemanaIndex >= 0 ? diaSemanaIndex : 0,
      horaInicio: formData.hora_inicio,
      horaFim: formData.hora_fim,
      sala: salaNome,
      disciplinaId: formData.disciplina_id || undefined
    };

    if (editingHorario) {
      updateHorarioMutation.mutate({ id: editingHorario.id, ...payload });
    } else {
      createHorarioMutation.mutate(payload);
    }
  };

  const handleEdit = (horario: Horario) => {
    const turmaEncontrada = turmas.find((t: Turma) => t.nome === horario.sala);
    setFormData({
      dia_semana: horario.dia_semana,
      hora_inicio: horario.hora_inicio,
      hora_fim: horario.hora_fim,
      turma_destino: turmaEncontrada?.id || '',
      disciplina_id: horario.disciplina_id || ''
    });
    setEditingHorario(horario);
    setDialogOpen(true);
  };

  const getDiaBadgeColor = (dia: string) => {
    const colors: Record<string, string> = {
      'Segunda-feira': 'bg-blue-500',
      'Terça-feira': 'bg-green-500',
      'Quarta-feira': 'bg-yellow-500',
      'Quinta-feira': 'bg-purple-500',
      'Sexta-feira': 'bg-pink-500',
      'Sábado': 'bg-orange-500',
      'Domingo': 'bg-red-500'
    };
    return colors[dia] || 'bg-gray-500';
  };

  const horariosByDay = DIAS_SEMANA.reduce((acc, dia) => {
    acc[dia] = horarios.filter((h: Horario) => h.dia_semana === dia);
    return acc;
  }, {} as Record<string, Horario[]>);

  const handlePrint = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Grade Horária - ${selectedTurmaData?.nome}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .institution-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .document-title { font-size: 18px; color: #666; margin-bottom: 10px; }
          .turma-info { font-size: 14px; color: #333; margin-top: 10px; }
          .day-section { margin-bottom: 20px; page-break-inside: avoid; }
          .day-header { background: #f0f0f0; padding: 10px; font-weight: bold; border-left: 4px solid #333; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f5f5f5; font-weight: bold; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="institution-name">${instituicao?.nome || 'Instituição de Ensino'}</div>
          <div class="document-title">GRADE HORÁRIA</div>
          <div class="turma-info">
            <strong>Turma:</strong> ${selectedTurmaData?.nome || '-'} | 
            <strong>Curso:</strong> ${selectedTurmaData?.cursos?.nome || '-'}
          </div>
        </div>
        ${DIAS_SEMANA.map(dia => {
          const diaHorarios = horariosByDay[dia];
          if (diaHorarios.length === 0) return '';
          return `
            <div class="day-section">
              <div class="day-header">${dia}</div>
              <table>
                <thead>
                  <tr>
                    <th>Horário</th>
                    <th>Disciplina</th>
                    <th>Turma</th>
                  </tr>
                </thead>
                <tbody>
                  ${diaHorarios
                    .sort((a: Horario, b: Horario) => a.hora_inicio.localeCompare(b.hora_inicio))
                    .map((h: Horario) => `
                      <tr>
                        <td>${h.hora_inicio.slice(0, 5)} - ${h.hora_fim.slice(0, 5)}</td>
                        <td>${h.disciplinas?.nome || '-'}</td>
                        <td>${h.sala || '-'}</td>
                      </tr>
                    `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }).join('')}
        <div class="footer">
          <p>Documento gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
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
              Carregando {labels.turma.toLowerCase()}s...
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
                    {turma.nome} - {turma.cursos?.nome} ({isSecundario ? turma.ano : `${turma.semestre}/${turma.ano}`})
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
                <CardDescription>
                  Gerencie os horários da turma selecionada
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {horarios.length > 0 && (
                  <Button variant="outline" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                )}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => resetForm()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Horário
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingHorario ? 'Editar Horário' : 'Adicionar Novo Horário'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Dia da Semana *</Label>
                      <Select 
                        value={formData.dia_semana} 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, dia_semana: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o dia" />
                        </SelectTrigger>
                        <SelectContent>
                          {DIAS_SEMANA.map(dia => (
                            <SelectItem key={dia} value={dia}>{dia}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Hora Início *</Label>
                        <Input
                          type="time"
                          value={formData.hora_inicio}
                          onChange={(e) => setFormData(prev => ({ ...prev, hora_inicio: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Hora Fim *</Label>
                        <Input
                          type="time"
                          value={formData.hora_fim}
                          onChange={(e) => setFormData(prev => ({ ...prev, hora_fim: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Disciplina</Label>
                      <Select 
                        value={formData.disciplina_id} 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, disciplina_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a disciplina (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {disciplinas.map((d: Disciplina) => (
                            <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createHorarioMutation.isPending || updateHorarioMutation.isPending}>
                        {(createHorarioMutation.isPending || updateHorarioMutation.isPending) && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
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
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : horarios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum horário cadastrado para esta turma.</p>
              </div>
            ) : (
              <div className="space-y-4" ref={printRef}>
                {DIAS_SEMANA.map(dia => {
                  const diaHorarios = horariosByDay[dia];
                  if (diaHorarios.length === 0) return null;
                  return (
                    <div key={dia} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getDiaBadgeColor(dia)}>{dia}</Badge>
                      </div>
                      <div className="rounded-md border">
                        <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Horário</TableHead>
                            <TableHead>Disciplina</TableHead>
                            <TableHead>Turma</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {diaHorarios
                            .sort((a: Horario, b: Horario) => a.hora_inicio.localeCompare(b.hora_inicio))
                            .map((horario: Horario) => (
                              <TableRow key={horario.id}>
                                <TableCell>
                                  {horario.hora_inicio.slice(0, 5)} - {horario.hora_fim.slice(0, 5)}
                                </TableCell>
                                <TableCell>{horario.disciplinas?.nome || '-'}</TableCell>
                                <TableCell>{horario.sala || '-'}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(horario)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Excluir horário?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Essa ação não pode ser desfeita.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteHorarioMutation.mutate(horario.id)}>
                                            Excluir
                                          </AlertDialogAction>
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