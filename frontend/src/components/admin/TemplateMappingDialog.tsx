/**
 * TemplateMappingDialog - Interface drag & drop para mapear placeholders DOCX aos campos do sistema.
 *
 * LAYOUT 3 COLUNAS:
 * - Esquerda: Campos do sistema (lista pesquisável) — origem do drag
 * - Centro: Área de mapeamento — ligações visuais e resumo
 * - Direita: Campos do template (placeholders) — destino do drop
 *
 * Arrastar campo do sistema e largar no placeholder do template para criar o mapeamento.
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GripVertical, Loader2, Trash2, Search, Link2 } from "lucide-react";
import { configuracoesInstituicaoApi } from "@/services/api";
import { toast } from "sonner";

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

  const handleDragLeave = () => {
    setDragOver(null);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const mappingsArray = Object.entries(mappings)
        .filter(([, v]) => v?.trim())
        .map(([campo_template, campo_sistema]) => ({ campo_template, campo_sistema }));
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Mapear placeholders — {modeloNome}
          </DialogTitle>
          <DialogDescription>
            Arraste um campo da esquerda e largue no placeholder à direita para criar o mapeamento. Cada placeholder só pode ter um campo ligado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 flex-1 min-h-0">
          {/* COLUNA ESQUERDA: Campos do sistema (origem do drag) */}
          <div className="space-y-2 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Campos do sistema</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar campo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 mb-2"
              />
            </div>
            <ScrollArea className="h-[320px] rounded-md border p-2">
              {loading ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredFields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {searchQuery ? "Nenhum campo corresponde à pesquisa." : "A carregar campos..."}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredFields.map((field) => (
                    <div
                      key={field}
                      draggable
                      onDragStart={(e) => handleDragStart(e, field)}
                      onDragEnd={handleDragEnd}
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

          {/* COLUNA CENTRAL: Área de mapeamento (ligações) */}
          <div className="flex flex-col items-center justify-center gap-2 w-48 shrink-0">
            <p className="text-sm font-medium text-muted-foreground text-center">Ligações</p>
            <div className="flex-1 flex flex-col justify-center min-h-0 w-full">
              {mappingsArray.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Arraste para criar ligações
                </p>
              ) : (
                <ScrollArea className="max-h-[280px]">
                  <div className="space-y-1.5 py-2">
                    {mappingsArray.map(([ph, campo]) => (
                      <div
                        key={ph}
                        className="flex flex-col gap-0.5 rounded border border-primary/20 bg-primary/5 px-2 py-1.5"
                      >
                        <code className="text-[10px] font-mono truncate text-primary">
                          {campo}
                        </code>
                        <span className="text-[10px] text-muted-foreground">→ {ph}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 mt-1 -mb-1 self-end"
                          onClick={() => removeMapping(ph)}
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

          {/* COLUNA DIREITA: Campos do template (destino do drop) */}
          <div className="space-y-2 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Placeholders do template</p>
            <ScrollArea className="h-[360px] rounded-md border p-2">
              {placeholders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhum placeholder detectado no DOCX.</p>
              ) : (
                <div className="space-y-2">
                  {placeholders.map((ph) => {
                    const isMapped = !!mappings[ph];
                    const isDragOver = dragOver === ph;
                    return (
                      <div
                        key={ph}
                        data-placeholder={ph}
                        onDragOver={(e) => handleDragOver(e, ph)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, ph)}
                        className={`flex items-center gap-2 rounded-md border p-3 transition-all duration-150 ${
                          isDragOver
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                            : isMapped
                              ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20"
                              : "border-border hover:border-primary/30"
                        }`}
                      >
                        <code className="text-xs font-mono flex-1 truncate">{ph}</code>
                        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
                          {mappings[ph] ? (
                            <>
                              <span className="text-xs text-muted-foreground truncate max-w-[120px] font-medium text-emerald-700 dark:text-emerald-400">
                                ← {mappings[ph]}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => removeMapping(ph)}
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
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

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
