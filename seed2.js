import { createClient } from '@supabase/supabase-js'
import { produtos } from './src/data/produtos.js'
import WebSocket from 'ws'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gsxmxtbbbamfhtpmysqe.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0RZ-Cs0G750wDabyQkZovA_NmPiymKe'

global.WebSocket = WebSocket

const supabase = createClient(supabaseUrl, supabaseKey)

async function seed2() {
  console.log(`Atualizando dados avançados de ${produtos.length} produtos...`)
  
  for (const p of produtos) {
    const { error } = await supabase
      .from('produtos')
      .update({
        imagens: p.imagens || [p.imagem],
        opcoes: p.opcoes || null
      })
      .eq('id', p.id)
    
    if (error) {
      console.error(`❌ Erro ao atualizar [${p.nome}]:`, error.message)
    } else {
      console.log(`✅ Atualizado com opções/imagens: ${p.nome}`)
    }
  }
  
  console.log('🎉 Migração avançada concluída!')
}

seed2()
