import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { notificacoesApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  link: string | null;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notificacoes.filter(n => !n.lida).length;

  const fetchNotificacoes = useCallback(async () => {
    if (!user) return;
    
    // Super Admin sem instituição não precisa de notificações específicas
    // (ou pode ver todas, mas por ora vamos apenas não buscar para evitar erro)
    if (isSuperAdmin && !instituicaoId) {
      // Super Admin sem instituição associada não busca notificações
      setNotificacoes([]);
      return;
    }
    
    // Se não tem instituição e não é Super Admin, também não busca
    if (!instituicaoId && !isSuperAdmin) {
      setNotificacoes([]);
      return;
    }
    
    try {
      const data = await notificacoesApi.getAll({ userId: user.id, limit: 20 });
      setNotificacoes(data || []);
    } catch (error: any) {
      // Ignorar erro de escopo de instituição silenciosamente
      if (error?.message?.includes('escopo de instituição') || 
          error?.response?.data?.message?.includes('escopo de instituição')) {
        // Super Admin sem instituição - não buscar notificações
        setNotificacoes([]);
        return;
      }
      
      // Ignorar erros de conexão silenciosamente (backend não está rodando)
      const isConnectionError = 
        error?.code === 'ERR_NETWORK' || 
        error?.code === 'ECONNREFUSED' || 
        error?.message?.includes('Network Error') ||
        error?.message?.includes('Não foi possível conectar ao servidor');
      
      if (isConnectionError) {
        // Backend não está disponível - não logar erro, apenas definir array vazio
        setNotificacoes([]);
        return;
      }
      
      // Logar apenas outros tipos de erro (não relacionados à conexão)
      console.error('Error fetching notifications:', error);
      // Não definir erro para não quebrar a UI
      setNotificacoes([]);
    }
  }, [user, instituicaoId, isSuperAdmin]);

  useEffect(() => {
    fetchNotificacoes();
    
    // Poll for new notifications every 30 seconds (apenas se tiver instituição)
    if (instituicaoId || (isSuperAdmin && instituicaoId)) {
      const interval = setInterval(fetchNotificacoes, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchNotificacoes, instituicaoId, isSuperAdmin]);

  const markAsRead = async (id: string) => {
    try {
      await notificacoesApi.update(id, { lida: true });
      setNotificacoes(prev =>
        prev.map(n => (n.id === id ? { ...n, lida: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      await notificacoesApi.marcarTodasLidas(user.id);
      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case "Sucesso": return "bg-green-100 text-green-800";
      case "Aviso": return "bg-yellow-100 text-yellow-800";
      case "Erro": return "bg-red-100 text-red-800";
      default: return "bg-blue-100 text-blue-800";
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notificações</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notificacoes.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y">
              {notificacoes.map((notificacao) => (
                <div
                  key={notificacao.id}
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !notificacao.lida ? "bg-muted/30" : ""
                  }`}
                  onClick={() => markAsRead(notificacao.id)}
                >
                  <div className="flex items-start gap-2">
                    <Badge className={getTipoColor(notificacao.tipo)} variant="secondary">
                      {notificacao.tipo}
                    </Badge>
                    {!notificacao.lida && (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <h5 className="font-medium mt-1">{notificacao.titulo}</h5>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {notificacao.mensagem}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {notificacao.created_at && !isNaN(new Date(notificacao.created_at).getTime()) 
                      ? format(new Date(notificacao.created_at), "dd MMM, HH:mm", { locale: ptBR })
                      : 'Data inválida'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}