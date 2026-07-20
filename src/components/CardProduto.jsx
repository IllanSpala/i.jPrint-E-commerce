import { useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Pencil, Tag, ChevronLeft, ChevronRight } from "lucide-react";
import { useCarrinho } from "../context/CarrinhoContext";

export default function CardProduto({ produto }) {
  const { dispatch, setSidebarAberta } = useCarrinho();
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const temCarousel = produto.imagens && produto.imagens.length > 1;

  function handlePrevImage(e) {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev === 0 ? produto.imagens.length - 1 : prev - 1));
  }

  function handleNextImage(e) {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev === produto.imagens.length - 1 ? 0 : prev + 1));
  }

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
      <div className="relative overflow-hidden aspect-square group/carousel">
        {temCarousel ? (
          <>
            <img
              src={produto.imagens[currentImgIndex]}
              alt={produto.nome}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <button
              onClick={handlePrevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover/carousel:opacity-100 transition-opacity z-20"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover/carousel:opacity-100 transition-opacity z-20"
            >
              <ChevronRight size={16} />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 bg-black/40 px-2 py-1 rounded-full">
              {produto.imagens.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === currentImgIndex ? "bg-sand-400" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          </>
        ) : (
          <img
            src={produto.imagem}
            alt={produto.nome}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {produto.exigePersonalizacao && (
          <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-zinc-950/90 border border-sand-400/40 rounded text-sand-400 text-[10px] font-medium tracking-wider uppercase">
            <Pencil size={10} />
            Personalizado
          </span>
        )}
        {produto.precoPromocional && (
          <span className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-red-950/90 border border-red-500/40 rounded text-red-400 text-[10px] font-medium tracking-wider uppercase">
            <Tag size={10} />
            Promoção
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
          <div className="flex items-center gap-2">
            {produto.precoPromocional ? (
              <>
                <span className="text-sand-400 font-bold text-base">
                  R$ {produto.precoPromocional.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-zinc-500 line-through text-[10px]">
                  R$ {produto.preco.toFixed(2).replace(".", ",")}
                </span>
              </>
            ) : (
              <span className="text-sand-400 font-bold text-base">
                R$ {produto.preco.toFixed(2).replace(".", ",")}
              </span>
            )}
          </div>

          {(!produto.exigePersonalizacao && (!produto.opcoes || produto.opcoes.length === 0)) ? (
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
