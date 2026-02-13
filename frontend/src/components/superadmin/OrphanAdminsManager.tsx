import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Link2, CheckCircle2, RefreshCw, Building2, Trash2 } from 'lucide-react';
import { profilesApi, instituicoesApi, userRolesApi, usersApi } from '@/services/api';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { useSafeMutation } from '@/hooks/useSafeMutation';

interface OrphanAdmin {
  id: string;
  nome_completo: string;
  email: string;
  created_at: string;
}

interface Instituicao {
  id: string;
  nome: string;
  subdominio: string;
}

export const OrphanAdminsManager = () => {
  const [orphanAdmins, setOrphanAdmins] = useState<OrphanAdmin[]>([]);
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInst, setSelectedInst] = useState<Record<string, string>>({});
  const [linking, setLinking] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useSafeDialog(false);
  const [adminToDelete, setAdminToDelete] = useState<OrphanAdmin | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const profiles = await profilesApi.getAll();
      
      // Filter admins without instituicao_id
      const adminsWithoutInst = (profiles || []).filter((p: any) => {
        const hasAdminRole = p.roles?.some((r: any) => r.role === 'ADMIN') || p.role === 'ADMIN';
        const hasNoInst = !p.instituicao_id && !p.instituicaoId;
        return hasAdminRole && hasNoInst;
      });

      const orphans = adminsWithoutInst.map((p: any) => ({
        id: p.id,
        nome_completo: p.nome_completo || p.nomeCompleto,
        email: p.email,
        created_at: p.created_at || p.createdAt,
      }));

      // Fetch institutions
      const insts = await instituicoesApi.getAll();

      setOrphanAdmins(orphans);
      setInstituicoes((insts || []).map((i: any) => ({
        id: i.id,
        nome: i.nome,
        subdominio: i.subdominio,
      })));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLink = async (adminId: string) => {
    const instituicaoId = selectedInst[adminId];
    if (!instituicaoId) {
      toast.error('Selecione uma instituição');
      return;
    }

    setLinking(adminId);
    try {
      // Update profile with instituicaoId
      await profilesApi.update(adminId, { instituicaoId });

      toast.success('Admin vinculado com sucesso!');
      fetchData();
    } catch (error: any) {
      console.error('Error linking admin:', error);
      toast.error(error.response?.data?.message || error.message || 'Erro ao vincular admin');
    } finally {
      setLinking(null);
    }
  };

  // Delete mutation
  const deleteAdminMutation = useSafeMutation({
    mutationFn: async (userId: string) => {
      return await usersApi.delete(userId);
    },
    onSuccess: () => {
      toast.success('Administrador excluído com sucesso!');
      setIsDeleteDialogOpen(false);
      setAdminToDelete(null);
      fetchData();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Erro ao excluir administrador');
    },
  });

  const handleDeleteClick = (admin: OrphanAdmin) => {
    setAdminToDelete(admin);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!adminToDelete) return;
    deleteAdminMutation.mutate(adminToDelete.id);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (orphanAdmins.length === 0) {
    return (
      <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-800 dark:text-green-300">Tudo em ordem!</AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-400">
          Todos os administradores estão corretamente vinculados às suas instituições.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="h-5 w-5" />
              Administradores Sem Instituição ({orphanAdmins.length})
            </CardTitle>
            <CardDescription className="text-yellow-700 dark:text-yellow-400">
              Esses administradores não estão vinculados a nenhuma instituição e não conseguem ver seus dados corretamente.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-yellow-200 dark:border-yellow-800 bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Administrador</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Vincular à Instituição</TableHead>
                <TableHead className="w-[200px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orphanAdmins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.nome_completo}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>
                    <Select
                      value={selectedInst[admin.id] || ''}
                      onValueChange={(value) => setSelectedInst(prev => ({ ...prev, [admin.id]: value }))}
                    >
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Selecione uma instituição" />
                      </SelectTrigger>
                      <SelectContent>
                        {instituicoes.map((inst) => (
                          <SelectItem key={inst.id} value={inst.id}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {inst.nome}
                              <Badge variant="outline" className="text-xs ml-2">
                                {inst.subdominio}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleLink(admin.id)}
                        disabled={!selectedInst[admin.id] || linking === admin.id}
                      >
                        {linking === admin.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Link2 className="h-4 w-4 mr-1" />
                            Vincular
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteClick(admin)}
                        title="Excluir"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o administrador <strong>{adminToDelete?.nome_completo}</strong> ({adminToDelete?.email})?
              <br />
              <br />
              <span className="text-red-600 font-semibold">Esta ação não pode ser desfeita.</span>
              <br />
              <span className="text-yellow-600 font-medium">Este administrador não está vinculado a nenhuma instituição.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteAdminMutation.isPending}
            >
              {deleteAdminMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
