import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { logsAuditoriaApi } from "@/services/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Search, FileText, Eye, Clock, User, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { DetalhesAuditoriaDialog } from "@/components/auditoria/DetalhesAuditoriaDialog";

interface LogAuditoria {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userNome: string | null;
  user_id?: string | null; // Compatibilidade
  user_email?: string | null; // Compatibilidade
  user_nome?: string | null; // Compatibilidade
  acao: string;
  modulo?: string | null;
  entidade?: string | null;
  entidadeId?: string | null;
  tabela?: string | null; // Compatibilidade
  registro_id?: string | null; // Compatibilidade
  registroId?: string | null; // Compatibilidade
  dados_anteriores?: any; // Compatibilidade
  dadosAnteriores?: any;
  dados_novos?: any; // Compatibilidade
  dadosNovos?: any;
  ip_address?: string | null; // Compatibilidade
  ipOrigem?: string | null;
  user_agent?: string | null; // Compatibilidade
  userAgent?: string | null;
  observacao?: string | null;
  createdAt: string;
  created_at?: string; // Compatibilidade
  instituicaoId?: string | null;
  instituicao_id?: string | null; // Compatibilidade
  instituicao?: {
    id: string;
    nome: string;
  } | null;
}

export default function LogsAuditoria() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [acaoFilter, setAcaoFilter] = useState("all");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [showDetalhesDialog, setShowDetalhesDialog] = useSafeDialog(false);
  const { instituicaoId, shouldFilter } = useTenantFilter();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["logs-auditoria", instituicaoId, dataInicio, dataFim],
    queryFn: async () => {
      // O backend já filtra por instituicaoId automaticamente via addInstitutionFilter
      // Filtros de data são enviados para o backend filtrar corretamente
      const params: any = { limit: 500 };
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;
      const data = await logsAuditoriaApi.getAll(params);
      return data as LogAuditoria[];
    },
    enabled: !!instituicaoId || !shouldFilter, // Só busca se tiver instituicaoId ou for SUPER_ADMIN
  });

  const filteredLogs = logs?.filter((log) => {
    // Normalizar campos para compatibilidade
    const userNome = String(log.userNome ?? log.user_nome ?? "");
    const userEmail = String(log.userEmail ?? log.user_email ?? "");
    const tabela = String(log.tabela ?? log.entidade ?? "");

    const searchLower = String(searchTerm ?? "").toLowerCase();
    const matchesSearch =
      userNome.toLowerCase().includes(searchLower) ||
      userEmail.toLowerCase().includes(searchLower) ||
      String(log?.acao ?? "").toLowerCase().includes(searchLower) ||
      tabela.toLowerCase().includes(searchLower) ||
      String(log.modulo ?? "").toLowerCase().includes(searchLower) ||
      String(log.observacao ?? "").toLowerCase().includes(searchLower);
    const matchesAcao = acaoFilter === "all" || String(log?.acao ?? "").toLowerCase().includes(String(acaoFilter ?? "").toLowerCase());
    return matchesSearch && matchesAcao;
  });

  const getAcaoBadgeVariant = (acao: string) => {
    const acaoLower = String(acao ?? "").toLowerCase();
    if (acaoLower.includes("criar") || acaoLower.includes("insert") || acaoLower.includes("novo")) {
      return "default";
    }
    if (acaoLower.includes("editar") || acaoLower.includes("update") || acaoLower.includes("alterar")) {
      return "secondary";
    }
    if (acaoLower.includes("excluir") || acaoLower.includes("delete") || acaoLower.includes("remover")) {
      return "destructive";
    }
    if (acaoLower.includes("login") || acaoLower.includes("logout") || acaoLower.includes("auth")) {
      return "outline";
    }
    return "outline";
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) {
      return "-";
    }
    try {
      // Garantir que a data seja parseada corretamente
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "-";
      }
      // Formato: DD/MM/YYYY HH:mm:ss
      return format(date, "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    } catch (error) {
      console.error("Erro ao formatar data:", error, dateString);
      return "-";
    }
  };

  const formatDateDetailed = (dateString: string | null | undefined) => {
    if (!dateString) {
      return "-";
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "-";
      }
      // Formato: DD/MM/YYYY às HH:mm:ss
      return format(date, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
    } catch (error) {
      console.error("Erro ao formatar data detalhada:", error, dateString);
      return "-";
    }
  };

  // Estatísticas
  const estatisticas = {
    total: logs?.length || 0,
    criar: logs?.filter((l) => String(l?.acao ?? '').toLowerCase().includes("criar") || String(l?.acao ?? '').toLowerCase().includes("insert")).length || 0,
    editar: logs?.filter((l) => String(l?.acao ?? '').toLowerCase().includes("editar") || String(l?.acao ?? '').toLowerCase().includes("update")).length || 0,
    excluir: logs?.filter((l) => String(l?.acao ?? '').toLowerCase().includes("excluir") || String(l?.acao ?? '').toLowerCase().includes("delete")).length || 0,
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
              <Activity className="h-8 w-8" />
              Logs de Auditoria
            </h1>
            <p className="text-muted-foreground">Rastreamento de ações dos usuários no sistema</p>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Logs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticas.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Criações</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{estatisticas.criar}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Edições</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{estatisticas.editar}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Exclusões</CardTitle>
              <Activity className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{estatisticas.excluir}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Ações</CardTitle>
            <CardDescription>Todas as ações realizadas no sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros */}
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por usuário, ação ou tabela..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={acaoFilter} onValueChange={setAcaoFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as ações</SelectItem>
                    <SelectItem value="criar">Criações</SelectItem>
                    <SelectItem value="editar">Edições</SelectItem>
                    <SelectItem value="excluir">Exclusões</SelectItem>
                    <SelectItem value="login">Login/Logout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Filtros de Data/Hora */}
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Data Início</label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Data Fim</label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
                {(dataInicio || dataFim) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDataInicio("");
                      setDataFim("");
                    }}
                  >
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </div>

            {/* Tabela de Logs */}
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Carregando logs...</p>
            ) : filteredLogs && filteredLogs.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Tabela</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead className="text-right">Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {formatDate(log.createdAt || log.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{log.userNome || log.user_nome || "Sistema"}</p>
                              <p className="text-xs text-muted-foreground">{log.userEmail || log.user_email || "-"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getAcaoBadgeVariant(log.acao)}>{log.acao}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.entidade || log.tabela || log.modulo || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm font-mono">
                          {(log.entidadeId || log.registroId || log.registro_id) 
                            ? (log.entidadeId || log.registroId || log.registro_id)!.substring(0, 8) + "..." 
                            : "-"}
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