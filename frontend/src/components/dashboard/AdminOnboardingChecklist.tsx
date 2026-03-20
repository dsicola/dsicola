import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, X, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cargosApi, departamentosApi } from '@/services/api';

const LEGACY_DISMISS_KEY = 'dsicola:admin-onboarding-dismissed';

export type OnboardingChecklistRole = 'ADMIN' | 'SECRETARIA';

function dismissStorageKey(instituicaoId: string, checklistRole: OnboardingChecklistRole) {
  return `dsicola:institution-onboarding-dismissed:${instituicaoId}:${checklistRole}`;
}

function getPaths(role: OnboardingChecklistRole) {
  if (role === 'SECRETARIA') {
    return {
      institution: '/ajuda',
      academicYear: '/admin-dashboard/configuracao-ensino?tab=anos-letivos',
      rh: '/admin-dashboard/recursos-humanos?tab=departamentos',
      turmas: '/admin-dashboard/gestao-academica?tab=turmas',
      estudantes: '/secretaria-dashboard/alunos',
    };
  }
  return {
    institution: '/admin-dashboard/configuracoes',
    academicYear: '/admin-dashboard/configuracao-ensino?tab=anos-letivos',
    rh: '/admin-dashboard/recursos-humanos?tab=departamentos',
    turmas: '/admin-dashboard/gestao-academica?tab=turmas',
    estudantes: '/admin-dashboard/gestao-alunos',
  };
}

type StatsLite = {
  alunos?: number;
  professores?: number;
  turmas?: number;
};

interface StepDef {
  id: string;
  title: string;
  hint: string;
  href: string;
  done: boolean;
}

interface Props {
  /** Quem vê o cartão: ADMIN (hub admin) ou SECRETARIA (painel secretaria). */
  checklistRole: OnboardingChecklistRole;
  instituicaoId: string | null | undefined;
  /** Quando preenchido, considera o cadastro mínimo da instituição como feito (ADMIN). Para secretaria, o mesmo sinaliza identidade visível. */
  instituicaoNome?: string | null;
  hasAnoLetivoAtivo: boolean;
  stats?: StatsLite | null;
  isLoadingStats?: boolean;
}

export function AdminOnboardingChecklist({
  checklistRole,
  instituicaoId,
  instituicaoNome,
  hasAnoLetivoAtivo,
  stats,
  isLoadingStats,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const paths = useMemo(() => getPaths(checklistRole), [checklistRole]);

  const storageKey =
    instituicaoId && checklistRole ? dismissStorageKey(instituicaoId, checklistRole) : null;

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!storageKey) {
      setDismissed(false);
      return;
    }
    try {
      let v = localStorage.getItem(storageKey) === '1';
      if (!v && checklistRole === 'ADMIN' && localStorage.getItem(LEGACY_DISMISS_KEY) === '1') {
        localStorage.setItem(storageKey, '1');
        v = true;
      }
      setDismissed(v);
    } catch {
      setDismissed(false);
    }
  }, [storageKey, checklistRole]);

  const { data: deptCount = 0 } = useQuery({
    queryKey: ['onboarding-departamentos', instituicaoId, checklistRole],
    queryFn: async () => {
      const list = await departamentosApi.getAll({ instituicaoId: instituicaoId || undefined });
      return Array.isArray(list) ? list.filter((d: { ativo?: boolean }) => d.ativo !== false).length : 0;
    },
    enabled: !!instituicaoId && !dismissed,
    staleTime: 60_000,
  });

  const { data: cargoCount = 0 } = useQuery({
    queryKey: ['onboarding-cargos', instituicaoId, checklistRole],
    queryFn: async () => {
      const list = await cargosApi.getAll({ instituicaoId: instituicaoId || undefined });
      return Array.isArray(list) ? list.filter((c: { ativo?: boolean }) => c.ativo !== false).length : 0;
    },
    enabled: !!instituicaoId && !dismissed,
    staleTime: 60_000,
  });

  const turmasOk = (stats?.turmas ?? 0) > 0;
  const professoresOk = (stats?.professores ?? 0) > 0;
  const classesStepDone =
    checklistRole === 'SECRETARIA' ? turmasOk : turmasOk && professoresOk;

  const steps: StepDef[] = useMemo(() => {
    const isSec = checklistRole === 'SECRETARIA';
    return [
      {
        id: 'instituicao',
        title: isSec
          ? t('dashboard.onboarding.institution.secretariaTitle')
          : t('dashboard.onboarding.institution.adminTitle'),
        hint: isSec
          ? t('dashboard.onboarding.institution.secretariaHint')
          : t('dashboard.onboarding.institution.adminHint'),
        href: paths.institution,
        done: Boolean(instituicaoNome?.trim()),
      },
      {
        id: 'ano-letivo',
        title: t('dashboard.onboarding.academicYear.title'),
        hint: t('dashboard.onboarding.academicYear.hint'),
        href: paths.academicYear,
        done: hasAnoLetivoAtivo,
      },
      {
        id: 'rh',
        title: t('dashboard.onboarding.departments.title'),
        hint: t('dashboard.onboarding.departments.hint'),
        href: paths.rh,
        done: deptCount > 0 && cargoCount > 0,
      },
      {
        id: 'turmas-docentes',
        title: isSec
          ? t('dashboard.onboarding.classes.secretariaTitle')
          : t('dashboard.onboarding.classes.adminTitle'),
        hint: isSec
          ? t('dashboard.onboarding.classes.secretariaHint')
          : t('dashboard.onboarding.classes.adminHint'),
        href: paths.turmas,
        done: classesStepDone,
      },
      {
        id: 'estudantes',
        title: t('dashboard.onboarding.students.title'),
        hint: isSec
          ? t('dashboard.onboarding.students.secretariaHint')
          : t('dashboard.onboarding.students.adminHint'),
        href: paths.estudantes,
        done: (stats?.alunos ?? 0) > 0,
      },
    ];
  }, [
    t,
    checklistRole,
    paths,
    instituicaoNome,
    hasAnoLetivoAtivo,
    deptCount,
    cargoCount,
    classesStepDone,
    stats?.alunos,
  ]);

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = Math.round((completed / total) * 100);
  const allDone = completed === total;

  const handleDismiss = useCallback(() => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, '1');
        if (checklistRole === 'ADMIN') {
          localStorage.removeItem(LEGACY_DISMISS_KEY);
        }
      } catch {
        /* ignore */
      }
    }
    setDismissed(true);
  }, [storageKey, checklistRole]);

  if (dismissed || !instituicaoId) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.03] w-full">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 rounded-md bg-primary/10 p-2 shrink-0">
            <ListChecks className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">{t('dashboard.onboarding.title')}</CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">{t('dashboard.onboarding.description')}</CardDescription>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={handleDismiss}
          aria-label={t('dashboard.onboarding.hideAria')}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('dashboard.onboarding.progress')}</span>
            <span>
              {completed}/{total}
              {isLoadingStats ? t('dashboard.onboarding.loadingStats') : ''}
            </span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <ul className="space-y-2">
          {steps.map((step) => (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => navigate(step.href)}
                className={cn(
                  'w-full flex items-start gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition-colors',
                  'hover:bg-muted/60 hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      step.done && 'text-muted-foreground line-through decoration-muted-foreground/50'
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.hint}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {allDone && (
          <p className="text-xs text-center text-emerald-700 dark:text-emerald-400 font-medium">
            {t('dashboard.onboarding.allDone')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
