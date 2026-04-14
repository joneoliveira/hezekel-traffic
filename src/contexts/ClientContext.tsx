import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Client {
  id: string;
  name: string;
  created_at: string;
}

interface ClientContextValue {
  clients: Client[];
  activeClient: Client | null;
  loading: boolean;
  setActiveClientId: (id: string) => void;
  createClient: (name: string) => Promise<Client>;
  renameClient: (id: string, name: string) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

const ClientContext = createContext<ClientContextValue>({
  clients: [], activeClient: null, loading: true,
  setActiveClientId: () => {},
  createClient: async () => { throw new Error('not ready'); },
  renameClient: async () => {},
  deleteClient: async () => {},
  reload: async () => {},
});

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClientId, setActiveClientIdState] = useState<string | null>(
    () => localStorage.getItem('hezekel_active_client_id')
  );
  const [loading, setLoading] = useState(true);

  const setActiveClientId = useCallback((id: string) => {
    localStorage.setItem('hezekel_active_client_id', id);
    setActiveClientIdState(id);
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: true });
    const list = (data as Client[]) ?? [];
    setClients(list);
    setActiveClientIdState(prev => {
      if (prev && list.find(c => c.id === prev)) return prev;
      const fallback = list[0]?.id ?? null;
      if (fallback) localStorage.setItem('hezekel_active_client_id', fallback);
      return fallback;
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeClient = clients.find(c => c.id === activeClientId) ?? null;

  const createClient = useCallback(async (name: string) => {
    const { data, error } = await supabase
      .from('clients')
      .insert({ name })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await load();
    return data as Client;
  }, [load]);

  const renameClient = useCallback(async (id: string, name: string) => {
    await supabase.from('clients').update({ name }).eq('id', id);
    setClients(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    await supabase.from('clients').delete().eq('id', id);
    await load();
  }, [load]);

  return (
    <ClientContext.Provider value={{
      clients, activeClient, loading,
      setActiveClientId: setActiveClientId,
      createClient, renameClient, deleteClient,
      reload: load,
    }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext() {
  return useContext(ClientContext);
}
