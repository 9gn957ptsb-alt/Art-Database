/* The connector's copy of the artist's deck: only the fields the tools need.
 *
 * The engine reads id, kind, category, era, place, genes, materials, colours, texture (features),
 * work (the seed names works by their slug on Artsy, or on The Architectural Authority for the
 * artist's bookmarked buildings), source (where the card is from) and cdn and url (the seed's kept
 * works carry them for the hub page). The tools add the reveal (title, artist, date, medium).
 * Everything else (the local img path, the atlas cell) belongs to the app's build and is dropped.
 */

export const CARD_FIELDS = Object.freeze([
  'id', 'kind', 'work', 'url', 'cdn', 'title', 'artist', 'date', 'year', 'era', 'category', 'medium',
  'materials', 'place', 'colours', 'genes', 'w', 'h', 'crop', 'texture', 'source',
]);

const httpsOnly = (u) => (typeof u === 'string' && /^https:\/\/[^\s"<>]+$/.test(u) ? u : null);

/**
 * trimDeck(deck, images, meta) -> the connector deck. Each card keeps the deck's own "cdn" (the
 * work's image on Artsy's CDN, or a building's own photo, SPEC "deck.json"); a deck built before
 * build_deck.py wrote "cdn" gets it from images: {[work slug]: address}, read from the art database
 * by `npm run deck`.
 */
export function trimDeck(deck, images, meta) {
  if (!deck || !Array.isArray(deck.cards)) throw new Error('not a 5s deck: no cards');
  const img = images || {};
  let fromDeck = 0, fromDb = 0;
  const cards = deck.cards.map((c) => {
    const o = {};
    for (const k of CARD_FIELDS) if (c[k] !== undefined) o[k] = c[k];
    if (httpsOnly(c.cdn)) fromDeck++;
    else if (httpsOnly(img[c.work])) { o.cdn = img[c.work]; fromDb++; }
    else o.cdn = null;
    return o;
  });
  const used = new Set();
  for (const c of cards) for (const g of c.genes || []) used.add(g);
  const genes = {};
  for (const [slug, g] of Object.entries(deck.genes || {})) if (used.has(slug)) genes[slug] = { name: g.name, family: g.family };
  return {
    version: deck.version || 1,
    built: deck.built || null,
    source: deck.source || null,
    for: '5s connector',
    images: Object.assign({ from_deck: fromDeck, from_db: fromDb, none: cards.length - fromDeck - fromDb }, meta || {}),
    genes,
    cards,
  };
}
