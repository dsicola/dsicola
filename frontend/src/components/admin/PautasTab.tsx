import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { FileText, Printer, Loader2, Download, GraduationCap, Calendar, Users, AlertCircle, CheckCircle, XCircle, Clock, School, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import { ExportButtons } from "@/components/common/ExportButtons";
import { safeToFixed } from "@/lib/utils";
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { turmasApi, matriculasApi, notasApi, relatoriosApi, anoLetivoApi } from '@/services/api';
import { useSafeMutation } from '@/hooks/useSafeMutation';

interface TrimestreNotas {
  p1: number | null;
  p2: number | null;
  p3: number | null;
  recurso: number | null;
  trabalho: number | null;
  media: number | null;
}

interface AlunoNota {
  aluno_id: string;
  nome_completo: string;
  numero_identificacao_publica: string | null;
  notas: { tipo: string; valor: number; peso: number }[];
  trimestre1: TrimestreNotas;
  trimestre2: TrimestreNotas;
  trimestre3: TrimestreNotas;
  nota1: number | null;
  nota2: number | null;
  nota3: number | null;
  notaRecurso: number | null;
  notaTrabalho: number | null;
  media: number | null;
  mediaFinal: number | null;
  status: string;
  provasCompletas: boolean;
  qtdProvas: number;
  temRecurso: boolean;
  temTrabalho: boolean;
}

const NOTA_MINIMA_APROVACAO = 10;
const NOTA_RECURSO = 7;

const normalizeProvaTipo = (tipo: string, isSecundario: boolean) => {
  const raw = (tipo || '').trim();
  
  if (isSecundario) {
    if (raw.match(/^[123]T-(P[123]|Recurso|Trabalho)$/)) {
      return raw;
    }
    const t = raw.toLowerCase();
    if (t.includes('trimestre') && t.includes('1')) return '1T-P1';
    if (t.includes('trimestre') && t.includes('2')) return '2T-P1';
    if (t.includes('trimestre') && t.includes('3')) return '3T-P1';
    return raw;
  } else {
    const t = raw.toLowerCase();
    const hasToken = (n: number) => new RegExp(`(^|\\D)${n}(\\D|$)`).test(t);
    if ((t.includes('teste') || t.includes('prova')) && hasToken(1)) return '1ª Prova';
    if ((t.includes('teste') || t.includes('prova')) && hasToken(2)) return '2ª Prova';
    if ((t.includes('teste') || t.includes('prova')) && hasToken(3)) return '3ª Prova';
    if (t.includes('trabalho')) return 'Trabalho';
    if (t.includes('recurso') || t.includes('exame')) return 'Exame de Recurso';
  }

  return raw;
};

const calcularMediaTrimestre = (
  p1: number | null,
  p2: number | null,
  p3: number | null,
  recurso: number | null,
  trabalho: number | null
): number | null => {
  const p3Final = recurso !== null ? recurso : p3;
  
  const provas = [p1, p2, p3Final].filter((n): n is number => n !== null);
  if (provas.length === 0) return null;
  
  let media = provas.reduce((a, b) => a + b, 0) / provas.length;
  
  if (trabalho !== null) {
    media = (media + trabalho) / 2;
  }
  
  return Math.round(media * 100) / 100;
};

const calcularMediaAnualEnsinoMedio = (
  mediaTrim1: number | null,
  mediaTrim2: number | null,
  mediaTrim3: number | null
): { media: number | null; mediaFinal: number | null } => {
  const medias = [mediaTrim1, mediaTrim2, mediaTrim3].filter((n): n is number => n !== null);
  if (medias.length === 0) return { media: null, mediaFinal: null };
  
  const mediaFinal = medias.reduce((a, b) => a + b, 0) / medias.length;
  
  return { 
    media: Math.round(mediaFinal * 100) / 100, 
    mediaFinal: Math.round(mediaFinal * 100) / 100 
  };
};

const calcularMediaUniversidade = (
  nota1: number | null,
  nota2: number | null,
  nota3: number | null,
  notaTrabalho: number | null,
  notaRecurso: number | null
): { media: number | null; mediaFinal: number | null; nota3Final: number | null } => {
  const notas = [nota1, nota2, nota3].filter((n): n is number => n !== null);
  if (notas.length === 0) return { media: null, mediaFinal: null, nota3Final: null };
  
  const media = notas.reduce((a, b) => a + b, 0) / notas.length;
  
  let nota3Final = nota3;
  
  if (notaRecurso !== null) {
    nota3Final = notaRecurso;
  } else if (notaTrabalho !== null && nota3 !== null) {
    nota3Final = (nota3 + notaTrabalho) / 2;
  }
  
  const notasFinais = [nota1, nota2, nota3Final].filter((n): n is number => n !== null);
  const mediaFinal = notasFinais.length > 0 
    ? notasFinais.reduce((a, b) => a + b, 0) / notasFinais.length 
    : null;
  
  return { 
    media: Math.round(media * 100) / 100, 
    mediaFinal: mediaFinal !== null ? Math.round(mediaFinal * 100) / 100 : null,
    nota3Final: nota3Final !== null ? Math.round(nota3Final * 100) / 100 : null
  };
};

export const PautasTab: React.FC = () => {
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [selectedTurno, setSelectedTurno] = useState<string>('todos');
  const [selectedAnoLetivo, setSelectedAnoLetivo] = useState<string>('todos');
  const [selectedSemestre, setSelectedSemestre] = useState<string>('todos');
  const [incluirIncompletos, setIncluirIncompletos] = useState<boolean>(true);
  const printRef = useRef<HTMLDivElement>(null);
  const { config, isSecundario } = useInstituicao();
  const { instituicaoId } = useTenantFilter();

  // Buscar anos letivos disponíveis
  const { data: anosLetivos = [], isLoading: isLoadingAnosLetivos } = useQuery({
    queryKey: ["anos-letivos-pautas", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  // Mutation para gerar Pauta Final
  const gerarPautaFinalMutation = useSafeMutation({
    mutationFn: relatoriosApi.gerarPautaFinal,
    onSuccess: () => {
      toast.success('Pauta Final gerada com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao gerar Pauta Final');
    },
  });

  const labels = {
    turma: isSecundario ? 'Classe' : 'Turma',
    curso: isSecundario ? 'Série' : 'Curso',
    semestre: isSecundario ? 'Ano Letivo' : 'Semestre',
    periodo: isSecundario ? 'Período' : 'Período Letivo',
    nota1: isSecundario ? '1º Trim' : '1ª Prova',
    nota2: isSecundario ? '2º Trim' : '2ª Prova',
    nota3: isSecundario ? '3º Trim' : '3ª Prova',
    recurso: isSecundario ? 'Recup.' : 'Recurso',
    trabalho: isSecundario ? 'Trabalho' : 'Trabalho',
  };

  const { data: turmas = [], isLoading: turmasLoading } = useQuery({
    queryKey: ['admin-turmas-pautas', instituicaoId],
    queryFn: async () => {
      const data = await turmasApi.getAll({ instituicaoId });
      return data || [];
    }
  });

  const filteredTurmas = turmas.filter((turma: any) => {
    let match = true;
    if (selectedTurno !== 'todos') {
      const turno = (turma.turno || '').toLowerCase();
      if (selectedTurno === 'manha' && !turno.includes('manhã') && !turno.includes('manha')) match = false;
      if (selectedTurno === 'tarde' && !turno.includes('tarde')) match = false;
      if (selectedTurno === 'noite' && !turno.includes('noite')) match = false;
    }
    if (selectedAnoLetivo !== 'todos' && turma.ano?.toString() !== selectedAnoLetivo) match = false;
    if (selectedSemestre !== 'todos' && turma.semestre !== selectedSemestre) match = false;
    return match;
  });

  const selectedTurmaData = turmas.find((t: any) => t.id === selectedTurma);

  const { data: pautaData, isLoading: pautaLoading } = useQuery({
    queryKey: ['pauta-data', selectedTurma, isSecundario],
    queryFn: async () => {
      const res = await matriculasApi.getAll({ turmaId: selectedTurma, status: 'ativa' });
      const matriculas = res?.data ?? [];

      if (matriculas.length === 0) return [];

      const matriculaIds = matriculas.map((m: any) => m.id);
      const notas = await notasApi.getByMatriculaIds(matriculaIds);

      const alunosNotas: AlunoNota[] = matriculas.map((m: any) => {
        const alunoNotasRaw = notas?.filter((n: any) => n.matricula_id === m.id) || [];

        const alunoNotas = alunoNotasRaw.map((n: any) => ({
          ...n,
          tipo: normalizeProvaTipo(n.tipo, isSecundario)
        }));

        const getNota = (tipo: string): number | null => {
          const nota = alunoNotas.find((n: any) => n.tipo === tipo);
          return nota ? nota.valor : null;
        };

        const emptyTrimestre: TrimestreNotas = { p1: null, p2: null, p3: null, recurso: null, trabalho: null, media: null };
        let trimestre1: TrimestreNotas = { ...emptyTrimestre };
        let trimestre2: TrimestreNotas = { ...emptyTrimestre };
        let trimestre3: TrimestreNotas = { ...emptyTrimestre };
        
        let nota1: number | null = null, nota2: number | null = null, nota3: number | null = null;
        let notaTrabalho: number | null = null, notaRecurso: number | null = null;

        if (isSecundario) {
          trimestre1 = {
            p1: getNota('1T-P1'),
            p2: getNota('1T-P2'),
            p3: getNota('1T-P3'),
            recurso: getNota('1T-Recurso'),
            trabalho: getNota('1T-Trabalho'),
            media: null
          };
          trimestre1.media = calcularMediaTrimestre(trimestre1.p1, trimestre1.p2, trimestre1.p3, trimestre1.recurso, trimestre1.trabalho);
          
          trimestre2 = {
            p1: getNota('2T-P1'),
            p2: getNota('2T-P2'),
            p3: getNota('2T-P3'),
            recurso: getNota('2T-Recurso'),
            trabalho: getNota('2T-Trabalho'),
            media: null
          };
          trimestre2.media = calcularMediaTrimestre(trimestre2.p1, trimestre2.p2, trimestre2.p3, trimestre2.recurso, trimestre2.trabalho);
          
          trimestre3 = {
            p1: getNota('3T-P1'),
            p2: getNota('3T-P2'),
            p3: getNota('3T-P3'),
            recurso: getNota('3T-Recurso'),
            trabalho: getNota('3T-Trabalho'),
            media: null
          };
          trimestre3.media = calcularMediaTrimestre(trimestre3.p1, trimestre3.p2, trimestre3.p3, trimestre3.recurso, trimestre3.trabalho);
          
          nota1 = trimestre1.media;
          nota2 = trimestre2.media;
          nota3 = trimestre3.media;
        } else {
          nota1 = getNota('1ª Prova');
          nota2 = getNota('2ª Prova');
          nota3 = getNota('3ª Prova');
          notaTrabalho = getNota('Trabalho');
          notaRecurso = getNota('Exame de Recurso');
        }

        const temRecurso = isSecundario 
          ? (trimestre1.recurso !== null || trimestre2.recurso !== null || trimestre3.recurso !== null)
          : notaRecurso !== null;
        const temTrabalho = isSecundario
          ? (trimestre1.trabalho !== null || trimestre2.trabalho !== null || trimestre3.trabalho !== null)
          : notaTrabalho !== null;
        
        const qtdProvas = isSecundario
          ? [trimestre1, trimestre2, trimestre3].filter(t => t.p1 !== null || t.p2 !== null || t.p3 !== null).length
          : [nota1, nota2, nota3].filter(n => n !== null).length;
        
        const provasCompletas = isSecundario
          ? trimestre1.media !== null && trimestre2.media !== null && trimestre3.media !== null
          : nota1 !== null && nota2 !== null && nota3 !== null;

        let media: number | null = null;
        let mediaFinal: number | null = null;

        if (isSecundario) {
          const calc = calcularMediaAnualEnsinoMedio(trimestre1.media, trimestre2.media, trimestre3.media);
          media = calc.media;
          mediaFinal = calc.mediaFinal;
        } else {
          const calc = calcularMediaUniversidade(nota1, nota2, nota3, notaTrabalho, notaRecurso);
          media = calc.media;
          mediaFinal = calc.mediaFinal;
        }

        let status = 'Sem Notas';
        if (qtdProvas > 0 && !provasCompletas && !temRecurso) {
          status = 'Incompleto';
        } else if (qtdProvas > 0) {
          const mediaParaStatus = mediaFinal !== null ? mediaFinal : 0;
          if (mediaParaStatus >= NOTA_MINIMA_APROVACAO) {
            status = 'Aprovado';
          } else if (mediaParaStatus >= NOTA_RECURSO && !temRecurso) {
            status = isSecundario ? 'Recuperação' : 'Recurso';
          } else {
            status = 'Reprovado';
          }
        }

        return {
          aluno_id: m.aluno_id,
          nome_completo: m.profiles?.nome_completo || 'N/A',
          numero_identificacao_publica: m.profiles?.numero_identificacao_publica || null,
          notas: alunoNotas.map((n: any) => ({ tipo: n.tipo, valor: n.valor, peso: n.peso })),
          trimestre1,
          trimestre2,
          trimestre3,
          nota1,
          nota2,
          nota3,
          notaRecurso,
          notaTrabalho,
          media,
          mediaFinal,
          status,
          provasCompletas,
          qtdProvas,
          temRecurso,
          temTrabalho
        };
      });

      return alunosNotas.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    },
    enabled: !!selectedTurma
  });

  const instituicao = config;
  const pautaTodos = pautaData || [];
  const pautaComNotas = pautaTodos.filter((a: AlunoNota) => a.qtdProvas > 0);
  const pautaCompletos = pautaTodos.filter((a: AlunoNota) => a.provasCompletas);
  
  const pautaParaRelatorio = incluirIncompletos ? pautaTodos : pautaCompletos;
  
  const aprovadosCount = pautaParaRelatorio.filter(a => a.status === 'Aprovado').length;
  const recursoCount = pautaParaRelatorio.filter(a => a.status === 'Recurso' || a.status === 'Recuperação').length;
  const reprovadosCount = pautaParaRelatorio.filter(a => a.status === 'Reprovado').length;
  const incompletosCount = pautaParaRelatorio.filter(a => a.status === 'Incompleto').length;

  const canPrintPauta = pautaParaRelatorio.length > 0;

  const formatNota = (nota: number | null): string => {
    if (nota === null) return '-';
    return safeToFixed(nota, 1);
  };

  const exportData = pautaParaRelatorio.map((a, index) => [
    (index + 1).toString(),
    a.nome_completo,
    formatNota(a.nota1),
    formatNota(a.nota2),
    formatNota(a.nota3),
    formatNota(a.notaRecurso),
    formatNota(a.notaTrabalho),
    a.mediaFinal !== null ? safeToFixed(a.mediaFinal, 1) : '-',
    a.status,
  ]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aprovado':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'Recurso':
      case 'Recuperação':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'Reprovado':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'Incompleto':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Pautas de Notas
          </CardTitle>
          <CardDescription>
            Selecione uma {labels.turma.toLowerCase()} para visualizar e exportar a pauta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Ano Letivo</Label>
              <Select value={selectedAnoLetivo} onValueChange={setSelectedAnoLetivo} disabled={isLoadingAnosLetivos}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingAnosLetivos ? "Carregando..." : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {anosLetivos.map((al: any) => (
                    <SelectItem key={al.id} value={al.ano.toString()}>
                      {al.ano} - {al.status === 'ATIVO' ? '🟢 Ativo' : al.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Turno</Label>
              <Select value={selectedTurno} onValueChange={setSelectedTurno}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="manha">Manhã</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="noite">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{labels.turma}</Label>
              <Select value={selectedTurma} onValueChange={setSelectedTurma}>
                <SelectTrigger>
                  <SelectValue placeholder={`Selecione a ${labels.turma.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {filteredTurmas.map((turma: any) => (
                    <SelectItem key={turma.id} value={turma.id}>
                      {turma.nome} - {turma.cursos?.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Incluir Incompletos</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={incluirIncompletos}
                  onCheckedChange={setIncluirIncompletos}
                />
                <span className="text-sm text-muted-foreground">
                  {incluirIncompletos ? 'Sim' : 'Não'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {selectedTurma && pautaData && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{pautaParaRelatorio.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Aprovados</p>
                  <p className="text-2xl font-bold text-green-600">{aprovadosCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Recurso</p>
                  <p className="text-2xl font-bold text-yellow-600">{recursoCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Reprovados</p>
                  <p className="text-2xl font-bold text-red-600">{reprovadosCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Incompletos</p>
                  <p className="text-2xl font-bold text-muted-foreground">{incompletosCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pauta Table */}
      {selectedTurma && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pauta de Notas</CardTitle>
              <CardDescription>
                {selectedTurmaData?.nome} - {selectedTurmaData?.cursos?.nome}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* REGRA: Geração de pauta deve ser feita via Plano de Ensino, não diretamente pela Turma */}
              {/* Removido botão que dependia de disciplinaId na Turma */}
              {selectedAnoLetivo && (
                <Button
                  onClick={() => {
                    if (!selectedTurma || !selectedAnoLetivo) {
                      toast.error('Selecione turma e ano letivo');
                      return;
                    }
                    toast.info('Para gerar pauta, use o módulo de Plano de Ensino');
                  }}
                  variant="default"
                >
                  {gerarPautaFinalMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Gerar Pauta Final Oficial
                    </>
                  )}
                </Button>
              )}
              <ExportButtons
                titulo={`Pauta - ${selectedTurmaData?.nome || 'Turma'}`}
                colunas={['#', 'Nome', labels.nota1, labels.nota2, labels.nota3, labels.recurso, labels.trabalho, 'Média', 'Status']}
                dados={exportData}
              />
            </div>
          </CardHeader>
          <CardContent>
            {pautaLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pautaParaRelatorio.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum estudante matriculado nesta turma</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto" ref={printRef}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nome do Estudante</TableHead>
                      <TableHead className="text-center">{labels.nota1}</TableHead>
                      <TableHead className="text-center">{labels.nota2}</TableHead>
                      <TableHead className="text-center">{labels.nota3}</TableHead>
                      <TableHead className="text-center">{labels.recurso}</TableHead>
                      <TableHead className="text-center">{labels.trabalho}</TableHead>
                      <TableHead className="text-center">Média</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pautaParaRelatorio.map((aluno, index) => (
                      <TableRow key={aluno.aluno_id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>{aluno.nome_completo}</TableCell>
                        <TableCell className="text-center">{formatNota(aluno.nota1)}</TableCell>
                        <TableCell className="text-center">{formatNota(aluno.nota2)}</TableCell>
                        <TableCell className="text-center">{formatNota(aluno.nota3)}</TableCell>
                        <TableCell className="text-center">{formatNota(aluno.notaRecurso)}</TableCell>
                        <TableCell className="text-center">{formatNota(aluno.notaTrabalho)}</TableCell>
                        <TableCell className="text-center font-bold">
                          {aluno.mediaFinal !== null ? safeToFixed(aluno.mediaFinal, 1) : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(aluno.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
