/**
 * Relatórios do Professor - Padrão SIGAE
 *
 * O professor pode:
 * - Emitir pauta da disciplina/turma (para impressão/assinatura)
 * - Relatório de frequência (mapa de presenças)
 * - Lista de alunos
 * - Boletim por aluno (conforme permissões)
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useAnoLetivoAtivo } from '@/hooks/useAnoLetivoAtivo';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { turmasApi, matriculasApi, relatoriosApi, relatoriosOficiaisApi } from '@/services/api';
import {
  FileText,
  Users,
  ClipboardList,
  Download,
  Loader2,
  AlertCircle,
  BookOpen,
  Printer,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PautaVisualizacao } from '@/components/relatorios/PautaVisualizacao';
import { BoletimVisualizacao } from '@/components/relatorios/BoletimVisualizacao';

export default function ProfessorRelatorios() {
  const { user } = useAuth();
  const { anoLetivo, anoLetivoId } = useAnoLetivoAtivo();
  const queryClient = useQueryClient();
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('');
  const [selectedAlunoId, setSelectedAlunoId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('pauta');

  // Turmas do professor
  const { data: turmasData, isLoading: turmasLoading } = useQuery({
    queryKey: ['professor-turmas-relatorios', user?.id, anoLetivoId],
    queryFn: async () => {
      if (!user?.id) return { anoLetivo: null, turmas: [], disciplinasSemTurma: [] };
      const data = await turmasApi.getTurmasProfessor({
        incluirPendentes: true,
        anoLetivoId: anoLetivoId || undefined,
      });
      return data || { anoLetivo: null, turmas: [], disciplinasSemTurma: [] };
    },
    enabled: !!user?.id,
  });

  const turmas = useMemo(() => turmasData?.turmas || [], [turmasData]);
  const turmaSelecionada = turmas.find((t: any) => (t.id || t.turmaId) === selectedTurmaId);
  const planoEnsinoId = turmaSelecionada?.planoEnsinoId;

  // Alunos da turma selecionada
  const { data: alunosData = [] } = useQuery({
    queryKey: ['professor-alunos-turma', selectedTurmaId],
    queryFn: async () => {
      if (!selectedTurmaId) return [];
      try {
        const res = await matriculasApi.getAlunosByTurmaProfessor(selectedTurmaId);
        return res?.alunos || [];
      } catch {
        return [];
      }
    },
    enabled: !!selectedTurmaId,
  });

  // Gerar mapa de presenças (relatório de frequência)
  const mapaPresencasMutation = useMutation({
    mutationFn: async () => {
      if (!planoEnsinoId) throw new Error('Selecione uma turma');
      return relatoriosApi.gerar({
        tipoRelatorio: 'MAPA_PRESENCAS',
        referenciaId: planoEnsinoId,
      });
    },
    onSuccess: async (data) => {
      if (data?.id) {
        try {
          const blob = await relatoriosApi.download(data.id);
          const url = window.URL.createObjectURL(new Blob([blob]));
          const a = document.createElement('a');
          a.href = url;
          a.download = `mapa-presencas-${planoEnsinoId}-${Date.now()}.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
          toast({ title: 'Sucesso', description: 'Relatório de frequência gerado' });
        } catch (e) {
          toast({ title: 'Erro', description: 'Não foi possível baixar o PDF', variant: 'destructive' });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['relatorios'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Erro',
        description: err?.response?.data?.message || 'Erro ao gerar relatório',
        variant: 'destructive',
      });
    },
  });

  if (turmasLoading) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (turmas.length === 0) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Relatórios
            </CardTitle>
            <CardDescription>Emita pautas, boletins e relatórios de frequência</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Nenhuma turma atribuída</AlertTitle>
              <AlertDescription>
                Você ainda não possui turmas atribuídas. Os relatórios ficam disponíveis quando houver
                um Plano de Ensino APROVADO com turma vinculada.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7" />
            Relatórios
          </h1>
          <p className="text-muted-foreground mt-1">
            Pauta da disciplina/turma, relatório de frequência, lista de alunos e boletins
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selecione a turma</CardTitle>
            <CardDescription>
              Escolha a turma para gerar a pauta, mapa de presenças ou lista de alunos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Selecione uma turma" />
              </SelectTrigger>
              <SelectContent>
                {turmas.map((t: any) => {
                  const tid = t.id || t.turmaId;
                  return (
                    <SelectItem key={tid} value={tid}>
                      {t.disciplinaNome || t.disciplina?.nome} – {t.nome}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {turmaSelecionada && (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="pauta">
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Pauta
                  </TabsTrigger>
                  <TabsTrigger value="frequencia">
                    <Users className="h-4 w-4 mr-2" />
                    Frequência
                  </TabsTrigger>
                  <TabsTrigger value="lista">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Lista de Alunos
                  </TabsTrigger>
                  <TabsTrigger value="boletim">
                    <FileText className="h-4 w-4 mr-2" />
                    Boletim
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pauta" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Pauta da disciplina/turma</CardTitle>
                      <CardDescription>
                        Notas e frequência dos alunos para impressão e assinatura
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PautaVisualizacao planoEnsinoId={planoEnsinoId} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="frequencia" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Relatório de frequência</CardTitle>
                      <CardDescription>
                        Mapa de presenças com percentual por aluno
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={() => mapaPresencasMutation.mutate()}
                        disabled={mapaPresencasMutation.isPending || !planoEnsinoId}
                      >
                        {mapaPresencasMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Gerar mapa de presenças (PDF)
                      </Button>
                      {(turmaSelecionada?.planoEstado !== 'APROVADO' || turmaSelecionada?.planoBloqueado) && (
                        <Alert className="mt-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            O Plano de Ensino deve estar APROVADO para gerar o relatório de frequência.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="lista" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Lista de alunos</CardTitle>
                      <CardDescription>Alunos matriculados nesta turma</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {alunosData.length === 0 ? (
                        <p className="text-muted-foreground">Nenhum aluno matriculado nesta turma.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Nome</TableHead>
                              <TableHead>Nº Identificação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {alunosData.map((aluno: any, idx: number) => (
                              <TableRow key={aluno.id}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell>{aluno.nomeCompleto || aluno.nome || aluno.email}</TableCell>
                                <TableCell>{aluno.numeroIdentificacao || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="boletim" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Boletim do aluno</CardTitle>
                      <CardDescription>
                        Seleccione um aluno para visualizar o boletim (notas e frequência)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Select value={selectedAlunoId} onValueChange={setSelectedAlunoId}>
                        <SelectTrigger className="max-w-md">
                          <SelectValue placeholder="Selecione um aluno" />
                        </SelectTrigger>
                        <SelectContent>
                          {alunosData.map((aluno: any) => (
                            <SelectItem key={aluno.id} value={aluno.id}>
                              {aluno.nomeCompleto || aluno.nome || aluno.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedAlunoId && (
                        <BoletimVisualizacao
                          alunoId={selectedAlunoId}
                          anoLetivoId={anoLetivoId || undefined}
                          anoLetivo={anoLetivo || new Date().getFullYear()}
                        />
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
