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
import { FileText, Award, FileCheck, ClipboardList, Loader2, Eye, Download, Upload, Pencil, Trash2, Info, FileDown, Link2, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { TemplateMappingDialog } from "./TemplateMappingDialog";
import { CellMappingEditor } from "./CellMappingEditor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const TIPOS_DOCUMENTO = [
  { value: "CERTIFICADO", label: "Certificado" },
  { value: "DECLARACAO_MATRICULA", label: "Declaração de Matrícula" },
  { value: "DECLARACAO_FREQUENCIA", label: "Declaração de Frequência" },
  { value: "MINI_PAUTA", label: "Mini Pauta" },
  { value: "PAUTA_CONCLUSAO", label: "Pauta de Conclusão" },
  { value: "BOLETIM", label: "Boletim" },
] as const;

const FORMATOS_CERT_DECL = [
  { value: "HTML", label: "HTML" },
  { value: "WORD", label: "Word (.docx)" },
  { value: "PDF", label: "PDF (.pdf)" },
] as const;

const FORMATO_BOLETIM = { value: "EXCEL", label: "Excel (.xlsx)" } as const;

/** Placeholder para modelos - evita ReferenceError em JSX */
const PH_IMAGEM_FUNDO = '\u007b\u007bIMAGEM_FUNDO_URL\u007d\u007d';

/** Placeholders para modelos - constantes evitam ReferenceError em JSX */
const PLACEHOLDERS_EXEMPLO = [
  "{{NOME_ALUNO}}",
  "{{CURSO}}",
  "{{ANO_LETIVO}}",
  "{{N_DOCUMENTO}}",
  "{{LOGO_IMG}}",
  "{{IMAGEM_FUNDO_URL}}",
  "{{MINISTERIO_SUPERIOR}}",
  "{{CARGO_ASSINATURA_1}}",
];

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
}: {
  tipoAcademico: "SUPERIOR" | "SECUNDARIO";
  onPreviewDoc: (tipo: "CERTIFICADO" | "DECLARACAO_MATRICULA" | "DECLARACAO_FREQUENCIA", tipoAcad: "SUPERIOR" | "SECUNDARIO", label: string) => void;
  onPreviewPauta?: (tipoPauta: "PROVISORIA" | "DEFINITIVA", label: string) => void;
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
  const { data: modelosRaw = [], isLoading } = useQuery({
    queryKey: ["modelos-documento", tipoAcademico],
    queryFn: () => configuracoesInstituicaoApi.listarModelosDocumento({ tipoAcademico }),
  });
  // Isolamento: exibir apenas modelos do tipo da instituição ou "Ambos" (tipoAcademico null)
  const modelos = modelosRaw.filter(
    (m: { tipoAcademico?: string | null }) => !m.tipoAcademico || m.tipoAcademico === tipoAcademico
  );

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

  const isSecundario = tipoAcademico === "SECUNDARIO";
  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-modelos"],
    queryFn: () => cursosApi.getAll({ excludeTipo: "classe" }),
    enabled: !isSecundario,
  });

  const isExcelModelo = formData.tipo === "BOLETIM" || formData.tipo === "PAUTA_CONCLUSAO" || formData.tipo === "MINI_PAUTA";
  const formatosDisponiveis = isExcelModelo ? [FORMATO_BOLETIM] : FORMATOS_CERT_DECL;

  const openCreate = () => {
    setEditingId(null);
    setFormData({
      tipo: "CERTIFICADO",
      tipoAcademico: tipoAcademico,
      cursoId: "ALL",
      nome: "",
      descricao: "",
      formato: "HTML",
      htmlTemplate: "",
      excelTemplateBase64: "",
      excelTemplateMode: "PLACEHOLDER",
      excelCellMappingJson: "",
      orientacaoPagina: "",
      ativo: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (m: { id: string; tipo: string; tipoAcademico: string | null; cursoId: string | null; nome: string; descricao: string | null; htmlTemplate: string; formatoDocumento?: string | null; excelTemplateBase64?: string | null; excelTemplateMode?: string | null; excelCellMappingJson?: string | null; orientacaoPagina?: string | null; ativo: boolean }) => {
    setEditingId(m.id);
    const formato = m.formatoDocumento ?? (m.tipo === "BOLETIM" || m.tipo === "PAUTA_CONCLUSAO" || m.tipo === "MINI_PAUTA" ? "EXCEL" : "HTML");
    setFormData({
      tipo: m.tipo,
      tipoAcademico: m.tipoAcademico ?? tipoAcademico,
      cursoId: m.cursoId ?? "ALL",
      nome: m.nome,
      descricao: m.descricao ?? "",
      formato,
      htmlTemplate: m.htmlTemplate ?? "",
      excelTemplateBase64: (m as { excelTemplateBase64?: string })?.excelTemplateBase64 ?? "",
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
    const isExcelDoc = formData.tipo === "BOLETIM" || formData.tipo === "PAUTA_CONCLUSAO" || formData.tipo === "MINI_PAUTA";
    if (isExcelDoc && !formData.excelTemplateBase64) {
      const label = formData.tipo === "BOLETIM" ? "Boletim" : formData.tipo === "PAUTA_CONCLUSAO" ? "Pauta de Conclusão" : "Mini Pauta";
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
        excelTemplateBase64: isExcelDoc ? formData.excelTemplateBase64 : undefined,
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
        await configuracoesInstituicaoApi.atualizarModeloDocumento(editingId, payload);
        toast.success("Modelo atualizado com sucesso");
      } else {
        await configuracoesInstituicaoApi.criarModeloDocumento(payload);
        toast.success("Modelo importado com sucesso");
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["modelos-documento"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(msg);
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

  const hasMappablePlaceholders = (m: { templatePlaceholdersJson?: string | null }) =>
    !!m.templatePlaceholdersJson && m.templatePlaceholdersJson.trim().length > 0;
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
    templateMappings?: { campoTemplate: string; campoSistema: string }[];
  }) => {
    setMappingModelo({
      id: m.id,
      nome: m.nome,
      placeholders: parsePlaceholders(m.templatePlaceholdersJson),
      mappings: m.templateMappings ?? [],
    });
    setMappingDialogOpen(true);
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
        docxUploadTipo
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Importar e gerir modelos
        </CardTitle>
        <CardDescription className="space-y-2">
          <span className="block">
            <strong>Excel</strong> (Pauta Final, Mini Pauta, Boletim): modo <em>Placeholders</em> — coloque {"{{ALUNO_1_NOME}}"}, {"{{ALUNO_1_DISC_1_MAC}}"}, etc. nas células. Modo <em>Mapeamento por coordenadas</em> — importe o ficheiro oficial sem editar; depois use o botão <strong>Mapear células</strong> na linha do modelo para configurar coordenadas.
          </span>
          <span className="block">
            <strong>Word (DOCX)</strong> (Certificados, Declarações): use <strong>Importar DOCX</strong> abaixo; depois clique em <strong>Mapear</strong> na linha do modelo para associar placeholders aos campos do sistema.
          </span>
          <span className="block">
            <strong>HTML / PDF</strong>: placeholders {"{{NOME_ALUNO}}"}, {"{{CURSO}}"}, {"{{ANO_LETIVO}}"}.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={openCreate}>
            <Upload className="h-4 w-4 mr-2" />
            Importar modelo (Excel / HTML)
          </Button>
          <Button variant="outline" onClick={() => setDocxUploadOpen(true)}>
            <FileDown className="h-4 w-4 mr-2" />
            Importar DOCX (Word)
          </Button>
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
                    <td className="p-3 text-right">
                      {["CERTIFICADO", "DECLARACAO_MATRICULA", "DECLARACAO_FREQUENCIA"].includes(m.tipo) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mr-1"
                          onClick={() => onPreviewDoc(m.tipo as any, (m.tipoAcademico as any) ?? tipoAcademico, m.nome)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {m.tipo === "MINI_PAUTA" && onPreviewPauta && (
                        <>
                          <Button variant="ghost" size="sm" className="mr-1" onClick={() => onPreviewPauta("PROVISORIA", `${m.nome} - Provisória`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="mr-1" onClick={() => onPreviewPauta("DEFINITIVA", `${m.nome} - Definitiva`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {hasMappablePlaceholders(m as { templatePlaceholdersJson?: string | null }) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-1"
                          onClick={() => openMapping(m as { id: string; nome: string; templatePlaceholdersJson?: string | null; templateMappings?: { campoTemplate: string; campoSistema: string }[] })}
                          title="Mapear placeholders do Word aos campos do sistema"
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          Mapear
                        </Button>
                      )}
                      {["PAUTA_CONCLUSAO", "BOLETIM", "MINI_PAUTA"].includes(m.tipo) &&
                        (m as { excelTemplateMode?: string }).excelTemplateMode === "CELL_MAPPING" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-1"
                          onClick={() => openEdit(m as any)}
                          title="Editar e configurar mapeamento de células (coordenadas Excel → campos)"
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
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
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
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v, formato: (v === "BOLETIM" || v === "PAUTA_CONCLUSAO" || v === "MINI_PAUTA") ? "EXCEL" : "HTML", excelTemplateBase64: (v === "BOLETIM" || v === "PAUTA_CONCLUSAO" || v === "MINI_PAUTA") ? formData.excelTemplateBase64 : "" })}>
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
            {formData.tipo !== "BOLETIM" && formData.tipo !== "PAUTA_CONCLUSAO" && (
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
                      Use <em>Sugerir mapeamento</em> (com o Excel carregado) ou adicione manualmente células únicas e lista de {formData.tipo === "BOLETIM" ? "disciplinas" : "alunos"}.
                    </p>
                    <CellMappingEditor
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
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>HTML do modelo</Label>
                  <span className="text-xs text-muted-foreground flex items-center gap-1" title={placeholders.map((p) => `{{${p.chave}}}`).join(", ")}>
                    <Info className="h-3 w-3" /> Placeholders disponíveis
                  </span>
                </div>
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
              </div>
            ) : formData.formato === "WORD" ? (
              <div className="space-y-2">
                <Label>Ficheiro Word (.docx)</Label>
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
                  <Textarea
                    value={formData.htmlTemplate}
                    onChange={(e) => setFormData({ ...formData, htmlTemplate: e.target.value })}
                    placeholder="HTML convertido (pode editar)"
                    rows={8}
                    className="font-mono text-xs"
                  />
                )}
              </div>
            ) : (
              <div className="space-y-2">
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
                  <Textarea
                    value={formData.htmlTemplate}
                    onChange={(e) => setFormData({ ...formData, htmlTemplate: e.target.value })}
                    placeholder="HTML convertido (pode editar)"
                    rows={8}
                    className="font-mono text-xs"
                  />
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
              Tem certeza? O sistema voltará a usar o modelo padrão para este tipo de documento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={docxUploadOpen} onOpenChange={setDocxUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar modelo DOCX</DialogTitle>
            <DialogDescription>
              Carregue um ficheiro Word (.docx) com placeholders no formato docxtemplater (ex: {"{{nome}}"}, {"{{student.fullName}}"}). Os placeholders são extraídos automaticamente para mapeamento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDocxUpload} className="space-y-4">
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
    type: "html" | "pdf";
    html?: string;
    pdfBase64?: string;
    title: string;
    loading: boolean;
  }>({ open: false, type: "html", title: "", loading: false });

  const tipoAcademico = instituicao?.tipo_academico ?? config?.tipo_academico ?? config?.tipoAcademico ?? "SUPERIOR";
  const isSecundario = tipoAcademico === "SECUNDARIO";

  const handlePreviewDoc = async (
    tipo: "CERTIFICADO" | "DECLARACAO_MATRICULA" | "DECLARACAO_FREQUENCIA",
    tipoAcad: "SUPERIOR" | "SECUNDARIO",
    label: string
  ) => {
    setPreview((p) => ({ ...p, open: true, loading: true, title: label }));
    try {
      const { html } = await configuracoesInstituicaoApi.previewDocumento({
        tipo,
        tipoAcademico: tipoAcad,
      });
      setPreview({ open: true, type: "html", html, title: label, loading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar pré-visualização";
      toast.error(msg);
      setPreview((p) => ({ ...p, loading: false }));
    }
  };

  const handlePreviewPauta = async (
    tipoPauta: "PROVISORIA" | "DEFINITIVA",
    label: string
  ) => {
    setPreview((p) => ({ ...p, open: true, loading: true, title: label, type: "pdf" }));
    try {
      const { pdfBase64 } = await configuracoesInstituicaoApi.previewPauta({
        tipoPauta,
        tipoAcademico: tipoAcademico as "SUPERIOR" | "SECUNDARIO",
      });
      setPreview({ open: true, type: "pdf", pdfBase64, title: label, loading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar pré-visualização";
      toast.error(msg);
      setPreview((p) => ({ ...p, loading: false }));
    }
  };

  const [exportExcelLoading, setExportExcelLoading] = useState(false);
  const [turmaIdExport, setTurmaIdExport] = useState<string>("__preview__");
  const [guiaPassosOpen, setGuiaPassosOpen] = useState(false);

  const { data: turmasRaw = [] } = useQuery({
    queryKey: ["turmas-export-pauta"],
    queryFn: () => turmasApi.getAll(),
  });
  const turmas = turmasRaw.filter((t: { curso?: { modeloPauta?: string } }) => !t.curso || t.curso.modeloPauta === "CONCLUSAO" || t.curso.modeloPauta === "SAUDE");

  const handlePreviewPautaConclusaoSaude = async () => {
    setPreview((p) => ({ ...p, open: true, loading: true, title: "Pauta de Conclusão - Saúde" }));
    try {
      const { pdfBase64 } = await configuracoesInstituicaoApi.previewPautaConclusaoSaude();
      setPreview({ open: true, type: "pdf", pdfBase64, title: "Pauta de Conclusão do Curso - Modelo Saúde", loading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar pré-visualização";
      toast.error(msg);
      setPreview((p) => ({ ...p, loading: false }));
    }
  };

  const handleExportExcelPautaSaude = async () => {
    setExportExcelLoading(true);
    const turmaId = turmaIdExport && turmaIdExport !== "__preview__" ? turmaIdExport : undefined;
    try {
      try {
        const blob = await configuracoesInstituicaoApi.getPautaConclusaoSaudeExcelExport(turmaId ?? null);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pauta-conclusao-${Date.now()}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Excel exportado com modelo do governo.');
        return;
      } catch (modelErr: unknown) {
        const status = (modelErr as { response?: { status?: number } })?.response?.status;
        if (status !== 404) throw modelErr;
      }
      const dados = await configuracoesInstituicaoApi.getPautaConclusaoSaudeDados(turmaId ?? undefined);
      const { exportarPautaConclusaoSaudeExcel } = await import('@/utils/pautaConclusaoSaudeExcel');
      exportarPautaConclusaoSaudeExcel(dados);
      toast.success(
        turmaId ? 'Excel exportado com dados reais.' : 'Excel exportado (preview). Selecione uma turma para dados reais.'
      );
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
                <h4 className="font-medium mb-2">Certificado / Declaração (HTML ou Word)</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Importar modelo → Tipo: Certificado (ou Declaração), Formato: HTML ou Word</li>
                  <li>Colar HTML com placeholders ou upload DOCX</li>
                  <li>Importar e marcar Ativo</li>
                  <li>Na emissão, o sistema usa o modelo automaticamente</li>
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
          <Card>
            <CardHeader>
              <CardTitle>Mini Pauta (por disciplina)</CardTitle>
              <CardDescription>
                Modelo de pauta por turma/disciplina. {isSecundario ? "Ensino Secundário (Classe)" : "Ensino Superior (Curso)"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => handlePreviewPauta("PROVISORIA", "Mini Pauta - Provisória")}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver modelo Provisória
              </Button>
              <Button
                variant="outline"
                onClick={() => handlePreviewPauta("DEFINITIVA", "Mini Pauta - Definitiva")}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver modelo Definitiva
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pauta de Conclusão do Curso</CardTitle>
              <CardDescription>
                Modelo de pauta de conclusão do curso para turmas cujos cursos estejam configurados com o modelo de pauta
                <strong> Conclusão</strong>. Todas as disciplinas aparecem em colunas com CA e CFD.
              </CardDescription>
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
          <Card>
            <CardHeader>
              <CardTitle>Certificados</CardTitle>
              <CardDescription>
                Modelos de certificado de conclusão. Apenas o nível da instituição é exibido.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {isSecundario ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    handlePreviewDoc("CERTIFICADO", "SECUNDARIO", "Certificado - Ensino Secundário")
                  }
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver modelo Ensino Secundário
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() =>
                    handlePreviewDoc("CERTIFICADO", "SUPERIOR", "Certificado - Ensino Superior")
                  }
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver modelo Ensino Superior
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="declaracoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Declarações</CardTitle>
              <CardDescription>
                Modelos de declaração de matrícula e de frequência.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  handlePreviewDoc(
                    "DECLARACAO_MATRICULA",
                    tipoAcademico as "SUPERIOR" | "SECUNDARIO",
                    "Declaração de Matrícula"
                  )
                }
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver modelo Matrícula
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  handlePreviewDoc(
                    "DECLARACAO_FREQUENCIA",
                    tipoAcademico as "SUPERIOR" | "SECUNDARIO",
                    "Declaração de Frequência"
                  )
                }
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver modelo Frequência
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={preview.open} onOpenChange={(open) => setPreview((p) => ({ ...p, open }))}>
        <DialogContent className={`${preview.type === "pdf" ? "max-w-6xl" : "max-w-4xl"} max-h-[90vh] flex flex-col p-0 gap-0`}>
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>{preview.title}</DialogTitle>
            <DialogDescription>
              Dados de exemplo. Os dados reais vêm do sistema ao emitir.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
            {preview.loading ? (
              <div className="flex items-center justify-center h-96 border rounded-lg bg-muted/30">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : preview.type === "html" && preview.html ? (
              <iframe
                srcDoc={preview.html}
                title={preview.title}
                className="w-full h-[70vh] min-h-[500px] border rounded-lg bg-white"
                sandbox="allow-same-origin"
              />
            ) : preview.type === "pdf" && preview.pdfBase64 ? (
              <div className="w-full min-h-[70vh] border rounded-lg bg-muted/20 overflow-auto">
                <iframe
                  src={`data:application/pdf;base64,${preview.pdfBase64}#view=FitH`}
                  title={preview.title}
                  className="w-full min-h-[70vh] border-0"
                  style={{ minHeight: "calc(100vh - 12rem)" }}
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
