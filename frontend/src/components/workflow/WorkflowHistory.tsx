import { useQuery } from '@tanstack/react-query';
import { workflowApi } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, User, Clock } from 'lucide-react';
import { WorkflowStatusBadge } from './WorkflowStatusBadge';

type EntidadeWorkflow = 'EventoCalendario' | 'PlanoEnsino' | 'Avaliacao';

interface WorkflowHistoryProps {
  entidade: EntidadeWorkflow;
  entidadeId: string;
}

interface WorkflowLog {
  id: string;
  statusAnterior: string | null;
  statusNovo: string;
  acao: string;
  observacao: string | null;
  data: string;
  usuario: {
    id: string;
    nomeCompleto: string;
    email: string;
  };
}

export function WorkflowHistory({ entidade, entidadeId }: WorkflowHistoryProps) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['workflow-history', entidade, entidadeId],
    queryFn: () => workflowApi.getHistorico({ entidade, entidadeId }),
    enabled: !!entidadeId,
  });

  const getAcaoLabel = (acao: string) => {
    const labels: Record<string, string> = {
      SUBMETER: 'Submetido',
      APROVAR: 'Aprovado',
      REJEITAR: 'Rejeitado',
      BLOQUEAR: 'Bloqueado',
    };
    return labels[acao] || acao;
  };

  const getAcaoColor = (acao: string) => {
    const colors: Record<string, string> = {
      SUBMETER: 'bg-blue-100 text-blue-700 border-blue-300',
      APROVAR: 'bg-green-100 text-green-700 border-green-300',
      REJEITAR: 'bg-red-100 text-red-700 border-red-300',
      BLOQUEAR: 'bg-orange-100 text-orange-700 border-orange-300',
    };
    return colors[acao] || 'bg-gray-100 text-gray-700';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Aprovações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">Carregando histórico...</p>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Aprovações
          </CardTitle>
          <CardDescription>Registro de todas as mudanças de status</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">Nenhum histórico disponível</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Aprovações
        </CardTitle>
        <CardDescription>Registro de todas as mudanças de status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.map((log: WorkflowLog, index: number) => (
            <div key={log.id} className="border-l-4 border-l-primary pl-4 pb-4 relative">
              {index < logs.length - 1 && (
                <div className="absolute left-[-2px] top-8 w-0.5 h-full bg-border" />
              )}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={getAcaoColor(log.acao)}>
                      {getAcaoLabel(log.acao)}
                    </Badge>
                    {log.statusAnterior && (
                      <>
                        <span className="text-muted-foreground">→</span>
                        <WorkflowStatusBadge status={log.statusAnterior as any} />
                      </>
                    )}
                    <span className="text-muted-foreground">→</span>
                    <WorkflowStatusBadge status={log.statusNovo as any} />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{log.usuario.nomeCompleto}</span>
                    <span>•</span>
                    <Clock className="h-4 w-4" />
                    <span>
                      {format(new Date(log.data), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {log.observacao && (
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">{log.observacao}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

