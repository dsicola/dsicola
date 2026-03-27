import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { relatoriosApi } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, History } from 'lucide-react';
import { safeToFixed } from '@/lib/utils';

export function HistoricoEducandoTab({ alunoId }: { alunoId: string }) {
  const { t } = useTranslation();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['responsavel-historico', alunoId],
    queryFn: () => relatoriosApi.getHistoricoEscolar(alunoId),
    enabled: !!alunoId,
    retry: 1,
  });

  const linhas = useMemo(() => {
    const historico = data?.historico;
    if (!Array.isArray(historico)) return [];
    return historico.flatMap((anoLetivoData: Record<string, unknown>) => {
      const ano = (anoLetivoData.anoLetivo as { ano?: number })?.ano ?? 0;
      const disciplinas = (anoLetivoData.disciplinas as unknown[]) ?? [];
      return disciplinas.map((disciplinaData: Record<string, unknown>) => {
        const disciplina = disciplinaData.disciplina as { nome?: string } | undefined;
        const curso = disciplinaData.curso as { nome?: string } | undefined;
        const turma = disciplinaData.turma as { nome?: string } | undefined;
        const notasBloco = disciplinaData.notas as { mediaFinal?: unknown } | undefined;
        const freqBloco = disciplinaData.frequencia as { percentualFrequencia?: unknown } | undefined;
        const sit = disciplinaData.situacaoAcademica as string | undefined;
        const media = notasBloco?.mediaFinal != null ? Number(notasBloco.mediaFinal) : null;
        const freq =
          freqBloco?.percentualFrequencia != null ? Number(freqBloco.percentualFrequencia) : null;
        let status = '—';
        if (sit === 'APROVADO') status = t('pages.responsavel.historico.statusApproved');
        else if (sit === 'REPROVADO_FALTA') status = t('pages.responsavel.historico.statusFailAttendance');
        else if (sit === 'REPROVADO') status = t('pages.responsavel.historico.statusFailGrade');
        else if (sit === 'EM_CURSO') status = t('pages.responsavel.historico.statusInProgress');
        return {
          key: `${ano}-${disciplina?.nome}-${turma?.nome}`,
          ano,
          disciplina: disciplina?.nome ?? '—',
          cursoTurma: [curso?.nome, turma?.nome].filter(Boolean).join(' · ') || '—',
          media,
          freq,
          status,
        };
      });
    });
  }, [data?.historico, t]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('pages.responsavel.historico.loadError')}</AlertTitle>
        <AlertDescription className="pt-2">
          {(error as Error)?.message ?? ''}
          <button
            type="button"
            className="ml-2 underline text-sm"
            onClick={() => refetch()}
          >
            {t('pages.responsavel.retry')}
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  if (linhas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            {t('pages.responsavel.historico.title')}
          </CardTitle>
          <CardDescription>{t('pages.responsavel.historico.empty')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          {t('pages.responsavel.historico.title')}
        </CardTitle>
        <CardDescription>{t('pages.responsavel.historico.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('pages.responsavel.historico.colYear')}</TableHead>
              <TableHead>{t('pages.responsavel.historico.colDiscipline')}</TableHead>
              <TableHead>{t('pages.responsavel.historico.colCourseClass')}</TableHead>
              <TableHead className="text-right">{t('pages.responsavel.historico.colAvg')}</TableHead>
              <TableHead className="text-right">{t('pages.responsavel.historico.colAttendance')}</TableHead>
              <TableHead>{t('pages.responsavel.historico.colStatus')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.ano}</TableCell>
                <TableCell>{row.disciplina}</TableCell>
                <TableCell>{row.cursoTurma}</TableCell>
                <TableCell className="text-right">
                  {row.media != null && Number.isFinite(row.media) ? safeToFixed(row.media, 1) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {row.freq != null && Number.isFinite(row.freq) ? `${safeToFixed(row.freq, 1)}%` : '—'}
                </TableCell>
                <TableCell>{row.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
