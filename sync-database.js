import WebSocket from 'ws';
global.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import { produtos } from './src/data/produtos.js';
import fs from 'fs';
import path from 'path';

// Carregar .env.local se existir localmente
if (fs.existsSync('.env.local')) {
  const envConfig = fs.readFileSync('.env.local', 'utf8');
  envConfig.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const val = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  });
}

// Carregar .env.prod se existir localmente
if (fs.existsSync('.env.prod')) {
  const envConfig = fs.readFileSync('.env.prod', 'utf8');
  envConfig.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const val = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()] && val && val !== '[SENSITIVE]') {
        process.env[key.trim()] = val;
      }
    }
  });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('⚠️ [sync-database] Variáveis do Supabase não encontradas. Pulando sincronização automática.');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function sync() {
  console.log(`\n🚀 [sync-database] Sincronizando ${produtos.length} produtos do produtos.js com o Supabase...`);
  let count = 0;
  let errors = 0;

  // Busca os produtos atuais para não sobrescrever pesos e dimensões
  const { data: dbProdutos, error: fetchError } = await supabase.from('produtos').select('id, peso_gramas, dimensoes');
  const produtosNoBanco = dbProdutos || [];

  for (const p of produtos) {
    const dbP = produtosNoBanco.find(banco => banco.id === p.id);
    
    const { error } = await supabase.from('produtos').upsert({
      id: p.id,
      nome: p.nome,
      preco: p.preco,
      preco_promocional: p.precoPromocional || null,
      imagem: p.imagem,
      imagens: p.imagens || [p.imagem],
      opcoes: p.opcoes || null,
      categoria: p.categoria,
      exige_personalizacao: p.exigePersonalizacao || false,
      descricao: p.descricao,
      // Se já existe no banco, mantém o peso de lá; senão, usa 300g
      peso_gramas: dbP ? dbP.peso_gramas : 300,
      dimensoes: dbP ? dbP.dimensoes : '150x100x200'
    });

    if (error) {
      if (error.code === '42501') {
        // RLS policy violation on local dev with anon key - log warning but don't fail build
        console.warn(`⚠️ [sync-database] Sem chave de serviço (RLS). Não foi possível atualizar ID ${p.id} via Anon key local.`);
      } else {
        console.error(`❌ [sync-database] Erro no ID ${p.id} (${p.nome}):`, error.message);
      }
      errors++;
    } else {
      count++;
    }
  }

  console.log(`✅ [sync-database] Concluído: ${count} produtos atualizados/inseridos com sucesso no Supabase.\n`);
}

sync().catch(err => {
  console.error('❌ Erro na sincronização:', err);
  // Do not fail build if sync fails locally, just continue build
  process.exit(0);
});
