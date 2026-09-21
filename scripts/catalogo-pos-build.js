import { deveSincronizar, sincronizarNovosProdutos } from './sincronizar-novos-produtos.js';

if (deveSincronizar(process.env)) {
  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Configure a URL do Supabase e SUPABASE_SERVICE_ROLE_KEY no ambiente Production.');
    const { createClient } = await import('@supabase/supabase-js');
    const { produtos } = await import('../src/data/produtos.js');
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const inseridos = await sincronizarNovosProdutos(db, produtos);
    console.log(`[Catálogo] ${inseridos} novos produtos cadastrados. Registros existentes preservados.`);
  } catch (error) {
    console.error('[Catálogo] Deploy interrompido:', error.message);
    process.exitCode = 1;
  }
} else {
  console.log('[Catálogo] Cadastro automático executado apenas nos builds de produção da Vercel.');
}
