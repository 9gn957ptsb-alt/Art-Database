// pb_seed.js - the walk-through marked done in the page's save, for the tests that play past it (court one walks a first
// game through its first points, the artist, 28 Oct 2026; pb_walk.js tests that). Whatever else a test sets stays; a
// save that will not parse is left as it is. const seed = require("./pb_seed"); await seed(page) before its goto.
module.exports = (p) => p.addInitScript(() => {
  try {
    const K = "pickleball-save-v1", s = JSON.parse(localStorage.getItem(K) || "{}") || {};
    if (typeof s === "object" && !("tut" in s)) { s.tut = 1; if (!("v" in s)) { s.v = 2; } localStorage.setItem(K, JSON.stringify(s)); }
  } catch (e) { /* none */ }
});
