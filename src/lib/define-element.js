/**
 * Safe CustomElementRegistry access for content-script bundles.
 * Prefer window.customElements so we never hit a shadowed/null binding.
 *
 * Note: Chrome leaves window.customElements as null in isolated content
 * scripts. content-end.js loads @webcomponents/custom-elements first so
 * this resolves to the polyfill registry there.
 */
export function getCustomElements() {
  const registry =
    (typeof window !== 'undefined' && window.customElements) ||
    (typeof globalThis !== 'undefined' && globalThis.customElements) ||
    null;
  return registry;
}

/** Define only if the registry exists and the tag is not already registered. */
export function defineElement(tagName, ctor) {
  const registry = getCustomElements();
  if (!registry) {
    console.error(`[gMixer] customElements unavailable; cannot define <${tagName}>`);
    return false;
  }
  if (registry.get(tagName)) return false;
  registry.define(tagName, ctor);
  return true;
}
