import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { horariosApi, distribuicaoAulasApi } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CalendarDays, Clock, Info, LayoutGrid, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Dia da semana local a partir de YYYY-MM-DD (evita desvio UTC). */
function weekdayFromDateStr(dataStr: string): number | null {
  const ymd = String(dataStr).split("T")[0];
  const parts = ymd.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, mo, da] = parts;
  const d = new Date(y, mo - 1, da);
  return Number.isNaN(d.getTime()) ? null : d.getDay();
}

const DIAS_SEMANA_CURTO: Record<number, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

/** Ordem institucional: Seg → Dom */
const ORDEM_DIA_SEMANA = [1, 2, 3, 4, 5, 6, 0];

function formatHoraCurta(s: string | undefined | null): string {
  if (!s) return "—";
  const t = String(s).trim();
  return t.length >= 5 ? t.slice(0, 5) : t;
}

type HorarioRow = {
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  sala?: string | null;
};

function setsIguais(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

export interface PlanoEnsinoContextoResumoCardProps {
  planoEnsinoId: string | null | undefined;
  plano: any | null | undefined;
  isSecundario: boolean;
  /** Professor: links do painel; equipa pedagógica: rotas admin */
  variant?: "professor" | "staff";
}

export function PlanoEnsinoContextoResumoCard({
  planoEnsinoId,
  plano,
  isSecundario,
  variant = "staff",
}: PlanoEnsinoContextoResumoCardProps) {
  const isStaff = variant === "staff";

  const { data: horariosRaw = [], isLoading: loadingHorarios } = useQuery({
    queryKey: ["plano-ensino-resumo-horarios", planoEnsinoId],
    queryFn: async () => {
      const res = await horariosApi.getAll({
        planoEnsinoId: planoEnsinoId!,
        status: "APROVADO",
        pageSize: 100,
      });
      const raw = (res as { data?: unknown })?.data ?? res;
      return Array.isArray(raw) ? (raw as HorarioRow[]) : [];
    },
    enabled: !!planoEnsinoId,
    staleTime: 30_000,
  });

  const { data: distribuicao = [], isLoading: loadingDist, isError: distError } = useQuery({
    queryKey: ["distribuicao-aulas", "by-plano-resumo", planoEnsinoId],
    queryFn: () => distribuicaoAulasApi.getByPlano(planoEnsinoId!),
    enabled: !!planoEnsinoId,
    staleTime: 30_000,
    retry: 1,
  });

  const diasUsadosNaDistribuicao = useMemo(() => {
    const dias = new Set<number>();
    if (!Array.isArray(distribuicao)) return dias;
    for (const item of distribuicao) {
      for (const dataStr of item.datas || []) {
        const wd = weekdayFromDateStr(String(dataStr));
        if (wd !== null) dias.add(wd);
      }
    }
    return dias;
  }, [distribuicao]);

  const diasHorarioOficial = useMemo(() => {
    const dias = new Set<number>();
    for (const h of horariosRaw) {
      if (typeof h.diaSemana === "number" && !Number.isNaN(h.diaSemana)) {
        dias.add(h.diaSemana);
      }
    }
    return dias;
  }, [horariosRaw]);

  const horariosPorDia = useMemo(() => {
    const m = new Map<number, HorarioRow[]>();
    for (const h of horariosRaw) {
      if (h.diaSemana == null) continue;
      const arr = m.get(h.diaSemana) || [];
      arr.push(h);
      m.set(h.diaSemana, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => String(a.horaInicio).localeCompare(String(b.horaInicio)));
    }
    return m;
  }, [horariosRaw]);

  const divergenciaHorarioDistribuicao = useMemo(() => {
    if (diasHorarioOficial.size === 0 || diasUsadosNaDistribuicao.size === 0) return false;
    return !setsIguais(diasHorarioOficial, diasUsadosNaDistribuicao);
  }, [diasHorarioOficial, diasUsadosNaDistribuicao]);

  const periodoResumo = useMemo(() => {
    if (!plano) return null;
    if (isSecundario) {
      const trimestres = [
        ...new Set(
          (plano.aulas || [])
            .map((a: { trimestre?: number }) => a.trimestre)
            .filter((t: number | undefined): t is number => typeof t === "number" && !Number.isNaN(t))
        ),
      ].sort((a, b) => a - b);
      if (trimestres.length === 0) return null;
      return trimestres.length === 1
        ? `Trimestre ${trimestres[0]}`
        : `Trimestres ${trimestres.join(", ")}`;
    }
    const n = plano.semestreRef?.numero ?? plano.semestre;
    if (n === null || n === undefined || n === "") return null;
    const num = Number(n);
    if (!Number.isFinite(num)) return null;
    return `Semestre ${num}`;
  }, [plano, isSecundario]);

  if (!planoEnsinoId || !plano) {
    return null;
  }

  const loading = loadingHorarios || loadingDist;
  const temHorario = horariosRaw.length > 0;
  const temDistribuicao = diasUsadosNaDistribuicao.size > 0;

  const linksHorario = isStaff ? (
    <Button variant="link" className="h-auto p-0 text-sm" asChild>
      <Link to="/admin-dashboard/gestao-academica?tab=horarios">Gestão académica — Horários</Link>
    </Button>
  ) : (
    <Button variant="link" className="h-auto p-0 text-sm" asChild>
      <Link to="/painel-professor/horarios">Ver os meus horários</Link>
    </Button>
  );

  const linkDistribuicao = isStaff ? (
    <Button variant="link" className="h-auto p-0 text-sm" asChild>
      <Link to="/admin-dashboard/configuracao-ensino?tab=distribuicao-aulas">Distribuição de aulas</Link>
    </Button>
  ) : null;

  const linkFrequencia =
    !isStaff ? (
      <Button variant="link" className="h-auto p-0 text-sm" asChild>
        <Link to="/painel-professor/frequencia">Registo de aulas e frequência</Link>
      </Button>
    ) : null;

  return (
    <Card className="border-primary/20 bg-muted/20">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <LayoutGrid className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <CardTitle className="text-base">Resumo institucional deste plano</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Horário oficial (aprovado) e dias cobertos pela distribuição de datas — alinhados ao contexto da
                instituição.
              </CardDescription>
            </div>
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" aria-hidden />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2 text-muted-foreground">
          {plano.disciplina?.nome && (
            <Badge variant="secondary" className="font-normal">
              {plano.disciplina.nome}
            </Badge>
          )}
          {plano.turma?.nome && (
            <Badge variant="outline" className="font-normal">
              Turma: {plano.turma.nome}
            </Badge>
          )}
          {periodoResumo && (
            <Badge variant="outline" className="font-normal">
              {periodoResumo}
            </Badge>
          )}
          {!isSecundario && plano.curso?.nome && (
            <Badge variant="outline" className="font-normal">
              Curso: {plano.curso.nome}
            </Badge>
          )}
          {isSecundario && (plano.classe?.nome || plano.classeOuAno) && (
            <Badge variant="outline" className="font-normal">
              Classe / ano: {plano.classe?.nome || plano.classeOuAno}
            </Badge>
          )}
          {isSecundario && plano.curso?.nome && (
            <Badge variant="outline" className="font-normal">
              Área / curso de estudo: {plano.curso.nome}
            </Badge>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            Semana (passe o rato para ver horários aprovados)
          </p>
          <TooltipProvider delayDuration={200}>
            <div className="flex flex-wrap gap-1.5">
              {ORDEM_DIA_SEMANA.map((dia) => {
                const noHorario = diasHorarioOficial.has(dia);
                const naDistrib = diasUsadosNaDistribuicao.has(dia);
                const blocos = horariosPorDia.get(dia) || [];
                let tooltipLines: string;
                if (blocos.length > 0) {
                  tooltipLines = blocos
                    .map(
                      (b) =>
                        `${formatHoraCurta(b.horaInicio)}–${formatHoraCurta(b.horaFim)}${b.sala ? ` · ${b.sala}` : ""}`
                    )
                    .join("\n");
                } else if (noHorario) {
                  tooltipLines = "Dia incluído no horário aprovado (detalhe de hora não listado).";
                } else if (naDistrib) {
                  tooltipLines = "Sem bloco aprovado neste dia; há datas na distribuição.";
                } else {
                  tooltipLines = "Sem aula prevista neste plano neste dia.";
                }

                const label = DIAS_SEMANA_CURTO[dia] ?? String(dia);
                return (
                  <Tooltip key={dia}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "min-w-[2.5rem] rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                          noHorario && "bg-primary/15 border-primary/40 text-foreground",
                          !noHorario && "bg-background border-border text-muted-foreground",
                          naDistrib && "ring-2 ring-violet-400/60 ring-offset-1 ring-offset-background"
                        )}
                        aria-label={`${label}: ${tooltipLines.replace(/\n/g, "; ")}`}
                      >
                        {label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs whitespace-pre-line text-left">
                      <span className="font-semibold">{label}</span>
                      {"\n"}
                      {tooltipLines}
                      {naDistrib ? "\n✓ Com datas na distribuição" : ""}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
              <Clock className="h-3.5 w-3.5" />
              Horário oficial (aprovado)
            </div>
            {temHorario ? (
              <ul className="space-y-1 text-sm">
                {ORDEM_DIA_SEMANA.filter((d) => horariosPorDia.has(d)).map((d) => (
                  <li key={d}>
                    <span className="font-medium">{DIAS_SEMANA_CURTO[d]}:</span>{" "}
                    {(horariosPorDia.get(d) || [])
                      .map((b) => `${formatHoraCurta(b.horaInicio)}–${formatHoraCurta(b.horaFim)}`)
                      .join(" · ")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Nenhum bloco <strong>aprovado</strong> associado a este plano. Cadastre e aprove em Horários (com turma
                vinculada ao plano).
              </p>
            )}
            <div className="mt-2">{linksHorario}</div>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
              <Info className="h-3.5 w-3.5" />
              Datas sugeridas (distribuição)
            </div>
            {distError ? (
              <p className="text-muted-foreground text-sm">Não foi possível carregar a distribuição.</p>
            ) : temDistribuicao ? (
              <p className="text-sm">
                <span className="font-medium">Dias da semana com datas:</span>{" "}
                {ORDEM_DIA_SEMANA.filter((d) => diasUsadosNaDistribuicao.has(d))
                  .map((d) => DIAS_SEMANA_CURTO[d])
                  .join(", ")}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                {isStaff
                  ? "Ainda não há datas distribuídas para este plano. Pode gerar em Configuração de ensino — Distribuição de aulas."
                  : "Ainda não há datas distribuídas para este plano. Quando a secretaria ou coordenação gerar, os dias aparecerão aqui."}
              </p>
            )}
            {isStaff && <div className="mt-2">{linkDistribuicao}</div>}
            {!isStaff && linkFrequencia && <div className="mt-2">{linkFrequencia}</div>}
          </div>
        </div>

        {divergenciaHorarioDistribuicao && (
          <Alert>
            <AlertDescription className="text-sm">
              Os <strong>dias da distribuição</strong> não coincidem com os <strong>dias do horário aprovado</strong>.
              Reveja a distribuição ou a grade para manter o alinhamento institucional.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
