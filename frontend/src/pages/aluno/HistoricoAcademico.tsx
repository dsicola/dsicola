import React, { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Download, GraduationCap, BookOpen, Award, TrendingUp, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { authApi, profilesApi, relatoriosApi } from '@/services/api';
import { safeToFixed } from '@/lib/utils';

const PROVAS_PRINCIPAIS = ['1ª Prova', '2ª Prova', '3ª Prova'] as const;
const NOTA_MINIMA_APROVACAO = 10;

interface NotaAgrupada {
  tipo: string;
  valor: number;
  peso: number;
  data: string;
}

interface DisciplinaHistorico {
  turma_id: string;
  turma_nome: string;
  curso_nome: string;
  semestre: string;
  ano: number;
  professor: string;
  notas: NotaAgrupada[];
  media: number | null;
  frequencia: number | null;
  status: string;
}

export default function HistoricoAcademico() {
  const { user } = useAuth();
  const { config: instituicao, isSecundario } = useInstituicao();
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch student profile (usar authApi.getProfile para ALUNO - mais fiável)
  const { data: profile } = useQuery({
    queryKey: ['student-profile-historico', user?.id],
    queryFn: async () => {
      try {
        return await authApi.getProfile();
      } catch {
        if (user?.id) return await profilesApi.getById(user.id);
        throw new Error('Utilizador não autenticado');
      }
    },
    enabled: !!user?.id
  });

  // REGRA CRÍTICA: Histórico acadêmico usa SNAPSHOT (não calcula dinamicamente)
  // Histórico só existe para anos letivos ENCERRADOS
  const { data: historicoSnapshot, isLoading: historicoLoading, error: historicoError, isError: historicoIsError } = useQuery({
    queryKey: ['historico-academico-snapshot', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return await relatoriosApi.getHistoricoEscolar(user.id);
    },
    enabled: !!user?.id,
    retry: 1,
  });

  // Processar dados do histórico a partir do snapshot
  // O snapshot retorna histórico agrupado por ano letivo
  const historicoData: DisciplinaHistorico[] = historicoSnapshot?.historico?.flatMap((anoLetivoData: any) => {
    return anoLetivoData.disciplinas?.map((disciplinaData: any) => {
      const disciplina = disciplinaData.disciplina;
      const anoLetivo = anoLetivoData.anoLetivo;
      const curso = disciplinaData.curso;
      const turma = disciplinaData.turma;

      return {
        turma_id: turma?.id || disciplina?.id || 'N/A',
        turma_nome: turma?.nome || disciplina?.nome || 'N/A',
        curso_nome: curso?.nome || 'N/A',
        semestre: '', // Vem do plano de ensino se necessário
        ano: anoLetivo?.ano || 0,
        professor: 'N/A', // Não está no snapshot atual
        notas: [], // Notas não estão no snapshot (apenas médias finais consolidadas)
        media: disciplinaData.notas?.mediaFinal ? Number(disciplinaData.notas.mediaFinal) : null,
        frequencia: disciplinaData.frequencia?.percentualFrequencia ? Number(disciplinaData.frequencia.percentualFrequencia) : null,
        status: disciplinaData.situacaoAcademica === 'APROVADO' ? 'Aprovado' 
          : disciplinaData.situacaoAcademica === 'REPROVADO_FALTA' ? 'Reprovado por Falta'
          : disciplinaData.situacaoAcademica === 'REPROVADO' ? 'Reprovado'
          : 'Em Curso'
      };
    }) || [];
  }) || [];

  // Estatísticas gerais
  const estatisticas = {
    total: historicoData.length,
    aprovados: historicoData.filter(d => d.status === 'Aprovado').length,
    emCurso: historicoData.filter(d => d.status === 'Em Curso' || d.status === 'Em Avaliação').length,
    reprovados: historicoData.filter(d => d.status === 'Reprovado').length,
    mediaGeral: historicoData.filter(d => d.media !== null).length > 0
      ? historicoData.filter(d => d.media !== null).reduce((sum, d) => sum + d.media!, 0) / historicoData.filter(d => d.media !== null).length
      : 0
  };

  const handleExportPDF = async () => {
    if (!profile) {
      toast.error('Dados do aluno não carregados');
      return;
    }

    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // Logo
    if (instituicao?.logo_url) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = instituicao.logo_url;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          setTimeout(reject, 3000);
        });
        doc.addImage(img, 'PNG', pageWidth / 2 - 12, yPos, 24, 24);
        yPos += 28;
      } catch {
        // Continue without logo
      }
    }

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(instituicao?.nome_instituicao || 'Instituição de Ensino', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    if (instituicao?.endereco) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(instituicao.endereco, pageWidth / 2, yPos, { align: 'center' });
      yPos += 4;
    }

    yPos += 2;
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('HISTÓRICO ACADÊMICO', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Student info box
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos - 2, pageWidth - margin * 2, 18, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Aluno:', margin + 5, yPos + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(profile.nomeCompleto || profile.nome_completo || 'N/A', margin + 20, yPos + 4);

    doc.setFont('helvetica', 'bold');
    doc.text('Email:', pageWidth / 2, yPos + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(profile.email || 'N/A', pageWidth / 2 + 18, yPos + 4);

    doc.setFont('helvetica', 'bold');
    doc.text('Nº ID:', margin + 5, yPos + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(profile.numeroIdentificacaoPublica || profile.numero_identificacao_publica || 'N/A', margin + 20, yPos + 12);

    yPos += 24;

    // Disciplines table
    const colWidths = {
      disciplina: 55,
      periodo: 25,
      media: 18,
      freq: 18,
      status: 25
    };

    doc.setFillColor(41, 128, 185);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.rect(margin, yPos, pageWidth - margin * 2, 7, 'F');

    let xPos = margin + 2;
    doc.text('Disciplina/Turma', xPos, yPos + 5);
    xPos += colWidths.disciplina;
    doc.text('Período', xPos, yPos + 5);
    xPos += colWidths.periodo;
    doc.text('Média', xPos, yPos + 5);
    xPos += colWidths.media;
    doc.text('Freq.', xPos, yPos + 5);
    xPos += colWidths.freq;
    doc.text('Situação', xPos, yPos + 5);

    yPos += 9;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    // Rows
    historicoData.forEach((d, index) => {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = margin;
      }

      if (index % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPos - 1, pageWidth - margin * 2, 7, 'F');
      }

      xPos = margin + 2;
      const turmaText = d.turma_nome.length > 30 ? d.turma_nome.substring(0, 30) + '...' : d.turma_nome;
      doc.text(turmaText, xPos, yPos + 4);
      xPos += colWidths.disciplina;
      doc.text(isSecundario ? `${d.ano}` : `${d.semestre}º/${d.ano}`, xPos, yPos + 4);
      xPos += colWidths.periodo;
      doc.text(d.media !== null ? safeToFixed(d.media, 1) : '-', xPos, yPos + 4);
      xPos += colWidths.media;
      doc.text(d.frequencia !== null ? `${d.frequencia}%` : '-', xPos, yPos + 4);
      xPos += colWidths.freq;

      if (d.status === 'Aprovado') {
        doc.setTextColor(34, 139, 34);
      } else if (d.status === 'Reprovado') {
        doc.setTextColor(220, 20, 60);
      } else if (d.status === 'Recurso') {
        doc.setTextColor(255, 165, 0);
      } else {
        doc.setTextColor(100, 100, 100);
      }
      doc.text(d.status, xPos, yPos + 4);
      doc.setTextColor(0, 0, 0);

      yPos += 7;
    });

    // Summary
    yPos += 8;
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('RESUMO:', margin, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Total de Disciplinas: ${estatisticas.total}`, margin, yPos);
    doc.text(`Aprovadas: ${estatisticas.aprovados}`, margin + 50, yPos);
    doc.text(`Em Curso: ${estatisticas.emCurso}`, margin + 90, yPos);
    doc.text(`Média Geral: ${safeToFixed(estatisticas.mediaGeral, 1)}`, margin + 130, yPos);

    // Date
    yPos += 10;
    doc.setFontSize(8);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin, yPos, { align: 'right' });

    // Signature lines
    yPos = pageHeight - 25;
    doc.line(margin, yPos, margin + 60, yPos);
    doc.line(pageWidth - margin - 60, yPos, pageWidth - margin, yPos);

    yPos += 4;
    doc.text('Secretaria Acadêmica', margin + 30, yPos, { align: 'center' });
    doc.text('Diretor', pageWidth - margin - 30, yPos, { align: 'center' });

    // Save
    const fileName = `Historico_${(profile.nomeCompleto || profile.nome_completo || 'aluno')?.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
    toast.success('Histórico exportado com sucesso!');
  };

  const isLoading = historicoLoading;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aprovado':
        return <Badge className="bg-green-600 text-white">Aprovado</Badge>;
      case 'Recurso':
        return <Badge className="bg-amber-500 text-white">Recurso</Badge>;
      case 'Reprovado':
        return <Badge variant="destructive">Reprovado</Badge>;
      case 'Em Avaliação':
        return <Badge variant="secondary">Em Avaliação</Badge>;
      default:
        return <Badge variant="outline">Em Curso</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Histórico Acadêmico</h1>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                📄 Documento Oficial
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Histórico consolidado de anos letivos encerrados (dados imutáveis)
            </p>
          </div>
          <Button onClick={handleExportPDF} disabled={isLoading || historicoData.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : historicoIsError ? (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="py-12">
              <div className="text-center space-y-2">
                <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                <p className="font-medium text-destructive">Erro ao carregar histórico acadêmico</p>
                <p className="text-sm text-muted-foreground">
                  {((historicoError as any)?.response?.data?.message) ||
                    (historicoError instanceof Error ? historicoError.message : null) ||
                    'Não foi possível carregar os dados. Tente novamente ou contacte o suporte.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Student Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Dados do Aluno
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nome Completo</p>
                  <p className="font-medium">{profile?.nomeCompleto || profile?.nome_completo}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{profile?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nº ID</p>
                  <p className="font-medium">{profile?.numeroIdentificacaoPublica || profile?.numero_identificacao_publica || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium">{profile?.statusAluno || profile?.status_aluno || 'Ativo'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <BookOpen className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Disciplinas</p>
                    <p className="text-2xl font-bold">{estatisticas.total}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <Award className="h-5 w-5 mx-auto mb-1 text-green-600" />
                    <p className="text-xs text-muted-foreground">Aprovadas</p>
                    <p className="text-2xl font-bold text-green-600">{estatisticas.aprovados}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Em Curso</p>
                    <p className="text-2xl font-bold text-blue-600">{estatisticas.emCurso}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Reprovadas</p>
                    <p className="text-2xl font-bold text-red-600">{estatisticas.reprovados}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xs text-muted-foreground">Média Geral</p>
                    <p className="text-2xl font-bold text-primary">{safeToFixed(estatisticas.mediaGeral, 1)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Academic History */}
            <div ref={printRef}>
              {historicoData.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center space-y-4">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground font-medium">Nenhum histórico acadêmico encontrado.</p>
                    {historicoSnapshot?.aviso && (
                      <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                        {historicoSnapshot.aviso}
                      </p>
                    )}
                    {!historicoSnapshot?.aviso && (
                      <p className="text-sm text-muted-foreground">
                        O histórico acadêmico é gerado automaticamente quando um ano letivo é encerrado.
                        Contacte a secretaria académica para mais informações.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {historicoData.map((d) => {
                    const notasProvas = d.notas.filter(n => PROVAS_PRINCIPAIS.includes(n.tipo as any));
                    const notasExtras = d.notas.filter(n => !PROVAS_PRINCIPAIS.includes(n.tipo as any));

                    return (
                      <Card key={d.turma_id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                <BookOpen className="h-5 w-5" />
                                {d.turma_nome}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">
                                {d.curso_nome} • {isSecundario ? d.ano : `${d.semestre}º Semestre/${d.ano}`}
                              </p>
                            </div>
                            {getStatusBadge(d.status)}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Notas */}
                            <div className="md:col-span-2">
                              <h4 className="font-medium mb-3">Notas</h4>
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                  <strong>Média Final:</strong> {d.media !== null ? safeToFixed(d.media, 1) : 'N/A'}
                                </p>
                                <p className="text-xs text-muted-foreground italic">
                                  Nota: O histórico acadêmico consolida apenas médias finais (snapshot imutável). 
                                  Detalhes de avaliações individuais não estão disponíveis após o encerramento do ano letivo.
                                </p>
                              </div>
                            </div>

                            {/* Resumo */}
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-medium mb-2">Resumo</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Média:</span>
                                    <span className="font-medium">{d.media !== null ? safeToFixed(d.media, 1) : '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Frequência:</span>
                                    <span className="font-medium">{d.frequencia !== null ? `${d.frequencia}%` : '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Professor:</span>
                                    <span className="font-medium">{d.professor}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
