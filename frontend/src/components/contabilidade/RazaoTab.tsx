import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contabilidadeApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BookOpen, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TIPO_LABELS: Record<string, string> = {
  ATIVO: 'Ativo',
  PASSIVO: 'Passivo',
  PATRIMONIO_LIQUIDO: 'Patrimônio Líquido',
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
};

export const RazaoTab = () => {
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [contaId, setContaId] = useState<string>('');
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: contas = [] } = useQuery({
    queryKey: ['plano-contas', instituicaoId],
    queryFn: () => contabilidadeApi.listPlanoContas({ incluirInativos: false }),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const { data: razao, isLoading } = useQuery({
    queryKey: ['razao', instituicaoId, contaId, dataInicio, dataFim],
    queryFn: () => contabilidadeApi.getRazao(contaId, { dataInicio, dataFim }),
    enabled: (!!instituicaoId || isSuperAdmin) && !!contaId && !!dataInicio && !!dataFim,
  });

  const formatarValor = (v: number) =>
    new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const handlePrint = () => window.print();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Livro Razão
          </CardTitle>
          <CardDescription>
            Movimentos de uma conta específica, com saldo inicial e saldo corrente. Selecione a conta e o período.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Conta</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {contas.map((c: { id: string; codigo: string; descricao: string }) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.codigo} — {c.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">De</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-36" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Até</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-36" />
          </div>
          <Button variant="outline" onClick={handlePrint}>
            <Download className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!contaId ? (
          <div className="py-8 text-center text-muted-foreground">
            Selecione uma conta para visualizar o Livro Razão.
          </div>
        ) : isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Carregando...</div>
        ) : !razao ? (
          <div className="py-8 text-center text-muted-foreground">
            Nenhum dado para o período selecionado.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                <strong>Conta:</strong> {razao.conta.codigo} — {razao.conta.descricao}
              </span>
              <span>{TIPO_LABELS[razao.conta.tipo] || razao.conta.tipo}</span>
              <span>
                Período: {format(new Date(razao.dataInicio), 'dd/MM/yyyy', { locale: ptBR })} a{' '}
                {format(new Date(razao.dataFim), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Data</TableHead>
                    <TableHead className="w-24">Nº</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right w-28">Débito</TableHead>
                    <TableHead className="text-right w-28">Crédito</TableHead>
                    <TableHead className="text-right w-28">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell colSpan={3}>Saldo inicial</TableCell>
                    <TableCell className="text-right" colSpan={2} />
                    <TableCell className="text-right">{formatarValor(razao.saldoInicial)}</TableCell>
                  </TableRow>
                  {razao.movimentos?.map((m: { data: string; numero: string; descricao: string; linhaDescricao: string | null; debito: number; credito: number; saldoCorrente: number }, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono">{format(new Date(m.data), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="font-mono">{m.numero}</TableCell>
                      <TableCell>{m.linhaDescricao || m.descricao}</TableCell>
                      <TableCell className="text-right">{m.debito > 0 ? formatarValor(m.debito) : ''}</TableCell>
                      <TableCell className="text-right">{m.credito > 0 ? formatarValor(m.credito) : ''}</TableCell>
                      <TableCell className="text-right font-medium">{formatarValor(m.saldoCorrente)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={3}>Saldo final</TableCell>
                    <TableCell className="text-right" colSpan={2} />
                    <TableCell className="text-right">{formatarValor(razao.saldoFinal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
