import { Instagram, Github, ShoppingBag, Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-800 mt-20 py-12 px-4">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">

        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="font-display text-white tracking-widest text-lg font-bold">
            I.J <span className="text-sand-400">PRINT26</span>
          </span>
        </div>

        {/* Email */}
        <a
          href="mailto:i.j.print26@gmail.com?subject=Contato%20/%20Pedido%20Personalizado%20-%20I.J%20Print&body=Ol%C3%A1!%20Gostaria%20de%20conversar%20sobre%20um%20projeto%20personalizado.%0A%0A[Por%20favor%2C%20descreva%20aqui%20a%20sua%20ideia%20e%20anexe%20arquivos/fotos%20se%20necess%C3%A1rio]"
          className="flex items-center gap-2 text-sand-400 hover:text-sand-200 transition-colors text-sm"
        >
          <Mail size={15} />
          i.j.print26@gmail.com
        </a>

        {/* Redes sociais */}
        <div className="flex items-center gap-6">
          <a
            href="https://www.instagram.com/i.j.print26/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="text-sand-500 hover:text-sand-300 transition-colors"
          >
            <Instagram size={20} />
          </a>
          <a
            href="https://shopee.com.br/i.jprint"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Shopee"
            className="text-sand-500 hover:text-sand-300 transition-colors"
          >
            <ShoppingBag size={20} />
          </a>
          <a
            href="https://github.com/IllanSpala"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub do desenvolvedor"
            className="text-sand-500 hover:text-sand-300 transition-colors"
          >
            <Github size={20} />
          </a>
        </div>

        <p className="text-zinc-600 text-xs">
          © {new Date().getFullYear()} I.J Print — Impressão 3D artesanal
        </p>
      </div>
    </footer>
  );
}
