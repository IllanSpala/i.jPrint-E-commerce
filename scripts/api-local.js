import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnv } from 'vite';

export function criarMiddlewareApiLocal({ rotas, carregar, limite = 4_500_000, log = console.error }) {
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return next();
    res.status = code => { res.statusCode = code; return res; };
    res.json = data => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); return res; };
    res.setHeader('Cache-Control', 'no-store');
    const nome = url.pathname.slice(5);
    if (!rotas.has(nome)) return res.status(404).json({ error: 'Rota de API não encontrada.' });
    try {
      req.query = Object.fromEntries(url.searchParams);
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > limite) return res.status(413).json({ error: 'Requisição muito grande.' });
        chunks.push(Buffer.from(chunk));
      }
      const text = Buffer.concat(chunks).toString('utf8');
      try { req.body = text ? JSON.parse(text) : {}; }
      catch { return res.status(400).json({ error: 'JSON inválido.' }); }
      const modulo = await carregar(nome);
      await modulo.default(req, res);
    } catch (error) {
      log('[API local]', nome, error.message);
      if (!res.headersSent) res.status(500).json({ error: 'Não foi possível executar a API local. Confira o terminal do servidor.' });
      else if (!res.writableEnded) res.end();
    }
  };
}

export function apiLocal() {
  return {
    name: 'ijprint-api-local',
    apply: 'serve',
    async configureServer(server) {
      // Variáveis privadas permanecem no processo Node; nunca são definidas no bundle.
      const env = loadEnv(server.config.mode, server.config.envDir, '');
      for (const [key, value] of Object.entries(env)) if (process.env[key] === undefined) process.env[key] = value;
      const arquivos = await readdir(join(server.config.root, 'api'));
      const rotas = new Set(arquivos.filter(file => /^[a-z0-9-]+\.js$/.test(file)).map(file => file.slice(0, -3)));
      server.middlewares.use(criarMiddlewareApiLocal({
        rotas,
        carregar: nome => server.ssrLoadModule(`/api/${nome}.js`),
      }));
    },
  };
}
