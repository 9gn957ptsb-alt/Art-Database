/* The app's own hub page (5s/src/hubpage.js, FiveSHubPage), used as it is: build / files / readme /
 * publicSeed. Plus the two checks the connector makes before saving over anything already in a
 * repository: was this page, or this seed, written by 5s?
 */
import FiveSHubPage from '../../src/hubpage.js';

if (!FiveSHubPage || typeof FiveSHubPage.files !== 'function') {
  throw new Error('5s hub page did not load: expected module.exports.files from 5s/src/hubpage.js');
}

export default FiveSHubPage;

export const HUB_MARK = '<meta name="generator" content="5s">';

export function isFivesPage(text) {
  return typeof text === 'string' && text.indexOf(HUB_MARK) >= 0 && /<script type="application\/json" id="seed">/.test(text);
}

export function isFivesSeed(text) {
  try { const s = JSON.parse(text); return !!s && s.format === '5s-seed'; } catch { return false; }
}

/** The README 5s writes (FiveSHubPage.readme): it says it was made with 5s. */
export function isFivesReadme(text) {
  return typeof text === 'string' && text.indexOf('Made with 5s:') >= 0;
}
