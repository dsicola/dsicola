import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { useListQuery } from '@/hooks/useListQuery';
import { ListToolbar } from '@/components/common/ListToolbar';
import { PaginationControls } from '@/components/common/PaginationControls';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Eye, FileText, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { isStaffWithFallback } from '@/utils/roleLabels';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FuncionarioFormDialog } from './FuncionarioFormDialog';
import { FuncionarioViewDialog } from './FuncionarioViewDialog';
import { DocumentosFuncionarioDialog } from './DocumentosFuncionarioDialog';
import { funcionariosApi, departamentosApi, cargosApi } from '@/services/api';

interface Funcionario {
  id: string;
  user_id: string;
  departamento_id: string | null;
  cargo_id: string | null;
  salario: number;
  data_admissao: string;
  data_demissao: string | null;
  data_fim_contrato: string | null;
  tipo_contrato: string;
  carga_horaria: string;
  status: string;
  observacoes: string | null;
  created_at: string;
  profiles: {
    nome_completo: string;
    email: string;
    telefone: string | null;
    avatar_url: string | null;
  };
  departamentos: {
    nome: string;
  } | null;
  cargos: {
    nome: string;
  } | null;
}

interface Departamento {
  id: string;
  nome: string;
}

interface Cargo {
  id: string;
  nome: string;
  salario_base: number | null;
}

export const FuncionariosRHTab = () => {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [showFormDialog, setShowFormDialog] = useSafeDialog(false);
  const [showViewDialog, setShowViewDialog] = useSafeDialog(false);
  const [showDocsDialog, setShowDocsDialog] = useSafeDialog(false);
  const [selectedFuncionario, setSelectedFuncionario] = useState<Funcionario | null>(null);

  // Listagem paginada server-side - RH: backend obtém instituicaoId do JWT
  const list = useListQuery({
    endpoint: funcionariosApi.getList,
    queryKey: ['funcionarios-list'],
    defaultFilters: { status: 'ATIVO' },
    pageSize: 10,
    enabled: !!instituicaoId || isSuperAdmin || isStaffWithFallback(role),
  });

  const { data: funcionariosData, meta, isLoading, page, setPage, searchInput, setSearchInput, filters, updateFilter, clearFilters } = list;
  const funcionarios = (funcionariosData ?? []) as Funcionario[];

  // Fetch departamentos - RH: backend obtém instituicaoId do JWT
  const { data: departamentos = [] } = useQuery({
    queryKey: ['departamentos', instituicaoId],
    queryFn: async () => {
      const params: any = { ativo: true };
      if (!isSuperAdmin && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      return departamentosApi.getAll(params);
    },
    enabled: !!instituicaoId || isSuperAdmin || isStaffWithFallback(role),
  });

  // Fetch cargos - RH: backend obtém instituicaoId do JWT
  const { data: cargos = [] } = useQuery({
    queryKey: ['cargos', instituicaoId],
    queryFn: async () => {
      const params: any = { ativo: true };
      if (!isSuperAdmin && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      return cargosApi.getAll(params);
    },
    enabled: !!instituicaoId || isSuperAdmin || isStaffWithFallback(role),
  });

  // Delete mutation - protegida contra unmount
  const deleteMutation = useSafeMutation({
    mutationFn: (id: string) => funcionariosApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      queryClient.invalidateQueries({ queryKey: ['funcionarios-list'] });
      list.invalidate();
      toast.success('Funcionário excluído');
    },
    onError: () => {
      toast.error('Erro ao excluir funcionário');
    },
  });

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este funcionário?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleView = (func: Funcionario) => {
    setSelectedFuncionario(func);
    setShowViewDialog(true);
  };

  const handleEdit = (func: Funcionario) => {
    setSelectedFuncionario(func);
    setShowFormDialog(true);
  };

  const handleDocs = (func: Funcionario) => {
    setSelectedFuncionario(func);
    setShowDocsDialog(true);
  };

  const handleNew = () => {
    setSelectedFuncionario(null);
    setShowFormDialog(true);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
    queryClient.invalidateQueries({ queryKey: ['funcionarios-list'] });
    list.invalidate();
    setShowFormDialog(false);
  };


  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase?.() || status;
    switch (s) {
      case 'ATIVO':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ativo</Badge>;
      case 'SUSPENSO':
        return <Badge variant="secondary">Suspenso</Badge>;
      case 'ENCERRADO':
        return <Badge variant="outline">Encerrado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Funcionários</CardTitle>
            <CardDescription>
              Gerencie todos os funcionários da instituição
            </CardDescription>
          </div>
          <Button onClick={handleNew}>
            <UserPlus className="mr-2 h-4 w-4" />
            Novo Funcionário
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ListToolbar */}
        <ListToolbar
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Buscar por nome ou email..."
          filters={[
            {
              key: 'status',
              label: 'Status',
              value: filters.status || 'ATIVO',
              onValueChange: (v) => updateFilter('status', v === 'all' ? undefined : v),
              options: [
                { value: 'ATIVO', label: 'Ativos' },
                { value: 'SUSPENSO', label: 'Suspensos' },
                { value: 'ENCERRADO', label: 'Encerrados' },
                { value: 'all', label: 'Todos' },
              ],
            },
            {
              key: 'cargoId',
              label: 'Cargo',
              value: filters.cargoId || 'all',
              onValueChange: (v) => updateFilter('cargoId', v === 'all' ? undefined : v),
              options: [
                { value: 'all', label: 'Todos os cargos' },
                ...(cargos as Cargo[]).map((c) => ({ value: c.id, label: c.nome })),
              ],
            },
          ]}
          onClearFilters={clearFilters}
          hasActiveFilters={!!(filters.status || filters.cargoId || searchInput)}
          pageSize={filters.pageSize ?? 10}
          onPageSizeChange={(n) => updateFilter('pageSize', n)}
        />

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando funcionários...
          </div>
        ) : funcionarios.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum funcionário encontrado
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Admissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funcionarios.map((func: Funcionario) => (
                  <TableRow key={func.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{func.profiles?.nome_completo || func.nome_completo || '-'}</p>
                        <p className="text-sm text-muted-foreground">{func.profiles?.email || func.email || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{func.cargos?.nome || func.cargo?.nome || '-'}</TableCell>
                    <TableCell>{func.departamentos?.nome || func.departamento?.nome || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(func.data_admissao), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getStatusBadge(func.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleView(func)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDocs(func)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(func)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(func.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        <PaginationControls
          page={page}
          pageSize={meta.pageSize}
          total={meta.total}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </CardContent>

      {/* Dialogs */}
      <FuncionarioFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        funcionario={selectedFuncionario}
        departamentos={departamentos}
        cargos={cargos}
        onSuccess={handleSuccess}
      />

      <FuncionarioViewDialog
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        funcionario={selectedFuncionario}
      />

      <DocumentosFuncionarioDialog
        open={showDocsDialog}
        onOpenChange={setShowDocsDialog}
        funcionario={selectedFuncionario}
      />
    </Card>
  );
};