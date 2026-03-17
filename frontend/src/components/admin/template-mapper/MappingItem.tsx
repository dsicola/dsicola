/**
 * MappingItem - Item do template (placeholder) na coluna direita.
 * Destino do drop, highlight quando mapeado ou com hover.
 * Especificação: Cada placeholder é um MappingItem.
 */
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export interface MappingItemProps {
  placeholder: string;
  mappedCampo: string | null;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
}

export function MappingItem({
  placeholder,
  mappedCampo,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
}: MappingItemProps) {
  const isMapped = !!mappedCampo;

  return (
    <div
      data-placeholder={placeholder}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex items-center gap-2 rounded-md border p-3 transition-all duration-150 ${
        isDragOver
          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
          : isMapped
            ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20"
            : "border-border hover:border-primary/30"
      }`}
    >
      <code className="text-xs font-mono flex-1 truncate">{placeholder}</code>
      <div className="flex items-center gap-1.5 shrink-0 min-w-0">
        {mappedCampo ? (
          <>
            <span className="text-xs text-muted-foreground truncate max-w-[120px] font-medium text-emerald-700 dark:text-emerald-400">
              ← {mappedCampo}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={onRemove}
              title="Remover mapeamento"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground italic shrink-0">
            Arraste aqui
          </span>
        )}
      </div>
    </div>
  );
}
