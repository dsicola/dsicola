import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { videoAulasApi } from '@/services/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, Loader2, Play, BookOpen, DollarSign, Settings, HelpCircle, CheckCircle2, Clock } from 'lucide-react';
import { VideoPlayer } from '@/components/videoaulas/VideoPlayer';
import { cn } from '@/lib/utils';

type ModuloVideoAula = 'ACADEMICO' | 'FINANCEIRO' | 'CONFIGURACOES' | 'GERAL';

interface VideoAula {
  id: string;
  titulo: string;
  descricao?: string | null;
  urlVideo: string;
  tipoVideo: 'YOUTUBE' | 'VIMEO' | 'UPLOAD';
  modulo: ModuloVideoAula;
  perfilAlvo: string;
  tipoInstituicao: string;
  ordem: number;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface VideoAulaComProgresso extends VideoAula {
  progresso?: {
    assistido: boolean;
    percentualAssistido: number;
    ultimaVisualizacao: string | null;
  };
}

const getModuloIcon = (modulo: ModuloVideoAula) => {
  switch (modulo) {
    case 'ACADEMICO':
      return <BookOpen className="h-5 w-5" />;
    case 'FINANCEIRO':
      return <DollarSign className="h-5 w-5" />;
    case 'CONFIGURACOES':
      return <Settings className="h-5 w-5" />;
    case 'GERAL':
      return <HelpCircle className="h-5 w-5" />;
    default:
      return <Video className="h-5 w-5" />;
  }
};

const getModuloLabel = (modulo: ModuloVideoAula) => {
  switch (modulo) {
    case 'ACADEMICO':
      return 'Acadêmico';
    case 'FINANCEIRO':
      return 'Financeiro';
    case 'CONFIGURACOES':
      return 'Configurações';
    case 'GERAL':
      return 'Geral';
    default:
      return modulo;
  }
};

export default function VideoAulas() {
  const { data: videoAulas = [], isLoading: isLoadingAulas } = useQuery({
    queryKey: ['video-aulas'],
    queryFn: videoAulasApi.getAll,
  });

  const { data: progressos = {}, refetch: refetchProgressos } = useQuery({
    queryKey: ['video-aulas-progresso'],
    queryFn: videoAulasApi.getProgress,
  });

  // Combinar videoaulas com progresso
  const videoAulasComProgresso: VideoAulaComProgresso[] = useMemo(() => {
    return videoAulas.map((aula: VideoAula) => ({
      ...aula,
      progresso: progressos[aula.id] ? {
        assistido: progressos[aula.id].assistido,
        percentualAssistido: progressos[aula.id].percentualAssistido,
        ultimaVisualizacao: progressos[aula.id].ultimaVisualizacao
      } : undefined
    }));
  }, [videoAulas, progressos]);

  // Agrupar videoaulas por módulo (Acadêmico, Financeiro, Configurações, Geral)
  const MODULOS_VALIDOS: ModuloVideoAula[] = ['ACADEMICO', 'FINANCEIRO', 'CONFIGURACOES', 'GERAL'];
  const videoAulasPorModulo = useMemo(() => {
    const grupos: Record<ModuloVideoAula, VideoAulaComProgresso[]> = {
      ACADEMICO: [],
      FINANCEIRO: [],
      CONFIGURACOES: [],
      GERAL: [],
    };

    videoAulasComProgresso.forEach((videoAula: VideoAulaComProgresso) => {
      const modulo = (videoAula.modulo?.toUpperCase?.() || 'GERAL') as ModuloVideoAula;
      const destino = MODULOS_VALIDOS.includes(modulo) ? modulo : 'GERAL';
      grupos[destino].push(videoAula);
    });

    // Ordenar por ordem
    Object.keys(grupos).forEach((modulo) => {
      grupos[modulo as ModuloVideoAula].sort((a, b) => a.ordem - b.ordem);
    });

    return grupos;
  }, [videoAulasComProgresso]);

  const modulosComAulas = useMemo(() => {
    return (Object.keys(videoAulasPorModulo) as ModuloVideoAula[]).filter(
      (modulo) => videoAulasPorModulo[modulo].length > 0
    );
  }, [videoAulasPorModulo]);

  // Calcular estatísticas de progresso
  const estatisticas = useMemo(() => {
    const total = videoAulasComProgresso.length;
    const concluidas = videoAulasComProgresso.filter(a => a.progresso?.assistido).length;
    const percentualConcluido = total > 0 ? Math.round((concluidas / total) * 100) : 0;
    return { total, concluidas, percentualConcluido };
  }, [videoAulasComProgresso]);

  const getStatusIcon = (progresso?: VideoAulaComProgresso['progresso']) => {
    if (!progresso) {
      return null; // Não iniciada
    }
    if (progresso.assistido) {
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    }
    if (progresso.percentualAssistido > 0) {
      return <Clock className="h-4 w-4 text-yellow-600" />;
    }
    return null;
  };

  const getStatusLabel = (progresso?: VideoAulaComProgresso['progresso']) => {
    if (!progresso) {
      return 'Não iniciada';
    }
    if (progresso.assistido) {
      return 'Concluída';
    }
    if (progresso.percentualAssistido > 0) {
      return 'Em progresso';
    }
    return 'Não iniciada';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Video className="h-8 w-8" />
            Videoaulas de Treinamento
          </h1>
          <p className="text-muted-foreground mt-2">
            Aprenda a usar o sistema com videoaulas explicativas
          </p>
        </div>

        {/* Dashboard de Progresso */}
        {estatisticas.total > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Meu Progresso</CardTitle>
              <CardDescription>
                Acompanhe seu progresso nas videoaulas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {estatisticas.concluidas} de {estatisticas.total} videoaulas concluídas
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {estatisticas.percentualConcluido}%
                  </span>
                </div>
                <Progress value={estatisticas.percentualConcluido} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {isLoadingAulas ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : videoAulas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhuma videoaula disponível</p>
              <p className="text-sm text-muted-foreground mt-2">
                Não há videoaulas disponíveis para seu perfil no momento.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue={modulosComAulas[0] || 'GERAL'} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              {modulosComAulas.map((modulo) => (
                <TabsTrigger key={modulo} value={modulo} className="flex items-center gap-2">
                  {getModuloIcon(modulo)}
                  <span className="hidden sm:inline">{getModuloLabel(modulo)}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {videoAulasPorModulo[modulo].length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {modulosComAulas.map((modulo) => (
              <TabsContent key={modulo} value={modulo} className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {getModuloIcon(modulo)}
                      {getModuloLabel(modulo)}
                    </CardTitle>
                    <CardDescription>
                      {videoAulasPorModulo[modulo].length} videoaula
                      {videoAulasPorModulo[modulo].length !== 1 ? 's' : ''} disponível
                      {videoAulasPorModulo[modulo].length !== 1 ? 'eis' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {videoAulasPorModulo[modulo].map((videoAula) => (
                        <Card key={videoAula.id} className="overflow-hidden">
                          <div className="relative aspect-video bg-muted">
                            <VideoPlayer 
                              videoAula={videoAula}
                              onProgressUpdate={() => refetchProgressos()}
                            />
                          </div>
                          <CardHeader>
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-lg flex-1">{videoAula.titulo}</CardTitle>
                              {getStatusIcon(videoAula.progresso)}
                            </div>
                            {videoAula.descricao && (
                              <CardDescription>{videoAula.descricao}</CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{getStatusLabel(videoAula.progresso)}</span>
                              {videoAula.progresso && videoAula.progresso.percentualAssistido > 0 && (
                                <span>{videoAula.progresso.percentualAssistido}%</span>
                              )}
                            </div>
                            {videoAula.progresso && videoAula.progresso.percentualAssistido > 0 && (
                              <Progress 
                                value={videoAula.progresso.percentualAssistido} 
                                className="h-1.5"
                              />
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
