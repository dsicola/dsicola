import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SmartSearch } from '@/components/common/SmartSearch';
import type { SmartSearchItem } from '@/components/common/SmartSearch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Plus, Edit, RefreshCw, AlertTriangle, Upload, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { funcionariosApi, contratosFuncionarioApi, storageApi } from '@/services/api';

interface Funcionario {
  id: string;
  user_id: string;
  nome_completo?: string;
  profiles?: {
    nome_completo: string;
  };
  cargo?: {
    nome: string;
  } | null;
  cargos?: {
    nome: string;
  } | null;
}

interface Contrato {
  id: string;
  funcionario_id: string;
  tipo_contrato: string;
  data_inicio: string;
  data_fim: string | null;
  salario: number;
  carga_horaria: string;
  arquivo_url: string | null;
  nome_arquivo: string | null;
  observacoes: string | null;
  status: string;
  renovado_de: string | null;
  created_at: string;
}

export const ContratosTab = () => {
  const { instituicaoId, shouldFilter, isSuperAdmin } = useTenantFilter();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [showDialog, setShowDialog] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    funcionario_id: '',
    tipo_contrato: 'Efetivo',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: '',
    salario: 0,
    carga_horaria: '8h/dia',
    observacoes: '',
    arquivo_url: '',
    nome_arquivo: ''
  });

  useEffect(() => {
    if (instituicaoId || isSuperAdmin) {
      fetchData();
    }
  }, [instituicaoId, isSuperAdmin]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Preencher salário base automaticamente quando um funcionário é selecionado
  // Prioridade: salário do funcionário > salário do cargo
  useEffect(() => {
    if (formData.funcionario_id && funcionarios.length > 0) {
      const funcionario = funcionarios.find((f: Funcionario) => f.id === formData.funcionario_id);
      if (funcionario) {
        // Primeiro tenta obter do funcionário
        const salarioFuncionario = (funcionario as any).salario_base ?? (funcionario as any).salario;
        
        // Se não tiver no funcionário (null/undefined), tenta obter do cargo
        const salarioCargo = (funcionario as any).cargo?.salario_base ?? (funcionario as any).cargos?.salario_base;
        
        // Usa o salário do funcionário se existir (pode ser 0), senão usa do cargo, senão 0
        const salarioFinal = salarioFuncionario !== null && salarioFuncionario !== undefined 
          ? salarioFuncionario 
          : (salarioCargo !== null && salarioCargo !== undefined ? salarioCargo : 0);
        
        setFormData(prev => ({ ...prev, salario: salarioFinal }));
      }
    }
  }, [formData.funcionario_id, funcionarios]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const funcData = await funcionariosApi.getAll(shouldFilter ? instituicaoId || undefined : undefined);
      setFuncionarios(funcData as unknown as Funcionario[]);

      const funcIds = funcData.map((f: any) => f.id);
      
      if (funcIds.length > 0) {
        const contratosData = await contratosFuncionarioApi.getByFuncionarioIds(funcIds);
        setContratos(contratosData);
      } else {
        setContratos([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    }
    setIsLoading(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await storageApi.upload('documentos_funcionarios', `contratos/${Date.now()}.${file.name.split('.').pop()}`, file);
      
      setFormData({
        ...formData,
        arquivo_url: result.publicUrl,
        nome_arquivo: file.name
      });
      toast.success('Arquivo enviado');
    } catch (error) {
      toast.error('Erro ao fazer upload do arquivo');
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!formData.funcionario_id || !formData.data_inicio) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const payload: any = {
      funcionario_id: formData.funcionario_id,
      tipo_contrato: formData.tipo_contrato,
      data_inicio: formData.data_inicio,
      data_fim: formData.data_fim || null,
      carga_horaria: formData.carga_horaria,
      arquivo_url: formData.arquivo_url || null,
      nome_arquivo: formData.nome_arquivo || null,
      observacoes: formData.observacoes || null,
      status: 'Ativo',
      renovado_de: isRenewing && editingContrato ? editingContrato.id : null
    };

    // NOTA: Salário não é enviado no payload porque o backend busca automaticamente
    // do funcionário ou cargo para garantir consistência. O campo no formulário
    // é apenas para visualização.

    try {
      if (editingContrato && !isRenewing) {
        await contratosFuncionarioApi.update(editingContrato.id, payload);
      } else {
        if (isRenewing && editingContrato) {
          await contratosFuncionarioApi.update(editingContrato.id, { status: 'Renovado' });
        }
        await contratosFuncionarioApi.create(payload);
      }

      toast.success(isRenewing ? 'Contrato renovado com sucesso' : 'Contrato salvo com sucesso');
      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Erro ao salvar contrato');
    }
  };

  const resetForm = () => {
    setFormData({
      funcionario_id: '',
      tipo_contrato: 'Efetivo',
      data_inicio: format(new Date(), 'yyyy-MM-dd'),
      data_fim: '',
      salario: 0,
      carga_horaria: '8h/dia',
      observacoes: '',
      arquivo_url: '',
      nome_arquivo: ''
    });
    setEditingContrato(null);
    setIsRenewing(false);
  };

  const handleEdit = (contrato: Contrato) => {
    setEditingContrato(contrato);
    setIsRenewing(false);
    setFormData({
      funcionario_id: contrato.funcionario_id,
      tipo_contrato: contrato.tipo_contrato,
      data_inicio: contrato.data_inicio,
      data_fim: contrato.data_fim || '',
      salario: contrato.salario,
      carga_horaria: contrato.carga_horaria,
      observacoes: contrato.observacoes || '',
      arquivo_url: contrato.arquivo_url || '',
      nome_arquivo: contrato.nome_arquivo || ''
    });
    setShowDialog(true);
  };

  const handleRenew = (contrato: Contrato) => {
    setEditingContrato(contrato);
    setIsRenewing(true);
    const newStartDate = contrato.data_fim 
      ? format(addDays(new Date(contrato.data_fim), 1), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd');
    
    // Ao renovar, o salário será buscado automaticamente pelo useEffect
    // quando o funcionário_id for definido, então inicializamos com 0
    setFormData({
      funcionario_id: contrato.funcionario_id,
      tipo_contrato: contrato.tipo_contrato,
      data_inicio: newStartDate,
      data_fim: '',
      salario: 0, // Será preenchido automaticamente pelo useEffect
      carga_horaria: contrato.carga_horaria,
      observacoes: '',
      arquivo_url: '',
      nome_arquivo: ''
    });
    setShowDialog(true);
  };

  const handleNew = () => {
    resetForm();
    setShowDialog(true);
  };

  const getStatusBadge = (contrato: Contrato) => {
    if (contrato.status === 'Renovado') {
      return <Badge variant="secondary">Renovado</Badge>;
    }
    if (contrato.status === 'Encerrado') {
      return <Badge variant="destructive">Encerrado</Badge>;
    }
    
    if (contrato.data_fim) {
      const daysUntilEnd = differenceInDays(new Date(contrato.data_fim), new Date());
      if (daysUntilEnd < 0) {
        return <Badge variant="destructive">Expirado</Badge>;
      }
      if (daysUntilEnd <= 30) {
        return (
          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Expira em {daysUntilEnd} dias
          </Badge>
        );
      }
    }
    
    return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ativo</Badge>;
  };

  const getFuncionarioNome = (funcId: string) => {
    const func = funcionarios.find(f => f.id === funcId);
    return func?.profiles?.nome_completo || func?.nome_completo || 'N/A';
  };

  // Função de busca para SmartSearch (funcionários no dialog)
  const searchFuncionarios = useMemo(() => {
    return async (searchTerm: string): Promise<SmartSearchItem[]> => {
      if (!searchTerm || searchTerm.trim().length < 1) return [];
      const search = searchTerm.toLowerCase().trim();
      const filtered = funcionarios.filter((func: Funcionario) => {
        const nome = (func.profiles?.nome_completo || func.nome_completo || '').toLowerCase();
        const cargoNome = (func.cargo?.nome || func.cargos?.nome || '').toLowerCase();
        return nome.includes(search) || cargoNome.includes(search);
      });
      return filtered.slice(0, 15).map((func: Funcionario) => ({
        id: func.id,
        nome: func.profiles?.nome_completo || func.nome_completo || 'N/A',
        nomeCompleto: func.profiles?.nome_completo || func.nome_completo || '',
        nome_completo: func.profiles?.nome_completo || func.nome_completo || '',
        complemento: func.cargo?.nome || func.cargos?.nome || '',
      }));
    };
  }, [funcionarios]);

  const getFuncionarioDisplayNameForForm = (funcId: string) => {
    const func = funcionarios.find((f: Funcionario) => f.id === funcId);
    return func?.profiles?.nome_completo || func?.nome_completo || '';
  };

  const filteredContratos = useMemo(() => {
    let result = contratos.filter(c => {
      if (statusFilter === 'todos') return true;
      if (statusFilter === 'ativo') return c.status === 'Ativo';
      if (statusFilter === 'expirando') {
        if (!c.data_fim || c.status !== 'Ativo') return false;
        const days = differenceInDays(new Date(c.data_fim), new Date());
        return days >= 0 && days <= 30;
      }
      if (statusFilter === 'expirado') {
        if (!c.data_fim) return false;
        return differenceInDays(new Date(c.data_fim), new Date()) < 0;
      }
      return true;
    });

    // Aplicar filtro de pesquisa
    if (debouncedSearchTerm) {
      const search = debouncedSearchTerm.toLowerCase();
      result = result.filter(c => {
        const func = funcionarios.find(f => f.id === c.funcionario_id);
        const nome = (func?.profiles?.nome_completo || func?.nome_completo || '').toLowerCase();
        const cargoNome = (func?.cargo?.nome || func?.cargos?.nome || '').toLowerCase();
        const contratoId = c.id.toLowerCase();
        const tipoContrato = c.tipo_contrato.toLowerCase();
        return nome.includes(search) || 
               cargoNome.includes(search) || 
               contratoId.includes(search) ||
               tipoContrato.includes(search);
      });
    }

    return result;
  }, [contratos, statusFilter, funcionarios, debouncedSearchTerm]);

  const contratosExpirando = contratos.filter(c => {
    if (!c.data_fim || c.status !== 'Ativo') return false;
    const days = differenceInDays(new Date(c.data_fim), new Date());
    return days >= 0 && days <= 30;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Gestão de Contratos
            </CardTitle>
            <CardDescription>
              Acompanhe e renove contratos de funcionários
            </CardDescription>
          </div>
          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Contrato
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {contratosExpirando.length > 0 && (
          <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-600">
                {contratosExpirando.length} contrato(s) expirando em breve
              </p>
              <p className="text-sm text-muted-foreground">
                {contratosExpirando.map(c => getFuncionarioNome(c.funcionario_id)).join(', ')}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do funcionário, número de contrato, cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="expirando">Expirando (30 dias)</SelectItem>
              <SelectItem value="expirado">Expirados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredContratos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum contrato encontrado
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto -mx-1 sm:mx-0 max-w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="text-right">Salário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContratos.map((contrato) => (
                  <TableRow key={contrato.id}>
                    <TableCell className="font-medium">
                      {getFuncionarioNome(contrato.funcionario_id)}
                    </TableCell>
                    <TableCell>{contrato.tipo_contrato}</TableCell>
                    <TableCell>
                      {format(new Date(contrato.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {contrato.data_fim 
                        ? format(new Date(contrato.data_fim), 'dd/MM/yyyy', { locale: ptBR })
                        : 'Indeterminado'}
                    </TableCell>
                    <TableCell className="text-right">
                      Kz {contrato.salario.toLocaleString('pt-AO')}
                    </TableCell>
                    <TableCell>{getStatusBadge(contrato)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {contrato.arquivo_url && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => window.open(contrato.arquivo_url!, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(contrato)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {contrato.status === 'Ativo' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleRenew(contrato)}
                            title="Renovar contrato"
                          >
                            <RefreshCw className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isRenewing ? 'Renovar Contrato' : editingContrato ? 'Editar Contrato' : 'Novo Contrato'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Funcionário *</Label>
              <SmartSearch
                key={`contrato-func-${showDialog ? formData.funcionario_id || 'new' : 'closed'}`}
                placeholder="Digite o nome do funcionário ou cargo para buscar..."
                value={getFuncionarioDisplayNameForForm(formData.funcionario_id)}
                selectedId={formData.funcionario_id || undefined}
                onSelect={(item) => setFormData((prev) => ({ ...prev, funcionario_id: item ? item.id : '' }))}
                onClear={() => setFormData((prev) => ({ ...prev, funcionario_id: '' }))}
                searchFn={searchFuncionarios}
                minSearchLength={1}
                maxResults={15}
                getSubtitle={(item) => (item.complemento ? `Cargo: ${item.complemento}` : '')}
                emptyMessage="Nenhum funcionário encontrado"
                disabled={isRenewing}
                silent
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Contrato</Label>
                <Select 
                  value={formData.tipo_contrato} 
                  onValueChange={(v) => setFormData({ ...formData, tipo_contrato: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efetivo">Efetivo</SelectItem>
                    <SelectItem value="Temporário">Temporário</SelectItem>
                    <SelectItem value="Estágio">Estágio</SelectItem>
                    <SelectItem value="Prestação de Serviços">Prestação de Serviços</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Carga Horária</Label>
                <Select 
                  value={formData.carga_horaria} 
                  onValueChange={(v) => setFormData({ ...formData, carga_horaria: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4h/dia">4h/dia (Meio período)</SelectItem>
                    <SelectItem value="6h/dia">6h/dia</SelectItem>
                    <SelectItem value="8h/dia">8h/dia (Integral)</SelectItem>
                    <SelectItem value="Por hora">Por hora</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de Início *</Label>
                <Input
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                />
              </div>
              <div>
                <Label>Data de Fim</Label>
                <Input
                  type="date"
                  value={formData.data_fim}
                  onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Salário (Kz)</Label>
              <Input
                type="number"
                value={formData.salario}
                readOnly
                disabled
                className="bg-muted cursor-not-allowed"
                title="O salário é herdado automaticamente do funcionário ou cargo. Não pode ser editado manualmente."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Valor herdado automaticamente do funcionário ou cargo
              </p>
            </div>

            <div>
              <Label>Arquivo do Contrato</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                {uploading && <span className="text-sm text-muted-foreground">Enviando...</span>}
              </div>
              {formData.nome_arquivo && (
                <p className="text-sm text-muted-foreground mt-1">{formData.nome_arquivo}</p>
              )}
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {isRenewing ? 'Renovar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
