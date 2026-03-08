import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { contabilidadeApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { Plus, Edit, Trash2, BookOpen, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiErrors';

const TIPO_LABELS: Record<string, string> = {
  ATIVO: 'Ativo',
  PASSIVO: 'Passivo',
  PATRIMONIO_LIQUIDO: 'Patrimônio Líquido',
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
};

interface PlanoConta {
  id: string;
  codigo: string;
  descricao: string;
  tipo: string;
  nivel: number;
  ativo: boolean;
  contaPai?: { id: string; codigo: string; descricao: string } | null;
}

export const PlanoContasTab = () => {
  const queryClient = useQueryClient();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [tipoPlanoSeed, setTipoPlanoSeed] = useState<'auto' | 'SECUNDARIO' | 'SUPERIOR' | 'minimo'>('auto');
  const [showForm, setShowForm] = useSafeDialog(false);
  const [editing, setEditing] = useState<PlanoConta | null>(null);
  const [form, setForm] = useState({ codigo: '', descricao: '', tipo: 'ATIVO' as string });

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['plano-contas', instituicaoId, incluirInativos],
    queryFn: () => contabilidadeApi.listPlanoContas({ incluirInativos }),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const createMutation = useSafeMutation({
    mutationFn: (data: { codigo: string; descricao: string; tipo: string }) =>
      contabilidadeApi.createPlanoConta(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plano-contas'] });
      toast.success('Conta criada');
      setShowForm(false);
      setForm({ codigo: '', descricao: '', tipo: 'ATIVO' });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao criar conta'),
  });

  const updateMutation = useSafeMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      contabilidadeApi.updatePlanoConta(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plano-contas'] });
      toast.success('Conta atualizada');
      setShowForm(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao atualizar'),
  });

  const seedPlanoEscolaMutation = useSafeMutation({
    mutationFn: () => contabilidadeApi.seedPlanoPadrao({ tipo: 'ESCOLA' }),
    onSuccess: (data: { criadas: Array<{ codigo: string; descricao: string }>; tipoUsado?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['plano-contas'] });
      const n = data?.criadas?.length ?? 0;
      toast.success(n > 0 ? `Plano de contas criado com sucesso (${n} contas)` : 'Plano de contas para escola já existe');
    },
    onError: (e: any) => toast.error(getApiErrorMessage(e, 'Erro ao gerar plano de contas. Verifique se as migrações da base de dados foram aplicadas.')),
  });

  const seedMutation = useSafeMutation({
    mutationFn: () =>
      contabilidadeApi.seedPlanoPadrao(
        tipoPlanoSeed === 'auto' ? undefined : { tipo: tipoPlanoSeed }
      ),
    onSuccess: (data: { criadas: Array<{ codigo: string; descricao: string }>; tipoUsado?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['plano-contas'] });
      const n = data?.criadas?.length ?? 0;
      const tipo = data?.tipoUsado || 'padrão';
      toast.success(n > 0 ? `Criadas ${n} contas (plano ${tipo})` : 'Plano padrão já existe');
    },
    onError: (e: any) => toast.error(getApiErrorMessage(e, 'Erro ao criar plano padrão. Verifique se as migrações da base de dados foram aplicadas.')),
  });

  const deleteMutation = useSafeMutation({
    mutationFn: (id: string) => contabilidadeApi.deletePlanoConta(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plano-contas'] });
      toast.success('Conta excluída');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao excluir'),
  });

  const handleSubmit = () => {
    if (!form.codigo.trim() || !form.descricao.trim()) {
      toast.error('Código e descrição são obrigatórios');
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (c: PlanoConta) => {
    setEditing(c);
    setForm({ codigo: c.codigo, descricao: c.descricao, tipo: c.tipo });
    setShowForm(true);
  };

  const handleDelete = (c: PlanoConta) => {
    if (window.confirm(`Excluir conta "${c.codigo} - ${c.descricao}"?`)) {
      deleteMutation.mutate(c.id);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Plano de Contas
          </CardTitle>
          <CardDescription>
            Lista de contas onde os movimentos são registados (ex: Caixa 11, Banco 12, Receita Mensalidades 41). Crie um plano padrão ou adicione contas manualmente.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="default"
            onClick={() => seedPlanoEscolaMutation.mutate()}
            disabled={seedPlanoEscolaMutation.isPending}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {seedPlanoEscolaMutation.isPending ? 'A gerar...' : 'Gerar plano de contas para escola'}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={incluirInativos}
              onChange={(e) => setIncluirInativos(e.target.checked)}
            />
            Incluir inativos
          </label>
          <Select value={tipoPlanoSeed} onValueChange={(v: 'auto' | 'ESCOLA' | 'SECUNDARIO' | 'SUPERIOR' | 'minimo') => setTipoPlanoSeed(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (por instituição)</SelectItem>
              <SelectItem value="ESCOLA">Escola (20 contas)</SelectItem>
              <SelectItem value="SECUNDARIO">Secundário (12 contas)</SelectItem>
              <SelectItem value="SUPERIOR">Superior (22 contas)</SelectItem>
              <SelectItem value="minimo">Mínimo (3 contas)</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? 'A criar...' : 'Criar plano padrão'}
          </Button>
          <Button onClick={() => { setEditing(null); setForm({ codigo: '', descricao: '', tipo: 'ATIVO' }); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova conta
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Carregando...</div>
        ) : contas.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground space-y-2">
            <p>Nenhuma conta cadastrada.</p>
            <p className="text-sm">
              Clique em <strong>Gerar plano de contas para escola</strong> para criar uma estrutura pronta adequada à maioria das escolas.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contas.map((c: PlanoConta) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">{c.codigo}</TableCell>
                  <TableCell>{c.descricao}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{TIPO_LABELS[c.tipo] || c.tipo}</Badge>
                  </TableCell>
                  <TableCell>{c.nivel}</TableCell>
                  <TableCell>
                    <Badge variant={c.ativo ? 'default' : 'secondary'}>{c.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Excluir</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar conta' : 'Nova conta'}</DialogTitle>
            <DialogDescription>Preencha os dados da conta contábil</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Código</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="Ex: 11, 41"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex: Caixa, Receita de Mensalidades"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
