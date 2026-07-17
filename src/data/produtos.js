export const produtos = [
  {
    id: 1,
    nome: "Pophead Personalizado",
    preco: 89.90,
    imagem: "/produtos/MINIATURA.png",
    categoria: "Personalizados",
    exigePersonalizacao: true,
    descricao: "Miniatura Pophead personalizada em estilo Funko Pop totalmente personalizada com suas características. Impressão FDM com acabamento premium. Acompanha base conjunta. Aproximadamente 13cm",
  },
  {
    id: 2,
    nome: "Pophead Casal",
    preco: 159.90,
    imagem: "/produtos/MINIATURA_CASAL.png",
    categoria: "Personalizados",
    exigePersonalizacao: true,
    descricao: "Kit com dois Popheads em estilo Funko Pop totalmente personalizados para casais. Ideal para presentes de noivado, casamento e aniversário. Acompanha base conjunta. Aproximadamente 13cm",
  },
  {
    id: 3,
    nome: "Pophead Família",
    preco: 229.90,
    imagem: "/produtos/MINIATURA_FAMILIA.png",
    categoria: "Personalizados",
    exigePersonalizacao: true,
    descricao: "Kit com três Popheads em estilo Funko Pop totalmente personalizados para famílias.Acompanha base conjunta. Aproximadamente 13cm",
  },
  {
    id: 4,
    nome: "Pophead Operadores RainbowSixSiege",
    preco: 89.90,
    imagem: "/produtos/MINIATURA_R6.png",
    categoria: "Personalizados",
    exigePersonalizacao: true,
    descricao: "Miniatura PopHead estilo FunkoPop do seu operador favorito de R6Siege. Enviar operador selecionado e skin no Whatsapp. Acompanha base conjunta. Aproximadamente 13cm",
  },
  {
    id: 5,
    nome: "Miniatura Personalizada Temática",
    preco: 119.90,
    imagem: "/produtos/MINIATURA_TEMATICA.png",
    categoria: "Personalizados",
    exigePersonalizacao: true,
    descricao: "Miniatura personalizada temática exclusiva baseada em sua profissão, hobbie ou caracteristica desejada. Acompanha base conjunta. Aproximadamente 13cm",
  },
  {
    id: 6,
    nome: "Tony Montana - Scarface",
    preco: 99.90,
    imagem: "/produtos/HOTTOY_TONY.png",
    categoria: "Hot Toys",
    exigePersonalizacao: false,
    descricao: "Hot Toy Tony Montana Filme Scarface, impresso em PLA Premium, aproximadamente 22cm",
  },
  {
    id: 7,
    nome: "Siegmeyer of Catarina - CEBOLÃO DarkSouls",
    preco: 139.90,
    imagem: "/produtos/CEBOLAO.png",
    categoria: "Hot Toys",
    exigePersonalizacao: false,
    descricao: "Miniatura Siegmeyer of Catarina, versão Cebolão, do jogo DarkSouls, sentadinho na sua estante (refs) impresso em PLA Premium, aproximadamente 20cm",
  },
  {
    id: 8,
    nome: "Porta Lápis Pokebola",
    preco: 44.90,
    imagem: "/produtos/PORTA_LAPIS_POKEBOLA.png",
    categoria: "Casa e Decoração",
    exigePersonalizacao: false,
    descricao: "Organizador de mesa/Porta lápis em formato de Pokebola. Aproximadamente 450g",
  },
  {
    id: 9,
    nome: "Torre de Dados Malboro",
    preco: 34.90,
    imagem: "/produtos/TORRE_MALBORO.png",
    categoria: "Casa e Decoração",
    exigePersonalizacao: false,
    descricao: "Torre de dados para RPG estilo Malboro. Ideal para mercenários fumantes, não recomendado para quem joga de Gnomo por causar insuficiencia respiratória.",
  },
  {
    id: 10,
    nome: "Porta Lápis Jake Hora de Aventura",
    preco: 44.90,
    imagem: "/produtos/PORTA_LAPIS_JAKE.png",
    categoria: "Casa e Decoração",
    exigePersonalizacao: false,
    descricao: "Organizador de mesa/Porta lápis em formato dO Jake o cachorro do Hora de Aventura. Aproximadamente 350g",
  },
  {
    id: 11,
    nome: "Ovo de Dragão - Fidget Sensorial",
    preco: 49.90,
    imagem: "/produtos/FIDGET_OVO_SENSORIAL.png",
    categoria: "Sensoriais",
    exigePersonalizacao: false,
    descricao: "Ovo de dragão fidget sensorial impresso em PLA Premium, perfeito para quem precisa de estímulo tátil. Aproximadamente 150g",
  },
  {
    id: 12,
    nome: "Estrela 10 pontas - Fidget Sensorial",
    preco: 49.90,
    imagem: "/produtos/FIDGET_ESTRELA_SENSORIAL.png",
    categoria: "Sensoriais",
    exigePersonalizacao: false,
    descricao: "Estrela 10 pontas fidget sensorial impresso em PLA Premium, perfeito para quem precisa de estímulo tátil.",
  },
  {
    id: 13,
    nome: "Estatua Gandalf - Senhor dos anéis (16cm)",
    preco: 179.90,
    imagem: "/produtos/ESTATUA_GANDALF.png",
    categoria: "Casa e Decoração",
    exigePersonalizacao: false,
    descricao: "Estatua Gandalf do Senhor dos anéis, impressa em Pla Stone Marmore e Pla SIlk Dourado, aproximadamente 16cm",
  },
  {
    id: 14,
    nome: "Kit Fallout - Funcionário Vault-tec",
    preco: 119.90,
    imagem: "/produtos/KIT_FALLOUT.png",
    categoria: "Kits",
    exigePersonalizacao: false,
    descricao: "Kit Fallout contendo: \n Action Figure do Vault Boy de aproximadamente 13cm pintado a mão \n 4 POrta-copos \n 1 Hueforge (20x20)",
  }
];

// ─── COMO ADICIONAR UM NOVO PRODUTO ───────────────────────────────────────
// Copie o bloco abaixo, cole antes do "];" e preencha os campos:
//
// {
//   id: 9,                          // próximo número disponível
//   nome: "Nome do Produto",
//   preco: 0.00,                    // valor em reais (use ponto como decimal)
//   imagem: "/produtos/foto.jpg",   // coloque a imagem em /public/produtos/
//   categoria: "Miniaturas",        // uma das 4 categorias abaixo
//   exigePersonalizacao: false,     // true = cliente precisa descrever; false = produto padrão
//   descricao: "Descrição completa do produto.",
// },
//
// CATEGORIAS VÁLIDAS: "Miniaturas" | "Personalizados" | "Sensoriais" | "Casa e Decoração"
// ─────────────────────────────────────────────────────────────────────────

export const categorias = [
  "Todos",
  "Casa e Decoração",
  "Hot Toys",
  "Kits",
  "Personalizados",
  "Sensoriais",
];
