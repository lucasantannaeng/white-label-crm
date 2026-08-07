import { useState } from 'react';
import { Bell, BellRing, Check, CheckCheck, Trash2, X, Calendar, CloudRain, Route } from 'lucide-react';
import { useNotifications, type Notificacao } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface NotificationBellProps {
  userId: string | undefined;
}

const tipoIcons: Record<string, React.ElementType> = {
  agendamento: Calendar,
  clima: CloudRain,
  rota: Route,
  info: Bell,
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const {
    notificacoes,
    naoLidas,
    pushPermission,
    marcarComoLida,
    marcarTodasComoLidas,
    excluirNotificacao,
    requestPushPermission,
  } = useNotifications(userId);

  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          title="Notificações"
        >
          {naoLidas > 0 ? (
            <BellRing className="w-5 h-5 text-primary animate-pulse" />
          ) : (
            <Bell className="w-5 h-5 text-muted-foreground" />
          )}
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {naoLidas > 99 ? '99+' : naoLidas}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 sm:w-96 p-0"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notificações</h3>
          <div className="flex items-center gap-1">
            {naoLidas > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={marcarTodasComoLidas}
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Ler todas
              </Button>
            )}
            {pushPermission === 'default' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary"
                onClick={requestPushPermission}
              >
                <BellRing className="w-3.5 h-3.5 mr-1" />
                Ativar push
              </Button>
            )}
          </div>
        </div>

        {/* Notifications list */}
        <ScrollArea className="max-h-[360px]">
          {notificacoes.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y">
              {notificacoes.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notif={notif}
                  onRead={marcarComoLida}
                  onDelete={excluirNotificacao}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({
  notif,
  onRead,
  onDelete,
}: {
  notif: Notificacao;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const Icon = tipoIcons[notif.tipo] || Bell;

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 transition-colors group',
        !notif.lida && 'bg-primary/5'
      )}
    >
      <div className={cn(
        'mt-0.5 p-1.5 rounded-full flex-shrink-0',
        !notif.lida ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-tight', !notif.lida && 'font-medium')}>
          {notif.titulo}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notif.mensagem}
        </p>
        <span className="text-[10px] text-muted-foreground/60 mt-1 block">
          {timeAgo(notif.created_at)}
        </span>
      </div>
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notif.lida && (
          <button
            onClick={() => onRead(notif.id)}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            title="Marcar como lida"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => onDelete(notif.id)}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          title="Excluir"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
