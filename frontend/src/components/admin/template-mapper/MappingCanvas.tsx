/**
 * MappingCanvas - Área central de mapeamento.
 * Mostra ligações visuais (campo_sistema → placeholder) e permite remover.
 * Especificação: Coluna central do mapeador de templates.
 */
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2 } from "lucide-react";

export interface MappingCanvasProps {
  mappings: Array<{ campoTemplate: string; campoSistema: string }>;
  onRemove: (campoTemplate: string) => void;
  mappedCount: number;
  totalPlaceholders: number;
}

export function MappingCanvas({
  mappings,
  onRemove,
  mappedCount,
  totalPlaceholders,
}: MappingCanvasProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 w-48 shrink-0">
      <p className="text-sm font-medium text-muted-foreground text-center">Ligações</p>
      <div className="flex-1 flex flex-col justify-center min-h-0 w-full">
        {mappings.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Arraste para criar ligações
          </p>
        ) : (
          <ScrollArea className="max-h-[280px]">
            <div className="space-y-1.5 py-2">
              {mappings.map(({ campoTemplate, campoSistema }) => (
                <div
                  key={campoTemplate}
                  className="flex flex-col gap-0.5 rounded border border-primary/20 bg-primary/5 px-2 py-1.5"
                >
                  <code className="text-[10px] font-mono truncate text-primary">
                    {campoSistema}
                  </code>
                  <span className="text-[10px] text-muted-foreground">→ {campoTemplate}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 mt-1 -mb-1 self-end"
                    onClick={() => onRemove(campoTemplate)}
                    title="Remover ligação"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
      <div className="text-xs text-muted-foreground text-center border-t pt-2 w-full">
        {mappedCount} de {totalPlaceholders} mapeados
      </div>
    </div>
  );
}
