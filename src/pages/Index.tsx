import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useSystemCheck } from '@/hooks/useSystemCheck';
import { useIsMobile } from '@/hooks/use-mobile';
import AppSidebar from '@/components/crm/AppSidebar';
import NotificationBell from '@/components/crm/NotificationBell';
import Login from '@/pages/Login';
import { Loader2, Menu } from 'lucide-react';

const DashboardPage = lazy(() => import('@/components/crm/DashboardPage'));
const ClientesPage = lazy(() => import('@/components/crm/ClientesPage'));
const CalculadoraPage = lazy(() => import('@/components/crm/CalculadoraPage'));
const ContratosPage = lazy(() => import('@/components/crm/ContratosPage'));
const AgendaPage = lazy(() => import('@/components/crm/AgendaPage'));
const ComissoesPage = lazy(() => import('@/components/crm/ComissoesPage'));
const ServicosExtrasPage = lazy(() => import('@/components/crm/ServicosExtrasPage'));
const ConfiguracoesPage = lazy(() => import('@/components/crm/ConfiguracoesPage'));
const AIHubPage = lazy(() => import('@/components/crm/AIHubPage'));
const EquipesPage = lazy(() => import('@/components/crm/EquipesPage'));
const DocumentosPage = lazy(() => import('@/components/crm/DocumentosPage'));
const WeatherPopup = lazy(() => import('@/components/crm/WeatherPopup'));

type Page = 'dashboard' | 'clientes' | 'calculadora' | 'contratos' | 'agenda' | 'servicos-extras' | 'comissoes' | 'configuracoes' | 'ai-hub' | 'equipes' | 'documentos';

export default function Index() {
  const { user, role, loading: authLoading, nome, signOut, isAdmin, isMaster } = useAuth();
  const { config } = useConfiguracoes();
  const { isReady, loading: systemLoading } = useSystemCheck();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => isMobile);

  useEffect(() => {
    setSidebarCollapsed(isMobile);
  }, [isMobile]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground font-mono">Iniciando Solar CRM...</span>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Pages accessible by role
  const viewerPages: Page[] = ['dashboard'];
  const tecnicoPages: Page[] = ['agenda', 'clientes', 'calculadora', 'contratos', 'ai-hub', 'documentos'];
  const vendedorPages: Page[] = ['agenda', 'servicos-extras', 'calculadora', 'clientes', 'contratos', 'ai-hub', 'documentos'];
  const adminPages: Page[] = ['dashboard', 'agenda', 'servicos-extras', 'calculadora', 'clientes', 'contratos', 'ai-hub', 'equipes', 'comissoes', 'documentos'];
  const masterPages: Page[] = [...adminPages, 'configuracoes'];

  let allowedPages: Page[];
  if (isMaster) allowedPages = masterPages;
  else if (isAdmin) allowedPages = adminPages;
  else if (role === 'vendedor') allowedPages = vendedorPages;
  else if (role === 'tecnico') allowedPages = tecnicoPages;
  else allowedPages = viewerPages;

  const defaultPage = (isAdmin || role === 'viewer') ? 'dashboard' : 'agenda';
  const effectivePage = allowedPages.includes(currentPage) ? currentPage : defaultPage;

  const pages: Record<Page, React.ReactNode> = {
    dashboard: <DashboardPage />,
    clientes: <ClientesPage role={role} />,
    calculadora: <CalculadoraPage />,
    contratos: <ContratosPage />,
    agenda: <AgendaPage />,
    'servicos-extras': <ServicosExtrasPage />,
    comissoes: <ComissoesPage />,
    'ai-hub': <AIHubPage />,
    equipes: <EquipesPage />,
    documentos: <DocumentosPage />,
    configuracoes: <ConfiguracoesPage />,
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        currentPage={currentPage}
        onNavigate={(page) => setCurrentPage(page)}
        role={role}
        nomeEmpresa={config.nome_empresa}
        logoUrl={config.logo_url}
        userName={nome || user.email}
        onSignOut={signOut}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      {sidebarCollapsed && <div className="hidden lg:block w-16 flex-shrink-0" />}
      <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-8 overflow-auto pb-safe safe-bottom">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          {sidebarCollapsed ? (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="lg:hidden p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              title="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          ) : <div />}
          <NotificationBell userId={user?.id} />
        </div>
        <WeatherPopup isAdmin={isAdmin} />
        <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
          {pages[effectivePage]}
        </Suspense>
      </main>
    </div>
  );
}
