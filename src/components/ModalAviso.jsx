import { AlertTriangle, X } from "lucide-react";

export default function ModalAviso({ onConfirmar, onCancelar }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-zinc-950/80 backdrop-blur-sm"
        onClick={onCancelar}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Faixa superior decorativa */}
          <div className="h-1 w-full bg-gradient-to-r from-sand-500 via-sand-400 to-sand-500" />

          {/* Botão fechar */}
          <button
            onClick={onCancelar}
            className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Fechar aviso"
          >
            <X size={16} />
          </button>

          {/* Conteúdo */}
          <div className="p-6 pt-5">
            {/* Ícone + Título */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-11 h-11 rounded-full bg-sand-400/15 border border-sand-400/30 flex items-center justify-center">
                <AlertTriangle size={22} className="text-sand-400" />
              </div>
              <div>
                <p className="text-xs text-sand-400/80 font-semibold uppercase tracking-widest mb-0.5">
                  Atenção antes de prosseguir
                </p>
                <h2 className="text-zinc-100 font-bold text-base leading-tight">
                  Informações sobre sua peça
                </h2>
              </div>
            </div>

            {/* Linha separadora */}
            <div className="border-t border-zinc-800 mb-4" />

            {/* Itens do aviso */}
            <ul className="space-y-3 mb-5">
              <li className="flex gap-3 text-sm text-zinc-300 leading-relaxed">
                <span className="flex-shrink-0 text-sand-400 mt-0.5">🖌️</span>
                <span>
                  Todas as nossas peças passam por um{" "}
                  <strong className="text-zinc-100">trabalho manual de pintura e acabamento</strong>.
                  Isso faz com que cada unidade seja{" "}
                  <strong className="text-zinc-100">única</strong>, podendo apresentar{" "}
                  variações de tonalidade e detalhes em relação às fotos do produto.
                </span>
              </li>
              <li className="flex gap-3 text-sm text-zinc-300 leading-relaxed">
                <span className="flex-shrink-0 text-sand-400 mt-0.5">📦</span>
                <span>
                  O prazo mínimo de produção é de{" "}
                  <strong className="text-zinc-100">20 dias corridos</strong> a partir da
                  confirmação do pagamento. Pedidos complexos ou personalizados podem
                  levar mais tempo.
                </span>
              </li>
              <li className="flex gap-3 text-sm text-zinc-300 leading-relaxed">
                <span className="flex-shrink-0 text-sand-400 mt-0.5">✉️</span>
                <span>
                  Em caso de dúvidas, entre em contato pelo WhatsApp antes de finalizar
                  a compra.
                </span>
              </li>
            </ul>

            {/* Botões */}
            <div className="flex flex-col gap-2">
              <button
                onClick={onConfirmar}
                className="w-full py-3 bg-sand-400 hover:bg-sand-300 text-zinc-950 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Estou ciente — Finalizar Pedido ✓
              </button>
              <button
                onClick={onCancelar}
                className="w-full py-2.5 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 font-medium text-sm rounded-xl transition-colors"
              >
                Cancelar e revisar o carrinho
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
