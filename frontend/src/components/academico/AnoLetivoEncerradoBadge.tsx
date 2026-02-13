import { Badge } from "@/components/ui/badge";
import { AlertCircle, Lock, Unlock } from "lucide-react";
import { useAnoLetivoEncerrado } from "@/hooks/useAnoLetivoEncerrado";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AnoLetivoEncerradoBadgeProps {
  anoLetivoId?: string | null;
  className?: string;
  showIcon?: boolean;
}

/**
 * Badge visual para indicar que o ano letivo está ENCERRADO
 * Usado em telas acadêmicas para informar que mutations estão bloqueadas
 * Se houver reabertura ativa, mostra badge diferente
 */
export function AnoLetivoEncerradoBadge({ 
  anoLetivoId, 
  className = "",
  showIcon = true 
}: AnoLetivoEncerradoBadgeProps) {
  const { isEncerrado, mensagem, anoLetivo, reaberturaAtiva } = useAnoLetivoEncerrado(anoLetivoId);

  // Se houver reabertura ativa, mostrar badge de reabertura
  if (reaberturaAtiva) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="default" 
              className={`flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 ${className}`}
            >
              {showIcon && <Unlock className="h-3 w-3" />}
              <span>REABERTURA EXCEPCIONAL ATIVA</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <Unlock className="h-3 w-3" />
                Reabertura Excepcional Ativa
              </p>
              <p className="text-xs text-muted-foreground">
                {mensagem || `Reabertura excepcional ativa até ${format(new Date(reaberturaAtiva.dataFim), "dd/MM/yyyy", { locale: ptBR })}. Escopo: ${reaberturaAtiva.escopo}`}
              </p>
              {reaberturaAtiva.motivo && (
                <p className="text-xs text-muted-foreground">
                  Motivo: {reaberturaAtiva.motivo}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Se estiver encerrado sem reabertura, mostrar badge de bloqueio
  if (isEncerrado) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="destructive" 
              className={`flex items-center gap-1.5 ${className}`}
            >
              {showIcon && <Lock className="h-3 w-3" />}
              <span>Ano Letivo ENCERRADO</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Ano Letivo Encerrado
              </p>
              <p className="text-xs text-muted-foreground">
                {mensagem || `Ano letivo ${anoLetivo?.ano || ''} está encerrado. Operações acadêmicas não são permitidas.`}
              </p>
              {anoLetivo?.encerradoEm && (
                <p className="text-xs text-muted-foreground">
                  Encerrado em: {format(new Date(anoLetivo.encerradoEm), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}

