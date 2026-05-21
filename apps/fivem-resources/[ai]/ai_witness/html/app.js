// ai_witness NUI — app.js
// Shows a brief toast when a witness observes a crime scene.
'use strict';

const body = document.body;
const text = document.getElementById('witness-text');

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || msg.action !== 'witnessAlert') return;

  body.classList.remove('hidden');
  text.textContent = msg.message || 'A witness observed the scene.';

  setTimeout(() => {
    body.classList.add('hidden');
  }, 4000);
});
