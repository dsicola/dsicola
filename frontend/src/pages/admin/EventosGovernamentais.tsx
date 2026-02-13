import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { eventosGovernamentaisApi } from '@/services/api';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Building2,
  Send,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Eye,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TipoEvento = 'MATRICULA' | 'CONCLUSAO' | 'DIPLOMA' | 'TRANSFERENCIA' | 'CANCELAMENTO_MATRICULA';
type StatusEvento = 'PENDENTE' | 'ENVIADO' | 'ERRO' | 'CANCELADO';

interface EventoGovernamental {
  id: string;
  tipoEvento: TipoEvento;
  status: StatusEvento;
  payloadJson: any;
  protocolo?: string | null;
  enviadoEm?: string | null;
  erro?: string | null;
  tentativas: number;
  observacoes?: string | null;
  createdAt: string;
  updatedAt: string;
  instituicao: {
    id: string;
    nome: string;
  };
}

const EventosGovernamentais: React.FC = () => {
  const queryClient = useQueryClient();
  const [filtroTipo, setFiltroTipo] = useState<TipoEvento | 'TODOS'>('TODOS');
  const [filtroStatus, setFiltroStatus] = useState<StatusEvento | 'TODOS'>('TODOS');
  const [showDetalhesDialog, setShowDetalhesDialog] = useSafeDialog(false);
  const [showEnviarDialog, setShowEnviarDialog] = useSafeDialog(false);
  const [showCancelarDialog, setShowCancelarDialog] = useSafeDialog(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<EventoGovernamental | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

  // Buscar eventos
  const { data: eventos = [], isLoading: carregandoEventos } = useQuery({
    queryKey: ['eventos-governamentais', filtroTipo, filtroStatus],
    queryFn: async () => {
      const params: any = {};
      if (filtroTipo !== 'TODOS') params.tipoEvento = filtroTipo;
      if (filtroStatus !== 'TODOS') params.status = filtroStatus;
      return await eventosGovernamentaisApi.getAll(params);
    },
  });

  // Estatísticas
  const { data: estatisticas, isLoading: carregandoEstatisticas } = useQuery({
    queryKey: ['eventos-governamentais-estatisticas'],
    queryFn: () => eventosGovernamentaisApi.obterEstatisticas(),
  });

  // Status da integração
  const { data: statusIntegracao } = useQuery({
    queryKey: ['eventos-governamentais-status-integracao'],
    queryFn: () => eventosGovernamentaisApi.verificarStatusIntegracao(),
  });

  // Mutations
  const enviarMutation = useSafeMutation({
    mutationFn: (id: string) => eventosGovernamentaisApi.enviar(id, false),
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: 'Evento enviado com sucesso',
      });
      queryClient.invalidateQueries({ queryKey: ['eventos-governamentais'] });
      queryClient.invalidateQueries({ queryKey: ['eventos-governamentais-estatisticas'] });
      setShowEnviarDialog(false);
      setEventoSelecionado(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao enviar evento',
        description: error?.response?.data?.message || 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });

  const cancelarMutation = useSafeMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      eventosGovernamentaisApi.cancelar(id, motivo),
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: 'Evento cancelado com sucesso',
      });
      queryClient.invalidateQueries({ queryKey: ['eventos-governamentais'] });
      queryClient.invalidateQueries({ queryKey: ['eventos-governamentais-estatisticas'] });
      setShowCancelarDialog(false);
      setEventoSelecionado(null);
      setMotivoCancelamento('');
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao cancelar evento',
        description: error?.response?.data?.message || 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });

  const handleVerDetalhes = (evento: EventoGovernamental) => {
    setEventoSelecionado(evento);
    setShowDetalhesDialog(true);
  };

  const handleEnviar = (evento: EventoGovernamental) => {
    setEventoSelecionado(evento);
    setShowEnviarDialog(true);
  };

  const handleCancelar = (evento: EventoGovernamental) => {
    setEventoSelecionado(evento);
    setShowCancelarDialog(true);
  };

  const confirmarEnvio = () => {
    if (eventoSelecionado) {
      enviarMutation.mutate(eventoSelecionado.id);
    }
  };

  const confirmarCancelamento = () => {
    if (eventoSelecionado && motivoCancelamento.trim()) {
      cancelarMutation.mutate({
        id: eventoSelecionado.id,
        motivo: motivoCancelamento.trim(),
      });
    }
  };

  const getStatusBadge = (status: StatusEvento) => {
    const variants: Record<StatusEvento, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      PENDENTE: 'secondary',
      ENVIADO: 'default',
      ERRO: 'destructive',
      CANCELADO: 'outline',
    };

    const icons: Record<StatusEvento, React.ReactNode> = {
      PENDENTE: <Clock className="h-3 w-3" />,
      ENVIADO: <CheckCircle2 className="h-3 w-3" />,
      ERRO: <AlertCircle className="h-3 w-3" />,
      CANCELADO: <X className="h-3 w-3" />,
    };

    const labels: Record<StatusEvento, string> = {
      PENDENTE: 'Pendente',
      ENVIADO: 'Enviado',
      ERRO: 'Erro',
      CANCELADO: 'Cancelado',
    };

    return (
      <Badge variant={variants[status]} className="flex items-center gap-1">
        {icons[status]}
        {labels[status]}
      </Badge>
    );
  };

  const getTipoEventoLabel = (tipo: TipoEvento) => {
    const labels: Record<TipoEvento, string> = {
      MATRICULA: 'Matrícula',
      CONCLUSAO: 'Conclusão',
      DIPLOMA: 'Diploma',
      TRANSFERENCIA: 'Transferência',
      CANCELAMENTO_MATRICULA: 'Cancelamento de Matrícula',
    };
    return labels[tipo];
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              Eventos Governamentais
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerenciamento de eventos para integração com órgãos governamentais
            </p>
          </div>
        </div>

        {/* Status da Integração */}
        {statusIntegracao && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Status da Integração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={statusIntegracao.ativa ? 'default' : 'secondary'}>
                  {statusIntegracao.ativa ? 'Ativa' : 'Desativada'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {statusIntegracao.mensagem}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estatísticas */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total</CardDescription>
                <CardTitle className="text-2xl">{estatisticas.total || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pendentes</CardDescription>
                <CardTitle className="text-2xl">{estatisticas.pendentes || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Enviados</CardDescription>
                <CardTitle className="text-2xl">{estatisticas.enviados || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Erros</CardDescription>
                <CardTitle className="text-2xl">{estatisticas.erros || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Cancelados</CardDescription>
                <CardTitle className="text-2xl">{estatisticas.cancelados || 0}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="filtro-tipo">Tipo de Evento</Label>
                <Select
                  value={filtroTipo}
                  onValueChange={(value) => setFiltroTipo(value as TipoEvento | 'TODOS')}
                >
                  <SelectTrigger id="filtro-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="MATRICULA">Matrícula</SelectItem>
                    <SelectItem value="CONCLUSAO">Conclusão</SelectItem>
                    <SelectItem value="DIPLOMA">Diploma</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                    <SelectItem value="CANCELAMENTO_MATRICULA">Cancelamento de Matrícula</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filtro-status">Status</Label>
                <Select
                  value={filtroStatus}
                  onValueChange={(value) => setFiltroStatus(value as StatusEvento | 'TODOS')}
                >
                  <SelectTrigger id="filtro-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="ENVIADO">Enviado</SelectItem>
                    <SelectItem value="ERRO">Erro</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Eventos */}
        <Card>
          <CardHeader>
            <CardTitle>Eventos</CardTitle>
            <CardDescription>
              Lista de eventos governamentais gerados pelo sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {carregandoEventos ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : eventos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum evento encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Protocolo</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventos.map((evento: EventoGovernamental) => (
                      <TableRow key={evento.id}>
                        <TableCell className="font-medium">
                          {getTipoEventoLabel(evento.tipoEvento)}
                        </TableCell>
                        <TableCell>{getStatusBadge(evento.status)}</TableCell>
                        <TableCell>
                          {evento.protocolo ? (
                            <Badge variant="outline">{evento.protocolo}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {evento.enviadoEm
                            ? format(new Date(evento.enviadoEm), "dd/MM/yyyy 'às' HH:mm", {
                                locale: ptBR,
                              })
                            : '-'}
                        </TableCell>
                        <TableCell>{evento.tentativas}</TableCell>
                        <TableCell>
                          {format(new Date(evento.createdAt), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVerDetalhes(evento)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {evento.status === 'PENDENTE' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEnviar(evento)}
                                  disabled={enviarMutation.isPending}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelar(evento)}
                                  disabled={cancelarMutation.isPending}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {evento.status === 'ERRO' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEnviar(evento)}
                                disabled={enviarMutation.isPending}
                              >
                                <RefreshCw className="h-4 w-4" />
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
        </Card>

        {/* Dialog de Detalhes */}
        <Dialog open={showDetalhesDialog} onOpenChange={setShowDetalhesDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do Evento</DialogTitle>
              <DialogDescription>
                Informações completas do evento governamental
              </DialogDescription>
            </DialogHeader>
            {eventoSelecionado && (
              <div className="space-y-4">
                <div>
                  <Label>Tipo de Evento</Label>
                  <p className="font-medium">{getTipoEventoLabel(eventoSelecionado.tipoEvento)}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <div>{getStatusBadge(eventoSelecionado.status)}</div>
                </div>
                {eventoSelecionado.protocolo && (
                  <div>
                    <Label>Protocolo</Label>
                    <p className="font-mono text-sm">{eventoSelecionado.protocolo}</p>
                  </div>
                )}
                {eventoSelecionado.erro && (
                  <div>
                    <Label>Erro</Label>
                    <p className="text-destructive text-sm">{eventoSelecionado.erro}</p>
                  </div>
                )}
                {eventoSelecionado.observacoes && (
                  <div>
                    <Label>Observações</Label>
                    <p className="text-sm">{eventoSelecionado.observacoes}</p>
                  </div>
                )}
                <div>
                  <Label>Payload JSON</Label>
                  <pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(eventoSelecionado.payloadJson, null, 2)}
                  </pre>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Criado em</Label>
                    <p className="text-sm">
                      {format(new Date(eventoSelecionado.createdAt), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  {eventoSelecionado.enviadoEm && (
                    <div>
                      <Label>Enviado em</Label>
                      <p className="text-sm">
                        {format(
                          new Date(eventoSelecionado.enviadoEm),
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR }
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetalhesDialog(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Enviar */}
        <Dialog open={showEnviarDialog} onOpenChange={setShowEnviarDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar Evento</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja enviar este evento para o órgão governamental?
              </DialogDescription>
            </DialogHeader>
            {eventoSelecionado && (
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Tipo:</strong> {getTipoEventoLabel(eventoSelecionado.tipoEvento)}
                </p>
                <p className="text-sm">
                  <strong>Status atual:</strong> {getStatusBadge(eventoSelecionado.status)}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEnviarDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={confirmarEnvio}
                disabled={enviarMutation.isPending}
              >
                {enviarMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Cancelar */}
        <Dialog open={showCancelarDialog} onOpenChange={setShowCancelarDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar Evento</DialogTitle>
              <DialogDescription>
                Informe o motivo do cancelamento. Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {eventoSelecionado && (
                <div>
                  <p className="text-sm mb-2">
                    <strong>Evento:</strong> {getTipoEventoLabel(eventoSelecionado.tipoEvento)}
                  </p>
                </div>
              )}
              <div>
                <Label htmlFor="motivo">Motivo do Cancelamento *</Label>
                <Textarea
                  id="motivo"
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  placeholder="Descreva o motivo do cancelamento..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCancelarDialog(false)}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmarCancelamento}
                disabled={!motivoCancelamento.trim() || cancelarMutation.isPending}
              >
                {cancelarMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Confirmar Cancelamento
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default EventosGovernamentais;
