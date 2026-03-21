/**
 * Meus Horários - Professor
 * Exibe a grade horária do professor (apenas próprios horários).
 * Multi-tenant: professorId e instituicaoId vêm do token; não aceita parâmetros de URL.
 * Funciona para ambos os tipos de instituição (Secundário e Superior).
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AnoLetivoContextHeader } from '@/components/dashboard/AnoLetivoContextHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Calendar, Clock, BookOpen, Users, FileDown, AlertCircle } from 'lucide-react';
import { horariosApi } from '@/services/api';
import { toast } from 'sonner';

const DIAS_SEMANA: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
};

export default function HorariosProfessor() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const professorId = (user as any)?.professorId as string | undefined;

  const { data: gradeData, isLoading, error, refetch } = useQuery({
    queryKey: ['professor-grade-horarios', professorId],
    queryFn: async () => {
      if (!professorId) throw new Error('Perfil de professor não disponível.');
      return horariosApi.getGradeProfessor(professorId);
    },
    enabled: !!professorId,
    retry: (failureCount, err: any) => {
      if ([400, 401, 403, 404].includes(err?.response?.status ?? 0)) return false;
      return failureCount < 2;
    },
  });

  const professor = gradeData?.professor;
  /** Oficiais (aprovados) primeiro; depois provisórios; dentro do dia, por hora de início */
  const horarios = useMemo(() => {
    const raw = gradeData?.horarios ?? [];
    return [...raw].sort((a: any, b: any) => {
      const pa = a.status === 'APROVADO' ? 0 : 1;
      const pb = b.status === 'APROVADO' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const diaA = a.diaSemana ?? a.dia_semana ?? 0;
      const diaB = b.diaSemana ?? b.dia_semana ?? 0;
      if (diaA !== diaB) return diaA - diaB;
      const horaA = a.horaInicio ?? a.hora_inicio ?? '';
      const horaB = b.horaInicio ?? b.hora_inicio ?? '';
      return String(horaA).localeCompare(String(horaB));
    });
  }, [gradeData?.horarios]);

  const totalOficial = useMemo(() => horarios.filter((h: any) => h.status === 'APROVADO').length, [horarios]);
  const totalProvisorio = useMemo(() => horarios.filter((h: any) => h.status === 'RASCUNHO').length, [horarios]);
  const temProvisorio = totalProvisorio > 0;

  const horariosPorDia = useMemo(() => {
    const dias = [1, 2, 3, 4, 5, 6, 0]; // Seg–Sáb, Dom por último
    return dias.map((dia) => ({
      dia,
      nome: DIAS_SEMANA[dia] ?? `Dia ${dia}`,
      horarios: horarios
        .filter((h: any) => (h.diaSemana ?? h.dia_semana) === dia)
        .sort((a: any, b: any) => {
          const pa = a.status === 'APROVADO' ? 0 : 1;
          const pb = b.status === 'APROVADO' ? 0 : 1;
          if (pa !== pb) return pa - pb;
          const horaA = a.horaInicio ?? a.hora_inicio ?? '';
          const horaB = b.horaInicio ?? b.hora_inicio ?? '';
          return String(horaA).localeCompare(String(horaB));
        }),
    })).filter((d) => d.horarios.length > 0);
  }, [horarios]);

  const handleImprimir = async () => {
    if (!professorId) {
      toast.error(t('professor.scheduleNotAvailable') ?? 'Perfil de professor não disponível.');
      return;
    }
    try {
      const blob = await horariosApi.imprimirProfessor(professorId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `horario-professor-${professor?.user?.nomeCompleto?.replace(/\s+/g, '-') ?? 'horario'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('common.success') ?? 'Download iniciado.');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Erro ao gerar PDF.';
      toast.error(msg);
    }
  };

  if (!professorId) {
    return (
      <DashboardLayout>
        <AnoLetivoContextHeader showBannerWhenInactive={false} userRole="PROFESSOR" />
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">{t('pages.meusHorarios')}</h1>
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {t('professor.scheduleNotAvailable') ?? 'Seu perfil de professor não está disponível. Contacte a administração.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <AnoLetivoContextHeader showBannerWhenInactive={false} userRole="PROFESSOR" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    const status = (error as any)?.response?.status;
    const isForbidden = status === 403 || status === 404;
    return (
      <DashboardLayout>
        <AnoLetivoContextHeader showBannerWhenInactive={false} userRole="PROFESSOR" />
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">{t('pages.meusHorarios')}</h1>
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p className="text-muted-foreground mb-4">
                {isForbidden
                  ? (t('professor.scheduleNotAvailable') ?? 'Não foi possível carregar seu horário. Verifique seu vínculo com a instituição.')
                  : (t('common.error') ?? 'Ocorreu um erro ao carregar os dados.')}
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                {t('common.retry') ?? 'Tentar novamente'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <AnoLetivoContextHeader showBannerWhenInactive={false} userRole="PROFESSOR" />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('pages.meusHorarios')}</h1>
            <p className="text-muted-foreground">
              {t('pages.meusHorariosDesc')}
            </p>
          </div>
          <Button onClick={handleImprimir} variant="outline" className="shrink-0">
            <FileDown className="h-4 w-4 mr-2" />
            {t('professor.printSchedule') ?? 'Imprimir horário'}
          </Button>
        </div>

        {temProvisorio && (
          <Alert className="border-amber-200 bg-amber-50/90 dark:bg-amber-950/30 dark:border-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-800 dark:text-amber-400" />
            <AlertTitle className="text-amber-950 dark:text-amber-100">Horário provisório</AlertTitle>
            <AlertDescription className="text-amber-900/90 dark:text-amber-200/90 text-sm">
              Os blocos marcados como «Provisório» ainda não foram aprovados pela secretaria. O quadro oficial passa a
              valer após aprovação; até lá, use-os apenas como referência.
            </AlertDescription>
          </Alert>
        )}

        {horariosPorDia.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {t('professor.noScheduleAssigned') ?? 'Nenhum horário atribuído no momento. Os horários são definidos pela secretaria ou coordenação.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {horariosPorDia.map(({ dia, nome, horarios: hrs }) => (
              <Card key={dia}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {nome}
                  </CardTitle>
                  <CardDescription>
                    {hrs.length} {hrs.length === 1 ? 'aula' : 'aulas'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {hrs.map((h: any) => (
                      <div
                        key={h.id}
                        className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm">
                                {h.horaInicio ?? h.hora_inicio ?? '--:--'}
                                {' – '}
                                {h.horaFim ?? h.hora_fim ?? '--:--'}
                              </span>
                              {h.status === 'APROVADO' ? (
                                <Badge className="text-[10px] h-5 px-1.5 bg-emerald-700 hover:bg-emerald-700 text-white border-0">
                                  Oficial
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 border-amber-300 text-amber-950 dark:text-amber-100">
                                  Provisório
                                </Badge>
                              )}
                            </div>
                            {h.disciplina && (
                              <div className="flex items-center gap-2 mb-1">
                                <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm">
                                  {h.disciplina.nome ?? 'Disciplina'}
                                </span>
                              </div>
                            )}
                            {h.turma && (
                              <div className="flex items-center gap-2 mb-1">
                                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm text-muted-foreground">
                                  {h.turma.nome ?? 'Turma'}
                                </span>
                              </div>
                            )}
                            {h.sala && (
                              <div className="mt-2">
                                <Badge variant="outline" className="text-xs">
                                  Sala: {h.sala}
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

        {professor && horarios.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('professor.summary') ?? 'Resumo'}</CardTitle>
              <CardDescription>
                {professor.user?.nomeCompleto ?? professor.user?.nome_completo ?? 'Professor'} · {horarios.length}{' '}
                {horarios.length === 1 ? 'bloco' : 'blocos'} na semana
                {(totalOficial > 0 || totalProvisorio > 0) && (
                  <span className="block mt-1 text-xs text-muted-foreground">
                    {totalOficial > 0 && (
                      <span>
                        {totalOficial} oficial(is)
                        {totalProvisorio > 0 ? ' · ' : ''}
                      </span>
                    )}
                    {totalProvisorio > 0 && <span>{totalProvisorio} provisório(s)</span>}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
