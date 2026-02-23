import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { Users, BookOpen, Calendar, MessageSquare, TrendingUp, GraduationCap } from "lucide-react";
import { MensagensResponsavelTab } from "@/components/responsavel/MensagensResponsavelTab";
import { FrequenciaAlunoTab } from "@/components/responsavel/FrequenciaAlunoTab";
import { NotasAlunoTab } from "@/components/responsavel/NotasAlunoTab";

interface AlunoVinculado {
  id: string;
  nome_completo: string;
  email: string;
  parentesco: string;
}

export default function ResponsavelDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedAluno, setSelectedAluno] = useState<AlunoVinculado | null>(null);

  // Buscar alunos vinculados ao responsável
  const { data: alunosVinculados, isLoading: loadingAlunos } = useQuery({
    queryKey: ["alunos-vinculados", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const data = await responsavelAlunosApi.getAlunosVinculados(user.id);
      return data?.map((item: any) => ({
        id: item.aluno?.id || item.alunoId,
        nome_completo: item.aluno?.nome_completo || item.alunoNome,
        email: item.aluno?.email || item.alunoEmail,
        parentesco: item.parentesco,
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
  const { data: estatisticas } = useQuery({
    queryKey: ["estatisticas-aluno", selectedAluno?.id],
    queryFn: async () => {
      if (!selectedAluno) return null;

      // Buscar matrículas
      const matriculas = await matriculasApi.getAll({ alunoId: selectedAluno.id });
      const matriculaIds = matriculas?.map((m: any) => m.id) || [];

      // Buscar notas
      let mediaNotas = 0;
      if (matriculaIds.length > 0) {
        const notas = await notasApi.getAll({ alunoId: selectedAluno.id });
        if (notas && notas.length > 0) {
          mediaNotas = notas.reduce((acc: number, n: any) => acc + n.valor, 0) / notas.length;
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
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!alunosVinculados || alunosVinculados.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Users className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Nenhum aluno vinculado</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Você ainda não possui alunos vinculados à sua conta. Entre em contato com a secretaria para vincular seus educandos.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('pages.portalResponsavel')}</h1>
          <p className="text-muted-foreground">
            {t('pages.portalResponsavelDesc')}
          </p>
        </div>

        {/* Seleção de Aluno */}
        {alunosVinculados.length > 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Selecione o Aluno</CardTitle>
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

        {/* Cards de Estatísticas */}
        {selectedAluno && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Aluno</CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{selectedAluno.nome_completo}</div>
                  <p className="text-xs text-muted-foreground">{selectedAluno.parentesco}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Disciplinas</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{estatisticas?.totalDisciplinas || 0}</div>
                  <p className="text-xs text-muted-foreground">Matriculado</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Média Geral</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{estatisticas?.mediaNotas || "0.0"}</div>
                  <p className="text-xs text-muted-foreground">Valores</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Frequência</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{estatisticas?.percentualFrequencia || "0"}%</div>
                  <p className="text-xs text-muted-foreground">
                    {estatisticas?.aulasPresentes || 0} de {estatisticas?.totalAulas || 0} aulas
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Abas de Conteúdo */}
            <Tabs defaultValue="notas" className="space-y-4">
              <TabsList>
                <TabsTrigger value="notas">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Notas
                </TabsTrigger>
                <TabsTrigger value="frequencia">
                  <Calendar className="h-4 w-4 mr-2" />
                  Frequência
                </TabsTrigger>
                <TabsTrigger value="mensagens">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Mensagens
                </TabsTrigger>
              </TabsList>

              <TabsContent value="notas">
                <NotasAlunoTab alunoId={selectedAluno.id} />
              </TabsContent>

              <TabsContent value="frequencia">
                <FrequenciaAlunoTab alunoId={selectedAluno.id} />
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