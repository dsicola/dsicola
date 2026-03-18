/**
 * WordTemplateEditor - Editor de templates DOCX com placeholders.
 * Funcionalidades: upload DOCX, listar placeholders detectados, ajuda com exemplos, preview com dados mock.
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  FileText,
  Info,
  Eye,
  Download,
  Loader2,
  HelpCircle,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { documentsApi } from "@/services/api";
import { toast } from "sonner";

const PLACEHOLDER_EXAMPLES = [
  "{{student.fullName}}",
  "{{student.birthDate}}",
  "{{student.bi}}",
  "{{turma.nome}}",
  "{{instituicao.nome}}",
  "{{document.number}}",
  "{{document.dataEmissao}}",
];

const LOOP_EXAMPLE = `{#alunos}
Nome: {{fullName}}
Data nascimento: {{birthDate}}
{/alunos}`;

export interface WordTemplateEditorProps {
  /** Template ID do modelo (quando editando modelo existente) */
  modeloId?: string;
  /** Template base64 (quando upload direto) */
  templateBase64?: string;
  /** Placeholders iniciais (ex: do modelo) */
  initialPlaceholders?: string[];
  /** Callback ao fazer upload */
  onUpload?: (base64: string, placeholders: string[], loops: string[]) => void;
  /** Modo compacto (para embed em dialog) */
  compact?: boolean;
}

export function WordTemplateEditor({
  modeloId,
  templateBase64: initialBase64,
  initialPlaceholders = [],
  onUpload,
  compact = false,
}: WordTemplateEditorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [templateBase64, setTemplateBase64] = useState(initialBase64 ?? "");
  const [placeholders, setPlaceholders] = useState<string[]>(initialPlaceholders);
  const [loops, setLoops] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [extractLoading, setExtractLoading] = useState(false);

  const loadTemplateFromFile = useCallback(async (f: File) => {
    const ext = (f.name?.split(".").pop() ?? "").toLowerCase();
    if (ext !== "docx") {
      toast.error("Use um ficheiro .docx (Word 2007+)");
      return;
    }
    setExtractLoading(true);
    try {
      const { placeholders: ph, loops: lp } = await documentsApi.extractDocxPlaceholdersUpload(f);
      setPlaceholders(ph);
      setLoops(lp);
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string)?.split(",")[1] ?? "";
        setTemplateBase64(b64);
        setFile(f);
        onUpload?.(b64, ph, lp);
      };
      reader.readAsDataURL(f);
      toast.success(`${ph.length} placeholder(s), ${lp.length} loop(s) detectado(s)`);
    } catch (err) {
      toast.error((err as Error)?.message ?? "Erro ao analisar DOCX");
    } finally {
      setExtractLoading(false);
    }
  }, [onUpload]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadTemplateFromFile(f);
    e.target.value = "";
  };

  const handlePreview = async () => {
    if (!templateBase64 && !modeloId) {
      toast.error("Carregue um template DOCX primeiro");
      return;
    }
    setPreviewLoading(true);
    try {
      const { docxBase64 } = await documentsApi.previewDocx({
        templateId: modeloId,
        templateBase64: templateBase64 || undefined,
      });
      const blob = new Blob(
        [Uint8Array.from(atob(docxBase64), (c) => c.charCodeAt(0))],
        { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "preview.docx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Preview descarregado");
    } catch (err) {
      toast.error((err as Error)?.message ?? "Erro ao gerar preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className={compact ? "" : "border-2"}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            Template Word (DOCX)
          </CardTitle>
          <CardDescription>
            Use placeholders no formato {`{{campo}}`} — ex: {`{{student.fullName}}`}. Loops: {`{#alunos}...{/alunos}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Carregar DOCX
                <input
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={extractLoading}
                />
              </label>
            </Button>
            {extractLoading && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                A analisar...
              </span>
            )}
            {templateBase64 && (
              <>
                <Badge variant="secondary">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {placeholders.length} placeholders
                </Badge>
                {loops.length > 0 && (
                  <Badge variant="outline">
                    {loops.length} loop(s): {loops.join(", ")}
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewLoading}>
                  {previewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-1" />
                  )}
                  Preview (dados mock)
                </Button>
              </>
            )}
          </div>

          {placeholders.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Placeholders detectados</Label>
              <ScrollArea className="h-24 mt-1 rounded border p-2">
                <div className="flex flex-wrap gap-1">
                  {placeholders.map((ph) => (
                    <Badge key={ph} variant="outline" className="font-mono text-xs">
                      {`{{${ph}}}`}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <details className="rounded border p-3 text-sm">
            <summary className="flex items-center gap-2 cursor-pointer font-medium">
              <HelpCircle className="h-4 w-4" />
              Exemplos de placeholders
            </summary>
            <div className="mt-2 space-y-2 text-muted-foreground">
              <p>Campos simples:</p>
              <div className="flex flex-wrap gap-1">
                {PLACEHOLDER_EXAMPLES.map((ex) => (
                  <code key={ex} className="bg-muted px-1 rounded text-xs">
                    {ex}
                  </code>
                ))}
              </div>
              <p>Lista (loop):</p>
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">{LOOP_EXAMPLE}</pre>
              <p className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Info className="h-4 w-4" />
                Dentro do loop use o nome do campo sem prefixo — ex: fullName em vez de student.fullName
              </p>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
