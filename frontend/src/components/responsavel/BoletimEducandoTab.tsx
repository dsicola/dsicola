import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { matriculasAnuaisApi } from '@/services/api';
import { BoletimVisualizacao } from '@/components/relatorios/BoletimVisualizacao';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen } from 'lucide-react';

export function BoletimEducandoTab({ alunoId }: { alunoId: string }) {
  const { t } = useTranslation();
  const [anoSelecionado, setAnoSelecionado] = useState<number | null>(null);

  const { data: matriculasAnuais = [], isLoading } = useQuery({
    queryKey: ['responsavel-boletim-anos', alunoId],
    queryFn: () => matriculasAnuaisApi.getByAluno(alunoId) as Promise<Array<{ anoLetivo?: number }>>,
    enabled: !!alunoId,
  });

  useEffect(() => {
    if (matriculasAnuais.length > 0 && anoSelecionado === null) {
      const anos = matriculasAnuais
        .map((m) => m.anoLetivo)
        .filter((n): n is number => typeof n === 'number' && !Number.isNaN(n));
      if (anos.length > 0) {
        setAnoSelecionado(Math.max(...anos));
      }
    }
  }, [matriculasAnuais, anoSelecionado]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('pages.carregando')}</p>;
  }

  if (matriculasAnuais.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground text-center">
            {t('pages.responsavel.boletim.empty')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Label htmlFor="ano-boletim-educando" className="font-medium shrink-0">
          {t('pages.responsavel.boletim.yearLabel')}
        </Label>
        <Select
          value={anoSelecionado?.toString() ?? ''}
          onValueChange={(v) => setAnoSelecionado(v ? Number(v) : null)}
        >
          <SelectTrigger id="ano-boletim-educando" className="w-full sm:w-[220px]">
            <SelectValue placeholder={t('pages.responsavel.boletim.yearPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {[...matriculasAnuais]
              .filter((m) => typeof m.anoLetivo === 'number')
              .sort((a, b) => (b.anoLetivo ?? 0) - (a.anoLetivo ?? 0))
              .map((m, idx) => (
                <SelectItem
                  key={`${(m as { id?: string }).id ?? idx}-${m.anoLetivo}`}
                  value={String(m.anoLetivo)}
                >
                  {m.anoLetivo}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      {anoSelecionado != null ? (
        <BoletimVisualizacao alunoId={alunoId} anoLetivo={anoSelecionado} />
      ) : null}
    </div>
  );
}
