const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'highscores.json');

function loadScores() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return {}; }
}

function saveScore(playerName, mode, score) {
  const scores = loadScores();
  const key = `${playerName}:${mode}`;
  const previousBest = scores[key] || 0;
  if (score > previousBest) {
    scores[key] = score;
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(scores, null, 2));
    return { isNewRecord: true, previousBest };
  }
  return { isNewRecord: false, previousBest };
}

function getBest(playerName, mode) {
  const scores = loadScores();
  return scores[`${playerName}:${mode}`] || 0;
}

module.exports = { saveScore, getBest };
