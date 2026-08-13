import { useState, useEffect } from "react";
import { Cookie, X, Check, ChevronDown, ChevronUp } from "lucide-react";

const STORAGE_KEY = "@ijprint:cookie_consent";

export default function CookieBanner() {
  const [visivel, setVisivel] = useState(false);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  useEffect(() => {
    const consentimento = localStorage.getItem(STORAGE_KEY);
    if (!consentimento) {
      // Pequeno delay para não aparecer imediatamente junto com a página
      const timer = setTimeout(() => setVisivel(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  function aceitar() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ aceito: true, data: new Date().toISOString() }));
    setVisivel(false);
  }

  function recusar() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ aceito: false, data: new Date().toISOString() }));
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[90] p-4"
      role="dialog"
      aria-label="Aviso de consentimento de cookies"
    >
      <div className="max-w-2xl mx-auto bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Faixa superior */}
        <div className="h-0.5 w-full bg-gradient-to-r from-sand-400/0 via-sand-400 to-sand-400/0" />

        <div className="p-5">
          {/* Cabeçalho */}
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-sand-400/15 border border-sand-400/30 flex items-center justify-center mt-0.5">
              <Cookie size={17} className="text-sand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-zinc-100 font-bold text-sm">
                Usamos cookies para melhorar sua experiência 🍪
              </h3>
              <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                Utilizamos cookies essenciais para o funcionamento da loja (carrinho, login e preferências).
                Ao aceitar, você também autoriza cookies analíticos para nos ajudar a entender como a loja é usada,
                conforme a{" "}
                <strong className="text-zinc-300">Lei Geral de Proteção de Dados (LGPD)</strong>.
              </p>
            </div>
          </div>

          {/* Detalhes expansíveis */}
          <div className="mb-4">
            <button
              onClick={() => setDetalhesAbertos(!detalhesAbertos)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {detalhesAbertos ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {detalhesAbertos ? "Ocultar detalhes" : "Ver detalhes dos cookies"}
            </button>

            {detalhesAbertos && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="p-3 bg-zinc-800/60 border border-zinc-700/60 rounded-xl">
                  <p className="text-zinc-200 text-xs font-semibold mb-1">🔒 Essenciais (sempre ativos)</p>
                  <p className="text-zinc-500 text-[11px] leading-relaxed">
                    Login, sessão, carrinho de compras. Necessários para o funcionamento da loja.
                  </p>
                </div>
                <div className="p-3 bg-zinc-800/60 border border-zinc-700/60 rounded-xl">
                  <p className="text-zinc-200 text-xs font-semibold mb-1">📊 Analíticos (opcional)</p>
                  <p className="text-zinc-500 text-[11px] leading-relaxed">
                    Nos ajudam a entender quais páginas são mais visitadas para melhorar o site.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <button
              onClick={recusar}
              className="flex-1 py-2.5 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 font-medium text-xs rounded-xl transition-colors"
            >
              Apenas essenciais
            </button>
            <button
              onClick={aceitar}
              className="flex-1 py-2.5 bg-sand-400 hover:bg-sand-300 text-zinc-950 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <Check size={13} />
              Aceitar todos os cookies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
