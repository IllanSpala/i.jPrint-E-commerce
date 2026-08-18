import { X, Trash2, Plus, Minus, ShoppingBag, CreditCard } from "lucide-react";
import { useCarrinho } from "../context/CarrinhoContext";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import ContagemRegressiva from "./ContagemRegressiva";
import ModalAviso from "./ModalAviso";

export default function SidebarCarrinho() {
  const {
    itens,
    dispatch,
    totalItens,
    totalPreco,
    sidebarAberta,
    setSidebarAberta,
  } = useCarrinho();

  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [calculandoFrete, setCalculandoFrete] = useState(false);
  const [opcoesFrete, setOpcoesFrete] = useState([]);
  const [freteSelecionado, setFreteSelecionado] = useState(null);
  const [todosEnderecos, setTodosEnderecos] = useState([]);
  const [enderecoSelecionado, setEnderecoSelecionado] = useState(null);
  const [modoEntrega, setModoEntrega] = useState('envio'); // 'envio' | 'retirada'
  const [modalAvisoAberto, setModalAvisoAberto] = useState(false);
  
  const [expiraEm, setExpiraEm] = useState(null);
  const estaNoCheckout = window.location.href.includes('infinitepay') || 
                         window.location.href.includes('checkout') ||
                         window.location.href.includes('pagamento');

  useEffect(() => {
    const savedExp = localStorage.getItem('@ijprint:checkout_expires_at');
    if (savedExp) {
      if (Date.now() > Number(savedExp) && !estaNoCheckout) {
        localStorage.removeItem('@ijprint:checkout_expires_at');
        dispatch({ type: "LIMPAR" });
      } else {
        setExpiraEm(Number(savedExp) - 15 * 60 * 1000);
      }
    }
  }, [itens]);

  // Busca os endereços assim que o carrinho abre
  useEffect(() => {
    if (sidebarAberta && user) {
      carregarEnderecos();
    }
  }, [sidebarAberta, user]);

  async function carregarEnderecos() {
    const { data: enderecos } = await supabase
      .from('enderecos')
      .select('*')
      .eq('user_id', user.id)
      .order('padrao', { ascending: false });

    if (enderecos && enderecos.length > 0) {
      setTodosEnderecos(enderecos);
      setEnderecoSelecionado(enderecos[0]);
    } else {
      setTodosEnderecos([]);
      setEnderecoSelecionado(null);
    }
  }

  // Calcula frete quando o endereço ou os itens mudam
  useEffect(() => {
    if (sidebarAberta && enderecoSelecionado && itens.length > 0 && modoEntrega === 'envio') {
      const delayId = setTimeout(() => {
        calcularFrete(enderecoSelecionado);
      }, 500);
      return () => clearTimeout(delayId);
    }
  }, [sidebarAberta, enderecoSelecionado, itens, modoEntrega]);

  async function calcularFrete(endereco) {
    setCalculandoFrete(true);
    try {
      let opcoes;
      if (import.meta.env.DEV) {
        await new Promise(r => setTimeout(r, 600));
        opcoes = [
          { id: 1, nome: 'PAC', preco: 25.50, prazo: 7 },
          { id: 2, nome: 'SEDEX', preco: 45.90, prazo: 3 },
        ];
      } else {
        const res = await fetch('/api/frete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cep_destino: endereco.cep, itens }),
        });
        const data = await res.json();
        opcoes = data.opcoes;
      }
      if (opcoes) {
        setOpcoesFrete(opcoes);
        setFreteSelecionado(prev => {
          if (!prev) return opcoes[0];
          return opcoes.find(o => o.id === prev.id) || opcoes[0];
        });
      }
    } catch (e) {
      console.error("Erro ao calcular frete", e);
    }
    setCalculandoFrete(false);
  }

  async function finalizar() {
    if (!user) {
      alert("Por favor, faça login para finalizar a compra.");
      navigate("/login");
      setSidebarAberta(false);
      return;
    }

    // Valida CPF e telefone obrigatórios
    const { data: perfil } = await supabase
      .from('perfis')
      .select('cpf, telefone')
      .eq('id', user.id)
      .single();

    const cpfOk = perfil?.cpf && perfil.cpf.replace(/\D/g, '').length === 11;
    const telefoneOk = perfil?.telefone && perfil.telefone.replace(/\D/g, '').length >= 10;

    if (!cpfOk || !telefoneOk) {
      const campos = [];
      if (!cpfOk) campos.push('CPF');
      if (!telefoneOk) campos.push('Telefone');
      alert(`Para finalizar o pedido, preencha o(s) campo(s) obrigatório(s) no seu Perfil:\n\n• ${campos.join('\n• ')}\n\nVocê será redirecionado para a página de Perfil.`);
      navigate('/perfil');
      setSidebarAberta(false);
      return;
    }

    // Mostra o modal de aviso antes de prosseguir
    setModalAvisoAberto(true);
  }

  async function prosseguirAposAviso() {
    setModalAvisoAberto(false);
    setLoading(true);

    // ── MODO RETIRADA ──────────────────────────────────────────────────
    if (modoEntrega === 'retirada') {
      if (import.meta.env.DEV) {
        setSidebarAberta(false);
        setLoading(false);
        alert(`PEDIDO DE RETIRADA em modo Dev!\n\n(Modo Dev: Chamada de pagamento simulada e pedido seria criado no painel)`);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const siteUrl = window.location.origin;
        const payRes = await fetch('/api/pagamento', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            endereco: { logradouro: 'Quadra da Guararema', numero: 'S/N', bairro: 'Guararema', cidade: 'Alegre', uf: 'ES', cep: '-' },
            frete_valor: 0, 
            itens,
            redirect_base_url: `${siteUrl}/pedido-confirmado`
          }),
        });
        const payData = await payRes.json();
        if (payData.link_pagamento) { 
          // Salva o contador de 15 minutos
          const expTime = Date.now() + 15 * 60 * 1000;
          localStorage.setItem('@ijprint:checkout_expires_at', expTime.toString());
          setExpiraEm(Date.now()); // Data de criação local

          setSidebarAberta(false); 
          setLoading(false); 
          window.location.href = payData.link_pagamento; 
          return; 
        } else {
          throw new Error(payData.error || "Erro desconhecido ao gerar pagamento.");
        }
      } catch (e) {
        console.error("Erro ao gerar link", e);
        alert("Erro ao gerar link de pagamento: " + e.message);
      }
      setSidebarAberta(false);
      setLoading(false);
      return;
    }

    // ── MODO ENVIO ─────────────────────────────────────────────────────
    if (!enderecoSelecionado) {
      alert("Por favor, cadastre um endereço no seu Perfil antes de comprar.");
      setLoading(false);
      navigate("/perfil");
      setSidebarAberta(false);
      return;
    }

    if (import.meta.env.DEV) {
      await new Promise(r => setTimeout(r, 800));
      setSidebarAberta(false);
      setLoading(false);
      alert(`PEDIDO de envio em modo Dev!\n\n(Modo Dev: Chamada de pagamento simulada e pedido seria criado no painel).`);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const siteUrl = window.location.origin;
      const payRes = await fetch('/api/pagamento', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          endereco: enderecoSelecionado,
          frete_valor: freteSelecionado ? freteSelecionado.preco : 0,
          itens,
          redirect_base_url: `${siteUrl}/pedido-confirmado`
        }),
      });
      const payData = await payRes.json();
      if (payData.link_pagamento) {
        // Salva o contador de 15 minutos
        const expTime = Date.now() + 15 * 60 * 1000;
        localStorage.setItem('@ijprint:checkout_expires_at', expTime.toString());
        setExpiraEm(Date.now()); // Data de criação local
        
        setSidebarAberta(false);
        setLoading(false);
        window.location.href = payData.link_pagamento;
        return;
      } else {
        throw new Error(payData.error || "Erro desconhecido ao gerar pagamento.");
      }
    } catch (e) {
      console.error("Erro ao gerar link", e);
      alert("Erro ao gerar link de pagamento: " + e.message);
    }

    setSidebarAberta(false);
    setLoading(false);
  }

  return (
    <>
      {/* Modal de Aviso de Produção */}
      {modalAvisoAberto && (
        <ModalAviso
          onConfirmar={prosseguirAposAviso}
          onCancelar={() => setModalAvisoAberto(false)}
        />
      )}

      {/* Overlay */}
      {sidebarAberta && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/70 backdrop-blur-sm"
          onClick={() => setSidebarAberta(false)}
        />
      )}

      {/* Gaveta */}
      <aside
        className={`fixed top-0 right-0 h-full z-50 w-full max-w-md bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-2xl transition-transform duration-300 ${
          sidebarAberta ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-sand-400" />
            <span className="font-semibold text-zinc-100 text-sm">
              Carrinho
              {totalItens > 0 && (
                <span className="ml-2 text-zinc-400 font-normal">
                  ({totalItens} {totalItens === 1 ? "item" : "itens"})
                </span>
              )}
            </span>
          </div>
          <button
            onClick={() => setSidebarAberta(false)}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Fechar carrinho"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto">
          {expiraEm && itens.length > 0 && (
             <div className="bg-yellow-500/10 border-b border-yellow-500/20 p-3 text-center">
               <p className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-1">Pagamento Pendente</p>
               <p className="text-yellow-400/80 text-[11px]">
                 Seu carrinho será esvaziado automaticamente.<br/>
                 <ContagemRegressiva 
                    dataCriacao={expiraEm} 
                    onExpirar={() => {
                      localStorage.removeItem('@ijprint:checkout_expires_at');
                      setExpiraEm(null);
                      dispatch({ type: "LIMPAR" });
                    }} 
                 />
               </p>
             </div>
          )}

          {itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-500 px-6 text-center">
              <ShoppingBag size={40} strokeWidth={1} />
              <p className="text-sm">Seu carrinho está vazio.</p>
              <button onClick={() => setSidebarAberta(false)} className="text-sand-400 text-sm hover:underline">
                Explorar produtos
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {itens.map((item) => (
                <li key={item.cartId || item.id} className="p-4 flex gap-3">
                  <img src={item.imagem} alt={item.nome} className="w-14 h-14 rounded object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-100 text-sm font-medium truncate">
                      {item.nome}{" "}
                      {item.opcaoEscolhida && <span className="text-zinc-400 font-normal">({item.opcaoEscolhida})</span>}
                    </p>
                    <p className="text-sand-400 text-sm font-bold mt-0.5">
                      R$ {((item.precoPromocional || item.preco) * item.quantidade).toFixed(2).replace(".", ",")}
                    </p>

                    {item.exigePersonalizacao && (
                      <textarea
                        rows={2}
                        placeholder="Descreva sua peça..."
                        value={item.personalizacao || ""}
                        onChange={(e) =>
                          dispatch({ type: "ATUALIZAR_PERSONALIZACAO", cartId: item.cartId || item.id, texto: e.target.value })
                        }
                        className="mt-2 w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:border-sand-400/50"
                      />
                    )}

                    {item.multiplaPersonalizacao && item.parametrosMultiplos && (
                      <div className="mt-2 text-xs text-zinc-500 bg-zinc-900/50 p-2 rounded border border-zinc-800/80">
                        <p className="font-semibold text-zinc-400 mb-1">Nomes ({item.quantidade}):</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {item.parametrosMultiplos.map((nome, idx) => (
                            <li key={idx} className="truncate">{nome}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      {!item.multiplaPersonalizacao && (
                        <>
                          <button
                            onClick={() => dispatch({ type: "ALTERAR_QUANTIDADE", cartId: item.cartId || item.id, quantidade: item.quantidade - 1 })}
                            className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-zinc-100 text-sm w-5 text-center">{item.quantidade}</span>
                          <button
                            onClick={() => dispatch({ type: "ALTERAR_QUANTIDADE", cartId: item.cartId || item.id, quantidade: item.quantidade + 1 })}
                            className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </>
                      )}
                      
                      {item.multiplaPersonalizacao && (
                        <span className="text-zinc-400 text-xs font-medium px-2 py-1 bg-zinc-800/50 rounded border border-zinc-700/50">
                          Qtd: {item.quantidade}
                        </span>
                      )}
                      <button
                        onClick={() => dispatch({ type: "REMOVER", cartId: item.cartId || item.id })}
                        className="ml-auto p-1 text-zinc-600 hover:text-red-400 transition-colors"
                        aria-label="Remover item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Rodapé */}
        {itens.length > 0 && (
          <div className="border-t border-zinc-800 p-5 space-y-4">
            <div className="flex justify-between items-center py-2">
              <span className="text-zinc-400 text-sm">Subtotal</span>
              <span className="text-sand-400 font-bold text-lg">
                R$ {totalPreco.toFixed(2).replace(".", ",")}
              </span>
            </div>

            {/* Seção de Entrega */}
            {user ? (
              <div className="py-2 border-t border-zinc-800">
                <span className="text-zinc-400 text-sm block mb-3">Opções de Entrega</span>

                {/* Toggle Envio / Retirada */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setModoEntrega('envio')}
                    className={`flex-1 py-2 text-xs font-bold rounded border transition-colors ${
                      modoEntrega === 'envio'
                        ? 'bg-sand-400/10 border-sand-400/50 text-sand-400'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    🚚 Envio pelos Correios
                  </button>
                  <button
                    onClick={() => { setModoEntrega('retirada'); setFreteSelecionado(null); }}
                    className={`flex-1 py-2 text-xs font-bold rounded border transition-colors ${
                      modoEntrega === 'retirada'
                        ? 'bg-green-500/10 border-green-500/40 text-green-400'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    📦 Retirar
                  </button>
                </div>

                {/* Aviso de Retirada */}
                {modoEntrega === 'retirada' && (
                  <div className="mb-3 p-3 bg-green-500/5 border border-green-500/20 rounded text-xs text-green-300 leading-relaxed">
                    ✅ <strong>Frete Grátis!</strong><br />
                    ⚠️ A retirada será realizada na <strong>Quadra da Guararema</strong>.
                    O horário da entrega será combinado pelo WhatsApp.
                  </div>
                )}

                {/* Seletor de endereço e opções de frete — só no modo envio */}
                {modoEntrega === 'envio' && (
                  <>
                    {todosEnderecos.length > 0 && (
                      <div className="mb-4">
                        <label className="text-xs text-zinc-500 mb-1 block">Enviar para:</label>
                        <select
                          value={enderecoSelecionado?.id || ''}
                          onChange={(e) => {
                            const selecionado = todosEnderecos.find(end => end.id === e.target.value);
                            setEnderecoSelecionado(selecionado);
                          }}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-zinc-300 focus:outline-none focus:border-sand-400"
                        >
                          {todosEnderecos.map(end => (
                            <option key={end.id} value={end.id}>
                              {end.rua}, {end.numero} — {end.cidade}/{end.uf} {end.padrao ? '(Padrão)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {calculandoFrete ? (
                      <p className="text-xs text-zinc-500 animate-pulse">Calculando opções...</p>
                    ) : !enderecoSelecionado ? (
                      <p className="text-xs text-zinc-500">
                        <button
                          onClick={() => { setSidebarAberta(false); navigate("/perfil"); }}
                          className="text-sand-400 underline"
                        >
                          Cadastre um endereço
                        </button>{" "}para ver o frete.
                      </p>
                    ) : opcoesFrete.length > 0 ? (
                      <div className="space-y-2">
                        {opcoesFrete.map((opcao) => (
                          <label
                            key={opcao.id}
                            className="flex items-center justify-between p-2 rounded border border-zinc-700 bg-zinc-800/50 cursor-pointer hover:border-sand-400/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="frete"
                                className="accent-sand-400"
                                checked={freteSelecionado?.id === opcao.id}
                                onChange={() => setFreteSelecionado(opcao)}
                              />
                              <span className="text-zinc-300 text-sm">{opcao.nome} ({opcao.prazo} dias)</span>
                            </div>
                            <span className="text-zinc-300 text-sm font-medium">
                              R$ {opcao.preco.toFixed(2).replace('.', ',')}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {/* Total com frete */}
            <div className="flex justify-between items-center py-2 border-t border-zinc-800">
              <span className="text-zinc-400 text-sm">Total a Pagar</span>
              <span className="text-sand-400 font-bold text-xl">
                R$ {(totalPreco + (freteSelecionado && modoEntrega === 'envio' ? freteSelecionado.preco : 0)).toFixed(2).replace(".", ",")}
              </span>
            </div>

            {itens.some((i) => i.exigePersonalizacao && !i.personalizacao) && (
              <p className="text-xs text-zinc-500 italic">
                Lembre-se de descrever os itens personalizados. Fotos e áudios de referência deverão ser enviados diretamente no WhatsApp.
              </p>
            )}

            <button
              onClick={finalizar}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-sand-400 hover:bg-sand-300 text-zinc-950 font-bold text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CreditCard size={16} />
              {loading ? "Processando..." : "Finalizar Pedido"}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
