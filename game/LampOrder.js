const express = require('express');

/**
 * Saved lamp order: the deCONZ light IDs of the bulbs clockwise, starting at the top bulb
 * (the same positions as bulb-0 … bulb-7 in public/assets/sputnik_lamp.svg).
 *
 * Stored as settings.deconz.bulbLightIds, so the game maps its bulb positions to the right
 * physical lamps, and the lamp control panel uses it as "Lamp order" for chases.
 *
 *   GET /api/lamp-order  -> { order: [..], totalBulbs }
 *   PUT /api/lamp-order  { order: [..] } -> { ok: true, order }
 *
 * @param {object}   options
 * @param {object}   options.settings   SettingsManager (getLive, updateNow)
 * @param {Function} [options.onChange] (order) => void, e.g. to update the running DeconzBridge
 * @param {Function} [options.isLocked] () => string|null; a non-empty string refuses changes
 */
function createLampOrderRouter({ settings, onChange = () => {}, isLocked = () => null }) {
  const router = express.Router();
  router.use(express.json({ limit: '2kb' }));

  const totalBulbs = () => (settings.getLive().gameplay || {}).totalBulbs || 8;

  router.get('/', (req, res) => {
    const order = ((settings.getLive().deconz || {}).bulbLightIds || []).map(Number);
    res.json({ order, totalBulbs: totalBulbs() });
  });

  router.put('/', (req, res) => {
    const reason = isLocked();
    if (reason) return res.status(409).json({ ok: false, error: reason });
    const order = req.body && req.body.order;
    const count = totalBulbs();
    if (!Array.isArray(order) || order.length !== count) {
      return res.status(400).json({ ok: false, error: `order must list exactly ${count} light IDs` });
    }
    if (!order.every(id => Number.isInteger(id) && id >= 1 && id <= 65535)) {
      return res.status(400).json({ ok: false, error: 'light IDs must be whole numbers from 1 to 65535' });
    }
    if (new Set(order).size !== order.length) {
      return res.status(400).json({ ok: false, error: 'each light ID may appear only once' });
    }
    settings.updateNow(['deconz', 'bulbLightIds'], order);
    onChange(order);
    res.json({ ok: true, order });
  });

  return router;
}

module.exports = createLampOrderRouter;
