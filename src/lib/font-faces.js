// Shared @font-face CSS for page restyle + settings UI typeface pickers.
import { getBundledFonts } from '../config/fonts.js';

function fontFormat(path) {
  if (path.endsWith('.woff2')) return 'woff2';
  if (path.endsWith('.woff')) return 'woff';
  if (path.endsWith('.otf')) return 'opentype';
  return 'truetype';
}

/** Emit @font-face rules for every bundled font. */
export function fontFaceRules() {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return '';
    return getBundledFonts()
      .map((font) => {
        const url = chrome.runtime.getURL(`fonts/${font.file}`);
        const weight =
          font.weightRange != null
            ? `  font-weight: ${font.weightRange};\n`
            : '';
        return `@font-face {
  font-family: ${font.family};
  src: url("${url}") format("${fontFormat(font.file)}");
${weight}  font-display: swap;
}`;
      })
      .join('\n\n');
  } catch {
    // The old page context may survive briefly after an extension reload.
    return '';
  }
}

/** Ensure a document-level <style> with all bundled @font-face rules exists. */
export function ensureDocumentFontFaces(doc = document) {
  const id = 'gmixer-font-faces';
  if (doc.getElementById(id)) return;
  const css = fontFaceRules();
  if (!css) return;
  const style = doc.createElement('style');
  style.id = id;
  style.textContent = css;
  (doc.head || doc.documentElement).appendChild(style);
}
