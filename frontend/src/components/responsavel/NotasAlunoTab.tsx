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

function toNum(v: unknown): number {
  if (v == null || v === "") return NaN;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/** Rótulo usado no secundário Angola: componente ("1º Trimestre - MAC") tem prioridade sobre tipo genérico. */
function rotuloAvaliacaoSecundario(nota: any): string {
  const parts = [
    nota.componente,
    nota.exame?.tipo,
    nota.exame?.nome,
    nota.avaliacao?.tipo,
    nota.avaliacao?.titulo,
    nota.tipo,
  ];
  for (const p of parts) {
    const s = String(p ?? "").trim();
    if (s) return s;
  }
  return "";
}

/** Alinha ao backend: "1º Trimestre - MAC", "2º Trimestre", "1o Trimestre", etc. */
function trimestreDeRotulo(label: string): number | null {
  const s = String(label || "").trim();
  const m = s.match(/([123])[º°oO]\s*trimestre/i);
  if (m) return parseInt(m[1], 10);
  const m2 = s.match(/\b([123])\s*º\s*trimestre/i);
  if (m2) return parseInt(m2[1], 10);
  const m3 = s.match(/trimestre\s*[:\-]?\s*([123])\b/i);
  if (m3) return parseInt(m3[1], 10);
  return null;
}

export function NotasAlunoTab({ alunoId }: NotasAlunoTabProps) {
  const { isSecundario } = useInstituicao();
  
  const { data: notas, isLoading } = useQuery({
    queryKey: ["notas-aluno-responsavel", alunoId],
    queryFn: async () => {
      const res = await matriculasApi.getByAlunoId(alunoId);
      const matriculas = res?.data ?? [];
      const rawNotas = (await notasApi.getAll({ alunoId })) || [];

      const matriculaByTurmaId = new Map(
        matriculas.map((m: any) => [m.turma?.id ?? m.turmaId, m])
      );

      return rawNotas.map((nota: any) => {
        const turmaId =
          nota.planoEnsino?.turma?.id ??
          nota.planoEnsino?.turmaId ??
          nota.exame?.turma?.id ??
          nota.avaliacao?.turma?.id ??
          nota.turmaId ??
          null;
        const matricula = turmaId ? matriculaByTurmaId.get(turmaId) : undefined;
        const disciplinaNome =
          nota.disciplina?.nome ??
          nota.planoEnsino?.disciplina?.nome ??
          nota.planoEnsino?.turma?.disciplina?.nome ??
          nota.exame?.turma?.disciplina?.nome ??
          nota.avaliacao?.turma?.disciplina?.nome ??
          "";
        const classeOuCurso =
          matricula?.turma?.curso?.nome ??
          nota.planoEnsino?.turma?.curso?.nome ??
          nota.exame?.turma?.curso?.nome ??
          nota.avaliacao?.turma?.curso?.nome ??
          "N/A";
        return {
          ...nota,
          turma:
            matricula?.turma?.nome ??
            nota.planoEnsino?.turma?.nome ??
            nota.exame?.turma?.nome ??
            nota.avaliacao?.turma?.nome ??
            "N/A",
          curso: classeOuCurso,
          disciplinaNome: disciplinaNome || "—",
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

  // Agrupar notas por disciplina para ensino médio
  const notasAgrupadas: NotaAgrupada[] = useMemo(() => {
    if (!notas || !isSecundario) return [];

    const grupos: Record<string, NotaAgrupada> = {};

    notas.forEach((nota: any) => {
      const disciplinaKey =
        nota.disciplina?.id ??
        nota.planoEnsino?.disciplina?.id ??
        nota.disciplinaNome ??
        nota.curso;
      const key = `${nota.turma}|${disciplinaKey}`;
      if (!grupos[key]) {
        grupos[key] = {
          disciplina: nota.disciplinaNome || nota.curso || "—",
          turma: nota.turma,
          notas: [],
          mediaAnual: null,
          status: 'Pendente',
        };
      }

      const rotulo = rotuloAvaliacaoSecundario(nota);
      const trimestre = trimestreDeRotulo(rotulo);
      if (trimestre) {
        const v = toNum(nota.valor);
        if (Number.isFinite(v)) {
          grupos[key].notas.push({
            trimestre,
            valor: v,
            tipo: rotulo || nota.tipo,
            data: nota.data ?? nota.createdAt,
          });
        }
      }
    });

    // Calcular médias anuais
    Object.values(grupos).forEach((grupo) => {
      const notasPorTrimestre: Record<number, number[]> = { 1: [], 2: [], 3: [] };
      
      grupo.notas.forEach((n) => {
        if (n.trimestre && notasPorTrimestre[n.trimestre]) {
          notasPorTrimestre[n.trimestre].push(toNum(n.valor));
        }
      });

      const mediasTrimestre = [1, 2, 3].map((t) => {
        const vals = notasPorTrimestre[t].filter((x) => Number.isFinite(x));
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
                    {nota.data || nota.createdAt
                      ? format(new Date(nota.data ?? nota.createdAt), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </TableCell>
                  <TableCell>{nota.turma}</TableCell>
                  <TableCell>
                    {isSecundario ? nota.disciplinaNome || nota.curso : nota.curso}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {rotuloAvaliacaoSecundario(nota) || nota.tipo || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-md text-sm font-medium ${getNotaColor(nota.valor)}`}>
                      {Number.isFinite(toNum(nota.valor)) ? safeToFixed(toNum(nota.valor), 1) : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {nota.observacoes ?? nota.observacao ?? "-"}
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
