import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cursosApi, turmasApi, matriculasApi, notasApi, profilesApi, anoLetivoApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { FileText, Search, Printer, Download, User, GraduationCap, School, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { safeToFixed } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import jsPDF from "jspdf";

interface Aluno {
  id: string;
  nome_completo: string;
  numero_identificacao: string | null;
  numero_identificacao_publica: string | null;
  email: string;
}

interface Turma {
  id: string;
  nome: string;
  ano: number;
  semestre: string;
  curso_id: string;
  professor_id: string;
  cursos?: { nome: string };
  profiles?: { nome_completo: string };
}

interface Nota {
  id: string;
  valor: number;
  tipo: string;
  peso: number;
  data: string;
}

interface Matricula {
  id: string;
  aluno_id: string;
  turma_id: string;
  status: string;
  turmas?: Turma;
  profiles?: Aluno;
  notas?: Nota[];
}

const NOTA_MINIMA_APROVACAO = 10;
const NOTA_RECURSO = 7;

// Normaliza tipos de notas - suporta formatos como "1T-P1", "2T-P2", "1º Trimestre", etc.
const normalizeNotaTipo = (tipo: string, isSecundario: boolean): string => {
  const raw = (tipo || '').trim();
  const t = raw.toLowerCase();
  
  // Formato abreviado: 1T-P1, 1T-P2, 1T-P3 (Trimestre X - Prova Y)
  // Agrupa notas do mesmo trimestre
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

export function BoletimTab() {
  const { config, isSecundario } = useInstituicao();
  const { instituicaoId } = useTenantFilter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCurso, setSelectedCurso] = useState<string>("all");
  const [selectedTurma, setSelectedTurma] = useState<string>("all");
  const [selectedAno, setSelectedAno] = useState<string>("");
  const [nomeAssinante, setNomeAssinante] = useState("Diretor(a)");
  const [cargoAssinante, setCargoAssinante] = useState("Diretor Geral");

  // Buscar anos letivos disponíveis
  const { data: anosLetivos = [], isLoading: isLoadingAnosLetivos } = useQuery({
    queryKey: ["anos-letivos-boletim", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  // Definir ano selecionado inicial como o mais recente
  useEffect(() => {
    if (anosLetivos.length > 0 && !selectedAno) {
      const anoMaisRecente = anosLetivos.sort((a: any, b: any) => b.ano - a.ano)[0];
      setSelectedAno(anoMaisRecente.ano.toString());
    }
  }, [anosLetivos, selectedAno]);

  // Labels adaptados
  const labels = {
    curso: isSecundario ? 'Classe' : 'Curso',
    turma: isSecundario ? 'Turma' : 'Turma',
    nota1: isSecundario ? '1º Trimestre' : '1ª Prova',
    nota2: isSecundario ? '2º Trimestre' : '2ª Prova',
    nota3: isSecundario ? '3º Trimestre' : '3ª Prova',
    nota1Short: isSecundario ? '1º Trim' : '1ª P.',
    nota2Short: isSecundario ? '2º Trim' : '2ª P.',
    nota3Short: isSecundario ? '3º Trim' : '3ª P.',
    recurso: isSecundario ? 'Recuperação' : 'Recurso',
    trabalho: isSecundario ? 'Trabalho' : 'Trabalho',
  };

  // Fetch courses/classes
  const { data: cursos } = useQuery({
    queryKey: ["cursos-boletim", instituicaoId],
    queryFn: async () => {
      const data = await cursosApi.getAll({ instituicaoId });
      return data;
    },
  });

  // Fetch turmas
  const { data: turmas } = useQuery({
    queryKey: ["turmas-boletim", selectedCurso, selectedAno, instituicaoId],
    queryFn: async () => {
      const data = await turmasApi.getAll({ 
        instituicaoId, 
        ano: selectedAno ? parseInt(selectedAno) : undefined,
        cursoId: selectedCurso !== "all" ? selectedCurso : undefined
      });
      return data as Turma[];
    },
    enabled: !!selectedAno, // Só buscar quando tiver ano selecionado
  });

  // Fetch enrollments with grades
  const { data: matriculas, isLoading } = useQuery({
    queryKey: ["matriculas-boletim", selectedTurma, selectedCurso, selectedAno, searchTerm, instituicaoId],
    queryFn: async () => {
      const matriculasData = await matriculasApi.getAll({
        turmaId: selectedTurma !== "all" ? selectedTurma : undefined
      });

      // Filter by year and course
      let filtered = (matriculasData || []).filter((m: any) => 
        !selectedAno || selectedAno === "" || (m.turmas && m.turmas.ano === parseInt(selectedAno))
      );

      if (selectedCurso && selectedCurso !== "all") {
        filtered = filtered.filter((m: any) => m.turmas?.curso_id === selectedCurso);
      }

      // Get student profiles and grades for each enrollment
      const enriched = await Promise.all(
        filtered.map(async (mat: any) => {
          try {
            const profile = await profilesApi.getById(mat.aluno_id);
            const notas = await notasApi.getAll({ matriculaId: mat.id });

            return {
              ...mat,
              profiles: profile as Aluno,
              notas: notas as Nota[] || [],
            };
          } catch {
            return { ...mat, profiles: null, notas: [] };
          }
        })
      );

      // Filter by search term
      if (searchTerm) {
        const searchLower = String(searchTerm ?? '').toLowerCase();
        return enriched.filter((m: any) =>
          String(m.profiles?.nome_completo ?? '').toLowerCase().includes(searchLower) ||
          String(m.profiles?.numero_identificacao ?? '').toLowerCase().includes(searchLower) ||
          String(m.profiles?.numero_identificacao_publica ?? '').toLowerCase().includes(searchLower)
        );
      }

      return enriched as Matricula[];
    },
  });

  // Get normalized nota - calcula média quando há múltiplas notas do mesmo tipo
  const getNotaValor = (notas: Nota[], tipoOriginal: string): number | null => {
    const notasDoTipo: number[] = [];
    
    for (const nota of notas) {
      const tipoNormalizado = normalizeNotaTipo(nota.tipo, isSecundario);
      if (tipoNormalizado === tipoOriginal) {
        notasDoTipo.push(nota.valor);
      }
    }
    
    if (notasDoTipo.length === 0) return null;
    
    // Retorna a média das notas do mesmo tipo
    const soma = notasDoTipo.reduce((acc, val) => acc + val, 0);
    return Math.round((soma / notasDoTipo.length) * 10) / 10;
  };

  // Calculate average and result for Ensino Médio
  const calcularMediaEnsinoMedio = (notas: Nota[]) => {
    const nota1 = getNotaValor(notas, '1º Trimestre');
    const nota2 = getNotaValor(notas, '2º Trimestre');
    const nota3 = getNotaValor(notas, '3º Trimestre');
    const notaTrabalho = getNotaValor(notas, 'Prova Final');
    const notaRecuperacao = getNotaValor(notas, 'Recuperação');

    const notasValidas = [nota1, nota2, nota3].filter((n): n is number => n !== null);
    if (notasValidas.length === 0) return { nota1, nota2, nota3, notaTrabalho, notaRecuperacao, media: null, mediaFinal: null, resultado: "Sem notas" };

    const media = notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length;
    let mediaFinal = media;

    // Se tem trabalho, considera
    if (notaTrabalho !== null) {
      const notasComTrabalho = [nota1, nota2, nota3].map(n => 
        n !== null ? (n + notaTrabalho) / 2 : null
      ).filter((n): n is number => n !== null);
      
      if (notasComTrabalho.length > 0) {
        mediaFinal = notasComTrabalho.reduce((a, b) => a + b, 0) / notasComTrabalho.length;
      }
    }

    // Se tem recuperação
    if (notaRecuperacao !== null && mediaFinal < NOTA_MINIMA_APROVACAO) {
      mediaFinal = Math.max(mediaFinal, (mediaFinal + notaRecuperacao) / 2);
    }

    let resultado = "Reprovado";
    if (mediaFinal >= NOTA_MINIMA_APROVACAO) {
      resultado = "Aprovado";
    } else if (mediaFinal >= NOTA_RECURSO && notaRecuperacao === null) {
      resultado = "Recuperação";
    }

    return {
      nota1,
      nota2,
      nota3,
      notaTrabalho,
      notaRecuperacao,
      media: Math.round(media * 10) / 10,
      mediaFinal: Math.round(mediaFinal * 10) / 10,
      resultado
    };
  };

  // Calculate average and result for University
  const calcularMediaUniversidade = (notas: Nota[]) => {
    const nota1 = getNotaValor(notas, '1ª Prova');
    const nota2 = getNotaValor(notas, '2ª Prova');
    const nota3 = getNotaValor(notas, '3ª Prova');
    const notaTrabalho = getNotaValor(notas, 'Trabalho');
    const notaRecurso = getNotaValor(notas, 'Exame de Recurso');

    const notasValidas = [nota1, nota2, nota3].filter((n): n is number => n !== null);
    if (notasValidas.length === 0) return { nota1, nota2, nota3, notaTrabalho, notaRecurso, media: null, mediaFinal: null, resultado: "Sem notas" };

    const media = notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length;
    
    let nota3Final = nota3;
    if (notaRecurso !== null) {
      nota3Final = notaRecurso;
    } else if (notaTrabalho !== null && nota3 !== null) {
      nota3Final = (nota3 + notaTrabalho) / 2;
    }

    const notasFinais = [nota1, nota2, nota3Final].filter((n): n is number => n !== null);
    const mediaFinal = notasFinais.length > 0 ? notasFinais.reduce((a, b) => a + b, 0) / notasFinais.length : null;

    let resultado = "Reprovado";
    if (mediaFinal !== null) {
      if (mediaFinal >= NOTA_MINIMA_APROVACAO) {
        resultado = "Aprovado";
      } else if (mediaFinal >= NOTA_RECURSO && notaRecurso === null) {
        resultado = "Recurso";
      }
    }

    return {
      nota1,
      nota2,
      nota3,
      notaTrabalho,
      notaRecurso,
      media: Math.round(media * 10) / 10,
      mediaFinal: mediaFinal !== null ? Math.round(mediaFinal * 10) / 10 : null,
      resultado
    };
  };

  const calcularMedia = (notas: Nota[]) => {
    return isSecundario ? calcularMediaEnsinoMedio(notas) : calcularMediaUniversidade(notas);
  };

  const formatNota = (nota: number | null): string => {
    if (nota === null) return "-";
    return safeToFixed(nota, 1);
  };

  // Generate professional PDF boletim
  const gerarBoletimPDF = async (matricula: Matricula) => {
    const aluno = matricula.profiles;
    const turma = matricula.turmas;
    
    if (!aluno || !turma) {
      toast.error("Dados incompletos para gerar boletim");
      return;
    }

    const dados = calcularMedia(matricula.notas || []);
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = margin;

    // Header background
    pdf.setFillColor(0, 102, 153);
    pdf.rect(0, 0, pageWidth, 50, 'F');

    // Logo
    if (config?.logo_url) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = config.logo_url;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          setTimeout(reject, 3000);
        });
        pdf.addImage(img, 'PNG', margin, 10, 30, 30);
      } catch {
        // Skip logo
      }
    }

    // Institution name
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(255, 255, 255);
    pdf.text(config?.nome_instituicao || "INSTITUIÇÃO DE ENSINO", pageWidth / 2, 22, { align: "center" });

    // Subtitle
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    const tipoBoletim = isSecundario ? "BOLETIM ESCOLAR - ENSINO SECUNDÁRIO" : "BOLETIM ACADÊMICO";
    pdf.text(tipoBoletim, pageWidth / 2, 32, { align: "center" });

    // Year
    pdf.setFontSize(10);
    pdf.text(`Ano Letivo: ${turma.ano}`, pageWidth / 2, 42, { align: "center" });

    yPos = 60;

    // Student info section
    pdf.setFillColor(245, 247, 250);
    pdf.setDrawColor(200, 210, 220);
    pdf.rect(margin, yPos, pageWidth - margin * 2, 40, 'FD');

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(0, 51, 102);
    pdf.text("DADOS DO ALUNO", margin + 5, yPos + 8);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(50, 50, 50);
    
    const col1 = margin + 5;
    const col2 = pageWidth / 2 + 5;
    
    pdf.text(`Nome: ${aluno.nome_completo}`, col1, yPos + 18);
    pdf.text(`Nº: ${aluno.numero_identificacao_publica || "N/A"}`, col1, yPos + 26);
    
    pdf.text(`${labels.curso}: ${turma.cursos?.nome || turma.nome}`, col2, yPos + 18);
    pdf.text(`Turma: ${turma.nome}`, col2, yPos + 26);
    pdf.text(`Professor: ${turma.profiles?.nome_completo || "N/A"}`, col2, yPos + 34);

    yPos += 50;

    // Grades table header
    pdf.setFillColor(0, 102, 153);
    pdf.rect(margin, yPos, pageWidth - margin * 2, 12, 'F');
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    
    const colWidths = [50, 28, 28, 28, 28, 28];
    let xPos = margin + 5;
    
    pdf.text("Disciplina", xPos, yPos + 8);
    xPos += colWidths[0];
    pdf.text(labels.nota1Short, xPos, yPos + 8);
    xPos += colWidths[1];
    pdf.text(labels.nota2Short, xPos, yPos + 8);
    xPos += colWidths[2];
    pdf.text(labels.nota3Short, xPos, yPos + 8);
    xPos += colWidths[3];
    pdf.text(labels.recurso, xPos, yPos + 8);
    xPos += colWidths[4];
    pdf.text("Média", xPos, yPos + 8);

    yPos += 12;

    // Grade row
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(200, 210, 220);
    pdf.rect(margin, yPos, pageWidth - margin * 2, 12, 'FD');

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(50, 50, 50);
    
    xPos = margin + 5;
    pdf.text(turma.cursos?.nome || turma.nome, xPos, yPos + 8);
    xPos += colWidths[0];
    pdf.text(formatNota(dados.nota1), xPos + 5, yPos + 8);
    xPos += colWidths[1];
    pdf.text(formatNota(dados.nota2), xPos + 5, yPos + 8);
    xPos += colWidths[2];
    pdf.text(formatNota(dados.nota3), xPos + 5, yPos + 8);
    xPos += colWidths[3];
    
    const notaRecuperacao = isSecundario ? (dados as any).notaRecuperacao : (dados as any).notaRecurso;
    pdf.text(formatNota(notaRecuperacao), xPos + 5, yPos + 8);
    xPos += colWidths[4];
    
    // Média com cor
    const mediaVal = dados.mediaFinal || 0;
    if (mediaVal >= NOTA_MINIMA_APROVACAO) {
      pdf.setTextColor(22, 163, 74);
    } else if (mediaVal >= NOTA_RECURSO) {
      pdf.setTextColor(217, 119, 6);
    } else {
      pdf.setTextColor(220, 38, 38);
    }
    pdf.setFont("helvetica", "bold");
    pdf.text(formatNota(dados.mediaFinal), xPos + 5, yPos + 8);

    yPos += 20;

    // Trabalho row (if applicable)
    if ((dados as any).notaTrabalho !== null) {
      pdf.setFillColor(250, 250, 250);
      pdf.setDrawColor(200, 210, 220);
      pdf.rect(margin, yPos, pageWidth - margin * 2, 12, 'FD');

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(50, 50, 50);
      pdf.text(`${labels.trabalho}: ${formatNota((dados as any).notaTrabalho)} valores`, margin + 5, yPos + 8);
      
      yPos += 15;
    }

    // Final result box
    yPos += 5;
    const resultColor = dados.resultado === "Aprovado" 
      ? [22, 163, 74] 
      : dados.resultado === "Recurso" || dados.resultado === "Recuperação"
        ? [217, 119, 6] 
        : [220, 38, 38];
    
    pdf.setFillColor(resultColor[0], resultColor[1], resultColor[2]);
    pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 25, 3, 3, 'F');

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`RESULTADO FINAL: ${dados.resultado.toUpperCase()}`, pageWidth / 2, yPos + 10, { align: "center" });
    
    pdf.setFontSize(11);
    pdf.text(`Média ${isSecundario ? "Anual" : "Final"}: ${formatNota(dados.mediaFinal)} valores`, pageWidth / 2, yPos + 19, { align: "center" });

    yPos += 35;

    // Summary box
    pdf.setFillColor(245, 247, 250);
    pdf.setDrawColor(200, 210, 220);
    pdf.rect(margin, yPos, pageWidth - margin * 2, 30, 'FD');

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(0, 51, 102);
    pdf.text("INFORMAÇÕES ADICIONAIS", margin + 5, yPos + 8);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Data de Emissão: ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, margin + 5, yPos + 16);
    pdf.text(`Nota mínima para aprovação: ${safeToFixed(NOTA_MINIMA_APROVACAO, 1)} valores`, margin + 5, yPos + 23);
    if (!isSecundario) {
      pdf.text(`Período: ${turma.semestre}`, pageWidth / 2, yPos + 16);
    }

    // Signature section
    yPos = pageHeight - 55;
    
    pdf.setDrawColor(100, 100, 100);
    pdf.setLineWidth(0.5);
    
    // Two signatures
    pdf.line(margin + 20, yPos, margin + 80, yPos);
    pdf.line(pageWidth - margin - 80, yPos, pageWidth - margin - 20, yPos);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    pdf.text(nomeAssinante, margin + 50, yPos + 6, { align: "center" });
    pdf.text(cargoAssinante, margin + 50, yPos + 11, { align: "center" });
    
    pdf.text("Professor(a) Responsável", pageWidth - margin - 50, yPos + 6, { align: "center" });
    pdf.text(turma.profiles?.nome_completo || "N/A", pageWidth - margin - 50, yPos + 11, { align: "center" });

    // Footer
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} | ${config?.nome_instituicao || "Sistema Acadêmico"}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );

    pdf.save(`Boletim_${aluno.nome_completo.replace(/\s+/g, '_')}_${turma.ano}.pdf`);
    toast.success("Boletim gerado com sucesso!");
  };

  const getResultadoBadge = (resultado: string) => {
    switch (resultado) {
      case "Aprovado":
        return <Badge className="bg-green-600 text-white"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case "Recurso":
      case "Recuperação":
        return <Badge className="bg-amber-500 text-white"><Clock className="h-3 w-3 mr-1" />{resultado}</Badge>;
      case "Reprovado":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Reprovado</Badge>;
      default:
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />{resultado}</Badge>;
    }
  };

  // Usar anos letivos da API ao invés de array hardcoded
  const anos = anosLetivos.map((al: any) => al.ano).sort((a: number, b: number) => b - a);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {isSecundario ? <School className="h-6 w-6" /> : <GraduationCap className="h-6 w-6" />}
            Boletim Individual
          </h2>
          <p className="text-muted-foreground">
            {isSecundario ? 'Ensino Secundário - Sistema de Trimestres' : 'Ensino Superior - Sistema de Semestres'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
          <CardDescription>Selecione os filtros para encontrar o aluno</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Ano Letivo</Label>
              <Select value={selectedAno} onValueChange={setSelectedAno} disabled={isLoadingAnosLetivos || anosLetivos.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingAnosLetivos ? "Carregando..." : anosLetivos.length === 0 ? "Nenhum ano letivo cadastrado" : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingAnosLetivos ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : anosLetivos.length === 0 ? (
                    <SelectItem value="empty" disabled>Nenhum ano letivo cadastrado</SelectItem>
                  ) : (
                    anosLetivos.map((al: any) => (
                      <SelectItem key={al.id} value={al.ano.toString()}>
                        {al.ano} - {al.status === 'ATIVO' ? '🟢 Ativo' : al.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{labels.curso}</Label>
              <Select value={selectedCurso} onValueChange={setSelectedCurso}>
                <SelectTrigger>
                  <SelectValue placeholder={`Todos`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {cursos?.map(curso => (
                    <SelectItem key={curso.id} value={curso.id}>{curso.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Turma</Label>
              <Select value={selectedTurma} onValueChange={setSelectedTurma}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {turmas?.map(turma => (
                    <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assinante</Label>
              <Input
                value={nomeAssinante}
                onChange={(e) => setNomeAssinante(e.target.value)}
                placeholder="Nome do diretor"
              />
            </div>

            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input
                value={cargoAssinante}
                onChange={(e) => setCargoAssinante(e.target.value)}
                placeholder="Cargo"
              />
            </div>
          </div>

          <Separator className="my-4" />

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno por nome ou número de identificação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Total de Estudantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{matriculas?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Aprovados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {matriculas?.filter(m => calcularMedia(m.notas || []).resultado === "Aprovado").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              {isSecundario ? 'Recuperação' : 'Recurso'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {matriculas?.filter(m => {
                const r = calcularMedia(m.notas || []).resultado;
                return r === "Recurso" || r === "Recuperação";
              }).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Reprovados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {matriculas?.filter(m => calcularMedia(m.notas || []).resultado === "Reprovado").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>{labels.curso}</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead className="text-center">{labels.nota1Short}</TableHead>
                <TableHead className="text-center">{labels.nota2Short}</TableHead>
                <TableHead className="text-center">{labels.nota3Short}</TableHead>
                <TableHead className="text-center">{labels.recurso}</TableHead>
                <TableHead className="text-center">Média</TableHead>
                <TableHead className="text-center">Resultado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : matriculas?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    Nenhum aluno encontrado com os filtros selecionados
                  </TableCell>
                </TableRow>
              ) : (
                matriculas?.map((mat) => {
                  const dados = calcularMedia(mat.notas || []);
                  const notaRecuperacao = isSecundario ? (dados as any).notaRecuperacao : (dados as any).notaRecurso;
                  
                  return (
                    <TableRow key={mat.id}>
                      <TableCell className="font-medium text-primary">
                        {mat.profiles?.numero_identificacao_publica || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{mat.profiles?.nome_completo}</p>
                          <p className="text-xs text-muted-foreground">{mat.profiles?.numero_identificacao_publica || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>{mat.turmas?.cursos?.nome || "-"}</TableCell>
                      <TableCell>{mat.turmas?.nome}</TableCell>
                      <TableCell className="text-center">{formatNota(dados.nota1)}</TableCell>
                      <TableCell className="text-center">{formatNota(dados.nota2)}</TableCell>
                      <TableCell className="text-center">{formatNota(dados.nota3)}</TableCell>
                      <TableCell className="text-center">{formatNota(notaRecuperacao)}</TableCell>
                      <TableCell className="text-center font-bold">{formatNota(dados.mediaFinal)}</TableCell>
                      <TableCell className="text-center">{getResultadoBadge(dados.resultado)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => gerarBoletimPDF(mat)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => gerarBoletimPDF(mat)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
