import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { mensalidadesApi } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, Wallet } from 'lucide-react';
import { format } from 'date-fns';

interface MensalidadeRow {
  id: string;
  status?: string;
  data_vencimento?: string;
  data_pagamento?: string | null;
  valor?: number;
  mes_referencia?: number;
  ano_referencia?: number;
  valor_multa?: number;
  valor_juros?: number;
}

export function MensalidadesEducandoTab({ alunoId }: { alunoId: string }) {
  const { t } = useTranslation();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['responsavel-mensalidades', alunoId],
    queryFn: async () => {
      const raw = await mensalidadesApi.getMensalidadesEducando(alunoId);
      return Array.isArray(raw) ? (raw as MensalidadeRow[]) : [];
    },
    enabled: !!alunoId,
  });

  const formatCurrency = (value: number | undefined) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: 'AOA',
    }).format(Number(value));
  };

  const statusBadge = (status: string | undefined) => {
    switch (status) {
      case 'Pago':
        return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">{status}</Badge>;
      case 'Pendente':
        return <Badge className="bg-yellow-500/10 text-yellow-800 dark:text-yellow-300">{status}</Badge>;
      case 'Atrasado':
        return <Badge variant="destructive">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status ?? '—'}</Badge>;
    }
  };

  const mesNome = (m: number | undefined) => {
    if (!m || m < 1 || m > 12) return '—';
    const meses = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
    ];
    return meses[m - 1];
  };

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
        <AlertTitle>{t('pages.responsavel.mensalidades.loadError')}</AlertTitle>
        <AlertDescription className="pt-2">
          <button type="button" className="underline text-sm" onClick={() => refetch()}>
            {t('pages.responsavel.retry')}
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  const lista = data ?? [];

  if (lista.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            {t('pages.responsavel.mensalidades.title')}
          </CardTitle>
          <CardDescription>{t('pages.responsavel.mensalidades.empty')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5" />
          {t('pages.responsavel.mensalidades.title')}
        </CardTitle>
        <CardDescription>{t('pages.responsavel.mensalidades.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('pages.responsavel.mensalidades.colRef')}</TableHead>
              <TableHead>{t('pages.responsavel.mensalidades.colDue')}</TableHead>
              <TableHead className="text-right">{t('pages.responsavel.mensalidades.colAmount')}</TableHead>
              <TableHead>{t('pages.responsavel.mensalidades.colStatus')}</TableHead>
              <TableHead>{t('pages.responsavel.mensalidades.colPaid')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {mesNome(row.mes_referencia)} / {row.ano_referencia ?? '—'}
                </TableCell>
                <TableCell>
                  {row.data_vencimento
                    ? format(new Date(row.data_vencimento), 'dd/MM/yyyy')
                    : '—'}
                </TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(row.valor)}</TableCell>
                <TableCell>{statusBadge(row.status)}</TableCell>
                <TableCell>
                  {row.data_pagamento
                    ? format(new Date(row.data_pagamento), 'dd/MM/yyyy')
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
