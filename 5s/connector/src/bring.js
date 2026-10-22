/* The app's own bring-in (5s/src/bring.js, FiveSBring), used as it is: newId() for a brought thing's
 * id, and the measures the app takes of a picture on its canvas (three dominant colours, the surface
 * window, its texture), so a picture read by the connector gets the same colours the app would give
 * it. A UMD script like the engine, so Node loads it as CommonJS and esbuild wraps it the same way.
 *
 * The measures come from FiveSBring._internals, which bring.js exposes for its tests; the connector
 * depends on four of them by name, so a rename there fails here at load (and in test/connect.test.mjs),
 * never quietly.
 */
import FiveSBring from '../../src/bring.js';

const I = FiveSBring && FiveSBring._internals;
if (!FiveSBring || typeof FiveSBring.newId !== 'function' || !I ||
    ['dominantColours', 'findSurface', 'edgeDensity', 'textureScale'].some((k) => typeof I[k] !== 'function')) {
  throw new Error('5s bring-in did not load: expected FiveSBring.newId and FiveSBring._internals.{dominantColours, findSurface, edgeDensity, textureScale} from 5s/src/bring.js');
}

export default FiveSBring;
export const newId = FiveSBring.newId;
export const measures = I;
