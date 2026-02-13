import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { planoEnsinoApi, cursosApi, classesApi, disciplinasApi, professorsApi, turmasApi, professorDisciplinasApi, anoLetivoApi, semestreApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, BookOpen, Calendar, FileText, Printer, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ApresentacaoTab } from "./planoEnsino/ApresentacaoTab";
import { PlanejarTab } from "./planoEnsino/PlanejarTab";
import { ExecutarTab } from "./planoEnsino/ExecutarTab";
import { GerenciarTab } from "./planoEnsino/GerenciarTab";
import { FinalizarTab } from "./planoEnsino/FinalizarTab";
import { EstadoRegistroBadge } from "@/components/workflow/EstadoRegistroBadge";
import { useEstadoRegistro } from "@/hooks/useEstadoRegistro";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { AnoLetivoAtivoGuard } from "@/components/academico/AnoLetivoAtivoGuard";
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";
import { PeriodoAcademicoSelect } from "@/components/academico/PeriodoAcademicoSelect";

interface PlanoEnsinoContext {
  cursoId?: string;
  classeId?: string;
  disciplinaId?: string;
  professorId?: string;
  anoLetivo?: number;
  anoLetivoId?: string;
  turmaId?: string;
  semestre?: number | string; // OBRIGATÓRIO para Ensino Superior (1 ou 2)
  classeOuAno?: string; // OBRIGATÓRIO para Ensino Secundário
}

export default function PlanoEnsino() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const { instituicaoId: tenantInstituicaoId } = useTenantFilter();
  const { instituicaoId: contextoInstituicaoId, instituicao, isSecundario } = useInstituicao();
  // CRÍTICO: Usar fallback para garantir que professores carreguem (user.instituicao_id pode demorar)
  const instituicaoId = tenantInstituicaoId || contextoInstituicaoId || instituicao?.id || (user as any)?.instituicao_id || null;
  const isProfessor = role === 'PROFESSOR';

  const [context, setContext] = useState<PlanoEnsinoContext>({
    cursoId: "",
    classeId: "",
    disciplinaId: "",
    // REGRA SIGA/SIGAE: Se for professor, inicializar com professor.id (professores.id) se disponível
    // O backend aceita users.id e converte automaticamente, mas preferir professores.id
    professorId: "",
    anoLetivo: new Date().getFullYear(),
    turmaId: "",
    semestre: undefined,
    classeOuAno: undefined,
  });

  const [planoId, setPlanoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("apresentacao");

  // Buscar ano letivo ativo
  const { anoLetivoAtivo } = useAnoLetivoAtivo();

  // Buscar anos letivos disponíveis
  const { data: anosLetivos = [] } = useQuery({
    queryKey: ["anos-letivos", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  // Atualizar ano letivo do contexto quando ano letivo ativo estiver disponível
  useEffect(() => {
    if (anoLetivoAtivo && !context.anoLetivoId) {
      setContext((prev) => ({ 
        ...prev, 
        anoLetivo: anoLetivoAtivo.ano,
        anoLetivoId: anoLetivoAtivo.id 
      }));
    }
  }, [anoLetivoAtivo]);

  // Buscar cursos (Ensino Superior) ou classes (Ensino Médio)
  const { data: cursos } = useQuery({
    queryKey: ["cursos-plano-ensino", instituicaoId],
    queryFn: async () => {
      if (!isSecundario) {
        const data = await cursosApi.getAll({ ativo: true });
        return (data || []).filter((c: any) => c.tipo !== "classe");
      }
      return [];
    },
    enabled: !isSecundario && !!instituicaoId,
  });

  const { data: classes } = useQuery({
    queryKey: ["classes-plano-ensino", instituicaoId],
    queryFn: async () => {
      if (isSecundario) {
        return await classesApi.getAll({ ativo: true });
      }
      return [];
    },
    enabled: isSecundario && !!instituicaoId,
  });

  // Buscar disciplinas baseado no curso/classe selecionado
  // MODELO SIGA/SIGAE: Para Ensino Superior, disciplinas vinculadas ao curso via CursoDisciplina
  // Para Ensino Secundário, buscar todas as disciplinas ativas da instituição (disciplinas não são mais vinculadas a classes)
  // Se for professor, buscar apenas suas disciplinas
  const { data: disciplinas } = useQuery({
    queryKey: ["disciplinas-plano-ensino", context.cursoId, context.classeId, isProfessor, user?.id, isSecundario, instituicaoId],
    queryFn: async () => {
      if (isProfessor && user?.id) {
        // REGRA SIGA/SIGAE: Usar GET /professor-disciplinas/me (backend resolve professorId via JWT)
        // NUNCA usar getByProfessor(user.id) - user.id é users.id, não professores.id
        const atribuicoes = await professorDisciplinasApi.getMyDisciplinas();
        // Extrair disciplinas únicas das atribuições
        const disciplinasUnicas = new Map();
        atribuicoes.forEach((atrib: any) => {
          if (atrib.disciplina && !disciplinasUnicas.has(atrib.disciplina.id)) {
            disciplinasUnicas.set(atrib.disciplina.id, {
              id: atrib.disciplina.id,
              nome: atrib.disciplina.nome,
              cursoId: atrib.disciplina.curso?.id || null,
            });
          }
        });
        return Array.from(disciplinasUnicas.values());
      } else {
        // ENSINO SUPERIOR: Buscar disciplinas vinculadas ao curso via CursoDisciplina
        if (!isSecundario && context.cursoId) {
          const vinculos = await cursosApi.listarDisciplinas(context.cursoId);
          if (Array.isArray(vinculos)) {
            return vinculos
              .filter((vinculo: any) => vinculo && vinculo.disciplina)
              .map((vinculo: any) => vinculo.disciplina);
          }
          return [];
        }
        
        // ENSINO SECUNDÁRIO: Buscar todas as disciplinas ativas da instituição
        // IMPORTANTE: Disciplinas não são mais vinculadas a classes - carregar automaticamente
        // O backend filtra automaticamente por instituição (multi-tenant) e tipo acadêmico
        if (isSecundario) {
          const data = await disciplinasApi.getAll();
          return Array.isArray(data) 
            ? data.filter((d: any) => d.ativa !== false)
            : [];
        }
        
        // Fallback: buscar por cursoId/classeId se fornecido (compatibilidade)
        const params: any = { ativo: true };
        if (context.cursoId) params.cursoId = context.cursoId;
        if (context.classeId) params.classeId = context.classeId;
        return await disciplinasApi.getAll(params);
      }
    },
    enabled: isProfessor 
      ? !!user?.id 
      : !!instituicaoId && (
          (!isSecundario && !!context.cursoId) || 
          isSecundario // Para Ensino Secundário, carregar automaticamente quando houver instituicaoId
        ),
  });

  // Buscar professores (tabela professores - entidade acadêmica)
  // REGRA SIGA/SIGAE: GET /professores - NUNCA usar /users?role=PROFESSOR
  const { data: professores } = useQuery({
    queryKey: ["professores-plano-ensino", instituicaoId],
    queryFn: async () => {
      const data = await professorsApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!instituicaoId,
    retry: 2,
    staleTime: 5 * 60 * 1000, // Cache 5 min
  });

  // Buscar turmas
  const { data: turmas } = useQuery({
    queryKey: ["turmas-plano-ensino", context.cursoId, context.classeId, context.disciplinaId],
    queryFn: async () => {
      const params: any = {};
      if (context.cursoId) params.cursoId = context.cursoId;
      if (context.classeId) params.classeId = context.classeId;
      if (context.disciplinaId) params.disciplinaId = context.disciplinaId;
      return await turmasApi.getAll(params);
    },
    enabled: !!(context.cursoId || context.classeId) && !!context.disciplinaId,
  });

  // Buscar semestres (apenas para Ensino Superior)
  const { data: semestres = [], isLoading: isLoadingSemestres } = useQuery({
    queryKey: ["semestres-plano-ensino", context.anoLetivoId, context.anoLetivo, instituicaoId],
    queryFn: async () => {
      if (context.anoLetivoId) {
        return await semestreApi.getAll({ anoLetivoId: context.anoLetivoId });
      }
      if (context.anoLetivo) {
        return await semestreApi.getAll({ anoLetivo: context.anoLetivo });
      }
      return [];
    },
    enabled: !isSecundario && !!instituicaoId && (!!context.anoLetivoId || !!context.anoLetivo),
    retry: 1,
  });

  // Buscar plano de ensino
  const { data: plano, isLoading: loadingPlano } = useQuery({
    queryKey: ["plano-ensino", context],
    queryFn: async () => {
      if (!context.disciplinaId || !context.professorId || !context.anoLetivoId) {
        return null;
      }
      return await planoEnsinoApi.getByContext({
        cursoId: context.cursoId || undefined,
        classeId: context.classeId || undefined,
        disciplinaId: context.disciplinaId,
        professorId: context.professorId,
        anoLetivo: context.anoLetivo, // Mantido para compatibilidade
        anoLetivoId: context.anoLetivoId, // Prioridade: usar ID
        turmaId: context.turmaId || undefined,
      });
    },
    enabled: !!(context.disciplinaId && context.professorId && context.anoLetivoId),
  });

  useEffect(() => {
    if (plano?.id) {
      setPlanoId(plano.id);
    } else {
      setPlanoId(null);
    }
  }, [plano]);

  // Validar contexto completo baseado no tipo de instituição
  const contextComplete = useMemo(() => {
    const camposBase = !!(context.disciplinaId && context.professorId && context.anoLetivo && context.anoLetivoId);
    
    if (!camposBase) return false;
    
    // Validação condicional por tipo de instituição
    if (!isSecundario) {
      // Ensino Superior: cursoId, semestre obrigatórios E semestres devem estar cadastrados
      // Aguardar carregamento dos semestres antes de validar
      if (isLoadingSemestres) return false;
      
      const temSemestres = Array.isArray(semestres) && semestres.length > 0;
      // Verificar se o semestre selecionado existe na lista de semestres cadastrados (SEM valores hardcoded)
      const semestreExiste = temSemestres && context.semestre
        ? semestres.some((s: any) => s.numero === Number(context.semestre))
        : false;
      return !!(context.cursoId && temSemestres && semestreExiste);
    } else {
      // Ensino Secundário: classeId e classeOuAno obrigatórios
      // NUNCA exigir semestre no Ensino Secundário
      return !!(context.classeId && context.classeOuAno && context.classeOuAno.trim() !== '');
    }
  }, [context, isSecundario, semestres, isLoadingSemestres]);
  
  // Verificar estado do plano
  const estadoPlano = plano?.estado || null;
  const { permiteEdicao, mensagemBloqueio } = useEstadoRegistro(estadoPlano);
  
  // Verificar permissões por perfil
  const { planoEnsino: permissoesPlano, messages } = useRolePermissions();
  
  // Calcular se pode editar baseado em permissões e estado
  const canEdit = permissoesPlano.canEdit(estadoPlano) && permiteEdicao;
  
  // Verificar se professor pode visualizar (só aprovado)
  const canView = permissoesPlano.canView && 
    (!permissoesPlano.canViewOnlyApproved || !plano || estadoPlano === 'APROVADO' || estadoPlano === 'ENCERRADO');
  
  // Se professor e plano existe mas não está aprovado/encerrado, mostrar mensagem
  const planoNaoAprovado = isProfessor && plano && estadoPlano && estadoPlano !== 'APROVADO' && estadoPlano !== 'ENCERRADO';

  return (
    <DashboardLayout>
      <AnoLetivoAtivoGuard showAlert={true} disableChildren={false}>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(isProfessor ? "/painel-professor" : "/admin-dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <BookOpen className="h-8 w-8" />
                    Plano de Ensino
                  </h1>
                  {estadoPlano && <EstadoRegistroBadge estado={estadoPlano} />}
                </div>
                <p className="text-muted-foreground">Planeje conteúdos antes de ministrar aulas</p>
              </div>
            </div>
          </div>

        {/* Mensagem de bloqueio se encerrado ou sem permissão */}
        {(planoNaoAprovado || (!canView || !canEdit)) && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm font-medium">
                  {planoNaoAprovado
                    ? messages.professorOnlyView
                    : !canView 
                    ? messages.professorOnlyView
                    : !canEdit && mensagemBloqueio
                    ? mensagemBloqueio
                    : !canEdit && estadoPlano === 'APROVADO'
                    ? messages.recordApproved
                    : messages.actionNotAllowed
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contexto Obrigatório */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Contexto do Plano de Ensino
            </CardTitle>
            <CardDescription>
              Selecione o contexto antes de iniciar o planejamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Curso (Ensino Superior) ou Classe (Ensino Médio) */}
              {isSecundario ? (
                <div className="space-y-2">
                  <Label>Classe / Ano *</Label>
                  <Select
                    value={context.classeId || ""}
                    onValueChange={(value) => {
                      setContext((prev) => ({
                        ...prev,
                        classeId: value,
                        disciplinaId: "",
                        turmaId: "",
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a classe" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes?.map((classe: any) => (
                        <SelectItem key={classe.id} value={String(classe.id)}>
                          {classe.nome || String(classe.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Curso *</Label>
                  <Select
                    value={context.cursoId || ""}
                    onValueChange={(value) => {
                      setContext((prev) => ({
                        ...prev,
                        cursoId: value,
                        disciplinaId: "",
                        turmaId: "",
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o curso" />
                    </SelectTrigger>
                    <SelectContent>
                      {cursos?.map((curso: any) => (
                        <SelectItem key={curso.id} value={String(curso.id)}>
                          {curso.nome || String(curso.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Disciplina */}
              <div className="space-y-2">
                <Label>Disciplina *</Label>
                {isProfessor ? (
                  <Select
                    value={context.disciplinaId || ""}
                    onValueChange={(value) => {
                      const disciplinaSelecionada = disciplinas?.find((d: any) => d.id === value);
                      setContext((prev) => ({
                        ...prev,
                        disciplinaId: value,
                        cursoId: disciplinaSelecionada?.cursoId || prev.cursoId,
                        turmaId: "",
                      }));
                    }}
                    disabled={!disciplinas || disciplinas.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={disciplinas && disciplinas.length > 0 ? "Selecione a disciplina" : "Carregando disciplinas..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {disciplinas?.map((disciplina: any) => (
                        <SelectItem key={disciplina.id} value={String(disciplina.id)}>
                          {disciplina.nome || String(disciplina.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={context.disciplinaId || ""}
                    onValueChange={(value) => {
                      setContext((prev) => ({
                        ...prev,
                        disciplinaId: value,
                        turmaId: "",
                      }));
                    }}
                    disabled={!context.cursoId && !context.classeId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      {disciplinas?.map((disciplina: any) => (
                        <SelectItem key={disciplina.id} value={String(disciplina.id)}>
                          {disciplina.nome || String(disciplina.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Professor */}
              <div className="space-y-2">
                <Label>Professor *</Label>
                {isProfessor ? (
                  <Input
                    value={user?.nome_completo || "Você"}
                    disabled
                    className="bg-muted"
                  />
                ) : (
                  <Select
                    value={context.professorId || ""}
                    onValueChange={(value) => {
                      setContext((prev) => ({ ...prev, professorId: value }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o professor" />
                    </SelectTrigger>
                    <SelectContent>
                      {professores?.map((prof: any) => {
                        // REGRA SIGA/SIGAE (OPÇÃO B): prof.id é professores.id (vindo de GET /professores)
                        return (
                          <SelectItem key={prof.id} value={String(prof.id)}>
                            {prof.nome_completo || prof.nomeCompleto || prof.email || String(prof.id)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Ano Letivo - OBRIGATÓRIO para Plano de Ensino */}
              <div className="space-y-2">
                <Label>Ano Letivo *</Label>
                <Select
                  value={context.anoLetivo?.toString() || ""}
                  onValueChange={(value) => {
                    const anoSelecionado = anosLetivos.find((al: any) => al.ano.toString() === value);
                    setContext((prev) => ({ 
                      ...prev, 
                      anoLetivo: anoSelecionado ? anoSelecionado.ano : Number(value),
                      anoLetivoId: anoSelecionado ? anoSelecionado.id : undefined
                    }));
                  }}
                  disabled={anosLetivos.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={anosLetivos.length === 0 ? "Nenhum ano letivo cadastrado" : "Selecione o ano letivo"} />
                  </SelectTrigger>
                  <SelectContent>
                    {anosLetivos.length === 0 ? (
                      <SelectItem value="empty" disabled>Nenhum ano letivo cadastrado</SelectItem>
                    ) : (
                      anosLetivos.map((al: any) => (
                        <SelectItem key={al.id} value={al.ano.toString()}>
                          {al.ano} - {al.status === 'ATIVO' ? '🟢 Ativo' : al.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Semestre (Obrigatório para Ensino Superior) - Deve vir da tabela Semestres */}
              {!isSecundario && (
                <PeriodoAcademicoSelect
                  value={context.semestre?.toString() || ""}
                  onValueChange={(value) => {
                    setContext((prev) => ({ ...prev, semestre: Number(value) }));
                  }}
                  anoLetivo={context.anoLetivo}
                  anoLetivoId={context.anoLetivoId}
                  label="Semestre"
                  required
                  useNumericValue={true}
                />
              )}

              {/* Classe/Ano (Obrigatório para Ensino Secundário) */}
              {isSecundario && (
                <div className="space-y-2">
                  <Label>Classe/Ano *</Label>
                  <Input
                    value={context.classeOuAno || ""}
                    onChange={(e) => {
                      setContext((prev) => ({ ...prev, classeOuAno: e.target.value }));
                    }}
                    placeholder="Ex: 10ª Classe, 11ª Classe, 12ª Classe"
                  />
                </div>
              )}

              {/* Turma (Opcional) */}
              <div className="space-y-2">
                <Label>Turma (Opcional)</Label>
                <Select
                  value={context.turmaId || "none"}
                  onValueChange={(value) => {
                    setContext((prev) => ({ ...prev, turmaId: value === "none" ? "" : value }));
                  }}
                  disabled={!context.disciplinaId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a turma (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma turma específica</SelectItem>
                    {turmas?.map((turma: any) => (
                      <SelectItem key={turma.id} value={String(turma.id)}>
                        {turma.nome || String(turma.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!contextComplete && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  Preencha todos os campos obrigatórios para continuar
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs do Workflow */}
        {contextComplete && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="apresentacao">
                <FileText className="h-4 w-4 mr-2" />
                1. Apresentação
              </TabsTrigger>
              <TabsTrigger value="planejar">
                <Calendar className="h-4 w-4 mr-2" />
                2. Planejar
              </TabsTrigger>
              <TabsTrigger value="executar">
                <BookOpen className="h-4 w-4 mr-2" />
                3. Executar
              </TabsTrigger>
              <TabsTrigger value="gerenciar">
                <FileText className="h-4 w-4 mr-2" />
                4. Gerenciar
              </TabsTrigger>
              <TabsTrigger value="finalizar">
                <Printer className="h-4 w-4 mr-2" />
                5. Finalizar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="apresentacao">
              <ApresentacaoTab
                context={context}
                plano={plano}
                planoId={planoId}
                loadingPlano={loadingPlano}
              />
            </TabsContent>

            <TabsContent value="planejar">
              <PlanejarTab
                context={context}
                plano={plano}
                planoId={planoId}
                permiteEdicao={canEdit}
                onPlanoCreated={() => {
                  queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
                }}
              />
            </TabsContent>

            <TabsContent value="executar">
              <ExecutarTab plano={plano} planoId={planoId} />
            </TabsContent>

            <TabsContent value="gerenciar">
              <GerenciarTab 
                plano={plano} 
                planoId={planoId}
                permiteEdicao={canEdit}
              />
            </TabsContent>

            <TabsContent value="finalizar">
              <FinalizarTab
                plano={plano}
                planoId={planoId}
                context={context}
                onPlanoBloqueado={() => {
                  queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
                }}
              />
            </TabsContent>
          </Tabs>
        )}
        </div>
      </AnoLetivoAtivoGuard>
    </DashboardLayout>
  );
}

