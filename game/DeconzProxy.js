const http = require('http');
const express = require('express');

/**
 * Narrow server-side proxy to the deCONZ REST API for the lamp control panel (/control/).
 *
 * The browser talks to /api/lampctl/... on the OctoOrgler server, which forwards the call to the
 * gateway with the configured API key. The key never reaches the browser and deCONZ needs no CORS setup.
 *
 * Only what the control panel needs is forwarded:
 *   GET /lights               GET /groups
 *   PUT /lights/:id/state     PUT /groups/:id/action
 *
 * @param {object}   options
 * @param {Function} options.getGateway  () => ({ host, port, apiKey }), read on every request so admin changes apply
 * @param {Function} [options.isLocked]  () => string|null; a non-empty string blocks writes (e.g. while a game runs)
 * @param {number}   [options.timeoutMs] gateway request timeout
 */
function createDeconzProxy({ getGateway, isLocked = () => null, timeoutMs = 8000 }) {
  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));

  function forward(method, path, body, res) {
    const { host, port, apiKey } = getGateway();
    if (!host || !apiKey) {
      return res.status(503).json([{ error: { type: 950, description: 'deCONZ gateway is not configured on the OctoOrgler server' } }]);
    }
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host,
        port,
        path: `/api/${encodeURIComponent(apiKey)}${path}`,
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
        timeout: timeoutMs,
      },
      upstream => {
        let data = '';
        upstream.setEncoding('utf8');
        upstream.on('data', chunk => { data += chunk; });
        upstream.on('end', () => {
          let parsed;
          try { parsed = data ? JSON.parse(data) : {}; } catch (e) { parsed = [{ error: { type: 901, description: 'Invalid JSON from deCONZ gateway' } }]; }
          res.status(upstream.statusCode || 502).json(parsed);
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('deCONZ request timed out')));
    req.on('error', err => {
      if (!res.headersSent) res.status(504).json([{ error: { type: 950, description: `deCONZ gateway not reachable: ${err.message}` } }]);
    });
    if (payload) req.write(payload);
    req.end();
  }

  function writeGuard(req, res, next) {
    const reason = isLocked();
    if (reason) return res.status(409).json([{ error: { type: 409, description: reason } }]);
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json([{ error: { type: 2, description: 'Body must be a JSON object' } }]);
    }
    next();
  }

  router.get('/status', (req, res) => {
    const { host, port } = getGateway();
    const locked = isLocked();
    res.json({ gatewayHost: host, gatewayPort: port, locked: !!locked, lockReason: locked || null });
  });
  router.get('/lights', (req, res) => forward('GET', '/lights', undefined, res));
  router.get('/groups', (req, res) => forward('GET', '/groups', undefined, res));
  router.put('/lights/:id(\\d+)/state', writeGuard, (req, res) => forward('PUT', `/lights/${req.params.id}/state`, req.body, res));
  router.put('/groups/:id(\\d+)/action', writeGuard, (req, res) => forward('PUT', `/groups/${req.params.id}/action`, req.body, res));
  router.use((req, res) => res.status(404).json([{ error: { type: 3, description: 'Not available through the lamp control proxy' } }]));

  return router;
}

module.exports = createDeconzProxy;
