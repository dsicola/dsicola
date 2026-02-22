import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
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
import { Calendar, Plus, Edit, Check, X, Clock, Trash2, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useAuth } from '@/contexts/AuthContext';
import { isStaffWithFallback } from '@/utils/roleLabels';
import { funcionariosApi, frequenciaFuncionariosApi, biometriaApi } from '@/services/api';

interface Funcionario {
  id: string;
  user_id?: string;
  nome_completo?: string;
  profiles?: {
    nome_completo: string;
  };
}

interface Frequencia {
  id: string;
  funcionario_id: string;
  data: string;
  status: string; // PRESENTE, FALTA_JUSTIFICADA, FALTA_NAO_JUSTIFICADA
  tipo?: string; // Mantido para compatibilidade
  hora_entrada: string | null;
  hora_saida: string | null;
  horas_trabalhadas: number | null;
  observacoes: string | null;
  funcionario?: {
    id: string;
    nome_completo: string;
    email: string;
    cargo: string | null;
    departamento: string | null;
  } | null;
}

export const FrequenciaFuncionariosTab = () => {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [selectedFuncionario, setSelectedFuncionario] = useState<string>('todos');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showDialog, setShowDialog] = useState(false);
  const [editingFrequencia, setEditingFrequencia] = useState<Frequencia | null>(null);
  
  const [formData, setFormData] = useState({
    funcionario_id: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    status: 'PRESENTE',
    hora_entrada: '',
    hora_saida: '',
    observacoes: ''
  });

  // Fetch funcionarios - carregar TODOS os funcionários cadastrados
  const { data: funcionarios = [], isLoading: isLoadingFuncionarios } = useQuery({
    queryKey: ['funcionarios-frequencia', instituicaoId],
    queryFn: async () => {
      const params: any = {};
      if (!isSuperAdmin && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      const response = await funcionariosApi.getAll(params);
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!instituicaoId || isSuperAdmin || isStaffWithFallback(role),
  });

  // Fetch frequencias
  const { data: frequencias = [], isLoading } = useQuery({
    queryKey: ['frequencias-funcionarios', selectedFuncionario, selectedMonth, selectedYear, instituicaoId],
    queryFn: async () => {
      const startDate = format(startOfMonth(new Date(selectedYear, selectedMonth - 1)), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date(selectedYear, selectedMonth - 1)), 'yyyy-MM-dd');
      
      const params: any = {
        dataInicio: startDate,
        dataFim: endDate,
      };
      
      if (selectedFuncionario !== 'todos') {
        params.funcionarioId = selectedFuncionario;
      }
      
      return frequenciaFuncionariosApi.getAll(params);
    },
    enabled: !!instituicaoId || isSuperAdmin || isStaffWithFallback(role),
  });

  // Save mutation
  const saveMutation = useSafeMutation({
    mutationFn: async (data: any) => {
      if (editingFrequencia) {
        return frequenciaFuncionariosApi.update(editingFrequencia.id, data);
      }
      return frequenciaFuncionariosApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['frequencias-funcionarios'] });
      toast.success('Frequência salva com sucesso');
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      if (error?.response?.data?.message?.includes('duplicate')) {
        toast.error('Já existe registro para este funcionário nesta data');
      } else {
        toast.error('Erro ao salvar frequência');
      }
    },
  });

  // Delete mutation
  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await frequenciaFuncionariosApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['frequencias-funcionarios'] });
      toast.success('Frequência removida com sucesso');
    },
    onError: () => {
      toast.error('Erro ao remover frequência');
    },
  });

  const processarPresencasMutation = useSafeMutation({
    mutationFn: async () => {
      const dataHoje = format(new Date(), 'yyyy-MM-dd');
      return biometriaApi.processarPresencasDia({
        data: dataHoje,
        horarioPadraoEntrada: '08:00',
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['frequencias-funcionarios'] });
      const n = data?.faltasProcessadas ?? data?.faltas?.length ?? 0;
      toast.success(
        n > 0
          ? `${n} falta(s) registrada(s) para hoje`
          : 'Processamento concluído. Nenhuma nova falta detectada.'
      );
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao processar presenças');
    },
  });

  const handleSave = () => {
    if (!formData.funcionario_id || !formData.data) {
      toast.error('Preencha funcionário e data');
      return;
    }

    saveMutation.mutate({
      funcionarioId: formData.funcionario_id,
      data: formData.data,
      status: formData.status,
      horaEntrada: formData.hora_entrada || null,
      horaSaida: formData.hora_saida || null,
      observacoes: formData.observacoes || null,
    });
  };

  const resetForm = () => {
    setFormData({
      funcionario_id: '',
      data: format(new Date(), 'yyyy-MM-dd'),
      status: 'PRESENTE',
      hora_entrada: '',
      hora_saida: '',
      observacoes: ''
    });
    setEditingFrequencia(null);
  };

  const handleEdit = (freq: Frequencia) => {
    setEditingFrequencia(freq);
    setFormData({
      funcionario_id: freq.funcionario_id,
      data: freq.data,
      status: freq.status || freq.tipo || 'PRESENTE',
      hora_entrada: freq.hora_entrada || '',
      hora_saida: freq.hora_saida || '',
      observacoes: freq.observacoes || ''
    });
    setShowDialog(true);
  };

  const handleNew = () => {
    resetForm();
    setShowDialog(true);
  };

  const getTipoBadge = (status: string, tipo?: string) => {
    // Usar status se disponível, senão usar tipo (compatibilidade)
    const value = status || tipo || 'PRESENTE';
    switch (value) {
      case 'PRESENTE':
      case 'normal':
      case 'presente':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><Check className="h-3 w-3 mr-1" />Presente</Badge>;
      case 'FALTA':
      case 'FALTA_NAO_JUSTIFICADA':
      case 'falta':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><X className="h-3 w-3 mr-1" />Falta</Badge>;
      case 'FALTA_JUSTIFICADA':
      case 'falta_justificada':
      case 'falta-justificada':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Falta Just.</Badge>;
      default:
        return <Badge variant="outline">{value}</Badge>;
    }
  };

  const getFuncionarioNome = (funcId: string) => {
    const freq = frequencias.find((f: Frequencia) => f.funcionario_id === funcId);
    if (freq?.funcionario?.nome_completo) {
      return freq.funcionario.nome_completo;
    }
    const func = funcionarios.find((f: Funcionario) => f.id === funcId);
    return func?.profiles?.nome_completo || func?.nome_completo || 'N/A';
  };

  // Resumo do mês
  const resumoMes = {
    presencas: frequencias.filter((f: Frequencia) => (f.status || f.tipo) === 'PRESENTE' || (f.status || f.tipo) === 'normal' || (f.status || f.tipo) === 'presente').length,
    faltas: frequencias.filter((f: Frequencia) => ['FALTA', 'FALTA_NAO_JUSTIFICADA', 'falta'].includes(f.status || f.tipo || '')).length,
    faltasJustificadas: frequencias.filter((f: Frequencia) => (f.status || f.tipo) === 'FALTA_JUSTIFICADA' || (f.status || f.tipo) === 'falta_justificada' || (f.status || f.tipo) === 'falta-justificada').length,
    licencas: 0, // Removido - não faz parte dos requisitos
    atrasos: 0 // Removido - não faz parte dos requisitos
  };

  // Função de busca para SmartSearch (funcionários)
  const searchFuncionarios = useMemo(() => {
    return async (searchTerm: string): Promise<SmartSearchItem[]> => {
      if (!searchTerm || searchTerm.trim().length < 1) return [];
      const search = String(searchTerm ?? "").toLowerCase().trim();
      const filtered = (funcionarios as Funcionario[]).filter((func) => {
        const nome = String(func.profiles?.nome_completo ?? func.nome_completo ?? '').toLowerCase();
        return nome.includes(search);
      });
      return filtered.slice(0, 15).map((func) => ({
        id: func.id,
        nome: func.profiles?.nome_completo || func.nome_completo || 'N/A',
        nomeCompleto: func.profiles?.nome_completo || func.nome_completo || '',
        nome_completo: func.profiles?.nome_completo || func.nome_completo || '',
      }));
    };
  }, [funcionarios]);

  const searchFuncionariosComTodos = useMemo(() => {
    return async (searchTerm: string): Promise<SmartSearchItem[]> => {
      const items: SmartSearchItem[] = [{ id: 'todos', nome: 'Todos os funcionários', nomeCompleto: 'Todos os funcionários' }];
      if (!searchTerm || searchTerm.trim().length < 1) return items;
      const search = String(searchTerm ?? "").toLowerCase().trim();
      const filtered = (funcionarios as Funcionario[]).filter((func) => {
        const nome = String(func.profiles?.nome_completo ?? func.nome_completo ?? '').toLowerCase();
        return nome.includes(search);
      });
      items.push(...filtered.slice(0, 14).map((func) => ({
        id: func.id,
        nome: func.profiles?.nome_completo || func.nome_completo || 'N/A',
        nomeCompleto: func.profiles?.nome_completo || func.nome_completo || '',
        nome_completo: func.profiles?.nome_completo || func.nome_completo || '',
      })));
      return items;
    };
  }, [funcionarios]);

  const getFuncionarioFilterLabel = (id: string) => {
    if (id === 'todos') return 'Todos os funcionários';
    const func = funcionarios.find((f: Funcionario) => f.id === id);
    return func?.profiles?.nome_completo || func?.nome_completo || '';
  };

  const meses = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Controle de Frequência
            </CardTitle>
            <CardDescription>
              Registre e acompanhe a frequência dos funcionários
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => processarPresencasMutation.mutate()}
              disabled={processarPresencasMutation.isPending}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              {processarPresencasMutation.isPending ? 'Processando...' : 'Processar presenças hoje'}
            </Button>
            <Button onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar Frequência
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-full sm:w-[280px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Funcionário</Label>
            <SmartSearch
              placeholder="Digite para buscar funcionário..."
              value={getFuncionarioFilterLabel(selectedFuncionario)}
              selectedId={selectedFuncionario}
              onSelect={(item) => setSelectedFuncionario(item ? item.id : 'todos')}
              onClear={() => setSelectedFuncionario('todos')}
              searchFn={searchFuncionariosComTodos}
              minSearchLength={0}
              maxResults={15}
              emptyMessage="Nenhum funcionário encontrado"
              disabled={isLoadingFuncionarios}
              silent
            />
          </div>
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {meses.map((mes) => (
                <SelectItem key={mes.value} value={mes.value.toString()}>
                  {mes.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-500/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">{resumoMes.presencas}</p>
            <p className="text-sm text-muted-foreground">Presenças</p>
          </div>
          <div className="p-4 bg-red-500/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-red-600">{resumoMes.faltas}</p>
            <p className="text-sm text-muted-foreground">Faltas Não Justificadas</p>
          </div>
          <div className="p-4 bg-yellow-500/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-yellow-600">{resumoMes.faltasJustificadas}</p>
            <p className="text-sm text-muted-foreground">Faltas Justificadas</p>
          </div>
        </div>

        {/* Tabela */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : frequencias.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum registro de frequência encontrado
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto -mx-1 sm:mx-0 max-w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {frequencias.map((freq: Frequencia) => (
                  <TableRow key={freq.id}>
                    <TableCell>
                      {format(new Date(freq.data), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getFuncionarioNome(freq.funcionario_id)}</TableCell>
                    <TableCell>{freq.hora_entrada || '-'}</TableCell>
                    <TableCell>{freq.hora_saida || '-'}</TableCell>
                    <TableCell>{getTipoBadge(freq.status, freq.tipo)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(freq)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            if (confirm('Tem certeza que deseja remover esta frequência?')) {
                              deleteMutation.mutate(freq.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
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
      </CardContent>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingFrequencia ? 'Editar Frequência' : 'Registrar Frequência'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Funcionário *</Label>
                <SmartSearch
                  key={`freq-func-${showDialog ? formData.funcionario_id || 'new' : 'closed'}`}
                  placeholder="Digite o nome do funcionário para buscar..."
                  value={(funcionarios as Funcionario[]).find((f) => f.id === formData.funcionario_id)?.profiles?.nome_completo || (funcionarios as Funcionario[]).find((f) => f.id === formData.funcionario_id)?.nome_completo || ''}
                  selectedId={formData.funcionario_id || undefined}
                  onSelect={(item) => setFormData((prev) => ({ ...prev, funcionario_id: item ? item.id : '' }))}
                  onClear={() => setFormData((prev) => ({ ...prev, funcionario_id: '' }))}
                  searchFn={searchFuncionarios}
                  minSearchLength={1}
                  maxResults={15}
                  emptyMessage="Nenhum funcionário encontrado"
                  disabled={isLoadingFuncionarios}
                  silent
                />
              </div>
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                />
              </div>
              <div>
                <Label>Status *</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENTE">Presente</SelectItem>
                    <SelectItem value="FALTA_JUSTIFICADA">Falta Justificada</SelectItem>
                    <SelectItem value="FALTA_NAO_JUSTIFICADA">Falta Não Justificada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Hora Entrada</Label>
                <Input
                  type="time"
                  value={formData.hora_entrada}
                  onChange={(e) => setFormData({ ...formData, hora_entrada: e.target.value })}
                />
              </div>
              <div>
                <Label>Hora Saída</Label>
                <Input
                  type="time"
                  value={formData.hora_saida}
                  onChange={(e) => setFormData({ ...formData, hora_saida: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações adicionais..."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};