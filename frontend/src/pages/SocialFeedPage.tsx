import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SocialShellLayout } from '@/layouts/SocialShellLayout';
import { PostCard } from '@/components/social/PostCard';
import { SocialPostEditDialog } from '@/components/social/SocialPostEditDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { socialApi, type SocialReactionType } from '@/services/socialApi';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Home, UsersRound, UserPlus, LogOut, Plus } from 'lucide-react';
import { ComunidadeFeatureGate } from '@/components/social/ComunidadeFeatureGate';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { cn } from '@/lib/utils';
import { canEditSocialPost } from '@/utils/socialPostPermissions';
import type { SocialPostDTO } from '@/services/socialApi';

const MAIN = null as string | null;

function nomeInitials(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export default function SocialFeedPage() {
  const queryClient = useQueryClient();
  const { instituicaoId } = useInstituicao();
  const { user, role } = useAuth();
  const [newBody, setNewBody] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [contactWhatsappShow, setContactWhatsappShow] = useState(false);
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactLocationShow, setContactLocationShow] = useState(false);
  const [contactLocation, setContactLocation] = useState('');
  const [contactVideoShow, setContactVideoShow] = useState(false);
  const [contactVideoUrl, setContactVideoUrl] = useState('');
  const [reactionBusyId, setReactionBusyId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(MAIN);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPostDTO | null>(null);

  const feedKey = selectedGroupId ?? 'main';

  const groupsQuery = useQuery({
    queryKey: ['social-groups'],
    queryFn: () => socialApi.listGroups(),
    enabled: Boolean(instituicaoId),
  });

  const overviewQuery = useQuery({
    queryKey: ['social-overview'],
    queryFn: () => socialApi.getFeedOverview(),
    enabled: !selectedGroupId,
  });

  const feedQuery = useInfiniteQuery({
    queryKey: ['social-feed', feedKey],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      socialApi.getFeed({
        page: pageParam,
        pageSize: 15,
        groupId: selectedGroupId || undefined,
      }),
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      socialApi.createPost({
        body: newBody.trim(),
        isPublic: selectedGroupId ? false : isPublic,
        socialGroupId: selectedGroupId,
        contactWhatsappShow,
        contactWhatsapp: contactWhatsapp.trim() || undefined,
        contactLocationShow,
        contactLocation: contactLocation.trim() || undefined,
        contactVideoShow,
        contactVideoUrl: contactVideoUrl.trim() || undefined,
      }),
    onSuccess: async () => {
      setNewBody('');
      setIsPublic(false);
      setContactWhatsappShow(false);
      setContactWhatsapp('');
      setContactLocationShow(false);
      setContactLocation('');
      setContactVideoShow(false);
      setContactVideoUrl('');
      toast.success('Publicação criada');
      await queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      await queryClient.invalidateQueries({ queryKey: ['social-groups'] });
      await queryClient.invalidateQueries({ queryKey: ['social-overview'] });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast.error(msg || 'Não foi possível publicar');
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: () =>
      socialApi.createGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || undefined,
      }),
    onSuccess: async () => {
      setNewGroupName('');
      setNewGroupDesc('');
      setGroupDialogOpen(false);
      toast.success('Grupo criado');
      await queryClient.invalidateQueries({ queryKey: ['social-groups'] });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast.error(msg || 'Não foi possível criar o grupo');
    },
  });

  const joinMutation = useMutation({
    mutationFn: (id: string) => socialApi.joinGroup(id),
    onSuccess: async () => {
      toast.success('Entrou no grupo');
      await queryClient.invalidateQueries({ queryKey: ['social-groups'] });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast.error(msg || 'Não foi possível entrar');
    },
  });

  const leaveMutation = useMutation({
    mutationFn: (id: string) => socialApi.leaveGroup(id),
    onSuccess: async (_, id) => {
      toast.success('Saiu do grupo');
      if (selectedGroupId === id) setSelectedGroupId(MAIN);
      await queryClient.invalidateQueries({ queryKey: ['social-groups'] });
      await queryClient.invalidateQueries({ queryKey: ['social-feed'] });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast.error(msg || 'Não foi possível sair');
    },
  });

  const invalidateFeed = () => queryClient.invalidateQueries({ queryKey: ['social-feed'] });

  const onEditPostSaved = async () => {
    await invalidateFeed();
    await queryClient.invalidateQueries({ queryKey: ['social-overview'] });
    await queryClient.invalidateQueries({ queryKey: ['social-post'] });
  };

  const reactionMutation = useMutation({
    mutationFn: async ({ postId, type }: { postId: string; type: SocialReactionType }) => {
      setReactionBusyId(postId);
      await socialApi.setReaction(postId, type);
    },
    onSettled: async (_, __, { postId }) => {
      setReactionBusyId((id) => (id === postId ? null : id));
      await invalidateFeed();
    },
  });

  const clearReactionMutation = useMutation({
    mutationFn: async (postId: string) => {
      setReactionBusyId(postId);
      await socialApi.clearReaction(postId);
    },
    onSettled: async (_, __, postId) => {
      setReactionBusyId((id) => (id === postId ? null : id));
      await invalidateFeed();
    },
  });

  const items = feedQuery.data?.pages.flatMap((p) => p.data) ?? [];
  const lastMeta = feedQuery.data?.pages[feedQuery.data.pages.length - 1]?.meta;
  const hasMore = Boolean(lastMeta && lastMeta.page < lastMeta.totalPages);
  const groups = groupsQuery.data ?? [];

  const contactFormInvalid =
    (contactWhatsappShow && !contactWhatsapp.trim()) ||
    (contactLocationShow && !contactLocation.trim()) ||
    (contactVideoShow && !contactVideoUrl.trim());

  return (
    <ComunidadeFeatureGate>
      <SocialShellLayout>
        <div className="grid gap-6 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] xl:grid-cols-[minmax(240px,280px)_minmax(0,640px)]">
          <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Feed
              </p>
              <Button
                variant={selectedGroupId === MAIN ? 'secondary' : 'ghost'}
                className="mb-1 w-full justify-start gap-2"
                size="sm"
                onClick={() => setSelectedGroupId(MAIN)}
              >
                <Home className="h-4 w-4" />
                Início
              </Button>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Grupos
                </p>
                {instituicaoId ? (
                  <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Novo grupo">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo grupo</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="g-name">Nome</Label>
                          <Input
                            id="g-name"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Ex.: Turma A, Associados…"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="g-desc">Descrição (opcional)</Label>
                          <Textarea
                            id="g-desc"
                            rows={3}
                            value={newGroupDesc}
                            onChange={(e) => setNewGroupDesc(e.target.value)}
                            className="resize-none"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => createGroupMutation.mutate()}
                          disabled={createGroupMutation.isPending || !newGroupName.trim()}
                        >
                          {createGroupMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Criar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : null}
              </div>

              {!instituicaoId ? (
                <p className="text-xs text-muted-foreground">
                  Grupos disponíveis quando tem sessão com instituição.
                </p>
              ) : groupsQuery.isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : groups.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ainda não há grupos. Crie o primeiro.</p>
              ) : (
                <ul className="max-h-[360px] space-y-1 overflow-y-auto pr-0.5">
                  {groups.map((g) => (
                    <li key={g.id}>
                      <div
                        className={cn(
                          'flex flex-col gap-1 rounded-md border border-transparent p-2 text-left text-sm',
                          selectedGroupId === g.id && 'border-primary/30 bg-primary/5',
                        )}
                      >
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 text-left font-medium"
                          onClick={() => setSelectedGroupId(g.id)}
                        >
                          <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 leading-tight">{g.name}</span>
                        </button>
                        <div className="flex flex-wrap items-center gap-1 pl-6">
                          <span className="text-[10px] text-muted-foreground">
                            {g.memberCount} membros · {g.postCount} posts
                          </span>
                          {!g.isMember ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 gap-1 px-2 text-[11px]"
                              disabled={joinMutation.isPending}
                              onClick={() => joinMutation.mutate(g.id)}
                            >
                              <UserPlus className="h-3 w-3" />
                              Entrar
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
                              disabled={leaveMutation.isPending}
                              onClick={() => leaveMutation.mutate(g.id)}
                            >
                              <LogOut className="h-3 w-3" />
                              Sair
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <div className="mx-auto w-full min-w-0 max-w-[640px] space-y-4">
            {!selectedGroupId && (
              <>
                {overviewQuery.isLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {(overviewQuery.data?.activeUsers?.length ?? 0) > 0 && (
                      <section className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Ativos na rede
                        </p>
                        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                          {overviewQuery.data!.activeUsers.map((u) => (
                            <div
                              key={u.id}
                              className="flex w-[72px] shrink-0 flex-col items-center gap-1 text-center"
                            >
                              <Avatar className="h-14 w-14 ring-2 ring-[#1877F2]/30">
                                <AvatarImage src={u.avatarUrl || undefined} alt="" />
                                <AvatarFallback className="text-xs font-medium">
                                  {nomeInitials(u.nomeCompleto)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                                {u.nomeCompleto.split(/\s+/)[0] ?? u.nomeCompleto}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                    {(overviewQuery.data?.stories?.length ?? 0) > 0 && (
                      <section className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Histórias
                        </p>
                        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                          {overviewQuery.data!.stories.map((s) => (
                            <Link
                              key={s.id}
                              to={`/post/${s.id}`}
                              className="flex w-[80px] shrink-0 flex-col items-center gap-1.5 text-center"
                            >
                              <div className="rounded-full bg-gradient-to-tr from-[#1877F2] to-violet-500 p-[3px]">
                                <Avatar className="h-14 w-14 border-2 border-card">
                                  <AvatarImage src={s.author.avatarUrl || undefined} alt="" />
                                  <AvatarFallback className="text-xs font-medium">
                                    {nomeInitials(s.author.nomeCompleto)}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                              <span className="line-clamp-3 w-full text-[10px] leading-tight text-muted-foreground">
                                {s.bodyPreview}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </>
            )}
            <section className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                {selectedGroupId ? 'Publicar no grupo' : 'Criar publicação'}
              </h2>
              <Textarea
                placeholder={
                  selectedGroupId
                    ? 'Escreva algo para o grupo…'
                    : 'No que está a pensar?'
                }
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={3}
                className="resize-none border-0 bg-muted/30 text-[15px] focus-visible:ring-1"
              />
              {!selectedGroupId ? (
                <div className="mt-3 space-y-1 border-t border-border/50 pt-3">
                  <div className="flex items-start gap-2">
                    <Switch id="social-public" checked={isPublic} onCheckedChange={setIsPublic} className="mt-0.5" />
                    <div className="min-w-0">
                      <Label htmlFor="social-public" className="cursor-pointer text-sm font-medium leading-snug">
                        {isPublic ? 'Público — aparece na Comunidade' : 'Privado — só na sua escola'}
                      </Label>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {isPublic
                          ? 'Visitantes e outras escolas podem ver (conteúdo promocional, ofertas). O servidor só publica se a instituição estiver elegível no diretório.'
                          : 'Avisos internos, reuniões, etc.: apenas utilizadores com sessão na mesma instituição. Não entra na página pública nem na vitrine.'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Posts em grupo são só para membros do grupo; nunca na vitrine pública.
                </p>
              )}

              <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
                <p className="text-xs font-medium text-muted-foreground">Destaques na publicação (opcional)</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Se activar uma opção, aparece no cartão e na vitrine pública. Vídeo: link YouTube ou Bunny (ex.{' '}
                  <span className="font-mono text-[10px]">iframe.mediadelivery.net</span>, <span className="font-mono text-[10px]">*.b-cdn.net</span>).
                </p>
                <div className="flex items-start gap-2">
                  <Switch
                    id="post-wa"
                    checked={contactWhatsappShow}
                    onCheckedChange={setContactWhatsappShow}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor="post-wa" className="cursor-pointer text-sm font-medium">
                      Mostrar WhatsApp da instituição
                    </Label>
                    {contactWhatsappShow ? (
                      <Input
                        placeholder="Telefone (ex. 244…) ou link wa.me"
                        value={contactWhatsapp}
                        onChange={(e) => setContactWhatsapp(e.target.value)}
                        className="h-9 text-sm"
                      />
                    ) : null}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Switch
                    id="post-local"
                    checked={contactLocationShow}
                    onCheckedChange={setContactLocationShow}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor="post-local" className="cursor-pointer text-sm font-medium">
                      Mostrar contacto / localidade
                    </Label>
                    {contactLocationShow ? (
                      <Textarea
                        placeholder="Morada, horário, telefone fixo…"
                        value={contactLocation}
                        onChange={(e) => setContactLocation(e.target.value)}
                        rows={2}
                        className="resize-none text-sm min-h-[60px]"
                      />
                    ) : null}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Switch
                    id="post-video"
                    checked={contactVideoShow}
                    onCheckedChange={setContactVideoShow}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor="post-video" className="cursor-pointer text-sm font-medium">
                      Mostrar vídeo (YouTube ou Bunny)
                    </Label>
                    {contactVideoShow ? (
                      <Input
                        placeholder="https://www.youtube.com/watch?v=… ou URL Bunny"
                        value={contactVideoUrl}
                        onChange={(e) => setContactVideoUrl(e.target.value)}
                        className="h-9 text-sm"
                      />
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={
                    createMutation.isPending || !newBody.trim() || contactFormInvalid
                  }
                  className="min-w-[100px] bg-[#1877F2] font-semibold text-white hover:bg-[#166fe5]"
                >
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Publicar
                </Button>
              </div>
            </section>

            {feedQuery.isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : feedQuery.isError ? (
              <p className="text-destructive text-sm">
                Não foi possível carregar o feed. Confirme a sessão e o plano.
              </p>
            ) : (
              <ul className="space-y-4">
                {items.map((post) => (
                  <li key={post.id}>
                    <PostCard
                      post={post}
                      reactionBusy={reactionBusyId === post.id}
                      onReaction={(type) => reactionMutation.mutate({ postId: post.id, type })}
                      onClearReaction={() => clearReactionMutation.mutate(post.id)}
                      canEdit={canEditSocialPost(user, role, post)}
                      onEditClick={() => setEditingPost(post)}
                    />
                  </li>
                ))}
              </ul>
            )}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => feedQuery.fetchNextPage()}
                  disabled={feedQuery.isFetchingNextPage}
                >
                  {feedQuery.isFetchingNextPage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Carregar mais'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        <SocialPostEditDialog
          post={editingPost}
          open={editingPost !== null}
          onOpenChange={(open) => {
            if (!open) setEditingPost(null);
          }}
          onSaved={onEditPostSaved}
        />
      </SocialShellLayout>
    </ComunidadeFeatureGate>
  );
}
