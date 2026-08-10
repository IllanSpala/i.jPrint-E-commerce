import { useState, useEffect } from "react";

export default function ContagemRegressiva({ dataCriacao, onExpirar }) {
  const [tempoRestante, setTempoRestante] = useState("");

  useEffect(() => {
    // 15 minutos a partir da data informada
    const dataFim = new Date(dataCriacao).getTime() + 15 * 60 * 1000;
    
    // Atualização imediata antes do intervalo
    const update = () => {
      const agora = new Date().getTime();
      const diff = dataFim - agora;
      if (diff <= 0) {
        if (tempoRestante !== "") setTempoRestante("");
        onExpirar();
      } else {
        const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((diff % (1000 * 60)) / 1000);
        setTempoRestante(`${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`);
      }
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [dataCriacao, onExpirar]);

  if (!tempoRestante) return <span className="animate-pulse">Expirando...</span>;
  return <span>Expira em: {tempoRestante}</span>;
}
