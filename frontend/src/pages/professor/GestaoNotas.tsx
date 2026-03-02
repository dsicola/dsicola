import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { turmasApi, matriculasApi, notasApi, profilesApi, examesApi } from '@/services/api';
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

// Tipos de avaliação para UNIVERSIDADE
const TIPOS_AVALIACAO_PROVAS_UNI = ['1ª Prova', '2ª Prova', '3ª Prova'] as const;
const TIPOS_AVALIACAO_EXTRAS_UNI = ['Trabalho', 'Exame de Recurso'] as const;

// Tipos de avaliação para ENSINO MÉDIO
const TIPOS_AVALIACAO_TRIMESTRES = ['1º Trimestre', '2º Trimestre', '3º Trimestre'] as const;
const TIPOS_AVALIACAO_EXTRAS_EM = ['Prova Final', 'Recuperação'] as const;

const NOTA_MINIMA_APROVACAO = 10;
const NOTA_RECURSO = 7;
const NOTA_MAXIMA = 20;

/**
 * Calcula a nota final da 3ª prova considerando trabalho (para Universidade)
 * NOTA: Recurso não substitui a 3ª prova, ele é aplicado na média final
 */
const calcularNota3ProvaFinal = (
  nota3Prova: number | null,
  notaTrabalho: number | null
): number | null => {
  // Se tem trabalho, calcula média entre 3ª prova e trabalho
  if (notaTrabalho !== null && nota3Prova !== null) {
    return (nota3Prova + notaTrabalho) / 2;
  }
  
  return nota3Prova;
};

/**
 * Calcula a média final para Ensino Médio
 * Regra: Média Anual = (MT1 + MT2 + MT3) / 3
 * Se média < 10 e >= 7, pode fazer recuperação: Nova média = (Média Anual + Recuperação) / 2
 */
const calcularMediaFinalEnsinoMedio = (
  nota1: number | null,
  nota2: number | null,
  nota3: number | null,
  notaRecuperacao: number | null
): number | null => {
  const notas = [nota1, nota2, nota3].filter((n): n is number => n !== null);
  if (notas.length === 0) return null;
  
  // Média anual = média dos 3 trimestres
  const mediaAnual = notas.reduce((a, b) => a + b, 0) / notas.length;
  
  // Se já está aprovado, retorna a média anual
  if (mediaAnual >= NOTA_MINIMA_APROVACAO) {
    return mediaAnual;
  }
  
  // Se tem recuperação e está em situação de recurso (7-9.9), calcula nova média
  if (notaRecuperacao !== null && mediaAnual >= NOTA_RECURSO && mediaAnual < NOTA_MINIMA_APROVACAO) {
    // Nova média = (Média Anual + Recuperação) / 2
    return (mediaAnual + notaRecuperacao) / 2;
  }
  
  return mediaAnual;
};

/**
 * Calcula a média final para Universidade
 * Regra: 
 * 1. Média das Provas = (P1 + P2 + P3) / 3
 * 2. Se tem trabalho: Média Parcial = (Média Provas * 0.8) + (Trabalho * 0.2)
 * 3. Se média parcial < 10 e >= 7, pode fazer exame de recurso
 * 4. Com recurso: Média Final = (Média Parcial + Exame de Recurso) / 2
 * IMPORTANTE: O trabalho é sempre considerado na média parcial antes de aplicar o recurso
 */
const calcularMediaFinalUniversidade = (
  nota1: number | null,
  nota2: number | null,
  nota3: number | null,
  notaTrabalho: number | null,
  notaRecurso: number | null
): number | null => {
  const notas = [nota1, nota2, nota3].filter((n): n is number => n !== null);
  if (notas.length === 0) return null;
  
  // Média das provas
  const mediaProvas = notas.reduce((a, b) => a + b, 0) / notas.length;
  
  // Média parcial: se tem trabalho, aplica peso 80% provas + 20% trabalho
  // Caso contrário, usa apenas a média das provas
  const mediaParcial = notaTrabalho !== null
    ? (mediaProvas * 0.8) + (notaTrabalho * 0.2)
    : mediaProvas;
  
  // Se já está aprovado (média parcial >= 10), retorna a média parcial
  if (mediaParcial >= NOTA_MINIMA_APROVACAO) {
    return mediaParcial;
  }
  
  // Se tem exame de recurso e está em situação de recurso (7 <= média < 10)
  // Calcula nova média: (Média Parcial + Exame de Recurso) / 2
  if (notaRecurso !== null && mediaParcial >= NOTA_RECURSO && mediaParcial < NOTA_MINIMA_APROVACAO) {
    return (mediaParcial + notaRecurso) / 2;
  }
  
  // Retorna a média parcial (pode ser < 7, caso reprovado)
  return mediaParcial;
};

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
  const TIPOS_AVALIACAO_PROVAS = isSecundario ? TIPOS_AVALIACAO_TRIMESTRES : TIPOS_AVALIACAO_PROVAS_UNI;
  const TIPOS_AVALIACAO_EXTRAS = isSecundario ? TIPOS_AVALIACAO_EXTRAS_EM : TIPOS_AVALIACAO_EXTRAS_UNI;

  // Labels adaptados
  const labels = {
    provasTab: isSecundario ? 'Trimestres' : 'Provas Principais',
    extrasTab: isSecundario ? 'Final e Recuperação' : 'Trabalhos e Recursos',
    nota3Label: isSecundario ? '3º Trim. Final' : '3ª P. Final',
    recursoLabel: isSecundario ? 'Recuperação' : 'Recurso',
    semestreLabel: isSecundario ? 'Ano Letivo' : 'Semestre',
  };

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
  const { data: gradeData, isLoading: gradeLoading, refetch: refetchGrade } = useQuery({
    queryKey: ['professor-grade-notas', selectedTurmaId, selectedPlanoEnsinoId, isSecundario],
    queryFn: async () => {
      const alunosData = await notasApi.getAlunosNotasByTurma(selectedTurmaId, selectedPlanoEnsinoId);
      
      if (!alunosData || alunosData.length === 0) return [];

      const alunosGrade: AlunoGrade[] = alunosData.map((aluno: any) => {
        // Notas já vêm organizadas por tipo do backend
        const notasPorTipo = aluno.notas || {};

        let nota1: number | null, nota2: number | null, nota3: number | null;
        let notaTrabalho: number | null, notaRecurso: number | null;

        if (isSecundario) {
          nota1 = notasPorTipo['1º Trimestre']?.valor ?? null;
          nota2 = notasPorTipo['2º Trimestre']?.valor ?? null;
          nota3 = notasPorTipo['3º Trimestre']?.valor ?? null;
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
          ? nota3 // Para Ensino Secundário, não modifica o 3º trimestre
          : calcularNota3ProvaFinal(nota3, notaTrabalho);

        const qtdProvas = [nota1, nota2, nota3].filter(n => n !== null).length;
        const provasCompletas = nota1 !== null && nota2 !== null && (nota3 !== null || temRecurso);

        // Calcular médias finais: preferir servidor quando disponível (cálculo seguro)
        const mediaFinalLocal = isSecundario
          ? calcularMediaFinalEnsinoMedio(nota1, nota2, nota3, notaRecurso)
          : calcularMediaFinalUniversidade(nota1, nota2, nota3, notaTrabalho, notaRecurso);
        const mediaFinal = aluno.mediaFinal != null ? aluno.mediaFinal : (mediaFinalLocal !== null ? Math.round(mediaFinalLocal * 100) / 100 : null);

        const mediaSimplesOriginal = [nota1, nota2, nota3].filter((n): n is number => n !== null);
        const mediaLocal = mediaSimplesOriginal.length > 0 
          ? mediaSimplesOriginal.reduce((a, b) => a + b, 0) / mediaSimplesOriginal.length 
          : null;
        // Preferir média do servidor quando disponível (cálculo seguro)
        const media = aluno.media != null ? aluno.media : (mediaLocal !== null ? Math.round(mediaLocal * 100) / 100 : null);

        // Determinar status
        let status = 'Sem Notas';
        if (qtdProvas > 0 && !provasCompletas && !temRecurso) {
          status = 'Incompleto';
        } else if (provasCompletas || temRecurso) {
          const mediaParaStatus = mediaFinal !== null ? Math.round(mediaFinal * 100) / 100 : 0;
          if (mediaParaStatus >= NOTA_MINIMA_APROVACAO) {
            status = 'Aprovado';
          } else if (mediaParaStatus >= NOTA_RECURSO && !temRecurso) {
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
          temTrabalho
        };
      });

      return alunosGrade.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    },
    enabled: !!selectedTurmaId
  });

  // Normalizar tipo para comparação (º vs ° e trim)
  const normalizarTipo = (t: string) => (t || '').trim().replace(/°/g, 'º');

  // Mutation para salvar notas em lote
  const salvarNotasMutation = useMutation({
    mutationFn: async (notas: NotaInput[]) => {
      const alunosData = await notasApi.getAlunosNotasByTurma(selectedTurmaId, selectedPlanoEnsinoId);
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
        if (isNaN(valor) || valor < 0 || valor > NOTA_MAXIMA) return;

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
    if (isNaN(valor) || valor < 0 || valor > NOTA_MAXIMA) {
      toast.error(`Nota inválida. Use valores entre 0 e ${NOTA_MAXIMA}.`);
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
      return isNaN(valor) || valor < 0 || valor > NOTA_MAXIMA;
    });

    if (invalidas.length > 0) {
      toast.error(`${invalidas.length} nota(s) inválida(s). Use valores entre 0 e ${NOTA_MAXIMA}.`);
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
    if (!gradeData || gradeData.length === 0) return [];

    return gradeData.map(aluno => {
      // Aplicar notas editadas
      const notasAtualizadas: { [tipo: string]: { valor: number; id: string } | null } = {};
      [...TIPOS_AVALIACAO_PROVAS, ...TIPOS_AVALIACAO_EXTRAS].forEach(tipo => {
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

      // Extrair valores numéricos
      let nota1: number | null, nota2: number | null, nota3: number | null;
      let notaTrabalho: number | null, notaRecurso: number | null;

      if (isSecundario) {
        nota1 = getNotaNumerica(aluno, '1º Trimestre');
        nota2 = getNotaNumerica(aluno, '2º Trimestre');
        nota3 = getNotaNumerica(aluno, '3º Trimestre');
        notaTrabalho = getNotaNumerica(aluno, 'Prova Final');
        notaRecurso = getNotaNumerica(aluno, 'Recuperação');
      } else {
        nota1 = getNotaNumerica(aluno, '1ª Prova');
        nota2 = getNotaNumerica(aluno, '2ª Prova');
        nota3 = getNotaNumerica(aluno, '3ª Prova');
        notaTrabalho = getNotaNumerica(aluno, 'Trabalho');
        notaRecurso = getNotaNumerica(aluno, 'Exame de Recurso');
      }

      const temRecurso = notaRecurso !== null;
      const temTrabalho = notaTrabalho !== null;

      // Calcular nota final da 3ª prova considerando trabalho (para Universidade)
      // NOTA: Recurso não substitui a 3ª prova, ele é aplicado na média final
      const nota3Final = isSecundario 
        ? nota3 // Para Ensino Secundário, não modifica o 3º trimestre
        : calcularNota3ProvaFinal(nota3, notaTrabalho);

      const qtdProvas = [nota1, nota2, nota3].filter(n => n !== null).length;
      const provasCompletas = nota1 !== null && nota2 !== null && (nota3 !== null || temRecurso);

      // Calcular médias finais com regras corretas de recurso/recuperação
      const mediaFinal = isSecundario
        ? calcularMediaFinalEnsinoMedio(nota1, nota2, nota3, notaRecurso)
        : calcularMediaFinalUniversidade(nota1, nota2, nota3, notaTrabalho, notaRecurso);

      const mediaSimplesOriginal = [nota1, nota2, nota3].filter((n): n is number => n !== null);
      const media = mediaSimplesOriginal.length > 0 
        ? mediaSimplesOriginal.reduce((a, b) => a + b, 0) / mediaSimplesOriginal.length 
        : null;

      // Determinar status
      let status = 'Sem Notas';
      if (qtdProvas > 0 && !provasCompletas && !temRecurso) {
        status = 'Incompleto';
      } else if (provasCompletas || temRecurso) {
        const mediaParaStatus = mediaFinal !== null ? Math.round(mediaFinal * 100) / 100 : 0;
        if (mediaParaStatus >= NOTA_MINIMA_APROVACAO) {
          status = 'Aprovado';
        } else if (mediaParaStatus >= NOTA_RECURSO && !temRecurso) {
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
        temTrabalho
      };
    });
  }, [gradeData, notasEditadas, isSecundario, TIPOS_AVALIACAO_PROVAS, TIPOS_AVALIACAO_EXTRAS]);

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
  const podeLancarNotas = selectedTurmaData?.podeLancarNota ?? selectedTurmaData?.podeLancarNotas ?? true;
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
            <p className="text-muted-foreground flex items-center gap-2">
              {isSecundario ? <School className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
              Modo: {tipoInstituicao} • {isSecundario ? 'Trimestres' : 'Semestres'}
            </p>
          </div>
        </div>

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
              <SelectTrigger className="w-full md:w-[400px]">
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Lançamento de Notas</CardTitle>
                  <CardDescription>
                    {selectedTurmaData?.nome} - {selectedTurmaData?.disciplinaNome || selectedTurmaData?.disciplina?.nome || selectedTurmaData?.curso?.nome || selectedTurmaData?.cursos?.nome}
                    {!podeLancarNotas && selectedTurmaData?.motivoBloqueio && (
                      <span className="block text-amber-600 mt-1">{selectedTurmaData.motivoBloqueio}</span>
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
              {!podeLancarNotas && selectedTurmaData?.motivoBloqueio && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Bloqueado</AlertTitle>
                  <AlertDescription>{selectedTurmaData.motivoBloqueio}</AlertDescription>
                </Alert>
              )}
              <Alert className="mt-4">
                <Calculator className="h-4 w-4" />
                <AlertTitle className="text-sm font-semibold">Regras de Cálculo</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  {isSecundario ? (
                    <>
                      <strong>Ensino Secundário:</strong> Média Anual = (MT1 + MT2 + MT3) / 3. 
                      Se média ≥ 7 e &lt; 10, pode fazer Recuperação: Nova Média = (Média Anual + Recuperação) / 2
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
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px]">Aluno</TableHead>
                            {TIPOS_AVALIACAO_PROVAS.map(tipo => (
                              <TableHead key={tipo} className="text-center min-w-[100px]">{tipo}</TableHead>
                            ))}
                            <TableHead className="text-center">Média</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gradeDataComputed.map(aluno => (
                            <TableRow key={aluno.matricula_id}>
                              <TableCell className="font-medium">{aluno.nome_completo}</TableCell>
                              {TIPOS_AVALIACAO_PROVAS.map(tipo => {
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
                    </div>
                  </TabsContent>

                  <TabsContent value="extras">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px]">Aluno</TableHead>
                            {TIPOS_AVALIACAO_EXTRAS.map(tipo => (
                              <TableHead key={tipo} className="text-center min-w-[100px]">{tipo}</TableHead>
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
                                    aluno.mediaFinal >= NOTA_MINIMA_APROVACAO
                                      ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                      : aluno.mediaFinal >= NOTA_RECURSO
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
                            {TIPOS_AVALIACAO_PROVAS.map(tipo => (
                              <TableHead key={tipo} className="text-center">{tipo}</TableHead>
                            ))}
                            <TableHead className="text-center">Média</TableHead>
                            <TableHead className="text-center">{labels.recursoLabel}</TableHead>
                            <TableHead className="text-center">Média Final</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gradeDataComputed.map(aluno => (
                            <TableRow key={aluno.matricula_id}>
                              <TableCell className="font-medium">{aluno.nome_completo}</TableCell>
                              {TIPOS_AVALIACAO_PROVAS.map(tipo => (
                                <TableCell key={tipo} className="text-center">
                                  {aluno.notas[tipo]?.valor != null ? safeToFixed(aluno.notas[tipo].valor, 1) : '-'}
                                </TableCell>
                              ))}
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
                                    aluno.mediaFinal >= NOTA_MINIMA_APROVACAO
                                      ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                      : aluno.mediaFinal >= NOTA_RECURSO
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
