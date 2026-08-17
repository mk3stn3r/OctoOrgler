// Renders a compact copy of the Sputnik lamp SVG above the tap button,
// highlighting only the bulb(s) assigned to this specific player and
// mirroring live color changes for those bulbs.
(function () {
  const boardEl = document.getElementById('myBulbBoard');
  if (!boardEl) return;

  window.myBulbElements = [];
  window.myHighlightRings = [];
  let myAssignedBulbs = [];

  fetch('/assets/sputnik_lamp.svg')
    .then(res => res.text())
    .then(svgText => {
      boardEl.innerHTML = svgText;
      const svgEl = boardEl.querySelector('svg');
      if (svgEl) svgEl.setAttribute('id', 'myBulbSvg');

      for (let i = 0; i < 8; i++) {
        const bulbEl = boardEl.querySelector(`#bulb-${i}`);
        window.myBulbElements[i] = bulbEl || null;

        if (bulbEl) {
          const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          ring.setAttribute('cx', bulbEl.getAttribute('cx'));
          ring.setAttribute('cy', bulbEl.getAttribute('cy'));
          ring.setAttribute('r', parseFloat(bulbEl.getAttribute('r')) + 10);
          ring.setAttribute('class', 'bulb-highlight');
          ring.setAttribute('id', `bulb-highlight-${i}`);
          bulbEl.parentNode.insertBefore(ring, bulbEl.nextSibling);
          window.myHighlightRings[i] = ring;
        }
      }

      window.dispatchEvent(new CustomEvent('myBulbBoardReady'));
      if (myAssignedBulbs.length) highlightAssignedBulbs(myAssignedBulbs);
    })
    .catch(err => {
      console.error('Failed to load sputnik_lamp.svg for player board', err);
    });

  window.highlightAssignedBulbs = function (bulbIndexes) {
    myAssignedBulbs = bulbIndexes || [];
    if (!window.myHighlightRings.length) return;
    window.myHighlightRings.forEach((ring, i) => {
      if (!ring) return;
      ring.classList.toggle('active', myAssignedBulbs.includes(i));
    });
  };

  window.setMyBulbVisual = function (index, color) {
    const el = window.myBulbElements && window.myBulbElements[index];
    if (!el) return;
    const displayColor = color || '#333333';
    el.setAttribute('fill', displayColor);
    el.style.filter = color ? `drop-shadow(0 0 14px ${displayColor})` : 'none';
  };
})();
