import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const scrapePlugin = (): Plugin => ({
  name: 'scrape-proxy',
  configureServer(server) {
    server.middlewares.use('/api/scrape', async (req, res) => {
      try {
        const urlObj = new URL(req.url || '', 'http://localhost:3000');
        const target = urlObj.searchParams.get('url');
        if (!target) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing url query parameter' }));
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(target, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        clearTimeout(timeout);

        const html = await response.text();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(html);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  },
});

export default defineConfig({
  plugins: [react(), scrapePlugin()],
  server: {
    port: 3000,
    host: true,
  },
});
