// Identify routine for the lamp view (lamp.html).
// Switches the OctoOrgler lamps on one at a time and shows each lamp's deCONZ ID. The user types that ID
// into the field on the bulb where they see it light up (or taps that bulb in the drawing). The result,
// clockwise from the top bulb, is saved as the lamp order used by the game and by Lamp control chases.
(function () {
  const POSITIONS = 8;
  const LAMP_API = '/api/lampctl';
  const ON_STATE = { on: true, bri: 254, ct: 250, transitiontime: 0 };
  const OFF_STATE = { on: false, transitiontime: 0 };

  const css = `
  #identifyBar{padding:10px 16px 16px;display:flex;flex-direction:column;align-items:center;gap:10px}
  #identifyBar button{min-height:42px;padding:8px 16px;border:1px solid #333;border-radius:8px;background:#222;color:#eee;font:inherit;cursor:pointer}
  #identifyBar button:hover:not(:disabled){background:#2c2c2c}
  #identifyBar button:disabled{opacity:.45;cursor:default}
  #identifyBar button.primary{background:#0d3d17;border-color:#00ff41;color:#d9ffe2}
  #identifyStart{border-color:#00ff41!important}
  #identifyPanel{display:none;flex-direction:column;align-items:center;gap:10px;width:min(100%,640px)}
  #identifyPanel.open{display:flex}
  #identifyNow{font-family:'Courier New',monospace;font-size:2.2em;color:#00ff41;text-shadow:0 0 8px #00ff41;letter-spacing:2px;text-align:center}
  #identifyNow small{display:block;font-size:.4em;color:#aaa;text-shadow:none;letter-spacing:0;font-family:sans-serif}
  .identify-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center}
  .identify-row label{color:#aaa;font-size:.9em;display:flex;gap:6px;align-items:center}
  .identify-row input{width:64px;min-height:36px;border:1px solid #333;border-radius:6px;background:#111;color:#eee;padding:4px 8px;font:inherit}
  #identifyStatus{min-height:1.3em;color:#aaa;text-align:center;font-size:.95em}
  #identifyStatus.error{color:#ff8a8a}#identifyStatus.ok{color:#8dffad}
  #identifyFields{position:absolute;inset:0;pointer-events:none}
  #identifyFields .id-field{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:auto}
  #identifyFields .id-field span{font-size:11px;color:#222;background:rgba(255,255,255,.75);border-radius:3px;padding:0 4px}
  #identifyFields input{width:52px;height:34px;text-align:center;font-size:18px;font-weight:bold;border:2px solid #444;border-radius:6px;background:rgba(10,10,10,.85);color:#fff}
  #identifyFields input.invalid{border-color:#ff3b30}
  #identifyFields input.lit{border-color:#00ff41;box-shadow:0 0 10px #00ff41}
  .identify-tap{cursor:pointer}`;

  const state = {
    open: false, members: [], groupId: null, index: 0, current: null,
    paused: false, timer: null, busy: false, saved: [],
  };
  let ui = {};

  function el(tag, attrs = {}, text) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    return { status: res.status, ok: res.ok, data };
  }

  function errorText(data) {
    if (Array.isArray(data)) { const e = data.find(x => x && x.error); if (e) return e.error.description || JSON.stringify(e.error); }
    return data && data.error ? data.error : '';
  }

  function setStatus(text, kind = '') {
    ui.status.textContent = text;
    ui.status.className = kind;
  }

  async function setLamp(id, lampState) {
    const r = await api('PUT', `${LAMP_API}/lights/${id}/state`, lampState);
    if (r.status === 409) throw new Error(errorText(r.data));
    const failed = Array.isArray(r.data) && r.data.some(x => x && x.error);
    return r.ok && !failed;
  }

  async function loadMembers() {
    const groups = await api('GET', `${LAMP_API}/groups`);
    if (!groups.ok) throw new Error(errorText(groups.data) || `deCONZ not reachable (HTTP ${groups.status})`);
    const match = Object.entries(groups.data || {}).find(([, g]) => g && g.name === 'OctoOrgler');
    if (match && Array.isArray(match[1].lights) && match[1].lights.length) {
      state.groupId = match[0];
      return match[1].lights.map(Number).sort((a, b) => a - b);
    }
    state.groupId = null;
    const lights = await api('GET', `${LAMP_API}/lights`);
    if (!lights.ok) throw new Error(errorText(lights.data) || `deCONZ not reachable (HTTP ${lights.status})`);
    return Object.keys(lights.data || {}).map(Number).sort((a, b) => a - b);
  }

  async function allOff() {
    if (state.groupId) {
      const r = await api('PUT', `${LAMP_API}/groups/${state.groupId}/action`, { on: false });
      if (r.status === 409) throw new Error(errorText(r.data));
    } else {
      for (const id of state.members) await setLamp(id, OFF_STATE);
    }
  }

  // ---- per-bulb input fields over the drawing -------------------------------------------------
  function buildFields() {
    const area = document.getElementById('lampArea');
    ui.fields = el('div', { id: 'identifyFields' });
    ui.inputs = [];
    for (let i = 0; i < POSITIONS; i++) {
      const wrap = el('div', { class: 'id-field' });
      const input = el('input', { type: 'text', inputmode: 'numeric', maxlength: '5', 'aria-label': `Light ID at position ${i + 1} (clockwise from top)` });
      input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); validate(); });
      wrap.append(el('span', {}, `Pos ${i + 1}`), input);
      ui.fields.appendChild(wrap);
      ui.inputs.push(input);
    }
    area.appendChild(ui.fields);
    layoutFields();
  }

  function layoutFields() {
    if (!ui.fields) return;
    const area = document.getElementById('lampArea').getBoundingClientRect();
    const bulbs = window.lampBulbElements || [];
    const centers = bulbs.map(b => {
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.left - area.left + r.width / 2, y: r.top - area.top + r.height / 2, size: r.width };
    });
    const known = centers.filter(Boolean);
    if (!known.length) return;
    const mid = { x: known.reduce((s, c) => s + c.x, 0) / known.length, y: known.reduce((s, c) => s + c.y, 0) / known.length };
    // Place the fields on one even ring around the lamp, each in the direction of its bulb,
    // so they stay readable even though the drawn bulbs overlap.
    const avgSize = known.reduce((s, c) => s + c.size, 0) / known.length;
    const maxDist = Math.max(...known.map(c => Math.hypot(c.x - mid.x, c.y - mid.y)));
    const box = ui.fields.getBoundingClientRect();
    const ring = Math.min(maxDist + avgSize * 0.75, mid.y - 30, box.height - mid.y - 30, mid.x - 40, box.width - mid.x - 40);
    ui.fields.childNodes.forEach((wrap, i) => {
      const c = centers[i];
      if (!c) return;
      const dx = c.x - mid.x, dy = c.y - mid.y, dist = Math.hypot(dx, dy) || 1;
      wrap.style.left = `${mid.x + (dx / dist) * ring}px`;
      wrap.style.top = `${mid.y + (dy / dist) * ring}px`;
    });
  }

  // Tapping a bulb in the drawing puts the currently lit lamp's ID there and moves on.
  function enableBulbTaps() {
    (window.lampBulbElements || []).forEach((bulb, i) => {
      if (!bulb || bulb.dataset.identifyTap) return;
      bulb.dataset.identifyTap = '1';
      bulb.classList.add('identify-tap');
      bulb.addEventListener('click', () => {
        if (!state.open || state.current == null) return;
        ui.inputs.forEach(inp => { if (inp.value === String(state.current)) inp.value = ''; });
        ui.inputs[i].value = String(state.current);
        validate();
        if (!state.paused) step(1);
      });
    });
  }

  function readOrder() { return ui.inputs.map(inp => (inp.value ? Number(inp.value) : null)); }

  function validate() {
    const order = readOrder();
    const known = new Set(state.members);
    const counts = new Map();
    order.forEach(id => { if (id != null) counts.set(id, (counts.get(id) || 0) + 1); });
    let allValid = true;
    ui.inputs.forEach((inp, i) => {
      const id = order[i];
      const bad = id != null && ((known.size && !known.has(id)) || counts.get(id) > 1);
      inp.classList.toggle('invalid', bad);
      inp.classList.toggle('lit', id != null && id === state.current);
      if (id == null || bad) allValid = false;
    });
    const missing = state.members.filter(id => !counts.has(id));
    ui.save.disabled = !allValid || order.length !== POSITIONS;
    ui.missing.textContent = state.members.length
      ? (missing.length ? `Not placed yet: ${missing.join(', ')}` : 'All lamps placed.')
      : '';
    if (state.members.length && state.members.length !== POSITIONS) {
      ui.missing.textContent += ` (deCONZ lists ${state.members.length} lamps, the lamp has ${POSITIONS} positions)`;
    }
    return allValid;
  }

  // ---- identify cycle ------------------------------------------------------------------------
  function stepMs() {
    const s = Math.max(1, Math.min(30, Number(ui.seconds.value) || 3));
    ui.seconds.value = s;
    return s * 1000;
  }

  function schedule() {
    clearTimeout(state.timer);
    if (state.open && !state.paused) state.timer = setTimeout(() => step(1), stepMs());
  }

  async function show(index) {
    if (!state.members.length) return;
    state.index = (index + state.members.length) % state.members.length;
    const id = state.members[state.index];
    const previous = state.current;
    state.current = id;
    ui.now.innerHTML = '';
    ui.now.append(`Lamp ID ${id}`, el('small', {}, `${state.index + 1} of ${state.members.length} · type ${id} into the bulb that is lit, or tap that bulb`));
    validate();
    state.busy = true;
    try {
      if (previous != null && previous !== id) await setLamp(previous, OFF_STATE);
      const ok = await setLamp(id, ON_STATE);
      if (state.current === id) setStatus(ok ? '' : `Lamp ${id} did not respond (it may be unreachable). Skip it or try again later.`, ok ? '' : 'error');
    } catch (e) {
      setStatus(e.message, 'error');
      stopCycle();
    } finally {
      state.busy = false;
    }
    schedule();
  }

  function step(delta) { if (!state.busy) show(state.index + delta); }

  function stopCycle() {
    state.paused = true;
    clearTimeout(state.timer);
    ui.pause.textContent = 'Resume';
  }

  async function open() {
    if (state.open) return;
    ui.start.disabled = true;
    setStatus('Preparing…');
    try {
      const status = await api('GET', `${LAMP_API}/status`);
      if (status.data && status.data.locked) throw new Error(status.data.lockReason);
      state.members = await loadMembers();
      if (!state.members.length) throw new Error('No lamps found in deCONZ.');
      const saved = await api('GET', '/api/lamp-order');
      state.saved = (saved.data && saved.data.order) || [];
      if (!ui.fields) buildFields();
      ui.inputs.forEach((inp, i) => { inp.value = state.saved[i] != null ? String(state.saved[i]) : ''; });
      ui.fields.style.display = '';
      enableBulbTaps();
      layoutFields();
      state.open = true;
      state.paused = false;
      ui.pause.textContent = 'Pause';
      ui.panel.classList.add('open');
      requestAnimationFrame(layoutFields);
      ui.start.textContent = 'Identify running…';
      setStatus(state.groupId ? 'All OctoOrgler lamps switched off for identifying.' : 'No "OctoOrgler" group found, identifying all deCONZ lamps.');
      await allOff();
      state.current = null;
      await show(0);
    } catch (e) {
      setStatus(`Identify not started: ${e.message}`, 'error');
      ui.start.disabled = false;
    }
  }

  async function close() {
    clearTimeout(state.timer);
    state.open = false;
    const last = state.current;
    state.current = null;
    ui.panel.classList.remove('open');
    if (ui.fields) ui.fields.style.display = 'none';
    ui.start.disabled = false;
    ui.start.textContent = 'Identify';
    if (last != null) { try { await setLamp(last, OFF_STATE); } catch (e) { /* locked */ } }
    setStatus('');
  }

  async function save() {
    if (!validate()) return;
    const order = readOrder();
    const r = await api('PUT', '/api/lamp-order', { order });
    if (!r.ok) return setStatus(`Not saved: ${errorText(r.data) || 'HTTP ' + r.status}`, 'error');
    state.saved = order;
    setStatus(`Saved lamp order ${order.join(',')}. Lamp control chases and the game now use it.`, 'ok');
  }

  function buildBar() {
    const style = el('style'); style.textContent = css; document.head.appendChild(style);
    const bar = el('div', { id: 'identifyBar' });
    ui.start = el('button', { type: 'button', id: 'identifyStart' }, 'Identify');
    ui.panel = el('div', { id: 'identifyPanel', role: 'region', 'aria-label': 'Identify lamps' });
    ui.now = el('div', { id: 'identifyNow', 'aria-live': 'polite' });
    const controls = el('div', { class: 'identify-row' });
    ui.prev = el('button', { type: 'button' }, '◀ Previous');
    ui.pause = el('button', { type: 'button' }, 'Pause');
    ui.next = el('button', { type: 'button' }, 'Next ▶');
    const secLabel = el('label', {}, 'Seconds per lamp');
    ui.seconds = el('input', { type: 'number', min: '1', max: '30', step: '0.5', value: '3' });
    secLabel.appendChild(ui.seconds);
    controls.append(ui.prev, ui.pause, ui.next, secLabel);
    ui.missing = el('div', { id: 'identifyMissing', style: 'color:#aaa;font-size:.9em;text-align:center' });
    const actions = el('div', { class: 'identify-row' });
    ui.save = el('button', { type: 'button', class: 'primary' }, 'Save as lamp order');
    ui.close = el('button', { type: 'button' }, 'Close identify');
    actions.append(ui.save, ui.close);
    ui.status = el('div', { id: 'identifyStatus', role: 'status' });
    ui.panel.append(ui.now, controls, ui.missing, actions);
    bar.append(ui.start, ui.panel, ui.status);
    document.body.appendChild(bar);

    ui.start.addEventListener('click', open);
    ui.prev.addEventListener('click', () => step(-1));
    ui.next.addEventListener('click', () => step(1));
    ui.pause.addEventListener('click', () => {
      if (state.paused) { state.paused = false; ui.pause.textContent = 'Pause'; schedule(); } else stopCycle();
    });
    ui.seconds.addEventListener('change', schedule);
    ui.save.addEventListener('click', save);
    ui.close.addEventListener('click', close);
    window.addEventListener('resize', layoutFields);
    // Opening the panel shrinks the lamp area and moves the drawing, so re-place the fields whenever it changes size.
    if (window.ResizeObserver) new ResizeObserver(() => layoutFields()).observe(document.getElementById('lampArea'));
    window.addEventListener('lampBoardReady', () => { layoutFields(); if (state.open) enableBulbTaps(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildBar);
  else buildBar();
})();
