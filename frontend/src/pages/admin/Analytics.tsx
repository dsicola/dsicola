import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { userRolesApi, turmasApi, cursosApi, notasApi, mensalidadesApi } from "@/services/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, BarChart3, Users, TrendingUp, DollarSign, GraduationCap, AlertTriangle, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { safeToFixed } from "@/lib/utils";
import { ExportButtons } from "@/components/common/ExportButtons";

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

export default function Analytics() {
  const navigate = useNavigate();
  const { instituicaoId, shouldFilter } = useTenantFilter();
  const currentYear = new Date().getFullYear();
  const [anoFiltro, setAnoFiltro] = useState<number>(currentYear);
  const [cursoFiltro, setCursoFiltro] = useState<string>("todos");

  // Estatísticas gerais - filtered by institution
  const { data: estatisticasGerais } = useQuery({
    queryKey: ["analytics-geral", instituicaoId],
    queryFn: async () => {
      const [alunosRoles, professoresRoles, turmasData, cursosData] = await Promise.all([
        userRolesApi.getByRole("ALUNO", shouldFilter ? instituicaoId : undefined),
        userRolesApi.getByRole("PROFESSOR", shouldFilter ? instituicaoId : undefined),
        turmasApi.getAll(shouldFilter ? { instituicaoId } : {}),
        cursosApi.getAll(shouldFilter ? { instituicaoId } : {}),
      ]);

      return {
        totalAlunos: alunosRoles?.length || 0,
        totalProfessores: professoresRoles?.length || 0,
        totalTurmas: turmasData?.length || 0,
        totalCursos: cursosData?.length || 0,
      };
    },
  });

  // Taxa de aprovação/reprovação por turma - filtered by institution
  const { data: taxasAprovacao } = useQuery({
    queryKey: ["analytics-aprovacao", instituicaoId],
    queryFn: async () => {
      const turmas = await turmasApi.getAll(shouldFilter ? { instituicaoId } : {});

      const resultados = [];

      for (const turma of turmas || []) {
        const painel = await notasApi.getAlunosNotasByTurma(turma.id);
        const alunos = Array.isArray(painel?.alunos) ? painel.alunos : [];

        if (alunos.length > 0) {
          const mediasPorMatricula: Record<string, number[]> = {};
          for (const aluno of alunos) {
            const mid = (aluno as { matricula_id?: string }).matricula_id;
            if (!mid) continue;
            const notasObj = (aluno as { notas?: Record<string, { valor?: unknown } | null> }).notas || {};
            const vals: number[] = [];
            for (const entry of Object.values(notasObj)) {
              if (entry != null && typeof entry === "object" && entry.valor != null) {
                const n = Number(entry.valor);
                if (Number.isFinite(n)) vals.push(n);
              }
            }
            if (vals.length > 0) mediasPorMatricula[mid] = vals;
          }

          let aprovados = 0;
          let reprovados = 0;

          Object.values(mediasPorMatricula).forEach((valores) => {
            const media = valores.reduce((a, b) => a + b, 0) / valores.length;
            if (media >= 10) {
              aprovados++;
            } else {
              reprovados++;
            }
          });

          const total = aprovados + reprovados;
          resultados.push({
            turma: turma.nome,
            curso: turma.curso?.nome || "N/A",
            aprovados,
            reprovados,
            total,
            taxaAprovacao: total > 0 ? safeToFixed((aprovados / total) * 100, 1) : "0",
          });
        }
      }

      return resultados;
    },
  });

  // Comparativo receitas por ano (últimos 3 anos)
  const { data: comparativoAnos } = useQuery({
    queryKey: ["analytics-comparativo", instituicaoId],
    queryFn: async () => {
      const res = await mensalidadesApi.getAll(shouldFilter ? { instituicaoId } : {});
      const todas = res?.data ?? [];
      const anos = [currentYear, currentYear - 1, currentYear - 2];
      return anos.map((ano) => {
        const doAno = todas.filter((m: any) => (m.anoReferencia ?? m.ano_referencia) === ano);
        const recebido = doAno.filter((m: any) => m.status === "Pago").reduce((s: number, m: any) => s + Number(m.valor), 0);
        const total = doAno.reduce((s: number, m: any) => s + Number(m.valor), 0);
        return { ano, recebido, total, qtd: doAno.length };
      });
    },
  });

  // Taxas filtradas por curso
  const taxasFiltradas = cursoFiltro === "todos"
    ? (taxasAprovacao ?? [])
    : (taxasAprovacao ?? []).filter((t: any) => t.curso === cursoFiltro);

  // Análise de inadimplência - filtered by institution and year
  const { data: inadimplencia } = useQuery({
    queryKey: ["analytics-inadimplencia", instituicaoId, anoFiltro],
    queryFn: async () => {
      const mensalidadesRes = await mensalidadesApi.getAll(shouldFilter ? { instituicaoId } : {});
      const todas = mensalidadesRes?.data ?? [];
      const mensalidades = todas.filter((m: any) => (m.anoReferencia ?? m.ano_referencia) === anoFiltro);

      const stats = {
        total: 0,
        pagas: 0,
        pendentes: 0,
        atrasadas: 0,
        valorTotal: 0,
        valorRecebido: 0,
        valorPendente: 0,
        valorAtrasado: 0,
      };

      const porMes: Record<number, { pagas: number; pendentes: number; atrasadas: number }> = {};

      mensalidades?.forEach((m: any) => {
        stats.total++;
        stats.valorTotal += Number(m.valor);
        const mesRef = m.mesReferencia || m.mes_referencia;

        if (!porMes[mesRef]) {
          porMes[mesRef] = { pagas: 0, pendentes: 0, atrasadas: 0 };
        }

        if (m.status === "Pago") {
          stats.pagas++;
          stats.valorRecebido += Number(m.valor);
          porMes[mesRef].pagas++;
        } else if (m.status === "Pendente") {
          stats.pendentes++;
          stats.valorPendente += Number(m.valor);
          porMes[mesRef].pendentes++;
        } else if (m.status === "Atrasado") {
          stats.atrasadas++;
          stats.valorAtrasado += Number(m.valor);
          porMes[mesRef].atrasadas++;
        }
      });

      const mesesNomes = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const dadosPorMes = Object.entries(porMes).map(([mes, dados]) => ({
        mes: mesesNomes[Number(mes)],
        ...dados,
      }));

      return { stats, dadosPorMes };
    },
  });

  // Dados para gráfico de pizza
  const dadosPizza = inadimplencia ? [
    { name: "Pagas", value: inadimplencia.stats.pagas, color: "#22c55e" },
    { name: "Pendentes", value: inadimplencia.stats.pendentes, color: "#f59e0b" },
    { name: "Atrasadas", value: inadimplencia.stats.atrasadas, color: "#ef4444" },
  ] : [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-AO", {
      style: "currency",
      currency: "AOA",
    }).format(value);
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
              <BarChart3 className="h-8 w-8" />
              Analytics & Relatórios
            </h1>
            <p className="text-muted-foreground">
              Métricas de desempenho, aprovação e análise financeira
            </p>
          </div>
        </div>

        {/* Cards de Estatísticas Gerais */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Estudantes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticasGerais?.totalAlunos || 0}</div>
              <p className="text-xs text-muted-foreground">Estudantes ativos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Professores</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticasGerais?.totalProfessores || 0}</div>
              <p className="text-xs text-muted-foreground">Docentes ativos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Turmas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticasGerais?.totalTurmas || 0}</div>
              <p className="text-xs text-muted-foreground">Turmas ativas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cursos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticasGerais?.totalCursos || 0}</div>
              <p className="text-xs text-muted-foreground">Cursos oferecidos</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="aprovacao" className="space-y-4">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="aprovacao">
              <TrendingUp className="h-4 w-4 mr-2" />
              Aprovação/Reprovação
            </TabsTrigger>
            <TabsTrigger value="inadimplencia">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Inadimplência
            </TabsTrigger>
            <TabsTrigger value="financeiro">
              <DollarSign className="h-4 w-4 mr-2" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="comparativo">
              <BarChart3 className="h-4 w-4 mr-2" />
              Comparativo Anos
            </TabsTrigger>
          </TabsList>

          {/* Taxa de Aprovação/Reprovação */}
          <TabsContent value="aprovacao" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div>
                    <CardTitle>Taxa de Aprovação por Turma</CardTitle>
                    <CardDescription>Análise de desempenho acadêmico por turma</CardDescription>
                  </div>
                  {taxasAprovacao && taxasAprovacao.length > 0 && (
                    <Select value={cursoFiltro} onValueChange={setCursoFiltro}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filtrar por curso" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os cursos</SelectItem>
                        {[...new Set((taxasAprovacao ?? []).map((t: any) => t.curso))].map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {taxasFiltradas.length > 0 && (
                  <ExportButtons
                    titulo="Taxa de Aprovação por Turma"
                    colunas={["Turma", "Curso", "Aprovados", "Reprovados", "Total", "Taxa Aprovação (%)"]}
                    dados={taxasFiltradas.map((t: any) => [t.turma, t.curso, t.aprovados, t.reprovados, t.total, t.taxaAprovacao])}
                  />
                )}
              </CardHeader>
              <CardContent>
                {taxasFiltradas.length > 0 ? (
                  <>
                    <div className="h-[300px] mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={taxasFiltradas}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="turma" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="aprovados" fill="#22c55e" name="Aprovados" />
                          <Bar dataKey="reprovados" fill="#ef4444" name="Reprovados" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="rounded-md border overflow-x-auto -mx-1 sm:mx-0 max-w-full">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Turma</TableHead>
                            <TableHead>Curso</TableHead>
                            <TableHead>Aprovados</TableHead>
                            <TableHead>Reprovados</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Taxa de Aprovação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {taxasFiltradas.map((turma: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{turma.turma}</TableCell>
                              <TableCell>{turma.curso}</TableCell>
                              <TableCell>
                                <Badge className="bg-green-100 text-green-800">{turma.aprovados}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="destructive">{turma.reprovados}</Badge>
                              </TableCell>
                              <TableCell>{turma.total}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={Number(turma.taxaAprovacao)} className="w-20" />
                                  <span className="text-sm">{turma.taxaAprovacao}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum dado de aprovação disponível
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Análise de Inadimplência */}
          <TabsContent value="inadimplencia" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Ano:</span>
                <Select value={String(anoFiltro)} onValueChange={(v) => setAnoFiltro(Number(v))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {inadimplencia && inadimplencia.dadosPorMes.length > 0 && (
                <ExportButtons
                  titulo={`Inadimplência ${anoFiltro}`}
                  colunas={["Mês", "Pagas", "Pendentes", "Atrasadas"]}
                  dados={inadimplencia.dadosPorMes.map((d: any) => [d.mes, d.pagas, d.pendentes, d.atrasadas])}
                  excelLabel="Exportar Excel"
                />
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Mensalidades Pagas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{inadimplencia?.stats.pagas || 0}</div>
                  <p className="text-xs text-muted-foreground">{formatCurrency(inadimplencia?.stats.valorRecebido || 0)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{inadimplencia?.stats.pendentes || 0}</div>
                  <p className="text-xs text-muted-foreground">{formatCurrency(inadimplencia?.stats.valorPendente || 0)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{inadimplencia?.stats.atrasadas || 0}</div>
                  <p className="text-xs text-muted-foreground">{formatCurrency(inadimplencia?.stats.valorAtrasado || 0)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Adimplência</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {inadimplencia?.stats.total
                      ? safeToFixed((inadimplencia.stats.pagas / inadimplencia.stats.total) * 100, 1)
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">Do total de mensalidades</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição de Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dadosPizza}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${safeToFixed(percent != null ? percent * 100 : 0, 0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {dadosPizza.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Evolução Mensal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={inadimplencia?.dadosPorMes || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="pagas" stroke="#22c55e" name="Pagas" />
                        <Line type="monotone" dataKey="pendentes" stroke="#f59e0b" name="Pendentes" />
                        <Line type="monotone" dataKey="atrasadas" stroke="#ef4444" name="Atrasadas" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Financeiro */}
          <TabsContent value="financeiro" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Receita Total Esperada</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(inadimplencia?.stats.valorTotal || 0)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Receita Recebida</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(inadimplencia?.stats.valorRecebido || 0)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">A Receber</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency((inadimplencia?.stats.valorPendente || 0) + (inadimplencia?.stats.valorAtrasado || 0))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Comparativo entre anos */}
          <TabsContent value="comparativo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Receita por Ano</CardTitle>
                <CardDescription>Comparativo de receitas recebidas nos últimos 3 anos</CardDescription>
              </CardHeader>
              <CardContent>
                {comparativoAnos && comparativoAnos.length > 0 ? (
                  <>
                    <div className="h-[300px] mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparativoAnos}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="ano" />
                          <YAxis tickFormatter={(v) => (v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${(v/1000).toFixed(0)}k`)} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Legend />
                          <Bar dataKey="recebido" fill="#22c55e" name="Recebido" />
                          <Bar dataKey="total" fill="#94a3b8" name="Total esperado" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ano</TableHead>
                            <TableHead>Recebido</TableHead>
                            <TableHead>Total Esperado</TableHead>
                            <TableHead>Mensalidades</TableHead>
                            <TableHead>Taxa Realização</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {comparativoAnos.map((r: any) => (
                            <TableRow key={r.ano}>
                              <TableCell className="font-medium">{r.ano}</TableCell>
                              <TableCell className="text-green-600">{formatCurrency(r.recebido)}</TableCell>
                              <TableCell>{formatCurrency(r.total)}</TableCell>
                              <TableCell>{r.qtd}</TableCell>
                              <TableCell>
                                {r.total > 0 ? safeToFixed((r.recebido / r.total) * 100, 1) : 0}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Nenhum dado disponível</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
