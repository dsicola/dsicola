import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
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

const ComunidadePage: React.FC = () => {
  const [cidade, setCidade] = useState('');
  const [curso, setCurso] = useState('');
  const [tipoAcademico, setTipoAcademico] = useState('any');
  const [tipoInstituicao, setTipoInstituicao] = useState('any');
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

  const { data, isLoading, isError } = useQuery({
    queryKey: ['community-institutions', applied],
    queryFn: async () => {
      const res = await communityApi.listInstitutions({
        page: 1,
        pageSize: 24,
        cidade: applied.cidade || undefined,
        curso: applied.curso || undefined,
        tipoAcademico: applied.tipoAcademico || undefined,
        tipoInstituicao: applied.tipoInstituicao || undefined,
      });
      return res.data;
    },
  });

  const applyFilters = () => {
    setApplied({
      cidade: cidade.trim(),
      curso: curso.trim(),
      tipoAcademico: tipoAcademico === 'any' ? '' : tipoAcademico,
      tipoInstituicao: tipoInstituicao === 'any' ? '' : tipoInstituicao,
    });
  };

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
            <Label htmlFor="filtro-cidade">Cidade / endereço</Label>
            <Input
              id="filtro-cidade"
              placeholder="Ex.: Luanda"
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
        <Button type="button" onClick={applyFilters} className="gap-2">
          <Search className="h-4 w-4" aria-hidden />
          Aplicar filtros
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Não foi possível carregar o diretório.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {data?.meta.total ?? 0} instituição(ões) encontrada(s).
          </p>
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
        </>
      )}
    </div>
  );
};

export default ComunidadePage;
