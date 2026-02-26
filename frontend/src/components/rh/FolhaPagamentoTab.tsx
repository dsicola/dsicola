import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SmartSearch } from '@/components/common/SmartSearch';
import type { SmartSearchItem } from '@/components/common/SmartSearch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Plus, Printer, Search, Eye, Check, Calculator, Lock, Unlock, AlertTriangle, CreditCard, RotateCcw, Trash2, Pencil } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useAuth } from '@/contexts/AuthContext';
import { isStaffWithFallback } from '@/utils/roleLabels';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { funcionariosApi, folhaPagamentoApi } from '@/services/api';
import { gerarReciboFolhaPagamentoPDF, gerarMultiplosRecibosFolhaPDF, type ReciboFolhaPagamentoData } from '@/utils/pdfGenerator';

interface Funcionario {
  id: string;
  user_id: string;
  salario: number;
  salario_base?: number;
  nome_completo?: string;
  profiles?: {
    nome_completo: string;
    email: string;
  };
  cargo?: {
    nome: string;
  } | null;
  cargos?: {
    nome: string;
  } | null;
}

interface FolhaPagamento {
  id: string;
  funcionario_id: string;
  mes: number;
  ano: number;
  dias_uteis?: number;
  valor_dia?: number;
  valor_hora?: number;
  salario_base: number;
  descontos_faltas: number;
  horas_extras: number;
  valor_horas_extras: number;
  bonus: number;
  beneficio_transporte: number;
  beneficio_alimentacao: number;
  outros_beneficios: number;
  outros_descontos: number;
  inss: number;
  irt: number;
  salario_liquido: number;
  status: string;
  fechado_em?: string | null;
  fechado_por?: string | null;
  reaberto_em?: string | null;
  reaberto_por?: string | null;
  justificativa_reabertura?: string | null;
  pago_em?: string | null;
  pago_por?: string | null;
  metodo_pagamento?: string | null;
  referencia?: string | null;
  observacao_pagamento?: string | null;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  funcionario?: {
    id: string;
    nome_completo: string;
    numero_identificacao?: string | null;
    email?: string | null;
    cargo?: string | null;
    departamento?: string | null;
  } | null;
}

// Perfis folha: ADMIN e FINANCEIRO geram/marcam pago/enviam recibo; só ADMIN cancela. SECRETARIA e PROFESSOR só visualizam (PROFESSOR só própria).
const canGerarFolha = (role: string | null) => ['ADMIN', 'FINANCEIRO', 'SUPER_ADMIN'].includes(role ?? '');
const canMarcarPago = (role: string | null) => ['ADMIN', 'FINANCEIRO', 'SUPER_ADMIN'].includes(role ?? '');
const canCancelarFolha = (role: string | null) => ['ADMIN', 'SUPER_ADMIN'].includes(role ?? '');

export const FolhaPagamentoTab = () => {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const canGerar = canGerarFolha(role);
  const canMarcar = canMarcarPago(role);
  const canCancelar = canCancelarFolha(role);
  const { config } = useInstituicao();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showDialog, setShowDialog] = useSafeDialog(false);
  const [showViewDialog, setShowViewDialog] = useSafeDialog(false);
  const [showFecharDialog, setShowFecharDialog] = useSafeDialog(false);
  const [showReabrirDialog, setShowReabrirDialog] = useSafeDialog(false);
  const [showPagarDialog, setShowPagarDialog] = useSafeDialog(false);
  const [showReverterPagamentoDialog, setShowReverterPagamentoDialog] = useSafeDialog(false);
  const [showDeleteDialog, setShowDeleteDialog] = useSafeDialog(false);
  const [editingFolha, setEditingFolha] = useState<FolhaPagamento | null>(null);
  const [selectedFolha, setSelectedFolha] = useState<FolhaPagamento | null>(null);
  const [selectedFuncionarioData, setSelectedFuncionarioData] = useState<Funcionario | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [justificativaReabertura, setJustificativaReabertura] = useState('');
  const [justificativaReverterPagamento, setJustificativaReverterPagamento] = useState('');
  const [enviarReciboEmailFechar, setEnviarReciboEmailFechar] = useState(true);
  const [pagamentoForm, setPagamentoForm] = useState({
    metodoPagamento: 'TRANSFERENCIA' as 'TRANSFERENCIA' | 'CASH' | 'MOBILE_MONEY' | 'CHEQUE',
    referencia: '',
    observacaoPagamento: '',
    enviarReciboEmail: true,
  });

  const [formData, setFormData] = useState({
    funcionario_id: '',
    salario_base: 0,
    descontos_faltas: 0,
    horas_extras: 0,
    valor_horas_extras: 0,
    bonus: 0,
    beneficio_transporte: 0,
    beneficio_alimentacao: 0,
    outros_beneficios: 0,
    outros_descontos: 0,
    inss: 0,
    irt: 0,
    observacoes: ''
  });

  // Fetch funcionarios - carregar TODOS os funcionários cadastrados
  const { data: funcionarios = [], isLoading: isLoadingFuncionarios } = useQuery({
    queryKey: ['funcionarios-folha', instituicaoId],
    queryFn: async () => {
      const params: any = {};
      if (!isSuperAdmin && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      const result = await funcionariosApi.getAll(params);
      return Array.isArray(result) ? result : [];
    },
    enabled: !!instituicaoId || isSuperAdmin || isStaffWithFallback(role),
  });

  // Função de busca para SmartSearch (busca por digitação, sem perder foco)
  const searchFuncionarios = useMemo(() => {
    return async (searchTerm: string): Promise<SmartSearchItem[]> => {
      if (!searchTerm || searchTerm.trim().length < 1) return [];
      const search = String(searchTerm ?? '').toLowerCase().trim();
      const filtered = funcionarios.filter((func: Funcionario) => {
        const nome = String(func.profiles?.nome_completo ?? func.nome_completo ?? '').toLowerCase();
        const cargoNome = String(func.cargo?.nome ?? func.cargos?.nome ?? '').toLowerCase();
        const email = String(func.profiles?.email ?? '').toLowerCase();
        return nome.includes(search) || cargoNome.includes(search) || email.includes(search);
      });
      return filtered.slice(0, 15).map((func: Funcionario) => ({
        id: func.id,
        nome: func.profiles?.nome_completo || func.nome_completo || 'N/A',
        nomeCompleto: func.profiles?.nome_completo || func.nome_completo || '',
        nome_completo: func.profiles?.nome_completo || func.nome_completo || '',
        email: func.profiles?.email || '',
        complemento: func.cargo?.nome || func.cargos?.nome || '',
      }));
    };
  }, [funcionarios]);

  const getFuncionarioDisplayName = (funcId: string) => {
    const func = funcionarios.find((f: Funcionario) => f.id === funcId);
    return func?.profiles?.nome_completo || func?.nome_completo || '';
  };

  // Quando selecionar um funcionário, carregar automaticamente o salário base do backend
  useEffect(() => {
    if (formData.funcionario_id) {
      // Buscar salário base do backend (busca do contrato/funcionário/cargo)
      folhaPagamentoApi.getSalarioBase(formData.funcionario_id)
        .then((data) => {
          const salarioBase = data.salario_base || data.salarioBase || 0;
          setFormData(prev => ({ ...prev, salario_base: salarioBase }));
        })
        .catch((error) => {
          console.error('Erro ao buscar salário base:', error);
          // Se houver erro, tenta buscar do objeto funcionário local como fallback
          const func = funcionarios.find((f: Funcionario) => f.id === formData.funcionario_id);
          if (func) {
            const salario = func.salario || func.salario_base || 0;
            setFormData(prev => ({ ...prev, salario_base: salario }));
          }
        });
    }
  }, [formData.funcionario_id, funcionarios]);

  // Carregar descontos por faltas automaticamente quando funcionário, mês ou ano mudarem
  useEffect(() => {
    if (formData.funcionario_id && selectedMonth && selectedYear) {
      folhaPagamentoApi.calcularDescontos(formData.funcionario_id, selectedMonth, selectedYear)
        .then((resultado) => {
          setFormData(prev => ({
            ...prev,
            descontos_faltas: resultado.descontos_faltas || 0,
          }));
        })
        .catch((error) => {
          console.error('Erro ao calcular descontos:', error);
          // Em caso de erro, apenas define como 0
          setFormData(prev => ({
            ...prev,
            descontos_faltas: 0,
          }));
        });
    }
  }, [formData.funcionario_id, selectedMonth, selectedYear]);

  // Recalcular INSS automaticamente quando o salário base mudar
  useEffect(() => {
    if (formData.salario_base > 0) {
      // Calcular INSS (3% sobre salário base) - padrão Angola
      const inssCalculado = formData.salario_base * 0.03;

      setFormData(prev => ({
        ...prev,
        inss: Math.round(inssCalculado * 100) / 100,
      }));
    } else {
      // Reset INSS se salário base for 0
      setFormData(prev => ({
        ...prev,
        inss: 0,
      }));
    }
  }, [formData.salario_base]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch folhas
  const { data: folhas = [], isLoading } = useQuery({
    queryKey: ['folha-pagamento', selectedMonth, selectedYear, instituicaoId],
    queryFn: async () => {
      return folhaPagamentoApi.getAll({
        mes: selectedMonth,
        ano: selectedYear,
      });
    },
    enabled: !!instituicaoId || isSuperAdmin || isStaffWithFallback(role),
  });

  // Save mutation (CREATE)
  const saveMutation = useSafeMutation({
    mutationFn: async (data: any) => {
      if (editingFolha) {
        // UPDATE: Apenas se estiver editando e folha não estiver fechada
        return folhaPagamentoApi.update(editingFolha.id, data);
      } else {
        // CREATE
        return folhaPagamentoApi.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folha-pagamento'] });
      toast.success(editingFolha ? 'Folha de pagamento atualizada com sucesso' : 'Folha de pagamento salva com sucesso');
      setShowDialog(false);
      resetForm();
      setEditingFolha(null);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || (editingFolha ? 'Erro ao atualizar folha de pagamento' : 'Erro ao salvar folha de pagamento');
      toast.error(errorMessage);
    },
  });

  // REMOVIDO: approveMutation - usar fluxo FECHAR → PAGAR
  // O endpoint legado 'aprovar' ainda existe no backend para compatibilidade,
  // mas o fluxo correto é: DRAFT/CALCULATED → FECHAR (CLOSED) → PAGAR (PAID)

  // Função para calcular salário líquido no frontend (apenas para exibição)
  const calcularSalarioLiquido = () => {
    const totalBeneficios = 
      (formData.beneficio_transporte || 0) + 
      (formData.beneficio_alimentacao || 0) + 
      (formData.outros_beneficios || 0) +
      (formData.bonus || 0) +
      (formData.valor_horas_extras || 0);
    
    const totalDescontos = 
      (formData.descontos_faltas || 0) + 
      (formData.outros_descontos || 0) +
      (formData.inss || 0) +
      (formData.irt || 0);
    
    const salarioLiquido = (formData.salario_base || 0) + totalBeneficios - totalDescontos;
    return Math.max(0, Math.round(salarioLiquido * 100) / 100); // Garantir que não seja negativo e arredondar
  };

  // Mutation para cálculo automático
  const calcularAutomaticoMutation = useSafeMutation({
    mutationFn: async (data: { funcionarioId: string; mes: string | number }) => {
      return folhaPagamentoApi.calcularAutomatico(data);
    },
    onSuccess: (resultado) => {
      // Preencher todos os campos automaticamente com valores calculados
      setFormData(prev => ({
        ...prev,
        salario_base: resultado.salario_base || resultado.salarioBase || prev.salario_base,
        descontos_faltas: resultado.descontos_faltas || resultado.descontosFaltas || 0,
        horas_extras: resultado.horas_extras || resultado.horasExtras || 0,
        valor_horas_extras: resultado.valor_horas_extras || resultado.valorHorasExtras || 0,
        inss: resultado.inss || 0,
        irt: resultado.irt || 0,
      }));

      // Mensagem de sucesso detalhada
      const dadosPresenca = resultado.dados_presenca || resultado.dadosPresenca || {};
      toast.success(
        `Cálculo automático concluído!\n` +
        `• ${dadosPresenca.total_presencas || dadosPresenca.totalPresencas || 0} presenças registradas\n` +
        `• ${resultado.total_faltas_nao_justificadas || resultado.totalFaltasNaoJustificadas || 0} falta(s) = Kz ${(resultado.descontos_faltas || resultado.descontosFaltas || 0).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}\n` +
        `• ${resultado.horas_extras || resultado.horasExtras || 0}h extras = Kz ${(resultado.valor_horas_extras || resultado.valorHorasExtras || 0).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}\n` +
        `• Salário Líquido: Kz ${(resultado.salario_liquido || resultado.salarioLiquido || 0).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}`,
        { duration: 6000 }
      );
    },
    onError: (error: any) => {
      console.error('Erro ao calcular automaticamente:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Erro ao calcular automaticamente';
      toast.error(errorMessage);
    },
  });

  const handleCalculate = async () => {
    if (!formData.funcionario_id) {
      toast.error('Selecione um funcionário');
      return;
    }

    // Formato de mês: "YYYY-MM"
    const mesFormatado = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    
    calcularAutomaticoMutation.mutate({
      funcionarioId: formData.funcionario_id,
      mes: mesFormatado,
    });
  };

  const handleSave = () => {
    if (!formData.funcionario_id) {
      toast.error('Selecione um funcionário');
      return;
    }

    if (!formData.salario_base || formData.salario_base <= 0) {
      toast.error('Salário base deve ser maior que zero. Verifique se o funcionário possui um contrato ativo ou salário cadastrado.');
      return;
    }

    // Backend busca o salário base automaticamente e calcula descontos por faltas e salário líquido
    // Não precisamos enviar salarioBase nem descontosFaltas - o backend calcula automaticamente
    // Para UPDATE: O backend recalcula automaticamente tudo (descontos, horas extras, INSS, salário líquido)
    const payload: any = {
      funcionarioId: formData.funcionario_id,
      // salarioBase: NÃO enviar - o backend busca automaticamente do funcionário/contrato/cargo
      // descontosFaltas: NÃO enviar - o backend calcula automaticamente baseado nas faltas não justificadas
      // horasExtras e valorHorasExtras: NÃO enviar - o backend recalcula automaticamente da frequência biométrica
      bonus: formData.bonus || 0,
      beneficioTransporte: formData.beneficio_transporte || 0,
      beneficioAlimentacao: formData.beneficio_alimentacao || 0,
      outrosBeneficios: formData.outros_beneficios || 0,
      outrosDescontos: formData.outros_descontos || 0,
      inss: formData.inss || 0, // Pode ser editado, mas backend recalcula se salário base mudar
      irt: formData.irt || 0,
      // salarioLiquido será calculado no backend automaticamente
      observacoes: formData.observacoes || null,
    };

    // Apenas enviar mes/ano se for CREATE (não pode ser alterado no UPDATE)
    if (!editingFolha) {
      payload.mes = selectedMonth;
      payload.ano = selectedYear;
    }

    saveMutation.mutate(payload);
  };

  const resetForm = () => {
    setFormData({
      funcionario_id: '',
      salario_base: 0,
      descontos_faltas: 0,
      horas_extras: 0,
      valor_horas_extras: 0,
      bonus: 0,
      beneficio_transporte: 0,
      beneficio_alimentacao: 0,
      outros_beneficios: 0,
      outros_descontos: 0,
      inss: 0,
      irt: 0,
      observacoes: ''
    });
    setEditingFolha(null);
  };

  const handleView = (folha: FolhaPagamento) => {
    setSelectedFolha(folha);
    const func = funcionarios.find((f: Funcionario) => f.id === folha.funcionario_id);
    setSelectedFuncionarioData(func || null);
    setShowViewDialog(true);
  };

  const handleEdit = (folha: FolhaPagamento) => {
    // VALIDAÇÃO: Bloquear edição se folha está FECHADA ou PAGA
    if (isFolhaFechada(folha.status)) {
      const statusMsg = folha.status?.toUpperCase() === 'CLOSED' 
        ? 'FECHADA. Reabra a folha primeiro.' 
        : 'PAGA. Folhas pagas são imutáveis.';
      toast.error(`Não é possível editar uma folha ${statusMsg}`);
      return;
    }
    
    setEditingFolha(folha);
    setFormData({
      funcionario_id: folha.funcionario_id,
      salario_base: folha.salario_base,
      descontos_faltas: folha.descontos_faltas,
      horas_extras: folha.horas_extras,
      valor_horas_extras: folha.valor_horas_extras,
      bonus: folha.bonus,
      beneficio_transporte: folha.beneficio_transporte,
      beneficio_alimentacao: folha.beneficio_alimentacao,
      outros_beneficios: folha.outros_beneficios,
      outros_descontos: folha.outros_descontos,
      inss: folha.inss,
      irt: folha.irt,
      observacoes: folha.observacoes || ''
    });
    setShowDialog(true);
  };

  const handleNew = () => {
    resetForm();
    setEditingFolha(null);
    setShowDialog(true);
  };

  const buildReciboData = (folhaItem: FolhaPagamento): ReciboFolhaPagamentoData | null => {
    const func = funcionarios.find((f: Funcionario) => f.id === folhaItem.funcionario_id);
    const nome = folhaItem.funcionario?.nome_completo ?? func?.profiles?.nome_completo ?? func?.nome_completo ?? '';
    if (!nome) return null;
    const lastDay = new Date(folhaItem.ano, folhaItem.mes, 0);
    const dataFechoStr = `${String(lastDay.getDate()).padStart(2, '0')}/${String(lastDay.getMonth() + 1).padStart(2, '0')}/${lastDay.getFullYear()}`;
    return {
      instituicao: {
        nome: config?.nome_instituicao || 'Instituição',
        logoUrl: config?.logo_url,
        endereco: config?.endereco,
        telefone: config?.telefone,
        email: config?.email,
        nif: (config as { nif?: string })?.nif,
      },
      funcionario: {
        nome,
        numeroId: folhaItem.funcionario?.numero_identificacao ?? (func as { numero_identificacao?: string })?.numero_identificacao,
        cargo: folhaItem.funcionario?.cargo ?? func?.cargo?.nome ?? func?.cargos?.nome ?? undefined,
        email: folhaItem.funcionario?.email ?? func?.profiles?.email ?? func?.email,
        departamento: folhaItem.funcionario?.departamento ?? undefined,
      },
      folha: {
        mes: folhaItem.mes,
        ano: folhaItem.ano,
        dias_uteis: folhaItem.dias_uteis,
        valor_dia: folhaItem.valor_dia,
        valor_hora: folhaItem.valor_hora,
        salario_base: folhaItem.salario_base,
        bonus: folhaItem.bonus,
        valor_horas_extras: folhaItem.valor_horas_extras,
        beneficio_transporte: folhaItem.beneficio_transporte,
        beneficio_alimentacao: folhaItem.beneficio_alimentacao,
        outros_beneficios: folhaItem.outros_beneficios,
        descontos_faltas: folhaItem.descontos_faltas,
        inss: folhaItem.inss,
        irt: folhaItem.irt,
        outros_descontos: folhaItem.outros_descontos,
        salario_liquido: folhaItem.salario_liquido,
      },
      reciboNumero: `REC-${folhaItem.mes}${folhaItem.ano}-${folhaItem.id.substring(0, 6)}`,
      dataFecho: dataFechoStr,
      formaPagamento: folhaItem.metodo_pagamento || folhaItem.forma_pagamento || 'Transferência',
    };
  };

  const generateReciboPDF = async (folha: FolhaPagamento, allFolhas?: FolhaPagamento[]) => {
    const lista = allFolhas && allFolhas.length > 0 ? allFolhas : [folha];
    const dataArray = lista.map((f) => buildReciboData(f)).filter((d): d is ReciboFolhaPagamentoData => d != null);
    if (dataArray.length === 0) {
      toast.error('Nenhum funcionário encontrado para gerar recibo');
      return;
    }
    try {
      const blob = dataArray.length === 1
        ? await gerarReciboFolhaPagamentoPDF(dataArray[0])
        : await gerarMultiplosRecibosFolhaPDF(dataArray);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = dataArray.length === 1
        ? `recibo-${dataArray[0].funcionario.nome.replace(/\s+/g, '_')}-${folha.mes}-${folha.ano}.pdf`
        : `recibos-${selectedMonth}-${selectedYear}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(dataArray.length === 1 ? 'Recibo gerado com sucesso' : `${dataArray.length} recibos gerados com sucesso`);
    } catch (err) {
      toast.error('Erro ao gerar recibo');
    }
  };

  // Mutation para fechar folha
  const fecharFolhaMutation = useSafeMutation({
    mutationFn: (data: { id: string; enviarReciboEmail?: boolean }) =>
      folhaPagamentoApi.fechar(data.id, { enviarReciboEmail: data.enviarReciboEmail }),
    onSuccess: (data: { recibo_email_enviado?: boolean; recibo_email_mensagem?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['folha-pagamento'] });
      toast.success('Folha de pagamento fechada com sucesso. A folha agora está bloqueada para edições.');
      if (data?.recibo_email_enviado === true) {
        toast.success('Recibo enviado por e-mail ao funcionário.');
      } else if (data?.recibo_email_enviado === false && data?.recibo_email_mensagem) {
        toast.warning(`Recibo não enviado por e-mail: ${data.recibo_email_mensagem}`);
      }
      setShowFecharDialog(false);
      setSelectedFolha(null);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || 'Erro ao fechar folha de pagamento';
      toast.error(errorMessage);
    },
  });

  // Mutation para reabrir folha
  const reabrirFolhaMutation = useSafeMutation({
    mutationFn: ({ id, justificativa }: { id: string; justificativa: string }) => 
      folhaPagamentoApi.reabrir(id, justificativa),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folha-pagamento'] });
      toast.success('Folha de pagamento reaberta com sucesso. A folha agora pode ser editada novamente.');
      setShowReabrirDialog(false);
      setSelectedFolha(null);
      setJustificativaReabertura('');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || 'Erro ao reabrir folha de pagamento';
      toast.error(errorMessage);
    },
  });

  // Mutation para pagar folha
  const pagarMutation = useSafeMutation({
    mutationFn: (data: { id: string; metodoPagamento: string; referencia?: string; observacaoPagamento?: string; enviarReciboEmail?: boolean }) =>
      folhaPagamentoApi.pagar(data.id, {
        metodoPagamento: data.metodoPagamento as 'TRANSFERENCIA' | 'CASH' | 'MOBILE_MONEY' | 'CHEQUE',
        referencia: data.referencia,
        observacaoPagamento: data.observacaoPagamento,
        enviarReciboEmail: data.enviarReciboEmail,
      }),
    onSuccess: (data: { recibo_email_enviado?: boolean; recibo_email_mensagem?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['folha-pagamento'] });
      toast.success('Folha de pagamento marcada como PAGA com sucesso');
      if (data?.recibo_email_enviado === true) {
        toast.success('Recibo enviado por e-mail ao funcionário.');
      } else if (data?.recibo_email_enviado === false && data?.recibo_email_mensagem) {
        toast.warning(`Recibo não enviado por e-mail: ${data.recibo_email_mensagem}`);
      }
      setShowPagarDialog(false);
      setSelectedFolha(null);
      setPagamentoForm({
        metodoPagamento: 'TRANSFERENCIA',
        referencia: '',
        observacaoPagamento: '',
        enviarReciboEmail: true,
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || 'Erro ao marcar folha como paga';
      toast.error(errorMessage);
    },
  });

  // Mutation para reverter pagamento
  const reverterPagamentoMutation = useSafeMutation({
    mutationFn: (data: { id: string; justificativa: string }) => 
      folhaPagamentoApi.reverterPagamento(data.id, data.justificativa),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folha-pagamento'] });
      toast.success('Pagamento revertido com sucesso');
      setShowReverterPagamentoDialog(false);
      setSelectedFolha(null);
      setJustificativaReverterPagamento('');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || 'Erro ao reverter pagamento';
      toast.error(errorMessage);
    },
  });

  const getStatusBadge = (status: string) => {
    const statusUpper = status?.toUpperCase() || '';
    switch (statusUpper) {
      case 'PAID':
      case 'PAGO':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><Check className="h-3 w-3 mr-1" />Pago</Badge>;
      case 'DRAFT':
      case 'RASCUNHO':
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">Rascunho</Badge>;
      case 'CALCULATED':
      case 'CALCULADA':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Calculada</Badge>;
      case 'CLOSED':
      case 'FECHADA':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><Lock className="h-3 w-3 mr-1" />Fechada</Badge>;
      case 'PENDENTE':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pendente</Badge>;
      case 'CANCELADO':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isFolhaFechada = (status: string): boolean => {
    const statusUpper = status?.toUpperCase() || '';
    return statusUpper === 'CLOSED' || statusUpper === 'PAID';
  };

  const handleFecharFolha = (folha: FolhaPagamento) => {
    setSelectedFolha(folha);
    setShowFecharDialog(true);
  };

  const handleReabrirFolha = (folha: FolhaPagamento) => {
    setSelectedFolha(folha);
    setJustificativaReabertura('');
    setShowReabrirDialog(true);
  };

  const handlePagarFolha = (folha: FolhaPagamento) => {
    setSelectedFolha(folha);
    setPagamentoForm({
      metodoPagamento: 'TRANSFERENCIA',
      referencia: '',
      observacaoPagamento: '',
      enviarReciboEmail: true,
    });
    setShowPagarDialog(true);
  };

  const handleReverterPagamento = (folha: FolhaPagamento) => {
    setSelectedFolha(folha);
    setJustificativaReverterPagamento('');
    setShowReverterPagamentoDialog(true);
  };

  const handleDelete = (folha: FolhaPagamento) => {
    setSelectedFolha(folha);
    setShowDeleteDialog(true);
  };

  const handleConfirmarPagamento = () => {
    if (!selectedFolha) return;
    if (!pagamentoForm.metodoPagamento) {
      toast.error('Selecione um método de pagamento');
      return;
    }
    pagarMutation.mutate({
      id: selectedFolha.id,
      metodoPagamento: pagamentoForm.metodoPagamento,
      referencia: pagamentoForm.referencia || undefined,
      observacaoPagamento: pagamentoForm.observacaoPagamento || undefined,
      enviarReciboEmail: pagamentoForm.enviarReciboEmail,
    });
  };

  const handleConfirmarReverterPagamento = () => {
    if (!selectedFolha) return;
    if (!justificativaReverterPagamento.trim()) {
      toast.error('Justificativa é obrigatória');
      return;
    }
    reverterPagamentoMutation.mutate({
      id: selectedFolha.id,
      justificativa: justificativaReverterPagamento,
    });
  };

  // Mutation para deletar folha
  const deleteMutation = useSafeMutation({
    mutationFn: (id: string) => folhaPagamentoApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folha-pagamento'] });
      toast.success('Folha de pagamento excluída com sucesso');
      setShowDeleteDialog(false);
      setSelectedFolha(null);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || 'Erro ao excluir folha de pagamento';
      toast.error(errorMessage);
    },
  });

  const handleConfirmarDelete = () => {
    if (!selectedFolha) return;
    deleteMutation.mutate(selectedFolha.id);
  };

  const getFuncionarioNome = (funcId: string) => {
    const func = funcionarios.find((f: Funcionario) => f.id === funcId);
    return func?.profiles?.nome_completo || func?.nome_completo || 'N/A';
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

  const metodosPagamento = [
    { id: 'TRANSFERENCIA', label: 'Transferência Bancária' },
    { id: 'CASH', label: 'Dinheiro (Cash)' },
    { id: 'MOBILE_MONEY', label: 'Mobile Money' },
    { id: 'CHEQUE', label: 'Cheque' },
  ];

  const searchMeses = useMemo(() => async (term: string): Promise<SmartSearchItem[]> => {
    if (!String(term ?? "").trim()) return meses.map(m => ({ id: m.value.toString(), nome: m.label, nomeCompleto: m.label }));
    const search = String(term ?? "").toLowerCase().trim();
    return meses
      .filter(m => String(m.label ?? '').toLowerCase().includes(search) || String(m.value).includes(search))
      .map(m => ({ id: m.value.toString(), nome: m.label, nomeCompleto: m.label }));
  }, []);

  const searchAnos = useMemo(() => {
    const yrs = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
    return async (term: string): Promise<SmartSearchItem[]> => {
      if (!term?.trim()) return yrs.map(y => ({ id: y.toString(), nome: y.toString(), nomeCompleto: y.toString() }));
      const search = term.trim();
      return yrs.filter(y => y.toString().includes(search)).map(y => ({ id: y.toString(), nome: y.toString(), nomeCompleto: y.toString() }));
    };
  }, [currentYear]);

  const searchMetodosPagamento = useMemo(() => async (term: string): Promise<SmartSearchItem[]> => {
    if (!String(term ?? "").trim()) return metodosPagamento.map(m => ({ id: m.id, nome: m.label, nomeCompleto: m.label }));
    const search = String(term ?? "").toLowerCase().trim();
    return metodosPagamento
      .filter(m => String(m.label ?? '').toLowerCase().includes(search) || String(m.id ?? '').toLowerCase().includes(search))
      .map(m => ({ id: m.id, nome: m.label, nomeCompleto: m.label }));
  }, []);

  const totalFolha = folhas.reduce((acc: number, f: FolhaPagamento) => acc + f.salario_liquido, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Folha de Pagamento
            </CardTitle>
            <CardDescription>
              Gerencie salários e benefícios dos funcionários
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {folhas.length > 0 && (
              <Button variant="outline" onClick={() => generateReciboPDF(folhas[0], folhas)}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Todos
              </Button>
            )}
            {canGerar && (
              <Button onClick={handleNew}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Folha
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-full sm:w-[180px] min-w-0">
            <Label className="text-xs text-muted-foreground">Mês</Label>
            <SmartSearch
              placeholder="Digite para buscar mês..."
              value={meses.find(m => m.value === selectedMonth)?.label || ''}
              selectedId={selectedMonth.toString()}
              onSelect={(item) => item && setSelectedMonth(parseInt(item.id))}
              onClear={() => setSelectedMonth(new Date().getMonth() + 1)}
              searchFn={searchMeses}
              minSearchLength={0}
              maxResults={12}
              emptyMessage="Nenhum mês encontrado"
              getDisplayName={(item) => item.nome || item.nomeCompleto || ''}
              silent
            />
          </div>
          <div className="w-full sm:w-[140px] min-w-0">
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <SmartSearch
              placeholder="Digite para buscar ano..."
              value={selectedYear.toString()}
              selectedId={selectedYear.toString()}
              onSelect={(item) => item && setSelectedYear(parseInt(item.id))}
              onClear={() => setSelectedYear(new Date().getFullYear())}
              searchFn={searchAnos}
              minSearchLength={0}
              maxResults={5}
              emptyMessage="Nenhum ano encontrado"
              getDisplayName={(item) => item.nome || item.id || ''}
              silent
            />
          </div>
          <div className="flex-1" />
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total da Folha</p>
            <p className="text-2xl font-bold text-primary">Kz {totalFolha.toLocaleString('pt-AO')}</p>
          </div>
        </div>

        {/* Pesquisa Inteligente */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do funcionário, cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabela */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : folhas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma folha de pagamento encontrada para este período
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto -mx-1 sm:mx-0 max-w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="text-right">Salário Base</TableHead>
                  <TableHead className="text-right">Benefícios</TableHead>
                  <TableHead className="text-right">Descontos</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {folhas
                  .filter((folha: FolhaPagamento) => {
                    if (!debouncedSearchTerm) return true;
                    const func = funcionarios.find((f: Funcionario) => f.id === folha.funcionario_id);
                    const nome = String(func?.profiles?.nome_completo ?? func?.nome_completo ?? '').toLowerCase();
                    const cargoNome = String(func?.cargo?.nome ?? func?.cargos?.nome ?? '').toLowerCase();
                    const search = String(debouncedSearchTerm ?? '').toLowerCase();
                    return nome.includes(search) || cargoNome.includes(search);
                  })
                  .map((folha: FolhaPagamento) => {
                    const totalBeneficios = folha.beneficio_transporte + folha.beneficio_alimentacao + 
                      folha.outros_beneficios + folha.bonus + folha.valor_horas_extras;
                    const totalDescontos = folha.descontos_faltas + folha.inss + folha.irt + folha.outros_descontos;
                    
                    return (
                      <TableRow key={folha.id}>
                        <TableCell>{getFuncionarioNome(folha.funcionario_id)}</TableCell>
                        <TableCell className="text-right">Kz {folha.salario_base.toLocaleString('pt-AO')}</TableCell>
                        <TableCell className="text-right text-green-600">+Kz {totalBeneficios.toLocaleString('pt-AO')}</TableCell>
                        <TableCell className="text-right text-red-600">-Kz {totalDescontos.toLocaleString('pt-AO')}</TableCell>
                        <TableCell className="text-right font-bold">Kz {folha.salario_liquido.toLocaleString('pt-AO')}</TableCell>
                        <TableCell>{getStatusBadge(folha.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleView(folha)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {!isFolhaFechada(folha.status) && canGerar && (
                              <>
                                {(folha.status?.toUpperCase() === 'DRAFT' || folha.status?.toUpperCase() === 'CALCULATED') && (
                                  <>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleEdit(folha)}
                                      title="Editar folha"
                                    >
                                      <Pencil className="h-4 w-4 text-blue-600" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleFecharFolha(folha)}
                                      title="Fechar folha"
                                    >
                                      <Lock className="h-4 w-4 text-orange-600" />
                                    </Button>
                                    {folha.status?.toUpperCase() === 'DRAFT' && canCancelar && (
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => handleDelete(folha)}
                                        title="Excluir folha (apenas DRAFT)"
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                            {isFolhaFechada(folha.status) && folha.status?.toUpperCase() === 'CLOSED' && (
                              <>
                                {canMarcar && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handlePagarFolha(folha)}
                                    title="Marcar como paga"
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    <CreditCard className="h-4 w-4" />
                                  </Button>
                                )}
                                {canCancelar && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleReabrirFolha(folha)}
                                    title="Reabrir folha (apenas ADMIN)"
                                  >
                                    <Unlock className="h-4 w-4 text-blue-600" />
                                  </Button>
                                )}
                              </>
                            )}
                            {folha.status?.toUpperCase() === 'PAID' && canCancelar && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleReverterPagamento(folha)}
                                title="Reverter pagamento (apenas ADMIN)"
                                className="text-red-600 hover:text-red-700"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => generateReciboPDF(folha)} title="Imprimir recibo">
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog Nova/Editar Folha */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        if (!open) {
          setShowDialog(false);
          resetForm();
        } else {
          setShowDialog(open);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFolha ? 'Editar Folha de Pagamento' : 'Nova Folha de Pagamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Funcionário *</Label>
                <SmartSearch
                  key={`func-folha-${showDialog ? formData.funcionario_id || 'new' : 'closed'}`}
                  placeholder="Digite o nome do funcionário, cargo ou email para buscar..."
                  value={getFuncionarioDisplayName(formData.funcionario_id)}
                  selectedId={formData.funcionario_id || undefined}
                  onSelect={(item) => {
                    setFormData((prev) => ({ ...prev, funcionario_id: item ? item.id : '' }));
                  }}
                  onClear={() => {
                    setFormData((prev) => ({ ...prev, funcionario_id: '' }));
                  }}
                  searchFn={searchFuncionarios}
                  minSearchLength={1}
                  maxResults={15}
                  getSubtitle={(item) => (item.complemento ? `Cargo: ${item.complemento}` : item.email || '')}
                  emptyMessage="Nenhum funcionário encontrado"
                  loadingMessage="Buscando..."
                  disabled={isLoadingFuncionarios}
                  silent
                />
              </div>
              <div className="col-span-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCalculate} 
                  className="w-full"
                  disabled={!formData.funcionario_id || calcularAutomaticoMutation.isPending}
                >
                  <Calculator className="mr-2 h-4 w-4" />
                  {calcularAutomaticoMutation.isPending ? 'Calculando...' : 'Calcular Automaticamente'}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Calcula automaticamente baseado em presenças biométricas do mês
                </p>
              </div>
              <div>
                <Label>Salário Base *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.salario_base || 0}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                  title="O salário base é herdado automaticamente do contrato/funcionário/cargo. Não pode ser editado manualmente."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Valor herdado automaticamente do contrato/funcionário/cargo
                </p>
              </div>
              <div>
                <Label>Descontos por Faltas</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.descontos_faltas || 0}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                  title="Os descontos são calculados automaticamente baseados nas faltas não justificadas do mês. Não pode ser editado manualmente."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Valor calculado automaticamente baseado nas faltas não justificadas (salário base ÷ dias úteis × faltas)
                </p>
              </div>
              <div>
                <Label>Bônus</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.bonus || 0}
                  onChange={(e) => setFormData({ ...formData, bonus: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Horas Extras</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.horas_extras || 0}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                  title="Horas extras são calculadas automaticamente baseadas nas presenças biométricas. Não pode ser editado manualmente."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Calculado automaticamente das presenças biométricas
                </p>
              </div>
              <div>
                <Label>Valor Horas Extras</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor_horas_extras || 0}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                  title="Valor das horas extras é calculado automaticamente. Não pode ser editado manualmente."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Calculado automaticamente baseado nas horas extras
                </p>
              </div>
              <div>
                <Label>Benefício Transporte</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.beneficio_transporte || 0}
                  onChange={(e) => setFormData({ ...formData, beneficio_transporte: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Benefício Alimentação</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.beneficio_alimentacao || 0}
                  onChange={(e) => setFormData({ ...formData, beneficio_alimentacao: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Outros Benefícios</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.outros_beneficios || 0}
                  onChange={(e) => setFormData({ ...formData, outros_beneficios: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Outros Descontos</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.outros_descontos || 0}
                  onChange={(e) => setFormData({ ...formData, outros_descontos: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>INSS (3% - calculado automaticamente)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.inss || 0}
                  onChange={(e) => setFormData({ ...formData, inss: parseFloat(e.target.value) || 0 })}
                  title="INSS é calculado automaticamente como 3% do salário base. Pode ser ajustado manualmente se necessário."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Calculado automaticamente como 3% do salário base. Pode ser ajustado manualmente se necessário.
                </p>
              </div>
              <div>
                <Label>IRT</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.irt || 0}
                  onChange={(e) => setFormData({ ...formData, irt: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                />
              </div>
              <div className="col-span-2 p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Salário Líquido:</span>
                  <span className="text-2xl font-bold text-primary">
                    Kz {calcularSalarioLiquido().toLocaleString('pt-AO')}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (editingFolha ? 'Atualizando...' : 'Salvando...') : (editingFolha ? 'Atualizar' : 'Salvar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Visualizar */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Folha de Pagamento</DialogTitle>
          </DialogHeader>
          {selectedFolha && selectedFuncionarioData && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Funcionário</p>
                <p className="font-medium">{selectedFuncionarioData.profiles?.nome_completo || selectedFuncionarioData.nome_completo}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Mês/Ano</p>
                  <p className="font-medium">{meses.find(m => m.value === selectedFolha.mes)?.label} / {selectedFolha.ano}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedFolha.status)}
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="font-medium mb-2">Rendimentos</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Salário Base</span>
                    <span>Kz {selectedFolha.salario_base.toLocaleString('pt-AO')}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Bônus</span>
                    <span>+Kz {selectedFolha.bonus.toLocaleString('pt-AO')}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Horas Extras</span>
                    <span>+Kz {selectedFolha.valor_horas_extras.toLocaleString('pt-AO')}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Benefícios</span>
                    <span>+Kz {(selectedFolha.beneficio_transporte + selectedFolha.beneficio_alimentacao + selectedFolha.outros_beneficios).toLocaleString('pt-AO')}</span>
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="font-medium mb-2">Descontos</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-red-600">
                    <span>Faltas</span>
                    <span>-Kz {selectedFolha.descontos_faltas.toLocaleString('pt-AO')}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>INSS</span>
                    <span>-Kz {selectedFolha.inss.toLocaleString('pt-AO')}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>IRT</span>
                    <span>-Kz {selectedFolha.irt.toLocaleString('pt-AO')}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Outros</span>
                    <span>-Kz {selectedFolha.outros_descontos.toLocaleString('pt-AO')}</span>
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Salário Líquido</span>
                  <span className="text-2xl font-bold text-primary">Kz {selectedFolha.salario_liquido.toLocaleString('pt-AO')}</span>
                </div>
              </div>

              {/* Informações de Fechamento/Reabertura */}
              {selectedFolha.fechado_em && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2 text-muted-foreground">Informações de Fechamento</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Fechada em:</span>
                      <span>{format(new Date(selectedFolha.fechado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                    {selectedFolha.reaberto_em && (
                      <>
                        <div className="flex justify-between">
                          <span>Reaberta em:</span>
                          <span>{format(new Date(selectedFolha.reaberto_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        </div>
                        {selectedFolha.justificativa_reabertura && (
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                            <p className="text-xs font-medium text-blue-900 mb-1">Justificativa da Reabertura:</p>
                            <p className="text-xs text-blue-800">{selectedFolha.justificativa_reabertura}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Informações de Pagamento */}
              {selectedFolha.status?.toUpperCase() === 'PAID' && selectedFolha.pago_em && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2 text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-green-600" />
                    Dados do Pagamento
                  </p>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-md space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-900">Pago em:</span>
                      <span className="font-medium text-green-900">
                        {format(new Date(selectedFolha.pago_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {selectedFolha.metodo_pagamento && (
                      <div className="flex justify-between">
                        <span className="text-green-900">Método:</span>
                        <span className="font-medium text-green-900">{selectedFolha.metodo_pagamento}</span>
                      </div>
                    )}
                    {selectedFolha.referencia && (
                      <div className="flex justify-between">
                        <span className="text-green-900">Referência:</span>
                        <span className="font-medium text-green-900">{selectedFolha.referencia}</span>
                      </div>
                    )}
                    {selectedFolha.observacao_pagamento && (
                      <div className="mt-2 pt-2 border-t border-green-300">
                        <p className="text-xs font-medium text-green-900 mb-1">Observação:</p>
                        <p className="text-xs text-green-800">{selectedFolha.observacao_pagamento}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Fechar
            </Button>
            {selectedFolha && selectedFolha.status?.toUpperCase() === 'PAID' && (
              <Button onClick={() => generateReciboPDF(selectedFolha)}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Recibo de Pagamento
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Fechar Folha */}
      <AlertDialog open={showFecharDialog} onOpenChange={setShowFecharDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-orange-600" />
              Fechar Folha de Pagamento
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Tem certeza que deseja <strong>FECHAR</strong> esta folha de pagamento?
              </p>
              {selectedFolha && (
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-md">
                  <p className="text-sm font-medium text-orange-900 mb-2">
                    Funcionário: {getFuncionarioNome(selectedFolha.funcionario_id)}
                  </p>
                  <p className="text-sm text-orange-800">
                    Período: {meses.find(m => m.value === selectedFolha.mes)?.label} / {selectedFolha.ano}
                  </p>
                  <p className="text-sm font-bold text-orange-900 mt-2">
                    Salário Líquido: Kz {selectedFolha.salario_liquido.toLocaleString('pt-AO', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
              <div className="mt-4 flex items-center space-x-2">
                <Checkbox
                  id="enviarReciboFechar"
                  checked={enviarReciboEmailFechar}
                  onCheckedChange={(v) => setEnviarReciboEmailFechar(!!v)}
                />
                <Label htmlFor="enviarReciboFechar" className="text-sm font-normal cursor-pointer">
                  Enviar recibo por e-mail ao funcionário (usa o e-mail cadastrado)
                </Label>
              </div>
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-bold text-red-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  ATENÇÃO: Esta ação é IRREVERSÍVEL sem autorização especial
                </p>
                <ul className="text-xs text-red-800 mt-2 space-y-1 list-disc list-inside">
                  <li>A folha ficará BLOQUEADA para edições</li>
                  <li>Não será possível alterar valores</li>
                  <li>Não será possível excluir a folha</li>
                  <li>Apenas ADMIN pode reabrir após o fechamento</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedFolha) {
                  fecharFolhaMutation.mutate({ id: selectedFolha.id, enviarReciboEmail: enviarReciboEmailFechar });
                }
              }}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={fecharFolhaMutation.isPending}
            >
              {fecharFolhaMutation.isPending ? 'Fechando...' : 'Confirmar Fechamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Reabrir Folha */}
      <AlertDialog open={showReabrirDialog} onOpenChange={setShowReabrirDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-blue-600" />
              Reabrir Folha de Pagamento
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Você está prestes a <strong>REABRIR</strong> uma folha de pagamento FECHADA.
              </p>
              {selectedFolha && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    Funcionário: {getFuncionarioNome(selectedFolha.funcionario_id)}
                  </p>
                  <p className="text-sm text-blue-800">
                    Período: {meses.find(m => m.value === selectedFolha.mes)?.label} / {selectedFolha.ano}
                  </p>
                  {selectedFolha.fechado_em && (
                    <p className="text-xs text-blue-700 mt-2">
                      Fechada em: {format(new Date(selectedFolha.fechado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="justificativa">Justificativa *</Label>
                <Textarea
                  id="justificativa"
                  placeholder="Descreva o motivo da reabertura (obrigatório)"
                  value={justificativaReabertura}
                  onChange={(e) => setJustificativaReabertura(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Esta justificativa será registrada no log de auditoria e não pode ser deixada em branco.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setJustificativaReabertura('')}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedFolha && justificativaReabertura.trim()) {
                  reabrirFolhaMutation.mutate({
                    id: selectedFolha.id,
                    justificativa: justificativaReabertura.trim(),
                  });
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={reabrirFolhaMutation.isPending || !justificativaReabertura.trim()}
            >
              {reabrirFolhaMutation.isPending ? 'Reabrindo...' : 'Confirmar Reabertura'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Pagar Folha */}
      <AlertDialog open={showPagarDialog} onOpenChange={setShowPagarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-600" />
              Efetuar Pagamento
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Marque esta folha como <strong>PAGA</strong>. Esta ação é <strong>irreversível</strong> sem permissão de administrador.
              </p>
              {selectedFolha && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm font-medium text-green-900 mb-2">
                    Funcionário: {getFuncionarioNome(selectedFolha.funcionario_id)}
                  </p>
                  <p className="text-sm text-green-800">
                    Período: {meses.find(m => m.value === selectedFolha.mes)?.label} / {selectedFolha.ano}
                  </p>
                  <p className="text-lg font-bold text-green-900 mt-2">
                    Valor: Kz {selectedFolha.salario_liquido.toLocaleString('pt-AO')}
                  </p>
                </div>
              )}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="metodoPagamento">Método de Pagamento *</Label>
                  <SmartSearch
                    key={`metodo-pagar-${showPagarDialog ? pagamentoForm.metodoPagamento : 'closed'}`}
                    placeholder="Digite para buscar: transferência, dinheiro, mobile, cheque..."
                    value={metodosPagamento.find(m => m.id === pagamentoForm.metodoPagamento)?.label || ''}
                    selectedId={pagamentoForm.metodoPagamento}
                    onSelect={(item) => {
                      if (item) setPagamentoForm(prev => ({ ...prev, metodoPagamento: item.id as 'TRANSFERENCIA' | 'CASH' | 'MOBILE_MONEY' | 'CHEQUE' }));
                    }}
                    onClear={() => setPagamentoForm(prev => ({ ...prev, metodoPagamento: 'TRANSFERENCIA' }))}
                    searchFn={searchMetodosPagamento}
                    minSearchLength={0}
                    maxResults={4}
                    emptyMessage="Nenhum método encontrado"
                    getDisplayName={(item) => item.nome || item.nomeCompleto || ''}
                    silent
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referencia">Referência (Opcional)</Label>
                  <Input
                    id="referencia"
                    placeholder="Ex: Nº transferência, Nº cheque, etc."
                    value={pagamentoForm.referencia}
                    onChange={(e) => setPagamentoForm({ ...pagamentoForm, referencia: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacaoPagamento">Observação (Opcional)</Label>
                  <Textarea
                    id="observacaoPagamento"
                    placeholder="Observações sobre o pagamento"
                    value={pagamentoForm.observacaoPagamento}
                    onChange={(e) => setPagamentoForm({ ...pagamentoForm, observacaoPagamento: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="enviarReciboPagar"
                    checked={pagamentoForm.enviarReciboEmail}
                    onCheckedChange={(v) => setPagamentoForm((prev) => ({ ...prev, enviarReciboEmail: !!v }))}
                  />
                  <Label htmlFor="enviarReciboPagar" className="text-sm font-normal cursor-pointer">
                    Enviar recibo por e-mail ao funcionário (usa o e-mail cadastrado)
                  </Label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPagamentoForm({
                  metodoPagamento: 'TRANSFERENCIA',
                  referencia: '',
                  observacaoPagamento: '',
                  enviarReciboEmail: true,
                });
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarPagamento}
              className="bg-green-600 hover:bg-green-700"
              disabled={pagarMutation.isPending || !pagamentoForm.metodoPagamento}
            >
              {pagarMutation.isPending ? 'Processando...' : 'Confirmar Pagamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Reverter Pagamento */}
      <AlertDialog open={showReverterPagamentoDialog} onOpenChange={setShowReverterPagamentoDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-red-600" />
              Reverter Pagamento
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Você está prestes a <strong>REVERTER</strong> o pagamento de uma folha. Esta ação só pode ser realizada por administradores e exige justificativa.
              </p>
              {selectedFolha && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm font-medium text-red-900 mb-2">
                    Funcionário: {getFuncionarioNome(selectedFolha.funcionario_id)}
                  </p>
                  <p className="text-sm text-red-800">
                    Período: {meses.find(m => m.value === selectedFolha.mes)?.label} / {selectedFolha.ano}
                  </p>
                  {selectedFolha.pago_em && (
                    <p className="text-xs text-red-700 mt-2">
                      Pago em: {format(new Date(selectedFolha.pago_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                  {selectedFolha.metodo_pagamento && (
                    <p className="text-xs text-red-700">
                      Método: {selectedFolha.metodo_pagamento}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="justificativaReverter">Justificativa *</Label>
                <Textarea
                  id="justificativaReverter"
                  placeholder="Descreva o motivo da reversão (obrigatório)"
                  value={justificativaReverterPagamento}
                  onChange={(e) => setJustificativaReverterPagamento(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Esta justificativa será registrada no log de auditoria e não pode ser deixada em branco.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setJustificativaReverterPagamento('')}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarReverterPagamento}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={reverterPagamentoMutation.isPending || !justificativaReverterPagamento.trim()}
            >
              {reverterPagamentoMutation.isPending ? 'Revertendo...' : 'Confirmar Reversão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Confirmar Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Você está prestes a <strong>EXCLUIR</strong> uma folha de pagamento. Esta ação <strong>NÃO PODE</strong> ser desfeita.
              </p>
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-medium text-red-900 mb-2">
                  <strong>Atenção:</strong> Folhas FECHADAS ou PAGAS não podem ser excluídas.
                </p>
                {selectedFolha && (
                  <>
                    <p className="text-sm text-red-800">
                      Funcionário: {getFuncionarioNome(selectedFolha.funcionario_id)}
                    </p>
                    <p className="text-sm text-red-800">
                      Período: {meses.find(m => m.value === selectedFolha.mes)?.label} / {selectedFolha.ano}
                    </p>
                    <p className="text-sm text-red-800">
                      Status: {selectedFolha.status}
                    </p>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Apenas folhas em status DRAFT podem ser excluídas. Esta ação será registrada no log de auditoria.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMutation.isPending || (selectedFolha && isFolhaFechada(selectedFolha.status))}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};