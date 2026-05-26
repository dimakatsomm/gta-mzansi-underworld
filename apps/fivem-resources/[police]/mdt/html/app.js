// MDT NUI — app.js
// Receives messages from client.lua via SendNUIMessage and manages the MDT UI.
'use strict';

const body = document.body;
const closeBtn = document.getElementById('mdt-close');
const incidentList = document.getElementById('incident-list');
const detailPanel = document.getElementById('incident-detail');
const audio = document.getElementById('mdt-audio');

let incidents = [];
let selectedId = null;

// ── NUI message handler ─────────────────────────────────────────────────────
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg.action !== 'string') return;

  switch (msg.action) {
    case 'open':
      body.classList.remove('hidden');
      break;
    case 'close':
      body.classList.add('hidden');
      audio.pause();
      audio.src = '';
      break;
    case 'incidentList':
      incidents = Array.isArray(msg.incidents) ? msg.incidents : [];
      renderList();
      if (selectedId) renderDetail(selectedId);
      break;
    case 'noteSaved':
      showNoteSavedFeedback(msg.incidentId);
      break;
    case 'arrestLogged': {
      const statusEl = document.getElementById('arrest-status');
      if (statusEl) {
        statusEl.textContent = msg.ok ? 'Arrest logged ✓' : 'Error: ' + (msg.error || 'unknown');
        statusEl.className = 'arrest-status' + (msg.ok ? ' success' : ' error');
      }
      break;
    }
  }
});

// ── Close button ─────────────────────────────────────────────────────────────
closeBtn.addEventListener('click', () => {
  fetch('https://mdt/close', { method: 'POST', body: '{}' });
});

// ── Sidebar list rendering ────────────────────────────────────────────────────
const SEV_COLOURS = {
  petty: '#6b7280',
  minor: '#f59e0b',
  major: '#ef4444',
  serious: '#7c3aed',
  capital: '#dc2626',
};

function renderList() {
  incidentList.innerHTML = '';

  if (incidents.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'No incidents on record.';
    incidentList.appendChild(li);
    return;
  }

  incidents.forEach((inc) => {
    const li = document.createElement('li');
    if (inc.incidentId === selectedId) li.classList.add('active');

    const dot = document.createElement('span');
    dot.className = 'inc-item-badge';
    dot.style.background = SEV_COLOURS[inc.severity] || '#6b7280';

    li.appendChild(dot);
    li.appendChild(document.createTextNode(`${inc.area.toUpperCase()} — ${inc.severity}`));
    li.addEventListener('click', () => selectIncident(inc.incidentId));
    incidentList.appendChild(li);
  });
}

function selectIncident(id) {
  selectedId = id;
  renderList();
  renderDetail(id);
}

// ── Detail panel ─────────────────────────────────────────────────────────────
function renderDetail(id) {
  const inc = incidents.find((i) => i.incidentId === id);
  if (!inc) {
    detailPanel.className = 'placeholder';
    detailPanel.innerHTML = '<p>Select an incident from the list.</p>';
    return;
  }

  detailPanel.className = '';
  const area = (inc.area || 'unknown').replace(/_/g, ' ').toUpperCase();
  const ts = inc.timestamp ? new Date(inc.timestamp).toLocaleTimeString() : '—';
  const sevClass = `sev-${inc.severity || 'minor'}`;

  detailPanel.innerHTML = `
    <div class="detail-header">
      <span class="detail-severity ${sevClass}">${inc.severity || 'unknown'}</span>
      <span class="detail-area">${area}</span>
    </div>
    <p class="detail-meta">Province: ${inc.province || '—'} &nbsp;|&nbsp; ${ts} &nbsp;|&nbsp; ID: <code>${(inc.incidentId || '').slice(0, 8)}</code></p>
    <p class="detail-summary">${escapeHtml(inc.summary || '')}</p>
    <button class="detail-audio-btn" id="replay-btn" ${inc.voiceUrl ? '' : 'disabled'}>▶ Replay Dispatch Audio</button>
    <span class="detail-notes-label">Case Notes</span>
    <textarea id="note-textarea" placeholder="Add your notes…">${escapeHtml(inc.notes || '')}</textarea>
    <button class="save-note-btn" id="save-note-btn">Save Note</button>
    <div class="arrest-section">
      <span class="detail-notes-label">Log Arrest</span>
      <input id="arrest-suspect-id" type="number" min="1" max="255" placeholder="Suspect server ID (1–255)" />
      <div class="charge-list" id="charge-list">
        <!-- checkboxes rendered by JS -->
      </div>
      <button class="arrest-btn" id="arrest-btn">Log Arrest</button>
      <span id="arrest-status" class="arrest-status"></span>
    </div>
  `;

  document.getElementById('replay-btn').addEventListener('click', () => {
    if (inc.voiceUrl) playAudio(inc.voiceUrl);
  });

  const CHARGES = [
    'hijack',
    'robbery',
    'assault',
    'murder',
    'drug_deal',
    'firearm_trafficking',
    'smuggling',
    'money_laundering',
    'corruption_bribe',
  ];

  const chargeList = document.getElementById('charge-list');
  CHARGES.forEach((charge) => {
    const label = document.createElement('label');
    label.className = 'charge-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = charge;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + charge.replace(/_/g, ' ')));
    chargeList.appendChild(label);
  });

  document.getElementById('arrest-btn').addEventListener('click', () => {
    const suspectId = document.getElementById('arrest-suspect-id').value.trim();
    const charges = [...chargeList.querySelectorAll('input[type=checkbox]:checked')].map(
      (cb) => cb.value,
    );
    const statusEl = document.getElementById('arrest-status');

    if (!suspectId || isNaN(Number(suspectId))) {
      statusEl.textContent = 'Enter a valid suspect server ID.';
      statusEl.className = 'arrest-status error';
      return;
    }
    if (charges.length === 0) {
      statusEl.textContent = 'Select at least one charge.';
      statusEl.className = 'arrest-status error';
      return;
    }

    statusEl.textContent = 'Logging arrest…';
    statusEl.className = 'arrest-status';

    fetch('https://mdt/makeArrest', {
      method: 'POST',
      body: JSON.stringify({ suspectServerId: suspectId, charges, incidentId: inc.incidentId }),
    }).catch((err) => {
      statusEl.textContent = 'Error: ' + err.message;
      statusEl.className = 'arrest-status error';
    });
  });

  document.getElementById('save-note-btn').addEventListener('click', () => {
    const note = document.getElementById('note-textarea').value;
    fetch('https://mdt/saveNote', {
      method: 'POST',
      body: JSON.stringify({ incidentId: inc.incidentId, note }),
    });
  });
}

function playAudio(url) {
  audio.pause();
  audio.src = url;
  audio.volume = 0.9;
  audio.load();
  audio.addEventListener('canplay', function onCanPlay() {
    audio.removeEventListener('canplay', onCanPlay);
    audio.play().catch(() => {
      /* autoplay blocked */
    });
  });
}

function showNoteSavedFeedback(incidentId) {
  if (incidentId !== selectedId) return;
  const btn = document.getElementById('save-note-btn');
  if (btn) {
    btn.textContent = 'Saved ✓';
    setTimeout(() => {
      btn.textContent = 'Save Note';
    }, 2000);
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
