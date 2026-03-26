import React, { useState } from 'react';
import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Star, CheckCircle2, Loader2, Send, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { communityApi } from '@/services/communityApi';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { StarRatingDisplay } from './StarRating';
import { QueryErrorBanner } from '@/components/common/QueryErrorBanner';
import { Skeleton } from '@/components/ui/skeleton';

const STAR_AMBER = 'text-amber-500 fill-amber-500';
const STAR_MUTED = 'text-muted-foreground/40 fill-transparent';

function InteractiveStars({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Classificação em estrelas">
      {[1, 2, 3, 4, 5].map((i) => {
        const active = shown >= i;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            className={cn(
              'p-0.5 rounded-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
            onMouseEnter={() => !disabled && setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => !disabled && onChange(i)}
            aria-label={`${i} estrela${i > 1 ? 's' : ''}`}
          >
            <Star
              className={cn('h-8 w-8', active ? STAR_AMBER : STAR_MUTED)}
              strokeWidth={active ? 0 : 1.25}
            />
          </button>
        );
      })}
    </div>
  );
}

export interface InstitutionRatingsSectionProps {
  instituicaoId: string;
  institutionName: string;
  ratingAverage: number | null;
  ratingCount: number;
  viewerRating: number | null;
}

const REVIEWS_PAGE_SIZE = 10;

export const InstitutionRatingsSection: React.FC<InstitutionRatingsSectionProps> = ({
  instituicaoId,
  institutionName,
  ratingAverage,
  ratingCount,
  viewerRating: initialViewerRating,
}) => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [stars, setStars] = useState(initialViewerRating ?? 0);
  const [comment, setComment] = useState('');

  const viewerInstId = user?.instituicao_id ?? null;
  const canRate = Boolean(user && (!viewerInstId || viewerInstId !== instituicaoId));

  const reviewsQuery = useInfiniteQuery({
    queryKey: ['community-institution-ratings', instituicaoId],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await communityApi.listRatings(instituicaoId, {
        page: pageParam as number,
        pageSize: REVIEWS_PAGE_SIZE,
      });
      return res.data;
    },
    getNextPageParam: (lastPage) => {
      const { page: p, totalPages } = lastPage.meta;
      return p < totalPages ? p + 1 : undefined;
    },
  });

  const reviewPages = reviewsQuery.data?.pages ?? [];
  const allReviews = reviewPages.flatMap((p) => p.data);
  const reviewsTotal = reviewPages[0]?.meta.total ?? 0;
  const reviewsLoading = reviewsQuery.isLoading;
  const reviewsFetchingMore = reviewsQuery.isFetchingNextPage;
  const reviewsError = reviewsQuery.isError;
  const reviewsErrorObj = reviewsQuery.error;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (stars < 1 || stars > 5) {
        throw new Error('Escolha de 1 a 5 estrelas.');
      }
      const res = await communityApi.submitRating(instituicaoId, {
        stars,
        comment: comment.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['community-institution', instituicaoId] });
      void queryClient.invalidateQueries({ queryKey: ['community-institution-ratings', instituicaoId] });
      void queryClient.invalidateQueries({ queryKey: ['community-institutions'] });
      toast.success(
        data.ratingCount != null
          ? `Obrigado! Média atual: ${data.ratingAverage?.toFixed(1).replace('.', ',')} (${data.ratingCount} avaliações)`
          : 'Avaliação registada.',
      );
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Não foi possível guardar a avaliação.');
    },
  });

  React.useEffect(() => {
    setStars(initialViewerRating ?? 0);
  }, [initialViewerRating]);

  const hasSummary = ratingCount > 0 && ratingAverage != null;

  return (
    <section className="space-y-6 rounded-xl border bg-card/50 p-4 sm:p-6 shadow-sm">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <h2 className="text-lg font-semibold tracking-tight shrink-0">Avaliações</h2>
          {hasSummary ? (
            <>
              <span className="text-muted-foreground font-light hidden sm:inline">|</span>
              <span className="text-lg font-bold tabular-nums text-foreground leading-none">
                {ratingAverage.toFixed(1).replace('.', ',')}
              </span>
              <StarRatingDisplay value={ratingAverage} size="md" className="shrink-0" />
              <span className="text-sm text-muted-foreground tabular-nums">
                {ratingCount} {ratingCount === 1 ? 'avaliação' : 'avaliações'}
              </span>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ainda não há classificações públicas para {institutionName}.
            </p>
          )}
        </div>

        <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Utilizadores autenticados · uma avaliação por conta por instituição</span>
        </p>
      </div>

      {!authLoading && user && canRate ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">A sua avaliação</p>
          <InteractiveStars value={stars} onChange={setStars} disabled={submitMutation.isPending} />
          <Textarea
            placeholder="Comentário opcional (máx. 600 caracteres)"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 600))}
            rows={3}
            disabled={submitMutation.isPending}
            className="resize-y min-h-[80px]"
          />
          <Button
            type="button"
            disabled={submitMutation.isPending || stars < 1}
            onClick={() => submitMutation.mutate()}
            className="gap-2"
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            {initialViewerRating ? 'Atualizar avaliação' : 'Enviar avaliação'}
          </Button>
        </div>
      ) : null}

      {!authLoading && user && !canRate ? (
        <p className="text-xs text-muted-foreground rounded-md bg-muted/40 px-3 py-2 border border-border/60">
          Quem pertence a esta instituição não pode classificar a própria escola no diretório.
        </p>
      ) : null}

      {!authLoading && !user ? (
        <p className="text-xs text-muted-foreground">
          Inicie sessão no painel para deixar uma classificação de 1 a 5 estrelas.
        </p>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
          <h3 className="text-sm font-semibold text-foreground">Opiniões dos utilizadores</h3>
          {!reviewsLoading && !reviewsError && reviewsTotal > 0 ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              A mostrar <span className="font-medium text-foreground">{allReviews.length}</span> de{' '}
              <span className="font-medium text-foreground">{reviewsTotal}</span>
            </p>
          ) : null}
        </div>
        {reviewsError ? (
          <QueryErrorBanner
            error={reviewsErrorObj}
            onRetry={() => void reviewsQuery.refetch()}
            fallback="Não foi possível carregar as opiniões. Os dados principais da página estão disponíveis acima."
          />
        ) : reviewsLoading ? (
          <div className="space-y-2 py-2" aria-busy>
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg sm:w-4/5" />
          </div>
        ) : !allReviews.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center border rounded-md bg-muted/20 px-3 leading-relaxed">
            Ainda não há avaliações nesta instituição. Se já utilizou o serviço, deixe a sua classificação acima.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border/70 rounded-lg border border-border/80 bg-background/40 overflow-hidden">
              {allReviews.map((r) => (
                <li key={r.id} className="px-3 py-3 sm:px-4 sm:py-3.5 hover:bg-muted/25 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <StarRatingDisplay value={r.stars} size="sm" className="shrink-0" />
                    <span className="text-xs text-muted-foreground text-right sm:text-left">
                      <span className="font-medium text-foreground tabular-nums">
                        {new Date(r.createdAt).toLocaleDateString('pt-PT', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="mx-1.5 text-border">|</span>
                      <span className="text-foreground">{r.authorLabel}</span>
                    </span>
                  </div>
                  {r.comment ? (
                    <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed pr-1">
                      {r.comment}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted-foreground italic">Sem comentário escrito</p>
                  )}
                </li>
              ))}
            </ul>
            {reviewsQuery.hasNextPage ? (
              <div className="flex flex-col items-center gap-2 pt-2 pb-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-w-[200px] gap-2 rounded-full border-muted-foreground/25 bg-background shadow-sm"
                  disabled={reviewsFetchingMore}
                  onClick={() => void reviewsQuery.fetchNextPage()}
                >
                  {reviewsFetchingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
                  )}
                  Carregar mais opiniões
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  {reviewsTotal - allReviews.length} restante
                  {reviewsTotal - allReviews.length === 1 ? '' : 's'}
                </p>
              </div>
            ) : allReviews.length > 0 && reviewsTotal > REVIEWS_PAGE_SIZE ? (
              <p className="text-center text-[11px] text-muted-foreground pt-1">Fim das opiniões</p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
};
