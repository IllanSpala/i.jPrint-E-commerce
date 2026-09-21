// A sincronização do catálogo é uma operação local explícita, nunca pública.
export default function handler(req, res) {
  return res.status(410).json({ error: 'Endpoint de sincronização desativado.' });
}
