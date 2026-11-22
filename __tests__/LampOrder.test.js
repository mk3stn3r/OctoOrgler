const express = require('express');
const request = require('supertest');
const createLampOrderRouter = require('../game/LampOrder');

function fakeSettings(order = [1, 2, 3, 4, 5, 6, 7, 8]) {
  const live = { deconz: { bulbLightIds: order }, gameplay: { totalBulbs: 8 } };
  return { live, getLive: () => live, updateNow: jest.fn((path, value) => { live[path[0]][path[1]] = value; }) };
}

function app(settings, opts = {}) {
  const a = express();
  a.use('/api/lamp-order', createLampOrderRouter({ settings, ...opts }));
  return a;
}

describe('LampOrder router', () => {
  test('GET returns the saved order', async () => {
    const res = await request(app(fakeSettings([2, 3, 5, 4, 1, 8, 6, 7]))).get('/api/lamp-order');
    expect(res.body).toEqual({ order: [2, 3, 5, 4, 1, 8, 6, 7], totalBulbs: 8 });
  });

  test('PUT saves a valid order immediately and notifies', async () => {
    const settings = fakeSettings();
    const onChange = jest.fn();
    const res = await request(app(settings, { onChange })).put('/api/lamp-order').send({ order: [12, 9, 14, 10, 11, 15, 13, 16] });
    expect(res.status).toBe(200);
    expect(settings.updateNow).toHaveBeenCalledWith(['deconz', 'bulbLightIds'], [12, 9, 14, 10, 11, 15, 13, 16]);
    expect(onChange).toHaveBeenCalledWith([12, 9, 14, 10, 11, 15, 13, 16]);
  });

  test.each([
    [[1, 2, 3], /exactly 8/],
    [[1, 2, 3, 4, 5, 6, 7, 7], /only once/],
    [[1, 2, 3, 4, 5, 6, 7, 0], /whole numbers/],
    [[1, 2, 3, 4, 5, 6, 7, '8'], /whole numbers/],
  ])('PUT rejects %j', async (order, message) => {
    const settings = fakeSettings();
    const res = await request(app(settings)).put('/api/lamp-order').send({ order });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(settings.updateNow).not.toHaveBeenCalled();
  });

  test('PUT is refused while locked', async () => {
    const settings = fakeSettings();
    const res = await request(app(settings, { isLocked: () => 'A game is running.' })).put('/api/lamp-order').send({ order: [1, 2, 3, 4, 5, 6, 7, 8] });
    expect(res.status).toBe(409);
    expect(settings.updateNow).not.toHaveBeenCalled();
  });
});
