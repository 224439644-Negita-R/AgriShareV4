// AgriShare API server (API only; the mobile app is a separate Expo project in ../app).
// Start with `npm start`. Health check: GET /healthz (plain text) or GET /api/health (JSON).
import http from 'node:http'
import { config } from './config.mjs'
import { handleApi } from './api.mjs'
import { securityHeaders } from './security.mjs'
import { db } from './db.mjs'

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.statusCode = 200
    return res.end('ok')
  }
  if (config.prod && config.trustProxy && req.headers['x-forwarded-proto'] === 'http') {
    res.statusCode = 301
    res.setHeader('Location', config.appUrl + req.url)
    return res.end()
  }
  if (req.url.startsWith('/api')) {
    req.url = req.url.slice(4) || '/'
    return handleApi(req, res)
  }
  // Not an API call: this server has no web front end. Answer with a small JSON pointer instead of failing.
  securityHeaders(res)
  res.statusCode = req.url === '/' ? 200 : 404
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(req.url === '/' ? { service: 'AgriShare API', health: '/api/health', docs: 'see docs/API_DOCUMENTATION.md' } : { error: 'Not found' }))
})
server.requestTimeout = 30_000
server.headersTimeout = 15_000
server.listen(config.port, '0.0.0.0', () => {
  console.log(`AgriShare listening on port ${config.port} (${config.prod ? 'production' : 'development'})`)
})
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`${sig}: shutting down`)
    server.close(() => {
      try { db.close() } catch { /* already closed */ }
      process.exit(0)
    })
    setTimeout(() => process.exit(1), 10_000).unref()
  })
}
