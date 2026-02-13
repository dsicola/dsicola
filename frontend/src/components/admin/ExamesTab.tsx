import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { turmasApi, turnosApi, examesApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, FileCheck, Loader2, Edit, Trash2, Calendar, Sun, Sunset, Moon, Clock, Filter } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Turma {
  id: string;
  nome: string;
  ano: number;
  semestre: string;
  cursos?: { nome: string };
  profiles?: { nome_completo: string };
}

interface Turno {
  id: string;
  nome: string;
  hora_inicio?: string;
  hora_fim?: string;
}

interface Exame {
  id: string;
  nome: string;
  tipo: string;
  data_exame: string;
  hora_inicio?: string;
  hora_fim?: string;
  sala?: string;
  observacoes?: string;
  status: string;
  turmas?: { nome: string; cursos?: { nome: string } };
}

export const ExamesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const { isSecundario } = useInstituicao();
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [editingExame, setEditingExame] = useState<Exame | null>(null);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [filterTurno, setFilterTurno] = useState<string>('all');
  const [formData, setFormData] = useState({
    nome: '',
    tipo: '1ª Prova',
    data_exame: '',
    hora_inicio: '',
    hora_fim: '',
    turno: '',
    observacoes: '',
    status: 'Agendado'
  });

  const labels = {
    turma: isSecundario ? 'Classe' : 'Turma',
  };

  // Fetch turmas
  const { data: turmas = [], isLoading: turmasLoading } = useQuery({
    queryKey: ['admin-turmas-exames', instituicaoId],
    queryFn: async () => {
      const response = await turmasApi.getAll({ instituicaoId: instituicaoId || undefined });
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  // Fetch turnos
  const { data: turnos = [], isLoading: turnosLoading } = useQuery({
    queryKey: ['turnos-ativos', instituicaoId],
    queryFn: async () => {
      const response = await turnosApi.getAll({ instituicaoId: instituicaoId || undefined, ativo: true });
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  // Fetch exames
  const { data: exames = [], isLoading: examesLoading } = useQuery({
    queryKey: ['turma-exames', selectedTurma],
    queryFn: async () => {
      const response = await examesApi.getAll({ turmaId: selectedTurma });
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!selectedTurma
  });

  const createExameMutation = useSafeMutation({
    mutationFn: async (data: { nome: string; turmaId: string; dataExame: string; tipo?: string; horaInicio?: string; horaFim?: string; sala?: string; observacoes?: string }) => {
      await examesApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-exames'] });
      toast.success('Exame agendado com sucesso!');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Erro ao agendar exame: ' + error.message);
    }
  });

  const updateExameMutation = useSafeMutation({
    mutationFn: async ({ id, ...data }: { id: string; nome?: string; dataExame?: string; tipo?: string; horaInicio?: string; horaFim?: string; sala?: string; observacoes?: string; status?: string }) => {
      await examesApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-exames'] });
      toast.success('Exame atualizado com sucesso!');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar exame: ' + error.message);
    }
  });

  const deleteExameMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await examesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-exames'] });
      toast.success('Exame excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir exame: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      tipo: '1ª Prova',
      data_exame: '',
      hora_inicio: '',
      hora_fim: '',
      turno: '',
      observacoes: '',
      status: 'Agendado'
    });
    setEditingExame(null);
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.data_exame) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const payload = {
      turmaId: selectedTurma,
      nome: formData.nome,
      tipo: formData.tipo,
      dataExame: formData.data_exame,
      horaInicio: formData.hora_inicio || undefined,
      horaFim: formData.hora_fim || undefined,
      sala: formData.turno || undefined,
      observacoes: formData.observacoes || undefined,
    };

    if (editingExame) {
      updateExameMutation.mutate({ id: editingExame.id, ...payload, status: formData.status });
    } else {
      createExameMutation.mutate(payload);
    }
  };

  const handleEdit = (exame: Exame) => {
    setFormData({
      nome: exame.nome,
      tipo: exame.tipo,
      data_exame: exame.data_exame,
      hora_inicio: exame.hora_inicio || '',
      hora_fim: exame.hora_fim || '',
      turno: exame.sala || '',
      observacoes: exame.observacoes || '',
      status: exame.status
    });
    setEditingExame(exame);
    setDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Agendado':
        return <Badge variant="secondary">Agendado</Badge>;
      case 'Em andamento':
        return <Badge className="bg-blue-500">Em andamento</Badge>;
      case 'Concluído':
        return <Badge className="bg-green-500">Concluído</Badge>;
      case 'Cancelado':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTurnoBadge = (turnoNome: string) => {
    if (!turnoNome) return <span className="text-muted-foreground">-</span>;
    
    const nomeLower = turnoNome.toLowerCase();
    let Icon = Clock;
    let colorClass = 'bg-gray-500';
    
    if (nomeLower.includes('manhã') || nomeLower.includes('manha')) {
      Icon = Sun;
      colorClass = 'bg-amber-500';
    } else if (nomeLower.includes('tarde')) {
      Icon = Sunset;
      colorClass = 'bg-orange-500';
    } else if (nomeLower.includes('noite')) {
      Icon = Moon;
      colorClass = 'bg-indigo-500';
    }
    
    return (
      <Badge className={colorClass}>
        <Icon className="h-3 w-3 mr-1" />
        {turnoNome}
      </Badge>
    );
  };

  const filteredExames = filterTurno === 'all' 
    ? exames 
    : exames.filter((e: Exame) => e.sala === filterTurno);

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
                  <FileCheck className="h-5 w-5 text-primary" />
                  Exames Agendados
                </CardTitle>
                <CardDescription>
                  Gerencie os exames da turma selecionada
                </CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => resetForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agendar Exame
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingExame ? 'Editar Exame' : 'Agendar Novo Exame'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome do Exame *</Label>
                      <Input
                        value={formData.nome}
                        onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                        placeholder="Ex: Prova de Matemática"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo *</Label>
                        <Select 
                          value={formData.tipo} 
                          onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1ª Prova">1ª Prova</SelectItem>
                            <SelectItem value="2ª Prova">2ª Prova</SelectItem>
                            <SelectItem value="3ª Prova">3ª Prova</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Turno</Label>
                        <Select 
                          value={formData.turno} 
                          onValueChange={(v) => setFormData(prev => ({ ...prev, turno: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={turnosLoading ? "Carregando..." : "Selecione o turno"} />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            {turnos.map((turno: Turno) => (
                              <SelectItem key={turno.id} value={turno.nome}>
                                {turno.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data *</Label>
                        <Input
                          type="date"
                          value={formData.data_exame}
                          onChange={(e) => setFormData(prev => ({ ...prev, data_exame: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select 
                          value={formData.status} 
                          onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Agendado">Agendado</SelectItem>
                            <SelectItem value="Em andamento">Em andamento</SelectItem>
                            <SelectItem value="Concluído">Concluído</SelectItem>
                            <SelectItem value="Cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Hora Início</Label>
                        <Input
                          type="time"
                          value={formData.hora_inicio}
                          onChange={(e) => setFormData(prev => ({ ...prev, hora_inicio: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Hora Fim</Label>
                        <Input
                          type="time"
                          value={formData.hora_fim}
                          onChange={(e) => setFormData(prev => ({ ...prev, hora_fim: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Observações</Label>
                      <Textarea
                        value={formData.observacoes}
                        onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                        placeholder="Observações adicionais..."
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createExameMutation.isPending || updateExameMutation.isPending}>
                        {(createExameMutation.isPending || updateExameMutation.isPending) && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        {editingExame ? 'Atualizar' : 'Agendar'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            {/* Filter by Turno */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterTurno} onValueChange={setFilterTurno}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por turno" />
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
            </div>
          </CardHeader>
          <CardContent>
            {examesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredExames.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum exame agendado.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Turno</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExames.map((exame: Exame) => (
                    <TableRow key={exame.id}>
                      <TableCell className="font-medium">{exame.nome}</TableCell>
                      <TableCell>{exame.tipo}</TableCell>
                      <TableCell>
                        {new Date(exame.data_exame).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        {exame.hora_inicio && exame.hora_fim 
                          ? `${exame.hora_inicio.slice(0, 5)} - ${exame.hora_fim.slice(0, 5)}`
                          : '-'}
                      </TableCell>
                      <TableCell>{getTurnoBadge(exame.sala || '')}</TableCell>
                      <TableCell>{getStatusBadge(exame.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(exame)}>
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
                                <AlertDialogTitle>Excluir exame?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Essa ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteExameMutation.mutate(exame.id)}>
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
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};