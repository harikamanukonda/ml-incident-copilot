import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chat} from './src/copilot.mjs';
import {catalog} from './src/scenarios.mjs';
import {interpretWithOllama} from './src/llm.mjs';
const root = new URL('./', import.meta.url);
export function makeServer({model = process.env.OLLAMA_MODEL, baseURL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'} = {}) {
  return createServer(async (req, res) => {
    const json = (status, value) => {res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(value));};
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return json(403, {error: 'Cross-origin requests are not accepted'});
    if (req.method === 'GET' && path === '/api/config') return json(200, {model: model || null, incidents: catalog});
    if (req.method === 'GET' && path === '/health') return json(200, {status: 'ok'});
    if (req.method === 'POST' && path === '/api/chat') {
      let body = '';
      try {
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 150000) return json(413, {error: 'Request too large'});
        }
        let input;
        try {input = JSON.parse(body);} catch {return json(400, {error: 'Expected valid JSON'});}
        if (!input || Array.isArray(input) || typeof input !== 'object') return json(400, {error: 'Expected a JSON object'});
        let result;
        try {result = chat(input);} catch (error) {return json(400, {error: error.message});}
        if (input.mode === 'ollama') {
          if (!model) return json(503, {error: 'No local model configured. Use evidence mode or set OLLAMA_MODEL.'});
          try {
            result.interpretation = await interpretWithOllama({result, message: input.message, history: input.history, model, baseURL});
            result.mode = 'ollama';
          } catch {return json(502, {error: 'Local model unavailable or invalid response. Your evidence remains available in evidence mode.'});}
        }
        return json(200, result);
      } catch {return json(400, {error: 'Could not read request'});}
    }
    const allowed = ['web/app.mjs', 'web/style.css', 'src/copilot.mjs', 'src/scenarios.mjs', 'src/metrics.mjs', 'src/tools.mjs'];
    const file = path === '/' || path === '/index.html' ? 'web/index.html' : path.slice(1);
    if (req.method !== 'GET' || (file !== 'web/index.html' && !allowed.includes(file))) return json(404, {error: 'Not found'});
    try {
      const data = await readFile(new URL(file, root));
      res.writeHead(200, {'Content-Type': file.endsWith('.mjs') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
      res.end(data);
    } catch {json(404, {error: 'Not found'});}
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 8011);
  const host = process.env.HOST || '127.0.0.1';
  const server = makeServer();
  server.requestTimeout = 100000; server.headersTimeout = 10000;
  server.listen(port, host, () => console.log(`ML Incident Copilot: http://${host}:${port}`));
}
