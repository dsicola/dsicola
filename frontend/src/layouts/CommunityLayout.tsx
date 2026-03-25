import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap } from 'lucide-react';
import { configuracoesLandingApi } from '@/services/api';
import { landingConfigsToMap, getLandingCopy } from '@/utils/platformLandingCopy';

/**
 * Layout público **Comunidade (descoberta)** — textos configuráveis pelo super-admin em Landing.
 */
export const CommunityLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: configs } = useQuery({
    queryKey: ['configuracoes-landing-public'],
    queryFn: () => configuracoesLandingApi.getPublic(),
    staleTime: 60_000,
  });

  const copy = useMemo(() => landingConfigsToMap(configs), [configs]);
  const navLong = getLandingCopy(copy, 'comunidade_layout_nav_rotulo', 'Comunidade · descoberta');
  const footerText = getLandingCopy(
    copy,
    'comunidade_layout_footer',
    'DSICOLA combina SaaS para escolas, descoberta pública aqui na Comunidade e rede social educacional no painel — cada peça com o seu propósito.',
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link
            to="/comunidade"
            className="flex items-center gap-2 font-semibold tracking-tight text-primary hover:opacity-90"
          >
            <GraduationCap className="h-6 w-6" aria-hidden />
            <span className="hidden sm:inline">{navLong}</span>
            <span className="sm:hidden">Comunidade</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Link to="/comunidade" className="text-muted-foreground hover:text-foreground">
              Instituições
            </Link>
            <Link
              to="/social"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              title="Área Social do painel: posts e grupos (requer sessão neste domínio)"
            >
              Social
            </Link>
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              Início
            </Link>
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">
              Entrar
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground max-w-2xl mx-auto px-4">
        {footerText}
      </footer>
    </div>
  );
};
