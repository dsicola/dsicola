import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { eventosApi } from '@/services/api';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/hooks/use-toast';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, CalendarDays, Trash2, Edit, Clock, Loader2 } from 'lucide-react';
import { WorkflowStatusBadge } from '@/components/workflow/WorkflowStatusBadge';
import { WorkflowActions } from '@/components/workflow/WorkflowActions';
import { useRolePermissions } from '@/hooks/useRolePermissions';

interface Evento {
  id: string;
  titulo: string;
  descricao: string | null;
  dataInicio: string;
  dataFim: string | null;
  horaInicio: string | null;
  horaFim: string | null;
  tipo: string;
  cor: string;
  status?: string;
  instituicaoId: string | null;
}

const tiposEvento = [
  { value: 'evento', label: 'Evento', cor: '#3b82f6' },
  { value: 'feriado', label: 'Feriado', cor: '#ef4444' },
  { value: 'prova', label: 'Prova/Exame', cor: '#f59e0b' },
  { value: 'reuniao', label: 'Reunião', cor: '#8b5cf6' },
  { value: 'ferias', label: 'Férias', cor: '#10b981' },
  { value: 'matricula', label: 'Período Matrícula', cor: '#06b6d4' },
  { value: 'aula_inaugural', label: 'Aula Inaugural', cor: '#ec4899' },
];

export const CalendarioAcademicoTab: React.FC = () => {
  const { instituicaoId } = useTenantFilter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { calendario, isSecretaria, messages } = useRolePermissions();
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    dataInicio: '',
    dataFim: '',
    horaInicio: '',
    horaFim: '',
    tipo: 'evento',
    cor: '#3b82f6',
  });

  const { data: eventos = [], isLoading, error } = useQuery({
    queryKey: ['eventos-calendario', currentMonth],
    queryFn: async () => {
      try {
        // NÃO enviar instituicaoId - backend pega do JWT
        const data = await eventosApi.getAll({});
        // Filter by month on client side since API may not support date range
        const startDate = startOfMonth(currentMonth);
        const endDate = endOfMonth(currentMonth);
        return (data as Evento[]).filter(evento => {
          const eventoDate = parseISO(evento.dataInicio);
          return eventoDate >= startDate && eventoDate <= endDate;
        });
      } catch (err) {
        console.error('Erro ao carregar eventos:', err);
        throw err;
      }
    },
    enabled: !!user, // Executar apenas quando usuário estiver autenticado
  });

  const createMutation = useSafeMutation({
    mutationFn: async (data: typeof formData) => {
      // NÃO enviar instituicaoId - vem do JWT no backend
      return await eventosApi.create({
        titulo: data.titulo,
        descricao: data.descricao || undefined,
        dataInicio: data.dataInicio,
        dataFim: data.dataFim || undefined,
        horaInicio: data.horaInicio || undefined,
        horaFim: data.horaFim || undefined,
        tipo: data.tipo,
        cor: data.cor,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventos-calendario'] });
      queryClient.invalidateQueries({ queryKey: ['eventos-calendario-check'] });
      toast({ title: 'Evento criado com sucesso!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao criar evento', variant: 'destructive' });
    },
  });

  const updateMutation = useSafeMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      await eventosApi.update(id, {
        titulo: data.titulo,
        descricao: data.descricao || undefined,
        dataInicio: data.dataInicio,
        dataFim: data.dataFim || undefined,
        horaInicio: data.horaInicio || undefined,
        horaFim: data.horaFim || undefined,
        tipo: data.tipo,
        cor: data.cor,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventos-calendario'] });
      queryClient.invalidateQueries({ queryKey: ['eventos-calendario-check'] });
      toast({ title: 'Evento atualizado!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    },
  });

  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await eventosApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventos-calendario'] });
      queryClient.invalidateQueries({ queryKey: ['eventos-calendario-check'] });
      toast({ title: 'Evento excluído!' });
    },
    onError: () => {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      titulo: '',
      descricao: '',
      dataInicio: '',
      dataFim: '',
      horaInicio: '',
      horaFim: '',
      tipo: 'evento',
      cor: '#3b82f6',
    });
    setEditingEvento(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (evento: Evento) => {
    setEditingEvento(evento);
    const validTipo = evento.tipo && evento.tipo !== '' 
      ? evento.tipo 
      : 'evento';
    const tipoConfig = tiposEvento.find(t => t.value === validTipo);
    setFormData({
      titulo: evento.titulo,
      descricao: evento.descricao || '',
      dataInicio: evento.dataInicio,
      dataFim: evento.dataFim || '',
      horaInicio: evento.horaInicio || '',
      horaFim: evento.horaFim || '',
      tipo: validTipo,
      cor: evento.cor || tipoConfig?.cor || '#3b82f6',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEvento) {
      updateMutation.mutate({ id: editingEvento.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getEventosForDate = (date: Date) => {
    return eventos.filter(evento => {
      const eventoDate = parseISO(evento.dataInicio);
      return isSameDay(eventoDate, date);
    });
  };

  const selectedDateEventos = getEventosForDate(selectedDate);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Calendário Académico</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Gerencie eventos, feriados e períodos letivos</p>
          {isSecretaria && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {messages.secretariaCannotEditCalendar}
            </p>
          )}
        </div>
        {calendario.canCreate && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setFormData(f => ({ ...f, dataInicio: format(selectedDate, 'yyyy-MM-dd') })); }} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Novo Evento
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEvento ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Início *</Label>
                  <Input
                    type="date"
                    value={formData.dataInicio}
                    onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={formData.dataFim}
                    onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hora Início</Label>
                  <Input
                    type="time"
                    value={formData.horaInicio}
                    onChange={(e) => setFormData({ ...formData, horaInicio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora Fim</Label>
                  <Input
                    type="time"
                    value={formData.horaFim}
                    onChange={(e) => setFormData({ ...formData, horaFim: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={formData.tipo || 'evento'}
                    onValueChange={(value) => {
                      if (!value || value === '') return;
                      const tipo = tiposEvento.find(t => t.value === value);
                      setFormData({ ...formData, tipo: value, cor: tipo?.cor || '#3b82f6' });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de evento" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposEvento
                        .filter((tipo) => tipo.value && tipo.value !== '' && tipo.value !== null && tipo.value !== undefined)
                        .map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tipo.cor }} />
                              {tipo.label}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <Input
                    type="color"
                    value={formData.cor}
                    onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                    className="h-10 p-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                {calendario.canCreate && (
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="w-full sm:w-auto">
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingEvento ? 'Atualizar' : 'Criar'}
                  </Button>
                )}
              </div>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Calendário */}
        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={ptBR}
              className="rounded-md border p-2 sm:p-3"
              modifiers={{
                hasEvent: (date) => getEventosForDate(date).length > 0,
              }}
              modifiersStyles={{
                hasEvent: {
                  fontWeight: 'bold',
                  textDecoration: 'underline',
                  color: 'hsl(var(--primary))',
                },
              }}
            />
          </CardContent>
        </Card>

        {/* Eventos do dia selecionado */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">
              {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-3 sm:p-6">
            {selectedDateEventos.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum evento neste dia
              </p>
            ) : (
              selectedDateEventos.map((evento) => (
                <div
                  key={evento.id}
                  className="p-3 rounded-lg border-l-4"
                  style={{ borderLeftColor: evento.cor }}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm sm:text-base break-words">{evento.titulo}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {tiposEvento.find(t => t.value === evento.tipo)?.label || evento.tipo}
                          </Badge>
                          {evento.status && (
                            <WorkflowStatusBadge status={evento.status as any} />
                          )}
                        </div>
                        {evento.horaInicio && (
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            <span className="break-words">{evento.horaInicio}{evento.horaFim && ` - ${evento.horaFim}`}</span>
                          </p>
                        )}
                        {evento.descricao && (
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">{evento.descricao}</p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {calendario.canEdit && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleEdit(evento)}
                            disabled={evento.status === 'SUBMETIDO' || evento.status === 'BLOQUEADO'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {calendario.canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(evento.id)}
                            disabled={deleteMutation.isPending || evento.status === 'BLOQUEADO'}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {evento.status && (
                      <WorkflowActions
                        entidade="EventoCalendario"
                        entidadeId={evento.id}
                        statusAtual={evento.status as any}
                        onStatusChange={() => {
                          queryClient.invalidateQueries({ queryKey: ['eventos-calendario'] });
                        }}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lista de eventos do mês */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Eventos de {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm sm:text-base text-destructive mb-2">
                Erro ao carregar eventos
              </p>
              <p className="text-xs text-muted-foreground">
                Tente recarregar a página
              </p>
            </div>
          ) : eventos.length === 0 ? (
            <p className="text-sm sm:text-base text-muted-foreground text-center py-8">
              Nenhum evento neste mês
            </p>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {eventos.map((evento) => (
                <div
                  key={evento.id}
                  className="p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
                  style={{ borderLeftWidth: '4px', borderLeftColor: evento.cor }}
                  onClick={() => {
                    setSelectedDate(parseISO(evento.dataInicio));
                    if (calendario.canEdit) {
                      handleEdit(evento);
                    } else {
                      // Apenas visualizar para SECRETARIA
                      toast({
                        title: 'Ação não permitida',
                        description: messages.secretariaCannotEditCalendar,
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base break-words">{evento.titulo}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {format(parseISO(evento.dataInicio), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      style={{ backgroundColor: `${evento.cor}20`, color: evento.cor }}
                      className="text-xs flex-shrink-0"
                    >
                      {tiposEvento.find(t => t.value === evento.tipo)?.label}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};