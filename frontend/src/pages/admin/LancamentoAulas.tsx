import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aulasLancadasApi, cursosApi, classesApi, disciplinasApi, professorsApi, turmasApi, anoLetivoApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, BookOpen, Calendar, CheckCircle2, Clock, AlertCircle, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useInstituicao } from "@/contexts/InstituicaoContext";

interface LancamentoAulasContext {
  cursoId?: string;
  classeId?: string;
  disciplinaId?: string;
  professorId?: string;
  anoLetivo?: number;
  turmaId?: string;
}

interface AulaPlanejada {
  id: string;
  ordem: number;
  titulo: string;
  descricao?: string;
  tipo: string;
  trimestre: number;
  quantidadeAulas: number;
  status: string;
  dataMinistrada?: string;
  totalLancado: number;
  lancamentos: Array<{
    id: string;
    data: string;
    observacoes?: string;
  }>;
}

export default function LancamentoAulas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { tipoAcademico, isSuperior, isSecundario } = useInstituicao();

  const [context, setContext] = useState<LancamentoAulasContext>({
    cursoId: "",
    classeId: "",
    disciplinaId: "",
    professorId: "",
    anoLetivo: new Date().getFullYear(),
    turmaId: "",
  });

  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [selectedAula, setSelectedAula] = useState<AulaPlanejada | null>(null);
  const [dataLancamento, setDataLancamento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Buscar cursos (Ensino Superior) ou classes (Ensino Médio)
  const { data: cursos } = useQuery({
    queryKey: ["cursos-lancamento", instituicaoId],
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
    queryKey: ["classes-lancamento", instituicaoId],
    queryFn: async () => {
      if (isSecundario) {
        return await classesApi.getAll({ ativo: true });
      }
      return [];
    },
    enabled: isSecundario && !!instituicaoId,
  });

  // Buscar disciplinas baseado no curso/classe selecionado
  const { data: disciplinas } = useQuery({
    queryKey: ["disciplinas-lancamento", context.cursoId, context.classeId],
    queryFn: async () => {
      const params: any = { ativo: true };
      if (context.cursoId) params.cursoId = context.cursoId;
      if (context.classeId) params.classeId = context.classeId;
      return await disciplinasApi.getAll(params);
    },
    enabled: !!(context.cursoId || context.classeId),
  });

  // Buscar professores (tabela professores - professores.id)
  const { data: professores } = useQuery({
    queryKey: ["professores-lancamento", instituicaoId],
    queryFn: async () => {
      const data = await professorsApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!instituicaoId,
  });

  // Buscar turmas
  const { data: turmas } = useQuery({
    queryKey: ["turmas-lancamento", context.cursoId, context.classeId, context.disciplinaId],
    queryFn: async () => {
      const params: any = {};
      if (context.cursoId) params.cursoId = context.cursoId;
      if (context.classeId) params.classeId = context.classeId;
      if (context.disciplinaId) params.disciplinaId = context.disciplinaId;
      return await turmasApi.getAll(params);
    },
    enabled: !!(context.cursoId || context.classeId) && !!context.disciplinaId,
  });

  // Buscar anos letivos
  const { data: anosLetivos = [], isLoading: isLoadingAnosLetivos } = useQuery({
    queryKey: ["anos-letivos-lancamento-aulas", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  // Buscar aulas planejadas
  const { data: aulasPlanejadas = [], isLoading: loadingAulas } = useQuery({
    queryKey: ["aulas-planejadas", context],
    queryFn: async () => {
      if (!context.disciplinaId || !context.professorId || !context.anoLetivo) {
        return [];
      }
      return await aulasLancadasApi.getAulasPlanejadas({
        cursoId: context.cursoId || undefined,
        classeId: context.classeId || undefined,
        disciplinaId: context.disciplinaId,
        professorId: context.professorId,
        anoLetivo: context.anoLetivo,
        turmaId: context.turmaId || undefined,
      });
    },
    enabled: !!(context.disciplinaId && context.professorId && context.anoLetivo),
  });

  const contextComplete = !!(context.disciplinaId && context.professorId && context.anoLetivo);

  // Mutation para criar lançamento
  const createLancamentoMutation = useMutation({
    mutationFn: (data: { planoAulaId: string; data: string; observacoes?: string }) =>
      aulasLancadasApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aulas-planejadas"] });
      toast({
        title: "Sucesso",
        description: "Aula lançada com sucesso",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || "Erro ao lançar aula",
        variant: "destructive",
      });
    },
  });

  // Mutation para remover lançamento
  const deleteLancamentoMutation = useMutation({
    mutationFn: (lancamentoId: string) => aulasLancadasApi.delete(lancamentoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aulas-planejadas"] });
      toast({
        title: "Sucesso",
        description: "Lançamento removido com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || "Erro ao remover lançamento",
        variant: "destructive",
      });
    },
  });

  const handleAbrirDialog = (aula: AulaPlanejada) => {
    setSelectedAula(aula);
    setDataLancamento(new Date().toISOString().split('T')[0]);
    setObservacoes("");
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedAula(null);
    setDataLancamento("");
    setObservacoes("");
  };

  const handleConfirmarLancamento = () => {
    if (!selectedAula || !dataLancamento) {
      toast({
        title: "Erro",
        description: "Data é obrigatória",
        variant: "destructive",
      });
      return;
    }

    createLancamentoMutation.mutate({
      planoAulaId: selectedAula.id,
      data: dataLancamento,
      observacoes: observacoes || undefined,
    });
  };

  const handleRemoverLancamento = (lancamentoId: string) => {
    if (confirm("Deseja realmente remover este lançamento?")) {
      deleteLancamentoMutation.mutate(lancamentoId);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
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
              <BookOpen className="h-8 w-8" />
              Lançamento de Aulas
            </h1>
            <p className="text-muted-foreground">Registre a execução real das aulas planejadas</p>
          </div>
        </div>

        {/* Contexto Obrigatório */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Contexto do Lançamento
            </CardTitle>
            <CardDescription>
              Selecione o contexto antes de lançar aulas
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
                      {classes?.filter((classe: any) => classe?.id).map((classe: any) => (
                        <SelectItem key={classe.id} value={String(classe.id)}>
                          {classe.nome}
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
                      {cursos?.filter((curso: any) => curso?.id).map((curso: any) => (
                        <SelectItem key={curso.id} value={String(curso.id)}>
                          {curso.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Disciplina */}
              <div className="space-y-2">
                <Label>Disciplina *</Label>
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
                    {disciplinas?.filter((disciplina: any) => disciplina?.id).map((disciplina: any) => (
                      <SelectItem key={disciplina.id} value={String(disciplina.id)}>
                        {disciplina.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Professor */}
              <div className="space-y-2">
                <Label>Professor *</Label>
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
                    {professores?.filter((prof: any) => prof?.id).map((prof: any) => (
                      <SelectItem key={prof.id} value={String(prof.id)}>
                        {prof.nome_completo || prof.nomeCompleto || prof.email || String(prof.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ano Letivo */}
              <div className="space-y-2">
                <Label>Ano Letivo *</Label>
                <Select
                  value={context.anoLetivo?.toString() || ""}
                  onValueChange={(value) => {
                    const anoSelecionado = anosLetivos.find((al: any) => al.ano.toString() === value);
                    setContext((prev) => ({ 
                      ...prev, 
                      anoLetivo: anoSelecionado ? anoSelecionado.ano : Number(value) 
                    }));
                  }}
                  disabled={isLoadingAnosLetivos || anosLetivos.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano letivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingAnosLetivos ? (
                      <SelectItem value="loading" disabled>Carregando...</SelectItem>
                    ) : anosLetivos.length === 0 ? (
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
                    {turmas?.filter((turma: any) => turma?.id).map((turma: any) => (
                      <SelectItem key={turma.id} value={String(turma.id)}>
                        {turma.nome}
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
                  Preencha todos os campos obrigatórios para visualizar as aulas planejadas
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de Aulas Planejadas */}
        {contextComplete && (
          <Card>
            <CardHeader>
              <CardTitle>Aulas Planejadas</CardTitle>
              <CardDescription>
                Lista de aulas do plano de ensino. Clique em "Lançar Aula" para registrar a execução.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAulas ? (
                <div className="text-center py-8 text-muted-foreground">Carregando aulas...</div>
              ) : aulasPlanejadas.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma aula planejada encontrada para este contexto.
                    <br />
                    Certifique-se de que existe um plano de ensino aprovado.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Ordem</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead className="w-24">Trimestre</TableHead>
                        <TableHead className="w-32">Quantidade</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead className="w-32">Lançamentos</TableHead>
                        <TableHead className="w-32">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aulasPlanejadas.map((aula: AulaPlanejada) => (
                        <TableRow key={aula.id}>
                          <TableCell className="font-medium">{aula.ordem}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{aula.titulo}</div>
                              {aula.descricao && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  {aula.descricao}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isSuperior ? `${aula.trimestre}º Semestre` : isSecundario ? `${aula.trimestre}º Trimestre` : `${aula.trimestre}º Período`}
                          </TableCell>
                          <TableCell>{aula.quantidadeAulas} aula(s)</TableCell>
                          <TableCell>
                            {aula.status === 'MINISTRADA' ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Ministrada
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                Planejada
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {aula.lancamentos.length > 0 ? (
                                aula.lancamentos.map((lancamento) => (
                                  <div
                                    key={lancamento.id}
                                    className="flex items-center justify-between text-sm bg-muted p-2 rounded"
                                  >
                                    <div>
                                      <div className="font-medium">{formatDate(lancamento.data)}</div>
                                      {lancamento.observacoes && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {lancamento.observacoes}
                                        </div>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive"
                                      onClick={() => handleRemoverLancamento(lancamento.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))
                              ) : (
                                <span className="text-sm text-muted-foreground">Nenhum lançamento</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handleAbrirDialog(aula)}
                              disabled={aula.lancamentos.length >= aula.quantidadeAulas}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Lançar Aula
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dialog para Lançar Aula */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) {
            handleCloseDialog();
          } else {
            setDialogOpen(open);
          }
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Lançar Aula</DialogTitle>
              <DialogDescription>
                {selectedAula ? `Registre a execução real da aula "${selectedAula.titulo}"` : "Registre a execução real da aula"}
              </DialogDescription>
            </DialogHeader>
            {selectedAula && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="data">Data da Aula *</Label>
                  <Input
                    id="data"
                    type="date"
                    value={dataLancamento}
                    onChange={(e) => setDataLancamento(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    placeholder="Observações sobre a aula ministrada (opcional)"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarLancamento}
                disabled={!dataLancamento || !selectedAula || createLancamentoMutation.isPending}
              >
                {createLancamentoMutation.isPending ? "Salvando..." : "Confirmar Lançamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

