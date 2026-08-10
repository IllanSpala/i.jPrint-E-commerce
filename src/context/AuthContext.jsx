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
        // O erro é suprimido silenciosamente pois se o RLS bloquear (ex: conta já tem perfil), não afeta a aplicação
        supabase.from('perfis').upsert(
          {
            id: u.id,
            nome: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Cliente',
          },
          { onConflict: 'id', ignoreDuplicates: true }
        ).then(({ error }) => {
          if (error && error.code !== '42501') { // Ignora erro de RLS (403/42501) 
            console.warn("Aviso ao sincronizar perfil:", error.message);
          }
        });
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
