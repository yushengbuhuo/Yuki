(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PetStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";
  const STORAGE_KEY = "zerohey_pet_state_v1";
  const VERSION = 1;
  const APPEARANCE_OPTIONS = Object.freeze({
    expression: ['calm', 'curious', 'happy', 'sleepy', 'surprised'],
    shape: ['classic', 'round', 'flat'],
    eyes: ['classic', 'close', 'wide'],
    material: ['matte', 'velvet', 'ceramic'],
    color: ['coal', 'slate', 'plum'],
    outfit: ['none', 'scarf', 'bow', 'cape'],
    hat: ['none', 'beret', 'leaf'],
    prop: ['cup', 'none', 'bowl', 'book'],
    pose: ['sit', 'side', 'rest', 'lookback'],
    scene: ['studio', 'night', 'window', 'garden']
  });
  const appearanceDefaults = () => Object.fromEntries(Object.entries(APPEARANCE_OPTIONS).map(([key, values]) => [key, values[0]]));
  const appearance = (input) => Object.fromEntries(Object.entries(APPEARANCE_OPTIONS).map(([key, values]) => [key, values.includes(input?.[key]) ? input[key] : values[0]]));
  const DEFAULTS = Object.freeze({
    version: VERSION,
    name: "小球",
    createdAt: 0,
    lastVisitAt: 0,
    lastTickAt: 0,
    satiety: 80,
    mood: 80,
    energy: 80,
    cleanliness: 80,
    totalInteractions: 0
  });
  const clamp = (value) => Math.max(0, Math.min(100, value));
  const safeNumber = (value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  const nowState = (now = Date.now()) => ({ ...DEFAULTS, appearance: appearanceDefaults(), createdAt: now, lastVisitAt: now, lastTickAt: now });
  function validate(input, now = Date.now()) {
    if (!input || typeof input !== "object" || input.version !== VERSION) return nowState(now);
    const name = typeof input.name === "string" && input.name.trim().length > 0
      ? Array.from(input.name.trim()).slice(0, 12).join("") : DEFAULTS.name;
    return {
      version: VERSION,
      name,
      appearance: appearance(input.appearance),
      createdAt: safeNumber(input.createdAt, now, 0, now),
      lastVisitAt: safeNumber(input.lastVisitAt, now, 0, now),
      lastTickAt: safeNumber(input.lastTickAt, now, 0, now),
      satiety: clamp(safeNumber(input.satiety, DEFAULTS.satiety)),
      mood: clamp(safeNumber(input.mood, DEFAULTS.mood)),
      energy: clamp(safeNumber(input.energy, DEFAULTS.energy)),
      cleanliness: clamp(safeNumber(input.cleanliness, DEFAULTS.cleanliness)),
      totalInteractions: safeNumber(input.totalInteractions, 0, 0)
    };
  }
  function storageAvailable() {
    try {
      const key = `${STORAGE_KEY}_probe`;
      localStorage.setItem(key, "1");
      localStorage.removeItem(key);
      return true;
    } catch (_) { return false; }
  }
  function parseStored(raw, now = Date.now()) {
    if (!raw) return null;
    try { return validate(JSON.parse(raw), now); } catch (_) { return null; }
  }
  function peek(now = Date.now()) {
    if (!storageAvailable()) return null;
    try { return parseStored(localStorage.getItem(STORAGE_KEY), now); } catch (_) { return null; }
  }
  function save(state) {
    if (!storageAvailable()) return false;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(validate(state))); return true; } catch (_) { return false; }
  }
  function load(now = Date.now()) {
    const raw = peek(now);
    const state = raw || nowState(now);
    const settled = settle(state, now);
    settled.lastVisitAt = now;
    return { state: settled, saved: save(settled), isNew: !raw };
  }
  function settle(state, now = Date.now()) {
    const safe = validate(state, now);
    const elapsedMs = Math.max(0, now - safe.lastTickAt);
    const hours = Math.min(24, Math.floor(elapsedMs / 3600000));
    if (hours <= 0) return safe;
    safe.satiety = clamp(safe.satiety - hours * 3);
    safe.mood = clamp(safe.mood - hours);
    safe.energy = clamp(safe.energy - hours * 2);
    safe.cleanliness = clamp(safe.cleanliness - hours);
    safe.lastTickAt = now;
    return safe;
  }
  const effects = {
    feed: { satiety: 20, mood: 2, cleanliness: -2 },
    pet: { mood: 12 },
    pinch: { mood: 8 },
    play: { mood: 18, energy: -12, satiety: -5 },
    sleep: { energy: 25, satiety: -3 },
    clean: { cleanliness: 30, mood: 3 }
  };
  function interact(state, action) {
    const safe = validate(state);
    const effect = effects[action];
    if (!effect) return safe;
    Object.entries(effect).forEach(([key, delta]) => { safe[key] = clamp(safe[key] + delta); });
    safe.totalInteractions += 1;
    safe.lastVisitAt = Date.now();
    return safe;
  }
  function getCondition(state) {
    const safe = validate(state);
    if (safe.energy < 25) return "sleepy";
    if (safe.satiety < 25) return "hungry";
    if (safe.cleanliness < 25) return "dirty";
    if (safe.mood < 25) return "sad";
    const average = (safe.satiety + safe.mood + safe.energy + safe.cleanliness) / 4;
    return average > 85 ? "happy" : "idle";
  }
  function getSummary(state) {
    const copy = {
      sleepy: "已经困得眼睛快粘在一起了。",
      hungry: "正盯着零食罐发呆。",
      dirty: "玩得有点灰扑扑，但还挺得意。",
      sad: "今天有一点委屈，想被摸摸。",
      happy: "今天非常开心，整只球都亮晶晶。",
      idle: "今天看起来松松软软，心情不错。"
    };
    return `${validate(state).name} ${copy[getCondition(state)]}`;
  }
  function rename(state, name) {
    const clean = typeof name === "string" ? Array.from(name.trim()).slice(0, 12).join("") : "";
    if (!clean) return { ok: false, state: validate(state) };
    return { ok: true, state: { ...validate(state), name: clean } };
  }
  function reset(now = Date.now()) {
    try { if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    return nowState(now);
  }
  function setAppearance(state, patch) {
    const safe = validate(state);
    safe.appearance = appearance({ ...safe.appearance, ...patch });
    return safe;
  }
  return { STORAGE_KEY, DEFAULTS, APPEARANCE_OPTIONS, setAppearance, clamp, validate, parseStored, storageAvailable, peek, save, load, settle, interact, getCondition, getSummary, rename, reset, nowState };
});
