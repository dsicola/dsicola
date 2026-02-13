import { useQuery } from "@tanstack/react-query";
import { documentosEmitidosApi, tiposDocumentoApi, matriculasApi, profilesApi } from "@/services/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useInstituicao } from "@/contexts/InstituicaoContext";

interface TipoDocumento {
  id: string;
  nome: string;
  codigo: string;
  template_html: string;
}

interface DocumentoEmitido {
  id: string;
  numero_documento: string;
  data_emissao: string;
  status: string;
  tipos_documento: TipoDocumento;
}

export default function MeusDocumentos() {
  const { user } = useAuth();
  const { config } = useInstituicao();

  const { data: documentos, isLoading } = useQuery({
    queryKey: ["meus-documentos", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return await documentosEmitidosApi.getAll({ alunoId: user.id });
    },
    enabled: !!user?.id,
  });

  const { data: tiposDisponiveis } = useQuery({
    queryKey: ["tipos-documento-disponiveis"],
    queryFn: async () => {
      return await tiposDocumentoApi.getAll();
    },
  });

  const imprimirDocumento = async (documento: DocumentoEmitido) => {
    if (!user) return;

    // Get student's course info
    const matriculas = await matriculasApi.getByAlunoId(user.id);
    const matriculaAtiva = matriculas.find((m: any) => m.status === "Ativa" || m.status === "ativa");
    
    const turma = matriculaAtiva?.turmas as { nome: string; ano: number; cursos: { nome: string; carga_horaria: number } } | null;
    const dataExtenso = format(new Date(documento.data_emissao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    // Get profile data for the user
    const profileData = await profilesApi.getById(user.id).catch(() => null);

    let htmlContent = documento.tipos_documento.template_html
      .replace(/\{\{nome_aluno\}\}/g, user.nome_completo || "")
      .replace(/\{\{numero_identificacao\}\}/g, profileData?.numero_identificacao || "N/A")
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

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${documento.tipos_documento.nome} - ${documento.numero_documento}</title>
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
    return (
      <DashboardLayout>
        <div className="flex justify-center p-8">Carregando...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Meus Documentos</h1>
          <p className="text-muted-foreground">
            Visualize e reimprima seus documentos acadêmicos
          </p>
        </div>

        {/* Available Document Types */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Tipos de Documentos Disponíveis</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tiposDisponiveis?.filter((t: any) => t.ativo).map((tipo: any) => (
              <Card key={tipo.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{tipo.nome}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">
                    {tipo.descricao || "Documento acadêmico oficial"}
                  </p>
                  {tipo.taxa && tipo.taxa > 0 && (
                    <Badge variant="outline">
                      Taxa: {tipo.taxa.toLocaleString("pt-AO")} Kz
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Para solicitar um documento, dirija-se à secretaria da instituição.
          </p>
        </div>

        {/* My Documents */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Documentos Emitidos</h2>
          {documentos?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Você ainda não possui documentos emitidos</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {documentos?.map((doc: DocumentoEmitido) => (
                <Card key={doc.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{doc.tipos_documento.nome}</h3>
                        <p className="text-sm text-muted-foreground">
                          Nº {doc.numero_documento} • Emitido em{" "}
                          {format(new Date(doc.data_emissao), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(doc.status)}
                      {doc.status === "Emitido" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => imprimirDocumento(doc)}
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          Imprimir
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
