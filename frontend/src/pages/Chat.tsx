import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatApi, turmasApi, disciplinasApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageCircle, Send, Plus, Users, BookOpen, Check, ChevronsUpDown, Paperclip, X, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatThread {
  id: string;
  tipo: "DISCIPLINA" | "DIRECT";
  disciplinaId?: string;
  disciplina?: { id: string; nome: string };
  lastMessage?: {
    id: string;
    content: string;
    createdAt: string;
    status: string;
    isFromMe: boolean;
  };
  unreadCount?: number;
  updatedAt: string;
  participants?: Array<{
    user: { id: string; nomeCompleto?: string; nome_completo?: string; avatarUrl?: string };
  }>;
}

type AttachmentItem = { url: string; type?: string; name?: string; size?: number };

/** Renderiza anexo em mensagem (imagem, PDF, vídeo, etc) */
function MessageAttachment({ attachment, isFromMe }: { attachment: AttachmentItem; isFromMe: boolean }) {
  const isImage = attachment.type?.startsWith("image/");
  const isVideo = attachment.type?.startsWith("video/");
  const isPdf = attachment.type === "application/pdf";

  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={attachment.url}
          alt={attachment.name || "Imagem"}
          className="max-w-[280px] max-h-[200px] rounded-lg object-contain"
        />
      </a>
    );
  }
  if (isVideo) {
    return (
      <video
        src={attachment.url}
        controls
        className="max-w-[280px] max-h-[200px] rounded-lg"
        preload="metadata"
      >
        Seu navegador não suporta vídeo.
      </video>
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 rounded-lg p-2 border ${
        isFromMe ? "border-primary-foreground/30" : "border-border"
      } hover:opacity-80 transition-opacity`}
    >
      {isPdf ? <FileText className="h-5 w-5 shrink-0" /> : <FileText className="h-5 w-5 shrink-0" />}
      <span className="truncate text-sm">{attachment.name || "Download"}</span>
    </a>
  );
}

interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  status: string;
  senderUserId: string;
  sender?: { nomeCompleto?: string; nome_completo?: string };
  isFromMe?: boolean;
  attachments?: AttachmentItem[];
}

export default function Chat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [newThreadTipo, setNewThreadTipo] = useState<"DISCIPLINA" | "DIRECT">("DISCIPLINA");
  const [newThreadDisciplinaId, setNewThreadDisciplinaId] = useState<string>("");
  const [newThreadTargetUserId, setNewThreadTargetUserId] = useState<string>("");
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isProfessor = user?.roles?.includes("PROFESSOR");
  const isAdmin = user?.roles?.includes("ADMIN");
  const isSecretaria = user?.roles?.includes("SECRETARIA");
  const isAluno = user?.roles?.includes("ALUNO");
  const canCreateThread = isProfessor || isAdmin || isSecretaria || isAluno;

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => chatApi.getThreads(),
    enabled: !!user?.id,
  });

  const { data: unreadData } = useQuery({
    queryKey: ["chat-unread-count"],
    queryFn: () => chatApi.getUnreadCount(),
    enabled: !!user?.id,
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ["chat-messages", selectedThreadId],
    queryFn: () => chatApi.getMessages(selectedThreadId!),
    enabled: !!selectedThreadId,
  });

  const { data: turmasData } = useQuery({
    queryKey: ["professor-turmas-chat"],
    queryFn: async () => turmasApi.getTurmasProfessor({ incluirPendentes: true }),
    enabled: (isProfessor || isAdmin) && newThreadOpen && newThreadTipo === "DISCIPLINA",
  });

  const { data: disciplinasData } = useQuery({
    queryKey: ["disciplinas-chat"],
    queryFn: () => disciplinasApi.getAll(),
    enabled: (isProfessor || isAdmin) && newThreadOpen && newThreadTipo === "DISCIPLINA",
  });

  const { data: availableContacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["chat-available-contacts"],
    queryFn: () => chatApi.getAvailableContacts(),
    enabled: canCreateThread && newThreadOpen && newThreadTipo === "DIRECT",
  });

  const sendMutation = useMutation({
    mutationFn: async ({
      threadId,
      content,
      files,
    }: {
      threadId: string;
      content: string;
      files?: File[];
    }) => {
      let attachments: AttachmentItem[] = [];
      if (files && files.length > 0) {
        attachments = await Promise.all(
          files.map((f) => chatApi.uploadAttachment(f))
        );
      }
      return chatApi.sendMessage(threadId, {
        content: content.trim() || "📎 Anexo",
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", selectedThreadId ?? ""] });
      setNewMessage("");
      setPendingFiles([]);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Erro ao enviar mensagem");
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const payload: { tipo: "DISCIPLINA" | "DIRECT"; disciplinaId?: string; targetUserId?: string } = {
        tipo: newThreadTipo,
      };
      if (newThreadTipo === "DISCIPLINA" && newThreadDisciplinaId) {
        payload.disciplinaId = newThreadDisciplinaId;
      } else if (newThreadTipo === "DIRECT" && newThreadTargetUserId) {
        payload.targetUserId = newThreadTargetUserId;
      }
      return chatApi.createThread(payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      setNewThreadOpen(false);
      setNewThreadDisciplinaId("");
      setNewThreadTargetUserId("");
      setSelectedThreadId(data.id);
      toast.success("Conversa aberta");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Erro ao criar conversa");
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (threadId: string) => chatApi.markAsRead(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      queryClient.invalidateQueries({ queryKey: ["chat-unread-count"] });
    },
  });

  const messages: ChatMessage[] = Array.isArray(messagesData) ? messagesData : [];
  const unreadCount = unreadData?.unreadCount ?? 0;

  useEffect(() => {
    if (selectedThreadId) {
      markReadMutation.mutate(selectedThreadId);
    }
  }, [selectedThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedThread = threads.find((t: ChatThread) => t.id === selectedThreadId);
  const turmasList = turmasData?.turmas ?? turmasData ?? [];
  const disciplinas = Array.from(
    new Map(
      (Array.isArray(turmasList) ? turmasList : [])
        .flatMap((t: any) => {
          if (t.disciplina) return [t.disciplina];
          if (t.disciplinaId) return [{ id: t.disciplinaId, nome: t.disciplinaNome || t.nome || t.codigo || "Disciplina" }];
          return [];
        })
        .filter((d: any) => d?.id)
        .map((d: any) => [d.id, d])
    ).values()
  );
  const disciplinasFromApi = Array.isArray(disciplinasData) ? disciplinasData : (disciplinasData as any)?.data ?? (disciplinasData as any)?.disciplinas ?? [];
  const disciplinasOptions = disciplinas.length > 0 ? disciplinas : disciplinasFromApi;
  const directUsers = (Array.isArray(availableContacts) ? availableContacts : [])
    .filter((u: any) => u.id !== user?.id)
    .sort((a: any, b: any) =>
      (a.nomeCompleto || a.nome_completo || a.email || "").localeCompare(
        b.nomeCompleto || b.nome_completo || b.email || ""
      )
    );

  const getThreadTitle = (t: ChatThread) => {
    if (t.tipo === "DISCIPLINA" && t.disciplina) return t.disciplina.nome;
    if (t.tipo === "DIRECT" && t.participants?.length) {
      const other = t.participants.find((p: any) => p.user?.id !== user?.id);
      return other?.user?.nomeCompleto || other?.user?.nome_completo || "Conversa privada";
    }
    return "Conversa";
  };

  const handleSend = () => {
    if (!selectedThreadId) return;
    if (!newMessage.trim() && pendingFiles.length === 0) return;
    sendMutation.mutate({
      threadId: selectedThreadId,
      content: newMessage.trim(),
      files: pendingFiles.length > 0 ? pendingFiles : undefined,
    });
  };

  const canSubmitNewThread =
    (newThreadTipo === "DISCIPLINA" && newThreadDisciplinaId) ||
    (newThreadTipo === "DIRECT" && newThreadTargetUserId);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center p-8">Carregando...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-12rem)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Chat</h1>
            <p className="text-muted-foreground text-sm">
              Conversas por disciplina ou mensagens diretas
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge variant="default">{unreadCount} não lida{unreadCount > 1 ? "s" : ""}</Badge>
            )}
            {canCreateThread && (
              <Button onClick={() => setNewThreadOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nova conversa
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-4 flex-1 min-h-0 border rounded-lg overflow-hidden bg-card">
          {/* Lista de conversas */}
          <div className="w-72 border-r flex flex-col bg-muted/30">
            {threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                <MessageCircle className="h-10 w-10 mb-2" />
                <p className="text-sm">Nenhuma conversa ainda</p>
                {canCreateThread && (
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setNewThreadOpen(true)}>
                    Iniciar conversa
                  </Button>
                )}
                {!canCreateThread && (
                  <p className="text-xs mt-2">Aguarde que um professor ou administrativo inicie uma conversa com você.</p>
                )}
              </div>
            ) : (
              <div className="overflow-y-auto flex-1">
                {threads.map((t: ChatThread) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedThreadId(t.id)}
                    className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${
                      selectedThreadId === t.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {t.tipo === "DISCIPLINA" ? (
                        <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{getThreadTitle(t)}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.lastMessage?.content || "Sem mensagens"}
                        </p>
                      </div>
                      {(t.unreadCount ?? 0) > 0 && (
                        <Badge variant="default" className="shrink-0 text-xs">
                          {t.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Área de mensagens */}
          <div className="flex-1 flex flex-col min-w-0">
            {!selectedThreadId ? (
              <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
                <MessageCircle className="h-16 w-16 mb-4 opacity-50" />
                <p>Selecione uma conversa ou inicie uma nova</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 border-b font-medium bg-muted/30">
                  {selectedThread ? getThreadTitle(selectedThread) : "..."}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messagesLoading ? (
                    <div className="flex justify-center py-8">Carregando...</div>
                  ) : (
                    messages.map((m: ChatMessage) => (
                      <div
                        key={m.id}
                        className={`flex ${m.isFromMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 ${
                            m.isFromMe ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="flex flex-col gap-2 mb-2">
                              {m.attachments.map((att, i) => (
                                <MessageAttachment key={i} attachment={att} isFromMe={m.isFromMe ?? false} />
                              ))}
                            </div>
                          )}
                          {m.content && m.content !== "📎 Anexo" && (
                            <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                          )}
                          <p className="text-xs opacity-80 mt-1">
                            {m.sender?.nomeCompleto || m.sender?.nome_completo || (m.isFromMe ? (user?.nome_completo || user?.nomeCompleto || "Eu") : "Usuário")} • {format(new Date(m.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-3 border-t">
                  {pendingFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {pendingFiles.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-lg bg-muted px-2 py-1 text-sm"
                        >
                          {f.type.startsWith("image/") ? (
                            <div className="w-10 h-10 rounded overflow-hidden bg-muted-foreground/20">
                              <img
                                src={URL.createObjectURL(f)}
                                alt={f.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="truncate max-w-[120px]">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                            className="p-0.5 rounded hover:bg-muted-foreground/20"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,video/mp4,video/webm,video/quicktime"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length) setPendingFiles((prev) => [...prev, ...files]);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      title="Anexar arquivo"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      placeholder="Digite sua mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      disabled={(!newMessage.trim() && pendingFiles.length === 0) || sendMutation.isPending}
                      onClick={handleSend}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal nova conversa - apenas para quem pode criar */}
      {canCreateThread && (
      <Dialog
        open={newThreadOpen}
        onOpenChange={(open) => {
          setNewThreadOpen(open);
          if (!open) {
            setNewThreadTargetUserId("");
            setContactPopoverOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <Select value={newThreadTipo} onValueChange={(v: any) => setNewThreadTipo(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isProfessor && (
                    <SelectItem value="DISCIPLINA">
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Disciplina (turma)
                      </span>
                    </SelectItem>
                  )}
                  <SelectItem value="DIRECT">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Mensagem direta
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newThreadTipo === "DISCIPLINA" && (
              <div>
                <label className="text-sm font-medium">Disciplina</label>
                <Select value={newThreadDisciplinaId} onValueChange={setNewThreadDisciplinaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    {disciplinasOptions.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {newThreadTipo === "DIRECT" && (
              <div>
                <label className="text-sm font-medium">Conversar com</label>
                <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={contactPopoverOpen}
                      className="w-full justify-between font-normal"
                      disabled={contactsLoading}
                    >
                      {contactsLoading
                        ? "Carregando contatos..."
                        : newThreadTargetUserId
                        ? directUsers.find((u: any) => u.id === newThreadTargetUserId)?.nomeCompleto ||
                          directUsers.find((u: any) => u.id === newThreadTargetUserId)?.nome_completo ||
                          directUsers.find((u: any) => u.id === newThreadTargetUserId)?.email ||
                          "Selecione"
                        : directUsers.length === 0
                        ? "Nenhum contato disponível"
                        : "Selecione a pessoa..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar por nome ou email..." />
                      <CommandList>
                        <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
                        <CommandGroup>
                          {directUsers.map((u: any) => (
                            <CommandItem
                              key={u.id}
                              value={`${u.nomeCompleto || u.nome_completo || u.email} ${u.email}`}
                              onSelect={() => {
                                setNewThreadTargetUserId(u.id);
                                setContactPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  newThreadTargetUserId === u.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {u.nomeCompleto || u.nome_completo || u.email} ({u.tipo === "ADMIN" ? "Administrativo" : u.tipo || "Usuário"})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {!contactsLoading && directUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Não há pessoas disponíveis para conversa direta no momento.
                  </p>
                )}
              </div>
            )}
            <Button
              className="w-full"
              disabled={!canSubmitNewThread || createThreadMutation.isPending}
              onClick={() => createThreadMutation.mutate()}
            >
              {createThreadMutation.isPending ? "Abrindo..." : "Abrir conversa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      )}
    </DashboardLayout>
  );
}
