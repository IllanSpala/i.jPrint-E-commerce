// ─────────────────────────────────────────────────────────────────────────────
// analytics.js — Carrega GA4 e Meta Pixel SOMENTE após consentimento do usuário
// ─────────────────────────────────────────────────────────────────────────────

const GA4_ID = "G-CSQZGQQNPZ";
const META_PIXEL_ID = "1585971716420476";

const STORAGE_KEY = "@ijprint:cookie_consent";

// ── GA4 ──────────────────────────────────────────────────────────────────────
function carregarGA4() {
  if (document.getElementById("ga4-script")) return; // Evita duplicar

  const script1 = document.createElement("script");
  script1.id = "ga4-script";
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(script1);

  const script2 = document.createElement("script");
  script2.id = "ga4-config";
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA4_ID}', { anonymize_ip: true });
  `;
  document.head.appendChild(script2);
  console.log("[Analytics] GA4 carregado ✅");
}

// ── META PIXEL ────────────────────────────────────────────────────────────────
function carregarMetaPixel() {
  if (!META_PIXEL_ID) return; // Aguardando o ID
  if (document.getElementById("meta-pixel-script")) return; // Evita duplicar

  const script = document.createElement("script");
  script.id = "meta-pixel-script";
  script.innerHTML = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${META_PIXEL_ID}');
    fbq('track', 'PageView');
  `;
  document.head.appendChild(script);

  // Noscript fallback
  const noscript = document.createElement("noscript");
  const img = document.createElement("img");
  img.height = 1;
  img.width = 1;
  img.style.display = "none";
  img.src = `https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`;
  noscript.appendChild(img);
  document.body.appendChild(noscript);
  console.log("[Analytics] Meta Pixel carregado ✅");
}

// ── Inicializador ─────────────────────────────────────────────────────────────
// Chame essa função após o usuário aceitar os cookies analíticos
export function iniciarAnalytics() {
  carregarGA4();
  carregarMetaPixel();
}

// ── Verificar e iniciar automaticamente se já consentiu ──────────────────────
// Chame isso no App.jsx ao montar a aplicação para quem já aceitou anteriormente
export function verificarConsentimentoSalvo() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (!salvo) return;
    const { aceito } = JSON.parse(salvo);
    if (aceito) {
      iniciarAnalytics();
    }
  } catch {
    // localStorage indisponível ou JSON inválido
  }
}

// ── Eventos personalizados ────────────────────────────────────────────────────
export function trackEvent(eventName, params = {}) {
  // GA4
  if (window.gtag) {
    window.gtag("event", eventName, params);
  }
  // Meta Pixel
  if (window.fbq && META_PIXEL_ID) {
    window.fbq("track", eventName, params);
  }
}

// Evento de compra — chame quando pedido for confirmado
export function trackPurchase({ valor, pedidoId, itens = [] }) {
  if (window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: pedidoId,
      value: valor,
      currency: "BRL",
      items: itens.map((i) => ({
        item_id: String(i.id),
        item_name: i.nome,
        price: i.preco,
        quantity: i.quantidade || 1,
      })),
    });
  }
  if (window.fbq && META_PIXEL_ID) {
    window.fbq("track", "Purchase", { value: valor, currency: "BRL" });
  }
}
