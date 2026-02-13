import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { treinamentoApi, onboardingApi, videoAulasApi } from '@/services/api';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { VideoPlayer } from '@/components/videoaulas/VideoPlayer';
import { 
  Loader2, 
  CheckCircle2, 
  Clock, 
  Circle, 
  Play, 
  GraduationCap,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface AulaTrilha {
  id: string;
  ordem: number;
  videoAula: {
    id: string;
    titulo: string;
    descricao?: string | null;
    urlVideo: string;
    tipoVideo: 'YOUTUBE' | 'VIMEO' | 'UPLOAD';
  };
  progresso: {
    assistido: boolean;
    percentualAssistido: number;
    ultimaVisualizacao: string | null;
  } | null;
}

interface TrilhaData {
  trilha: {
    id: string;
    nome: string;
    descricao?: string | null;
    perfil: string;
  } | null;
  aulas: AulaTrilha[];
  progresso: {
    totalAulas: number;
    aulasConcluidas: number;
    percentualConcluido: number;
    podeFinalizar: boolean;
  };
}

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [aulaSelecionada, setAulaSelecionada] = useState<string | null>(null);

  // Buscar trilha atual
  const { data: trilhaData, isLoading: isLoadingTrilha } = useQuery<TrilhaData>({
    queryKey: ['trilha-atual'],
    queryFn: treinamentoApi.getTrilhaAtual,
  });

  // Buscar status do onboarding
  const { data: onboardingStatus } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: onboardingApi.getStatus,
  });

  // Mutation para finalizar onboarding - protegida contra unmount
  const finalizarMutation = useSafeMutation({
    mutationFn: onboardingApi.finalizar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      toast({
        title: "Onboarding concluído!",
        description: "Bem-vindo ao DSICOLA. Você agora tem acesso completo ao sistema.",
      });
      // Redirecionar para dashboard baseado no perfil
      const userRole = role || 'ADMIN';
      switch (userRole) {
        case 'ADMIN':
          navigate('/admin-dashboard');
          break;
        case 'PROFESSOR':
          navigate('/painel-professor');
          break;
        case 'SECRETARIA':
          navigate('/secretaria-dashboard');
          break;
        default:
          navigate('/admin-dashboard');
      }
    },
    onError: (error: any) => {
      // Se não houver trilha, não mostrar erro, apenas redirecionar
      if (!trilhaData?.trilha) {
        const userRole = role || 'ADMIN';
        switch (userRole) {
          case 'ADMIN':
            navigate('/admin-dashboard');
            break;
          case 'PROFESSOR':
            navigate('/painel-professor');
            break;
          case 'SECRETARIA':
            navigate('/secretaria-dashboard');
            break;
          default:
            navigate('/admin-dashboard');
        }
        return;
      }
      toast({
        title: "Erro ao finalizar onboarding",
        description: error?.response?.data?.message || "Você precisa assistir pelo menos 90% das aulas obrigatórias.",
        variant: "destructive",
      });
    },
  });

  // Auto-finalizar onboarding se não houver trilha disponível
  useEffect(() => {
    // Verificar se não está carregando, não há trilha, e onboarding não está concluído
    const shouldAutoFinalize = !isLoadingTrilha && 
                                !trilhaData?.trilha && 
                                (onboardingStatus?.concluido === false || onboardingStatus?.concluido === undefined) &&
                                !finalizarMutation.isPending;
    
    if (shouldAutoFinalize) {
      // Finalizar onboarding automaticamente se não houver trilha
      finalizarMutation.mutate(undefined);
    }
  }, [isLoadingTrilha, trilhaData, onboardingStatus, finalizarMutation]);

  const getStatusIcon = (progresso: AulaTrilha['progresso']) => {
    if (!progresso || progresso.percentualAssistido === 0) {
      return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
    if (progresso.percentualAssistido >= 90) {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }
    return <Clock className="h-5 w-5 text-yellow-600" />;
  };

  const getStatusLabel = (progresso: AulaTrilha['progresso']) => {
    if (!progresso || progresso.percentualAssistido === 0) {
      return 'Não iniciada';
    }
    if (progresso.percentualAssistido >= 90) {
      return 'Concluída';
    }
    return 'Em progresso';
  };

  const getStatusBadge = (progresso: AulaTrilha['progresso']) => {
    if (!progresso || progresso.percentualAssistido === 0) {
      return <Badge variant="outline">⭕ Não iniciada</Badge>;
    }
    if (progresso.percentualAssistido >= 90) {
      return <Badge className="bg-green-100 text-green-800">✔️ Concluída</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800">⏳ Em progresso</Badge>;
  };

  if (isLoadingTrilha) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando trilha de treinamento...</p>
        </div>
      </div>
    );
  }

  if (!trilhaData?.trilha) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Nenhuma trilha disponível
            </CardTitle>
            <CardDescription>
              Não há trilha de treinamento configurada para o seu perfil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => {
                // Finalizar onboarding antes de redirecionar
                finalizarMutation.mutate(undefined, {
                  onSuccess: () => {
                    // Redirecionar baseado no perfil
                    const userRole = role || 'ADMIN';
                    switch (userRole) {
                      case 'ADMIN':
                        navigate('/admin-dashboard');
                        break;
                      case 'PROFESSOR':
                        navigate('/painel-professor');
                        break;
                      case 'SECRETARIA':
                        navigate('/secretaria-dashboard');
                        break;
                      default:
                        navigate('/admin-dashboard');
                    }
                  },
                  onError: () => {
                    // Mesmo se falhar, tentar redirecionar baseado no perfil
                    const userRole = role || 'ADMIN';
                    switch (userRole) {
                      case 'ADMIN':
                        navigate('/admin-dashboard');
                        break;
                      case 'PROFESSOR':
                        navigate('/painel-professor');
                        break;
                      case 'SECRETARIA':
                        navigate('/secretaria-dashboard');
                        break;
                      default:
                        navigate('/admin-dashboard');
                    }
                  }
                });
              }}
              className="w-full"
              disabled={finalizarMutation.isPending}
            >
              {finalizarMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finalizando...
                </>
              ) : (
                'Continuar para o sistema'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { trilha, aulas, progresso } = trilhaData;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Onboarding Obrigatório</h1>
          </div>
          <p className="text-muted-foreground">
            Complete o treinamento para ter acesso completo ao sistema
          </p>
        </div>

        {/* Card da Trilha */}
        <Card>
          <CardHeader>
            <CardTitle>{trilha.nome}</CardTitle>
            {trilha.descricao && (
              <CardDescription>{trilha.descricao}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Barra de Progresso Geral */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Progresso Geral</span>
                <span className="text-sm font-semibold">
                  {progresso.aulasConcluidas} de {progresso.totalAulas} aulas concluídas
                </span>
              </div>
              <Progress value={progresso.percentualConcluido} className="h-3" />
              <p className="text-xs text-muted-foreground text-center">
                {progresso.percentualConcluido}% concluído
              </p>
            </div>

            {/* Lista de Aulas */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Aulas da Trilha</h3>
              {aulas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma aula configurada nesta trilha.
                </p>
              ) : (
                <div className="space-y-2">
                  {aulas.map((aula) => (
                    <Card
                      key={aula.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        aulaSelecionada === aula.videoAula.id && "ring-2 ring-primary"
                      )}
                      onClick={() => setAulaSelecionada(aula.videoAula.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 mt-1">
                            {getStatusIcon(aula.progresso)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <h4 className="font-medium">{aula.videoAula.titulo}</h4>
                                {aula.videoAula.descricao && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {aula.videoAula.descricao}
                                  </p>
                                )}
                              </div>
                              <div className="flex-shrink-0">
                                {getStatusBadge(aula.progresso)}
                              </div>
                            </div>
                            {aula.progresso && aula.progresso.percentualAssistido > 0 && (
                              <div className="mt-2 space-y-1">
                                <Progress 
                                  value={aula.progresso.percentualAssistido} 
                                  className="h-1.5"
                                />
                                <p className="text-xs text-muted-foreground">
                                  {aula.progresso.percentualAssistido}% assistido
                                </p>
                              </div>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAulaSelecionada(aula.videoAula.id);
                            }}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Assistir
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Botão Finalizar */}
            {progresso.podeFinalizar && (
              <div className="pt-4 border-t">
                <Button
                  onClick={() => finalizarMutation.mutate()}
                  disabled={finalizarMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {finalizarMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Finalizando...
                    </>
                  ) : (
                    <>
                      Finalizar Onboarding
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Você completou todas as aulas obrigatórias. Clique para finalizar e acessar o sistema.
                </p>
              </div>
            )}

            {!progresso.podeFinalizar && progresso.totalAulas > 0 && (
              <div className="pt-4 border-t">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>Atenção:</strong> Você precisa assistir pelo menos 90% das aulas obrigatórias 
                    ({progresso.aulasConcluidas}/{progresso.totalAulas} concluídas) para finalizar o onboarding.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Player de Vídeo (Modal/Drawer) */}
        {aulaSelecionada && (
          <Card className="sticky top-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {aulas.find(a => a.videoAula.id === aulaSelecionada)?.videoAula.titulo}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAulaSelecionada(null)}
                >
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <VideoPlayer
                  videoAula={aulas.find(a => a.videoAula.id === aulaSelecionada)!.videoAula}
                  onProgressUpdate={() => {
                    queryClient.invalidateQueries({ queryKey: ['trilha-atual'] });
                    queryClient.invalidateQueries({ queryKey: ['video-aulas-progresso'] });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

