import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { tiposDocumentoApi, documentosEmitidosApi, userRolesApi, profilesApi, matriculasApi } from "@/services/api";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Printer, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantFilter } from "@/hooks/useTenantFilter";

interface TipoDocumento {
  id: string;
  nome: string;
  codigo: string;
  descricao: string | null;
  template_html: string;
  taxa: number | null;
}

interface TipoDocumentoBasic {
  id: string;
  nome: string;
  codigo: string;
}

interface Aluno {
  id: string;
  nome_completo: string;
  numero_identificacao: string | null;
  email: string;
}

interface DocumentoEmitido {
  id: string;
  numero_documento: string;
  tipo_documento_id: string;
  aluno_id: string;
  data_emissao: string;
  status: string;
  observacoes: string | null;
  tipos_documento?: TipoDocumentoBasic;
  profiles?: Aluno;
}

export function DocumentosTab() {
  const queryClient = useQueryClient();
  const { config } = useInstituicao();
  const { user } = useAuth();
  const { instituicaoId } = useTenantFilter();
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTipo, setSelectedTipo] = useState<string>("");
  const [selectedAluno, setSelectedAluno] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");

  const { data: tiposDocumento } = useQuery({
    queryKey: ["tipos-documento"],
    queryFn: async () => {
      const data = await tiposDocumentoApi.getAll();
      return data?.filter((t: any) => t.ativo !== false) as TipoDocumento[];
    },
  });

  const { data: alunos } = useQuery({
    queryKey: ["alunos-documentos", instituicaoId],
    queryFn: async () => {
      if (!instituicaoId) return [];
      
      const alunoRoles = await userRolesApi.getByRole("ALUNO", instituicaoId);
      if (!alunoRoles || alunoRoles.length === 0) return [];

      const userIds = alunoRoles.map((r: any) => r.user_id);
      const profiles = await profilesApi.getByIds(userIds);
      return profiles as Aluno[];
    },
  });

  const { data: documentos, isLoading } = useQuery({
    queryKey: ["documentos-emitidos", searchTerm, instituicaoId],
    queryFn: async () => {
      const data = await documentosEmitidosApi.getAll({ instituicaoId });
      
      // Enrich with student profiles
      const enrichedDocs = await Promise.all(
        (data || []).map(async (doc: any) => {
          try {
            const alunoData = await profilesApi.getById(doc.aluno_id);
            return { ...doc, profiles: alunoData };
          } catch {
            return { ...doc, profiles: undefined };
          }
        })
      );
      
      // Filter by search term if provided
      if (searchTerm) {
        return enrichedDocs.filter((doc: any) => 
          doc.numero_documento?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.profiles?.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase())
        ) as DocumentoEmitido[];
      }
      
      return enrichedDocs as DocumentoEmitido[];
    },
  });

  const emitirDocumentoMutation = useSafeMutation({
    mutationFn: async () => {
      // Get the next document number
      const numeroData = await documentosEmitidosApi.gerarNumero();

      await documentosEmitidosApi.create({
        numeroDocumento: numeroData,
        tipoDocumentoId: selectedTipo,
        alunoId: selectedAluno,
        emitidoPor: user?.id,
        observacoes: observacoes || undefined,
      });

      return numeroData;
    },
    onSuccess: (numero) => {
      queryClient.invalidateQueries({ queryKey: ["documentos-emitidos"] });
      toast.success(`Documento ${numero} emitido com sucesso!`);
      setDialogOpen(false);
      setSelectedTipo("");
      setSelectedAluno("");
      setObservacoes("");
    },
    onError: (error) => {
      console.error("Erro ao emitir documento:", error);
      toast.error("Erro ao emitir documento");
    },
  });

  const cancelarDocumentoMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      // Note: using a general update approach
      await documentosEmitidosApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos-emitidos"] });
      toast.success("Documento cancelado");
    },
  });

  const imprimirDocumento = async (documento: DocumentoEmitido) => {
    const tipo = tiposDocumento?.find(t => t.id === documento.tipo_documento_id);
    const aluno = alunos?.find(a => a.id === documento.aluno_id);
    
    if (!tipo || !aluno) {
      toast.error("Dados incompletos para impressão");
      return;
    }

    // Get student's course info
    const matriculas = await matriculasApi.getByAlunoId(aluno.id);
    const matriculaAtiva = matriculas?.find((m: any) => m.status === 'Ativa' || m.status === 'ativa');
    const turma = matriculaAtiva?.turmas as { nome: string; ano: number; cursos: { nome: string; carga_horaria: number } } | null;

    // Format date in Portuguese
    const dataExtenso = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    // Replace template variables
    let htmlContent = tipo.template_html
      .replace(/\{\{nome_aluno\}\}/g, aluno.nome_completo)
      .replace(/\{\{numero_identificacao\}\}/g, aluno.numero_identificacao || "N/A")
      .replace(/\{\{nome_curso\}\}/g, turma?.cursos?.nome || "N/A")
      .replace(/\{\{nome_turma\}\}/g, turma?.nome || "N/A")
      .replace(/\{\{ano_letivo\}\}/g, turma?.ano?.toString() || new Date().getFullYear().toString())
      .replace(/\{\{carga_horaria\}\}/g, turma?.cursos?.carga_horaria?.toString() || "N/A")
      .replace(/\{\{carga_horaria_total\}\}/g, turma?.cursos?.carga_horaria?.toString() || "N/A")
      .replace(/\{\{cidade\}\}/g, "Luanda")
      .replace(/\{\{data_extenso\}\}/g, dataExtenso)
      .replace(/\{\{nome_instituicao\}\}/g, config?.nome_instituicao || "Instituição")
      .replace(/\{\{data_ingresso\}\}/g, format(new Date(), "MMMM 'de' yyyy", { locale: ptBR }))
      .replace(/\{\{horario\}\}/g, "08:00 às 12:00")
      .replace(/\{\{periodo_letivo\}\}/g, `${turma?.ano || new Date().getFullYear()}`);

    // Create print window
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${tipo.nome} - ${documento.numero_documento}</title>
          <style>
            @page { margin: 2cm; }
            body { 
              font-family: 'Times New Roman', Times, serif; 
              font-size: 14pt; 
              line-height: 1.8;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 { font-size: 18pt; margin-bottom: 30px; }
            .header { 
              text-align: center; 
              margin-bottom: 40px;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
            }
            .header img { max-height: 80px; margin-bottom: 10px; }
            .header h2 { margin: 0; font-size: 16pt; }
            .doc-number { 
              text-align: right; 
              font-size: 10pt; 
              color: #666;
              margin-bottom: 20px;
            }
            p { text-align: justify; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            ${config?.logo_url ? `<img src="${config.logo_url}" alt="Logo" />` : ""}
            <h2>${config?.nome_instituicao || "Instituição de Ensino"}</h2>
            ${config?.endereco ? `<p style="font-size: 10pt; margin: 5px 0;">${config.endereco}</p>` : ""}
          </div>
          <div class="doc-number">Documento Nº: ${documento.numero_documento}</div>
          ${htmlContent}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Emitido":
        return <Badge className="bg-green-100 text-green-800">Emitido</Badge>;
      case "Cancelado":
        return <Badge variant="destructive">Cancelado</Badge>;
      case "Expirado":
        return <Badge variant="secondary">Expirado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Documentos Acadêmicos</h2>
          <p className="text-muted-foreground">
            Emita declarações, históricos e certificados
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Emitir Documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Emitir Novo Documento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposDocumento?.map((tipo) => (
                      <SelectItem key={tipo.id} value={tipo.id}>
                        <div className="flex justify-between items-center gap-4">
                          <span>{tipo.nome}</span>
                          {tipo.taxa && tipo.taxa > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Taxa: {tipo.taxa.toLocaleString("pt-AO")} Kz
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Aluno</Label>
                <Select value={selectedAluno} onValueChange={setSelectedAluno}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o aluno" />
                  </SelectTrigger>
                  <SelectContent>
                    {alunos?.map((aluno) => (
                      <SelectItem key={aluno.id} value={aluno.id}>
                        {aluno.nome_completo} - {aluno.numero_identificacao || aluno.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => emitirDocumentoMutation.mutate()}
                disabled={!selectedTipo || !selectedAluno || emitirDocumentoMutation.isPending}
              >
                <FileText className="h-4 w-4 mr-2" />
                Emitir Documento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {tiposDocumento?.slice(0, 4).map((tipo) => {
          const count = documentos?.filter(d => d.tipo_documento_id === tipo.id && d.status === "Emitido").length || 0;
          return (
            <Card key={tipo.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tipo.nome}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground">documentos emitidos</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número ou nome do aluno..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Documents Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Documento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Data Emissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentos?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    Nenhum documento emitido ainda
                  </TableCell>
                </TableRow>
              ) : (
                documentos?.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-mono font-medium">
                      {doc.numero_documento}
                    </TableCell>
                    <TableCell>{doc.tipos_documento?.nome}</TableCell>
                    <TableCell>{doc.profiles?.nome_completo}</TableCell>
                    <TableCell>
                      {format(new Date(doc.data_emissao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getStatusBadge(doc.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {doc.status === "Emitido" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => imprimirDocumento(doc)}
                            >
                              <Printer className="h-4 w-4 mr-1" />
                              Imprimir
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelarDocumentoMutation.mutate(doc.id)}
                            >
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}