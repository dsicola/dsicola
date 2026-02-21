import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Calendar, CalendarDays, ClipboardList, Users, CheckSquare, Clock, FileLock, Shield, FileText, AlertCircle, GraduationCap, Unlock, CalendarRange } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarioAcademicoTab } from "@/components/admin/CalendarioAcademicoTab";
import { PlanoEnsinoTab } from "@/components/configuracaoEnsino/PlanoEnsinoTab";
import { DistribuicaoAulasTab } from "@/components/configuracaoEnsino/DistribuicaoAulasTab";
import { LancamentoAulasTab } from "@/components/configuracaoEnsino/LancamentoAulasTab";
import { ControlePresencasTab } from "@/components/configuracaoEnsino/ControlePresencasTab";
import { AvaliacoesNotasTab } from "@/components/configuracaoEnsino/AvaliacoesNotasTab";
import { PeriodoLancamentoNotasTab } from "@/components/configuracaoEnsino/PeriodoLancamentoNotasTab";
import { RelatoriosOficiaisTab } from "@/components/configuracaoEnsino/RelatoriosOficiaisTab";
import { AuditoriaTab } from "@/components/configuracaoEnsino/AuditoriaTab";
import { EncerramentosAcademicosTab } from "@/components/configuracaoEnsino/EncerramentosAcademicosTab";
import { ReaberturaAnoLetivoTab } from "@/components/configuracaoEnsino/ReaberturaAnoLetivoTab";
import { SemestresTab } from "@/components/configuracaoEnsino/SemestresTab";
import { TrimestresTab } from "@/components/configuracaoEnsino/TrimestresTab";
import { AnosLetivosTab } from "@/components/configuracaoEnsino/AnosLetivosTab";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { eventosApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useAuth } from "@/contexts/AuthContext";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ContextType {
  cursoId?: string;
  classeId?: string;
  disciplinaId?: string;
  professorId?: string;
  anoLetivo?: number;
  turmaId?: string;
}

export default function ConfiguracaoEnsino() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { instituicaoId } = useTenantFilter();
  const { user, role } = useAuth();
  const { tipoAcademico, isSuperior, isSecundario } = useInstituicao();
  
  // RBAC: Verificar se usuário tem permissão para acessar Configuração de Ensinos
  const rolesPermitidos = ['ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'];
  const temPermissao = role && rolesPermitidos.includes(role);
  const isProfessor = role === 'PROFESSOR';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  
  // Se não tem permissão, mostrar mensagem de bloqueio
  if (!temPermissao) {
    return (
      <DashboardLayout>
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              Acesso Negado
            </CardTitle>
            <CardDescription className="text-red-600 dark:text-red-300">
              {isSuperAdmin 
                ? 'SUPER_ADMIN não pode acessar módulos acadêmicos. Use o painel de administração SaaS.'
                : isProfessor
                ? 'Você não tem permissão para acessar Configuração de Ensinos. Acesso restrito à Administração Acadêmica.'
                : 'Você não tem permissão para esta ação.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/admin-dashboard')} variant="outline">
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }
  
  // Ler tab da URL ou usar padrão
  const tabFromUrl = searchParams.get('tab') || 'calendario-academico';
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // Sincronizar tab com URL
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  // Atualizar URL quando tab mudar
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };
  const [sharedContext, setSharedContext] = useState<ContextType>({
    cursoId: "",
    classeId: "",
    disciplinaId: "",
    professorId: "",
    anoLetivo: new Date().getFullYear(),
    turmaId: "",
  });

  // Verificar se existe calendário ativo
  // IMPORTANTE: Não enviar instituicaoId no body/query - backend pega do JWT (multi-tenant)
  const { data: eventosCalendario = [] } = useQuery({
    queryKey: ['eventos-calendario-check'],
    queryFn: async () => {
      try {
        // Backend filtra automaticamente por instituicaoId do JWT
        // Não passar nenhum parâmetro para garantir que backend use apenas JWT
        return await eventosApi.getAll();
      } catch (error) {
        console.error('Erro ao verificar calendário:', error);
        return [];
      }
    },
    enabled: !!user, // Executar apenas quando usuário estiver autenticado
  });

  // Verificar se existe período letivo ativo (temporário - será implementado)
  const hasCalendarioAtivo = eventosCalendario.length > 0;

  const handleContextChange = (context: ContextType) => {
    setSharedContext(context);
  };

  // Determinar se uma tab está bloqueada
  const isTabBlocked = (tabKey: string): boolean => {
    switch (tabKey) {
      case "calendario-academico":
        return false; // Sempre disponível
      case "plano-ensino":
        return !hasCalendarioAtivo;
      case "distribuicao-aulas":
        // Bloqueado se não houver plano de ensino aprovado
        return !sharedContext.disciplinaId || !sharedContext.professorId;
      case "lancamento-aulas":
        // Bloqueado se não houver distribuição de aulas
        return !sharedContext.disciplinaId || !sharedContext.professorId;
      case "controle-presencas":
        // Bloqueado se não houver aulas lançadas
        return !sharedContext.disciplinaId || !sharedContext.professorId;
      case "avaliacoes-notas":
        // Bloqueado se não houver frequência mínima (será verificado no componente)
        return !sharedContext.disciplinaId || !sharedContext.professorId;
      default:
        return false;
    }
  };

  const getTabStatus = (tabKey: string) => {
    const blocked = isTabBlocked(tabKey);
    if (blocked) {
      return { variant: "destructive" as const, label: "Bloqueado" };
    }
    return { variant: "default" as const, label: "" };
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin-dashboard")} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 flex-shrink-0" />
              <span className="break-words">Configuração de Ensinos</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Gerencie o fluxo académico completo: calendário, planos, aulas, presenças e avaliações
            </p>
          </div>
        </div>

        {/* Fluxo de progresso visual */}
        <Alert className="w-full">
          <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2 w-full">
            <span className="font-semibold text-xs sm:text-sm md:text-base whitespace-nowrap">Fluxo Académico:</span>
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap w-full sm:w-auto">
              <Badge variant={hasCalendarioAtivo ? "default" : "outline"} className="text-xs whitespace-nowrap">1. Calendário</Badge>
              <span className="hidden sm:inline text-muted-foreground">→</span>
              <Badge variant={sharedContext.disciplinaId ? "default" : "outline"} className="text-xs whitespace-nowrap">2. Plano</Badge>
              <span className="hidden sm:inline text-muted-foreground">→</span>
              <Badge variant="outline" className="text-xs whitespace-nowrap">3. Distribuição</Badge>
              <span className="hidden sm:inline text-muted-foreground">→</span>
              <Badge variant="outline" className="text-xs whitespace-nowrap">4. Lançamento</Badge>
              <span className="hidden sm:inline text-muted-foreground">→</span>
              <Badge variant="outline" className="text-xs whitespace-nowrap">5. Presenças</Badge>
              <span className="hidden sm:inline text-muted-foreground">→</span>
              <Badge variant="outline" className="text-xs whitespace-nowrap">6. Avaliações</Badge>
            </div>
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="calendario-academico" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span className="hidden sm:inline">Calendário Académico</span>
              </TabsTrigger>
              <TabsTrigger 
                value="plano-ensino" 
                className="flex items-center gap-2"
                disabled={isTabBlocked("plano-ensino")}
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Plano de Ensino</span>
                {isTabBlocked("plano-ensino") && (
                  <Badge variant="destructive" className="ml-1 text-xs">!</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="distribuicao-aulas" 
                className="flex items-center gap-2"
                disabled={isTabBlocked("distribuicao-aulas")}
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Distribuição de Aulas</span>
                {isTabBlocked("distribuicao-aulas") && (
                  <Badge variant="destructive" className="ml-1 text-xs">!</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="lancamento-aulas" 
                className="flex items-center gap-2"
                disabled={isTabBlocked("lancamento-aulas")}
              >
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Lançamento de Aulas</span>
                {isTabBlocked("lancamento-aulas") && (
                  <Badge variant="destructive" className="ml-1 text-xs">!</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="controle-presencas" 
                className="flex items-center gap-2"
                disabled={isTabBlocked("controle-presencas")}
              >
                <CheckSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Controle de Presenças</span>
                {isTabBlocked("controle-presencas") && (
                  <Badge variant="destructive" className="ml-1 text-xs">!</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="avaliacoes-notas" 
                className="flex items-center gap-2"
                disabled={isTabBlocked("avaliacoes-notas")}
              >
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Avaliações e Notas</span>
                {isTabBlocked("avaliacoes-notas") && (
                  <Badge variant="destructive" className="ml-1 text-xs">!</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="periodos-lancamento-notas" className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4" />
                <span className="hidden sm:inline">Períodos de Lançamento</span>
              </TabsTrigger>
              <TabsTrigger value="relatorios-oficiais" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Relatórios Oficiais</span>
              </TabsTrigger>
              <TabsTrigger value="anos-letivos" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Anos Letivos</span>
              </TabsTrigger>
              {/* Semestres: APENAS para Ensino Superior - NUNCA para Ensino Secundário */}
              {isSuperior && (
                <TabsTrigger value="semestres" className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  <span className="hidden sm:inline">Semestres</span>
                </TabsTrigger>
              )}
              {/* Trimestres: APENAS para Ensino Secundário - NUNCA para Ensino Superior */}
              {isSecundario && (
                <TabsTrigger value="trimestres" className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span className="hidden sm:inline">Trimestres</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="encerramentos" className="flex items-center gap-2">
                <FileLock className="h-4 w-4" />
                <span className="hidden sm:inline">Encerramentos</span>
              </TabsTrigger>
              <TabsTrigger value="reabertura-ano-letivo" className="flex items-center gap-2">
                <Unlock className="h-4 w-4" />
                <span className="hidden sm:inline">Reabertura Excepcional</span>
              </TabsTrigger>
              <TabsTrigger value="auditoria" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Auditoria</span>
              </TabsTrigger>
          </TabsList>

          <div className="w-full">
            <TabsContent 
              value="calendario-academico" 
              className="mt-0 outline-none focus-visible:outline-none"
            >
              <div className="space-y-4">
                <CalendarioAcademicoTab />
              </div>
            </TabsContent>

            <TabsContent 
              value="plano-ensino" 
              className="mt-0 outline-none focus-visible:outline-none"
            >
              <div className="space-y-4">
                {isTabBlocked("plano-ensino") ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      É necessário ter um Calendário Académico ATIVO antes de criar um Plano de Ensino.
                      Acesse a aba "Calendário Académico" primeiro.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <PlanoEnsinoTab
                    sharedContext={sharedContext}
                    onContextChange={handleContextChange}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent 
              value="distribuicao-aulas" 
              className="mt-0 outline-none focus-visible:outline-none"
            >
              <div className="space-y-4">
                {isTabBlocked("distribuicao-aulas") ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      É necessário ter um Plano de Ensino APROVADO antes de distribuir aulas.
                      Acesse a aba "Plano de Ensino" e finalize/aprove o plano primeiro.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <DistribuicaoAulasTab
                    sharedContext={sharedContext}
                    onContextChange={handleContextChange}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent 
              value="lancamento-aulas" 
              className="mt-0 outline-none focus-visible:outline-none"
            >
              <div className="space-y-4">
                {isTabBlocked("lancamento-aulas") ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      É necessário distribuir as aulas antes de realizar lançamentos.
                      Acesse a aba "Distribuição de Aulas" e gere a distribuição automática primeiro.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <LancamentoAulasTab
                    sharedContext={sharedContext}
                    onContextChange={handleContextChange}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent 
              value="controle-presencas" 
              className="mt-0 outline-none focus-visible:outline-none"
            >
              <div className="space-y-4">
                {isTabBlocked("controle-presencas") ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      É necessário lançar aulas como "Ministradas" antes de controlar presenças.
                      Acesse a aba "Lançamento de Aulas" e registre as aulas ministradas primeiro.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <ControlePresencasTab
                    sharedContext={sharedContext}
                    onContextChange={handleContextChange}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent 
              value="avaliacoes-notas" 
              className="mt-0 outline-none focus-visible:outline-none"
            >
              <div className="space-y-4">
                {isTabBlocked("avaliacoes-notas") ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      É necessário controlar presenças e verificar frequência mínima (75%) antes de lançar avaliações.
                      Acesse a aba "Controle de Presenças" e registre as presenças primeiro.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <AvaliacoesNotasTab
                    sharedContext={sharedContext}
                    onContextChange={handleContextChange}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent 
              value="periodos-lancamento-notas" 
              className="mt-0 outline-none focus-visible:outline-none"
            >
              <div className="space-y-4">
                <PeriodoLancamentoNotasTab />
              </div>
            </TabsContent>

            <TabsContent 
              value="relatorios-oficiais" 
              className="mt-0 outline-none focus-visible:outline-none"
            >
              <div className="space-y-4">
                <RelatoriosOficiaisTab />
              </div>
            </TabsContent>

            <TabsContent 
              value="anos-letivos" 
              className="mt-0 outline-none focus-visible:outline-none"
            >
              <div className="space-y-4">
                <AnosLetivosTab />
              </div>
            </TabsContent>

            {/* Semestres: APENAS para Ensino Superior - NUNCA para Ensino Secundário */}
            {isSuperior && (
              <TabsContent 
                value="semestres" 
                className="mt-0 outline-none focus-visible:outline-none"
              >
                <div className="space-y-4">
                  <SemestresTab />
                </div>
              </TabsContent>
            )}

            {/* Trimestres: APENAS para Ensino Secundário - NUNCA para Ensino Superior */}
            {isSecundario && (
              <TabsContent 
                value="trimestres" 
                className="mt-0 outline-none focus-visible:outline-none"
              >
                <div className="space-y-4">
                  <TrimestresTab />
                </div>
              </TabsContent>
            )}

            <TabsContent 
              value="encerramentos" 
              className="mt-0 outline-none focus-visible:outline-none"
            >
              <div className="space-y-4">
                <EncerramentosAcademicosTab />
              </div>
            </TabsContent>

            <TabsContent 
              value="reabertura-ano-letivo" 
              className="mt-0 outline-none focus-visible:outline-none"
            >
              <div className="space-y-4">
                <ReaberturaAnoLetivoTab />
              </div>
            </TabsContent>

            <TabsContent 
              value="auditoria" 
              className="mt-0 outline-none focus-visible:outline-none"
            >
              <div className="space-y-4">
                <AuditoriaTab />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

