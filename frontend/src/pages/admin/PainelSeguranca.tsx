import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Shield,
  Lock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  User,
  Calendar,
  Globe,
  KeyRound,
  Activity,
  BarChart3,
} from "lucide-react";
import { segurancaApi } from "@/services/api";

export default function PainelSeguranca() {
  const [filters, setFilters] = useState({
    dataInicio: "",
    dataFim: "",
    email: "",
    bloqueado: "",
    usado: "",
  });

  // Query para o dashboard consolidado
  const { data: dashboardData, isLoading: loadingDashboard, refetch: refetchDashboard } = useQuery({
    queryKey: ["seguranca-dashboard", filters.dataInicio, filters.dataFim],
    queryFn: async () => {
      const params: any = {};
      if (filters.dataInicio) params.dataInicio = filters.dataInicio;
      if (filters.dataFim) params.dataFim = filters.dataFim;
      return await segurancaApi.getDashboard(params);
    },
  });

  // Query para tentativas de login
  const { data: loginAttempts, isLoading: loadingAttempts, refetch: refetchAttempts } = useQuery({
    queryKey: ["seguranca-login-attempts", filters],
    queryFn: async () => {
      const params: any = {};
      if (filters.email) params.email = filters.email;
      if (filters.dataInicio) params.dataInicio = filters.dataInicio;
      if (filters.dataFim) params.dataFim = filters.dataFim;
      if (filters.bloqueado) params.bloqueado = filters.bloqueado === "true";
      return await segurancaApi.getLoginAttempts(params);
    },
  });

  // Query para resets de senha
  const { data: passwordResets, isLoading: loadingResets, refetch: refetchResets } = useQuery({
    queryKey: ["seguranca-password-resets", filters],
    queryFn: async () => {
      const params: any = {};
      if (filters.dataInicio) params.dataInicio = filters.dataInicio;
      if (filters.dataFim) params.dataFim = filters.dataFim;
      if (filters.usado) params.usado = filters.usado === "true";
      return await segurancaApi.getPasswordResets(params);
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      dataInicio: "",
      dataFim: "",
      email: "",
      bloqueado: "",
      usado: "",
    });
  };

  const handleRefresh = () => {
    refetchDashboard();
    refetchAttempts();
    refetchResets();
    toast({
      title: "Dados atualizados",
      description: "As informações do painel foram atualizadas.",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Painel de Segurança
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitoramento de segurança institucional - Somente leitura
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Alert sobre somente leitura */}
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertDescription>
            Este painel é <strong>somente leitura</strong>. Os logs de auditoria são imutáveis e não podem ser editados ou excluídos.
          </AlertDescription>
        </Alert>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filters.dataInicio}
                  onChange={(e) => handleFilterChange("dataInicio", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filters.dataFim}
                  onChange={(e) => handleFilterChange("dataFim", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email (tentativas de login)</Label>
                <Input
                  type="text"
                  placeholder="Filtrar por email..."
                  value={filters.email}
                  onChange={(e) => handleFilterChange("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status (tentativas)</Label>
                <Select
                  value={filters.bloqueado}
                  onValueChange={(value) => handleFilterChange("bloqueado", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="true">Bloqueados</SelectItem>
                    <SelectItem value="false">Não bloqueados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status (resets)</Label>
                <Select
                  value={filters.usado}
                  onValueChange={(value) => handleFilterChange("usado", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="true">Usados</SelectItem>
                    <SelectItem value="false">Pendentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex items-end">
                <Button onClick={handleResetFilters} variant="outline" className="w-full">
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Consolidado */}
        {loadingDashboard ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Carregando estatísticas...
            </CardContent>
          </Card>
        ) : dashboardData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total de Tentativas */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tentativas de Login</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.loginAttempts?.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData.loginAttempts?.blocked || 0} bloqueadas
                </p>
              </CardContent>
            </Card>

            {/* Contas Bloqueadas */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contas Bloqueadas</CardTitle>
                <Lock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {dashboardData.loginAttempts?.blocked || 0}
                </div>
                <p className="text-xs text-muted-foreground">Atualmente bloqueadas</p>
              </CardContent>
            </Card>

            {/* Resets de Senha */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resets de Senha</CardTitle>
                <KeyRound className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.passwordResets?.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData.passwordResets?.used || 0} usados,{" "}
                  {dashboardData.passwordResets?.pending || 0} pendentes
                </p>
              </CardContent>
            </Card>

            {/* Eventos de Segurança */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Eventos de Segurança</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData.securityAudits?.total || 0}
                </div>
                <p className="text-xs text-muted-foreground">Registrados no período</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Tabs com detalhes */}
        <Tabs defaultValue="login-attempts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="login-attempts">
              <Lock className="h-4 w-4 mr-2" />
              Tentativas de Login
            </TabsTrigger>
            <TabsTrigger value="password-resets">
              <KeyRound className="h-4 w-4 mr-2" />
              Resets de Senha
            </TabsTrigger>
            <TabsTrigger value="security-audits">
              <Shield className="h-4 w-4 mr-2" />
              Eventos de Segurança
            </TabsTrigger>
          </TabsList>

          {/* Tab: Tentativas de Login */}
          <TabsContent value="login-attempts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tentativas de Login</CardTitle>
                <CardDescription>
                  Histórico de tentativas de login, incluindo falhas e bloqueios
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAttempts ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando tentativas de login...
                  </div>
                ) : loginAttempts && loginAttempts.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Tentativas</TableHead>
                          <TableHead>Última Tentativa</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>IP Origem</TableHead>
                          <TableHead>User Agent</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loginAttempts.map((attempt: any) => (
                          <TableRow key={attempt.id}>
                            <TableCell className="font-medium">{attempt.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{attempt.attemptCount}</Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(attempt.lastAttemptAt), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </TableCell>
                            <TableCell>
                              {attempt.lockedUntil && new Date(attempt.lockedUntil) > new Date() ? (
                                <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                  <Lock className="h-3 w-3" />
                                  Bloqueado
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Ativo
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {attempt.ipOrigem || "N/A"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                              {attempt.userAgent || "N/A"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma tentativa de login encontrada para os filtros selecionados.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Resets de Senha */}
          <TabsContent value="password-resets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Resets de Senha</CardTitle>
                <CardDescription>
                  Histórico de solicitações de redefinição de senha
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingResets ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando resets de senha...
                  </div>
                ) : passwordResets && passwordResets.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Criado em</TableHead>
                          <TableHead>Expira em</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {passwordResets.map((reset: any) => (
                          <TableRow key={reset.id}>
                            <TableCell className="font-medium">
                              {reset.user?.nomeCompleto || "N/A"}
                            </TableCell>
                            <TableCell>{reset.user?.email || "N/A"}</TableCell>
                            <TableCell>
                              {format(new Date(reset.createdAt), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </TableCell>
                            <TableCell>
                              {format(new Date(reset.expiresAt), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </TableCell>
                            <TableCell>
                              {reset.used ? (
                                <Badge variant="default" className="flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Usado
                                </Badge>
                              ) : new Date(reset.expiresAt) < new Date() ? (
                                <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                  <XCircle className="h-3 w-3" />
                                  Expirado
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                  <Clock className="h-3 w-3" />
                                  Pendente
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum reset de senha encontrado para os filtros selecionados.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Eventos de Segurança */}
          <TabsContent value="security-audits" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Eventos de Segurança</CardTitle>
                <CardDescription>
                  Logs de auditoria relacionados a segurança (login, bloqueios, resets)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardData?.securityAudits?.recent && dashboardData.securityAudits.recent.length > 0 ? (
                  <>
                    {/* Estatísticas por ação */}
                    {dashboardData.securityAudits.byAction &&
                      dashboardData.securityAudits.byAction.length > 0 && (
                        <div className="mb-6">
                          <h3 className="text-sm font-medium mb-3">Eventos por Ação</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {dashboardData.securityAudits.byAction.map((item: any) => (
                              <div
                                key={item.acao}
                                className="p-3 border rounded-md flex items-center justify-between"
                              >
                                <span className="text-sm text-muted-foreground">{item.acao}</span>
                                <Badge>{item.quantidade}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Lista de eventos recentes */}
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ação</TableHead>
                            <TableHead>Entidade</TableHead>
                            <TableHead>Usuário</TableHead>
                            <TableHead>IP</TableHead>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead>Observação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dashboardData.securityAudits.recent.map((audit: any) => (
                            <TableRow key={audit.id}>
                              <TableCell>
                                <Badge variant="outline">{audit.acao}</Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {audit.entidade || "N/A"}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">
                                    {audit.userNome || audit.userEmail || "Sistema"}
                                  </span>
                                  {audit.userEmail && audit.userNome && (
                                    <span className="text-xs text-muted-foreground">
                                      {audit.userEmail}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {audit.ipOrigem || "N/A"}
                              </TableCell>
                              <TableCell>
                                {format(new Date(audit.createdAt), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                                {audit.observacao || "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum evento de segurança encontrado para os filtros selecionados.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

