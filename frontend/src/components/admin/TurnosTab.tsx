import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { turnosApi, campusApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Clock, Loader2, Edit, Trash2, Sun, Sunset, Moon } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const TURNOS_PREDEFINIDOS = [
  { nome: 'Manhã', horaInicio: '07:00', horaFim: '12:00' },
  { nome: 'Tarde', horaInicio: '13:00', horaFim: '18:00' },
  { nome: 'Noite', horaInicio: '18:30', horaFim: '22:00' },
];

interface Turno {
  id: string;
  nome: string;
  horaInicio: string | null;
  horaFim: string | null;
  instituicaoId: string | null;
  campusId?: string | null;
  campus?: { id: string; nome: string } | null;
}

export const TurnosTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { instituicaoId, shouldFilter, isSuperAdmin } = useTenantFilter();
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [editingTurno, setEditingTurno] = useState<Turno | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    horaInicio: '',
    horaFim: '',
    campusId: '' as string,
  });

  const { data: campusList = [] } = useQuery({
    queryKey: ['campus', instituicaoId],
    queryFn: async () => {
      const response = await campusApi.getAll();
      return Array.isArray(response) ? response : response?.data ?? [];
    },
  });

  // Fetch turnos - filtered by instituicao
  const { data: turnos = [], isLoading } = useQuery({
    queryKey: ['turnos', instituicaoId],
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (shouldFilter && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      const response = await turnosApi.getAll(params);
      return Array.isArray(response) ? response : (response?.data || []);
    }
  });

  const createTurnoMutation = useSafeMutation({
    mutationFn: async (data: any) => {
      await turnosApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos'] });
      toast.success('Turno cadastrado com sucesso!');
      // Fechamento explícito após sucesso
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Erro ao cadastrar turno: ' + (error.response?.data?.error || error.message));
    }
  });

  const updateTurnoMutation = useSafeMutation({
    mutationFn: async ({ id, ...data }: any) => {
      await turnosApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos'] });
      toast.success('Turno atualizado com sucesso!');
      // Fechamento explícito após sucesso
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar turno: ' + (error.response?.data?.error || error.message));
    }
  });

  const deleteTurnoMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await turnosApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos'] });
      toast.success('Turno excluído com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir turno: ' + (error.response?.data?.error || error.message));
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      horaInicio: '',
      horaFim: '',
      campusId: '',
    });
    setEditingTurno(null);
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome) {
      toast.error('Preencha o nome do turno');
      return;
    }

    const campusId = formData.campusId?.trim() || null;

    if (editingTurno) {
      updateTurnoMutation.mutate({ 
        id: editingTurno.id, 
        nome: formData.nome,
        horaInicio: formData.horaInicio || null,
        horaFim: formData.horaFim || null,
        campusId,
      });
    } else {
      createTurnoMutation.mutate({
        nome: formData.nome,
        horaInicio: formData.horaInicio || null,
        horaFim: formData.horaFim || null,
        campusId,
      });
    }
  };

  const handleEdit = (turno: Turno) => {
    setFormData({
      nome: turno.nome,
      horaInicio: turno.horaInicio || '',
      horaFim: turno.horaFim || '',
      campusId: (turno as Turno & { campusId?: string }).campusId ?? '',
    });
    setEditingTurno(turno);
    setDialogOpen(true);
  };

  const getTurnoIcon = (nome: string) => {
    const nomeLower = nome.toLowerCase();
    if (nomeLower.includes('manhã') || nomeLower.includes('manha')) {
      return <Sun className="h-4 w-4 text-amber-500" />;
    }
    if (nomeLower.includes('tarde')) {
      return <Sunset className="h-4 w-4 text-orange-500" />;
    }
    if (nomeLower.includes('noite')) {
      return <Moon className="h-4 w-4 text-indigo-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Turnos
              </CardTitle>
              <CardDescription>
                Gerencie os turnos do sistema
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Turno
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTurno ? 'Editar Turno' : 'Cadastrar Novo Turno'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Turno *</Label>
                  <Select
                    value={formData.nome}
                    onValueChange={(value) => {
                      const turnoSelecionado = TURNOS_PREDEFINIDOS.find(t => t.nome === value);
                      setFormData(prev => ({
                        ...prev,
                        nome: value,
                        horaInicio: turnoSelecionado?.horaInicio || prev.horaInicio,
                        horaFim: turnoSelecionado?.horaFim || prev.horaFim
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o turno" />
                    </SelectTrigger>
                    <SelectContent>
                      {TURNOS_PREDEFINIDOS.map((turno) => (
                        <SelectItem key={turno.nome} value={turno.nome}>
                          <div className="flex items-center gap-2">
                            {turno.nome === 'Manhã' && <Sun className="h-4 w-4 text-amber-500" />}
                            {turno.nome === 'Tarde' && <Sunset className="h-4 w-4 text-orange-500" />}
                            {turno.nome === 'Noite' && <Moon className="h-4 w-4 text-indigo-500" />}
                            {turno.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {campusList.length > 0 && (
                  <div className="space-y-2">
                    <Label>Campus (opcional)</Label>
                    <Select
                      value={formData.campusId || '_none'}
                      onValueChange={(v) => setFormData((p) => ({ ...p, campusId: v === '_none' ? '' : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o campus" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Nenhum</SelectItem>
                        {campusList.map((c: { id: string; nome: string }) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hora Início</Label>
                    <Input
                      type="time"
                      value={formData.horaInicio}
                      onChange={(e) => setFormData(prev => ({ ...prev, horaInicio: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora Fim</Label>
                    <Input
                      type="time"
                      value={formData.horaFim}
                      onChange={(e) => setFormData(prev => ({ ...prev, horaFim: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createTurnoMutation.isPending || updateTurnoMutation.isPending}>
                    {(createTurnoMutation.isPending || updateTurnoMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingTurno ? 'Atualizar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : turnos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum turno cadastrado.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Turno</TableHead>
                    <TableHead>Hora Início</TableHead>
                    <TableHead>Hora Fim</TableHead>
                    {campusList.length > 0 && <TableHead>Campus</TableHead>}
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {turnos.map((turno: Turno) => (
                    <TableRow key={turno.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTurnoIcon(turno.nome)}
                          <span className="font-medium">{turno.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell>{turno.horaInicio?.slice(0, 5) || '-'}</TableCell>
                      <TableCell>{turno.horaFim?.slice(0, 5) || '-'}</TableCell>
                      {campusList.length > 0 && (
                        <TableCell>{turno.campus?.nome ?? '-'}</TableCell>
                      )}
                      <TableCell>
                        <TooltipProvider>
                          <div className="flex gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" onClick={() => handleEdit(turno)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                            <AlertDialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button size="icon" variant="ghost" className="text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Excluir</TooltipContent>
                              </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Turno</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o turno "{turno.nome}"?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteTurnoMutation.mutate(turno.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};