import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { contabilidadeApi, saftExportsApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileSpreadsheet, FileText, Download, Loader2, FileCode } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TIPO_LABELS: Record<string, string> = {
  ATIVO: 'Ativo',
  PASSIVO: 'Passivo',
  PATRIMONIO_LIQUIDO: 'Patrimônio Líquido',
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
};

const formatarValor = (v: number) =>
  new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export const ExportacaoContabilistasTab = () => {
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const { instituicao } = useInstituicao();
  const { toast } = useToast();

  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [anoSaft, setAnoSaft] = useState(new Date().getFullYear());
  const [mesSaft, setMesSaft] = useState(new Date().getMonth() + 1);
  const [contaIdRazao, setContaIdRazao] = useState<string>('');

  const [exportando, setExportando] = useState<string | null>(null);

  const { data: contas = [] } = useQuery({
    queryKey: ['plano-contas', instituicaoId],
    queryFn: () => contabilidadeApi.listPlanoContas({ incluirInativos: false }),
    enabled: !!instituicaoId,
  });

  const nomeInstituicao = instituicao?.nome || 'Instituição';
  const dataExportacao = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const exportarExcel = (titulo: string, colunas: string[], dados: unknown[][]) => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      [nomeInstituicao],
      [titulo],
      [`Exportado em: ${dataExportacao}`],
      [],
      colunas,
      ...dados,
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = colunas.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    const filename = `${titulo.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const handleExportPlanoContas = async () => {
    if (!instituicaoId) {
      toast({ variant: 'destructive', title: 'Selecione uma instituição no contexto para exportar' });
      return;
    }
    setExportando('plano');
    try {
      const contas = await contabilidadeApi.listPlanoContas({ incluirInativos: true, instituicaoId: instituicaoId! });
      const colunas = ['Código', 'Descrição', 'Tipo', 'Nível', 'Conta Pai'];
      const dados = (contas || []).map((c: { codigo: string; descricao: string; tipo: string; nivel: number; contaPai?: { codigo: string } }) => [
        c.codigo,
        c.descricao,
        TIPO_LABELS[c.tipo] || c.tipo,
        c.nivel,
        c.contaPai?.codigo || '-',
      ]);
      exportarExcel('Plano de Contas', colunas, dados);
      toast({ title: 'Plano de Contas exportado com sucesso' });
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erro ao exportar', description: (err as Error)?.message });
    } finally {
      setExportando(null);
    }
  };

  const handleExportLancamentos = async () => {
    if (!instituicaoId) {
      toast({ variant: 'destructive', title: 'Selecione uma instituição no contexto para exportar' });
      return;
    }
    setExportando('lancamentos');
    try {
      const lancamentos = await contabilidadeApi.listLancamentos({ dataInicio, dataFim, instituicaoId: instituicaoId! });
      const linhas: unknown[][] = [];
      (lancamentos || []).forEach((l: { numero: string; data: string; descricao: string; linhas: Array<{ conta: { codigo: string; descricao: string }; debito: number; credito: number; descricao?: string }> }) => {
        l.linhas?.forEach((ln) => {
          linhas.push([
            l.numero,
            format(new Date(l.data), 'dd/MM/yyyy', { locale: ptBR }),
            l.descricao,
            ln.conta?.codigo,
            ln.conta?.descricao,
            ln.descricao || '',
            formatarValor(Number(ln.debito)),
            formatarValor(Number(ln.credito)),
          ]);
        });
      });
      const colunas = ['Nº', 'Data', 'Descrição', 'Conta Cód.', 'Conta Desc.', 'Linha Desc.', 'Débito', 'Crédito'];
      exportarExcel(`Lançamentos ${dataInicio} a ${dataFim}`, colunas, linhas);
      toast({ title: 'Lançamentos exportados com sucesso' });
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erro ao exportar', description: (err as Error)?.message });
    } finally {
      setExportando(null);
    }
  };

  const handleExportBalancete = async () => {
    if (!instituicaoId) {
      toast({ variant: 'destructive', title: 'Selecione uma instituição no contexto para exportar' });
      return;
    }
    setExportando('balancete');
    try {
      const balancete = await contabilidadeApi.getBalancete({ dataInicio, dataFim, instituicaoId: instituicaoId! });
      const colunas = ['Código', 'Descrição', 'Tipo', 'Débito', 'Crédito', 'Saldo'];
      const dados = (balancete?.contas || []).map((c: { conta: { codigo: string; descricao: string; tipo: string }; debito: number; credito: number; saldo: number }) => [
        c.conta.codigo,
        c.conta.descricao,
        TIPO_LABELS[c.conta.tipo] || c.conta.tipo,
        formatarValor(c.debito),
        formatarValor(c.credito),
        formatarValor(c.saldo),
      ]);
      exportarExcel(`Balancete ${dataInicio} a ${dataFim}`, colunas, dados);
      toast({ title: 'Balancete exportado com sucesso' });
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erro ao exportar', description: (err as Error)?.message });
    } finally {
      setExportando(null);
    }
  };

  const handleExportBalanco = async () => {
    if (!instituicaoId) {
      toast({ variant: 'destructive', title: 'Selecione uma instituição no contexto para exportar' });
      return;
    }
    setExportando('balanco');
    try {
      const balanco = await contabilidadeApi.getBalanco({ dataFim: dataFim, dataInicio, instituicaoId: instituicaoId! });
      const wb = XLSX.utils.book_new();

      const addSheet = (nome: string, titulo: string, items: Array<{ conta: { codigo: string; descricao: string }; saldoNatural: number }>, total: number) => {
        const dados = [
          [nomeInstituicao],
          [titulo],
          [`Até ${format(new Date(dataFim), 'dd/MM/yyyy', { locale: ptBR })}`],
          [],
          ['Código', 'Descrição', 'Saldo'],
          ...items.map((c) => [c.conta.codigo, c.conta.descricao, formatarValor(c.saldoNatural)]),
          [],
          ['Total', '', formatarValor(total)],
        ];
        const ws = XLSX.utils.aoa_to_sheet(dados);
        XLSX.utils.book_append_sheet(wb, ws, nome);
      };

      addSheet('Ativo', 'Balanço - Ativo', balanco?.ativos || [], balanco?.totalAtivo || 0);
      addSheet('Passivo', 'Balanço - Passivo', balanco?.passivos || [], balanco?.totalPassivo || 0);
      addSheet('PL', 'Patrimônio Líquido', balanco?.patrimonioLiquido || [], balanco?.totalPatrimonioLiquido || 0);

      XLSX.writeFile(wb, `balanco-${dataFim}-${Date.now()}.xlsx`);
      toast({ title: 'Balanço exportado com sucesso' });
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erro ao exportar', description: (err as Error)?.message });
    } finally {
      setExportando(null);
    }
  };

  const handleExportDRE = async () => {
    if (!instituicaoId) {
      toast({ variant: 'destructive', title: 'Selecione uma instituição no contexto para exportar' });
      return;
    }
    setExportando('dre');
    try {
      const dre = await contabilidadeApi.getDRE({ dataInicio, dataFim, instituicaoId: instituicaoId! });
      const colunas = ['Código', 'Descrição', 'Valor'];
      const receitas = (dre?.receitas || []).map((r: { conta: { codigo: string; descricao: string }; valor: number }) => [r.conta.codigo, r.conta.descricao, formatarValor(r.valor)]);
      const despesas = (dre?.despesas || []).map((d: { conta: { codigo: string; descricao: string }; valor: number }) => [d.conta.codigo, d.conta.descricao, formatarValor(d.valor)]);

      const wb = XLSX.utils.book_new();
      const wsRec = XLSX.utils.aoa_to_sheet([
        [nomeInstituicao],
        ['DRE - Receitas'],
        [`Período: ${dataInicio} a ${dataFim}`],
        [],
        colunas,
        ...receitas,
        [],
        ['Total Receitas', '', formatarValor(dre?.totalReceitas || 0)],
      ]);
      const wsDesp = XLSX.utils.aoa_to_sheet([
        [nomeInstituicao],
        ['DRE - Despesas'],
        [`Período: ${dataInicio} a ${dataFim}`],
        [],
        colunas,
        ...despesas,
        [],
        ['Total Despesas', '', formatarValor(dre?.totalDespesas || 0)],
        [],
        ['Resultado do Período', '', formatarValor(dre?.resultado || 0)],
      ]);
      XLSX.utils.book_append_sheet(wb, wsRec, 'Receitas');
      XLSX.utils.book_append_sheet(wb, wsDesp, 'Despesas');
      XLSX.writeFile(wb, `dre-${dataInicio}-${dataFim}-${Date.now()}.xlsx`);
      toast({ title: 'DRE exportada com sucesso' });
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erro ao exportar', description: (err as Error)?.message });
    } finally {
      setExportando(null);
    }
  };

  const handleExportRazao = async () => {
    if (!instituicaoId || !contaIdRazao) {
      toast({ variant: 'destructive', title: 'Selecione uma instituição e uma conta' });
      return;
    }
    setExportando('razao');
    try {
      const razao = await contabilidadeApi.getRazao(contaIdRazao, {
        dataInicio,
        dataFim,
        instituicaoId,
      });
      const colunas = ['Data', 'Nº', 'Descrição', 'Débito', 'Crédito', 'Saldo'];
      const dados: unknown[][] = [
        ['Saldo inicial', '', '', '', '', formatarValor(razao?.saldoInicial || 0)],
        ...(razao?.movimentos || []).map((m: { data: string; numero: string; descricao: string; linhaDescricao?: string; debito: number; credito: number; saldoCorrente: number }) => [
          format(new Date(m.data), 'dd/MM/yyyy', { locale: ptBR }),
          m.numero,
          m.linhaDescricao || m.descricao,
          m.debito > 0 ? formatarValor(m.debito) : '',
          m.credito > 0 ? formatarValor(m.credito) : '',
          formatarValor(m.saldoCorrente),
        ]),
        ['Saldo final', '', '', '', '', formatarValor(razao?.saldoFinal || 0)],
      ];
      const contaLabel = razao?.conta ? `${razao.conta.codigo}-${(razao.conta.descricao || '').slice(0, 20)}` : 'razao';
      exportarExcel(`Razão ${contaLabel}`, colunas, dados);
      toast({ title: 'Razão exportada com sucesso' });
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erro ao exportar', description: (err as Error)?.message });
    } finally {
      setExportando(null);
    }
  };

  const handleExportSAFT = async () => {
    const instId = instituicaoId;
    if (!instId) {
      toast({
        variant: 'destructive',
        title: 'Instituição necessária',
        description: isSuperAdmin ? 'Selecione uma instituição no contexto para exportar SAFT.' : 'Operação requer instituição.',
      });
      return;
    }
    setExportando('saft');
    try {
      const blob = await saftExportsApi.exportXml({
        instituicaoId: instId,
        ano: anoSaft,
        mes: mesSaft,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saft-${nomeInstituicao.replace(/\s+/g, '-')}-${anoSaft}-${String(mesSaft).padStart(2, '0')}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'SAFT-AO exportado com sucesso' });
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erro ao exportar SAFT', description: (err as Error)?.message });
    } finally {
      setExportando(null);
    }
  };

  const ExportButton = ({
    label,
    icon: Icon,
    onClick,
    loadingKey,
    disabled,
  }: {
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    loadingKey: string;
    disabled?: boolean;
  }) => (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled || !!exportando}
      className="w-full sm:w-auto justify-start"
    >
      {exportando === loadingKey ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Icon className="h-4 w-4 mr-2" />
      )}
      {label}
    </Button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Exportação para Contabilistas
        </CardTitle>
        <CardDescription>
          Exporte o plano de contas, lançamentos, balancete, balanço, DRE e SAFT-AO em formatos compatíveis com software contabilístico e Excel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Período para relatórios */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Data início (relatórios)</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Data fim (relatórios)</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>

        {/* Exportações Excel */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Exportações Excel
          </h3>
          <div className="flex flex-wrap gap-2">
            <ExportButton label="Plano de Contas" icon={FileSpreadsheet} onClick={handleExportPlanoContas} loadingKey="plano" disabled={!instituicaoId} />
            <ExportButton label="Lançamentos" icon={FileText} onClick={handleExportLancamentos} loadingKey="lancamentos" disabled={!instituicaoId} />
            <ExportButton label="Balancete" icon={FileText} onClick={handleExportBalancete} loadingKey="balancete" disabled={!instituicaoId} />
            <ExportButton label="Balanço" icon={FileSpreadsheet} onClick={handleExportBalanco} loadingKey="balanco" disabled={!instituicaoId} />
            <ExportButton label="DRE" icon={FileSpreadsheet} onClick={handleExportDRE} loadingKey="dre" disabled={!instituicaoId} />
          </div>
        </div>

        {/* Razão por conta */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Livro Razão (por conta)
          </h3>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={contaIdRazao} onValueChange={setContaIdRazao}>
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
            <ExportButton
              label="Exportar Razão"
              icon={FileText}
              onClick={handleExportRazao}
              loadingKey="razao"
              disabled={!instituicaoId || !contaIdRazao}
            />
          </div>
        </div>

        {/* SAFT-AO */}
        <div className="space-y-3 pt-4 border-t">
          <h3 className="font-semibold flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            SAFT-AO (conformidade fiscal Angola)
          </h3>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input
                type="number"
                value={anoSaft}
                onChange={(e) => setAnoSaft(parseInt(e.target.value, 10) || new Date().getFullYear())}
                className="w-24"
                min={2000}
                max={2100}
              />
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Input
                type="number"
                value={mesSaft}
                onChange={(e) => setMesSaft(Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                className="w-20"
                min={1}
                max={12}
              />
            </div>
            <ExportButton label="Exportar SAFT-AO (XML)" icon={FileCode} onClick={handleExportSAFT} loadingKey="saft" disabled={!instituicaoId} />
          </div>
          <p className="text-sm text-muted-foreground">
            O ficheiro SAFT-AO é gerado a partir dos documentos fiscais (Faturas e Recibos) e está em conformidade com a legislação angolana.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
