import { useRef } from "react";
import { Rotate3D, Move, ZoomIn } from "lucide-react";

// Ambiente compartilhado pelos personalizadores paramétricos e HueForge.
export default function ViewportPersonalizacao({ children, ferramenta = "rotacionar", panCamera, setPanCamera, pov, setPov, posicao = { x: 0, y: 0 }, setPosicao, modelo3d = true }) {
  const drag = useRef(null);
  return (
            <main className={`order-1 md:order-2 relative min-h-0 min-w-0 overflow-hidden select-none touch-none ${ferramenta === "rotacionar" ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
              onPointerDown={(event) => {
                const pan = event.shiftKey || event.button === 1;
                if (!pan && ferramenta !== "rotacionar") return;
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                drag.current = { tipo: pan ? "camera" : "rotacionar", clientX: event.clientX, clientY: event.clientY, x: pan ? panCamera.x : pov.x, y: pan ? panCamera.y : pov.y, width: rect.width, height: rect.height };
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!drag.current) return;
                if (drag.current.tipo === "camera") {
                  setPanCamera({ x: drag.current.x + (event.clientX - drag.current.clientX) / drag.current.width, y: drag.current.y + (event.clientY - drag.current.clientY) / drag.current.height });
                } else if (drag.current.tipo === "rotacionar") {
                  setPov({ x: Math.max(-75, Math.min(75, drag.current.x - (event.clientY - drag.current.clientY) * .45)), y: drag.current.y + (event.clientX - drag.current.clientX) * .55 });
                } else {
                  setPosicao({ x: drag.current.x + event.clientX - drag.current.clientX, y: drag.current.y + event.clientY - drag.current.clientY });
                }
              }}
              onPointerCancel={() => { drag.current = null; }}
              onLostPointerCapture={() => { drag.current = null; }}
              onPointerUp={(event) => { drag.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); }}>
              {children}
              {modelo3d && <div className="absolute right-4 top-28 w-[120px] grid grid-cols-3 gap-2" onPointerDown={(event) => event.stopPropagation()}>
                {[["X", 35, 48], ["Y", 35, 138], ["Z", -55, -42]].map(([eixo, px, py]) => <button key={eixo} aria-label={`Vista ${eixo}`} className="rounded bg-zinc-900 border border-zinc-700 py-2 text-sm text-zinc-200" onClick={() => setPov({ x: px, y: py })}>{eixo}</button>)}
              </div>}
              <button aria-label="Arrastar gravura" className={`absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 w-52 h-28 md:w-64 md:h-32 cursor-move ${ferramenta === "mover" ? "pointer-events-auto" : "pointer-events-none"}`} onPointerDown={(event) => { if (event.shiftKey || event.button === 1) return; event.stopPropagation(); drag.current = { tipo: "mover", clientX: event.clientX, clientY: event.clientY, ...posicao }; event.currentTarget.parentElement.setPointerCapture?.(event.pointerId); }}/>
              <div className="absolute left-4 bottom-4 flex gap-2 text-[11px] text-zinc-400"><span className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-950/80">{ferramenta === "rotacionar" ? <Rotate3D size={12}/> : <Move size={12}/>} Arrastar para {ferramenta === "rotacionar" ? "girar" : "mover"}</span><span className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-950/80"><ZoomIn size={12}/> Controle lateral</span></div>
              {!modelo3d && <div className="absolute right-6 top-7 w-24 h-28 flex flex-col items-center pointer-events-none">
                <div className="relative w-14 h-14" style={{ perspective: "220px" }}>
                  <div className="absolute inset-0 transition-transform duration-100" style={{ transform: `rotateX(${-pov.x}deg) rotateY(${-pov.y}deg)`, transformStyle: "preserve-3d" }}>
                    {[
                      ["Z", "translateZ(28px)", "bg-sand-400/90 text-zinc-950"],
                      ["Z", "rotateY(180deg) translateZ(28px)", "bg-zinc-700/90 text-zinc-200"],
                      ["X", "rotateY(90deg) translateZ(28px)", "bg-red-500/90 text-white"],
                      ["X", "rotateY(-90deg) translateZ(28px)", "bg-red-900/90 text-red-100"],
                      ["Y", "rotateX(90deg) translateZ(28px)", "bg-emerald-500/90 text-zinc-950"],
                      ["Y", "rotateX(-90deg) translateZ(28px)", "bg-emerald-900/90 text-emerald-100"],
                    ].map(([eixo, transform, cores], index) => <div key={index} className={`absolute inset-0 grid place-items-center border border-white/25 text-xs font-black ${cores}`} style={{ transform, backfaceVisibility: "hidden" }}>{eixo}</div>)}
                  </div>
                </div>
                <span className="mt-5 text-[10px] tracking-widest text-zinc-500">X · Y · Z</span>
              </div>}
            </main>
  );
}
