const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const SETTINGS_PATH = path.join(__dirname, '..', 'config', 'settings.json');

class SettingsManager extends EventEmitter {
  constructor() {
    super();
    this.liveSettings = this.load();
    this.pendingSettings = JSON.parse(JSON.stringify(this.liveSettings));
  }

  load() {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  }

  persistToDisk(settings) {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  }

  updatePending(pathParts, value) {
    let obj = this.pendingSettings;
    for (let i = 0; i < pathParts.length - 1; i++) obj = obj[pathParts[i]];
    obj[pathParts[pathParts.length - 1]] = value;
    this.persistToDisk(this.pendingSettings);
    this.emit('pendingUpdated', this.pendingSettings);
  }

  // Applies a value immediately (live and pending) instead of waiting for the next round.
  updateNow(pathParts, value) {
    for (const target of [this.liveSettings, this.pendingSettings]) {
      let obj = target;
      for (let i = 0; i < pathParts.length - 1; i++) obj = obj[pathParts[i]] = obj[pathParts[i]] || {};
      obj[pathParts[pathParts.length - 1]] = JSON.parse(JSON.stringify(value));
    }
    this.persistToDisk(this.pendingSettings);
    this.emit('updatedNow', { path: pathParts, value });
  }

  commitPending() {
    this.liveSettings = JSON.parse(JSON.stringify(this.pendingSettings));
    this.emit('committed', this.liveSettings);
    return this.liveSettings;
  }

  getLive() { return this.liveSettings; }
  getPending() { return this.pendingSettings; }
  hasPendingChanges() {
    return JSON.stringify(this.liveSettings) !== JSON.stringify(this.pendingSettings);
  }
}

module.exports = new SettingsManager();
