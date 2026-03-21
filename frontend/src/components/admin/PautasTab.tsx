import React, { useState, useRef, useEffect, useMemo } from 'react';
import { mergePautaLabelsSuperior, mergePautaLabelsSecundario, buildPesosMTSecundarioFromParametros } from '@/utils/pautaLabelsConfig';
import {
  NOTA_MINIMA_ZONA_RECURSO_PADRAO,
  calcularMediaFinalEnsinoMedio,
  calcularMediaFinalUniversidade,
  buildOpcoesCalculoSuperiorPautaFromParametros,
  obterMediasTrimestraisSecundario,
  contarTrimestresComLancamentoSecundario,
} from '@/utils/gestaoNotasCalculo';
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
import { useAuth } from '@/contexts/AuthContext';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { turmasApi, matriculasApi, notasApi, relatoriosApi, anoLetivoApi, parametrosSistemaApi } from '@/services/api';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { getTurmaRowId, isValidTurmaSelection, turmasListFromApiResponse, parseTurmaAnoCivil } from '@/utils/turmaIdentity';

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

function matriculasDataFromListResponse(res: unknown): any[] {
  if (res == null || typeof res !== 'object') return [];
  const r = res as Record<string, unknown>;
  if (Array.isArray(r.data)) return r.data;
  if (Array.isArray(res)) return res as any[];
  return [];
}

/** Nome do turno para etiqueta (objeto API ou string) */
function getTurnoNomeTurma(turma: { turno?: { nome?: string } | string | null }): string {
  const raw = turma.turno;
  if (raw && typeof raw === 'object' && 'nome' in raw) return String((raw as { nome?: string }).nome ?? '');
  return String(raw ?? '');
}

/**
 * Filtro de turno só no browser (refina a lista do select). GET /matriculas usa apenas turmaId.
 * Aceita variantes: Matutino, Vespertino, Noturno.
 */
function turmaMatchesTurnoFilter(turnoNome: unknown, selected: string): boolean {
  if (selected === 'todos') return true;
  const t = String(turnoNome ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (selected === 'manha') return /manha|matutin/.test(t);
  if (selected === 'tarde') return /tarde|vespertin/.test(t);
  if (selected === 'noite') return /noite|noturn/.test(t);
  return true;
}

/** Matrículas da turma com paginação (API limita pageSize) */
async function fetchTodasMatriculasTurmaPages(
  turmaId: string,
  opts?: { status?: string },
): Promise<any[]> {
  const pageSize = 100;
  let page = 1;
  const all: any[] = [];
  const tid = String(turmaId).trim();
  if (!isValidTurmaSelection(tid)) return [];
  for (;;) {
    const res = await matriculasApi.getAll({
      turmaId: tid,
      ...(opts?.status ? { status: opts.status } : {}),
      page,
      pageSize,
    });
    const chunk = matriculasDataFromListResponse(res);
    all.push(...chunk);
    const total = typeof (res as any)?.meta?.total === 'number' ? (res as any).meta.total : chunk.length;
    if (chunk.length < pageSize || all.length >= total) break;
    page += 1;
    if (page > 100) break;
  }
  return all;
}

/**
 * Lista alunos da turma para a pauta. Tenta primeiro só matrículas Ativas; se vazio, repete sem filtro
 * de status (dados legados / inconsistências) e exclui só Cancelada — alinhado ao uso em NotasTab (histórico).
 */
async function fetchTodasMatriculasTurma(turmaId: string): Promise<any[]> {
  const ativas = await fetchTodasMatriculasTurmaPages(turmaId, { status: 'Ativa' });
  if (ativas.length > 0) return ativas;
  const todas = await fetchTodasMatriculasTurmaPages(turmaId);
  return todas.filter((m: any) => m?.status !== 'Cancelada');
}

export const PautasTab: React.FC = () => {
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [selectedTurno, setSelectedTurno] = useState<string>('todos');
  const [selectedAnoLetivo, setSelectedAnoLetivo] = useState<string>('todos');
  const [selectedSemestre, setSelectedSemestre] = useState<string>('todos');
  const [incluirIncompletos, setIncluirIncompletos] = useState<boolean>(true);
  const printRef = useRef<HTMLDivElement>(null);
  const { config, isSecundario } = useInstituicao();
  const { instituicaoId } = useTenantFilter();
  const { user, role } = useAuth();
  const isProfessor = role === 'PROFESSOR';

  // Buscar anos letivos disponíveis
  const { data: anosLetivos = [], isLoading: isLoadingAnosLetivos } = useQuery({
    queryKey: ["anos-letivos-pautas", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  const { data: parametrosPauta } = useQuery({
    queryKey: ['parametros-sistema-pautas-tab', instituicaoId],
    queryFn: () => parametrosSistemaApi.get(),
    enabled: !!instituicaoId,
    staleTime: 60_000,
  });
  const labelsPautaSup = useMemo(
    () => mergePautaLabelsSuperior(parametrosPauta?.pautaLabelsSuperior),
    [parametrosPauta?.pautaLabelsSuperior],
  );
  const labelsPautaSec = useMemo(
    () => mergePautaLabelsSecundario(parametrosPauta?.pautaLabelsSecundario),
    [parametrosPauta?.pautaLabelsSecundario],
  );

  const thresholdsPauta = useMemo(
    () => ({
      notaMinimaAprovacao: Number(parametrosPauta?.percentualMinimoAprovacao ?? NOTA_MINIMA_APROVACAO),
      notaMinRecurso: Number(
        parametrosPauta?.notaMinimaZonaExameRecurso ?? NOTA_MINIMA_ZONA_RECURSO_PADRAO,
      ),
      permitirExameRecurso: parametrosPauta?.permitirExameRecurso ?? false,
    }),
    [parametrosPauta],
  );
  const opSuperiorPauta = useMemo(
    () =>
      buildOpcoesCalculoSuperiorPautaFromParametros(parametrosPauta as Record<string, unknown> | undefined),
    [parametrosPauta],
  );
  const pesosMTSec = useMemo(
    () => buildPesosMTSecundarioFromParametros(parametrosPauta),
    [parametrosPauta],
  );
  const pesosMTQueryKey =
    pesosMTSec == null
      ? 'mt-eq'
      : `${pesosMTSec.mac.toFixed(4)}-${pesosMTSec.npp.toFixed(4)}-${pesosMTSec.npt.toFixed(4)}`;

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

  const labels = useMemo(
    () => ({
      // Sempre "Turma": o select usa o id do registo Turma (10ª A, 10ª B), não o id da Classe (série)
      turma: 'Turma',
      curso: isSecundario ? 'Série' : 'Curso',
      semestre: isSecundario ? 'Ano Letivo' : 'Semestre',
      periodo: isSecundario ? 'Período' : 'Período Letivo',
      nota1: isSecundario ? labelsPautaSec.periodo1 : labelsPautaSup.prova1,
      nota2: isSecundario ? labelsPautaSec.periodo2 : labelsPautaSup.prova2,
      nota3: isSecundario ? labelsPautaSec.periodo3 : labelsPautaSup.prova3,
      recurso: isSecundario ? labelsPautaSec.recuperacao : labelsPautaSup.exameRecurso,
      trabalho: isSecundario ? labelsPautaSec.trabalho : labelsPautaSup.trabalho,
    }),
    [isSecundario, labelsPautaSec, labelsPautaSup],
  );

  // Mesma fonte que NotasTab: partilha cache React Query e evita turmas/ids diferentes entre separadores
  const { data: turmas = [], isLoading: turmasLoading } = useQuery({
    queryKey: ['admin-turmas', instituicaoId, user?.id, role],
    queryFn: async () => {
      if (isProfessor) {
        const data = await turmasApi.getTurmasProfessor({ incluirPendentes: true });
        return turmasListFromApiResponse(data?.turmas ?? data) as any[];
      }
      const data = await turmasApi.getAll();
      return turmasListFromApiResponse(data) as any[];
    },
    enabled: isProfessor ? true : !!instituicaoId,
  });

  /** Ano civil do registo AnoLetivo selecionado (para filtro tolerante a FK duplicada / legado) */
  const selectedAnoLetivoAno = useMemo(() => {
    if (selectedAnoLetivo === 'todos') return null;
    const al = anosLetivos.find((x: any) => String(x.id) === String(selectedAnoLetivo));
    return al?.ano != null && al.ano !== '' ? Number(al.ano) : null;
  }, [selectedAnoLetivo, anosLetivos]);

  const filteredTurmas = useMemo(() => {
    return turmas.filter((turma: any) => {
      let match = true;
      if (selectedTurno !== 'todos') {
        const turnoNome = getTurnoNomeTurma(turma);
        if (!turmaMatchesTurnoFilter(turnoNome, selectedTurno)) match = false;
      }
      if (selectedAnoLetivo !== 'todos') {
        const fk =
          turma.anoLetivoId ??
          (turma as { ano_letivo_id?: string }).ano_letivo_id ??
          '';
        const refId = turma.anoLetivoRef?.id;
        const matchByFk =
          String(fk) === String(selectedAnoLetivo) ||
          (refId != null && String(refId) === String(selectedAnoLetivo));
        const anoTurma = parseTurmaAnoCivil(turma);
        const matchByYear =
          selectedAnoLetivoAno != null &&
          anoTurma != null &&
          anoTurma === selectedAnoLetivoAno;
        if (!matchByFk && !matchByYear) match = false;
      }
      // Secundário: semestre na turma não define período (trimestres); filtrar só no superior.
      if (
        !isSecundario &&
        selectedSemestre !== 'todos' &&
        String(turma.semestre ?? '') !== String(selectedSemestre)
      ) {
        match = false;
      }
      return match;
    });
  }, [turmas, selectedTurno, selectedAnoLetivo, selectedAnoLetivoAno, selectedSemestre, isSecundario]);

  useEffect(() => {
    if (!selectedTurma) return;
    // Radix Select devolve value em string; API pode trazer id numérico — evitar limpar seleção à toa
    if (!filteredTurmas.some((t: any) => getTurmaRowId(t) === String(selectedTurma))) {
      setSelectedTurma('');
    }
  }, [filteredTurmas, selectedTurma]);

  const selectedTurmaData = turmas.find((t: any) => getTurmaRowId(t) === String(selectedTurma));

  const { data: pautaData, isLoading: pautaLoading } = useQuery({
    queryKey: [
      'pauta-data',
      selectedTurma,
      isSecundario,
      thresholdsPauta.notaMinimaAprovacao,
      thresholdsPauta.notaMinRecurso,
      thresholdsPauta.permitirExameRecurso,
      pesosMTQueryKey,
      opSuperiorPauta.modeloPauta,
      opSuperiorPauta.pesoAc,
      opSuperiorPauta.pesoExame,
      opSuperiorPauta.acTipoCalculo,
      opSuperiorPauta.recursoModo,
    ],
    queryFn: async () => {
      if (!isValidTurmaSelection(selectedTurma)) return [];
      const matriculas = await fetchTodasMatriculasTurma(selectedTurma);

      if (matriculas.length === 0) return [];

      const notas = (await notasApi.getByTurma(selectedTurma)) || [];

      const alunosNotas: AlunoNota[] = matriculas.map((m: any) => {
        const alunoIdMat = m.alunoId ?? m.aluno?.id;
        const alunoNotasRaw = (notas || []).filter(
          (n: any) => (n.alunoId ?? n.aluno_id) === alunoIdMat
        );

        const alunoNotas = alunoNotasRaw.map((n: any) => {
          const tipoBruto =
            n.tipo ??
            n.avaliacao?.nome ??
            n.avaliacao?.tipo ??
            n.exame?.tipo ??
            n.exame?.nome ??
            '';
          const valorNum = n.valor != null && n.valor !== '' ? Number(n.valor) : NaN;
          return {
            ...n,
            tipo: normalizeProvaTipo(String(tipoBruto), isSecundario),
            valor: Number.isFinite(valorNum) ? valorNum : null,
            peso: n.peso != null ? Number(n.peso) : 1,
          };
        });

        const getNota = (tipo: string): number | null => {
          const nota = alunoNotas.find((n: any) => n.tipo === tipo);
          return nota ? nota.valor : null;
        };

        const getVSem = (tipoCanon: string): number | null => {
          const c = normTipoNotaPauta(tipoCanon);
          const hit = alunoNotasRaw.find((n: any) => {
            const tipoBruto =
              n.tipo ??
              n.avaliacao?.nome ??
              n.avaliacao?.tipo ??
              n.exame?.tipo ??
              n.exame?.nome ??
              '';
            return normTipoNotaPauta(String(tipoBruto)) === c;
          });
          if (!hit || hit.valor == null || hit.valor === '') return null;
          const v = Number(hit.valor);
          return Number.isFinite(v) ? v : null;
        };

        const emptyTrimestre: TrimestreNotas = { p1: null, p2: null, p3: null, recurso: null, trabalho: null, media: null };
        let trimestre1: TrimestreNotas = { ...emptyTrimestre };
        let trimestre2: TrimestreNotas = { ...emptyTrimestre };
        let trimestre3: TrimestreNotas = { ...emptyTrimestre };
        
        let nota1: number | null = null, nota2: number | null = null, nota3: number | null = null;
        let notaTrabalho: number | null = null, notaRecurso: number | null = null;

        const mtsSec = isSecundario ? obterMediasTrimestraisSecundario(getVSem, pesosMTSec) : null;

        if (isSecundario && mtsSec) {
          trimestre1 = {
            p1: getNota('1T-P1'),
            p2: getNota('1T-P2'),
            p3: getNota('1T-P3'),
            recurso: getNota('1T-Recurso'),
            trabalho: getNota('1T-Trabalho'),
            media:
              mtsSec.mt1 ??
              calcularMediaTrimestre(
                getNota('1T-P1'),
                getNota('1T-P2'),
                getNota('1T-P3'),
                getNota('1T-Recurso'),
                getNota('1T-Trabalho'),
              ),
          };
          trimestre2 = {
            p1: getNota('2T-P1'),
            p2: getNota('2T-P2'),
            p3: getNota('2T-P3'),
            recurso: getNota('2T-Recurso'),
            trabalho: getNota('2T-Trabalho'),
            media:
              mtsSec.mt2 ??
              calcularMediaTrimestre(
                getNota('2T-P1'),
                getNota('2T-P2'),
                getNota('2T-P3'),
                getNota('2T-Recurso'),
                getNota('2T-Trabalho'),
              ),
          };
          trimestre3 = {
            p1: getNota('3T-P1'),
            p2: getNota('3T-P2'),
            p3: getNota('3T-P3'),
            recurso: getNota('3T-Recurso'),
            trabalho: getNota('3T-Trabalho'),
            media:
              mtsSec.mt3 ??
              calcularMediaTrimestre(
                getNota('3T-P1'),
                getNota('3T-P2'),
                getNota('3T-P3'),
                getNota('3T-Recurso'),
                getNota('3T-Trabalho'),
              ),
          };

          nota1 = mtsSec.mt1;
          nota2 = mtsSec.mt2;
          nota3 = mtsSec.mt3;
          notaRecurso =
            getVSem('Recuperação') ??
            alunoNotas.find(
              (n: any) =>
                String(n.tipo).toUpperCase() === 'RECUPERACAO' || /^REC$/i.test(String(n.tipo)),
            )?.valor ??
            null;
        } else {
          nota1 = getNota('1ª Prova');
          nota2 = getNota('2ª Prova');
          nota3 = getNota('3ª Prova');
          notaTrabalho = getNota('Trabalho');
          notaRecurso = getNota('Exame de Recurso');
        }

        const temRecurso = notaRecurso !== null;
        const temTrabalho = isSecundario
          ? (trimestre1.trabalho !== null || trimestre2.trabalho !== null || trimestre3.trabalho !== null)
          : notaTrabalho !== null;

        const qtdProvas = isSecundario
          ? contarTrimestresComLancamentoSecundario(getVSem, mtsSec?.usaModeloAngola ?? false)
          : [nota1, nota2, nota3].filter((n) => n !== null).length;

        const provasCompletas = isSecundario
          ? mtsSec != null &&
            mtsSec.mt1 !== null &&
            mtsSec.mt2 !== null &&
            mtsSec.mt3 !== null
          : nota1 !== null && nota2 !== null && nota3 !== null;

        let media: number | null = null;
        let mediaFinal: number | null = null;

        if (isSecundario && mtsSec) {
          const ma =
            mtsSec.mt1 != null && mtsSec.mt2 != null && mtsSec.mt3 != null
              ? (mtsSec.mt1 + mtsSec.mt2 + mtsSec.mt3) / 3
              : null;
          media = ma !== null ? Math.round(ma * 100) / 100 : null;
          mediaFinal = calcularMediaFinalEnsinoMedio(
            mtsSec.mt1,
            mtsSec.mt2,
            mtsSec.mt3,
            notaRecurso,
            thresholdsPauta,
          );
          if (mediaFinal !== null) mediaFinal = Math.round(mediaFinal * 100) / 100;
        } else {
          mediaFinal = calcularMediaFinalUniversidade(
            nota1,
            nota2,
            nota3,
            notaTrabalho,
            notaRecurso,
            thresholdsPauta,
            opSuperiorPauta,
          );
          if (mediaFinal !== null) mediaFinal = Math.round(mediaFinal * 100) / 100;
          const mediasP = [nota1, nota2, nota3].filter((n): n is number => n !== null);
          media =
            mediasP.length > 0
              ? Math.round((mediasP.reduce((a, b) => a + b, 0) / mediasP.length) * 100) / 100
              : null;
        }

        let status = 'Sem Notas';
        if (qtdProvas > 0 && !provasCompletas) {
          status = 'Incompleto';
        } else if (qtdProvas > 0 && provasCompletas) {
          const mediaParaStatus = mediaFinal !== null ? mediaFinal : 0;
          if (mediaParaStatus >= thresholdsPauta.notaMinimaAprovacao) {
            status = 'Aprovado';
          } else if (
            thresholdsPauta.permitirExameRecurso &&
            mediaParaStatus >= thresholdsPauta.notaMinRecurso &&
            !temRecurso
          ) {
            status = isSecundario ? 'Recuperação' : 'Recurso';
          } else {
            status = 'Reprovado';
          }
        } else if (qtdProvas > 0) {
          status = 'Incompleto';
        }

        return {
          aluno_id: m.alunoId ?? m.aluno?.id ?? m.aluno_id,
          nome_completo: m.aluno?.nomeCompleto ?? m.profiles?.nome_completo ?? 'N/A',
          numero_identificacao_publica:
            m.aluno?.numeroIdentificacaoPublica ?? m.profiles?.numero_identificacao_publica ?? null,
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
    enabled: isValidTurmaSelection(selectedTurma),
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
          <CardTitle className="flex items-center gap-2" data-testid="admin-pautas-heading">
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
                    <SelectItem key={al.id} value={String(al.id)}>
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
              <p className="text-xs text-muted-foreground leading-snug">
                Refina apenas a lista de turmas abaixo. As matrículas vêm por <strong>turma</strong> (id); o turno não é parâmetro do servidor. Se não vir alunos, experimente <strong>Todos</strong> no turno.
              </p>
            </div>
            <div className="space-y-2">
              <Label>{labels.turma}</Label>
              <Select value={selectedTurma} onValueChange={setSelectedTurma}>
                <SelectTrigger data-testid="pautas-select-turma">
                  <SelectValue placeholder={`Selecione a ${labels.turma.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {filteredTurmas.map((turma: any, index: number) => {
                    const pk = getTurmaRowId(turma);
                    if (!pk) return null;
                    const anoEtiqueta =
                      turma.anoLetivoRef?.ano ?? turma.ano ?? null;
                    const sufixoAno = anoEtiqueta != null ? ` · ${anoEtiqueta}` : '';
                    const nomeTurno = getTurnoNomeTurma(turma);
                    const sufixoTurno = nomeTurno ? ` · ${nomeTurno}` : '';
                    return (
                    <SelectItem
                      key={pk}
                      value={pk}
                      data-testid={index === 0 ? 'pautas-turma-option-first' : undefined}
                    >
                      {turma.nome} - {turma.classe?.nome || turma.curso?.nome || ''}
                      {sufixoAno}
                      {sufixoTurno}
                    </SelectItem>
                    );
                  })}
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
                {selectedTurmaData?.nome} -{' '}
                {selectedTurmaData?.classe?.nome || selectedTurmaData?.curso?.nome || ''}
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
                pdfButtonTestId="pautas-export-pdf"
              />
            </div>
          </CardHeader>
          <CardContent>
            {pautaLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pautaParaRelatorio.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground space-y-2">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum estudante matriculado nesta turma</p>
                <p className="text-sm max-w-md mx-auto">
                  Confirme em Estudantes → Matrículas em turmas que os alunos estão nesta mesma turma (mesmo ano letivo).
                  Se houver várias turmas com o mesmo nome, use o ano indicado ao lado do nome na lista.
                </p>
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
