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
      if (imagesOk) say("This browser can't show that photo's format, so it can't go into the plane, but Claude can still read it. Drift when ready.");
      else { picked = null; say("This browser can't open that photo's format (it may be HEIC). A screenshot of it, or a JPEG or PNG, will go in."); }
      return picked;
    }
    const canvas = fitted(im, 1024);
    picked = { file, canvas, measured: measure(canvas) };
    $("d-thumb").src = canvas.toDataURL("image/jpeg", 0.6); $("d-thumb").hidden = false; $("d-thumb").alt = "The photo put in";
    if (plane()) GLG.putIn(canvas, vx + VW / 2, vy + VH / 2);
    label();
    if (!sample) say("The photo is in the plane.");
    else if (!imagesOk) say("The photo is in the plane. Claude can't be sent pictures in this view, so the drift will follow its colours and light; add a name for more, then Drift.");
    else say("The photo is in the plane. Add a name if you like, then Drift.");
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
    GLG.putIn(wordSheet(name), vx + VW / 2, vy + VH / 2);
  }
  let queued = null, claudeOff = "";
  /** The button says Stop only while a drift is under way and nothing new is waiting to go in; else it takes it in. */
  const label = () => { $("d-go").textContent = busy && !$("d-q").value.trim() && !picked ? "Stop" : "Drift"; };
  $("d-q").addEventListener("input", label);
  const blobOf = (canvas) => new Promise((ok) => sendAs ? canvas.toBlob(ok, sendAs, 0.88) : ok(null));
  $("d-pick").addEventListener("click", () => $("d-file").click());
  $("d-file").addEventListener("change", () => take($("d-file").files[0]));
  stageEl.addEventListener("dragover", (e) => { if ([...(e.dataTransfer.items || [])].some((i) => i.kind === "file")) e.preventDefault(); });
  stageEl.addEventListener("dragover", (e) => { if ([...(e.dataTransfer.types || [])].includes("text/plain")) e.preventDefault(); });
  stageEl.addEventListener("drop", async (e) => {
    const f = e.dataTransfer.files[0], text = (e.dataTransfer.getData("text/plain") || "").trim();
    if (isImage(f)) { e.preventDefault(); const ph = await take(f); if (ph) go(null, ph, []); }
    else if (text) { e.preventDefault(); putIn(text.slice(0, 233), null); go(text.slice(0, 233), null, []); }
  });
  document.addEventListener("paste", (e) => { const f = [...(e.clipboardData?.files || [])].find(isImage); if (f) take(f); });
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
  document.addEventListener("keydown", (e) => {
    if (!trip || at.hidden || /^(input|textarea)$/i.test(document.activeElement && document.activeElement.tagName)) return;
    if (e.key === "]" && trip.at < trip.stations.length - 1) show(trip.at + 1);
    if (e.key === "[" && trip.at > 0) show(trip.at - 1);
  });
})();
