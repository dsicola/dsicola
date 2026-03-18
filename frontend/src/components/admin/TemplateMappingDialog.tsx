/**
 * TemplateMappingDialog - Interface drag & drop para mapear placeholders DOCX aos campos do sistema.
 *
 * LAYOUT 3 COLUNAS (conforme especificação):
 * - Esquerda: FieldList - Campos do sistema (lista pesquisável, origem do drag)
 * - Centro: MappingCanvas - Área de mapeamento com ligações visuais
 * - Direita: MappingItem - Placeholders do template (destino do drop)
 *
 * API: GET available-fields, POST modelos-documento/:id/mapping
 * Estado: mappings Array<{ campo_template, campo_sistema }>
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Link2, Sparkles, AlertCircle } from "lucide-react";
import { configuracoesInstituicaoApi } from "@/services/api";
import { toast } from "sonner";
import { FieldList, MappingCanvas, MappingItem } from "./template-mapper";
import { suggestAllMappings } from "./template-mapper/autoSuggestMapping";

export interface TemplateMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modeloId: string;
  modeloNome: string;
  placeholders: string[];
  initialMappings: { campoTemplate: string; campoSistema: string }[];
  onSaved?: () => void;
}

export function TemplateMappingDialog({
  open,
  onOpenChange,
  modeloId,
  modeloNome,
  placeholders,
  initialMappings,
  onSaved,
}: TemplateMappingDialogProps) {
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setMappings(
      initialMappings.reduce((acc, m) => {
        acc[m.campoTemplate] = m.campoSistema;
        return acc;
      }, {} as Record<string, string>)
    );
  }, [initialMappings, open]);

  const fetchFields = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const fields = await configuracoesInstituicaoApi.getAvailableFields();
      setAvailableFields(fields);
    } catch (err) {
      toast.error("Erro ao carregar campos disponíveis");
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return availableFields;
    const q = searchQuery.toLowerCase().trim();
    return availableFields.filter((f) => f.toLowerCase().includes(q));
  }, [availableFields, searchQuery]);

  const handleDragStart = (e: React.DragEvent, field: string) => {
    e.dataTransfer.setData("text/plain", field);
    e.dataTransfer.effectAllowed = "copy";
    setDraggedField(field);
  };

  const handleDragEnd = () => {
    setDraggedField(null);
    setDragOver(null);
  };

  const handleDragOver = (e: React.DragEvent, ph: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(ph);
  };

  const handleDrop = (e: React.DragEvent, ph: string) => {
    e.preventDefault();
    const field = e.dataTransfer.getData("text/plain");
    setDragOver(null);
    setDraggedField(null);
    if (field) {
      setMappings((m) => ({ ...m, [ph]: field }));
    }
  };

  const removeMapping = (ph: string) => {
    setMappings((m) => {
      const next = { ...m };
      delete next[ph];
      return next;
    });
  };

  const handleSetFixedValue = (ph: string) => {
    const valor = window.prompt(
      `Valor fixo para {{${ph}}}:\n(Ex: N/A, -, ou texto literal que aparecerá no documento)`,
      ""
    );
    if (valor !== null) {
      setMappings((m) => ({ ...m, [ph]: `__fixo::${valor.trim()}` }));
      toast.success("Valor fixo definido");
    }
  };

  const handleAutoSuggest = () => {
    const suggested = suggestAllMappings(placeholders, availableFields, mappings);
    const added = Object.keys(suggested).filter((k) => suggested[k] && !mappings[k]).length;
    setMappings(suggested);
    if (added > 0) {
      toast.success(`${added} mapeamento(s) sugerido(s) automaticamente.`);
    } else {
      toast.info("Nenhum mapeamento adicional sugerido.");
    }
  };

  const handleSave = async () => {
    const mappingsArray = Object.entries(mappings)
      .filter(([, v]) => v?.trim())
      .map(([campo_template, campo_sistema]) => ({ campo_template, campo_sistema }));

    setSaving(true);
    try {
      await configuracoesInstituicaoApi.saveModeloMapping(modeloId, mappingsArray);
      toast.success("Mapeamentos guardados");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error)?.message ?? "Erro ao guardar mapeamentos");
    } finally {
      setSaving(false);
    }
  };

  const mappingsArray = Object.entries(mappings).filter(([, v]) => v?.trim());
  const mappedCount = mappingsArray.length;
  const totalPlaceholders = placeholders.length;
  const unmappedCount = totalPlaceholders - mappedCount;
  const hasUnmapped = unmappedCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed left-1/2 top-1/2 z-50 flex w-[min(95vw,1280px)] max-w-[95vw] h-[min(90vh,calc(100dvh-2rem))] max-h-[90vh] min-h-[400px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Mapear placeholders — {modeloNome}
          </DialogTitle>
          <DialogDescription>
            Arraste um campo da esquerda e largue no placeholder à direita para criar o mapeamento. Cada
            placeholder só pode ter um campo ligado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <FieldList
            fields={filteredFields}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            draggedField={draggedField}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            fieldLabels={{ __empty__: "— Deixar vazio —" }}
          />

          <MappingCanvas
            mappings={mappingsArray.map(([ph, campo]) => ({ campoTemplate: ph, campoSistema: campo }))}
            onRemove={removeMapping}
            mappedCount={mappedCount}
            totalPlaceholders={totalPlaceholders}
          />

          <div className="space-y-2 min-w-0 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Placeholders do template</p>
              {placeholders.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleAutoSuggest} className="text-xs">
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Sugerir mapeamentos
                </Button>
              )}
            </div>
            <ScrollArea className="h-[min(400px,50vh)] rounded-md border p-2">
              {placeholders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhum placeholder detectado no DOCX.</p>
              ) : (
                <div className="space-y-2">
                  {placeholders.map((ph) => (
                    <MappingItem
                      key={ph}
                      placeholder={ph}
                      mappedCampo={mappings[ph] || null}
                      isDragOver={dragOver === ph}
                      onDragOver={(e) => handleDragOver(e, ph)}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={(e) => handleDrop(e, ph)}
                      onRemove={() => removeMapping(ph)}
                      onSetFixedValue={() => handleSetFixedValue(ph)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {hasUnmapped && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              {unmappedCount} placeholder{unmappedCount !== 1 ? "s" : ""} não mapeado{unmappedCount !== 1 ? "s" : ""}.
              Pode guardar na mesma — campos não mapeados ficarão vazios no documento.
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                A guardar...
              </>
            ) : (
              "Guardar mapeamentos"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
