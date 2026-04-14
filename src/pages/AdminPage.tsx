import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronRight,
  Loader2, KeyRound, Eye, EyeOff, RefreshCw, UserPlus,
  CheckCircle2, AlertCircle, Star, Users, Building2,
} from 'lucide-react';
import type { UserRole } from '@/contexts/AuthContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  gestor: 'Gestor',
  gestor_trafego: 'Gestor de Tráfego',
  marketing: 'Time Marketing',
  social_media: 'Social Media',
};

interface ClientRow { id: string; name: string; created_at: string; }
interface UserRow { id: string; email: string; role: UserRole; }
interface AccountRow { id: string; name: string; ad_account_id: string; access_token: string; is_active: boolean; client_id: string; }
interface IgAccountRow { id: string; name: string; ig_account_id: string; access_token: string; client_id: string; }
interface ClientUser { client_id: string; user_id: string; }

// ── Token Field ────────────────────────────────────────────────────────────────

function TokenField({ accountId, initialToken, table = 'meta_accounts' }: { accountId: string; initialToken: string; table?: string }) {
  const [token, setToken] = useState(initialToken);
  const [savedToken, setSavedToken] = useState(initialToken);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = token !== savedToken;

  async function handleSave() {
    setSaving(true);
    await (supabase.from(table as any) as any).update({ access_token: token }).eq('id', accountId);
    setSavedToken(token);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type={show ? 'text' : 'password'}
          value={token}
          onChange={e => { setToken(e.target.value); setSaved(false); }}
          placeholder="Token de acesso Meta..."
          className="w-full h-7 rounded border border-input bg-background px-2 pr-8 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button type="button" onClick={() => setShow(!show)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
      </div>
      {dirty && (
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs px-2 shrink-0">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
        </Button>
      )}
      {saved && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
    </div>
  );
}

// ── Account Item ───────────────────────────────────────────────────────────────

function AccountItem({ account, onDelete, onActivate }: {
  account: AccountRow;
  onDelete: (id: string) => void;
  onActivate: (id: string, clientId: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  return (
    <div className={`p-3 rounded-lg border ${account.is_active ? 'border-primary/30 bg-primary/5' : 'border-border bg-background'}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{account.name}</span>
            {account.is_active && (
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-wide">Ativa</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{account.ad_account_id}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!account.is_active && (
            <Button variant="outline" size="sm" onClick={() => onActivate(account.id, account.client_id)} className="h-6 text-xs px-2">
              <Star className="w-3 h-3 mr-1" />Ativar
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={async () => { setDeleting(true); onDelete(account.id); }} disabled={deleting} className="h-6 w-6 text-muted-foreground hover:text-destructive">
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </Button>
        </div>
      </div>
      <div className="mt-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1 flex items-center gap-1">
          <KeyRound className="w-2.5 h-2.5" />Token
        </p>
        <TokenField accountId={account.id} initialToken={account.access_token || ''} />
      </div>
    </div>
  );
}

// ── Add Account Inline ─────────────────────────────────────────────────────────

function AddAccountInline({ clientId, onAdded }: { clientId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [adAccountId, setAdAccountId] = useState('');
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(true);

  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2">
      <Plus className="w-3 h-3" />Adicionar conta
    </button>
  );

  async function handleTest() {
    setTesting(true);
    setMsg('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-test-connection`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token, adAccountId }),
      });
      const data = await res.json();
      if (data.success) {
        setMsgOk(true);
        setMsg(`Conectado: ${data.accountName || adAccountId}`);
        setTested(true);
        if (!name && data.accountName) setName(data.accountName);
      } else {
        setMsgOk(false);
        setMsg(data.error || 'Falha na conexão.');
      }
    } catch (e: any) {
      setMsgOk(false);
      setMsg(e.message);
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { count } = await supabase
        .from('meta_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId);
      const isFirst = (count ?? 0) === 0;
      const { error } = await supabase.from('meta_accounts').insert({
        name: name || adAccountId,
        ad_account_id: adAccountId,
        access_token: token,
        is_active: isFirst,
        client_id: clientId,
      });
      if (error) throw new Error(error.message);
      setAdAccountId(''); setName(''); setToken('');
      setTested(false); setMsg('');
      setOpen(false);
      onAdded();
    } catch (e: any) {
      setMsgOk(false);
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 p-3 rounded-lg border border-dashed border-border bg-muted/30 space-y-2">
      <div className="flex gap-2">
        <input
          value={adAccountId}
          onChange={e => { setAdAccountId(e.target.value); setTested(false); }}
          placeholder="act_xxxxxxxxxx"
          className="flex-1 h-8 rounded border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <input
        type="password"
        value={token}
        onChange={e => { setToken(e.target.value); setTested(false); }}
        placeholder="Token de acesso Meta..."
        className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {tested && (
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nome da conta"
          className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
      )}
      {msg && (
        <div className={`flex items-center gap-1.5 text-xs p-2 rounded border ${msgOk ? 'bg-emerald-950/50 border-emerald-700/40 text-emerald-400' : 'bg-red-950/50 border-red-800/40 text-red-400'}`}>
          {msgOk ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
          {msg}
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || !adAccountId || !token} className="h-7 text-xs flex-1">
          {testing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}Testar
        </Button>
        {tested && (
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs flex-1">
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}Salvar
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setMsg(''); }} className="h-7 w-7 text-xs p-0">
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ── IG Account Item ────────────────────────────────────────────────────────────

function IgAccountItem({ account, onDelete }: {
  account: IgAccountRow;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="p-3 rounded-lg border border-border bg-background">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate">{account.name}</span>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{account.ig_account_id}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={async () => { setDeleting(true); onDelete(account.id); }} disabled={deleting} className="h-6 w-6 text-muted-foreground hover:text-destructive">
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </Button>
      </div>
      <div className="mt-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1 flex items-center gap-1">
          <KeyRound className="w-2.5 h-2.5" />Token
        </p>
        <TokenField accountId={account.id} initialToken={account.access_token || ''} table="ig_accounts" />
      </div>
    </div>
  );
}

// ── Add IG Account Inline ──────────────────────────────────────────────────────

interface IgAccountOption { id: string; name: string; username: string; }

function AddIgAccountInline({ clientId, onAdded }: { clientId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState<IgAccountOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<IgAccountOption | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(true);

  function reset() {
    setToken(''); setOptions([]); setSelectedOption(null); setName(''); setMsg('');
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2">
      <Plus className="w-3 h-3" />Adicionar conta Instagram
    </button>
  );

  async function handleFetch() {
    setFetching(true);
    setMsg('');
    setOptions([]);
    setSelectedOption(null);
    try {
      // Fetch Facebook Pages linked to the token
      const pagesRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account{id,name,username}&access_token=${token}`
      );
      const pagesData = await pagesRes.json();
      if (pagesData.error) throw new Error(pagesData.error.message);

      const found: IgAccountOption[] = [];
      for (const page of pagesData.data || []) {
        const ig = page.instagram_business_account;
        if (ig?.id) {
          found.push({ id: ig.id, name: ig.name || ig.username || ig.id, username: ig.username || '' });
        }
      }
      if (found.length === 0) throw new Error('Nenhuma conta Instagram Business encontrada neste token.');
      setOptions(found);
      setSelectedOption(found[0]);
      setName(found[0].name);
      setMsgOk(true);
      setMsg(`${found.length} conta${found.length > 1 ? 's' : ''} encontrada${found.length > 1 ? 's' : ''}.`);
    } catch (e: any) {
      setMsgOk(false);
      setMsg(e.message);
    } finally {
      setFetching(false);
    }
  }

  async function handleSave() {
    if (!selectedOption || !name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('ig_accounts').insert({
        name: name.trim(),
        ig_account_id: selectedOption.id,
        access_token: token,
        client_id: clientId,
        is_active: true,
      });
      if (error) throw new Error(error.message);
      reset();
      setOpen(false);
      onAdded();
    } catch (e: any) {
      setMsgOk(false);
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 p-3 rounded-lg border border-dashed border-border bg-muted/30 space-y-2">
      {/* Step 1: Token */}
      <div className="flex gap-2">
        <input
          type="password"
          value={token}
          onChange={e => { setToken(e.target.value); setOptions([]); setSelectedOption(null); setMsg(''); }}
          placeholder="Token de acesso Meta..."
          className="flex-1 h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button variant="outline" size="sm" onClick={handleFetch} disabled={fetching || !token} className="h-8 text-xs shrink-0">
          {fetching ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          Buscar contas
        </Button>
      </div>

      {/* Step 2: Select account */}
      {options.length > 0 && (
        <>
          <select
            value={selectedOption?.id || ''}
            onChange={e => {
              const opt = options.find(o => o.id === e.target.value) || null;
              setSelectedOption(opt);
              if (opt) setName(opt.name);
            }}
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {options.map(o => (
              <option key={o.id} value={o.id}>
                {o.username ? `@${o.username}` : o.name} — {o.id}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome de exibição"
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </>
      )}

      {msg && (
        <div className={`flex items-center gap-1.5 text-xs p-2 rounded border ${msgOk ? 'bg-emerald-950/50 border-emerald-700/40 text-emerald-400' : 'bg-red-950/50 border-red-800/40 text-red-400'}`}>
          {msgOk ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
          {msg}
        </div>
      )}

      <div className="flex gap-2">
        {selectedOption && (
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()} className="h-7 text-xs flex-1">
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}Salvar
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => { setOpen(false); reset(); }} className="h-7 w-7 text-xs p-0">
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Add User To Client ─────────────────────────────────────────────────────────

function AddUserToClient({
  clientId,
  assignedUserIds,
  allNonAdminUsers,
  onCreateUser,
  onLinked,
}: {
  clientId: string;
  assignedUserIds: string[];
  allNonAdminUsers: UserRow[];
  onCreateUser: (clientId: string, email: string, password: string, role: UserRole) => Promise<{ error?: string }>;
  onLinked: (clientId: string, userId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'link'>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('gestor_trafego');
  const [creating, setCreating] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [linking, setLinking] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(true);

  const available = allNonAdminUsers.filter(u => !assignedUserIds.includes(u.id));

  function reset() {
    setEmail(''); setPassword(''); setSelectedUserId(''); setMsg(''); setMsgOk(true);
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2">
      <UserPlus className="w-3 h-3" />Adicionar usuário
    </button>
  );

  async function handleCreate() {
    setCreating(true);
    setMsg('');
    const { error } = await onCreateUser(clientId, email, password, role);
    setCreating(false);
    if (error) {
      setMsgOk(false);
      setMsg(error);
      return;
    }
    setMsgOk(true);
    setMsg(`Usuário ${email} criado e vinculado!`);
    setEmail(''); setPassword(''); setRole('gestor_trafego');
    // não fecha automaticamente — usuário fecha com X após ver a confirmação
  }

  async function handleLink() {
    if (!selectedUserId) return;
    setLinking(true);
    await onLinked(clientId, selectedUserId);
    setLinking(false);
    setMsgOk(true);
    setMsg('Usuário vinculado!');
    setSelectedUserId('');
    // não fecha automaticamente
  }

  return (
    <div className="mt-2 p-3 rounded-lg border border-dashed border-border bg-muted/30 space-y-2">
      {/* Mode toggle */}
      <div className="flex gap-1 bg-muted rounded-md p-0.5 w-fit">
        <button type="button" onClick={() => { setMode('create'); setMsg(''); }}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${mode === 'create' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Criar novo
        </button>
        <button type="button" onClick={() => { setMode('link'); setMsg(''); }}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${mode === 'link' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Usuário existente
        </button>
      </div>

      {mode === 'create' ? (
        <>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Senha (mín. 6 caracteres)"
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
          <select value={role} onChange={e => setRole(e.target.value as UserRole)}
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="gestor">Gestor</option>
            <option value="gestor_trafego">Gestor de Tráfego</option>
            <option value="marketing">Time Marketing</option>
            <option value="social_media">Social Media</option>
          </select>
        </>
      ) : available.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">
          Nenhum usuário disponível.{' '}
          <button type="button" onClick={() => setMode('create')} className="underline hover:text-foreground">Criar novo?</button>
        </p>
      ) : (
        <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
          className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="">Selecionar usuário...</option>
          {available.map(u => (
            <option key={u.id} value={u.id}>{u.email} · {ROLE_LABELS[u.role]}</option>
          ))}
        </select>
      )}

      {msg && (
        <div className={`flex items-center gap-1.5 text-xs p-2 rounded border ${msgOk ? 'bg-emerald-950/50 border-emerald-700/40 text-emerald-400' : 'bg-red-950/50 border-red-800/40 text-red-400'}`}>
          {msgOk ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
          {msg}
        </div>
      )}

      <div className="flex gap-2">
        {mode === 'create' ? (
          <Button size="sm" onClick={handleCreate}
            disabled={creating || !email || password.length < 6}
            className="h-7 text-xs flex-1">
            {creating && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            Criar e vincular
          </Button>
        ) : (
          <Button size="sm" onClick={handleLink}
            disabled={linking || !selectedUserId || available.length === 0}
            className="h-7 text-xs flex-1">
            {linking && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            Vincular
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => { setOpen(false); reset(); }} className="h-7 w-7 p-0">
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Client Card ────────────────────────────────────────────────────────────────

function ClientCard({
  client, accounts, igAccounts, assignedUsers, allNonAdminUsers, syncLogs,
  onRename, onDelete, onCreateUser, onAddUser, onRemoveUser,
  onDeleteAccount, onActivateAccount, onSync, onAccountAdded,
  onDeleteIgAccount, onIgAccountAdded,
}: {
  client: ClientRow;
  accounts: AccountRow[];
  igAccounts: IgAccountRow[];
  assignedUsers: UserRow[];
  allNonAdminUsers: UserRow[];
  syncLogs: string[];
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreateUser: (clientId: string, email: string, password: string, role: UserRole) => Promise<{ error?: string }>;
  onAddUser: (clientId: string, userId: string) => Promise<void>;
  onRemoveUser: (clientId: string, userId: string) => Promise<void>;
  onDeleteAccount: (id: string) => void;
  onActivateAccount: (id: string, clientId: string) => Promise<void>;
  onSync: (clientId: string) => Promise<void>;
  onAccountAdded: () => void;
  onDeleteIgAccount: (id: string) => void;
  onIgAccountAdded: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(client.name);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const assignedUserIds = assignedUsers.map(u => u.id);

  async function handleRename() {
    if (nameVal.trim() && nameVal !== client.name) {
      setBusy(true);
      await onRename(client.id, nameVal.trim());
      setBusy(false);
    }
    setEditing(false);
  }

  async function handleSync() {
    setSyncing(true);
    await onSync(client.id);
    setSyncing(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setNameVal(client.name); setEditing(false); } }}
                className="h-7 rounded border border-input bg-background px-2 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button onClick={handleRename} disabled={busy} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
              <button onClick={() => { setNameVal(client.name); setEditing(false); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <span className="font-semibold text-sm">{client.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {assignedUsers.length} usuário{assignedUsers.length !== 1 ? 's' : ''} · {accounts.length} conta{accounts.length !== 1 ? 's' : ''}
          </span>
          <Button variant="ghost" size="icon" onClick={handleSync} disabled={syncing || accounts.length === 0} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Sincronizar">
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon"
            onClick={async () => { if (!confirm(`Remover cliente "${client.name}"?`)) return; setBusy(true); await onDelete(client.id); }}
            disabled={busy} className="h-7 w-7 text-muted-foreground hover:text-destructive">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {/* Sync logs */}
          {syncLogs.length > 0 && (
            <div className="flex flex-col gap-0.5 p-2 rounded bg-muted/50">
              {syncLogs.map((log, i) => (
                <p key={i} className="text-xs font-mono text-muted-foreground">{log}</p>
              ))}
            </div>
          )}

          {/* Users */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Users className="w-3 h-3" />Usuários
            </p>
            {assignedUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum usuário atribuído.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assignedUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs">
                    <span className="font-medium">{u.email}</span>
                    <span className="text-muted-foreground">· {ROLE_LABELS[u.role]}</span>
                    <button onClick={() => onRemoveUser(client.id, u.id)} className="text-muted-foreground hover:text-destructive ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <AddUserToClient
              clientId={client.id}
              assignedUserIds={assignedUserIds}
              allNonAdminUsers={allNonAdminUsers}
              onCreateUser={onCreateUser}
              onLinked={onAddUser}
            />
          </div>

          {/* Accounts */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Building2 className="w-3 h-3" />Contas Meta
            </p>
            {accounts.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma conta configurada.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {accounts.map(account => (
                  <AccountItem
                    key={account.id}
                    account={account}
                    onDelete={onDeleteAccount}
                    onActivate={onActivateAccount}
                  />
                ))}
              </div>
            )}
            <AddAccountInline clientId={client.id} onAdded={onAccountAdded} />
          </div>

          {/* Instagram Accounts */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              Contas Instagram
            </p>
            {igAccounts.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma conta configurada.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {igAccounts.map(account => (
                  <IgAccountItem key={account.id} account={account} onDelete={onDeleteIgAccount} />
                ))}
              </div>
            )}
            <AddIgAccountInline clientId={client.id} onAdded={onIgAccountAdded} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin Page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [igAccounts, setIgAccounts] = useState<IgAccountRow[]>([]);
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [syncLogs, setSyncLogs] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const [clientsRes, rolesRes, accountsRes, igAccountsRes, cuRes] = await Promise.all([
      supabase.from('clients').select('*').order('created_at'),
      supabase.from('user_roles').select('user_id, email, role').order('created_at'),
      supabase.from('meta_accounts').select('*').order('created_at'),
      supabase.from('ig_accounts').select('*').order('created_at'),
      supabase.from('client_users').select('client_id, user_id'),
    ]);
    if (rolesRes.error) {
      setLoadError(`Erro ao carregar usuários: ${rolesRes.error.message}`);
    }
    const mappedUsers: UserRow[] = (rolesRes.data ?? []).map(r => ({
      id: r.user_id,
      email: r.email ?? r.user_id,
      role: r.role as UserRole,
    }));
    setClients((clientsRes.data as ClientRow[]) ?? []);
    setAllUsers(mappedUsers);
    setAccounts((accountsRes.data as AccountRow[]) ?? []);
    setIgAccounts((igAccountsRes.data as IgAccountRow[]) ?? []);
    setClientUsers((cuRes.data as ClientUser[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreateClient() {
    if (!newClientName.trim()) return;
    setCreating(true);
    await supabase.from('clients').insert({ name: newClientName.trim() });
    setNewClientName('');
    setCreating(false);
    await load();
  }

  async function handleRenameClient(id: string, name: string) {
    await supabase.from('clients').update({ name }).eq('id', id);
    setClients(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  }

  async function handleDeleteClient(id: string) {
    await supabase.from('clients').delete().eq('id', id);
    await load();
  }

  async function handleCreateUserForClient(
    clientId: string,
    email: string,
    password: string,
    role: UserRole
  ): Promise<{ error?: string }> {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (!accessToken) return { error: 'Sessão expirada. Faça login novamente.' };
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, client_id: clientId }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch {
        return { error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
      }
      if (!res.ok || data.error) {
        return { error: `[${res.status}] ${data.error || data.message || 'Erro desconhecido'}` };
      }
      await load();
      return {};
    } catch (e: any) {
      return { error: `Erro de rede: ${e.message}` };
    }
  }

  async function handleAddUser(clientId: string, userId: string) {
    await supabase.from('client_users').insert({ client_id: clientId, user_id: userId });
    setClientUsers(prev => [...prev, { client_id: clientId, user_id: userId }]);
  }

  async function handleRemoveUser(clientId: string, userId: string) {
    await supabase.from('client_users').delete().eq('client_id', clientId).eq('user_id', userId);
    setClientUsers(prev => prev.filter(cu => !(cu.client_id === clientId && cu.user_id === userId)));
  }

  function handleDeleteAccount(id: string) {
    supabase.from('meta_accounts').delete().eq('id', id).then(() => {
      setAccounts(prev => prev.filter(a => a.id !== id));
    });
  }

  function handleDeleteIgAccount(id: string) {
    supabase.from('ig_accounts').delete().eq('id', id).then(() => {
      setIgAccounts(prev => prev.filter(a => a.id !== id));
    });
  }

  async function handleActivateAccount(id: string, clientId: string) {
    await supabase.from('meta_accounts').update({ is_active: false }).eq('client_id', clientId);
    await supabase.from('meta_accounts').update({ is_active: true }).eq('id', id);
    setAccounts(prev => prev.map(a => a.client_id === clientId ? { ...a, is_active: a.id === id } : a));
  }

  async function handleSync(clientId: string) {
    const clientAccounts = accounts.filter(a => a.client_id === clientId);
    const logs: string[] = [];
    for (const account of clientAccounts) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-sync-creative-intelligence`, {
          method: 'POST',
          headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: account.ad_account_id, date_preset: 'last_30d', time_increment: 1 }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const d = data.debug ?? {};
        const debugStr = `[ids:${d.creative_ids_found ?? '?'} specs:${d.specs_fetched ?? '?'} urls:${d.urls_extracted ?? '?'}]`;
        const errStr = d.spec_errors?.length ? ` errs:${JSON.stringify(d.spec_errors[0])}` : '';
        const sampleStr = d.sample_spec ? ` sample:${JSON.stringify(d.sample_spec)}` : '';
        logs.push(`✓ ${account.name}: ${data.synced_insights_rows ?? 0} linhas · ${data.unique_ads ?? 0} ads · ${debugStr}${errStr}${sampleStr}`);
      } catch (e: any) {
        logs.push(`✗ ${account.name}: ${e.message}`);
      }
    }
    setSyncLogs(prev => ({ ...prev, [clientId]: logs }));
  }

  async function handleDeleteUser(userId: string, email: string) {
    if (!confirm(`Remover ${email}?`)) return;
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-delete-user`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    const data = await res.json();
    if (!data.error) await load();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  const nonAdminUsers = allUsers.filter(u => u.role !== 'super_admin');

  return (
    <div className="min-h-screen bg-background p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-muted-foreground mt-1">Gerencie clientes, usuários e contas de anúncios</p>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-800/40 bg-red-950/50 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Erro ao carregar dados</p>
            <p className="font-mono text-xs mt-0.5 break-all">{loadError}</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="h-7 text-xs shrink-0 border-red-300 text-red-800 hover:bg-red-100">
            Recarregar
          </Button>
        </div>
      )}

      {/* Clients section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Clientes <span className="font-normal text-muted-foreground/60">({clients.length})</span>
          </h2>
          <div className="flex gap-2">
            <input
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateClient(); }}
              placeholder="Nome do cliente..."
              className="h-8 w-52 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" onClick={handleCreateClient} disabled={creating || !newClientName.trim()} className="h-8">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5 mr-1" />Criar</>}
            </Button>
          </div>
        </div>

        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {clients.map(client => {
              const assignedIds = clientUsers.filter(cu => cu.client_id === client.id).map(cu => cu.user_id);
              const assignedUsers = allUsers.filter(u => assignedIds.includes(u.id));
              const clientAccounts = accounts.filter(a => a.client_id === client.id);
              const clientIgAccounts = igAccounts.filter(a => a.client_id === client.id);
              return (
                <ClientCard
                  key={client.id}
                  client={client}
                  accounts={clientAccounts}
                  igAccounts={clientIgAccounts}
                  assignedUsers={assignedUsers}
                  allNonAdminUsers={nonAdminUsers}
                  syncLogs={syncLogs[client.id] ?? []}
                  onRename={handleRenameClient}
                  onDelete={handleDeleteClient}
                  onCreateUser={handleCreateUserForClient}
                  onAddUser={handleAddUser}
                  onRemoveUser={handleRemoveUser}
                  onDeleteAccount={handleDeleteAccount}
                  onActivateAccount={handleActivateAccount}
                  onSync={handleSync}
                  onAccountAdded={load}
                  onDeleteIgAccount={handleDeleteIgAccount}
                  onIgAccountAdded={load}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Users section — read-only reference */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Todos os usuários <span className="font-normal text-muted-foreground/60">({nonAdminUsers.length})</span>
        </h2>

        {nonAdminUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado. Crie um dentro de um cliente.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Clientes</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {nonAdminUsers.map(u => {
                  const userClientIds = clientUsers.filter(cu => cu.user_id === u.id).map(cu => cu.client_id);
                  const userClients = clients.filter(c => userClientIds.includes(c.id));
                  return (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2.5 font-medium">{u.email}</td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">{ROLE_LABELS[u.role]}</td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">
                        {userClients.length === 0 ? '—' : userClients.map(c => c.name).join(', ')}
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => handleDeleteUser(u.id, u.email)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
