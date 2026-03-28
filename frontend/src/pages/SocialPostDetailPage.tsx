import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SocialShellLayout } from '@/layouts/SocialShellLayout';
import { CommentList } from '@/components/social/CommentList';
import { PostContactBlocks } from '@/components/social/PostContactBlocks';
import { ReactionButton } from '@/components/social/ReactionButton';
import { SocialPostEditDialog } from '@/components/social/SocialPostEditDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { socialApi, type SocialReactionType } from '@/services/socialApi';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Globe,
  Loader2,
  Trash2,
  MessageCircle,
  Eye,
  ThumbsUp,
  UsersRound,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { ComunidadeFeatureGate } from '@/components/social/ComunidadeFeatureGate';
import { canEditSocialPost } from '@/utils/socialPostPermissions';
import { ConfirmacaoResponsabilidadeDialog } from '@/components/common/ConfirmacaoResponsabilidadeDialog';

export default function SocialPostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const currentUserId = user?.id ?? null;
  const [editOpen, setEditOpen] = useState(false);
  const [criticoEdicaoSocial, setCriticoEdicaoSocial] = useState<
    null | { tipo: 'post' } | { tipo: 'comentario'; commentId: string }
  >(null);
  const [eliminandoComentario, setEliminandoComentario] = useState(false);

  const postQuery = useQuery({
    queryKey: ['social-post', id],
    queryFn: () => socialApi.getPost(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!id) return;
    socialApi.registerView(id).catch(() => {});
  }, [id]);

  const post = postQuery.data;
  const comments = post?.comments ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['social-post', id] });
    queryClient.invalidateQueries({ queryKey: ['social-feed'] });
    queryClient.invalidateQueries({ queryKey: ['social-overview'] });
  };

  const deletePostMutation = useMutation({
    mutationFn: () => socialApi.deletePost(id!),
    onSuccess: () => {
      setCriticoEdicaoSocial(null);
      toast.success('Publicação eliminada');
      navigate('/social');
    },
    onError: () => {
      setCriticoEdicaoSocial(null);
      toast.error('Não foi possível eliminar');
    },
  });

  const reactionMutation = useMutation({
    mutationFn: (type: SocialReactionType) => socialApi.setReaction(id!, type),
    onSuccess: invalidate,
  });

  const clearReactionMutation = useMutation({
    mutationFn: () => socialApi.clearReaction(id!),
    onSuccess: invalidate,
  });

  if (postQuery.isLoading) {
    return (
      <ComunidadeFeatureGate>
        <SocialShellLayout>
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </SocialShellLayout>
      </ComunidadeFeatureGate>
    );
  }

  if (postQuery.isError || !post) {
    return (
      <ComunidadeFeatureGate>
        <SocialShellLayout>
          <div className="max-w-2xl mx-auto p-6">
            <p className="text-destructive text-sm">Publicação não encontrada ou sem permissão.</p>
            <Button asChild variant="link" className="mt-2 px-0">
              <Link to="/social">Voltar ao Social</Link>
            </Button>
          </div>
        </SocialShellLayout>
      </ComunidadeFeatureGate>
    );
  }

  const isAuthor = post.authorId === currentUserId;
  const sameInstitution = Boolean(user?.instituicao_id && post.instituicaoId === user.instituicao_id);
  const canComment = sameInstitution;
  const canModerate = sameInstitution && (role === 'ADMIN' || role === 'DIRECAO');
  const canEditPost = canEditSocialPost(user, role, post);

  return (
    <ComunidadeFeatureGate>
      <SocialShellLayout>
        <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2" asChild>
            <Link to="/social">
              <ArrowLeft className="h-4 w-4" />
              Social
            </Link>
          </Button>

          <article className="rounded-xl border bg-card p-4 md:p-6 space-y-4">
            <header className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h1 className="text-lg font-semibold">{post.author.nomeCompleto}</h1>
                  <p className="text-xs text-muted-foreground">
                    {post.instituicao.nome} ·{' '}
                    {format(new Date(post.createdAt), "d MMM yyyy, HH:mm", { locale: ptBR })}
                  </p>
                </div>
                {post.group ? (
                  <Badge variant="outline" className="shrink-0 gap-1 border-muted-foreground/40 font-normal">
                    <UsersRound className="h-3 w-3" />
                    {post.group.name}
                  </Badge>
                ) : post.isPublic ? (
                  <Badge variant="outline" className="gap-1 font-normal shrink-0">
                    <Globe className="h-3 w-3" />
                    Público · Comunidade
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-normal shrink-0">
                    Privado · escola
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-muted-foreground text-xs">
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {post.commentCount} comentários
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {post.reactionCount}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {post.viewCount} vistas
                </span>
              </div>
            </header>

            <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.body}</p>

            <PostContactBlocks
              contactWhatsappShow={post.contactWhatsappShow}
              contactWhatsapp={post.contactWhatsapp}
              contactLocationShow={post.contactLocationShow}
              contactLocation={post.contactLocation}
              contactVideoShow={post.contactVideoShow}
              contactVideoUrl={post.contactVideoUrl}
              contactVideoEmbedSrc={post.contactVideoEmbedSrc}
              contactWhatsappHref={post.contactWhatsappHref}
            />

            <div className="flex flex-wrap items-center gap-2">
              <ReactionButton
                postId={post.id}
                myReaction={post.myReaction}
                disabled={reactionMutation.isPending || clearReactionMutation.isPending}
                onSelect={(t) => reactionMutation.mutate(t)}
                onClear={() => clearReactionMutation.mutate()}
              />
              {canEditPost && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
              )}
              {(isAuthor || canModerate) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive gap-1"
                  onClick={() => setCriticoEdicaoSocial({ tipo: 'post' })}
                  disabled={deletePostMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              )}
            </div>
          </article>

          <SocialPostEditDialog
            post={post}
            open={editOpen}
            onOpenChange={setEditOpen}
            onSaved={invalidate}
          />

          <section className="rounded-xl border bg-card p-4 md:p-6">
            <h2 className="text-sm font-medium mb-4">Comentários</h2>
            <CommentList
              comments={comments}
              currentUserId={currentUserId}
              canModerate={canModerate}
              allowCreate={canComment}
              onCreate={async (body) => {
                await socialApi.createComment(post.id, body);
                invalidate();
              }}
              onUpdate={async (commentId, body) => {
                await socialApi.updateComment(post.id, commentId, body);
                invalidate();
              }}
              onDelete={async (commentId) => {
                setCriticoEdicaoSocial({ tipo: 'comentario', commentId });
              }}
            />
          </section>
        </div>

        <ConfirmacaoResponsabilidadeDialog
          open={criticoEdicaoSocial !== null}
          onOpenChange={(open) => {
            if (!open) setCriticoEdicaoSocial(null);
          }}
          title={
            criticoEdicaoSocial?.tipo === 'comentario'
              ? 'Eliminar comentário'
              : 'Eliminar publicação'
          }
          description={
            criticoEdicaoSocial?.tipo === 'comentario'
              ? 'O comentário deixa de ser visível para a comunidade desta instituição.'
              : 'A publicação e interacções associadas deixam de estar disponíveis no mural social.'
          }
          avisoInstitucional="A moderação de conteúdos deve observar o regulamento interno da comunidade escolar e a protecção de dados; remoções por litígio, queixa ou imperativo legal podem exigir registo ou excepção aprovada pela administração."
          pontosAtencao={[
            'A operação não pode ser desfeita pelo utilizador final.',
            'Em contexto de auditoria, mantenha evidência externa se o caso o exigir.',
          ]}
          confirmLabel={
            criticoEdicaoSocial?.tipo === 'comentario' ? 'Eliminar comentário' : 'Eliminar publicação'
          }
          confirmVariant="destructive"
          checkboxLabel="Confirmo que a eliminação é adequada e autorizada nos termos de moderação aplicáveis."
          isLoading={deletePostMutation.isPending || eliminandoComentario}
          onConfirm={() => {
            if (!criticoEdicaoSocial || !post) return;
            if (criticoEdicaoSocial.tipo === 'post') deletePostMutation.mutate();
            else {
              setEliminandoComentario(true);
              void socialApi
                .deleteComment(post.id, criticoEdicaoSocial.commentId)
                .then(() => {
                  toast.success('Comentário eliminado');
                  invalidate();
                  setCriticoEdicaoSocial(null);
                })
                .catch(() => toast.error('Não foi possível eliminar'))
                .finally(() => setEliminandoComentario(false));
            }
          }}
        />
      </SocialShellLayout>
    </ComunidadeFeatureGate>
  );
}
