import { useQuery } from "@tanstack/react-query";
import { safeToFixed } from "@/lib/utils";
import { frequenciasApi } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X } from "lucide-react";
import { useInstituicao } from "@/contexts/InstituicaoContext";

interface FrequenciaAlunoTabProps {
  alunoId: string;
}

export function FrequenciaAlunoTab({ alunoId }: FrequenciaAlunoTabProps) {
  const { isSecundario } = useInstituicao();
  const { data, isLoading } = useQuery({
    queryKey: ["frequencia-aluno-responsavel", alunoId],
    queryFn: async () => {
      // Buscar frequências do aluno via API
      const frequencias = await frequenciasApi.getByAluno(alunoId);

      // Calcular estatísticas por turma
      const turmasMap = new Map();
      
      frequencias?.forEach((freq: any) => {
        const turmaId = freq.aula?.turma?.id || freq.aulas?.turmas?.id;
        const turmaNome = freq.aula?.turma?.nome || freq.aulas?.turmas?.nome || "N/A";
        const cursoNome = freq.aula?.turma?.curso?.nome || freq.aulas?.turmas?.cursos?.nome || "N/A";
        
        if (!turmasMap.has(turmaId)) {
          turmasMap.set(turmaId, {
            turmaId,
            turmaNome,
            cursoNome,
            total: 0,
            presentes: 0,
          });
        }
        
        const turmaStats = turmasMap.get(turmaId);
        turmaStats.total++;
        if (freq.presente) turmaStats.presentes++;
      });

      const estatisticasPorTurma = Array.from(turmasMap.values()).map((stats) => ({
        ...stats,
        percentual: stats.total > 0 ? (stats.presentes / stats.total) * 100 : 0,
      }));

      // Formatar frequências para exibição
      const frequenciasFormatadas = frequencias?.map((freq: any) => ({
        id: freq.id,
        data: freq.aula?.data || freq.aulas?.data,
        turma: freq.aula?.turma?.nome || freq.aulas?.turmas?.nome || "N/A",
        curso: freq.aula?.turma?.curso?.nome || freq.aulas?.turmas?.cursos?.nome || "N/A",
        conteudo: freq.aula?.conteudo || freq.aulas?.conteudo || "-",
        presente: freq.presente,
        justificativa: freq.justificativa,
      }));

      return {
        frequencias: frequenciasFormatadas,
        estatisticas: estatisticasPorTurma,
      };
    },
    enabled: !!alunoId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando frequência...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo por Turma */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Frequência por Turma</CardTitle>
          <CardDescription>Percentual de presença em cada {isSecundario ? "classe" : "disciplina"}</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.estatisticas && data.estatisticas.length > 0 ? (
            <div className="space-y-4">
              {data.estatisticas.map((stats) => (
                <div key={stats.turmaId} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{stats.turmaNome}</span>
                      <span className="text-muted-foreground ml-2">({isSecundario ? "Classe" : stats.cursoNome})</span>
                    </div>
                    <span className="text-sm">
                      {stats.presentes}/{stats.total} aulas ({safeToFixed(stats.percentual)}%)
                    </span>
                  </div>
                  <Progress 
                    value={stats.percentual} 
                    className={stats.percentual < 75 ? "bg-red-100" : "bg-green-100"}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Nenhuma frequência registrada ainda.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Frequências */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Frequência</CardTitle>
          <CardDescription>Registro detalhado de presença em cada aula</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.frequencias && data.frequencias.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>{isSecundario ? "Classe" : "Curso"}</TableHead>
                    <TableHead>Conteúdo</TableHead>
                    <TableHead>Presença</TableHead>
                    <TableHead>Justificativa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.frequencias.map((freq) => (
                    <TableRow key={freq.id}>
                      <TableCell>
                        {freq.data ? format(new Date(freq.data), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell>{freq.turma}</TableCell>
                      <TableCell>{isSecundario ? freq.turma : freq.curso}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {freq.conteudo}
                      </TableCell>
                      <TableCell>
                        {freq.presente ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                            <Check className="h-3 w-3 mr-1" />
                            Presente
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <X className="h-3 w-3 mr-1" />
                            Falta
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {freq.justificativa || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma frequência registrada ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
