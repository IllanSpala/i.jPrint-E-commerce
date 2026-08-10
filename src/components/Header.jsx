import { ShoppingCart, User, ShieldCheck } from "lucide-react";
import { useCarrinho } from "../context/CarrinhoContext";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function Header() {
  const { totalItens, setSidebarAberta } = useCarrinho();
  const { user } = useAuth();
  
  const isAdmin = user && user.email === 'i.j.print26@gmail.com';

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

        {/* Botões direita (Perfil e Carrinho) */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              to="/admin"
              aria-label="Painel Admin"
              className="p-2 mr-1 rounded-md text-sand-400 hover:text-sand-300 hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck size={20} />
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Admin</span>
            </Link>
          )}

          <Link
            to="/perfil"
            aria-label="Perfil do usuário"
            className="p-2 rounded-md text-zinc-400 hover:text-sand-400 hover:bg-zinc-800 transition-colors"
          >
            <User size={22} />
          </Link>

          <button
            onClick={() => setSidebarAberta(true)}
            aria-label="Abrir carrinho"
            className="relative p-2 rounded-md text-zinc-400 hover:text-sand-400 hover:bg-zinc-800 transition-colors"
          >
            <ShoppingCart size={22} />
            {totalItens > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-sand-400 text-zinc-950 text-[10px] font-bold rounded-full flex items-center justify-center">
                {totalItens > 9 ? "9+" : totalItens}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
