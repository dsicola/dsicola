import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { planoEnsinoApi, cursosApi, classesApi, disciplinasApi, professorsApi, turmasApi, semestreApi, anoLetivoApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, FileText, Printer, AlertCircle, BookOpen } from "lucide-react";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { AnoLetivoAtivoGuard, useAnoLetivoAtivoProps } from "@/components/academico/AnoLetivoAtivoGuard";
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";
import { ApresentacaoTab } from "../../pages/admin/planoEnsino/ApresentacaoTab";
import { PlanejarTab } from "../../pages/admin/planoEnsino/PlanejarTab";
import { ExecutarTab } from "../../pages/admin/planoEnsino/ExecutarTab";
import { GerenciarTab } from "../../pages/admin/planoEnsino/GerenciarTab";
import { FinalizarTab } from "../../pages/admin/planoEnsino/FinalizarTab";
import { SearchableSelect, SearchableSelectOption } from "@/components/common/SearchableSelect";
import { AnoLetivoSelect } from "@/components/academico/AnoLetivoSelect";
import { CargaHorariaStatusCard } from "@/components/planoEnsino/CargaHorariaStatusCard";
import { PeriodoAcademicoSelect } from "@/components/academico/PeriodoAcademicoSelect";

interface PlanoEnsinoContext {
  cursoId?: string;
  classeId?: string;
  disciplinaId?: string;
  professorId?: string;
  anoLetivo?: number;
  anoLetivoId?: string; // OBRIGATÓRIO para Plano de Ensino
  turmaId?: string;
  semestre?: number; // OBRIGATÓRIO apenas se tipoInstituicao = Ensino Superior (1 ou 2)
  classeOuAno?: string; // OBRIGATÓRIO apenas se tipoInstituicao = Ensino Secundário
}

interface PlanoEnsinoTabProps {
  sharedContext?: PlanoEnsinoContext;
  onContextChange?: (context: PlanoEnsinoContext) => void;
}

export function PlanoEnsinoTab({ sharedContext, onContextChange }: PlanoEnsinoTabProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { instituicaoId: tenantInstituicaoId } = useTenantFilter();
  const { instituicaoId: contextoInstituicaoId, isSuperior, isSecundario, instituicao, tipoAcademico, refetch: refetchInstituicao, loading: loadingInstituicao } = useInstituicao();
  // CRÍTICO: Usar fallback para garantir que professores carreguem (user.instituicao_id pode demorar)
  const instituicaoId = tenantInstituicaoId || contextoInstituicaoId || instituicao?.id || (user as any)?.instituicao_id || null;
  const { anoLetivoAtivo } = useAnoLetivoAtivo();
  const anoLetivoProps = useAnoLetivoAtivoProps();
  
  // Fallback: se isSuperior não estiver definido, verificar diretamente
  const isEnsinoSuperior = isSuperior || tipoAcademico === 'SUPERIOR' || instituicao?.tipoAcademico === 'SUPERIOR' || instituicao?.tipo_academico === 'SUPERIOR';
  const isEnsinoSecundario = isSecundario || tipoAcademico === 'SECUNDARIO' || instituicao?.tipoAcademico === 'SECUNDARIO' || instituicao?.tipo_academico === 'SECUNDARIO';
  
  // Debug: Log do tipo de ensino detectado
  useEffect(() => {
    console.log('[PlanoEnsinoTab] Tipo de ensino detectado:', {
      isSuperior,
      isSecundario,
      tipoAcademico,
      instituicaoTipoAcademico: instituicao?.tipoAcademico || instituicao?.tipo_academico,
      isEnsinoSuperior,
      isEnsinoSecundario,
      instituicaoId
    });
  }, [isSuperior, isSecundario, tipoAcademico, instituicao?.tipoAcademico, instituicao?.tipo_academico, isEnsinoSuperior, isEnsinoSecundario, instituicaoId]);

  // Forçar recarregamento de cursos quando isEnsinoSuperior mudar para true
  useEffect(() => {
    if (isEnsinoSuperior && instituicaoId) {
      console.log('[PlanoEnsinoTab] Habilitando query de cursos - isEnsinoSuperior:', isEnsinoSuperior, 'instituicaoId:', instituicaoId);
      // Invalidar query de cursos para forçar recarregamento quando isEnsinoSuperior mudar para true
      queryClient.invalidateQueries({ 
        queryKey: ["cursos-plano-ensino"],
        exact: false 
      });
    }
  }, [isEnsinoSuperior, instituicaoId, queryClient]);

  // Verificar se tipoAcademico está disponível e tentar recarregar o contexto se necessário
  useEffect(() => {
    if (!tipoAcademico && instituicaoId && !loadingInstituicao) {
      console.warn('[PlanoEnsinoTab] tipoAcademico não está disponível, mas instituicaoId está presente. Tentando recarregar contexto:', {
        instituicaoId,
        tipoAcademico,
        loadingInstituicao,
        instituicaoData: instituicao ? {
          tipo_academico: instituicao?.tipo_academico,
          tipoAcademico: instituicao?.tipoAcademico,
          tipo_instituicao: instituicao?.tipo_instituicao,
        } : null
      });
      
      // Tentar recarregar o contexto da instituição uma vez se tipoAcademico não estiver disponível
      // Isso pode ajudar quando as APIs falham inicialmente mas funcionam depois
      const timer = setTimeout(() => {
        if (!tipoAcademico && instituicaoId) {
          console.log('[PlanoEnsinoTab] Recarregando contexto da instituição...');
          // Tratar promise para evitar erros não capturados
          // Erros 400/403 são esperados e já são tratados silenciosamente pelo contexto
          refetchInstituicao().catch((error) => {
            // Apenas logar erros inesperados (não 400/403)
            if (error?.response?.status !== 400 && error?.response?.status !== 403) {
              console.warn('[PlanoEnsinoTab] Erro ao recarregar contexto da instituição:', error);
            }
          });
        }
      }, 2000); // Aguardar 2 segundos antes de tentar recarregar
      
      return () => clearTimeout(timer);
    }
  }, [tipoAcademico, instituicaoId, loadingInstituicao, instituicao, refetchInstituicao]);

  // Pré-selecionar ano letivo ativo se disponível
  const anoLetivoInicial = useMemo(() => {
    if (sharedContext?.anoLetivo) return sharedContext.anoLetivo;
    if (anoLetivoAtivo?.ano) return anoLetivoAtivo.ano;
    return new Date().getFullYear();
  }, [sharedContext?.anoLetivo, anoLetivoAtivo?.ano]);

  const [context, setContext] = useState<PlanoEnsinoContext>(
    sharedContext || {
      cursoId: "",
      classeId: "",
      disciplinaId: "",
      professorId: "",
      anoLetivo: anoLetivoInicial,
      anoLetivoId: anoLetivoAtivo?.id || "",
      turmaId: "",
      semestre: undefined,
      classeOuAno: undefined,
    }
  );

  // Buscar anos letivos para sincronizar anoLetivo com anoLetivoId
  const { data: anosLetivos = [] } = useQuery({
    queryKey: ["anos-letivos-plano-ensino", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  // Sincronizar anoLetivoId quando anoLetivo mudar (se anoLetivoId não estiver definido ou não corresponder)
  useEffect(() => {
    if (context.anoLetivo && anosLetivos.length > 0) {
      const anoLetivoEncontrado = anosLetivos.find((al: any) => al.ano === context.anoLetivo);
      if (anoLetivoEncontrado && anoLetivoEncontrado.id !== context.anoLetivoId) {
        // Se o ano letivo mudou, limpar o semestre (semestres são específicos por ano letivo)
        updateContext({ 
          anoLetivoId: anoLetivoEncontrado.id,
          semestre: undefined // Limpar semestre quando ano letivo muda
        });
        // Invalidar todas as queries de semestres para forçar recarregamento
        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'semestres' || query.queryKey[0] === 'semestres-plano-ensino' });
        // Invalidar query do plano de ensino para garantir recarregamento com novo anoLetivoId
        queryClient.invalidateQueries({ 
          queryKey: ["plano-ensino"],
          exact: false 
        });
      }
    }
  }, [context.anoLetivo, anosLetivos, queryClient]);

  // Sincronizar anoLetivo quando anoLetivoId mudar (se anoLetivo não estiver definido ou não corresponder)
  useEffect(() => {
    if (context.anoLetivoId && anosLetivos.length > 0) {
      const anoLetivoEncontrado = anosLetivos.find((al: any) => al.id === context.anoLetivoId);
      if (anoLetivoEncontrado && anoLetivoEncontrado.ano !== context.anoLetivo) {
        // Se o ano letivo ID mudou, limpar o semestre (semestres são específicos por ano letivo)
        updateContext({ 
          anoLetivo: anoLetivoEncontrado.ano,
          semestre: undefined // Limpar semestre quando ano letivo muda
        });
        // Invalidar todas as queries de semestres para forçar recarregamento
        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'semestres' || query.queryKey[0] === 'semestres-plano-ensino' });
        // Invalidar query do plano de ensino para garantir recarregamento com novo anoLetivo
        queryClient.invalidateQueries({ 
          queryKey: ["plano-ensino"],
          exact: false 
        });
      }
    }
  }, [context.anoLetivoId, anosLetivos, queryClient]);

  // Atualizar ano letivo quando ano letivo ativo mudar
  useEffect(() => {
    if (anoLetivoAtivo?.ano && !context.anoLetivo) {
      updateContext({ 
        anoLetivo: anoLetivoAtivo.ano,
        anoLetivoId: anoLetivoAtivo.id 
      });
    }
  }, [anoLetivoAtivo?.ano, anoLetivoAtivo?.id]);

  // SINCRONIZAÇÃO CRÍTICA: Garantir que anoLetivoId seja sempre definido quando anoLetivo estiver definido
  useEffect(() => {
    if (context.anoLetivo && anosLetivos.length > 0) {
      const anoLetivoEncontrado = anosLetivos.find((al: any) => al.ano === context.anoLetivo);
      if (anoLetivoEncontrado && anoLetivoEncontrado.id) {
        // Sincronizar anoLetivoId se não estiver definido ou se estiver diferente
        if (!context.anoLetivoId || context.anoLetivoId !== anoLetivoEncontrado.id) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[PlanoEnsinoTab] Sincronizando anoLetivoId:', {
              anoLetivo: context.anoLetivo,
              anoLetivoIdAtual: context.anoLetivoId,
              anoLetivoIdNovo: anoLetivoEncontrado.id
            });
          }
          updateContext({ anoLetivoId: anoLetivoEncontrado.id });
          // Invalidar query do plano quando anoLetivoId for sincronizado para garantir recarregamento
          queryClient.invalidateQueries({ 
            queryKey: ["plano-ensino"],
            exact: false 
          });
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[PlanoEnsinoTab] ⚠️ Ano letivo não encontrado na lista:', {
            anoLetivo: context.anoLetivo,
            anosLetivosDisponiveis: anosLetivos.map((al: any) => al.ano)
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.anoLetivo, context.anoLetivoId, anosLetivos]);

  const [planoId, setPlanoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("apresentacao");
  const [shouldOpenAulaDialog, setShouldOpenAulaDialog] = useState(false);

  // Atualizar contexto quando sharedContext mudar
  useEffect(() => {
    if (sharedContext) {
      setContext(sharedContext);
    }
  }, [sharedContext]);

  // Notificar mudanças no contexto
  useEffect(() => {
    if (onContextChange) {
      onContextChange(context);
    }
  }, [context, onContextChange]);

  // Buscar cursos (Ensino Superior) ou classes (Ensino Secundário)
  // IMPORTANTE: Carregar automaticamente quando houver instituicaoId
  // O backend filtra automaticamente pelo tipo de instituição e multi-tenant via JWT token
  // CORREÇÃO: Habilitar query mesmo se tipo acadêmico não estiver disponível ainda (carregará quando disponível)
  const cursosQueryEnabled = !!instituicaoId && (isEnsinoSuperior || !isEnsinoSecundario); // Carregar se for Superior OU se tipo ainda não foi determinado
  
  // Debug: Log quando a query de cursos é habilitada/desabilitada
  useEffect(() => {
    console.log('[PlanoEnsinoTab] Query de cursos - enabled:', cursosQueryEnabled, {
      isEnsinoSuperior,
      isEnsinoSecundario,
      instituicaoId,
      tipoAcademico,
      instituicaoTipoAcademico: instituicao?.tipoAcademico || instituicao?.tipo_academico
    });
  }, [cursosQueryEnabled, isEnsinoSuperior, isEnsinoSecundario, instituicaoId, tipoAcademico, instituicao?.tipoAcademico, instituicao?.tipo_academico]);

  const { data: cursos, isLoading: isLoadingCursos, error: errorCursos } = useQuery({
    queryKey: ["cursos-plano-ensino", instituicaoId, isEnsinoSuperior],
    queryFn: async () => {
      console.log('[PlanoEnsinoTab] Executando query de cursos...');
      try {
        // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
        // O backend usa req.user.instituicaoId do JWT token automaticamente
        const data = await cursosApi.getAll({ ativo: true });
        
        // Filtrar cursos do tipo 'classe' (esses são classes, não cursos)
        // Incluir cursos ativos ou sem campo ativo (null/undefined)
        const cursosFiltrados = (data || []).filter((c: any) => {
          return c.tipo !== "classe" && (c.ativo === true || c.ativo === null || c.ativo === undefined);
        });
        
        console.log('[PlanoEnsinoTab] Cursos encontrados:', cursosFiltrados.length, { 
          total: data?.length || 0, 
          isEnsinoSuperior, 
          instituicaoId 
        });
        return cursosFiltrados;
      } catch (error) {
        console.error('[PlanoEnsinoTab] Erro ao buscar cursos:', error);
        return []; // Retornar array vazio em caso de erro
      }
    },
    enabled: cursosQueryEnabled, // Habilitar quando houver instituicaoId (backend filtra por JWT token)
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    retry: 2, // Tentar novamente 2 vezes em caso de erro
  });

  const { data: classes, isLoading: isLoadingClasses, error: errorClasses } = useQuery({
    queryKey: ["classes-plano-ensino", instituicaoId],
    queryFn: async () => {
      try {
        if (isEnsinoSecundario) {
          return await classesApi.getAll({ ativo: true });
        }
        return [];
      } catch (error) {
        console.error('[PlanoEnsinoTab] Erro ao buscar classes:', error);
        return []; // Retornar array vazio em caso de erro
      }
    },
    enabled: (isEnsinoSecundario || (!isEnsinoSuperior && !isEnsinoSecundario)) && !!instituicaoId, // Habilitar também se tipo ainda não foi determinado
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    retry: 2, // Tentar novamente 2 vezes em caso de erro
  });

  // Buscar disciplinas baseado no curso ou classe selecionado
  // MODELO SIGA/SIGAE: Disciplinas devem estar vinculadas ao curso via CursoDisciplina
  // IMPORTANTE: 
  // - Ensino Superior: buscar disciplinas vinculadas ao curso via CursoDisciplina
  // - Ensino Secundário: buscar disciplinas vinculadas à classe (pode ter curso também)
  // CORREÇÃO: Carregar disciplinas quando houver cursoId (Superior) OU classeId (Secundário)
  const disciplinasQueryEnabled = useMemo(() => {
    // Ensino Superior: precisa de cursoId
    if (isEnsinoSuperior && !!context.cursoId) {
      return true;
    }
    // Ensino Secundário: pode ter classeId (e opcionalmente cursoId)
    if (isEnsinoSecundario && (!!context.classeId || !!context.cursoId)) {
      return true;
    }
    // Fallback: se tipo não foi determinado, aceitar cursoId ou classeId
    if (!isEnsinoSuperior && !isEnsinoSecundario && (!!context.cursoId || !!context.classeId)) {
      return true;
    }
    
    return false;
  }, [context.cursoId, context.classeId, isEnsinoSuperior, isEnsinoSecundario]);

  // Debug: Log quando a query de disciplinas é habilitada/desabilitada
  useEffect(() => {
    console.log('[PlanoEnsinoTab] Query de disciplinas - enabled:', disciplinasQueryEnabled, {
      isEnsinoSuperior,
      isEnsinoSecundario,
      cursoId: context.cursoId,
      classeId: context.classeId,
      instituicaoId,
      tipoAcademico,
      instituicaoTipoAcademico: instituicao?.tipoAcademico || instituicao?.tipo_academico
    });
  }, [disciplinasQueryEnabled, isEnsinoSuperior, isEnsinoSecundario, context.cursoId, context.classeId, instituicaoId, tipoAcademico, instituicao?.tipoAcademico, instituicao?.tipo_academico]);

  const { data: disciplinas, isLoading: isLoadingDisciplinas, error: errorDisciplinas } = useQuery({
    queryKey: ["disciplinas-plano-ensino", context.cursoId, context.classeId, isEnsinoSuperior, isEnsinoSecundario, instituicaoId],
    queryFn: async () => {
      try {
        console.log('[PlanoEnsinoTab] Executando query de disciplinas...', { 
          isEnsinoSuperior, 
          isEnsinoSecundario,
          cursoId: context.cursoId,
          classeId: context.classeId,
          instituicaoId,
          tipoAcademico
        });
        
        // IMPORTANTE: Buscar disciplinas vinculadas ao curso
        // REGRA SIGA/SIGAE: Disciplinas são sempre vinculadas a CURSOS via CursoDisciplina
        // No Ensino Secundário, mesmo com classeId, as disciplinas são vinculadas a cursos
        // Se houver apenas classeId sem cursoId, buscar todas as disciplinas da instituição (filtradas por multi-tenant)
        let vinculos: any[] = [];
        
        if (context.cursoId) {
          // Buscar disciplinas vinculadas ao curso via CursoDisciplina
          vinculos = await cursosApi.listarDisciplinas(context.cursoId);
        } else if (context.classeId && isEnsinoSecundario) {
          // Para Ensino Secundário com apenas classeId (sem cursoId):
          // Buscar todas as disciplinas da instituição (o backend filtra por multi-tenant via JWT)
          // IMPORTANTE: No Ensino Secundário, disciplinas podem estar vinculadas a vários cursos
          // O usuário pode selecionar qualquer disciplina disponível na instituição
          try {
            // IMPORTANTE: Multi-tenant - backend filtra automaticamente por instituicaoId do token
            const todasDisciplinas = await disciplinasApi.getAll();
            // Filtrar apenas disciplinas ativas e converter para formato compatível com vinculos
            const disciplinasAtivas = (todasDisciplinas || []).filter((d: any) => d.ativa !== false);
            vinculos = disciplinasAtivas.map((d: any) => ({
              disciplina: d,
              cursoId: null,
              semestre: null,
              trimestre: null,
              cargaHoraria: d.cargaHoraria,
              obrigatoria: d.obrigatoria !== false
            }));
          } catch (error: any) {
            console.error('[PlanoEnsinoTab] Erro ao buscar disciplinas da instituição:', error);
            return [];
          }
        } else {
          console.warn('[PlanoEnsinoTab] Nenhum curso ou classe selecionado - não é possível buscar disciplinas');
          return [];
        }
        
        // Garantir que vinculos seja um array
        if (!Array.isArray(vinculos)) {
          console.warn('[PlanoEnsinoTab] listarDisciplinas retornou não-array:', vinculos);
          return [];
        }
        
        // Extrair disciplinas dos vínculos
        // Validar que cada vinculo tenha disciplina
        const disciplinasVinculadas = vinculos
          .filter((vinculo: any) => vinculo && vinculo.disciplina)
          .map((vinculo: any) => ({
            ...vinculo.disciplina,
            cursoDisciplina: {
              semestre: vinculo.semestre,
              trimestre: vinculo.trimestre,
              cargaHoraria: vinculo.cargaHoraria,
              obrigatoria: vinculo.obrigatoria,
            }
          }));
        
        // Filtrar apenas disciplinas ativas
        const disciplinasAtivas = disciplinasVinculadas.filter((d: any) => {
          // Incluir se ativa for true, null ou undefined
          // Excluir apenas se ativa for explicitamente false
          return d.ativa !== false;
        });
        
        console.log('[PlanoEnsinoTab] Disciplinas encontradas para curso:', {
          total: disciplinasVinculadas.length,
          ativas: disciplinasAtivas.length,
          cursoId: context.cursoId
        });
        
        // Log das primeiras disciplinas para debug
        if (disciplinasAtivas.length > 0) {
          console.log('[PlanoEnsinoTab] Primeiras disciplinas vinculadas:', disciplinasAtivas.slice(0, 3).map((d: any) => ({
            id: d.id,
            nome: d.nome,
            ativa: d.ativa
          })));
        }
        
        return disciplinasAtivas || [];
      } catch (error: any) {
        console.error('[PlanoEnsinoTab] Erro ao buscar disciplinas:', {
          message: error?.message,
          response: error?.response?.data,
          status: error?.response?.status,
          error
        });
        // Retornar array vazio em caso de erro para não quebrar a UI
        return [];
      }
    },
    enabled: disciplinasQueryEnabled,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    retry: 2, // Tentar novamente 2 vezes em caso de erro
  });

  // Buscar professores (tabela professores - entidade acadêmica)
  // REGRA SIGA/SIGAE: GET /professores - NUNCA usar /users?role=PROFESSOR ou profilesApi
  const { data: professores, isLoading: loadingProfessores, error: errorProfessores } = useQuery({
    queryKey: ["professores-plano-ensino", instituicaoId],
    queryFn: async () => {
      const data = await professorsApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!instituicaoId,
    retry: 2,
    staleTime: 5 * 60 * 1000, // Cache 5 min
  });

  // Preparar opções de professores para SearchableSelect
  // REGRA SIGA/SIGAE (OPÇÃO B): prof.id é professores.id (vindo de GET /professores)
  const professoresOptions: SearchableSelectOption[] = useMemo(() => {
    if (!professores) return [];
    return professores
      .map((prof: any) => ({
        value: String(prof.id),
        label: prof.nome_completo || prof.nomeCompleto || prof.email || String(prof.id),
        subtitle: prof.email || undefined,
      }));
  }, [professores]);

  // Buscar turmas
  const { data: turmas, isLoading: isLoadingTurmas } = useQuery({
    queryKey: ["turmas-plano-ensino", context.cursoId, context.classeId, context.disciplinaId],
    queryFn: async () => {
      const params: any = {};
      if (context.cursoId) params.cursoId = context.cursoId;
      if (context.classeId) params.classeId = context.classeId;
      if (context.disciplinaId) params.disciplinaId = context.disciplinaId;
      return await turmasApi.getAll(params);
    },
    enabled: !!(context.cursoId || context.classeId) && !!context.disciplinaId,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  // Buscar semestres (apenas para Ensino Superior)
  // IMPORTANTE: Habilitar também se houver cursoId selecionado (indica Ensino Superior)
  // mesmo se isEnsinoSuperior não estiver detectado corretamente
  const semestresQueryEnabled = (isEnsinoSuperior || !!context.cursoId) && !!instituicaoId && (!!context.anoLetivoId || !!context.anoLetivo);
  
  // Debug: Log quando a query de semestres é habilitada/desabilitada
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[PlanoEnsinoTab] Query de semestres - enabled:', semestresQueryEnabled, {
        isEnsinoSuperior,
        instituicaoId,
        anoLetivoId: context.anoLetivoId,
        anoLetivo: context.anoLetivo
      });
    }
  }, [semestresQueryEnabled, isEnsinoSuperior, instituicaoId, context.anoLetivoId, context.anoLetivo]);

  const { data: semestres = [], isLoading: isLoadingSemestres, error: errorSemestres } = useQuery({
    queryKey: ["semestres-plano-ensino", context.anoLetivoId, context.anoLetivo, instituicaoId],
    queryFn: async () => {
      try {
        console.log('[PlanoEnsinoTab] Executando query de semestres...', {
          anoLetivoId: context.anoLetivoId,
          anoLetivo: context.anoLetivo
        });
        
        let resultado;
        if (context.anoLetivoId) {
          resultado = await semestreApi.getAll({ anoLetivoId: context.anoLetivoId });
        } else if (context.anoLetivo) {
          resultado = await semestreApi.getAll({ anoLetivo: context.anoLetivo });
        } else {
          console.warn('[PlanoEnsinoTab] Nenhum ano letivo disponível para buscar semestres');
          return [];
        }
        
        console.log('[PlanoEnsinoTab] Semestres encontrados:', {
          count: Array.isArray(resultado) ? resultado.length : 0,
          semestres: Array.isArray(resultado) ? resultado.map((s: any) => ({ id: s.id, numero: s.numero, anoLetivoId: s.anoLetivoId })) : []
        });
        
        return Array.isArray(resultado) ? resultado : [];
      } catch (error: any) {
        console.error('[PlanoEnsinoTab] Erro ao buscar semestres:', {
          message: error?.message,
          response: error?.response?.data,
          status: error?.response?.status,
          error
        });
        return [];
      }
    },
    enabled: semestresQueryEnabled,
    retry: 2,
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
  });

  // Buscar plano de ensino
  const { data: plano, isLoading: loadingPlano, refetch: refetchPlano } = useQuery({
    queryKey: ["plano-ensino", context],
    queryFn: async () => {
      // Verificar se temos pelo menos anoLetivo ou anoLetivoId para a busca
      const temAnoLetivo = !!(context.anoLetivoId || context.anoLetivo);
      if (!context.disciplinaId || !context.professorId || !temAnoLetivo) {
        return null;
      }
      
      // Tentar obter anoLetivoId se não estiver disponível
      let anoLetivoIdFinal = context.anoLetivoId;
      if (!anoLetivoIdFinal && context.anoLetivo && anosLetivos.length > 0) {
        const anoEncontrado = anosLetivos.find((al: any) => al.ano === context.anoLetivo);
        if (anoEncontrado) {
          anoLetivoIdFinal = anoEncontrado.id;
        }
      }
      
      // CORREÇÃO: Não enviar anoLetivoId se for string vazia (backend espera undefined ou string válida)
      // Não enviar campos opcionais como string vazia - usar undefined
      const params: any = {
        disciplinaId: context.disciplinaId,
        professorId: context.professorId,
      };
      
      // Adicionar anoLetivo ou anoLetivoId (pelo menos um deve estar presente)
      if (anoLetivoIdFinal && anoLetivoIdFinal.trim() !== '') {
        params.anoLetivoId = anoLetivoIdFinal;
      } else if (context.anoLetivo) {
        params.anoLetivo = context.anoLetivo;
      }
      
      // Adicionar campos opcionais apenas se tiverem valor válido
      if (context.cursoId && context.cursoId.trim() !== '') {
        params.cursoId = context.cursoId;
      }
      if (context.classeId && context.classeId.trim() !== '') {
        params.classeId = context.classeId;
      }
      if (context.turmaId && context.turmaId.trim() !== '') {
        params.turmaId = context.turmaId;
      }
      if (context.semestre !== undefined && context.semestre !== null) {
        params.semestre = Number(context.semestre);
      }
      if (context.classeOuAno && context.classeOuAno.trim() !== '') {
        params.classeOuAno = context.classeOuAno;
      }
      
      try {
        return await planoEnsinoApi.getByContext(params);
      } catch (error: any) {
        // Tratar erro 400 (Bad Request) silenciosamente se os campos obrigatórios ainda não estão completos
        // Isso evita logs desnecessários durante o preenchimento do formulário
        if (error?.response?.status === 400) {
          const errorMessage = error?.response?.data?.message || error?.message || '';
          // Se o erro for sobre campos obrigatórios faltando, retornar null silenciosamente
          if (errorMessage.includes('obrigatório') || errorMessage.includes('obrigatória')) {
            if (process.env.NODE_ENV === 'development') {
              console.log('[PlanoEnsinoTab] Campos obrigatórios ainda não preenchidos - ignorando erro 400:', errorMessage);
            }
            return null;
          }
          // Para outros erros 400, logar apenas em desenvolvimento
          if (process.env.NODE_ENV === 'development') {
            console.warn('[PlanoEnsinoTab] Erro 400 ao buscar plano de ensino:', errorMessage);
          }
          throw error;
        }
        // Para outros erros, propagar normalmente
        throw error;
      }
    },
    enabled: !!(context.disciplinaId && context.professorId && (context.anoLetivoId || context.anoLetivo)),
    staleTime: 0, // Sempre considerar os dados como stale para garantir atualização
    cacheTime: 5 * 60 * 1000, // Cache por 5 minutos
    retry: (failureCount, error: any) => {
      // Não retentar em caso de erro 400 (Bad Request) - indica parâmetros inválidos
      if (error?.response?.status === 400) {
        return false;
      }
      return failureCount < 2;
    },
  });

  useEffect(() => {
    if (plano?.id) {
      setPlanoId(plano.id);
      
      // SINCRONIZAÇÃO: Atualizar contexto com dados do plano se necessário
      // Isso garante que o contexto esteja sempre alinhado com o plano encontrado
      setContext((prevContext) => {
        const updates: Partial<PlanoEnsinoContext> = {};
        let needsUpdate = false;
        
        // Sincronizar semestre se o plano tiver e o contexto não tiver
        if (plano.semestre && !prevContext.semestre) {
          updates.semestre = plano.semestre;
          needsUpdate = true;
        }
        
        // Sincronizar classeOuAno se o plano tiver e o contexto não tiver
        if (plano.classeOuAno && !prevContext.classeOuAno) {
          updates.classeOuAno = plano.classeOuAno;
          needsUpdate = true;
        }
        
        // Sincronizar cursoId/classeId se necessário
        if (plano.cursoId && !prevContext.cursoId) {
          updates.cursoId = plano.cursoId;
          needsUpdate = true;
        }
        if (plano.classeId && !prevContext.classeId) {
          updates.classeId = plano.classeId;
          needsUpdate = true;
        }
        
        // Sincronizar turmaId se necessário
        if (plano.turmaId && !prevContext.turmaId) {
          updates.turmaId = plano.turmaId;
          needsUpdate = true;
        }
        
        // Retornar contexto atualizado se houver mudanças
        return needsUpdate ? { ...prevContext, ...updates } : prevContext;
      });
    } else {
      setPlanoId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plano?.id, plano?.semestre, plano?.classeOuAno, plano?.cursoId, plano?.classeId, plano?.turmaId]);

  // Validação completa do contexto: todos os campos obrigatórios + campos condicionais
  const contextComplete = useMemo(() => {
    // Validar campos base: disciplina, professor e ano letivo
    // IMPORTANTE: anoLetivoId é OBRIGATÓRIO para Plano de Ensino (regra mestre do backend)
    
    // Verificar se há ano letivo (considerando sincronização)
    let anoLetivoIdFinal = context.anoLetivoId;
    if (!anoLetivoIdFinal && context.anoLetivo && anosLetivos.length > 0) {
      const anoEncontrado = anosLetivos.find((al: any) => al.ano === context.anoLetivo);
      if (anoEncontrado) {
        anoLetivoIdFinal = anoEncontrado.id;
      }
    }
    
    // CRÍTICO: anoLetivoId é obrigatório (não apenas anoLetivo)
    const temAnoLetivoId = !!anoLetivoIdFinal;
    const camposBase = !!(context.disciplinaId && context.professorId && temAnoLetivoId);
    
    // Debug: Log da validação
    if (process.env.NODE_ENV === 'development') {
      console.log('[PlanoEnsinoTab] Validação do contexto:', {
        disciplinaId: !!context.disciplinaId,
        professorId: !!context.professorId,
        anoLetivo: !!context.anoLetivo,
        anoLetivoId: !!context.anoLetivoId,
        anoLetivoIdFinal: !!anoLetivoIdFinal,
        temAnoLetivoId,
        camposBase,
        cursoId: !!context.cursoId,
        classeId: !!context.classeId,
        semestre: context.semestre,
        classeOuAno: context.classeOuAno,
        isEnsinoSuperior,
        isEnsinoSecundario,
        isLoadingSemestres,
        semestresCount: Array.isArray(semestres) ? semestres.length : 0
      });
    }
    
    if (!camposBase) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[PlanoEnsinoTab] ❌ Campos base não preenchidos');
      }
      return false;
    }
    
    // Validação condicional por tipo de instituição
    // IMPORTANTE: Se não há cursoId mas há classeId, considerar Ensino Secundário
    // Se há cursoId mas não há classeId, considerar Ensino Superior
    const temCurso = !!context.cursoId;
    const temClasse = !!context.classeId;
    
    if (isEnsinoSuperior || (temCurso && !temClasse)) {
      // Ensino Superior: cursoId, semestre obrigatórios E semestres devem estar cadastrados
      // Aguardar carregamento dos semestres antes de validar
      if (isLoadingSemestres) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[PlanoEnsinoTab] ⏳ Aguardando carregamento de semestres...');
        }
        return false;
      }
      
      // Verificar se há semestres cadastrados para o ano letivo
      // IMPORTANTE: Se ainda está carregando, aguardar antes de validar
      const temSemestres = Array.isArray(semestres) && semestres.length > 0;
      
      // Se ainda está carregando, aguardar
      if (isLoadingSemestres) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[PlanoEnsinoTab] ⏳ Aguardando carregamento de semestres...');
        }
        return false;
      }
      
      // Se não há semestres cadastrados, não pode continuar
      // Mas só mostrar erro se a query foi executada (não está mais carregando)
      if (!temSemestres && !isLoadingSemestres) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[PlanoEnsinoTab] ❌ Nenhum semestre cadastrado para o ano letivo', {
            anoLetivoId: context.anoLetivoId,
            anoLetivo: context.anoLetivo,
            semestresCount: semestres.length,
            errorSemestres: errorSemestres
          });
        }
        return false;
      }
      
      // Verificar se o semestre selecionado existe na lista de semestres cadastrados (SEM valores hardcoded)
      // Aceitar tanto número quanto string convertida para número
      const semestreExiste = context.semestre 
        ? semestres.some((s: any) => {
            const semestreNum = typeof context.semestre === 'string' ? Number(context.semestre) : context.semestre;
            return s.numero === semestreNum || s.numero === context.semestre;
          })
        : false;
      
      // Todos os campos obrigatórios devem estar preenchidos
      const isValid = !!(context.cursoId && context.semestre && semestreExiste);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[PlanoEnsinoTab] Validação Ensino Superior:', {
          cursoId: !!context.cursoId,
          semestre: context.semestre,
          semestreExiste,
          isValid
        });
      }
      
      return isValid;
    } else if (isEnsinoSecundario || (temClasse && !temCurso)) {
      // Ensino Secundário: classeId e classeOuAno obrigatórios
      // NUNCA exigir semestre no Ensino Secundário
      const isValid = !!(context.classeId && context.classeOuAno && context.classeOuAno.trim() !== '');
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[PlanoEnsinoTab] Validação Ensino Secundário:', {
          classeId: !!context.classeId,
          classeOuAno: context.classeOuAno,
          isValid
        });
      }
      
      return isValid;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[PlanoEnsinoTab] ❌ Tipo de instituição não identificado');
    }
    return false;
  }, [context, isEnsinoSuperior, isEnsinoSecundario, semestres, isLoadingSemestres, anosLetivos]);

  const updateContext = (updates: Partial<PlanoEnsinoContext>) => {
    setContext((prev) => {
      const newContext = { ...prev, ...updates };
      
      // SINCRONIZAÇÃO AUTOMÁTICA: Se anoLetivo foi atualizado, buscar anoLetivoId correspondente
      if (updates.anoLetivo !== undefined && !updates.anoLetivoId && anosLetivos.length > 0) {
        const anoLetivoEncontrado = anosLetivos.find((al: any) => al.ano === updates.anoLetivo);
        if (anoLetivoEncontrado) {
          newContext.anoLetivoId = anoLetivoEncontrado.id;
        }
      }
      
      return newContext;
    });
  };

  return (
    <AnoLetivoAtivoGuard showAlert={true}>
      <div className="space-y-4 sm:space-y-6 w-full">
        {/* Contexto Obrigatório */}
        <Card className="w-full">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="text-base sm:text-lg">Contexto do Plano de Ensino</span>
            </CardTitle>
            {isEnsinoSecundario && (
              <Badge variant="secondary" className="text-xs font-normal">
                Ensino Secundário
              </Badge>
            )}
            {isEnsinoSuperior && (
              <Badge variant="secondary" className="text-xs font-normal">
                Ensino Superior
              </Badge>
            )}
          </div>
          <CardDescription className="text-sm">
            {isEnsinoSecundario
              ? "Selecione a classe, disciplina, professor e ano letivo para criar ou editar o plano"
              : "Selecione o curso, disciplina, professor, ano letivo e semestre antes de iniciar o planejamento"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Curso (Ensino Superior) ou Classe (Ensino Secundário) */}
            {isEnsinoSecundario ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Classe / Ano *</Label>
                <Select
                  value={context.classeId || ""}
                  onValueChange={(value) => {
                    const classeSelecionada = classes?.find((c: any) => String(c.id) === value);
                    const nomeClasse = classeSelecionada?.nome || "";
                    updateContext({
                      classeId: value,
                      classeOuAno: nomeClasse, // Auto-preencher: classeOuAno = nome da classe selecionada
                      disciplinaId: "",
                      turmaId: "",
                    });
                    // Invalidar query de disciplinas quando classe mudar para garantir recarregamento
                    queryClient.invalidateQueries({ 
                      queryKey: ["disciplinas-plano-ensino"],
                      exact: false 
                    });
                  }}
                  disabled={isLoadingClasses}
                >
                  <SelectTrigger className="w-full text-sm sm:text-base">
                    <SelectValue 
                      placeholder={
                        isLoadingClasses
                          ? "Carregando classes..."
                          : classes && classes.length === 0
                            ? "Nenhuma classe cadastrada"
                            : "Selecione a classe"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingClasses ? (
                      <SelectItem value="loading" disabled>
                        Carregando classes...
                      </SelectItem>
                    ) : classes && classes.length > 0 ? (
                      classes.map((classe: any) => (
                        <SelectItem key={classe.id} value={String(classe.id)}>
                          {classe.nome || String(classe.id)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="empty" disabled>
                        Nenhuma classe cadastrada
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {!isLoadingClasses && classes && classes.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Cadastre classes em <strong>Acadêmica → Classes</strong>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Curso *</Label>
                {/* Debug: Mostrar status da query */}
                {process.env.NODE_ENV === 'development' && (
                  <p className="text-xs text-muted-foreground">
                    Debug: enabled={cursosQueryEnabled ? 'true' : 'false'}, 
                    instituicaoId={instituicaoId ? 'ok' : 'missing'}, 
                    isSuperior={isEnsinoSuperior ? 'true' : 'false'}
                    {errorCursos && `, erro: ${errorCursos}`}
                  </p>
                )}
                <Select
                  value={context.cursoId || ""}
                  onValueChange={(value) => {
                    updateContext({
                      cursoId: value,
                      disciplinaId: "",
                      turmaId: "",
                    });
                    // Invalidar query de disciplinas quando curso mudar para garantir recarregamento
                    queryClient.invalidateQueries({ 
                      queryKey: ["disciplinas-plano-ensino"],
                      exact: false 
                    });
                  }}
                  disabled={isLoadingCursos}
                >
                  <SelectTrigger className="w-full text-sm sm:text-base">
                    <SelectValue 
                      placeholder={
                        isLoadingCursos 
                          ? "Carregando cursos..." 
                          : cursos && cursos.length === 0 
                            ? "Nenhum curso cadastrado"
                            : "Selecione o curso"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingCursos ? (
                      <SelectItem value="loading" disabled>
                        Carregando cursos...
                      </SelectItem>
                    ) : cursos && cursos.length > 0 ? (
                      cursos.map((curso: any) => (
                        <SelectItem key={curso.id} value={String(curso.id)}>
                          {curso.nome || String(curso.id)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="empty" disabled>
                        Nenhum curso cadastrado
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {errorCursos && (
                  <p className="text-xs text-destructive">
                    Erro ao carregar cursos. Verifique sua conexão e tente novamente.
                  </p>
                )}
                {!isLoadingCursos && !errorCursos && cursos && cursos.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Cadastre cursos em <strong>Acadêmica → Cursos</strong>
                  </p>
                )}
                {!cursosQueryEnabled && !isLoadingCursos && (
                  <p className="text-xs text-amber-600">
                    Aguardando identificação da instituição...
                  </p>
                )}
              </div>
            )}

            {/* Disciplina */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Disciplina *</Label>
              <Select
                value={context.disciplinaId || ""}
                onValueChange={(value) => {
                  updateContext({
                    disciplinaId: value,
                    turmaId: "",
                  });
                }}
                disabled={(!context.cursoId && !context.classeId) || isLoadingDisciplinas}
              >
                <SelectTrigger className="w-full text-sm sm:text-base">
                  <SelectValue 
                    placeholder={
                      isLoadingDisciplinas
                        ? "Carregando disciplinas..."
                        : !context.cursoId && !context.classeId
                          ? isEnsinoSuperior 
                            ? "Selecione um curso primeiro"
                            : isEnsinoSecundario
                              ? "Selecione uma classe primeiro"
                              : "Selecione curso ou classe primeiro"
                          : disciplinas && disciplinas.length === 0
                            ? errorDisciplinas
                              ? "Erro ao carregar disciplinas"
                              : isEnsinoSuperior
                                ? "Nenhuma disciplina vinculada ao curso"
                                : isEnsinoSecundario
                                  ? "Nenhuma disciplina vinculada à classe"
                                  : "Nenhuma disciplina encontrada"
                            : "Selecione a disciplina"
                    } 
                  />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingDisciplinas ? (
                    <SelectItem value="loading" disabled>
                      Carregando disciplinas...
                    </SelectItem>
                  ) : !context.cursoId && !context.classeId ? (
                    <SelectItem value="select-first" disabled>
                      {isEnsinoSuperior 
                        ? "Selecione um curso primeiro"
                        : isEnsinoSecundario
                          ? "Selecione uma classe primeiro"
                          : "Selecione curso ou classe primeiro"}
                    </SelectItem>
                  ) : errorDisciplinas ? (
                    <SelectItem value="error" disabled>
                      Erro ao carregar disciplinas. Tente novamente.
                    </SelectItem>
                  ) : disciplinas && disciplinas.length > 0 ? (
                    disciplinas.map((disciplina: any) => (
                      <SelectItem key={disciplina.id} value={String(disciplina.id)}>
                        {disciplina.nome || String(disciplina.id)}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="empty" disabled>
                      {errorDisciplinas 
                        ? "Erro ao carregar disciplinas" 
                        : "Nenhuma disciplina vinculada ao curso"}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {!isLoadingDisciplinas && !errorDisciplinas && disciplinas && disciplinas.length === 0 && (context.cursoId || context.classeId) && (
                <p className="text-xs text-muted-foreground">
                  {isEnsinoSuperior && context.cursoId
                    ? <>Nenhuma disciplina vinculada ao curso selecionado. Vincule disciplinas em <strong>Acadêmica → Cursos → [Curso] → Disciplinas</strong></>
                    : isEnsinoSecundario && context.classeId
                      ? <>Nenhuma disciplina cadastrada na instituição. Cadastre disciplinas em <strong>Acadêmica → Disciplinas</strong></>
                      : <>Nenhuma disciplina encontrada. Vincule disciplinas ao curso ou cadastre disciplinas na instituição.</>
                  }
                </p>
              )}
              {errorDisciplinas && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Erro ao carregar disciplinas. Verifique sua conexão e tente novamente.
                </p>
              )}
            </div>

            {/* Professor - Melhorado com busca */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Professor *</Label>
              {errorProfessores && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Erro ao carregar professores. Verifique sua conexão e tente novamente.
                </p>
              )}
              {!instituicaoId && user && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Aguardando identificação da instituição...
                </p>
              )}
              {!errorProfessores && instituicaoId && !loadingProfessores && professores && professores.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Nenhum professor cadastrado. Cadastre professores em Gestão de Professores primeiro.
                </p>
              )}
              {/* Usar sempre SearchableSelect para evitar perda de foco ao carregar (evita troca Select↔SearchableSelect) */}
              <SearchableSelect
                options={professoresOptions}
                value={context.professorId || ""}
                onValueChange={(value) => {
                  updateContext({ professorId: value });
                }}
                placeholder="Selecione o professor"
                searchPlaceholder="Buscar professor por nome ou email..."
                emptyMessage="Nenhum professor encontrado."
                loading={loadingProfessores}
                showCount={professoresOptions.length > 5}
                maxHeight="300px"
              />
            </div>

            {/* Ano Letivo - OBRIGATÓRIO para Plano de Ensino */}
            <AnoLetivoSelect
              value={context.anoLetivo}
              onValueChange={(ano) => {
                // Verificar se o ano realmente mudou
                const anoMudou = ano !== context.anoLetivo;
                
                // Buscar o ID correspondente ao ano selecionado
                const anoEncontrado = anosLetivos.find((al: any) => al.ano === ano);
                if (anoEncontrado) {
                  updateContext({ 
                    anoLetivo: ano,
                    anoLetivoId: anoEncontrado.id,
                    // Limpar semestre se o ano letivo mudou (semestres são específicos por ano)
                    ...(anoMudou && { semestre: undefined })
                  });
                  // Invalidar todas as queries de semestres para forçar recarregamento
                  if (anoMudou) {
                    queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'semestres' || query.queryKey[0] === 'semestres-plano-ensino' });
                  }
                } else {
                  // Se não encontrou, atualizar apenas o ano e tentar buscar o ID depois
                  updateContext({ 
                    anoLetivo: ano,
                    anoLetivoId: "", // Limpar ID se não encontrou correspondência
                    semestre: undefined // Limpar semestre também
                  });
                }
              }}
              onIdChange={(id) => {
                // Verificar se o ID realmente mudou
                const idMudou = id !== context.anoLetivoId;
                
                // CRÍTICO: Sempre atualizar o anoLetivoId quando o ID mudar
                // Buscar o ano correspondente ao ID
                const anoEncontrado = anosLetivos.find((al: any) => al.id === id);
                if (anoEncontrado) {
                  updateContext({ 
                    anoLetivoId: id,
                    anoLetivo: anoEncontrado.ano,
                    // Limpar semestre se o ano letivo mudou (semestres são específicos por ano)
                    ...(idMudou && { semestre: undefined })
                  });
                  // Invalidar todas as queries de semestres para forçar recarregamento
                  if (idMudou) {
                    queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'semestres' || query.queryKey[0] === 'semestres-plano-ensino' });
                  }
                } else {
                  // Se não encontrou, atualizar apenas o ID
                  updateContext({ 
                    anoLetivoId: id,
                    semestre: undefined // Limpar semestre também
                  });
                }
              }}
              label="Ano Letivo *"
              required
              disabled={anoLetivoProps.disabled}
              showStatus={true}
              className="w-full"
            />
            
            {/* Campos condicionais por tipo de instituição */}
            {/* Semestre (Ensino Superior) - Só mostrar se houver ano letivo selecionado */}
            {isEnsinoSuperior && (context.anoLetivoId || context.anoLetivo) && (
              <div className="space-y-2 w-full" key="semestre-field">
                <PeriodoAcademicoSelect
                  value={context.semestre?.toString() || ""}
                  onValueChange={(value) => {
                    // Usar valor numérico do semestre selecionado (vem do banco, não hardcoded)
                    if (value && value.trim() !== "") {
                      const semestreNum = Number(value);
                      if (!isNaN(semestreNum) && semestreNum > 0) {
                        updateContext({ semestre: semestreNum });
                      }
                    } else {
                      // Limpar semestre se valor vazio
                      updateContext({ semestre: undefined });
                    }
                  }}
                  anoLetivo={context.anoLetivo}
                  anoLetivoId={context.anoLetivoId}
                  label="Semestre *"
                  required
                  className="w-full"
                  useNumericValue={true}
                />
              </div>
            )}
            
            {/* Ensino Secundário: classeOuAno é preenchido automaticamente ao selecionar Classe (sem campo duplicado) */}

            {/* Turma (Opcional) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Turma (Opcional)</Label>
              <Select
                value={context.turmaId || "none"}
                onValueChange={(value) => {
                  updateContext({ turmaId: value === "none" ? "" : value });
                }}
                disabled={!context.disciplinaId || isLoadingTurmas}
              >
                <SelectTrigger className="w-full text-sm sm:text-base">
                  <SelectValue 
                    placeholder={
                      isLoadingTurmas
                        ? "Carregando turmas..."
                        : !context.disciplinaId
                          ? "Selecione uma disciplina primeiro"
                          : "Selecione a turma (opcional)"
                    } 
                  />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingTurmas ? (
                    <SelectItem value="loading" disabled>
                      Carregando turmas...
                    </SelectItem>
                  ) : (
                    <>
                      <SelectItem value="none">Nenhuma turma específica</SelectItem>
                      {turmas && turmas.length > 0 ? (
                        turmas.map((turma: any) => (
                          <SelectItem key={turma.id} value={String(turma.id)}>
                            {turma.nome || String(turma.id)}
                          </SelectItem>
                        ))
                      ) : context.disciplinaId ? (
                        <SelectItem value="no-turmas" disabled>
                          Nenhuma turma encontrada
                        </SelectItem>
                      ) : null}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!contextComplete && (
            <div className="mt-4 p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md flex items-start sm:items-center gap-2">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">
                  Preencha todos os campos obrigatórios para continuar:
                </p>
                <ul className="text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-0.5">
                  {!context.disciplinaId && <li>Disciplina (selecione uma disciplina)</li>}
                  {!context.professorId && <li>Professor (selecione um professor)</li>}
                  {(() => {
                    // Verificar se ano letivo ID está realmente faltando (considerar sincronização)
                    let anoLetivoIdFinal = context.anoLetivoId;
                    if (!anoLetivoIdFinal && context.anoLetivo && anosLetivos.length > 0) {
                      const anoEncontrado = anosLetivos.find((al: any) => al.ano === context.anoLetivo);
                      if (anoEncontrado) {
                        anoLetivoIdFinal = anoEncontrado.id;
                      }
                    }
                    // Só mostrar erro se realmente não houver ano letivo ID
                    if (!anoLetivoIdFinal) {
                      return <li>Ano Letivo (obrigatório para Plano de Ensino - selecione um ano letivo válido)</li>;
                    }
                    return null;
                  })()}
                  {(() => {
                    // Determinar tipo baseado no contexto se não estiver claro
                    const temCurso = !!context.cursoId;
                    const temClasse = !!context.classeId;
                    const isSuperiorContext = isEnsinoSuperior || (temCurso && !temClasse);
                    const isSecundarioContext = isEnsinoSecundario || (temClasse && !temCurso);
                    
                    if (isSuperiorContext) {
                      return (
                        <>
                          {!context.cursoId && <li>Curso (obrigatório para Ensino Superior - selecione um curso)</li>}
                          {context.cursoId && context.anoLetivoId && isLoadingSemestres && (
                            <li>Carregando semestres...</li>
                          )}
                          {context.cursoId && context.anoLetivoId && !isLoadingSemestres && semestres.length === 0 && !errorSemestres && (
                            <li>Semestre não configurado. Acesse <strong>Configuração de Ensino → Semestres</strong> para criar um semestre para o ano letivo selecionado.</li>
                          )}
                          {context.cursoId && errorSemestres && (
                            <li>Erro ao carregar semestres. Verifique sua conexão e tente novamente.</li>
                          )}
                          {context.cursoId && !isLoadingSemestres && semestres.length > 0 && !context.semestre && (
                            <li>Semestre (obrigatório: selecione um semestre cadastrado)</li>
                          )}
                          {context.cursoId && context.semestre && !isLoadingSemestres && semestres.length > 0 && (() => {
                            // Verificar se o semestre selecionado existe na lista
                            const semestreExiste = semestres.some((s: any) => {
                              const semestreNum = typeof context.semestre === 'string' ? Number(context.semestre) : context.semestre;
                              return s.numero === semestreNum || s.numero === context.semestre;
                            });
                            if (!semestreExiste) {
                              return <li>Semestre selecionado não existe. Selecione um semestre válido da lista (semestres disponíveis: {semestres.map((s: any) => s.numero).join(', ')})</li>;
                            }
                            return null;
                          })()}
                        </>
                      );
                    } else if (isSecundarioContext) {
                      return (
                        <>
                          {!context.classeId && <li>Classe (obrigatória - selecione uma classe acima)</li>}
                          {context.classeId && (!context.classeOuAno || context.classeOuAno.trim() === '') && <li>Classe/Ano (selecione novamente a classe - será preenchido automaticamente)</li>}
                        </>
                      );
                    }
                    return null;
                  })()}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aviso quando plano encontrado tem curso/classe/turma diferente */}
      {plano && (plano as any)._avisoDiferenca && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  Plano de Ensino encontrado
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {(plano as any)._avisoDiferenca}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status de Carga Horária */}
      {contextComplete && planoId && (
        <CargaHorariaStatusCard
          planoId={planoId}
          onAdicionarAula={() => {
            setActiveTab("planejar");
            setShouldOpenAulaDialog(true);
          }}
          bloqueado={plano?.bloqueado || false}
        />
      )}

      {/* Tabs do Workflow */}
      {contextComplete && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="apresentacao" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">1. Apresentação</span>
            </TabsTrigger>
            <TabsTrigger value="planejar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">2. Planejar</span>
            </TabsTrigger>
            <TabsTrigger value="executar" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">3. Executar</span>
            </TabsTrigger>
            <TabsTrigger value="gerenciar" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">4. Gerenciar</span>
            </TabsTrigger>
            <TabsTrigger value="finalizar" className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">5. Finalizar</span>
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
              shouldOpenAulaDialog={shouldOpenAulaDialog}
              onAulaDialogOpened={() => setShouldOpenAulaDialog(false)}
              onPlanoCreated={async () => {
                // Invalidar todas as queries relacionadas ao plano de ensino
                await queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
                // Forçar refetch da query específica do contexto para garantir sincronização
                await queryClient.refetchQueries({ 
                  queryKey: ["plano-ensino", context],
                  exact: true 
                });
                // Também chamar refetch diretamente para garantir atualização imediata
                await refetchPlano();
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
              permiteEdicao={!plano?.bloqueado && plano?.status !== 'APROVADO'}
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
  );
}

