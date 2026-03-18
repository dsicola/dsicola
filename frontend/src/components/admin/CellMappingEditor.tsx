/**
 * Editor visual para mapeamento CELL_MAPPING (Excel por coordenadas).
 * Substitui edição manual de JSON por tabela com dropdowns.
 */
import { useState, useMemo } from "react";
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
import { configuracoesInstituicaoApi } from "@/services/api";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles, CheckCircle, Loader2, Eye } from "lucide-react";

type ColumnSpec = { coluna: string; campo: string; disciplina?: string };
type SingleSpec = { cell: string; campo: string };
type ListaItem = { tipo: "LISTA"; startRow: number; columns: ColumnSpec[] };
type SingleItem = { cell: string; campo: string };
type MappingItem = SingleItem | ListaItem;

const CAMPOS_GLOBAIS = [
  { value: "instituicao.nome", label: "Nome da instituição" },
  { value: "aluno.nomeCompleto", label: "Nome do aluno" },
  { value: "anoLetivo.ano", label: "Ano letivo" },
  { value: "turma", label: "Turma" },
  { value: "especialidade", label: "Especialidade" },
  { value: "anoLetivo", label: "Ano letivo" },
  { value: "classe", label: "Classe" },
];
const CAMPOS_ALUNO = [
  { value: "student.n", label: "Nº ordem" },
  { value: "student.fullName", label: "Nome completo" },
  { value: "student.numeroEstudante", label: "Nº estudante" },
  { value: "student.obs", label: "Observação" },
  { value: "student.estagio", label: "Estágio" },
  { value: "student.cfPlano", label: "CF Plano" },
  { value: "student.pap", label: "PAP" },
  { value: "student.classFinal", label: "Class. final" },
];
const CAMPOS_DISCIPLINA = [
  { value: "disciplina.disciplinaNome", label: "Nome disciplina" },
  { value: "disciplina.notaFinal", label: "Nota final" },
  { value: "disciplina.situacaoAcademica", label: "Situação" },
  { value: "disciplina.professorNome", label: "Professor" },
  { value: "disciplina.cargaHoraria", label: "C.H." },
];
const CAMPOS_NOTA = [
  { value: "nota.MAC", label: "MAC" },
  { value: "nota.CA", label: "CA" },
  { value: "nota.NPP", label: "NPP" },
  { value: "nota.NPG", label: "NPG" },
  { value: "nota.MT1", label: "MT1" },
  { value: "nota.MT2", label: "MT2" },
  { value: "nota.MT3", label: "MT3" },
  { value: "nota.HA", label: "HA" },
  { value: "nota.EX", label: "Exame" },
  { value: "nota.MFD", label: "MFD" },
  { value: "nota.CFD", label: "CFD" },
];
const CAMPOS_COL_PAUTA = [...CAMPOS_GLOBAIS, ...CAMPOS_ALUNO, ...CAMPOS_NOTA];
const CAMPOS_COL_BOLETIM = [...CAMPOS_GLOBAIS, { value: "aluno.nomeCompleto", label: "Nome aluno" }, { value: "aluno.numeroIdentificacao", label: "Nº estudante" }, { value: "anoLetivo.ano", label: "Ano letivo" }, ...CAMPOS_DISCIPLINA];

function normalizeListaColumns(columns: ColumnSpec[] | Record<string, string>): ColumnSpec[] {
  if (Array.isArray(columns)) return columns;
  return Object.entries(columns).map(([coluna, campo]) => ({ coluna, campo }));
}

function parseMappingJson(json: string): { items: MappingItem[] } {
  try {
    if (!json?.trim()) return { items: [] };
    const parsed = JSON.parse(json) as { items?: unknown[] };
    const raw = Array.isArray(parsed?.items) ? parsed.items : [];
    const items: MappingItem[] = raw.map((i: unknown) => {
      const it = i as Record<string, unknown>;
      if (it?.tipo === "LISTA" && it.columns) {
        return { ...it, columns: normalizeListaColumns(it.columns as ColumnSpec[] | Record<string, string>) };
      }
      return i as MappingItem;
    });
    return { items };
  } catch {
    return { items: [] };
  }
}

function buildMappingJson(items: MappingItem[]): string {
  return JSON.stringify({ items }, null, 2);
}

export function CellMappingEditor({
  value,
  onChange,
  excelTemplateBase64,
  disciplinas = [],
  tipo = "PAUTA_CONCLUSAO",
}: {
  value: string;
  onChange: (json: string) => void;
  excelTemplateBase64?: string;
  disciplinas?: string[];
  tipo?: "PAUTA_CONCLUSAO" | "BOLETIM" | "MINI_PAUTA";
}) {
  const { items } = parseMappingJson(value);
  const [suggesting, setSuggesting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const listaItem = items.find((i): i is ListaItem => "tipo" in i && i.tipo === "LISTA") as ListaItem | undefined;
  const singleItems = items.filter((i): i is SingleItem => !("tipo" in i) || i.tipo !== "LISTA") as SingleItem[];

  const updateItems = (newItems: MappingItem[]) => {
    onChange(buildMappingJson(newItems));
  };

  const handleSuggest = async () => {
    if (!excelTemplateBase64?.trim()) {
      toast.error("Carregue o modelo Excel antes de sugerir.");
      return;
    }
    setSuggesting(true);
    try {
      const result = await configuracoesInstituicaoApi.analyzeExcelTemplate(excelTemplateBase64);
      const newItems: MappingItem[] = [];
      if (result.suggestedMapping?.singles?.length) {
        newItems.push(...result.suggestedMapping.singles);
      }
      if (result.suggestedMapping?.lista) {
        const { startRow, columns } = result.suggestedMapping.lista;
        newItems.push({ tipo: "LISTA", startRow, columns });
      }
      if (newItems.length > 0) {
        updateItems(newItems);
        const conf = result.confidence != null ? Math.round(result.confidence * 100) : null;
        const msg = conf != null
          ? `Mapeamento sugerido aplicado (confiança ${conf}%). Revise e ajuste se necessário.`
          : "Mapeamento sugerido aplicado. Revise e ajuste se necessário.";
        toast.success(msg);
      } else {
        toast.info("Não foi possível sugerir mapeamento automático.");
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Erro ao analisar Excel");
    } finally {
      setSuggesting(false);
    }
  };

  const handlePreview = async () => {
    const currentJson = buildMappingJson(items);
    if (!currentJson || currentJson === '{"items":[]}') {
      toast.error("Adicione mapeamentos antes de visualizar.");
      return;
    }
    if (!excelTemplateBase64?.trim()) {
      toast.error("Carregue o modelo Excel antes de visualizar.");
      return;
    }
    setPreviewing(true);
    try {
      const { excelBase64 } = await configuracoesInstituicaoApi.previewExcelCellMapping({
        excelTemplateBase64,
        excelCellMappingJson: currentJson,
      });
      const blob = await fetch(`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${excelBase64}`).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `preview-pauta-conclusao-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Preview descarregado. Abra o ficheiro para ver o resultado.");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Erro ao gerar preview");
    } finally {
      setPreviewing(false);
    }
  };

  const handleValidate = async () => {
    const currentJson = buildMappingJson(items);
    if (!currentJson || currentJson === '{"items":[]}') {
      toast.error("Adicione mapeamentos antes de validar.");
      return;
    }
    setValidating(true);
    try {
      const result = await configuracoesInstituicaoApi.validateCellMapping({
        excelCellMappingJson: currentJson,
        excelTemplateBase64: excelTemplateBase64 || undefined,
        disciplinas: disciplinas.length ? disciplinas : undefined,
      });
      if (result.valid && result.errors.length === 0 && result.warnings.length === 0) {
        toast.success("Mapeamento válido.");
      } else if (result.errors.length > 0) {
        toast.error(result.errors.join("; "));
      } else if (result.warnings.length > 0) {
        toast.warning(result.warnings.join("; "));
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Erro ao validar");
    } finally {
      setValidating(false);
    }
  };

  const addSingle = () => {
    const newItems = [...items];
    newItems.push({ cell: "A1", campo: "instituicao.nome" });
    updateItems(newItems);
  };

  const removeSingle = (idx: number) => {
    const singles = items.filter((i): i is SingleItem => !("tipo" in i) || i.tipo !== "LISTA");
    const removed = singles.splice(idx, 1);
    const rest = items.filter((i) => i !== removed[0]);
    updateItems(rest);
  };

  const updateSingle = (idx: number, field: "cell" | "campo", val: string) => {
    const singles = items.filter((i): i is SingleItem => !("tipo" in i) || i.tipo !== "LISTA");
    const listas = items.filter((i): i is ListaItem => "tipo" in i && i.tipo === "LISTA");
    const s = { ...singles[idx], [field]: val };
    singles[idx] = s;
    updateItems([...singles, ...listas]);
  };

  const listSource = tipo === "BOLETIM" ? "disciplinas" : "alunos";
  const listaColumns = listaItem?.columns ?? [];

  const setListaStartRow = (startRow: number) => {
    const singles = items.filter((i): i is SingleItem => !("tipo" in i) || i.tipo !== "LISTA");
    const lista = listaItem ? { ...listaItem, startRow, listSource } : { tipo: "LISTA" as const, startRow, listSource, columns: [] as ColumnSpec[] };
    const otherListas = items.filter((i): i is ListaItem => "tipo" in i && i.tipo === "LISTA" && i !== listaItem);
    updateItems([...singles, lista, ...otherListas]);
  };
  const addListaColumn = () => {
    const lista = listaItem ?? { tipo: "LISTA" as const, startRow: 5, listSource, columns: [] as ColumnSpec[] };
    const defaultCampo = tipo === "BOLETIM" ? "disciplina.disciplinaNome" : "student.fullName";
    const newCols = [...lista.columns, { coluna: "B", campo: defaultCampo }];
    const singles = items.filter((i): i is SingleItem => !("tipo" in i) || i.tipo !== "LISTA");
    const otherListas = items.filter((i): i is ListaItem => "tipo" in i && i.tipo === "LISTA" && i !== lista);
    updateItems([...singles, { ...lista, listSource, columns: newCols }, ...otherListas]);
  };

  const updateListaColumn = (colIdx: number, field: keyof ColumnSpec, val: string) => {
    const lista = listaItem!;
    const newCols = [...lista.columns];
    newCols[colIdx] = { ...newCols[colIdx], [field]: val };
    const singles = items.filter((i): i is SingleItem => !("tipo" in i) || i.tipo !== "LISTA");
    const otherListas = items.filter((i): i is ListaItem => "tipo" in i && i.tipo === "LISTA" && i !== lista);
    updateItems([...singles, { ...lista, listSource, columns: newCols }, ...otherListas]);
  };

  const removeListaColumn = (colIdx: number) => {
    const lista = listaItem!;
    const newCols = lista.columns.filter((_, i) => i !== colIdx);
    const singles = items.filter((i): i is SingleItem => !("tipo" in i) || i.tipo !== "LISTA");
    const otherListas = items.filter((i): i is ListaItem => "tipo" in i && i.tipo === "LISTA" && i !== lista);
    if (newCols.length === 0) {
      updateItems([...singles, ...otherListas]);
    } else {
      updateItems([...singles, { ...lista, listSource, columns: newCols }, ...otherListas]);
    }
  };

  const ensureLista = () => {
    if (listaItem) return;
    const defaultCampo = tipo === "BOLETIM" ? "disciplina.disciplinaNome" : "student.fullName";
    const singles = items.filter((i): i is SingleItem => !("tipo" in i) || i.tipo !== "LISTA");
    updateItems([...singles, { tipo: "LISTA", startRow: 5, listSource, columns: [{ coluna: "B", campo: defaultCampo }] }]);
  };

  const colLetters = useMemo(() => {
    const letters: string[] = [];
    for (let i = 0; i < 26; i++) letters.push(String.fromCharCode(65 + i));
    for (let i = 0; i < 26; i++)
      for (let j = 0; j < 26; j++) letters.push(String.fromCharCode(65 + i) + String.fromCharCode(65 + j));
    return letters;
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleSuggest} disabled={suggesting || !excelTemplateBase64}>
          {suggesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Sugerir mapeamento
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleValidate} disabled={validating}>
          {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Validar
        </Button>
        {tipo === "PAUTA_CONCLUSAO" && (
          <Button type="button" variant="outline" size="sm" onClick={handlePreview} disabled={previewing || !excelTemplateBase64}>
            {previewing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            Visualizar preenchimento
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={addSingle}>
          <Plus className="h-4 w-4 mr-2" /> Célula única
        </Button>
      </div>

      {singleItems.length > 0 && (
        <div className="space-y-2">
          <Label>Células únicas</Label>
          <div className="rounded border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-2 font-medium">Célula</th>
                  <th className="text-left p-2 font-medium">Campo</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {singleItems.map((s, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="p-2">
                      <Input
                        value={s.cell}
                        onChange={(e) => updateSingle(idx, "cell", e.target.value.toUpperCase())}
                        placeholder="B2"
                        className="w-20 font-mono"
                      />
                    </td>
                    <td className="p-2">
                      <Select value={s.campo} onValueChange={(v) => updateSingle(idx, "campo", v)}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CAMPOS_GLOBAIS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeSingle(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addSingle}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar célula
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{tipo === "BOLETIM" ? "Lista de disciplinas (uma linha por disciplina)" : "Lista de alunos (uma linha por aluno)"}</Label>
          {!listaItem && (
            <Button type="button" variant="outline" size="sm" onClick={ensureLista}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar lista
            </Button>
          )}
        </div>
        {listaItem && (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Linha inicial:</Label>
              <Input
                type="number"
                min={1}
                value={listaItem.startRow}
                onChange={(e) => setListaStartRow(parseInt(e.target.value, 10) || 1)}
                className="w-20"
              />
            </div>
            <div className="rounded border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-2 font-medium">Coluna Excel</th>
                    <th className="text-left p-2 font-medium">Campo</th>
                    <th className="text-left p-2 font-medium">Disciplina (opcional)</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {listaColumns.map((col, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="p-2">
                        <Select value={col.coluna} onValueChange={(v) => updateListaColumn(idx, "coluna", v)}>
                          <SelectTrigger className="h-8 w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {colLetters.slice(0, 52).map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Select value={col.campo} onValueChange={(v) => updateListaColumn(idx, "campo", v)}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(tipo === "BOLETIM" ? CAMPOS_COL_BOLETIM : CAMPOS_COL_PAUTA).map((c) => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Select
                          value={col.disciplina ?? "__none__"}
                          onValueChange={(v) => updateListaColumn(idx, "disciplina", v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">—</SelectItem>
                            {disciplinas.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeListaColumn(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addListaColumn}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar coluna
            </Button>
          </>
        )}
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Use "Sugerir mapeamento" (com o Excel carregado) ou adicione células/lista manualmente.
        </p>
      )}
    </div>
  );
}
