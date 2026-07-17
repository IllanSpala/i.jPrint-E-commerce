import { ShoppingCart } from "lucide-react";
import { useCarrinho } from "../context/CarrinhoContext";
import { Link } from "react-router-dom";

export default function Header() {
  const { totalItens, setSidebarAberta } = useCarrinho();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between relative">

        {/* Espaço esquerdo (balanceia a logo) */}
        <div className="w-10" />

        {/* Logo centralizada — substitua o <div> abaixo por <img src="/logo.png" ... /> */}
        <Link to="/" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          { }
          <img
            src="/logo.png"
            alt="I.J Print"
            className="h-16 w-auto object-contain"
          />

        </Link>

        {/* Botão carrinho */}
        <button
          onClick={() => setSidebarAberta(true)}
          aria-label="Abrir carrinho"
          className="relative p-2 rounded-md text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
        >
          <ShoppingCart size={22} />
          {totalItens > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-silver-400 text-zinc-950 text-[10px] font-bold rounded-full flex items-center justify-center">
              {totalItens > 9 ? "9+" : totalItens}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
