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
  { id: 'documentos', label: 'Documentos', icon: FolderOpen, access: 'admin' },
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
    // Técnicos: only specific pages
    if (isTecnico) return ['agenda', 'calculadora', 'contratos', 'ai-hub'].includes(item.id);
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
        <div className="p-4 flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-contain flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-xl solar-gradient flex items-center justify-center flex-shrink-0">
              <Sun className="w-6 h-6 text-sidebar-primary-foreground" />
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="font-display font-bold text-base text-sidebar-primary-foreground truncate">{nomeEmpresa || 'Solar Service'}</h1>
              <p className="text-xs text-sidebar-foreground/60">CRM</p>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors flex-shrink-0"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
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
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  collapsed && "lg:justify-center lg:px-2",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="p-4 border-t border-sidebar-border space-y-3">
            {userName && (
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-sidebar-foreground/80 truncate">{userName}</p>
                  <p className="text-[10px] text-sidebar-foreground/40 uppercase">{getRoleLabel(role)}</p>
                </div>
                {onSignOut && (
                  <button onClick={onSignOut} className="text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors" title="Sair">
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-sidebar-foreground/40 text-center">{nomeEmpresa || 'Solar Service'} CRM v2.1</p>
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
