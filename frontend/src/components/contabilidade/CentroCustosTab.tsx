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
import { Plus, Edit, Trash2, PieChart } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmacaoResponsabilidadeDialog } from '@/components/common/ConfirmacaoResponsabilidadeDialog';

interface CentroCusto {
  id: string;
  codigo: string;
  descricao: string;
  ativo: boolean;
}

export const CentroCustosTab = () => {
  const queryClient = useQueryClient();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [showForm, setShowForm] = useSafeDialog(false);
  const [editing, setEditing] = useState<CentroCusto | null>(null);
  const [form, setForm] = useState<{ codigo: string; descricao: string; ativo?: boolean }>({ codigo: '', descricao: '' });
  const [criticoExcluirCentro, setCriticoExcluirCentro] = useState<CentroCusto | null>(null);

  const { data: centros = [], isLoading } = useQuery({
    queryKey: ['centros-custo', instituicaoId, incluirInativos],
    queryFn: () => contabilidadeApi.listCentrosCusto({ incluirInativos }),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const createMutation = useSafeMutation({
    mutationFn: (data: { codigo: string; descricao: string }) =>
      contabilidadeApi.createCentroCusto(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centros-custo'] });
      toast.success('Centro de custo criado');
      setShowForm(false);
      setForm({ codigo: '', descricao: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao criar'),
  });

  const updateMutation = useSafeMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      contabilidadeApi.updateCentroCusto(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centros-custo'] });
      toast.success('Centro de custo atualizado');
      setShowForm(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao atualizar'),
  });

  const deleteMutation = useSafeMutation({
    mutationFn: (id: string) => contabilidadeApi.deleteCentroCusto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centros-custo'] });
      toast.success('Centro de custo excluído');
      setCriticoExcluirCentro(null);
    },
    onError: (e: any) => {
      setCriticoExcluirCentro(null);
      toast.error(e.response?.data?.message || 'Erro ao excluir');
    },
  });

  const handleSubmit = () => {
    if (!form.codigo.trim() || !form.descricao.trim()) {
      toast.error('Código e descrição são obrigatórios');
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: { codigo: form.codigo, descricao: form.descricao, ativo: form.ativo } });
    } else {
      createMutation.mutate(form);
    }
  };

  const openEdit = (c: CentroCusto) => {
    setEditing(c);
    setForm({ codigo: c.codigo, descricao: c.descricao, ativo: c.ativo });
    setShowForm(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Centros de custo
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Opcional: atribua centros de custo às linhas dos lançamentos para relatórios por área (ex: Administração, Académico).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={incluirInativos}
              onChange={(e) => setIncluirInativos(e.target.checked)}
            />
            Inativos
          </label>
          <Button onClick={() => { setEditing(null); setForm({ codigo: '', descricao: '' }); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground">A carregar...</div>
        ) : centros.length === 0 ? (
          <p className="text-muted-foreground">
            Nenhum centro de custo. Crie um para organizar lançamentos por área.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {centros.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">{c.codigo}</TableCell>
                  <TableCell>{c.descricao}</TableCell>
                  <TableCell>
                    {c.ativo ? (
                      <Badge variant="default">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCriticoExcluirCentro(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
            <DialogTitle>{editing ? 'Editar centro de custo' : 'Novo centro de custo'}</DialogTitle>
            <DialogDescription>
              Código único e descrição (ex: ADM, Administração).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                placeholder="ADM"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Administração"
              />
            </div>
            {editing && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.ativo !== false}
                    onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                  />
                  Ativo
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Guardar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmacaoResponsabilidadeDialog
        open={criticoExcluirCentro !== null}
        onOpenChange={(open) => {
          if (!open) setCriticoExcluirCentro(null);
        }}
        title={
          criticoExcluirCentro
            ? `Excluir centro de custo ${criticoExcluirCentro.codigo}`
            : 'Excluir centro de custo'
        }
        description={
          criticoExcluirCentro
            ? `${criticoExcluirCentro.codigo} — ${criticoExcluirCentro.descricao}.`
            : undefined
        }
        avisoInstitucional="Centros de custo servem para rastrear despesas e receitas por área; a exclusão deve ser coerente com o mapa analítico aprovado pela gestão."
        pontosAtencao={[
          'Linhas de lançamento ou relatórios históricos podem referenciar este centro.',
          'Alterações estruturais fora do calendário contabilístico podem exigir deliberação ou excepção interna.',
        ]}
        confirmLabel="Excluir centro de custo"
        confirmVariant="destructive"
        checkboxLabel="Confirmo que autorizo a exclusão com base na política de reporte em vigor."
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (criticoExcluirCentro) deleteMutation.mutate(criticoExcluirCentro.id);
        }}
      />
    </Card>
  );
};
