import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { produtos, categorias } from "../data/produtos";
import CardProduto from "../components/CardProduto";

export default function Home() {
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todos");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (buscaAberta) inputRef.current?.focus();
  }, [buscaAberta]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") fecharBusca();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function fecharBusca() {
    setBuscaAberta(false);
    setTermoBusca("");
  }

  const filtrados = produtos.filter((p) => {
    const passaCategoria = categoriaAtiva === "Todos" || p.categoria === categoriaAtiva;
    const passaBusca =
      termoBusca.trim() === "" ||
      p.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
      p.descricao.toLowerCase().includes(termoBusca.toLowerCase()) ||
      p.categoria.toLowerCase().includes(termoBusca.toLowerCase());
    return passaCategoria && passaBusca;
  });

  return (
    <main className="pt-24 pb-16 px-4 max-w-7xl mx-auto">

      {/* Hero */}
      <section className="text-center py-12 mb-12 relative">
        <h1 className="font-display text-5xl md:text-7xl text-white tracking-tight uppercase">
          Forjado em{" "}
          <span className="text-sand-400">três dimensões</span>
        </h1>
        <p className="mt-4 text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed">
          Impressão 3D com precisão e acabamento premium.
        </p>
      </section>

      {/* Filtros + Busca */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">

        {/* Tags de categoria */}
        <div className="flex flex-wrap gap-2 flex-1">
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaAtiva(cat)}
              className={`px-4 py-1.5 rounded text-xs font-medium uppercase tracking-wider border transition-all duration-200 ${
                categoriaAtiva === cat
                  ? "bg-sand-400 border-sand-400 text-zinc-950"
                  : "bg-transparent border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Ícone de busca + input expansível */}
        <div className="relative flex items-center">
          <div
            className="flex items-center overflow-hidden transition-all duration-300 ease-in-out rounded-full"
            style={{
              maxWidth: buscaAberta ? "220px" : "0px",
              opacity: buscaAberta ? 1 : 0,
              background: buscaAberta ? "rgba(255,255,255,0.04)" : "transparent",
              backdropFilter: buscaAberta ? "blur(8px)" : "none",
              border: buscaAberta ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
              marginRight: buscaAberta ? "6px" : "0px",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Buscar produtos..."
              className="bg-transparent text-zinc-200 text-xs placeholder-zinc-500 outline-none px-3 py-1.5 w-full"
              style={{ minWidth: "180px" }}
            />
            {termoBusca && (
              <button
                onClick={() => setTermoBusca("")}
                className="pr-2 text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
                aria-label="Limpar busca"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            onClick={() => (buscaAberta ? fecharBusca() : setBuscaAberta(true))}
            aria-label={buscaAberta ? "Fechar busca" : "Abrir busca"}
            className={`p-2 rounded-full transition-all duration-200 ${
              buscaAberta
                ? "text-sand-400 bg-sand-400/10"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <Search size={15} />
          </button>
        </div>
      </div>

      {/* Indicador de busca ativa */}
      {termoBusca && (
        <p className="text-xs text-zinc-500 mb-4">
          {filtrados.length === 0 ? "Nenhum resultado para" : `${filtrados.length} resultado${filtrados.length !== 1 ? "s" : ""} para`}{" "}
          <span className="text-sand-400/80">"{termoBusca}"</span>
        </p>
      )}

      {/* Grid de produtos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtrados.map((produto) => (
          <CardProduto key={produto.id} produto={produto} />
        ))}
      </div>

      {filtrados.length === 0 && (
        <p className="text-center text-zinc-500 py-16">
          {termoBusca ? `Nenhum produto encontrado para "${termoBusca}".` : "Nenhum produto nesta categoria."}
        </p>
      )}
    </main>
  );
}
