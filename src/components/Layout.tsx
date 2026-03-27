import { useState, useRef, useEffect } from 'react';
import { Layers, Settings, LayoutDashboard, Menu, ChevronDown, Check, Loader2, Building2, LogOut, Film, Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountContext } from '@/contexts/AccountContext';
import { useAuth, canAccess } from '@/contexts/AuthContext';

export type Page = 'dashboard' | 'creative' | 'settings' | 'content' | 'content_intelligence' | 'organic_intelligence';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const NAV_ITEMS: { id: Page; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'dashboard', label: 'Dashboard DCM', icon: LayoutDashboard },
  { id: 'creative', label: 'Creative Intelligence', icon: Layers },
  { id: 'content_intelligence', label: 'Content Intel. — Paid', icon: Film },
  { id: 'organic_intelligence', label: 'Content Intel. — Organic', icon: Leaf },
  { id: 'content', label: 'Métricas Conteúdo', icon: Building2 },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

function AccountSwitcherHeader() {
  const { accounts, activeAccount, switchAccount } = useAccountContext();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleSwitch(id: string) {
    if (id === activeAccount?.id) { setOpen(false); return; }
    setSwitching(id);
    await switchAccount(id);
    setSwitching(null);
    setOpen(false);
  }

  if (accounts.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors text-sm"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="font-medium max-w-[180px] truncate">{activeAccount?.name ?? '—'}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-popover border border-border rounded-lg shadow-lg z-50 py-1 overflow-hidden">
          <p className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Trocar conta</p>
          {accounts.map(account => (
            <button
              key={account.id}
              onClick={() => handleSwitch(account.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {switching === account.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : account.is_active
                    ? <Check className="w-3.5 h-3.5 text-primary" />
                    : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('truncate', account.is_active && 'font-semibold')}>{account.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{account.ad_account_id}</p>
              </div>
            </button>
          ))}
          {accounts.length > 1 && (
            <div className="border-t border-border mt-1 pt-1 px-3 py-1.5 text-xs text-muted-foreground">
              {accounts.length} contas configuradas
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { activeAccount } = useAccountContext();
  const { role, signOut } = useAuth();

  const visibleNav = NAV_ITEMS.filter(item => canAccess(role, item.id));

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top header bar */}
      <header className="h-11 border-b bg-card flex items-center px-3 gap-3 shrink-0 z-10">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded hover:bg-muted transition-colors shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>
        <img src="/logo.svg" alt="Hezekel Traffic" className="h-7 w-auto" />
        <div className="flex-1" />
        {activeAccount && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground border-r border-border pr-3 mr-1">
            <Building2 className="w-3.5 h-3.5" />
            <span className="font-mono">{activeAccount.ad_account_id}</span>
          </div>
        )}
        <AccountSwitcherHeader />
        <button
          onClick={signOut}
          title="Sair"
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0 ml-1"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={cn(
          'flex flex-col border-r bg-card transition-all duration-200 shrink-0',
          sidebarOpen ? 'w-52' : 'w-0 overflow-hidden border-r-0'
        )}>
          <nav className="flex-1 py-3 space-y-0.5 px-2">
            {visibleNav.map(item => (
              <button key={item.id} onClick={() => onNavigate(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors',
                  currentPage === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}>
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
