import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { cargosApi } from '@/services/api';

interface Cargo {
  id: string;
  nome: string;
  descricao: string | null;
  salario_base: number | null;
  ativo: boolean;
  created_at: string;
}

export const CargosTab = () => {
  const { instituicaoId, shouldFilter, isSuperAdmin } = useTenantFilter();
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCargo, setEditingCargo] = useState<Cargo | null>(null);
  const [formData, setFormData] = useState({ nome: '', descricao: '', salario_base: 0 });

  useEffect(() => {
    if (instituicaoId || isSuperAdmin) {
      fetchCargos();
    }
  }, [instituicaoId, isSuperAdmin]);

  const fetchCargos = async () => {
    setIsLoading(true);
    try {
      const params = shouldFilter && instituicaoId ? { instituicaoId } : undefined;
      const data = await cargosApi.getAll(params);
      setCargos(data);
    } catch (error) {
      console.error('Error fetching cargos:', error);
      toast.error('Erro ao carregar cargos');
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      if (editingCargo) {
        await cargosApi.update(editingCargo.id, {
          nome: formData.nome,
          descricao: formData.descricao || null,
          salario_base: formData.salario_base,
        });
        toast.success('Cargo atualizado!');
      } else {
        await cargosApi.create({
          nome: formData.nome,
          descricao: formData.descricao || null,
          salario_base: formData.salario_base,
          // instituicaoId vem do backend (req.user) - NÃO enviar do frontend
        });
        toast.success('Cargo criado!');
      }

      setShowDialog(false);
      setEditingCargo(null);
      setFormData({ nome: '', descricao: '', salario_base: 0 });
      fetchCargos();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    }
  };

  const handleEdit = (cargo: Cargo) => {
    setEditingCargo(cargo);
    setFormData({
      nome: cargo.nome || '',
      descricao: cargo.descricao || '',
      salario_base: cargo.salario_base ?? 0,
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cargo?')) return;

    try {
      await cargosApi.delete(id);
      toast.success('Cargo excluído');
      fetchCargos();
    } catch (error) {
      toast.error('Erro ao excluir. Verifique se há funcionários vinculados.');
    }
  };

  const handleToggleActive = async (cargo: Cargo) => {
    try {
      await cargosApi.update(cargo.id, { ativo: !cargo.ativo });
      toast.success(cargo.ativo ? 'Cargo desativado' : 'Cargo ativado');
      fetchCargos();
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleNew = () => {
    setEditingCargo(null);
    setFormData({ nome: '', descricao: '', salario_base: 0 });
    setShowDialog(true);
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '-';
    }
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: 'AOA',
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Cargos
            </CardTitle>
            <CardDescription>
              Gerencie os cargos e salários base
            </CardDescription>
          </div>
          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Cargo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando cargos...
          </div>
        ) : cargos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum cargo cadastrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Salário Base</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargos.map((cargo) => (
                <TableRow key={cargo.id}>
                  <TableCell className="font-medium">{cargo.nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {cargo.descricao || '-'}
                  </TableCell>
                  <TableCell>{formatCurrency(cargo.salario_base)}</TableCell>
                  <TableCell>
                    <Badge variant={cargo.ativo ? 'default' : 'secondary'}>
                      {cargo.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Switch
                        checked={cargo.ativo}
                        onCheckedChange={() => handleToggleActive(cargo)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(cargo)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(cargo.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) {
          setEditingCargo(null);
          setFormData({ nome: '', descricao: '', salario_base: 0 });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCargo ? 'Editar Cargo' : 'Novo Cargo'}
            </DialogTitle>
            <DialogDescription>
              {editingCargo ? 'Atualize os dados do cargo' : 'Crie um novo cargo'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formData.nome || ''}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Professor"
              />
            </div>
            <div className="space-y-2">
              <Label>Salário Base</Label>
              <Input
                type="number"
                value={formData.salario_base ?? 0}
                onChange={(e) => setFormData({ ...formData, salario_base: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao || ''}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição opcional"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDialog(false);
              setEditingCargo(null);
              setFormData({ nome: '', descricao: '', salario_base: 0 });
            }}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingCargo ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
