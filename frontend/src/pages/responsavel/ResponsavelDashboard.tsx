import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { responsavelAlunosApi, matriculasApi, notasApi, frequenciasApi } from "@/services/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { safeToFixed } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import { Users, BookOpen, Calendar, MessageSquare, TrendingUp, GraduationCap, FileText, History, Wallet } from "lucide-react";
import { MensagensResponsavelTab } from "@/components/responsavel/MensagensResponsavelTab";
import { FrequenciaAlunoTab } from "@/components/responsavel/FrequenciaAlunoTab";
import { NotasAlunoTab } from "@/components/responsavel/NotasAlunoTab";
import { BoletimEducandoTab } from "@/components/responsavel/BoletimEducandoTab";
import { HistoricoEducandoTab } from "@/components/responsavel/HistoricoEducandoTab";
import { MensalidadesEducandoTab } from "@/components/responsavel/MensalidadesEducandoTab";
import { EducandosResponsavelPanel } from "@/components/responsavel/EducandosResponsavelPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface AlunoVinculado {
  id: string;
  nome_completo: string;
  email: string;
  parentesco: string;
}

type AbaPortal = "notas" | "frequencia" | "mensagens" | "boletim" | "historico" | "mensalidades";

function abaFromPath(pathname: string): AbaPortal {
  const p = pathname.replace(/\/$/, "");
  if (p.endsWith("/mensagens")) return "mensagens";
  if (p.endsWith("/frequencia")) return "frequencia";
  if (p.endsWith("/boletim")) return "boletim";
  if (p.endsWith("/historico")) return "historico";
  if (p.endsWith("/mensalidades")) return "mensalidades";
  return "notas";
}

export default function ResponsavelDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const abaPortal = useMemo(() => abaFromPath(location.pathname), [location.pathname]);
  const isEducandosRoute = useMemo(() => {
    const p = location.pathname.replace(/\/$/, "");
    return p.endsWith("/educandos");
  }, [location.pathname]);
  const [selectedAluno, setSelectedAluno] = useState<AlunoVinculado | null>(null);

  // Buscar alunos vinculados ao responsável
  const {
    data: alunosVinculados,
    isLoading: loadingAlunos,
    isError: errorAlunos,
    refetch: refetchAlunos,
  } = useQuery({
    queryKey: ["alunos-vinculados", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const data = await responsavelAlunosApi.getAlunosVinculados(user.id);
      return (data ?? []).map((item: any) => ({
        id: String(item.id ?? item.aluno?.id ?? item.alunoId ?? ''),
        nome_completo:
          item.nomeCompleto ??
          item.nome_completo ??
          item.aluno?.nome_completo ??
          item.alunoNome ??
          '—',
        email: item.email ?? item.aluno?.email ?? item.alunoEmail ?? '',
        parentesco: item.parentesco ?? '—',
      })) as AlunoVinculado[];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (alunosVinculados && alunosVinculados.length > 0 && !selectedAluno) {
      setSelectedAluno(alunosVinculados[0]);
    }
  }, [alunosVinculados, selectedAluno]);

  // Buscar estatísticas do aluno selecionado
  const {
    data: estatisticas,
    isLoading: loadingEstatisticas,
    isError: errorEstatisticas,
    refetch: refetchEstatisticas,
  } = useQuery({
    queryKey: ["estatisticas-aluno", selectedAluno?.id],
    queryFn: async () => {
      if (!selectedAluno) return null;

      // Buscar matrículas
      const res = await matriculasApi.getAll({ alunoId: selectedAluno.id });
      const matriculas = res?.data ?? [];
      const matriculaIds = matriculas.map((m: any) => m.id);

      // Buscar notas (valor pode vir como string Decimal da API — somar com + concatenava)
      let mediaNotas = 0;
      if (matriculaIds.length > 0) {
        const notas = await notasApi.getAll({ alunoId: selectedAluno.id });
        if (notas && notas.length > 0) {
          const valores = (notas as any[]).map((n) => Number(n?.valor)).filter((v) => Number.isFinite(v));
          mediaNotas =
            valores.length > 0 ? valores.reduce((acc, v) => acc + v, 0) / valores.length : 0;
        }
      }

      // Buscar frequências
      const frequencias = await frequenciasApi.getAll({ alunoId: selectedAluno.id });
      const totalAulas = frequencias?.length || 0;
      const aulasPresentes = frequencias?.filter((f: any) => f.presente).length || 0;
      const percentualFrequencia = totalAulas > 0 ? (aulasPresentes / totalAulas) * 100 : 0;

      return {
        totalDisciplinas: matriculas?.length || 0,
        mediaNotas: safeToFixed(mediaNotas, 1),
        percentualFrequencia: safeToFixed(percentualFrequencia, 1),
        totalAulas,
        aulasPresentes,
      };
    },
    enabled: !!selectedAluno?.id,
  });

  if (loadingAlunos) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t("pages.responsavel.loading")}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (errorAlunos) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto py-12 space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("pages.responsavel.loadStudentsError")}</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 pt-2">
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => refetchAlunos()}>
                {t("pages.responsavel.retry")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  if (!alunosVinculados || alunosVinculados.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Users className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">{t("pages.responsavel.noStudentsTitle")}</h2>
          <p className="text-muted-foreground text-center max-w-md">
            {t("pages.responsavel.noStudentsDesc")}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const navigateComEducando = (aluno: AlunoVinculado, dest: AbaPortal) => {
    setSelectedAluno(aluno);
    const base = "/painel-responsavel";
    if (dest === "mensagens") navigate(`${base}/mensagens`);
    else if (dest === "frequencia") navigate(`${base}/frequencia`);
    else if (dest === "boletim") navigate(`${base}/boletim`);
    else if (dest === "historico") navigate(`${base}/historico`);
    else if (dest === "mensalidades") navigate(`${base}/mensalidades`);
    else navigate(`${base}/notas`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('pages.portalResponsavel')}</h1>
          <p className="text-muted-foreground">
            {t('pages.portalResponsavelDesc')}
          </p>
        </div>

        {isEducandosRoute ? (
          <EducandosResponsavelPanel
            alunos={alunosVinculados}
            selectedId={selectedAluno?.id ?? null}
            onNavigate={navigateComEducando}
          />
        ) : null}

        {/* Seleção de Aluno */}
        {!isEducandosRoute && alunosVinculados.length > 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t("pages.responsavel.selectStudent")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {alunosVinculados.map((aluno) => (
                  <Button
                    key={aluno.id}
                    variant={selectedAluno?.id === aluno.id ? "default" : "outline"}
                    onClick={() => setSelectedAluno(aluno)}
                  >
                    <GraduationCap className="h-4 w-4 mr-2" />
                    {aluno.nome_completo}
                    <Badge variant="secondary" className="ml-2">
                      {aluno.parentesco}
                    </Badge>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cards de Estatísticas + abas (ocultos na rota /educandos) */}
        {!isEducandosRoute && selectedAluno && (
          <>
            {errorEstatisticas ? (
              <Alert variant="destructive" className="border-destructive/50">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("pages.responsavel.loadStatsError")}</AlertTitle>
                <AlertDescription className="pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => refetchEstatisticas()}>
                    {t("pages.responsavel.retry")}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{t("pages.responsavel.student")}</CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{selectedAluno.nome_completo}</div>
                  <p className="text-xs text-muted-foreground">{selectedAluno.parentesco}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{t("pages.responsavel.subjects")}</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${loadingEstatisticas ? "text-muted-foreground animate-pulse" : ""}`}>
                    {loadingEstatisticas ? "…" : estatisticas?.totalDisciplinas ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("pages.responsavel.enrolled")}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{t("pages.responsavel.generalAverage")}</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${loadingEstatisticas ? "text-muted-foreground animate-pulse" : ""}`}>
                    {loadingEstatisticas ? "…" : estatisticas?.mediaNotas ?? "0.0"}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("pages.responsavel.valuesLabel")}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{t("pages.responsavel.attendance")}</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${loadingEstatisticas ? "text-muted-foreground animate-pulse" : ""}`}>
                    {loadingEstatisticas ? "…" : `${estatisticas?.percentualFrequencia ?? "0"}%`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {loadingEstatisticas
                      ? "…"
                      : t("pages.responsavel.classesShort", {
                          present: estatisticas?.aulasPresentes ?? 0,
                          total: estatisticas?.totalAulas ?? 0,
                        })}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Abas alinhadas ao menu lateral (/notas, /frequencia, /mensagens) */}
            <Tabs
              value={abaPortal}
              onValueChange={(v) => {
                const base = "/painel-responsavel";
                const tab = v as AbaPortal;
                if (tab === "mensagens") navigate(`${base}/mensagens`);
                else if (tab === "frequencia") navigate(`${base}/frequencia`);
                else if (tab === "boletim") navigate(`${base}/boletim`);
                else if (tab === "historico") navigate(`${base}/historico`);
                else if (tab === "mensalidades") navigate(`${base}/mensalidades`);
                else navigate(`${base}/notas`);
              }}
              className="space-y-4"
            >
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="notas" className="gap-1">
                  <TrendingUp className="h-4 w-4 shrink-0" />
                  {t("pages.responsavel.tabGrades")}
                </TabsTrigger>
                <TabsTrigger value="boletim" className="gap-1">
                  <FileText className="h-4 w-4 shrink-0" />
                  {t("pages.responsavel.tabBulletin")}
                </TabsTrigger>
                <TabsTrigger value="historico" className="gap-1">
                  <History className="h-4 w-4 shrink-0" />
                  {t("pages.responsavel.tabHistory")}
                </TabsTrigger>
                <TabsTrigger value="frequencia" className="gap-1">
                  <Calendar className="h-4 w-4 shrink-0" />
                  {t("pages.responsavel.tabAttendance")}
                </TabsTrigger>
                <TabsTrigger value="mensalidades" className="gap-1">
                  <Wallet className="h-4 w-4 shrink-0" />
                  {t("pages.responsavel.tabTuition")}
                </TabsTrigger>
                <TabsTrigger value="mensagens" className="gap-1">
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  {t("pages.responsavel.tabMessages")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="notas">
                <NotasAlunoTab alunoId={selectedAluno.id} />
              </TabsContent>

              <TabsContent value="boletim">
                <BoletimEducandoTab alunoId={selectedAluno.id} />
              </TabsContent>

              <TabsContent value="historico">
                <HistoricoEducandoTab alunoId={selectedAluno.id} />
              </TabsContent>

              <TabsContent value="frequencia">
                <FrequenciaAlunoTab alunoId={selectedAluno.id} />
              </TabsContent>

              <TabsContent value="mensalidades">
                <MensalidadesEducandoTab alunoId={selectedAluno.id} />
              </TabsContent>

              <TabsContent value="mensagens">
                <MensagensResponsavelTab alunoId={selectedAluno.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}