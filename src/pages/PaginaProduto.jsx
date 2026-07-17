import { useParams, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, ShoppingCart, Pencil } from "lucide-react";
import { produtos } from "../data/produtos";
import { useCarrinho } from "../context/CarrinhoContext";

export default function PaginaProduto() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dispatch, setSidebarAberta } = useCarrinho();

  const produto = produtos.find((p) => p.id === Number(id));
  const [personalizacao, setPersonalizacao] = useState("");
  const [adicionado, setAdicionado] = useState(false);

  if (!produto) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-zinc-500">
        <p>Produto não encontrado.</p>
        <Link to="/" className="text-sand-400 text-sm hover:underline">
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  function adicionarAoCarrinho() {
    dispatch({
      type: "ADICIONAR",
      item: {
        ...produto,
        personalizacao: produto.exigePersonalizacao ? personalizacao : undefined,
      },
    });
    setAdicionado(true);
    setTimeout(() => {
      setSidebarAberta(true);
      navigate("/");
    }, 600);
  }

  const podeAdicionar = !produto.exigePersonalizacao || personalizacao.trim().length > 0;

  return (
    <main className="pt-24 pb-16 px-4 max-w-5xl mx-auto">
      {/* Botão voltar */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-sand-400 text-sm mb-8 transition-colors"
      >
        <ArrowLeft size={15} />
        Voltar
      </button>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Imagem */}
        <div className="aspect-square rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900">
          <img
            src={produto.imagem}
            alt={produto.nome}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Detalhes */}
        <div className="flex flex-col gap-5">
          <div>
            <span className="text-xs text-zinc-500 uppercase tracking-widest">
              {produto.categoria}
            </span>
            <h1 className="font-display text-3xl md:text-4xl text-white uppercase tracking-tight mt-1">
              {produto.nome}
            </h1>
          </div>

          <p className="text-zinc-400 text-sm leading-relaxed">{produto.descricao}</p>

          {/* Campo de personalização */}
          {produto.exigePersonalizacao && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sand-400">
                <Pencil size={14} />
                <span className="text-sm font-medium">Personalização</span>
              </div>
              <textarea
                rows={4}
                placeholder="Descreva sua peça (cor de cabelo, roupa, acessórios, estilo…)"
                value={personalizacao}
                onChange={(e) => setPersonalizacao(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-sand-400/60"
              />
              <p className="text-xs text-zinc-500 italic">
                Nota: Fotos e áudios de referência deverão ser enviados diretamente no WhatsApp após a finalização do pedido.
              </p>
            </div>
          )}

          {/* Preço e botão */}
          <div className="mt-auto space-y-3">
            <p className="text-sand-400 font-bold text-3xl">
              R$ {produto.preco.toFixed(2).replace(".", ",")}
            </p>

            <button
              onClick={adicionarAoCarrinho}
              disabled={!podeAdicionar || adicionado}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded font-bold text-sm uppercase tracking-wider transition-all ${
                adicionado
                  ? "bg-green-500/20 border border-green-500/40 text-green-400 cursor-default"
                  : podeAdicionar
                  ? "bg-sand-400 hover:bg-sand-300 text-zinc-950"
                  : "bg-zinc-800 border border-zinc-700 text-zinc-600 cursor-not-allowed"
              }`}
            >
              <ShoppingCart size={16} />
              {adicionado ? "Adicionado!" : "Adicionar ao carrinho"}
            </button>

            {produto.exigePersonalizacao && !personalizacao.trim() && (
              <p className="text-xs text-zinc-600 text-center">
                Preencha a personalização para continuar.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
