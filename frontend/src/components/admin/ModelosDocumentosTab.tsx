/**
 * Modelos de Documentos - Pré-visualização de mini pautas, certificados e declarações.
 * Permite importar modelos HTML oficiais do governo e vinculá-los por tipo/curso.
 * Multi-tenant: instituicaoId do JWT. Respeita tipoAcademico (SUPERIOR/SECUNDARIO).
 */
import { useState } from "react";
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
import { FileText, Award, FileCheck, ClipboardList, Loader2, Eye, Download, Upload, Pencil, Trash2, Info, FileDown, Link2 } from "lucide-react";
import { toast } from "sonner";
import { TemplateMappingDialog } from "./TemplateMappingDialog";

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
    ativo: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [convertingFile, setConvertingFile] = useState(false);

  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ["modelos-documento"],
    queryFn: () => configuracoesInstituicaoApi.listarModelosDocumento(),
  });

  const { data: placeholders = [] } = useQuery({
    queryKey: ["modelos-documento-placeholders"],
    queryFn: () => configuracoesInstituicaoApi.listarPlaceholdersModelosDocumento(),
  });

  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-modelos"],
    queryFn: () => cursosApi.getAll({ excludeTipo: "classe" }),
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
      ativo: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (m: { id: string; tipo: string; tipoAcademico: string | null; cursoId: string | null; nome: string; descricao: string | null; htmlTemplate: string; formatoDocumento?: string | null; excelTemplateBase64?: string | null; ativo: boolean }) => {
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
      ativo: m.ativo,
    });
    setDialogOpen(true);
  };

  const handleWordFile = async (file: File) => {
    setConvertingFile(true);
    try {
      const mammoth = await import("mammoth");
      const arr = await file.arrayBuffer();
      const { value } = await mammoth.convertToHtml({ arrayBuffer: arr });
      setFormData((f) => ({ ...f, htmlTemplate: value || "", formato: "WORD" }));
      toast.success("Word convertido para HTML. Revise o resultado.");
    } catch (e) {
      toast.error((e as Error)?.message || "Erro ao converter Word");
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
    return new Promise<void>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const b64 = (r.result as string)?.split(",")[1] ?? "";
        setFormData((f) => ({ ...f, excelTemplateBase64: b64, formato: "EXCEL" }));
        toast.success("Modelo Excel carregado.");
        resolve();
      };
      r.onerror = () => reject(new Error("Erro ao ler ficheiro"));
      r.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isExcelDoc = formData.tipo === "BOLETIM" || formData.tipo === "PAUTA_CONCLUSAO" || formData.tipo === "MINI_PAUTA";
    if (isExcelDoc && !formData.excelTemplateBase64) {
      const label = formData.tipo === "BOLETIM" ? "Boletim" : formData.tipo === "PAUTA_CONCLUSAO" ? "Pauta de Conclusão" : "Mini Pauta";
      toast.error(`Carregue o modelo Excel do governo para ${label}.`);
      return;
    }
    if (!isExcelDoc && !formData.htmlTemplate.trim()) {
      toast.error("Cole o HTML ou carregue um ficheiro Word/PDF.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        tipo: formData.tipo,
        tipoAcademico: formData.tipoAcademico || null,
        cursoId: formData.cursoId === "ALL" ? null : formData.cursoId || null,
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim() || null,
        htmlTemplate: isExcelDoc ? "" : formData.htmlTemplate.trim(),
        formatoDocumento: formData.formato,
        excelTemplateBase64: isExcelDoc ? formData.excelTemplateBase64 : undefined,
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

  const isDocxTemplate = (m: { templatePlaceholdersJson?: string | null }) =>
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
          Modelos Importados
        </CardTitle>
        <CardDescription>
          Mini Pauta, Pauta de Conclusão e Boletim seguem a mesma configuração: modelos Excel (.xlsx) fornecidos pelo governo. O sistema adapta os dados reais (estudantes, notas, turmas) ao layout do modelo.
          Placeholders: {"{{TABELA_ALUNOS}}"}, {"{{DISCIPLINA}}"}. Certificados/Declarações: HTML com {"{{NOME_ALUNO}}"}, {"{{CURSO}}"}. Use &quot;Importar DOCX&quot; para modelos Word com mapeamento arrastar-e-largar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={openCreate}>
            <Upload className="h-4 w-4 mr-2" />
            Importar modelo
          </Button>
          <Button variant="outline" onClick={() => setDocxUploadOpen(true)}>
            <FileDown className="h-4 w-4 mr-2" />
            Importar DOCX
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4">Carregando...</div>
        ) : modelos.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 rounded-lg border border-dashed p-6 text-center">
            Nenhum modelo importado. Clique em &quot;Importar modelo&quot; para adicionar modelos oficiais (Mini Pauta, Pauta Conclusão, Boletim, etc.).
          </div>
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Tipo</th>
                  <th className="text-left p-3 font-medium">Nível</th>
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium">Curso</th>
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
                    <td className="p-3">{m.curso?.nome ?? "—"}</td>
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
                      {isDocxTemplate(m as { templatePlaceholdersJson?: string | null }) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mr-1"
                          onClick={() => openMapping(m as { id: string; nome: string; templatePlaceholdersJson?: string | null; templateMappings?: { campoTemplate: string; campoSistema: string }[] })}
                          title="Mapear placeholders"
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="mr-1" onClick={() => openEdit(m as any)}>
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
              Mini Pauta, Pauta de Conclusão e Boletim usam modelos do governo (mesma configuração, formato Excel). Placeholders no Excel: {"{{NOME_ALUNO}}"}, {"{{TABELA_ALUNOS}}"}, {"{{DISCIPLINA}}"}. Certificado/Declarações: HTML ou Word.
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
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Ex: Modelo oficial do Ministério 2024"
              />
            </div>
            <div className="space-y-2">
              <Label>Formato do modelo</Label>
              <Select
                value={formData.formato}
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
              <div className="space-y-2">
                <Label>Modelo Excel do governo (.xlsx)</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleExcelFile(f);
                    e.target.value = "";
                  }}
                  className="cursor-pointer"
                />
                {formData.excelTemplateBase64 && (
                  <p className="text-xs text-emerald-600">Modelo Excel carregado. Pode guardar.</p>
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
              <Label>Ficheiro DOCX</Label>
              <Input
                type="file"
                accept=".docx,.doc"
                onChange={(e) => setDocxUploadFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer"
              />
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
    setPreview((p) => ({ ...p, open: true, loading: true, title: label }));
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

      <Tabs defaultValue="pautas" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
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
          <TabsTrigger value="importados" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Modelos Importados
          </TabsTrigger>
        </TabsList>

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

        <TabsContent value="importados" className="space-y-4">
          <ModelosImportadosSection
            tipoAcademico={tipoAcademico as "SUPERIOR" | "SECUNDARIO"}
            onPreviewDoc={handlePreviewDoc}
            onPreviewPauta={handlePreviewPauta}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={preview.open} onOpenChange={(open) => setPreview((p) => ({ ...p, open }))}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>{preview.title}</DialogTitle>
            <DialogDescription>
              Dados de exemplo. Os dados reais vêm do sistema ao emitir.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6">
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
              <iframe
                src={`data:application/pdf;base64,${preview.pdfBase64}`}
                title={preview.title}
                className="w-full h-[70vh] min-h-[500px] border rounded-lg bg-white"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
