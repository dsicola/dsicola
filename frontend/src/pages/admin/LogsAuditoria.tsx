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
import { ArrowLeft, Search, FileText, Eye, Clock, User, Activity, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  labelAcaoAuditoria,
  matchesAcaoFilter,
  getAcaoBadgeVariant,
  isCriacaoAcao,
  isAlteracaoAcao,
  isExclusaoOuReversaoAcao,
  type AcaoFilterValue,
} from "@/utils/auditDisplay";
import { useNavigate } from "react-router-dom";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { DetalhesAuditoriaDialog } from "@/components/auditoria/DetalhesAuditoriaDialog";

interface LogAuditoria {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userNome: string | null;
  perfilUsuario?: string | null;
  rota?: string | null;
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
  const [acaoFilter, setAcaoFilter] = useState<AcaoFilterValue>("all");
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
    const matchesAcao = matchesAcaoFilter(String(log?.acao ?? ""), acaoFilter);
    return matchesSearch && matchesAcao;
  });

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
    criar: logs?.filter((l) => isCriacaoAcao(String(l?.acao ?? ""))).length || 0,
    editar: logs?.filter((l) => isAlteracaoAcao(String(l?.acao ?? ""))).length || 0,
    excluir: logs?.filter((l) => isExclusaoOuReversaoAcao(String(l?.acao ?? ""))).length || 0,
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
            <p className="text-muted-foreground">
              Quem fez o quê, quando, a partir de que IP e navegador — com valores antes/depois nas alterações.
            </p>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>O que é registado na auditoria</AlertTitle>
          <AlertDescription className="space-y-2 text-muted-foreground">
            <p>
              Cada entrada é <strong>imutável</strong>: utilizador (ou &quot;Sistema&quot; para jobs internos), perfil, data/hora,
              módulo/entidade, ID do registo, <strong>endereço IP</strong> e <strong>resumo do dispositivo/navegador</strong> (derivado do
              User-Agent). Em <strong>Detalhes</strong> vê o JSON antes/depois quando a operação os guardou (campos sensíveis aparecem
              mascarados).
            </p>
            <p>
              <strong>Pagamentos</strong> não são apagados na base de dados: reverte-se com <strong>estorno</strong>, o que também gera
              linha de auditoria. <strong>Localidade geográfica</strong> não é calculada automaticamente (seria necessário serviço
              externo de geolocalização por IP).
            </p>
            <p>
              Alunos e responsáveis com login aparecem como qualquer outro utilizador quando a ação passa na API autenticada; eventos de
              dispositivos biométricos ficam associados ao contexto registado nessa integração.
            </p>
          </AlertDescription>
        </Alert>

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
              <CardTitle className="text-sm font-medium">Criações / registos</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{estatisticas.criar}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Alterações</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{estatisticas.editar}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Exclusões / estornos</CardTitle>
              <Activity className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{estatisticas.excluir}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de ações</CardTitle>
            <CardDescription>
              Filtre por tipo de ação (códigos em inglês na API; rótulos em português na coluna).
            </CardDescription>
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
                <Select value={acaoFilter} onValueChange={(v) => setAcaoFilter(v as AcaoFilterValue)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtrar por ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as ações</SelectItem>
                    <SelectItem value="create">Criações e pagamentos</SelectItem>
                    <SelectItem value="update">Alterações (UPDATE)</SelectItem>
                    <SelectItem value="delete">Exclusões e estornos</SelectItem>
                    <SelectItem value="security">Segurança / login</SelectItem>
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
                      <TableHead>Entidade / módulo</TableHead>
                      <TableHead>Registo (ID)</TableHead>
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
                              {(log.perfilUsuario || (log as any).perfil_usuario) && (
                                <Badge variant="outline" className="mt-1 text-[10px] font-normal">
                                  {(log.perfilUsuario || (log as any).perfil_usuario) as string}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <Badge variant={getAcaoBadgeVariant(log.acao)}>{labelAcaoAuditoria(log.acao)}</Badge>
                            <span className="text-[10px] font-mono text-muted-foreground">{log.acao}</span>
                          </div>
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