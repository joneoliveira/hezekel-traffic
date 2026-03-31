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
};

interface ClientRow { id: string; name: string; created_at: string; }
interface UserRow { id: string; email: string; role: UserRole; }
interface AccountRow { id: string; name: string; ad_account_id: string; access_token: string; is_active: boolean; client_id: string; }
interface ClientUser { client_id: string; user_id: string; }

// ── Token Field ────────────────────────────────────────────────────────────────

function TokenField({ accountId, initialToken }: { accountId: string; initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [savedToken, setSavedToken] = useState(initialToken);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = token !== savedToken;

  async function handleSave() {
    setSaving(true);
    await supabase.from('meta_accounts').update({ access_token: token }).eq('id', accountId);
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
        <div className={`flex items-center gap-1.5 text-xs p-2 rounded border ${msgOk ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
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

// ── Client Card ────────────────────────────────────────────────────────────────

function ClientCard({
  client, accounts, assignedUsers, availableUsers, syncLogs,
  onRename, onDelete, onAddUser, onRemoveUser,
  onDeleteAccount, onActivateAccount, onSync, onAccountAdded,
}: {
  client: ClientRow;
  accounts: AccountRow[];
  assignedUsers: UserRow[];
  availableUsers: UserRow[];
  syncLogs: string[];
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddUser: (clientId: string, userId: string) => Promise<void>;
  onRemoveUser: (clientId: string, userId: string) => Promise<void>;
  onDeleteAccount: (id: string) => void;
  onActivateAccount: (id: string, clientId: string) => Promise<void>;
  onSync: (clientId: string) => Promise<void>;
  onAccountAdded: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(client.name);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
            {availableUsers.length > 0 && (
              <div className="mt-2">
                {showUserPicker ? (
                  <div className="flex flex-wrap gap-1">
                    {availableUsers.map(u => (
                      <button key={u.id}
                        onClick={async () => { await onAddUser(client.id, u.id); setShowUserPicker(false); }}
                        className="flex items-center gap-1 bg-background border border-border rounded px-2 py-1 text-xs hover:bg-muted transition-colors">
                        <UserPlus className="w-3 h-3" />{u.email}
                      </button>
                    ))}
                    <button onClick={() => setShowUserPicker(false)} className="text-xs text-muted-foreground px-2 py-1 hover:text-foreground">Cancelar</button>
                  </div>
                ) : (
                  <button onClick={() => setShowUserPicker(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <UserPlus className="w-3 h-3" />Adicionar usuário
                  </button>
                )}
              </div>
            )}
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
        </div>
      )}
    </div>
  );
}

// ── Create User Form ───────────────────────────────────────────────────────────

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('gestor_trafego');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(true);

  async function handleCreate() {
    setCreating(true);
    setMsg('');
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMsgOk(true);
      setMsg(`Usuário ${email} criado com sucesso.`);
      setEmail(''); setPassword('');
      onCreated();
    } catch (e: any) {
      setMsgOk(false);
      setMsg(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="email@exemplo.com"
        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)}
        placeholder="Senha (mín. 6 caracteres)"
        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      <select value={role} onChange={e => setRole(e.target.value as UserRole)}
        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
        <option value="gestor">Gestor</option>
        <option value="gestor_trafego">Gestor de Tráfego</option>
        <option value="marketing">Time Marketing</option>
      </select>
      {msg && (
        <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${msgOk ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {msgOk ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          {msg}
        </div>
      )}
      <Button onClick={handleCreate} disabled={creating || !email || password.length < 6} size="sm" className="w-full">
        {creating ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Criando...</> : <><Plus className="w-3.5 h-3.5 mr-1.5" />Criar usuário</>}
      </Button>
    </div>
  );
}

// ── Admin Page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [syncLogs, setSyncLogs] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [newClientName, setNewClientName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [clientsRes, usersRes, accountsRes, cuRes] = await Promise.all([
      supabase.from('clients').select('*').order('created_at'),
      supabase.rpc('get_all_users_with_roles'),
      supabase.from('meta_accounts').select('*').order('created_at'),
      supabase.from('client_users').select('client_id, user_id'),
    ]);
    setClients((clientsRes.data as ClientRow[]) ?? []);
    setAllUsers((usersRes.data as UserRow[]) ?? []);
    setAccounts((accountsRes.data as AccountRow[]) ?? []);
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
              const availableUsers = nonAdminUsers.filter(u => !assignedIds.includes(u.id));
              const clientAccounts = accounts.filter(a => a.client_id === client.id);
              return (
                <ClientCard
                  key={client.id}
                  client={client}
                  accounts={clientAccounts}
                  assignedUsers={assignedUsers}
                  availableUsers={availableUsers}
                  syncLogs={syncLogs[client.id] ?? []}
                  onRename={handleRenameClient}
                  onDelete={handleDeleteClient}
                  onAddUser={handleAddUser}
                  onRemoveUser={handleRemoveUser}
                  onDeleteAccount={handleDeleteAccount}
                  onActivateAccount={handleActivateAccount}
                  onSync={handleSync}
                  onAccountAdded={load}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Users section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Usuários <span className="font-normal text-muted-foreground/60">({nonAdminUsers.length})</span>
        </h2>

        {nonAdminUsers.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Cliente</th>
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

        <div className="rounded-lg border border-border p-4 max-w-sm">
          <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" />Novo usuário
          </p>
          <CreateUserForm onCreated={load} />
        </div>
      </div>
    </div>
  );
}
