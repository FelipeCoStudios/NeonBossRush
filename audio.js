/* NEON BOSS RUSH - Procedural Music & SFX
 * Uses Web Audio API, so no external audio assets are required.
 * Audio starts only after a user gesture, which is required by browsers.
 */
(function () {
  'use strict';

  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let musicRunning = false;
  let resultLock = false;
  let muted = false;
  let musicVolume = 0.4;
  let sfxVolume = 0.6;

  const $ = id => document.getElementById(id);

  function ensureAudio() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        musicGain = ctx.createGain();
        sfxGain = ctx.createGain();
        master.gain.value = 1;
        musicGain.gain.value = musicVolume;
        sfxGain.gain.value = sfxVolume;
        musicGain.connect(master);
        sfxGain.connect(master);
        master.connect(ctx.destination);
      } catch (e) {
        return false;
      }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }

  function tone(freq, duration, type, volume, destination, when) {
    if (!ensureAudio() || muted) return;
    const t = when == null ? ctx.currentTime : when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(destination || sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  // Short synthesized shot sound.
  function shoot() {
    if (!ensureAudio() || muted) return;
    const t = ctx.currentTime;
    tone(180 + Math.random() * 55, 0.07, 'square', 0.11, sfxGain, t);
    tone(70, 0.055, 'sawtooth', 0.07, sfxGain, t + 0.015);
  }

  function ability(kind) {
    if (!ensureAudio() || muted) return;
    const t = ctx.currentTime;
    if (kind === 'dash') {
      tone(260, 0.08, 'sine', 0.13, sfxGain, t);
      tone(620, 0.13, 'triangle', 0.11, sfxGain, t + 0.045);
    } else if (kind === 'special') {
      [330, 440, 660, 880].forEach((f, i) => tone(f, 0.12, 'triangle', 0.1, sfxGain, t + i * 0.045));
    } else {
      tone(520, 0.08, 'triangle', 0.11, sfxGain, t);
      tone(900, 0.15, 'sine', 0.08, sfxGain, t + 0.06);
    }
  }

  function startMusic() {
    if (!ensureAudio() || musicRunning || resultLock || muted) return;
    musicRunning = true;

    // Lightweight looping cyber/neon arpeggio. Scheduled in small chunks so
    // the page can stay responsive and the music can continue in the background.
    const notes = [55, 65.41, 73.42, 82.41, 98, 82.41, 73.42, 65.41];
    let step = 0;

    function schedule() {
      if (!musicRunning || !ctx || muted) return;
      const now = ctx.currentTime + 0.03;
      const beat = 0.22;
      for (let i = 0; i < 8; i++) {
        const n = notes[(step + i) % notes.length];
        tone(n, 0.19, 'sawtooth', 0.035, musicGain, now + i * beat);
        tone(n * 2, 0.13, 'square', 0.018, musicGain, now + i * beat + 0.02);
      }
      step = (step + 8) % notes.length;
      musicTimer = setTimeout(schedule, 8 * beat * 1000 - 35);
    }
    schedule();
  }

  function stopMusic() {
    musicRunning = false;
    if (musicTimer) {
      clearTimeout(musicTimer);
      musicTimer = null;
    }
    if (musicGain && ctx) {
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.025);
    }
  }

  function restoreMusic() {
    if (!musicGain || !ctx || muted) return;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(musicVolume, ctx.currentTime, 0.04);
    startMusic();
  }

  function victory() {
    if (!ensureAudio() || muted) return;
    resultLock = true;
    stopMusic();
    const t = ctx.currentTime + 0.05;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(f, 0.28, 'triangle', 0.12, sfxGain, t + i * 0.13);
      tone(f / 2, 0.22, 'sine', 0.055, sfxGain, t + i * 0.13);
    });
    setTimeout(() => { resultLock = false; restoreMusic(); }, 850);
  }

  function defeat() {
    if (!ensureAudio() || muted) return;
    resultLock = true;
    stopMusic();
    const t = ctx.currentTime + 0.05;
    [392, 330, 277, 196].forEach((f, i) => {
      tone(f, 0.34, 'sawtooth', 0.1, sfxGain, t + i * 0.17);
    });
    setTimeout(() => { resultLock = false; restoreMusic(); }, 900);
  }

  function syncSettings() {
    const mv = $('music-vol');
    const sv = $('sfx-vol');
    const mt = $('mute-toggle');
    if (mv) {
      musicVolume = Number(mv.value);
      if (musicGain && ctx) musicGain.gain.value = muted ? 0 : musicVolume;
    }
    if (sv) {
      sfxVolume = Number(sv.value);
      if (sfxGain && ctx) sfxGain.gain.value = muted ? 0 : sfxVolume;
    }
    if (mt) {
      muted = mt.checked;
      if (master && ctx) master.gain.value = muted ? 0 : 1;
      if (muted) stopMusic();
    }
  }

  function watchResultScreens() {
    const victoryScreen = $('victory-screen');
    const defeatScreen = $('defeat-screen');
    if (!victoryScreen && !defeatScreen) return;
    const observer = new MutationObserver(() => {
      if (victoryScreen && victoryScreen.classList.contains('active')) victory();
      else if (defeatScreen && defeatScreen.classList.contains('active')) defeat();
    });
    if (victoryScreen) observer.observe(victoryScreen, { attributes: true, attributeFilter: ['class'] });
    if (defeatScreen) observer.observe(defeatScreen, { attributes: true, attributeFilter: ['class'] });
  }

  function installControls() {
    const start = () => { ensureAudio(); startMusic(); };
    // The initial overlay is a user gesture, so this satisfies autoplay policy.
    document.addEventListener('pointerdown', start, { once: true, passive: true });
    document.addEventListener('keydown', start, { once: true });

    const canvas = $('game-canvas');
    if (canvas) canvas.addEventListener('pointerdown', () => shoot(), { passive: true });

    // Common desktop controls plus the existing mobile controls.
    document.addEventListener('keydown', e => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'enter' || k === 'j' || k === 'f') shoot();
      if (k === 'shift') ability('dash');
      if (k === 'q' || k === 'e') ability('special');
    });

    const dash = $('btn-dash-m');
    const special = $('btn-special-m');
    const attack = $('btn-attack-m');
    const power = $('btn-power-m');
    if (dash) dash.addEventListener('pointerdown', () => ability('dash'), { passive: true });
    if (special) special.addEventListener('pointerdown', () => ability('special'), { passive: true });
    if (attack) attack.addEventListener('pointerdown', () => shoot(), { passive: true });
    if (power) power.addEventListener('pointerdown', () => ability('power'), { passive: true });

    ['music-vol', 'sfx-vol', 'mute-toggle'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('input', syncSettings);
      if (el) el.addEventListener('change', syncSettings);
    });
  }

  function init() {
    installControls();
    watchResultScreens();
    syncSettings();
  }

  window.NeonAudio = { startMusic, stopMusic, shoot, ability, victory, defeat, syncSettings };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
