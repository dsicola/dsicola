import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { useNavigate } from 'react-router-dom';
import { profilesApi, mensalidadesApi, matriculasApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  FileText,
  Receipt,
  Calendar,
  LogOut,
} from 'lucide-react';
import { 
  ReciboData, 
  downloadReciboA4, 
  downloadReciboTermico 
} from '@/utils/pdfGenerator';
import { PrintReceiptDialog } from '@/components/secretaria/PrintReceiptDialog';

interface Mensalidade {
  id: string;
  aluno_id: string;
  valor: number;
  status: string;
  data_vencimento: string;
  data_pagamento: string | null;
  multa: boolean;
  valor_multa: number;
  mes_referencia: number;
  ano_referencia: number;
  forma_pagamento: string | null;
  recibo_numero: string | null;
}

export default function MinhasMensalidades() {
  const { user, signOut } = useAuth();
  const { config } = useInstituicao();
  const navigate = useNavigate();
  const [selectedMensalidade, setSelectedMensalidade] = useState<Mensalidade | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useSafeDialog(false);

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const data = await profilesApi.getById(user.id);
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch student's mensalidades
  const { data: mensalidades, isLoading } = useQuery({
    queryKey: ['minhas-mensalidades', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Use the specific route for students to get their own mensalidades
      const data = await mensalidadesApi.getMinhasMensalidades();
      return data as Mensalidade[];
    },
    enabled: !!user?.id,
  });

  // Fetch student's course info
  const { data: matriculaInfo } = useQuery({
    queryKey: ['aluno-matricula-info', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const matriculas = await matriculasApi.getByAlunoId(user.id);
      return matriculas?.[0] || null;
    },
    enabled: !!user?.id,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: 'AOA',
    }).format(value);
  };

  const getMesNome = (mes: number) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mes - 1] || '';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pago':
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20"><CheckCircle className="h-3 w-3 mr-1" /> Pago</Badge>;
      case 'Pendente':
        return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      case 'Atrasado':
        return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20"><AlertTriangle className="h-3 w-3 mr-1" /> Atrasado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const createReciboData = (mensalidade: Mensalidade): ReciboData => {
    return {
      instituicao: {
        nome: config?.nome_instituicao || 'Universidade',
        nif: (config as { nif?: string })?.nif ?? null,
        logoUrl: config?.logo_url,
        email: config?.email,
        telefone: config?.telefone,
        endereco: config?.endereco,
      },
      aluno: {
        nome: profile?.nome_completo || 'Aluno',
        numeroId: profile?.numero_identificacao_publica,
        bi: profile?.numero_identificacao,
        email: profile?.email,
        curso: matriculaInfo?.turmas?.cursos?.nome,
        turma: matriculaInfo?.turmas?.nome,
      },
      pagamento: {
        valor: Number(mensalidade.valor),
        valorMulta: Number(mensalidade.valor_multa || 0),
        mesReferencia: mensalidade.mes_referencia,
        anoReferencia: mensalidade.ano_referencia,
        dataPagamento: mensalidade.data_pagamento || new Date().toISOString(),
        formaPagamento: mensalidade.forma_pagamento || 'N/A',
        reciboNumero: mensalidade.recibo_numero || `REC-${mensalidade.id.substring(0, 8)}`,
      },
    };
  };

  const handleDownloadRecibo = async (mensalidade: Mensalidade) => {
    try {
      const reciboData = createReciboData(mensalidade);
      await downloadReciboA4(reciboData);
      toast({
        title: 'Recibo baixado',
        description: 'O recibo foi baixado com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao baixar recibo',
        description: 'Ocorreu um erro ao gerar o PDF.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenPrintDialog = (mensalidade: Mensalidade) => {
    setSelectedMensalidade(mensalidade);
    setShowPrintDialog(true);
  };

  const pagas = mensalidades?.filter(m => m.status === 'Pago') || [];
  const pendentes = mensalidades?.filter(m => m.status === 'Pendente') || [];
  const atrasadas = mensalidades?.filter(m => m.status === 'Atrasado') || [];

  const totalPago = pagas.reduce((acc, m) => acc + Number(m.valor), 0);
  const totalPendente = pendentes.reduce((acc, m) => acc + Number(m.valor), 0);
  const totalAtrasado = atrasadas.reduce((acc, m) => acc + Number(m.valor) + Number(m.valor_multa || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Minhas Mensalidades</h1>
            <p className="text-muted-foreground">
              Acompanhe seus pagamentos e baixe os recibos
            </p>
          </div>
          <Button 
            variant="destructive" 
            onClick={async () => {
              await signOut();
              navigate('/auth');
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{pagas.length}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalPago)}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendentes.length}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalPendente)}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{atrasadas.length}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalAtrasado)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="todas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="todas">
              <FileText className="h-4 w-4 mr-2" />
              Todas
            </TabsTrigger>
            <TabsTrigger value="pagas">
              <CheckCircle className="h-4 w-4 mr-2" />
              Pagas ({pagas.length})
            </TabsTrigger>
            <TabsTrigger value="pendentes">
              <Clock className="h-4 w-4 mr-2" />
              Pendentes ({pendentes.length + atrasadas.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="todas">
            <Card>
              <CardHeader>
                <CardTitle>Histórico Completo</CardTitle>
                <CardDescription>Todas as suas mensalidades</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </div>
                ) : mensalidades && mensalidades.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Referência</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead className="text-right">Recibo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mensalidades.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {getMesNome(m.mes_referencia)}/{m.ano_referencia}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{formatCurrency(Number(m.valor) - Number(m.valor_desconto || 0))}</p>
                                {Number(m.valor_desconto || 0) > 0 && (
                                  <p className="text-xs text-green-600">
                                    -{formatCurrency(Number(m.valor_desconto))} desconto
                                  </p>
                                )}
                                {Number(m.valor_multa || 0) > 0 && (
                                  <p className="text-xs text-destructive">
                                    +{formatCurrency(Number(m.valor_multa))} multa
                                  </p>
                                )}
                                {Number(m.valor_juros || 0) > 0 && (
                                  <p className="text-xs text-destructive">
                                    +{formatCurrency(Number(m.valor_juros))} juros
                                  </p>
                                )}
                                <p className="font-semibold text-primary border-t pt-1 mt-1">
                                  Total: {formatCurrency(
                                    Number(m.valor) 
                                    - Number(m.valor_desconto || 0)
                                    + Number(m.valor_multa || 0)
                                    + Number(m.valor_juros || 0)
                                  )}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(m.data_vencimento), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell>{getStatusBadge(m.status)}</TableCell>
                            <TableCell>
                              {m.data_pagamento
                                ? format(new Date(m.data_pagamento), 'dd/MM/yyyy')
                                : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {m.status === 'Pago' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenPrintDialog(m)}
                                  title="Baixar recibo"
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Recibo
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma mensalidade encontrada</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pagas">
            <Card>
              <CardHeader>
                <CardTitle>Mensalidades Pagas</CardTitle>
                <CardDescription>Baixe seus comprovantes de pagamento</CardDescription>
              </CardHeader>
              <CardContent>
                {pagas.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pagas.map((m) => (
                      <Card key={m.id} className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-5 w-5 text-green-500" />
                              <span className="font-medium">
                                {getMesNome(m.mes_referencia)}/{m.ano_referencia}
                              </span>
                            </div>
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                              Pago
                            </Badge>
                          </div>
                          <p className="text-lg font-bold mb-1">
                            {formatCurrency(Number(m.valor))}
                          </p>
                          <p className="text-sm text-muted-foreground mb-3">
                            Pago em {m.data_pagamento ? format(new Date(m.data_pagamento), 'dd/MM/yyyy') : '-'}
                          </p>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleOpenPrintDialog(m)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Baixar Recibo
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma mensalidade paga</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pendentes">
            <Card>
              <CardHeader>
                <CardTitle>Mensalidades Pendentes</CardTitle>
                <CardDescription>Mensalidades aguardando pagamento</CardDescription>
              </CardHeader>
              <CardContent>
                {pendentes.length > 0 || atrasadas.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...atrasadas, ...pendentes].map((m) => (
                      <Card 
                        key={m.id} 
                        className={m.status === 'Atrasado' 
                          ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' 
                          : 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20'
                        }
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {m.status === 'Atrasado' ? (
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                              ) : (
                                <Clock className="h-5 w-5 text-yellow-500" />
                              )}
                              <span className="font-medium">
                                {getMesNome(m.mes_referencia)}/{m.ano_referencia}
                              </span>
                            </div>
                            {getStatusBadge(m.status)}
                          </div>
                          <p className="text-lg font-bold mb-1">
                            {formatCurrency(
                              Number(m.valor) 
                              - Number(m.valor_desconto || 0)
                              + Number(m.valor_multa || 0)
                              + Number(m.valor_juros || 0)
                            )}
                          </p>
                          {(Number(m.valor_multa || 0) > 0 || Number(m.valor_juros || 0) > 0) && (
                            <div className="text-xs text-destructive mb-1 space-y-0.5">
                              {Number(m.valor_multa || 0) > 0 && (
                                <p>Multa: {formatCurrency(Number(m.valor_multa))}</p>
                              )}
                              {Number(m.valor_juros || 0) > 0 && (
                                <p>Juros: {formatCurrency(Number(m.valor_juros))}</p>
                              )}
                            </div>
                          )}
                          <p className="text-sm text-muted-foreground">
                            Vence em {format(new Date(m.data_vencimento), 'dd/MM/yyyy')}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>Você está em dia! Nenhuma mensalidade pendente.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Print Dialog */}
        {selectedMensalidade && (
          <PrintReceiptDialog
            open={showPrintDialog}
            onOpenChange={setShowPrintDialog}
            reciboData={createReciboData(selectedMensalidade)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
