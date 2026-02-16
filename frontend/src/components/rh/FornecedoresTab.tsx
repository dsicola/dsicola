import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Edit, Trash2, Building2, Plus, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FornecedorFormDialog } from './FornecedorFormDialog';
import { fornecedoresApi } from '@/services/api';

interface Fornecedor {
  id: string;
  razaoSocial: string;
  nif?: string | null;
  tipoServico: 'SEGURANCA' | 'LIMPEZA' | 'TI' | 'CANTINA' | 'MANUTENCAO' | 'OUTRO';
  contato?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  pais?: string | null;
  inicioContrato: string;
  fimContrato?: string | null;
  status: 'ATIVO' | 'INATIVO' | 'SUSPENSO';
  observacoes?: string | null;
  createdAt: string;
  instituicao?: {
    id: string;
    nome: string;
  };
}

const TIPO_SERVICO_LABELS: Record<string, string> = {
  SEGURANCA: 'Segurança',
  LIMPEZA: 'Limpeza',
  TI: 'Tecnologia da Informação',
  CANTINA: 'Cantina',
  MANUTENCAO: 'Manutenção',
  OUTRO: 'Outro',
};

const STATUS_LABELS: Record<string, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  SUSPENSO: 'Suspenso',
};

export const FornecedoresTab = () => {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [tipoServicoFilter, setTipoServicoFilter] = useState<string>('todos');
  
  const [showFormDialog, setShowFormDialog] = useSafeDialog(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState<Fornecedor | null>(null);

  // Fetch fornecedores
  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ['fornecedores', instituicaoId, statusFilter, tipoServicoFilter, searchTerm],
    queryFn: async () => {
      const params: any = {};
      // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
      // O backend usa req.user.instituicaoId do JWT token automaticamente
      if (statusFilter !== 'todos') {
        params.status = statusFilter;
      }
      if (tipoServicoFilter !== 'todos') {
        params.tipoServico = tipoServicoFilter;
      }
      if (searchTerm) {
        params.search = searchTerm;
      }
      return fornecedoresApi.getAll(params);
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  // Delete mutation
  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      return fornecedoresApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      toast.success('Fornecedor desativado com sucesso');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao desativar fornecedor');
    },
  });

  const handleCreate = () => {
    setSelectedFornecedor(null);
    setShowFormDialog(true);
  };

  const handleEdit = (fornecedor: Fornecedor) => {
    setSelectedFornecedor(fornecedor);
    setShowFormDialog(true);
  };

  const handleDelete = (fornecedor: Fornecedor) => {
    if (window.confirm(`Deseja realmente desativar o fornecedor "${fornecedor.razaoSocial}"?`)) {
      deleteMutation.mutate(fornecedor.id);
    }
  };

  const filteredFornecedores = fornecedores.filter((fornecedor: Fornecedor) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        fornecedor.razaoSocial.toLowerCase().includes(search) ||
        fornecedor.contato?.toLowerCase().includes(search) ||
        fornecedor.email?.toLowerCase().includes(search) ||
        fornecedor.nif?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const canManage = role === 'ADMIN' || role === 'SUPER_ADMIN';

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Fornecedores são empresas terceirizadas (pessoa jurídica).</strong> Para cadastrar funcionários (pessoa física), use a aba "Funcionários".
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Fornecedores / Prestadores de Serviço
              </CardTitle>
              <CardDescription>
                Gerencie empresas terceirizadas e prestadores de serviço (pessoa jurídica)
              </CardDescription>
            </div>
            {canManage && (
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Fornecedor
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Buscar por razão social, contato, email ou NIF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="INATIVO">Inativo</SelectItem>
                  <SelectItem value="SUSPENSO">Suspenso</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tipoServicoFilter} onValueChange={setTipoServicoFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tipo de Serviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  <SelectItem value="SEGURANCA">Segurança</SelectItem>
                  <SelectItem value="LIMPEZA">Limpeza</SelectItem>
                  <SelectItem value="TI">Tecnologia da Informação</SelectItem>
                  <SelectItem value="CANTINA">Cantina</SelectItem>
                  <SelectItem value="MANUTENCAO">Manutenção</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabela */}
            {isLoading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : filteredFornecedores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum fornecedor encontrado
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto -mx-1 sm:mx-0 max-w-full">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>NIF</TableHead>
                    <TableHead>Tipo de Serviço</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Início Contrato</TableHead>
                    <TableHead>Fim Contrato</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFornecedores.map((fornecedor: Fornecedor) => (
                    <TableRow key={fornecedor.id}>
                      <TableCell className="font-medium">{fornecedor.razaoSocial}</TableCell>
                      <TableCell>{fornecedor.nif || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {TIPO_SERVICO_LABELS[fornecedor.tipoServico] || fornecedor.tipoServico}
                        </Badge>
                      </TableCell>
                      <TableCell>{fornecedor.contato || '-'}</TableCell>
                      <TableCell>{fornecedor.email || '-'}</TableCell>
                      <TableCell>
                        {format(new Date(fornecedor.inicioContrato), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {fornecedor.fimContrato
                          ? format(new Date(fornecedor.fimContrato), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            fornecedor.status === 'ATIVO'
                              ? 'default'
                              : fornecedor.status === 'SUSPENSO'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {STATUS_LABELS[fornecedor.status]}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(fornecedor)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(fornecedor)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <FornecedorFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        fornecedor={selectedFornecedor}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
          setShowFormDialog(false);
          setSelectedFornecedor(null);
        }}
      />
    </div>
  );
};

