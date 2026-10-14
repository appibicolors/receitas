import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase, configured } from './lib/client';
import type { Profile } from './lib/domain';
type Auth = {
  profile: Profile | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};
const context = createContext<Auth>(null!);
export const useAuth = () => useContext(context);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const revision = useRef(0);
  async function refresh() {
    const ticket = ++revision.current;
    if (!configured) {
      setLoading(false);
      return;
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (ticket !== revision.current) return;
    if (!user || authError) {
      setProfile(null);
      setError('');
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('rama_usuarios')
      .select('id,nome,email,perfil,ativo')
      .eq('id', user.id)
      .eq('ativo', true)
      .maybeSingle();
    if (ticket !== revision.current) return;
    setProfile(data as Profile | null);
    setError(
      error
        ? 'Não foi possível verificar seu acesso.'
        : data
          ? ''
          : 'Sua conta não tem acesso ativo ao módulo RAMA.',
    );
    setLoading(false);
  }
  useEffect(() => {
    void refresh();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => void refresh(), 0);
    });
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, []);
  return (
    <context.Provider value={{ profile, loading, error, refresh }}>{children}</context.Provider>
  );
}
