import { Link } from "react-router-dom";
import { ShoppingCart, Pencil } from "lucide-react";
import { useCarrinho } from "../context/CarrinhoContext";

export default function CardProduto({ produto }) {
  const { dispatch, setSidebarAberta } = useCarrinho();

  function adicionarAoCarrinho(e) {
    e.preventDefault();
    dispatch({ type: "ADICIONAR", item: produto });
    setSidebarAberta(true);
  }

  return (
    <Link
      to={`/produto/${produto.id}`}
      className="group relative flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-sand-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-sand-400/5"
    >
      {/* Imagem do produto */}
      <div className="relative overflow-hidden aspect-square">
        <img
          src={produto.imagem}
          alt={produto.nome}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {produto.exigePersonalizacao && (
          <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-zinc-950/90 border border-sand-400/40 rounded text-sand-400 text-[10px] font-medium tracking-wider uppercase">
            <Pencil size={10} />
            Personalizado
          </span>
        )}
      </div>

      {/* Informações */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
            {produto.categoria}
          </span>
          <h3 className="mt-0.5 text-zinc-100 font-semibold text-sm leading-snug group-hover:text-sand-300 transition-colors">
            {produto.nome}
          </h3>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <span className="text-sand-400 font-bold text-base">
            R$ {produto.preco.toFixed(2).replace(".", ",")}
          </span>

          {!produto.exigePersonalizacao ? (
            <button
              onClick={adicionarAoCarrinho}
              aria-label={`Adicionar ${produto.nome} ao carrinho`}
              className="p-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-sand-400 hover:border-sand-400 hover:text-zinc-950 transition-all"
            >
              <ShoppingCart size={16} />
            </button>
          ) : (
            <span className="text-[10px] text-zinc-500 italic">Ver detalhes</span>
          )}
        </div>
      </div>
    </Link>
  );
}
