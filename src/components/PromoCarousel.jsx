import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

// Padrão das artes: 1920 × 384 px (5:1). Reserve os 60% centrais ao conteúdo.
const slides = [
  /* {
    id: 0,
    image: "/banners/banner-teste.svg",
    mobileImage: null,
    alt: "Banner teste I.J Print - 1920 por 384 pixels",
    href: null,
  }, */
  {
    id: 1,
    image: "/banners/banner_cliente_novo.png",
    mobileImage: null,
    alt: "10% de desconto na primeira compra com o cupom COMPRE.IJ",
    href: null,
  },
  {
    id: 2,
    image: "/banners/banner_envio.png",
    mobileImage: null,
    alt: "Envios para todo Brasil - Parcelamento em ate 12x",
    href: null,
  },
];

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sand-400";

export default function PromoCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const hasMultipleSlides = slides.length > 1;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event) => setReducedMotion(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!hasMultipleSlides || hovered || focused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hasMultipleSlides, hovered, focused, reducedMotion]);

  function navigate(offset) {
    setActiveIndex((index) => (index + offset + slides.length) % slides.length);
  }

  return (
    <div
      role="region"
      aria-label="Banners promocionais"
      aria-roledescription={hasMultipleSlides ? "carrossel" : undefined}
      className="relative h-[110px] w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 sm:h-[135px] md:h-auto md:aspect-[5/1]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      {slides.map((slide, index) => {
        const isActive = index === activeIndex;
        const image = (
          <picture className="block h-full w-full">
            {slide.mobileImage && <source media="(max-width: 767px)" srcSet={slide.mobileImage} />}
            <img
              src={slide.image}
              alt={slide.alt}
              width="1920"
              height="384"
              loading={index === 0 ? "eager" : "lazy"}
              fetchpriority={index === 0 ? "high" : "auto"}
              className="h-full w-full object-cover object-center"
            />
          </picture>
        );
        const linkClass = `block h-full w-full ${focusClass}`;

        return (
          <div
            key={slide.id}
            role="group"
            aria-roledescription={hasMultipleSlides ? "slide" : undefined}
            aria-label={hasMultipleSlides ? `${index + 1} de ${slides.length}` : undefined}
            aria-hidden={!isActive}
            className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${isActive ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            {slide.href ? (
              /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(slide.href) ? (
                <a href={slide.href} tabIndex={isActive ? 0 : -1} className={linkClass}>{image}</a>
              ) : (
                <Link to={slide.href} tabIndex={isActive ? 0 : -1} className={linkClass}>{image}</Link>
              )
            ) : image}
          </div>
        );
      })}

      {hasMultipleSlides && (
        <>
          <button
            type="button"
            aria-label="Slide anterior"
            onClick={() => navigate(-1)}
            className={`absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-950/50 text-zinc-300 backdrop-blur-sm hover:bg-zinc-950/70 hover:text-sand-400 md:left-3 md:h-10 md:w-10 ${focusClass}`}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Próximo slide"
            onClick={() => navigate(1)}
            className={`absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-950/50 text-zinc-300 backdrop-blur-sm hover:bg-zinc-950/70 hover:text-sand-400 md:right-3 md:h-10 md:w-10 ${focusClass}`}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 md:bottom-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Ir para o slide ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => setActiveIndex(index)}
                className={`flex h-6 w-6 items-center justify-center rounded-full ${focusClass}`}
              >
                <span className={`h-1.5 rounded-full ${index === activeIndex ? "w-4 bg-sand-400" : "w-1.5 bg-white/30"}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
