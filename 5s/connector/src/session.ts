/* Each MCP session belongs to the person who opened it.
 *
 * McpAgent routes a request to a session's Durable Object by the Mcp-Session-Id header alone, and
 * that object keeps the identity (and the GitHub token) of whoever opened it. So without a check,
 * anyone signed in to 5s who learned someone else's session id (from a log, a proxy, a screenshot)
 * could use that session as them. The MCP security best practices ask servers to bind session ids
 * to the user; this does it without any storage:
 *
 *   the id the person's client sees = <the agent's id> "." base64url(HMAC-SHA256(key, <GitHub id> "\n" <the agent's id>))
 *
 * The key is derived from the Worker secret COOKIE_ENCRYPTION_KEY. Only the Worker can make a tag,
 * and it makes one only for the person whose sign-in opened the session, so a request signed in as
 * anyone else (or with a tampered id) is answered "Session not found" before it reaches the session.
 *
 * Also stripped from every request: the headers the agents package uses between the Worker and its
 * Durable Objects (props, the forwarded MCP message), so a client can never supply them itself.
 */

const LABEL = "5s mcp session v1|";
const encoder = new TextEncoder();

/** The HMAC key for session tags, or null when COOKIE_ENCRYPTION_KEY is missing or shorter than 32 characters. */
export async function sessionKey(secret: string | undefined | null): Promise<CryptoKey | null> {
	if (typeof secret !== "string" || secret.length < 32) return null;
	return crypto.subtle.importKey("raw", encoder.encode(LABEL + secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function toBase64url(buf: ArrayBuffer) {
	let bin = "";
	for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Uint8Array | null {
	if (!/^[A-Za-z0-9_-]{43}$/.test(s)) return null; // 32 bytes
	const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=");
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	// Only the canonical spelling: the last character's two spare bits must be zero, so each tag has one form.
	return toBase64url(out.buffer) === s ? out : null;
}

// The agents package's own session ids are Durable Object ids: 64 hex characters.
const RAW_ID = /^[A-Za-z0-9_-]{8,128}$/;

/** The session id to hand to the client: the agent's id, tagged for this person. */
export async function bindSession(key: CryptoKey, person: string, raw: string): Promise<string> {
	const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(String(person) + "\n" + raw));
	return raw + "." + toBase64url(mac);
}

/** The agent's id inside a client's session id, or null unless the tag is this person's. */
export async function unbindSession(key: CryptoKey, person: string, sent: string | null | undefined): Promise<string | null> {
	if (typeof sent !== "string") return null;
	const i = sent.lastIndexOf(".");
	if (i <= 0) return null;
	const raw = sent.slice(0, i);
	const mac = fromBase64url(sent.slice(i + 1));
	if (!mac || !RAW_ID.test(raw)) return null;
	const ok = await crypto.subtle.verify("HMAC", key, mac, encoder.encode(String(person) + "\n" + raw));
	return ok ? raw : null;
}

/** Headers only the Worker may set on the way to a session's Durable Object. */
export function isInternalHeader(name: string) {
	const n = name.toLowerCase();
	return n.startsWith("cf-mcp-") || n.startsWith("x-agents-") || n.startsWith("x-cf-agents-") || n.startsWith("x-partykit-");
}

const json = (status: number, code: number, message: string) =>
	new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
	});

type Fetcher = { fetch(request: Request, env: any, ctx: any): Promise<Response> | Response };

/**
 * serveBound(inner, request, env, ctx, person) -> /mcp through `inner` (McpAgent.serve), after checking
 * the client's session id belongs to `person` (their GitHub id): the inner handler gets the agent's
 * own id, and the reply's id comes back tagged for this person. Internal headers never pass.
 */
export async function serveBound(inner: Fetcher, request: Request, env: { COOKIE_ENCRYPTION_KEY?: string }, ctx: unknown, person: string): Promise<Response> {
	const key = await sessionKey(env.COOKIE_ENCRYPTION_KEY);
	if (!key) return json(503, -32603, "Not set up yet: the COOKIE_ENCRYPTION_KEY secret is missing or too short.");
	const headers = new Headers();
	request.headers.forEach((value, name) => {
		if (!isInternalHeader(name)) headers.set(name, value);
	});
	const sent = request.headers.get("mcp-session-id");
	if (sent !== null) {
		const raw = await unbindSession(key, person, sent);
		// The same answer the agents package gives for an unknown session, so the client starts a new one.
		if (!raw) return json(404, -32001, "Session not found");
		headers.set("mcp-session-id", raw);
	}
	const res = await inner.fetch(new Request(request, { headers }), env, ctx);
	const raw = res.headers.get("mcp-session-id");
	if (!raw) return res;
	const out = new Headers(res.headers);
	out.set("mcp-session-id", await bindSession(key, person, raw));
	return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

/*
 * Each session's Durable Object ends a day after it starts (README "What it costs: nothing"). On
 * Workers Free every Durable Object shares 5 GB, and a session's object, with the agents package's
 * tables, takes about 136 KB (34 SQLite pages, measured under wrangler dev) that nothing would ever
 * delete: Claude seldom ends a session itself, and a person opens about two a day. The person's 5s is
 * in their own object (FiveSPerson), so nothing of theirs goes: a later request on the ended session
 * is answered "Session not found", and the MCP client starts a new session, as the protocol asks.
 */
export const SESSION_LIFETIME_S = 24 * 3600;
/** A session used within this many seconds when its day is up is given this much longer. */
export const SESSION_GRACE_S = 3600;

type SessionObject = {
	listSchedules(): Promise<{ callback?: unknown }[]>;
	schedule(when: number, callback: "endSession", payload?: undefined, options?: { idempotent?: boolean }): Promise<unknown>;
	destroy(): Promise<void>;
};

/** Called each time a session's object wakes (McpAgent init): its end is set once, so a wake writes no row. */
export async function scheduleEnd(agent: SessionObject): Promise<boolean> {
	if ((await agent.listSchedules()).some((s) => s.callback === "endSession")) return false;
	await agent.schedule(SESSION_LIFETIME_S, "endSession", undefined, { idempotent: true });
	return true;
}

/** The scheduled end: deleted, unless a tool was called in the last hour (only an object still awake knows), then an hour more. */
export async function endSession(agent: SessionObject, lastCallMs: number, now: number): Promise<boolean> {
	if (lastCallMs > 0 && now - lastCallMs < SESSION_GRACE_S * 1000) {
		// Not idempotent: the schedule that is firing still exists and would be matched instead.
		await agent.schedule(SESSION_GRACE_S, "endSession");
		return false;
	}
	await agent.destroy();
	return true;
}
