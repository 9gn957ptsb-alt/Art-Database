/* What put_state accepts: the shape of a 5s state (SPEC "State"), checked field by field, so that
 * no state the connector keeps can make a tool fail later. The engine fills in what is missing
 * (FiveS.migrate) and keeps unknown fields; this only refuses values of the wrong type, and lists
 * longer than any person makes. Limits are generous: the app's own fields are shorter (a note is at
 * most 500 characters, a set's name 80, a brought thing's name 60).
 */
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const optNum = (x) => x == null || isNum(x);
const isStr = (x, max) => typeof x === 'string' && x.length <= max;
const optStr = (x, max) => x == null || isStr(x, max);
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const SLOTS = ['wall', 'window', 'picture', 'floor', 'object'];

export const LIMITS = Object.freeze({ judgments: 50000, sets: 500, own: 1000, notes: 5000, days: 5000, text: 2000, name: 200 });

function judgment(e) {
  if (!Array.isArray(e) || e.length < 4 || e.length > 8) return 'is not [card, keep, ms, time, turn]';
  if (typeof e[0] !== 'string' || !ID.test(e[0])) return 'does not start with a card id';
  if (![0, 1, true, false].includes(e[1])) return 'has a keep that is not 1 or 0';
  if (!optNum(e[2])) return 'has a time to decide that is not a number';
  if (!isNum(e[3])) return 'has a time that is not a number';
  if (e[4] != null && ![-1, 0, 1].includes(e[4])) return 'has a turn that is not -1, 0 or 1';
  return '';
}

function own(o) {
  if (!isObj(o)) return 'is not an object';
  if (typeof o.id !== 'string' || !ID.test(o.id)) return 'has no id';
  if (!optStr(o.kind, 20) || !optStr(o.name, LIMITS.name) || !optStr(o.source, LIMITS.name)) return 'has a kind, name or source that is not short text';
  if (o.colours != null && !(Array.isArray(o.colours) && o.colours.length <= 16 && o.colours.every((h) => typeof h === 'string' && HEX.test(h)))) return 'has colours that are not hex colours';
  if (o.crop != null && !(Array.isArray(o.crop) && o.crop.length === 4 && o.crop.every(isNum))) return 'has a crop that is not four numbers';
  for (const k of ['texture', 'w', 'h', 'at', 'let', 'seenAt']) if (!optNum(o[k])) return 'has a ' + k + ' that is not a number';
  return '';
}

function set(s) {
  if (!isObj(s)) return 'is not an object';
  if (!optNum(s.at) || !optStr(s.name, LIMITS.name)) return 'has a time or name of the wrong kind';
  for (const k of SLOTS) if (!(s[k] == null || (typeof s[k] === 'string' && ID.test(s[k])))) return 'has a ' + k + ' that is not a card id';
  return '';
}

function note(n) {
  if (!isObj(n)) return 'is not an object';
  if (!optNum(n.at) || !optStr(n.q, 20) || !optStr(n.text, LIMITS.text) || !optStr(n.ref, 100)) return 'has a time, question, text or reference of the wrong kind';
  return '';
}

function list(s, key, max, each) {
  const xs = s[key];
  if (xs === undefined) return '';
  if (!Array.isArray(xs)) return 'state.' + key + ' must be a list.';
  if (xs.length > max) return 'state.' + key + ' has more than ' + max + ' entries.';
  for (let i = 0; i < xs.length; i++) {
    const why = each(xs[i]);
    if (why) return 'state.' + key + '[' + i + '] ' + why + '.';
  }
  return '';
}

/** checkState(s) -> '' when the state is fine, else one plain sentence saying what is wrong. */
export function checkState(s) {
  if (!isObj(s)) return 'The state must be an object.';
  const why = list(s, 'j', LIMITS.judgments, judgment) ||
    list(s, 'sets', LIMITS.sets, set) ||
    list(s, 'days', LIMITS.days, (d) => (isStr(d, 20) ? '' : 'is not a date')) ||
    list(s, 'own', LIMITS.own, own) ||
    list(s, 'notes', LIMITS.notes, note);
  if (why) return why;
  if (s.five != null) {
    const f = s.five;
    if (!isObj(f) || !Array.isArray(f.ids) || f.ids.length > 10 || !f.ids.every((id) => typeof id === 'string' && ID.test(id))) return 'state.five must have ids: a list of card ids.';
    if (f.i != null && !(Number.isInteger(f.i) && f.i >= 0 && f.i <= f.ids.length)) return 'state.five.i must count the cards judged so far.';
    if (!optStr(f.day, 20) || !(f.n == null || (Number.isInteger(f.n) && f.n >= 1))) return 'state.five has a day or number of the wrong kind.';
  }
  if (s.seen != null && !isObj(s.seen)) return 'state.seen must be an object.';
  if (s.seen && s.seen.path != null && !(Array.isArray(s.seen.path) && s.seen.path.every((k) => isStr(k, 40)))) return 'state.seen.path must be a list of milestone names.';
  if (s.opts != null && !isObj(s.opts)) return 'state.opts must be an object.';
  if (s.hub != null) {
    const h = s.hub;
    if (!isObj(h)) return 'state.hub must be an object.';
    // The engine's setHub keeps whatever was typed (trimmed, at most 100 and 39 characters), so any
    // short text is kept here too; the tools check GitHub's rules before using or repeating it.
    if (!optStr(h.name, 100)) return 'state.hub.name must be text of at most 100 characters.';
    if (!optStr(h.user, 39)) return 'state.hub.user must be text of at most 39 characters.';
    if (!(h.private == null || typeof h.private === 'boolean') || !optStr(h.mode, 10) || !optStr(h.savedCode, 40)) return 'state.hub has a field of the wrong kind.';
    for (const k of ['madeAt', 'savedAt']) if (!optNum(h[k])) return 'state.hub.' + k + ' must be a time.';
  }
  return '';
}
