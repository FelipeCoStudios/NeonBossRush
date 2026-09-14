/* NEON BOSS RUSH - MP3 Audio Manager
 * Put the following files in /audio:
 * music.mp3, shoot.mp3, victory.mp3, defeat.mp3,
 * dash.mp3, special.mp3, powerup.mp3
 *
 * The main track loops continuously. Victory/defeat temporarily stop
 * the main track, play their result sound, then restore the music.
 */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const files = {
    music: 'audio/music.mp3',
    shoot: 'audio/shoot.mp3',
    victory: 'audio/victory.mp3',
    defeat: 'audio/defeat.mp3',
    dash: 'audio/dash.mp3',
    special: 'audio/special.mp3',
    powerup: 'audio/powerup.mp3'
  };

  const audio = {};
  let muted = false;
  let musicVolume = 0.4;
  let sfxVolume = 0.6;
  let musicWasPlaying = false;
  let resultLock = false;

  function makeAudio(src, loop) {
    const el = new Audio(src);
    el.preload = 'auto';
    el.loop = !!loop;
    el.playsInline = true;
    return el;
  }

  function init() {
    audio.music = makeAudio(files.music, true);
    audio.shoot = makeAudio(files.shoot, false);
    audio.victory = makeAudio(files.victory, false);
    audio.defeat = makeAudio(files.defeat, false);
    audio.dash = makeAudio(files.dash, false);
    audio.special = makeAudio(files.special, false);
    audio.powerup = makeAudio(files.powerup, false);
    applyVolumes();

    document.addEventListener('pointerdown', unlockAudio, { passive: true });
    document.addEventListener('keydown', unlockAudio, { passive: true });
    watchResultScreens();
    installSFXControls();

    ['music-vol', 'sfx-vol', 'mute-toggle'].forEach(id => {
      const el = $(id);
      if (el) {
        el.addEventListener('input', syncSettings);
        el.addEventListener('change', syncSettings);
      }
    });
  }

  function unlockAudio() {
    if (!audio.music) return;
    // HTMLAudio is intentionally started from a real user gesture so
    // browsers such as Chrome/Safari are less likely to reject playback.
    startMusic();
  }

  function applyVolumes() {
    if (!audio.music) return;
    audio.music.volume = muted ? 0 : musicVolume;
    ['shoot', 'victory', 'defeat', 'dash', 'special', 'powerup'].forEach(key => {
      if (audio[key]) audio[key].volume = muted ? 0 : sfxVolume;
    });
  }

  function playSFX(name) {
    if (muted || !audio[name] || resultLock) return;
    try {
      audio[name].currentTime = 0;
      const promise = audio[name].play();
      if (promise && promise.catch) promise.catch(() => {});
    } catch (e) {}
  }

  function startMusic() {
    if (muted || !audio.music || resultLock) return;
    try {
      audio.music.volume = musicVolume;
      const promise = audio.music.play();
      if (promise && promise.catch) promise.catch(() => {});
    } catch (e) {}
  }

  function stopMusic() {
    if (!audio.music) return;
    musicWasPlaying = !audio.music.paused;
    audio.music.pause();
  }

  function restoreMusic() {
    if (muted || !audio.music) return;
    if (!musicWasPlaying) return;
    try {
      audio.music.volume = musicVolume;
      const promise = audio.music.play();
      if (promise && promise.catch) promise.catch(() => {});
    } catch (e) {}
  }

  function playResult(name, delayMs) {
    if (resultLock || muted || !audio[name]) return;
    resultLock = true;
    stopMusic();

    const sound = audio[name];
    try {
      sound.currentTime = 0;
      const promise = sound.play();
      if (promise && promise.catch) promise.catch(() => {});
    } catch (e) {}

    const finish = () => {
      resultLock = false;
      restoreMusic();
    };

    sound.onended = finish;
    // Fallback in case the file fails to fire ended.
    setTimeout(finish, delayMs || 3000);
  }

  function victory() { playResult('victory', 4000); }
  function defeat() { playResult('defeat', 4000); }

  function shoot() { playSFX('shoot'); }
  function ability(kind) {
    if (kind === 'dash') playSFX('dash');
    else if (kind === 'special') playSFX('special');
    else if (kind === 'power' || kind === 'powerup') playSFX('powerup');
  }

  function syncSettings() {
    const mv = $('music-vol');
    const sv = $('sfx-vol');
    const mt = $('mute-toggle');
    if (mv) musicVolume = Number(mv.value);
    if (sv) sfxVolume = Number(sv.value);
    if (mt) muted = !!mt.checked;
    applyVolumes();

    if (muted) {
      if (audio.music) audio.music.pause();
    } else if (audio.music && !resultLock && musicWasPlaying) {
      startMusic();
    }
  }

  function watchResultScreens() {
    const victoryScreen = $('victory-screen');
    const defeatScreen = $('defeat-screen');
    const observer = new MutationObserver(() => {
      if (victoryScreen && victoryScreen.classList.contains('active')) victory();
      else if (defeatScreen && defeatScreen.classList.contains('active')) defeat();
    });
    if (victoryScreen) observer.observe(victoryScreen, { attributes: true, attributeFilter: ['class'] });
    if (defeatScreen) observer.observe(defeatScreen, { attributes: true, attributeFilter: ['class'] });
  }

  function installSFXControls() {
    // Extra direct controls for the MP3 SFX layer. The game's gameplay
    // remains responsible for the actual actions; this layer supplies sound.
    document.addEventListener('keydown', e => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'shift') ability('dash');
      else if (k === 'q' || k === 'e') ability('special');
    });

    const attack = $('btn-attack-m');
    const dash = $('btn-dash-m');
    const special = $('btn-special-m');
    const power = $('btn-power-m');
    if (attack) attack.addEventListener('pointerdown', shoot, { passive: true });
    if (dash) dash.addEventListener('pointerdown', () => ability('dash'), { passive: true });
    if (special) special.addEventListener('pointerdown', () => ability('special'), { passive: true });
    if (power) power.addEventListener('pointerdown', () => ability('power'), { passive: true });
  }

  window.NeonAudio = {
    startMusic,
    stopMusic,
    restoreMusic,
    shoot,
    ability,
    victory,
    defeat,
    syncSettings
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
