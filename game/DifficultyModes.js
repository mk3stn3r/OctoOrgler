const settingsManager = require('./SettingsManager');
function getModes() {
  return settingsManager.getLive().difficultyModes;
}
module.exports = { getModes };
