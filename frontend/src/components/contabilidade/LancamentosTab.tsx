import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { contabilidadeApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus, Edit, Trash2, Lock, FileText, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Lancamento {
  id: string;
  numero: string;
  data: string;
  descricao: string;
  fechado: boolean;
  linhas?: Array<{
    id: string;
    contaId: string;
    descricao?: string | null;
    debito: number;
    credito: number;
    conta?: { codigo: string; descricao: string };
  }>;
}

export const LancamentosTab = () => {
  const queryClient = useQueryClient();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [showForm, setShowForm] = useSafeDialog(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    descricao: '',
    linhas: [{ contaId: '', debito: 0, credito: 0, descricao: '' }] as Array<{ contaId: string; debito: number; credito: number; descricao?: string }>,
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['plano-contas', instituicaoId],
    queryFn: () => contabilidadeApi.listPlanoContas({ incluirInativos: false }),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ['lancamentos', instituicaoId, dataInicio, dataFim],
    queryFn: () => contabilidadeApi.listLancamentos({ dataInicio, dataFim }),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const { data: bloqueio } = useQuery({
    queryKey: ['bloqueio-periodo', instituicaoId],
    queryFn: () => contabilidadeApi.getBloqueioPeriodo(),
    enabled: !!instituicaoId || isSuperAdmin,
  });
  const dataFimBloqueio = bloqueio?.dataFimBloqueio ? new Date(bloqueio.dataFimBloqueio) : null;
  const isBloqueado = (dataStr: string) => dataFimBloqueio && new Date(dataStr) <= dataFimBloqueio;

  const createMutation = useSafeMutation({
    mutationFn: (data: { data: string; descricao: string; linhas: Array<{ contaId: string; debito: number; credito: number; descricao?: string }> }) =>
      contabilidadeApi.createLancamento({
        ...data,
        linhas: data.linhas.filter((l) => l.contaId && (l.debito > 0 || l.credito > 0)).map((l, i) => ({
          contaId: l.contaId,
          debito: l.debito,
          credito: l.credito,
          descricao: l.descricao || undefined,
          ordem: i,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Lançamento criado');
      setShowForm(false);
      setForm({ data: new Date().toISOString().slice(0, 10), descricao: '', linhas: [{ contaId: '', debito: 0, credito: 0, descricao: '' }] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao criar lançamento'),
  });

  const updateMutation = useSafeMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      contabilidadeApi.updateLancamento(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Lançamento atualizado');
      setShowForm(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao atualizar'),
  });

  const fecharMutation = useSafeMutation({
    mutationFn: (id: string) => contabilidadeApi.fecharLancamento(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Lançamento fechado');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao fechar'),
  });

  const deleteMutation = useSafeMutation({
    mutationFn: (id: string) => contabilidadeApi.deleteLancamento(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Lançamento excluído');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao excluir'),
  });

  const importMutation = useSafeMutation({
    mutationFn: (linhas: Array<{ data: string; contaCodigo: string; descricao?: string; debito: number; credito: number }>) =>
      contabilidadeApi.importarLancamentos(linhas),
    onSuccess: (data: { criados: number; erros: string[]; mensagem: string }) => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      if (data.criados > 0) toast.success(data.mensagem);
      if (data.erros?.length) toast.warning(`${data.erros.length} erro(s): ${data.erros.slice(0, 2).join('; ')}${data.erros.length > 2 ? '...' : ''}`);
      setShowImport(false);
      setImportText('');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao importar'),
  });

  const parseAndImport = () => {
    const lines = importText.trim().split(/\r?\n/).filter(Boolean);
    const linhas: Array<{ data: string; contaCodigo: string; descricao?: string; debito: number; credito: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(/[;\t,]/).map((p) => p.trim());
      if (parts.length < 4) continue;
      const data = parts[0];
      const contaCodigo = parts[1];
      const desc = parts.length >= 5 ? parts[2] : undefined;
      const deb = parts.length >= 5 ? parts[3] : parts[2];
      const cred = parts.length >= 5 ? parts[4] : parts[3];
      const debito = parseFloat(String(deb).replace(',', '.')) || 0;
      const credito = parseFloat(String(cred).replace(',', '.')) || 0;
      linhas.push({ data, contaCodigo, descricao: desc || undefined, debito, credito });
    }
    if (linhas.length === 0) {
      toast.error('Nenhuma linha válida. Formato: data;contaCodigo;descricao;debito;credito (separados por ; ou , ou tab)');
      return;
    }
    importMutation.mutate(linhas);
  };

  const downloadTemplate = () => {
    const template = `2026-03-06;11;Receita mensalidade;1000;0
2026-03-06;41;Receita mensalidade;0;1000`;
    const blob = new Blob([template], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_importacao_lancamentos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const linhasValidas = form.linhas.filter((l) => l.contaId && (l.debito > 0 || l.credito > 0));
  const totalDebito = linhasValidas.reduce((s, l) => s + l.debito, 0);
  const totalCredito = linhasValidas.reduce((s, l) => s + l.credito, 0);
  const balanceado = Math.abs(totalDebito - totalCredito) < 0.01 && linhasValidas.length >= 2;
  const dataBloqueada = !editing && isBloqueado(form.data);

  const handleSubmit = () => {
    if (!form.descricao.trim()) {
      toast.error('Descrição é obrigatória');
      return;
    }
    if (dataBloqueada) {
      toast.error('Não é possível criar lançamentos em exercícios já fechados. Selecione uma data posterior.');
      return;
    }
    if (!balanceado) {
      toast.error('Débito deve ser igual ao crédito e pelo menos 2 linhas');
      return;
    }
    const payload = {
      data: form.data,
      descricao: form.descricao,
      linhas: linhasValidas.map((l, i) => ({
        contaId: l.contaId,
        debito: l.debito,
        credito: l.credito,
        descricao: l.descricao || undefined,
        ordem: i,
      })),
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const addLinha = () => setForm({ ...form, linhas: [...form.linhas, { contaId: '', debito: 0, credito: 0, descricao: '' }] });
  const removeLinha = (i: number) => setForm({ ...form, linhas: form.linhas.filter((_, idx) => idx !== i) });
  const updateLinha = (i: number, f: Record<string, unknown>) => {
    const next = [...form.linhas];
    next[i] = { ...next[i], ...f };
    setForm({ ...form, linhas: next });
  };

  const handleEdit = (l: Lancamento) => {
    if (l.fechado || isBloqueado(l.data)) return;
    setEditing(l);
    setForm({
      data: l.data.slice(0, 10),
      descricao: l.descricao,
      linhas: (l.linhas || []).map((ln) => ({
        contaId: ln.contaId,
        debito: Number(ln.debito),
        credito: Number(ln.credito),
        descricao: ln.descricao || '',
      })),
    });
    setShowForm(true);
  };

  const handleDelete = (l: Lancamento) => {
    if (l.fechado || isBloqueado(l.data)) return;
    if (window.confirm(`Excluir lançamento ${l.numero}?`)) deleteMutation.mutate(l.id);
  };

  const handleFechar = (l: Lancamento) => {
    if (l.fechado || isBloqueado(l.data)) return;
    if (window.confirm(`Fechar lançamento ${l.numero}? Não será mais editável.`)) fecharMutation.mutate(l.id);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Lançamentos Contábeis
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="text-sm">De</Label>
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-36" />
          <Label className="text-sm">Até</Label>
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-36" />
          <Button onClick={() => { setEditing(null); setForm({ data: new Date().toISOString().slice(0, 10), descricao: '', linhas: [{ contaId: '', debito: 0, credito: 0, descricao: '' }] }); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo lançamento
          </Button>
          <Button variant="outline" onClick={() => setShowImport(!showImport)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
        </div>
      </CardHeader>
      {showImport && (
        <CardContent className="border-b bg-muted/30">
          <div className="space-y-2">
            <Label>Importar lançamentos (CSV)</Label>
            <p className="text-sm text-muted-foreground">
              Formato: data;contaCodigo;descricao;debito;credito — Linhas com mesma data+descricao formam um lançamento.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Descarregar modelo
              </Button>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="2026-03-06;11;Receita;1000;0&#10;2026-03-06;41;Receita;0;1000"
              className="w-full h-32 p-2 font-mono text-sm border rounded-md"
            />
            <Button onClick={parseAndImport} disabled={importMutation.isPending || !importText.trim()}>
              Importar
            </Button>
          </div>
        </CardContent>
      )}
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Carregando...</div>
        ) : lancamentos.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Nenhum lançamento no período. Crie um novo lançamento.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[140px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancamentos.map((l: Lancamento) => {
                const bloqueado = isBloqueado(l.data);
                return (
                <TableRow key={l.id}>
                  <TableCell className="font-mono">{l.numero}</TableCell>
                  <TableCell>{format(new Date(l.data), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                  <TableCell>{l.descricao}</TableCell>
                  <TableCell>
                    <Badge variant={l.fechado ? 'secondary' : bloqueado ? 'outline' : 'default'}>
                      {l.fechado ? 'Fechado' : bloqueado ? 'Bloqueado' : 'Aberto'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(l)} disabled={l.fechado || bloqueado} title={bloqueado ? 'Período bloqueado' : 'Editar'}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!l.fechado && !bloqueado && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleFechar(l)} title="Fechar">
                            <Lock className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(l)} title="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );})}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar lançamento' : 'Novo lançamento'}</DialogTitle>
            <DialogDescription>Débito deve ser igual ao crédito. Mínimo 2 linhas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Pagamento mensalidade" />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Linhas</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLinha}>+ Linha</Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {form.linhas.map((linha, i) => (
                  <div key={i} className="flex gap-2 items-center flex-wrap">
                    <Select value={linha.contaId} onValueChange={(v) => updateLinha(i, { contaId: v })}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {contas.map((c: { id: string; codigo: string; descricao: string }) => (
                          <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.descricao}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" step="0.01" min={0} placeholder="Débito" value={linha.debito || ''} onChange={(e) => updateLinha(i, { debito: parseFloat(e.target.value) || 0 })} className="w-24" />
                    <Input type="number" step="0.01" min={0} placeholder="Crédito" value={linha.credito || ''} onChange={(e) => updateLinha(i, { credito: parseFloat(e.target.value) || 0 })} className="w-24" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLinha(i)} disabled={form.linhas.length <= 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Total Débito: {totalDebito.toFixed(2)} | Total Crédito: {totalCredito.toFixed(2)}
                {!balanceado && <span className="text-destructive ml-2">(Débito ≠ Crédito)</span>}
              </p>
            </div>
          </div>
          {dataBloqueada && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <Lock className="h-4 w-4" />
              A data selecionada está em período bloqueado. Escolha uma data posterior ao fecho do exercício.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!balanceado || dataBloqueada || createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
