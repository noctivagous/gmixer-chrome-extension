// Keeps the theme applied as the page changes after initial load — SPA
// route swaps, infinite scroll, lazy-loaded sections/images, and sites
// that inject their own <style>/<link> tags after ours (which would
// otherwise win any same-specificity CSS battle by being later in the
// document). See product description.txt > "INJECTION PIPELINE".

/**
 * @param {() => void} reapply Called (debounced) whenever the DOM changes
 *   in a way that might need the override re-applied/re-asserted.
 */
export function startMutationObserver(reapply) {
  let pending = false;
  const isGmixerNode = (node) =>
    node.nodeType === Node.ELEMENT_NODE &&
    (node.id === 'gmixer-style' || node.id === 'gmixer-settings' ||
      node.closest?.('#gmixer-settings'));

  const scheduleReapply = () => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      reapply();
    });
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      let hasRelevantAddition = false;
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        // injectStyle() appends its own style tag on every reapply. Ignore
        // gMixer-owned DOM or this observer schedules itself forever.
        if (isGmixerNode(node)) continue;
        hasRelevantAddition = true;
        const tag = node.tagName;
        // A newly added <style>/<link> could out-order our override, or new
        // content (images, cards, headings) needs the same rules re-asserted.
        if (tag === 'STYLE' || tag === 'LINK' || tag === 'IMG' || tag === 'HEAD') {
          scheduleReapply();
          return;
        }
      }
      if (hasRelevantAddition) {
        scheduleReapply();
        return;
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => observer.disconnect();
}
