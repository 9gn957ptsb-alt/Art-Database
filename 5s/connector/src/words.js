/* Wording shared by the tools: the same sentences the app says (app.js featureNoun, turnSentence,
 * describeBefore), and the rule that other people's text is data.
 */
import FiveS from './engine.js';

export const KIND_LABEL = { image: 'Image', object: 'Object', space: 'Space', surface: 'Surface', colour: 'Colour' };
const MAT_NOUN = { photograph: 'photographs', screenprint: 'screenprints', lithograph: 'lithographs', etching: 'etchings', woodcut: 'woodcuts' };

/**
 * Text written by other people (titles, artist names, media, the person's notes and names) leaves
 * the connector as one plain line: control characters, line breaks and direction overrides are
 * removed and the length is capped, so it can only ever read as a quoted value in a JSON field.
 */
export function quoted(s, max) {
  if (s == null) return null;
  const t = String(s)
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/[​-‏‪-‮⁠-⁩﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const n = max || 200;
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

/** Only https addresses go out (Artsy pages, Artsy's CDN, GitHub). */
export function safeUrl(u) {
  return typeof u === 'string' && /^https:\/\/[^\s"<>]+$/.test(u) ? u : null;
}

// A feature as a noun phrase: "Geometric works", "works in wood", "orange works" (app.js featureNoun).
export function featureNoun(key, deck) {
  const i = String(key).indexOf(':');
  const type = key.slice(0, i), v = key.slice(i + 1);
  const label = FiveS.featureLabel(key, deck);
  switch (type) {
    case 'gene': case 'cat': return label + ' works';
    case 'mat': return MAT_NOUN[v] || 'works in ' + label.toLowerCase();
    case 'hue': return label.toLowerCase() + ' works';
    case 'value': return ({ light: 'light', mid: 'mid-tone', dark: 'dark' }[v] || v) + ' works';
    case 'chroma': return v + ' works';
    case 'chord': return v + ' palettes';
    case 'texture': return v + '-textured surfaces';
    case 'era': return 'works from ' + (/^Before/.test(label) ? 'b' + label.slice(1) : label);
    case 'place': return 'works from ' + label;
    case 'kind': return label + ' cards';
    default: return label;
  }
}

/** "You kept this though you pass most Geometric works (kept 1 of 6)." (app.js turnSentence) */
export function turnSentence(dir, because, what, deck) {
  const b = because && because[0];
  if (!b) return 'You ' + (dir > 0 ? 'kept' : 'passed') + ' ' + what + ' against your own pattern.';
  return 'You ' + (dir > 0 ? 'kept' : 'passed') + ' ' + what + ' though you ' + (dir > 0 ? 'pass' : 'keep') + ' most ' +
    featureNoun(b.key, deck) + ' (kept ' + b.kept + ' of ' + b.n + ').';
}

export const listWords = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);

/** A card before judging, in words: kind, colour names, materials; never the title or artist. */
export function describeBefore(c) {
  if (!c) return '';
  const kind = KIND_LABEL[c.kind] || 'Card';
  const cols = (c.colours || []).map((h) => FiveS.colourName(h));
  let s = c.own ? 'Still yours? Your ' + kind.toLowerCase() + '.' : kind + '.';
  if (c.kind === 'surface') s += ' A detail, at its own scale.';
  if (cols.length) s += ' Colours: ' + listWords(cols) + '.';
  const mats = c.kind === 'colour' ? [] : (c.materials || []);
  if (mats.length) s += ' Materials: ' + listWords(mats) + '.';
  return s;
}

// Dates arrive as written on Artsy: "Executed in 2002.", "(Date unknown)". Say the date, or nothing.
export function dateText(d) {
  const t = String(d == null ? '' : d).replace(/\s+/g, ' ').trim();
  if (/^\(?\s*(date\s+)?(unknown|undated|n\.\s?d\.|n\/?a|no date)(\s+date)?\s*\)?\.?$/i.test(t)) return '';
  return t.replace(/^executed in\s+/i, '').replace(/(\d)\.$/, '$1');
}

export const colourOf = (hex) => ({ hex, name: FiveS.colourName(hex) });
