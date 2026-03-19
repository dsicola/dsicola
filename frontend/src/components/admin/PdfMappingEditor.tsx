/**
 * PdfMappingEditor - Editor de mapeamento para templates PDF.
 * MODO FORM: listar campos detectados, mapear via dropdown.
 * MODO COORDENADAS: tabela para definir (pageIndex, x, y, campo) — coordenadas manuais ou via clique (futuro).
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MapPin,
  FormInput,
  Upload,
  Loader2,
  Plus,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { documentsApi, configuracoesInstituicaoApi } from "@/services/api";
import { toast } from "sonner";

const CAMPOS_SISTEMA_BASE = [
  { value: "student.fullName", label: "Nome completo" },
  { value: "student.birthDate", label: "Data nascimento" },
  { value: "student.bi", label: "BI" },
  { value: "student.numeroEstudante", label: "Nº estudante" },
  { value: "instituicao.nome", label: "Nome instituição" },
  { value: "document.number", label: "Nº documento" },
  { value: "document.codigoVerificacao", label: "Código verificação" },
  { value: "document.dataEmissao", label: "Data emissão" },
  { value: "turma.nome", label: "Turma" },
];

const CAMPOS_BOLETIM = [
  ...CAMPOS_SISTEMA_BASE,
  { value: "boletim.anoLetivo", label: "Ano letivo (Boletim)" },
  { value: "boletim.disciplinas.0.disciplinaNome", label: "Disciplina 1 (Boletim)" },
  { value: "boletim.disciplinas.0.notaFinal", label: "Nota 1 (Boletim)" },
  { value: "boletim.disciplinas.0.situacaoAcademica", label: "Situação 1 (Boletim)" },
  { value: "boletim.disciplinas.0.professorNome", label: "Professor 1 (Boletim)" },
  { value: "boletim.disciplinas.0.cargaHoraria", label: "Carga horária 1 (Boletim)" },
];

function getCamposSistema(tipo?: string) {
  return tipo === "BOLETIM" ? CAMPOS_BOLETIM : CAMPOS_SISTEMA_BASE;
}

type PdfMode = "FORM_FIELDS" | "COORDINATES";

export interface PdfCoordinateItem {
  pageIndex: number;
  x: number;
  y: number;
  campo: string;
  fontSize?: number;
}

export interface PdfMappingEditorProps {
  /** Modo: FORM_FIELDS ou COORDINATES */
  mode: PdfMode;
  /** Template base64 (quando disponível) */
  templateBase64?: string;
  /** Campos detectados (modo FORM) */
  initialFields?: Array<{ fieldName: string; type: string }>;
  /** Mapeamento inicial (modo FORM: campo PDF → campo sistema) */
  initialFormMapping?: Record<string, string>;
  /** Mapeamento inicial (modo COORDINATES) */
  initialCoordinateMapping?: PdfCoordinateItem[];
  /** Callback ao alterar mapeamento */
  onChange?: (formMapping?: Record<string, string>, coordinateMapping?: PdfCoordinateItem[]) => void;
  /** Compacto */
  compact?: boolean;
  /** Tipo documento (BOLETIM, CERTIFICADO, etc.) — afeta campos sugeridos */
  tipoDocumento?: string;
}

export function PdfMappingEditor({
  mode,
  templateBase64: initialBase64,
  initialFields = [],
  initialFormMapping = {},
  initialCoordinateMapping = [],
  onChange,
  compact = false,
  tipoDocumento,
}: PdfMappingEditorProps) {
  const camposSistema = getCamposSistema(tipoDocumento);
  const [templateBase64, setTemplateBase64] = useState(initialBase64 ?? "");
  const [fields, setFields] = useState<Array<{ fieldName: string; type: string }>>(initialFields);
  const [formMapping, setFormMapping] = useState<Record<string, string>>(initialFormMapping);
  const [coordinateItems, setCoordinateItems] = useState<PdfCoordinateItem[]>(
    initialCoordinateMapping.length > 0 ? initialCoordinateMapping : [{ pageIndex: 0, x: 100, y: 400, campo: "student.fullName" }]
  );
  const [loading, setLoading] = useState(false);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const ext = (file.name?.split(".").pop() ?? "").toLowerCase();
      if (ext !== "pdf") {
        toast.error("Use um ficheiro PDF");
        return;
      }
      setLoading(true);
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const b64 = (reader.result as string)?.split(",")[1] ?? "";
          setTemplateBase64(b64);
          const { fields: f } = await configuracoesInstituicaoApi.extractPdfFields(b64);
          setFields(f);
          const initial: Record<string, string> = {};
          for (const ff of f) {
            initial[ff.fieldName] = formMapping[ff.fieldName] ?? "";
          }
          setFormMapping(initial);
          toast.success(`${f.length} campo(s) detectado(s)`);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        toast.error((err as Error)?.message ?? "Erro ao carregar PDF");
      } finally {
        setLoading(false);
        e.target.value = "";
      }
    },
    [formMapping]
  );

  const updateFormMapping = (fieldName: string, value: string) => {
    const next = { ...formMapping, [fieldName]: value };
    setFormMapping(next);
    onChange?.(next, undefined);
  };

  const addCoordinateItem = () => {
    const next = [...coordinateItems, { pageIndex: 0, x: 100, y: 400, campo: "student.fullName" }];
    setCoordinateItems(next);
    onChange?.(undefined, next);
  };

  const removeCoordinateItem = (i: number) => {
    const next = coordinateItems.filter((_, idx) => idx !== i);
    setCoordinateItems(next);
    onChange?.(undefined, next);
  };

  const updateCoordinateItem = (i: number, updates: Partial<PdfCoordinateItem>) => {
    const next = coordinateItems.map((item, idx) =>
      idx === i ? { ...item, ...updates } : item
    );
    setCoordinateItems(next);
    onChange?.(undefined, next);
  };

  return (
    <Card className={compact ? "" : "border-2"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {mode === "FORM_FIELDS" ? <FormInput className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
          Mapeamento PDF — {mode === "FORM_FIELDS" ? "Formulário" : "Coordenadas"}
        </CardTitle>
        <CardDescription>
          {mode === "FORM_FIELDS"
            ? "PDFs com campos interativos (AcroForm). Mapeie cada campo ao dado do sistema."
            : "PDFs estáticos. Defina posições (x,y) em cada página para inserir texto."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Carregar PDF
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={loading}
              />
            </label>
          </Button>
          {loading && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              A analisar...
            </span>
          )}
        </div>

        {mode === "FORM_FIELDS" && (
          <div>
            <Label className="text-sm font-medium">Campos do PDF → Campos do sistema</Label>
            {fields.length === 0 ? (
              <div className="space-y-2 mt-1">
                <p className="text-sm text-muted-foreground">Carregue um PDF para listar os campos.</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  O PDF não tem campos interativos (AcroForm)? Use o modo <strong>Coordenadas</strong> para PDFs estáticos — defina posições (x, y) manualmente.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-48 mt-2 rounded border p-2">
                <div className="space-y-2">
                  {fields.map((f) => (
                    <div key={f.fieldName} className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs shrink-0">
                        {f.fieldName}
                      </Badge>
                      <span className="text-muted-foreground text-xs">({f.type})</span>
                      <Select
                        value={formMapping[f.fieldName] ?? ""}
                        onValueChange={(v) => updateFormMapping(f.fieldName, v)}
                      >
                        <SelectTrigger className="h-8 max-w-[240px]">
                          <SelectValue placeholder="Selecionar campo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">— Não mapear —</SelectItem>
                          {camposSistema.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {mode === "COORDINATES" && (
          <div>
            <Label className="text-sm font-medium">Posições (x, y) por página</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Origem (0,0) no canto inferior-esquerdo. A4 ≈ 595×842 pts.
            </p>
            <details className="mt-2 rounded border p-2 text-xs">
              <summary className="flex items-center gap-2 cursor-pointer font-medium text-muted-foreground">
                <HelpCircle className="h-4 w-4" />
                Como obter as coordenadas x, y?
              </summary>
              <div className="mt-2 space-y-1 text-muted-foreground pl-6">
                <p>1. Abra o PDF num editor (ex.: Adobe Acrobat, PDF-XChange) e ative a régua.</p>
                <p>2. Medida em pontos: 1 cm ≈ 28 pts. Página A4 = 595 pts de largura × 842 pts de altura.</p>
                <p>3. A origem (0,0) fica no canto inferior-esquerdo — o eixo Y sobe para cima.</p>
                <p>4. Experimente valores e use o Preview para ajustar.</p>
              </div>
            </details>
            <div className="mt-2 space-y-2 max-h-64 overflow-auto">
              {coordinateItems.map((item, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 p-2 rounded border text-sm">
                  <Input
                    type="number"
                    placeholder="Pág"
                    className="w-16 h-8"
                    min={0}
                    value={item.pageIndex}
                    onChange={(e) => updateCoordinateItem(i, { pageIndex: parseInt(e.target.value, 10) || 0 })}
                  />
                  <Input
                    type="number"
                    placeholder="X"
                    className="w-20 h-8"
                    value={item.x}
                    onChange={(e) => updateCoordinateItem(i, { x: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    type="number"
                    placeholder="Y"
                    className="w-20 h-8"
                    value={item.y}
                    onChange={(e) => updateCoordinateItem(i, { y: parseFloat(e.target.value) || 0 })}
                  />
                  <Select
                    value={item.campo}
                    onValueChange={(v) => updateCoordinateItem(i, { campo: v })}
                  >
                    <SelectTrigger className="h-8 w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {camposSistema.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCoordinateItem(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCoordinateItem}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar posição
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
