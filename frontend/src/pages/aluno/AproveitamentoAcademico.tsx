import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, BookOpen, TrendingUp, Award, Calendar, Filter, Printer } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { matriculasDisciplinasApi, matriculasApi, notasApi } from '@/services/api';
import { safeToFixed } from '@/lib/utils';

interface TrimestreNotas {
  p1: number | null;
  p2: number | null;
  p3: number | null;
  media: number | null;
  recurso: number | null;
}

interface DisciplinaNota {
  disciplina: string;
  turma: string;
  curso: string;
  ano: number | string;
  anoFrequencia: number;
  professor: string;
  notas: {
    trimestre1: TrimestreNotas;
    trimestre2: TrimestreNotas;
    trimestre3: TrimestreNotas;
    mac: number | null;
    exame: number | null;
    frequencia: number | null;
    mediaAnual: number | null;
    exameRecurso: number | null;
    notaFinal: number | null;
  };
  status: string;
}

const AproveitamentoAcademico: React.FC = () => {
  const { user } = useAuth();
  const { isSecundario, config, instituicao } = useInstituicao();
  const [anoSelecionado, setAnoSelecionado] = useState<string>('todos');
  const [semestreSelecionado, setSemestreSelecionado] = useState<string>('todos');
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch aluno_disciplinas - usando endpoint geral para buscar todas as matrículas do aluno
  const { data: alunoDisciplinas = [], isLoading: alunoDiscLoading } = useQuery({
    queryKey: ['aluno-disciplinas-aproveitamento', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }
      try {
        // Usar endpoint geral com filtro por alunoId para buscar todas as matrículas (todos os anos)
        const data = await matriculasDisciplinasApi.getAll({ alunoId: user.id });
        return data || [];
      } catch (error) {
        console.error('Error fetching aluno-disciplinas:', error);
        return [];
      }
    },
    enabled: !!user?.id && typeof user.id === 'string' && user.id.trim().length > 0
  });

  // Fetch matriculas do aluno
  const { data: matriculas = [], isLoading: matriculasLoading } = useQuery({
    queryKey: ['aluno-matriculas-aproveitamento', user?.id],
    queryFn: async () => {
      const res = await matriculasApi.getByAlunoId(user?.id);
      return res?.data ?? [];
    },
    enabled: !!user?.id
  });

  // Fetch notas do aluno
  const { data: notas = [], isLoading: notasLoading } = useQuery({
    queryKey: ['aluno-notas-aproveitamento', user?.id, matriculas.length],
    queryFn: async () => {
      const matriculaIds = matriculas.map((m: any) => m.id);
      if (matriculaIds.length === 0) return [];
      
      const data = await notasApi.getByMatriculaIds(matriculaIds);
      return data || [];
    },
    enabled: matriculas.length > 0
  });

  // Get unique years
  const anosDisponiveis = [...new Set([
    ...alunoDisciplinas.map((ad: any) => ad.ano?.toString()).filter(Boolean),
    ...matriculas.map((m: any) => m.turmas?.ano?.toString()).filter(Boolean)
  ])];
  if (anosDisponiveis.length === 0) {
    anosDisponiveis.push(new Date().getFullYear().toString());
  }

  // Parse nota tipo
  const parseTipoNota = (tipo: string): { trimestre: number | null; prova: string | null } => {
    const tipoUpper = tipo.toUpperCase().trim();
    
    const matchTrimestreProva = tipoUpper.match(/(\d)T[-_]?(P1|P2|P3|REC|MEDIA)/);
    if (matchTrimestreProva) {
      const trimestre = parseInt(matchTrimestreProva[1]);
      const prova = matchTrimestreProva[2];
      if (prova === 'REC') return { trimestre, prova: 'RECURSO' };
      if (prova === 'MEDIA') return { trimestre, prova: 'MEDIA' };
      return { trimestre, prova };
    }

    const matchTrimestreNumero = tipoUpper.match(/(\d)[ºª°]?\s*(TRIMESTRE|TRI)/);
    if (matchTrimestreNumero) {
      return { trimestre: parseInt(matchTrimestreNumero[1]), prova: 'MEDIA' };
    }

    const matchProvaNumerada = tipoUpper.match(/(\d)[ºª°]?\s*PROVA/);
    if (matchProvaNumerada) {
      const num = parseInt(matchProvaNumerada[1]);
      if (num <= 2) return { trimestre: 1, prova: `P${num}` };
      if (num === 3) return { trimestre: 2, prova: 'P1' };
      if (num === 4) return { trimestre: 2, prova: 'P2' };
      if (num === 5) return { trimestre: 3, prova: 'P1' };
      if (num === 6) return { trimestre: 3, prova: 'P2' };
    }

    if (tipoUpper.includes('RECURSO') || tipoUpper.includes('RECUPERAÇÃO')) {
      return { trimestre: null, prova: 'RECURSO' };
    }
    if (tipoUpper === 'EXAME' || tipoUpper.includes('EXAME NORMAL')) {
      return { trimestre: null, prova: 'EXAME' };
    }
    if (tipoUpper.includes('FREQUÊNCIA') || tipoUpper === 'FREQ') {
      return { trimestre: null, prova: 'FREQUENCIA' };
    }
    if (tipoUpper === 'MAC') {
      return { trimestre: null, prova: 'MAC' };
    }
    if (tipoUpper === 'REC') {
      return { trimestre: null, prova: 'RECURSO' };
    }
    if (tipoUpper.includes('SEMESTRE') || tipoUpper.includes('SEMESTRAL')) {
      if (tipoUpper.includes('1')) return { trimestre: 1, prova: 'MEDIA' };
      if (tipoUpper.includes('2')) return { trimestre: 2, prova: 'MEDIA' };
    }

    return { trimestre: null, prova: null };
  };

  const calcularPrimeiroAnoLetivo = (): number => {
    const anosMatriculas = [
      ...alunoDisciplinas.map((ad: any) => ad.ano).filter(Boolean),
      ...matriculas.map((m: any) => m.turmas?.ano).filter(Boolean)
    ].map(a => parseInt(a.toString()));
    
    if (anosMatriculas.length === 0) return new Date().getFullYear();
    return Math.min(...anosMatriculas);
  };

  const primeiroAnoLetivo = calcularPrimeiroAnoLetivo();

  const calcularAnoFrequencia = (anoLetivo: number | string): number => {
    const ano = parseInt(anoLetivo?.toString() || new Date().getFullYear().toString());
    return ano - primeiroAnoLetivo + 1;
  };

  const organizarNotasPorDisciplina = (): DisciplinaNota[] => {
    const disciplinasMap: Record<string, DisciplinaNota> = {};

    alunoDisciplinas.forEach((ad: any) => {
      const disciplina = ad.disciplinas;
      const turma = ad.turmas;
      if (!disciplina) return;

      const ano = ad.ano?.toString() || turma?.ano?.toString();
      if (anoSelecionado !== 'todos' && ano !== anoSelecionado) return;

      const semestre = ad.semestre?.toString() || turma?.semestre?.toString();
      if (semestreSelecionado !== 'todos' && semestre !== semestreSelecionado) return;

      const key = `${disciplina.id}-${turma?.id || 'sem-turma'}`;
      
      const createEmptyTrimestre = (): TrimestreNotas => ({
        p1: null, p2: null, p3: null, media: null, recurso: null
      });

      const anoNumerico = parseInt(ano || new Date().getFullYear().toString());

      if (!disciplinasMap[key]) {
        disciplinasMap[key] = {
          disciplina: disciplina.nome,
          turma: turma?.nome || 'N/A',
          curso: disciplina.cursos?.nome || '',
          ano: ano || new Date().getFullYear(),
          anoFrequencia: calcularAnoFrequencia(anoNumerico),
          professor: turma?.profiles?.nome_completo || '',
          notas: {
            trimestre1: createEmptyTrimestre(),
            trimestre2: createEmptyTrimestre(),
            trimestre3: createEmptyTrimestre(),
            mac: null,
            exame: null,
            frequencia: null,
            mediaAnual: null,
            exameRecurso: null,
            notaFinal: null
          },
          status: 'Em Curso'
        };
      }
    });

    notas.forEach((nota: any) => {
      const turma = nota.matriculas?.turmas;
      if (!turma) return;

      const ano = turma.ano?.toString();
      if (anoSelecionado !== 'todos' && ano !== anoSelecionado) return;

      const semestre = turma.semestre?.toString();
      if (semestreSelecionado !== 'todos' && semestre !== semestreSelecionado) return;

      const disciplinaAssociada = alunoDisciplinas.find((ad: any) => ad.turma_id === turma.id);
      
      if (!disciplinaAssociada || !disciplinaAssociada.disciplinas) return;
      
      const key = `${disciplinaAssociada.disciplinas.id}-${turma.id}`;

      const { trimestre, prova } = parseTipoNota(nota.tipo);

      if (!disciplinasMap[key]) return;

      if (trimestre && prova && trimestre <= 3) {
        const trimestreKey = `trimestre${trimestre}` as 'trimestre1' | 'trimestre2' | 'trimestre3';
        if (prova === 'P1') {
          disciplinasMap[key].notas[trimestreKey].p1 = nota.valor;
        } else if (prova === 'P2') {
          disciplinasMap[key].notas[trimestreKey].p2 = nota.valor;
        } else if (prova === 'P3') {
          disciplinasMap[key].notas[trimestreKey].p3 = nota.valor;
        } else if (prova === 'MEDIA') {
          disciplinasMap[key].notas[trimestreKey].media = nota.valor;
        } else if (prova === 'RECURSO') {
          disciplinasMap[key].notas[trimestreKey].recurso = nota.valor;
        }
      } else if (prova === 'RECURSO') {
        disciplinasMap[key].notas.exameRecurso = nota.valor;
      } else if (prova === 'EXAME') {
        disciplinasMap[key].notas.exame = nota.valor;
      } else if (prova === 'MAC') {
        disciplinasMap[key].notas.mac = nota.valor;
      } else if (prova === 'FREQUENCIA') {
        disciplinasMap[key].notas.frequencia = nota.valor;
      }
    });

    Object.values(disciplinasMap).forEach(disc => {
      ['trimestre1', 'trimestre2', 'trimestre3'].forEach(t => {
        const tri = disc.notas[t as 'trimestre1' | 'trimestre2' | 'trimestre3'];
        if (tri.media === null) {
          const provas = [tri.p1, tri.p2, tri.p3].filter(p => p !== null) as number[];
          if (provas.length > 0) {
            tri.media = provas.reduce((a, b) => a + b, 0) / provas.length;
          }
        }
      });

      const medias = [
        disc.notas.trimestre1.media,
        disc.notas.trimestre2.media,
        disc.notas.trimestre3.media
      ].filter(m => m !== null) as number[];

      if (medias.length > 0) {
        disc.notas.mediaAnual = medias.reduce((a, b) => a + b, 0) / medias.length;
      }

      if (disc.notas.exameRecurso !== null && disc.notas.mediaAnual !== null) {
        disc.notas.notaFinal = Math.max(disc.notas.mediaAnual, (disc.notas.mediaAnual + disc.notas.exameRecurso) / 2);
      } else {
        disc.notas.notaFinal = disc.notas.mediaAnual;
      }

      const notaMinima = 10;
      if (disc.notas.notaFinal !== null) {
        if (disc.notas.notaFinal >= notaMinima) {
          disc.status = 'Aprovado';
        } else if (disc.notas.exameRecurso !== null) {
          disc.status = 'Reprovado';
        } else if (disc.notas.mediaAnual !== null && disc.notas.mediaAnual < notaMinima) {
          disc.status = 'Em Recuperação';
        }
      }
    });

    return Object.values(disciplinasMap);
  };

  const disciplinasOrganizadas = organizarNotasPorDisciplina();

  const estatisticas = {
    totalDisciplinas: disciplinasOrganizadas.length,
    aprovadas: disciplinasOrganizadas.filter(d => d.status === 'Aprovado').length,
    emRecuperacao: disciplinasOrganizadas.filter(d => d.status === 'Em Recuperação').length,
    reprovadas: disciplinasOrganizadas.filter(d => d.status === 'Reprovado').length,
    mediaGeral: disciplinasOrganizadas.filter(d => d.notas.notaFinal !== null).length > 0
      ? disciplinasOrganizadas
          .filter(d => d.notas.notaFinal !== null)
          .reduce((acc, d) => acc + (d.notas.notaFinal || 0), 0) / 
          disciplinasOrganizadas.filter(d => d.notas.notaFinal !== null).length
      : 0
  };

  const getNotaColor = (nota: number | null) => {
    if (nota === null) return 'text-muted-foreground';
    if (nota >= 14) return 'text-green-600 font-semibold';
    if (nota >= 10) return 'text-blue-600';
    if (nota >= 8) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aprovado':
        return <Badge className="bg-green-500 hover:bg-green-600">Aprovado</Badge>;
      case 'Em Recuperação':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Em Recuperação</Badge>;
      case 'Reprovado':
        return <Badge variant="destructive">Reprovado</Badge>;
      default:
        return <Badge variant="secondary">Em Curso</Badge>;
    }
  };

  const formatNota = (nota: number | null) => {
    if (nota === null) return '-';
    return safeToFixed(nota, 1);
  };

  const handlePrint = () => {
    window.print();
  };

  const isLoading = alunoDiscLoading || matriculasLoading || notasLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" ref={printRef}>
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Aproveitamento Académico
            </h1>
            <p className="text-muted-foreground">
              Acompanhe seu desempenho nas disciplinas
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Ano Letivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Anos</SelectItem>
                {anosDisponiveis.map(ano => (
                  <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Disciplinas</p>
                  <p className="text-2xl font-bold">{estatisticas.totalDisciplinas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Aprovadas</p>
                  <p className="text-2xl font-bold text-green-600">{estatisticas.aprovadas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Recuperação</p>
                  <p className="text-2xl font-bold text-yellow-600">{estatisticas.emRecuperacao}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Reprovadas</p>
                  <p className="text-2xl font-bold text-red-600">{estatisticas.reprovadas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Média Geral</p>
                  <p className={`text-2xl font-bold ${getNotaColor(estatisticas.mediaGeral)}`}>
                    {safeToFixed(estatisticas.mediaGeral, 1)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grades Table */}
        <Card>
          <CardHeader>
            <CardTitle>Notas por Disciplina</CardTitle>
            <CardDescription>
              {isSecundario ? 'Notas por trimestre' : 'Notas por semestre'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {disciplinasOrganizadas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma disciplina encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Disciplina</TableHead>
                      <TableHead>Turma</TableHead>
                      <TableHead>Ano</TableHead>
                      <TableHead className="text-center">1º Tri</TableHead>
                      <TableHead className="text-center">2º Tri</TableHead>
                      {isSecundario && <TableHead className="text-center">3º Tri</TableHead>}
                      <TableHead className="text-center">Média</TableHead>
                      <TableHead className="text-center">Recurso</TableHead>
                      <TableHead className="text-center">Final</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disciplinasOrganizadas.map((disc, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{disc.disciplina}</TableCell>
                        <TableCell>{disc.turma}</TableCell>
                        <TableCell>{disc.ano}</TableCell>
                        <TableCell className={`text-center ${getNotaColor(disc.notas.trimestre1.media)}`}>
                          {formatNota(disc.notas.trimestre1.media)}
                        </TableCell>
                        <TableCell className={`text-center ${getNotaColor(disc.notas.trimestre2.media)}`}>
                          {formatNota(disc.notas.trimestre2.media)}
                        </TableCell>
                        {isSecundario && (
                          <TableCell className={`text-center ${getNotaColor(disc.notas.trimestre3.media)}`}>
                            {formatNota(disc.notas.trimestre3.media)}
                          </TableCell>
                        )}
                        <TableCell className={`text-center ${getNotaColor(disc.notas.mediaAnual)}`}>
                          {formatNota(disc.notas.mediaAnual)}
                        </TableCell>
                        <TableCell className={`text-center ${getNotaColor(disc.notas.exameRecurso)}`}>
                          {formatNota(disc.notas.exameRecurso)}
                        </TableCell>
                        <TableCell className={`text-center font-bold ${getNotaColor(disc.notas.notaFinal)}`}>
                          {formatNota(disc.notas.notaFinal)}
                        </TableCell>
                        <TableCell>{getStatusBadge(disc.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AproveitamentoAcademico;
