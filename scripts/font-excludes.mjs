/**
 * Fonts intentionally removed from the extension bundle.
 * Fetch / reclassify scripts must never re-download these.
 *
 * Zip names kept for maintainer reference (Peter Wiegel site).
 */

/** @type {{ id: string, zip: string, label: string }[]} */
export const RETIRED_FONTS = [
  { id: 'alpha-54', zip: 'Alpha54.zip', label: 'Alpha 54' },
  { id: 'cat-reporter', zip: 'CATReporter.zip', label: 'CAT Reporter' },
  { id: 'discipuli-britannica', zip: 'DiscipuliBritannicaTT.zip', label: 'Discipuli Britannica' },
  { id: 'goldmarie', zip: 'Goldmarie.zip', label: 'Goldmarie' },
  { id: 'nigra-script', zip: 'NigraScript.zip', label: 'Nigra Script' },
  { id: 'wolgast-script', zip: 'WolgastScriptTT.zip', label: 'Wolgast Script' },
  { id: 'elb-tunnel', zip: 'ElbtunnelTT.zip', label: 'Elb Tunnel' },
  { id: 'eyechart', zip: 'Eyechart.zip', label: 'Eyechart' },
  { id: 'googee', zip: 'googee.zip', label: 'Googee' },
  { id: 'border-control', zip: 'BorderControl.zip', label: 'Border Control' },
  { id: 'schraubenkiste', zip: 'Schraubenkiste.zip', label: 'Schraubenkiste' },
  { id: 'baudot-murray', zip: 'Baudot_Murray.zip', label: 'Baudot Murray' },
  { id: 'astrud', zip: 'Astrud.zip', label: 'Astrud' },
  { id: 'gloria', zip: 'Gloria.zip', label: 'Gloria' },
  { id: 'hardman', zip: 'Hardman.zip', label: 'Hardman' },
  { id: 'youbilee', zip: 'Youbilee.zip', label: 'Youbilee' },
];

/** @type {Set<string>} */
export const EXCLUDED_FONT_IDS = new Set(RETIRED_FONTS.map((f) => f.id));
