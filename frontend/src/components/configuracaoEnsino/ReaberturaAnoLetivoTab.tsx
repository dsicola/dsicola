import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reaberturaAnoLetivoApi, anoLetivoApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileLock,
  History,
  Loader2,
  Lock,
  Unlock,
  Calendar,
  User,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type EscopoReabertura = 'NOTAS' | 'PRESENCAS' | 'AVALIACOES' | 'MATRICULAS' | 'GERAL';

interface Reabertura {
  id: string;
  instituicaoId: string;
  anoLetivoId: string;
  motivo: string;
  escopo: EscopoReabertura;
  dataInicio: string;
  dataFim: string;
  autorizadoPor: string;
  ativo: boolean;
  encerradoEm?: string | null;
  encerradoPor?: string | null;
  observacoes?: string | null;
  createdAt: string;
  autorizador?: {
    id: string;
    nomeCompleto: string;
    email: string;
  };
  encerrador?: {
    id: string;
    nomeCompleto: string;
    email: string;
  };
  anoLetivo?: {
    id: string;
    ano: number;
    status: string;
  };
}

export function ReaberturaAnoLetivoTab() {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { tipoAcademico, isSuperior, isSecundario } = useInstituicao();

  // Buscar anos letivos disponíveis (apenas encerrados)
  const { data: anosLetivos = [], isLoading: isLoadingAnosLetivos } = useQuery({
    queryKey: ["anos-letivos-reabertura", instituicaoId],
    queryFn: async () => {
      const todos = await anoLetivoApi.getAll();
      // Filtrar apenas anos letivos ENCERRADOS
      return todos.filter((al: any) => al.status === 'ENCERRADO');
    },
    enabled: !!instituicaoId,
  });

  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [encerrarDialogOpen, setEncerrarDialogOpen] = useSafeDialog(false);
  const [selectedReabertura, setSelectedReabertura] = useState<Reabertura | null>(null);
  
  const [formData, setFormData] = useState({
    anoLetivoId: "",
    motivo: "",
    escopo: 'GERAL' as EscopoReabertura,
    dataInicio: "",
    dataFim: "",
    observacoes: "",
  });

  const [encerrarObservacoes, setEncerrarObservacoes] = useState("");

  // Buscar reaberturas
  const { data: reaberturas = [], isLoading } = useQuery({
    queryKey: ["reaberturas-ano-letivo", instituicaoId],
    queryFn: async () => {
      return await reaberturaAnoLetivoApi.listar();
    },
    enabled: !!instituicaoId,
  });

  // Separar reaberturas ativas e históricas
  const reaberturasAtivas = useMemo(() => {
    const agora = new Date();
    return reaberturas.filter((r: Reabertura) => {
      if (!r.ativo) return false;
      const dataFim = new Date(r.dataFim);
      return dataFim >= agora;
    });
  }, [reaberturas]);

  const reaberturasHistoricas = useMemo(() => {
    const agora = new Date();
    return reaberturas.filter((r: Reabertura) => {
      if (r.ativo) {
        const dataFim = new Date(r.dataFim);
        return dataFim < agora;
      }
      return true;
    });
  }, [reaberturas]);

  // Mutation para criar reabertura
  const criarMutation = useSafeMutation({
    mutationFn: (data: typeof formData) => reaberturaAnoLetivoApi.criar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reaberturas-ano-letivo"] });
      toast({
        title: "Reabertura criada",
        description: "A reabertura excepcional foi criada com sucesso. Todas as operações durante este período serão auditadas.",
      });
      setDialogOpen(false);
      setFormData({
        anoLetivoId: "",
        motivo: "",
        escopo: 'GERAL',
        dataInicio: "",
        dataFim: "",
        observacoes: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar reabertura",
        description: error?.response?.data?.message || "Erro ao criar reabertura excepcional",
        variant: "destructive",
      });
    },
  });

  // Mutation para encerrar reabertura
  const encerrarMutation = useSafeMutation({
    mutationFn: (data: { id: string; observacoes?: string }) => 
      reaberturaAnoLetivoApi.encerrar(data.id, { observacoes: data.observacoes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reaberturas-ano-letivo"] });
      toast({
        title: "Reabertura encerrada",
        description: "A reabertura foi encerrada com sucesso. O ano letivo voltou ao estado de bloqueio.",
      });
      setEncerrarDialogOpen(false);
      setSelectedReabertura(null);
      setEncerrarObservacoes("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao encerrar reabertura",
        description: error?.response?.data?.message || "Erro ao encerrar reabertura",
        variant: "destructive",
      });
    },
  });

  const getEscopoLabel = (escopo: EscopoReabertura) => {
    switch (escopo) {
      case 'NOTAS':
        return 'Notas';
      case 'PRESENCAS':
        return 'Presenças';
      case 'AVALIACOES':
        return 'Avaliações';
      case 'MATRICULAS':
        return 'Matrículas';
      case 'GERAL':
        return 'Geral (Todas as operações)';
      default:
        return escopo;
    }
  };

  const getEscopoBadge = (escopo: EscopoReabertura) => {
    const variant = escopo === 'GERAL' ? 'default' : 'outline';
    return <Badge variant={variant}>{getEscopoLabel(escopo)}</Badge>;
  };

  const getStatusBadge = (reabertura: Reabertura) => {
    const agora = new Date();
    const dataFim = new Date(reabertura.dataFim);
    
    if (!reabertura.ativo) {
      return <Badge variant="destructive">Encerrada</Badge>;
    }
    
    if (dataFim < agora) {
      return <Badge variant="secondary">Expirada</Badge>;
    }
    
    return <Badge variant="default" className="bg-green-600">Ativa</Badge>;
  };

  const handleCriar = () => {
    if (!formData.anoLetivoId || !formData.motivo || !formData.dataInicio || !formData.dataFim) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    criarMutation.mutate(formData);
  };

  const handleEncerrar = (reabertura: Reabertura) => {
    setSelectedReabertura(reabertura);
    setEncerrarDialogOpen(true);
  };

  const handleConfirmarEncerrar = () => {
    if (!selectedReabertura) return;
    encerrarMutation.mutate({
      id: selectedReabertura.id,
      observacoes: encerrarObservacoes || undefined,
    });
  };

  // Escopos recomendados por tipo de instituição
  const escoposRecomendados = useMemo(() => {
    if (isSuperior) {
      return ['NOTAS', 'AVALIACOES', 'GERAL'];
    } else if (isSecundario) {
      return ['AVALIACOES', 'NOTAS', 'GERAL'];
    }
    return ['NOTAS', 'PRESENCAS', 'AVALIACOES', 'MATRICULAS', 'GERAL'];
  }, [isSuperior, isSecundario]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5" />
            Reabertura Excepcional do Ano Letivo
          </CardTitle>
          <CardDescription>
            Gerencie reaberturas excepcionais de anos letivos encerrados. A reabertura é temporária, justificada e totalmente auditada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> A reabertura é uma exceção administrativa. Todas as operações realizadas durante o período de reabertura serão registradas em auditoria.
            </AlertDescription>
          </Alert>

          <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
            <Unlock className="h-4 w-4 mr-2" />
            Criar Reabertura Excepcional
          </Button>
        </CardContent>
      </Card>

      {/* Reaberturas Ativas */}
      {reaberturasAtivas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Reaberturas Ativas
            </CardTitle>
            <CardDescription>
              Reaberturas em andamento que permitem operações acadêmicas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ano Letivo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Escopo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Autorizado Por</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reaberturasAtivas.map((reabertura: Reabertura) => (
                    <TableRow key={reabertura.id}>
                      <TableCell className="font-medium">
                        {reabertura.anoLetivo?.ano || 'N/A'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {reabertura.motivo}
                      </TableCell>
                      <TableCell>
                        {getEscopoBadge(reabertura.escopo)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{format(new Date(reabertura.dataInicio), "dd/MM/yyyy", { locale: ptBR })}</div>
                          <div className="text-muted-foreground">até</div>
                          <div>{format(new Date(reabertura.dataFim), "dd/MM/yyyy", { locale: ptBR })}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(reabertura)}
                      </TableCell>
                      <TableCell>
                        {reabertura.autorizador?.nomeCompleto || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEncerrar(reabertura)}
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          Encerrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reaberturas Históricas */}
      {reaberturasHistoricas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Reaberturas
            </CardTitle>
            <CardDescription>
              Reaberturas encerradas ou expiradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ano Letivo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Escopo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Autorizado Por</TableHead>
                    <TableHead>Encerrado Por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reaberturasHistoricas.map((reabertura: Reabertura) => (
                    <TableRow key={reabertura.id}>
                      <TableCell className="font-medium">
                        {reabertura.anoLetivo?.ano || 'N/A'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {reabertura.motivo}
                      </TableCell>
                      <TableCell>
                        {getEscopoBadge(reabertura.escopo)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{format(new Date(reabertura.dataInicio), "dd/MM/yyyy", { locale: ptBR })}</div>
                          <div className="text-muted-foreground">até</div>
                          <div>{format(new Date(reabertura.dataFim), "dd/MM/yyyy", { locale: ptBR })}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(reabertura)}
                      </TableCell>
                      <TableCell>
                        {reabertura.autorizador?.nomeCompleto || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {reabertura.encerrador?.nomeCompleto || reabertura.encerradoEm ? 'Automático' : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {reaberturas.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <FileLock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma reabertura registrada</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Criar Reabertura */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Reabertura Excepcional</DialogTitle>
            <DialogDescription>
              A reabertura é temporária e auditada. Todas as operações durante este período serão registradas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="anoLetivoId">Ano Letivo *</Label>
              <Select
                value={formData.anoLetivoId}
                onValueChange={(value) => setFormData({ ...formData, anoLetivoId: value })}
                disabled={isLoadingAnosLetivos || anosLetivos.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingAnosLetivos ? "Carregando..." : anosLetivos.length === 0 ? "Nenhum ano letivo encerrado disponível" : "Selecione o ano letivo"} />
                </SelectTrigger>
                <SelectContent>
                  {anosLetivos.map((al: any) => (
                    <SelectItem key={al.id} value={al.id}>
                      {al.ano} - Encerrado
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {anosLetivos.length === 0 && !isLoadingAnosLetivos && (
                <p className="text-xs text-muted-foreground">
                  Apenas anos letivos ENCERRADOS podem ter reabertura excepcional.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da Reabertura *</Label>
              <Textarea
                id="motivo"
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                placeholder="Descreva o motivo da reabertura excepcional (obrigatório)"
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Este motivo será registrado em auditoria e não pode ser deixado em branco.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="escopo">Escopo Permitido *</Label>
              <Select
                value={formData.escopo}
                onValueChange={(value) => setFormData({ ...formData, escopo: value as EscopoReabertura })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GERAL">Geral (Todas as operações)</SelectItem>
                  <SelectItem value="NOTAS">Notas</SelectItem>
                  <SelectItem value="PRESENCAS">Presenças</SelectItem>
                  <SelectItem value="AVALIACOES">Avaliações</SelectItem>
                  <SelectItem value="MATRICULAS">Matrículas</SelectItem>
                </SelectContent>
              </Select>
              {isSuperior && (
                <p className="text-xs text-muted-foreground">
                  Recomendado para Ensino Superior: Notas, Avaliações ou Geral
                </p>
              )}
              {isSecundario && (
                <p className="text-xs text-muted-foreground">
                  Recomendado para Ensino Secundário: Avaliações, Notas ou Geral
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dataInicio">Data de Início *</Label>
                <Input
                  id="dataInicio"
                  type="datetime-local"
                  value={formData.dataInicio}
                  onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataFim">Data de Término *</Label>
                <Input
                  id="dataFim"
                  type="datetime-local"
                  value={formData.dataFim}
                  onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações (opcional)</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações adicionais sobre a reabertura"
                rows={3}
                className="resize-none"
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                A reabertura expirará automaticamente na data de término. Você também pode encerrá-la manualmente antes do prazo.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCriar}
              disabled={
                criarMutation.isPending ||
                !formData.anoLetivoId ||
                !formData.motivo ||
                !formData.dataInicio ||
                !formData.dataFim
              }
            >
              {criarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Reabertura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Encerrar Reabertura */}
      <Dialog open={encerrarDialogOpen} onOpenChange={setEncerrarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar Reabertura</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja encerrar esta reabertura antes do prazo? O ano letivo voltará ao estado de bloqueio.
            </DialogDescription>
          </DialogHeader>
          {selectedReabertura && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Ano Letivo: {selectedReabertura.anoLetivo?.ano || 'N/A'}
                </p>
                <p className="text-sm text-blue-800">
                  Motivo: {selectedReabertura.motivo}
                </p>
                <p className="text-sm text-blue-800">
                  Escopo: {getEscopoLabel(selectedReabertura.escopo)}
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  Período: {format(new Date(selectedReabertura.dataInicio), "dd/MM/yyyy", { locale: ptBR })} até {format(new Date(selectedReabertura.dataFim), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="encerrarObservacoes">Observações (opcional)</Label>
                <Textarea
                  id="encerrarObservacoes"
                  value={encerrarObservacoes}
                  onChange={(e) => setEncerrarObservacoes(e.target.value)}
                  placeholder="Observações sobre o encerramento antecipado"
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncerrarDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarEncerrar}
              variant="destructive"
              disabled={encerrarMutation.isPending || !selectedReabertura}
            >
              {encerrarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Encerramento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

