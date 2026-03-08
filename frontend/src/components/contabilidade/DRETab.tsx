import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contabilidadeApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
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
import { TrendingUp, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type DRERow = {
  conta: { codigo: string; descricao: string; tipo: string };
  debito: number;
  credito: number;
  valor: number;
};

export const DRETab = () => {
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: dre, isLoading } = useQuery({
    queryKey: ['dre', instituicaoId, dataInicio, dataFim],
    queryFn: () => contabilidadeApi.getDRE({ dataInicio, dataFim }),
    enabled: (!!instituicaoId || isSuperAdmin) && !!dataInicio && !!dataFim,
  });

  const formatarValor = (v: number) =>
    new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const handlePrint = () => window.print();

  const renderSecao = (titulo: string, linhas: DRERow[], total: number) => (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm">{titulo}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Código</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="text-right w-32">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground text-center py-4">
                Nenhuma conta
              </TableCell>
            </TableRow>
          ) : (
            linhas.map((c) => (
              <TableRow key={c.conta.codigo + c.conta.descricao}>
                <TableCell className="font-mono">{c.conta.codigo}</TableCell>
                <TableCell>{c.conta.descricao}</TableCell>
                <TableCell className="text-right font-medium">{formatarValor(c.valor)}</TableCell>
              </TableRow>
            ))
          )}
          {linhas.length > 0 && (
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell colSpan={2}>Total {titulo}</TableCell>
              <TableCell className="text-right">{formatarValor(total)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            DRE — Demonstração do Resultado do Exercício
          </CardTitle>
          <CardDescription>
            Receitas, Despesas e Resultado do período. Mostra se a instituição teve lucro ou prejuízo.
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
        ) : !dre ? (
          <div className="py-8 text-center text-muted-foreground">
            Selecione o período e altere as datas se necessário.
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Período: {format(new Date(dre.dataInicio), 'dd/MM/yyyy', { locale: ptBR })} a{' '}
              {format(new Date(dre.dataFim), 'dd/MM/yyyy', { locale: ptBR })}
            </p>

            <div className="space-y-6">
              {renderSecao('Receitas', dre.receitas || [], dre.totalReceitas || 0)}
              {renderSecao('Despesas', dre.despesas || [], dre.totalDespesas || 0)}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <div className="text-right space-y-1">
                <p className="text-sm text-muted-foreground">Resultado do Período</p>
                <p
                  className={`text-xl font-bold ${
                    (dre.resultado ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatarValor(dre.resultado ?? 0)}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
