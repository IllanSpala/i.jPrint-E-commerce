import { X, Trash2, Plus, Minus, ShoppingBag, MessageCircle } from "lucide-react";
import { useCarrinho } from "../context/CarrinhoContext";
import { useState } from "react";

export default function SidebarCarrinho() {
  const {
    itens,
    dispatch,
    cliente,
    setCliente,
    totalItens,
    totalPreco,
    sidebarAberta,
    setSidebarAberta,
    gerarLinkWhatsApp,
  } = useCarrinho();

  const [erros, setErros] = useState({});

  function validar() {
    const novos = {};
    if (!cliente.nome.trim())     novos.nome     = "Informe seu nome.";
    if (!cliente.endereco.trim()) novos.endereco = "Informe o endereço completo.";
    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  function finalizar() {
    if (!validar()) return;
    window.open(gerarLinkWhatsApp(), "_blank");
  }

  return (
    <>
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
          {itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-500 px-6 text-center">
              <ShoppingBag size={40} strokeWidth={1} />
              <p className="text-sm">Seu carrinho está vazio.</p>
              <button
                onClick={() => setSidebarAberta(false)}
                className="text-sand-400 text-sm hover:underline"
              >
                Explorar produtos
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {itens.map((item) => (
                <li key={item.id} className="p-4 flex gap-3">
                  <img
                    src={item.imagem}
                    alt={item.nome}
                    className="w-14 h-14 rounded object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-100 text-sm font-medium truncate">{item.nome}</p>
                    <p className="text-sand-400 text-sm font-bold mt-0.5">
                      R$ {(item.preco * item.quantidade).toFixed(2).replace(".", ",")}
                    </p>

                    {/* Campo de personalização */}
                    {item.exigePersonalizacao && (
                      <textarea
                        rows={2}
                        placeholder="Descreva sua peça..."
                        value={item.personalizacao || ""}
                        onChange={(e) =>
                          dispatch({
                            type: "ATUALIZAR_PERSONALIZACAO",
                            id: item.id,
                            texto: e.target.value,
                          })
                        }
                        className="mt-2 w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:border-sand-400/50"
                      />
                    )}

                    {/* Quantidade */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() =>
                          dispatch({ type: "ALTERAR_QUANTIDADE", id: item.id, quantidade: item.quantidade - 1 })
                        }
                        className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-zinc-100 text-sm w-5 text-center">{item.quantidade}</span>
                      <button
                        onClick={() =>
                          dispatch({ type: "ALTERAR_QUANTIDADE", id: item.id, quantidade: item.quantidade + 1 })
                        }
                        className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        onClick={() => dispatch({ type: "REMOVER", id: item.id })}
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
            <div className="space-y-2.5">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Seu nome</label>
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={cliente.nome}
                  onChange={(e) => setCliente({ ...cliente, nome: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sand-400/60"
                />
                {erros.nome && <p className="text-red-400 text-xs mt-1">{erros.nome}</p>}
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Endereço completo</label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro, CEP, cidade"
                  value={cliente.endereco}
                  onChange={(e) => setCliente({ ...cliente, endereco: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sand-400/60"
                />
                {erros.endereco && <p className="text-red-400 text-xs mt-1">{erros.endereco}</p>}
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-zinc-800">
              <span className="text-zinc-400 text-sm">Total</span>
              <span className="text-sand-400 font-bold text-lg">
                R$ {totalPreco.toFixed(2).replace(".", ",")}
              </span>
            </div>

            {itens.some((i) => i.exigePersonalizacao && !i.personalizacao) && (
              <p className="text-xs text-zinc-500 italic">
                Lembre-se de descrever os itens personalizados. Fotos e áudios de referência deverão ser enviados diretamente no WhatsApp.
              </p>
            )}

            <button
              onClick={finalizar}
              className="w-full flex items-center justify-center gap-2 py-3 bg-sand-400 hover:bg-sand-300 text-zinc-950 font-bold text-sm rounded transition-colors"
            >
              <MessageCircle size={16} />
              Finalizar no WhatsApp
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
