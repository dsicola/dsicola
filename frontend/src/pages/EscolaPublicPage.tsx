import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, MessageCircle } from 'lucide-react';
import { CourseList } from '@/components/community/CourseList';
import { FollowButton } from '@/components/community/FollowButton';
import { communityApi } from '@/services/communityApi';
import { Card, CardContent } from '@/components/ui/card';

const EscolaPublicPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['community-institution', id],
    queryFn: async () => {
      const res = await communityApi.getInstitution(id!);
      return res.data;
    },
    enabled: Boolean(id),
  });

  if (!id) {
    return <p className="text-sm text-muted-foreground">Instituição inválida.</p>;
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">A carregar…</p>;
  }

  if (isError || !data) {
    return <p className="text-sm text-destructive">Instituição não encontrada.</p>;
  }

  return (
    <div className="space-y-10">
      <Link
        to="/comunidade"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar ao diretório (Comunidade)
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          {data.logoUrl ? (
            <img
              src={data.logoUrl}
              alt=""
              className="h-20 w-20 rounded-xl object-cover bg-muted"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted">
              <Building2 className="h-10 w-10 text-muted-foreground" aria-hidden />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
            <p className="text-sm text-muted-foreground">{data.address || '—'}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-muted px-2 py-0.5">{data.institutionType}</span>
              {data.academicType ? (
                <span className="rounded-md bg-muted px-2 py-0.5">{data.academicType}</span>
              ) : null}
              <span className="rounded-md bg-muted px-2 py-0.5">
                {data.followerCount} seguidor(es)
              </span>
            </div>
          </div>
        </div>
        <FollowButton instituicaoId={data.id} initialFollowing={data.viewerFollowing} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cursos e ofertas</h2>
        <p className="text-xs text-muted-foreground">
          O que a instituição divulgou para o diretório público em{' '}
          <span className="font-mono">dsicola.com/comunidade</span>.
        </p>
        <CourseList courses={data.courses} title="Ofertas no diretório" />
      </section>

      {data.publicPosts?.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Posts e comentários (Social público)</h2>
          <p className="text-xs text-muted-foreground">
            Só entram aqui publicações marcadas como <strong className="text-foreground">públicas</strong>{' '}
            no Social do painel. Comentários visíveis para o visitante. Para criar posts, comentar como
            utilizador ligado à escola ou ver o <strong className="text-foreground">privado</strong> à
            instituição, use o painel em <span className="font-mono">/social</span>.
          </p>
          <div className="space-y-5">
            {data.publicPosts.map((p) => (
              <Card key={p.id} className="border-border/80">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {p.createdAt
                        ? new Date(p.createdAt).toLocaleDateString('pt-PT', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : ''}
                      {p.author?.nomeCompleto ? ` · ${p.author.nomeCompleto}` : ''}
                    </p>
                    <p className="mt-2 text-sm whitespace-pre-wrap">{p.body}</p>
                    <p className="mt-2">
                      <Link
                        to={`/post/${p.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                        title="Abre o fio completo no Social (é necessário sessão no painel)"
                      >
                        Ver no Social e interagir →
                      </Link>
                    </p>
                  </div>
                  {p.comments?.length ? (
                    <div className="rounded-md bg-muted/40 border border-border/60 pl-3 pr-2 py-2 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                        Comentários ({p.comments.length})
                      </p>
                      <ul className="space-y-2 max-h-64 overflow-y-auto">
                        {p.comments.map((c) => (
                          <li key={c.id} className="text-sm border-l-2 border-primary/30 pl-2 py-0.5">
                            <span className="text-xs text-muted-foreground">
                              {c.author?.nomeCompleto ?? '—'} ·{' '}
                              {c.createdAt
                                ? new Date(c.createdAt).toLocaleString('pt-PT', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                            <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem comentários públicos ainda.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Posts e comentários (Social público)</h2>
          <p className="text-xs text-muted-foreground">
            Esta instituição ainda não tem publicações <strong className="text-foreground">públicas</strong>{' '}
            no Social. No painel (/social) pode criar posts e escolher público ou só instituição.
          </p>
        </section>
      )}
    </div>
  );
};

export default EscolaPublicPage;
