import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { pagamentoLicencaApi, instituicoesApi } from '@/services/api';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Clock, XCircle, Search, Eye, AlertTriangle, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { documentoFiscalApi } from '@/services/api';
import { downloadDocumentoFiscalLicenca, DocumentoFiscalLicencaData } from '@/utils/pdfGenerator';

interface PagamentoLicenca {
  id: string;
  instituicaoId: string;
  assinaturaId?: string;
  plano: string;
  valor: number;
  periodo: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  metodo: string;
  gateway?: string;
  gatewayId?: string;
  referencia?: string;
  observacoes?: string;
  criadoEm: string;
  pagoEm?: string;
  confirmadoPor?: string;
  instituicao?: {
    id: string;
    nome: string;
    subdominio: string;
  };
  assinatura?: {
    id: string;
    dataFim?: string;
    plano: {
      nome: string;
    };
  };
}

export function PagamentosLicencaTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [instituicaoFilter, setInstituicaoFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPagamento, setSelectedPagamento] = useState<PagamentoLicenca | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [observacoes, setObservacoes] = useState('');

  // Buscar todas as instituições para filtro
  const { data: instituicoes = [] } = useQuery({
    queryKey: ['instituicoes-pagamentos'],
    queryFn: async () => {
      return await instituicoesApi.getAll();
    },
  });

  // Buscar pagamentos
  const { data: pagamentos = [], isLoading } = useQuery({
    queryKey: ['pagamentos-licenca-admin', statusFilter, instituicaoFilter],
    queryFn: async () => {
      const params: any = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (instituicaoFilter !== 'all') {
        params.instituicaoId = instituicaoFilter;
      }
      return await pagamentoLicencaApi.getHistorico(params);
    },
  });

  // Filtrar por busca
  const pagamentosFiltrados = pagamentos.filter((pagamento: PagamentoLicenca) => {
    if (!searchTerm) return true;
    const term = String(searchTerm ?? '').toLowerCase();
    return (
      String(pagamento.instituicao?.nome ?? '').toLowerCase().includes(term) ||
      String(pagamento.plano ?? '').toLowerCase().includes(term) ||
      String(pagamento.referencia ?? '').toLowerCase().includes(term) ||
      String(pagamento.instituicao?.subdominio ?? '').toLowerCase().includes(term)
    );
  });

  // Mutation para confirmar pagamento
  const confirmarMutation = useSafeMutation({
    mutationFn: (pagamentoId: string) =>
      pagamentoLicencaApi.confirmar(pagamentoId, observacoes || undefined),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pagamentos-licenca-admin'] });
      toast({
        title: 'Pagamento confirmado',
        description: data.renovacaoAutomatica
          ? `Licença renovada automaticamente até ${data.novaDataFim ? format(new Date(data.novaDataFim), "dd/MM/yyyy") : ''}`
          : 'Pagamento confirmado com sucesso',
      });
      setConfirmDialogOpen(false);
      setSelectedPagamento(null);
      setObservacoes('');
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.response?.data?.message || 'Erro ao confirmar pagamento',
        variant: 'destructive',
      });
    },
  });

  // Mutation para cancelar pagamento
  const cancelarMutation = useSafeMutation({
    mutationFn: (pagamentoId: string) =>
      pagamentoLicencaApi.cancelar(pagamentoId, observacoes || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagamentos-licenca-admin'] });
      toast({
        title: 'Pagamento cancelado',
        description: 'Pagamento cancelado com sucesso',
      });
      setCancelDialogOpen(false);
      setSelectedPagamento(null);
      setObservacoes('');
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.response?.data?.message || 'Erro ao cancelar pagamento',
        variant: 'destructive',
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'AOA',
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Pago
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Falhou
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="outline">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelado
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleConfirmar = (pagamento: PagamentoLicenca) => {
    setSelectedPagamento(pagamento);
    setObservacoes('');
    setConfirmDialogOpen(true);
  };

  const handleCancelar = (pagamento: PagamentoLicenca) => {
    setSelectedPagamento(pagamento);
    setObservacoes('');
    setCancelDialogOpen(true);
  };

  const confirmarPagamento = () => {
    if (selectedPagamento) {
      confirmarMutation.mutate(selectedPagamento.id);
    }
  };

  const cancelarPagamento = () => {
    if (selectedPagamento) {
      cancelarMutation.mutate(selectedPagamento.id);
    }
  };

  // Handler para baixar recibo/fatura
  const handleDownloadDocumento = async (pagamento: PagamentoLicenca) => {
    try {
      // Buscar dados do documento fiscal
      const dados = await documentoFiscalApi.getByPagamento(pagamento.id);

      // Preparar dados para geração de PDF
      const documentoData: DocumentoFiscalLicencaData = {
        tipo: dados.documento.tipo,
        numeroDocumento: dados.documento.numeroDocumento,
        instituicao: {
          nome: dados.instituicao.nome,
          logoUrl: dados.instituicao.logoUrl || null,
          email: dados.instituicao.emailContato || null,
          telefone: dados.instituicao.telefone || null,
          endereco: dados.instituicao.endereco || null,
          nif: dados.instituicao.configuracao?.nif || null,
        },
        plano: {
          nome: dados.planoSnapshot?.nome || dados.pagamento.plano,
        },
        valor: Number(dados.pagamento.valor),
        moeda: dados.documento.moeda,
        periodo: dados.pagamento.periodo,
        metodo: dados.pagamento.metodo,
        referencia: dados.pagamento.referencia || null,
        dataEmissao: dados.documento.dataEmissao || new Date().toISOString(),
        dataPagamento: dados.pagamento.pagoEm || new Date().toISOString(),
      };

      await downloadDocumentoFiscalLicenca(documentoData);

      toast({
        title: "Sucesso",
        description: "Documento fiscal baixado com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || "Erro ao baixar documento fiscal",
        variant: "destructive",
      });
    }
  };

  // Estatísticas
  const pagamentosPendentes = pagamentosFiltrados.filter((p: PagamentoLicenca) => p.status === 'PENDING').length;
  const totalPago = pagamentosFiltrados
    .filter((p: PagamentoLicenca) => p.status === 'PAID')
    .reduce((sum: number, p: PagamentoLicenca) => sum + Number(p.valor), 0);

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagamentosFiltrados.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pagamentosPendentes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPago)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Instituição, plano, referência..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="PAID">Pago</SelectItem>
                  <SelectItem value="FAILED">Falhou</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Instituição</Label>
              <Select value={instituicaoFilter} onValueChange={setInstituicaoFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {instituicoes.map((inst: any) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Pagamentos */}
      <Card>
        <CardHeader>
          <CardTitle>Pagamentos de Licença</CardTitle>
          <CardDescription>Gerencie todos os pagamentos de licença do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando pagamentos...</p>
          ) : pagamentosFiltrados.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum pagamento encontrado</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instituição</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagamentosFiltrados.map((pagamento: PagamentoLicenca) => (
                    <TableRow key={pagamento.id}>
                      <TableCell className="font-medium">
                        {pagamento.instituicao?.nome || 'N/A'}
                        <div className="text-xs text-muted-foreground">
                          {pagamento.instituicao?.subdominio}
                        </div>
                      </TableCell>
                      <TableCell>{pagamento.plano}</TableCell>
                      <TableCell>{pagamento.periodo}</TableCell>
                      <TableCell>{formatCurrency(pagamento.valor)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{pagamento.metodo}</Badge>
                      </TableCell>
                      <TableCell>
                        {pagamento.gateway ? (
                          <Badge variant="secondary">{pagamento.gateway}</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{pagamento.referencia || '-'}</TableCell>
                      <TableCell>{getStatusBadge(pagamento.status)}</TableCell>
                      <TableCell>
                        {format(new Date(pagamento.criadoEm), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {pagamento.pagoEm
                          ? format(new Date(pagamento.pagoEm), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {pagamento.status === 'PENDING' && (
                            <>
                              {/* Só mostrar botão de confirmar para pagamentos MANUAIS */}
                              {pagamento.metodo !== 'ONLINE' && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleConfirmar(pagamento)}
                                  disabled={confirmarMutation.isPending}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Confirmar
                                </Button>
                              )}
                              {/* Pagamentos online mostram status diferente */}
                              {pagamento.metodo === 'ONLINE' && (
                                <Badge variant="outline" className="text-xs">
                                  Aguardando Gateway
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleCancelar(pagamento)}
                                disabled={cancelarMutation.isPending}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Cancelar
                              </Button>
                            </>
                          )}
                          {pagamento.status === 'PAID' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadDocumento(pagamento)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Recibo
                            </Button>
                          )}
                          {pagamento.status !== 'PENDING' && pagamento.status !== 'PAID' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedPagamento(pagamento);
                              }}
                            >
                              <Eye className="h-4 w-4" />
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

      {/* Dialog Confirmar Pagamento */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              Confirme o recebimento do pagamento. A licença será renovada automaticamente.
            </DialogDescription>
          </DialogHeader>
          {selectedPagamento && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-md">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Instituição:</span>
                    <span className="font-medium">{selectedPagamento.instituicao?.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plano:</span>
                    <span className="font-medium">{selectedPagamento.plano} - {selectedPagamento.periodo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-medium">{formatCurrency(selectedPagamento.valor)}</span>
                  </div>
                  {selectedPagamento.referencia && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Referência:</span>
                      <span className="font-medium">{selectedPagamento.referencia}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações sobre a confirmação do pagamento"
                  rows={3}
                />
              </div>
              {selectedPagamento.assinatura?.dataFim && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Licença atual expira em:{' '}
                    {format(new Date(selectedPagamento.assinatura.dataFim), "dd/MM/yyyy", { locale: ptBR })}
                    . A nova data será calculada automaticamente após a confirmação.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarPagamento}
              disabled={confirmarMutation.isPending}
            >
              {confirmarMutation.isPending ? 'Confirmando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Cancelar Pagamento */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este pagamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedPagamento && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-md">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Instituição:</span>
                    <span className="font-medium">{selectedPagamento.instituicao?.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-medium">{formatCurrency(selectedPagamento.valor)}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Motivo do cancelamento (opcional)</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Motivo do cancelamento"
                  rows={3}
                />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={cancelarPagamento}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelarMutation.isPending}
            >
              {cancelarMutation.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

