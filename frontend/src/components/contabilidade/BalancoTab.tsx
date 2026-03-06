import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contabilidadeApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Scale, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type BalancoRow = {
  conta: { codigo: string; descricao: string; tipo: string };
  debito: number;
  credito: number;
  saldoNatural: number;
};

export const BalancoTab = () => {
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setMonth(0);
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });

  const { data: balanco, isLoading } = useQuery({
    queryKey: ['balanco', instituicaoId, dataInicio, dataFim],
    queryFn: () => contabilidadeApi.getBalanco({ dataFim, dataInicio }),
    enabled: (!!instituicaoId || isSuperAdmin) && !!dataFim,
  });

  const formatarValor = (v: number) =>
    new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const handlePrint = () => window.print();

  const renderSecao = (titulo: string, linhas: BalancoRow[], total: number) => (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm">{titulo}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Código</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="text-right w-32">Saldo</TableHead>
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
                <TableCell className="text-right font-medium">{formatarValor(c.saldoNatural)}</TableCell>
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
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Balanço Patrimonial
        </CardTitle>
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
        ) : !balanco ? (
          <div className="py-8 text-center text-muted-foreground">
            Selecione a data de corte e altere o período se necessário.
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Saldos até {format(new Date(balanco.dataFim), 'dd/MM/yyyy', { locale: ptBR })}
              {balanco.dataInicio && (
                <> (desde {format(new Date(balanco.dataInicio), 'dd/MM/yyyy', { locale: ptBR })})</>
              )}
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                {renderSecao('Ativo', balanco.ativos || [], balanco.totalAtivo || 0)}
              </div>
              <div>
                {renderSecao('Passivo', balanco.passivos || [], balanco.totalPassivo || 0)}
                {renderSecao('Patrimônio Líquido', balanco.patrimonioLiquido || [], balanco.totalPatrimonioLiquido || 0)}
              </div>
            </div>

            <div className="flex justify-end gap-6 pt-4 border-t text-sm font-medium">
              <span>Total Ativo: {formatarValor(balanco.totalAtivo || 0)}</span>
              <span>Total Passivo + PL: {formatarValor(balanco.totalPassivoMaisPL || 0)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
