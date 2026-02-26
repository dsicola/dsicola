import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { turmasApi, matriculasApi, notasApi, notasHistoricoApi, trimestresFechadosApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { BookOpen, Loader2, ClipboardList, Award, Lock, History, TrendingUp, Users, CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { ExportButtons } from "@/components/common/ExportButtons";
import { format } from 'date-fns';
import { safeToFixed } from '@/lib/utils';
import { pt } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// =============================================
// CONFIGURAÇÕES DE NOTAS
// =============================================
const NOTA_APROVACAO = 10;
const NOTA_RECURSO_MIN = 7;
const NOTA_MAXIMA = 20;
const NOTA_MINIMA = 0;

// =============================================
// ESTRUTURA PARA ENSINO MÉDIO (Trimestres)
// =============================================
// 3 Trimestres, cada um com P1, P2, P3
// Média Trimestral = (P1 + P2 + P3) / 3
// Média Final = (MT1 + MT2 + MT3) / 3
// Se MF < 10 → Vai para Recurso (Recuperação)
// Recurso: Nova média = (MF + Nota Recuperação) / 2
// Se Nova média ≥ 10 → Aprovado, senão → Reprovado

interface ColunaTrimestre {
  key: string;
  label: string;
  fullLabel: string;
  trimestre: number;
  isRecuperacao?: boolean;
}

const COLUNAS_SECUNDARIO: ColunaTrimestre[] = [
  // 1º Trimestre
  { key: '1T-P1', label: 'P1', trimestre: 1, fullLabel: '1º Tri - Prova 1' },
  { key: '1T-P2', label: 'P2', trimestre: 1, fullLabel: '1º Tri - Prova 2' },
  { key: '1T-P3', label: 'P3', trimestre: 1, fullLabel: '1º Tri - Prova 3' },
  // 2º Trimestre
  { key: '2T-P1', label: 'P1', trimestre: 2, fullLabel: '2º Tri - Prova 1' },
  { key: '2T-P2', label: 'P2', trimestre: 2, fullLabel: '2º Tri - Prova 2' },
  { key: '2T-P3', label: 'P3', trimestre: 2, fullLabel: '2º Tri - Prova 3' },
  // 3º Trimestre
  { key: '3T-P1', label: 'P1', trimestre: 3, fullLabel: '3º Tri - Prova 1' },
  { key: '3T-P2', label: 'P2', trimestre: 3, fullLabel: '3º Tri - Prova 2' },
  { key: '3T-P3', label: 'P3', trimestre: 3, fullLabel: '3º Tri - Prova 3' },
  // Recuperação Final
  { key: 'REC', label: 'Rec', trimestre: 4, fullLabel: 'Recuperação Final', isRecuperacao: true },
];

// =============================================
// ESTRUTURA PARA UNIVERSIDADE (Semestral)
// =============================================
// Frequência + 3 Provas + Trabalho/Seminário
// Média = (P1 + P2 + P3) / 3  OU  ((P1+P2+P3)/3 * 0.8) + (Trabalho * 0.2)
// Se MF ≥ 10 e Freq ≥ 75% → Aprovado
// Se MF entre 7-9.9 → Exame de Recurso
// Recurso: Média = (MF + Nota Exame) / 2
// Se < 7 OU Freq < 75% → Reprovado

interface ColunaUniversidade {
  key: string;
  label: string;
  fullLabel: string;
  isFrequencia?: boolean;
  isTrabalho?: boolean;
  isExame?: boolean;
}

const COLUNAS_UNIVERSIDADE: ColunaUniversidade[] = [
  { key: 'FREQ', label: 'Freq%', fullLabel: 'Frequência (%)', isFrequencia: true },
  { key: 'P1', label: '1ª P', fullLabel: '1ª Prova' },
  { key: 'P2', label: '2ª P', fullLabel: '2ª Prova' },
  { key: 'P3', label: '3ª P', fullLabel: '3ª Prova' },
  { key: 'TRAB', label: 'Trab', fullLabel: 'Trabalho/Seminário', isTrabalho: true },
  { key: 'EXAME', label: 'Exame', fullLabel: 'Exame de Recurso', isExame: true },
];

// =============================================
// STATUS DO ALUNO
// =============================================
type StatusAluno = 'aprovado' | 'recurso' | 'reprovado' | 'pendente' | 'freq_baixa';

const StatusBadge: React.FC<{ status: StatusAluno; isSecundario: boolean }> = ({ status, isSecundario }) => {
  switch (status) {
    case 'aprovado':
      return (
        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1">
          <CheckCircle className="h-3 w-3" />
          Aprovado
        </Badge>
      );
    case 'recurso':
      return (
        <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1">
          <RefreshCw className="h-3 w-3" />
          {isSecundario ? 'Recuperação' : 'Recurso'}
        </Badge>
      );
    case 'reprovado':
      return (
        <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30 gap-1">
          <XCircle className="h-3 w-3" />
          Reprovado
        </Badge>
      );
    case 'freq_baixa':
      return (
        <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30 gap-1">
          <AlertTriangle className="h-3 w-3" />
          Freq. Baixa
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          Pendente
        </Badge>
      );
  }
};

// =============================================
// COMPONENTE DE CÉLULA EDITÁVEL
// =============================================
const EditableCell: React.FC<{
  value: number | null;
  notaId: string | null;
  matriculaId: string;
  tipo: string;
  onSave: (matriculaId: string, tipo: string, valor: number, notaId: string | null) => void;
  disabled: boolean;
  isLoading: boolean;
  isSpecial?: boolean;
  maxValue?: number;
}> = ({ value, notaId, matriculaId, tipo, onSave, disabled, isLoading, isSpecial, maxValue = NOTA_MAXIMA }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value?.toString() || '');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setInputValue(value?.toString() || '');
  }, [value]);

  const validateAndSave = () => {
    const cleanValue = inputValue.trim().replace(',', '.');
    
    if (!cleanValue) {
      setError('');
      setIsEditing(false);
      return;
    }

    const numValue = parseFloat(cleanValue);
    
    if (isNaN(numValue)) {
      setError('Inválido');
      return;
    }
    
    if (numValue < NOTA_MINIMA || numValue > maxValue) {
      setError(`${NOTA_MINIMA}-${maxValue}`);
      return;
    }

    const roundedValue = Math.round(numValue * 10) / 10;
    setError('');
    setIsEditing(false);
    onSave(matriculaId, tipo, roundedValue, notaId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      validateAndSave();
    } else if (e.key === 'Escape') {
      setInputValue(value?.toString() || '');
      setError('');
      setIsEditing(false);
    }
  };

  const getColor = (val: number | null) => {
    if (val === null) return 'text-muted-foreground';
    if (val >= 14) return 'text-emerald-600 dark:text-emerald-400';
    if (val >= 10) return 'text-blue-600 dark:text-blue-400';
    if (val >= 7) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-10 w-full">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="flex items-center justify-center h-10 w-full">
        <span className={`font-semibold ${getColor(value)}`}>
          {value !== null ? safeToFixed(value, 1) : '—'}
        </span>
        <Lock className="h-3 w-3 ml-1 text-muted-foreground" />
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError('');
          }}
          onBlur={validateAndSave}
          onKeyDown={handleKeyDown}
          className={`h-10 w-14 text-center font-semibold text-sm ${error ? 'border-destructive' : 'border-primary'}`}
        />
        {error && (
          <span className="absolute -bottom-4 left-0 text-[9px] text-destructive whitespace-nowrap">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      onDoubleClick={() => !disabled && setIsEditing(true)}
      className={`flex items-center justify-center h-10 w-14 rounded-md cursor-pointer transition-colors hover:bg-muted/80 ${
        value !== null ? 'bg-muted/50' : 'bg-transparent border border-dashed border-muted-foreground/30'
      } ${isSpecial ? 'bg-amber-500/5' : ''}`}
      title="Duplo clique para editar"
    >
      <span className={`font-semibold text-sm ${getColor(value)}`}>
        {value !== null ? (maxValue === 100 ? `${safeToFixed(value, 0)}%` : safeToFixed(value, 1)) : '—'}
      </span>
    </div>
  );
};

// =============================================
// COMPONENTE PRINCIPAL
// =============================================
export const NotasTab: React.FC = () => {
  const { instituicaoId, shouldFilter } = useTenantFilter();
  const { isSecundario } = useInstituicao();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isProfessor = role === 'PROFESSOR';

  const labels = {
    turma: isSecundario ? 'Classe' : 'Turma',
    curso: isSecundario ? 'Série' : 'Curso',
  };

  // Fetch turmas
  // P0: Professor usa getTurmasProfessor (JWT resolve professorId). Admin usa getAll.
  const { data: turmas = [] } = useQuery({
    queryKey: ['admin-turmas', instituicaoId, user?.id, role],
    queryFn: async () => {
      if (isProfessor) {
        const data = await turmasApi.getTurmasProfessor({ incluirPendentes: true });
        return Array.isArray(data?.turmas) ? data.turmas : [];
      }
      const data = await turmasApi.getAll();
      return data || [];
    }
  });

  // Fetch trimestres fechados
  const { data: trimestresFechados = [] } = useQuery({
    queryKey: ['trimestres-fechados', instituicaoId],
    queryFn: async () => {
      if (!instituicaoId) return [];
      const data = await trimestresFechadosApi.getAll({ instituicaoId });
      return data || [];
    },
    enabled: isSecundario && !!instituicaoId
  });

  const selectedTurmaData = turmas.find((t: any) => t.id === selectedTurma);
  const anoLetivo = selectedTurmaData?.ano || new Date().getFullYear();

  const isTrimestreFechado = (trimestre: number): boolean => {
    return trimestresFechados.some(
      (tf: any) => tf.ano_letivo === anoLetivo && tf.trimestre === trimestre && tf.fechado
    );
  };

  // Fetch matriculas
  const { data: matriculas = [], isLoading: matriculasLoading } = useQuery({
    queryKey: ['turma-matriculas', selectedTurma],
    queryFn: async () => {
      const res = await matriculasApi.getAll({ turmaId: selectedTurma });
      const data = res?.data ?? [];
      return data.filter((m: any) => m.status === 'Ativa' || m.status === 'ativa');
    },
    enabled: !!selectedTurma
  });

  // Fetch notas
  const { data: notas = [], isLoading: notasLoading } = useQuery({
    queryKey: ['turma-notas', selectedTurma],
    queryFn: async () => {
      if (!selectedTurma) return [];
      
      const res = await matriculasApi.getAll({ turmaId: selectedTurma });
      const turmaMatriculas = res?.data ?? [];
      const activeMatriculas = turmaMatriculas.filter((m: any) => m.status === 'ativa');
      
      if (activeMatriculas.length === 0) return [];
      
      // Fetch notas for each matricula
      const allNotas = await Promise.all(
        activeMatriculas.map((m: any) => notasApi.getAll({ matriculaId: m.id }))
      );
      
      return allNotas.flat();
    },
    enabled: !!selectedTurma
  });

  // Fetch histórico
  const { data: historicoNotas = [] } = useQuery({
    queryKey: ['notas-historico', selectedTurma],
    queryFn: async () => {
      if (!selectedTurma) return [];
      
      const res = await matriculasApi.getAll({ turmaId: selectedTurma });
      const turmaMatriculas = res?.data ?? [];
      if (turmaMatriculas.length === 0) return [];
      
      // Fetch historico for each matricula
      const allHistorico = await Promise.all(
        turmaMatriculas.slice(0, 10).map((m: any) => notasHistoricoApi.getAll({ matriculaId: m.id }))
      );
      
      return allHistorico.flat().slice(0, 50);
    },
    enabled: !!selectedTurma && isAdmin
  });

  // REGRA: Apenas ADMIN pode editar notas diretamente
  // Professores editam notas via Plano de Ensino / Avaliações
  const canEditTurma = isAdmin;

  // Criar mapa de notas
  const notasMap = React.useMemo(() => {
    const map: Record<string, Record<string, { id: string; valor: number }>> = {};
    notas.forEach((nota: any) => {
      if (!map[nota.matricula_id]) {
        map[nota.matricula_id] = {};
      }
      map[nota.matricula_id][nota.tipo] = { id: nota.id, valor: nota.valor };
    });
    return map;
  }, [notas]);

  // Estado para dialog de correção
  const [correcaoDialogOpen, setCorrecaoDialogOpen] = useState(false);
  const [correcaoData, setCorrecaoData] = useState<{
    notaId: string;
    valorAnterior: number;
    valorNovo: number;
    matriculaId: string;
    tipo: string;
  } | null>(null);
  const [motivoCorrecao, setMotivoCorrecao] = useState('');

  // Mutation para salvar nota
  const saveNotaMutation = useSafeMutation({
    mutationFn: async ({ matriculaId, tipo, valor, notaId }: { matriculaId: string; tipo: string; valor: number; notaId: string | null }) => {
      if (notaId) {
        // Verificar se valor mudou
        const notaAtual = notasMap[matriculaId]?.[tipo];
        const valorAnterior = notaAtual?.valor;
        
        if (valorAnterior !== undefined && Math.abs(valorAnterior - valor) > 0.01) {
          // Valor mudou - deve usar corrigir() com motivo obrigatório
          // Abrir dialog para solicitar motivo
          setCorrecaoData({
            notaId,
            valorAnterior,
            valorNovo: valor,
            matriculaId,
            tipo,
          });
          setCorrecaoDialogOpen(true);
          // Não salvar ainda - aguardar confirmação do dialog
          return Promise.resolve();
        } else {
          // Valor não mudou - pode usar update() apenas para observações
          // Mas como não há observações sendo passadas, não faz nada
          return Promise.resolve();
        }
      } else {
        // Create new nota
        await notasApi.create({
          matriculaId,
          tipo,
          valor,
          peso: 1,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-notas'] });
      queryClient.invalidateQueries({ queryKey: ['notas-historico'] });
      toast.success('Nota salva!');
      setSavingCell(null);
    },
    onError: (error: any) => {
      toast.error('Erro: ' + (error.response?.data?.message || error.message));
      setSavingCell(null);
    }
  });

  // Mutation para corrigir nota (com motivo obrigatório)
  const corrigirNotaMutation = useSafeMutation({
    mutationFn: async ({ notaId, valor, motivo }: { notaId: string; valor: number; motivo: string }) => {
      await notasApi.corrigir(notaId, {
        valor,
        motivo: motivo.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-notas'] });
      queryClient.invalidateQueries({ queryKey: ['notas-historico'] });
      toast.success('Nota corrigida com sucesso! Histórico preservado.');
      setSavingCell(null);
      setCorrecaoDialogOpen(false);
      setCorrecaoData(null);
      setMotivoCorrecao('');
    },
    onError: (error: any) => {
      toast.error('Erro ao corrigir nota: ' + (error.response?.data?.message || error.message));
      setSavingCell(null);
    }
  });

  const handleSaveNota = (matriculaId: string, tipo: string, valor: number, notaId: string | null) => {
    setSavingCell(`${matriculaId}-${tipo}`);
    saveNotaMutation.mutate({ matriculaId, tipo, valor, notaId });
  };

  const handleConfirmarCorrecao = () => {
    if (!correcaoData || !motivoCorrecao.trim()) {
      toast.error('Motivo da correção é obrigatório');
      return;
    }
    corrigirNotaMutation.mutate({
      notaId: correcaoData.notaId,
      valor: correcaoData.valorNovo,
      motivo: motivoCorrecao,
    });
  };

  // =============================================
  // CÁLCULOS PARA ENSINO MÉDIO
  // =============================================
  const calcularMediaTrimestreEM = (matriculaId: string, trimestre: number): number | null => {
    const notasAluno = notasMap[matriculaId];
    if (!notasAluno) return null;

    const p1 = notasAluno[`${trimestre}T-P1`]?.valor;
    const p2 = notasAluno[`${trimestre}T-P2`]?.valor;
    const p3 = notasAluno[`${trimestre}T-P3`]?.valor;

    if (p1 !== undefined && p2 !== undefined && p3 !== undefined) {
      return Math.round(((p1 + p2 + p3) / 3) * 10) / 10;
    }
    return null;
  };

  const calcularMediaAnualEM = (matriculaId: string): number | null => {
    const mt1 = calcularMediaTrimestreEM(matriculaId, 1);
    const mt2 = calcularMediaTrimestreEM(matriculaId, 2);
    const mt3 = calcularMediaTrimestreEM(matriculaId, 3);

    if (mt1 === null || mt2 === null || mt3 === null) return null;
    return Math.round(((mt1 + mt2 + mt3) / 3) * 10) / 10;
  };

  const calcularMediaFinalEM = (matriculaId: string): number | null => {
    const mediaAnual = calcularMediaAnualEM(matriculaId);
    if (mediaAnual === null) return null;

    // Se já está aprovado, retorna a média anual
    if (mediaAnual >= NOTA_APROVACAO) return mediaAnual;

    // Se está em situação de recurso, verifica se fez recuperação
    const notasAluno = notasMap[matriculaId];
    const recuperacao = notasAluno?.['REC']?.valor;

    if (recuperacao !== undefined) {
      // Nova média = (Média Anual + Recuperação) / 2
      const novaMedia = Math.round(((mediaAnual + recuperacao) / 2) * 10) / 10;
      return novaMedia;
    }

    return mediaAnual;
  };

  const getStatusAlunoEM = (matriculaId: string): StatusAluno => {
    const mediaAnual = calcularMediaAnualEM(matriculaId);
    if (mediaAnual === null) return 'pendente';

    // Aprovado direto
    if (mediaAnual >= NOTA_APROVACAO) return 'aprovado';

    // Reprovado direto (média < 7)
    if (mediaAnual < NOTA_RECURSO_MIN) return 'reprovado';

    // Entre 7 e 9.9 - verifica recuperação
    const notasAluno = notasMap[matriculaId];
    const recuperacao = notasAluno?.['REC']?.valor;

    if (recuperacao === undefined) return 'recurso';

    // Fez recuperação - calcula nova média
    const novaMedia = (mediaAnual + recuperacao) / 2;
    return novaMedia >= NOTA_APROVACAO ? 'aprovado' : 'reprovado';
  };

  const precisaRecuperacaoEM = (matriculaId: string): boolean => {
    const mediaAnual = calcularMediaAnualEM(matriculaId);
    if (mediaAnual === null) return false;
    return mediaAnual >= NOTA_RECURSO_MIN && mediaAnual < NOTA_APROVACAO;
  };

  // =============================================
  // CÁLCULOS PARA UNIVERSIDADE
  // =============================================
  const calcularMediaProvasUni = (matriculaId: string): number | null => {
    const notasAluno = notasMap[matriculaId];
    if (!notasAluno) return null;

    const p1 = notasAluno['P1']?.valor;
    const p2 = notasAluno['P2']?.valor;
    const p3 = notasAluno['P3']?.valor;
    const trabalho = notasAluno['TRAB']?.valor;

    // Precisa de pelo menos as 3 provas
    if (p1 === undefined || p2 === undefined || p3 === undefined) return null;

    const mediaProvas = (p1 + p2 + p3) / 3;

    // Se tem trabalho, aplica peso: 80% provas + 20% trabalho
    if (trabalho !== undefined) {
      return Math.round((mediaProvas * 0.8 + trabalho * 0.2) * 10) / 10;
    }

    return Math.round(mediaProvas * 10) / 10;
  };

  const calcularMediaFinalUni = (matriculaId: string): number | null => {
    const mediaProvas = calcularMediaProvasUni(matriculaId);
    if (mediaProvas === null) return null;

    // Se já está aprovado, retorna a média
    if (mediaProvas >= NOTA_APROVACAO) return mediaProvas;

    // Se está em situação de recurso, verifica se fez exame
    const notasAluno = notasMap[matriculaId];
    const exame = notasAluno?.['EXAME']?.valor;

    if (exame !== undefined && mediaProvas >= NOTA_RECURSO_MIN) {
      // Nova média = (Média + Exame) / 2
      return Math.round(((mediaProvas + exame) / 2) * 10) / 10;
    }

    return mediaProvas;
  };

  const getFrequenciaUni = (matriculaId: string): number | null => {
    const notasAluno = notasMap[matriculaId];
    return notasAluno?.['FREQ']?.valor ?? null;
  };

  const getStatusAlunoUni = (matriculaId: string): StatusAluno => {
    const mediaProvas = calcularMediaProvasUni(matriculaId);
    const frequencia = getFrequenciaUni(matriculaId);
    
    if (mediaProvas === null) return 'pendente';

    // Frequência baixa (< 75%)
    if (frequencia !== null && frequencia < 75) return 'freq_baixa';

    // Aprovado direto
    if (mediaProvas >= NOTA_APROVACAO) return 'aprovado';

    // Reprovado direto (média < 7)
    if (mediaProvas < NOTA_RECURSO_MIN) return 'reprovado';

    // Entre 7 e 9.9 - verifica exame
    const notasAluno = notasMap[matriculaId];
    const exame = notasAluno?.['EXAME']?.valor;

    if (exame === undefined) return 'recurso';

    // Fez exame - calcula nova média
    const novaMedia = (mediaProvas + exame) / 2;
    return novaMedia >= NOTA_APROVACAO ? 'aprovado' : 'reprovado';
  };

  const precisaExameUni = (matriculaId: string): boolean => {
    const mediaProvas = calcularMediaProvasUni(matriculaId);
    const frequencia = getFrequenciaUni(matriculaId);
    
    if (mediaProvas === null) return false;
    if (frequencia !== null && frequencia < 75) return false; // Reprovado por falta
    return mediaProvas >= NOTA_RECURSO_MIN && mediaProvas < NOTA_APROVACAO;
  };

  // =============================================
  // FUNÇÕES UNIFICADAS
  // =============================================
  const calcularMediaFinal = (matriculaId: string): number | null => {
    return isSecundario ? calcularMediaFinalEM(matriculaId) : calcularMediaFinalUni(matriculaId);
  };

  const getStatusAluno = (matriculaId: string): StatusAluno => {
    return isSecundario ? getStatusAlunoEM(matriculaId) : getStatusAlunoUni(matriculaId);
  };

  // Estatísticas
  const estatisticas = React.useMemo(() => {
    if (matriculas.length === 0) {
      return { media: '—', aprovados: 0, recurso: 0, reprovados: 0, total: 0 };
    }

    let somaMedias = 0;
    let countMedias = 0;
    let aprovados = 0;
    let recurso = 0;
    let reprovados = 0;

    matriculas.forEach((m: any) => {
      const mediaFinal = calcularMediaFinal(m.id);
      const status = getStatusAluno(m.id);
      
      if (mediaFinal !== null) {
        somaMedias += mediaFinal;
        countMedias++;
      }

      if (status === 'aprovado') aprovados++;
      else if (status === 'recurso') recurso++;
      else if (status === 'reprovado' || status === 'freq_baixa') reprovados++;
    });

    return {
      media: countMedias > 0 ? safeToFixed(somaMedias / countMedias, 1) : '—',
      aprovados,
      recurso,
      reprovados,
      total: matriculas.length
    };
  }, [matriculas, notasMap, isSecundario]);

  // Dados para exportação
  const exportData = React.useMemo(() => {
    return matriculas.map((m: any) => {
      const row: string[] = [m.profiles?.nome_completo || 'N/A'];
      
      if (isSecundario) {
        [1, 2, 3].forEach(tri => {
          const cols = COLUNAS_SECUNDARIO.filter(c => c.trimestre === tri);
          cols.forEach(col => {
            const nota = notasMap[m.id]?.[col.key];
            row.push(nota ? safeToFixed(nota.valor, 1) : '—');
          });
          const mediaTri = calcularMediaTrimestreEM(m.id, tri);
          row.push(mediaTri !== null ? safeToFixed(mediaTri, 1) : '—');
        });
        // Recuperação
        const rec = notasMap[m.id]?.['REC'];
        row.push(rec ? safeToFixed(rec.valor, 1) : '—');
      } else {
        COLUNAS_UNIVERSIDADE.forEach(col => {
          const nota = notasMap[m.id]?.[col.key];
          row.push(nota ? (col.isFrequencia ? `${safeToFixed(nota.valor, 0)}%` : safeToFixed(nota.valor, 1)) : '—');
        });
      }
      
      const mediaFinal = calcularMediaFinal(m.id);
      const status = getStatusAluno(m.id);
      row.push(mediaFinal !== null ? safeToFixed(mediaFinal, 1) : '—');
      row.push(
        status === 'aprovado' ? 'Aprovado' : 
        status === 'recurso' ? (isSecundario ? 'Recuperação' : 'Recurso') : 
        status === 'reprovado' ? 'Reprovado' : 
        status === 'freq_baixa' ? 'Rep. Frequência' : 'Pendente'
      );
      return row;
    });
  }, [matriculas, notasMap, isSecundario]);

  const exportColunas = React.useMemo(() => {
    const cols = ['Aluno'];
    if (isSecundario) {
      [1, 2, 3].forEach(tri => {
        cols.push(`${tri}T-P1`, `${tri}T-P2`, `${tri}T-P3`, `MT${tri}`);
      });
      cols.push('Recuperação');
    } else {
      COLUNAS_UNIVERSIDADE.forEach(c => cols.push(c.fullLabel));
    }
    cols.push('Média Final', 'Situação');
    return cols;
  }, [isSecundario]);

  const getMediaColor = (media: number | null) => {
    if (media === null) return 'text-muted-foreground';
    if (media >= 14) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10';
    if (media >= 10) return 'text-blue-600 dark:text-blue-400 bg-blue-500/10';
    if (media >= 7) return 'text-amber-600 dark:text-amber-400 bg-amber-500/10';
    return 'text-red-600 dark:text-red-400 bg-red-500/10';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm">
            <Award className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Lançamento de Notas</h2>
            <p className="text-muted-foreground text-sm">
              {isSecundario 
                ? 'MT = (P1+P2+P3)/3 | MF = (MT1+MT2+MT3)/3 | Rec: (MF+Rec)/2'
                : 'MP = (P1+P2+P3)/3 ou 80% + 20% Trab | Exame: (MP+Ex)/2'
              }
            </p>
          </div>
        </div>
        
        <Select value={selectedTurma} onValueChange={setSelectedTurma}>
          <SelectTrigger className="w-[280px] h-11">
            <SelectValue placeholder={`Selecione uma ${labels.turma}`} />
          </SelectTrigger>
          <SelectContent>
            {turmas.map((turma: any) => (
              <SelectItem key={turma.id} value={turma.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{turma.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {turma.cursos?.nome} • {turma.ano}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Estatísticas */}
      {selectedTurma && notas.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Média Geral</p>
                  <p className="text-xl font-bold text-primary">{estatisticas.media}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Aprovados</p>
                  <p className="text-xl font-bold text-emerald-600">{estatisticas.aprovados}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <RefreshCw className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isSecundario ? 'Recuperação' : 'Em Recurso'}</p>
                  <p className="text-xl font-bold text-amber-600">{estatisticas.recurso}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reprovados</p>
                  <p className="text-xl font-bold text-red-600">{estatisticas.reprovados}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de Notas */}
      {selectedTurma && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Pauta de Notas</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-normal">
                      <Users className="h-3 w-3 mr-1" />
                      {matriculas.length} aluno(s)
                    </Badge>
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {matriculas.length > 0 && (
                  <ExportButtons
                    titulo="Pauta de Notas"
                    colunas={exportColunas}
                    dados={exportData}
                  />
                )}
                
                {isAdmin && historicoNotas.length > 0 && (
                  <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <History className="h-4 w-4" />
                        Histórico
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <History className="h-5 w-5" />
                          Histórico de Alterações
                        </DialogTitle>
                        <DialogDescription>Últimas 50 alterações</DialogDescription>
                      </DialogHeader>
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead>Data</TableHead>
                              <TableHead>Usuário</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead className="text-center">Anterior</TableHead>
                              <TableHead className="text-center">Nova</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {historicoNotas.map((h: any) => (
                              <TableRow key={h.id}>
                                <TableCell className="text-sm">
                                  {format(new Date(h.created_at), "dd/MM/yy HH:mm", { locale: pt })}
                                </TableCell>
                                <TableCell className="text-sm">{h.alterado_por_nome}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{h.tipo_nota}</Badge>
                                </TableCell>
                                <TableCell className="text-center text-red-600 font-semibold">
                                  {safeToFixed(h.nota_anterior, 1)}
                                </TableCell>
                                <TableCell className="text-center text-emerald-600 font-semibold">
                                  {safeToFixed(h.nota_nova, 1)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            {matriculasLoading || notasLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : matriculas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-1">Nenhum aluno matriculado</h3>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <TooltipProvider>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold sticky left-0 bg-muted/50 z-10 min-w-[160px]">
                          Aluno
                        </TableHead>
                        {isSecundario ? (
                          <>
                            <TableHead colSpan={4} className="text-center font-semibold border-l bg-blue-500/5">
                              1º Trimestre
                            </TableHead>
                            <TableHead colSpan={4} className="text-center font-semibold border-l bg-emerald-500/5">
                              2º Trimestre
                            </TableHead>
                            <TableHead colSpan={4} className="text-center font-semibold border-l bg-violet-500/5">
                              3º Trimestre
                            </TableHead>
                            <TableHead className="text-center font-semibold border-l bg-amber-500/5">
                              Rec
                            </TableHead>
                          </>
                        ) : (
                          COLUNAS_UNIVERSIDADE.map(col => (
                            <TableHead key={col.key} className={`text-center font-semibold min-w-[70px] ${col.isExame ? 'bg-amber-500/5' : ''}`}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">{col.label}</span>
                                </TooltipTrigger>
                                <TooltipContent>{col.fullLabel}</TooltipContent>
                              </Tooltip>
                            </TableHead>
                          ))
                        )}
                        <TableHead className="text-center font-semibold bg-primary/10 border-l min-w-[70px]">
                          MF
                        </TableHead>
                        <TableHead className="text-center font-semibold bg-primary/10 min-w-[100px]">
                          Situação
                        </TableHead>
                      </TableRow>
                      {isSecundario && (
                        <TableRow className="bg-muted/30">
                          <TableHead className="sticky left-0 bg-muted/30 z-10" />
                          {[1, 2, 3].map(tri => (
                            <React.Fragment key={tri}>
                              {['P1', 'P2', 'P3'].map((p, idx) => (
                                <TableHead 
                                  key={`${tri}T-${p}`} 
                                  className={`text-center text-xs font-medium ${idx === 0 ? 'border-l' : ''}`}
                                >
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help">{p}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>{tri}º Tri - Prova {idx + 1}</TooltipContent>
                                  </Tooltip>
                                </TableHead>
                              ))}
                              <TableHead className="text-center text-xs font-medium bg-muted/50">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help">MT</span>
                                  </TooltipTrigger>
                                  <TooltipContent>Média {tri}º Trimestre</TooltipContent>
                                </Tooltip>
                              </TableHead>
                            </React.Fragment>
                          ))}
                          <TableHead className="text-center text-xs font-medium border-l bg-amber-500/10">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">Rec</span>
                              </TooltipTrigger>
                              <TooltipContent>Recuperação Final</TooltipContent>
                            </Tooltip>
                          </TableHead>
                          <TableHead className="bg-primary/10 border-l" />
                          <TableHead className="bg-primary/10" />
                        </TableRow>
                      )}
                    </TableHeader>
                    <TableBody>
                      {matriculas.map((matricula: any, index: number) => {
                        const mediaFinal = calcularMediaFinal(matricula.id);
                        const status = getStatusAluno(matricula.id);
                        const needsRecuperacao = isSecundario ? precisaRecuperacaoEM(matricula.id) : precisaExameUni(matricula.id);
                        
                        return (
                          <TableRow key={matricula.id} className="hover:bg-muted/30">
                            <TableCell className="sticky left-0 bg-background z-10 font-medium">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-bold text-primary">
                                    {index + 1}
                                  </span>
                                </div>
                                <span className="truncate max-w-[120px] text-sm">
                                  {matricula.profiles?.nome_completo || 'N/A'}
                                </span>
                              </div>
                            </TableCell>
                            
                            {isSecundario ? (
                              <>
                                {[1, 2, 3].map(tri => {
                                  const mediaTri = calcularMediaTrimestreEM(matricula.id, tri);
                                  const disabled = !canEditTurma || isTrimestreFechado(tri);
                                  
                                  return (
                                    <React.Fragment key={tri}>
                                      {['P1', 'P2', 'P3'].map((p, idx) => {
                                        const key = `${tri}T-${p}`;
                                        const notaData = notasMap[matricula.id]?.[key];
                                        const isLoading = savingCell === `${matricula.id}-${key}`;
                                        
                                        return (
                                          <TableCell 
                                            key={key} 
                                            className={`text-center p-1 ${idx === 0 ? 'border-l' : ''}`}
                                          >
                                            <EditableCell
                                              value={notaData?.valor ?? null}
                                              notaId={notaData?.id ?? null}
                                              matriculaId={matricula.id}
                                              tipo={key}
                                              onSave={handleSaveNota}
                                              disabled={disabled}
                                              isLoading={isLoading}
                                            />
                                          </TableCell>
                                        );
                                      })}
                                      <TableCell className="text-center p-1 bg-muted/30">
                                        <div className={`inline-flex items-center justify-center w-14 h-10 rounded-md font-bold text-sm ${getMediaColor(mediaTri)}`}>
                                          {mediaTri !== null ? safeToFixed(mediaTri, 1) : '—'}
                                        </div>
                                      </TableCell>
                                    </React.Fragment>
                                  );
                                })}
                                {/* Recuperação */}
                                <TableCell className="text-center p-1 border-l bg-amber-500/5">
                                  {needsRecuperacao ? (
                                    <EditableCell
                                      value={notasMap[matricula.id]?.['REC']?.valor ?? null}
                                      notaId={notasMap[matricula.id]?.['REC']?.id ?? null}
                                      matriculaId={matricula.id}
                                      tipo="REC"
                                      onSave={handleSaveNota}
                                      disabled={!canEditTurma}
                                      isLoading={savingCell === `${matricula.id}-REC`}
                                      isSpecial
                                    />
                                  ) : (
                                    <div className="flex items-center justify-center h-10 w-14 text-muted-foreground text-xs">
                                      N/A
                                    </div>
                                  )}
                                </TableCell>
                              </>
                            ) : (
                              COLUNAS_UNIVERSIDADE.map((col) => {
                                const notaData = notasMap[matricula.id]?.[col.key];
                                const disabled = !canEditTurma;
                                const isLoading = savingCell === `${matricula.id}-${col.key}`;
                                
                                // Exame só habilitado se precisa
                                if (col.isExame && !needsRecuperacao) {
                                  return (
                                    <TableCell key={col.key} className="text-center p-1 bg-amber-500/5">
                                      <div className="flex items-center justify-center h-10 w-14 text-muted-foreground text-xs">
                                        N/A
                                      </div>
                                    </TableCell>
                                  );
                                }
                                
                                return (
                                  <TableCell key={col.key} className={`text-center p-1 ${col.isExame ? 'bg-amber-500/5' : ''}`}>
                                    <EditableCell
                                      value={notaData?.valor ?? null}
                                      notaId={notaData?.id ?? null}
                                      matriculaId={matricula.id}
                                      tipo={col.key}
                                      onSave={handleSaveNota}
                                      disabled={disabled}
                                      isLoading={isLoading}
                                      isSpecial={col.isExame || col.isTrabalho}
                                      maxValue={col.isFrequencia ? 100 : NOTA_MAXIMA}
                                    />
                                  </TableCell>
                                );
                              })
                            )}
                            
                            <TableCell className="text-center border-l bg-primary/5 p-1">
                              <div className={`inline-flex items-center justify-center w-14 h-10 rounded-md font-bold ${getMediaColor(mediaFinal)}`}>
                                {mediaFinal !== null ? safeToFixed(mediaFinal, 1) : '—'}
                              </div>
                            </TableCell>
                            <TableCell className="text-center bg-primary/5 p-1">
                              <StatusBadge status={status} isSecundario={isSecundario} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TooltipProvider>
              </div>
            )}
            
            {/* Legenda */}
            {matriculas.length > 0 && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Legenda:</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-emerald-500/20"></span>
                    ≥14 Excelente
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-blue-500/20"></span>
                    10-13.9 Aprovado
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-amber-500/20"></span>
                    7-9.9 {isSecundario ? 'Recuperação' : 'Recurso'}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-red-500/20"></span>
                    &lt;7 Reprovado
                  </span>
                  {!isSecundario && (
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-orange-500/20"></span>
                      Freq &lt;75% Reprovado
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Estado vazio */}
      {!selectedTurma && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <BookOpen className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Selecione uma {labels.turma}</h3>
              <p className="text-muted-foreground max-w-md">
                Escolha uma {labels.turma.toLowerCase()} para visualizar a pauta de notas
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Correção de Nota */}
      <Dialog open={correcaoDialogOpen} onOpenChange={(open) => {
        setCorrecaoDialogOpen(open);
        if (!open) {
          setCorrecaoData(null);
          setMotivoCorrecao('');
          setSavingCell(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Corrigir Nota</DialogTitle>
            <DialogDescription>
              Para alterar o valor de uma nota, é obrigatório informar o motivo da correção.
              O histórico será preservado conforme padrão institucional.
            </DialogDescription>
          </DialogHeader>
          {correcaoData && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Valor Anterior</Label>
                  <div className="text-lg font-semibold text-red-600">
                    {safeToFixed(correcaoData.valorAnterior, 1)}
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Novo Valor</Label>
                  <div className="text-lg font-semibold text-emerald-600">
                    {safeToFixed(correcaoData.valorNovo, 1)}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo da Correção *</Label>
                <Textarea
                  id="motivo"
                  value={motivoCorrecao}
                  onChange={(e) => setMotivoCorrecao(e.target.value)}
                  placeholder="Ex: Erro de digitação, Revisão pedagógica, Reavaliação..."
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  O motivo será registrado no histórico imutável da nota.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCorrecaoDialogOpen(false);
                setCorrecaoData(null);
                setMotivoCorrecao('');
                setSavingCell(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarCorrecao}
              disabled={!motivoCorrecao.trim() || corrigirNotaMutation.isPending}
            >
              {corrigirNotaMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Corrigindo...
                </>
              ) : (
                'Confirmar Correção'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
