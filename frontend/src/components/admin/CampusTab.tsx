import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campusApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Loader2, Edit, Trash2, Building2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Campus {
  id: string;
  nome: string;
  codigo: string | null;
  endereco: string | null;
  telefone: string | null;
  ativo: boolean;
  instituicaoId: string;
}

export const CampusTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    endereco: '',
    telefone: '',
  });

  const { data: campusList = [], isLoading } = useQuery({
    queryKey: ['campus', instituicaoId],
    queryFn: async () => {
      const response = await campusApi.getAll();
      return Array.isArray(response) ? response : response?.data ?? [];
    },
  });

  const createMutation = useSafeMutation({
    mutationFn: (data: { nome: string; codigo?: string | null; endereco?: string | null; telefone?: string | null }) =>
      campusApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus'] });
      toast.success('Campus cadastrado com sucesso!');
      resetForm();
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao cadastrar campus'),
  });

  const updateMutation = useSafeMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      nome?: string;
      codigo?: string | null;
      endereco?: string | null;
      telefone?: string | null;
      ativo?: boolean;
    }) => campusApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus'] });
      toast.success('Campus atualizado com sucesso!');
      resetForm();
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao atualizar campus'),
  });

  const deleteMutation = useSafeMutation({
    mutationFn: (id: string) => campusApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus'] });
      toast.success('Campus excluído com sucesso!');
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao excluir campus'),
  });

  const resetForm = () => {
    setFormData({ nome: '', codigo: '', endereco: '', telefone: '' });
    setEditingCampus(null);
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome?.trim()) {
      toast.error('Preencha o nome do campus');
      return;
    }

    if (editingCampus) {
      updateMutation.mutate({
        id: editingCampus.id,
        nome: formData.nome.trim(),
        codigo: formData.codigo.trim() || null,
        endereco: formData.endereco.trim() || null,
        telefone: formData.telefone.trim() || null,
      });
    } else {
      createMutation.mutate({
        nome: formData.nome.trim(),
        codigo: formData.codigo.trim() || null,
        endereco: formData.endereco.trim() || null,
        telefone: formData.telefone.trim() || null,
      });
    }
  };

  const handleEdit = (campus: Campus) => {
    setFormData({
      nome: campus.nome,
      codigo: campus.codigo ?? '',
      endereco: campus.endereco ?? '',
      telefone: campus.telefone ?? '',
    });
    setEditingCampus(campus);
    setDialogOpen(true);
  };

  const handleToggleAtivo = (campus: Campus) => {
    updateMutation.mutate({
      id: campus.id,
      ativo: !campus.ativo,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Campus
              </CardTitle>
              <CardDescription>
                Gerencie os campus da instituição. Útil para instituições com múltiplas unidades físicas.
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Campus
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCampus ? 'Editar Campus' : 'Cadastrar Novo Campus'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome do Campus *</Label>
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
                      placeholder="Ex: Campus Principal, Campus Benguela"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Código (opcional)</Label>
                    <Input
                      value={formData.codigo}
                      onChange={(e) => setFormData((p) => ({ ...p, codigo: e.target.value }))}
                      placeholder="Ex: LUA, BGL"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Endereço (opcional)</Label>
                    <Input
                      value={formData.endereco}
                      onChange={(e) => setFormData((p) => ({ ...p, endereco: e.target.value }))}
                      placeholder="Endereço completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone (opcional)</Label>
                    <Input
                      value={formData.telefone}
                      onChange={(e) => setFormData((p) => ({ ...p, telefone: e.target.value }))}
                      placeholder="+244 123 456 789"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {editingCampus ? 'Atualizar' : 'Cadastrar'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : campusList.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum campus cadastrado. Cadastre campus para organizar turmas, salas e turnos por unidade física.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campus</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campusList.map((campus: Campus) => (
                    <TableRow key={campus.id}>
                      <TableCell className="font-medium">{campus.nome}</TableCell>
                      <TableCell>{campus.codigo ?? '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{campus.endereco ?? '-'}</TableCell>
                      <TableCell>
                        <Switch
                          checked={campus.ativo}
                          onCheckedChange={() => handleToggleAtivo(campus)}
                          disabled={updateMutation.isPending}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(campus)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Campus</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o campus &quot;{campus.nome}&quot;?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(campus.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
