/**
 * MappingItem - Item do template (placeholder) na coluna direita.
 * Destino do drop, highlight quando mapeado ou com hover.
 * Suporta: campo do sistema, deixar vazio, valor fixo.
 */
import { Button } from "@/components/ui/button";
import { Trash2, Type } from "lucide-react";

const PREFIXO_VALOR_FIXO = "__fixo::";
const CAMPO_VAZIO = "__empty__";

function formatMappedCampo(campo: string): string {
  if (campo === CAMPO_VAZIO) return "— Vazio —";
  if (campo.startsWith(PREFIXO_VALOR_FIXO)) return `"${campo.slice(PREFIXO_VALOR_FIXO.length)}"`;
  return campo;
}

export interface MappingItemProps {
  placeholder: string;
  mappedCampo: string | null;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
  onSetFixedValue?: () => void;
}

export function MappingItem({
  placeholder,
  mappedCampo,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
  onSetFixedValue,
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
            <span className="text-xs text-muted-foreground truncate max-w-[140px] font-medium text-emerald-700 dark:text-emerald-400">
              ← {formatMappedCampo(mappedCampo)}
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
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-muted-foreground italic">Arraste aqui</span>
            {onSetFixedValue && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetFixedValue();
                }}
                title="Definir valor fixo (ex: N/A, -, texto literal)"
              >
                <Type className="h-3 w-3 mr-1" />
                Valor fixo
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
