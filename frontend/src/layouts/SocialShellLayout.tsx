import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Share2, LayoutDashboard } from 'lucide-react';
import { configuracoesLandingApi } from '@/services/api';
import { getDashboardPathForRole } from '@/components/layout/sidebar.modules';
import { useAuth } from '@/contexts/AuthContext';
import { landingConfigsToMap, getLandingCopy } from '@/utils/platformLandingCopy';
function isHexColor(v: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v.trim());
}

export const SocialShellLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const roles = ((user as { roles?: string[] } | null)?.roles ?? []) as string[];
  const dashboardPath = roles.length ? getDashboardPathForRole(roles) : '/admin-dashboard';

  const { data: configs } = useQuery({
    queryKey: ['configuracoes-landing-public'],
    queryFn: () => configuracoesLandingApi.getPublic(),
    staleTime: 60_000,
  });

  const copy = useMemo(() => landingConfigsToMap(configs), [configs]);
  const titulo = getLandingCopy(copy, 'social_shell_titulo', 'Social');
  const subtitulo = getLandingCopy(
    copy,
    'social_shell_subtitulo',
    'Comunicação institucional: público na Comunidade ou privado à sua escola — regras validadas no servidor.',
  );
  const footerNote = getLandingCopy(
    copy,
    'social_shell_footer',
    'Área reservada a utilizadores autenticados. Conteúdo publicado é da responsabilidade de cada instituição, nos termos aplicáveis.',
  );
  const rawAccent = getLandingCopy(copy, 'social_cor_primaria', '#1877F2');
  const accent = isHexColor(rawAccent) ? rawAccent.trim() : '#1877F2';

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-slate-950 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background shadow-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-3 sm:px-4">
          <Link
            to="/social"
            className="flex min-w-0 items-center gap-2 font-semibold tracking-tight"
            style={{color: accent }}
          >
            <Share2 className="h-6 w-6 shrink-0" aria-hidden />
            <span className="truncate">{titulo}</span>
          </Link>
          <p className="hidden max-w-md truncate text-xs text-muted-foreground sm:block">{subtitulo}</p>
          <nav className="flex shrink-0 items-center gap-2 text-sm">
            <Link
              to="/comunidade"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Comunidade
            </Link>
            <Link
              to={dashboardPath}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LayoutDashboard className="h-4 w-4" />
              Painel
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-2 pb-10 pt-4 sm:px-4">{children}</div>
      <footer className="border-t border-border/60 bg-background/80 py-4 text-center text-[11px] text-muted-foreground">
        <p className="mx-auto max-w-2xl px-4">{footerNote}</p>
        <p className="mx-auto mt-2 max-w-2xl px-4">
          <Link
            to="/auth/entrada-social?returnTo=%2Fsocial"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Entrar na Social com código por email
          </Link>
          <span className="mx-1.5 text-border">·</span>
          <Link
            to="/comunidade"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Comunidade (público)
          </Link>
        </p>
      </footer>
    </div>
  );
};
