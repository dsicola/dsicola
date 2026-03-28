import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { turmasApi, notasApi, notasHistoricoApi, trimestresFechadosApi, avaliacoesApi, examesApi, planoEnsinoApi, parametrosSistemaApi } from '@/services/api';
import { mergePautaLabelsSuperior, mergePautaLabelsSecundario, buildPesosMTSecundarioFromParametros } from '@/utils/pautaLabelsConfig';
import {
  NOTA_MINIMA_ZONA_RECURSO_PADRAO,
  calcularMediaFinalEnsinoMedio,
  calcularMediaFinalUniversidade,
  buildOpcoesCalculoSuperiorPautaFromParametros,
  criarGetterSemanticoDasChavesGrid,
  obterMediasTrimestraisSecundario,
  secundarioUsaNppNaMediaTrimestral,
  resultadoCalculoSuperiorPauta,
  TIPOS_SECUNDARIO_MERGE_KEYS,
} from '@/utils/gestaoNotasCalculo';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useAuth } from '@/contexts/AuthContext';
import { getTurmaRowId, isValidTurmaSelection, turmasListFromApiResponse } from '@/utils/turmaIdentity';
import { labelPlanoEnsino } from '@/utils/planoEnsinoLabel';
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
import { BookOpen, Loader2, ClipboardList, Award, Lock, History, TrendingUp, Users, CheckCircle, XCircle, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { ExportButtons } from "@/components/common/ExportButtons";
import { format } from 'date-fns';
import { safeToFixed } from '@/lib/utils';
import { pt } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  { key: '1T-MAC', label: 'MAC', trimestre: 1, fullLabel: '1º Tri - MAC' },
  { key: '1T-NPP', label: 'NPP', trimestre: 1, fullLabel: '1º Tri - NPP' },
  { key: '1T-NPT', label: 'NPT', trimestre: 1, fullLabel: '1º Tri - NPT' },
  // 2º Trimestre
  { key: '2T-P1', label: 'P1', trimestre: 2, fullLabel: '2º Tri - Prova 1' },
  { key: '2T-P2', label: 'P2', trimestre: 2, fullLabel: '2º Tri - Prova 2' },
  { key: '2T-P3', label: 'P3', trimestre: 2, fullLabel: '2º Tri - Prova 3' },
  { key: '2T-MAC', label: 'MAC', trimestre: 2, fullLabel: '2º Tri - MAC' },
  { key: '2T-NPP', label: 'NPP', trimestre: 2, fullLabel: '2º Tri - NPP' },
  { key: '2T-NPT', label: 'NPT', trimestre: 2, fullLabel: '2º Tri - NPT' },
  // 3º Trimestre
  { key: '3T-P1', label: 'P1', trimestre: 3, fullLabel: '3º Tri - Prova 1' },
  { key: '3T-P2', label: 'P2', trimestre: 3, fullLabel: '3º Tri - Prova 2' },
  { key: '3T-P3', label: 'P3', trimestre: 3, fullLabel: '3º Tri - Prova 3' },
  { key: '3T-MAC', label: 'MAC', trimestre: 3, fullLabel: '3º Tri - MAC' },
  { key: '3T-EN', label: 'EN', trimestre: 3, fullLabel: '3º Tri - EN (exame nacional)' },
  { key: '3T-NPP', label: 'NPP', trimestre: 3, fullLabel: '3º Tri - NPP' },
  { key: '3T-NPT', label: 'NPT', trimestre: 3, fullLabel: '3º Tri - NPT' },
  // Recuperação Final
  { key: 'REC', label: 'Rec', trimestre: 4, fullLabel: 'Recuperação Final', isRecuperacao: true },
];

/** Colunas de lançamento por trimestre: legado P1–P3, mini-pauta Angola, ou ambos. */
type ModoColunasTrimestreSec = 'legacy' | 'angola' | 'mixed';

function trimColModeSecundario(
  tipoMap: Record<string, { avaliacaoId?: string; exameId?: string } | undefined>,
  trim: 1 | 2 | 3,
  keysComDados: Set<string>,
): ModoColunasTrimestreSec {
  const p = [`${trim}T-P1`, `${trim}T-P2`, `${trim}T-P3`];
  const a =
    trim === 3
      ? [`${trim}T-MAC`, `${trim}T-EN`, `${trim}T-NPP`, `${trim}T-NPT`]
      : [`${trim}T-MAC`, `${trim}T-NPP`, `${trim}T-NPT`];
  const configuredOrData = (k: string) =>
    !!(tipoMap[k]?.avaliacaoId || tipoMap[k]?.exameId) || keysComDados.has(k);
  const hasP = p.some(configuredOrData);
  const hasA = a.some(configuredOrData);
  if (hasA && !hasP) return 'angola';
  if (hasP && !hasA) return 'legacy';
  if (hasP && hasA) return 'mixed';
  return 'legacy';
}

/** Sem provas P1–P3 nem colunas mini-pauta (MAC/NPT ou III·EN) mapeados nem notas na grelha. */
function trimestreSemColunasConfiguradasNemDados(
  tipoMap: Record<string, { avaliacaoId?: string; exameId?: string } | undefined>,
  trim: 1 | 2 | 3,
  keysComDados: Set<string>,
): boolean {
  const p = [`${trim}T-P1`, `${trim}T-P2`, `${trim}T-P3`];
  const a =
    trim === 3
      ? [`${trim}T-MAC`, `${trim}T-EN`, `${trim}T-NPP`, `${trim}T-NPT`]
      : [`${trim}T-MAC`, `${trim}T-NPP`, `${trim}T-NPT`];
  const configuredOrData = (k: string) =>
    !!(tipoMap[k]?.avaliacaoId || tipoMap[k]?.exameId) || keysComDados.has(k);
  return !p.some(configuredOrData) && !a.some(configuredOrData);
}

/**
 * Evita que o II/III trimestre mostrem colunas legadas P1–P3 vazias quando o I (e o II) já
 * usam mini-pauta (MAC+NPT / III·EN): o fallback "legacy" só faz sentido com provas explícitas.
 */
function normalizeModosTrimestreSecundario(
  tipoMap: Record<string, { avaliacaoId?: string; exameId?: string } | undefined>,
  keysComDados: Set<string>,
): { 1: ModoColunasTrimestreSec; 2: ModoColunasTrimestreSec; 3: ModoColunasTrimestreSec } {
  const m1 = trimColModeSecundario(tipoMap, 1, keysComDados);
  let m2 = trimColModeSecundario(tipoMap, 2, keysComDados);
  let m3 = trimColModeSecundario(tipoMap, 3, keysComDados);
  const empty = (t: 1 | 2 | 3) => trimestreSemColunasConfiguradasNemDados(tipoMap, t, keysComDados);

  if (m2 === 'legacy' && empty(2) && m1 !== 'legacy') m2 = 'angola';
  if (m3 === 'legacy' && empty(3) && m1 !== 'legacy' && m2 !== 'legacy') m3 = 'angola';

  return { 1: m1, 2: m2, 3: m3 };
}

function colunasTrimestreSecundario(
  trim: 1 | 2 | 3,
  mode: ModoColunasTrimestreSec,
  usarNppNaMediaTrimestral: boolean,
): ColunaTrimestre[] {
  const all = COLUNAS_SECUNDARIO.filter((c) => c.trimestre === trim);
  const provas = all.filter((c) => /-P[123]$/.test(c.key));
  const angola =
    trim === 3
      ? usarNppNaMediaTrimestral
        ? all.filter((c) => /-MAC$|-NPP$|-EN$|-NPT$/.test(c.key))
        : all.filter((c) => /-MAC$|-EN$/.test(c.key))
      : usarNppNaMediaTrimestral
        ? all.filter((c) => /-MAC$|-NPP$|-NPT$/.test(c.key))
        : all.filter((c) => /-MAC$|-NPT$/.test(c.key));
  if (mode === 'legacy') return provas;
  if (mode === 'angola') return angola;
  return [...provas, ...angola];
}

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

function buildColunasUniversidade(rotulos: Record<string, string>): ColunaUniversidade[] {
  const short = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);
  return [
    { key: 'FREQ', label: 'Freq%', fullLabel: 'Frequência (%)', isFrequencia: true },
    { key: 'P1', label: short(rotulos.prova1, 8), fullLabel: rotulos.prova1 },
    { key: 'P2', label: short(rotulos.prova2, 8), fullLabel: rotulos.prova2 },
    { key: 'P3', label: short(rotulos.prova3, 8), fullLabel: rotulos.prova3 },
    { key: 'TRAB', label: short(rotulos.trabalho, 8), fullLabel: rotulos.trabalho, isTrabalho: true },
    { key: 'EXAME', label: short(rotulos.exameRecurso, 8), fullLabel: rotulos.exameRecurso, isExame: true },
  ];
}

/** Liga nota da API às chaves da grelha (1T-P1 … REC / P1 … EXAME) */
function mapNotaToGridKey(nota: any, isSecundario: boolean): string | null {
  const raw = String(
    nota?.avaliacao?.nome ??
      nota?.exame?.nome ??
      nota?.tipo ??
      nota?.avaliacao?.tipo ??
      nota?.exame?.tipo ??
      ''
  ).trim();
  if (!raw) return null;

  if (!isSecundario) {
    const t = raw.toLowerCase();
    if (t.includes('freq')) return 'FREQ';
    const hasToken = (n: number) => new RegExp(`(^|\\D)${n}(\\D|$)`).test(t);
    if ((t.includes('teste') || t.includes('prova')) && hasToken(1)) return 'P1';
    if ((t.includes('teste') || t.includes('prova')) && hasToken(2)) return 'P2';
    if ((t.includes('teste') || t.includes('prova')) && hasToken(3)) return 'P3';
    if (t.includes('trabalho')) return 'TRAB';
    if (t.includes('recurso') || t.includes('exame de recurso')) return 'EXAME';
    if (/^P[123]$/.test(raw)) return raw;
    if (['FREQ', 'TRAB', 'EXAME'].includes(raw)) return raw;
    return null;
  }

  const avTipo = String(nota?.avaliacao?.tipo || '').toUpperCase();
  if (avTipo === 'RECUPERACAO' || /^RECUPERACAO$/i.test(raw)) return 'REC';

  if (/^[123]T-P[123]$/.test(raw)) return raw;
  if (/^REC$/i.test(raw)) return 'REC';
  {
    const tl = raw.toLowerCase();
    if (/recupera(ç|c)ão\s*final|recurso\s*final/.test(tl)) return 'REC';
  }

  const t = raw.toLowerCase();
  let tri: 1 | 2 | 3 | null = null;
  if (/\b1\s*º|primeiro|1\s*tri/i.test(raw) || (t.includes('trimestre') && /\b1\b/.test(t))) tri = 1;
  else if (/\b2\s*º|segundo|2\s*tri/i.test(raw) || (t.includes('trimestre') && /\b2\b/.test(t))) tri = 2;
  else if (/\b3\s*º|terceiro|3\s*tri/i.test(raw) || (t.includes('trimestre') && /\b3\b/.test(t))) tri = 3;

  if (tri !== null) {
    const tl = raw.toLowerCase();
    if (/\bmac\b/.test(tl)) return `${tri}T-MAC`;
    if (tri === 3 && (/\ben\b|exame\s*nacional|exame nacional/i.test(tl))) return '3T-EN';
    if (/\bnpp\b/.test(tl)) return `${tri}T-NPP`;
    if (/\bnpt\b/.test(tl)) return `${tri}T-NPT`;
    const sub = /\bp1\b|prova\s*1|^\s*p1\s*$/i.test(raw)
      ? 'P1'
      : /\bp2\b|prova\s*2|^\s*p2\s*$/i.test(raw)
        ? 'P2'
        : /\bp3\b|prova\s*3|^\s*p3\s*$/i.test(raw)
          ? 'P3'
          : null;
    if (sub) return `${tri}T-${sub}`;
    if (t.includes('trimestre')) return `${tri}T-P1`;
  }
  return null;
}

/** Mapeia chave da grelha (ex.: 1T-P1) → avaliação ou exame da turma (primeiro por chave). */
function buildTipoLancamentoMap(
  avaliacoes: any[],
  exames: any[],
  isSecundario: boolean
): Record<string, { avaliacaoId?: string; exameId?: string }> {
  const out: Record<string, { avaliacaoId?: string; exameId?: string }> = {};
  const put = (key: string, field: 'avaliacaoId' | 'exameId', id: string) => {
    if (!key || !id) return;
    if (!out[key]) out[key] = {};
    if (out[key][field]) return;
    out[key][field] = id;
  };

  const avList = Array.isArray(avaliacoes) ? avaliacoes : [];
  const exList = Array.isArray(exames) ? exames : [];

  for (const av of avList) {
    const key = mapNotaToGridKey({ avaliacao: av }, isSecundario);
    if (key) put(key, 'avaliacaoId', av.id);
  }
  for (const ex of exList) {
    const key = mapNotaToGridKey({ exame: ex }, isSecundario);
    if (key) put(key, 'exameId', ex.id);
  }
  if (isSecundario && !out['3T-EN'] && out['3T-NPT']) {
    out['3T-EN'] = { ...out['3T-NPT'] };
  }
  return out;
}

function nomeCompletoMatricula(m: any): string {
  return (
    m?.aluno?.nomeCompleto ??
    m?.profiles?.nome_completo ??
    'N/A'
  );
}

/** Mesmo conjunto de tipos que o professor envia ao preview — paridade com o motor no backend. */
const TIPOS_PREVIEW_MOTOR_SECUNDARIO = [...TIPOS_SECUNDARIO_MERGE_KEYS, 'Prova Final', 'Recuperação'];

function valorTipoParaPreviewMotorSecundario(
  notasAluno: Record<string, { valor?: number } | undefined> | undefined,
  tipo: string,
): number | null {
  if (!notasAluno) return null;
  const g = (k: string) => {
    const v = notasAluno[k]?.valor;
    return v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null;
  };
  if (tipo === 'Recuperação') return g('REC');
  if (tipo === 'Prova Final') return g('3T-EN') ?? g('3T-NPT');
  return criarGetterSemanticoDasChavesGrid(notasAluno)(tipo);
}

/** Matrículas a partir da resposta de GET /notas/turma/alunos (paridade com Pautas / professor). */
function panelAlunosToMatriculas(alunos: unknown): any[] {
  if (!Array.isArray(alunos)) return [];
  return alunos.map((a: any) => ({
    id: a.matricula_id,
    alunoId: a.aluno_id,
    aluno: {
      id: a.aluno_id,
      nomeCompleto: a.nome_completo,
      numeroIdentificacaoPublica: a.numero_identificacao_publica ?? null,
    },
  }));
}

/** Notas “achatadas” para mapNotaToGridKey (tipo canónico no nome da avaliação sintética). */
function panelAlunosToFlatNotas(alunos: unknown): any[] {
  if (!Array.isArray(alunos)) return [];
  const out: any[] = [];
  for (const a of alunos as any[]) {
    const notasObj = a?.notas;
    if (!notasObj || typeof notasObj !== 'object') continue;
    for (const [tipoKey, entry] of Object.entries(notasObj)) {
      if (entry == null || typeof entry !== 'object') continue;
      const id = (entry as { id?: string }).id;
      const valor = Number((entry as { valor?: unknown }).valor);
      if (!id || !Number.isFinite(valor)) continue;
      out.push({
        id,
        valor,
        alunoId: a.aluno_id,
        matriculaId: a.matricula_id,
        matricula_id: a.matricula_id,
        avaliacao: { nome: tipoKey, tipo: tipoKey },
        exame: null,
      });
    }
  }
  return out;
}

// =============================================
// STATUS DO ALUNO
// =============================================
type StatusAluno = 'aprovado' | 'recurso' | 'reprovado' | 'pendente' | 'freq_baixa' | 'em_curso';

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
        <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30 gap-1 max-w-[min(100%,200px)] whitespace-normal text-left h-auto py-1">
          <XCircle className="h-3 w-3 shrink-0" />
          Reprovado (média final)
        </Badge>
      );
    case 'em_curso':
      return (
        <Badge variant="secondary" className="gap-1 max-w-[min(100%,240px)] whitespace-normal text-left h-auto py-1">
          <RefreshCw className="h-3 w-3 shrink-0 opacity-70" />
          Ano letivo em curso — resultado não definitivo
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
  const { instituicaoId: tenantInstituicaoId, shouldFilter } = useTenantFilter();
  const { instituicaoId: contextoInstituicaoId, instituicao, isSecundario } = useInstituicao();
  const { user, role } = useAuth();
  const instituicaoId =
    tenantInstituicaoId ||
    contextoInstituicaoId ||
    instituicao?.id ||
    (user as { instituicao_id?: string; instituicaoId?: string })?.instituicao_id ||
    (user as { instituicaoId?: string })?.instituicaoId ||
    null;
  const queryClient = useQueryClient();
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [selectedPlanoEnsinoId, setSelectedPlanoEnsinoId] = useState<string>('');
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isProfessor = role === 'PROFESSOR';

  const labels = {
    turma: 'Turma',
    curso: isSecundario ? 'Série' : 'Curso',
  };

  const { data: parametrosPauta } = useQuery({
    queryKey: ['parametros-sistema-notas-tab', instituicaoId],
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
  const thresholdsNotasTab = useMemo(
    () => ({
      notaMinimaAprovacao: Number(parametrosPauta?.percentualMinimoAprovacao ?? NOTA_APROVACAO),
      notaMinRecurso: Number(parametrosPauta?.notaMinimaZonaExameRecurso ?? NOTA_MINIMA_ZONA_RECURSO_PADRAO),
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
  const usarNppNaMediaTrimestral = useMemo(
    () => secundarioUsaNppNaMediaTrimestral(parametrosPauta as Record<string, unknown> | undefined),
    [parametrosPauta],
  );
  const colunasUniversidade = useMemo(
    () => buildColunasUniversidade(labelsPautaSup),
    [labelsPautaSup],
  );

  // Fetch turmas
  // P0: Professor usa getTurmasProfessor (JWT resolve professorId). Admin usa getAll.
  const { data: turmas = [] } = useQuery({
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

  const selectedTurmaData = turmas.find((t: any) => getTurmaRowId(t) === String(selectedTurma));
  const anoLetivo =
    selectedTurmaData?.ano ??
    selectedTurmaData?.anoLetivoRef?.ano ??
    new Date().getFullYear();

  const isTrimestreFechado = (trimestre: number): boolean => {
    return trimestresFechados.some(
      (tf: any) => tf.ano_letivo === anoLetivo && tf.trimestre === trimestre && tf.fechado
    );
  };

  const { data: planosTurmaRaw = [], isLoading: planosTurmaLoading } = useQuery({
    queryKey: ['turma-planos-lancamento-notas', selectedTurma, isProfessor, (user as any)?.professorId],
    queryFn: async () => {
      if (!selectedTurma) return [];
      const raw = await planoEnsinoApi.getAll({ turmaId: selectedTurma });
      return Array.isArray(raw) ? raw : [];
    },
    enabled: isValidTurmaSelection(selectedTurma),
  });

  const planosTurma = React.useMemo(() => {
    const list = Array.isArray(planosTurmaRaw) ? planosTurmaRaw : [];
    if (!isProfessor) return list;
    const pid = (user as any)?.professorId;
    if (!pid) return list;
    return list.filter((p: any) => String(p.professorId) === String(pid));
  }, [planosTurmaRaw, isProfessor, user]);

  useEffect(() => {
    setSelectedPlanoEnsinoId('');
  }, [selectedTurma]);

  useEffect(() => {
    if (planosTurma.length === 1 && planosTurma[0]?.id) {
      setSelectedPlanoEnsinoId(planosTurma[0].id);
    }
  }, [planosTurma, selectedTurma]);

  const effectivePlanoId: string | null =
    planosTurma.length === 0
      ? null
      : planosTurma.length === 1
        ? planosTurma[0]?.id ?? null
        : selectedPlanoEnsinoId || null;

  const awaitingPlanoPick =
    !planosTurmaLoading && planosTurma.length > 1 && !selectedPlanoEnsinoId;
  const filterByPlano = effectivePlanoId != null;

  const selectedPlanoData = planosTurma.find((p: any) => p.id === effectivePlanoId);

  const painelTurmaReady =
    isValidTurmaSelection(selectedTurma) && !planosTurmaLoading && !awaitingPlanoPick;

  const {
    data: painelTurmaRes,
    isLoading: painelTurmaLoading,
    isError: painelTurmaQueryError,
    error: painelTurmaErr,
    refetch: refetchPainelTurma,
  } = useQuery({
    queryKey: ['turma-alunos-notas', selectedTurma, effectivePlanoId ?? '', role, user?.id],
    queryFn: async () =>
      notasApi.getAlunosNotasByTurma(selectedTurma, effectivePlanoId ?? undefined),
    enabled: painelTurmaReady,
  });

  const matriculas = React.useMemo(
    () => panelAlunosToMatriculas(painelTurmaRes?.alunos),
    [painelTurmaRes?.alunos],
  );

  const notas = React.useMemo(
    () => panelAlunosToFlatNotas(painelTurmaRes?.alunos),
    [painelTurmaRes?.alunos],
  );

  const matriculasLoading = painelTurmaLoading;
  const notasLoading = painelTurmaLoading;

  const { data: avaliacoesTurma = [] } = useQuery({
    queryKey: ['turma-avaliacoes-lancamento', selectedTurma],
    queryFn: async () => {
      const raw = await avaliacoesApi.getAll({ turmaId: selectedTurma });
      return Array.isArray(raw) ? raw : [];
    },
    enabled: isValidTurmaSelection(selectedTurma),
  });

  const { data: examesTurma = [] } = useQuery({
    queryKey: ['turma-exames-lancamento', selectedTurma],
    queryFn: async () => {
      const raw = await examesApi.getAll({ turmaId: selectedTurma });
      return Array.isArray(raw) ? raw : [];
    },
    enabled: isValidTurmaSelection(selectedTurma),
  });

  const avaliacoesVisiveis = React.useMemo(() => {
    if (!filterByPlano || !effectivePlanoId) return avaliacoesTurma;
    return avaliacoesTurma.filter((a: any) => a.planoEnsinoId === effectivePlanoId);
  }, [avaliacoesTurma, filterByPlano, effectivePlanoId]);

  const examesVisiveis = React.useMemo(() => {
    if (!filterByPlano || !effectivePlanoId) return examesTurma;
    return examesTurma.filter((e: any) => e.planoEnsinoId === effectivePlanoId);
  }, [examesTurma, filterByPlano, effectivePlanoId]);

  // GET /notas/turma/alunos já filtra por planoEnsinoId quando enviado (admin/professor).
  const notasVisiveis = notas;

  const tipoLancamentoMap = React.useMemo(
    () => buildTipoLancamentoMap(avaliacoesVisiveis, examesVisiveis, isSecundario),
    [avaliacoesVisiveis, examesVisiveis, isSecundario]
  );

  const lancamentoMetaRef = useRef<{
    tipoMap: Record<string, { avaliacaoId?: string; exameId?: string }>;
    matriculas: any[];
  }>({ tipoMap: {}, matriculas: [] });

  useEffect(() => {
    lancamentoMetaRef.current = { tipoMap: tipoLancamentoMap, matriculas };
  }, [tipoLancamentoMap, matriculas]);

  const { data: historicoNotas = [] } = useQuery({
    queryKey: ['notas-historico', selectedTurma, effectivePlanoId],
    queryFn: async () => {
      if (!selectedTurma) return [];
      const mats = matriculas as any[];
      if (mats.length === 0) return [];
      const allHistorico = await Promise.all(
        mats.slice(0, 10).map((m: any) => notasHistoricoApi.getAll({ matriculaId: m.id })),
      );
      return allHistorico.flat().slice(0, 50);
    },
    enabled: painelTurmaReady && isAdmin && (matriculas as any[]).length > 0,
  });

  // REGRA: Apenas ADMIN pode editar notas diretamente
  // Professores editam notas via Plano de Ensino / Avaliações
  const canEditTurma = isAdmin;

  // Criar mapa de notas (matrícula → tipo na grelha → nota)
  const notasMap = React.useMemo(() => {
    const map: Record<string, Record<string, { id: string; valor: number }>> = {};
    const alunoToMatricula = new Map<string, string>();
    (matriculas as any[]).forEach((m: any) => {
      const aid = m.alunoId ?? m.aluno?.id;
      if (aid) alunoToMatricula.set(aid, m.id);
    });
    notasVisiveis.forEach((nota: any) => {
      const mid =
        nota.matriculaId ??
        nota.matricula_id ??
        alunoToMatricula.get(nota.alunoId ?? nota.aluno_id);
      if (!mid) return;
      const gridKey = mapNotaToGridKey(nota, isSecundario);
      if (!gridKey) return;
      const valor = nota.valor != null ? Number(nota.valor) : NaN;
      if (!Number.isFinite(valor)) return;
      if (!map[mid]) map[mid] = {};
      map[mid][gridKey] = { id: nota.id, valor };
    });
    for (const row of Object.values(map)) {
      if (!row['3T-EN'] && row['3T-NPT']) {
        row['3T-EN'] = { ...row['3T-NPT'] };
      }
    }
    return map;
  }, [notasVisiveis, matriculas, isSecundario]);

  const keysComDadosSecundario = React.useMemo(() => {
    if (!isSecundario) return new Set<string>();
    const s = new Set<string>();
    for (const nota of notasVisiveis) {
      const k = mapNotaToGridKey(nota, true);
      if (k && /^[123]T-/.test(k)) s.add(k);
    }
    for (const row of Object.values(notasMap)) {
      for (const k of Object.keys(row)) {
        if (/^[123]T-/.test(k)) s.add(k);
      }
    }
    return s;
  }, [isSecundario, notasVisiveis, notasMap]);

  const modosTrimestreSecundario = React.useMemo(() => {
    if (!isSecundario) return null;
    return normalizeModosTrimestreSecundario(tipoLancamentoMap, keysComDadosSecundario);
  }, [isSecundario, tipoLancamentoMap, keysComDadosSecundario]);

  const grelhaSecSoAngola =
    !!modosTrimestreSecundario &&
    modosTrimestreSecundario[1] === 'angola' &&
    modosTrimestreSecundario[2] === 'angola' &&
    modosTrimestreSecundario[3] === 'angola';

  const previewSecundarioPayload = useMemo(() => {
    if (!grelhaSecSoAngola || !instituicaoId || matriculas.length === 0) return null;
    return {
      alunos: (matriculas as any[]).map((m: any) => ({
        matriculaId: m.id,
        notas: TIPOS_PREVIEW_MOTOR_SECUNDARIO.map((tipo) => ({
          tipo,
          valor: valorTipoParaPreviewMotorSecundario(notasMap[m.id], tipo),
        })),
      })),
    };
  }, [grelhaSecSoAngola, instituicaoId, matriculas, notasMap]);

  const [debouncedPreviewMotorPayload, setDebouncedPreviewMotorPayload] = useState<typeof previewSecundarioPayload>(null);
  useEffect(() => {
    const tid = window.setTimeout(() => setDebouncedPreviewMotorPayload(previewSecundarioPayload), 400);
    return () => window.clearTimeout(tid);
  }, [previewSecundarioPayload]);

  const { data: previewMotorSecundario, isFetching: previewMotorFetching } = useQuery({
    queryKey: ['preview-secundario-pauta-exames', debouncedPreviewMotorPayload],
    queryFn: () => notasApi.previewSecundarioPautaExames(debouncedPreviewMotorPayload!),
    enabled: Boolean(
      debouncedPreviewMotorPayload?.alunos?.length && instituicaoId && grelhaSecSoAngola,
    ),
    staleTime: 0,
    gcTime: 120_000,
  });

  const previewMotorPorMatricula = useMemo(() => {
    const m = new Map<string, (typeof previewMotorSecundario)['alunos'][number]>();
    if (!previewMotorSecundario?.alunos) return m;
    for (const row of previewMotorSecundario.alunos) {
      m.set(row.matriculaId, row);
    }
    return m;
  }, [previewMotorSecundario]);

  const mapPreviewMotorStatusParaTab = (s: string): StatusAluno => {
    switch (s) {
      case 'APROVADO':
        return 'aprovado';
      case 'REPROVADO':
      case 'REPROVADO_FALTA':
        return 'reprovado';
      case 'EXAME_RECURSO':
        return 'recurso';
      case 'EM_CURSO':
        return 'em_curso';
      default:
        return 'pendente';
    }
  };

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
        const { tipoMap, matriculas: mats } = lancamentoMetaRef.current;
        const m = mats.find((x: any) => x.id === matriculaId);
        const alunoId = m?.alunoId ?? m?.aluno?.id;
        if (!alunoId) {
          throw new Error('Não foi possível identificar o estudante desta matrícula.');
        }
        const dest = tipoMap[tipo];
        if (dest?.avaliacaoId) {
          await notasApi.create({ alunoId, avaliacaoId: dest.avaliacaoId, valor });
        } else if (dest?.exameId) {
          await notasApi.create({ alunoId, exameId: dest.exameId, valor });
        } else {
          throw new Error(
            'Não há avaliação nem exame configurado para esta célula. Crie as avaliações no Plano de Ensino (ou exames na turma) com nome/tipo reconhecível pelo trimestre.'
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-alunos-notas'] });
      queryClient.invalidateQueries({ queryKey: ['notas-historico'] });
      queryClient.invalidateQueries({ queryKey: ['preview-secundario-pauta-exames'] });
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
      queryClient.invalidateQueries({ queryKey: ['turma-alunos-notas'] });
      queryClient.invalidateQueries({ queryKey: ['notas-historico'] });
      queryClient.invalidateQueries({ queryKey: ['preview-secundario-pauta-exames'] });
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
    const prevRow = previewMotorPorMatricula.get(matriculaId);
    if (grelhaSecSoAngola && prevRow) {
      const mt = trimestre === 1 ? prevRow.mt1 : trimestre === 2 ? prevRow.mt2 : prevRow.mt3;
      if (mt != null) return Math.round(mt * 10) / 10;
    }
    const notasAluno = notasMap[matriculaId];
    if (!notasAluno) return null;
    const getSem = criarGetterSemanticoDasChavesGrid(notasAluno);
    const getValor = (tipo: string): number | null => {
      const v = getSem(tipo);
      if (v != null) return v;
      const m = String(tipo || '').match(/^([123])º\s*Trimestre$/);
      if (m) {
        const tr = Number(m[1]);
        const p1 = notasAluno[`${tr}T-P1`]?.valor;
        const p2 = notasAluno[`${tr}T-P2`]?.valor;
        const p3 = notasAluno[`${tr}T-P3`]?.valor;
        if (p1 !== undefined && p2 !== undefined && p3 !== undefined) {
          return Math.round(((p1 + p2 + p3) / 3) * 10) / 10;
        }
      }
      return null;
    };
    const { mt1, mt2, mt3 } = obterMediasTrimestraisSecundario(getValor, pesosMTSec, {
      usarNppNaMediaTrimestral,
    });
    const mt = trimestre === 1 ? mt1 : trimestre === 2 ? mt2 : mt3;
    return mt !== null ? Math.round(mt * 10) / 10 : null;
  };

  const calcularMediaAnualEM = (matriculaId: string): number | null => {
    const prevRow = previewMotorPorMatricula.get(matriculaId);
    if (
      grelhaSecSoAngola &&
      prevRow &&
      prevRow.mt1 != null &&
      prevRow.mt2 != null &&
      prevRow.mt3 != null &&
      prevRow.media != null
    ) {
      return Math.round(prevRow.media * 10) / 10;
    }
    const mt1 = calcularMediaTrimestreEM(matriculaId, 1);
    const mt2 = calcularMediaTrimestreEM(matriculaId, 2);
    const mt3 = calcularMediaTrimestreEM(matriculaId, 3);

    if (mt1 === null || mt2 === null || mt3 === null) return null;
    return Math.round(((mt1 + mt2 + mt3) / 3) * 10) / 10;
  };

  const calcularMediaFinalEM = (matriculaId: string): number | null => {
    const prevRow = previewMotorPorMatricula.get(matriculaId);
    if (
      grelhaSecSoAngola &&
      prevRow &&
      prevRow.mt1 != null &&
      prevRow.mt2 != null &&
      prevRow.mt3 != null &&
      prevRow.mediaFinal != null
    ) {
      return Math.round(prevRow.mediaFinal * 10) / 10;
    }
    const mt1 = calcularMediaTrimestreEM(matriculaId, 1);
    const mt2 = calcularMediaTrimestreEM(matriculaId, 2);
    const mt3 = calcularMediaTrimestreEM(matriculaId, 3);
    const notasAluno = notasMap[matriculaId];
    const recuperacao = notasAluno?.['REC']?.valor;
    const mf = calcularMediaFinalEnsinoMedio(
      mt1,
      mt2,
      mt3,
      recuperacao !== undefined ? recuperacao : null,
      thresholdsNotasTab,
    );
    return mf !== null ? Math.round(mf * 10) / 10 : null;
  };

  const getStatusAlunoEM = (matriculaId: string): StatusAluno => {
    const prevRow = previewMotorPorMatricula.get(matriculaId);
    if (
      grelhaSecSoAngola &&
      prevRow &&
      prevRow.mt1 != null &&
      prevRow.mt2 != null &&
      prevRow.mt3 != null
    ) {
      return mapPreviewMotorStatusParaTab(prevRow.status);
    }
    const mediaAnual = calcularMediaAnualEM(matriculaId);
    if (mediaAnual === null) return 'pendente';

    const { notaMinimaAprovacao, notaMinRecurso, permitirExameRecurso } = thresholdsNotasTab;
    const notasAluno = notasMap[matriculaId];
    const recuperacao = notasAluno?.['REC']?.valor;

    if (mediaAnual >= notaMinimaAprovacao) return 'aprovado';
    if (mediaAnual < notaMinRecurso) return 'reprovado';
    if (permitirExameRecurso && recuperacao === undefined) return 'recurso';
    if (permitirExameRecurso && recuperacao !== undefined) {
      const novaMedia = (mediaAnual + recuperacao) / 2;
      return novaMedia >= notaMinimaAprovacao ? 'aprovado' : 'reprovado';
    }
    return 'reprovado';
  };

  const precisaRecuperacaoEM = (matriculaId: string): boolean => {
    const prevRow = previewMotorPorMatricula.get(matriculaId);
    if (grelhaSecSoAngola && prevRow?.status === 'EXAME_RECURSO') return true;
    const mediaAnual = calcularMediaAnualEM(matriculaId);
    if (mediaAnual === null) return false;
    const { notaMinimaAprovacao, notaMinRecurso, permitirExameRecurso } = thresholdsNotasTab;
    return (
      permitirExameRecurso &&
      mediaAnual >= notaMinRecurso &&
      mediaAnual < notaMinimaAprovacao
    );
  };

  // =============================================
  // CÁLCULOS PARA UNIVERSIDADE (paridade com ParametrosSistema + backend)
  // =============================================
  const getValoresUni = (matriculaId: string) => {
    const row = notasMap[matriculaId];
    return {
      p1: row?.['P1']?.valor,
      p2: row?.['P2']?.valor,
      p3: row?.['P3']?.valor,
      trab: row?.['TRAB']?.valor,
      exame: row?.['EXAME']?.valor,
    };
  };

  const calcularMediaFinalUni = (matriculaId: string): number | null => {
    const { p1, p2, p3, trab, exame } = getValoresUni(matriculaId);
    return calcularMediaFinalUniversidade(
      p1 !== undefined ? p1 : null,
      p2 !== undefined ? p2 : null,
      p3 !== undefined ? p3 : null,
      trab !== undefined ? trab : null,
      exame !== undefined ? exame : null,
      thresholdsNotasTab,
      opSuperiorPauta,
    );
  };

  const getFrequenciaUni = (matriculaId: string): number | null => {
    const notasAluno = notasMap[matriculaId];
    return notasAluno?.['FREQ']?.valor ?? null;
  };

  const getStatusAlunoUni = (matriculaId: string): StatusAluno => {
    const frequencia = getFrequenciaUni(matriculaId);
    const { p1, p2, p3, trab, exame } = getValoresUni(matriculaId);
    const r = resultadoCalculoSuperiorPauta(
      p1 !== undefined ? p1 : null,
      p2 !== undefined ? p2 : null,
      p3 !== undefined ? p3 : null,
      trab !== undefined ? trab : null,
      exame !== undefined ? exame : null,
      thresholdsNotasTab,
      opSuperiorPauta,
    );
    if (r == null && p1 === undefined && p2 === undefined && p3 === undefined) return 'pendente';
    if (r == null) return 'pendente';

    const { notaMinimaAprovacao, notaMinRecurso, permitirExameRecurso } = thresholdsNotasTab;
    if (frequencia !== null && frequencia < 75) return 'freq_baixa';
    if (r.status === 'EM_CURSO') return 'em_curso';
    const mf = r.media_final;
    if (mf >= notaMinimaAprovacao) return 'aprovado';
    if (mf < notaMinRecurso) return 'reprovado';
    if (permitirExameRecurso && exame === undefined) return 'recurso';
    return 'reprovado';
  };

  const precisaExameUni = (matriculaId: string): boolean => {
    const frequencia = getFrequenciaUni(matriculaId);
    const { p1, p2, p3, trab, exame } = getValoresUni(matriculaId);
    if (exame !== undefined) return false;
    if (frequencia !== null && frequencia < 75) return false;
    const r = resultadoCalculoSuperiorPauta(
      p1 !== undefined ? p1 : null,
      p2 !== undefined ? p2 : null,
      p3 !== undefined ? p3 : null,
      trab !== undefined ? trab : null,
      null,
      thresholdsNotasTab,
      opSuperiorPauta,
    );
    if (r == null) return false;
    const { notaMinimaAprovacao, notaMinRecurso, permitirExameRecurso } = thresholdsNotasTab;
    return (
      permitirExameRecurso &&
      r.media_final >= notaMinRecurso &&
      r.media_final < notaMinimaAprovacao
    );
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
      // em_curso e pendente não entram em reprovados
    });

    return {
      media: countMedias > 0 ? safeToFixed(somaMedias / countMedias, 1) : '—',
      aprovados,
      recurso,
      reprovados,
      total: matriculas.length
    };
  }, [
    matriculas,
    notasMap,
    isSecundario,
    thresholdsNotasTab,
    opSuperiorPauta,
    pesosMTSec,
    usarNppNaMediaTrimestral,
    modosTrimestreSecundario,
    previewMotorPorMatricula,
    grelhaSecSoAngola,
  ]);

  // Dados para exportação
  const exportData = React.useMemo(() => {
    return matriculas.map((m: any) => {
      const row: string[] = [nomeCompletoMatricula(m)];
      
      if (isSecundario && modosTrimestreSecundario) {
        [1, 2, 3].forEach((tri) => {
          const cols = colunasTrimestreSecundario(tri, modosTrimestreSecundario[tri], usarNppNaMediaTrimestral);
          cols.forEach((col) => {
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
        colunasUniversidade.forEach(col => {
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
        status === 'reprovado' ? 'Reprovado (média final)' :
        status === 'freq_baixa' ? 'Rep. Frequência' :
        status === 'em_curso' ? 'Ano letivo em curso — resultado não definitivo' :
        'Pendente'
      );
      return row;
    });
  }, [
    matriculas,
    notasMap,
    isSecundario,
    thresholdsNotasTab,
    opSuperiorPauta,
    pesosMTSec,
    usarNppNaMediaTrimestral,
    modosTrimestreSecundario,
    previewMotorPorMatricula,
    grelhaSecSoAngola,
  ]);

  const exportColunas = React.useMemo(() => {
    const cols = ['Aluno'];
    if (isSecundario && modosTrimestreSecundario) {
      [1, 2, 3].forEach((tri) => {
        colunasTrimestreSecundario(tri, modosTrimestreSecundario[tri], usarNppNaMediaTrimestral).forEach((c) =>
          cols.push(c.fullLabel),
        );
        cols.push(`MT${tri}`);
      });
      cols.push('Recuperação');
    } else {
      colunasUniversidade.forEach(c => cols.push(c.fullLabel));
    }
    cols.push('Média Final', 'Situação');
    return cols;
  }, [isSecundario, modosTrimestreSecundario, colunasUniversidade, usarNppNaMediaTrimestral]);

  const getMediaColor = (media: number | null) => {
    if (media === null) return 'text-muted-foreground';
    if (media >= 14) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10';
    if (media >= 10) return 'text-blue-600 dark:text-blue-400 bg-blue-500/10';
    if (media >= 7) return 'text-amber-600 dark:text-amber-400 bg-amber-500/10';
    return 'text-red-600 dark:text-red-400 bg-red-500/10';
  };

  const canShowPauta = !!selectedTurma && !planosTurmaLoading && !awaitingPlanoPick;
  const pautaLoading =
    !!selectedTurma && (matriculasLoading || notasLoading || planosTurmaLoading);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight" data-testid="admin-notas-turma-heading">
                Lançamento de notas (turma)
              </h2>
              <p className="text-muted-foreground text-sm max-w-xl">
                {isSecundario
                  ? 'Institucional: as notas vinculam-se ao Plano de Ensino (disciplina) e às avaliações. Selecione a turma e, havendo várias disciplinas, o plano correspondente.'
                  : 'Institucional: as notas vinculam-se ao Plano de Ensino e às avaliações/exames da disciplina. Selecione turma e plano quando aplicável.'}
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                {isSecundario
                  ? grelhaSecSoAngola
                    ? 'Secundário: grelha só mini-pauta (MAC+NPT nos dois primeiros trimestres, MAC+EN no III) + MT · MFD/recuperação conforme Configuração.'
                    : 'Secundário: colunas por trimestre ajustam-se ao plano (P1–P3 e/ou mini-pauta) · MFD/recuperação conforme Configuração.'
                  : opSuperiorPauta.modeloPauta === 'AC_EXAME_PONDERADO'
                    ? 'Superior: NF = MC×peso + Exame×peso (parâmetros) · recurso: média com NF ou aprovação direta.'
                    : 'Superior (3 provas): MP = média das provas com 80%/20% se houver trabalho · exame recurso quando aplicável.'}
              </p>
              {isSecundario && grelhaSecSoAngola && (
                <p className="text-xs mt-2 text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    MT, média final e situação usam o{' '}
                    <strong className="font-medium text-foreground">mesmo motor</strong> que em Avaliações e notas (servidor).
                  </span>
                  {previewMotorFetching ? (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      A atualizar…
                    </span>
                  ) : previewMotorSecundario ? (
                    <span className="text-[11px] rounded-md border bg-muted/40 px-2 py-0.5 font-mono">
                      {previewMotorSecundario.templateId} · v{previewMotorSecundario.templateVersion}
                    </span>
                  ) : null}
                  {isAdmin ? (
                    <>
                      <Link
                        to="/admin-dashboard/configuracoes?tab=geral#cfg-motor-mini-pauta"
                        className="text-primary underline-offset-2 hover:underline whitespace-nowrap"
                      >
                        Motor da instituição
                      </Link>
                      <span className="text-[11px]">·</span>
                    </>
                  ) : null}
                  <Link
                    to="/admin-dashboard/configuracao-ensino"
                    className="text-primary underline-offset-2 hover:underline whitespace-nowrap"
                  >
                    Configuração de ensino
                  </Link>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 lg:items-start">
            <Select value={selectedTurma} onValueChange={setSelectedTurma}>
              <SelectTrigger className="w-full sm:w-[280px] h-11" data-testid="admin-notas-select-turma">
                <SelectValue placeholder={`Selecione uma ${labels.turma}`} />
              </SelectTrigger>
              <SelectContent>
                {turmas.map((turma: any, index: number) => {
                  const pk = getTurmaRowId(turma);
                  if (!pk) return null;
                  return (
                  <SelectItem
                    key={pk}
                    value={pk}
                    data-testid={index === 0 ? 'admin-notas-turma-option-first' : undefined}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{turma.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {(isSecundario ? turma.classe?.nome : turma.curso?.nome) || '—'} •{' '}
                        {turma.ano ?? turma.anoLetivoRef?.ano ?? '—'}
                      </span>
                    </div>
                  </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {selectedTurma && planosTurma.length > 1 && (
              <Select value={selectedPlanoEnsinoId} onValueChange={setSelectedPlanoEnsinoId}>
                <SelectTrigger
                  className="w-full sm:w-[300px] h-11"
                  data-testid="admin-notas-select-plano"
                >
                  <SelectValue placeholder="Disciplina (Plano de Ensino)" />
                </SelectTrigger>
                <SelectContent>
                  {planosTurma.map((plano: any) => (
                    <SelectItem key={plano.id} value={plano.id}>
                      <div className="flex flex-col gap-0.5 py-0.5">
                        <span className="font-medium">{labelPlanoEnsino(plano, isSecundario)}</span>
                        {plano.estado && (
                          <span className="text-[10px] text-muted-foreground">{plano.estado}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {selectedTurma && planosTurma.length === 1 && selectedPlanoData && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="font-normal">
              Plano: {labelPlanoEnsino(selectedPlanoData, isSecundario)}
            </Badge>
            {selectedPlanoData.estado && (
              <Badge variant="secondary" className="text-xs font-normal">
                {selectedPlanoData.estado}
              </Badge>
            )}
          </div>
        )}

        {selectedTurma && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Fluxo alinhado à instituição</AlertTitle>
            <AlertDescription className="text-sm">
              O lançamento oficial de notas ocorre no contexto de um <strong>Plano de Ensino</strong> (disciplina)
              e das respetivas <strong>avaliações</strong>. Esta grelha mostra apenas as notas do plano selecionado.
              {planosTurma.length === 0 && (
                <>
                  {' '}
                  Esta turma ainda não tem planos de ensino associados: está em modo de consulta agregada (todas as
                  notas da turma). Para o modelo completo, crie planos em Configuração de ensino.
                </>
              )}
              {planosTurma.length > 1 && (
                <> Escolha a disciplina no segundo seletor antes de lançar ou consultar a pauta.</>
              )}{' '}
              {isProfessor ? (
                <a
                  className="text-primary underline underline-offset-2 font-medium"
                  href="/painel-professor/notas"
                >
                  Abrir lançamento de notas (área do professor)
                </a>
              ) : (
                <a
                  className="text-primary underline underline-offset-2 font-medium"
                  href="/admin-dashboard/configuracao-ensino?tab=avaliacoes-notas"
                >
                  Abrir Avaliações e notas (Configuração de ensino)
                </a>
              )}
            </AlertDescription>
          </Alert>
        )}

        {awaitingPlanoPick && (
          <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/5 text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle>Selecione a disciplina</AlertTitle>
            <AlertDescription>
              Esta turma tem vários planos de ensino. Escolha o plano (disciplina) no menu acima para ver e lançar
              notas no contexto institucional correto.
            </AlertDescription>
          </Alert>
        )}

        {painelTurmaQueryError && canShowPauta && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar alunos e notas</AlertTitle>
            <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">
                {(painelTurmaErr as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                  (painelTurmaErr instanceof Error ? painelTurmaErr.message : 'Verifique a ligação e tente novamente.')}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => refetchPainelTurma()}>
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {selectedTurma && planosTurmaLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            A carregar planos de ensino da turma…
          </div>
        )}
      </div>

      {/* Estatísticas */}
      {canShowPauta && matriculas.length > 0 && (
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
      {canShowPauta && (
        <Card className="border-border/50 shadow-sm" data-testid="admin-notas-pauta-card">
          <CardHeader className="pb-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Pauta de Notas</CardTitle>
                  <CardDescription className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <Badge variant="secondary" className="font-normal w-fit">
                      <Users className="h-3 w-3 mr-1" />
                      {matriculas.length} aluno(s)
                    </Badge>
                    {filterByPlano && selectedPlanoData && (
                      <span className="text-xs text-muted-foreground">
                        Contexto: {labelPlanoEnsino(selectedPlanoData, isSecundario)}
                      </span>
                    )}
                    {!filterByPlano && planosTurma.length === 0 && (
                      <span className="text-xs text-amber-700 dark:text-amber-400">
                        Consulta agregada (sem plano único na turma)
                      </span>
                    )}
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {matriculas.length > 0 && (
                  <ExportButtons
                    titulo={
                      filterByPlano && selectedPlanoData
                        ? `Pauta — ${labelPlanoEnsino(selectedPlanoData, isSecundario)}`
                        : 'Pauta de Notas (turma)'
                    }
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
            {pautaLoading ? (
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
                  <Table data-testid="admin-notas-lancamento-table">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold sticky left-0 bg-muted/50 z-10 min-w-[160px]">
                          Aluno
                        </TableHead>
                        {isSecundario && modosTrimestreSecundario ? (
                          <>
                            {([1, 2, 3] as const).map((tri) => {
                              const span =
                                colunasTrimestreSecundario(tri, modosTrimestreSecundario[tri], usarNppNaMediaTrimestral).length + 1;
                              const bg =
                                tri === 1
                                  ? 'bg-blue-500/5'
                                  : tri === 2
                                    ? 'bg-emerald-500/5'
                                    : 'bg-violet-500/5';
                              const label =
                                tri === 1
                                  ? labelsPautaSec.periodo1
                                  : tri === 2
                                    ? labelsPautaSec.periodo2
                                    : labelsPautaSec.periodo3;
                              return (
                                <TableHead
                                  key={tri}
                                  colSpan={span}
                                  className={`text-center font-semibold border-l ${bg}`}
                                >
                                  {label}
                                </TableHead>
                              );
                            })}
                            <TableHead className="text-center font-semibold border-l bg-amber-500/5">
                              {labelsPautaSec.recuperacao}
                            </TableHead>
                          </>
                        ) : !isSecundario ? (
                          colunasUniversidade.map(col => (
                            <TableHead key={col.key} className={`text-center font-semibold min-w-[70px] ${col.isExame ? 'bg-amber-500/5' : ''}`}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">{col.label}</span>
                                </TooltipTrigger>
                                <TooltipContent>{col.fullLabel}</TooltipContent>
                              </Tooltip>
                            </TableHead>
                          ))
                        ) : null}
                        <TableHead className="text-center font-semibold bg-primary/10 border-l min-w-[70px]">
                          MF
                        </TableHead>
                        <TableHead className="text-center font-semibold bg-primary/10 min-w-[100px]">
                          Situação
                        </TableHead>
                      </TableRow>
                      {isSecundario && modosTrimestreSecundario && (
                        <TableRow className="bg-muted/30">
                          <TableHead className="sticky left-0 bg-muted/30 z-10" />
                          {([1, 2, 3] as const).map((tri) => {
                            const colsTri = colunasTrimestreSecundario(tri, modosTrimestreSecundario[tri], usarNppNaMediaTrimestral);
                            return (
                              <React.Fragment key={tri}>
                                {colsTri.map((col, idx) => (
                                  <TableHead
                                    key={col.key}
                                    className={`text-center text-xs font-medium ${idx === 0 ? 'border-l' : ''}`}
                                  >
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help">{col.label}</span>
                                      </TooltipTrigger>
                                      <TooltipContent>{col.fullLabel}</TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                ))}
                                <TableHead className="text-center text-xs font-medium bg-muted/50">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help">{labelsPautaSec.mt}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {labelsPautaSec.mt} —{' '}
                                      {tri === 1
                                        ? labelsPautaSec.periodo1
                                        : tri === 2
                                          ? labelsPautaSec.periodo2
                                          : labelsPautaSec.periodo3}
                                    </TooltipContent>
                                  </Tooltip>
                                </TableHead>
                              </React.Fragment>
                            );
                          })}
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
                                  {nomeCompletoMatricula(matricula)}
                                </span>
                              </div>
                            </TableCell>
                            
                            {isSecundario && modosTrimestreSecundario ? (
                              <>
                                {([1, 2, 3] as const).map((tri) => {
                                  const mediaTri = calcularMediaTrimestreEM(matricula.id, tri);
                                  const disabled = !canEditTurma || isTrimestreFechado(tri);
                                  const colsTri = colunasTrimestreSecundario(tri, modosTrimestreSecundario[tri], usarNppNaMediaTrimestral);

                                  return (
                                    <React.Fragment key={tri}>
                                      {colsTri.map((col, idx) => {
                                        const key = col.key;
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
                            ) : !isSecundario ? (
                              colunasUniversidade.map((col) => {
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
                            ) : null}
                            
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
