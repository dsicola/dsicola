import { useQuery } from "@tanstack/react-query";
import { planoEnsinoApi } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CargaHorariaStatusCardProps {
  planoId: string | null;
  onAdicionarAula?: () => void;
  bloqueado?: boolean;
}

export function CargaHorariaStatusCard({ 
  planoId, 
  onAdicionarAula,
  bloqueado = false 
}: CargaHorariaStatusCardProps) {
  const { data: stats } = useQuery({
    queryKey: ["plano-ensino-stats", planoId],
    queryFn: async () => {
      if (!planoId) return null;
      return await planoEnsinoApi.getStats(planoId);
    },
    enabled: !!planoId,
  });

  if (!stats) {
    return null;
  }

  const progressPercentage = stats.totalExigido > 0 
    ? Math.min((stats.totalPlanejado / stats.totalExigido) * 100, 100)
    : 0;

  const isComplete = stats.status === "ok";
  const isIncomplete = stats.status === "faltando";
  const isExceeded = stats.status === "excedente";

  // Determinar cor e ícone baseado no status
  const getStatusConfig = () => {
    if (isComplete) {
      return {
        icon: CheckCircle,
        iconColor: "text-green-600",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        textColor: "text-green-800",
        progressColorClass: "[&>div]:bg-green-500",
        badgeVariant: "default" as const,
        badgeClass: "bg-green-100 text-green-800",
      };
    } else if (progressPercentage >= 80) {
      return {
        icon: AlertCircle,
        iconColor: "text-yellow-600",
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-200",
        textColor: "text-yellow-800",
        progressColorClass: "[&>div]:bg-yellow-500",
        badgeVariant: "default" as const,
        badgeClass: "bg-yellow-100 text-yellow-800",
      };
    } else {
      return {
        icon: AlertCircle,
        iconColor: "text-red-600",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        textColor: "text-red-800",
        progressColorClass: "[&>div]:bg-red-500",
        badgeVariant: "default" as const,
        badgeClass: "bg-red-100 text-red-800",
      };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  // Calcular quantas aulas de 2h faltam (sugestão padrão)
  const aulasFaltantes = isIncomplete && stats.diferenca > 0
    ? Math.ceil(stats.diferenca / 2)
    : 0;

  return (
    <Card className={cn("border-2", statusConfig.borderColor)}>
      <CardHeader className={cn("pb-3", statusConfig.bgColor)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <StatusIcon className={cn("h-5 w-5", statusConfig.iconColor)} />
            Carga Horária da Disciplina
          </CardTitle>
          <Badge className={statusConfig.badgeClass}>
            {isComplete ? "✅ Completa" : isIncomplete ? "⚠️ Incompleta" : "❌ Excedente"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Informações de Carga Horária */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Carga Horária Exigida
              <span className="block text-xs text-muted-foreground mt-0.5">(da Disciplina) {stats.unidadeHoraAula ? `· ${stats.unidadeHoraAula}/aula` : ''}</span>
            </p>
            <p className="text-2xl font-bold">{stats.totalExigido}h</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Carga Horária Planejada
              <span className="block text-xs text-muted-foreground mt-0.5">(soma das aulas)</span>
            </p>
            <p className="text-2xl font-bold">{stats.totalPlanejado}h</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Diferença</p>
            <p className={cn(
              "text-2xl font-bold",
              isComplete ? "text-green-600" : isIncomplete ? "text-yellow-600" : "text-red-600"
            )}>
              {stats.diferenca > 0 ? "+" : ""}
              {stats.diferenca}h
            </p>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Progresso da Carga Horária</span>
            <span className="text-sm font-semibold">{Math.round(progressPercentage)}%</span>
          </div>
          <div className="relative">
            <Progress 
              value={progressPercentage} 
              className={cn("h-6", statusConfig.progressColorClass)}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-semibold text-white drop-shadow-md">
                {stats.totalPlanejado}h de {stats.totalExigido}h planejadas
              </span>
            </div>
          </div>
        </div>

        {/* Mensagem Institucional */}
        <div className={cn(
          "p-4 rounded-md border flex items-start gap-3",
          statusConfig.bgColor,
          statusConfig.borderColor
        )}>
          <StatusIcon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", statusConfig.iconColor)} />
          <div className="flex-1 space-y-2">
            {isComplete ? (
              <>
                <p className={cn("font-semibold text-base", statusConfig.textColor)}>
                  ✅ Carga horária completa
                </p>
                <p className={cn("text-sm leading-relaxed", statusConfig.textColor)}>
                  O Plano de Ensino atende integralmente à carga horária exigida para esta disciplina.
                </p>
              </>
            ) : isIncomplete ? (
              <>
                <p className={cn("font-semibold text-base", statusConfig.textColor)}>
                  ⚠️ Carga horária incompleta
                </p>
                <p className={cn("text-sm leading-relaxed", statusConfig.textColor)}>
                  A disciplina exige <strong>{stats.totalExigido} horas-aula</strong>{stats.unidadeHoraAula ? ` (${stats.unidadeHoraAula}/aula)` : ''} (definida no cadastro da Disciplina), porém apenas{" "}
                  <strong>{stats.totalPlanejado} horas</strong> foram planejadas (soma das aulas cadastradas).
                  {aulasFaltantes > 0 && (
                    <span className="block mt-1">
                      Adicione mais aulas ao Plano de Ensino para cumprir a carga horária mínima
                      exigida pelas normas acadêmicas.
                    </span>
                  )}
                </p>
                {!bloqueado && onAdicionarAula && aulasFaltantes > 0 && (
                  <div className="mt-3 pt-3 border-t border-yellow-300">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <p className={cn("text-sm", statusConfig.textColor)}>
                        <strong>Sugestão:</strong> Adicione {aulasFaltantes} {aulasFaltantes === 1 ? "aula" : "aulas"} de 2h para completar a carga horária.
                      </p>
                      <Button
                        size="sm"
                        onClick={onAdicionarAula}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Aula
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className={cn("font-semibold text-base", statusConfig.textColor)}>
                  ❌ Carga horária excedente
                </p>
                <p className={cn("text-sm leading-relaxed", statusConfig.textColor)}>
                  O planejamento excede a carga horária exigida (definida no cadastro da Disciplina) em{" "}
                  <strong>{Math.abs(stats.diferenca)} horas</strong>.
                  Considere revisar o planejamento na aba "2. Planejar" para ajustar a carga horária planejada.
                </p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

