// Inserção atômica: conflitos de ID são ignorados também em deploys concorrentes.
export async function sincronizarNovosProdutos(db, produtos) {
  const registros = produtos.map(p => ({
    id: p.id,
    nome: p.nome,
    preco: p.preco,
    preco_promocional: p.precoPromocional ?? null,
    imagem: p.imagem,
    imagens: p.imagens || [p.imagem],
    opcoes: p.opcoes || null,
    categoria: p.categoria,
    exige_personalizacao: p.exigePersonalizacao || false,
    descricao: p.descricao,
    peso_gramas: p.peso_gramas ?? 300,
    dimensoes: p.dimensoes || '15x10x20',
  }));
  if (!registros.length) return 0;
  const { data, error } = await db.from('produtos')
    .upsert(registros, { onConflict: 'id', ignoreDuplicates: true })
    .select('id')
    .abortSignal(AbortSignal.timeout(30_000));
  if (error) throw new Error(`Falha ao cadastrar novos produtos (${error.code || 'erro de conexão/schema'}).`);
  return data.length;
}

export function deveSincronizar(env) {
  return env.VERCEL === '1' && env.VERCEL_ENV === 'production';
}
