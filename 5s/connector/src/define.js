/* What a brought-in thing says about itself (SPEC "Connect your apps": the paste box that defines a
 * thing from a link and catalogs it). bring_in takes these per item, from read_link's page facts,
 * from Claude, or from the 5s app; this turns what it is given into the fields the state keeps,
 * the same in the app, the engine and validate.js:
 *
 *   maker ≤120 · date ≤40 · year ≤10 · medium ≤200 · place ≤60 · about (one line) ≤200
 *   category, era      the deck's own words (deck.json cards), matched without regard to case
 *   genes ≤12          the deck's gene slugs (deck.json top-level genes), by slug or by name
 *   materials ≤8       words of ≤40 characters (the deck's material words where possible)
 *   coloursEstimated   true when its colours are Claude's estimate, not read from a picture
 *   definedBy          'page' | 'claude' | 'address' | 'person'
 *
 * Text is other people's: each value is made one plain line (words.quoted) and never reaches a
 * summary. A value that is not the deck's word is left out and named in `dropped`, never guessed.
 * With a year and no era, the era is the deck's bucket for that year (build_deck.py ERA_BUCKETS),
 * so a defined thing teaches the taste model as a judged card does (engine computeFeatures).
 */
import { quoted } from './words.js';
import { deckVocab, OWN_FACTS, DEFINED_BY } from './validate.js';

const squash = (x) => String(x == null ? '' : x).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

// build_deck.py ERA_BUCKETS: the last year of each era.
const ERA_BUCKETS = [[1799, 'Before 1800'], [1899, '1800s'], [1945, '1900–45'], [1969, '1945–69'], [1999, '1970–99'], [2009, '2000s'], [9999, '2010s–now']];

/** The deck's era for a year ("1962" -> "1945–69"), when the deck has that era. */
export function eraOfYear(year, vocab) {
  const m = /(?:^|\D)(\d{3,4})(?:\D|$)/.exec(String(year == null ? '' : year));
  if (!m) return null;
  const y = Number(m[1]);
  const hit = ERA_BUCKETS.find(([top]) => y <= top);
  return hit && (!vocab || vocab.eras.has(hit[1])) ? hit[1] : null;
}

/** One of the deck's words for `text`: the same word in any case or spacing, else one it starts (if only one). */
function fromVocab(text, words) {
  const k = squash(text);
  if (!k) return null;
  const list = Array.from(words);
  const same = list.find((w) => squash(w) === k);
  if (same) return same;
  if (k.length < 4) return null;
  const starts = list.filter((w) => squash(w).startsWith(k));
  return starts.length === 1 ? starts[0] : null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * facts(item, deck) -> {facts, dropped}: the fields to keep on the thing (only those given and fine),
 * and the names of fields given but left out (not the deck's word, empty, or the wrong kind).
 */
export function definedFacts(item, deck) {
  const it = item || {};
  const vocab = deckVocab(deck) || { categories: new Set(), eras: new Set(), genes: new Set() };
  const facts = {}, dropped = [];
  for (const k of ['maker', 'date', 'medium', 'place', 'about']) {
    if (it[k] == null) continue;
    const v = typeof it[k] === 'string' ? quoted(it[k], OWN_FACTS[k]) : '';
    if (v) facts[k] = v; else dropped.push(k);
  }
  if (it.year != null) {
    const v = typeof it.year === 'number' && Number.isFinite(it.year) ? String(Math.trunc(it.year)) : typeof it.year === 'string' ? quoted(it.year, OWN_FACTS.year) : '';
    if (v) facts.year = v; else dropped.push('year');
  }
  if (it.category != null) {
    const v = fromVocab(it.category, vocab.categories);
    if (v) facts.category = v; else dropped.push('category');
  }
  if (it.era != null) {
    const v = fromVocab(it.era, vocab.eras);
    if (v) facts.era = v; else dropped.push('era');
  }
  if (!facts.era && it.era == null && facts.year) {
    const v = eraOfYear(facts.year, vocab.eras.size ? vocab : null);
    if (v) facts.era = v;
  }
  if (it.genes != null) {
    const byName = new Map();
    for (const [slug, g] of Object.entries((deck && deck.genes) || {})) {
      byName.set(squash(slug), slug);
      if (g && g.name) byName.set(squash(g.name), slug);
    }
    const out = [];
    let lost = !Array.isArray(it.genes);
    for (const g of Array.isArray(it.genes) ? it.genes : []) {
      const slug = typeof g === 'string' ? byName.get(squash(g)) : null;
      if (slug && vocab.genes.has(slug)) { if (!out.includes(slug)) out.push(slug); } else lost = true;
    }
    if (out.length) facts.genes = out.slice(0, OWN_FACTS.genes);
    if (lost || out.length > OWN_FACTS.genes) dropped.push('genes');
  }
  if (it.materials != null) {
    const out = [];
    let lost = !Array.isArray(it.materials);
    for (const m of Array.isArray(it.materials) ? it.materials : []) {
      const v = typeof m === 'string' ? quoted(m, OWN_FACTS.material).toLowerCase() : '';
      if (v && !out.includes(v)) out.push(v); else if (!v) lost = true;
    }
    if (out.length) facts.materials = out.slice(0, OWN_FACTS.materials);
    if (lost || out.length > OWN_FACTS.materials) dropped.push('materials');
  }
  if (it.definedBy != null) {
    if (DEFINED_BY.includes(it.definedBy)) facts.definedBy = it.definedBy; else dropped.push('definedBy');
  }
  // Colours Claude estimated (no picture read): kept only when said to be an estimate.
  if (it.colours != null) {
    const hexes = Array.isArray(it.colours) ? it.colours.filter((h) => typeof h === 'string' && HEX.test(h)).slice(0, 3).map((h) => h.toLowerCase()) : [];
    if (it.coloursEstimated === true && hexes.length) facts.estimatedColours = hexes; else dropped.push('colours');
  }
  if (it.coloursEstimated === true && facts.estimatedColours) facts.coloursEstimated = true;
  return { facts, dropped };
}

/** The fields definedFacts keeps on a thing (estimatedColours becomes its colours). */
export const FACT_FIELDS = Object.freeze(['maker', 'date', 'year', 'medium', 'place', 'about', 'category', 'era', 'genes', 'materials', 'coloursEstimated', 'definedBy']);
