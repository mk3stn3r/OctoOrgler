const http = require('http');
const DeconzBridge = require('../game/DeconzBridge');

describe('DeconzBridge', () => {
  test('throws without an apiKey', () => {
    expect(() => new DeconzBridge({ bulbLightIds: [1, 2] })).toThrow(/apiKey/);
  });

  test('hexToHueSat converts pure red correctly', () => {
    const bridge = new DeconzBridge({ apiKey: 'testkey', bulbLightIds: [1] });
    const { hue, sat, bri } = bridge.hexToHueSat('#ff0000');
    expect(hue).toBe(0);
    expect(sat).toBe(254);
    expect(bri).toBe(254);
  });

  test('hexToHueSat converts pure green to ~1/3 of hue wheel', () => {
    const bridge = new DeconzBridge({ apiKey: 'testkey', bulbLightIds: [1] });
    const { hue, sat } = bridge.hexToHueSat('#00ff00');
    expect(hue).toBeCloseTo(65535 / 3, -1);
    expect(sat).toBe(254);
  });

  test('hexToHueSat converts black to zero saturation/brightness floor', () => {
    const bridge = new DeconzBridge({ apiKey: 'testkey', bulbLightIds: [1] });
    const { sat, bri } = bridge.hexToHueSat('#000000');
    expect(sat).toBe(0);
    expect(bri).toBe(1);
  });

  test('setBulbColor sends PUT with on:false for #000000', async () => {
    const bridge = new DeconzBridge({ apiKey: 'testkey', bulbLightIds: [1, 2, 3] });
    const spy = jest.spyOn(bridge, '_request').mockResolvedValue({});
    await bridge.setBulbColor(1, '#000000', 150);
    expect(spy).toHaveBeenCalledWith('PUT', '/lights/2/state', expect.objectContaining({ on: false }));
  });

  test('setBulbColor sends PUT with hue/sat/bri for a color', async () => {
    const bridge = new DeconzBridge({ apiKey: 'testkey', bulbLightIds: [10, 20, 30] });
    const spy = jest.spyOn(bridge, '_request').mockResolvedValue({});
    await bridge.setBulbColor(2, '#007aff', 200);
    expect(spy).toHaveBeenCalledWith(
      'PUT',
      '/lights/30/state',
      expect.objectContaining({ on: true, hue: expect.any(Number), sat: expect.any(Number), bri: expect.any(Number) })
    );
  });

  test('checkReachable returns true when light state is returned', async () => {
    const bridge = new DeconzBridge({ apiKey: 'testkey', bulbLightIds: [1] });
    jest.spyOn(bridge, '_request').mockResolvedValue({ state: { on: true }, name: 'Bulb 1' });
    const reachable = await bridge.checkReachable();
    expect(reachable).toBe(true);
    expect(bridge.reachable).toBe(true);
  });

  test('checkReachable returns false on request failure', async () => {
    const bridge = new DeconzBridge({ apiKey: 'testkey', bulbLightIds: [1] });
    jest.spyOn(bridge, '_request').mockRejectedValue(new Error('timeout'));
    const reachable = await bridge.checkReachable();
    expect(reachable).toBe(false);
    expect(bridge.reachable).toBe(false);
  });

  test('allOff sends PUT off to every configured light', async () => {
    const bridge = new DeconzBridge({ apiKey: 'testkey', bulbLightIds: [1, 2, 3] });
    const spy = jest.spyOn(bridge, '_request').mockResolvedValue({});
    await bridge.allOff();
    expect(spy).toHaveBeenCalledTimes(3);
  });

  test('allOff does not throw if individual requests fail', async () => {
    const bridge = new DeconzBridge({ apiKey: 'testkey', bulbLightIds: [1, 2] });
    jest.spyOn(bridge, '_request').mockRejectedValue(new Error('network error'));
    await expect(bridge.allOff()).resolves.toBeUndefined();
  });
});
