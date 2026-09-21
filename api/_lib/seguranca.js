import { createClient } from '@supabase/supabase-js';

export function bancoServidor() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Object.assign(new Error('Serviço indisponível: configuração do servidor pendente.'), { status: 503 });
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function exigirAdmin(db, req) {
  const token = /^Bearer (\S+)$/i.exec(req.headers?.authorization || '')?.[1];
  if (!token) throw Object.assign(new Error('Autenticação necessária.'), { status: 401 });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw Object.assign(new Error('Sessão inválida.'), { status: 401 });
  const permissao = await db.from('loja_admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (permissao.error) throw Object.assign(new Error('Não foi possível verificar a permissão.'), { status: 503 });
  if (!permissao.data) throw Object.assign(new Error('Acesso restrito à administração.'), { status: 403 });
  return data.user;
}

export function protegerAdmin(handler, criarBanco = bancoServidor) {
  return async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
    try {
      const db = criarBanco();
      const usuario = await exigirAdmin(db, req);
      await limitarRequisicoes(db, 'admin:' + usuario.id, 30);
      return await handler(req, res, db);
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.status ? error.message : 'Falha ao processar a operação.' });
    }
  };
}

export async function limitarRequisicoes(db, chave, limite = 30) {
  const { data, error } = await db.rpc('limitar_requisicoes_loja', { p_chave: chave, p_limite: limite });
  if (error) throw Object.assign(new Error('Verificação de limite indisponível.'), { status: 503 });
  if (data !== true) throw Object.assign(new Error('Muitas tentativas. Aguarde um minuto.'), { status: 429 });
}

export function cpfValido(valor) {
  const cpf = String(valor || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) return false;
  for (let n = 9; n <= 10; n++) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i);
    const digito = (soma * 10) % 11;
    if ((digito === 10 ? 0 : digito) !== Number(cpf[n])) return false;
  }
  return true;
}
