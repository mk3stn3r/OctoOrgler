const osc = require('osc');

class HueOSCBridge {
  constructor({ host = '127.0.0.1', port = 8080, bulbLightIds, timeoutMs = 800 }) {
    this.bulbLightIds = bulbLightIds;
    this.reachable = false;
    this.timeoutMs = timeoutMs;
    this.port = new osc.UDPPort({
      localAddress: '0.0.0.0',
      localPort: 57121,
      remoteAddress: host,
      remotePort: port,
    });
    this.port.open();
  }

  hexToXY(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    [r, g, b] = [r, g, b].map(c => (c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92));
    const X = r * 0.4124 + g * 0.3576 + b * 0.1805;
    const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const Z = r * 0.0193 + g * 0.1192 + b * 0.9505;
    const sum = X + Y + Z || 1;
    return [X / sum, Y / sum];
  }

  setBulbColor(bulbIndex, hexColor, durationMs = 150) {
    const lightId = this.bulbLightIds[bulbIndex];
    if (hexColor === '#000000') {
      this.port.send({ address: `/hue/light/${lightId}/on`, args: [{ type: 'i', value: 0 }, { type: 'i', value: durationMs }] });
      return;
    }
    const [x, y] = this.hexToXY(hexColor);
    this.port.send({
      address: `/hue/light/${lightId}/color`,
      args: [{ type: 'f', value: x }, { type: 'f', value: y }, { type: 'i', value: durationMs }],
    });
  }

  async checkReachable() {
    return new Promise(resolve => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) { done = true; this.reachable = false; resolve(false); }
      }, this.timeoutMs);
      this.port.send({ address: '/hue/all/on', args: [{ type: 'i', value: 1 }] });
      this.port.once('message', () => {
        if (!done) { done = true; clearTimeout(timer); this.reachable = true; resolve(true); }
      });
    });
  }

  allOff() {
    this.port.send({ address: '/hue/all/on', args: [{ type: 'i', value: 0 }] });
  }
}

module.exports = HueOSCBridge;
