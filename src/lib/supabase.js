import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function criarConsultaLocal() {
  const resposta = { data: null, error: null };
  const consulta = {
    select: () => consulta,
    insert: () => consulta,
    update: () => consulta,
    upsert: () => consulta,
    delete: () => consulta,
    eq: () => consulta,
    neq: () => consulta,
    in: () => consulta,
    order: () => consulta,
    limit: () => consulta,
    single: () => Promise.resolve(resposta),
    maybeSingle: () => Promise.resolve(resposta),
    then: (resolve, reject) => Promise.resolve(resposta).then(resolve, reject),
  };
  return consulta;
}

function criarSupabaseLocal() {
  return {
    from: () => criarConsultaLocal(),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async () => ({ data: null, error: new Error('Configure o Supabase para fazer login.') }),
      signUp: async () => ({ data: null, error: new Error('Configure o Supabase para criar uma conta.') }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ data: null, error: new Error('Configure o Supabase para recuperar a senha.') }),
      updateUser: async () => ({ data: null, error: new Error('Configure o Supabase para atualizar o usuário.') }),
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
  };
}

// O catálogo e o personalizador continuam disponíveis no preview local mesmo
// quando as credenciais de produção não foram fornecidas.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : criarSupabaseLocal()
