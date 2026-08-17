// Loads the sputnik lamp SVG inline and exposes bulb elements for live color control
(function() {
  const lampArea = document.getElementById('lampArea');
  if (!lampArea) return;

  fetch('/assets/sputnik_lamp.svg')
    .then(res => res.text())
    .then(svgText => {
      lampArea.innerHTML = svgText;
      const svgEl = lampArea.querySelector('svg');
      if (svgEl) svgEl.setAttribute('id', 'sputnikSvg');

      window.lampBulbElements = [];
      for (let i = 0; i < 8; i++) {
        const el = lampArea.querySelector(`#bulb-${i}`);
        window.lampBulbElements[i] = el || null;
      }
      window.dispatchEvent(new CustomEvent('lampBoardReady'));
    })
    .catch(err => {
      console.error('Failed to load sputnik_lamp.svg, falling back to simple dots', err);
      renderFallbackDots();
    });

  function renderFallbackDots() {
    const positions = [0,90,180,270, 45,135,225,315];
    window.lampBulbElements = [];
    for (let i = 0; i < 8; i++) {
      const el = document.createElement('div');
      el.style.cssText = 'width:50px;height:50px;border-radius:50%;position:absolute;background:#333;box-shadow:0 0 20px 5px currentColor;transition:background 0.15s;';
      const radius = i < 4 ? 160 : 90;
      const rad = (positions[i] * Math.PI) / 180;
      el.style.left = `calc(50% + ${radius * Math.cos(rad)}px)`;
      el.style.top = `calc(50% + ${radius * Math.sin(rad)}px)`;
      lampArea.appendChild(el);
      window.lampBulbElements[i] = el;
    }
    window.dispatchEvent(new CustomEvent('lampBoardReady'));
  }
})();

function setBulbVisual(index, color) {
  const el = window.lampBulbElements && window.lampBulbElements[index];
  if (!el) return;
  const displayColor = color || '#333333';
  if (el.tagName === 'DIV') {
    el.style.background = displayColor;
    el.style.color = displayColor;
  } else {
    el.setAttribute('fill', displayColor);
    el.style.filter = color ? `drop-shadow(0 0 12px ${displayColor})` : 'none';
  }
}
