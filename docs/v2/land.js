/* The land.

   land.json gives the words and, under each word, the works that share it.
   This file grows the land from that, walks a creature across it, and lets an
   artwork be condensed into the three colours it reduces to and thrown at the
   creature to repaint it.

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
  var HOLD = 380;       // press this long and the artwork condenses

  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var data = null;
  var plots = [];       // the rendered word cells, in document order
  var here = 0;         // which plot the creature is standing on
  var offering = null;  // the work currently being grazed
  var walkTimer = null;

  /* ---- reading the land ------------------------------------------------ */

  function thumb(work, cdn) {
    return cdn + work.i + ".jpg";
  }

  function artsy(work) {
    return "https://www.artsy.net/artwork/" + work.s;
  }

  function line(work) {
    var bits = [];
    if (work.a) { bits.push(work.a); }
    if (work.y) { bits.push(work.y); }
    return bits.join(", ");
  }

  /* ---- growing it ------------------------------------------------------ */

  function grow() {
    var counts = data.terms.map(function (t) { return t.n; });
    var low = Math.min.apply(null, counts);
    var high = Math.max.apply(null, counts);

    // Counts run from twenty to well over a thousand, so a straight scale
    // would leave everything flat under 'paper'. Log gives the land relief.
    var floor = Math.log(low);
    var span = Math.log(high) - floor || 1;

    var fragment = document.createDocumentFragment();

    data.terms.forEach(function (term, index) {
      var plot = document.createElement("button");
      plot.type = "button";
      plot.className = "plot";
      plot.dataset.index = String(index);
      plot.setAttribute("aria-label",
        term.w + " — " + term.n + (term.n === 1 ? " work" : " works"));

      var word = document.createElement("span");
      word.className = "plot-word";
      word.style.setProperty("--mass", ((Math.log(term.n) - floor) / span).toFixed(3));
      word.textContent = term.w;

      var count = document.createElement("span");
      count.className = "plot-count";
      count.textContent = term.n;

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
      offering = null;          // a new word means a new thing to offer
      if (!graze.hidden) { offer(); }
      walkTimer = window.setTimeout(walk, GRAZE_MIN + Math.random() * (GRAZE_MAX - GRAZE_MIN));
    }, still ? 1 : STEP);
  }

  function hold() { window.clearTimeout(walkTimer); }
  function resume() {
    hold();
    walkTimer = window.setTimeout(walk, GRAZE_MIN);
  }

  /* ---- what it finds --------------------------------------------------- */

  function offer() {
    var term = data.terms[here];
    if (!term || !term.k.length) { hideGraze(); return; }

    if (!offering) {
      offering = data.works[term.k[Math.floor(Math.random() * term.k.length)]];
    }
    if (!offering) { hideGraze(); return; }

    grazePlate.src = thumb(offering, data.cdn);
    grazePlate.alt = offering.t + (offering.a ? " by " + offering.a : "");
    grazeTitle.textContent = offering.t;
    grazeMeta.textContent = line(offering);
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
  var carrying = null;   // the work whose colours are in hand

  function condense(work, x, y) {
    carrying = work;
    token.style.setProperty("--t1", work.c[0]);
    token.style.setProperty("--t2", work.c[1]);
    token.style.setProperty("--t3", work.c[2]);
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

  function wear(work) {
    creature.style.setProperty("--c1", work.c[0]);
    creature.style.setProperty("--c2", work.c[1]);
    creature.style.setProperty("--c3", work.c[2]);
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
      hideGraze();
    } else {
      token.dataset.thrown = "true";
      window.setTimeout(function () { token.hidden = true; }, 320);
      hideGraze();
    }

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
    var work = offering;
    var point = local(event);

    // Capture now, so the throw can carry the token past the card's own box.
    try { grazeCard.setPointerCapture(event.pointerId); } catch (e) {}

    holdTimer = window.setTimeout(function () {
      condense(work, point.x, point.y);
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

  // Keyboard: Enter on the artwork condenses and applies it in one move.
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

  /* ---- showing and hiding what it is grazing --------------------------- */

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

  /* ---- what a word is standing on -------------------------------------- */

  function openSeam(index) {
    var term = data.terms[index];
    if (!term) { return; }

    seamWord.textContent = term.w;
    seamCount.textContent =
      term.n + (term.n === 1 ? " work" : " works") +
      (term.k.length < term.n ? " — showing " + term.k.length : "");

    seamList.textContent = "";
    term.k.forEach(function (key) {
      var work = data.works[key];
      if (!work) { return; }

      var item = document.createElement("li");
      item.className = "seam-item";

      var link = document.createElement("a");
      link.href = artsy(work);
      link.target = "_blank";
      link.rel = "noopener";

      var plate = document.createElement("img");
      plate.className = "seam-plate";
      plate.loading = "lazy";
      plate.src = thumb(work, data.cdn);
      plate.alt = work.t + (work.a ? " by " + work.a : "");

      var title = document.createElement("h3");
      title.textContent = work.t;

      var meta = document.createElement("p");
      meta.textContent = line(work);

      var colours = document.createElement("span");
      colours.className = "seam-colours";
      colours.setAttribute("aria-hidden", "true");
      work.c.forEach(function (hex) {
        var swatch = document.createElement("span");
        swatch.style.background = hex;
        colours.appendChild(swatch);
      });

      link.appendChild(plate);
      link.appendChild(title);
      link.appendChild(meta);
      link.appendChild(colours);
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

  fetch("land.json")
    .then(function (response) {
      if (!response.ok) { throw new Error(response.status + " " + response.statusText); }
      return response.json();
    })
    .then(function (json) {
      data = json;
      if (!data.terms || !data.terms.length) { throw new Error("no terms"); }

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
