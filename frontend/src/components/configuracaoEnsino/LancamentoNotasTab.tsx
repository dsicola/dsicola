import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { avaliacoesApi, notasAvaliacaoApi, planoEnsinoApi, cursosApi, classesApi, disciplinasApi, professorsApi, turmasApi, anoLetivoApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ClipboardList, Users, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { safeToFixed } from "@/lib/utils";
import { AnoLetivoAtivoGuard } from "@/components/academico/AnoLetivoAtivoGuard";
import { AnoLetivoSelect } from "@/components/academico/AnoLetivoSelect";
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";

interface Avaliacao {
  id: string;
  tipo: string;
  nome?: string | null;
  fechada: boolean;
}

interface ContextType {
  cursoId?: string;
  classeId?: string;
  disciplinaId?: string;
  professorId?: string;
  anoLetivo?: number;
  turmaId?: string;
}

interface LancamentoNotasTabProps {
  sharedContext?: ContextType;
  onContextChange?: (context: ContextType) => void;
}

export function LancamentoNotasTab({ sharedContext, onContextChange }: LancamentoNotasTabProps) {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { instituicao, isSecundario } = useInstituicao();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();

  // Removido: busca manual de anos letivos - usar AnoLetivoSelect que já faz isso

  const [context, setContext] = useState<ContextType>(
    sharedContext || {
      cursoId: "",
      classeId: "",
      disciplinaId: "",
      professorId: "",
      anoLetivo: anoLetivoAtivo?.ano || new Date().getFullYear(),
      turmaId: "",
    }
  );

  // Atualizar ano letivo quando ano letivo ativo estiver disponível
  useEffect(() => {
    if (anoLetivoAtivo?.ano && !context.anoLetivo) {
      setContext((prev) => ({ ...prev, anoLetivo: anoLetivoAtivo.ano }));
    }
  }, [anoLetivoAtivo?.ano]);

  const [planoId, setPlanoId] = useState<string | null>(null);
  const [showLancarNotasDialog, setShowLancarNotasDialog] = useState(false);
  const [selectedAvaliacao, setSelectedAvaliacao] = useState<Avaliacao | null>(null);
  const [notasForm, setNotasForm] = useState<{ [alunoId: string]: { valor: string; observacoes: string } }>({});

  useEffect(() => {
    if (sharedContext) {
      setContext(sharedContext);
    }
  }, [sharedContext]);

  useEffect(() => {
    if (onContextChange) {
      onContextChange(context);
    }
  }, [context, onContextChange]);

  // Buscar cursos/classes
  const { data: cursos } = useQuery({
    queryKey: ["cursos-lancamento-notas", instituicaoId],
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
    queryKey: ["classes-lancamento-notas", instituicaoId],
    queryFn: async () => {
      if (isSecundario) {
        return await classesApi.getAll({ ativo: true });
      }
      return [];
    },
    enabled: isSecundario && !!instituicaoId,
  });

  // Buscar disciplinas
  const { data: disciplinas } = useQuery({
    queryKey: ["disciplinas-lancamento-notas", context.cursoId, context.classeId],
    queryFn: async () => {
      const params: any = { ativo: true };
      if (context.cursoId) params.cursoId = context.cursoId;
      if (context.classeId) params.classeId = context.classeId;
      return await disciplinasApi.getAll(params);
    },
    enabled: !!(context.cursoId || context.classeId),
  });

  // Buscar professores (tabela professores - professores.id, NUNCA users.id)
  const { data: professores } = useQuery({
    queryKey: ["professores-lancamento-notas", instituicaoId],
    queryFn: async () => {
      const data = await professorsApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!instituicaoId,
  });

  // Buscar turmas
  const { data: turmas } = useQuery({
    queryKey: ["turmas-lancamento-notas", context.cursoId, context.classeId, context.disciplinaId],
    queryFn: async () => {
      const params: any = {};
      if (context.cursoId) params.cursoId = context.cursoId;
      if (context.classeId) params.classeId = context.classeId;
      if (context.disciplinaId) params.disciplinaId = context.disciplinaId;
      return await turmasApi.getAll(params);
    },
    enabled: !!(context.cursoId || context.classeId) && !!context.disciplinaId,
  });

  // Buscar plano de ensino
  const { data: plano } = useQuery({
    queryKey: ["plano-ensino-lancamento-notas", context],
    queryFn: async () => {
      if (!context.disciplinaId || !context.professorId || !context.anoLetivo) {
        return null;
      }
      return await planoEnsinoApi.getByContext({
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

  useEffect(() => {
    if (plano?.id) {
      setPlanoId(plano.id);
    } else {
      setPlanoId(null);
    }
  }, [plano]);

  // Buscar avaliações
  const { data: avaliacoes } = useQuery({
    queryKey: ["avaliacoes-lancamento-notas", planoId],
    queryFn: async () => {
      if (!planoId) return [];
      return await avaliacoesApi.getAll({ planoEnsinoId: planoId });
    },
    enabled: !!planoId,
  });

  // Buscar alunos para lançar notas
  const { data: alunosParaNotas, isLoading: loadingAlunos } = useQuery({
    queryKey: ["alunos-notas", selectedAvaliacao?.id],
    queryFn: async () => {
      if (!selectedAvaliacao?.id) return null;
      return await notasAvaliacaoApi.getAlunosParaLancar(selectedAvaliacao.id);
    },
    enabled: !!selectedAvaliacao?.id,
  });

  // Lançar notas em lote
  const lancarNotasMutation = useSafeMutation({
    mutationFn: async () => {
      if (!selectedAvaliacao?.id) throw new Error("Avaliação não selecionada");

      // Validar e preparar notas
      const notas = Object.entries(notasForm)
        .filter(([alunoId, data]) => {
          // Filtrar apenas notas com valor válido
          if (!data.valor || data.valor.trim() === '') return false;
          
          // Validar alunoId
          if (!alunoId || alunoId.trim() === '') {
            console.warn('Nota sem alunoId válido:', data);
            return false;
          }
          
          // Validar valor numérico
          const valorNum = parseFloat(data.valor.replace(',', '.'));
          if (isNaN(valorNum)) {
            console.warn('Valor de nota inválido (NaN):', data.valor);
            return false;
          }
          
          // Validar range 0-20
          if (valorNum < 0 || valorNum > 20) {
            console.warn('Valor de nota fora do range (0-20):', valorNum);
            return false;
          }
          
          return true;
        })
        .map(([alunoId, data]) => {
          const valorNum = parseFloat(data.valor.replace(',', '.'));
          
          // Garantir que alunoId é string válida
          if (!alunoId || typeof alunoId !== 'string') {
            throw new Error(`alunoId inválido: ${alunoId}`);
          }
          
          // Garantir que valor é número válido entre 0 e 20
          if (isNaN(valorNum) || valorNum < 0 || valorNum > 20) {
            throw new Error(`Valor de nota inválido: ${data.valor} (deve ser entre 0 e 20)`);
          }
          
          return {
            alunoId: alunoId.trim(),
            valor: Math.round(valorNum * 10) / 10, // Arredondar para 1 casa decimal
            observacoes: data.observacoes?.trim() || undefined,
          };
        });

      if (notas.length === 0) {
        throw new Error("Nenhuma nota válida para lançar. Verifique se os valores estão entre 0 e 20.");
      }

      // Validar que todas as notas têm alunoId válido
      const notasInvalidas = notas.filter(n => !n.alunoId || n.alunoId.trim() === '');
      if (notasInvalidas.length > 0) {
        throw new Error(`Algumas notas não possuem alunoId válido. Por favor, recarregue a página e tente novamente.`);
      }

      return await notasAvaliacaoApi.createLote({
        avaliacaoId: selectedAvaliacao.id,
        notas,
      });
    },
    onSuccess: () => {
      setNotasForm({});
      setSelectedAvaliacao(null);
      setShowLancarNotasDialog(false);
      queryClient.invalidateQueries({ queryKey: ["alunos-notas"] });
      queryClient.invalidateQueries({ queryKey: ["avaliacoes-lancamento-notas"] });
      toast({
        title: "Notas lançadas",
        description: "As notas foram lançadas com sucesso.",
      });
    },
    onError: (error: any) => {
      // Extrair mensagem de erro mais detalhada
      const errorMessage = error?.response?.data?.message || 
                          error?.response?.data?.error || 
                          error?.message || 
                          'Erro desconhecido ao lançar notas';
      
      console.error('Erro ao lançar notas:', {
        error,
        response: error?.response?.data,
        status: error?.response?.status,
      });
      
      toast({ 
        title: "Erro ao lançar notas", 
        description: errorMessage, 
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const handleLancarNotas = (avaliacao: Avaliacao) => {
    setSelectedAvaliacao(avaliacao);
    setShowLancarNotasDialog(true);
  };

  const getTipoLabel = (tipo: string) => {
    const labels: { [key: string]: string } = {
      PROVA: "Prova",
      TESTE: "Teste",
      TRABALHO: "Trabalho",
      PROVA_FINAL: "Prova Final",
      RECUPERACAO: "Recuperação",
    };
    return labels[tipo] || tipo;
  };

  const contextComplete = !!(context.disciplinaId && context.professorId && context.anoLetivo && planoId);

  const updateContext = (updates: Partial<ContextType>) => {
    setContext((prev) => ({ ...prev, ...updates }));
  };

  return (
    <AnoLetivoAtivoGuard showAlert={true} disableChildren={false}>
    <div className="space-y-6">
      {/* Contexto Obrigatório */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contexto do Plano de Ensino
          </CardTitle>
          <CardDescription>Selecione o contexto antes de lançar notas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isSecundario ? (
              <div className="space-y-2">
                <Label>Classe / Ano *</Label>
                <Select
                  value={context.classeId || ""}
                  onValueChange={(value) => updateContext({ classeId: value, disciplinaId: "", turmaId: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes?.filter((classe: any) => classe?.id).map((classe: any) => (
                      <SelectItem key={classe.id} value={String(classe.id)}>{classe.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Curso *</Label>
                <Select
                  value={context.cursoId || ""}
                  onValueChange={(value) => updateContext({ cursoId: value, disciplinaId: "", turmaId: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {cursos?.filter((curso: any) => curso?.id).map((curso: any) => (
                      <SelectItem key={curso.id} value={String(curso.id)}>{curso.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Disciplina *</Label>
              <Select
                value={context.disciplinaId || ""}
                onValueChange={(value) => updateContext({ disciplinaId: value, turmaId: "" })}
                disabled={!context.cursoId && !context.classeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {disciplinas?.filter((disciplina: any) => disciplina?.id).map((disciplina: any) => (
                    <SelectItem key={disciplina.id} value={String(disciplina.id)}>{disciplina.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Professor *</Label>
              <Select
                value={context.professorId || ""}
                onValueChange={(value) => updateContext({ professorId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o professor" />
                </SelectTrigger>
                <SelectContent>
                  {professores?.filter((prof: any) => prof?.id).map((prof: any) => (
                    <SelectItem key={prof.id} value={String(prof.id)}>{prof.nome_completo || prof.nomeCompleto || prof.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AnoLetivoSelect
              value={context.anoLetivo}
              onValueChange={(ano) => updateContext({ anoLetivo: ano })}
              onIdChange={(id) => {
                // Manter o ano atual do contexto
                updateContext({ anoLetivo: context.anoLetivo });
              }}
              label="Ano Letivo"
              required
              showStatus={true}
            />

            <div className="space-y-2">
              <Label>Turma (opcional)</Label>
              <Select
                value={context.turmaId || "all"}
                onValueChange={(value) => updateContext({ turmaId: value === "all" ? "" : value })}
                disabled={!context.disciplinaId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as turmas</SelectItem>
                  {turmas?.filter((turma: any) => turma?.id).map((turma: any) => (
                    <SelectItem key={turma.id} value={String(turma.id)}>{turma.nome}</SelectItem>
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

      {contextComplete && (
        <Card>
          <CardHeader>
            <CardTitle>Lançamento de Notas</CardTitle>
            <CardDescription>Selecione uma avaliação para lançar notas aos estudantes</CardDescription>
          </CardHeader>
          <CardContent>
            {avaliacoes && avaliacoes.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {avaliacoes.map((avaliacao: any) => (
                      <TableRow key={avaliacao.id}>
                        <TableCell>
                          <Badge variant="outline">{getTipoLabel(avaliacao.tipo)}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{avaliacao.nome || "-"}</TableCell>
                        <TableCell>
                          {avaliacao.fechada ? (
                            <Badge variant="destructive">Fechada</Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-500 bg-green-50 text-green-700">Aberta</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleLancarNotas(avaliacao)}
                            disabled={avaliacao.fechada}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Lançar Notas
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhuma avaliação disponível</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog Lançar Notas */}
      <Dialog open={showLancarNotasDialog} onOpenChange={setShowLancarNotasDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lançar Notas</DialogTitle>
            <DialogDescription>
              Lançar notas para a avaliação: {selectedAvaliacao?.nome || getTipoLabel(selectedAvaliacao?.tipo || "")}
            </DialogDescription>
          </DialogHeader>
          {loadingAlunos ? (
            <p className="text-center text-muted-foreground py-8">Carregando alunos...</p>
          ) : alunosParaNotas ? (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Frequência</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Nota</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alunosParaNotas.alunos?.map((aluno: any) => (
                      <TableRow key={aluno.alunoId}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{aluno.nomeCompleto}</p>
                            <p className="text-sm text-muted-foreground">{aluno.numeroIdentificacaoPublica || aluno.numeroIdentificacao}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{safeToFixed(aluno.frequencia?.percentual)}%</p>
                            <p className="text-muted-foreground">
                              {aluno.frequencia?.presencas || 0}/{aluno.frequencia?.totalAulas || 0}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {aluno.bloqueado ? (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Frequência Insuficiente
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-500 bg-green-50 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="20"
                            disabled={aluno.bloqueado}
                            value={notasForm[aluno.alunoId]?.valor || aluno.nota?.valor?.toString() || ""}
                            onChange={(e) =>
                              setNotasForm((prev) => ({
                                ...prev,
                                [aluno.alunoId]: { ...prev[aluno.alunoId], valor: e.target.value },
                              }))
                            }
                            placeholder="0.0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            disabled={aluno.bloqueado}
                            value={notasForm[aluno.alunoId]?.observacoes || aluno.nota?.observacoes || ""}
                            onChange={(e) =>
                              setNotasForm((prev) => ({
                                ...prev,
                                [aluno.alunoId]: { ...prev[aluno.alunoId], observacoes: e.target.value },
                              }))
                            }
                            placeholder="Observações..."
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setNotasForm({}); setShowLancarNotasDialog(false); }}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => lancarNotasMutation.mutate()}
                  disabled={lancarNotasMutation.isPending || selectedAvaliacao?.fechada}
                >
                  Salvar Notas
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Nenhum estudante encontrado</p>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </AnoLetivoAtivoGuard>
  );
}

