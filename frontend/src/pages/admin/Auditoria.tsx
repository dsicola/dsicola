import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { logsAuditoriaApi } from "@/services/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Search, FileText, Eye, Clock, User, Activity, Shield, Filter, Calendar, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { DetalhesAuditoriaDialog } from "@/components/auditoria/DetalhesAuditoriaDialog";

interface LogAuditoria {
  id: string;
  instituicaoId?: string | null;
  modulo?: string | null;
  entidade?: string | null;
  entidadeId?: string | null;
  acao: string;
  dadosAnteriores?: any;
  dadosNovos?: any;
  userId?: string | null;
  perfilUsuario?: string | null;
  rota?: string | null;
  ipOrigem?: string | null;
  userAgent?: string | null;
  observacao?: string | null;
  createdAt: string;
  // Campos de compatibilidade
  userEmail?: string | null;
  userNome?: string | null;
  tabela?: string | null;
  registroId?: string | null;
  ip?: string | null;
  comparacao?: {
    temAntes: boolean;
    temDepois: boolean;
    podeComparar: boolean;
  };
}

const modulosLabels: { [key: string]: string } = {
  CALENDARIO_ACADEMICO: "Calendário Acadêmico",
  PLANO_ENSINO: "Plano de Ensino",
  DISTRIBUICAO_AULAS: "Distribuição de Aulas",
  LANCAMENTO_AULAS: "Lançamento de Aulas",
  PRESENCAS: "Presenças",
  AVALIACOES_NOTAS: "Avaliações e Notas",
  TRIMESTRE: "Trimestre",
  ANO_LETIVO: "Ano Letivo",
  CONFIGURACAO: "Configuração",
};

const acoesLabels: { [key: string]: string } = {
  CREATE: "Criar",
  UPDATE: "Atualizar",
  DELETE: "Excluir",
  SUBMIT: "Submeter",
  APPROVE: "Aprovar",
  REJECT: "Rejeitar",
  CLOSE: "Encerrar",
  REOPEN: "Reabrir",
  BLOCK: "Bloquear",
};

export default function Auditoria() {
  const navigate = useNavigate();
  const { instituicaoId } = useTenantFilter();
  const [searchTerm, setSearchTerm] = useState("");
  const [moduloFilter, setModuloFilter] = useState<string>("all");
  const [acaoFilter, setAcaoFilter] = useState<string>("all");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [showDetalhesDialog, setShowDetalhesDialog] = useSafeDialog(false);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["logs-auditoria", instituicaoId, moduloFilter, acaoFilter, dataInicio, dataFim],
    queryFn: async () => {
      const params: any = { limit: 1000 };
      if (moduloFilter !== "all") params.modulo = moduloFilter;
      if (acaoFilter !== "all") params.acao = acaoFilter;
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;
      const data = await logsAuditoriaApi.getAll(params);
      return data as LogAuditoria[];
    },
    enabled: !!instituicaoId,
  });

  const { data: stats } = useQuery({
    queryKey: ["logs-auditoria-stats", instituicaoId, dataInicio, dataFim],
    queryFn: async () => {
      const params: any = {};
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;
      return await logsAuditoriaApi.getStats(params);
    },
    enabled: !!instituicaoId,
  });

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      (log.userNome || log.userEmail || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.acao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.modulo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entidade || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.observacao || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getAcaoBadgeVariant = (acao: string) => {
    const acaoUpper = acao.toUpperCase();
    if (acaoUpper.includes("CREATE") || acaoUpper.includes("CRIAR")) {
      return "default";
    }
    if (acaoUpper.includes("UPDATE") || acaoUpper.includes("EDITAR") || acaoUpper.includes("ATUALIZAR")) {
      return "secondary";
    }
    if (acaoUpper.includes("DELETE") || acaoUpper.includes("EXCLUIR") || acaoUpper.includes("REMOVER")) {
      return "destructive";
    }
    if (acaoUpper.includes("APPROVE") || acaoUpper.includes("APROVAR")) {
      return "default";
    }
    if (acaoUpper.includes("REJECT") || acaoUpper.includes("REJEITAR")) {
      return "destructive";
    }
    if (acaoUpper.includes("CLOSE") || acaoUpper.includes("ENCERRAR")) {
      return "secondary";
    }
    if (acaoUpper.includes("REOPEN") || acaoUpper.includes("REABRIR")) {
      return "default";
    }
    return "outline";
  };

  const getModuloBadge = (modulo: string | null | undefined) => {
    if (!modulo) return null;
    return <Badge variant="outline">{modulosLabels[modulo] || modulo}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin-dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Auditoria / Histórico
            </h1>
            <p className="text-muted-foreground">
              Rastreabilidade completa de todas as ações críticas no sistema
            </p>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total de Logs</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Módulos Auditados</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.porModulo?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Entidades</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.porEntidade?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.porUsuario?.length || 0}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Auditoria</CardTitle>
            <CardDescription>
              Logs imutáveis de todas as ações críticas. Logs não podem ser editados ou excluídos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por usuário, ação, módulo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={moduloFilter} onValueChange={setModuloFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Módulo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os módulos</SelectItem>
                  {Object.entries(modulosLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={acaoFilter} onValueChange={setAcaoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  {Object.entries(acoesLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  type="date"
                  placeholder="Data início"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="date"
                  placeholder="Data fim"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Tabela de Logs */}
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Carregando logs...</p>
            ) : filteredLogs && filteredLogs.length > 0 ? (
              <div className="rounded-md border">
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Data/Hora</TableHead>
                        <TableHead className="w-[180px]">Usuário</TableHead>
                        <TableHead className="w-[120px]">Módulo</TableHead>
                        <TableHead className="w-[100px]">Ação</TableHead>
                        <TableHead>Entidade</TableHead>
                        <TableHead className="w-[120px]">ID Registro</TableHead>
                        <TableHead className="text-right w-[80px]">Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono text-xs">
                                {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{log.userNome || log.userEmail || "Sistema"}</p>
                              <p className="text-xs text-muted-foreground">{log.perfilUsuario || "-"}</p>
                              {log.userEmail && (
                                <p className="text-xs text-muted-foreground">{log.userEmail}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getModuloBadge(log.modulo)}</TableCell>
                          <TableCell>
                            <Badge variant={getAcaoBadgeVariant(log.acao)}>
                              {acoesLabels[log.acao] || log.acao}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {log.entidade || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono">
                            {log.entidadeId ? log.entidadeId.substring(0, 8) + "..." : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => {
                                setSelectedLogId(log.id);
                                setShowDetalhesDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum log encontrado</p>
            )}
          </CardContent>
        </Card>

        {/* Dialog: Detalhes da Auditoria (Antes/Depois) */}
        <DetalhesAuditoriaDialog
          logId={selectedLogId}
          open={showDetalhesDialog}
          onOpenChange={setShowDetalhesDialog}
        />
      </div>
    </DashboardLayout>
  );
}
