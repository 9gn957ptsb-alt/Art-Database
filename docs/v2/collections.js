/* The rest of a museum's collection, searched from the visitor's browser.

   A museum's own saved works come from museums.json; this finds everything
   else it holds, so a visitor can look through the whole collection without
   leaving the site. Each museum is searched through the best open source
   that answers a browser directly (all of these are free, keyless and send
   CORS headers):

     * the museum's own open collection service, where it has one — the Met,
       the Art Institute of Chicago, the Cleveland Museum of Art, SMK;
     * otherwise Wikidata, which records what each museum's collection holds
       (P195, "collection") and its public-domain pictures on Wikimedia
       Commons. The museum's Wikidata item comes from museums.json (`wd`,
       written by scripts/build_collections.py) or, failing that, is looked
       up once by the museum's place and name and kept in the browser.

   Collections.search(museum, text) resolves to a list of works in the same
   shape as the saved ones — { t: title, a: artist, y: date, m: medium,
   src: picture } — or rejects if the source cannot be reached. The Met's and
   the Art Institute's also say where each work hangs today (gallery), as a
   line under it; a work found here is never hung in the walk.
   Collections.source(museum) names where the results come from.

   Collections.whereNow(museum, works) asks the same four services, from the
   visitor's browser, where each saved work placed in the museum's interior
   file (docs/v2/interiors/, its ref.object the museum's own record) is
   today, in the record's own words, as scripts/build_interiors.py reads
   them: {<id>: {on, how: room | off | none, room, keys, said, asof}}. It
   rejects when none of them answers; the walk then keeps the file's own. */
(function () {
  "use strict";

  var PAGE = 24;
  var WD_API = "https://www.wikidata.org/w/api.php";
  var WD_SPARQL = "https://query.wikidata.org/sparql";
  var FILEPATH = "https://commons.wikimedia.org/wiki/Special:FilePath/";

  function json(url, init) {
    return fetch(url, init).then(function (r) {
      if (!r.ok) { throw new Error(url + ": " + r.status); }
      return r.json();
    });
  }

  function q(params) {
    return Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }).join("&");
  }

  /* ---- the museums' own services ------------------------------------ */

  var NATIVE = {
    // The Metropolitan Museum of Art: search gives ids, each object its own call.
    "museum-the-metropolitan-museum-of-art": {
      name: "the Met's open collection",
      search: function (text) {
        var url = "https://collectionapi.metmuseum.org/public/collection/v1/search?" +
                  q({ q: text || "painting", hasImages: "true" });
        return json(url).then(function (d) {
          var ids = (d.objectIDs || []).slice(0, PAGE);
          return Promise.all(ids.map(function (id) {
            return json("https://collectionapi.metmuseum.org/public/collection/v1/objects/" + id)
              .catch(function () { return null; });
          }));
        }).then(function (objs) {
          return objs.filter(function (o) { return o && o.primaryImageSmall; }).map(function (o) {
            return { t: o.title, a: o.artistDisplayName, y: o.objectDate, m: o.medium,
                     src: o.primaryImageSmall, gallery: o.GalleryNumber ? "Gallery " + o.GalleryNumber : "" };
          });
        });
      }
    },
    // The Art Institute of Chicago: one call; pictures from its IIIF server.
    "museum-art-institute-of-chicago": {
      name: "the Art Institute's open collection",
      search: function (text) {
        var fields = "id,title,artist_title,artist_display,date_display,medium_display,image_id,is_on_view,gallery_title";
        var url = text
          ? "https://api.artic.edu/api/v1/artworks/search?" + q({ q: text, limit: PAGE, fields: fields })
          : "https://api.artic.edu/api/v1/artworks?" + q({ limit: PAGE, fields: fields });
        return json(url).then(function (d) {
          var iiif = (d.config && d.config.iiif_url) || "https://www.artic.edu/iiif/2";
          return (d.data || []).filter(function (w) { return w.image_id; }).map(function (w) {
            return { t: w.title, a: w.artist_title || (w.artist_display || "").split("\n")[0],
                     y: w.date_display, m: w.medium_display,
                     src: iiif + "/" + w.image_id + "/full/600,/0/default.jpg",
                     gallery: w.is_on_view && w.gallery_title ? w.gallery_title : "" };
          });
        });
      }
    },
    // The Cleveland Museum of Art's Open Access API.
    "museum-cleveland-museum-of-art": {
      name: "the Cleveland Museum of Art's open access collection",
      search: function (text) {
        var p = { has_image: 1, limit: PAGE };
        if (text) { p.q = text; }
        return json("https://openaccess-api.clevelandart.org/api/artworks/?" + q(p)).then(function (d) {
          return (d.data || []).filter(function (w) { return w.images && w.images.web; }).map(function (w) {
            var c = (w.creators && w.creators[0] && w.creators[0].description) || "";
            return { t: w.title, a: c.replace(/\s*\(.*$/, ""), y: w.creation_date,
                     m: w.technique, src: w.images.web.url };
          });
        });
      }
    },
    // SMK, the National Gallery of Denmark.
    "museum-statens-museum-for-kunst": {
      name: "SMK's open collection",
      search: function (text) {
        var url = "https://api.smk.dk/api/v1/art/search/?" +
                  q({ keys: text || "*", rows: PAGE, filters: "[has_image:true]", lang: "en" });
        return json(url).then(function (d) {
          return (d.items || []).filter(function (w) { return w.image_thumbnail; }).map(function (w) {
            var who = w.production && w.production[0] && w.production[0].creator;
            var when = w.production_date && w.production_date[0] && w.production_date[0].period;
            return { t: (w.titles && w.titles[0] && w.titles[0].title) || "Untitled",
                     a: who || "", y: when || "", m: (w.techniques || []).join(", "),
                     src: w.image_thumbnail };
          });
        });
      }
    }
  };

  /* ---- Wikidata, for every other museum ----------------------------- */

  var KEEP = "museum-wikidata:";

  function sparql(query) {
    return json(WD_SPARQL + "?" + q({ query: query, format: "json" }), {
      headers: { Accept: "application/sparql-results+json" }
    }).then(function (d) { return d.results.bindings; });
  }

  function flat(text) {
    return (text || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/\b(the|of|de|du|del|di|and|art|arts|museum|musee|museo|gallery)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }

  /* The museum's Wikidata item: from museums.json, or else the museum-like
     item standing within half a kilometre of its door whose name is most
     like its own. Kept in the browser once found. */
  function itemFor(m) {
    if (m.wd) { return Promise.resolve(m.wd); }
    var kept = null;
    try { kept = localStorage.getItem(KEEP + m.slug); } catch (e) {}
    if (kept) { return Promise.resolve(kept); }
    var query =
      "SELECT ?m ?mLabel WHERE {" +
      " SERVICE wikibase:around { ?m wdt:P625 ?loc ." +
      "  bd:serviceParam wikibase:center \"Point(" + m.lon + " " + m.lat + ")\"^^geo:wktLiteral ;" +
      "   wikibase:radius \"0.6\" . }" +
      " ?m wdt:P31/wdt:P279* wd:Q33506 ." +
      " SERVICE wikibase:label { bd:serviceParam wikibase:language \"en,fr,es,de,it,nl\" . }" +
      "} LIMIT 40";
    return sparql(query).then(function (rows) {
      var want = flat(m.name), best = null, score = -1;
      rows.forEach(function (r) {
        var have = flat(r.mLabel && r.mLabel.value);
        var s = 0;
        want.split(" ").forEach(function (w) { if (w && have.indexOf(w) !== -1) { s += w.length; } });
        if (s > score) { score = s; best = r.m.value.split("/").pop(); }
      });
      if (!best) { throw new Error("no Wikidata item near " + m.name); }
      try { localStorage.setItem(KEEP + m.slug, best); } catch (e) {}
      return best;
    });
  }

  /* Search the items in the museum's collection that have a picture: the
     text is matched against each work's title and description (which, on
     Wikidata, names its maker); then one query brings their details. */
  function wikidata(m, text) {
    return itemFor(m).then(function (qid) {
      var find = (text ? text + " " : "") + "haswbstatement:P195=" + qid + " haswbstatement:P18";
      return json(WD_API + "?" + q({ action: "query", list: "search", srsearch: find,
                                     srlimit: PAGE, srnamespace: 0, format: "json", origin: "*" }))
        .then(function (d) {
          var ids = ((d.query && d.query.search) || []).map(function (s) { return s.title; });
          if (!ids.length) { return []; }
          var query =
            "SELECT ?w ?wLabel ?img (SAMPLE(?by) AS ?byLabel) (MIN(?when) AS ?date) " +
            "(SAMPLE(?what) AS ?medium) WHERE {" +
            " VALUES ?w { " + ids.map(function (id) { return "wd:" + id; }).join(" ") + " }" +
            " ?w wdt:P18 ?img ." +
            " OPTIONAL { ?w wdt:P170 ?c . ?c rdfs:label ?by . FILTER(LANG(?by) = \"en\") }" +
            " OPTIONAL { ?w wdt:P571 ?when . }" +
            " OPTIONAL { ?w wdt:P186 ?mat . ?mat rdfs:label ?what . FILTER(LANG(?what) = \"en\") }" +
            " SERVICE wikibase:label { bd:serviceParam wikibase:language \"en,fr,es,de,it,nl\" . }" +
            "} GROUP BY ?w ?wLabel ?img";
          return sparql(query).then(function (rows) {
            var byId = {};
            rows.forEach(function (r) { byId[r.w.value.split("/").pop()] = r; });
            // Kept in the search's order, which is its sense of relevance.
            return ids.filter(function (id) { return byId[id]; }).map(function (id) {
              var r = byId[id];
              var file = decodeURIComponent(r.img.value.split("/").pop());
              var year = r.date ? r.date.value.slice(0, 4).replace(/^0+/, "") : "";
              return { t: r.wLabel.value, a: r.byLabel ? r.byLabel.value : "", y: year,
                       m: r.medium ? r.medium.value : "",
                       src: FILEPATH + encodeURIComponent(file) + "?width=600" };
            });
          });
        });
    });
  }

  /* ---- where a placed work is today ---------------------------------- */

  function today() { return new Date().toISOString().slice(0, 10); }
  function num(g) { return String(g).replace(/^Gallery\s+/i, ""); }
  // The same words scripts/build_interiors.py writes for each answer.
  function room(said, keys) {
    return { on: true, how: "room", room: keys[0], keys: keys, said: said, asof: today() };
  }
  function none(said) { return { on: null, how: "none", room: null, keys: [], said: said, asof: today() }; }
  function off(said) { return { on: false, how: "off", room: null, keys: [], said: said, asof: today() }; }

  // Each object on its own, then all of them; if not one answered, a refusal.
  function each(works, ask) {
    var out = {}, answered = 0;
    return Promise.all(works.map(function (w) {
      return ask(w).then(function (v) { if (v) { out[w.id] = v; answered += 1; } }).catch(function () {});
    })).then(function () {
      if (works.length && !answered) { throw new Error("no answer"); }
      return out;
    });
  }

  var WHERE = {
    "museum-the-metropolitan-museum-of-art": function (works) {
      return each(works, function (w) {
        return json("https://collectionapi.metmuseum.org/public/collection/v1/objects/" + encodeURIComponent(w.ref.object))
          .then(function (o) {
            var g = String(o.GalleryNumber || "").trim();
            return g ? room("GalleryNumber: " + g, [g, "Gallery " + g]) : none("no gallery in the Met's record");
          });
      });
    },
    "museum-art-institute-of-chicago": function (works) {
      var ids = works.map(function (w) { return String(w.ref.object); });
      if (!ids.length) { return Promise.resolve({}); }
      return json("https://api.artic.edu/api/v1/artworks?" + q({ ids: ids.join(","), limit: 100,
                                                                 fields: "id,is_on_view,gallery_id,gallery_title" }))
        .then(function (d) {
          var by = {}, out = {};
          (d.data || []).forEach(function (a) { by[String(a.id)] = a; });
          works.forEach(function (w) {
            var a = by[String(w.ref.object)];
            if (!a) { return; }
            if (a.is_on_view === false) { out[w.id] = off("is_on_view: false"); return; }
            var t = String(a.gallery_title || "").trim();
            out[w.id] = t ? room(t, [t, num(t), String(a.gallery_id || "")].filter(Boolean))
                          : none("no gallery in the Art Institute's record");
          });
          return out;
        });
    },
    "museum-cleveland-museum-of-art": function (works) {
      return each(works, function (w) {
        return json("https://openaccess-api.clevelandart.org/api/artworks/" + encodeURIComponent(w.ref.object))
          .then(function (d) {
            var loc = String((d.data && d.data.current_location) || "").trim();
            return loc ? room(loc, [loc, loc.split(" ")[0]]) : none("no current location in Cleveland's record");
          });
      });
    },
    "museum-statens-museum-for-kunst": function (works) {
      return each(works, function (w) {
        return json("https://api.smk.dk/api/v1/art/?" + q({ object_number: w.ref.object, lang: "en" }))
          .then(function (d) {
            var a = (d.items || [])[0];
            if (!a) { return null; }
            if (a.on_display === false) { return off("on_display: false"); }
            var loc = String(a.current_location_name || "").trim();
            return loc ? room(loc, [loc]) : none("no location in SMK's record");
          });
      });
    }
  };

  window.Collections = {
    whereNow: function (m, works) {
      var ask = m && WHERE[m.slug];
      if (!ask) { return Promise.reject(new Error("no live record for " + (m && m.slug))); }
      var mine = { "museum-the-metropolitan-museum-of-art": "met", "museum-art-institute-of-chicago": "aic",
                   "museum-cleveland-museum-of-art": "cma", "museum-statens-museum-for-kunst": "smk" }[m.slug];
      var list = (works || []).filter(function (w) {
        return w && w.ref && w.ref.object !== undefined && w.ref.object !== null && w.ref.museum === mine;
      });
      if (!list.length) { return Promise.resolve({}); }
      return ask(list);
    },
    search: function (m, text) {
      text = (text || "").trim();
      var own = NATIVE[m.slug];
      return own ? own.search(text) : wikidata(m, text);
    },
    source: function (m) {
      return NATIVE[m.slug] ? NATIVE[m.slug].name : "Wikidata and Wikimedia Commons";
    }
  };
})();
