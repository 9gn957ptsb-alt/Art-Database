/* Bloomberg Connects: a museum's own guide — a link off the site.

   The artist, 7 Oct 2026, of Bloomberg Connects (Bloomberg Philanthropies' free app of digital
   guides that museums, galleries, gardens and historic sites make themselves: audio, video and
   text from their curators, artists and educators): "It is a great example of how I want to set
   up connections with museums and galleries regarding historical narratives or contemporary
   talks on art"; and, asked whether its stops should link out or stay on the site, "Link them
   for now to the Bloomberg site".

   bloomberg.json (scripts/fetch_bloomberg_guides.py, from scripts/bloomberg_hand.json) says
   which museums and venues of the site have a guide of their own and, where it has been seen,
   its address — always as it was seen, never made up. Where a guide is known but its address has
   not been seen, nothing is shown: a link to Bloomberg's home page would mislead.

     Bloomberg.link(key, opts) → an element, or null
       key   a museum's slug (museums.json), "folger", or Bloomberg.venueKey(cityKey, venueName)
       opts  { size: "line" (default) | "small", name, noun ("museum", "library") }
     Bloomberg.when(fn)   fn() once bloomberg.json has been read (at once if it has)

   "line" — a museum's view, the Folger's theatre: ◆ Its own guide · Bloomberg Connects ↗, and
   under it in small mono what the guide holds, in the museum's own description where that was
   seen, else that the museum made it. "small" — a row of a city's column: Guide ↗. Each is an
   <a> that opens Bloomberg Connects in a new tab, named so (WCAG 2.4.4, 3.2.5), 24 px or more to
   press; a press on it never reaches the row it sits in. Asked for before bloomberg.json has
   landed, a key gets a hidden placeholder that is filled when it does, or taken away.

   The fourth way off the site, after NASA's photographs, the building articles and a writing's
   link in a work's history. Its category is the place it is in: Museums ◆ (Galleries & shows ▢
   for a venue). */
(function () {
  "use strict";

  var data = null;            // bloomberg.json's guides, once read
  var done = false;           // read, or given up on
  var waiting = [];           // placeholders handed out before then
  var whens = [];

  function read() {
    if (!window.fetch) { settle(null); return; }
    fetch("bloomberg.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { settle(d && d.guides ? d.guides : null); })
      .catch(function () { settle(null); });
  }
  function settle(g) {
    data = g || {};
    done = true;
    var w = waiting, f = whens;
    waiting = [];
    whens = [];
    w.forEach(function (p) { fill(p.el, p.key, p.opts); });
    f.forEach(function (fn) { try { fn(); } catch (e) { /* the page goes on */ } });
  }
  function when(fn) { if (done) { fn(); } else { whens.push(fn); } }

  function venueKey(cityKey, venueName) { return "venue:" + cityKey + ":" + venueName; }

  // Only an address on Bloomberg Connects' own hosts is ever a link.
  function entry(key) {
    var e = data && Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    return e && typeof e.url === "string" && /^https:\/\/(guides|app|links)\.bloombergconnects\.org\//.test(e.url) ? e : null;
  }

  function make(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text) { n.textContent = text; }
    return n;
  }
  function unseen(text) { return make("span", "visually-hidden", text); }
  function deco(text) { var s = make("span", "bb-out", text); s.setAttribute("aria-hidden", "true"); return s; }

  // The link itself: a new tab, nothing handed back to it (noopener), and no press passed on to
  // the row under it (a museum's row goes into the museum).
  function anchor(e, cls) {
    var a = make("a", cls);
    a.href = e.url;
    a.target = "_blank";
    a.rel = "noopener";
    ["click", "pointerdown", "mousedown"].forEach(function (t) {
      a.addEventListener(t, function (ev) { ev.stopPropagation(); });
    });
    a.addEventListener("touchstart", function (ev) { ev.stopPropagation(); }, { passive: true });
    a.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.stopPropagation(); } });
    return a;
  }

  function fill(el, key, opts) {
    var e = entry(key);
    if (!e) { if (el.parentNode) { el.parentNode.removeChild(el); } return false; }
    el.textContent = "";
    el.hidden = false;
    delete el.dataset.bbWaiting;
    var venue = key.indexOf("venue:") === 0;
    var whose = opts.name || e.name || "";
    if (opts.size === "small") {
      var s = anchor(e, "bb-small");
      s.appendChild(document.createTextNode("Guide"));
      s.appendChild(deco(" ↗"));
      s.appendChild(unseen(" · " + (whose ? whose + "’s own guide" : "its own guide") +
                           " on Bloomberg Connects, opens Bloomberg Connects in a new tab"));
      el.appendChild(s);
      return true;
    }
    var noun = opts.noun || (venue ? "institution" : key === "folger" ? "library" : "museum");
    var a = anchor(e, "bb-link");
    var g = make("span", "bb-glyph", venue ? "▢" : "◆");
    g.setAttribute("aria-hidden", "true");
    a.appendChild(g);
    a.appendChild(make("span", "bb-text", "Its own guide · Bloomberg Connects"));
    a.appendChild(deco("↗"));
    a.appendChild(unseen(" — opens Bloomberg Connects in a new tab"));
    el.appendChild(a);
    el.appendChild(make("span", "bb-note", e.holds ? e.holds + " · made by the " + noun + " itself"
                                                   : "made by the " + noun + " itself, free"));
    return true;
  }

  function link(key, opts) {
    opts = opts || {};
    if (!key) { return null; }
    if (done && !entry(key)) { return null; }
    var small = opts.size === "small";
    var el = make(small ? "span" : "p", small ? "bb-guide bb-guide-small" : "bb-guide");
    el.dataset.bbKey = key;
    if (!done) {
      el.hidden = true;
      el.dataset.bbWaiting = "true";
      waiting.push({ el: el, key: key, opts: opts });
      return el;
    }
    fill(el, key, opts);
    return el;
  }

  read();
  window.Bloomberg = {
    link: link,
    when: when,
    venueKey: venueKey,
    has: function (key) { return !!entry(key); },
    ready: function () { return done; },
    _data: function () { return data; }
  };
})();
