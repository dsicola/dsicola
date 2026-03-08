import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { contabilidadeApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ContaSelect, type ContaOption } from './ContaSelect';
import { Badge } from '@/components/ui/badge';
import { Zap, Save, Info } from 'lucide-react';
import { toast } from 'sonner';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const EVENTO_LABELS: Record<string, string> = {
  pagamento_propina: 'Pagamento de propina/mensalidade',
  estorno_propina: 'Estorno de propina',
  pagamento_matricula: 'Pagamento de taxa de matrícula',
  estorno_matricula: 'Estorno de taxa de matrícula',
  pagamento_salario: 'Pagamento de salários (folha)',
  estorno_salario: 'Estorno de folha',
  pagamento_fornecedor: 'Pagamento a fornecedor',
  compra_material: 'Compra de material',
};

const CAIXA_BANCO = 'CAIXA_BANCO';
const CAIXA_BANCO_LABEL = 'Caixa/Banco (conforme método)';

export const RegrasContabeisTab = () => {
  const queryClient = useQueryClient();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [editingEvento, setEditingEvento] = useState<string | null>(null);
  const [form, setForm] = useState({ contaDebitoCodigo: '', contaCreditoCodigo: '', ativo: true });

  const { data, isLoading } = useQuery({
    queryKey: ['regras-contabeis', instituicaoId],
    queryFn: () => contabilidadeApi.listRegrasContabeis(),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['plano-contas', instituicaoId],
    queryFn: () => contabilidadeApi.listPlanoContas({ incluirInativos: false }),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const contasOptions: ContaOption[] = (contas as Array<{ id: string; codigo: string; descricao: string; tipo?: string }>).map((c) => ({
    id: c.id,
    codigo: c.codigo,
    descricao: c.descricao,
    tipo: c.tipo,
  }));

  const upsertMutation = useSafeMutation({
    mutationFn: (data: { evento: string; contaDebitoCodigo: string; contaCreditoCodigo: string; ativo?: boolean }) =>
      contabilidadeApi.upsertRegraContabil(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regras-contabeis'] });
      toast.success('Regra guardada');
      setEditingEvento(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao guardar regra'),
  });

  const regras = data?.regras ?? [];
  const eventos = data?.eventos ?? [];

  const DEFAULTS: Record<string, { debito: string; credito: string }> = {
    pagamento_propina: { debito: 'CAIXA_BANCO', credito: '41' },
    estorno_propina: { debito: '41', credito: 'CAIXA_BANCO' },
    pagamento_matricula: { debito: 'CAIXA_BANCO', credito: '42' },
    estorno_matricula: { debito: '42', credito: 'CAIXA_BANCO' },
    pagamento_salario: { debito: '51', credito: 'CAIXA_BANCO' },
    estorno_salario: { debito: 'CAIXA_BANCO', credito: '51' },
    pagamento_fornecedor: { debito: '21', credito: 'CAIXA_BANCO' },
    compra_material: { debito: '52', credito: '21' },
  };

  const handleEdit = (evento: string, regra?: { contaDebitoCodigo: string; contaCreditoCodigo: string; ativo: boolean }) => {
    setEditingEvento(evento);
    const def = DEFAULTS[evento];
    setForm({
      contaDebitoCodigo: regra?.contaDebitoCodigo ?? def?.debito ?? '',
      contaCreditoCodigo: regra?.contaCreditoCodigo ?? def?.credito ?? '',
      ativo: regra?.ativo ?? true,
    });
  };

  const handleSubmit = () => {
    if (!editingEvento || !form.contaDebitoCodigo.trim() || !form.contaCreditoCodigo.trim()) {
      toast.error('Códigos de conta são obrigatórios');
      return;
    }
    upsertMutation.mutate({
      evento: editingEvento,
      contaDebitoCodigo: form.contaDebitoCodigo.trim(),
      contaCreditoCodigo: form.contaCreditoCodigo.trim(),
      ativo: form.ativo,
    });
  };

  const formatCodigo = (codigo: string) => (codigo === CAIXA_BANCO ? CAIXA_BANCO_LABEL : codigo);

  if (isLoading) return <div className="text-muted-foreground">A carregar...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Integração Contábil
        </CardTitle>
        <div className="flex items-start gap-2">
          <p className="text-sm text-muted-foreground">
            Mapa de eventos do sistema → contas contábeis. Altere as regras sem alterar código (ex: Receita Propinas → Receita Educação).
            Quando o aluno paga propina, o sistema lança Débito Caixa/Banco e Crédito Receita Propinas — sem intervenção manual.
          </p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Use CAIXA_BANCO para contas que variam conforme o método de pagamento (dinheiro→Caixa, transferência→Banco).
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead>Conta Débito</TableHead>
              <TableHead>Conta Crédito</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventos.map((ev: { codigo: string; descricao: string }) => {
              const regra = regras.find((r: { evento: string }) => r.evento === ev.codigo);
              const usaPadrao = !regra;
              return (
                <TableRow key={ev.codigo}>
                  <TableCell>
                    <span className="font-medium">{ev.descricao}</span>
                    <span className="text-muted-foreground text-xs ml-2">({ev.codigo})</span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {usaPadrao ? (
                      <span className="text-muted-foreground italic">Padrão</span>
                    ) : (
                      formatCodigo(regra.contaDebitoCodigo)
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {usaPadrao ? (
                      <span className="text-muted-foreground italic">Padrão</span>
                    ) : (
                      formatCodigo(regra.contaCreditoCodigo)
                    )}
                  </TableCell>
                  <TableCell>
                    {usaPadrao ? (
                      <Badge variant="outline">Padrão</Badge>
                    ) : (
                      <Badge variant={regra.ativo ? 'default' : 'secondary'}>
                        {regra.ativo ? 'Ativo' : 'Inativo (usa padrão)'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(ev.codigo, regra)}>
                      {regra ? 'Editar' : 'Configurar'}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <Dialog open={!!editingEvento} onOpenChange={(open) => !open && setEditingEvento(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEvento ? EVENTO_LABELS[editingEvento] || editingEvento : 'Configurar regra'}
              </DialogTitle>
              <DialogDescription>
                Defina as contas para Débito e Crédito. Use CAIXA_BANCO para resolver automaticamente conforme o método de pagamento.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Conta Débito</Label>
                <ContaSelect
                  contas={contasOptions}
                  value={form.contaDebitoCodigo}
                  onChange={(codigo) => setForm({ ...form, contaDebitoCodigo: codigo })}
                  placeholder="Selecione a conta de débito"
                  allowCaixaBanco
                />
              </div>
              <div>
                <Label>Conta Crédito</Label>
                <ContaSelect
                  contas={contasOptions}
                  value={form.contaCreditoCodigo}
                  onChange={(codigo) => setForm({ ...form, contaCreditoCodigo: codigo })}
                  placeholder="Selecione a conta de crédito"
                  allowCaixaBanco
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                />
                <Label htmlFor="ativo">Regra ativa</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingEvento(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={upsertMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
