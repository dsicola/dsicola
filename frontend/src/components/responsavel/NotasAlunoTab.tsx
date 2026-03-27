import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { safeToFixed } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { matriculasApi, notasApi } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle } from "lucide-react";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { tInstitution } from "@/utils/institutionI18n";
import {
  obterMediasTrimestraisSecundario,
  parseTipoNotaParaComponenteSemantico,
} from "@/utils/gestaoNotasCalculo";

export type NotaStatusKey = "pending" | "yearInProgress" | "approved" | "recovery" | "failed";

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
  /** MT calculado: (MAC+NPT)/2, etc. — alinhado ao resto do sistema. */
  mt1: number | null;
  mt2: number | null;
  mt3: number | null;
  mediaAnual: number | null;
  statusKey: NotaStatusKey;
}

function toNum(v: unknown): number {
  if (v == null || v === "") return NaN;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/** `componente` na BD é muitas vezes "exame-<uuid>" ou "av-<uuid>" — não dá para extrair trimestre daí. */
function isComponenteSintetico(componente: string): boolean {
  const c = String(componente || "").trim();
  return /^exame-/i.test(c) || /^av-/i.test(c);
}

/** Rótulo legível para o encarregado (mini-pauta ou exame com nome). */
function rotuloHumanoSecundario(nota: any): string {
  const comp = String(nota.componente ?? "").trim();
  if (comp && !isComponenteSintetico(comp)) return comp;
  const parts = [
    nota.exame?.nome,
    nota.avaliacao?.nome,
    nota.exame?.tipo,
    nota.avaliacao?.tipo,
    nota.tipo,
  ];
  for (const p of parts) {
    const s = String(p ?? "").trim();
    if (s) return s;
  }
  return "";
}

/** Compat: alguns ecrãs ainda chamam por este nome. */
function rotuloAvaliacaoSecundario(nota: any): string {
  return rotuloHumanoSecundario(nota);
}

/** Alinha ao backend: "1º Trimestre - MAC", "2º Trimestre", "1o Trimestre", etc. */
function trimestreDeRotulo(label: string): number | null {
  const s = String(label || "").trim();
  const m = s.match(/([123])[º°oO]\s*trimestre/i);
  if (m) return parseInt(m[1], 10);
  const m2 = s.match(/\b([123])\s*º\s*trimestre/i);
  if (m2) return parseInt(m2[1], 10);
  const m3 = s.match(/trimestre\s*[-:]?\s*([123])\b/i);
  if (m3) return parseInt(m3[1], 10);
  return null;
}

/** Ordem: trimestre explícito na avaliação → nome do exame → texto do componente legível. */
function trimestreDaNota(nota: any): number | null {
  const tr = nota.avaliacao?.trimestre;
  if (tr === 1 || tr === 2 || tr === 3) return tr;
  const exameNome = String(nota.exame?.nome ?? "").trim();
  if (exameNome) {
    const fromExame = trimestreDeRotulo(exameNome);
    if (fromExame) return fromExame;
  }
  return trimestreDeRotulo(rotuloHumanoSecundario(nota));
}

export function NotasAlunoTab({ alunoId }: NotasAlunoTabProps) {
  const { t } = useTranslation();
  const { isSecundario } = useInstituicao();

  const { data: notas, isLoading, isError, refetch } = useQuery({
    queryKey: ["notas-aluno-responsavel", alunoId],
    queryFn: async () => {
      const res = await matriculasApi.getByAlunoId(alunoId);
      const matriculas = res?.data ?? [];
      const rawNotas = (await notasApi.getAll({ alunoId })) || [];

      const matriculaByTurmaId = new Map<string | undefined, any>();
      for (const m of matriculas) {
        const tid = (m as any).turma?.id ?? (m as any).turmaId ?? (m as any).turmas?.id ?? (m as any).turma_id;
        if (tid) matriculaByTurmaId.set(tid, m);
      }

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
          matricula?.turma?.classe?.nome ??
          matricula?.turma?.curso?.nome ??
          nota.planoEnsino?.turma?.classe?.nome ??
          nota.planoEnsino?.turma?.curso?.nome ??
          nota.exame?.turma?.classe?.nome ??
          nota.exame?.turma?.curso?.nome ??
          nota.avaliacao?.turma?.classe?.nome ??
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

  const getStatusColor = (key: NotaStatusKey) => {
    switch (key) {
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "recovery":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "yearInProgress":
        return "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300";
      default:
        return "bg-muted text-muted-foreground";
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
          mt1: null,
          mt2: null,
          mt3: null,
          mediaAnual: null,
          statusKey: "pending",
        };
      }

      const trimestre = trimestreDaNota(nota);
      const rotulo = rotuloHumanoSecundario(nota);
      if (trimestre) {
        const v = toNum(nota.valor);
        if (Number.isFinite(v)) {
          grupos[key].notas.push({
            trimestre,
            valor: v,
            tipo: rotulo || nota.tipo || "—",
            data: nota.data ?? nota.createdAt,
          });
        }
      }
    });

    // Calcular MT por trimestre (mini-pauta: (MAC+NPT)/2, III: (MAC+EN)/2) e MFD = (MT1+MT2+MT3)/3
    Object.values(grupos).forEach((grupo) => {
      const porSemantica = new Map<string, number>();
      for (const n of grupo.notas) {
        const sem = parseTipoNotaParaComponenteSemantico(n.tipo);
        if (sem) porSemantica.set(sem, n.valor);
      }
      const getV = (tipo: string): number | null => porSemantica.get(tipo) ?? null;

      const { mt1, mt2, mt3 } = obterMediasTrimestraisSecundario(getV, null);
      grupo.mt1 = mt1;
      grupo.mt2 = mt2;
      grupo.mt3 = mt3;
      const mediasTrimestre = [mt1, mt2, mt3];

      const mediasValidas = mediasTrimestre.filter((m): m is number => m !== null);
      const tresTrimestresCompletos =
        mediasTrimestre[0] !== null && mediasTrimestre[1] !== null && mediasTrimestre[2] !== null;

      if (mediasValidas.length > 0) {
        grupo.mediaAnual = mediasValidas.reduce((a, b) => a + b, 0) / mediasValidas.length;

        if (!tresTrimestresCompletos) {
          grupo.statusKey = "yearInProgress";
        } else if (grupo.mediaAnual >= 10) {
          grupo.statusKey = "approved";
        } else if (grupo.mediaAnual >= 7) {
          grupo.statusKey = "recovery";
        } else {
          grupo.statusKey = "failed";
        }
      }
    });

    return Object.values(grupos);
  }, [notas, isSecundario]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t("pages.responsavel.notas.loading")}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="border-destructive/50">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("pages.responsavel.notas.loadError")}</AlertTitle>
        <AlertDescription className="pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            {t("pages.responsavel.retry")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!notas || notas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("pages.responsavel.notas.emptyTitle")}</CardTitle>
          <CardDescription>{t("pages.responsavel.notas.emptyDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="py-4" />
      </Card>
    );
  }

  // Renderização para ensino médio - agrupado por trimestre
  if (isSecundario && notasAgrupadas.length > 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("pages.responsavel.notas.titleTrimester")}</CardTitle>
          <CardDescription>{t("pages.responsavel.notas.descTrimester")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pages.responsavel.notas.colDiscipline")}</TableHead>
                  <TableHead>{t("pages.responsavel.notas.colClass")}</TableHead>
                  <TableHead className="text-center">{t("pages.responsavel.notas.colT1")}</TableHead>
                  <TableHead className="text-center">{t("pages.responsavel.notas.colT2")}</TableHead>
                  <TableHead className="text-center">{t("pages.responsavel.notas.colT3")}</TableHead>
                  <TableHead className="text-center">{t("pages.responsavel.notas.colFinal")}</TableHead>
                  <TableHead className="text-center">{t("pages.responsavel.notas.colStatus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notasAgrupadas.map((grupo, idx) => {
                  const mts = [grupo.mt1, grupo.mt2, grupo.mt3] as const;

                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{grupo.disciplina}</TableCell>
                      <TableCell>{grupo.turma}</TableCell>
                      {[0, 1, 2].map((i) => (
                        <TableCell key={i} className="text-center">
                          {mts[i] !== null ? (
                            <span className={`px-2 py-1 rounded-md text-sm font-medium ${getNotaColor(mts[i]!)}`}>
                              {safeToFixed(mts[i], 1)}
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
                        <Badge className={getStatusColor(grupo.statusKey)}>
                          {t(`pages.responsavel.notas.status.${grupo.statusKey}`)}
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
        <CardTitle>{t("pages.responsavel.notas.title")}</CardTitle>
        <CardDescription>{t("pages.responsavel.notas.histDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("pages.responsavel.notas.colDate")}</TableHead>
                <TableHead>{t("pages.responsavel.notas.colClass")}</TableHead>
                <TableHead>{tInstitution(t, "cursoOuClasseHistorico", isSecundario)}</TableHead>
                <TableHead>{t("pages.responsavel.notas.colType")}</TableHead>
                <TableHead>{t("pages.responsavel.notas.colGrade")}</TableHead>
                <TableHead>{t("pages.responsavel.notas.colObs")}</TableHead>
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
                      {rotuloHumanoSecundario(nota) || nota.tipo || "—"}
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
