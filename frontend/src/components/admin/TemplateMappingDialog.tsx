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
import { Loader2, Link2, Sparkles, AlertCircle, Download, HelpCircle, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { configuracoesInstituicaoApi, documentsApi } from "@/services/api";
import { toast } from "sonner";
import { FieldList, MappingCanvas, MappingItem } from "./template-mapper";
import { suggestAllMappings } from "./template-mapper/autoSuggestMapping";

/** Texto de ajuda para placeholders de notas em certificados */
const CERTIFICADO_NOTAS_UX_HELP = (
  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground space-y-3">
    <p className="font-medium text-foreground">Placeholders de notas e médias em certificados</p>
    <div className="space-y-3 rounded border border-border/50 bg-background/50 p-3 text-xs">
      <p className="font-medium text-foreground">Há uma diferença entre Secundário e Superior:</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border-l-4 border-l-amber-500/70 bg-amber-500/10 p-2 space-y-1">
          <p className="font-semibold text-foreground">Ensino Secundário</p>
          <p>Ex.: Certificado de Habilitações — tabela pivot: DISCIPLINAS | 10ª Classe | 11ª Classe | 12ª Classe. Uma linha por disciplina, notas em colunas de ano.</p>
          <p>Use <code className="bg-muted px-1 rounded">student.disciplinasPivot</code></p>
        </div>
        <div className="rounded border-l-4 border-l-blue-500/70 bg-blue-500/10 p-2 space-y-1">
          <p className="font-semibold text-foreground">Ensino Superior</p>
          <p>Ex.: modelo ESP-Bié — tabelas separadas por ano: 1º Ano, 2º Ano, 3º Ano… Cada ano: Cadeiras | Valores.</p>
          <p>Use <code className="bg-muted px-1 rounded">student.tabelasPorAno</code></p>
        </div>
      </div>
    </div>
    <p>O sistema expõe os dados de forma dinâmica. O modelo Word escolhe o que usar conforme o layout.</p>
    <ul className="list-disc list-inside space-y-1.5 ml-1">
      <li><strong>student.disciplinasPivot</strong> — Secundário: DISCIPLINAS | 10ª | 11ª | 12ª. Loop: <code className="bg-muted px-1 rounded text-xs">{`{#student.disciplinasPivot}{disciplina} {classe10} {classe11} {classe12}{/student.disciplinasPivot}`}</code></li>
      <li><strong>student.tabelasPorAno</strong> — Superior: 1º Ano, 2º Ano… (Cadeiras | Valores). Loop: <code className="bg-muted px-1 rounded text-xs">{`{#student.tabelasPorAno}{ano}{#disciplinas}{cadeira} {valor}{/disciplinas}{/student.tabelasPorAno}`}</code></li>
      <li><strong>student.disciplinas</strong> — Lista plana. Loop: <code className="bg-muted px-1 rounded text-xs">{`{#student.disciplinas}{nome} {mediaFinal} {situacao}{/student.disciplinas}`}</code></li>
      <li><strong>student.mediaFinal</strong> — Média final numérica</li>
      <li><strong>student.mediaFinalPorExtenso</strong> — Média por extenso (ex: catorze vírgula cinco)</li>
    </ul>
    <p className="text-xs opacity-90">Os loops usam sintaxe docxtemplater. Para tabelas no Word: crie a linha com os placeholders, selecione-a e aplique o loop.</p>
  </div>
);

export interface TemplateMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modeloId: string;
  modeloNome: string;
  placeholders: string[];
  initialMappings: { campoTemplate: string; campoSistema: string }[];
  /** Filtra campos por tipo (CERTIFICADO, DECLARACAO_*, etc.). Reduz lista para o relevante. */
  tipoDocumento?: string;
  onSaved?: () => void;
}

export function TemplateMappingDialog({
  open,
  onOpenChange,
  modeloId,
  modeloNome,
  placeholders,
  initialMappings,
  tipoDocumento,
  onSaved,
}: TemplateMappingDialogProps) {
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [downloading, setDownloading] = useState(false);

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
      const fields = await configuracoesInstituicaoApi.getAvailableFields(tipoDocumento);
      setAvailableFields(fields);
    } catch (err) {
      toast.error("Erro ao carregar campos disponíveis");
    } finally {
      setLoading(false);
    }
  }, [open, tipoDocumento]);

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

  const handleDownloadBlank = async () => {
    setDownloading(true);
    try {
      const blob = await documentsApi.getModeloCertificadoBlank();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "modelo-certificado-blank.docx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Modelo descarregado. Carregue-o na secção de modelos e volte a mapear.");
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error)?.message ?? "Erro ao descarregar modelo");
    } finally {
      setDownloading(false);
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

    if (hasUnmapped && unmappedCount > 0) {
      const proceed = window.confirm(
        `${unmappedCount} placeholder(s) não mapeado(s). Os dados não serão preenchidos nesses campos ao gerar o documento.\n\nDeseja guardar mesmo assim?`
      );
      if (!proceed) return;
    }

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
            Em Word, cada {"{{marcador}}"} do modelo liga-se a um dado do sistema — não há grelha como no Excel. Arraste um campo da esquerda para o placeholder à direita. Use <strong>Sugerir mapeamentos</strong> quando possível e guarde no fim.
          </DialogDescription>
        </DialogHeader>

        {/* Guia visual: 3 passos */}
        <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted/50 text-sm">
          <span className="font-medium text-primary">1.</span>
          <span className="text-muted-foreground">Campos do sistema</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-medium text-primary">2.</span>
          <span className="text-muted-foreground">Ligações</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-medium text-primary">3.</span>
          <span className="text-muted-foreground">Placeholders do template</span>
        </div>

        {/* Ajuda — Placeholders de notas (certificados) */}
        {tipoDocumento === "CERTIFICADO" && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 rounded-lg border border-border hover:bg-muted/40 text-left text-sm font-medium">
              <HelpCircle className="h-4 w-4 text-primary" />
              Ajuda — Placeholders de notas em certificados
              <ChevronDown className="h-4 w-4 ml-auto transition-transform [[data-state=open]_&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {CERTIFICADO_NOTAS_UX_HELP}
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="rounded-lg border border-border bg-muted/20 p-3 min-h-0 flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">1. Campos do sistema</p>
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
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col shrink-0 w-56">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">2. Ligações</p>
            <MappingCanvas
              mappings={mappingsArray.map(([ph, campo]) => ({ campoTemplate: ph, campoSistema: campo }))}
              onRemove={removeMapping}
              mappedCount={mappedCount}
              totalPlaceholders={totalPlaceholders}
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 min-w-0 flex flex-col min-h-0">
            <div className="flex items-center justify-between shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">3. Placeholders do template</p>
              {placeholders.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleAutoSuggest} className="text-xs">
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Sugerir mapeamentos
                </Button>
              )}
            </div>
            <ScrollArea className="h-[min(400px,50vh)] rounded-md border p-2">
              {placeholders.length === 0 ? (
                <div className="py-4 px-2 space-y-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">O modelo ainda não tem marcadores de dados.</p>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                    <p className="font-medium text-foreground text-sm">Opção fácil — modelo pronto:</p>
                    <p className="text-xs">Descarregue um modelo Word com marcadores já inseridos. Pode personalizar logos e texto no Word; depois carregue-o na secção de modelos.</p>
                    <Button onClick={handleDownloadBlank} disabled={downloading} size="sm" className="w-full">
                      {downloading ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />A descarregar...</>
                      ) : (
                        <><Download className="h-4 w-4 mr-2" />Descarregar modelo pronto</>
                      )}
                    </Button>
                  </div>
                  <div className="border-t pt-2">
                    <p className="font-medium text-foreground text-xs mb-1">Adicionar marcadores no Word:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-1 text-xs">
                      <li>Abra o Word e escreva <code className="bg-muted px-1 rounded">{'{{NOME_ALUNO}}'}</code> onde quer o nome; <code className="bg-muted px-1 rounded">{'{{CURSO}}'}</code> para curso; <code className="bg-muted px-1 rounded">{'{{ANO_LETIVO}}'}</code> para ano.</li>
                      <li>Guarde e carregue novamente nesta secção.</li>
                    </ol>
                    <p className="text-xs mt-1 opacity-80">Use sempre o formato {'{{'}NOME{'}}'} — duas chavetas de cada lado.</p>
                  </div>
                </div>
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
