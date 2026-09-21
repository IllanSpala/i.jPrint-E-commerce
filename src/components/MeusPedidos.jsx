import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
export default function MeusPedidos({ userId }) {
  const [pedidos, setPedidos] = useState([]);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let ativo = true;
    supabase.from('pedidos').select('id,created_at,status,total,checkout_estado,link_pagamento,tracking_url').eq('user_id', userId).order('created_at', { ascending: false }).limit(50).then(({ data, error }) => {
      if (!ativo) return;
      setPedidos(data || []); setErro(error ? 'Não foi possível carregar seus pedidos.' : '');
    });
    return () => { ativo = false; };
  }, [userId]);
  const linkSeguro = (link, host) => { try { const u = new URL(link); return u.protocol === 'https:' && u.hostname === host; } catch { return false; } };
  return <section className="mt-8 border-t border-zinc-800 pt-6"><h2 className="text-lg font-semibold mb-4">Meus pedidos</h2>
    {erro && <p role="alert">{erro}</p>}
    {!erro && !pedidos.length && <p className="text-zinc-400">Nenhum pedido encontrado.</p>}
    <ul className="space-y-4">{pedidos.map(p => <li key={p.id} className="rounded border border-zinc-800 p-4">
      <p>#{p.id.slice(0,8).toUpperCase()} · {new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
      <p>{p.checkout_estado === 'falhou' ? 'Pagamento não iniciado' : p.status} · {Number(p.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
      {p.status === 'Aguardando Pagamento' && linkSeguro(p.link_pagamento, 'pay.infinitepay.io') && <a className="text-sand-400 underline" href={p.link_pagamento}>Retomar pagamento</a>}
      {p.status === 'Aguardando Pagamento' && !p.link_pagamento && p.checkout_estado !== 'falhou' && <p className="text-zinc-400 text-sm">Em processamento. Se já pagou, aguarde a confirmação ou contate a loja antes de tentar novamente.</p>}
      {linkSeguro(p.tracking_url, 'rastreamento.correios.com.br') && <a className="block text-sand-400 underline" href={p.tracking_url} target="_blank" rel="noopener noreferrer">Rastrear pedido</a>}
    </li>)}</ul>
  </section>;
}
