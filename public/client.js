const socket = io();
// Bulb visuals are now rendered via the sputnik_lamp.svg board (lampBoard.js),
// using setBulbVisual(index, color) exposed globally once the SVG loads.
let pendingBulbState = null;

function applyBulbState(state) {
  state.forEach((c, i) => setBulbVisual(i, c));
}

window.addEventListener('lampBoardReady', () => {
  if (pendingBulbState) applyBulbState(pendingBulbState);
});

socket.on('bulbState', state => {
  if (window.lampBulbElements) applyBulbState(state);
  else pendingBulbState = state;
});

socket.on('bulbUpdate', ({ bulb, color }) => {
  if (window.lampBulbElements) setBulbVisual(bulb, color);
});

socket.on('capture', ({ bulbIndex, newColor }) => {
  if (!window.lampBulbElements) return;
  const el = window.lampBulbElements[bulbIndex];
  if (el) {
    setBulbVisual(bulbIndex, '#ffffff');
    setTimeout(() => setBulbVisual(bulbIndex, newColor), 120);
  }
});

let myColor = null, myBulbs = [];
const joinBtn = document.getElementById('joinBtn');
const nameInput = document.getElementById('nameInput');
const modeForm = document.getElementById('modeForm');
const joinForm = document.getElementById('joinForm');
const startBtn = document.getElementById('startBtn');
const modeSelect = document.getElementById('modeSelect');
const tapBtn = document.getElementById('tapBtn');
const scoreDisplay = document.getElementById('scoreDisplay');
const timerEl = document.getElementById('timerDisplay');
const reassignBtn = document.getElementById('reassignBtn');

let countdownInterval = null;
let reassignsLeft = 2;

if (joinBtn) {
  joinBtn.onclick = () => {
    const name = nameInput.value.trim();
    if (!name) return;
    socket.emit('join', { name });
  };
}

socket.on('joined', ({ color }) => {
  myColor = color;
  if (joinForm) joinForm.style.display = 'none';
  if (modeForm) modeForm.style.display = 'block';
  if (tapBtn) tapBtn.style.background = color;
});

if (startBtn) {
  startBtn.onclick = () => {
    socket.emit('startGame', { mode: modeSelect.value });
  };
}

socket.on('assignment', ({ bulbs, color }) => {
  myBulbs = bulbs;
  myColor = color;
  if (tapBtn) tapBtn.style.background = color;
  reassignsLeft = 2;
  if (reassignBtn) { reassignBtn.disabled = false; reassignBtn.style.display = 'block'; reassignBtn.textContent = "Can't see my bulb — Reassign"; }
});

if (tapBtn) {
  tapBtn.addEventListener('touchstart', handleTap, { passive: false });
  tapBtn.addEventListener('click', handleTap);
}

function handleTap(e) {
  if (e.cancelable) e.preventDefault();
  tapBtn.style.transform = 'scale(0.92)';
  setTimeout(() => (tapBtn.style.transform = 'scale(1)'), 100);
  myBulbs.forEach(b => socket.emit('press', { bulbIndex: b }));
}

if (reassignBtn) {
  reassignBtn.addEventListener('click', () => {
    if (!myBulbs.length) return;
    socket.emit('requestReassign', { bulbIndex: myBulbs[0] });
  });
}

socket.on('bulbReassigned', ({ oldBulb, newBulb, remaining }) => {
  myBulbs = myBulbs.map(b => (b === oldBulb ? newBulb : b));
  reassignsLeft = remaining;
  if (reassignBtn) {
    reassignBtn.textContent = `Reassign (${remaining} left)`;
    if (remaining <= 0) reassignBtn.disabled = true;
  }
});

socket.on('reassignDenied', ({ reason }) => {
  if (!reassignBtn) return;
  const msg = reason === 'limit_reached' ? 'No reassigns left' : 'No alternative bulbs available';
  const original = reassignBtn.textContent;
  reassignBtn.textContent = msg;
  setTimeout(() => (reassignBtn.textContent = original), 1500);
});

socket.on('capture', ({ scoreboard, playerId }) => {
  if (scoreDisplay) {
    const me = scoreboard.find(p => p.id === socket.id);
    if (me) scoreDisplay.textContent = `Score: ${me.score}`;
  }
});

socket.on('missPenalty', ({ newScore }) => {
  if (scoreDisplay) scoreDisplay.textContent = `Score: ${newScore}`;
  if (tapBtn) {
    const prev = tapBtn.style.background;
    tapBtn.style.background = '#8b0000';
    setTimeout(() => (tapBtn.style.background = prev), 250);
  }
});

socket.on('missedGrace', () => {
  if (tapBtn) {
    tapBtn.style.filter = 'brightness(0.4)';
    setTimeout(() => (tapBtn.style.filter = 'brightness(1)'), 200);
  }
});

socket.on('highScoreTarget', ({ best }) => {
  if (scoreDisplay) scoreDisplay.textContent = `Beat: ${best} | Score: 0`;
});

socket.on('highScoreResult', ({ isNewRecord, previousBest }) => {
  const banner = document.createElement('div');
  banner.textContent = isNewRecord ? 'New High Score!' : `So close! Best: ${previousBest}`;
  banner.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#222;padding:10px 20px;border-radius:8px;z-index:200;';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 3000);
});

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

socket.on('roundStart', ({ lengthMs }) => {
  if (!timerEl) return;
  timerEl.style.display = 'block';
  const startTime = Date.now();
  clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = lengthMs - elapsed;
    timerEl.textContent = formatTime(remaining);
    timerEl.classList.toggle('warning', remaining <= 5000 && remaining > 0);

    if (remaining <= 0) {
      clearInterval(countdownInterval);
      timerEl.textContent = '0:00';
      playEndRoundBuzzer();
    }
  }, 100);
});

function playEndRoundBuzzer() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const sequence = [
    { type: 'tone', duration: 300 },
    { type: 'gap', duration: 80 },
    { type: 'tone', duration: 100 },
    { type: 'gap', duration: 80 },
    { type: 'tone', duration: 100 },
    { type: 'gap', duration: 80 },
    { type: 'tone', duration: 300 },
  ];
  let t = ctx.currentTime;
  sequence.forEach(step => {
    if (step.type === 'tone') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + step.duration / 1000);
    }
    t += step.duration / 1000;
  });
}
