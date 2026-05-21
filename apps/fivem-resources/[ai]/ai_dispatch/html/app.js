// ai_dispatch NUI — app.js
// Receives messages from client.lua via SendNUIMessage and updates the DOM.
// Handles prefetch + streaming of synthesized voice URL.

'use strict';

const card = document.getElementById('dispatch-card');
const badge = document.getElementById('severity-badge');
const areaLabel = document.getElementById('area-label');
const summaryEl = document.getElementById('summary-text');
const audio = document.getElementById('dispatch-audio');
const closeBtn = document.getElementById('close-btn');

closeBtn.addEventListener('click', () => {
  hide();
  // Notify Lua that user dismissed the card
  fetch('https://ai_dispatch/close', { method: 'POST', body: JSON.stringify({}) });
});

function hide() {
  card.classList.add('hidden');
  audio.pause();
  audio.src = '';
}

function show() {
  card.classList.remove('hidden');
}

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg.action !== 'string') return;

  if (msg.action === 'setVisible') {
    msg.visible ? show() : hide();
    return;
  }

  if (msg.action === 'showIncident') {
    renderIncident(msg);
  }
});

/**
 * Render an incident card.
 * @param {object} msg
 * @param {string} msg.severity
 * @param {string} msg.color
 * @param {string} msg.area
 * @param {string} msg.summary
 * @param {string|undefined} msg.voiceUrl
 */
function renderIncident(msg) {
  const severity = msg.severity || 'minor';
  const area = (msg.area || 'Unknown').replace(/_/g, ' ').toUpperCase();
  const summary = msg.summary || '';

  card.dataset.severity = severity;
  badge.textContent = severity.toUpperCase();
  areaLabel.textContent = area;
  summaryEl.textContent = summary;

  show();

  // Prefetch + play synthesized voice if provided. Without a voiceUrl we
  // must still stop any in-flight playback from a previous incident so the
  // old audio doesn't bleed onto the new card.
  if (msg.voiceUrl) {
    playVoice(msg.voiceUrl);
  } else {
    stopVoice();
  }
}

// Tracks the canplay listener for the current playVoice() invocation so it
// can be cleaned up on error or when a new incident arrives.
let currentCanPlay = null;

function detachCanPlay() {
  if (currentCanPlay) {
    audio.removeEventListener('canplay', currentCanPlay);
    currentCanPlay = null;
  }
}

function stopVoice() {
  detachCanPlay();
  audio.onerror = null;
  try {
    audio.pause();
  } catch {
    /* paused already */
  }
  if (audio.currentTime) audio.currentTime = 0;
  audio.removeAttribute('src');
  audio.load();
}

/**
 * Prefetch audio then play. Falls back silently if URL is unavailable.
 * @param {string} url
 */
function playVoice(url) {
  // Always tear down any pending canplay from a previous incident before
  // wiring up the new one — otherwise failed loads stack listeners and
  // trigger duplicate play() calls later.
  detachCanPlay();
  audio.pause();
  audio.src = url;
  audio.volume = 0.85;

  const onCanPlay = () => {
    detachCanPlay();
    audio.play().catch(() => {
      /* autoplay blocked — silently skip */
    });
  };
  currentCanPlay = onCanPlay;
  audio.addEventListener('canplay', onCanPlay);

  audio.onerror = () => {
    console.warn('[ai_dispatch] voice audio failed to load:', url);
    detachCanPlay();
    audio.onerror = null;
    audio.removeAttribute('src');
  };

  audio.load();
}
