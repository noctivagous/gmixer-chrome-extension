// Wait for a short post-document_end settle before the first adaptive sample.
// Double-rAF lands after the next paint; the timeout caps SPA-heavy pages.

/**
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<void>}
 */
export function waitForPageSettle({ timeoutMs = 250 } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        requestAnimationFrame(finish);
      });
    } else {
      finish();
    }

    setTimeout(finish, Math.max(0, timeoutMs));
  });
}
