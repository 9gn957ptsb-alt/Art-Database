/* What it costs: nothing (README "What it costs: nothing"). The free-plan numbers the connector is
 * built to, what one person's day of 5s uses of each, and how many people a day that makes room for.
 * index.ts takes TOKEN_LIFETIMES from here; test/free.test.mjs checks the arithmetic, and the README
 * prints it.
 *
 * Cloudflare's Workers Free plan (developers.cloudflare.com, Workers, Workers KV and Durable Objects
 * pricing and limits pages; a limit reached makes that kind of operation fail until 00:00 UTC):
 */
export const FREE_PLAN = Object.freeze({
  workerRequests: 100000,     // a day
  workerCpuMs: 10,            // a request (time waiting on fetch, KV or a Durable Object does not count)
  subrequests: 50,            // a request
  doRequests: 100000,         // a day: requests and RPC calls to Durable Objects
  doRowsWritten: 100000,      // a day (SQLite-backed Durable Objects; a delete counts as a row written)
  doRowsRead: 5000000,        // a day
  doStorageGB: 5,             // in all (1 GB a single object)
  doDurationGBs: 13000,       // a day, while an object is awake (128 MB each)
  kvReads: 100000,            // a day
  kvWrites: 1000,             // a day
  kvDeletes: 1000,            // a day
  kvStorageGB: 1,
});

/**
 * Token lifetimes for the OAuth provider (index.ts). The provider writes to KV only when it makes
 * tokens: a sign-in at most SIGNIN_KV_WRITES keys (two short-lived transaction records, the grant,
 * the grant again at the code exchange, the access token), plus 1 when Claude registers itself as a
 * client; a refresh REFRESH_KV_WRITES (the grant and the new access token); using a token none.
 * Access tokens last 7 days, so a person who comes back every day refreshes once a week; the sign-in
 * itself lasts as long as it is used, ending after 90 days without any use.
 */
export const TOKEN_LIFETIMES = Object.freeze({
  accessTokenTTL: 7 * 24 * 3600,
  refreshTokenTTL: 90 * 24 * 3600,
  refreshTokenIdleTTL: 90 * 24 * 3600,
});
export const SIGNIN_KV_WRITES = 5;
export const REGISTER_KV_WRITES = 1;
export const REFRESH_KV_WRITES = 2;

/**
 * What each piece of 5s uses, counted from the code (agents 0.28.1 McpAgent, src/person.js,
 * src/tools.js, @cloudflare/workers-oauth-provider 1.2.3):
 *   - every request to /mcp: 1 Worker request; 1 KV read (the provider looks up the token); 3
 *     requests to the session's Durable Object (start it, ask whether the session is initialised, the
 *     call itself); initialize 1 more (it keeps the request)
 *   - a new session: its Durable Object makes the agents package's tables once (about 16 rows), keeps
 *     the initialize request (1 row) and the session's props (1 row; index.ts writes them again only
 *     when they change); with the event store off (index.ts getEventStore), a tool call writes nothing there
 *   - every tool call: 1 request to the person's Durable Object to read their 5s, 1 more to save it
 *     when the tool changes it; a save is 1 row written
 *   - the end of a session, a day after it starts (session.ts): its alarm wakes it (1 request), setting
 *     that end wrote 2 rows (the schedule and the alarm), and ending it writes a marker and deletes the
 *     object's rows (about 11; a delete counts as a row written)
 */
export const PER = Object.freeze({
  sessionRequests: 4,          // initialize, notifications/initialized, tools/list, the GET event stream
  doRequestsPerMcpRequest: 3,
  doRequestsInitialize: 1,
  rowsPerNewSession: 16 + 1 + 1,
  doRequestsSessionEnd: 1,
  rowsPerSessionEnd: 2 + 1 + 11,
  kvReadsPerMcpRequest: 1,
  // Duration: an object is counted (at 128 MB) only while it is awake and can't hibernate; a call keeps
  // its session's object awake for about half a second, a bring_in for as long as the sites take.
  awakeSecondsPerCall: 0.5,
  awakeSecondsBringIn: 10,
  objectGB: 0.128,
});

/**
 * A person's ordinary day: two sessions (a chat, and the 5s app opening), a five played in the chat
 * (next_five, judge × 5, get_taste) and the app's sync (get_state, put_state): 9 tool calls, 7 of
 * which save; one bring_in counted at 10 seconds of waiting on other sites. A refresh of their
 * sign-in once a week.
 */
export function personDay(o) {
  const d = Object.assign({ sessions: 2, toolCalls: 9, saves: 7, refreshesPerDay: 1 / 7, bringIns: 1 }, o || {});
  const mcpRequests = d.sessions * PER.sessionRequests + d.toolCalls;
  return {
    sessions: d.sessions, toolCalls: d.toolCalls, saves: d.saves,
    workerRequests: mcpRequests,
    kvReads: mcpRequests * PER.kvReadsPerMcpRequest,
    doRequests: mcpRequests * PER.doRequestsPerMcpRequest + d.sessions * (PER.doRequestsInitialize + PER.doRequestsSessionEnd) + d.toolCalls + d.saves,
    rowsWritten: d.sessions * (PER.rowsPerNewSession + PER.rowsPerSessionEnd) + d.saves,
    kvWrites: d.refreshesPerDay * REFRESH_KV_WRITES,
    durationGBs: +((mcpRequests * PER.awakeSecondsPerCall + d.bringIns * PER.awakeSecondsBringIn) * PER.objectGB).toFixed(2),
  };
}

export const PERSON_DAY = Object.freeze(personDay());

/** How many people a day each free limit leaves room for, and the least of them. */
export function capacity(day, plan) {
  const d = day || PERSON_DAY, p = plan || FREE_PLAN;
  const by = {
    workerRequests: Math.floor(p.workerRequests / d.workerRequests),
    kvReads: Math.floor(p.kvReads / d.kvReads),
    doRequests: Math.floor(p.doRequests / d.doRequests),
    doRowsWritten: Math.floor(p.doRowsWritten / d.rowsWritten),
    kvWrites: Math.floor(p.kvWrites / d.kvWrites),
    doDuration: Math.floor(p.doDurationGBs / d.durationGBs),
  };
  const least = Object.entries(by).sort((a, b) => a[1] - b[1])[0];
  return { by, people: least[1], limit: least[0] };
}
