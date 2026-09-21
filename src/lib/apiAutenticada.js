import { supabase } from './supabase';
export async function apiAutenticada(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Faça login novamente.');
  return fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${session.access_token}` } });
}
