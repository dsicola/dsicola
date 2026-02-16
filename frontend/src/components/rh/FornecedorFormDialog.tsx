import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SmartSearch } from '@/components/common/SmartSearch';
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipoServico">
                Tipo de Serviço <span className="text-red-500">*</span>
              </Label>
              <SmartSearch
                placeholder="Digite: segurança, limpeza, TI, cantina, manutenção..."
                value={formData.tipoServico ? ({ SEGURANCA: 'Segurança', LIMPEZA: 'Limpeza', TI: 'Tecnologia da Informação', CANTINA: 'Cantina', MANUTENCAO: 'Manutenção', OUTRO: 'Outro' } as Record<string, string>)[formData.tipoServico] || formData.tipoServico : ''}
                selectedId={formData.tipoServico || undefined}
                onSelect={(item) => setFormData((prev) => ({ ...prev, tipoServico: (item?.id as any) || 'OUTRO' }))}
                onClear={() => setFormData((prev) => ({ ...prev, tipoServico: 'OUTRO' }))}
                searchFn={async (term) => {
                  const opts = [
                    { id: 'SEGURANCA', label: 'Segurança' },
                    { id: 'LIMPEZA', label: 'Limpeza' },
                    { id: 'TI', label: 'Tecnologia da Informação' },
                    { id: 'CANTINA', label: 'Cantina' },
                    { id: 'MANUTENCAO', label: 'Manutenção' },
                    { id: 'OUTRO', label: 'Outro' },
                  ];
                  const search = term.toLowerCase().trim();
                  return opts
                    .filter((o) => o.label.toLowerCase().includes(search) || o.id.toLowerCase().includes(search))
                    .map((o) => ({ id: o.id, nome: o.label, nomeCompleto: o.label }));
                }}
                minSearchLength={0}
                maxResults={6}
                emptyMessage="Nenhum tipo encontrado"
                silent
              />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pais">País</Label>
              <SmartSearch
                placeholder="Digite o nome do país..."
                value={formData.pais || ''}
                selectedId={formData.pais || undefined}
                onSelect={(item) => setFormData((prev) => ({ ...prev, pais: item ? item.id : '', provincia: '', municipio: '' }))}
                onClear={() => setFormData((prev) => ({ ...prev, pais: '', provincia: '', municipio: '' }))}
                searchFn={async (term) => {
                  const search = term.toLowerCase().trim();
                  return COUNTRIES.filter((c) => c.toLowerCase().includes(search))
                    .slice(0, 15)
                    .map((c) => ({ id: c, nome: c, nomeCompleto: c }));
                }}
                minSearchLength={1}
                maxResults={15}
                emptyMessage="Nenhum país encontrado"
                silent
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provincia">Província</Label>
              <SmartSearch
                placeholder={formData.pais ? "Digite a província..." : "Selecione primeiro o país"}
                value={formData.provincia || ''}
                selectedId={formData.provincia || undefined}
                onSelect={(item) => setFormData((prev) => ({ ...prev, provincia: item ? item.id : '', municipio: '' }))}
                onClear={() => setFormData((prev) => ({ ...prev, provincia: '', municipio: '' }))}
                searchFn={async (term) => {
                  if (!formData.pais) return [];
                  const provinces = getProvincesByCountry(formData.pais);
                  const search = term.toLowerCase().trim();
                  return provinces
                    .filter((p) => p.toLowerCase().includes(search))
                    .slice(0, 15)
                    .map((p) => ({ id: p, nome: p, nomeCompleto: p }));
                }}
                minSearchLength={0}
                maxResults={15}
                emptyMessage="Nenhuma província encontrada"
                disabled={!formData.pais}
                silent
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="municipio">Município</Label>
              <SmartSearch
                placeholder={formData.pais && formData.provincia ? "Digite o município..." : formData.pais ? "Selecione primeiro a província" : "Selecione primeiro o país"}
                value={formData.municipio || ''}
                selectedId={formData.municipio || undefined}
                onSelect={(item) => setFormData((prev) => ({ ...prev, municipio: item ? item.id : '' }))}
                onClear={() => setFormData((prev) => ({ ...prev, municipio: '' }))}
                searchFn={async (term) => {
                  if (!formData.pais || !formData.provincia) return [];
                  const municipios = getMunicipiosByProvince(formData.pais, formData.provincia);
                  const search = term.toLowerCase().trim();
                  return municipios
                    .filter((m) => m.toLowerCase().includes(search))
                    .slice(0, 15)
                    .map((m) => ({ id: m, nome: m, nomeCompleto: m }));
                }}
                minSearchLength={0}
                maxResults={15}
                emptyMessage="Nenhum município encontrado"
                disabled={!formData.pais || !formData.provincia}
                silent
              />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

