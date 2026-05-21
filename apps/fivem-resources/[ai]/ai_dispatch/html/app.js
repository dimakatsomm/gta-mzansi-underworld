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

  // Prefetch + play synthesized voice if provided
  if (msg.voiceUrl) {
    playVoice(msg.voiceUrl);
  }
}

/**
 * Prefetch audio then play. Falls back silently if URL is unavailable.
 * @param {string} url
 */
function playVoice(url) {
  audio.pause();
  audio.src = url;
  audio.volume = 0.85;

  // Attempt eager load; play on canplay
  const onCanPlay = () => {
    audio.removeEventListener('canplay', onCanPlay);
    audio.play().catch(() => {
      /* autoplay blocked — silently skip */
    });
  };

  audio.addEventListener('canplay', onCanPlay);

  audio.onerror = () => {
    console.warn('[ai_dispatch] voice audio failed to load:', url);
    audio.src = '';
  };

  audio.load();
}
