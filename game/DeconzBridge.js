const http = require('http');

class DeconzBridge {
  constructor({ gatewayHost = '127.0.0.1', gatewayPort = 80, apiKey, bulbLightIds, timeoutMs = 800 }) {
    if (!apiKey) {
      throw new Error('DeconzBridge requires an apiKey. See BUILD.md for how to acquire one from the deCONZ gateway.');
    }
    this.gatewayHost = gatewayHost;
    this.gatewayPort = gatewayPort;
    this.apiKey = apiKey;
    this.bulbLightIds = bulbLightIds;
    this.timeoutMs = timeoutMs;
    this.reachable = false;
  }

  hexToHueSat(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
    }
    h = h * 60;
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : delta / max;

    const deconzHue = Math.round((h / 360) * 65535);
    const deconzSat = Math.round(s * 254);
    const bri = Math.round(max * 254);

    return { hue: deconzHue, sat: deconzSat, bri: Math.max(bri, 1) };
  }

  _request(method, path, body) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : undefined;
      const req = http.request(
        {
          host: this.gatewayHost,
          port: this.gatewayPort,
          path: `/api/${this.apiKey}${path}`,
          method,
          headers: payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {},
          timeout: this.timeoutMs,
        },
        res => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              resolve(data ? JSON.parse(data) : {});
            } catch (e) {
              resolve({});
            }
          });
        }
      );
      req.on('timeout', () => { req.destroy(new Error('deCONZ request timed out')); });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  async setBulbColor(bulbIndex, hexColor, durationMs = 150) {
    const lightId = this.bulbLightIds[bulbIndex];
    const transitiontime = Math.max(0, Math.round(durationMs / 100));

    if (hexColor === '#000000') {
      return this._request('PUT', `/lights/${lightId}/state`, { on: false, transitiontime });
    }

    const { hue, sat, bri } = this.hexToHueSat(hexColor);
    return this._request('PUT', `/lights/${lightId}/state`, {
      on: true,
      hue,
      sat,
      bri,
      transitiontime,
    });
  }

  async checkReachable() {
    try {
      const lightId = this.bulbLightIds[0];
      const result = await this._request('GET', `/lights/${lightId}`);
      this.reachable = !!(result && (result.state || result.name));
      return this.reachable;
    } catch (e) {
      this.reachable = false;
      return false;
    }
  }

  async allOff() {
    await Promise.all(
      this.bulbLightIds.map(lightId =>
        this._request('PUT', `/lights/${lightId}/state`, { on: false }).catch(() => {})
      )
    );
  }
}

module.exports = DeconzBridge;
