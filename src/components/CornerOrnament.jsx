/**
 * CornerOrnament — espinho metálico SVG para decoração de cantos.
 * Inspirado nos ramos espinhosos da logo IJ Print.
 *
 * Props:
 *  position: "top-left" | "top-right" | "bottom-left" | "bottom-right"
 *  size: largura/altura em px (default 220)
 *  opacity: opacidade (default 0.18)
 *  className: classes extras
 */
export default function CornerOrnament({
  position = "top-left",
  size = 220,
  opacity = 0.18,
  className = "",
}) {
  const transforms = {
    "top-left":     "scale(1, 1)",
    "top-right":    "scale(-1, 1)",
    "bottom-left":  "scale(1, -1)",
    "bottom-right": "scale(-1, -1)",
  };

  const positionClasses = {
    "top-left":     "top-0 left-0",
    "top-right":    "top-0 right-0",
    "bottom-left":  "bottom-0 left-0",
    "bottom-right": "bottom-0 right-0",
  };

  return (
    <div
      className={`pointer-events-none fixed z-10 ${positionClasses[position]} ${className}`}
      style={{ width: size, height: size, opacity }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 220 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: transforms[position], transformOrigin: "50% 50%", width: "100%", height: "100%" }}
      >
        <defs>
          {/* Gradiente metálico prata */}
          <linearGradient id={`metal-${position}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#E8EAEE" />
            <stop offset="30%"  stopColor="#B8BEC8" />
            <stop offset="60%"  stopColor="#8E97A6" />
            <stop offset="100%" stopColor="#C8D0DC" />
          </linearGradient>
          <filter id={`glow-${position}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ramo principal diagonal */}
        <path
          d="M 5 5 C 15 30, 30 50, 60 90 C 80 115, 110 145, 140 180"
          stroke={`url(#metal-${position})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          filter={`url(#glow-${position})`}
        />

        {/* Espinho 1 — grande, apontando para fora */}
        <path
          d="M 22 42 L 5 18 L 32 30 Z"
          fill={`url(#metal-${position})`}
          filter={`url(#glow-${position})`}
        />

        {/* Espinho 2 */}
        <path
          d="M 45 72 L 20 48 L 55 58 Z"
          fill={`url(#metal-${position})`}
          filter={`url(#glow-${position})`}
        />

        {/* Espinho 3 */}
        <path
          d="M 68 100 L 38 80 L 75 88 Z"
          fill={`url(#metal-${position})`}
          filter={`url(#glow-${position})`}
        />

        {/* Espinho 4 — menor, interno */}
        <path
          d="M 55 78 L 72 58 L 68 82 Z"
          fill={`url(#metal-${position})`}
          opacity="0.7"
        />

        {/* Espinho 5 */}
        <path
          d="M 95 130 L 65 110 L 102 118 Z"
          fill={`url(#metal-${position})`}
          filter={`url(#glow-${position})`}
        />

        {/* Espinho 6 — topo (aponta para cima) */}
        <path
          d="M 30 55 L 18 28 L 40 42 Z"
          fill={`url(#metal-${position})`}
          opacity="0.6"
        />

        {/* Ramo secundário curvo */}
        <path
          d="M 15 5 C 20 25, 40 40, 70 75"
          stroke={`url(#metal-${position})`}
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />

        {/* Espinho fino no ramo secundário */}
        <path
          d="M 30 30 L 10 12 L 38 22 Z"
          fill={`url(#metal-${position})`}
          opacity="0.5"
        />

        {/* Ponta vertical saindo do canto */}
        <path
          d="M 5 5 L 2 -10 L 8 5 Z"
          fill={`url(#metal-${position})`}
          opacity="0.4"
        />

        {/* Ponta horizontal saindo do canto */}
        <path
          d="M 5 5 L -10 2 L 5 8 Z"
          fill={`url(#metal-${position})`}
          opacity="0.4"
        />

        {/* Espinho final menor */}
        <path
          d="M 120 158 L 95 140 L 126 148 Z"
          fill={`url(#metal-${position})`}
          opacity="0.55"
        />
      </svg>
    </div>
  );
}
