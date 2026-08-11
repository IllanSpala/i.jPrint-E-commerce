import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCarrinho } from '../context/CarrinhoContext';
import { supabase } from '../lib/supabase';
import { CheckCircle, Clock, XCircle, ShoppingBag } from 'lucide-react';

export default function PaginaSucesso() {
  const [searchParams] = useSearchParams();
  const { dispatch } = useCarrinho();
  const navigate = useNavigate();

  const [status, setStatus] = useState('verificando'); // verificando | pago | pendente | erro
  const pedidoId = searchParams.get('pedido_id');

  useEffect(() => {
    if (!pedidoId) {
      setStatus('erro');
      return;
    }
    verificarPagamento();
  }, [pedidoId]);

  async function verificarPagamento() {
    setStatus('verificando');

    // Tenta até 6x (30s total) para dar tempo do webhook chegar
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('status')
        .eq('id', pedidoId)
        .single();

      if (pedido?.status === 'Pago' || pedido?.status === 'Em Produção' || pedido?.status === 'Enviado' || pedido?.status === 'Concluído') {
        // Pagamento confirmado! Agora sim, limpa o carrinho
        dispatch({ type: 'LIMPAR' });
        localStorage.removeItem('pedido_pendente_id');
        setStatus('pago');
        return;
      }

      // Aguarda 5s antes de tentar novamente
      await new Promise(r => setTimeout(r, 5000));
    }

    // Após 30s sem confirmação, mostra como pendente
    setStatus('pendente');
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6 bg-zinc-900 border border-zinc-800 p-10 rounded-2xl shadow-2xl">

        {status === 'verificando' && (
          <>
            <div className="w-14 h-14 border-2 border-sand-400/30 border-t-sand-400 rounded-full animate-spin mx-auto" />
            <h1 className="text-xl font-bold text-zinc-100">Verificando pagamento...</h1>
            <p className="text-zinc-400 text-sm">Aguarde enquanto confirmamos a sua compra com a InfinitePay.</p>
          </>
        )}

        {status === 'pago' && (
          <>
            <CheckCircle size={56} className="text-green-400 mx-auto" />
            <h1 className="text-2xl font-bold text-white">Pagamento Confirmado!</h1>
            <p className="text-zinc-400 text-sm">Seu pedido foi recebido e já está sendo preparado. Você receberá atualizações em breve!</p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-sand-400 hover:bg-sand-300 text-zinc-950 font-bold py-3 rounded transition-colors uppercase tracking-widest text-sm"
            >
              Continuar comprando
            </button>
          </>
        )}

        {status === 'pendente' && (
          <>
            <Clock size={56} className="text-yellow-400 mx-auto" />
            <h1 className="text-xl font-bold text-zinc-100">Pagamento Pendente</h1>
            <p className="text-zinc-400 text-sm">
              Não conseguimos confirmar o pagamento ainda. Se você pagou, fique tranquilo — assim que a InfinitePay confirmar, seu pedido será atualizado automaticamente.
            </p>
            <p className="text-zinc-500 text-xs">Pedido: <span className="font-mono text-zinc-300">{String(pedidoId).slice(0,8).toUpperCase()}</span></p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate('/')}
                className="w-full border border-zinc-700 hover:border-zinc-600 text-zinc-300 font-bold py-3 rounded transition-colors text-sm flex items-center justify-center gap-2"
              >
                <ShoppingBag size={16} /> Voltar à loja
              </button>
            </div>
          </>
        )}

        {status === 'erro' && (
          <>
            <XCircle size={56} className="text-red-400 mx-auto" />
            <h1 className="text-xl font-bold text-zinc-100">Pedido não encontrado</h1>
            <p className="text-zinc-400 text-sm">Não foi possível identificar o pedido. Verifique seu histórico no perfil.</p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-sand-400 hover:bg-sand-300 text-zinc-950 font-bold py-3 rounded transition-colors uppercase tracking-widest text-sm"
            >
              Voltar ao início
            </button>
          </>
        )}
      </div>
    </main>
  );
}
