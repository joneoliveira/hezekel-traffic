import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layers, Settings, LayoutDashboard, Menu, ChevronDown, Check, Loader2, Building2, LogOut, Film, Leaf, Briefcase, Megaphone, ShieldCheck, FileBarChart, Camera, X, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountContext } from '@/contexts/AccountContext';
import { useClientContext } from '@/contexts/ClientContext';
import { useAuth, canAccess } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type Page = 'dashboard' | 'creative' | 'settings' | 'content' | 'content_intelligence' | 'organic_intelligence' | 'campaigns' | 'create_campaign' | 'admin' | 'reports';

export const PAGE_TO_PATH: Record<Page, string> = {
  dashboard:            '/dashboard',
  campaigns:            '/campanhas',
  create_campaign:      '/campanhas/criar',
  creative:             '/creative',
  content:              '/content',
  content_intelligence: '/content-intel',
  organic_intelligence: '/organic-intel',
  reports:              '/reports',
  settings:             '/configuracoes',
  admin:                '/admin',
};

export const PATH_TO_PAGE: Record<string, Page> = Object.fromEntries(
  Object.entries(PAGE_TO_PATH).map(([k, v]) => [v, k as Page])
);

interface LayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS: { id: Page; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'dashboard',            label: 'Dashboard',                  icon: LayoutDashboard },
  { id: 'campaigns',            label: 'Campanhas',                  icon: Megaphone },
  { id: 'creative',             label: 'Creative Intelligence',      icon: Layers },
  { id: 'content_intelligence', label: 'Content Intel. — Paid',      icon: Film },
  { id: 'organic_intelligence', label: 'Content Intel. — Organic',   icon: Leaf },
  { id: 'content',              label: 'Métricas Conteúdo',          icon: Building2 },
  { id: 'reports',              label: 'Reports',                    icon: FileBarChart },
  { id: 'settings',             label: 'Configurações',              icon: Settings },
  { id: 'admin',                label: 'Admin',                      icon: ShieldCheck },
];

function ClientSwitcherHeader() {
  const { clients, activeClient, setActiveClientId } = useClientContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (clients.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors text-sm"
      >
        <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium max-w-[160px] truncate">{activeClient?.name ?? '—'}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-popover border border-border rounded-lg shadow-lg z-50 py-1 overflow-hidden">
          <p className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Trocar cliente</p>
          {clients.map(client => (
            <button
              key={client.id}
              onClick={() => { setActiveClientId(client.id); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {client.id === activeClient?.id && <Check className="w-3.5 h-3.5 text-primary" />}
              </div>
              <span className={cn('truncate', client.id === activeClient?.id && 'font-semibold')}>{client.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

// ── Profile Modal ─────────────────────────────────────────────────────────────

function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user?.user_metadata?.avatar_url ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setMsg('');
    const { error } = await supabase.storage
      .from('avatars')
      .upload(user.id, file, { upsert: true, contentType: file.type });
    if (error) {
      setMsgOk(false);
      setMsg(`Erro ao enviar foto: ${error.message}`);
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(user.id);
    const bust = `${publicUrl}?t=${Date.now()}`;
    await supabase.auth.updateUser({ data: { avatar_url: bust } });
    setAvatarUrl(bust);
    setUploading(false);
    setMsgOk(true);
    setMsg('Foto atualizada!');
  }

  async function handleSavePassword() {
    if (password.length < 6) { setMsgOk(false); setMsg('Senha mínimo 6 caracteres.'); return; }
    if (password !== confirmPassword) { setMsgOk(false); setMsg('Senhas não coincidem.'); return; }
    setSaving(true);
    setMsg('');
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { setMsgOk(false); setMsg(error.message); return; }
    setMsgOk(true);
    setMsg('Senha alterada com sucesso!');
    setPassword(''); setConfirmPassword('');
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '?';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Meu perfil</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-border flex items-center justify-center text-xl font-bold text-primary">
                {initials}
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alterar senha</p>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Nova senha"
              className="w-full h-8 rounded border border-input bg-background px-2 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPw ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          </div>
          <input
            type={showPw ? 'text' : 'password'}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirmar senha"
            className="w-full h-8 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={handleSavePassword}
            disabled={saving || !password}
            className="w-full h-8 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            Salvar senha
          </button>
        </div>

        {msg && (
          <p className={`text-xs px-2 py-1.5 rounded border ${msgOk ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Avatar Button ──────────────────────────────────────────────────────────────

function AvatarButton({ onClick }: { onClick: () => void }) {
  const { user } = useAuth();
  const avatarUrl = user?.user_metadata?.avatar_url ?? null;
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '?';

  return (
    <button
      onClick={onClick}
      title="Meu perfil"
      className="w-7 h-7 rounded-full overflow-hidden border border-border hover:border-primary transition-colors shrink-0 ml-1"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
          {initials}
        </div>
      )}
    </button>
  );
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const { activeAccount } = useAccountContext();
  const { role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = PATH_TO_PAGE[location.pathname];

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
        <ClientSwitcherHeader />
        <AccountSwitcherHeader />
        <AvatarButton onClick={() => setProfileOpen(true)} />
        <button
          onClick={signOut}
          title="Sair"
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0 ml-1"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={cn(
          'flex flex-col border-r border-border bg-gradient-to-b from-card to-background transition-all duration-200 shrink-0',
          sidebarOpen ? 'w-52' : 'w-0 overflow-hidden border-r-0'
        )}>
          <nav className="flex-1 py-3 space-y-0.5 px-2">
            {visibleNav.map(item => (
              <button key={item.id} onClick={() => navigate(PAGE_TO_PATH[item.id])}
                className={cn(
                  'w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-all duration-150',
                  currentPage === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}>
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="px-4 py-3 border-t border-border">
            <p className="text-[11px] text-muted-foreground/60 font-mono">v{__APP_VERSION__}</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
