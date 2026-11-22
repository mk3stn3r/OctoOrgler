const http = require('http');
const express = require('express');
const request = require('supertest');
const createDeconzProxy = require('../game/DeconzProxy');

describe('DeconzProxy', () => {
  let gateway, gatewayPort, calls, locked;

  beforeAll(done => {
    gateway = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        calls.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : undefined });
        res.setHeader('Content-Type', 'application/json');
        if (req.url.endsWith('/lights')) return res.end(JSON.stringify({ 1: { state: { on: true, reachable: true } } }));
        res.end(JSON.stringify([{ success: {} }]));
      });
    }).listen(0, () => { gatewayPort = gateway.address().port; done(); });
  });
  afterAll(done => { gateway.closeAllConnections(); gateway.close(done); });

  function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/lampctl', createDeconzProxy({
      getGateway: () => ({ host: '127.0.0.1', port: gatewayPort, apiKey: 'secretkey' }),
      isLocked: () => locked,
      timeoutMs: 2000,
    }));
    return a;
  }

  beforeEach(() => { calls = []; locked = null; });

  test('forwards GET /lights with the server-side API key', async () => {
    const res = await request(app()).get('/api/lampctl/lights');
    expect(res.status).toBe(200);
    expect(res.body['1'].state.reachable).toBe(true);
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/secretkey/lights' });
  });

  test('forwards PUT light state and group action bodies', async () => {
    await request(app()).put('/api/lampctl/lights/4/state').send({ on: false });
    await request(app()).put('/api/lampctl/groups/2/action').send({ bri: 100, transitiontime: 40 });
    expect(calls).toEqual([
      { method: 'PUT', url: '/api/secretkey/lights/4/state', body: { on: false } },
      { method: 'PUT', url: '/api/secretkey/groups/2/action', body: { bri: 100, transitiontime: 40 } },
    ]);
  });

  test('status endpoint does not reveal the API key', async () => {
    const res = await request(app()).get('/api/lampctl/status');
    expect(res.body).toEqual({ gatewayHost: '127.0.0.1', gatewayPort, locked: false, lockReason: null });
    expect(JSON.stringify(res.body)).not.toContain('secretkey');
  });

  test('refuses writes with 409 while locked, but still allows reads', async () => {
    locked = 'A game is running.';
    const put = await request(app()).put('/api/lampctl/lights/1/state').send({ on: true });
    expect(put.status).toBe(409);
    expect(put.body[0].error.description).toBe('A game is running.');
    const get = await request(app()).get('/api/lampctl/lights');
    expect(get.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  test('does not forward other paths or non-numeric ids', async () => {
    expect((await request(app()).get('/api/lampctl/config')).status).toBe(404);
    expect((await request(app()).put('/api/lampctl/lights/..%2Fconfig/state').send({ on: true })).status).toBe(404);
    expect((await request(app()).delete('/api/lampctl/lights/1')).status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  test('reports an unreachable gateway as 504', async () => {
    const a = express();
    a.use('/api/lampctl', createDeconzProxy({ getGateway: () => ({ host: '127.0.0.1', port: 1, apiKey: 'k' }), timeoutMs: 500 }));
    const res = await request(a).get('/api/lampctl/lights');
    expect(res.status).toBe(504);
  });
});
