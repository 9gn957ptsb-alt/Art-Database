/* The app's own GitHub driver (5s/src/hub.js, FiveSHub), used as it is: api(token, fetch, opts) for
 * the hub's few api.github.com calls, rules for GitHub's naming rules, links for addresses.
 * A UMD script like the engine, so Node loads it as CommonJS and esbuild wraps it the same way.
 */
import FiveSHub from '../../src/hub.js';

if (!FiveSHub || typeof FiveSHub.api !== 'function') {
  throw new Error('5s hub driver did not load: expected module.exports.api from 5s/src/hub.js');
}

export default FiveSHub;
export const api = FiveSHub.api;

/** A HubError from FiveSHub (it carries a code, a status and a message in 5s's words). */
export const isHubError = (e) => !!e && e.name === 'HubError' && typeof e.code === 'string';
