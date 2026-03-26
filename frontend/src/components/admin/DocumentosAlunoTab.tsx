import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { documentosAlunoApi, storageApi } from "@/services/api";
import { safeToFixed } from "@/lib/utils";
import { EmitirDocumentoTab } from "@/components/admin/EmitirDocumentoTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Upload, Eye, Trash2, Loader2, Download, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SmartSearch } from "@/components/common/SmartSearch";
import { useAlunoSearch } from "@/hooks/useSmartSearch";
import { getApiErrorMessage } from "@/utils/apiErrors";

const TIPOS_DOCUMENTO = [
  { value: "bi_copia", label: "Cópia do BI" },
  { value: "certificado", label: "Certificado" },
  { value: "comprovante_residencia", label: "Comprovante de Residência" },
  { value: "declaracao", label: "Declaração" },
  { value: "outro", label: "Outro" },
];

export function DocumentosAlunoTab() {
  const queryClient = useQueryClient();
  const { searchAlunos } = useAlunoSearch();
  const [selectedAluno, setSelectedAluno] = useState<string | null>(null);
  const [selectedAlunoNome, setSelectedAlunoNome] = useState<string>('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [descricao, setDescricao] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Lista de alunos: SmartSearch + searchAlunos (tenant no servidor). Evita GET redundante pré-listagem.

  const {
    data: documentos = [],
    isLoading: docsLoading,
    isError: docsError,
    error: docsQueryError,
    refetch: refetchDocumentos,
  } = useQuery({
    queryKey: ["documentos-aluno", selectedAluno],
    queryFn: async () => {
      if (!selectedAluno) return [];

      const data = await documentosAlunoApi.getByAlunoId(selectedAluno);
      return data;
    },
    enabled: !!selectedAluno,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("O arquivo deve ter no máximo 10MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const uploadDocument = async () => {
    if (!selectedAluno || !selectedFile || !tipoDocumento) {
      toast.error("Selecione um aluno, arquivo e tipo de documento");
      return;
    }

    setIsUploading(true);
    try {
      // Upload file to storage
      const filePath = await storageApi.uploadDocument(selectedAluno, selectedFile, "documentos_alunos");

      // Create document record
      await documentosAlunoApi.create({
        alunoId: selectedAluno,
        nomeArquivo: selectedFile.name,
        tipoDocumento: tipoDocumento,
        descricao: descricao || undefined,
        arquivoUrl: filePath,
        tamanhoBytes: selectedFile.size,
      });

      queryClient.invalidateQueries({ queryKey: ["documentos-aluno", selectedAluno] });
      toast.success("Documento enviado com sucesso!");
      setIsUploadOpen(false);
      setSelectedFile(null);
      setTipoDocumento("");
      setDescricao("");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Não foi possível enviar o documento."));
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewDocument = async (documentId: string) => {
    if (!documentId) {
      toast.error("ID do documento não encontrado");
      return;
    }

    try {
      const { blob } = await documentosAlunoApi.getArquivoBlob(documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 300_000);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Não foi possível abrir o documento."));
    }
  };

  const handleDownloadDocument = async (documentId: string, fileName: string) => {
    if (!documentId) {
      toast.error("ID do documento não encontrado");
      return;
    }

    try {
      const { blob, filenameHint } = await documentosAlunoApi.getArquivoBlob(documentId, {
        download: true,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameHint || fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Não foi possível baixar o documento."));
    }
  };

  const handleDeleteDocument = async (id: string, filePath: string) => {
    if (!confirm("Tem certeza que deseja excluir este documento?")) return;

    try {
      // Delete file from storage
      try {
        await storageApi.deleteFile(filePath, "documentos_alunos");
      } catch (e) {
        console.warn("Error removing file:", e);
      }

      // Delete document record
      await documentosAlunoApi.delete(id);

      queryClient.invalidateQueries({ queryKey: ["documentos-aluno", selectedAluno] });
      toast.success("Documento excluído!");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Não foi possível excluir o documento."));
    }
  };

  // Removido: filtragem manual de alunos - agora usa SmartSearch

  const getTipoLabel = (tipo: string) => {
    return TIPOS_DOCUMENTO.find((t) => t.value === tipo)?.label || tipo;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${safeToFixed(bytes / 1024, 1)} KB`;
    return `${safeToFixed(bytes / (1024 * 1024), 1)} MB`;
  };

  const getFileExtension = (fileName: string) => {
    if (!fileName) return "";
    const parts = fileName.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Documentos dos Alunos</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Students List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Selecionar Aluno</CardTitle>
          </CardHeader>
          <CardContent>
            <SmartSearch
              placeholder="Digite o nome do aluno, email, BI ou número de identificação..."
              value={selectedAlunoNome}
              selectedId={selectedAluno || undefined}
              onSelect={(item) => {
                if (item) {
                  setSelectedAluno(item.id);
                  setSelectedAlunoNome(item.nomeCompleto || item.nome_completo || '');
                } else {
                  setSelectedAluno(null);
                  setSelectedAlunoNome('');
                }
              }}
              searchFn={searchAlunos}
              emptyMessage="Nenhum aluno encontrado"
            />
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              {selectedAluno 
                ? `Documentos de ${selectedAlunoNome}`
                : "Selecione um aluno"}
            </CardTitle>
            {selectedAluno && (
              <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar Documento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Enviar Documento</DialogTitle>
                    <DialogDescription>
                      Faça upload de um documento do aluno
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Tipo de Documento *</Label>
                      <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_DOCUMENTO.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        placeholder="Descrição opcional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Arquivo *</Label>
                      <Input
                        type="file"
                        onChange={handleFileChange}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      />
                      <p className="text-xs text-muted-foreground">
                        PDF, imagens ou documentos Word. Máx 10MB
                      </p>
                    </div>
                    {selectedFile && (
                      <p className="text-sm text-muted-foreground">
                        Arquivo selecionado: {selectedFile.name}
                      </p>
                    )}
                    <Button
                      onClick={uploadDocument}
                      disabled={isUploading || !selectedFile || !tipoDocumento}
                      className="w-full"
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Enviar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {!selectedAluno ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecione um aluno para ver seus documentos</p>
              </div>
            ) : docsError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="space-y-3">
                  <p>
                    {getApiErrorMessage(
                      docsQueryError,
                      "Não foi possível carregar os documentos deste aluno.",
                    )}
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => refetchDocumentos()}>
                    Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            ) : docsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : documentos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum documento encontrado</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome do Arquivo</TableHead>
                      <TableHead>Tipo de Documento</TableHead>
                      <TableHead>Extensão</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Data de Envio</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentos.map((doc: any) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span>{doc.nome_arquivo || doc.nomeArquivo || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {getTipoLabel(doc.tipo_documento || doc.tipoDocumento)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {getFileExtension(doc.nome_arquivo || doc.nomeArquivo)}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatFileSize(doc.tamanho_bytes || doc.tamanhoBytes)}</TableCell>
                        <TableCell>
                          {doc.created_at || doc.createdAt
                            ? format(new Date(doc.created_at || doc.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleViewDocument(doc.id)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Visualizar documento</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDownloadDocument(doc.id, doc.nome_arquivo || doc.nomeArquivo || 'documento')}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Baixar documento</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteDocument(doc.id, doc.arquivo_url || doc.arquivoUrl)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Excluir documento</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Emitir Documento Oficial (Certificado, Declaração, Histórico) */}
      {selectedAluno && selectedAlunoNome && (
        <EmitirDocumentoTab
          estudanteId={selectedAluno}
          estudanteNome={selectedAlunoNome}
        />
      )}
    </div>
  );
}
