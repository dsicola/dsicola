import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { contabilidadeApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
          Configure os códigos de conta usados nas integrações automáticas (mensalidades, folha de pagamento, fornecedores). 
          Cada instituição pode configurar o seu próprio plano de contas.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contaCaixaCodigo">Caixa (pagamentos em dinheiro)</Label>
              <Input
                id="contaCaixaCodigo"
                value={form.contaCaixaCodigo}
                onChange={(e) => setForm((f) => ({ ...f, contaCaixaCodigo: e.target.value }))}
                placeholder="11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contaBancoCodigo">Banco (transferências)</Label>
              <Input
                id="contaBancoCodigo"
                value={form.contaBancoCodigo}
                onChange={(e) => setForm((f) => ({ ...f, contaBancoCodigo: e.target.value }))}
                placeholder="12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contaReceitaMensalidadesCodigo">Receita Mensalidades</Label>
              <Input
                id="contaReceitaMensalidadesCodigo"
                value={form.contaReceitaMensalidadesCodigo}
                onChange={(e) => setForm((f) => ({ ...f, contaReceitaMensalidadesCodigo: e.target.value }))}
                placeholder="41"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contaReceitaTaxasCodigo">Receita Taxas</Label>
              <Input
                id="contaReceitaTaxasCodigo"
                value={form.contaReceitaTaxasCodigo}
                onChange={(e) => setForm((f) => ({ ...f, contaReceitaTaxasCodigo: e.target.value }))}
                placeholder="42"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contaPessoalCodigo">Despesas Pessoal (folha)</Label>
              <Input
                id="contaPessoalCodigo"
                value={form.contaPessoalCodigo}
                onChange={(e) => setForm((f) => ({ ...f, contaPessoalCodigo: e.target.value }))}
                placeholder="51"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contaFornecedoresCodigo">Fornecedores</Label>
              <Input
                id="contaFornecedoresCodigo"
                value={form.contaFornecedoresCodigo}
                onChange={(e) => setForm((f) => ({ ...f, contaFornecedoresCodigo: e.target.value }))}
                placeholder="21"
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
