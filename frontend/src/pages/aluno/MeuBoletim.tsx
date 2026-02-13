import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { matriculasApi, notasApi } from "@/services/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Printer, GraduationCap, BookOpen, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useAuth } from "@/contexts/AuthContext";
import jsPDF from "jspdf";

interface Nota {
  id: string;
  valor: number;
  tipo: string;
  peso: number;
  data: string;
}

interface Turma {
  id: string;
  nome: string;
  ano: number;
  semestre: string;
  cursos?: { nome: string };
  profiles?: { nome_completo: string };
}

interface Matricula {
  id: string;
  turma_id: string;
  status: string;
  turmas?: Turma;
  notas?: Nota[];
}

export default function MeuBoletim() {
  const { config, isSecundario } = useInstituicao();
  const { user } = useAuth();
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Fetch student's enrollments with grades
  const { data: matriculas, isLoading } = useQuery({
    queryKey: ["meu-boletim", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const matriculasData = await matriculasApi.getAll({ alunoId: user.id });
      const activeMatriculas = (matriculasData || []).filter((m: any) => m.status === 'Ativa' || m.status === 'ativa');

      // Get grades for each enrollment
      const enriched = await Promise.all(
        activeMatriculas.map(async (mat: any) => {
          const notas = await notasApi.getAll({ matriculaId: mat.id });

          return {
            id: mat.id,
            turma_id: mat.turmaId || mat.turma_id,
            status: mat.status,
            turmas: mat.turma ? {
              id: mat.turma.id,
              nome: mat.turma.nome,
              ano: mat.turma.ano,
              semestre: mat.turma.semestre,
              cursos: mat.turma.curso ? { nome: mat.turma.curso.nome } : undefined,
              profiles: mat.turma.professor ? { nome_completo: mat.turma.professor.nomeCompleto || mat.turma.professor.nome_completo } : undefined,
            } : undefined,
            notas: (notas || []).map((n: any) => ({
              id: n.id,
              valor: n.valor,
              tipo: n.tipo,
              peso: n.peso,
              data: n.data,
            })),
          };
        })
      );

      return enriched as Matricula[];
    },
    enabled: !!user?.id,
  });

  // Tipos de avaliação para Ensino Secundário e Superior
  const tiposAvaliacao = isSecundario
    ? ["1º Trimestre", "2º Trimestre", "3º Trimestre"]
    : ["1ª Prova", "2ª Prova", "3ª Prova"];

  const tiposExtras = isSecundario
    ? ["Prova Final", "Recuperação"]
    : ["Trabalho", "Exame de Recurso"];

  const NOTA_MINIMA_APROVACAO = 10;
  const NOTA_RECURSO = 7;

  // Normaliza tipos de notas - suporta formatos como "1T-P1", "2T-P2", "1º Trimestre", etc.
  const normalizeNotaTipo = (tipo: string): string => {
    const raw = (tipo || '').trim();
    const t = raw.toLowerCase();
    
    // Formato abreviado: 1T-P1, 1T-P2, 1T-P3 (Trimestre X - Prova Y)
    if (/^1t-/.test(t)) return isSecundario ? '1º Trimestre' : '1ª Prova';
    if (/^2t-/.test(t)) return isSecundario ? '2º Trimestre' : '2ª Prova';
    if (/^3t-/.test(t)) return isSecundario ? '3º Trimestre' : '3ª Prova';
    
    // Recuperação do trimestre
    if (t.includes('-rec') || t.includes('rec')) return isSecundario ? 'Recuperação' : 'Exame de Recurso';
    
    const hasToken = (n: number) => new RegExp(`(^|\\D)${n}(\\D|$)`).test(t);

    if (isSecundario) {
      if (t.includes('trimestre') && hasToken(1)) return '1º Trimestre';
      if (t.includes('trimestre') && hasToken(2)) return '2º Trimestre';
      if (t.includes('trimestre') && hasToken(3)) return '3º Trimestre';
      if (t.includes('final')) return 'Prova Final';
      if (t.includes('recuper')) return 'Recuperação';
    } else {
      if ((t.includes('teste') || t.includes('prova')) && hasToken(1)) return '1ª Prova';
      if ((t.includes('teste') || t.includes('prova')) && hasToken(2)) return '2ª Prova';
      if ((t.includes('teste') || t.includes('prova')) && hasToken(3)) return '3ª Prova';
      if (t.includes('trabalho')) return 'Trabalho';
      if (t.includes('recurso') || t.includes('exame')) return 'Exame de Recurso';
    }
    return raw;
  };

  // Get normalized nota - calcula média quando há múltiplas notas do mesmo tipo
  const getNotaValor = (notas: Nota[], tipoOriginal: string): number | null => {
    const notasDoTipo: number[] = [];
    
    for (const nota of notas) {
      const tipoNormalizado = normalizeNotaTipo(nota.tipo);
      if (tipoNormalizado === tipoOriginal) {
        notasDoTipo.push(nota.valor);
      }
    }
    
    if (notasDoTipo.length === 0) return null;
    
    // Retorna a média das notas do mesmo tipo
    const soma = notasDoTipo.reduce((acc, val) => acc + val, 0);
    return Math.round((soma / notasDoTipo.length) * 10) / 10;
  };

  const calcularMedia = (notas: Nota[]) => {
    if (!notas || notas.length === 0) return { 
      nota1: null, nota2: null, nota3: null, 
      notaTrabalho: null, notaRecuperacao: null,
      media: 0, mediaFinal: 0, resultado: "Sem notas" 
    };

    let nota1: number | null, nota2: number | null, nota3: number | null;
    let notaTrabalho: number | null, notaRecuperacao: number | null;

    if (isSecundario) {
      nota1 = getNotaValor(notas, '1º Trimestre');
      nota2 = getNotaValor(notas, '2º Trimestre');
      nota3 = getNotaValor(notas, '3º Trimestre');
      notaTrabalho = getNotaValor(notas, 'Prova Final');
      notaRecuperacao = getNotaValor(notas, 'Recuperação');
    } else {
      nota1 = getNotaValor(notas, '1ª Prova');
      nota2 = getNotaValor(notas, '2ª Prova');
      nota3 = getNotaValor(notas, '3ª Prova');
      notaTrabalho = getNotaValor(notas, 'Trabalho');
      notaRecuperacao = getNotaValor(notas, 'Exame de Recurso');
    }

    const notasValidas = [nota1, nota2, nota3].filter((n): n is number => n !== null);
    if (notasValidas.length === 0) return { 
      nota1, nota2, nota3, notaTrabalho, notaRecuperacao,
      media: 0, mediaFinal: 0, resultado: "Sem notas" 
    };

    const media = notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length;
    let mediaFinal = media;

    if (isSecundario) {
      // Ensino Secundário: considera trabalho e recuperação
      if (notaTrabalho !== null) {
        const notasComTrabalho = [nota1, nota2, nota3].map(n => 
          n !== null ? (n + notaTrabalho) / 2 : null
        ).filter((n): n is number => n !== null);
        
        if (notasComTrabalho.length > 0) {
          mediaFinal = notasComTrabalho.reduce((a, b) => a + b, 0) / notasComTrabalho.length;
        }
      }
      
      if (notaRecuperacao !== null && mediaFinal < NOTA_MINIMA_APROVACAO) {
        mediaFinal = Math.max(mediaFinal, (mediaFinal + notaRecuperacao) / 2);
      }
    } else {
      // Universidade: recurso substitui 3ª prova, trabalho faz média com 3ª prova
      let nota3Final = nota3;
      if (notaRecuperacao !== null) {
        nota3Final = notaRecuperacao;
      } else if (notaTrabalho !== null && nota3 !== null) {
        nota3Final = (nota3 + notaTrabalho) / 2;
      }
      
      const notasFinais = [nota1, nota2, nota3Final].filter((n): n is number => n !== null);
      if (notasFinais.length > 0) {
        mediaFinal = notasFinais.reduce((a, b) => a + b, 0) / notasFinais.length;
      }
    }

    let resultado = "Reprovado";
    if (mediaFinal >= NOTA_MINIMA_APROVACAO) {
      resultado = "Aprovado";
    } else if (mediaFinal >= NOTA_RECURSO && notaRecuperacao === null) {
      resultado = isSecundario ? "Recuperação" : "Recurso";
    }

    return { 
      nota1, nota2, nota3, notaTrabalho, notaRecuperacao,
      media: Math.round(media * 10) / 10, 
      mediaFinal: Math.round(mediaFinal * 10) / 10, 
      resultado 
    };
  };

  const getNotaByTipo = (notas: Nota[], tipo: string) => {
    const nota = notas?.find(n => n.tipo === tipo);
    return nota ? nota.valor.toFixed(1) : "-";
  };

  const gerarBoletimPDF = async (matricula: Matricula) => {
    if (!user) return;
    setGeneratingPDF(true);

    try {
      const turma = matricula.turmas;
      if (!turma) {
        toast.error("Dados incompletos");
        return;
      }

      const dados = calcularMedia(matricula.notas || []);
      const { mediaFinal, resultado } = dados;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = margin;

      // Header
      pdf.setFillColor(139, 92, 246);
      pdf.rect(0, 0, pageWidth, 45, 'F');

      if (config?.logo_url) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = config.logo_url;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          pdf.addImage(img, 'PNG', margin, 8, 30, 30);
        } catch {
          // Skip
        }
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.setTextColor(255, 255, 255);
      pdf.text(config?.nome_instituicao || "INSTITUIÇÃO DE ENSINO", pageWidth / 2, 20, { align: "center" });

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(isSecundario ? "BOLETIM ESCOLAR" : "BOLETIM ACADÊMICO", pageWidth / 2, 30, { align: "center" });

      pdf.setFontSize(10);
      pdf.text(`Ano Letivo: ${turma.ano}`, pageWidth / 2, 38, { align: "center" });

      yPos = 55;

      // Student info
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, yPos, pageWidth - margin * 2, 30, 'F');
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(margin, yPos, pageWidth - margin * 2, 30, 'S');

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(50, 50, 50);
      pdf.text("DADOS DO ALUNO", margin + 5, yPos + 8);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(`Nome: ${user.nome_completo}`, margin + 5, yPos + 16);
      pdf.text(`${isSecundario ? "Classe" : "Curso"}: ${turma.cursos?.nome || turma.nome}`, margin + 5, yPos + 24);
      pdf.text(`Turma: ${turma.nome}`, pageWidth / 2, yPos + 16);
      pdf.text(`Professor: ${turma.profiles?.nome_completo || "N/A"}`, pageWidth / 2, yPos + 24);

      yPos += 40;

      // Grades table
      pdf.setFillColor(139, 92, 246);
      pdf.rect(margin, yPos, pageWidth - margin * 2, 10, 'F');
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      
      let xPos = margin + 5;
      pdf.text("Disciplina", xPos, yPos + 7);
      xPos += 60;

      tiposAvaliacao.forEach(tipo => {
        const label = isSecundario 
          ? tipo.replace("º Trimestre", "º Tri")
          : tipo.replace("ª Prova", "ª P.");
        pdf.text(label, xPos, yPos + 7);
        xPos += 30;
      });

      pdf.text("Média", xPos, yPos + 7);

      yPos += 10;

      // Grade row
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(margin, yPos, pageWidth - margin * 2, 12, 'S');

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(50, 50, 50);

      xPos = margin + 5;
      pdf.text(turma.cursos?.nome || turma.nome, xPos, yPos + 8);
      xPos += 60;

      tiposAvaliacao.forEach(tipo => {
        pdf.text(getNotaByTipo(matricula.notas || [], tipo), xPos, yPos + 8);
        xPos += 30;
      });

      const mediaColor = mediaFinal >= 10 ? [34, 197, 94] : mediaFinal >= 7 ? [234, 179, 8] : [239, 68, 68];
      pdf.setTextColor(mediaColor[0], mediaColor[1], mediaColor[2]);
      pdf.setFont("helvetica", "bold");
      pdf.text(mediaFinal.toFixed(1), xPos, yPos + 8);

      yPos += 25;

      // Result box
      const resultColor = resultado === "Aprovado" ? [34, 197, 94] : (resultado === "Recurso" || resultado === "Recuperação") ? [234, 179, 8] : [239, 68, 68];
      pdf.setFillColor(resultColor[0], resultColor[1], resultColor[2]);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 20, 3, 3, 'F');

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`RESULTADO FINAL: ${resultado.toUpperCase()}`, pageWidth / 2, yPos + 13, { align: "center" });

      // Footer
      pdf.setFontSize(7);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`,
        pageWidth / 2,
        pdf.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );

      pdf.save(`MeuBoletim_${turma.ano}.pdf`);
      toast.success("Boletim gerado com sucesso!");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const getResultadoBadge = (resultado: string) => {
    switch (resultado) {
      case "Aprovado":
        return <Badge className="bg-green-100 text-green-800">Aprovado</Badge>;
      case "Recurso":
        return <Badge className="bg-yellow-100 text-yellow-800">Recurso</Badge>;
      case "Recuperação":
        return <Badge className="bg-yellow-100 text-yellow-800">Recuperação</Badge>;
      case "Reprovado":
        return <Badge className="bg-red-100 text-red-800">Reprovado</Badge>;
      default:
        return <Badge variant="secondary">{resultado}</Badge>;
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Meu Boletim
          </h1>
          <p className="text-muted-foreground">
            Visualize suas notas e desempenho acadêmico
          </p>
        </div>

        {matriculas?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhuma matrícula encontrada</h3>
              <p className="text-muted-foreground">Você ainda não está matriculado em nenhuma turma.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {matriculas?.map((mat) => {
              const dados = calcularMedia(mat.notas || []);
              const { mediaFinal, resultado } = dados;
              return (
                <Card key={mat.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <GraduationCap className="h-5 w-5" />
                          {mat.turmas?.cursos?.nome || mat.turmas?.nome}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-4 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Ano Letivo: {mat.turmas?.ano}
                            {!isSecundario && ` - ${mat.turmas?.semestre}`}
                          </span>
                          <span>Turma: {mat.turmas?.nome}</span>
                        </CardDescription>
                      </div>
                      <Button
                        onClick={() => gerarBoletimPDF(mat)}
                        disabled={generatingPDF}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Baixar PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      {tiposAvaliacao.map(tipo => {
                        const notaValor = getNotaValor(mat.notas || [], tipo);
                        return (
                          <div key={tipo} className="text-center p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">
                              {isSecundario ? tipo.replace("º Trimestre", "º Tri") : tipo.replace("ª Prova", "ª P.")}
                            </p>
                            <p className="text-2xl font-bold">
                              {notaValor !== null ? notaValor.toFixed(1) : "-"}
                            </p>
                          </div>
                        );
                      })}
                      <div className="text-center p-3 bg-primary/10 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Média Final</p>
                        <p className="text-2xl font-bold text-primary">{mediaFinal.toFixed(1)}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground">Professor</p>
                        <p className="font-medium">{mat.turmas?.profiles?.nome_completo || "N/A"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">Resultado</p>
                        {getResultadoBadge(resultado)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
