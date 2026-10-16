/**
 * ShopSync — Dedicated Backend API Server
 * Designed for persistent deployment on Render (Node.js Web Service)
 *
 * Responsibilities:
 * 1. Serves strictly backend API endpoints (/api/*) and health checks (/api/health)
 * 2. Shields the backend service from serving duplicate frontend HTML/React pages
 * 3. Binds to 0.0.0.0:$PORT as required by cloud container orchestrators
 * 4. Provides graceful shutdown and connection draining
 */

const http = require('http');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '10000', 10);
const host = '0.0.0.0';

const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

async function startServer() {
  try {
    console.log('[ShopSync Backend] Initializing Next.js API runtime...');
    await app.prepare();

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

      // 1. API Endpoints and Health Probes: Handled directly
      if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
        return handle(req, res);
      }

      // 2. Non-API Routes (Storefront, Admin UI, Static Pages):
      // Render must NOT serve the frontend. Frontend is hosted exclusively on Vercel.
      const frontendUrl = process.env.FRONTEND_URL;
      if (frontendUrl && url.pathname !== '/') {
        // Redirect deep frontend routes to Vercel
        const cleanFrontend = frontendUrl.replace(/\/$/, '');
        res.writeHead(302, {
          Location: `${cleanFrontend}${url.pathname}${url.search}`,
          'Cache-Control': 'no-cache',
        });
        return res.end();
      }

      // Root endpoint service descriptor
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      });
      res.end(
        JSON.stringify(
          {
            service: 'ShopSync Dedicated Backend API',
            environment: process.env.NODE_ENV || 'development',
            status: 'online',
            healthCheck: '/api/health',
            frontendUrl: frontendUrl || 'https://shopsync.vercel.app',
            notice:
              'This is the dedicated backend API service running on Render. Storefront and Admin interfaces are hosted on Vercel.',
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
    });

    server.listen(port, host, () => {
      console.log(`================================================================`);
      console.log(`🚀 SHOPSYNC DEDICATED BACKEND API SERVICE ONLINE`);
      console.log(`   Host: ${host}`);
      console.log(`   Port: ${port}`);
      console.log(`   Health: http://localhost:${port}/api/health`);
      console.log(`   Frontend Target: ${process.env.FRONTEND_URL || '(not configured)'}`);
      console.log(`================================================================`);
    });

    // Graceful Shutdown
    const shutdown = () => {
      console.log('\n[ShopSync Backend] Received shutdown signal. Draining connections...');
      server.close(() => {
        console.log('[ShopSync Backend] HTTP server closed cleanly.');
        process.exit(0);
      });
      setTimeout(() => {
        console.error('[ShopSync Backend] Forcing shutdown after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('❌ [ShopSync Backend] Fatal startup error:', err);
    process.exit(1);
  }
}

startServer();
