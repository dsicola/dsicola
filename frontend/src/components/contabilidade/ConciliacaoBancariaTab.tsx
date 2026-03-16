import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { contabilidadeApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useFormatarMoeda } from '@/components/contabilidade/useFormatarMoeda';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Plus, Upload, Link2, Unlink, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const ConciliacaoBancariaTab = () => {
  const queryClient = useQueryClient();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const { formatar } = useFormatarMoeda();
  const [contaSelecionada, setContaSelecionada] = useState<string>('');
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [showNovaConta, setShowNovaConta] = useSafeDialog(false);
  const [showImport, setShowImport] = useSafeDialog(false);
  const [showConciliar, setShowConciliar] = useSafeDialog(false);
  const [movimentoParaConciliar, setMovimentoParaConciliar] = useState<{
    id: string;
    data: string;
    valor: number;
    descricao?: string | null;
  } | null>(null);
  const [lancamentoSelecionado, setLancamentoSelecionado] = useState<string>('');
  const [formConta, setFormConta] = useState({
    nome: '',
    ibanOuNumero: '',
    banco: '',
    contaContabilId: '',
  });
  const [importText, setImportText] = useState('');

  const scopeParams = isSuperAdmin && instituicaoId ? { instituicaoId } : {};

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-bancarias', instituicaoId],
    queryFn: () => contabilidadeApi.listContasBancarias({ incluirInativos: true, ...scopeParams }),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const { data: contasPlano = [] } = useQuery({
    queryKey: ['plano-contas', instituicaoId],
    queryFn: () => contabilidadeApi.listPlanoContas({ incluirInativos: false, ...scopeParams }),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const { data: movimentos = [], isLoading: loadingMovimentos } = useQuery({
    queryKey: ['movimentos-extrato', contaSelecionada, dataInicio, dataFim],
    queryFn: () =>
      contabilidadeApi.listMovimentosExtrato(contaSelecionada, {
        dataInicio,
        dataFim,
      }),
    enabled: !!contaSelecionada,
  });

  const { data: resumo } = useQuery({
    queryKey: ['resumo-conciliacao', contaSelecionada, dataFim],
    queryFn: () =>
      contabilidadeApi.getResumoConciliacao(contaSelecionada, { dataFim }),
    enabled: !!contaSelecionada,
  });

  const { data: lancamentos = [] } = useQuery({
    queryKey: ['lancamentos', instituicaoId, dataInicio, dataFim],
    queryFn: () => contabilidadeApi.listLancamentos({ dataInicio, dataFim, ...scopeParams }),
    enabled: !!instituicaoId && showConciliar,
  });

  const createContaMutation = useSafeMutation({
    mutationFn: (data: { nome: string; ibanOuNumero?: string; banco?: string; contaContabilId?: string }) =>
      contabilidadeApi.createContaBancaria({
        nome: data.nome,
        ibanOuNumero: data.ibanOuNumero || null,
        banco: data.banco || null,
        contaContabilId: data.contaContabilId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-bancarias'] });
      toast.success('Conta bancária criada');
      setShowNovaConta(false);
      setFormConta({ nome: '', ibanOuNumero: '', banco: '', contaContabilId: '' });
    },
    onError: (e: unknown) =>
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao criar'),
  });

  const importMutation = useSafeMutation({
    mutationFn: (movimentos: Array<{ data: string; valor: number; descricao?: string; referenciaExterna?: string }>) =>
      contabilidadeApi.importarMovimentosExtrato(contaSelecionada, movimentos),
    onSuccess: (data: { importados: number; erros: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ['movimentos-extrato'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-conciliacao'] });
      if (data.importados > 0) toast.success(`${data.importados} movimento(s) importado(s)`);
      if (data.erros?.length) toast.warning(`${data.erros.length} erro(s) na importação`);
      setShowImport(false);
      setImportText('');
    },
    onError: (e: unknown) =>
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao importar'),
  });

  const conciliarMutation = useSafeMutation({
    mutationFn: ({ movimentoId, lancamentoContabilId }: { movimentoId: string; lancamentoContabilId: string }) =>
      contabilidadeApi.conciliarMovimento(movimentoId, lancamentoContabilId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimentos-extrato'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-conciliacao'] });
      toast.success('Movimento conciliado');
      setShowConciliar(false);
      setMovimentoParaConciliar(null);
      setLancamentoSelecionado('');
    },
    onError: (e: unknown) =>
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao conciliar'),
  });

  const desconciliarMutation = useSafeMutation({
    mutationFn: (movimentoId: string) => contabilidadeApi.desconciliarMovimento(movimentoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimentos-extrato'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-conciliacao'] });
      toast.success('Movimento desconciliado');
    },
    onError: (e: unknown) =>
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao desconciliar'),
  });

  const parseAndImport = () => {
    const lines = importText.trim().split(/\r?\n/).filter(Boolean);
    const movs: Array<{ data: string; valor: number; descricao?: string; referenciaExterna?: string }> = [];
    for (const line of lines) {
      const parts = line.split(/[;\t,]/).map((p) => p.trim());
      if (parts.length < 2) continue;
      const data = parts[0];
      const valor = parseFloat(String(parts[1]).replace(',', '.')) || 0;
      const descricao = parts[2] || undefined;
      const ref = parts[3] || undefined;
      movs.push({ data, valor, descricao, referenciaExterna: ref });
    }
    if (movs.length === 0) {
      toast.error('Formato: data;valor;descricao;referencia (separados por ; ou , ou tab)');
      return;
    }
    importMutation.mutate(movs);
  };

  const handleConciliar = () => {
    if (!movimentoParaConciliar || !lancamentoSelecionado) {
      toast.error('Selecione o lançamento contábil');
      return;
    }
    conciliarMutation.mutate({
      movimentoId: movimentoParaConciliar.id,
      lancamentoContabilId: lancamentoSelecionado,
    });
  };

  const abrirConciliar = (m: { id: string; data: string; valor: number; descricao?: string | null }) => {
    setMovimentoParaConciliar(m);
    setLancamentoSelecionado('');
    setShowConciliar(true);
  };

  if (contas.length === 0 && !showNovaConta) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Conciliação Bancária
          </CardTitle>
          <CardDescription>
            Configure contas bancárias para importar extratos e conciliar com lançamentos contábeis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              Nenhuma conta bancária configurada. Crie a primeira para começar.
            </p>
            <Button onClick={() => setShowNovaConta(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova conta bancária
            </Button>
          </div>
        </CardContent>
        <Dialog open={showNovaConta} onOpenChange={setShowNovaConta}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova conta bancária</DialogTitle>
              <DialogDescription>
                Configure a conta para importar extratos e conciliar com o plano de contas.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={formConta.nome}
                  onChange={(e) => setFormConta({ ...formConta, nome: e.target.value })}
                  placeholder="Ex: Banco BFA - Conta Principal"
                />
              </div>
              <div>
                <Label>IBAN ou Número da conta</Label>
                <Input
                  value={formConta.ibanOuNumero}
                  onChange={(e) => setFormConta({ ...formConta, ibanOuNumero: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <Label>Banco</Label>
                <Input
                  value={formConta.banco}
                  onChange={(e) => setFormConta({ ...formConta, banco: e.target.value })}
                  placeholder="Ex: BFA, BAI"
                />
              </div>
              <div>
                <Label>Conta contábil (Plano de contas)</Label>
                <Select value={formConta.contaContabilId} onValueChange={(v) => setFormConta({ ...formConta, contaContabilId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta (ex: 12 Bancos)" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasPlano
                      .filter((c: { tipo: string }) => c.tipo === 'ATIVO')
                      .map((c: { id: string; codigo: string; descricao: string }) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.codigo} - {c.descricao}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNovaConta(false)}>Cancelar</Button>
              <Button
                onClick={() => createContaMutation.mutate(formConta)}
                disabled={!formConta.nome.trim() || createContaMutation.isPending}
              >
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Conciliação Bancária
          </CardTitle>
          <CardDescription>
            Importe extratos bancários e concilie movimentos com lançamentos contábeis. Rastreabilidade e auditoria para instituições de ensino.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecione a conta" />
            </SelectTrigger>
            <SelectContent>
              {contas.map((c: { id: string; nome: string; banco?: string | null }) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome} {c.banco ? `(${c.banco})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label className="text-sm">De</Label>
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-36" />
          <Label className="text-sm">Até</Label>
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-36" />
          {contaSelecionada && (
            <>
              <Button variant="outline" onClick={() => setShowImport(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar extrato
              </Button>
              <Button variant="outline" onClick={() => setShowNovaConta(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova conta
              </Button>
            </>
          )}
        </div>
      </CardHeader>

      {resumo && contaSelecionada && (
        <CardContent className="border-b bg-muted/30">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Saldo extrato</p>
              <p className="font-semibold">{formatar(resumo.saldoExtrato)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo contábil</p>
              <p className="font-semibold">{formatar(resumo.saldoContabil)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Diferença</p>
              <p className={`font-semibold ${Math.abs(resumo.diferenca) < 0.01 ? 'text-green-600' : 'text-destructive'}`}>
                {formatar(resumo.diferenca)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              {resumo.conciliado ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Conciliado
                </Badge>
              ) : (
                <Badge variant="destructive" className="bg-destructive/10">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Pendente
                </Badge>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Movimentos pendentes</p>
              <p className="font-semibold">{resumo.movimentosPendentes}</p>
            </div>
          </div>
        </CardContent>
      )}

      <CardContent>
        {!contaSelecionada ? (
          <div className="py-8 text-center text-muted-foreground">
            Selecione uma conta bancária para ver os movimentos.
          </div>
        ) : loadingMovimentos ? (
          <div className="py-8 text-center text-muted-foreground">Carregando...</div>
        ) : movimentos.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Nenhum movimento no período. Importe o extrato bancário.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Lançamento</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentos.map((m: {
                id: string;
                data: string;
                valor: number;
                descricao?: string | null;
                referenciaExterna?: string | null;
                conciliado: boolean;
                lancamento?: { id: string; numero: string; descricao: string } | null;
              }) => (
                <TableRow key={m.id}>
                  <TableCell>{format(new Date(m.data), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                  <TableCell className={Number(m.valor) >= 0 ? 'text-green-600' : 'text-destructive'}>
                    {formatar(Number(m.valor))}
                  </TableCell>
                  <TableCell>{m.descricao || '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.referenciaExterna || '—'}</TableCell>
                  <TableCell>
                    {m.conciliado && m.lancamento ? (
                      <Badge variant="outline" className="font-mono">{m.lancamento.numero}</Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {m.conciliado ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => desconciliarMutation.mutate(m.id)}
                        disabled={desconciliarMutation.isPending}
                      >
                        <Unlink className="h-4 w-4" title="Desconciliar" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirConciliar(m)}
                        title="Conciliar com lançamento"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Dialog Nova Conta */}
      <Dialog open={showNovaConta} onOpenChange={setShowNovaConta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conta bancária</DialogTitle>
            <DialogDescription>
              Configure a conta para importar extratos e conciliar com o plano de contas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={formConta.nome}
                onChange={(e) => setFormConta({ ...formConta, nome: e.target.value })}
                placeholder="Ex: Banco BFA - Conta Principal"
              />
            </div>
            <div>
              <Label>IBAN ou Número da conta</Label>
              <Input
                value={formConta.ibanOuNumero}
                onChange={(e) => setFormConta({ ...formConta, ibanOuNumero: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div>
              <Label>Banco</Label>
              <Input
                value={formConta.banco}
                onChange={(e) => setFormConta({ ...formConta, banco: e.target.value })}
                placeholder="Ex: BFA, BAI"
              />
            </div>
            <div>
              <Label>Conta contábil (Plano de contas)</Label>
              <Select value={formConta.contaContabilId} onValueChange={(v) => setFormConta({ ...formConta, contaContabilId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta (ex: 12 Bancos)" />
                </SelectTrigger>
                <SelectContent>
                  {contasPlano
                    .filter((c: { tipo: string }) => c.tipo === 'ATIVO')
                    .map((c: { id: string; codigo: string; descricao: string }) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} - {c.descricao}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNovaConta(false)}>Cancelar</Button>
            <Button
              onClick={() => createContaMutation.mutate(formConta)}
              disabled={!formConta.nome.trim() || createContaMutation.isPending}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Importar */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar extrato bancário</DialogTitle>
            <DialogDescription>
              Formato: data;valor;descricao;referencia — Um movimento por linha. Valor positivo = entrada, negativo = saída.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="2026-03-15;15000;Transferência recebida;TRF-123&#10;2026-03-16;-5000;Pagamento fornecedor;CHQ-001"
            className="w-full h-40 p-2 font-mono text-sm border rounded-md"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Cancelar</Button>
            <Button onClick={parseAndImport} disabled={importMutation.isPending || !importText.trim()}>
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Conciliar */}
      <Dialog open={showConciliar} onOpenChange={setShowConciliar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conciliar movimento</DialogTitle>
            <DialogDescription>
              {movimentoParaConciliar && (
                <>
                  Movimento: {format(new Date(movimentoParaConciliar.data), 'dd/MM/yyyy', { locale: ptBR })} — {formatar(movimentoParaConciliar.valor)}
                  {movimentoParaConciliar.descricao && ` — ${movimentoParaConciliar.descricao}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Selecione o lançamento contábil correspondente</Label>
            <Select value={lancamentoSelecionado} onValueChange={setLancamentoSelecionado}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Lançamento" />
              </SelectTrigger>
              <SelectContent>
                {lancamentos.map((l: { id: string; numero: string; data: string; descricao: string }) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.numero} — {format(new Date(l.data), 'dd/MM/yyyy', { locale: ptBR })} — {l.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConciliar(false)}>Cancelar</Button>
            <Button onClick={handleConciliar} disabled={!lancamentoSelecionado || conciliarMutation.isPending}>
              Conciliar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
