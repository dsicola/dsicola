/**
 * FieldList - Lista de campos do sistema (origem do drag).
 * Pesquisável, cada item é draggable.
 * Especificação: Coluna esquerda do mapeador de templates.
 */
import { GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2 } from "lucide-react";

export interface FieldListProps {
  fields: string[];
  loading?: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  draggedField: string | null;
  onDragStart: (e: React.DragEvent, field: string) => void;
  onDragEnd: () => void;
  placeholder?: string;
  emptyMessage?: string;
}

export function FieldList({
  fields,
  loading = false,
  searchQuery,
  onSearchChange,
  draggedField,
  onDragStart,
  onDragEnd,
  placeholder = "Pesquisar campo...",
  emptyMessage = "Nenhum campo corresponde à pesquisa.",
}: FieldListProps) {
  return (
    <div className="space-y-2 min-w-0 flex flex-col flex-1 min-h-0">
      <p className="text-sm font-medium text-muted-foreground">Campos do sistema</p>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 h-9 mb-2"
        />
      </div>
      <ScrollArea className="h-[min(400px,50vh)] min-h-[200px] rounded-md border p-2">
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : fields.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {searchQuery ? emptyMessage : "A carregar campos..."}
          </p>
        ) : (
          <div className="space-y-1">
            {fields.map((field) => (
              <div
                key={field}
                draggable
                onDragStart={(e) => onDragStart(e, field)}
                onDragEnd={onDragEnd}
                className={`flex items-center gap-2 rounded-md border p-2 cursor-grab active:cursor-grabbing transition-all duration-150 ${
                  draggedField === field
                    ? "opacity-50 scale-[0.98]"
                    : "hover:bg-muted/60 hover:border-primary/30"
                }`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <code className="text-xs font-mono truncate flex-1">{field}</code>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
