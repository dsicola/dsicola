import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Clock, BookOpen, Users } from 'lucide-react';
import { matriculasApi, horariosApi } from '@/services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function HorariosAluno() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Fetch matriculas ativas do aluno
  const { data: matriculas = [], isLoading: matriculasLoading } = useQuery({
    queryKey: ['aluno-matriculas-horarios', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const data = await matriculasApi.getAll({ alunoId: user.id });
      return (data || []).filter((m: any) => m.status === 'Ativa' || m.status === 'ativa');
    },
    enabled: !!user?.id
  });

  // Fetch horários de todas as turmas do aluno
  const { data: horarios = [], isLoading: horariosLoading } = useQuery({
    queryKey: ['aluno-horarios-completos', user?.id, matriculas],
    queryFn: async () => {
      const turmaIds = matriculas.map((m: any) => m.turmaId || m.turma_id).filter(Boolean);
      if (turmaIds.length === 0) return [];

      const allHorarios = await Promise.all(
        turmaIds.map((id: string) => horariosApi.getAll({ turmaId: id }))
      );

      return allHorarios.flat();
    },
    enabled: matriculas.length > 0
  });

  const isLoading = matriculasLoading || horariosLoading;

  // Organizar horários por dia da semana
  const diasSemana = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
    'Domingo'
  ];

  const horariosPorDia = diasSemana.map(dia => ({
    dia,
    horarios: horarios.filter((h: any) => 
      (h.diaSemana === dia || h.dia_semana === dia)
    ).sort((a: any, b: any) => {
      const horaA = a.horaInicio || a.hora_inicio || '';
      const horaB = b.horaInicio || b.hora_inicio || '';
      return horaA.localeCompare(horaB);
    })
  })).filter(dia => dia.horarios.length > 0);

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
          <h1 className="text-2xl font-bold">{t('pages.meusHorarios')}</h1>
          <p className="text-muted-foreground">
            {t('pages.meusHorariosDesc')}
          </p>
        </div>

        {matriculas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Você não possui turmas matriculadas no momento.
              </p>
            </CardContent>
          </Card>
        ) : horariosPorDia.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Nenhum horário cadastrado para suas turmas.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {horariosPorDia.map(({ dia, horarios }) => (
              <Card key={dia}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {dia}
                  </CardTitle>
                  <CardDescription>
                    {horarios.length} {horarios.length === 1 ? 'aula' : 'aulas'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {horarios.map((horario: any) => (
                      <div
                        key={horario.id}
                        className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">
                                {horario.horaInicio || horario.hora_inicio || '--:--'}
                                {' - '}
                                {horario.horaFim || horario.hora_fim || '--:--'}
                              </span>
                            </div>
                            {horario.disciplina && (
                              <div className="flex items-center gap-2 mb-1">
                                <BookOpen className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {horario.disciplina.nome || 'Disciplina'}
                                </span>
                              </div>
                            )}
                            {horario.turma && (
                              <div className="flex items-center gap-2 mb-1">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  {horario.turma.nome || 'Turma'}
                                </span>
                              </div>
                            )}
                            {horario.sala && (
                              <div className="mt-2">
                                <Badge variant="outline" className="text-xs">
                                  Sala: {horario.sala}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Resumo das turmas */}
        {matriculas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Minhas Turmas</CardTitle>
              <CardDescription>Turmas com horários cadastrados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {matriculas.map((matricula: any) => (
                  <div
                    key={matricula.id}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <p className="font-medium">{matricula.turma?.nome || 'Turma'}</p>
                    <p className="text-sm text-muted-foreground">
                      {matricula.turma?.curso?.nome || matricula.turma?.classe?.nome || 'Curso'}
                    </p>
                    <Badge variant="default" className="mt-2">
                      {matricula.status === 'Ativa' ? 'Ativa' : matricula.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

