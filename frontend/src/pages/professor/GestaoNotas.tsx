import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { turmasApi, matriculasApi, notasApi, profilesApi, examesApi, parametrosSistemaApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { BookOpen, Loader2, Save, Calculator, Users, AlertCircle, CheckCircle2, School, GraduationCap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { safeToFixed } from '@/lib/utils';
import {
  NOTA_MAXIMA_PADRAO,
  NOTA_MINIMA_ZONA_RECURSO_PADRAO,
  TIPOS_SECUNDARIO_LANCAMENTO_ANGOLA,
  TIPOS_SECUNDARIO_MERGE_KEYS,
  calcularNota3ProvaFinal,
  calcularMediaFinalEnsinoMedio,
  calcularMediaFinalUniversidade,
  buildOpcoesCalculoSuperiorPautaFromParametros,
  obterMediasTrimestraisSecundario,
  contarTrimestresComLancamentoSecundario,
  tiposComponenteTrimestre,
  type GestaoNotasThresholds,
} from '@/utils/gestaoNotasCalculo';
import {
  mergePautaLabelsSuperior,
  mergePautaLabelsSecundario,
  labelColunaSuperior,
  labelColunaSecundarioTipoCompleto,
  labelExtraSecundario,
  buildPesosMTSecundarioFromParametros,
} from '@/utils/pautaLabelsConfig';

// Tipos de avaliação para UNIVERSIDADE
const TIPOS_AVALIACAO_PROVAS_UNI = ['1ª Prova', '2ª Prova', '3ª Prova'] as const;
const TIPOS_AVALIACAO_EXTRAS_UNI = ['Trabalho', 'Exame de Recurso'] as const;

// Secundário: mini-pauta (MAC, NPP, NPT por trimestre) — alinhado ao II Ciclo / modelo institucional AO
const TIPOS_AVALIACAO_EXTRAS_EM = ['Prova Final', 'Recuperação'] as const;

interface NotaInput {
  matricula_id: string;
  tipo: string;
  valor: string;
  id?: string;
}

interface AlunoGrade {
  matricula_id: string;
  aluno_id: string;
  nome_completo: string;
  notas: { [tipo: string]: { valor: number; id: string } | null };
  media: number | null;
  mediaFinal: number | null;
  nota3ProvaFinal: number | null;
  status: string;
  temRecurso: boolean;
  temTrabalho: boolean;
  /** Médias trimestrais (MT) quando secundário — Angola ou legado */
  mt1?: number | null;
  mt2?: number | null;
  mt3?: number | null;
  usaModeloAngola?: boolean;
}

export default function GestaoNotas() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const { isSecundario, config } = useInstituicao();
  const queryClient = useQueryClient();
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [notasEditadas, setNotasEditadas] = useState<{ [key: string]: NotaInput }>({});
  const [salvando, setSalvando] = useState(false);
  const salvandoKeyRef = useRef<string | null>(null);

  const isProfessor = role === 'PROFESSOR';

  const { data: parametrosSistema } = useQuery({
    queryKey: ['parametros-sistema-gestao-notas', user?.id],
    queryFn: () => parametrosSistemaApi.get(),
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id,
  });

  const thresholds: GestaoNotasThresholds = useMemo(
    () => ({
      notaMinimaAprovacao: Number(parametrosSistema?.percentualMinimoAprovacao ?? 10),
      notaMinRecurso: Number(
        parametrosSistema?.notaMinimaZonaExameRecurso ?? NOTA_MINIMA_ZONA_RECURSO_PADRAO,
      ),
      permitirExameRecurso: parametrosSistema?.permitirExameRecurso ?? false,
    }),
    [parametrosSistema]
  );

  const labelsSup = useMemo(
    () => mergePautaLabelsSuperior(parametrosSistema?.pautaLabelsSuperior),
    [parametrosSistema?.pautaLabelsSuperior],
  );
  const labelsSec = useMemo(
    () => mergePautaLabelsSecundario(parametrosSistema?.pautaLabelsSecundario),
    [parametrosSistema?.pautaLabelsSecundario],
  );
  const pesosMTSec = useMemo(
    () => buildPesosMTSecundarioFromParametros(parametrosSistema),
    [parametrosSistema],
  );

  const opSuperiorPauta = useMemo(
    () => buildOpcoesCalculoSuperiorPautaFromParametros(parametrosSistema as Record<string, unknown> | undefined),
    [parametrosSistema],
  );

  // Parser: valor do select pode ser "turmaId" ou "turmaId|planoEnsinoId" (contexto turma+disciplina único)
  const parseSelectedTurma = (value: string): { turmaId: string; planoEnsinoId?: string } => {
    if (!value) return { turmaId: '' };
    if (value.includes('|')) {
      const [tid, pid] = value.split('|');
      return { turmaId: tid || '', planoEnsinoId: pid || undefined };
    }
    return { turmaId: value };
  };

  const parsed = parseSelectedTurma(selectedTurma);
  const selectedTurmaId = parsed.turmaId;

  // Tipos de avaliação baseados no tipo acadêmico
  const TIPOS_AVALIACAO_PROVAS = isSecundario ? TIPOS_SECUNDARIO_LANCAMENTO_ANGOLA : [...TIPOS_AVALIACAO_PROVAS_UNI];
  const TIPOS_MERGE_PROVAS_SEC = TIPOS_SECUNDARIO_MERGE_KEYS;
  const TIPOS_AVALIACAO_EXTRAS = isSecundario ? TIPOS_AVALIACAO_EXTRAS_EM : TIPOS_AVALIACAO_EXTRAS_UNI;

  const labels = useMemo(
    () => ({
      provasTab: isSecundario
        ? `${labelsSec.trimI}, ${labelsSec.trimII} e ${labelsSec.trimIII}`
        : 'Provas Principais',
      extrasTab: isSecundario ? 'Final e Recuperação' : 'Trabalhos e Recursos',
      nota3Label: isSecundario ? `${labelsSec.mt} (${labelsSec.trimIII})` : `${labelsSup.prova3} (final)`,
      recursoLabel: isSecundario ? labelsSec.recuperacao : labelsSup.exameRecurso,
      semestreLabel: isSecundario ? 'Ano Letivo' : 'Semestre',
      mfdTitulo: 'MFD',
      mfdHint: `Média final da disciplina (${labelsSec.mt} I + II + III) / 3, antes da ${labelsSec.recuperacao.toLowerCase()}`,
    }),
    [isSecundario, labelsSec, labelsSup],
  );

  // Fetch turmas (classes) for professor
  // REGRA ABSOLUTA: Usar GET /turmas/professor SEM enviar professorId, instituicaoId ou anoLetivoId
  // O backend extrai professorId, instituicaoId e tipoAcademico automaticamente do JWT (req.user)
  // IMPORTANTE: Filtrar disciplinas sem turma - ações pedagógicas só podem ser executadas com turmas
  const { data: turmasData, isLoading: turmasLoading } = useQuery({
    queryKey: ['professor-turmas', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return { anoLetivo: null, turmas: [], disciplinasSemTurma: [] };
      }
      
      // REGRA ABSOLUTA: NÃO enviar professorId - o backend extrai do JWT
      // Usar método específico getTurmasProfessor que não aceita IDs sensíveis
      const data = await turmasApi.getTurmasProfessor({ incluirPendentes: true });
      
      // Backend retorna formato padronizado { anoLetivo, turmas: [], disciplinasSemTurma: [] }
      return data || { anoLetivo: null, turmas: [], disciplinasSemTurma: [] };
    },
    enabled: !!user?.id
  });

  // Filtrar apenas turmas (excluir disciplinas sem turma)
  // REGRA: Ações pedagógicas (notas, avaliações) só podem ser executadas com turmas vinculadas
  // REGRA ABSOLUTA: Backend já retorna turmas e disciplinasSemTurma separados
  const turmas = useMemo(() => {
    if (!turmasData) return [];
    return turmasData.turmas || [];
  }, [turmasData]);

  const getTurmaOptionValue = (t: any) =>
    t.planoEnsinoId ? `${t.turmaId || t.id}|${t.planoEnsinoId}` : (t.turmaId || t.id);
  const selectedPlanoEnsinoId = useMemo(() => {
    if (parsed.planoEnsinoId) return parsed.planoEnsinoId;
    const row = turmas.find((t: any) => getTurmaOptionValue(t) === selectedTurma);
    return row?.planoEnsinoId;
  }, [selectedTurma, turmas, parsed.planoEnsinoId]);

  // Fetch alunos e notas para a turma selecionada (turmaId; backend filtra por plano do professor)
  const pesosMTQueryKey =
    pesosMTSec == null
      ? 'mt-eq'
      : `${pesosMTSec.mac.toFixed(4)}-${pesosMTSec.npp.toFixed(4)}-${pesosMTSec.npt.toFixed(4)}`;

  const { data: gradeData, isLoading: gradeLoading, refetch: refetchGrade } = useQuery({
    queryKey: [
      'professor-grade-notas',
      selectedTurmaId,
      selectedPlanoEnsinoId,
      isSecundario,
      thresholds.notaMinimaAprovacao,
      thresholds.notaMinRecurso,
      thresholds.permitirExameRecurso,
      pesosMTQueryKey,
      opSuperiorPauta.modeloPauta,
      opSuperiorPauta.pesoAc,
      opSuperiorPauta.pesoExame,
      opSuperiorPauta.acTipoCalculo,
      opSuperiorPauta.recursoModo,
    ],
    queryFn: async () => {
      const res = await notasApi.getAlunosNotasByTurma(selectedTurmaId, selectedPlanoEnsinoId);
      const pautaStatus = res?.pautaStatus ?? null;
      const alunosData = Array.isArray(res) ? res : (res?.alunos ?? []);
      
      if (!alunosData || alunosData.length === 0) return { alunos: [], pautaStatus: null };

      const alunosGrade: AlunoGrade[] = alunosData.map((aluno: any) => {
        // Notas já vêm organizadas por tipo do backend
        const notasPorTipo = aluno.notas || {};

        let nota1: number | null, nota2: number | null, nota3: number | null;
        let notaTrabalho: number | null, notaRecurso: number | null;
        let usaModeloAngola = false;

        if (isSecundario) {
          const getV = (tipo: string) => notasPorTipo[tipo]?.valor ?? null;
          const mts = obterMediasTrimestraisSecundario(getV, pesosMTSec);
          nota1 = mts.mt1;
          nota2 = mts.mt2;
          nota3 = mts.mt3;
          usaModeloAngola = mts.usaModeloAngola;
          notaTrabalho = notasPorTipo['Prova Final']?.valor ?? null;
          notaRecurso = notasPorTipo['Recuperação']?.valor ?? null;
        } else {
          nota1 = notasPorTipo['1ª Prova']?.valor ?? null;
          nota2 = notasPorTipo['2ª Prova']?.valor ?? null;
          nota3 = notasPorTipo['3ª Prova']?.valor ?? null;
          notaTrabalho = notasPorTipo['Trabalho']?.valor ?? null;
          notaRecurso = notasPorTipo['Exame de Recurso']?.valor ?? null;
        }

        const temRecurso = notaRecurso !== null;
        const temTrabalho = notaTrabalho !== null;

        // Calcular nota final da 3ª prova considerando trabalho (para Universidade)
        // NOTA: Recurso não substitui a 3ª prova, ele é aplicado na média final
        const nota3Final = isSecundario 
          ? nota3 // Secundário: MT do 3º trimestre (Angola ou legado)
          : calcularNota3ProvaFinal(nota3, notaTrabalho);

        const qtdProvas = isSecundario
          ? contarTrimestresComLancamentoSecundario(
              (tipo) => notasPorTipo[tipo]?.valor ?? null,
              usaModeloAngola,
            )
          : [nota1, nota2, nota3].filter((n) => n !== null).length;
        const provasCompletasSec = nota1 !== null && nota2 !== null && nota3 !== null;
        const provasCompletasUni = nota1 !== null && nota2 !== null && (nota3 !== null || temRecurso);
        const provasCompletas = isSecundario ? provasCompletasSec : provasCompletasUni;

        // Calcular médias finais: preferir servidor quando disponível (cálculo seguro)
        const mediaFinalLocal = isSecundario
          ? calcularMediaFinalEnsinoMedio(nota1, nota2, nota3, notaRecurso, thresholds)
          : calcularMediaFinalUniversidade(
              nota1,
              nota2,
              nota3,
              notaTrabalho,
              notaRecurso,
              thresholds,
              opSuperiorPauta,
            );
        const mediaFinal = aluno.mediaFinal != null ? aluno.mediaFinal : (mediaFinalLocal !== null ? Math.round(mediaFinalLocal * 100) / 100 : null);

        const mediaSimplesOriginal = [nota1, nota2, nota3].filter((n): n is number => n !== null);
        const mediaLocal = mediaSimplesOriginal.length > 0 
          ? mediaSimplesOriginal.reduce((a, b) => a + b, 0) / mediaSimplesOriginal.length 
          : null;
        // Preferir média do servidor quando disponível (cálculo seguro)
        const media = aluno.media != null ? aluno.media : (mediaLocal !== null ? Math.round(mediaLocal * 100) / 100 : null);

        // Determinar status (secundário: ano só fechado com os 3 trimestres; recurso não substitui T3)
        let status = 'Sem Notas';
        if (qtdProvas > 0 && !provasCompletas) {
          status = 'Incompleto';
        } else if (provasCompletas) {
          const mediaParaStatus = mediaFinal !== null ? Math.round(mediaFinal * 100) / 100 : 0;
          if (mediaParaStatus >= thresholds.notaMinimaAprovacao) {
            status = 'Aprovado';
          } else if (
            thresholds.permitirExameRecurso &&
            mediaParaStatus >= thresholds.notaMinRecurso &&
            !temRecurso
          ) {
            status = isSecundario ? 'Recuperação' : 'Recurso';
          } else {
            status = 'Reprovado';
          }
        }

        return {
          matricula_id: aluno.matricula_id,
          aluno_id: aluno.aluno_id,
          nome_completo: aluno.nome_completo || 'N/A',
          notas: notasPorTipo,
          media,
          mediaFinal,
          nota3ProvaFinal: nota3Final !== null ? Math.round(nota3Final * 100) / 100 : null,
          status,
          temRecurso,
          temTrabalho,
          ...(isSecundario && {
            mt1: nota1,
            mt2: nota2,
            mt3: nota3,
            usaModeloAngola,
          }),
        };
      });

      return {
        alunos: alunosGrade.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo)),
        pautaStatus,
      };
    },
    enabled: !!selectedTurmaId
  });

  const alunosGrade = gradeData?.alunos ?? [];
  const pautaStatus = gradeData?.pautaStatus ?? null;
  const pautaBloqueiaEdicao = pautaStatus === 'FECHADA' || pautaStatus === 'APROVADA';

  // Normalizar tipo para comparação (º vs ° e trim)
  const normalizarTipo = (t: string) => (t || '').trim().replace(/°/g, 'º');

  // Mutation para salvar notas em lote
  const salvarNotasMutation = useMutation({
    mutationFn: async (notas: NotaInput[]) => {
      const res = await notasApi.getAlunosNotasByTurma(selectedTurmaId, selectedPlanoEnsinoId);
      const alunosData = Array.isArray(res) ? res : (res?.alunos ?? []);
      const pautaStatusMut = Array.isArray(res) ? null : (res?.pautaStatus ?? null);
      if (pautaStatusMut === 'FECHADA' || pautaStatusMut === 'APROVADA') {
        throw new Error('Não é possível salvar notas. A pauta está fechada ou aprovada. O histórico acadêmico é imutável após fechamento.');
      }
      const alunoMap = new Map<string, string>();
      alunosData.forEach((a: any) => {
        const matriculaId = a.matricula_id ?? a.matriculaId;
        const alunoId = a.aluno_id ?? a.alunoId;
        if (matriculaId && alunoId) alunoMap.set(String(matriculaId), alunoId);
      });
      if (alunoMap.size === 0) {
        throw new Error('Nenhum aluno encontrado nesta turma. Verifique se a turma e o ano letivo estão corretos e tente novamente.');
      }

      // Exames por turma + plano do professor (cada disciplina tem os seus 1º/2º/3º Trim, etc.)
      const tipos = [...new Set(notas.map(n => n.tipo))];
      const examesRaw = await examesApi.getAll({
        turmaId: selectedTurmaId,
        ...(selectedPlanoEnsinoId && { planoEnsinoId: selectedPlanoEnsinoId }),
      });
      const exames = Array.isArray(examesRaw) ? examesRaw : [];
      const exameMap = new Map<string, string>();

      for (const tipo of tipos) {
        const tipoNorm = normalizarTipo(tipo);
        const turmaOk = (e: any) => (e.turmaId === selectedTurmaId || e.turma_id === selectedTurmaId);
        const tipoOk = (e: any) => {
          const eTipo = normalizarTipo(e.tipo ?? e.nome ?? '');
          return eTipo === tipoNorm || e.tipo === tipo || e.nome === tipo;
        };
        // CRÍTICO: usar exame do plano da disciplina selecionada, senão a nota é gravada noutro plano e não aparece no painel
        // Com planoEnsinoId: NUNCA usar exame de outro plano (fallback) - senão getAlunosNotasByTurma não retorna a nota
        let exame = selectedPlanoEnsinoId
          ? exames.find((e: any) => turmaOk(e) && tipoOk(e) && (e.planoEnsinoId === selectedPlanoEnsinoId || e.plano_ensino_id === selectedPlanoEnsinoId))
          : exames.find((e: any) => turmaOk(e) && tipoOk(e));

        if (!exame) {
          const hoje = new Date();
          exame = await examesApi.create({
            nome: tipo,
            turmaId: selectedTurmaId,
            dataExame: hoje.toISOString(),
            tipo: tipo,
            peso: 1,
            status: 'agendado',
            ...(selectedPlanoEnsinoId && { planoEnsinoId: selectedPlanoEnsinoId }),
          });
        }
        const exameId = (exame as any).id ?? (exame as any).exame_id;
        if (exameId) {
          exameMap.set(tipo, exameId);
          exameMap.set(tipoNorm, exameId);
        }
      }

      // Preparar notas para inserção/atualização
      const notasParaSalvar: any[] = [];
      const notasParaAtualizar: any[] = [];

      notas.forEach(nota => {
        const valor = parseFloat(String(nota.valor).replace(',', '.'));
        if (isNaN(valor) || valor < 0 || valor > NOTA_MAXIMA_PADRAO) return;

        const matriculaKey = nota.matricula_id ?? (nota as any).matriculaId;
        const alunoId = matriculaKey ? alunoMap.get(String(matriculaKey)) : undefined;
        const exameId = exameMap.get(nota.tipo) ?? exameMap.get(normalizarTipo(nota.tipo));

        if (!alunoId || !exameId) {
          console.error('[GestaoNotas] Dados incompletos para nota:', {
            matricula_id: nota.matricula_id,
            tipo: nota.tipo,
            alunoId,
            exameId,
            alunoMapKeys: [...alunoMap.keys()].slice(0, 5),
            exameMapKeys: [...exameMap.keys()],
          });
          return;
        }

        // Se a nota já tem ID, é uma atualização
        if (nota.id) {
          notasParaAtualizar.push({
            id: nota.id,
            valor: Math.round(valor * 10) / 10,
            // Não incluir observacoes se for undefined
            ...(nota.observacoes !== undefined && { observacoes: nota.observacoes })
          });
        } else {
          // Validar novamente antes de adicionar (segurança extra)
          if (!alunoId || !exameId) {
            console.error(`Nota ignorada: alunoId=${alunoId}, exameId=${exameId}, tipo=${nota.tipo}`);
            return;
          }
          
          notasParaSalvar.push({
            alunoId,
            exameId,
            valor: Math.round(valor * 10) / 10,
            // Não incluir observacoes se for undefined
            ...(nota.observacoes !== undefined && { observacoes: nota.observacoes })
          });
        }
      });

      let inserted = 0;
      let updated = 0;

      // Validar notas antes de enviar
      const notasValidas = notasParaSalvar.filter(nota => {
        // Validar alunoId
        if (!nota.alunoId || typeof nota.alunoId !== 'string' || nota.alunoId.trim() === '') {
          console.error('Nota inválida ignorada - alunoId ausente ou inválido:', nota);
          return false;
        }
        
        // Validar exameId
        if (!nota.exameId || typeof nota.exameId !== 'string' || nota.exameId.trim() === '') {
          console.error('Nota inválida ignorada - exameId ausente ou inválido:', nota);
          return false;
        }
        
        // Validar valor
        if (nota.valor === undefined || nota.valor === null) {
          console.error('Nota com valor ausente ignorada:', nota);
          return false;
        }
        
        const valorNumerico = typeof nota.valor === 'number' ? nota.valor : parseFloat(String(nota.valor));
        if (isNaN(valorNumerico)) {
          console.error('Nota com valor não numérico ignorada:', nota);
          return false;
        }
        
        if (valorNumerico < 0 || valorNumerico > 20) {
          console.error('Nota com valor fora do range (0-20) ignorada:', nota);
          return false;
        }
        
        return true;
      });
      
      // Se não há notas válidas após validação, retornar erro
      if (notasParaSalvar.length > 0 && notasValidas.length === 0) {
        throw new Error('Nenhuma nota válida para salvar. Verifique se todos os campos obrigatórios estão preenchidos corretamente.');
      }

      // Salvar novas notas em lote
      if (notasValidas.length > 0) {
        try {
          // Validar novamente antes de enviar - garantir que todos os campos obrigatórios estão presentes
          const notasFinais = notasValidas.map(nota => {
            // Garantir que valor é um número válido
            const valorNumerico = typeof nota.valor === 'number' ? nota.valor : parseFloat(nota.valor);
            
            // Validar valor
            if (isNaN(valorNumerico) || valorNumerico < 0 || valorNumerico > 20) {
              throw new Error(`Valor da nota inválido: ${nota.valor}. Deve estar entre 0 e 20.`);
            }
            
            // Retornar apenas os campos necessários (garantir que alunoId e exameId estão definidos)
            return {
              alunoId: String(nota.alunoId),
              exameId: String(nota.exameId),
              valor: Math.round(valorNumerico * 10) / 10, // Arredondar para 1 casa decimal
              ...(nota.observacoes && { observacoes: nota.observacoes })
            };
          });

          // Garantir que nenhuma nota vai com dados em falta (evita payload [{}])
          const comFalta = notasFinais.find(n => !n.alunoId || !n.exameId);
          if (comFalta) {
            console.error('[GestaoNotas] Nota sem alunoId ou exameId antes de enviar:', comFalta);
            throw new Error(
              'Não foi possível associar a nota ao aluno ou à avaliação. Verifique se a turma e o ano letivo estão corretos e tente novamente.'
            );
          }

          // Log para debug
          console.log('[GestaoNotas] Enviando notas para o backend:', {
            quantidade: notasFinais.length,
            notas: notasFinais.map(n => ({ alunoId: n.alunoId, exameId: n.exameId, valor: n.valor }))
          });

          const result = await notasApi.createBatch(notasFinais);
          inserted = notasFinais.length;
        } catch (error: any) {
          console.error('Erro ao salvar notas em lote:', error);
          console.error('Notas que falharam:', notasValidas);
          
          let errorMessage = 'Erro ao salvar notas';
          if (error.response?.status === 401) {
            errorMessage = 'Sessão expirada. Faça login novamente e tente novamente.';
          } else if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          throw new Error(errorMessage);
        }
      }

      // Atualizar notas existentes
      if (notasParaAtualizar.length > 0) {
        await Promise.all(
          notasParaAtualizar.map(nota => {
            const updateData: any = { valor: nota.valor };
            if (nota.observacoes !== undefined) {
              updateData.observacoes = nota.observacoes;
            }
            return notasApi.update(nota.id, updateData);
          })
        );
        updated = notasParaAtualizar.length;
      }

      return { 
        inserted, 
        updated, 
        notificacoes: []
      };
    },
    onSuccess: async (result) => {
      setNotasEditadas({});
      queryClient.invalidateQueries({ queryKey: ['professor-grade-notas'] });
      await refetchGrade();
      toast.success(`Notas salvas! ${result.inserted} inseridas, ${result.updated} atualizadas.`);
    },
    onError: (error: any) => {
      // Extrair mensagem de erro mais específica
      let errorMessage = 'Erro desconhecido ao salvar notas';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Log detalhado para debug
      console.error('Erro ao salvar notas:', {
        message: errorMessage,
        status: error.response?.status,
        data: error.response?.data,
        fullError: error
      });
      
      toast.error('Erro ao salvar notas: ' + errorMessage);
    }
  });

  const handleNotaChange = (matriculaId: string, tipo: string, valor: string, notaId?: string) => {
    const key = `${matriculaId}-${tipo}`;
    setNotasEditadas(prev => ({
      ...prev,
      [key]: { matricula_id: matriculaId, tipo, valor, id: notaId }
    }));
  };

  const handleNotaKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, aluno: AlunoGrade, tipo: string) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const key = `${aluno.matricula_id}-${tipo}`;
    if (salvandoKeyRef.current === key || salvando) return; // Proteger contra double-save

    const notaEditada = notasEditadas[key];
    if (!notaEditada || notaEditada.valor.trim() === '') return;

    const valorStr = notaEditada.valor.trim().replace(',', '.');
    const valor = parseFloat(valorStr);
    if (isNaN(valor) || valor < 0 || valor > NOTA_MAXIMA_PADRAO) {
      toast.error(`Nota inválida. Use valores entre 0 e ${NOTA_MAXIMA_PADRAO}.`);
      return;
    }

    // Evitar salvamento redundante: se valor igual ao já salvo, apenas limpar edição
    const valorSalvo = aluno.notas[tipo]?.valor ?? aluno.notas[normalizarTipo(tipo)]?.valor;
    if (valorSalvo != null && Math.abs(valor - valorSalvo) < 0.01) {
      setNotasEditadas(prev => { const n = { ...prev }; delete n[key]; return n; });
      return;
    }

    salvandoKeyRef.current = key;
    setSalvando(true);
    try {
      await salvarNotasMutation.mutateAsync([notaEditada]);
      setNotasEditadas(prev => {
        const novas = { ...prev };
        delete novas[key];
        return novas;
      });
      toast.success('Nota salva com sucesso!');
    } catch {
      // Erro já tratado no mutation
    } finally {
      salvandoKeyRef.current = null;
      setSalvando(false);
    }
  };

  const getNotaValue = (aluno: AlunoGrade, tipo: string): string => {
    const key = `${aluno.matricula_id}-${tipo}`;
    if (notasEditadas[key] !== undefined) {
      return notasEditadas[key].valor;
    }
    // Alinhar com backend: valor pode vir em tipo exato ou normalizado (º vs °)
    const valor = aluno.notas[tipo]?.valor ?? aluno.notas[normalizarTipo(tipo)]?.valor;
    return valor != null ? String(valor) : '';
  };

  const isNotaEditada = (matriculaId: string, tipo: string): boolean => {
    const key = `${matriculaId}-${tipo}`;
    return notasEditadas[key] !== undefined && notasEditadas[key].valor.trim() !== '';
  };

  const handleSalvarNotas = async () => {
    const notasParaSalvar = Object.values(notasEditadas).filter(n => n.valor.trim() !== '');
    
    if (notasParaSalvar.length === 0) {
      toast.info('Nenhuma nota para salvar');
      return;
    }

    const invalidas = notasParaSalvar.filter(n => {
      const valor = parseFloat(n.valor.replace(',', '.'));
      return isNaN(valor) || valor < 0 || valor > NOTA_MAXIMA_PADRAO;
    });

    if (invalidas.length > 0) {
      toast.error(`${invalidas.length} nota(s) inválida(s). Use valores entre 0 e ${NOTA_MAXIMA_PADRAO}.`);
      return;
    }

    setSalvando(true);
    try {
      await salvarNotasMutation.mutateAsync(notasParaSalvar);
    } finally {
      setSalvando(false);
    }
  };

  // Função auxiliar para obter valor numérico de uma nota (considerando edições)
  const getNotaNumerica = (aluno: AlunoGrade, tipo: string): number | null => {
    const key = `${aluno.matricula_id}-${tipo}`;
    if (notasEditadas[key] !== undefined && notasEditadas[key].valor.trim() !== '') {
      const valor = parseFloat(notasEditadas[key].valor.replace(',', '.'));
      return isNaN(valor) ? null : valor;
    }
    return aluno.notas[tipo]?.valor ?? null;
  };

  // Versão computada de gradeData com notas editadas aplicadas e cálculos atualizados
  const gradeDataComputed = useMemo(() => {
    if (!alunosGrade || alunosGrade.length === 0) return [];

    return alunosGrade.map(aluno => {
      // Aplicar notas editadas (secundário: MAC/NPP/NPT + legado; superior: provas + extras)
      const tiposProvasParaMerge = isSecundario ? TIPOS_MERGE_PROVAS_SEC : [...TIPOS_AVALIACAO_PROVAS_UNI];
      const notasAtualizadas: { [tipo: string]: { valor: number; id: string } | null } = {};
      [...tiposProvasParaMerge, ...TIPOS_AVALIACAO_EXTRAS].forEach(tipo => {
        const key = `${aluno.matricula_id}-${tipo}`;
        // Se há uma edição (mesmo que vazia), usar o valor editado
        if (notasEditadas[key] !== undefined) {
          const valorNumerico = getNotaNumerica(aluno, tipo);
          if (valorNumerico !== null) {
            notasAtualizadas[tipo] = {
              valor: valorNumerico,
              id: aluno.notas[tipo]?.id || notasEditadas[key]?.id || ''
            };
          } else {
            // Nota foi limpa - tratar como null
            notasAtualizadas[tipo] = null;
          }
        } else {
          // Sem edição, usar valor original
          notasAtualizadas[tipo] = aluno.notas[tipo];
        }
      });

      const alunoComNotas = { ...aluno, notas: notasAtualizadas };
      const getVLocal = (tipo: string) => getNotaNumerica(alunoComNotas, tipo);

      // Extrair valores numéricos (secundário: MT1–MT3 via Angola ou legado)
      let nota1: number | null, nota2: number | null, nota3: number | null;
      let notaTrabalho: number | null, notaRecurso: number | null;
      let usaModeloAngola = false;

      if (isSecundario) {
        const mts = obterMediasTrimestraisSecundario(getVLocal, pesosMTSec);
        nota1 = mts.mt1;
        nota2 = mts.mt2;
        nota3 = mts.mt3;
        usaModeloAngola = mts.usaModeloAngola;
        notaTrabalho = getNotaNumerica(alunoComNotas, 'Prova Final');
        notaRecurso = getNotaNumerica(alunoComNotas, 'Recuperação');
      } else {
        nota1 = getNotaNumerica(alunoComNotas, '1ª Prova');
        nota2 = getNotaNumerica(alunoComNotas, '2ª Prova');
        nota3 = getNotaNumerica(alunoComNotas, '3ª Prova');
        notaTrabalho = getNotaNumerica(alunoComNotas, 'Trabalho');
        notaRecurso = getNotaNumerica(alunoComNotas, 'Exame de Recurso');
      }

      const temRecurso = notaRecurso !== null;
      const temTrabalho = notaTrabalho !== null;

      // Calcular nota final da 3ª prova considerando trabalho (para Universidade)
      // NOTA: Recurso não substitui a 3ª prova, ele é aplicado na média final
      const nota3Final = isSecundario 
        ? nota3
        : calcularNota3ProvaFinal(nota3, notaTrabalho);

      const qtdProvas = isSecundario
        ? contarTrimestresComLancamentoSecundario(getVLocal, usaModeloAngola)
        : [nota1, nota2, nota3].filter((n) => n !== null).length;
      const provasCompletasSec = nota1 !== null && nota2 !== null && nota3 !== null;
      const provasCompletasUni = nota1 !== null && nota2 !== null && (nota3 !== null || temRecurso);
      const provasCompletas = isSecundario ? provasCompletasSec : provasCompletasUni;

      // Calcular médias finais com regras corretas de recurso/recuperação
      const mediaFinal = isSecundario
        ? calcularMediaFinalEnsinoMedio(nota1, nota2, nota3, notaRecurso, thresholds)
        : calcularMediaFinalUniversidade(
            nota1,
            nota2,
            nota3,
            notaTrabalho,
            notaRecurso,
            thresholds,
            opSuperiorPauta,
          );

      const mediaSimplesOriginal = [nota1, nota2, nota3].filter((n): n is number => n !== null);
      const media = mediaSimplesOriginal.length > 0 
        ? mediaSimplesOriginal.reduce((a, b) => a + b, 0) / mediaSimplesOriginal.length 
        : null;

      // Determinar status
      let status = 'Sem Notas';
      if (qtdProvas > 0 && !provasCompletas) {
        status = 'Incompleto';
      } else if (provasCompletas) {
        const mediaParaStatus = mediaFinal !== null ? Math.round(mediaFinal * 100) / 100 : 0;
        if (mediaParaStatus >= thresholds.notaMinimaAprovacao) {
          status = 'Aprovado';
        } else if (
          thresholds.permitirExameRecurso &&
          mediaParaStatus >= thresholds.notaMinRecurso &&
          !temRecurso
        ) {
          status = isSecundario ? 'Recuperação' : 'Recurso';
        } else {
          status = 'Reprovado';
        }
      }

      return {
        ...aluno,
        notas: notasAtualizadas,
        media: media !== null ? Math.round(media * 100) / 100 : null,
        mediaFinal: mediaFinal !== null ? Math.round(mediaFinal * 100) / 100 : null,
        nota3ProvaFinal: nota3Final !== null ? Math.round(nota3Final * 100) / 100 : null,
        status,
        temRecurso,
        temTrabalho,
        ...(isSecundario && {
          mt1: nota1,
          mt2: nota2,
          mt3: nota3,
          usaModeloAngola,
        }),
      };
    });
  }, [alunosGrade, notasEditadas, isSecundario, TIPOS_AVALIACAO_EXTRAS, thresholds, pesosMTSec, opSuperiorPauta]);

  // Estatísticas da turma (usando dados computados)
  const estatisticas = useMemo(() => {
    if (!gradeDataComputed || gradeDataComputed.length === 0) return null;

    const comNotas = gradeDataComputed.filter(a => a.mediaFinal !== null);
    const aprovados = gradeDataComputed.filter(a => a.status === 'Aprovado').length;
    const recurso = gradeDataComputed.filter(a => a.status === 'Recurso' || a.status === 'Recuperação').length;
    const reprovados = gradeDataComputed.filter(a => a.status === 'Reprovado').length;
    const incompletos = gradeDataComputed.filter(a => a.status === 'Incompleto').length;
    
    const mediaGeral = comNotas.length > 0
      ? comNotas.reduce((sum, a) => sum + (a.mediaFinal || 0), 0) / comNotas.length
      : 0;

    return {
      total: gradeDataComputed.length,
      aprovados,
      recurso,
      reprovados,
      incompletos,
      semNotas: gradeDataComputed.length - comNotas.length - incompletos,
      mediaGeral: safeToFixed(mediaGeral, 1),
      taxaAprovacao: gradeDataComputed.length > 0 ? safeToFixed((aprovados / gradeDataComputed.length) * 100, 0) : '0'
    };
  }, [gradeDataComputed]);

  const selectedTurmaData = turmas.find((t: any) => getTurmaOptionValue(t) === selectedTurma);
  const podeLancarNotas = (selectedTurmaData?.podeLancarNota ?? selectedTurmaData?.podeLancarNotas ?? true) && !pautaBloqueiaEdicao;
  const temAlteracoes = Object.keys(notasEditadas).length > 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aprovado':
        return <Badge className="bg-green-600 text-white">Aprovado</Badge>;
      case 'Recurso':
        return <Badge className="bg-amber-500 text-white">Recurso</Badge>;
      case 'Recuperação':
        return <Badge className="bg-amber-500 text-white">Recuperação</Badge>;
      case 'Reprovado':
        return <Badge variant="destructive">Reprovado</Badge>;
      case 'Incompleto':
        return <Badge variant="secondary">Incompleto</Badge>;
      default:
        return <Badge variant="outline">Sem Notas</Badge>;
    }
  };

  const tipoInstituicao = isSecundario ? 'Ensino Secundário' : 'Ensino Superior';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('pages.gestaoNotas')}</h1>
            <p
              className="text-muted-foreground flex items-center gap-2"
              data-testid="gestao-notas-modo"
            >
              {isSecundario ? <School className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
              Modo: {tipoInstituicao} • {isSecundario ? 'Trimestres' : 'Semestres'}
            </p>
          </div>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('pages.gestaoNotasFluxoTitulo')}</AlertTitle>
          <AlertDescription>{t('pages.gestaoNotasOrientacaoInstitucional')}</AlertDescription>
        </Alert>

        {/* Seleção de Turma - contexto do Plano de Ensino */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {isSecundario ? 'Classe' : 'Turma'} / Disciplina (do meu Plano de Ensino)
            </CardTitle>
            {turmasData?.anoLetivo && (
              <CardDescription>Ano letivo ativo: {turmasData.anoLetivo}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <Select value={selectedTurma} onValueChange={setSelectedTurma}>
              <SelectTrigger className="w-full md:w-[400px]" data-testid="professor-notas-select-turma">
                <SelectValue placeholder={`Selecione uma ${isSecundario ? 'classe' : 'turma'}`} />
              </SelectTrigger>
              <SelectContent>
                {turmasLoading ? (
                  <div className="p-4 flex justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : turmas.length === 0 ? (
                  <div className="p-4 text-center">
                    <div className="rounded-lg border border-dashed p-4 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="font-medium">Sem atribuições no Plano de Ensino</p>
                      <p className="text-sm mt-1">Entre em contacto com a direção para atribuir turmas/disciplinas ao seu plano.</p>
                    </div>
                  </div>
                ) : (
                  turmas.map((turma: any, index: number) => (
                    <SelectItem
                      key={getTurmaOptionValue(turma)}
                      value={getTurmaOptionValue(turma)}
                      data-testid={index === 0 ? 'turma-option-first' : undefined}
                    >
                      {turma.nome} - {turma.disciplinaNome || turma.disciplina?.nome}
                      {!(turma.podeLancarNota ?? turma.podeLancarNotas) && turma.motivoBloqueio ? ` — ${turma.motivoBloqueio}` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        {estatisticas && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total</span>
                </div>
                <p className="text-2xl font-bold">{estatisticas.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Aprovados</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{estatisticas.aprovados}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">{isSecundario ? 'Recuperação' : 'Recurso'}</span>
                </div>
                <p className="text-2xl font-bold text-amber-500">{estatisticas.recurso}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-muted-foreground">Reprovados</span>
                </div>
                <p className="text-2xl font-bold text-destructive">{estatisticas.reprovados}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Média Geral</span>
                </div>
                <p className="text-2xl font-bold text-primary">{estatisticas.mediaGeral}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-muted-foreground">% Aprovação</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{estatisticas.taxaAprovacao}%</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabela de Notas */}
        {selectedTurma && (
          <Card data-testid="gestao-notas-lancamento-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Lançamento de notas (plano + turma)
                    {pautaStatus && (
                      <Badge
                        variant={pautaBloqueiaEdicao ? 'destructive' : pautaStatus === 'SUBMETIDA' ? 'secondary' : 'outline'}
                        className="shrink-0"
                      >
                        {pautaStatus === 'RASCUNHO' && 'Pauta Aberta'}
                        {pautaStatus === 'SUBMETIDA' && 'Pauta Submetida'}
                        {pautaStatus === 'APROVADA' && 'Pauta Aprovada (bloqueada)'}
                        {pautaStatus === 'FECHADA' && 'Pauta Fechada (bloqueada)'}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {selectedTurmaData?.nome} - {selectedTurmaData?.disciplinaNome || selectedTurmaData?.disciplina?.nome || selectedTurmaData?.curso?.nome || selectedTurmaData?.cursos?.nome}
                    {!podeLancarNotas && selectedTurmaData?.motivoBloqueio && (
                      <span className="block text-amber-600 mt-1">{selectedTurmaData.motivoBloqueio}</span>
                    )}
                    {pautaBloqueiaEdicao && (
                      <span className="block text-destructive font-medium mt-1">
                        A pauta está {pautaStatus === 'FECHADA' ? 'fechada (definitiva)' : 'aprovada pelo conselho'}. Não é possível alterar notas. O histórico acadêmico é imutável após fechamento.
                      </span>
                    )}
                  </CardDescription>
                </div>
                {temAlteracoes && podeLancarNotas && (
                  <Button onClick={handleSalvarNotas} disabled={salvando || !podeLancarNotas} size="sm" className="gap-2" data-testid="salvar-todas-notas">
                    {salvando ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar Todas ({Object.keys(notasEditadas).length})
                  </Button>
                )}
              </div>
              {!podeLancarNotas && selectedTurmaData?.motivoBloqueio && !pautaBloqueiaEdicao && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Bloqueado</AlertTitle>
                  <AlertDescription>{selectedTurmaData.motivoBloqueio}</AlertDescription>
                </Alert>
              )}
              {pautaBloqueiaEdicao && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Pauta {pautaStatus === 'FECHADA' ? 'Fechada' : 'Aprovada'}</AlertTitle>
                  <AlertDescription>
                    Não é possível alterar notas. A pauta está {pautaStatus === 'FECHADA' ? 'fechada (definitiva)' : 'aprovada pelo conselho'}. O histórico acadêmico é imutável após fechamento.
                  </AlertDescription>
                </Alert>
              )}
              <Alert className="mt-4">
                <Calculator className="h-4 w-4" />
                <AlertTitle className="text-sm font-semibold">Regras de Cálculo</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  {isSecundario ? (
                    <>
                      <strong>Avaliação por trimestre:</strong>{' '}
                      <strong>
                        {labelsSec.trimI}, {labelsSec.trimII} e {labelsSec.trimIII}.
                      </strong>{' '}
                      Em cada um: <strong>{labelsSec.mac}</strong> (contínua), <strong>{labelsSec.npp}</strong> (prova docente),{' '}
                      <strong>{labelsSec.npt}</strong> (prova trimestral), <strong>{labelsSec.mt}</strong> com pesos configuráveis
                      na instituição (vazio = 0). Coluna <strong>MFD</strong>: média final = (
                      {labelsSec.mt} I + II + III) / 3; depois <strong>{labelsSec.recuperacao}</strong> se ativa nos parâmetros.
                    </>
                  ) : (
                    <>
                      <strong>Universidade:</strong> Média Parcial = (P1 + P2 + P3) / 3. 
                      Se houver Trabalho: Média Parcial = (Média Provas × 0.8) + (Trabalho × 0.2). 
                      Se média ≥ 7 e &lt; 10, pode fazer Exame de Recurso: Média Final = (Média Parcial + Recurso) / 2
                    </>
                  )}
                  <br />
                  <span className="text-muted-foreground mt-1 block">
                    💡 Dica: Pressione <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> após inserir uma nota para salvá-la automaticamente
                  </span>
                </AlertDescription>
              </Alert>
            </CardHeader>
            <CardContent>
              {gradeLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : gradeDataComputed && gradeDataComputed.length > 0 ? (
                <Tabs defaultValue="provas" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="provas">{labels.provasTab}</TabsTrigger>
                    <TabsTrigger value="extras">{labels.extrasTab}</TabsTrigger>
                    <TabsTrigger value="resumo">Resumo Final</TabsTrigger>
                  </TabsList>

                  <TabsContent value="provas">
                    <div className="overflow-x-auto">
                      {isSecundario ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead rowSpan={2} className="align-bottom min-w-[160px]">Aluno</TableHead>
                              {([1, 2, 3] as const).map((tr) => {
                                const tituloTrim =
                                  tr === 1 ? labelsSec.trimI : tr === 2 ? labelsSec.trimII : labelsSec.trimIII;
                                return (
                                  <TableHead key={tr} colSpan={4} className="text-center border-l bg-muted/30 text-sm">
                                    <span className="font-semibold">{tituloTrim}</span>
                                    <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                                      {labelsSec.mac} · {labelsSec.npp} · {labelsSec.npt} · {labelsSec.mt}
                                    </span>
                                  </TableHead>
                                );
                              })}
                              <TableHead
                                rowSpan={2}
                                className="text-center align-bottom border-l min-w-[88px]"
                                title={labels.mfdHint}
                              >
                                <span className="font-semibold">{labels.mfdTitulo}</span>
                                <span className="block text-[10px] font-normal text-muted-foreground leading-tight mt-1">
                                  média disciplina
                                </span>
                              </TableHead>
                            </TableRow>
                            <TableRow>
                              {([1, 2, 3] as const).flatMap((tr) => {
                                const [macK, nppK, nptK] = tiposComponenteTrimestre(tr);
                                return [
                                  <TableHead
                                    key={macK}
                                    className="text-center text-xs border-l w-[76px]"
                                    title={`${labelsSec.mac} — componente da mini-pauta`}
                                  >
                                    {labelsSec.mac}
                                  </TableHead>,
                                  <TableHead
                                    key={nppK}
                                    className="text-center text-xs w-[76px]"
                                    title={`${labelsSec.npp} — componente da mini-pauta`}
                                  >
                                    {labelsSec.npp}
                                  </TableHead>,
                                  <TableHead
                                    key={nptK}
                                    className="text-center text-xs w-[76px]"
                                    title={`${labelsSec.npt} — componente da mini-pauta`}
                                  >
                                    {labelsSec.npt}
                                  </TableHead>,
                                  <TableHead
                                    key={`mt-${tr}`}
                                    className="text-center text-xs font-semibold bg-muted/50 w-[64px]"
                                    title={`${labelsSec.mt} — média do trimestre (pesos configuráveis)`}
                                  >
                                    {labelsSec.mt}
                                  </TableHead>,
                                ];
                              })}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {gradeDataComputed.map((aluno) => {
                              const getV = (tipo: string) => getNotaNumerica(aluno, tipo);
                              const { mt1, mt2, mt3 } = obterMediasTrimestraisSecundario(getV, pesosMTSec);
                              const mts = [mt1, mt2, mt3];
                              return (
                                <TableRow key={aluno.matricula_id}>
                                  <TableCell className="font-medium">{aluno.nome_completo}</TableCell>
                                  {([1, 2, 3] as const).flatMap((tr) => {
                                    const [macK, nppK, nptK] = tiposComponenteTrimestre(tr);
                                    const mt = mts[tr - 1];
                                    return [
                                      macK,
                                      nppK,
                                      nptK,
                                    ].map((tipo) => {
                                      const editada = isNotaEditada(aluno.matricula_id, tipo);
                                      return (
                                        <TableCell key={tipo} className="text-center p-1 border-l">
                                          <div className="relative inline-block">
                                            <Input
                                              type="text"
                                              inputMode="decimal"
                                              value={getNotaValue(aluno, tipo)}
                                              onChange={(e) =>
                                                handleNotaChange(
                                                  aluno.matricula_id,
                                                  tipo,
                                                  e.target.value,
                                                  aluno.notas[tipo]?.id,
                                                )
                                              }
                                              onKeyDown={(e) => handleNotaKeyDown(e, aluno, tipo)}
                                              disabled={!podeLancarNotas}
                                              className={`w-[68px] h-8 text-center text-sm px-1 ${
                                                editada
                                                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300'
                                                  : ''
                                              }`}
                                              placeholder="0–20"
                                            />
                                            {editada && (
                                              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 bg-amber-500 rounded-full" />
                                            )}
                                          </div>
                                        </TableCell>
                                      );
                                    }).concat(
                                      <TableCell
                                        key={`mtc-${tr}`}
                                        className="text-center font-semibold bg-muted/40 border-l text-sm"
                                      >
                                        {mt != null ? safeToFixed(mt, 2) : '—'}
                                      </TableCell>,
                                    );
                                  })}
                                  <TableCell className="text-center font-bold border-l">
                                    {aluno.media !== null ? (
                                      <span className="px-2 py-1 rounded bg-primary/10 text-primary">
                                        {safeToFixed(aluno.media, 2)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[200px]">Aluno</TableHead>
                              {TIPOS_AVALIACAO_PROVAS.map((tipo) => (
                                <TableHead key={tipo} className="text-center min-w-[100px]">
                                  {isSecundario
                                    ? labelColunaSecundarioTipoCompleto(tipo, labelsSec)
                                    : labelColunaSuperior(tipo, labelsSup)}
                                </TableHead>
                              ))}
                              <TableHead className="text-center">Média</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {gradeDataComputed.map((aluno) => (
                              <TableRow key={aluno.matricula_id}>
                                <TableCell className="font-medium">{aluno.nome_completo}</TableCell>
                                {TIPOS_AVALIACAO_PROVAS.map((tipo) => {
                                  const editada = isNotaEditada(aluno.matricula_id, tipo);
                                  return (
                                    <TableCell key={tipo} className="text-center">
                                      <div className="relative inline-block">
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          value={getNotaValue(aluno, tipo)}
                                          onChange={(e) =>
                                            handleNotaChange(
                                              aluno.matricula_id,
                                              tipo,
                                              e.target.value,
                                              aluno.notas[tipo]?.id,
                                            )
                                          }
                                          onKeyDown={(e) => handleNotaKeyDown(e, aluno, tipo)}
                                          disabled={!podeLancarNotas}
                                          className={`w-20 text-center mx-auto focus:ring-2 focus:ring-primary transition-all ${
                                            editada
                                              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700'
                                              : ''
                                          }`}
                                          placeholder="0-20"
                                          title="Pressione Enter para salvar (validação automática)"
                                        />
                                        {editada && (
                                          <span className="absolute -top-1 -right-1 h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
                                        )}
                                      </div>
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center font-bold text-primary">
                                  {aluno.media !== null ? (
                                    <span className="px-2 py-1 rounded bg-primary/10">
                                      {safeToFixed(aluno.media, 1)}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="extras">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px]">Aluno</TableHead>
                            {TIPOS_AVALIACAO_EXTRAS.map((tipo) => (
                              <TableHead key={tipo} className="text-center min-w-[100px]">
                                {isSecundario ? labelExtraSecundario(tipo, labelsSec) : labelColunaSuperior(tipo, labelsSup)}
                              </TableHead>
                            ))}
                            <TableHead className="text-center">{labels.nota3Label}</TableHead>
                            <TableHead className="text-center">Média Final</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gradeDataComputed.map(aluno => (
                            <TableRow key={aluno.matricula_id}>
                              <TableCell className="font-medium">{aluno.nome_completo}</TableCell>
                              {TIPOS_AVALIACAO_EXTRAS.map(tipo => {
                                const editada = isNotaEditada(aluno.matricula_id, tipo);
                                return (
                                  <TableCell key={tipo} className="text-center">
                                    <div className="relative inline-block">
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={getNotaValue(aluno, tipo)}
                                        onChange={(e) => handleNotaChange(
                                          aluno.matricula_id, 
                                          tipo, 
                                          e.target.value,
                                          aluno.notas[tipo]?.id
                                        )}
                                        onKeyDown={(e) => handleNotaKeyDown(e, aluno, tipo)}
                                        disabled={!podeLancarNotas}
                                        className={`w-20 text-center mx-auto focus:ring-2 focus:ring-primary transition-all ${
                                          editada ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700' : ''
                                        }`}
                                        placeholder="0-20"
                                        title="Pressione Enter para salvar (validação automática)"
                                      />
                                      {editada && (
                                        <span className="absolute -top-1 -right-1 h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
                                      )}
                                    </div>
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-medium">
                                {aluno.nota3ProvaFinal !== null ? (
                                  <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400">
                                    {safeToFixed(aluno.nota3ProvaFinal, 1)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center font-bold">
                                {aluno.mediaFinal !== null ? (
                                  <span className={`px-2 py-1 rounded ${
                                    aluno.mediaFinal >= thresholds.notaMinimaAprovacao
                                      ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                      : thresholds.permitirExameRecurso &&
                                          aluno.mediaFinal >= thresholds.notaMinRecurso
                                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                      : 'bg-red-500/10 text-red-700 dark:text-red-400'
                                  }`}>
                                    {safeToFixed(aluno.mediaFinal, 1)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="resumo">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px]">Aluno</TableHead>
                            {isSecundario ? (
                              <>
                                <TableHead className="text-center text-xs">
                                  {labelsSec.mt} ({labelsSec.trimI})
                                </TableHead>
                                <TableHead className="text-center text-xs">
                                  {labelsSec.mt} ({labelsSec.trimII})
                                </TableHead>
                                <TableHead className="text-center text-xs">
                                  {labelsSec.mt} ({labelsSec.trimIII})
                                </TableHead>
                              </>
                            ) : (
                              TIPOS_AVALIACAO_PROVAS.map((tipo) => (
                                <TableHead key={tipo} className="text-center">
                                  {labelColunaSuperior(tipo, labelsSup)}
                                </TableHead>
                              ))
                            )}
                            <TableHead
                              className="text-center"
                              title={isSecundario ? labels.mfdHint : undefined}
                            >
                              {isSecundario ? labels.mfdTitulo : 'Média'}
                            </TableHead>
                            <TableHead className="text-center">{labels.recursoLabel}</TableHead>
                            <TableHead className="text-center">Média final</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gradeDataComputed.map(aluno => (
                            <TableRow key={aluno.matricula_id}>
                              <TableCell className="font-medium">{aluno.nome_completo}</TableCell>
                              {isSecundario ? (
                                <>
                                  <TableCell className="text-center">
                                    {aluno.mt1 != null ? safeToFixed(aluno.mt1, 2) : '—'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {aluno.mt2 != null ? safeToFixed(aluno.mt2, 2) : '—'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {aluno.mt3 != null ? safeToFixed(aluno.mt3, 2) : '—'}
                                  </TableCell>
                                </>
                              ) : (
                                TIPOS_AVALIACAO_PROVAS.map((tipo) => (
                                  <TableCell key={tipo} className="text-center">
                                    {aluno.notas[tipo]?.valor != null ? safeToFixed(aluno.notas[tipo].valor, 1) : '-'}
                                  </TableCell>
                                ))
                              )}
                              <TableCell className="text-center">
                                {aluno.media !== null ? (
                                  <span className="px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                                    {safeToFixed(aluno.media, 1)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {aluno.temRecurso ? 
                                  (isSecundario ? 
                                    safeToFixed(aluno.notas['Recuperação']?.valor, 1) : 
                                    safeToFixed(aluno.notas['Exame de Recurso']?.valor, 1)
                                  ) || '-' : '-'}
                              </TableCell>
                              <TableCell className="text-center font-bold">
                                {aluno.mediaFinal !== null ? (
                                  <span className={`px-2 py-1 rounded font-semibold ${
                                    aluno.mediaFinal >= thresholds.notaMinimaAprovacao
                                      ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                      : thresholds.permitirExameRecurso &&
                                          aluno.mediaFinal >= thresholds.notaMinRecurso
                                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                      : 'bg-red-500/10 text-red-700 dark:text-red-400'
                                  }`}>
                                    {safeToFixed(aluno.mediaFinal, 1)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {getStatusBadge(aluno.status)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Sem alunos</AlertTitle>
                  <AlertDescription>
                    Nenhum aluno matriculado nesta {isSecundario ? 'classe' : 'turma'}.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
