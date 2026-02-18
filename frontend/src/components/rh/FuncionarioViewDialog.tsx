import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, Mail, Phone, Building2, Briefcase, Calendar, Clock, DollarSign, Printer, Loader2 } from 'lucide-react';
import { funcionariosApi } from '@/services/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface FuncionarioViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionario: any | null;
}

export const FuncionarioViewDialog: React.FC<FuncionarioViewDialogProps> = ({
  open,
  onOpenChange,
  funcionario,
}) => {
  const { role } = useAuth();
  const [loadingPrint, setLoadingPrint] = useState(false);
  const canPrintAdmissao = role === 'ADMIN' || role === 'RH' || role === 'SUPER_ADMIN';

  const handleImprimirAdmissao = async () => {
    if (!funcionario?.id) return;
    setLoadingPrint(true);
    try {
      const blob = await funcionariosApi.imprimirAdmissao(funcionario.id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.open(url, '_blank');
      toast.success('Comprovante de admissão aberto em nova aba');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao imprimir comprovante de admissão');
    } finally {
      setLoadingPrint(false);
    }
  };

  if (!funcionario) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Ativo':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ativo</Badge>;
      case 'Inativo':
        return <Badge variant="secondary">Inativo</Badge>;
      case 'Férias':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Férias</Badge>;
      case 'Licença':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Licença</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '-';
    }
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: 'AOA',
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Ficha do Funcionário
            </span>
            {canPrintAdmissao && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleImprimirAdmissao}
                disabled={loadingPrint}
              >
                {loadingPrint ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4 mr-1" />
                )}
                Imprimir Admissão
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{funcionario.profiles?.nome_completo}</h2>
              <p className="text-muted-foreground">{funcionario.cargos?.nome || 'Sem cargo definido'}</p>
              {getStatusBadge(funcionario.status)}
            </div>
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase">Contato</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{funcionario.profiles?.email}</span>
              </div>
              {funcionario.profiles?.telefone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{funcionario.profiles.telefone}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Employment Info */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase">Vínculo</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Departamento</p>
                  <p>{funcionario.departamentos?.nome || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Cargo</p>
                  <p>{funcionario.cargos?.nome || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Admissão</p>
                  <p>{format(new Date(funcionario.data_admissao), 'dd/MM/yyyy', { locale: ptBR })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Carga Horária</p>
                  <p>{funcionario.carga_horaria}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Salário</p>
                  <p>{formatCurrency(funcionario.salario)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de Contrato</p>
                <p>{funcionario.tipo_contrato}</p>
              </div>
            </div>
          </div>

          {funcionario.data_fim_contrato && (
            <>
              <Separator />
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-yellow-600">
                  <strong>Atenção:</strong> Contrato expira em{' '}
                  {format(new Date(funcionario.data_fim_contrato), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </>
          )}

          {funcionario.observacoes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground uppercase">Observações</h3>
                <p className="text-sm">{funcionario.observacoes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
