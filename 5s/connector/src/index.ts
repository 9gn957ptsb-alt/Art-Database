/* 5s as a Claude connector: a remote MCP server on Cloudflare Workers, signed in with GitHub.
 *
 * The shape of cloudflare/ai demos/remote-mcp-github-oauth: @cloudflare/workers-oauth-provider is the
 * OAuth server Claude talks to (discovery, client registration, tokens), GitHub is the upstream
 * identity (github-handler.ts), and the agents package's McpAgent serves the MCP endpoint at /mcp.
 * The tools themselves are plain handlers in tools.js.
 */
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { DurableObject } from "cloudflare:workers";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { GitHubHandler } from "./github-handler";
import { githubFetch, type Props } from "./utils";
import { registerTools, SERVER_INSTRUCTIONS } from "./tools.js";
import { guardedStore } from "./store.js";
import { personStore, personRpcStore, personName } from "./person.js";
// Token lifetimes for Workers KV's free 1,000 writes a day (costs.js, README "What it costs: nothing").
import { TOKEN_LIFETIMES } from "./costs.js";
import { api } from "./hub.js";
import { createFakeGitHub } from "./fake-github.js";
import { createWeb } from "./web.js";
import { createFakeWeb } from "./fake-web.js";
import { serveBound, scheduleEnd, endSession } from "./session";
// The artist's deck, trimmed for the connector by `npm run deck` (gitignored: data derived from Artsy and The Architectural Authority).
import deck from "./deck.generated.json";

const VERSION = "0.1.0";
const DEV_TOKEN = "dev-fake-token";
const DEV_FAKE_KEY = "dev:fake-github";

export class FiveSMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({ name: "5s", version: VERSION }, { instructions: SERVER_INSTRUCTIONS });

	/**
	 * McpAgent keeps a session's props in Durable Object storage so it can wake from hibernation.
	 * The GitHub token must live only in the OAuth provider's encrypted props, so storage gets the
	 * props without it. The token stays in memory for the running session, and every request to
	 * /mcp brings it again (the provider decrypts it from the bearer token and passes it in).
	 */
	async updateProps(props?: Props) {
		const { accessToken: _token, ...withoutToken } = (props ?? {}) as Props;
		// Written only when they change: the object starts again after every pause in a chat, and on
		// Workers Free each row written counts (costs.js). A read costs far less.
		const stored = await this.ctx.storage.get("props");
		if (JSON.stringify(stored) !== JSON.stringify(withoutToken)) await this.ctx.storage.put("props", withoutToken);
		this.props = props as Props;
	}

	/**
	 * No event store: the agents package would otherwise write every answer into this object's storage
	 * and delete it again once sent (about 4 rows written a tool call), so a client could resume a
	 * stream the edge cut. Every 5s tool answers within 30 seconds, so a cut stream is simply asked
	 * again, and Workers Free's 100,000 rows written a day go to people's 5s instead (costs.js).
	 */
	protected getEventStore() {
		return undefined;
	}

	async init() {
		registerTools(this.server, () => this.toolContext());
		// This object is deleted a day after it starts, so sessions never fill Workers Free's 5 GB (session.ts).
		await scheduleEnd(this);
	}

	/** When the last tool call came, in memory only (nothing written): endSession spares a session in use. */
	private lastCall = 0;

	async endSession() {
		await endSession(this, this.lastCall, Date.now());
	}

	private async toolContext() {
		this.lastCall = Date.now();
		const p = this.props;
		if (!p || !p.id || !p.login) throw new Error("No signed-in person on this session");
		let github = null;
		if (p.dev && this.env.DEV_FAKE_USER) github = await devGitHub(this.env, p);
		else if (p.accessToken) github = api(p.accessToken, githubFetch);
		// Connect your apps (read_link, bring_in, item_image): the public web, read through web.js's
		// guard (addresses, DNS, redirects, byte caps, timeouts, a request budget per call). Under the dev
		// bypass the web is a fake too (fake-web.js, behind the same guard), so local tests read nothing real.
		const devWeb = p.dev && this.env.DEV_FAKE_USER ? createFakeWeb() : null;
		const webFetch = devWeb ? devWeb.fetch : (input: RequestInfo, init?: RequestInit) => fetch(input, init);
		const web = (o: { budget?: number }) => createWeb({ fetch: webFetch, budget: o && o.budget });
		const limiter = this.env.RATE_LIMIT_WEB;
		const limitWeb = limiter ? async () => (await limiter.limit({ key: "web:" + p.id })).success : undefined;
		// COLOUR_BUDGET_PX (wrangler.jsonc vars): pixels one call may decode here. "0" on Workers Free,
		// whose 10 ms of CPU a request can't decode a picture: colours are then read by the 5s app.
		const budget = String(this.env.COLOUR_BUDGET_PX ?? "").trim();
		const colourBudgetPx = /^\d{1,9}$/.test(budget) ? Number(budget) : undefined;
		// The person's 5s lives in their own SQLite-backed Durable Object (FiveSPerson, person.js), not in
		// this session's object: a person opens a new session each time, their 5s stays in one place.
		const store = guardedStore(personRpcStore(this.env.PERSON, p.id));
		return { store, deck, github, user: { id: p.id, login: p.login }, web, limitWeb, colourBudgetPx };
	}
}

/**
 * FiveSPerson: one person's 5s (their state and the hubs 5s made for them), one SQLite-backed Durable
 * Object per GitHub user id, named "person:<id>". On Workers Free: 100,000 rows written a day for the
 * whole connector, one row for each save of a state. Only the Worker's own code can reach it (a
 * Durable Object has no address of its own), and each call must name the person the object is for:
 * a call for anyone else is refused.
 */
export class FiveSPerson extends DurableObject<Env> {
	private store: ReturnType<typeof personStore> | null = null;

	private storeFor(uid: string) {
		const name = personName(uid);
		// Native ctx.id.name is the name the object was addressed by (idFromName). Fail closed without it.
		if (this.ctx.id.name !== name) throw new Error("This is not that person's 5s.");
		if (!this.store) {
			this.store = personStore(this.ctx.storage.sql, { uid });
		}
		return this.store;
	}

	async get(uid: string, key: string): Promise<string | null> {
		return this.storeFor(uid).get(key);
	}

	async put(uid: string, key: string, value: string): Promise<void> {
		await this.storeFor(uid).put(key, value);
	}
}

// --------------------------------------------------------------- local dev only

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** DEV_FAKE_USER = "login" or "id:login" (in .dev.vars only); a comma-separated list names several people. */
function devPeople(value: string): Props[] {
	return value.split(",").map((one, i) => {
		const m = /^(?:(\d{1,12}):)?([A-Za-z0-9-]{1,39})$/.exec(one.trim());
		if (!m) throw new Error('DEV_FAKE_USER must look like "artist-dev", "1001:artist-dev" or "1001:artist-dev,1002:other-dev"');
		return { id: m[1] || String(1001 + i), login: m[2], accessToken: DEV_TOKEN, scopes: ["read:user", "public_repo"], dev: true };
	});
}

/** The first person in DEV_FAKE_USER, or the one an X-5s-Dev-User header names (only people listed there). */
function devProps(value: string, request: Request): Props | null {
	const people = devPeople(value);
	const asked = request.headers.get("x-5s-dev-user");
	if (!asked) return people[0];
	return people.find((p) => p.login.toLowerCase() === asked.trim().toLowerCase()) || null;
}

/** A fake GitHub that remembers its repositories in the local OAUTH_KV (wrangler dev only), so make_hub then save_hub works across requests. */
async function devGitHub(env: Env, p: Props) {
	const fake = createFakeGitHub({ users: [{ token: DEV_TOKEN, id: Number(p.id) || 1001, login: p.login }] });
	fake.restore(await env.OAUTH_KV.get(DEV_FAKE_KEY, "json"));
	const fetchAndKeep = async (input: RequestInfo, init?: RequestInit) => {
		const res = await fake.fetch(input, init);
		await env.OAUTH_KV.put(DEV_FAKE_KEY, JSON.stringify(fake.snapshot()));
		return res;
	};
	return api(DEV_TOKEN, fetchAndKeep, { base: fake.base });
}

// --------------------------------------------------------------- the Worker

const mcpHandler = FiveSMCP.serve("/mcp", { binding: "MCP_OBJECT" });

const plain = (status: number, text: string, extra?: Record<string, string>) =>
	new Response(text, { status, headers: Object.assign({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, extra || {}) });

/**
 * /mcp for a signed-in person (the provider has checked the token and set ctx.props): at most
 * RATE_LIMIT_PERSON requests a minute per GitHub id, and a session id only works for the person
 * who opened it (session.ts).
 */
const boundMcp = {
	async fetch(request: Request, env: Env, ctx: ExecutionContext & { props?: Props }) {
		const person = ctx.props && ctx.props.id;
		if (!person) return plain(401, "Not signed in.");
		if (env.RATE_LIMIT_PERSON && !(await env.RATE_LIMIT_PERSON.limit({ key: "person:" + person })).success) {
			return plain(429, "A lot of requests are coming from you. Wait a minute and try again.", { "Retry-After": "60" });
		}
		try {
			return await serveBound(mcpHandler, request, env, ctx, person);
		} catch (error) {
			// The session's Durable Object could not be reached: on Workers Free, most likely the day's
			// 100,000 Durable Object requests used up (costs.js). Said in plain words, never a bare 500.
			console.error("5s /mcp failed:", error instanceof Error ? error.message : error);
			return Response.json(
				{ jsonrpc: "2.0", error: { code: -32603, message: "That couldn't be answered just now. Try again in a minute; if it keeps happening, today's free allowance is used up: it comes back at midnight UTC. Nothing saved is lost, and the app keeps working on its own meanwhile." }, id: null },
				{ status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
			);
		}
	},
};

// The OAuth resource is the URL Claude connects to, so the provider is made for the origin the
// request arrived on (workers.dev in production, localhost under wrangler dev). Cloudflare only
// routes this Worker's own hostnames here, and every token is bound to the origin it was issued on.
const providers = new Map<string, OAuthProvider<Env>>();

function providerFor(origin: string) {
	let p = providers.get(origin);
	if (!p) {
		p = new OAuthProvider<Env>({
			apiRoute: "/mcp",
			apiHandler: boundMcp as any,
			defaultHandler: GitHubHandler as any,
			authorizeEndpoint: "/authorize",
			tokenEndpoint: "/token",
			clientRegistrationEndpoint: "/register",
			clientIdMetadataDocumentEnabled: true,
			...TOKEN_LIFETIMES,
			resourceMetadata: {
				resource: origin + "/mcp",
				authorization_servers: [origin],
				bearer_methods_supported: ["header"],
				resource_name: "5s",
			},
		});
		providers.set(origin, p);
	}
	return p;
}

// The sign-in endpoints anyone can reach without a token. Each client registration and sign-in
// writes to KV, so they are limited per address (RATE_LIMIT_SIGNIN) to keep one caller from using
// up the store's daily writes for everyone.
const SIGNIN_PATHS = new Set(["/register", "/authorize", "/token", "/callback"]);

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		if (env.DEV_FAKE_USER) {
			// Tests only: every /mcp request is a fake person, and GitHub is a fake. Refused anywhere
			// but localhost, so a stray DEV_FAKE_USER can never open a deployed connector.
			if (!LOCAL_HOSTS.has(url.hostname)) {
				return plain(403, "DEV_FAKE_USER is set, but this request is not to localhost, so the dev bypass is refused. DEV_FAKE_USER belongs only in .dev.vars, for local tests.");
			}
			if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
				const props = devProps(env.DEV_FAKE_USER, request);
				if (!props) return plain(403, "X-5s-Dev-User names someone who is not in DEV_FAKE_USER.");
				(ctx as ExecutionContext & { props: Props }).props = props;
				return boundMcp.fetch(request, env, ctx as ExecutionContext & { props: Props });
			}
			if (url.pathname === "/dev/fake-github") {
				return Response.json((await env.OAUTH_KV.get(DEV_FAKE_KEY, "json")) || {});
			}
		}
		if (env.RATE_LIMIT_SIGNIN && SIGNIN_PATHS.has(url.pathname)) {
			const from = request.headers.get("cf-connecting-ip") || "unknown";
			if (!(await env.RATE_LIMIT_SIGNIN.limit({ key: "signin:" + from })).success) {
				return plain(429, "Too many sign-in requests from here. Wait a minute and try again.", { "Retry-After": "60" });
			}
		}
		return providerFor(url.origin).fetch(request, env, ctx);
	},
};
