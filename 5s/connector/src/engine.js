/* The app's own engine (5s/src/engine.js), unchanged: every judgment, profile, philosophy line,
 * five and seed the connector gives comes from the same code the 5s app runs.
 *
 * engine.js is a UMD script with no package.json above it, so Node loads it as CommonJS and
 * esbuild (wrangler) wraps it as CommonJS; either way the default import is its module.exports.
 */
import FiveS from '../../src/engine.js';

if (!FiveS || typeof FiveS.judge !== 'function') {
  throw new Error('5s engine did not load: expected module.exports from 5s/src/engine.js');
}

export default FiveS;
