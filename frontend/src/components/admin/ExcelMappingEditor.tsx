/**
 * Editor de grelha do modelo Excel (CELL_MAPPING): primeira folha, referências A1, B2…
 * O utilizador clica ou arrasta campos para as células. Compatível com o JSON existente (items: singles + LISTA).
 */
import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { tInstitution } from "@/utils/institutionI18n";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { configuracoesInstituicaoApi } from "@/services/api";
import { toast } from "sonner";
import {
  Sparkles,
  CheckCircle,
  Loader2,
  Eye,
  Trash2,
  ListStart,
  ZoomIn,
  ZoomOut,
  Search,
  ExternalLink,
  Download,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ExcelStyledPreview } from "@/components/documents/ExcelStyledPreview";
import {
  CATEGORIAS_EXCEL_BOLETIM,
  CATEGORIAS_EXCEL_MINI_PAUTA,
  CATEGORIAS_EXCEL_PAUTA_CONCLUSAO,
  DICA_MAPEAMENTO_EXCEL,
} from "@/config/excelCellMappingFields";

type ColumnSpec = { coluna: string; campo: string; disciplina?: string };
type ListaItem = { tipo: "LISTA"; startRow: number; listSource?: string; columns: ColumnSpec[] };
type SingleItem = { cell: string; campo: string };
type MappingItem = SingleItem | ListaItem;

function parseMappingJson(json: string): { items: MappingItem[] } {
  try {
    if (!json?.trim()) return { items: [] };
    const parsed = JSON.parse(json) as { items?: unknown[] };
    const raw = Array.isArray(parsed?.items) ? parsed.items : [];
    const items: MappingItem[] = raw.map((i: unknown) => {
      const it = i as Record<string, unknown>;
      if (it?.tipo === "LISTA" && it.columns) {
        const cols = it.columns as (ColumnSpec | Record<string, string>)[];
        return {
          ...it,
          columns: Array.isArray(cols)
            ? cols.map((c) =>
                typeof c === "object" && c !== null && "coluna" in c && "campo" in c
                  ? (c as ColumnSpec)
                  : { coluna: Object.keys(c)[0] ?? "A", campo: Object.values(c)[0] ?? "" }
              )
            : [],
        };
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

function encodeCol(n: number): string {
  let s = "";
  n++;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellRef(col: number, row: number): string {
  return `${encodeCol(col)}${row + 1}`;
}

interface ParsedSheet {
  cells: (string | number)[][];
  maxRows: number;
  maxCols: number;
  colWidths: number[];  // px por coluna
  rowHeights: number[]; // px por linha
  merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
}

function parseExcelSheet(base64: string): ParsedSheet | null {
  try {
    const buf = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const workbook = XLSX.read(buf, {
      type: "array",
      cellDates: false,
      cellStyles: true,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return null;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet["!ref"]) return null;

    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const maxRows = range.e.r - range.s.r + 1;
    const maxCols = range.e.c - range.s.c + 1;
    const cells: (string | number)[][] = [];

    // Larguras de colunas (preservar formato original)
    const colWidths: number[] = [];
    const cols = sheet["!cols"] as Array<{ wch?: number; wpx?: number }> | undefined;
    for (let c = 0; c <= range.e.c; c++) {
      const col = cols?.[c];
      const w = col?.wpx ?? (typeof col?.wch === "number" ? col.wch * 8 : 64);
      colWidths.push(Math.max(24, w));
    }

    // Alturas de linhas (preservar formato original)
    const rowHeights: number[] = [];
    const rows = sheet["!rows"] as Array<{ hpt?: number; hpx?: number }> | undefined;
    for (let r = 0; r <= range.e.r; r++) {
      const row = rows?.[r];
      const h = row?.hpx ?? (typeof row?.hpt === "number" ? row.hpt * 1.333 : 24);
      rowHeights.push(Math.max(20, h));
    }

    // Células merged
    const merges = (sheet["!merges"] ?? []) as Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;

    for (let r = 0; r <= range.e.r; r++) {
      const row: (string | number)[] = [];
      for (let c = 0; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        const v = cell?.v;
        const val =
          typeof v === "string" ? v : typeof v === "number" && !Number.isNaN(v) ? v : "";
        row.push(val);
      }
      cells.push(row);
    }

    return { cells, maxRows, maxCols, colWidths, rowHeights, merges };
  } catch {
    return null;
  }
}

function isMergeStart(
  r: number,
  c: number,
  merges: ParsedSheet["merges"]
): { rowspan: number; colspan: number } | null {
  for (const m of merges) {
    if (m.s.r === r && m.s.c === c) {
      return {
        rowspan: m.e.r - m.s.r + 1,
        colspan: m.e.c - m.s.c + 1,
      };
    }
  }
  return null;
}

function isCellInMerge(r: number, c: number, merges: ParsedSheet["merges"]): boolean {
  for (const m of merges) {
    if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) {
      if (r === m.s.r && c === m.s.c) return false;
      return true;
    }
  }
  return false;
}

export function ExcelMappingEditor({
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
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [listModeStartRow, setListModeStartRow] = useState<number | null>(null);
  const [fieldSearch, setFieldSearch] = useState("");
  const [zoom, setZoom] = useState(100);
  const [disciplinaParaMapear, setDisciplinaParaMapear] = useState<string>("");
  const [suggesting, setSuggesting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewPdfBase64, setPreviewPdfBase64] = useState<string | null>(null);
  const [previewExcelBase64, setPreviewExcelBase64] = useState<string | null>(null);
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const { t } = useTranslation();
  const { isSecundario } = useInstituicao();

  const listSource = tipo === "BOLETIM" ? "disciplinas" : "alunos";
  const listaItem = items.find((i): i is ListaItem => "tipo" in i && i.tipo === "LISTA") as
    | ListaItem
    | undefined;
  const singleItems = items.filter(
    (i): i is SingleItem => !("tipo" in i) || i.tipo !== "LISTA"
  ) as SingleItem[];

  const sheet = useMemo(
    () => (excelTemplateBase64 ? parseExcelSheet(excelTemplateBase64) : null),
    [excelTemplateBase64]
  );

  const colLetters = useMemo(() => {
    const letters: string[] = [];
    for (let i = 0; i < 26; i++) letters.push(String.fromCharCode(65 + i));
    for (let i = 0; i < 26; i++) {
      for (let j = 0; j < 26; j++) letters.push(String.fromCharCode(65 + i) + String.fromCharCode(65 + j));
    }
    return letters;
  }, []);

  const getMappingForCell = useCallback(
    (cellRef: string): { campo: string; disciplina?: string } | null => {
      for (const s of singleItems) {
        if (s.cell.toUpperCase() === cellRef.toUpperCase()) return { campo: s.campo };
      }
      if (listaItem) {
        const [col, rowStr] = [
          cellRef.replace(/\d+$/, ""),
          parseInt(cellRef.replace(/\D/g, ""), 10),
        ];
        if (rowStr >= listaItem.startRow) {
          for (const colSpec of listaItem.columns) {
            if (colSpec.coluna.toUpperCase() === col.toUpperCase())
              return {
                campo: colSpec.campo,
                disciplina: colSpec.disciplina,
              };
          }
        }
      }
      return null;
    },
    [singleItems, listaItem]
  );

  const updateItems = useCallback(
    (newItems: MappingItem[]) => {
      onChange(buildMappingJson(newItems));
    },
    [onChange]
  );

  const categorias = useMemo(() => {
    if (tipo === "BOLETIM") return CATEGORIAS_EXCEL_BOLETIM;
    if (tipo === "MINI_PAUTA") {
      const labelTrilha = tInstitution(t, "excelLabelTrilha", isSecundario);
      const valorTrilha = tInstitution(t, "excelValorTrilha", isSecundario);
      return CATEGORIAS_EXCEL_MINI_PAUTA.map((cat, idx) => {
        if (idx !== 0) return cat;
        const campos = cat.campos.map((c) => {
          if (c.value === "labelCursoClasse") return { ...c, label: labelTrilha };
          if (c.value === "valorCursoClasse") return { ...c, label: valorTrilha };
          return c;
        });
        return { ...cat, campos };
      });
    }
    return CATEGORIAS_EXCEL_PAUTA_CONCLUSAO;
  }, [tipo, t, isSecundario]);
  const labelPorCampo = useMemo(() => {
    const m: Record<string, string> = {};
    for (const cat of categorias) {
      for (const c of cat.campos) m[c.value] = c.label;
    }
    return m;
  }, [categorias]);
  const categoriasFiltradas = useMemo(() => {
    if (!fieldSearch.trim()) return categorias;
    const q = fieldSearch.toLowerCase();
    return categorias
      .map((cat) => ({
        ...cat,
        campos: cat.campos.filter(
          (c) =>
            c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.campos.length > 0);
  }, [categorias, fieldSearch]);

  const handleMapField = (campo: string, disciplina?: string, cellRef?: string) => {
    const effectiveCell = cellRef ?? selectedCell;
    if (!effectiveCell) {
      toast.error("Selecione uma célula primeiro (clique ou arraste um campo para a célula).");
      return;
    }
    const singles = items.filter(
      (i): i is SingleItem => !("tipo" in i) || i.tipo !== "LISTA"
    );
    const listas = items.filter(
      (i): i is ListaItem => "tipo" in i && i.tipo === "LISTA"
    );

    const row = parseInt(effectiveCell.replace(/\D/g, ""), 10);
    const col = effectiveCell.replace(/\d+$/, "").toUpperCase();
    const useListMode = listModeStartRow !== null && row >= listModeStartRow;
    if (useListMode) {
      const lista =
        listaItem ??
        ({
          tipo: "LISTA" as const,
          startRow: listModeStartRow,
          listSource,
          columns: [],
        } as ListaItem);
      const newCols = lista.columns.filter((c) => c.coluna !== col);
      newCols.push({ coluna: col, campo, disciplina: disciplina || undefined });
      newCols.sort((a, b) => colLetters.indexOf(a.coluna) - colLetters.indexOf(b.coluna));
      const updatedLista = { ...lista, columns: newCols };
      const otherListas = listas.filter((l) => l !== listaItem);
      updateItems([...singles, updatedLista, ...otherListas]);
      toast.success(`Coluna ${col} → ${campo}`);
    } else {
      const existingIdx = singles.findIndex(
        (s) => s.cell.toUpperCase() === effectiveCell.toUpperCase()
      );
      const newSingles = [...singles];
      if (existingIdx >= 0) newSingles[existingIdx] = { cell: effectiveCell, campo };
      else newSingles.push({ cell: effectiveCell, campo });
      newSingles.sort(
        (a, b) =>
          parseInt(a.cell.replace(/\D/g, ""), 10) - parseInt(b.cell.replace(/\D/g, ""), 10) ||
          colLetters.indexOf(a.cell.replace(/\d/g, "")) - colLetters.indexOf(b.cell.replace(/\d/g, ""))
      );
      updateItems([...newSingles, ...listas]);
      toast.success(`${effectiveCell} → ${campo}`);
    }
  };

  const handleSetListStart = () => {
    if (!selectedCell) {
      toast.error("Selecione a célula de início da lista.");
      return;
    }
    const row = parseInt(selectedCell.replace(/\D/g, ""), 10);
    setListModeStartRow(row);
    const singles = items.filter(
      (i): i is SingleItem => !("tipo" in i) || i.tipo !== "LISTA"
    );
    const lista: ListaItem = listaItem ?? {
      tipo: "LISTA",
      startRow: row,
      listSource,
      columns: [],
    };
    const updatedLista = { ...lista, startRow: row };
    const otherListas = items.filter(
      (i): i is ListaItem => "tipo" in i && i.tipo === "LISTA" && i !== listaItem
    );
    updateItems([...singles, updatedLista, ...otherListas]);
    toast.success(`Início da lista definido na linha ${row}. Mapeie as colunas clicando nas células.`);
  };

  const handleRemoveMapping = (cellRef: string) => {
    const singles = items.filter(
      (i): i is SingleItem => !("tipo" in i) || i.tipo !== "LISTA"
    );
    const listas = items.filter(
      (i): i is ListaItem => "tipo" in i && i.tipo === "LISTA"
    );

    const newSingles = singles.filter(
      (s) => s.cell.toUpperCase() !== cellRef.toUpperCase()
    );
    if (listaItem) {
      const row = parseInt(cellRef.replace(/\D/g, ""), 10);
      const col = cellRef.replace(/\d+$/, "").toUpperCase();
      if (row >= listaItem.startRow) {
        const newCols = listaItem.columns.filter(
          (c) => c.coluna.toUpperCase() !== col
        );
        if (newCols.length === 0) {
          updateItems([...newSingles, ...listas.filter((l) => l !== listaItem)]);
        } else {
          updateItems([
            ...newSingles,
            { ...listaItem, columns: newCols },
            ...listas.filter((l) => l !== listaItem),
          ]);
        }
        return;
      }
    }
    updateItems([...newSingles, ...listas]);
  };

  const handleSuggest = async () => {
    if (!excelTemplateBase64?.trim()) {
      toast.error("Carregue o modelo Excel antes de sugerir.");
      return;
    }
    setSuggesting(true);
    try {
      const result = await configuracoesInstituicaoApi.analyzeExcelTemplate(excelTemplateBase64, tipo);
      const newItems: MappingItem[] = [];
      if (result.suggestedMapping?.singles?.length) {
        newItems.push(...result.suggestedMapping.singles);
      }
      if (result.suggestedMapping?.lista) {
        const { startRow, columns, listSource: resultListSource } = result.suggestedMapping.lista;
        const effectiveListSource = resultListSource ?? (tipo === "BOLETIM" ? "disciplinas" : listSource);
        newItems.push({
          tipo: "LISTA",
          startRow,
          listSource: effectiveListSource,
          columns: Array.isArray(columns)
            ? columns.map((c) =>
                typeof c === "object" && c !== null && "coluna" in c && "campo" in c
                  ? (c as ColumnSpec)
                  : { coluna: (c as { col?: string }).col ?? "B", campo: (c as { campo?: string }).campo ?? "" }
              )
            : [],
        });
      }
      if (newItems.length > 0) {
        updateItems(newItems);
        const conf =
          result.confidence != null ? Math.round(result.confidence * 100) : null;
        toast.success(
          conf != null
            ? `Mapeamento sugerido (confiança ${conf}%). Revise no grid. Para formato oficial, use "Aplicar formato oficial" ou configure manualmente.`
            : "Mapeamento sugerido. Revise no grid. Para formato oficial, use \"Aplicar formato oficial\" ou configure manualmente."
        );
      } else {
        toast.info("Não foi possível sugerir mapeamento automático.");
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Erro ao analisar Excel");
    } finally {
      setSuggesting(false);
    }
  };

  const handleApplyPreset = async () => {
    if (!excelTemplateBase64?.trim()) {
      toast.error("Carregue o modelo Excel antes de aplicar o formato oficial.");
      return;
    }
    setSuggesting(true);
    try {
      const result = await configuracoesInstituicaoApi.analyzeExcelTemplate(
        excelTemplateBase64,
        tipo,
        { applyPreset: true }
      );
      const presetItems = (result as { appliedPresetMapping?: { items?: unknown[] } }).appliedPresetMapping?.items;
      if (!presetItems?.length) {
        toast.info("Formato oficial não disponível para este tipo. Use Sugerir mapeamento.");
        return;
      }
      const newItems: MappingItem[] = presetItems.map((it: unknown) => {
        const i = it as Record<string, unknown>;
        if (i.tipo === "LISTA" && i.startRow != null && i.columns) {
          const cols = Array.isArray(i.columns)
            ? (i.columns as { coluna?: string; campo?: string }[]).map((c) => ({
                coluna: c.coluna ?? "A",
                campo: c.campo ?? "",
              }))
            : [];
          return {
            tipo: "LISTA" as const,
            startRow: i.startRow as number,
            listSource: (i.listSource as "alunos" | "disciplinas") ?? (tipo === "BOLETIM" ? "disciplinas" : listSource),
            columns: cols,
          } as ListaItem;
        }
        if (i.cell && i.campo) {
          return { cell: String(i.cell), campo: String(i.campo) } as SingleItem;
        }
        return null;
      }).filter((x): x is MappingItem => x !== null);
      if (newItems.length > 0) {
        updateItems(newItems);
        toast.success("Formato oficial aplicado. Revise no grid e valide antes de guardar.");
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Erro ao aplicar formato oficial");
    } finally {
      setSuggesting(false);
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
    setPreviewPdfBase64(null);
    setPreviewExcelBase64(null);
    try {
      const res = await configuracoesInstituicaoApi.previewExcelCellMapping({
        excelTemplateBase64,
        excelCellMappingJson: currentJson,
        format: "pdf",
        tipo: tipo ?? "PAUTA_CONCLUSAO",
      });
      if (res.pdfBase64) {
        setPreviewPdfBase64(res.pdfBase64);
      } else if (res.excelBase64) {
        setPreviewExcelBase64(res.excelBase64);
      } else {
        toast.error("Nenhum resultado do preview.");
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Erro ao gerar preview");
    } finally {
      setPreviewing(false);
    }
  };

  const handleClear = () => {
    updateItems([]);
    setSelectedCell(null);
    setListModeStartRow(null);
    toast.info("Mapeamento limpo.");
  };

  if (!excelTemplateBase64?.trim()) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        Carregue o modelo Excel acima para ver a grelha e mapear clicando nas células.
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        Não foi possível ler o ficheiro Excel. Verifique se é um .xlsx válido.
      </div>
    );
  }

  const { cells, maxRows, maxCols, colWidths, rowHeights, merges } = sheet;
  const displayRows = Math.min(maxRows, 200);
  const displayCols = Math.min(maxCols, 52);

  return (
    <div className="flex flex-col gap-3" data-testid="excel-mapping-editor">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2" data-testid="excel-mapping-toolbar">
        <Button type="button" variant="outline" size="sm" onClick={handleSuggest} disabled={suggesting || !excelTemplateBase64} data-testid="btn-sugerir-mapeamento">
          {suggesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Sugerir mapeamento
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleApplyPreset} disabled={suggesting || !excelTemplateBase64} data-testid="btn-aplicar-formato-oficial" title="Aplica ordem padrão das colunas do modelo oficial">
          Aplicar formato oficial
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleValidate} disabled={validating} data-testid="btn-validar">
          {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Validar
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handlePreview} disabled={previewing || items.length === 0} data-testid="btn-preview-excel">
          {previewing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
          Ver preview
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleClear}>
          <Trash2 className="h-4 w-4 mr-2" />
          Limpar mapeamento
        </Button>
        <span className="text-xs text-muted-foreground self-center ml-2 px-2 py-1 rounded bg-muted/50">
          Guardar ↓ (botão no final do formulário)
        </span>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom((z) => Math.max(50, z - 25))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs w-10 text-center">{zoom}%</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom((z) => Math.min(150, z + 25))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        <strong>Grelha do modelo</strong> (primeiro separador do .xlsx, como no Excel). <strong>Passo a passo:</strong> 1) Clique ou arraste um campo para uma célula. 2) Tabela de {tipo === "BOLETIM" ? "disciplinas" : "alunos"}: primeira linha → &quot;Definir como início da lista&quot; → mapeie cada coluna. 3) <strong>Sugerir mapeamento</strong> ou <strong>Aplicar formato oficial</strong>. 4) <strong>Validar</strong> e <strong>Ver preview</strong> antes de <strong>Guardar</strong>.
      </p>
      {tipo === "PAUTA_CONCLUSAO" && (
        <p className="text-[11px] rounded-md border border-blue-200 bg-blue-50/90 dark:border-blue-900 dark:bg-blue-950/40 px-3 py-2 text-foreground/90">
          <strong>Pauta de conclusão:</strong> {DICA_MAPEAMENTO_EXCEL.PAUTA_CONCLUSAO}
        </p>
      )}
      {tipo === "BOLETIM" && (
        <p className="text-[11px] rounded-md border border-emerald-200 bg-emerald-50/90 dark:border-emerald-900 dark:bg-emerald-950/35 px-3 py-2 text-foreground/90">
          <strong>Boletim:</strong> {DICA_MAPEAMENTO_EXCEL.BOLETIM}
        </p>
      )}
      {tipo === "MINI_PAUTA" && (
        <p className="text-[11px] rounded-md border border-violet-200 bg-violet-50/90 dark:border-violet-900 dark:bg-violet-950/35 px-3 py-2 text-foreground/90">
          <strong>Mini pauta:</strong> {DICA_MAPEAMENTO_EXCEL.MINI_PAUTA}
        </p>
      )}

      {/* Grid + Sidebar */}
      <div className="flex gap-4 min-h-[400px]">
        {/* Excel Grid */}
        <div className="flex-1 min-w-0 overflow-hidden border rounded-lg bg-white" data-testid="excel-grid-container">
          <ScrollArea className="h-[min(60vh,500px)]">
            <div
              className="inline-block p-2"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
            >
              <div className="mb-2 rounded bg-primary/5 border border-primary/20 px-3 py-2.5 text-xs space-y-2">
                <div><strong>1. Células simples</strong> — Clique numa célula ou arraste um campo para ela.</div>
                <div><strong>2. Tabela de {tipo === "BOLETIM" ? "disciplinas" : "alunos"}</strong> — Clique na 1.ª célula da tabela → botão &quot;Definir como início da lista&quot; → arraste ou clique para mapear cada coluna (A, B, C…).</div>
                <div className="text-muted-foreground text-[10px]">Clique com o botão direito numa célula mapeada para remover.</div>
              </div>
              <table className="border-collapse text-xs font-mono">
                <thead>
                  <tr>
                    <th className="w-10 min-h-[28px] border bg-muted/50 font-medium sticky left-0 top-0 z-20 bg-muted/90 backdrop-blur" />
                    {colLetters.slice(0, displayCols).map((c, ci) => (
                      <th
                        key={c}
                        className="border bg-muted/50 font-medium sticky top-0 z-10 bg-muted/80 backdrop-blur"
                        style={{
                          minWidth: colWidths[ci] ?? 64,
                          width: colWidths[ci] ?? 64,
                          height: rowHeights[0] ?? 28,
                        }}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cells.slice(0, displayRows).map((row, r) => {
                    const isHeaderRow = r === 0;
                    const rowH = rowHeights[r] ?? 24;
                    return (
                    <tr key={r} className={isHeaderRow ? "bg-muted/40" : ""} style={{ height: rowH }}>
                      <td
                        className={`w-10 border text-center text-muted-foreground sticky left-0 z-10 backdrop-blur ${isHeaderRow ? "bg-muted/90 font-medium" : "bg-muted/80"}`}
                        style={{ minHeight: rowH, height: rowH }}
                      >
                        {r + 1}
                      </td>
                      {row.map((val, c) => {
                        if (isCellInMerge(r, c, merges)) return null;
                        const ref = cellRef(c, r);
                        const mergeSpan = isMergeStart(r, c, merges);
                        const mapping = getMappingForCell(ref);
                        const isListStart =
                          listaItem && r + 1 === listaItem.startRow;
                        const isSelected = selectedCell === ref;
                        const colW = colWidths[c] ?? 64;
                        const spanWidth = mergeSpan
                          ? Array.from({ length: mergeSpan.colspan }, (_, i) => colWidths[c + i] ?? 64).reduce((a, b) => a + b, 0)
                          : colW;
                        const spanHeight = mergeSpan
                          ? Array.from({ length: mergeSpan.rowspan }, (_, i) => rowHeights[r + i] ?? 24).reduce((a, b) => a + b, 0)
                          : rowH;
                        return (
                          <ContextMenu key={c}>
                            <ContextMenuTrigger asChild>
                              <td
                                className={`border px-1 truncate cursor-pointer select-none ${
                                  mapping
                                    ? "bg-primary/15 text-primary font-medium"
                                    : isListStart
                                    ? "bg-amber-100 dark:bg-amber-900/30"
                                    : isHeaderRow
                                    ? "bg-muted/50 font-medium"
                                    : ""
                                } ${isSelected ? "ring-2 ring-primary ring-inset" : ""} ${dragOverCell === ref ? "ring-2 ring-primary ring-offset-1 bg-primary/10" : ""}`}
                                style={{
                                  minWidth: colW,
                                  width: spanWidth,
                                  maxWidth: 400,
                                  minHeight: rowH,
                                  height: spanHeight,
                                }}
                                rowSpan={mergeSpan?.rowspan}
                                colSpan={mergeSpan?.colspan}
                                onClick={() => {
                                  setSelectedCell(ref);
                                  if (listModeStartRow !== null) setListModeStartRow(null);
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = "copy";
                                  setDragOverCell(ref);
                                }}
                                onDragLeave={() => setDragOverCell(null)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setDragOverCell(null);
                                  setDraggedField(null);
                                  const field = e.dataTransfer.getData("text/plain");
                                  if (field) handleMapField(field, disciplinaParaMapear || undefined, ref);
                                }}
                                title={
                                  mapping
                                    ? `${ref} → ${labelPorCampo[mapping.campo] ?? mapping.campo}${mapping.disciplina ? ` (${mapping.disciplina})` : ""}`
                                    : ref
                                }
                              >
                                {mapping ? (
                                  <span className="truncate block" title={labelPorCampo[mapping.campo] ?? mapping.campo}>
                                    {labelPorCampo[mapping.campo] ?? mapping.campo.split(".").pop() ?? mapping.campo}
                                  </span>
                                ) : (
                                  <span className="truncate block">
                                    {val !== "" && val !== undefined ? String(val) : ""}
                                  </span>
                                )}
                              </td>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              {mapping ? (
                                <ContextMenuItem
                                  className="text-destructive"
                                  onClick={() => handleRemoveMapping(ref)}
                                >
                                  Remover mapeamento
                                </ContextMenuItem>
                              ) : (
                                <ContextMenuItem disabled>
                                  Clique num campo à direita para mapear
                                </ContextMenuItem>
                              )}
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </tr>
                  );
                  })}
                </tbody>
              </table>
              {maxRows > displayRows && (
                <p className="text-xs text-muted-foreground mt-2">
                  Mostrando primeiras {displayRows} de {maxRows} linhas.
                </p>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </div>

        {/* Sidebar Campos */}
        <div className="w-64 shrink-0 flex flex-col gap-2 border rounded-lg p-3 bg-muted/10" data-testid="excel-mapping-sidebar">
          <div className="flex items-center gap-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar campo..."
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            {selectedCell ? (
              <>Célula {selectedCell} selecionada. Clique num campo abaixo ou arraste para a célula.</>
            ) : (
              <>Selecione uma célula no Excel (ou arraste um campo até à célula desejada).</>
            )}
          </div>
          {listModeStartRow !== null && (
            <>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Modo lista (linha {listModeStartRow}). Mapeie colunas.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setListModeStartRow(null)}
                className="text-xs"
              >
                Sair do modo lista
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSetListStart}
            disabled={!selectedCell}
            className="w-full"
            data-testid="btn-definir-inicio-lista"
          >
            <ListStart className="h-4 w-4 mr-2" />
            Definir como início da lista
          </Button>
          {listaItem && tipo === "PAUTA_CONCLUSAO" && disciplinas.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Disciplina (opcional, para notas):</span>
              <select
                value={disciplinaParaMapear}
                onChange={(e) => setDisciplinaParaMapear(e.target.value)}
                className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
              >
                <option value="">— Nenhuma —</option>
                {disciplinas.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-3 pr-2">
              {categoriasFiltradas.map((cat) => (
                <div key={cat.titulo}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {cat.titulo}
                  </div>
                  <div className="space-y-0.5">
                    {cat.campos.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", c.value);
                          e.dataTransfer.effectAllowed = "copy";
                          setDraggedField(c.value);
                        }}
                        onDragEnd={() => {
                          setDraggedField(null);
                          setDragOverCell(null);
                        }}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted truncate ${draggedField === c.value ? "opacity-60" : ""}`}
                        onClick={() => handleMapField(c.value, disciplinaParaMapear || undefined)}
                        title={`${c.label} (clique ou arraste para uma célula)`}
                      >
                        <span className="text-muted-foreground">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Dialog Preview PDF — idêntico ao ficheiro Excel gerado */}
      <Dialog open={!!previewPdfBase64} onOpenChange={(open) => !open && setPreviewPdfBase64(null)}>
        <DialogContent className="w-[min(95vw,1000px)] max-w-[95vw] h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Preview — Pauta de Conclusão</DialogTitle>
            <DialogDescription>
              Visualização idêntica ao ficheiro Excel exportado. Dados de exemplo.
            </DialogDescription>
          </DialogHeader>
          {previewPdfBase64 && (
            <div className="flex-1 min-h-0 overflow-auto px-6 pb-6 flex flex-col gap-2">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `data:application/pdf;base64,${previewPdfBase64}#view=FitH`;
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir em nova aba
                </Button>
              </div>
              <div className="w-full flex-1 min-h-[calc(90vh-12rem)] border rounded-lg bg-muted/20 overflow-auto">
                <iframe
                  src={`data:application/pdf;base64,${previewPdfBase64}#view=FitH`}
                  title="Preview Pauta"
                  className="w-full h-full min-h-[400px] border-0"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Preview Excel — quando conversão PDF falha, mostra tabela inline */}
      <Dialog open={!!previewExcelBase64} onOpenChange={(open) => !open && setPreviewExcelBase64(null)}>
        <DialogContent className="w-[min(95vw,1000px)] max-w-[95vw] h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Preview — Pauta de Conclusão</DialogTitle>
            <DialogDescription>
              Pré-visualização com alinhamento, células unidas e larguras como no ficheiro (conversão para PDF
              indisponível). Dados de exemplo.
            </DialogDescription>
          </DialogHeader>
          {previewExcelBase64 && (
            <div className="flex-1 min-h-0 overflow-auto px-6 pb-6 flex flex-col gap-2">
              <div className="flex justify-end shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const blob = await fetch(
                      `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${previewExcelBase64}`
                    ).then((r) => r.blob());
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `preview-pauta-${Date.now()}.xlsx`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descarregar Excel
                </Button>
              </div>
              <ScrollArea className="h-[min(55vh,500px)] flex-1 min-h-[280px] border rounded-lg bg-muted/30">
                <div className="min-h-[260px] p-1">
                  <ExcelStyledPreview
                    base64={previewExcelBase64}
                    className="h-[min(52vh,480px)] w-full min-h-[260px] border-0"
                  />
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
