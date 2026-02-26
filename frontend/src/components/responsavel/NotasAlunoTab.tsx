import React, { useMemo } from "react";
import { safeToFixed } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { matriculasApi, notasApi } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useInstituicao } from "@/contexts/InstituicaoContext";

interface NotasAlunoTabProps {
  alunoId: string;
}

interface NotaAgrupada {
  disciplina: string;
  turma: string;
  notas: {
    trimestre: number;
    valor: number;
    tipo: string;
    data: string;
  }[];
  mediaAnual: number | null;
  status: string;
}

export function NotasAlunoTab({ alunoId }: NotasAlunoTabProps) {
  const { isSecundario } = useInstituicao();
  
  const { data: notas, isLoading } = useQuery({
    queryKey: ["notas-aluno-responsavel", alunoId],
    queryFn: async () => {
      // Buscar matrículas do aluno
      const res = await matriculasApi.getByAlunoId(alunoId);
      const matriculas = res?.data ?? [];

      // Buscar notas para cada matrícula
      const matriculaIds = matriculas?.map((m: any) => m.id) || [];
      
      if (matriculaIds.length === 0) return [];
      
      // Fetch notas for all matriculas
      const allNotas: any[] = [];
      for (const matriculaId of matriculaIds) {
        const notasData = await notasApi.getAll({ matriculaId });
        allNotas.push(...(notasData || []));
      }

      // Combinar dados
      return allNotas.map((nota: any) => {
        const matricula = matriculas?.find((m: any) => m.id === nota.matriculaId);
        return {
          ...nota,
          turma: matricula?.turma?.nome || "N/A",
          curso: matricula?.turma?.curso?.nome || "N/A",
        };
      });
    },
    enabled: !!alunoId,
  });

  const getNotaColor = (valor: number) => {
    if (valor >= 14) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (valor >= 10) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aprovado':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'Reprovado':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'Em Recuperação':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // Extrair o trimestre do tipo da nota
  const getTrimestre = (tipo: string): number | null => {
    const t = (tipo || '').toLowerCase();
    if (t.includes('1') && (t.includes('trim') || t.includes('teste') || t.includes('prova'))) return 1;
    if (t.includes('2') && (t.includes('trim') || t.includes('teste') || t.includes('prova'))) return 2;
    if (t.includes('3') && (t.includes('trim') || t.includes('teste') || t.includes('prova'))) return 3;
    return null;
  };

  // Agrupar notas por disciplina para ensino médio
  const notasAgrupadas: NotaAgrupada[] = useMemo(() => {
    if (!notas || !isSecundario) return [];

    const grupos: Record<string, NotaAgrupada> = {};

    notas.forEach((nota: any) => {
      const key = `${nota.turma}-${nota.curso}`;
      if (!grupos[key]) {
        grupos[key] = {
          disciplina: nota.curso,
          turma: nota.turma,
          notas: [],
          mediaAnual: null,
          status: 'Pendente',
        };
      }

      const trimestre = getTrimestre(nota.tipo);
      if (trimestre) {
        grupos[key].notas.push({
          trimestre,
          valor: nota.valor,
          tipo: nota.tipo,
          data: nota.data,
        });
      }
    });

    // Calcular médias anuais
    Object.values(grupos).forEach((grupo) => {
      const notasPorTrimestre: Record<number, number[]> = { 1: [], 2: [], 3: [] };
      
      grupo.notas.forEach((n) => {
        if (n.trimestre && notasPorTrimestre[n.trimestre]) {
          notasPorTrimestre[n.trimestre].push(n.valor);
        }
      });

      const mediasTrimestre = [1, 2, 3].map((t) => {
        const vals = notasPorTrimestre[t];
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      });

      const mediasValidas = mediasTrimestre.filter((m): m is number => m !== null);
      
      if (mediasValidas.length > 0) {
        grupo.mediaAnual = mediasValidas.reduce((a, b) => a + b, 0) / mediasValidas.length;
        
        if (grupo.mediaAnual >= 10) {
          grupo.status = 'Aprovado';
        } else if (grupo.mediaAnual >= 7) {
          grupo.status = 'Em Recuperação';
        } else {
          grupo.status = 'Reprovado';
        }
      }
    });

    return Object.values(grupos);
  }, [notas, isSecundario]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando notas...
        </CardContent>
      </Card>
    );
  }

  if (!notas || notas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notas</CardTitle>
          <CardDescription>Visualize as notas do aluno</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhuma nota registrada ainda.
        </CardContent>
      </Card>
    );
  }

  // Renderização para ensino médio - agrupado por trimestre
  if (isSecundario && notasAgrupadas.length > 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notas por Trimestre</CardTitle>
          <CardDescription>Média calculada automaticamente a partir dos 3 trimestres</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead className="text-center">1º Trim</TableHead>
                  <TableHead className="text-center">2º Trim</TableHead>
                  <TableHead className="text-center">3º Trim</TableHead>
                  <TableHead className="text-center">Média Final</TableHead>
                  <TableHead className="text-center">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notasAgrupadas.map((grupo, idx) => {
                  const notasPorTrimestre: Record<number, number | null> = { 1: null, 2: null, 3: null };
                  grupo.notas.forEach((n) => {
                    if (n.trimestre) {
                      // Pega a última nota de cada trimestre
                      notasPorTrimestre[n.trimestre] = n.valor;
                    }
                  });

                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{grupo.disciplina}</TableCell>
                      <TableCell>{grupo.turma}</TableCell>
                      {[1, 2, 3].map((t) => (
                        <TableCell key={t} className="text-center">
                          {notasPorTrimestre[t] !== null ? (
                            <span className={`px-2 py-1 rounded-md text-sm font-medium ${getNotaColor(notasPorTrimestre[t]!)}`}>
                              {safeToFixed(notasPorTrimestre[t], 1)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        {grupo.mediaAnual !== null ? (
                          <span className={`px-2 py-1 rounded-md text-sm font-medium ${getNotaColor(grupo.mediaAnual)}`}>
                            {safeToFixed(grupo.mediaAnual, 1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={getStatusColor(grupo.status)}>
                          {grupo.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Renderização padrão para universidade
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notas</CardTitle>
        <CardDescription>Histórico de avaliações e notas do aluno</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>{isSecundario ? 'Classe' : 'Curso'}</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notas.map((nota: any) => (
                <TableRow key={nota.id}>
                  <TableCell>
                    {format(new Date(nota.data), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>{nota.turma}</TableCell>
                  <TableCell>{nota.curso}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{nota.tipo}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-md text-sm font-medium ${getNotaColor(nota.valor)}`}>
                      {nota.valor}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {nota.observacao || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
