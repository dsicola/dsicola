/**
 * Modelos de Documentos - Pré-visualização de mini pautas, certificados e declarações.
 * Permite importar modelos HTML oficiais do governo e vinculá-los por tipo/curso.
 * Multi-tenant: instituicaoId do JWT. Respeita tipoAcademico (SUPERIOR/SECUNDARIO).
 */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { configuracoesInstituicaoApi, turmasApi, cursosApi } from "@/services/api";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Award, FileCheck, ClipboardList, Loader2, Eye, Download, Upload, Pencil, Trash2, Info, FileDown, Link2, BookOpen, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { TemplateMappingDialog } from "./TemplateMappingDialog";
import { ExcelMappingEditor } from "./ExcelMappingEditor";
import { PdfMappingEditor, type PdfCoordinateItem } from "./PdfMappingEditor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as XLSX from "xlsx";
import { ScrollArea } from "@/components/ui/scroll-area";
import { injectCertificatePreviewStyles } from "@/utils/certificatePreviewUtils";

/** Converte Excel base64 numa grelha simples para pré-visualização inline */
function parseExcelForPreview(base64: string): (string | number)[][] | null {
  try {
    const buf = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet?.["!ref"]) return null;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const rows: (string | number)[][] = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: (string | number)[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        const v = cell?.v;
        row.push(typeof v === "string" ? v : typeof v === "number" && !Number.isNaN(v) ? v : "");
      }
      rows.push(row);
    }
    return rows;
  } catch {
    return null;
  }
}

const TIPOS_DOCUMENTO = [
  { value: "CERTIFICADO", label: "Certificado" },
  { value: "DECLARACAO_MATRICULA", label: "Declaração de Matrícula" },
  { value: "DECLARACAO_FREQUENCIA", label: "Declaração de Frequência" },
  { value: "MINI_PAUTA", label: "Mini Pauta" },
  { value: "PAUTA_CONCLUSAO", label: "Pauta de Conclusão" },
  { value: "BOLETIM", label: "Boletim" },
] as const;

/** Tipos que usam modelo Excel (.xlsx) — fonte única para evitar duplicação */
const TIPOS_EXCEL = ["BOLETIM", "PAUTA_CONCLUSAO", "MINI_PAUTA"] as const;
const isTipoExcel = (t: string) => TIPOS_EXCEL.includes(t as (typeof TIPOS_EXCEL)[number]);
/** Tipos Excel que não mostram orientação no form (layout fixo do governo) */
const TIPOS_EXCEL_SEM_ORIENTACAO = ["BOLETIM", "PAUTA_CONCLUSAO"];

const FORMATOS_CERT_DECL = [
  { value: "HTML", label: "HTML" },
  { value: "WORD", label: "Word (.docx)" },
  { value: "PDF", label: "PDF (.pdf)" },
] as const;

const FORMATO_BOLETIM = { value: "EXCEL", label: "Excel (.xlsx)" } as const;

/** Placeholders para modelos - constantes evitam ReferenceError em JSX quando o parser interpreta {{VAR}} */
const PH = {
  NOME_ALUNO: '\u007b\u007bNOME_ALUNO\u007d\u007d',
  CURSO: '\u007b\u007bCURSO\u007d\u007d',
  ANO_LETIVO: '\u007b\u007bANO_LETIVO\u007d\u007d',
  N_DOCUMENTO: '\u007b\u007bN_DOCUMENTO\u007d\u007d',
  LOGO_IMG: '\u007b\u007bLOGO_IMG\u007d\u007d',
  IMAGEM_FUNDO_URL: '\u007b\u007bIMAGEM_FUNDO_URL\u007d\u007d',
  MINISTERIO_SUPERIOR: '\u007b\u007bMINISTERIO_SUPERIOR\u007d\u007d',
  CARGO_ASSINATURA_1: '\u007b\u007bCARGO_ASSINATURA_1\u007d\u007d',
};

function ModelosImportadosSection({
  tipoAcademico,
  onPreviewDoc,
  onPreviewPauta,
  filterTipos,
  defaultTipo,
  tituloSecao,
  compactMode = false,
}: {
  tipoAcademico: "SUPERIOR" | "SECUNDARIO";
  onPreviewDoc: (tipo: "CERTIFICADO" | "DECLARACAO_MATRICULA" | "DECLARACAO_FREQUENCIA", tipoAcad: "SUPERIOR" | "SECUNDARIO", label: string) => void;
  onPreviewPauta?: (tipoPauta: "PROVISORIA" | "DEFINITIVA", label: string) => void;
  filterTipos?: string[];
  defaultTipo?: string;
  tituloSecao?: string;
  compactMode?: boolean;
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [mappingModelo, setMappingModelo] = useState<{
    id: string;
    nome: string;
    placeholders: string[];
    mappings: { campoTemplate: string; campoSistema: string }[];
  } | null>(null);
  const [docxUploadOpen, setDocxUploadOpen] = useState(false);
  const [docxUploadNome, setDocxUploadNome] = useState("");
  const [docxUploadTipo, setDocxUploadTipo] = useState("DOCUMENTO_OFICIAL");
  const [docxUploadFile, setDocxUploadFile] = useState<File | null>(null);
  const [docxUploading, setDocxUploading] = useState(false);
  const [pdfUploadOpen, setPdfUploadOpen] = useState(false);
  const [pdfUploadNome, setPdfUploadNome] = useState("");
  const [pdfUploadTipo, setPdfUploadTipo] = useState<"CERTIFICADO" | "DECLARACAO_MATRICULA" | "DECLARACAO_FREQUENCIA">("CERTIFICADO");
  const [pdfUploadFile, setPdfUploadFile] = useState<File | null>(null);
  const [pdfUploadBase64, setPdfUploadBase64] = useState("");
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfUploadMode, setPdfUploadMode] = useState<"FORM_FIELDS" | "COORDINATES">("FORM_FIELDS");
  const [pdfFields, setPdfFields] = useState<Array<{ fieldName: string; type: string }>>([]);
  const [pdfMappings, setPdfMappings] = useState<Record<string, string>>({});
  const [pdfCoordinateItems, setPdfCoordinateItems] = useState<PdfCoordinateItem[]>([{ pageIndex: 0, x: 100, y: 400, campo: "student.fullName" }]);
  const [formData, setFormData] = useState({
    tipo: "CERTIFICADO" as string,
    tipoAcademico: "" as string,
    cursoId: "ALL" as string,
    nome: "",
    descricao: "",
    formato: "HTML" as string,
    htmlTemplate: "",
    excelTemplateBase64: "" as string,
    excelTemplateMode: "PLACEHOLDER" as "PLACEHOLDER" | "CELL_MAPPING",
    excelCellMappingJson: "" as string,
    orientacaoPagina: "" as string,
    ativo: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [convertingFile, setConvertingFile] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const { data: modelosRaw = [], isLoading } = useQuery({
    queryKey: ["modelos-documento", tipoAcademico],
    queryFn: () => configuracoesInstituicaoApi.listarModelosDocumento({ tipoAcademico }),
  });
  // Isolamento: exibir apenas modelos do tipo da instituição ou "Ambos" (tipoAcademico null)
  // Se filterTipos definido, filtrar também por tipo de documento
  const modelos = modelosRaw.filter((m: { tipoAcademico?: string | null; tipo?: string }) => {
    if (!m.tipoAcademico || m.tipoAcademico === tipoAcademico) {
      if (filterTipos?.length) return filterTipos.includes(m.tipo ?? "");
      return true;
    }
    return false;
  });

  const { data: placeholders = [] } = useQuery({
    queryKey: ["modelos-documento-placeholders"],
    queryFn: () => configuracoesInstituicaoApi.listarPlaceholdersModelosDocumento(),
  });

  const { data: pautaConclusaoDados } = useQuery({
    queryKey: ["pauta-conclusao-dados", "preview"],
    queryFn: () => configuracoesInstituicaoApi.getPautaConclusaoSaudeDados(null),
    enabled: formData.tipo === "PAUTA_CONCLUSAO" && formData.excelTemplateMode === "CELL_MAPPING",
  });
  const disciplinasPauta = pautaConclusaoDados?.disciplinas ?? [];

  const { data: pdfAvailableFields = [] } = useQuery({
    queryKey: ["modelos-documento-available-fields"],
    queryFn: () => configuracoesInstituicaoApi.getAvailableFields(),
    enabled: pdfUploadOpen,
  });

  const isSecundario = tipoAcademico === "SECUNDARIO";
  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-modelos"],
    queryFn: () => cursosApi.getAll({ excludeTipo: "classe" }),
    enabled: !isSecundario,
  });

  const isExcelModelo = isTipoExcel(formData.tipo);
  const formatosDisponiveis = isExcelModelo ? [FORMATO_BOLETIM] : FORMATOS_CERT_DECL;

  const openCreate = () => {
    setEditingId(null);
    const tipoInicial = defaultTipo ?? "CERTIFICADO";
    const isExcelTipo = isTipoExcel(tipoInicial);
    setFormData({
      tipo: tipoInicial,
      tipoAcademico: tipoAcademico,
      cursoId: "ALL",
      nome: "",
      descricao: "",
      formato: isExcelTipo ? "EXCEL" : "HTML",
      htmlTemplate: "",
      excelTemplateBase64: "",
      excelTemplateMode: "PLACEHOLDER",
      excelCellMappingJson: "",
      orientacaoPagina: "",
      ativo: true,
    });
    setDialogOpen(true);
  };

  const openEdit = async (m: { id: string; tipo: string; tipoAcademico: string | null; cursoId: string | null; nome: string; descricao: string | null; htmlTemplate: string; formatoDocumento?: string | null; excelTemplateBase64?: string | null; excelTemplateMode?: string | null; excelCellMappingJson?: string | null; orientacaoPagina?: string | null; ativo: boolean }) => {
    const base64 = (m as { excelTemplateBase64?: string })?.excelTemplateBase64 ?? "";
    const isExcel = isTipoExcel(m.tipo);
    if (isExcel && !base64?.trim()) {
      setEditLoading(true);
      try {
        const full = await configuracoesInstituicaoApi.getModeloDocumento(m.id);
        const formato = full.formatoDocumento ?? "EXCEL";
        setEditingId(m.id);
        setFormData({
          tipo: full.tipo,
          tipoAcademico: full.tipoAcademico ?? tipoAcademico,
          cursoId: full.cursoId ?? "ALL",
          nome: full.nome,
          descricao: full.descricao ?? "",
          formato,
          htmlTemplate: full.htmlTemplate ?? "",
          excelTemplateBase64: full.excelTemplateBase64 ?? "",
          excelTemplateMode: (full.excelTemplateMode === "CELL_MAPPING" ? "CELL_MAPPING" : "PLACEHOLDER") as "PLACEHOLDER" | "CELL_MAPPING",
          excelCellMappingJson: full.excelCellMappingJson ?? "",
          orientacaoPagina: full.orientacaoPagina ?? "",
          ativo: full.ativo,
        });
        setDialogOpen(true);
      } catch (err) {
        toast.error((err as Error)?.message ?? "Erro ao carregar modelo");
      } finally {
        setEditLoading(false);
      }
      return;
    }
    setEditingId(m.id);
    const formato = m.formatoDocumento ?? (isExcel ? "EXCEL" : "HTML");
    setFormData({
      tipo: m.tipo,
      tipoAcademico: m.tipoAcademico ?? tipoAcademico,
      cursoId: m.cursoId ?? "ALL",
      nome: m.nome,
      descricao: m.descricao ?? "",
      formato,
      htmlTemplate: m.htmlTemplate ?? "",
      excelTemplateBase64: base64,
      excelTemplateMode: ((m as { excelTemplateMode?: string })?.excelTemplateMode === "CELL_MAPPING" ? "CELL_MAPPING" : "PLACEHOLDER") as "PLACEHOLDER" | "CELL_MAPPING",
      excelCellMappingJson: (m as { excelCellMappingJson?: string })?.excelCellMappingJson ?? "",
      orientacaoPagina: (m as { orientacaoPagina?: string | null }).orientacaoPagina ?? "",
      ativo: m.ativo,
    });
    setDialogOpen(true);
  };

  const handleWordFile = async (file: File) => {
    const ext = (file.name?.split(".").pop() ?? "").toLowerCase();
    if (ext !== "docx" && ext !== "doc") {
      toast.error("Use um ficheiro Word (.docx recomendado). Ficheiros .doc antigos podem falhar.");
      return;
    }
    setConvertingFile(true);
    try {
      const mammoth = await import("mammoth");
      const arr = await file.arrayBuffer();
      const { value } = await mammoth.convertToHtml({ arrayBuffer: arr });
      setFormData((f) => ({ ...f, htmlTemplate: value || "", formato: "WORD" }));
      toast.success("Word convertido para HTML. Revise o resultado.");
    } catch (e) {
      const msg = (e as Error)?.message || "";
      const mensagem = msg.toLowerCase().includes("format") || msg.toLowerCase().includes("formato")
        ? "O ficheiro não está num formato Word válido (.docx). Guarde o documento como .docx no Word e tente novamente."
        : msg || "Erro ao converter Word. Verifique se o ficheiro é um DOCX válido.";
      toast.error(mensagem);
    } finally {
      setConvertingFile(false);
    }
  };

  const handlePdfFile = async (file: File) => {
    setConvertingFile(true);
    try {
      const html = await configuracoesInstituicaoApi.convertPdfToHtml(file);
      setFormData((f) => ({ ...f, htmlTemplate: html, formato: "PDF" }));
      toast.success("PDF convertido para HTML. Revise o resultado.");
    } catch (e) {
      toast.error((e as Error)?.message || "Erro ao converter PDF");
    } finally {
      setConvertingFile(false);
    }
  };

  const handleExcelFile = async (file: File) => {
    const ext = (file.name?.split(".").pop() ?? "").toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      toast.error("Use um ficheiro Excel (.xlsx ou .xls).");
      return;
    }
    if (ext === "xls") {
      toast.info("Ficheiro .xls detetado. Para maior compatibilidade, guarde como .xlsx no Excel.");
    }
    setExcelLoading(true);
    try {
      await new Promise<void>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const b64 = (r.result as string)?.split(",")[1] ?? "";
          if (!b64) reject(new Error("Ficheiro vazio ou inválido"));
          else {
            setFormData((f) => ({ ...f, excelTemplateBase64: b64, formato: "EXCEL" }));
            toast.success("Modelo Excel carregado.");
            resolve();
          }
        };
        r.onerror = () => reject(new Error("Erro ao ler ficheiro"));
        r.readAsDataURL(file);
      });
    } catch (e) {
      toast.error((e as Error)?.message || "Erro ao carregar Excel. Verifique se o ficheiro é válido.");
    } finally {
      setExcelLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isExcelDoc = isTipoExcel(formData.tipo);
    if (isExcelDoc && !formData.excelTemplateBase64) {
      const label = TIPOS_DOCUMENTO.find((x) => x.value === formData.tipo)?.label ?? "modelo";
      toast.error(`Carregue o modelo Excel do governo para ${label}.`);
      return;
    }
    if (isExcelDoc && formData.excelTemplateMode === "CELL_MAPPING") {
      if (!formData.excelCellMappingJson?.trim()) {
        toast.error("No modo Mapeamento por coordenadas, o JSON de mapeamento é obrigatório.");
        return;
      }
      try {
        const parsed = JSON.parse(formData.excelCellMappingJson);
        if (!parsed?.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
          toast.error("O JSON deve ter uma propriedade 'items' com pelo menos um mapeamento.");
          return;
        }
      } catch {
        toast.error("O mapeamento JSON é inválido. Verifique a sintaxe.");
        return;
      }
    }
    if (!isExcelDoc && !formData.htmlTemplate.trim()) {
      toast.error("Cole o HTML ou carregue um ficheiro Word/PDF.");
      return;
    }
    setSubmitting(true);
    try {
      // Secundário: backend não suporta classeId — modelo aplica-se à instituição inteira
      const cursoIdFinal = isSecundario ? null : (formData.cursoId === "ALL" ? null : formData.cursoId || null);
      const payload = {
        tipo: formData.tipo,
        tipoAcademico: formData.tipoAcademico || null,
        cursoId: cursoIdFinal,
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim() || null,
        htmlTemplate: isExcelDoc ? "" : formData.htmlTemplate.trim(),
        formatoDocumento: formData.formato,
        excelTemplateBase64: isExcelDoc && formData.excelTemplateBase64?.trim() ? formData.excelTemplateBase64 : undefined,
        excelTemplateMode: isExcelDoc ? (formData.excelTemplateMode === "CELL_MAPPING" ? "CELL_MAPPING" : "PLACEHOLDER") : undefined,
        excelCellMappingJson: isExcelDoc
          ? formData.excelTemplateMode === "CELL_MAPPING" && formData.excelCellMappingJson?.trim()
            ? formData.excelCellMappingJson.trim()
            : null
          : undefined,
        orientacaoPagina: formData.orientacaoPagina && ["RETRATO", "PAISAGEM"].includes(formData.orientacaoPagina) ? formData.orientacaoPagina : null,
        ativo: formData.ativo,
      };
      if (editingId) {
        // Nunca enviar excelTemplateBase64 vazio na atualização — o backend preserva o existente
        const updatePayload = { ...payload };
        if (isExcelDoc && !formData.excelTemplateBase64?.trim()) {
          delete (updatePayload as Record<string, unknown>).excelTemplateBase64;
        }
        await configuracoesInstituicaoApi.atualizarModeloDocumento(editingId, updatePayload);
        toast.success("Modelo atualizado com sucesso");
      } else {
        await configuracoesInstituicaoApi.criarModeloDocumento(payload);
        toast.success("Modelo importado com sucesso");
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["modelos-documento"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(axiosMsg || msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await configuracoesInstituicaoApi.removerModeloDocumento(deletingId);
      toast.success("Modelo removido");
      setDeleteDialogOpen(false);
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["modelos-documento"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover";
      toast.error(msg);
    }
  };

  const getTipoLabel = (t: string) => TIPOS_DOCUMENTO.find((x) => x.value === t)?.label ?? t;
  const getTipoAcadLabel = (t: string | null) => (t === "SUPERIOR" ? "Superior" : t === "SECUNDARIO" ? "Secundário" : "Ambos");

  /** Exibe se o modelo está mapeado: Excel CELL_MAPPING, DOCX placeholders, PDF */
  const getMapeamentoLabel = (m: {
    tipo: string;
    excelTemplateMode?: string | null;
    excelCellMappingJson?: string | null;
    templatePlaceholdersJson?: string | null;
    templateMappings?: { campoTemplate: string; campoSistema: string }[];
    pdfMappingJson?: string | null;
  }): string => {
    if (isTipoExcel(m.tipo)) {
      const mode = (m as { excelTemplateMode?: string }).excelTemplateMode;
      if (mode === "CELL_MAPPING") {
        try {
          const parsed = JSON.parse((m.excelCellMappingJson ?? "{}") || "{}");
          const items = parsed?.items;
          const hasItems = Array.isArray(items) && items.length > 0;
          return hasItems ? "Configurado ✓" : "Por configurar";
        } catch {
          return "Por configurar";
        }
      }
      return "Placeholders";
    }
    if (hasMappablePlaceholders(m)) {
      const placeholders = parsePlaceholders(m.templatePlaceholdersJson);
      const mapped = (m.templateMappings ?? []).length;
      return placeholders.length > 0 ? `${mapped}/${placeholders.length} mapeados` : "—";
    }
    if (m.tipo && ["CERTIFICADO", "DECLARACAO_MATRICULA", "DECLARACAO_FREQUENCIA"].includes(m.tipo)) {
      const pdfMap = (m as { pdfMappingJson?: string | null }).pdfMappingJson;
      if (pdfMap?.trim()) {
        try {
          const j = JSON.parse(pdfMap);
          const hasMapping = (typeof j === "object" && Object.keys(j).length > 0) || (j?.items?.length > 0);
          return hasMapping ? "Configurado ✓" : "Por configurar";
        } catch {
          return "Por configurar";
        }
      }
    }
    return "—";
  };

  /** Extrai placeholders de HTML ({{CHAVE}} ou {CHAVE}) para modelos sem templatePlaceholdersJson */
  const extractPlaceholdersFromHtml = (html: string): string[] => {
    if (!html?.trim()) return [];
    const set = new Set<string>();
    /\{\{([^}]+)\}\}/g.exec(html); // reset regex
    let m: RegExpExecArray | null;
    const doubleRegex = /\{\{([^}]+)\}\}/g;
    while ((m = doubleRegex.exec(html)) !== null) {
      const key = m[1].trim();
      if (key && !key.startsWith("#") && !key.startsWith("/")) set.add(key);
    }
    const singleRegex = /\{([^{}]+)\}/g;
    while ((m = singleRegex.exec(html)) !== null) {
      const key = m[1].trim();
      if (key && !key.startsWith("#") && !key.startsWith("/")) set.add(key);
    }
    return Array.from(set);
  };
  const hasMappablePlaceholders = (m: {
    templatePlaceholdersJson?: string | null;
    htmlTemplate?: string | null;
    formatoDocumento?: string | null;
  }) => {
    if (m.templatePlaceholdersJson?.trim()) return true;
    const fmt = m.formatoDocumento ?? "";
    if ((fmt === "HTML" || fmt === "WORD") && m.htmlTemplate?.trim()) {
      return extractPlaceholdersFromHtml(m.htmlTemplate).length > 0;
    }
    return false;
  };
  const parsePlaceholders = (json: string | null | undefined): string[] => {
    try {
      if (!json?.trim()) return [];
      const arr = JSON.parse(json) as unknown;
      return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  };
  const openMapping = (m: {
    id: string;
    nome: string;
    templatePlaceholdersJson?: string | null;
    htmlTemplate?: string | null;
    templateMappings?: { campoTemplate: string; campoSistema: string }[];
  }) => {
    let placeholders = parsePlaceholders(m.templatePlaceholdersJson);
    if (placeholders.length === 0 && m.htmlTemplate?.trim()) {
      placeholders = extractPlaceholdersFromHtml(m.htmlTemplate);
    }
    setMappingModelo({
      id: m.id,
      nome: m.nome,
      placeholders,
      mappings: m.templateMappings ?? [],
    });
    setMappingDialogOpen(true);
  };
  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPdfUploadFile(file ?? null);
    setPdfFields([]);
    setPdfMappings({});
    if (file) {
      const r = new FileReader();
      r.onload = () => {
        const b64 = (r.result as string)?.split(",")[1] ?? "";
        setPdfUploadBase64(b64);
      };
      r.readAsDataURL(file);
    } else {
      setPdfUploadBase64("");
    }
  };
  const handleExtractPdfFields = async () => {
    if (!pdfUploadBase64?.trim()) {
      toast.error("Carregue o PDF primeiro.");
      return;
    }
    setPdfUploading(true);
    try {
      const { fields } = await configuracoesInstituicaoApi.extractPdfFields(pdfUploadBase64);
      setPdfFields(fields);
      const initial: Record<string, string> = {};
      for (const f of fields) {
        if (f.type === "text") initial[f.fieldName] = "";
      }
      setPdfMappings(initial);
      toast.success(`${fields.length} campo(s) extraído(s). Mapeie aos campos do sistema.`);
    } catch (err) {
      toast.error((err as Error)?.message ?? "Erro ao extrair campos");
    } finally {
      setPdfUploading(false);
    }
  };
  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfUploadNome.trim() || !pdfUploadBase64?.trim()) {
      toast.error("Indique o nome e carregue o PDF.");
      return;
    }
    if (pdfUploadMode === "COORDINATES" && (!pdfCoordinateItems.length || pdfCoordinateItems.every((i) => !i.campo))) {
      toast.error("Defina pelo menos uma posição com campo associado no modo Coordenadas.");
      return;
    }
    setPdfUploading(true);
    try {
      let pdfMappingJson: string;
      if (pdfUploadMode === "FORM_FIELDS") {
        const mappingObj: Record<string, string> = {};
        for (const [k, v] of Object.entries(pdfMappings)) {
          if (v?.trim()) mappingObj[k] = v;
        }
        pdfMappingJson = Object.keys(mappingObj).length ? JSON.stringify(mappingObj) : "{}";
      } else {
        pdfMappingJson = JSON.stringify({ items: pdfCoordinateItems.filter((i) => i.campo?.trim()) });
      }
      await configuracoesInstituicaoApi.criarModeloDocumento({
        tipo: pdfUploadTipo,
        tipoAcademico: tipoAcademico,
        nome: pdfUploadNome.trim(),
        htmlTemplate: "",
        formatoDocumento: "PDF",
        pdfTemplateBase64: pdfUploadBase64,
        pdfTemplateMode: pdfUploadMode,
        pdfMappingJson,
        ativo: true,
      });
      toast.success("Modelo PDF importado.");
      setPdfUploadOpen(false);
      setPdfUploadNome("");
      setPdfUploadFile(null);
      setPdfUploadBase64("");
      setPdfFields([]);
      setPdfMappings({});
      setPdfCoordinateItems([{ pageIndex: 0, x: 100, y: 400, campo: "student.fullName" }]);
      queryClient.invalidateQueries({ queryKey: ["modelos-documento"] });
    } catch (err) {
      toast.error((err as Error)?.message ?? "Erro ao importar PDF");
    } finally {
      setPdfUploading(false);
    }
  };
  const handleDocxUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docxUploadNome.trim() || !docxUploadFile) {
      toast.error("Indique o nome e selecione o ficheiro DOCX.");
      return;
    }
    const ext = (docxUploadFile.name?.split(".").pop() ?? "").toLowerCase();
    if (ext !== "docx") {
      toast.error("Use um ficheiro .docx (Word actual). Ficheiros .doc antigos não são suportados.");
      return;
    }
    setDocxUploading(true);
    try {
      const result = await configuracoesInstituicaoApi.uploadTemplateDocx(
        docxUploadFile,
        docxUploadNome.trim(),
        docxUploadTipo,
        tipoAcademico
      );
      toast.success("Modelo DOCX importado. Pode mapear os placeholders.");
      setDocxUploadOpen(false);
      setDocxUploadNome("");
      setDocxUploadFile(null);
      queryClient.invalidateQueries({ queryKey: ["modelos-documento"] });
      if (result?.id && (result as { placeholders?: string[] }).placeholders?.length) {
        setMappingModelo({
          id: result.id,
          nome: docxUploadNome.trim(),
          placeholders: (result as { placeholders: string[] }).placeholders,
          mappings: [],
        });
        setMappingDialogOpen(true);
      }
    } catch (err) {
      toast.error((err as Error)?.message ?? "Erro ao importar DOCX");
    } finally {
      setDocxUploading(false);
    }
  };

  const secaoTitulo = tituloSecao ?? "Importar e gerir modelos";
  const secaoDesc = compactMode
    ? "Lista de modelos importados e mapeados para este tipo de documento."
    : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          {secaoTitulo}
        </CardTitle>
        {secaoDesc ? (
          <CardDescription>{secaoDesc}</CardDescription>
        ) : (
        <CardDescription className="space-y-2">
          <span className="block">
            <strong>Excel</strong> (Pauta Final, Mini Pauta, Boletim): modo <em>Placeholders</em> — coloque {"{{ALUNO_1_NOME}}"}, {"{{ALUNO_1_DISC_1_MAC}}"}, etc. nas células. Modo <em>Mapeamento por coordenadas</em> — importe o ficheiro oficial sem editar; depois use o botão <strong>Mapear células</strong> na linha do modelo para configurar coordenadas.
          </span>
          <span className="block">
            <strong>Word (DOCX)</strong> (Certificados, Declarações): use <strong>Importar DOCX</strong> abaixo; depois clique em <strong>Mapear</strong> na linha do modelo para associar placeholders aos campos do sistema.
          </span>
          <span className="block">
            <strong>PDF</strong> (Certificados, Declarações): use <strong>Importar PDF</strong> para ficheiros fillable (AcroForm); mapeie os campos aos dados do sistema. Modo coordenadas disponível para PDFs estáticos.
          </span>
          <span className="block">
            <strong>HTML</strong>: placeholders {"{{NOME_ALUNO}}"}, {"{{CURSO}}"}, {"{{ANO_LETIVO}}"}.
          </span>
        </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {compactMode ? (
            <Button onClick={openCreate}>
              <Upload className="h-4 w-4 mr-2" />
              Importar {tituloSecao?.toLowerCase().replace(" importados", "").replace(" importadas", "") ?? "modelo"}
            </Button>
          ) : (
            <>
              <Button onClick={openCreate} data-testid="btn-importar-modelo-excel-html">
                <Upload className="h-4 w-4 mr-2" />
                Importar modelo (Excel / HTML)
              </Button>
              <Button variant="outline" onClick={() => setDocxUploadOpen(true)} data-testid="btn-importar-docx">
                <FileDown className="h-4 w-4 mr-2" />
                Importar DOCX (Word)
              </Button>
              <Button variant="outline" onClick={() => setPdfUploadOpen(true)} data-testid="btn-importar-pdf">
                <FileText className="h-4 w-4 mr-2" />
                Importar PDF
              </Button>
            </>
          )}
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4">Carregando...</div>
        ) : modelos.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 rounded-lg border-2 border-dashed p-8 text-center bg-muted/20">
            <p className="font-medium mb-2">Nenhum modelo importado</p>
            <p className="mb-4">Importe Excel (pautas, boletim) ou HTML/Word (certificados, declarações).</p>
            <Button onClick={openCreate} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Importar primeiro modelo
            </Button>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Tipo</th>
                  <th className="text-left p-3 font-medium">Nível</th>
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium">{isSecundario ? "Classe" : "Curso"}</th>
                  <th className="text-left p-3 font-medium">Orientação</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Mapeamento</th>
                  <th className="text-right p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {modelos.map((m) => (
                  <tr key={m.id} className="border-b">
                    <td className="p-3">{getTipoLabel(m.tipo)}</td>
                    <td className="p-3">{getTipoAcadLabel(m.tipoAcademico)}</td>
                    <td className="p-3">{m.nome}</td>
                    <td className="p-3">
                      {(m as { curso?: { nome?: string }; cursoId?: string | null }).curso?.nome ??
                        (isSecundario ? "Institucional" : "Geral")}
                    </td>
                    <td className="p-3">
                      {(m as { orientacaoPagina?: string | null }).orientacaoPagina === "PAISAGEM" ? "Paisagem" :
                        (m as { orientacaoPagina?: string | null }).orientacaoPagina === "RETRATO" ? "Retrato" : "—"}
                    </td>
                    <td className="p-3">{m.ativo ? "Ativo" : "Inativo"}</td>
                    <td className="p-3">
                      <span className="text-xs" title={isTipoExcel(m.tipo) ? "Excel: use 'Mapear células' para configurar" : "DOCX/PDF: use 'Mapear' para associar campos"}>
                        {getMapeamentoLabel(m as any)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {["CERTIFICADO", "DECLARACAO_MATRICULA", "DECLARACAO_FREQUENCIA"].includes(m.tipo) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mr-1"
                          onClick={() => onPreviewDoc(m.tipo as any, (m.tipoAcademico as any) ?? tipoAcademico, m.nome)}
                          aria-label={`Ver modelo ${m.nome}`}
                          title="Ver modelo"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {m.tipo === "MINI_PAUTA" && onPreviewPauta && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mr-1"
                                onClick={() => onPreviewPauta("PROVISORIA", `${m.nome} - Provisória`)}
                                aria-label="Pré-visualizar Mini Pauta provisória"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Pré-visualizar Mini Pauta provisória</p>
                              <p className="text-muted-foreground text-xs">Com dados de exemplo</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mr-1"
                                onClick={() => onPreviewPauta("DEFINITIVA", `${m.nome} - Definitiva`)}
                                aria-label="Pré-visualizar Mini Pauta definitiva"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Pré-visualizar Mini Pauta definitiva</p>
                              <p className="text-muted-foreground text-xs">Com dados de exemplo</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {hasMappablePlaceholders(m as { templatePlaceholdersJson?: string | null; htmlTemplate?: string | null; formatoDocumento?: string | null }) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-1"
                          onClick={() => openMapping(m as { id: string; nome: string; templatePlaceholdersJson?: string | null; htmlTemplate?: string | null; templateMappings?: { campoTemplate: string; campoSistema: string }[] })}
                          title="Mapear placeholders do Word aos campos do sistema"
                          aria-label="Mapear placeholders Word"
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          Mapear
                        </Button>
                      )}
                      {isTipoExcel(m.tipo) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-1"
                          onClick={() => openEdit(m as any)}
                          title="Configurar mapeamento de células (coordenadas Excel → campos) ou modo de preenchimento"
                          data-testid="btn-mapear-cellulas"
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          Mapear células
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="mr-1" onClick={() => openEdit(m as any)} aria-label="Editar modelo">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          setDeletingId(m.id);
                          setDeleteDialogOpen(true);
                        }}
                        aria-label="Remover modelo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[min(95vw,960px)] max-w-[95vw] max-h-[90vh] min-w-[500px] min-h-[400px] flex flex-col overflow-auto resize">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar modelo" : "Importar modelo"}</DialogTitle>
            <DialogDescription>
              {isExcelModelo ? (
                <>
                  <strong>Excel (edição célula a célula)</strong>: o modelo do governo tem a estrutura pronta. Coloque placeholders nas células (ex.: {"{{ALUNO_1_NOME}}"}, {"{{ALUNO_1_DISC_1_MAC}}"}, {"{{ALUNO_1_DISC_1_MFD}}"}) e o sistema preenche cada célula com os dados reais. Use o botão de mapeamento após guardar para associar placeholders a campos do sistema.
                </>
              ) : (
                <>
                  <strong>Certificados e Declarações</strong>: HTML com placeholders ou Word (DOCX). No Word, edite como um documento normal e use placeholders; mapeie aos campos do sistema.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto flex-1 min-h-0 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v, formato: isTipoExcel(v) ? "EXCEL" : "HTML", excelTemplateBase64: isTipoExcel(v) ? formData.excelTemplateBase64 : "" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo académico</Label>
                <Input
                  value={tipoAcademico === "SUPERIOR" ? "Ensino Superior" : "Ensino Secundário"}
                  readOnly
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Definido pelo tipo da sua instituição. Não é editável.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome (identificação)</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Certificado Superior - Modelo MINED 2024"
                  required
                />
              </div>
              {!isSecundario ? (
                <div className="space-y-2">
                  <Label>Vincular ao curso (opcional)</Label>
                  <Select value={formData.cursoId} onValueChange={(v) => setFormData({ ...formData, cursoId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os cursos (modelo geral)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos os cursos (modelo geral)</SelectItem>
                      {cursos.map((c: { id: string; nome: string; codigo: string }) => (
                        <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Se o governo forneceu um modelo para um curso específico (ex: Enfermagem, Informática), selecione-o aqui. O modelo ficará vinculado e será usado automaticamente na emissão para esse curso.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Âmbito do modelo</Label>
                  <div className="rounded-lg border border-border/80 bg-muted/20 p-4 text-sm">
                    <p className="text-muted-foreground">
                      O modelo aplica-se à instituição inteira (todas as classes). Será utilizado automaticamente na emissão de documentos para o Ensino Secundário.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Ex: Modelo oficial do Ministério 2024"
              />
            </div>
            {!TIPOS_EXCEL_SEM_ORIENTACAO.includes(formData.tipo) && (
              <div className="space-y-2">
                <Label>Orientação da página (PDF)</Label>
                <Select
                  value={formData.orientacaoPagina || "PADRAO"}
                  onValueChange={(v) => setFormData({ ...formData, orientacaoPagina: v === "PADRAO" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Padrão (retrato)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PADRAO">Padrão (retrato)</SelectItem>
                    <SelectItem value="RETRATO">Retrato (vertical)</SelectItem>
                    <SelectItem value="PAISAGEM">Paisagem (horizontal)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Adapte ao formato do modelo do governo. Paisagem para documentos horizontais.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Formato do modelo</Label>
              <Select
                value={formatosDisponiveis.some((f) => f.value === formData.formato) ? formData.formato : formatosDisponiveis[0]?.value ?? "HTML"}
                onValueChange={(v) => setFormData({ ...formData, formato: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatosDisponiveis.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isExcelModelo ? "Mini Pauta, Pauta de Conclusão e Boletim usam modelos Excel (.xlsx) fornecidos pelo governo. Certificados e declarações aceitam HTML, Word ou PDF." : "Certificados e declarações: cole HTML ou carregue Word/PDF para converter."}
              </p>
            </div>
            {isExcelModelo ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Modelo Excel do governo (.xlsx)</Label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    data-testid="modelo-excel-file-input"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) await handleExcelFile(f);
                    }}
                    disabled={excelLoading}
                    className="cursor-pointer"
                  />
                  {excelLoading && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> A carregar Excel...</p>}
                  {formData.excelTemplateBase64 && !excelLoading && (
                    <p className="text-xs text-emerald-600">Modelo Excel carregado. Pode guardar.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Modo de preenchimento</Label>
                  <Select
                    value={formData.excelTemplateMode}
                    onValueChange={(v: "PLACEHOLDER" | "CELL_MAPPING") => setFormData({ ...formData, excelTemplateMode: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PLACEHOLDER">Placeholders ({'\u007b\u007bCHAVE\u007d\u007d'} nas células)</SelectItem>
                      <SelectItem value="CELL_MAPPING">Mapeamento por coordenadas (ficheiro oficial sem editar)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.excelTemplateMode === "PLACEHOLDER"
                      ? "Coloque placeholders nas células; o sistema substitui pelos dados."
                      : "Importe o Excel oficial sem alterar. Use o editor abaixo para mapear colunas e linhas aos campos do sistema."}
                  </p>
                </div>
                {formData.excelTemplateMode === "CELL_MAPPING" && (
                  <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                    <Label className="text-base font-medium">Mapeamento de células</Label>
                    <p className="text-xs text-muted-foreground">
                      Clique nas células do Excel e depois nos campos à direita. Use <em>Definir como início da lista</em> para mapear a tabela de {formData.tipo === "BOLETIM" ? "disciplinas" : "alunos"}.
                    </p>
                    <ExcelMappingEditor
                      value={formData.excelCellMappingJson}
                      onChange={(json) => setFormData({ ...formData, excelCellMappingJson: json })}
                      excelTemplateBase64={formData.excelTemplateBase64 || undefined}
                      disciplinas={formData.tipo === "PAUTA_CONCLUSAO" ? disciplinasPauta : []}
                      tipo={formData.tipo === "BOLETIM" ? "BOLETIM" : formData.tipo === "MINI_PAUTA" ? "MINI_PAUTA" : "PAUTA_CONCLUSAO"}
                    />
                  </div>
                )}
              </div>
            ) : formData.formato === "HTML" ? (
              <div className="space-y-3">
                <Tabs defaultValue="preview" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preview" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Pré-visualização
                    </TabsTrigger>
                    <TabsTrigger value="code" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Código fonte (só se souber HTML)
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="preview" className="mt-3 space-y-2">
                    <div className="rounded-lg border border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/40 p-3 text-sm">
                      <p className="text-foreground">
                        <strong>Pré-visualização do documento</strong> — É assim que ficará ao emitir. Os marcadores {'{{'}NOME_ALUNO{'}}'}, {'{{'}CURSO{'}}'} serão substituídos pelos dados reais. Não precisa de editar código. Se preferir editar como documento normal (sem programação), use o formato <strong>Word</strong> em vez de HTML.
                      </p>
                    </div>
                    {formData.htmlTemplate ? (
                      <div className="rounded-lg border bg-white min-h-[300px] overflow-hidden">
                        <iframe
                          srcDoc={injectCertificatePreviewStyles(formData.htmlTemplate)}
                          title="Pré-visualização"
                          className="w-full h-[min(400px,50vh)] border-0"
                          sandbox="allow-same-origin"
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed bg-muted/30 min-h-[200px] flex items-center justify-center text-muted-foreground text-sm p-6">
                        Cole o HTML abaixo para ver a pré-visualização
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="code" className="mt-3 space-y-2">
                    <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/40 p-3 text-sm">
                      <p className="text-foreground">
                        <strong>Atenção</strong> — Só edite aqui se souber HTML. Em caso de dúvida, volte à aba <strong>Pré-visualização</strong> e use o botão Mapear para configurar os dados.
                      </p>
                    </div>
                    <Label>HTML do modelo</Label>
                    <Textarea
                      value={formData.htmlTemplate}
                      onChange={(e) => setFormData({ ...formData, htmlTemplate: e.target.value })}
                      placeholder="<html>... {{NOME_ALUNO}} {{CURSO}} ...</html>"
                      rows={12}
                      className="font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ex: {[PH.NOME_ALUNO, PH.CURSO, PH.ANO_LETIVO, PH.N_DOCUMENTO, PH.LOGO_IMG, PH.IMAGEM_FUNDO_URL, PH.MINISTERIO_SUPERIOR, PH.CARGO_ASSINATURA_1].join(', ')}
                    </p>
                  </TabsContent>
                </Tabs>
              </div>
            ) : formData.formato === "WORD" ? (
              <div className="space-y-3">
                <Label>Ficheiro Word (.docx)</Label>
                <p className="text-xs text-muted-foreground">
                  Para alterar o documento, edite o ficheiro no Word ou LibreOffice e carregue-o novamente. Não precisa de editar código.
                </p>
                <Input
                  type="file"
                  accept=".docx,.doc"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleWordFile(f);
                    e.target.value = "";
                  }}
                  disabled={convertingFile}
                  className="cursor-pointer"
                />
                {convertingFile && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> A converter...</p>}
                {formData.htmlTemplate && (
                  <Tabs defaultValue="preview" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="preview" className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Pré-visualização
                      </TabsTrigger>
                      <TabsTrigger value="code" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Código (só técnicos)
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="preview" className="mt-3 space-y-2">
                      <div className="rounded-lg border border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/40 p-3 text-sm">
                        <p className="text-foreground">
                          <strong>Pré-visualização</strong> — É assim que ficará ao emitir. Para alterar texto ou imagens, edite o ficheiro .docx no Word e carregue novamente. Use o botão <strong>Mapear</strong> na tabela para associar campos aos dados.
                        </p>
                      </div>
                      <div className="rounded-lg border bg-white min-h-[300px] overflow-hidden">
                        <iframe
                          srcDoc={injectCertificatePreviewStyles(formData.htmlTemplate)}
                          title="Pré-visualização"
                          className="w-full h-[min(400px,50vh)] border-0"
                          sandbox="allow-same-origin"
                        />
                      </div>
                    </TabsContent>
                    <TabsContent value="code" className="mt-3 space-y-2">
                      <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/40 p-3 text-sm">
                        <p className="text-foreground">
                          <strong>Atenção</strong> — Só edite aqui se souber HTML. Em caso de dúvida, volte à aba <strong>Pré-visualização</strong> e use o botão Mapear.
                        </p>
                      </div>
                      <Label>HTML convertido</Label>
                      <Textarea
                        value={formData.htmlTemplate}
                        onChange={(e) => setFormData({ ...formData, htmlTemplate: e.target.value })}
                        placeholder="HTML convertido (pode editar)"
                        rows={8}
                        className="font-mono text-xs"
                      />
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Label>Ficheiro PDF (.pdf)</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePdfFile(f);
                    e.target.value = "";
                  }}
                  disabled={convertingFile}
                  className="cursor-pointer"
                />
                {convertingFile && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> A converter...</p>}
                {formData.htmlTemplate && (
                  <Tabs defaultValue="preview" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="preview" className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Pré-visualização
                      </TabsTrigger>
                      <TabsTrigger value="code" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Código (avançado)
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="preview" className="mt-3 space-y-2">
                      <div className="rounded-lg border border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/40 p-3 text-sm">
                        <p className="text-foreground">
                          <strong>Pré-visualização do documento</strong> — É assim que ficará ao emitir. Não precisa de ver código. Use o botão <strong>Mapear</strong> na tabela para associar os campos aos dados reais.
                        </p>
                      </div>
                      <div className="rounded-lg border bg-white min-h-[300px] overflow-hidden">
                        <iframe
                          srcDoc={injectCertificatePreviewStyles(formData.htmlTemplate)}
                          title="Pré-visualização"
                          className="w-full h-[min(400px,50vh)] border-0"
                          sandbox="allow-same-origin"
                        />
                      </div>
                    </TabsContent>
                    <TabsContent value="code" className="mt-3 space-y-2">
                      <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/40 p-3 text-sm">
                        <p className="text-foreground">
                          <strong>Atenção</strong> — Só edite aqui se souber HTML. Em caso de dúvida, volte à aba <strong>Pré-visualização</strong> e use o botão Mapear.
                        </p>
                      </div>
                      <Label>Código HTML convertido</Label>
                      <Textarea
                        value={formData.htmlTemplate}
                        onChange={(e) => setFormData({ ...formData, htmlTemplate: e.target.value })}
                        placeholder="HTML convertido (pode editar)"
                        rows={8}
                        className="font-mono text-xs"
                      />
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="ativo" className="font-normal">Modelo ativo (será usado na emissão)</Label>
            </div>
            {!isExcelModelo && (formData.formato === "HTML" || formData.formato === "WORD") && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/40 p-3 text-sm">
                <p className="text-foreground">
                  <strong>Próximo passo:</strong> Guarde o modelo. O sistema extrairá os placeholders (ex: {'{{'}NOME_ALUNO{'}}'}) do template. Depois disso, o botão <strong>Mapear</strong> aparecerá na secção Certificados para associar aos campos reais.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "A guardar..." : editingId ? "Guardar" : "Importar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover modelo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? O sistema não terá modelo para este tipo até importar outro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={pdfUploadOpen} onOpenChange={setPdfUploadOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar modelo PDF</DialogTitle>
            <DialogDescription>
              Carregue um PDF. Formulário: PDFs com campos AcroForm — extraia e mapeie. Coordenadas: PDFs estáticos — defina posições (x,y) para cada dado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePdfUpload} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do modelo</Label>
              <Input value={pdfUploadNome} onChange={(e) => setPdfUploadNome(e.target.value)} placeholder="Ex: Certificado PDF MINED" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Select value={pdfUploadTipo} onValueChange={(v: "CERTIFICADO" | "DECLARACAO_MATRICULA" | "DECLARACAO_FREQUENCIA") => setPdfUploadTipo(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CERTIFICADO">Certificado</SelectItem>
                    <SelectItem value="DECLARACAO_MATRICULA">Declaração de Matrícula</SelectItem>
                    <SelectItem value="DECLARACAO_FREQUENCIA">Declaração de Frequência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Modo de preenchimento</Label>
                <Select value={pdfUploadMode} onValueChange={(v: "FORM_FIELDS" | "COORDINATES") => setPdfUploadMode(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FORM_FIELDS">Formulário (campos AcroForm)</SelectItem>
                    <SelectItem value="COORDINATES">Coordenadas (PDF estático)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {pdfUploadMode === "FORM_FIELDS"
                    ? "Use quando o PDF tem campos clicáveis (formulário preenchível). O sistema extrai os nomes dos campos e mapeia aos dados."
                    : "Use para PDFs sem campos — define posições (x, y) em cada página onde o texto será inserido."}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ficheiro PDF</Label>
              <Input type="file" accept=".pdf" onChange={handlePdfFileChange} className="cursor-pointer" />
              {pdfUploadMode === "FORM_FIELDS" && (
                <Button type="button" variant="outline" size="sm" onClick={handleExtractPdfFields} disabled={!pdfUploadBase64 || pdfUploading}>
                  {pdfUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Extrair campos do PDF
                </Button>
              )}
            </div>
            {pdfUploadMode === "COORDINATES" && pdfUploadBase64 && (
              <PdfMappingEditor
                mode="COORDINATES"
                templateBase64={pdfUploadBase64}
                initialCoordinateMapping={pdfCoordinateItems}
                onChange={(_, coords) => coords && setPdfCoordinateItems(coords)}
                compact
              />
            )}
            {pdfUploadMode === "FORM_FIELDS" && pdfFields.length > 0 && (
              <div className="space-y-2 border rounded p-3">
                <Label>Mapeamento (campo PDF → campo do sistema)</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pdfFields.filter((f) => f.type === "text" || f.type === "unknown").map((f) => (
                    <div key={f.fieldName} className="flex items-center gap-2">
                      <span className="text-xs w-32 truncate" title={f.fieldName}>{f.fieldName}</span>
                      <span className="text-muted-foreground">→</span>
                      <Select value={pdfMappings[f.fieldName] ?? ""} onValueChange={(v) => setPdfMappings((m) => ({ ...m, [f.fieldName]: v }))}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">— Não mapear —</SelectItem>
                          {pdfAvailableFields
                            .filter((c) => c.startsWith("student.") || c.startsWith("instituicao.") || c.startsWith("document.") || c.startsWith("finance."))
                            .map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPdfUploadOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={pdfUploading}>
                {pdfUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> A importar...</> : "Importar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={docxUploadOpen} onOpenChange={setDocxUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar modelo DOCX</DialogTitle>
            <DialogDescription>
              Carregue um ficheiro Word (.docx) com placeholders no formato docxtemplater (ex: {"{{nome}}"}, {"{{student.fullName}}"}). Os placeholders são extraídos automaticamente para mapeamento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDocxUpload} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use placeholders no formato {`{{campo}}`} — ex: {`{{student.fullName}}`}, {`{{instituicao.nome}}`}. Loops: {`{#alunos}...{/alunos}`}. Após importar, clique em <strong>Mapear</strong> na tabela para associar aos campos do sistema.
            </p>
            <div className="space-y-2">
              <Label>Nome do modelo</Label>
              <Input
                value={docxUploadNome}
                onChange={(e) => setDocxUploadNome(e.target.value)}
                placeholder="Ex: Certificado Modelo MINED 2024"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de documento</Label>
              <Select value={docxUploadTipo} onValueChange={setDocxUploadTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                  <SelectItem value="DOCUMENTO_OFICIAL">Documento Oficial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ficheiro DOCX (.docx)</Label>
              <Input
                type="file"
                accept=".docx"
                onChange={(e) => setDocxUploadFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">Apenas ficheiros .docx são suportados. Guarde o documento como .docx no Word se estiver em .doc.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDocxUploadOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={docxUploading}>
                {docxUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> A importar...</> : "Importar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {mappingModelo && (
        <TemplateMappingDialog
          open={mappingDialogOpen}
          onOpenChange={setMappingDialogOpen}
          modeloId={mappingModelo.id}
          modeloNome={mappingModelo.nome}
          placeholders={mappingModelo.placeholders}
          initialMappings={mappingModelo.mappings}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["modelos-documento"] })}
        />
      )}
    </Card>
  );
}

export function ModelosDocumentosTab() {
  const { config, instituicao } = useInstituicao();
  const [searchParams, setSearchParams] = useSearchParams();
  const subtabFromUrl = searchParams.get("subtab");
  const validSubtab = ["importados", "certificados", "declaracoes", "pautas"].includes(subtabFromUrl ?? "")
    ? subtabFromUrl
    : "importados";
  const innerTab = validSubtab ?? "importados";

  const [preview, setPreview] = useState<{
    open: boolean;
    type: "html" | "pdf" | "excel";
    html?: string;
    pdfBase64?: string;
    excelBase64?: string;
    title: string;
    loading: boolean;
    errorMessage?: string;
  }>({ open: false, type: "html", title: "", loading: false });

  const tipoAcademico = instituicao?.tipo_academico ?? config?.tipo_academico ?? config?.tipoAcademico ?? "SUPERIOR";
  const isSecundario = tipoAcademico === "SECUNDARIO";

  const handlePreviewDoc = async (
    tipo: "CERTIFICADO" | "DECLARACAO_MATRICULA" | "DECLARACAO_FREQUENCIA",
    tipoAcad: "SUPERIOR" | "SECUNDARIO",
    label: string
  ) => {
    setPreview((p) => ({ ...p, open: true, loading: true, title: label, errorMessage: undefined }));
    try {
      const res = await configuracoesInstituicaoApi.previewDocumento({
        tipo,
        tipoAcademico: tipoAcad,
      });
      if (res.pdfBase64) {
        setPreview({ open: true, type: "pdf", pdfBase64: res.pdfBase64, title: label, loading: false });
      } else {
        setPreview({ open: true, type: "html", html: res.html ?? "", title: label, loading: false });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar pré-visualização";
      toast.error(msg);
      setPreview((p) => ({ ...p, loading: false, errorMessage: msg }));
    }
  };

  const handlePreviewPauta = async (
    tipoPauta: "PROVISORIA" | "DEFINITIVA",
    label: string
  ) => {
    setPreview((p) => ({ ...p, open: true, loading: true, title: label, errorMessage: undefined }));
    try {
      const res = await configuracoesInstituicaoApi.previewPauta({
        tipoPauta,
        tipoAcademico: tipoAcademico as "SUPERIOR" | "SECUNDARIO",
      });
      if (res.formato === "EXCEL" && res.excelBase64) {
        setPreview({ open: true, type: "excel", excelBase64: res.excelBase64, title: label, loading: false });
      } else {
        setPreview({ open: true, type: "pdf", pdfBase64: res.pdfBase64, title: label, loading: false });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar pré-visualização";
      toast.error(msg);
      setPreview((p) => ({ ...p, loading: false, errorMessage: msg }));
    }
  };

  const [exportExcelLoading, setExportExcelLoading] = useState(false);
  const [turmaIdExport, setTurmaIdExport] = useState<string>("__preview__");
  const [guiaPassosOpen, setGuiaPassosOpen] = useState(false);

  const { data: turmasRaw = [] } = useQuery({
    queryKey: ["turmas-export-pauta"],
    queryFn: () => turmasApi.getAll(),
  });
  // Pauta de Conclusão exige turma com curso e modelo CONCLUSAO/SAUDE ( Ensino Superior). Turmas só com classe (Secundário) ainda não suportadas para exportação.
  const turmas = turmasRaw.filter((t: { curso?: { modeloPauta?: string } }) => t.curso && (t.curso.modeloPauta === "CONCLUSAO" || t.curso.modeloPauta === "SAUDE"));

  const handlePreviewPautaConclusaoSaude = async () => {
    setPreview((p) => ({ ...p, open: true, loading: true, title: "Pauta de Conclusão - Saúde", errorMessage: undefined }));
    try {
      const { pdfBase64 } = await configuracoesInstituicaoApi.previewPautaConclusaoSaude();
      setPreview({ open: true, type: "pdf", pdfBase64, title: "Pauta de Conclusão do Curso - Modelo Saúde", loading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar pré-visualização";
      toast.error(msg);
      setPreview((p) => ({ ...p, loading: false, errorMessage: msg }));
    }
  };

  const handleExportExcelPautaSaude = async () => {
    setExportExcelLoading(true);
    const turmaId = turmaIdExport && turmaIdExport !== "__preview__" ? turmaIdExport : undefined;
    try {
      const blob = await configuracoesInstituicaoApi.getPautaConclusaoSaudeExcelExport(turmaId ?? null);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pauta-conclusao-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel exportado com modelo do governo.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao exportar Excel';
      toast.error(msg);
    } finally {
      setExportExcelLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Modelos de Documentos
        </h2>
        <p className="text-muted-foreground">
          Visualize os modelos de mini pautas, certificados e declarações oficiais. Dados de exemplo.
        </p>
      </div>

      <Collapsible open={guiaPassosOpen} onOpenChange={setGuiaPassosOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Como utilizar (passo a passo)
            </span>
            {guiaPassosOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2 border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fluxo completo — do início ao fim</CardTitle>
              <CardDescription>
                Segue um resumo do fluxo para cada tipo de documento. Para Pauta e Boletim com dados reais, é necessário o fluxo académico concluído (notas, frequências).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Pauta de Conclusão (Excel)</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Edite o Excel no computador (placeholders ou mantenha original se CELL_MAPPING)</li>
                  <li>Importar modelo → Tipo: Pauta de Conclusão, Formato: Excel</li>
                  <li>Upload do ficheiro; se CELL_MAPPING, configurar mapeamento</li>
                  <li>Importar e marcar Ativo</li>
                  <li>Sub-aba Mini Pautas → Pauta de Conclusão do Curso → Exportar Excel</li>
                </ol>
              </div>
              <div>
                <h4 className="font-medium mb-2">Boletim (Excel)</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Edite o Excel (placeholders) ou mantenha original (CELL_MAPPING)</li>
                  <li>Importar modelo → Tipo: Boletim, Formato: Excel</li>
                  <li>Upload e configurar mapeamento se CELL_MAPPING</li>
                  <li>Importar e marcar Ativo</li>
                  <li>Relatórios Oficiais → Boletim do Aluno → Descarregar Excel</li>
                </ol>
              </div>
              <div>
                <h4 className="font-medium mb-2">Certificado / Declaração (HTML, Word ou PDF)</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Importar modelo → Tipo: Certificado (ou Declaração), Formato: HTML ou Word</li>
                  <li>Colar HTML com placeholders ou upload DOCX</li>
                  <li>Importar e marcar Ativo</li>
                  <li>Na emissão, o sistema usa o modelo automaticamente</li>
                </ol>
              </div>
              <div>
                <h4 className="font-medium mb-2">Certificado / Declaração (PDF)</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li><strong>PDF com formulário</strong>: Importar PDF → Modo Formulário → Carregar ficheiro → Extrair campos → Mapear cada campo ao dado do sistema → Importar</li>
                  <li><strong>PDF estático</strong> (sem campos): Importar PDF → Modo Coordenadas → Carregar ficheiro → Definir posições (página, x, y) para cada dado → Importar</li>
                  <li>Na emissão, o documento é preenchido automaticamente</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Tabs
        value={innerTab}
        onValueChange={(v) => {
          const next = new URLSearchParams(searchParams);
          next.set("subtab", v);
          setSearchParams(next);
        }}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="importados" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar / Modelos
          </TabsTrigger>
          <TabsTrigger value="pautas" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Mini Pautas
          </TabsTrigger>
          <TabsTrigger value="certificados" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Certificados
          </TabsTrigger>
          <TabsTrigger value="declaracoes" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Declarações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="importados" className="space-y-4">
          <ModelosImportadosSection
            tipoAcademico={tipoAcademico as "SUPERIOR" | "SECUNDARIO"}
            onPreviewDoc={handlePreviewDoc}
            onPreviewPauta={handlePreviewPauta}
          />
        </TabsContent>

        <TabsContent value="pautas" className="space-y-4">
          <ModelosImportadosSection
            tipoAcademico={tipoAcademico as "SUPERIOR" | "SECUNDARIO"}
            onPreviewDoc={handlePreviewDoc}
            onPreviewPauta={handlePreviewPauta}
            filterTipos={[...TIPOS_EXCEL]}
            defaultTipo="MINI_PAUTA"
            tituloSecao="Pautas e Boletins importados"
            compactMode
          />
          <Card>
            <CardHeader>
              <CardTitle>Pauta de Conclusão do Curso</CardTitle>
              <CardDescription>
                Modelo de pauta de conclusão do curso para turmas cujos cursos estejam configurados com o modelo de pauta
                <strong> Conclusão</strong>. Todas as disciplinas aparecem em colunas com CA e CFD.
              </CardDescription>
              <Alert className="mt-3 border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/40">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Esta secção usa <strong>Pauta de Conclusão</strong> (não Mini Pauta). Na tabela acima, clique em «Importar modelo»
                  e selecione o tipo «Pauta de Conclusão» para adicionar o modelo Excel correto.
                </AlertDescription>
              </Alert>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Exportar com dados reais</Label>
                <Select value={turmaIdExport} onValueChange={setTurmaIdExport}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a turma (ou preview)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__preview__">Preview (dados fictícios)</SelectItem>
                    {turmas.map((t: { id: string; nome: string; curso?: { nome: string } }) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome} {t.curso?.nome ? `— ${t.curso.nome}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecione uma turma para exportar com notas e alunos reais. Apenas turmas de cursos com modelo de pauta Conclusão aparecem na lista.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={handlePreviewPautaConclusaoSaude}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver modelo
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportExcelPautaSaude}
                  disabled={exportExcelLoading}
                >
                  {exportExcelLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Exportar Excel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certificados" className="space-y-4">
          <ModelosImportadosSection
            tipoAcademico={tipoAcademico as "SUPERIOR" | "SECUNDARIO"}
            onPreviewDoc={handlePreviewDoc}
            onPreviewPauta={handlePreviewPauta}
            filterTipos={["CERTIFICADO"]}
            defaultTipo="CERTIFICADO"
            tituloSecao="Certificados importados"
            compactMode
          />
        </TabsContent>

        <TabsContent value="declaracoes" className="space-y-4">
          <ModelosImportadosSection
            tipoAcademico={tipoAcademico as "SUPERIOR" | "SECUNDARIO"}
            onPreviewDoc={handlePreviewDoc}
            onPreviewPauta={handlePreviewPauta}
            filterTipos={["DECLARACAO_MATRICULA", "DECLARACAO_FREQUENCIA"]}
            defaultTipo="DECLARACAO_MATRICULA"
            tituloSecao="Declarações importadas"
            compactMode
          />
        </TabsContent>
      </Tabs>

      <Dialog open={preview.open} onOpenChange={(open) => setPreview((p) => ({ ...p, open }))}>
        <DialogContent className="fixed left-1/2 top-1/2 z-50 flex w-[min(95vw,1200px)] h-[min(90vh,calc(100dvh-2rem))] min-h-[400px] max-w-[95vw] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-auto resize gap-0 border bg-background p-0 shadow-lg sm:rounded-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2 text-left">
            <DialogTitle>{preview.title}</DialogTitle>
            <DialogDescription>
              Dados de exemplo. Os dados reais vêm do sistema ao emitir.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden px-6 pb-6">
            {preview.loading ? (
              <div className="flex flex-1 items-center justify-center border rounded-lg bg-muted/30">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : preview.errorMessage ? (
              <div className="flex flex-1 items-center justify-center p-8 border rounded-lg bg-muted/30">
                <div className="text-center space-y-3 max-w-md">
                  <p className="text-sm text-muted-foreground">{preview.errorMessage}</p>
                  <p className="text-xs text-muted-foreground">
                    Importe um modelo em Configurações → Modelos de Documentos para visualizar.
                  </p>
                </div>
              </div>
            ) : preview.type === "html" && preview.html ? (
              <div className="flex flex-1 min-h-0 flex-col gap-2 w-full overflow-hidden">
                <div className="flex justify-end shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      try {
                        const blob = new Blob([preview.html!], { type: "text/html;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        window.open(url, "_blank", "noopener,noreferrer");
                        setTimeout(() => URL.revokeObjectURL(url), 10000);
                      } catch {
                        toast.error("Não foi possível abrir em nova aba.");
                      }
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir em nova aba
                  </Button>
                </div>
                <iframe
                  srcDoc={injectCertificatePreviewStyles(preview.html)}
                  title={preview.title}
                  className="flex-1 min-h-0 w-full border rounded-lg bg-white"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : preview.type === "pdf" && preview.pdfBase64 ? (
              <div className="flex flex-1 min-h-0 flex-col gap-2 w-full overflow-hidden">
                <div className="flex justify-end shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      try {
                        const binary = atob(preview.pdfBase64!);
                        const bytes = new Uint8Array(binary.length);
                        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                        const blob = new Blob([bytes], { type: "application/pdf" });
                        const url = URL.createObjectURL(blob);
                        window.open(url + "#view=FitH", "_blank", "noopener,noreferrer");
                        setTimeout(() => URL.revokeObjectURL(url), 60000);
                      } catch {
                        toast.error("Não foi possível abrir o PDF em nova aba.");
                      }
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir em nova aba
                  </Button>
                </div>
                <div className="flex-1 min-h-0 w-full border rounded-lg bg-muted/20 overflow-hidden">
                  <iframe
                    src={`data:application/pdf;base64,${preview.pdfBase64}#view=FitH`}
                    title={preview.title}
                    className="h-full w-full min-h-0 border-0"
                  />
                </div>
              </div>
            ) : preview.type === "excel" && preview.excelBase64 ? (
              <div className="flex flex-1 min-h-0 flex-col gap-2 w-full overflow-hidden">
                <p className="text-sm text-muted-foreground shrink-0">
                  Pré-visualização da primeira folha do Excel (dados de exemplo). Pode descarregar o ficheiro original abaixo.
                </p>
                <ScrollArea className="h-[min(55vh,500px)] flex-1 min-h-[280px] border rounded-lg bg-white shrink-0">
                  {(() => {
                    const rows = parseExcelForPreview(preview.excelBase64);
                    if (!rows?.length) {
                      return (
                        <div className="p-8 text-center text-muted-foreground">
                          Não foi possível ler o conteúdo. Use o botão para descarregar o ficheiro Excel.
                        </div>
                      );
                    }
                    const maxCols = Math.max(...rows.map((r) => r.length));
                    return (
                      <div className="p-4 overflow-auto">
                        <table className="border-collapse text-sm w-full">
                          <tbody>
                            {rows.map((row, rIdx) => (
                              <tr key={rIdx}>
                                {Array.from({ length: maxCols }, (_, cIdx) => (
                                  <td key={cIdx} className="border border-border px-2 py-1 whitespace-nowrap">
                                    {row[cIdx] ?? ""}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </ScrollArea>
                <div className="flex justify-end shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const blob = await fetch(
                        `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${preview.excelBase64}`
                      ).then((r) => r.blob());
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `mini-pauta-preview-${Date.now()}.xlsx`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descarregar Excel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
