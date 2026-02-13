import React, { useEffect, useState } from 'react';
import { notificacoesApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { Bell, Check, X, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  link: string | null;
  created_at: string;
  createdAt?: string;
}

export const NotificationsRealtime: React.FC = () => {
  const { user } = useAuth();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  useEffect(() => {
    if (!user?.id) return;

    // Buscar notificações iniciais
    const fetchNotificacoes = async () => {
      // Super Admin sem instituição não busca notificações
      if (isSuperAdmin && !instituicaoId) {
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
        if (data) {
          setNotificacoes(data.map((n: any) => ({
            ...n,
            created_at: n.createdAt || n.created_at
          })));
        }
      } catch (error: any) {
        // Ignorar erro de escopo de instituição silenciosamente
        if (error?.message?.includes('escopo de instituição') || 
            error?.response?.data?.message?.includes('escopo de instituição')) {
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
        
        // Não logar outros erros de notificação para não poluir console
        setNotificacoes([]);
      }
    };

    fetchNotificacoes();

    // Poll for new notifications every 30 seconds (apenas se tiver instituição)
    if (instituicaoId || (isSuperAdmin && instituicaoId)) {
      const interval = setInterval(fetchNotificacoes, 30000);
      return () => {
        clearInterval(interval);
      };
    }
  }, [user?.id, instituicaoId, isSuperAdmin]);

  const marcarComoLida = async (id: string) => {
    try {
      await notificacoesApi.update(id, { lida: true });
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const marcarTodasComoLidas = async () => {
    if (!user?.id) return;
    try {
      await notificacoesApi.marcarTodasLidas(user.id);
      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const excluirNotificacao = async (id: string) => {
    try {
      await notificacoesApi.delete(id);
      setNotificacoes((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleClick = (notificacao: Notificacao) => {
    marcarComoLida(notificacao.id);
    if (notificacao.link) {
      navigate(notificacao.link);
      setIsOpen(false);
    }
  };

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {naoLidas > 9 ? '9+' : naoLidas}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold">Notificações</h4>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={marcarTodasComoLidas}
              className="text-xs"
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notificacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y">
              {notificacoes.map((notificacao) => (
                <div
                  key={notificacao.id}
                  className={`px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                    !notificacao.lida ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => handleClick(notificacao)}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5">{getIcon(notificacao.tipo)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm truncate">
                          {notificacao.titulo}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            excluirNotificacao(notificacao.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notificacao.mensagem}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(() => {
                          const dateStr = notificacao.created_at || notificacao.createdAt;
                          const date = dateStr ? new Date(dateStr) : new Date();
                          if (isNaN(date.getTime())) {
                            return 'Data inválida';
                          }
                          return formatDistanceToNow(date, {
                            addSuffix: true,
                            locale: ptBR,
                          });
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
