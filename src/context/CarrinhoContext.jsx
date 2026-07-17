import { createContext, useContext, useReducer, useEffect, useState } from "react";

const CarrinhoContext = createContext(null);

function carrinhoReducer(state, action) {
  switch (action.type) {
    case "ADICIONAR": {
      const existente = state.find((i) => i.id === action.item.id);
      if (existente) {
        return state.map((i) =>
          i.id === action.item.id
            ? { ...i, quantidade: i.quantidade + 1 }
            : i
        );
      }
      return [...state, { ...action.item, quantidade: 1 }];
    }
    case "REMOVER":
      return state.filter((i) => i.id !== action.id);
    case "ALTERAR_QUANTIDADE": {
      if (action.quantidade <= 0) return state.filter((i) => i.id !== action.id);
      return state.map((i) =>
        i.id === action.id ? { ...i, quantidade: action.quantidade } : i
      );
    }
    case "LIMPAR":
      return [];
    case "ATUALIZAR_PERSONALIZACAO":
      return state.map((i) =>
        i.id === action.id ? { ...i, personalizacao: action.texto } : i
      );
    default:
      return state;
  }
}

const STORAGE_KEY_CARRINHO = "ijprint_carrinho";
const STORAGE_KEY_CLIENTE = "ijprint_cliente";

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

  const [cliente, setClienteState] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_CLIENTE);
      return salvo ? JSON.parse(salvo) : { nome: "", endereco: "" };
    } catch {
      return { nome: "", endereco: "" };
    }
  });

  const [sidebarAberta, setSidebarAberta] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CARRINHO, JSON.stringify(itens));
  }, [itens]);

  function setCliente(dados) {
    setClienteState(dados);
    localStorage.setItem(STORAGE_KEY_CLIENTE, JSON.stringify(dados));
  }

  const totalItens = itens.reduce((acc, i) => acc + i.quantidade, 0);
  const totalPreco = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);

  function gerarLinkWhatsApp() {
    const numero = "5528999202470"; // uatizap

    const linhasItens = itens
      .map((item, idx) => {
        const base = `${item.quantidade}x ${item.nome} - R$ ${(item.preco * item.quantidade).toFixed(2).replace(".", ",")}`;
        if (item.exigePersonalizacao && item.personalizacao) {
          return `${idx + 1}. ${base}\n   Detalhes: ${item.personalizacao}`;
        }
        return `${idx + 1}. ${base}`;
      })
      .join("\n");

    const temPersonalizacao = itens.some(
      (i) => i.exigePersonalizacao && i.personalizacao
    );

    const avisoPersonalizacao = temPersonalizacao
      ? "\n\nEstou enviando as fotos/arquivos de referência para os itens personalizados logo abaixo."
      : "";

    const mensagem =
      `Pedido I.J Print\n` +
      `Cliente: ${cliente.nome}\n` +
      `Endereço: ${cliente.endereco}\n\n` +
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
        cliente,
        setCliente,
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
