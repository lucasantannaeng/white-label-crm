import { Sun, LayoutDashboard, Users, SprayCan, FileText, Calendar, Settings, DollarSign, LogOut, BotMessageSquare, Wrench, UsersRound, FolderOpen, PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/hooks/useAuth';

type Page = 'dashboard' | 'clientes' | 'calculadora' | 'contratos' | 'agenda' | 'servicos-extras' | 'comissoes' | 'configuracoes' | 'ai-hub' | 'equipes' | 'documentos';

interface AppSidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  role: AppRole | null;
  nomeEmpresa?: string;
  logoUrl?: string | null;
  userName?: string;
  onSignOut?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const allNavItems: { id: Page; label: string; icon: React.ElementType; access: 'all' | 'admin' | 'master' | 'admin_vendedor' }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, access: 'admin' },
  { id: 'clientes', label: 'Clientes', icon: Users, access: 'all' },
  { id: 'calculadora', label: 'Limpeza de Módulos', icon: SprayCan, access: 'all' },
  { id: 'contratos', label: 'Contratos', icon: FileText, access: 'all' },
  { id: 'agenda', label: 'Agenda', icon: Calendar, access: 'all' },
  { id: 'servicos-extras', label: 'Novos Serviços', icon: Wrench, access: 'admin_vendedor' },
  { id: 'equipes', label: 'Equipes', icon: UsersRound, access: 'admin' },
  { id: 'comissoes', label: 'Comissões', icon: DollarSign, access: 'admin' },
  { id: 'documentos', label: 'Documentos', icon: FolderOpen, access: 'all' },
  { id: 'ai-hub', label: 'Hub de IA', icon: BotMessageSquare, access: 'all' },
  { id: 'configuracoes', label: 'Configurações', icon: Settings, access: 'master' },
];

function getRoleLabel(role: AppRole | null) {
  switch (role) {
    case 'master': return 'Admin Master';
    case 'admin': return 'Administrador';
    case 'vendedor': return 'Vendedor';
    case 'tecnico': return 'Técnico';
    case 'viewer': return 'Visualizador';
    default: return 'Usuário';
  }
}

export default function AppSidebar({ currentPage, onNavigate, role, nomeEmpresa, logoUrl, userName, onSignOut, collapsed, onToggleCollapse }: AppSidebarProps) {
  const isAdmin = role === 'admin' || role === 'master';
  const isMaster = role === 'master';

  const isViewer = role === 'viewer';

  const isTecnico = role === 'tecnico';

  const navItems = allNavItems.filter(item => {
    if (isViewer) return item.id === 'dashboard';
    // Técnicos: field-accessible pages
    if (isTecnico) return ['agenda', 'clientes', 'calculadora', 'contratos', 'ai-hub', 'documentos'].includes(item.id);
    if (item.access === 'all') return true;
    if (item.access === 'admin_vendedor') return isAdmin || role === 'vendedor';
    if (item.access === 'master') return isMaster;
    if (item.access === 'admin') return isAdmin;
    return false;
  });

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onToggleCollapse}
        />
      )}

      <aside
        className={cn(
          "fixed lg:relative z-40 min-h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-all duration-300",
          collapsed ? "-translate-x-full lg:translate-x-0 lg:w-16" : "translate-x-0 w-64"
        )}
      >
        {/* Header */}
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border/60">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-contain flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-xl solar-gradient flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/20">
              <Sun className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-sm text-sidebar-primary-foreground truncate">{nomeEmpresa || 'Solar Service'}</h1>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/90 font-medium">ONLINE</span>
              </div>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors flex-shrink-0"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  if (window.innerWidth < 1024 && onToggleCollapse) {
                    onToggleCollapse();
                  }
                }}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 relative",
                  collapsed && "lg:justify-center lg:px-2",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary-foreground font-semibold shadow-sm border border-sidebar-border before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-primary before:rounded-r"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0 transition-transform", isActive ? "text-primary scale-105" : "text-sidebar-foreground/60")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="p-3 border-t border-sidebar-border/60 space-y-2.5 bg-sidebar-background/50">
            {userName && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-sidebar-accent/40 border border-sidebar-border/40">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-sidebar-foreground truncate">{userName}</p>
                  <span className="inline-block mt-0.5 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                    {getRoleLabel(role)}
                  </span>
                </div>
                {onSignOut && (
                  <button onClick={onSignOut} className="text-sidebar-foreground/40 hover:text-destructive transition-colors p-1" title="Sair do Sistema">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center justify-between text-[10px] font-mono text-sidebar-foreground/40 px-1">
              <span>{nomeEmpresa || 'Solar Service'}</span>
              <span>v2.2-pro</span>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="hidden lg:flex p-3 border-t border-sidebar-border justify-center">
            {onSignOut && (
              <button onClick={onSignOut} className="text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors" title="Sair">
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
