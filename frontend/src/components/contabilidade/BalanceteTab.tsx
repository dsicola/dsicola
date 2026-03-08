import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contabilidadeApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useFormatarMoeda } from './useFormatarMoeda';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart3, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TIPO_LABELS: Record<string, string> = {
  ATIVO: 'Ativo',
  PASSIVO: 'Passivo',
  PATRIMONIO_LIQUIDO: 'Patrimônio Líquido',
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
};

export const BalanceteTab = () => {
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const { formatarNumero } = useFormatarMoeda();
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: balancete, isLoading } = useQuery({
    queryKey: ['balancete', instituicaoId, dataInicio, dataFim],
    queryFn: () => contabilidadeApi.getBalancete({ dataInicio, dataFim }),
    enabled: (!!instituicaoId || isSuperAdmin) && !!dataInicio && !!dataFim,
  });

  const handlePrint = () => window.print();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Balancete
          </CardTitle>
          <CardDescription>
            Relatório com débitos, créditos e saldos por conta no período. Use para verificar os movimentos e saldos de cada conta.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="text-sm">De</Label>
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-36" />
          <Label className="text-sm">Até</Label>
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-36" />
          <Button variant="outline" onClick={handlePrint}>
            <Download className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Carregando...</div>
        ) : !balancete ? (
          <div className="py-8 text-center text-muted-foreground">
            Defina o período (De / Até) e aguarde. O balancete será carregado automaticamente.
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Período: {format(new Date(balancete.dataInicio), 'dd/MM/yyyy', { locale: ptBR })} a{' '}
              {format(new Date(balancete.dataFim), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
            {(!balancete.contas || balancete.contas.length === 0) ? (
              <p className="text-muted-foreground">Nenhum movimento no período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balancete.contas.map((c: { conta: { codigo: string; descricao: string; tipo: string }; debito: number; credito: number; saldo: number }) => (
                    <TableRow key={c.conta.codigo + c.conta.descricao}>
                      <TableCell className="font-mono">{c.conta.codigo}</TableCell>
                      <TableCell>{c.conta.descricao}</TableCell>
                      <TableCell>{TIPO_LABELS[c.conta.tipo] || c.conta.tipo}</TableCell>
                      <TableCell className="text-right">{formatarNumero(c.debito)}</TableCell>
                      <TableCell className="text-right">{formatarNumero(c.credito)}</TableCell>
                      <TableCell className="text-right font-medium">{formatarNumero(c.saldo)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {balancete.contas && balancete.contas.length > 0 && (
              <div className="flex justify-end gap-4 pt-4 border-t text-sm">
                <span>Total Débito: {formatarNumero(balancete.totalDebito || 0)}</span>
                <span>Total Crédito: {formatarNumero(balancete.totalCredito || 0)}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
