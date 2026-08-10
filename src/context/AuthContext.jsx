import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Garante que todo usuário logado tenha um registro na tabela 'perfis'
      if (session?.user) {
        const u = session.user;
        // Usa upsert para criar o perfil se não existir, sem sobrescrever dados existentes
        await supabase.from('perfis').upsert(
          {
            id: u.id,
            // Nome padrão: parte do email antes do @, ou o full_name do provedor social
            nome: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Cliente',
          },
          { onConflict: 'id', ignoreDuplicates: true } // Não sobrescreve se já existir
        );
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
