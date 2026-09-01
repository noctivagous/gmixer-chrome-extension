// Page main-world stub for window.gmixerDebug.
// Forwards calls to the content-script debug API via window.postMessage.
// Bundled as extension/debug-bridge.js and injected only in debug builds.

(() => {
  if (globalThis.gmixerDebug?.__gmixerBridge) return;

  const REQUEST_TYPE = 'GMIXER_DEBUG_REQUEST';
  const RESPONSE_TYPE = 'GMIXER_DEBUG_RESPONSE';
  /** @type {Map<string, { resolve: (v: unknown) => void, reject: (e: Error) => void }>} */
  const pending = new Map();

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.type !== RESPONSE_TYPE || typeof data.id !== 'string') return;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.ok) entry.resolve(data.result);
    else entry.reject(new Error(data.error || 'gmixerDebug call failed'));
  });

  function call(method, args) {
    const id = `gmixer-debug-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      window.postMessage(
        {
          type: REQUEST_TYPE,
          id,
          method,
          args: args || [],
        },
        window.location.origin
      );
      window.setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        reject(new Error(`gmixerDebug.${method} timed out`));
      }, 8000);
    });
  }

  const methods = [
    'state',
    'resolvedState',
    'openSettings',
    'closeSettings',
    'toggleSection',
    'setSectionEnabled',
    'setEnabled',
    'setThemeMode',
    'setSettingsFocus',
    'samplePage',
    'findPrimaryBackground',
    'inspectRoles',
    'inspectLiveSurfaces',
    'openSurfaceInspector',
    'rebuildCss',
    'dumpDiagnostics',
  ];

  /** @type {Record<string, (...args: unknown[]) => Promise<unknown>>} */
  const api = { __gmixerBridge: true };
  for (const name of methods) {
    api[name] = (...args) => call(name, args);
  }

  globalThis.__GMIXER_DEBUG__ = true;
  globalThis.gmixerDebug = api;
})();
