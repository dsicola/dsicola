import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { configuracoesLandingApi } from '@/services/api';
import { landingConfigsToMap, getLandingCopy } from '@/utils/platformLandingCopy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SchoolCard } from '@/components/community/SchoolCard';
import { communityApi } from '@/services/communityApi';

const PAGE_SIZE = 24;

type ActiveFilterKey = 'cidade' | 'curso' | 'tipoAcademico' | 'tipoInstituicao';

const TIPO_INSTITUICAO_LABEL: Record<string, string> = {
  ENSINO_MEDIO: 'Ensino médio',
  UNIVERSIDADE: 'Universidade',
  MISTA: 'Mista',
  EM_CONFIGURACAO: 'Em configuração',
};

const ComunidadePage: React.FC = () => {
  const [cidade, setCidade] = useState('');
  const [curso, setCurso] = useState('');
  const [tipoAcademico, setTipoAcademico] = useState('any');
  const [tipoInstituicao, setTipoInstituicao] = useState('any');
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState({
    cidade: '',
    curso: '',
    tipoAcademico: '',
    tipoInstituicao: '',
  });

  const { data: landingConfigs } = useQuery({
    queryKey: ['configuracoes-landing-public'],
    queryFn: () => configuracoesLandingApi.getPublic(),
    staleTime: 60_000,
  });
  const copy = useMemo(() => landingConfigsToMap(landingConfigs), [landingConfigs]);
  const pageTitulo = getLandingCopy(copy, 'comunidade_pagina_titulo', 'Comunidade');
  const pageSub = getLandingCopy(copy, 'comunidade_pagina_subtitulo', 'Descoberta · público');
  const pageIntro = getLandingCopy(
    copy,
    'comunidade_pagina_intro',
    'Esta página é o marketplace de descoberta do DSICOLA: instituições ativas e o que divulgaram no diretório. A gestão académica e financeira fica no SaaS (painel); posts e comentários no Social.',
  );

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['community-institutions', applied, page],
    queryFn: async () => {
      const res = await communityApi.listInstitutions({
        page,
        pageSize: PAGE_SIZE,
        cidade: applied.cidade || undefined,
        curso: applied.curso || undefined,
        tipoAcademico: applied.tipoAcademico || undefined,
        tipoInstituicao: applied.tipoInstituicao || undefined,
      });
      return res.data;
    },
  });

  const applyFilters = () => {
    setPage(1);
    setApplied({
      cidade: cidade.trim(),
      curso: curso.trim(),
      tipoAcademico: tipoAcademico === 'any' ? '' : tipoAcademico,
      tipoInstituicao: tipoInstituicao === 'any' ? '' : tipoInstituicao,
    });
  };

  const clearFilters = () => {
    setCidade('');
    setCurso('');
    setTipoAcademico('any');
    setTipoInstituicao('any');
    setPage(1);
    setApplied({ cidade: '', curso: '', tipoAcademico: '', tipoInstituicao: '' });
  };

  const removeOneFilter = (key: ActiveFilterKey) => {
    setPage(1);
    if (key === 'cidade') {
      setCidade('');
      setApplied((p) => ({ ...p, cidade: '' }));
    } else if (key === 'curso') {
      setCurso('');
      setApplied((p) => ({ ...p, curso: '' }));
    } else if (key === 'tipoAcademico') {
      setTipoAcademico('any');
      setApplied((p) => ({ ...p, tipoAcademico: '' }));
    } else {
      setTipoInstituicao('any');
      setApplied((p) => ({ ...p, tipoInstituicao: '' }));
    }
  };

  const activeFilterChips: { key: ActiveFilterKey; label: string }[] = [];
  if (applied.cidade) {
    activeFilterChips.push({ key: 'cidade', label: `Local: ${applied.cidade}` });
  }
  if (applied.curso) {
    activeFilterChips.push({ key: 'curso', label: `Oferta: ${applied.curso}` });
  }
  if (applied.tipoAcademico) {
    activeFilterChips.push({
      key: 'tipoAcademico',
      label:
        applied.tipoAcademico === 'SECUNDARIO'
          ? 'Académico: Secundário'
          : 'Académico: Superior',
    });
  }
  if (applied.tipoInstituicao) {
    activeFilterChips.push({
      key: 'tipoInstituicao',
      label: `Instituição: ${TIPO_INSTITUICAO_LABEL[applied.tipoInstituicao] ?? applied.tipoInstituicao}`,
    });
  }

  const hasActiveFilters =
    applied.cidade.length > 0 ||
    applied.curso.length > 0 ||
    applied.tipoAcademico.length > 0 ||
    applied.tipoInstituicao.length > 0;

  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 0;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  useEffect(() => {
    const tp = data?.meta.totalPages ?? 0;
    if (tp > 0 && page > tp) {
      setPage(tp);
    }
  }, [data?.meta.totalPages, page]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{pageTitulo}</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{pageSub}</p>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm sm:text-base whitespace-pre-wrap">
          {pageIntro}
        </p>
        <div className="mt-3 max-w-2xl rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground sm:text-sm">
          <span className="font-medium text-foreground">Social (painel):</span> para criar posts, grupos e comentários
          privados à instituição, inicie sessão e abra a área Social.{' '}
          <Link to="/auth" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
          <span className="mx-1">·</span>
          <Link
            to="/social"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
            title="Abre num novo separador"
          >
            Abrir Social
          </Link>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="filtro-cidade">Local ou nome</Label>
            <Input
              id="filtro-cidade"
              placeholder="Cidade no endereço, morada ou nome da escola"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filtro-curso">Curso / oferta</Label>
            <Input
              id="filtro-curso"
              placeholder="Nome da oferta"
              value={curso}
              onChange={(e) => setCurso(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo académico</Label>
            <Select value={tipoAcademico} onValueChange={setTipoAcademico}>
              <SelectTrigger>
                <SelectValue placeholder="Qualquer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer</SelectItem>
                <SelectItem value="SECUNDARIO">Secundário</SelectItem>
                <SelectItem value="SUPERIOR">Superior</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de instituição</Label>
            <Select value={tipoInstituicao} onValueChange={setTipoInstituicao}>
              <SelectTrigger>
                <SelectValue placeholder="Qualquer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer</SelectItem>
                <SelectItem value="ENSINO_MEDIO">Ensino médio</SelectItem>
                <SelectItem value="UNIVERSIDADE">Universidade</SelectItem>
                <SelectItem value="MISTA">Mista</SelectItem>
                <SelectItem value="EM_CONFIGURACAO">Em configuração</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={applyFilters} className="gap-2">
            <Search className="h-4 w-4" aria-hidden />
            Aplicar filtros
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={!hasActiveFilters && page <= 1}
            onClick={clearFilters}
          >
            Limpar filtros
          </Button>
        </div>
        {activeFilterChips.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Filtros aplicados — toque para remover</p>
            <div className="flex flex-wrap gap-2">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => removeOneFilter(chip.key)}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 py-1 pl-3 pr-1 text-left text-xs font-medium text-amber-950 shadow-sm transition-colors hover:bg-amber-500/20 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100 dark:hover:bg-amber-400/20"
                  title="Remover este filtro"
                  aria-label={`Remover filtro ${chip.label}`}
                >
                  <span className="min-w-0 truncate">{chip.label}</span>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-foreground/10">
                    <X className="h-3.5 w-3.5 opacity-80" aria-hidden />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Não foi possível carregar o diretório.</p>
      ) : (
        <>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{total}</span> instituição
              {total === 1 ? '' : 'ões'} encontrada
              {total === 1 ? '' : 's'}
              {total > 0 ? (
                <>
                  {' '}
                  <span className="tabular-nums">
                    ({rangeStart}–{rangeEnd})
                  </span>
                </>
              ) : null}
              {isFetching ? <span className="ml-2 text-xs">· a atualizar…</span> : null}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            {data?.data.map((s) => (
              <SchoolCard key={s.id} school={s} />
            ))}
          </div>
          {!data?.data.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhum resultado. Ajuste os filtros ou volte mais tarde.
            </p>
          ) : null}
          {totalPages > 1 ? (
            <div className="flex flex-col items-stretch gap-3 rounded-lg border bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <p className="text-center text-xs text-muted-foreground sm:text-left">
                Página <span className="font-semibold text-foreground">{page}</span> de{' '}
                <span className="font-semibold text-foreground">{totalPages}</span>
              </p>
              <div className="flex items-center justify-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={page >= totalPages || isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Seguinte
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default ComunidadePage;
