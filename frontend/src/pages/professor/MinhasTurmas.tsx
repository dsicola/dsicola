import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { turmasApi, matriculasApi, aulasApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, Users, BookOpen, Sun, Sunset, Moon, Clock, 
  ChevronRight, GraduationCap, Calendar, ClipboardCheck 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MinhasTurmas() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isSecundario } = useInstituicao();
  const navigate = useNavigate();

  // Fetch turmas do professor
  // REGRA ABSOLUTA: Usar GET /turmas/professor SEM enviar professorId, instituicaoId ou anoLetivoId
  // O backend extrai professorId, instituicaoId e tipoAcademico automaticamente do JWT (req.user)
  // IMPORTANTE: Filtrar disciplinas sem turma - esta página mostra apenas turmas vinculadas
  const { data: turmasData, isLoading: turmasLoading } = useQuery({
    queryKey: ['professor-turmas-full', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return { anoLetivo: null, turmas: [], disciplinasSemTurma: [] };
      }
      
      // REGRA ABSOLUTA: NÃO enviar professorId - o backend extrai do JWT
      // Usar método específico getTurmasProfessor que não aceita IDs sensíveis
      const data = await turmasApi.getTurmasProfessor({ incluirPendentes: true });
      
      // Backend retorna formato padronizado { anoLetivo, turmas: [], disciplinasSemTurma: [] }
      return data || { anoLetivo: null, turmas: [], disciplinasSemTurma: [] };
    },
    enabled: !!user?.id
  });

  // Filtrar apenas turmas (excluir disciplinas sem turma)
  // REGRA: Esta página mostra apenas turmas vinculadas (disciplinas sem turma são mostradas no dashboard)
  // REGRA ABSOLUTA: Backend já retorna turmas e disciplinasSemTurma separados
  const turmas = useMemo(() => {
    if (!turmasData) return [];
    return turmasData.turmas || [];
  }, [turmasData]);

  // Fetch alunos por turma usando rota específica do professor
  const { data: alunosPorTurma = {} } = useQuery({
    queryKey: ['professor-alunos-turmas', turmas],
    queryFn: async () => {
      if (turmas.length === 0) return {};
      const turmaIds = turmas.map((t: any) => t.id);
      
      const grouped: Record<string, any[]> = {};
      
      for (const turmaId of turmaIds) {
        try {
          const response = await matriculasApi.getAlunosByTurmaProfessor(turmaId);
          // A resposta vem no formato { turma: {...}, alunos: [...] }
          grouped[turmaId] = response?.alunos || [];
        } catch (error) {
          console.error(`Erro ao buscar alunos da turma ${turmaId}:`, error);
          grouped[turmaId] = [];
        }
      }
      
      return grouped;
    },
    enabled: turmas.length > 0
  });

  // Fetch aulas por turma
  const { data: aulasPorTurma = {} } = useQuery({
    queryKey: ['professor-aulas-turmas', turmas],
    queryFn: async () => {
      if (turmas.length === 0) return {};
      const turmaIds = turmas.map((t: any) => t.id);
      
      const grouped: Record<string, any[]> = {};
      
      for (const turmaId of turmaIds) {
        const aulas = await aulasApi.getAll({ turmaId });
        grouped[turmaId] = aulas || [];
      }
      
      return grouped;
    },
    enabled: turmas.length > 0
  });

  const getTurnoIcon = (turno: string | { nome?: string } | null) => {
    const turnoNome = typeof turno === 'string' ? turno : turno?.nome;
    if (!turnoNome) return <Clock className="h-4 w-4 text-muted-foreground" />;
    
    switch (turnoNome.toLowerCase()) {
      case 'manhã':
      case 'manha':
        return <Sun className="h-4 w-4 text-yellow-500" />;
      case 'tarde':
        return <Sunset className="h-4 w-4 text-orange-500" />;
      case 'noite':
        return <Moon className="h-4 w-4 text-indigo-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTurnoBadgeVariant = (turno: string | { nome?: string } | null): "default" | "secondary" | "outline" => {
    const turnoNome = typeof turno === 'string' ? turno : turno?.nome;
    if (!turnoNome) return "secondary";
    
    switch (turnoNome.toLowerCase()) {
      case 'manhã':
      case 'manha':
        return "default";
      case 'tarde':
        return "secondary";
      case 'noite':
        return "outline";
      default:
        return "secondary";
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return '-';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('pages.minhasTurmas')}</h1>
            <p className="text-muted-foreground">
              {t('pages.minhasTurmasDesc')}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/painel-professor/frequencia')}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Frequência
            </Button>
            <Button onClick={() => navigate('/painel-professor/notas')}>
              <GraduationCap className="mr-2 h-4 w-4" />
              Notas
            </Button>
          </div>
        </div>

        {turmasLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : turmas.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma turma atribuída</h3>
                <p className="text-muted-foreground">
                  Você ainda não possui turmas atribuídas. Contacte a administração.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue={turmas[0]?.id} className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-1">
              {turmas.map((turma: any) => (
                <TabsTrigger key={turma.id} value={turma.id} className="gap-2">
                  {getTurnoIcon(turma.turno)}
                  {turma.nome}
                </TabsTrigger>
              ))}
            </TabsList>

            {turmas.map((turma: any) => {
              const alunos = alunosPorTurma[turma.id] || [];
              const aulas = aulasPorTurma[turma.id] || [];
              
              return (
                <TabsContent key={turma.id} value={turma.id} className="space-y-6">
                  {/* Info da Turma */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-3">
                            {getTurnoIcon(turma.turno)}
                            {turma.nome}
                            <Badge variant={getTurnoBadgeVariant(turma.turno)}>
                              {typeof turma.turno === 'object' ? turma.turno?.nome : turma.turno || 'N/A'}
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            {turma.cursos?.nome} ({turma.cursos?.codigo}) • {turma.ano}{!isSecundario && `/${turma.semestre}`}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{alunos.length}</p>
                          <p className="text-xs text-muted-foreground">alunos matriculados</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-muted/50 rounded-lg text-center">
                          <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                          <p className="text-xl font-bold">{alunos.length}</p>
                          <p className="text-xs text-muted-foreground">Alunos</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg text-center">
                          <Calendar className="h-6 w-6 mx-auto mb-2 text-primary" />
                          <p className="text-xl font-bold">{aulas.length}</p>
                          <p className="text-xs text-muted-foreground">Aulas</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg text-center">
                          <Clock className="h-6 w-6 mx-auto mb-2 text-primary" />
                          <p className="text-sm font-medium">{turma.horario || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">Horário</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg text-center">
                          <BookOpen className="h-6 w-6 mx-auto mb-2 text-primary" />
                          <p className="text-sm font-medium">{turma.sala || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">Sala</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Lista de Alunos */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Alunos Matriculados ({alunos.length})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {alunos.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">
                            Nenhum aluno matriculado nesta turma.
                          </p>
                        ) : (
                          <div className="max-h-[400px] overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nome</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Telefone</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {alunos.map((aluno: any) => (
                                  <TableRow key={aluno.id || aluno.matriculaId}>
                                    <TableCell className="font-medium">
                                      {aluno.nomeCompleto || aluno.nome_completo || '-'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {aluno.email || '-'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {aluno.numeroIdentificacaoPublica || aluno.numero_identificacao_publica || '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Últimas Aulas */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Últimas Aulas ({aulas.length})</CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => navigate('/painel-professor/frequencia')}
                        >
                          Nova Aula <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {aulas.length === 0 ? (
                          <div className="text-center py-4">
                            <p className="text-muted-foreground">Nenhuma aula registrada.</p>
                            <Button 
                              variant="link" 
                              className="mt-2"
                              onClick={() => navigate('/painel-professor/frequencia')}
                            >
                              Registrar primeira aula
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {aulas.slice(0, 10).map((aula: any) => (
                              <div 
                                key={aula.id} 
                                className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
                              >
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                  <Calendar className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{formatDate(aula.data)}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {aula.conteudo || 'Sem conteúdo registrado'}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
