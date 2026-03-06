import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salasApi, campusApi } from '@/services/api';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Loader2, Edit, Trash2, DoorOpen } from 'lucide-react';
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

interface Sala {
  id: string;
  nome: string;
  capacidade: number | null;
  ativa: boolean;
  instituicaoId: string;
  campusId?: string | null;
  campus?: { id: string; nome: string } | null;
}

export const SalasTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [editingSala, setEditingSala] = useState<Sala | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    capacidade: '' as string | number,
    campusId: '' as string,
  });

  const { data: campusList = [] } = useQuery({
    queryKey: ['campus', instituicaoId],
    queryFn: async () => {
      const response = await campusApi.getAll();
      return Array.isArray(response) ? response : response?.data ?? [];
    },
  });

  const { data: salas = [], isLoading } = useQuery({
    queryKey: ['salas', instituicaoId],
    queryFn: async () => {
      const response = await salasApi.getAll();
      return Array.isArray(response) ? response : response?.data ?? [];
    },
  });

  const createMutation = useSafeMutation({
    mutationFn: (data: { nome: string; capacidade?: number | null; campusId?: string | null }) => salasApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salas'] });
      toast.success('Sala cadastrada com sucesso!');
      resetForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao cadastrar sala'),
  });

  const updateMutation = useSafeMutation({
    mutationFn: ({ id, ...data }: { id: string; nome?: string; capacidade?: number | null; ativa?: boolean; campusId?: string | null }) =>
      salasApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salas'] });
      toast.success('Sala atualizada com sucesso!');
      resetForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao atualizar sala'),
  });

  const deleteMutation = useSafeMutation({
    mutationFn: (id: string) => salasApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salas'] });
      toast.success('Sala excluída com sucesso!');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao excluir sala'),
  });

  const resetForm = () => {
    setFormData({ nome: '', capacidade: '', campusId: '' });
    setEditingSala(null);
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome?.trim()) {
      toast.error('Preencha o nome da sala');
      return;
    }
    const capacidade =
      formData.capacidade === '' || formData.capacidade == null
        ? null
        : Number(formData.capacidade);

    const campusId = formData.campusId?.trim() || null;

    if (editingSala) {
      updateMutation.mutate({
        id: editingSala.id,
        nome: formData.nome.trim(),
        capacidade,
        campusId,
      });
    } else {
      createMutation.mutate({ nome: formData.nome.trim(), capacidade, campusId });
    }
  };

  const handleEdit = (sala: Sala) => {
    setFormData({
      nome: sala.nome,
      capacidade: sala.capacidade ?? '',
      campusId: sala.campusId ?? '',
    });
    setEditingSala(sala);
    setDialogOpen(true);
  };

  const handleToggleAtiva = (sala: Sala) => {
    updateMutation.mutate({
      id: sala.id,
      ativa: !sala.ativa,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DoorOpen className="h-5 w-5 text-primary" />
                Salas
              </CardTitle>
              <CardDescription>
                Gerencie as salas de aula. Usadas na sugestão de horários para evitar conflitos.
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Sala
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingSala ? 'Editar Sala' : 'Cadastrar Nova Sala'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome da Sala *</Label>
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
                      placeholder="Ex: Sala 101, Lab. Informática"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Capacidade (opcional)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.capacidade}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          capacidade: e.target.value === '' ? '' : parseInt(e.target.value, 10),
                        }))
                      }
                      placeholder="Ex: 30"
                    />
                  </div>
                  {campusList.length > 0 && (
                    <div className="space-y-2">
                      <Label>Campus (opcional)</Label>
                      <Select
                        value={formData.campusId || '_none'}
                        onValueChange={(v) => setFormData((p) => ({ ...p, campusId: v === '_none' ? '' : v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o campus" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Nenhum</SelectItem>
                          {campusList.map((c: { id: string; nome: string }) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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
                      {editingSala ? 'Atualizar' : 'Cadastrar'}
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
          ) : salas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma sala cadastrada. Cadastre salas para que a sugestão de horários possa atribuí-las automaticamente.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sala</TableHead>
                    <TableHead>Capacidade</TableHead>
                    {campusList.length > 0 && <TableHead>Campus</TableHead>}
                    <TableHead>Ativa</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salas.map((sala: Sala) => (
                    <TableRow key={sala.id}>
                      <TableCell className="font-medium">{sala.nome}</TableCell>
                      <TableCell>{sala.capacidade ?? '-'}</TableCell>
                      {campusList.length > 0 && (
                        <TableCell>{sala.campus?.nome ?? '-'}</TableCell>
                      )}
                      <TableCell>
                        <Switch
                          checked={sala.ativa}
                          onCheckedChange={() => handleToggleAtiva(sala)}
                          disabled={updateMutation.isPending}
                        />
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <div className="flex gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" onClick={() => handleEdit(sala)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                            <AlertDialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button size="icon" variant="ghost" className="text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Excluir</TooltipContent>
                              </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Sala</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir a sala &quot;{sala.nome}&quot;?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(sala.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          </div>
                        </TooltipProvider>
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
