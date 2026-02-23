import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { eventosApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export default function CalendarioAluno() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const { data: eventos = [], isLoading, error } = useQuery({
    queryKey: ['eventos-calendario-aluno', currentMonth],
    queryFn: async () => {
      try {
        const data = await eventosApi.getAll({});
        // Filter by month on client side
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

  // Get eventos for selected date
  const eventosDoDia = selectedDate
    ? eventos.filter(evento => isSameDay(parseISO(evento.dataInicio), selectedDate))
    : [];

  // Get eventos for calendar dates
  const eventosPorData = eventos.reduce((acc, evento) => {
    const data = format(parseISO(evento.dataInicio), 'yyyy-MM-dd');
    if (!acc[data]) {
      acc[data] = [];
    }
    acc[data].push(evento);
    return acc;
  }, {} as Record<string, Evento[]>);

  // Custom day renderer to show event indicators
  const dayContent = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const eventosDoDia = eventosPorData[dateKey] || [];
    return (
      <div className="relative">
        <span>{format(date, 'd')}</span>
        {eventosDoDia.length > 0 && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5">
            {eventosDoDia.slice(0, 3).map((evento, idx) => (
              <div
                key={idx}
                className="w-1 h-1 rounded-full"
                style={{ backgroundColor: evento.cor || '#3b82f6' }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('pages.calendarioAcademico')}</h1>
          <p className="text-muted-foreground">
            {t('pages.calendarioAcademicoDesc')}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Calendário</CardTitle>
              <CardDescription>
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="rounded-md border"
                locale={ptBR}
                modifiers={{
                  hasEvent: (date) => {
                    const dateKey = format(date, 'yyyy-MM-dd');
                    return !!eventosPorData[dateKey];
                  },
                }}
                modifiersClassNames={{
                  hasEvent: 'bg-primary/10',
                }}
              />
            </CardContent>
          </Card>

          {/* Eventos do Dia Selecionado */}
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDate
                  ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                  : 'Selecione uma data'}
              </CardTitle>
              <CardDescription>
                {eventosDoDia.length > 0
                  ? `${eventosDoDia.length} evento(s)`
                  : 'Nenhum evento'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eventosDoDia.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum evento agendado para esta data.
                </p>
              ) : (
                <div className="space-y-3">
                  {eventosDoDia.map((evento) => {
                    const tipoInfo = tiposEvento.find(t => t.value === evento.tipo) || tiposEvento[0];
                    return (
                      <div
                        key={evento.id}
                        className="p-3 rounded-lg border"
                        style={{ borderLeftColor: evento.cor || tipoInfo.cor, borderLeftWidth: '4px' }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="font-medium">{evento.titulo}</h4>
                            {evento.descricao && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {evento.descricao}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {evento.horaInicio && (
                                <Badge variant="outline" className="text-xs">
                                  {evento.horaInicio}
                                  {evento.horaFim && ` - ${evento.horaFim}`}
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                style={{ borderColor: evento.cor || tipoInfo.cor }}
                              >
                                {tipoInfo.label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lista de Eventos do Mês */}
        <Card>
          <CardHeader>
            <CardTitle>Eventos do Mês</CardTitle>
            <CardDescription>
              Todos os eventos de {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-sm text-destructive mb-2">
                  Erro ao carregar eventos
                </p>
                <p className="text-xs text-muted-foreground">
                  Tente recarregar a página
                </p>
              </div>
            ) : eventos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum evento agendado para este mês.
              </p>
            ) : (
              <div className="space-y-2">
                {eventos
                  .sort((a, b) => parseISO(a.dataInicio).getTime() - parseISO(b.dataInicio).getTime())
                  .map((evento) => {
                    const tipoInfo = tiposEvento.find(t => t.value === evento.tipo) || tiposEvento[0];
                    return (
                      <div
                        key={evento.id}
                        className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div
                          className="w-2 h-12 rounded"
                          style={{ backgroundColor: evento.cor || tipoInfo.cor }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{evento.titulo}</h4>
                            <Badge
                              variant="outline"
                              style={{ borderColor: evento.cor || tipoInfo.cor }}
                            >
                              {tipoInfo.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {format(parseISO(evento.dataInicio), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            {evento.horaInicio && ` às ${evento.horaInicio}`}
                            {evento.horaFim && ` - ${evento.horaFim}`}
                          </p>
                          {evento.descricao && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {evento.descricao}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

