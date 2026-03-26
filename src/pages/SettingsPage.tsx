import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, KeyRound,
  Plus, Trash2, Star, Pencil, Check, X, Building2, RefreshCw,
} from 'lucide-react';
import { useAccountContext, type MetaAccount } from '@/contexts/AccountContext';
import { useAuth } from '@/contexts/AuthContext';
import UserManagement from '@/components/UserManagement';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ─── Token Section ────────────────────────────────────────────────────────────

function TokenSection() {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'meta_access_token').single()
      .then(({ data }) => { if (data?.value) setToken(data.value); });
  }, []);

  async function handleSave() {
    setSaving(true);
    setStatus('idle');
    try {
      await supabase.from('app_settings').upsert(
        { key: 'meta_access_token', value: token },
        { onConflict: 'key' }
      );
      setStatus('success');
      setMessage('Token salvo com sucesso.');
    } catch (e: any) {
      setStatus('error');
      setMessage('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="w-4 h-4" />
          Access Token Meta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Token único usado para todas as contas. Configure uma vez.
        </p>
        <div className="space-y-1">
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => { setToken(e.target.value); setStatus('idle'); }}
              placeholder="EAAxxxxxxxxxxxxxxx..."
              className="w-full h-10 rounded-md border border-input bg-background px-3 pr-10 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button type="button" onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {message && (
          <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
            status === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {status === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {message}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving || !token.trim()}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando...</> : 'Salvar Token'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Sync Section ─────────────────────────────────────────────────────────────

function SyncSection() {
  const { accounts } = useAccountContext();
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<{ name: string; ok: boolean; msg: string }[]>([]);

  async function handleSync() {
    setSyncing(true);
    setResults([]);
    const logs: { name: string; ok: boolean; msg: string }[] = [];

    for (const account of accounts) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-sync-creative-intelligence`, {
          method: 'POST',
          headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: account.ad_account_id, date_preset: 'last_30d', time_increment: 1 }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        logs.push({ name: account.name, ok: true, msg: `${data.synced_insights_rows ?? 0} linhas · ${data.unique_ads ?? 0} ads` });
      } catch (e: any) {
        logs.push({ name: account.name, ok: false, msg: e.message });
      }
    }

    setResults(logs);
    setSyncing(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCw className="w-4 h-4" />
          Sincronizar dados Meta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sincroniza insights e criativos dos últimos 30 dias para todas as contas configuradas.
        </p>
        <Button onClick={handleSync} disabled={syncing || accounts.length === 0}>
          {syncing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sincronizando...</> : 'Sincronizar todas as contas'}
        </Button>
        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg border text-sm ${r.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {r.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                <div>
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-2 opacity-75">{r.msg}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Add Account Form ─────────────────────────────────────────────────────────

function AddAccountForm({ onAdded }: { onAdded: () => void }) {
  const { addAccount } = useAccountContext();
  const [accountId, setAccountId] = useState('');
  const [name, setName] = useState('');
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleTest() {
    setTesting(true);
    setStatus('idle');
    setMessage('');
    setTested(false);
    try {
      // Read token from app_settings
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'meta_access_token').single();
      const accessToken = data?.value;
      if (!accessToken) throw new Error('Configure o Access Token antes de testar.');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-test-connection`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, adAccountId: accountId }),
      });
      const result = await res.json();
      if (result.success) {
        setStatus('success');
        setTested(true);
        if (!name && result.accountName) setName(result.accountName);
        setMessage(`Conectado! ${result.accountName || accountId}`);
      } else {
        setStatus('error');
        setMessage(result.error || 'Falha na conexão.');
      }
    } catch (e: any) {
      setStatus('error');
      setMessage(e.message);
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await addAccount(name.trim() || accountId, accountId);
      setAccountId('');
      setName('');
      setStatus('idle');
      setMessage('');
      setTested(false);
      onAdded();
    } catch (e: any) {
      setStatus('error');
      setMessage('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  const canTest = accountId.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="w-4 h-4" />
          Adicionar conta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Ad Account ID</label>
          <input
            type="text"
            value={accountId}
            onChange={e => { setAccountId(e.target.value); setStatus('idle'); setTested(false); }}
            placeholder="act_xxxxxxxxxxxxxxxxx"
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">Formato: act_123456789</p>
        </div>

        {tested && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Nome da conta</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Marca X - Vendas"
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {message && (
          <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
            status === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {status === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {message}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing || !canTest} className="flex-1">
            {testing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Testando...</> : 'Testar Conexão'}
          </Button>
          {tested && (
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando...</> : 'Salvar Conta'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Account Row ──────────────────────────────────────────────────────────────

function AccountRow({ account, onActivate, onDelete, onRename }: {
  account: MetaAccount;
  onActivate: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(account.name);
  const [activating, setActivating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleActivate() {
    setActivating(true);
    await onActivate();
    setActivating(false);
  }

  function handleRename() {
    if (nameVal.trim() && nameVal !== account.name) onRename(nameVal.trim());
    setEditing(false);
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
      account.is_active ? 'border-primary/40 bg-primary/5' : 'border-border bg-background'
    }`}>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input autoFocus value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 h-7 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            <button onClick={handleRename} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
            <button onClick={() => { setNameVal(account.name); setEditing(false); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{account.name}</span>
            {account.is_active && <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-wide">Ativa</span>}
          </div>
        )}
        <p className="text-xs text-muted-foreground font-mono mt-0.5">{account.ad_account_id}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!account.is_active && (
          <Button variant="outline" size="sm" onClick={handleActivate} disabled={activating} className="h-7 text-xs">
            {activating ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Star className="w-3 h-3 mr-1" />Ativar</>}
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => setEditing(true)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
          <Pencil className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="icon" onClick={async () => { setDeleting(true); await onDelete(); }} disabled={deleting} className="h-7 w-7 text-muted-foreground hover:text-destructive">
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { accounts, loading, switchAccount, deleteAccount, updateAccountName, reload } = useAccountContext();
  const { role } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie suas integrações</p>
      </div>

      <TokenSection />

      <SyncSection />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-4 h-4" />
            Contas Meta Ads
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />Carregando...
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta adicionada ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {accounts.map(account => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onActivate={() => switchAccount(account.id)}
                  onDelete={() => deleteAccount(account.id)}
                  onRename={name => updateAccountName(account.id, name)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddAccountForm onAdded={reload} />

      {role === 'gestor' && <UserManagement />}
    </div>
  );
}
