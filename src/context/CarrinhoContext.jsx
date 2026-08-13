import { createContext, useContext, useReducer, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";

const CarrinhoContext = createContext(null);

function carrinhoReducer(state, action) {
  switch (action.type) {
    case "ADICIONAR": {
      // Find based on id and opcaoEscolhida
      const existente = state.find((i) => i.id === action.item.id && i.opcaoEscolhida === action.item.opcaoEscolhida);
      if (existente) {
        return state.map((i) => {
          if (i.id === action.item.id && i.opcaoEscolhida === action.item.opcaoEscolhida) {
            const qtdAdicionada = action.item.quantidade || 1;
            const novosParametros = action.item.parametrosMultiplos 
              ? [...(i.parametrosMultiplos || []), ...action.item.parametrosMultiplos] 
              : i.parametrosMultiplos;
              
            return { ...i, quantidade: i.quantidade + qtdAdicionada, parametrosMultiplos: novosParametros };
          }
          return i;
        });
      }
      return [...state, { ...action.item, quantidade: action.item.quantidade || 1, cartId: action.item.cartId || `${action.item.id}-${action.item.opcaoEscolhida || 'default'}-${Date.now()}` }];
    }
    case "REMOVER":
      return state.filter((i) => (i.cartId || i.id) !== action.cartId);
    case "ALTERAR_QUANTIDADE": {
      if (action.quantidade <= 0) return state.filter((i) => (i.cartId || i.id) !== action.cartId);
      return state.map((i) =>
        (i.cartId || i.id) === action.cartId ? { ...i, quantidade: action.quantidade } : i
      );
    }
    case "LIMPAR":
      return [];
    case "ATUALIZAR_PERSONALIZACAO":
      return state.map((i) =>
        (i.cartId || i.id) === action.cartId ? { ...i, personalizacao: action.texto } : i
      );
    default:
      return state;
  }
}

const STORAGE_KEY_CARRINHO = "ijprint_carrinho";

export function CarrinhoProvider({ children }) {
  const [itens, dispatch] = useReducer(
    carrinhoReducer,
    [],
    () => {
      try {
        const salvo = localStorage.getItem(STORAGE_KEY_CARRINHO);
        return salvo ? JSON.parse(salvo) : [];
      } catch {
        return [];
      }
    }
  );

  const [sidebarAberta, setSidebarAberta] = useState(false);

  const { user } = useAuth();

  // Persiste no localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CARRINHO, JSON.stringify(itens));
  }, [itens]);

  // Sincroniza com Supabase se o usuário estiver logado
  // Debounced: aguarda 2s após última mudança para não sobrecarregar a API
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      fetch('/api/carrinho-abandonado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, itens }),
      }).catch((err) => console.warn('[CarrinhoSync] Falha ao salvar no backend:', err));
    }, 2000); // 2s de debounce
    return () => clearTimeout(timer);
  }, [itens, user]);

  const totalItens = itens.reduce((acc, i) => acc + i.quantidade, 0);
  const totalPreco = itens.reduce((acc, i) => acc + (i.precoPromocional || i.preco) * i.quantidade, 0);

  function gerarLinkWhatsApp() {
    const numero = "5528999202470"; // uatizap

    const linhasItens = itens
      .map((item, idx) => {
        const nomeFinal = item.opcaoEscolhida ? `${item.nome} (${item.opcaoEscolhida})` : item.nome;
        const precoItem = item.precoPromocional || item.preco;
        const base = `${item.quantidade}x ${nomeFinal} - R$ ${(precoItem * item.quantidade).toFixed(2).replace(".", ",")}`;
        if (item.exigePersonalizacao && item.personalizacao) {
          return `${idx + 1}. ${base}\n   Detalhes: ${item.personalizacao}`;
        }
        if (item.multiplaPersonalizacao && item.parametrosMultiplos) {
          const formatados = item.parametrosMultiplos.map((p, i) => `     ${i+1}) ${p}`).join("\n");
          return `${idx + 1}. ${base}\n   Nomes Parametrizados:\n${formatados}`;
        }
        return `${idx + 1}. ${base}`;
      })
      .join("\n");

    const temPersonalizacao = itens.some(
      (i) => (i.exigePersonalizacao && i.personalizacao) || (i.multiplaPersonalizacao && i.parametrosMultiplos)
    );

    const avisoPersonalizacao = temPersonalizacao
      ? "\n\nEstou enviando as fotos/arquivos de referência para os itens personalizados logo abaixo."
      : "";

    const mensagem =
      `Pedido I.J Print\n\n` +
      `Itens:\n${linhasItens}\n\n` +
      `Total: R$ ${totalPreco.toFixed(2).replace(".", ",")}` +
      avisoPersonalizacao;

    return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
  }

  return (
    <CarrinhoContext.Provider
      value={{
        itens,
        dispatch,
        totalItens,
        totalPreco,
        sidebarAberta,
        setSidebarAberta,
        gerarLinkWhatsApp,
      }}
    >
      {children}
    </CarrinhoContext.Provider>
  );
}

export function useCarrinho() {
  const ctx = useContext(CarrinhoContext);
  if (!ctx) throw new Error("useCarrinho deve ser usado dentro de CarrinhoProvider");
  return ctx;
}
