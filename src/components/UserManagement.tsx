import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Loader2, Trash2, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import type { UserRole } from '@/contexts/AuthContext';

const ROLE_LABELS: Record<UserRole, string> = {
  gestor: 'Gestor',
  gestor_trafego: 'Gestor de Tráfego',
  marketing: 'Time Marketing',
};

interface UserWithRole {
  id: string;
  email: string;
  role: UserRole;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('gestor_trafego');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_all_users_with_roles');
    if (!error && data) setUsers(data as UserWithRole[]);
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleCreate() {
    setCreating(true);
    setMessage('');
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      // Create user via Edge Function (needs service role)
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setMsgType('success');
      setMessage(`Usuário ${newEmail} criado com sucesso.`);
      setNewEmail('');
      setNewPassword('');
      await loadUsers();
    } catch (e: any) {
      setMsgType('error');
      setMessage(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(userId: string, email: string) {
    if (!confirm(`Remover ${email}?`)) return;
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-delete-user`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      await loadUsers();
    } catch (e: any) {
      setMsgType('error');
      setMessage(e.message);
    }
  }

  const canCreate = newEmail.trim() && newPassword.length >= 6;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="w-4 h-4" />
          Usuários
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User list */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />Carregando...
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[u.role]}</p>
                </div>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => handleDelete(u.id, u.email)}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium">Novo usuário</p>
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Senha (mín. 6 caracteres)"
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value as UserRole)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="gestor">Gestor</option>
            <option value="gestor_trafego">Gestor de Tráfego</option>
            <option value="marketing">Time Marketing</option>
          </select>

          {message && (
            <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
              msgType === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {msgType === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {message}
            </div>
          )}

          <Button onClick={handleCreate} disabled={creating || !canCreate} className="w-full">
            {creating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Criando...</> : <><Plus className="w-4 h-4 mr-2" />Criar usuário</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
