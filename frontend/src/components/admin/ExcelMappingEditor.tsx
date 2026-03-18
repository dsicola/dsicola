/**
 * Editor visual estilo Excel para mapeamento CELL_MAPPING.
 * O utilizador clica em células e associa campos do sistema diretamente.
 * Compatível com o JSON existente (items: singles + LISTA).
 */
import { useState, useMemo, useCallback } from "react";
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
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type ColumnSpec = { coluna: string; campo: string; disciplina?: string };
type ListaItem = { tipo: "LISTA"; startRow: number; listSource?: string; columns: ColumnSpec[] };
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

const CAMPOS_PAUTA = [...CAMPOS_GLOBAIS, ...CAMPOS_ALUNO, ...CAMPOS_NOTA];
const CAMPOS_BOLETIM = [
  ...CAMPOS_GLOBAIS,
  { value: "aluno.nomeCompleto", label: "Nome aluno" },
  { value: "aluno.numeroIdentificacao", label: "Nº estudante" },
  { value: "anoLetivo.ano", label: "Ano letivo" },
  ...CAMPOS_DISCIPLINA,
];

const CAMPOS_ALUNO_BOLETIM = [
  { value: "aluno.nomeCompleto", label: "Nome aluno" },
  { value: "aluno.numeroIdentificacao", label: "Nº estudante" },
  { value: "anoLetivo.ano", label: "Ano letivo" },
];
const CATEGORIAS_PAUTA = [
  { titulo: "Instituição / Global", campos: CAMPOS_GLOBAIS },
  { titulo: "Aluno", campos: CAMPOS_ALUNO },
  { titulo: "Notas", campos: CAMPOS_NOTA },
];
const CATEGORIAS_BOLETIM = [
  { titulo: "Instituição / Global", campos: CAMPOS_GLOBAIS },
  { titulo: "Aluno", campos: CAMPOS_ALUNO_BOLETIM },
  { titulo: "Disciplinas", campos: CAMPOS_DISCIPLINA },
];

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
}

function parseExcelSheet(base64: string): ParsedSheet | null {
  try {
    const buf = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const workbook = XLSX.read(buf, { type: "array", cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return null;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet["!ref"]) return null;

    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const maxRows = range.e.r - range.s.r + 1;
    const maxCols = range.e.c - range.s.c + 1;
    const cells: (string | number)[][] = [];

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

    return { cells, maxRows, maxCols };
  } catch {
    return null;
  }
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

  const categorias = tipo === "BOLETIM" ? CATEGORIAS_BOLETIM : CATEGORIAS_PAUTA;
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

  const handleMapField = (campo: string, disciplina?: string) => {
    if (!selectedCell) {
      toast.error("Selecione uma célula primeiro (clique no Excel).");
      return;
    }
    const singles = items.filter(
      (i): i is SingleItem => !("tipo" in i) || i.tipo !== "LISTA"
    );
    const listas = items.filter(
      (i): i is ListaItem => "tipo" in i && i.tipo === "LISTA"
    );

    if (listModeStartRow !== null) {
      const row = parseInt(selectedCell.replace(/\D/g, ""), 10);
      const col = selectedCell.replace(/\d+$/, "").toUpperCase();
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
        (s) => s.cell.toUpperCase() === selectedCell.toUpperCase()
      );
      let newSingles = [...singles];
      if (existingIdx >= 0) newSingles[existingIdx] = { cell: selectedCell, campo };
      else newSingles.push({ cell: selectedCell, campo });
      newSingles.sort(
        (a, b) =>
          parseInt(a.cell.replace(/\D/g, ""), 10) - parseInt(b.cell.replace(/\D/g, ""), 10) ||
          colLetters.indexOf(a.cell.replace(/\d/g, "")) - colLetters.indexOf(b.cell.replace(/\d/g, ""))
      );
      updateItems([...newSingles, ...listas]);
      toast.success(`${selectedCell} → ${campo}`);
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
      const result = await configuracoesInstituicaoApi.analyzeExcelTemplate(excelTemplateBase64);
      const newItems: MappingItem[] = [];
      if (result.suggestedMapping?.singles?.length) {
        newItems.push(...result.suggestedMapping.singles);
      }
      if (result.suggestedMapping?.lista) {
        const { startRow, columns } = result.suggestedMapping.lista;
        newItems.push({
          tipo: "LISTA",
          startRow,
          listSource,
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
            ? `Mapeamento sugerido (confiança ${conf}%). Revise no grid.`
            : "Mapeamento sugerido. Revise no grid."
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
    try {
      const { excelBase64 } = await configuracoesInstituicaoApi.previewExcelCellMapping({
        excelTemplateBase64,
        excelCellMappingJson: currentJson,
      });
      const blob = await fetch(
        `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${excelBase64}`
      ).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `preview-pauta-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Preview descarregado. Abra o ficheiro para ver o resultado.");
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

  const { cells, maxRows, maxCols } = sheet;
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
        <Button type="button" variant="outline" size="sm" onClick={handleValidate} disabled={validating} data-testid="btn-validar">
          {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Validar
        </Button>
        {tipo === "PAUTA_CONCLUSAO" && (
          <Button type="button" variant="outline" size="sm" onClick={handlePreview} disabled={previewing || items.length === 0} data-testid="btn-preview-excel">
            {previewing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            Preview
          </Button>
        )}
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
        <strong>Coordenadas:</strong> Letra = coluna (A, B, C…), número = linha (1, 2, 3…). Ex.: B5 = coluna B, linha 5. Clique numa célula → depois num campo à direita. Clique em <strong>Guardar</strong> no final para aplicar.
      </p>

      {/* Grid + Sidebar */}
      <div className="flex gap-4 min-h-[400px]">
        {/* Excel Grid */}
        <div className="flex-1 min-w-0 overflow-hidden border rounded-lg bg-white" data-testid="excel-grid-container">
          <ScrollArea className="h-[min(60vh,500px)]">
            <div
              className="inline-block p-2"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
            >
              <div className="mb-2 rounded bg-primary/5 border border-primary/20 px-3 py-2 text-xs space-y-1">
                <div><strong>Como mapear:</strong> 1) Clique numa célula (ex: B5). 2) Clique num campo na barra lateral direita.</div>
                <div className="text-muted-foreground">Para a tabela de {tipo === "BOLETIM" ? "disciplinas" : "alunos"}: clique na célula da primeira linha → &quot;Definir como início da lista&quot; → depois mapeie cada coluna clicando nas células.</div>
                <div className="text-muted-foreground">Botão direito numa célula mapeada = remover mapeamento.</div>
              </div>
              <table className="border-collapse text-xs font-mono">
                <thead>
                  <tr>
                    <th className="w-10 h-7 border bg-muted/50 font-medium sticky left-0 top-0 z-20 bg-muted/90 backdrop-blur" />
                    {colLetters.slice(0, displayCols).map((c) => (
                      <th key={c} className="min-w-[4rem] h-7 border bg-muted/50 font-medium sticky top-0 z-10 bg-muted/80 backdrop-blur">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cells.slice(0, displayRows).map((row, r) => {
                    const isHeaderRow = r === 0;
                    return (
                    <tr key={r} className={isHeaderRow ? "bg-muted/40" : ""}>
                      <td className={`w-10 h-6 border text-center text-muted-foreground sticky left-0 z-10 backdrop-blur ${isHeaderRow ? "bg-muted/90 font-medium" : "bg-muted/80"}`}>
                        {r + 1}
                      </td>
                      {row.map((val, c) => {
                        const ref = cellRef(c, r);
                        const mapping = getMappingForCell(ref);
                        const isListStart =
                          listaItem && r + 1 === listaItem.startRow;
                        const isSelected = selectedCell === ref;
                        return (
                          <ContextMenu key={c}>
                            <ContextMenuTrigger asChild>
                              <td
                                className={`min-w-[4rem] h-6 border px-1 truncate max-w-[8rem] cursor-pointer select-none ${
                                  mapping
                                    ? "bg-primary/15 text-primary font-medium"
                                    : isListStart
                                    ? "bg-amber-100 dark:bg-amber-900/30"
                                    : isHeaderRow
                                    ? "bg-muted/50 font-medium"
                                    : ""
                                } ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}
                                onClick={() => {
                                  setSelectedCell(ref);
                                  if (listModeStartRow !== null) setListModeStartRow(null);
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
              <>Célula: {selectedCell}. Clique num campo para mapear.</>
            ) : (
              <>Clique numa célula no Excel primeiro.</>
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
                        className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted truncate"
                        onClick={() => handleMapField(c.value, disciplinaParaMapear || undefined)}
                        title={c.label}
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
    </div>
  );
}
