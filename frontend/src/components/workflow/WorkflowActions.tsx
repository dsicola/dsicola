import { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { workflowApi, authApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { Send, CheckCircle, XCircle, Lock, FileEdit } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type StatusWorkflow = 'RASCUNHO' | 'SUBMETIDO' | 'APROVADO' | 'REJEITADO' | 'BLOQUEADO';
type EntidadeWorkflow = 'EventoCalendario' | 'PlanoEnsino' | 'Avaliacao';

interface WorkflowActionsProps {
  entidade: EntidadeWorkflow;
  entidadeId: string;
  statusAtual: StatusWorkflow;
  onStatusChange?: () => void;
  disabledByCargaHoraria?: boolean;
}

export function WorkflowActions({ entidade, entidadeId, statusAtual, onStatusChange, disabledByCargaHoraria = false }: WorkflowActionsProps) {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [dialogType, setDialogType] = useState<'aprovar' | 'rejeitar' | 'bloquear' | null>(null);
  const [observacao, setObservacao] = useState('');

  // Buscar roles do usuário
  const { data: profileData } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      try {
        return await authApi.getProfile();
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const userRoles = profileData?.roles || (role ? [role] : []);

  // Verificar permissões
  const podeSubmeter = statusAtual === 'RASCUNHO' && 
    (userRoles.includes('PROFESSOR') || userRoles.includes('SECRETARIA') || userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN'));
  
  const podeAprovar = statusAtual === 'SUBMETIDO' && 
    (userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN') || userRoles.includes('SECRETARIA'));
  
  const podeRejeitar = statusAtual === 'SUBMETIDO' && 
    (userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN') || userRoles.includes('SECRETARIA'));
  
  const podeBloquear = statusAtual === 'APROVADO' && 
    (userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN'));

  // Mutations - protegidas contra unmount
  const submeterMutation = useSafeMutation({
    mutationFn: () => workflowApi.submeter({ entidade, entidadeId }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: 'Sucesso', description: 'Item submetido para aprovação' });
      onStatusChange?.();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.response?.data?.message || 'Erro ao submeter',
        variant: 'destructive',
      });
    },
  });

  const aprovarMutation = useSafeMutation({
    mutationFn: () => workflowApi.aprovar({ entidade, entidadeId, observacao: observacao || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: 'Sucesso', description: 'Item aprovado com sucesso' });
      // Fechamento explícito após sucesso
      setDialogOpen(false);
      setObservacao('');
      onStatusChange?.();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.response?.data?.message || 'Erro ao aprovar',
        variant: 'destructive',
      });
    },
  });

  const rejeitarMutation = useSafeMutation({
    mutationFn: () => workflowApi.rejeitar({ entidade, entidadeId, observacao }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: 'Item rejeitado', description: 'O item foi rejeitado e retornou para rascunho' });
      // Fechamento explícito após sucesso
      setDialogOpen(false);
      setObservacao('');
      onStatusChange?.();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.response?.data?.message || 'Erro ao rejeitar',
        variant: 'destructive',
      });
    },
  });

  const bloquearMutation = useSafeMutation({
    mutationFn: () => workflowApi.bloquear({ entidade, entidadeId, observacao: observacao || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: 'Sucesso', description: 'Item bloqueado com sucesso' });
      // Fechamento explícito após sucesso
      setDialogOpen(false);
      setObservacao('');
      onStatusChange?.();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.response?.data?.message || 'Erro ao bloquear',
        variant: 'destructive',
      });
    },
  });

  const handleSubmeter = () => {
    submeterMutation.mutate();
  };

  const handleOpenDialog = (type: 'aprovar' | 'rejeitar' | 'bloquear') => {
    setDialogType(type);
    setDialogOpen(true);
    setObservacao('');
  };

  const handleConfirm = () => {
    if (dialogType === 'aprovar') {
      aprovarMutation.mutate();
    } else if (dialogType === 'rejeitar') {
      if (!observacao.trim()) {
        toast({
          title: 'Erro',
          description: 'Observação é obrigatória ao rejeitar',
          variant: 'destructive',
        });
        return;
      }
      rejeitarMutation.mutate();
    } else if (dialogType === 'bloquear') {
      bloquearMutation.mutate();
    }
  };

  const temAlgumaAcao = podeSubmeter || podeAprovar || podeRejeitar || podeBloquear;
  const isSubmeterDisabled = disabledByCargaHoraria || submeterMutation.isPending;
  const isAprovarDisabled = disabledByCargaHoraria || aprovarMutation.isPending;

  return (
    <>
      {temAlgumaAcao ? (
        <TooltipProvider>
        <div className="flex gap-2 flex-wrap">
          {podeSubmeter && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
            <Button
              size="sm"
              onClick={handleSubmeter}
                    disabled={isSubmeterDisabled}
            >
              <Send className="h-4 w-4 mr-2" />
              Submeter para Aprovação
            </Button>
                </span>
              </TooltipTrigger>
              {disabledByCargaHoraria && (
                <TooltipContent>
                  <p>A carga horária planejada deve ser EXATAMENTE igual à carga horária exigida. Ajuste as aulas na aba "2. Planejar" antes de continuar.</p>
                </TooltipContent>
              )}
            </Tooltip>
          )}

          {podeAprovar && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
            <Button
              size="sm"
              variant="default"
              onClick={() => handleOpenDialog('aprovar')}
                    disabled={isAprovarDisabled}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Aprovar Plano
            </Button>
                </span>
              </TooltipTrigger>
              {disabledByCargaHoraria && (
                <TooltipContent>
                  <p>A carga horária planejada deve ser EXATAMENTE igual à carga horária exigida. Ajuste as aulas na aba "2. Planejar" antes de continuar.</p>
                </TooltipContent>
              )}
            </Tooltip>
          )}

          {podeRejeitar && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleOpenDialog('rejeitar')}
              disabled={rejeitarMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Rejeitar
            </Button>
          )}

          {podeBloquear && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenDialog('bloquear')}
              disabled={bloquearMutation.isPending}
            >
              <Lock className="h-4 w-4 mr-2" />
              Bloquear
            </Button>
          )}
        </div>
        </TooltipProvider>
      ) : (
        <div className="text-sm text-muted-foreground p-4 bg-muted rounded-md">
          <p className="font-medium mb-1">Nenhuma ação disponível</p>
          <p className="text-xs">
            Status atual: <strong>{statusAtual}</strong>
            {statusAtual === 'RASCUNHO' && ' - O plano está em rascunho e pode ser submetido para aprovação.'}
            {statusAtual === 'SUBMETIDO' && ' - O plano foi submetido e aguarda aprovação.'}
            {statusAtual === 'APROVADO' && ' - O plano foi aprovado.'}
            {statusAtual === 'REJEITADO' && ' - O plano foi rejeitado.'}
            {statusAtual === 'BLOQUEADO' && ' - O plano está bloqueado.'}
          </p>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'aprovar' && 'Aprovar Item'}
              {dialogType === 'rejeitar' && 'Rejeitar Item'}
              {dialogType === 'bloquear' && 'Bloquear Item'}
            </DialogTitle>
            <DialogDescription>
              {dialogType === 'aprovar' && 'Confirme a aprovação deste item'}
              {dialogType === 'rejeitar' && 'Informe o motivo da rejeição (obrigatório)'}
              {dialogType === 'bloquear' && 'Confirme o bloqueio deste item'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Observações {dialogType === 'rejeitar' && '*'}</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder={
                  dialogType === 'aprovar' ? 'Observações opcionais...' :
                  dialogType === 'rejeitar' ? 'Motivo da rejeição (obrigatório)...' :
                  'Observações opcionais...'
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                (dialogType === 'rejeitar' && !observacao.trim()) ||
                aprovarMutation.isPending ||
                rejeitarMutation.isPending ||
                bloquearMutation.isPending
              }
              variant={dialogType === 'rejeitar' ? 'destructive' : 'default'}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

