import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { socialApi } from '@/services/socialApi';
import { PostContactBlocks } from '@/components/social/PostContactBlocks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Globe2, Share2, Loader2, LogIn } from 'lucide-react';

interface PublicComunidadeLandingSectionProps {
  primaryColor: string;
}

/**
 * Vitrine **Social público** (posts isPublic) — leitura anónima. Comunidade (descoberta) é /comunidade.
 */
function openInNewTab(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  window.open(`${window.location.origin}${p}`, '_blank', 'noopener,noreferrer');
}

export function PublicComunidadeLandingSection({ primaryColor }: PublicComunidadeLandingSectionProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['social-public-feed', 'vendas-landing'],
    queryFn: () => socialApi.getPublicFeed({ page: 1, pageSize: 9 }),
    staleTime: 60_000,
    retry: 1,
  });

  const items = data?.data ?? [];

  return (
    <section
      id="social-vitrine-publica"
      className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 overflow-hidden bg-gradient-to-b from-slate-50 to-white border-t border-slate-200/80"
      aria-labelledby="social-vitrine-publica-heading"
    >
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10 sm:mb-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
              <Share2 className="h-4 w-4" style={{ color: primaryColor }} aria-hidden />
              Social · vitrine institucional (leitura pública)
            </div>
            <h2
              id="social-vitrine-publica-heading"
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 tracking-tight"
            >
              Conteúdo que as escolas optam por tornar visível ao exterior
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
              O DSICOLA combina <strong className="font-semibold text-slate-800">operação em SaaS</strong>,{' '}
              <strong className="font-semibold text-slate-800">diretório Comunidade</strong> e{' '}
              <strong className="font-semibold text-slate-800">Social com governança</strong> — camadas distintas,
              sem misturar dados internos com a imagem pública.
            </p>
            <p className="mt-3 text-slate-600 text-base sm:text-lg leading-relaxed">
              A amostra abaixo é <strong className="font-semibold text-slate-800">só leitura</strong>, alimentada por
              publicações marcadas como públicas e por instituições elegíveis no diretório. Para interagir, feed
              completo e grupos, aceda ao painel autenticado. Para{' '}
              <strong className="font-semibold text-slate-800">descobrir instituições e ofertas</strong>, use a{' '}
              <strong className="font-semibold text-slate-800">Comunidade</strong>.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 shrink-0">
            <Button
              variant="outline"
              className="border-slate-200 gap-2"
              onClick={() => openInNewTab('/comunidade')}
              title="Abre o diretório Comunidade num novo separador"
            >
              <Globe2 className="h-4 w-4" aria-hidden />
              Diretório Comunidade
            </Button>
            <Button
              variant="outline"
              className="border-slate-200"
              onClick={() => openInNewTab('/social')}
              title="Abre o Social num novo separador (login no mesmo domínio)"
            >
              Área Social (painel)
            </Button>
            <Button
              className="text-white font-semibold shadow-md"
              style={{ backgroundColor: primaryColor }}
              onClick={() => navigate('/auth')}
            >
              <LogIn className="h-4 w-4 mr-2" />
              Entrar (instituição)
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
          </div>
        )}

        {isError && (
          <p className="text-center text-slate-500 py-8 text-sm">
            Não foi possível carregar as publicações agora. Tente mais tarde.
          </p>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <Card className="border-2 border-dashed border-slate-200 bg-slate-50/80">
            <CardContent className="py-12 text-center text-slate-600">
              <p className="font-medium text-slate-800">Ainda não há publicações públicas</p>
              <p className="mt-2 text-sm max-w-md mx-auto">
                No Social do painel, marque um post como público para ele surgir nesta vitrine. A
                Comunidade (/comunidade) é o diretório de instituições e ofertas.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {items.map((post) => {
              const preview =
                post.body.length > 200 ? `${post.body.slice(0, 200).trim()}…` : post.body;
              return (
                <Card
                  key={post.id}
                  className="border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow rounded-xl overflow-hidden bg-white"
                >
                  <CardContent className="p-4 sm:p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {post.instituicao.nome}
                        </span>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs font-normal">
                        Público
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed flex-1 whitespace-pre-wrap">
                      {preview}
                    </p>
                    <PostContactBlocks
                      compact
                      className="mt-3 border-slate-200 bg-slate-50/80"
                      contactWhatsappShow={post.contactWhatsappShow}
                      contactWhatsapp={post.contactWhatsapp}
                      contactLocationShow={post.contactLocationShow}
                      contactLocation={post.contactLocation}
                      contactVideoShow={post.contactVideoShow}
                      contactVideoUrl={post.contactVideoUrl}
                      contactVideoEmbedSrc={post.contactVideoEmbedSrc}
                      contactWhatsappHref={post.contactWhatsappHref}
                    />
                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="truncate max-w-[60%]" title={post.author.nomeCompleto}>
                        {post.author.nomeCompleto}
                      </span>
                      <time dateTime={post.createdAt}>
                        {format(new Date(post.createdAt), "d MMM yyyy", { locale: ptBR })}
                      </time>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
