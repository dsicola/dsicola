import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { logsAuditoriaApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Shield, Eye, Calendar, User, Filter, FileText, Search } from "lucide-react";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DetalhesAuditoriaDialog } from "@/components/auditoria/DetalhesAuditoriaDialog";

interface LogAuditoria {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  userNome?: string | null;
  perfilUsuario?: string | null;
  acao: string;
  entidade?: string | null;
  tabela?: string | null;
  registroId?: string | null;
  dadosAnteriores?: any;
  dadosNovos?: any;
  ip?: string | null;
  userAgent?: string | null;
  observacao?: string | null;
  instituicaoId?: string | null;
  createdAt: string;
  comparacao?: {
    temAntes: boolean;
    temDepois: boolean;
    podeComparar: boolean;
  };
}

export function AuditoriaTab() {
  const { instituicaoId } = useTenantFilter();
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [showDetalhesDialog, setShowDetalhesDialog] = useSafeDialog(false);
  const [filtros, setFiltros] = useState({
    acao: "all",
    entidade: "all",
    dataInicio: "",
    dataFim: "",
    search: "",
  });

  // Buscar logs
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["logs-auditoria", instituicaoId, filtros],
    queryFn: async () => {
      const params: any = {
        limit: 500,
      };
      if (filtros.acao && filtros.acao !== "all") params.acao = filtros.acao;
      if (filtros.entidade && filtros.entidade !== "all") params.entidade = filtros.entidade;
      if (filtros.dataInicio) params.dataInicio = filtros.dataInicio;
      if (filtros.dataFim) params.dataFim = filtros.dataFim;
      return await logsAuditoriaApi.getAll(params);
    },
    enabled: !!instituicaoId,
  });

  // Buscar estatísticas
  const { data: stats } = useQuery({
    queryKey: ["logs-auditoria-stats", instituicaoId, filtros.dataInicio, filtros.dataFim],
    queryFn: async () => {
      const params: any = {};
      if (filtros.dataInicio) params.dataInicio = filtros.dataInicio;
      if (filtros.dataFim) params.dataFim = filtros.dataFim;
      return await logsAuditoriaApi.getStats(params);
    },
    enabled: !!instituicaoId,
  });

  // Filtrar logs por termo de busca
  const logsFiltrados = logs.filter((log: LogAuditoria) => {
    if (!filtros.search) return true;
    const searchLower = filtros.search.toLowerCase();
    return (
      log.userNome?.toLowerCase().includes(searchLower) ||
      log.userEmail?.toLowerCase().includes(searchLower) ||
      log.acao.toLowerCase().includes(searchLower) ||
      log.entidade?.toLowerCase().includes(searchLower) ||
      log.observacao?.toLowerCase().includes(searchLower)
    );
  });

  const getAcaoBadge = (acao: string) => {
    const acaoUpper = acao.toUpperCase();
    if (acaoUpper === "CREATE") {
      return <Badge variant="default" className="bg-green-500">Criar</Badge>;
    }
    if (acaoUpper === "UPDATE") {
      return <Badge variant="secondary">Atualizar</Badge>;
    }
    if (acaoUpper === "DELETE") {
      return <Badge variant="destructive">Deletar</Badge>;
    }
    if (acaoUpper === "APPROVE") {
      return <Badge className="bg-blue-500">Aprovar</Badge>;
    }
    if (acaoUpper === "REJECT") {
      return <Badge variant="destructive">Rejeitar</Badge>;
    }
    if (acaoUpper === "CLOSE") {
      return <Badge className="bg-orange-500">Encerrar</Badge>;
    }
    if (acaoUpper === "REOPEN") {
      return <Badge className="bg-yellow-500">Reabrir</Badge>;
    }
    return <Badge variant="outline">{acao}</Badge>;
  };

  const getEntidadeLabel = (entidade?: string | null) => {
    if (!entidade) return "N/A";
    const labels: { [key: string]: string } = {
      CALENDARIO_ACADEMICO: "Calendário Acadêmico",
      PLANO_ENSINO: "Plano de Ensino",
      DISTRIBUICAO_AULAS: "Distribuição de Aulas",
      AULA_LANCADA: "Aula Lançada",
      PRESENCA: "Presença",
      AVALIACAO: "Avaliação",
      NOTA: "Nota",
      TRIMESTRE: "Trimestre",
      ANO_LETIVO: "Ano Letivo",
    };
    return labels[entidade] || entidade;
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Auditoria e Histórico
          </CardTitle>
          <CardDescription>
            Registro imutável de todas as ações críticas do sistema acadêmico
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Estatísticas */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total de Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ações por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.porAcao?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Tipos diferentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Módulos Auditados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.porEntidade?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Entidades diferentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.porUsuario?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Usuários com ações</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Usuário, ação, módulo..."
                  value={filtros.search}
                  onChange={(e) => setFiltros({ ...filtros, search: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ação</Label>
              <Select
                value={filtros.acao}
                onValueChange={(value) => setFiltros({ ...filtros, acao: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="CREATE">Criar</SelectItem>
                  <SelectItem value="UPDATE">Atualizar</SelectItem>
                  <SelectItem value="DELETE">Deletar</SelectItem>
                  <SelectItem value="APPROVE">Aprovar</SelectItem>
                  <SelectItem value="REJECT">Rejeitar</SelectItem>
                  <SelectItem value="CLOSE">Encerrar</SelectItem>
                  <SelectItem value="REOPEN">Reabrir</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Módulo</Label>
              <Select
                value={filtros.entidade}
                onValueChange={(value) => setFiltros({ ...filtros, entidade: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="CALENDARIO_ACADEMICO">Calendário Acadêmico</SelectItem>
                  <SelectItem value="PLANO_ENSINO">Plano de Ensino</SelectItem>
                  <SelectItem value="DISTRIBUICAO_AULAS">Distribuição de Aulas</SelectItem>
                  <SelectItem value="AULA_LANCADA">Aula Lançada</SelectItem>
                  <SelectItem value="PRESENCA">Presença</SelectItem>
                  <SelectItem value="AVALIACAO">Avaliação</SelectItem>
                  <SelectItem value="NOTA">Nota</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Auditoria</CardTitle>
          <CardDescription>
            {logsFiltrados.length} registro(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando logs...</div>
          ) : logsFiltrados.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum log encontrado</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsFiltrados.map((log: LogAuditoria) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.userNome || "N/A"}</div>
                          <div className="text-xs text-muted-foreground">
                            {log.userEmail || "N/A"}
                            {log.perfilUsuario && ` • ${log.perfilUsuario}`}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getAcaoBadge(log.acao)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getEntidadeLabel(log.entidade)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.registroId ? log.registroId.substring(0, 8) + "..." : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
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
  );
}
