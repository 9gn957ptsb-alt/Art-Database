/* The land.

   Two sources, and they do different jobs.

   ../works.json is Matthew's. Its `terms` give the land its words, and a word
   links to his works that share it — that is what the land is for.

   land.json is the token supply, built from the Artsy saves. A token is one of
   those works boiled down to the three colours it reduces to. The creature
   turns one up as it grazes; hold it to condense it, throw it to repaint the
   creature. Artsy works are tokens and nothing else — they are never what a
   word links to.

   No build step and no dependencies: the page is served as it is written. */

(function () {
  "use strict";

  var land = document.getElementById("land");
  var loading = document.getElementById("land-loading");
  var creature = document.getElementById("creature");
  var graze = document.getElementById("graze");
  var grazeCard = document.getElementById("graze-card");
  var grazePlate = document.getElementById("graze-plate");
  var grazeTitle = document.getElementById("graze-title");
  var grazeMeta = document.getElementById("graze-meta");
  var grazeHint = document.getElementById("graze-hint");
  var token = document.getElementById("token");
  var seam = document.getElementById("seam");
  var seamWord = document.getElementById("seam-word");
  var seamCount = document.getElementById("seam-count");
  var seamList = document.getElementById("seam-list");
  var seamClose = document.getElementById("seam-close");

  var STEP = 1600;      // how long a walk between two plots takes
  var GRAZE_MIN = 2600; // how long it stays with a word
  var GRAZE_MAX = 5200;
  var HOLD = 380;       // press this long and the token condenses

  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var supply = null;    // land.json — the tokens
  var mine = null;      // works.json — the artist's works
  var vocabulary = [];  // [{ word, works: [work, …] }], the land itself
  var plots = [];       // the rendered word cells, in document order
  var here = 0;         // which plot the creature is standing on
  var offering = null;  // the token currently turned up
  var walkTimer = null;

  /* ---- reading ---------------------------------------------------------- */

  function thumb(tok) {
    return supply.cdn + tok.i + ".jpg";
  }

  function tokenLine(tok) {
    var bits = [];
    if (tok.a) { bits.push(tok.a); }
    if (tok.y) { bits.push(tok.y); }
    return bits.join(", ");
  }

  function workLine(work) {
    var bits = [work.medium];
    if (work.dimensions) {
      bits.push(work.dimensions + (work.unframed ? " (unframed)" : ""));
    }
    return bits.filter(Boolean).join(", ");
  }

  /* The land's words, in the order the works introduce them. */
  function readVocabulary() {
    var order = [];
    var held = {};

    mine.works.forEach(function (work) {
      (work.terms || []).forEach(function (term) {
        if (!held[term]) {
          held[term] = [];
          order.push(term);
        }
        held[term].push(work);
      });
    });

    return order.map(function (term) {
      return { word: term, works: held[term] };
    });
  }

  /* ---- growing it ------------------------------------------------------- */

  function grow() {
    var counts = vocabulary.map(function (v) { return v.works.length; });
    var high = Math.max.apply(null, counts);
    var low = Math.min.apply(null, counts);
    var span = high - low || 1;

    var fragment = document.createDocumentFragment();

    vocabulary.forEach(function (ground, index) {
      var n = ground.works.length;

      var plot = document.createElement("button");
      plot.type = "button";
      plot.className = "plot";
      plot.setAttribute("aria-label",
        ground.word + " — " + n + (n === 1 ? " work" : " works"));

      var word = document.createElement("span");
      word.className = "plot-word";
      word.style.setProperty("--mass", ((n - low) / span).toFixed(3));
      word.textContent = ground.word;

      var count = document.createElement("span");
      count.className = "plot-count";
      count.textContent = n;

      plot.appendChild(word);
      plot.appendChild(count);
      plot.addEventListener("click", function () { openSeam(index); });

      fragment.appendChild(plot);
      plots.push(plot);
    });

    loading.remove();
    land.insertBefore(fragment, creature);
    fit();
  }

  /* A word wider than its plot is shrunk until it fits. Type is set from the
     count first and corrected here, so relief survives and nothing wraps. */
  function fit() {
    var room = [];
    plots.forEach(function (plot) {
      var word = plot.firstChild;
      word.style.fontSize = "";
      room.push(plot.clientWidth - 32);
    });
    plots.forEach(function (plot, i) {
      var word = plot.firstChild;
      var wide = word.scrollWidth;
      if (wide > room[i] && room[i] > 0) {
        var size = parseFloat(getComputedStyle(word).fontSize);
        word.style.fontSize = Math.max(11, size * room[i] / wide).toFixed(2) + "px";
      }
    });
  }

  /* ---- the walk -------------------------------------------------------- */

  function columns() {
    var template = getComputedStyle(land).gridTemplateColumns;
    return Math.max(1, template.split(" ").filter(Boolean).length);
  }

  function neighbours(index) {
    var cols = columns();
    var row = Math.floor(index / cols);
    var col = index % cols;
    var out = [];

    [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]
      .forEach(function (step) {
        var r = row + step[0];
        var c = col + step[1];
        if (r < 0 || c < 0 || c >= cols) { return; }
        var next = r * cols + c;
        if (next >= 0 && next < plots.length) { out.push(next); }
      });

    return out;
  }

  function standOn(index) {
    var plot = plots[index];
    if (!plot) { return; }

    var from = here;
    plots.forEach(function (p) { delete p.dataset.grazed; });
    plot.dataset.grazed = "true";
    here = index;

    // Centre the creature on the plot, a little low so it stands on the word
    // rather than floating over it.
    var x = plot.offsetLeft + plot.offsetWidth / 2 - creature.offsetWidth / 2;
    var y = plot.offsetTop + plot.offsetHeight - creature.offsetHeight + 6;

    if (index !== from) {
      creature.dataset.facing =
        plots[from] && plot.offsetLeft < plots[from].offsetLeft ? "left" : "right";
    }

    creature.style.transform = "translate(" + Math.round(x) + "px, " + Math.round(y) + "px)";
  }

  function walk() {
    var options = neighbours(here);
    if (!options.length) { options = [Math.floor(Math.random() * plots.length)]; }

    delete creature.dataset.grazing;
    standOn(options[Math.floor(Math.random() * options.length)]);

    walkTimer = window.setTimeout(function () {
      creature.dataset.grazing = "true";
      offering = null;          // new ground, something new to turn up
      if (!graze.hidden) { offer(); }
      walkTimer = window.setTimeout(walk, GRAZE_MIN + Math.random() * (GRAZE_MAX - GRAZE_MIN));
    }, still ? 1 : STEP);
  }

  function hold() { window.clearTimeout(walkTimer); }
  function resume() {
    hold();
    walkTimer = window.setTimeout(walk, GRAZE_MIN);
  }

  /* ---- what it turns up ------------------------------------------------- */

  /* Where the word the creature is standing on is one an Artsy medium also
     says — paper, photograph, tape — it turns up something that shares it.
     Otherwise it turns up whatever is in the general supply. */
  function pick() {
    var ground = vocabulary[here];
    var keys = (ground && supply.byTerm[ground.word]) || supply.pool;
    if (!keys || !keys.length) { return null; }
    return supply.tokens[keys[Math.floor(Math.random() * keys.length)]] || null;
  }

  function offer() {
    if (!offering) { offering = pick(); }
    if (!offering) { hideGraze(); return; }

    grazePlate.src = thumb(offering);
    grazePlate.alt = offering.t + (offering.a ? " by " + offering.a : "");
    grazeTitle.textContent = offering.t;
    grazeMeta.textContent = tokenLine(offering);
    grazeHint.textContent = "Hold to condense";
    delete graze.dataset.condensing;

    graze.hidden = false;

    // Above the word being grazed, kept inside the land.
    var plot = plots[here];
    var width = graze.offsetWidth || 168;
    var x = plot.offsetLeft + plot.offsetWidth / 2 - width / 2;
    x = Math.max(4, Math.min(x, land.offsetWidth - width - 4));

    var y = plot.offsetTop - graze.offsetHeight - 10;
    if (y < 4) { y = plot.offsetTop + plot.offsetHeight + 10; }

    graze.style.left = Math.round(x) + "px";
    graze.style.top = Math.round(y) + "px";
  }

  function hideGraze() {
    graze.hidden = true;
    delete graze.dataset.condensing;
  }

  /* ---- condensing and throwing ----------------------------------------- */

  var holdTimer = null;
  var carrying = null;   // the token whose colours are in hand

  function condense(tok, x, y) {
    carrying = tok;
    token.style.setProperty("--t1", tok.c[0]);
    token.style.setProperty("--t2", tok.c[1]);
    token.style.setProperty("--t3", tok.c[2]);
    delete token.dataset.thrown;
    token.hidden = false;
    moveToken(x, y);
    graze.dataset.condensing = "true";
    grazeHint.textContent = "Throw it at the creature";
  }

  function moveToken(x, y) {
    token.style.left = Math.round(x - token.offsetWidth / 2) + "px";
    token.style.top = Math.round(y - token.offsetHeight / 2) + "px";
  }

  function wear(tok) {
    creature.style.setProperty("--c1", tok.c[0]);
    creature.style.setProperty("--c2", tok.c[1]);
    creature.style.setProperty("--c3", tok.c[2]);
    creature.dataset.struck = "true";
    window.setTimeout(function () { delete creature.dataset.struck; }, 460);
  }

  function landed(x, y) {
    var box = creature.getBoundingClientRect();
    var pad = 28;
    return x >= box.left - pad && x <= box.right + pad &&
           y >= box.top - pad && y <= box.bottom + pad;
  }

  function release(clientX, clientY) {
    if (!carrying) { return; }

    if (landed(clientX, clientY)) {
      wear(carrying);
      token.hidden = true;
    } else {
      token.dataset.thrown = "true";
      window.setTimeout(function () { token.hidden = true; }, 320);
    }

    hideGraze();
    carrying = null;
    resume();
  }

  function local(event) {
    var box = land.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  grazeCard.addEventListener("pointerdown", function (event) {
    if (!offering) { return; }
    event.preventDefault();
    var tok = offering;
    var point = local(event);

    // Capture now, so the throw can carry the token past the card's own box.
    try { grazeCard.setPointerCapture(event.pointerId); } catch (e) {}

    holdTimer = window.setTimeout(function () {
      condense(tok, point.x, point.y);
    }, HOLD);
  });

  grazeCard.addEventListener("pointermove", function (event) {
    if (!carrying) { return; }
    var point = local(event);
    moveToken(point.x, point.y);
  });

  ["pointerup", "pointercancel"].forEach(function (name) {
    grazeCard.addEventListener(name, function (event) {
      window.clearTimeout(holdTimer);
      release(event.clientX, event.clientY);
    });
  });

  // Keyboard: Enter on the token condenses and applies it in one move.
  grazeCard.tabIndex = 0;
  grazeCard.setAttribute("role", "button");
  grazeCard.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") { return; }
    event.preventDefault();
    if (!offering) { return; }
    wear(offering);
    hideGraze();
    resume();
  });

  /* ---- showing and hiding what it turned up ---------------------------- */

  function show() { hold(); offer(); }

  creature.addEventListener("pointerenter", show);
  creature.addEventListener("focus", show);

  creature.addEventListener("pointerleave", function () {
    if (carrying) { return; }
    window.setTimeout(function () {
      if (!carrying && !graze.matches(":hover")) { hideGraze(); resume(); }
    }, 220);
  });

  creature.addEventListener("blur", function () {
    if (!carrying && !graze.contains(document.activeElement)) { hideGraze(); resume(); }
  });

  graze.addEventListener("pointerleave", function () {
    if (carrying) { return; }
    window.setTimeout(function () {
      if (!carrying && !creature.matches(":hover") && !graze.matches(":hover")) {
        hideGraze();
        resume();
      }
    }, 220);
  });

  /* ---- what a word is standing on: the artist's works ------------------- */

  function openSeam(index) {
    var ground = vocabulary[index];
    if (!ground) { return; }

    seamWord.textContent = ground.word;
    seamCount.textContent = ground.works.length +
      (ground.works.length === 1 ? " work" : " works");

    seamList.textContent = "";
    ground.works.forEach(function (work) {
      var item = document.createElement("li");
      item.className = "seam-item";

      var link = document.createElement("a");
      link.href = "index.html#" + work.slug;

      var plate = document.createElement("img");
      plate.className = "seam-plate";
      plate.loading = "lazy";
      plate.src = "../images/" + work.slug + ".jpg";
      plate.alt = work.alt + ".";

      var title = document.createElement("h3");
      title.textContent = work.title;

      var year = document.createElement("p");
      year.textContent = work.year;

      var detail = document.createElement("p");
      detail.textContent = workLine(work);

      link.appendChild(plate);
      link.appendChild(title);
      link.appendChild(year);
      link.appendChild(detail);
      item.appendChild(link);
      seamList.appendChild(item);
    });

    seam.hidden = false;
    seamClose.focus();
  }

  seamClose.addEventListener("click", function () { seam.hidden = true; });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !seam.hidden) { seam.hidden = true; }
  });

  /* ---- starting -------------------------------------------------------- */

  var settle = null;
  window.addEventListener("resize", function () {
    window.clearTimeout(settle);
    settle = window.setTimeout(function () {
      fit();
      standOn(here);
      if (!graze.hidden) { offer(); }
    }, 160);
  });

  function read(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) {
        throw new Error(url + ": " + response.status + " " + response.statusText);
      }
      return response.json();
    });
  }

  Promise.all([read("../works.json"), read("land.json")])
    .then(function (both) {
      mine = both[0];
      supply = both[1];

      vocabulary = readVocabulary();
      if (!vocabulary.length) { throw new Error("the works carry no terms"); }

      grow();
      // Archivo arrives after first paint and changes every width.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(fit);
      }
      creature.hidden = false;
      standOn(Math.floor(Math.random() * plots.length));
      creature.dataset.grazing = "true";
      walkTimer = window.setTimeout(walk, GRAZE_MIN);
    })
    .catch(function (error) {
      loading.textContent = "The land could not be read (" + error.message + ").";
    });
})();
