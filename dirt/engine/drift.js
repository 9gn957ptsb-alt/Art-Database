// ---- the drift: putting a thing into the plane ------------------------------------------------------------------
// Give the plane a thing (its name, or a photograph: picked, pasted or dropped on the plane) and it drifts: Claude
// reads the thing for its qualities (colour, surface, shape, motion, sound, scale, material, place, time, use,
// meaning) and finds seven real, specific things, each joined to the one before by one quality they share and never
// of the same kind, farther out with every step. The plane carries you to each in turn, a long glide across it, and
// names where you have come to, what carried you there, and where to go to see more; Drift from here goes on from
// any of them. It asks Claude through the page's `sample` capability, on the viewer's own Claude account.
// A photo also goes into the plane itself, the moment it is given: it arrives where you are, torn out whole, and the
// collage (ground-gl.js) melts it and carries pieces of it across the plane from then on. Where Claude cannot be sent
// pictures in this view, the drift still follows the photo: the page measures it (its colours, light, contrast and
// grain) and gives Claude that instead, with any name you add. A word goes into the plane too, as a sheet of type
// the collage tears up and carries (as Schwitters glued newsprint into his Merz pictures). Nothing is ever refused:
// whatever is given goes into the plane at once; a new thing given mid-drift replaces that drift; and where Claude
// cannot answer, the thing is in the plane all the same and the page says why there is no drift.

(() => {
  if (typeof SITE !== "undefined" && SITE) return;
  const style = document.createElement("style");
  style.textContent = `
    .drift-in { display: flex; gap: 8px; align-items: center; flex: none; }
    .drift-in input[type=text] { width: 21ch; background: transparent; border: 0; border-bottom: 1px solid var(--line); color: var(--ink);
      font: italic 400 15px/1.2 var(--serif); padding: 3px 2px; }
    .drift-in input[type=text]::placeholder { color: var(--muted); opacity: 0.7; }
    .drift-in input[type=text]:focus { outline: none; border-bottom-color: var(--ink); }
    .drift-in img { width: 22px; height: 22px; object-fit: cover; }
    .drift-at { position: absolute; left: 13px; bottom: 13px; z-index: 3; max-width: min(62ch, calc(100% - 26px)); background: rgba(15, 10, 7, 0.8);
      padding: 8px 13px; font: 11px/1.55 var(--mono); color: var(--ink); }
    .drift-at .dn { color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase; font-size: 10px; }
    .drift-at .dt { font: italic 400 19px/1.25 var(--serif); display: block; margin: 2px 0 3px; }
    .drift-at .ds { font: 400 14px/1.4 var(--serif); margin: 0 0 3px; }
    .drift-at .dw { color: var(--muted); margin: 0 0 5px; }
    .drift-at .dl { display: flex; gap: 13px; flex-wrap: wrap; align-items: center; }
    .drift-at .dl a { color: var(--muted); }
    .drift-at .dl a.v { color: var(--ink); }
    .drift-at .dl button { padding: 3px 9px; font-size: 10px; }
    .drift-by { position: absolute; left: 50%; top: 13px; transform: translateX(-50%); z-index: 3; background: rgba(15, 10, 7, 0.8);
      padding: 4px 10px; font: 11px/1.4 var(--mono); color: var(--muted); max-width: calc(100% - 26px); text-align: center; }
    .drift-by b { color: var(--ink); font-weight: 500; }
    @media (max-width: 640px) { .drift-in input[type=text] { width: 14ch; } }
  `;
  document.head.appendChild(style);
  const bar = document.querySelector(".bar"), stageEl = document.getElementById("stage");
  const form = document.createElement("form");
  form.className = "drift-in";
  form.innerHTML = `<img id="d-thumb" alt="" hidden><input type="text" id="d-q" autocomplete="off" placeholder="put a thing in" aria-label="Put a thing in: name it, or give a photo">
    <button type="button" id="d-pick" title="Put a photo in: it goes into the plane, and the drift starts from it">Photo</button><input type="file" id="d-file" accept="image/*" hidden>
    <button type="submit" id="d-go">Drift</button>`;
  bar.appendChild(form);
  const at = document.createElement("div"); at.className = "drift-at"; at.hidden = true; at.setAttribute("aria-live", "polite");
  const by = document.createElement("div"); by.className = "drift-by"; by.hidden = true;
  stageEl.append(at, by);
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } };
  const link = (text, href, cls) => { const a = el("a", cls || "", text); a.href = href; a.target = "_blank"; a.rel = "noopener"; return a; };

  // ---- Claude --------------------------------------------------------------------------------------------------
  let sample = null, imagesOk = false, sendAs = null;
  const plane = () => typeof GLG !== "undefined" && GLG && GLG.putIn;
  const ready = (async () => {
    const p = window.claude && window.claude.use ? window.claude.use("sample") : null;
    sample = p ? await p.catch(() => null) : null;
    if (!sample) { if (!plane()) form.hidden = true; return; }     // no Claude here: things still go into the plane
    const lim = await sample.limits().catch(() => null);
    imagesOk = !!(lim && lim.images);
    if (imagesOk) sendAs = ["image/jpeg", "image/png", "image/webp"].find((m) => lim.images.mediaTypes.includes(m)) || null;
  })();
  const ARTISTS = (typeof PL !== "undefined" && PL.works ? [...new Set(PL.works.map((w) => w.artist).filter(Boolean))].slice(0, 24) : []).join(", ");
  function prompt(thing, visited) {
    return `You are the drift inside DIRT, an endless plane made of an artist's saved paintings. The input is a THING (${thing ? "named below" : "shown in the attached image"}). Find its lateral connections, not its neighbours: never things of the same kind or category, never the obvious association.

Read the thing for its qualities across the senses and ideas: colour, surface and texture, shape and silhouette, motion and gesture, sound, scale and weight, material, where it lives, rhythm and time, what people do with it, what it means.

Then drift through 7 stations. Each station is a concrete, specific, real thing or scene someone could look up and see: a creature, a place, a person at work, a named artwork, an instrument, a weather, a craft, a building, a phenomenon, a community, a tool. Each is joined to the one before it (station 1 to the thing) by exactly ONE quality they share, stated precisely and sensorially in a few words. Every station is in a different domain from all before it; the distance grows, station 1 already surprising, station 7 far away yet earned by the chain. Favour what is beautiful, strange, specific and real, and what leads somewhere: people, places, makers, collections, communities with a real presence online.
The person drifting is a collage artist.${ARTISTS ? " Artists they have saved include " + ARTISTS + "." : ""}
${visited.length ? "Already visited (never repeat): " + visited.join("; ") + "." : ""}
${thing ? "THE THING: " + thing : ""}

Reply with JSON Lines only, one object per line, no other text, no code fences:
line 1: {"t":"thing","name":"what it is, a few words"}
then 7 lines: {"t":"station","name":"short title","by":"the one quality carried across, max 8 words","scene":"one vivid sentence","why":"one sentence on why it is worth following","go":{"name":"site name","url":"https://..."},"search":"a precise web search phrase"}
For "go", give a real website you are certain exists (a museum or collection page, an organization, a well-known article, a maker's own site); if not certain, null.`;
  }
  const COPY = {
    not_granted: "Claude wasn't allowed for this page, so the drift is off.", sampling_disabled: "Claude isn't available on this account.",
    rate_limited: "Too many drifts at once. Wait a little, then drift again.", session_expired: "Sign in to Claude again, then drift.",
    image_rejected: "That picture couldn't be read. Try a JPEG or PNG.", refused: "Claude declined this one. Try another thing.",
    images_unavailable: "Pictures can't be sent from this view; name the thing instead.",
  };
  const lines = (text) => text.split("\n").map((s) => s.trim()).filter((s) => s.startsWith("{")).map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);

  // ---- travelling across the plane --------------------------------------------------------------------------------
  // Each station lies a long way on from the last, 987 to 1,597 cells, turning a little each time, so every step of the
  // drift crosses the plane's ladder of complexity somewhere new. The glide takes 2.6 seconds, easing out and in.
  let trip = null;                                                    // { thing, stations, at, path: [[x, y]] }
  let flight = null;
  function glideTo(x, y) {
    const from = [vx + VW / 2, vy + VH / 2], t0 = performance.now(), D = REDUCED ? 0 : 2600;
    flight = { from, to: [x, y], t0, D };
    const step = (now) => {
      if (!flight) return;
      const k = D ? Math.min(1, (now - t0) / D) : 1, e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      vx = flight.from[0] + (flight.to[0] - flight.from[0]) * e - VW / 2;
      vy = flight.from[1] + (flight.to[1] - flight.from[1]) * e - VH / 2;
      velX = velY = 0;
      if (k < 1) requestAnimationFrame(step); else flight = null;
    };
    requestAnimationFrame(step);
  }
  function place(n) {
    const p = trip.path[trip.path.length - 1], a = trip.dir + (Math.random() - 0.5) * 1.2, d = 987 + 610 * Math.random();
    trip.dir = a;
    trip.path.push([p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d]);
    return trip.path[n + 1];
  }
  function show(n) {
    if (!trip || !trip.stations[n]) return;
    trip.at = n;
    UC.shownAt = performance.now();                                   // (the ultracode lets a station be read before moving on)
    const st = trip.stations[n];
    while (trip.path.length < n + 2) place(trip.path.length - 1);
    glideTo(trip.path[n + 1][0], trip.path[n + 1][1]);
    by.replaceChildren("carried by ", el("b", "", st.by || "a shared quality")); by.hidden = false;
    at.replaceChildren();
    at.append(el("div", "dn", `${trip.thing} · ${n + 1} of ${trip.stations.length}${trip.done ? "" : " so far"}`), el("span", "dt", st.name));
    if (st.scene) at.append(el("p", "ds", st.scene));
    if (st.why) at.append(el("p", "dw", st.why));
    const l = el("div", "dl"), u = st.go && safeUrl(st.go.url);
    if (u) l.append(link((st.go.name || "Visit") + " ↗", u, "v"));
    l.append(link("search ↗", "https://www.google.com/search?q=" + encodeURIComponent(st.search || st.name)),
             link("wikipedia ↗", "https://en.wikipedia.org/w/index.php?search=" + encodeURIComponent(st.name)));
    const prev = el("button", "", "‹"), next = el("button", "", "›"), from = el("button", "", "Drift from here");
    prev.type = next.type = from.type = "button";
    prev.setAttribute("aria-label", "The station before"); next.setAttribute("aria-label", "The next station");
    prev.disabled = n === 0; next.disabled = n >= trip.stations.length - 1;
    prev.onclick = () => show(n - 1); next.onclick = () => show(n + 1);
    from.onclick = () => go(`${st.name}: ${st.scene || ""}`, null, [trip.thing, ...trip.stations.map((s) => s.name)]);
    l.append(prev, next, from);
    at.append(l);
    at.hidden = false;
  }
  function say(text) { at.replaceChildren(el("div", "dn", "the drift"), el("p", "ds", text)); at.hidden = false; by.hidden = true; }

  // ---- putting a thing in ----------------------------------------------------------------------------------------
  // ---- a photo -------------------------------------------------------------------------------------------------
  const isImage = (f) => f && (/^image\//.test(f.type) || /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(f.name || ""));
  const open = (file) => new Promise((ok, no) => {
    const im = new Image(), u = URL.createObjectURL(file);
    im.onload = () => ok(im); im.onerror = () => { URL.revokeObjectURL(u); no(new Error("undecodable")); };
    im.src = u;
  });
  /** The photo drawn at most `side` pixels on its longer side (browsers turn it upright as they draw it). */
  function fitted(im, side) {
    const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height, k = Math.min(1, side / Math.max(w, h)), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    return c;
  }
  const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  /** What the page can tell of a photo without seeing it as Claude would: its colours, most to least, its light, its
   * contrast, its grain, and its shape. */
  function measure(c) {
    const S = 34, s = document.createElement("canvas"); s.width = s.height = S;
    const x = s.getContext("2d", { willReadFrequently: true }); x.drawImage(c, 0, 0, S, S);
    const d = x.getImageData(0, 0, S, S).data, bins = new Map();
    let L = 0, L2 = 0, sat = 0, warm = 0, edge = 0;
    const lum = (i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], l = lum(i), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      L += l; L2 += l * l; sat += mx ? (mx - mn) / mx : 0; warm += r - b;
      if ((i / 4) % S) edge += Math.abs(l - lum(i - 4));
      const k = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5), e = bins.get(k) || [0, 0, 0, 0];
      e[0] += r; e[1] += g; e[2] += b; e[3]++; bins.set(k, e);
    }
    const n = S * S; L /= n; const sd = Math.sqrt(Math.max(0, L2 / n - L * L)); sat /= n; warm /= n; edge /= S * (S - 1);
    const cols = [];
    for (const e of [...bins.values()].sort((a, b) => b[3] - a[3])) {
      const col = [e[0] / e[3], e[1] / e[3], e[2] / e[3]];
      if (cols.every((q) => Math.hypot(q[0] - col[0], q[1] - col[1], q[2] - col[2]) > 55)) cols.push(col);
      if (cols.length === 6) break;
    }
    const ar = c.width / c.height;
    return [ar > 1.15 ? "wider than tall" : ar < 0.87 ? "taller than wide" : "about square",
      L > 170 ? "light and high-key" : L < 85 ? "dark and low-key" : "mid-toned",
      sd > 64 ? "strong contrast" : sd < 32 ? "soft, low contrast" : "moderate contrast",
      sat > 0.45 ? "saturated colour" : sat < 0.18 ? "nearly colourless" : "some colour",
      warm > 18 ? "warm" : warm < -18 ? "cool" : "neither warm nor cool",
      edge > 18 ? "busy with detail and texture" : edge < 7 ? "smooth, few edges" : "some detail",
    ].join(", ") + "; its colours, most to least: " + cols.map(hex).join(", ");
  }
  let picked = null, ctl = null, busy = false;
  /** Take a photo: into the plane at once, and ready for the drift. */
  async function take(file) {
    if (!isImage(file)) return null;
    let im = null;
    try { im = await open(file); } catch (e) {
      try { im = await createImageBitmap(file); } catch (e2) { im = null; }   // a second decoder, for formats the first refuses
    }
    await ready;
    if (!im) {
      // this browser cannot draw it; Claude may still read it
      picked = { file, canvas: null, measured: "" };
      if (imagesOk) say("This browser can't show that photo's format, so it can't go into the plane, but Claude is reading it.");
      else { picked = null; say("This browser can't open that photo's format (it may be HEIC). A screenshot of it, or a JPEG or PNG, will go in."); }
      return picked;
    }
    const canvas = fitted(im, 1024);
    picked = { file, canvas, measured: measure(canvas) };
    UC.given = true;
    $("d-thumb").src = canvas.toDataURL("image/jpeg", 0.6); $("d-thumb").hidden = false; $("d-thumb").alt = "The photo put in";
    if (plane()) GLG.putIn(canvas, vx + VW / 2, vy + VH / 2);
    label();
    return picked;
  }
  /** A word as a sheet of type for the plane: warm paper, lines of the word at Fibonacci sizes, roman and italic, one
   * line in vermilion, each set a little along from the last, so a torn piece of it reads as print. */
  function wordSheet(text) {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 640;
    const x = c.getContext("2d"), line = (text.slice(0, 89) + "  ·  ").repeat(21), sizes = [34, 89, 55, 144, 21, 55, 89];
    x.fillStyle = "#eee7d8"; x.fillRect(0, 0, c.width, c.height);
    let y = 0;
    for (let i = 0; y < c.height + 40; i++) {
      const s = sizes[i % sizes.length];
      x.font = `${i % 3 === 1 ? "italic " : ""}400 ${s}px Newsreader, Georgia, "Times New Roman", serif`;
      x.fillStyle = i % 5 === 3 ? "#d23c28" : "#17120e";
      y += s * 1.02;
      x.fillText(line, -((i * 233) % 610), y - s * 0.18);
    }
    return c;
  }
  /** Into the plane, at once: the photo if there is one (already in), else the word as type. */
  function putIn(name, photo) {
    if (photo || !name || !plane()) return;
    UC.given = true;
    GLG.putIn(wordSheet(name), vx + VW / 2, vy + VH / 2);
  }
  let queued = null, claudeOff = "";
  /** The button says Stop only while a drift is under way and nothing new is waiting to go in; else it takes it in. */
  const label = () => { $("d-go").textContent = busy && !$("d-q").value.trim() && !picked ? "Stop" : "Drift"; };
  $("d-q").addEventListener("input", label);
  const blobOf = (canvas) => new Promise((ok) => sendAs ? canvas.toBlob(ok, sendAs, 0.88) : ok(null));
  $("d-pick").addEventListener("click", () => $("d-file").click());
  /** A photo given is taken in at once: into the plane, and the drift starts from it (with any name already typed). */
  async function takeAndGo(f) {
    const ph = await take(f);
    if (!ph) return;
    const t = $("d-q").value.trim();
    $("d-q").value = "";
    go(t || null, ph, []);
  }
  $("d-file").addEventListener("change", () => takeAndGo($("d-file").files[0]));
  stageEl.addEventListener("dragover", (e) => { if ([...(e.dataTransfer.items || [])].some((i) => i.kind === "file")) e.preventDefault(); });
  stageEl.addEventListener("dragover", (e) => { if ([...(e.dataTransfer.types || [])].includes("text/plain")) e.preventDefault(); });
  stageEl.addEventListener("drop", async (e) => {
    const f = e.dataTransfer.files[0], text = (e.dataTransfer.getData("text/plain") || "").trim();
    if (isImage(f)) { e.preventDefault(); takeAndGo(f); }
    else if (text) { e.preventDefault(); putIn(text.slice(0, 233), null); go(text.slice(0, 233), null, []); }
  });
  document.addEventListener("paste", (e) => { const f = [...(e.clipboardData?.files || [])].find(isImage); if (f) takeAndGo(f); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = $("d-q").value.trim();
    if (!t && !picked) { if (busy) ctl && ctl.abort(); else $("d-q").focus(); return; }   // (empty while drifting: stop)
    putIn(t, picked);
    $("d-q").value = "";
    go(t || null, picked, []);
  });
  /** Drift from a thing: a name, a photo (with or without a name), or a station to go on from. */
  async function go(name, photo, visited) {
    await ready;
    if (busy) { queued = [name, photo, visited]; ctl && ctl.abort(); return; }   // a new thing replaces the drift under way
    if (!sample || claudeOff) {
      say(`It's in the plane. ${claudeOff || "Claude can't be reached from this view"}, so there is no drift to follow this time.`);
      picked = null; $("d-thumb").hidden = true; $("d-file").value = "";
      return;
    }
    let thing = name, images, retry = false;
    if (photo && !photo.canvas && !imagesOk) photo = null;
    if (photo && imagesOk) {
      images = (photo.canvas && (await blobOf(photo.canvas))) || photo.file;
      thing = name ? "the thing in the photo: " + name : null;
    } else if (photo) {
      thing = name ? `the thing in the photo: ${name} (you cannot see the photo here; the page measured it: ${photo.measured})`
        : `a photograph the person put in, which you cannot see here; the page measured it: ${photo.measured}. Drift from what such a picture holds`;
    }
    busy = true; label();
    ctl = new AbortController();
    const start = [vx + VW / 2, vy + VH / 2];
    trip = { thing: name ? name.split(":")[0] : photo ? "the photo" : "the thing", stations: [], at: -1, path: [start], dir: Math.random() * Math.PI * 2, done: false };
    say("Reading the thing. The first station takes a little while.");
    try {
      const { text } = await sample(prompt(thing, visited), {
        signal: ctl.signal, cache: false, images,
        onText: ({ text }) => {
          const objs = lines(text), th = objs.find((o) => o.t === "thing");
          if (th && th.name) trip.thing = th.name;
          trip.stations = objs.filter((o) => o.t === "station" && o.name);
          if (trip.at < 0 && trip.stations.length) show(0);
          else if (trip.at >= 0) show(trip.at);                     // the count goes up as they come
        },
      });
      trip.stations = lines(text).filter((o) => o.t === "station" && o.name);
      trip.done = true;
      if (trip.stations.length) show(Math.max(0, trip.at)); else say("Nothing came back to follow. Try another thing.");
    } catch (e) {
      if (e && e.code === "images_unavailable" && images) retry = true;   // then from what the page measured of it
      else if (e && e.code === "cancelled") { if (!queued) say("Stopped."); }
      else say("It's in the plane. " + (COPY[e && e.code] || "The drift was interrupted; give it again to retry."));
      if (e && (e.code === "not_granted" || e.code === "sampling_disabled")) claudeOff = COPY[e.code].replace(/\.$/, "").replace(/, so the drift is off$/, "");
    } finally {
      busy = false; label();
      if (!queued) { picked = null; $("d-thumb").hidden = true; $("d-file").value = ""; }
    }
    if (retry) { imagesOk = false; go(name, photo, visited); }
    else if (queued) { const q = queued; queued = null; go(...q); }
  }

  // ---- ultracode: a self-reflective propulsion ----------------------------------------------------------------
  // Ultracode (Aries's word): code (Latin cōdex, earlier caudex, a tree's trunk, then the tablets split from it and
  // bound, then a book of laws, then a cipher) that goes beyond itself (ultra-, "on the far side of") by reading
  // itself. As a dynamic, a thing whose next move is driven by a reading of what it has just made, measured against
  // what it made before and against where it has already been; and whose next frame is drawn from where that move took
  // it, so the reading changes, and the loop runs on:
  //     move(t) = thrust( reflect(frame(t), frame(t - 1)), memory(its path to t) ),   frame(t + 1) = draw(view + move(t))
  // To reflect is to bend back (re- + flectere) and to propel is to drive forward (prō- + pellere). A rocket goes forward
  // only by throwing something back; DRIFT goes forward only by looking back at what it has just made. Its fuel is
  // novelty: what it has seen is spent, and is thrown out behind it as its wake. Its parts, each feeding the next:
  //   reflection   about thirteen times a second (every 75 ms) DRIFT reads back a tiny copy of its own last frame
  //                (ground-gl.js, reflect(): a mipmap level ~34 texels across, read into a buffer behind a fence, so
  //                the GPU never waits) and measures it in colour, not only light: its life (how much it changes across
  //                itself), its novelty (how much it has changed since what it saw a third of a second ago, the view's
  //                own motion taken out, over only what both looks saw) and where in the view, in its own proportions,
  //                each stands out;
  //   memory       the squares of the plane (377 cells a side) it has passed through, and when, kept in this browser,
  //                so it remembers where it has been across visits; the recent ones push it away (over ten minutes a
  //                place stops pushing), so it does not circle back to what it has already spent;
  //   propulsion   left alone for a second, both become thrust: toward what is most alive and new, away from where it
  //                has been, harder the more alive and new the view is (at most 105 cells a second; calm, it still
  //                wanders on a little). A craft with a heavy rudder and a strong engine: its heading turns over phi^-1
  //                seconds, so it sweeps rather than twitches, and its throttle answers in phi/5 seconds. A touch, a
  //                drift's glide, a station being read, an anomaly, the Earth, a hidden tab or a preference for
  //                reduced motion stops it at once;
  //   wake         while it drives itself, the collage's melt and streaks run out behind it (ground-gl.js, uThrust), the
  //                more the faster it goes: what it has spent, thrown back, as a rocket's exhaust;
  //   code as matter  until a thing is put in, the collage glues in sheets of DRIFT's own code (these very functions,
  //                read from themselves) headed by their live readings, a new stretch every 34 seconds: the codex read
  //                as texture, taken back to the trunk it was split from.
  const UC = { hist: [], dir: [0, 0], mem: [0, 0], life: 0, novelty: 0, vx: 0, vy: 0, hx: 0, hy: 0, speed: 0, idleAt: performance.now(),
    last: 0, seen: null, given: false, sheetAt: -1e9, line: 0, shownAt: -1e9 };
  const TOP = 105, WAIT = 1000, RUDDER = 1 / PHI, THROTTLE = PHI / 5, LOOKBACK = 377;   // (5 times as propulsive as it was)
  for (const ev of ["pointerdown", "wheel", "keydown", "touchstart"]) addEventListener(ev, () => { UC.idleAt = performance.now(); }, { passive: true, capture: true });
  const onPlane = () => typeof MODE === "undefined" || MODE === "plane";
  /** How far apart two colours are (0 to 255): the one at i in A and the one at j in B. */
  const cdiff = (A, i, B, j) => (Math.abs(A[i] - B[j]) + Math.abs(A[i + 1] - B[j + 1]) + Math.abs(A[i + 2] - B[j + 2])) / 3;
  /** Reflection: the measure of a reading of the last frame (w by h texels, uw by uh of them the view, cells a texel). */
  function reflectOn(r) {
    const { w, uw, uh, data, cells } = r, n = uw * uh, C = new Float32Array(n * 3), side = Math.max(uw, uh);
    for (let y = 0; y < uh; y++) for (let x = 0; x < uw; x++) {
      const i = (y * w + x) * 4, k = (y * uw + x) * 3;
      C[k] = data[i]; C[k + 1] = data[i + 1]; C[k + 2] = data[i + 2];
    }
    // what it saw a third of a second ago (the latest look at least that old, or the oldest it has), moved by as far as
    // the view has moved since, so what changed is the image and not the looking; however often it looks, the change
    // is measured over the same span of time
    const at = r.at || 0, H = UC.hist;
    let E = null;
    for (const h of H) if (at - h.at >= LOOKBACK) E = h;
    if (!E && H.length) E = H[0];
    const P = E && E.uw === uw && E.uh === uh ? E.C : null;
    const sx = E ? Math.round((r.x0 - E.px) / cells) : 0, sy = E ? Math.round((r.y0 - E.py) / cells) : 0;
    const G = new Float32Array(n), D = new Float32Array(n);
    let life = 0, nov = 0, both = 0;
    for (let y = 0; y < uh; y++) for (let x = 0; x < uw; x++) {
      const k = y * uw + x, i = k * 3;
      G[k] = (x + 1 < uw ? cdiff(C, i, C, i + 3) : 0) + (y + 1 < uh ? cdiff(C, i, C, i + uw * 3) : 0);
      const ox = x + sx, oy = y + sy, was = P !== null && ox >= 0 && oy >= 0 && ox < uw && oy < uh;
      D[k] = was ? cdiff(C, i, P, (oy * uw + ox) * 3) : 0;          // (what the last look did not see is not counted as
      if (was) both++;                                               //  new, or the edge it moves toward would always pull)
      life += G[k]; nov += D[k];
    }
    /** Where a field is strongest: the centre of what stands above its own mean, from the view's middle, in the view's
     * own proportions (a busy view is busy everywhere, so only what stands out can point anywhere). */
    const toward = (F, mean) => {
      let cx = 0, cy = 0, s = 0;
      for (let y = 0; y < uh; y++) for (let x = 0; x < uw; x++) {
        const v = F[y * uw + x] - mean;
        if (v > 0) { cx += v * (x + 0.5 - uw / 2) / side; cy += v * (y + 0.5 - uh / 2) / side; s += v; }
      }
      return s > 0 ? [cx / s, cy / s] : [0, 0];
    };
    const tn = both ? toward(D, nov / both) : [0, 0], tl = toward(G, life / n);
    H.push({ C, uw, uh, px: r.x0, py: r.y0, at });
    while (H.length > 2 && at - H[1].at >= LOOKBACK) H.shift();       // (keep what is needed to look a third of a second back)
    UC.life = life / n / 255;
    if (both) UC.novelty = nov / both / 255;
    UC.dir = [tn[0] + 0.382 * tl[0], tn[1] + 0.382 * tl[1]];         // where it is new, and a little where it is alive
    remember();
  }
  // Memory: the squares it has passed through, and when, kept in this browser (a day at most, 377 squares at most).
  const MEM_G = 377, MEM_KEY = "drift-ultracode-places", memory = new Map();
  let memSaved = 0;
  try { for (const [k, t] of JSON.parse(localStorage.getItem(MEM_KEY) || "[]")) if (Date.now() - t < 864e5) memory.set(k, t); } catch (e) { /* none kept */ }
  /** Mark where the view is now; and the push away from where it has been lately (each square within two of this one
   * pushing, the more recent the harder, the nearer the harder). */
  function remember() {
    const cx = vx + VW / 2, cy = vy + VH / 2, i0 = Math.floor(cx / MEM_G), j0 = Math.floor(cy / MEM_G), t = Date.now(), here = i0 + "," + j0;
    memory.delete(here); memory.set(here, t);                        // (the most recent last, so the oldest go first)
    while (memory.size > 377) memory.delete(memory.keys().next().value);
    let mx = 0, my = 0;
    for (let j = j0 - 2; j <= j0 + 2; j++) for (let i = i0 - 2; i <= i0 + 2; i++) {
      const at = i === i0 && j === j0 ? undefined : memory.get(i + "," + j);
      if (at === undefined) continue;
      const dx = cx - (i + 0.5) * MEM_G, dy = cy - (j + 0.5) * MEM_G, d = Math.hypot(dx, dy) || 1;
      const f = Math.exp(-(t - at) / 610000) / (1 + d / MEM_G);
      mx += (dx / d) * f; my += (dy / d) * f;
    }
    const m = Math.hypot(mx, my);
    UC.mem = m > 1 ? [mx / m, my / m] : [mx, my];
    if (t - memSaved > 13000) { memSaved = t; try { localStorage.setItem(MEM_KEY, JSON.stringify([...memory])); } catch (e) { /* not kept */ } }
  }
  /** Propulsion, every frame: the reflection and the memory become thrust while DRIFT is left alone. */
  function propel(now) {
    requestAnimationFrame(propel);
    const dt = Math.min(0.1, (now - (UC.last || now)) / 1000);
    UC.last = now;
    const r = plane() && GLG.reflection && onPlane() ? GLG.reflection() : null;
    if (r && r !== UC.seen) { UC.seen = r; reflectOn(r); }
    const alone = !!UC.seen && onPlane() && now - UC.idleAt > WAIT && !flight && !(typeof ANOM !== "undefined" && ANOM.at) && !REDUCED
      && !(typeof down !== "undefined" && down) && !document.hidden && !(!at.hidden && now - UC.shownAt < 34000);
    // toward what is most alive and new, and away from where it has been
    // and, while Plectra (cast.js) is in view, toward the shade she wants, at phi^-1
    const sp = typeof STAR !== "undefined" && STAR.shadePull ? STAR.shadePull : [0, 0];
    const tx = UC.dir[0] * 3 + UC.mem[0] * 0.618 + sp[0] / PHI, ty = UC.dir[1] * 3 + UC.mem[1] * 0.618 + sp[1] / PHI, tm = Math.hypot(tx, ty);
    const fuel = Math.min(1, Math.max(0.236, UC.life * 2.6 + UC.novelty * 8));
    const want = alone && tm > 0.02 ? TOP * fuel * Math.min(1, tm) : 0;
    // the rudder: the heading turns toward the thrust over phi^-1 seconds (from rest it takes the thrust's heading at once)
    if (tm > 0.02) {
      const kr = UC.hx || UC.hy ? 1 - Math.exp(-dt / RUDDER) : 1;
      let hx = UC.hx + (tx / tm - UC.hx) * kr, hy = UC.hy + (ty / tm - UC.hy) * kr;
      const hm = Math.hypot(hx, hy);
      if (hm > 1e-6) { UC.hx = hx / hm; UC.hy = hy / hm; }
    }
    // the throttle: the speed answers in phi/5 seconds; let go of within a fifth of a second, whatever the frame rate
    UC.speed += (want - UC.speed) * (1 - Math.exp(-dt / (alone ? THROTTLE : 0.2)));
    UC.vx = UC.hx * UC.speed; UC.vy = UC.hy * UC.speed;
    if (alone) { vx += UC.vx * dt; vy += UC.vy * dt; }
    if (plane() && GLG.setThrust) GLG.setThrust(UC.vx, UC.vy);       // its wake, in the collage
    if (!UC.given && plane() && onPlane() && now - UC.sheetAt > 34000) {                // code, and every other time a character's card
      UC.sheetAt = now; UC.sheets = (UC.sheets || 0) + 1;
      GLG.putIn((UC.sheets % 2 === 0 && castCard()) || codeSheet(), vx + VW / 2, vy + VH / 2, { quiet: true, share: 0.618 });
    }
  }
  /** Code as matter: a sheet of DRIFT's own code (these functions), a new stretch each time, headed by its readings. */
  function codeSheet() {
    const lines = [reflectOn, remember, propel, codeSheet].map((f) => f.toString()).join("\n\n").split("\n");
    const c = document.createElement("canvas"); c.width = 1024; c.height = 640;
    const x = c.getContext("2d"), mono = getComputedStyle(document.documentElement).getPropertyValue("--mono").trim() || "ui-monospace, Menlo, Consolas, monospace";
    x.fillStyle = "#eee7d8"; x.fillRect(0, 0, c.width, c.height);
    x.font = `500 17px ${mono}`;
    x.fillStyle = "#d23c28";
    x.fillText(`ultracode · life ${UC.life.toFixed(3)} · new ${UC.novelty.toFixed(3)} · remembers ${memory.size} places · ${Math.hypot(UC.vx, UC.vy).toFixed(1)} cells a second`, 21, 34);
    x.fillStyle = "#17120e";
    for (let i = 0; i < 27; i++) x.fillText(lines[(UC.line + i) % lines.length].replace(/\t/g, "  "), 21, 68 + i * 21.5);
    UC.line = (UC.line + 27) % lines.length;
    return c;
  }
  /** A title card for Falling Like Leaves (cast.js): the character nearest the middle of the view, else any, in the
   * colours of its plant, with the place on Earth where its plant thrives. */
  function castCard() {
    if (typeof STAR === "undefined" || typeof CASTED === "undefined" || !CASTED.size) return null;
    const mx = vx + VW / 2, my = vy + VH / 2;
    const near = STAR.list.slice().sort((p, q) => Math.hypot(p.x - mx, p.y - my) - Math.hypot(q.x - mx, q.y - my))[0];
    const all = [...CASTED.values()], c = near ? near.c : all[Math.floor(Math.random() * all.length)];
    const pl = (typeof PLANT !== "undefined" && PLANT.find((p) => p.plant === c.plant)) || null;
    const leaf = near ? near.cols : pl ? pl.leaf : [[170, 60, 140], [60, 30, 70], [90, 140, 70], [200, 220, 110]];
    const fl = near ? near.flower : pl ? pl.flower : [[250, 240, 120], [170, 60, 140], [90, 30, 90]];
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 640;
    const x = cv.getContext("2d"), rgb = (q) => `rgb(${q.map(Math.round).join(",")})`;
    const css = getComputedStyle(document.documentElement), serif = css.getPropertyValue("--serif").trim() || "Georgia, serif",
      mono = css.getPropertyValue("--mono").trim() || "ui-monospace, Menlo, monospace";
    const dark = leaf.slice().sort((p, q) => lum(p) - lum(q))[0];
    if (typeof SEED !== "undefined") SEED = { leaf: leaf.slice(), at: performance.now() };   // the credits become the soil
    x.fillStyle = rgb(dark.map((v) => v * 0.35)); x.fillRect(0, 0, 1024, 640);
    // the flower, large, on the left: petals round a heart
    const n = c.action === "void" ? 0 : 7, R = 190;
    for (let k = 0; k < n; k++) { x.save(); x.translate(250, 320); x.rotate(k * Math.PI * 2 / n); x.fillStyle = rgb(fl[1]);
      x.beginPath(); x.ellipse(R * 0.5, 0, R * 0.5, R * 0.2, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = rgb(fl[2]);
      x.beginPath(); x.ellipse(R * 0.82, 0, R * 0.16, R * 0.11, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
    x.fillStyle = rgb(fl[0]); x.beginPath(); x.arc(250, 320, n ? 34 : 120, 0, Math.PI * 2); x.fill();
    // the leaves' spectrum, a band along the foot
    leaf.forEach((q, k) => { x.fillStyle = rgb(q); x.fillRect(k * 256, 604, 256, 36); });
    const lat = `${Math.abs(c.lat).toFixed(2)}° ${c.lat < 0 ? "S" : "N"}  ${Math.abs(c.lon).toFixed(2)}° ${c.lon < 0 ? "W" : "E"}`;
    x.fillStyle = "#efe8d8"; x.font = `500 15px ${mono}`;
    x.fillText("FALLING LIKE LEAVES", 500, 96);
    x.font = `italic 400 76px ${serif}`; x.fillText(c.name, 500, 196);
    x.font = `italic 400 25px ${serif}`;
    const wrap = (txt, y0, max, lh) => { let line = "", y = y0; for (const wd of txt.split(" ")) { if (x.measureText(line + wd).width > max) { x.fillText(line, 500, y); line = ""; y += lh; } line += wd + " "; } x.fillText(line, 500, y); return y + lh; };
    let y = wrap(c.role, 238, 480, 31);
    x.font = `500 15px ${mono}`; x.fillStyle = rgb(fl[1].map((v) => Math.min(255, v + 40)));
    x.fillText(`${c.plant.toUpperCase()}${c.artist ? "  ·  " + c.artist.toUpperCase() : ""}`, 500, y + 14);
    x.fillStyle = "#efe8d8"; x.fillText(c.place, 500, y + 44); x.fillText(lat, 500, y + 66);
    x.font = `400 14px ${mono}`; x.fillText(c.climate, 500, y + 88);
    x.font = `italic 400 21px ${serif}`; y = wrap(`after ${c.after}, ${c.performance} (${c.year})`, y + 136, 480, 27);
    return cv;
  }
  requestAnimationFrame(propel);
  UC.places = () => memory.size; UC.castCard = castCard;
  window.ULTRACODE = UC;                                              // its state, to look at
  document.addEventListener("keydown", (e) => {
    if (!trip || at.hidden || /^(input|textarea)$/i.test(document.activeElement && document.activeElement.tagName)) return;
    if (e.key === "]" && trip.at < trip.stations.length - 1) show(trip.at + 1);
    if (e.key === "[" && trip.at > 0) show(trip.at - 1);
  });
})();
