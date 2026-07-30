const TOTAL_BULBS = 8;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function assignBulbs(playerIds, round, mode) {
  const n = playerIds.length;
  const assignment = {};
  playerIds.forEach(id => (assignment[id] = []));
  const pool = shuffle([...Array(TOTAL_BULBS).keys()]);

  if (n === 1) {
    const count = Math.min(TOTAL_BULBS, mode.bulbsPerPlayer + Math.floor((round - 1) / 2));
    assignment[playerIds[0]] = pool.slice(0, count);
    return assignment;
  }

  if (n === 4) {
    const count = round === 1 ? Math.max(1, mode.bulbsPerPlayer - 1) : mode.bulbsPerPlayer;
    playerIds.forEach((id, idx) => {
      assignment[id] = pool.slice(idx * count, (idx + 1) * count).filter(x => x !== undefined);
    });
  } else if (n === 3) {
    const shuffled = shuffle(playerIds);
    const heavy = shuffled.slice(0, 2);
    const light = shuffled[2];
    const heavyCount = mode.bulbsPerPlayer;
    const lightCount = Math.max(1, mode.bulbsPerPlayer - 1);
    assignment[heavy[0]] = pool.slice(0, heavyCount);
    assignment[heavy[1]] = pool.slice(heavyCount, heavyCount * 2);
    assignment[light] = pool.slice(heavyCount * 2, heavyCount * 2 + lightCount);
  } else if (n === 2) {
    const c = Math.max(1, Math.min(4, Math.min(round, 3)));
    playerIds.forEach((id, idx) => {
      assignment[id] = pool.slice(idx * c, (idx + 1) * c);
    });
  } else {
    throw new Error('Game requires 1-4 players');
  }
  return assignment;
}

module.exports = { assignBulbs, TOTAL_BULBS };
