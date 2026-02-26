import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userRolesApi, profilesApi, tiposDocumentoApi, documentosEmitidosApi, matriculasApi } from "@/services/api";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { useSafeMutation } from "@/hooks/useSafeMutation";
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
import { Award, Plus, Printer, Search, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import jsPDF from "jspdf";

interface Aluno {
  id: string;
  nome_completo: string;
  numero_identificacao: string | null;
  email: string;
}

interface Certificado {
  id: string;
  numero_documento: string;
  aluno_id: string;
  data_emissao: string;
  status: string;
  observacoes: string | null;
  dados_adicionais: {
    curso_nome?: string;
    ano_conclusao?: number;
    codigo_verificacao?: string;
    tipo_certificado?: string;
  } | null;
  profiles?: Aluno;
}

export function CertificadosTab() {
  const queryClient = useQueryClient();
  const { config, isSecundario, instituicao } = useInstituicao();
  const { user } = useAuth();
  const { instituicaoId, addFilter } = useTenantFilter();
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAluno, setSelectedAluno] = useState<string>("");
  const [textoDeclaracao, setTextoDeclaracao] = useState("");
  const [nomeAssinante, setNomeAssinante] = useState("Diretor(a)");
  const [cargoAssinante, setCargoAssinante] = useState("Diretor Geral");

  // Get approved students from the institution
  const { data: alunosAprovados } = useQuery({
    queryKey: ["alunos-aprovados-certificado", instituicaoId],
    queryFn: async () => {
      if (!instituicaoId) return [];
      
      const alunoRoles = await userRolesApi.getByRole("ALUNO", instituicaoId);
      if (!alunoRoles || alunoRoles.length === 0) return [];

      const userIds = alunoRoles.map((r: any) => r.user_id);
      const profiles = await profilesApi.getByIds(userIds);
      return profiles as Aluno[];
    },
  });

  // Get certificate document type
  const { data: tipoCertificado } = useQuery({
    queryKey: ["tipo-certificado"],
    queryFn: async () => {
      try {
        const data = await tiposDocumentoApi.getByCodigo("CERT");
        return data;
      } catch {
        // If not exists, create it
        const newTipo = await tiposDocumentoApi.create({
          nome: "Certificado de Conclusão",
          codigo: "CERT",
          descricao: "Certificado de conclusão de curso",
          templateHtml: "<p>Certificado</p>",
          requerAssinatura: true,
          taxa: 0
        });
        return newTipo;
      }
    },
  });

  // Get issued certificates - filter by institution's students
  const { data: certificados, isLoading } = useQuery({
    queryKey: ["certificados-emitidos", searchTerm, instituicaoId, tipoCertificado?.id],
    queryFn: async () => {
      if (!tipoCertificado?.id || !instituicaoId) return [];

      // First get student IDs from this institution
      const alunoRoles = await userRolesApi.getByRole("ALUNO", instituicaoId);
      const alunoIds = alunoRoles?.map((r: any) => r.user_id) || [];

      if (alunoIds.length === 0) return [];

      const data = await documentosEmitidosApi.getAll({ 
        tipoDocumentoId: tipoCertificado.id,
        instituicaoId 
      });
      
      // Filter by student IDs and enrich with profiles
      const filteredData = (data || []).filter((doc: any) => alunoIds.includes(doc.aluno_id));
      
      const enrichedDocs = await Promise.all(
        filteredData.map(async (doc: any) => {
          try {
            const alunoData = await profilesApi.getById(doc.aluno_id);
            return { ...doc, profiles: alunoData };
          } catch {
            return { ...doc, profiles: undefined };
          }
        })
      );
      
      if (searchTerm) {
        return enrichedDocs.filter((doc: any) => 
          doc.numero_documento?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.profiles?.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase())
        ) as Certificado[];
      }
      
      return enrichedDocs as Certificado[];
    },
    enabled: !!tipoCertificado?.id,
  });

  // Get student course info
  const getStudentCourseInfo = async (alunoId: string) => {
    const res = await matriculasApi.getByAlunoId(alunoId);
    const matriculas = res?.data ?? [];
    const matriculaAtiva = matriculas.find((m: any) => m.status === 'Ativa' || m.status === 'ativa');
    
    return matriculaAtiva?.turmas as { 
      nome: string; 
      ano: number; 
      cursos: { nome: string; carga_horaria: number } 
    } | null;
  };

  // Generate unique verification code
  const generateVerificationCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const emitirCertificadoMutation = useSafeMutation({
    mutationFn: async () => {
      if (!tipoCertificado?.id) throw new Error("Tipo de certificado não encontrado");

      const courseInfo = await getStudentCourseInfo(selectedAluno);
      const codigoVerificacao = generateVerificationCode();

      const numeroData = await documentosEmitidosApi.gerarNumero();

      const tipoCert = isSecundario ? "ENSINO_MEDIO" : "UNIVERSIDADE";
      
      await documentosEmitidosApi.create({
        numeroDocumento: numeroData,
        tipoDocumentoId: tipoCertificado.id,
        alunoId: selectedAluno,
        emitidoPor: user?.id,
        observacoes: textoDeclaracao || undefined,
        dadosAdicionais: {
          curso_nome: courseInfo?.cursos?.nome || (isSecundario ? "Ensino Médio" : "Curso"),
          ano_conclusao: courseInfo?.ano || new Date().getFullYear(),
          codigo_verificacao: codigoVerificacao,
          tipo_certificado: tipoCert,
          nome_assinante: nomeAssinante,
          cargo_assinante: cargoAssinante,
        }
      });

      return numeroData;
    },
    onSuccess: (numero) => {
      queryClient.invalidateQueries({ queryKey: ["certificados-emitidos"] });
      toast.success(`Certificado ${numero} emitido com sucesso!`);
      setDialogOpen(false);
      setSelectedAluno("");
      setTextoDeclaracao("");
    },
    onError: (error) => {
      console.error("Erro ao emitir certificado:", error);
      toast.error("Erro ao emitir certificado");
    },
  });

  const gerarPDFCertificado = async (certificado: Certificado) => {
    const aluno = certificado.profiles;
    if (!aluno) {
      toast.error("Dados do aluno não encontrados");
      return;
    }

    const dados = certificado.dados_adicionais || {};
    const isMedio = dados.tipo_certificado === "ENSINO_MEDIO" || isSecundario;
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;

    // Background gradient effect (border)
    pdf.setDrawColor(139, 92, 246);
    pdf.setLineWidth(3);
    pdf.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);
    
    // Inner decorative border
    pdf.setDrawColor(200, 180, 140);
    pdf.setLineWidth(1);
    pdf.rect(margin + 5, margin + 5, pageWidth - margin * 2 - 10, pageHeight - margin * 2 - 10);

    // Decorative corners
    const cornerSize = 15;
    pdf.setDrawColor(139, 92, 246);
    pdf.setLineWidth(2);
    // Top left
    pdf.line(margin + 8, margin + 8, margin + 8 + cornerSize, margin + 8);
    pdf.line(margin + 8, margin + 8, margin + 8, margin + 8 + cornerSize);
    // Top right
    pdf.line(pageWidth - margin - 8 - cornerSize, margin + 8, pageWidth - margin - 8, margin + 8);
    pdf.line(pageWidth - margin - 8, margin + 8, pageWidth - margin - 8, margin + 8 + cornerSize);
    // Bottom left
    pdf.line(margin + 8, pageHeight - margin - 8, margin + 8 + cornerSize, pageHeight - margin - 8);
    pdf.line(margin + 8, pageHeight - margin - 8 - cornerSize, margin + 8, pageHeight - margin - 8);
    // Bottom right
    pdf.line(pageWidth - margin - 8 - cornerSize, pageHeight - margin - 8, pageWidth - margin - 8, pageHeight - margin - 8);
    pdf.line(pageWidth - margin - 8, pageHeight - margin - 8 - cornerSize, pageWidth - margin - 8, pageHeight - margin - 8);

    let yPos = margin + 20;

    // Logo placeholder (circle with text if no logo)
    if (config?.logo_url) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = config.logo_url;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        pdf.addImage(img, 'PNG', pageWidth / 2 - 20, yPos, 40, 40);
        yPos += 45;
      } catch {
        yPos += 5;
      }
    } else {
      yPos += 5;
    }

    // Institution name
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(50, 50, 50);
    pdf.text(config?.nome_instituicao || "INSTITUIÇÃO DE ENSINO", pageWidth / 2, yPos, { align: "center" });
    yPos += 12;

    // Certificate title
    pdf.setFontSize(32);
    pdf.setTextColor(139, 92, 246);
    const titulo = isMedio ? "CERTIFICADO DE CONCLUSÃO" : "CERTIFICADO DE CONCLUSÃO DE CURSO";
    pdf.text(titulo, pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    // Subtitle
    pdf.setFontSize(14);
    pdf.setTextColor(100, 100, 100);
    const subtitulo = isMedio ? "do Ensino Médio" : "Superior";
    pdf.text(subtitulo, pageWidth / 2, yPos, { align: "center" });
    yPos += 18;

    // Declaration text
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.setTextColor(60, 60, 60);
    
    const declaracao = isMedio
      ? `Certificamos que o(a) aluno(a) abaixo identificado(a) concluiu com êxito o Ensino Médio nesta instituição de ensino, cumprindo todas as exigências curriculares estabelecidas pela legislação educacional vigente.`
      : `Certificamos que o(a) aluno(a) abaixo identificado(a) concluiu com aproveitamento o curso superior, tendo cumprido integralmente a carga horária e os requisitos curriculares exigidos para a obtenção do presente certificado.`;

    const splitDeclaracao = pdf.splitTextToSize(declaracao, pageWidth - margin * 2 - 60);
    pdf.text(splitDeclaracao, pageWidth / 2, yPos, { align: "center" });
    yPos += splitDeclaracao.length * 6 + 12;

    // Student name
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.setTextColor(30, 30, 30);
    pdf.text(aluno.nome_completo.toUpperCase(), pageWidth / 2, yPos, { align: "center" });
    yPos += 12;

    // Course/Class info
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(14);
    pdf.setTextColor(80, 80, 80);
    const cursoLabel = isMedio ? "Classe" : "Curso";
    const cursoNome = dados.curso_nome || (isMedio ? "12ª Classe" : "Não informado");
    pdf.text(`${cursoLabel}: ${cursoNome}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    // Year of completion
    pdf.text(`Ano de Conclusão: ${dados.ano_conclusao || new Date().getFullYear()}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 20;

    // Custom text if provided
    if (certificado.observacoes) {
      pdf.setFontSize(11);
      pdf.setTextColor(100, 100, 100);
      const customText = pdf.splitTextToSize(certificado.observacoes, pageWidth - margin * 2 - 80);
      pdf.text(customText, pageWidth / 2, yPos, { align: "center" });
      yPos += customText.length * 5 + 10;
    }

    // Date and location
    const dataExtenso = format(new Date(certificado.data_emissao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    pdf.setFontSize(11);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Luanda, ${dataExtenso}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 20;

    // Signature line
    const sigY = pageHeight - margin - 35;
    pdf.setDrawColor(100, 100, 100);
    pdf.setLineWidth(0.5);
    pdf.line(pageWidth / 2 - 50, sigY, pageWidth / 2 + 50, sigY);
    
    pdf.setFontSize(11);
    pdf.setTextColor(60, 60, 60);
    const dadosAssinante = dados as { nome_assinante?: string; cargo_assinante?: string };
    pdf.text(dadosAssinante.nome_assinante || nomeAssinante, pageWidth / 2, sigY + 6, { align: "center" });
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text(dadosAssinante.cargo_assinante || cargoAssinante, pageWidth / 2, sigY + 11, { align: "center" });

    // Verification code at footer
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Código de Verificação: ${dados.codigo_verificacao || "N/A"}`, pageWidth / 2, pageHeight - margin - 8, { align: "center" });
    pdf.text(`Documento Nº: ${certificado.numero_documento}`, pageWidth / 2, pageHeight - margin - 3, { align: "center" });

    // Seal placeholder (decorative circle)
    pdf.setDrawColor(139, 92, 246);
    pdf.setLineWidth(1);
    pdf.circle(pageWidth - margin - 40, pageHeight - margin - 45, 18);
    pdf.setFontSize(7);
    pdf.setTextColor(139, 92, 246);
    pdf.text("SELO", pageWidth - margin - 40, pageHeight - margin - 45, { align: "center" });
    pdf.text("OFICIAL", pageWidth - margin - 40, pageHeight - margin - 42, { align: "center" });

    pdf.save(`Certificado_${aluno.nome_completo.replace(/\s+/g, '_')}_${certificado.numero_documento}.pdf`);
    toast.success("Certificado gerado com sucesso!");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Emitido":
        return <Badge className="bg-green-100 text-green-800">Emitido</Badge>;
      case "Cancelado":
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const tipoLabel = isSecundario ? "Ensino Médio" : "Universidade";

  if (isLoading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" />
            Certificados de Conclusão
          </h2>
          <p className="text-muted-foreground">
            Emita certificados para alunos aprovados • Modo: {tipoLabel}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Emitir Certificado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Emitir Certificado de Conclusão
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Tipo: <strong>{isSecundario ? "Certificado de Conclusão do Ensino Médio" : "Certificado de Conclusão de Curso Superior"}</strong>
                </p>
              </div>

              <div className="space-y-2">
                <Label>Aluno Aprovado</Label>
                <Select value={selectedAluno} onValueChange={setSelectedAluno}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o aluno" />
                  </SelectTrigger>
                  <SelectContent>
                    {alunosAprovados?.map((aluno) => (
                      <SelectItem key={aluno.id} value={aluno.id}>
                        {aluno.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Assinante</Label>
                  <Input
                    value={nomeAssinante}
                    onChange={(e) => setNomeAssinante(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input
                    value={cargoAssinante}
                    onChange={(e) => setCargoAssinante(e.target.value)}
                    placeholder="Ex: Diretor Geral"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Texto Adicional (opcional)</Label>
                <Textarea
                  value={textoDeclaracao}
                  onChange={(e) => setTextoDeclaracao(e.target.value)}
                  placeholder="Texto personalizado para o certificado..."
                  rows={3}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => emitirCertificadoMutation.mutate()}
                disabled={!selectedAluno || emitirCertificadoMutation.isPending}
              >
                <Award className="h-4 w-4 mr-2" />
                Emitir Certificado
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Emitidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{certificados?.filter(c => c.status === "Emitido").length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alunos Elegíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alunosAprovados?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tipo de Instituição
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{tipoLabel}</div>
          </CardContent>
        </Card>
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

      {/* Certificates Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Certificado</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>{isSecundario ? "Classe" : "Curso"}</TableHead>
                <TableHead>Data Emissão</TableHead>
                <TableHead>Código Verificação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificados?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    Nenhum certificado emitido ainda
                  </TableCell>
                </TableRow>
              ) : (
                certificados?.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell className="font-mono font-medium">
                      {cert.numero_documento}
                    </TableCell>
                    <TableCell>{cert.profiles?.nome_completo}</TableCell>
                    <TableCell>{cert.dados_adicionais?.curso_nome || "-"}</TableCell>
                    <TableCell>
                      {format(new Date(cert.data_emissao), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {cert.dados_adicionais?.codigo_verificacao || "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(cert.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {cert.status === "Emitido" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => gerarPDFCertificado(cert)}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => gerarPDFCertificado(cert)}
                              title="Reemitir"
                            >
                              <RefreshCw className="h-4 w-4" />
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
