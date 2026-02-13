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
import { Plus, Edit, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { departamentosApi } from '@/services/api';

interface Departamento {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

export const DepartamentosTab = () => {
  const { instituicaoId, shouldFilter, isSuperAdmin } = useTenantFilter();
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingDept, setEditingDept] = useState<Departamento | null>(null);
  const [formData, setFormData] = useState({ nome: '', descricao: '' });

  useEffect(() => {
    if (instituicaoId || isSuperAdmin) {
      fetchDepartamentos();
    }
  }, [instituicaoId, isSuperAdmin]);

  const fetchDepartamentos = async () => {
    setIsLoading(true);
    try {
      const params = shouldFilter && instituicaoId ? { instituicaoId } : undefined;
      const data = await departamentosApi.getAll(params);
      setDepartamentos(data);
    } catch (error) {
      console.error('Error fetching departamentos:', error);
      toast.error('Erro ao carregar departamentos');
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      if (editingDept) {
        await departamentosApi.update(editingDept.id, {
          nome: formData.nome,
          descricao: formData.descricao || null,
        });
        toast.success('Departamento atualizado!');
      } else {
        await departamentosApi.create({
          nome: formData.nome,
          descricao: formData.descricao || null,
          // instituicaoId vem do backend (req.user) - NÃO enviar do frontend
        });
        toast.success('Departamento criado!');
      }

      setShowDialog(false);
      setEditingDept(null);
      setFormData({ nome: '', descricao: '' });
      fetchDepartamentos();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    }
  };

  const handleEdit = (dept: Departamento) => {
    setEditingDept(dept);
    setFormData({ nome: dept.nome || '', descricao: dept.descricao || '' });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este departamento?')) return;

    try {
      await departamentosApi.delete(id);
      toast.success('Departamento excluído');
      fetchDepartamentos();
    } catch (error) {
      toast.error('Erro ao excluir. Verifique se há funcionários vinculados.');
    }
  };

  const handleToggleActive = async (dept: Departamento) => {
    try {
      await departamentosApi.update(dept.id, { ativo: !dept.ativo });
      toast.success(dept.ativo ? 'Departamento desativado' : 'Departamento ativado');
      fetchDepartamentos();
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleNew = () => {
    setEditingDept(null);
    setFormData({ nome: '', descricao: '' });
    setShowDialog(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Departamentos
            </CardTitle>
            <CardDescription>
              Gerencie os departamentos da instituição
            </CardDescription>
          </div>
          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Departamento
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando departamentos...
          </div>
        ) : departamentos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum departamento cadastrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departamentos.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {dept.descricao || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={dept.ativo ? 'default' : 'secondary'}>
                      {dept.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Switch
                        checked={dept.ativo}
                        onCheckedChange={() => handleToggleActive(dept)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(dept)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(dept.id)}>
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
          setEditingDept(null);
          setFormData({ nome: '', descricao: '' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDept ? 'Editar Departamento' : 'Novo Departamento'}
            </DialogTitle>
            <DialogDescription>
              {editingDept ? 'Atualize os dados do departamento' : 'Crie um novo departamento'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formData.nome || ''}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Recursos Humanos"
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
              setEditingDept(null);
              setFormData({ nome: '', descricao: '' });
            }}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingDept ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
