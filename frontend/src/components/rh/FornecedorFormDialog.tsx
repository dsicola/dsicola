import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { toast } from 'sonner';
import { fornecedoresApi } from '@/services/api';
import { COUNTRIES, getProvincesByCountry, getMunicipiosByProvince } from '@/utils/countries-provinces';

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
  provincia?: string | null;
  municipio?: string | null;
  inicioContrato: string;
  fimContrato?: string | null;
  status: 'ATIVO' | 'INATIVO' | 'SUSPENSO';
  observacoes?: string | null;
}

interface FornecedorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fornecedor: Fornecedor | null;
  onSuccess: () => void;
}

export const FornecedorFormDialog: React.FC<FornecedorFormDialogProps> = ({
  open,
  onOpenChange,
  fornecedor,
  onSuccess,
}) => {
  const { instituicaoId } = useTenantFilter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    razaoSocial: '',
    nif: '',
    tipoServico: 'OUTRO' as 'SEGURANCA' | 'LIMPEZA' | 'TI' | 'CANTINA' | 'MANUTENCAO' | 'OUTRO',
    contato: '',
    email: '',
    telefone: '',
    endereco: '',
    cidade: '',
    pais: 'Angola',
    provincia: '',
    municipio: '',
    inicioContrato: '',
    fimContrato: '',
    status: 'ATIVO' as 'ATIVO' | 'INATIVO' | 'SUSPENSO',
    observacoes: '',
  });

  useEffect(() => {
    if (fornecedor) {
      setFormData({
        razaoSocial: fornecedor.razaoSocial || '',
        nif: fornecedor.nif || '',
        tipoServico: fornecedor.tipoServico || 'OUTRO',
        contato: fornecedor.contato || '',
        email: fornecedor.email || '',
        telefone: fornecedor.telefone || '',
        endereco: fornecedor.endereco || '',
        cidade: fornecedor.cidade || '',
        pais: fornecedor.pais || 'Angola',
        provincia: fornecedor.provincia || '',
        municipio: fornecedor.municipio || '',
        inicioContrato: fornecedor.inicioContrato
          ? new Date(fornecedor.inicioContrato).toISOString().split('T')[0]
          : '',
        fimContrato: fornecedor.fimContrato
          ? new Date(fornecedor.fimContrato).toISOString().split('T')[0]
          : '',
        status: fornecedor.status || 'ATIVO',
        observacoes: fornecedor.observacoes || '',
      });
    } else {
      setFormData({
        razaoSocial: '',
        nif: '',
        tipoServico: 'OUTRO',
        contato: '',
        email: '',
        telefone: '',
        endereco: '',
        cidade: '',
        pais: 'Angola',
        provincia: '',
        municipio: '',
        inicioContrato: '',
        fimContrato: '',
        status: 'ATIVO',
        observacoes: '',
      });
    }
  }, [fornecedor, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!formData.razaoSocial.trim()) {
        toast.error('Razão social é obrigatória');
        setIsLoading(false);
        return;
      }

      if (!formData.tipoServico) {
        toast.error('Tipo de serviço é obrigatório');
        setIsLoading(false);
        return;
      }

      if (!formData.inicioContrato) {
        toast.error('Data de início do contrato é obrigatória');
        setIsLoading(false);
        return;
      }

      const data = {
        razaoSocial: formData.razaoSocial.trim(),
        nif: formData.nif.trim() || undefined,
        tipoServico: formData.tipoServico,
        contato: formData.contato.trim() || undefined,
        email: formData.email.trim() || undefined,
        telefone: formData.telefone.trim() || undefined,
        endereco: formData.endereco.trim() || undefined,
        cidade: formData.cidade.trim() || undefined,
        pais: formData.pais.trim() || 'Angola',
        provincia: formData.provincia.trim() || undefined,
        municipio: formData.municipio.trim() || undefined,
        inicioContrato: new Date(formData.inicioContrato).toISOString(),
        fimContrato: formData.fimContrato
          ? new Date(formData.fimContrato).toISOString()
          : undefined,
        observacoes: formData.observacoes.trim() || undefined,
      };

      if (fornecedor) {
        await fornecedoresApi.update(fornecedor.id, {
          ...data,
          status: formData.status,
        });
        toast.success('Fornecedor atualizado com sucesso');
      } else {
        await fornecedoresApi.create(data);
        toast.success('Fornecedor criado com sucesso');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao salvar fornecedor:', error);
      toast.error(error.response?.data?.message || 'Erro ao salvar fornecedor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-2">
              <p>
                <strong>Cadastre uma empresa terceirizada ou prestadora de serviço (pessoa jurídica).</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                ⚠️ <strong>NÃO cadastre:</strong> pessoas físicas, funcionários ou colaboradores individuais.
                <br />
                Para cadastrar funcionários (pessoa física), use a aba <strong>"Funcionários"</strong>.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="razaoSocial">
                Razão Social <span className="text-red-500">*</span>
              </Label>
              <Input
                id="razaoSocial"
                value={formData.razaoSocial}
                onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                placeholder="Nome da empresa"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nif">NIF (Número de Identificação Fiscal)</Label>
              <Input
                id="nif"
                value={formData.nif}
                onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                placeholder="NIF empresarial"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipoServico">
                Tipo de Serviço <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.tipoServico}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, tipoServico: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de serviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEGURANCA">Segurança</SelectItem>
                  <SelectItem value="LIMPEZA">Limpeza</SelectItem>
                  <SelectItem value="TI">Tecnologia da Informação</SelectItem>
                  <SelectItem value="CANTINA">Cantina</SelectItem>
                  <SelectItem value="MANUTENCAO">Manutenção</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contato">Contato Principal</Label>
              <Input
                id="contato"
                value={formData.contato}
                onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                placeholder="Nome do contato"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@empresa.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="+244 900 000 000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={formData.endereco}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              placeholder="Endereço completo"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pais">País</Label>
              <Select
                value={formData.pais}
                onValueChange={(value) => setFormData({ ...formData, pais: value, provincia: '', municipio: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o país" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provincia">Província</Label>
              <Select
                value={formData.provincia}
                onValueChange={(value) => setFormData({ ...formData, provincia: value, municipio: '' })}
                disabled={!formData.pais}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.pais ? "Selecione a província" : "Selecione primeiro o país"} />
                </SelectTrigger>
                <SelectContent>
                  {formData.pais && getProvincesByCountry(formData.pais).map((province) => (
                    <SelectItem key={province} value={province}>
                      {province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="municipio">Município</Label>
              <Select
                value={formData.municipio}
                onValueChange={(value) => setFormData({ ...formData, municipio: value })}
                disabled={!formData.pais || !formData.provincia}
              >
                <SelectTrigger>
                  <SelectValue 
                    placeholder={
                      formData.pais && formData.provincia 
                        ? "Selecione o município" 
                        : formData.pais 
                        ? "Selecione primeiro a província" 
                        : "Selecione primeiro o país"
                    } 
                  />
                </SelectTrigger>
                <SelectContent>
                  {formData.pais && formData.provincia && getMunicipiosByProvince(formData.pais, formData.provincia).map((municipio) => (
                    <SelectItem key={municipio} value={municipio}>
                      {municipio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade (complemento)</Label>
              <Input
                id="cidade"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                placeholder="Cidade ou bairro (opcional)"
              />
            </div>

            {fornecedor && (
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="INATIVO">Inativo</SelectItem>
                    <SelectItem value="SUSPENSO">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inicioContrato">
                Início do Contrato <span className="text-red-500">*</span>
              </Label>
              <Input
                id="inicioContrato"
                type="date"
                value={formData.inicioContrato}
                onChange={(e) => setFormData({ ...formData, inicioContrato: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fimContrato">Fim do Contrato</Label>
              <Input
                id="fimContrato"
                type="date"
                value={formData.fimContrato}
                onChange={(e) => setFormData({ ...formData, fimContrato: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Informações adicionais sobre o fornecedor"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : fornecedor ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

