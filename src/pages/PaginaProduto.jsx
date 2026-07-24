import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, ShoppingCart, Pencil, Tag, ChevronLeft, ChevronRight } from "lucide-react";
import { produtos } from "../data/produtos";
import { useCarrinho } from "../context/CarrinhoContext";

export default function PaginaProduto() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dispatch, setSidebarAberta } = useCarrinho();

  const produto = produtos.find((p) => p.id === Number(id));
  const [personalizacao, setPersonalizacao] = useState("");
  const [adicionado, setAdicionado] = useState(false);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState("");
  const [variacaoSelecionada, setVariacaoSelecionada] = useState("");
  const [imagemAtual, setImagemAtual] = useState("");

  useEffect(() => {
    setPersonalizacao("");
    setAdicionado(false);
    setOpcaoSelecionada("");
    setVariacaoSelecionada("");
    if (produto) setImagemAtual(produto.imagem);
  }, [id, produto]);


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

  const opcaoAtual = produto.opcoes?.find((o) => o.nome === opcaoSelecionada);
  const variacaoAtual = opcaoAtual?.variacoes?.find((v) => v.nome === variacaoSelecionada);
  const precoFinal = variacaoAtual?.preco || opcaoAtual?.preco || produto.precoPromocional || produto.preco;
  const exibePromocao = !opcaoAtual?.preco && !variacaoAtual?.preco && produto.precoPromocional;

  function adicionar() {
    const itemToAdd = {
      ...produto,
      preco: variacaoAtual?.preco || opcaoAtual?.preco || produto.preco,
      precoPromocional: (opcaoAtual?.preco || variacaoAtual?.preco) ? null : produto.precoPromocional,
      personalizacao: produto.exigePersonalizacao ? personalizacao : undefined,
      opcaoEscolhida: opcaoSelecionada 
        ? (variacaoSelecionada ? `${opcaoSelecionada} - ${variacaoSelecionada}` : opcaoSelecionada) 
        : undefined,
      cartId: `${produto.id}-${opcaoSelecionada || 'default'}-${variacaoSelecionada || 'default'}-${Date.now()}`,
    };

    dispatch({ type: "ADICIONAR", item: itemToAdd });
    setAdicionado(true);
    setTimeout(() => {
      setSidebarAberta(true);
      setAdicionado(false);
    }, 600);
  }

  const temCarousel = produto?.imagens && produto.imagens.length > 1;
  const currentImgIndex = temCarousel ? Math.max(0, produto.imagens.indexOf(imagemAtual)) : 0;

  function handlePrevImage(e) {
    if (e) e.preventDefault();
    if (!temCarousel) return;
    const prev = currentImgIndex === 0 ? produto.imagens.length - 1 : currentImgIndex - 1;
    setImagemAtual(produto.imagens[prev]);
  }

  function handleNextImage(e) {
    if (e) e.preventDefault();
    if (!temCarousel) return;
    const next = currentImgIndex === produto.imagens.length - 1 ? 0 : currentImgIndex + 1;
    setImagemAtual(produto.imagens[next]);
  }

  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) handleNextImage();
    if (isRightSwipe) handlePrevImage();
  };

  const temOpcaoPendente = (produto.opcoes && produto.opcoes.length > 0 && !opcaoSelecionada) || 
                           (opcaoAtual?.variacoes && opcaoAtual.variacoes.length > 0 && !variacaoSelecionada);
  const podeAdicionar = (!produto.exigePersonalizacao || personalizacao.trim().length > 0) && !temOpcaoPendente;

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
        <div className="flex flex-col gap-4">
          <div 
            className="relative aspect-square rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 group/carousel"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEndHandler}
          >
            <img
              src={imagemAtual}
              alt={produto.nome}
              className="w-full h-full object-cover transition-transform duration-500"
            />

            {temCarousel && (
              <>
                <button
                  onClick={handlePrevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover/carousel:opacity-100 transition-opacity z-20"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover/carousel:opacity-100 transition-opacity z-20"
                >
                  <ChevronRight size={20} />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 bg-black/40 px-3 py-1.5 rounded-full">
                  {produto.imagens.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i === currentImgIndex ? "bg-sand-400" : "bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            {produto.precoPromocional && !opcaoAtual?.preco && (
              <span className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1 bg-red-950/90 border border-red-500/40 rounded text-red-400 text-xs font-bold tracking-wider uppercase z-20">
                <Tag size={12} />
                Promoção
              </span>
            )}
          </div>
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

          {/* Opções de Escolha (ex: cores) */}
          {produto.opcoes && produto.opcoes.length > 0 && (
            <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/20 backdrop-blur-md p-4 space-y-3 mt-2">
              <span className="text-sm font-medium text-sand-400">Opções Disponíveis</span>
              <div className="flex flex-wrap gap-3">
                {produto.opcoes.map((opcao) => {
                  const isSelected = opcaoSelecionada === opcao.nome;
                  return (
                    <button
                      key={opcao.nome}
                      disabled={opcao.esgotado}
                      onClick={() => {
                        if (opcaoSelecionada !== opcao.nome) {
                          setVariacaoSelecionada(""); // Reseta a sub-opção se trocar o modelo
                        }
                        setOpcaoSelecionada(opcao.nome);
                        if (opcao.imagem) {
                          setImagemAtual(opcao.imagem);
                        } else if (opcao.variacoes && opcao.variacoes.length > 0 && opcao.variacoes[0].imagem) {
                          setImagemAtual(opcao.variacoes[0].imagem);
                        }
                      }}
                      className={`relative px-4 py-2 rounded-full border text-sm font-medium transition-all duration-300 ${
                        opcao.esgotado
                          ? "bg-zinc-900/40 backdrop-blur-sm border-zinc-800/50 text-zinc-600 cursor-not-allowed overflow-hidden"
                          : isSelected
                          ? "bg-sand-400 border-sand-400 text-zinc-950 shadow-[0_0_12px_rgba(255,255,255,0.1)] scale-[1.02]"
                          : "bg-zinc-800/40 backdrop-blur-sm border-zinc-700/50 text-zinc-300 hover:bg-zinc-700/60 hover:border-sand-400/60 hover:text-white"
                      }`}
                    >
                      {opcao.nome}
                      {opcao.esgotado && (
                        <div className="absolute inset-0 w-full h-full pointer-events-none">
                          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-zinc-600/50 -rotate-[20deg] transform origin-center"></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Variações da opção escolhida (ex: pintado/não pintado) */}
          {opcaoAtual?.variacoes && opcaoAtual.variacoes.length > 0 && (
            <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/20 backdrop-blur-md p-4 space-y-3 mt-2">
              <span className="text-sm font-medium text-sand-400">Opções de Acabamento</span>
              <div className="flex flex-wrap gap-3">
                {opcaoAtual.variacoes.map((variacao) => {
                  const isSelected = variacaoSelecionada === variacao.nome;
                  return (
                    <button
                      key={variacao.nome}
                      disabled={variacao.esgotado}
                      onClick={() => {
                        setVariacaoSelecionada(variacao.nome);
                        if (variacao.imagem) setImagemAtual(variacao.imagem);
                      }}
                      className={`relative px-4 py-2 rounded-full border text-sm font-medium transition-all duration-300 ${
                        variacao.esgotado
                          ? "bg-zinc-900/40 backdrop-blur-sm border-zinc-800/50 text-zinc-600 cursor-not-allowed overflow-hidden"
                          : isSelected
                          ? "bg-sand-400 border-sand-400 text-zinc-950 shadow-[0_0_12px_rgba(255,255,255,0.1)] scale-[1.02]"
                          : "bg-zinc-800/40 backdrop-blur-sm border-zinc-700/50 text-zinc-300 hover:bg-zinc-700/60 hover:border-sand-400/60 hover:text-white"
                      }`}
                    >
                      {variacao.nome}
                      {variacao.esgotado && (
                        <div className="absolute inset-0 w-full h-full pointer-events-none">
                          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-zinc-600/50 -rotate-[20deg] transform origin-center"></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preço e botão */}
          <div className="mt-auto space-y-3">
            {exibePromocao ? (
              <div className="flex items-end gap-3">
                <p className="text-sand-400 font-bold text-3xl">
                  R$ {produto.precoPromocional.toFixed(2).replace(".", ",")}
                </p>
                <p className="text-zinc-500 line-through text-lg mb-0.5">
                  R$ {produto.preco.toFixed(2).replace(".", ",")}
                </p>
              </div>
            ) : (
              <p className="text-sand-400 font-bold text-3xl">
                R$ {precoFinal.toFixed(2).replace(".", ",")}
              </p>
            )}

            <button
              onClick={adicionar}
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
            
            {temOpcaoPendente && (
              <p className="text-xs text-zinc-600 text-center">
                Selecione uma opção para continuar.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
