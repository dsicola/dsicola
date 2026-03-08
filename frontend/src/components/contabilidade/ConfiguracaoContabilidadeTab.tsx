import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { contabilidadeApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ContaSelect, type ContaOption } from './ContaSelect';
import { Settings, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiErrors';

export const ConfiguracaoContabilidadeTab = () => {
  const queryClient = useQueryClient();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [form, setForm] = useState({
    contaCaixaCodigo: '11',
    contaBancoCodigo: '12',
    contaReceitaMensalidadesCodigo: '41',
    contaReceitaTaxasCodigo: '42',
    contaPessoalCodigo: '51',
    contaFornecedoresCodigo: '21',
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ['configuracao-contabilidade', instituicaoId],
    queryFn: () => contabilidadeApi.getConfiguracao(),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['plano-contas', instituicaoId],
    queryFn: () => contabilidadeApi.listPlanoContas({ incluirInativos: false }),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const contasOptions: ContaOption[] = (contas as Array<{ id: string; codigo: string; descricao: string; tipo?: string }>).map((c) => ({
    id: c.id,
    codigo: c.codigo,
    descricao: c.descricao,
    tipo: c.tipo,
  }));

  useEffect(() => {
    if (config) {
      setForm({
        contaCaixaCodigo: config.contaCaixaCodigo || '11',
        contaBancoCodigo: config.contaBancoCodigo || '12',
        contaReceitaMensalidadesCodigo: config.contaReceitaMensalidadesCodigo || '41',
        contaReceitaTaxasCodigo: config.contaReceitaTaxasCodigo || '42',
        contaPessoalCodigo: config.contaPessoalCodigo || '51',
        contaFornecedoresCodigo: config.contaFornecedoresCodigo || '21',
      });
    }
  }, [config]);

  const updateMutation = useSafeMutation({
    mutationFn: (data: typeof form) => contabilidadeApi.updateConfiguracao(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracao-contabilidade'] });
      toast.success('Configuração guardada');
    },
    onError: (e: any) => toast.error(getApiErrorMessage(e, 'Não foi possível guardar a configuração. Tente novamente.')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  if (isLoading) return <div className="text-muted-foreground">A carregar...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuração de contas por instituição
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure os códigos de conta usados no Motor Automático de Lançamentos (mensalidades, folha, fornecedores).
          Estes valores são usados como padrão quando não há regra personalizada em Motor de Lançamentos.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Caixa (pagamentos em dinheiro)</Label>
              <ContaSelect
                contas={contasOptions}
                value={form.contaCaixaCodigo}
                onChange={(codigo) => setForm((f) => ({ ...f, contaCaixaCodigo: codigo }))}
                placeholder="Selecione conta Caixa"
                allowCaixaBanco={false}
                filterTipo="ATIVO"
              />
            </div>
            <div className="space-y-2">
              <Label>Banco (transferências)</Label>
              <ContaSelect
                contas={contasOptions}
                value={form.contaBancoCodigo}
                onChange={(codigo) => setForm((f) => ({ ...f, contaBancoCodigo: codigo }))}
                placeholder="Selecione conta Banco"
                allowCaixaBanco={false}
                filterTipo="ATIVO"
              />
            </div>
            <div className="space-y-2">
              <Label>Receita Mensalidades</Label>
              <ContaSelect
                contas={contasOptions}
                value={form.contaReceitaMensalidadesCodigo}
                onChange={(codigo) => setForm((f) => ({ ...f, contaReceitaMensalidadesCodigo: codigo }))}
                placeholder="Selecione conta Receita"
                allowCaixaBanco={false}
                filterTipo="RECEITA"
              />
            </div>
            <div className="space-y-2">
              <Label>Receita Taxas</Label>
              <ContaSelect
                contas={contasOptions}
                value={form.contaReceitaTaxasCodigo}
                onChange={(codigo) => setForm((f) => ({ ...f, contaReceitaTaxasCodigo: codigo }))}
                placeholder="Selecione conta Receita Taxas"
                allowCaixaBanco={false}
                filterTipo="RECEITA"
              />
            </div>
            <div className="space-y-2">
              <Label>Despesas Pessoal (folha)</Label>
              <ContaSelect
                contas={contasOptions}
                value={form.contaPessoalCodigo}
                onChange={(codigo) => setForm((f) => ({ ...f, contaPessoalCodigo: codigo }))}
                placeholder="Selecione conta Pessoal"
                allowCaixaBanco={false}
                filterTipo="DESPESA"
              />
            </div>
            <div className="space-y-2">
              <Label>Fornecedores</Label>
              <ContaSelect
                contas={contasOptions}
                value={form.contaFornecedoresCodigo}
                onChange={(codigo) => setForm((f) => ({ ...f, contaFornecedoresCodigo: codigo }))}
                placeholder="Selecione conta Fornecedores"
                allowCaixaBanco={false}
                filterTipo="PASSIVO"
              />
            </div>
          </div>
          <Button type="submit" disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Guardar configuração
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
