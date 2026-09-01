// Dedicated debug page: live classified surfaces from the current tab.
import { MSG_DEBUG_INSPECT_TAB } from '../messaging/messages.js';

function debugEnabled() {
  try {
    return typeof __GMIXER_DEBUG__ !== 'undefined' && !!__GMIXER_DEBUG__;
  } catch {
    return false;
  }
}

function tabIdFromUrl() {
  const raw = new URLSearchParams(location.search).get('tab');
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function inkFor(hex) {
  if (!hex || hex[0] !== '#') return '#f2eefc';
  const n = hex.replace('#', '');
  if (n.length < 6) return '#f2eefc';
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return l > 0.55 ? '#14121a' : '#f2eefc';
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'className') node.className = value;
    else if (value != null) node.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
}

function swatchCard(label, hex, sub) {
  const card = el('div', { className: 'swatch' });
  const chip = el('div', { className: 'chip', text: hex || '—' });
  chip.style.background = hex || '#2a2436';
  chip.style.color = inkFor(hex);
  card.append(
    chip,
    el('div', { className: 'info' }, [
      el('div', { className: 'label', text: label }),
      sub ? el('div', { className: 'sub', text: sub }) : null,
    ])
  );
  return card;
}

function hexList(entries) {
  if (!entries?.length) return '—';
  return entries
    .slice(0, 4)
    .map((entry) => `${entry.hex} ×${entry.count}`)
    .join(', ');
}

function mini(hex) {
  const node = el('span', { className: 'mini' });
  node.style.background = hex || 'transparent';
  return node;
}

function renderPalette(root, palette) {
  root.append(el('h2', { text: 'Assigned palette tokens' }));
  if (palette?.collapses?.length) {
    for (const note of palette.collapses) {
      root.append(el('div', { className: 'warn', text: note }));
    }
  }
  const grid = el('div', { className: 'grid' });
  for (const token of palette?.tokens || []) {
    grid.append(
      swatchCard(token.label, token.hex, `${token.cssVar}${token.raw && token.raw !== token.hex ? ` · ${token.raw}` : ''}`)
    );
  }
  if (palette?.htmlFill || palette?.bodyFill) {
    grid.append(swatchCard('html computed fill', palette.htmlFill, 'documentElement'));
    grid.append(swatchCard('body computed fill', palette.bodyFill, palette.bodyInk ? `ink ${palette.bodyInk}` : ''));
  }
  root.append(grid);
}

function renderClassified(root, classified) {
  root.append(el('h2', { text: 'Classified page surfaces' }));
  if (!classified?.length) {
    root.append(el('p', { className: 'empty', text: 'No data-gmixer-role stamps on this page yet.' }));
    return;
  }
  const table = el('table');
  table.append(
    el('thead', {}, [
      el('tr', {}, [
        el('th', { text: 'Role' }),
        el('th', { text: 'Count' }),
        el('th', { text: 'Live fills' }),
        el('th', { text: 'Live ink' }),
        el('th', { text: 'Tone steps' }),
        el('th', { text: 'Samples' }),
      ]),
    ])
  );
  const body = el('tbody');
  for (const group of classified) {
    const fillCell = el('td');
    const topFill = group.fills[0]?.hex;
    if (topFill) fillCell.append(mini(topFill));
    fillCell.append(hexList(group.fills));
    const inkCell = el('td');
    const topInk = group.inks[0]?.hex;
    if (topInk) inkCell.append(mini(topInk));
    inkCell.append(hexList(group.inks));
    const steps = Object.entries(group.toneSteps || {})
      .map(([step, count]) => `${step}×${count}`)
      .join(', ');
    const samples = (group.samples || [])
      .map((sample) => `${sample.selector}${sample.fill ? ` ${sample.fill}` : ''}`)
      .join('\n');
    body.append(
      el('tr', {}, [
        el('td', { text: `${group.label} (${group.role})` }),
        el('td', { text: String(group.count) }),
        fillCell,
        inkCell,
        el('td', { text: steps || '—' }),
        el('td', { text: samples || '—' }),
      ])
    );
  }
  table.append(body);
  root.append(table);
}

function renderTexture(root, texture) {
  root.append(el('h2', { text: 'Texture-catalog surfaces' }));
  const table = el('table');
  table.append(
    el('thead', {}, [
      el('tr', {}, [
        el('th', { text: 'Surface' }),
        el('th', { text: 'Group' }),
        el('th', { text: 'Matches' }),
        el('th', { text: 'Fill' }),
        el('th', { text: 'Ink' }),
        el('th', { text: 'Sample' }),
      ]),
    ])
  );
  const body = el('tbody');
  for (const surface of texture || []) {
    const fillCell = el('td');
    if (surface.sampleFill) fillCell.append(mini(surface.sampleFill));
    fillCell.append(surface.sampleFill || hexList(surface.fills));
    const inkCell = el('td');
    if (surface.sampleInk) inkCell.append(mini(surface.sampleInk));
    inkCell.append(surface.sampleInk || hexList(surface.inks));
    body.append(
      el('tr', {}, [
        el('td', { text: `${surface.label} (${surface.id})` }),
        el('td', { text: surface.group }),
        el('td', { text: String(surface.matchCount) }),
        fillCell,
        inkCell,
        el('td', { text: surface.sampleSelector || '—' }),
      ])
    );
  }
  table.append(body);
  root.append(table);
}

function renderDisabled() {
  const app = document.getElementById('app');
  app.replaceChildren(
    el('h1', { text: 'gMixer live surfaces' }),
    el('p', {
      className: 'status',
      text: 'This inspector is compiled out of production builds. Run npm run build:debug, reload the unpacked extension, then open this page again.',
    })
  );
}

async function loadSurfaces(tabId) {
  return chrome.runtime.sendMessage({
    type: MSG_DEBUG_INSPECT_TAB,
    tabId,
  });
}

function renderPayload(payload, tabId) {
  const app = document.getElementById('app');
  const surfaces = payload?.surfaces;
  const statusKind = payload?.ok ? 'ok' : 'error';
  const header = el('header', {}, [
    el('div', {}, [
      el('h1', { text: 'gMixer live surfaces' }),
      el('div', {
        className: 'meta',
        text: surfaces
          ? `${surfaces.hostname || payload.tabTitle || ''} · ${surfaces.href || payload.tabUrl || ''}`
          : payload?.tabUrl || payload?.tabTitle || 'No page snapshot',
      }),
    ]),
    el('div', {}, [
      el('button', { type: 'button', text: 'Refresh', id: 'refresh' }),
      el('div', {
        className: 'status',
        'data-kind': statusKind,
        text: payload?.ok
          ? `${surfaces?.classifiedCount ?? 0} classified nodes`
          : payload?.error || 'Inspect failed',
      }),
    ]),
  ]);
  app.replaceChildren(header);
  header.querySelector('#refresh')?.addEventListener('click', () => {
    void refresh(tabId);
  });
  if (!payload?.ok || !surfaces) return;
  renderPalette(app, surfaces.palette);
  renderClassified(app, surfaces.classified);
  renderTexture(app, surfaces.texture);
}

async function refresh(tabId) {
  const payload = await loadSurfaces(tabId);
  renderPayload(payload, payload?.tabId || tabId);
  if (payload?.tabId && String(payload.tabId) !== String(tabId || '')) {
    history.replaceState(null, '', `?tab=${payload.tabId}`);
  }
}

async function main() {
  if (!debugEnabled()) {
    renderDisabled();
    return;
  }
  await refresh(tabIdFromUrl());
}

void main();
