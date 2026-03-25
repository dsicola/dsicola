import { Link } from 'react-router-dom';
import { PostContactBlocks } from '@/components/social/PostContactBlocks';
import { ReactionButton } from '@/components/social/ReactionButton';
import type { SocialPostDTO, SocialReactionType } from '@/services/socialApi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageCircle, UsersRound, Globe, Building2, Pencil } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface PostCardProps {
  post: SocialPostDTO;
  onReaction: (type: SocialReactionType) => void;
  onClearReaction: () => void;
  reactionBusy?: boolean;
  canEdit?: boolean;
  onEditClick?: () => void;
}

export function PostCard({
  post,
  onReaction,
  onClearReaction,
  reactionBusy,
  canEdit,
  onEditClick,
}: PostCardProps) {
  const preview = post.body.length > 560 ? `${post.body.slice(0, 560)}…` : post.body;
  const when = format(new Date(post.createdAt), "d MMM · HH:mm", { locale: ptBR });

  return (
    <article
      className={cn(
        'overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm',
        'transition-shadow hover:shadow-md',
      )}
    >
      <div className="flex gap-3 p-4 pb-2">
        <Avatar className="h-10 w-10 ring-2 ring-background">
          {post.author.avatarUrl ? (
            <AvatarImage src={post.author.avatarUrl} alt="" />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials(post.author.nomeCompleto)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <div>
              <p className="text-[15px] font-semibold leading-tight">{post.author.nomeCompleto}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {post.instituicao.nome} · <span className="text-muted-foreground/90">{when}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {post.group ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <UsersRound className="h-3 w-3" />
                  {post.group.name}
                </span>
              ) : post.isPublic ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                  <Globe className="h-3 w-3" />
                  Público · Comunidade
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  Privado · escola
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <Link to={`/post/${post.id}`} className="block px-4 pb-3 hover:bg-muted/20">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{preview}</p>
      </Link>

      <div className="px-4 pb-3">
        <PostContactBlocks
          compact
          contactWhatsappShow={post.contactWhatsappShow}
          contactWhatsapp={post.contactWhatsapp}
          contactLocationShow={post.contactLocationShow}
          contactLocation={post.contactLocation}
          contactVideoShow={post.contactVideoShow}
          contactVideoUrl={post.contactVideoUrl}
          contactVideoEmbedSrc={post.contactVideoEmbedSrc}
          contactWhatsappHref={post.contactWhatsappHref}
        />
      </div>

      <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <ReactionButton
            postId={post.id}
            myReaction={post.myReaction}
            disabled={reactionBusy}
            onSelect={onReaction}
            onClear={onClearReaction}
            compact
          />
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" asChild>
            <Link to={`/post/${post.id}`}>
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Comentar</span>
              {post.commentCount > 0 ? (
                <span className="text-[11px] tabular-nums">({post.commentCount})</span>
              ) : null}
            </Link>
          </Button>
          {canEdit && onEditClick ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEditClick();
              }}
            >
              <Pencil className="h-4 w-4" />
              <span className="text-xs font-medium">Editar</span>
            </Button>
          ) : null}
        </div>
        <p className="pr-2 text-[11px] tabular-nums text-muted-foreground">
          {post.reactionCount} reações
        </p>
      </div>
    </article>
  );
}
