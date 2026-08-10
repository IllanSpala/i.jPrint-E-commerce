import { createClient } from '@supabase/supabase-js'
import { produtos } from './src/data/produtos.js'
import WebSocket from 'ws'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gsxmxtbbbamfhtpmysqe.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0RZ-Cs0G750wDabyQkZovA_NmPiymKe'

global.WebSocket = WebSocket

const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  console.log(`Iniciando migração de ${produtos.length} produtos...`)
  
  for (const p of produtos) {
    const { error } = await supabase
      .from('produtos')
      .insert({
        id: p.id,
        nome: p.nome,
        preco: p.preco,
        preco_promocional: p.precoPromocional || null,
        imagem: p.imagem,
        categoria: p.categoria,
        exige_personalizacao: p.exigePersonalizacao,
        descricao: p.descricao,
        peso_gramas: 300
      })
    
    if (error) {
      console.error(`❌ Erro ao inserir [${p.nome}]:`, error.message)
    } else {
      console.log(`✅ Inserido: ${p.nome}`)
    }
  }
  
  console.log('🎉 Migração concluída com sucesso!')
}

seed()
