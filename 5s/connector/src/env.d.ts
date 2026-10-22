/* Bindings and secrets the Worker sees (wrangler.jsonc, Worker secrets, .dev.vars). */
interface Env {
	/** The OAuth provider's own store: clients, grants, tokens (props encrypted). */
	OAUTH_KV: KVNamespace;
	/** Each person's 5s state and the repositories the connector made, keyed by GitHub user id. */
	FIVES_KV: KVNamespace;
	/** McpAgent's Durable Object: one per MCP session. */
	MCP_OBJECT: DurableObjectNamespace;
	/** Worker secrets (wrangler secret put). */
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	COOKIE_ENCRYPTION_KEY: string;
	/** Local tests only, in .dev.vars: "login" or "id:login" (a comma-separated list for several people). Refused on any host but localhost. */
	DEV_FAKE_USER?: string;
	/** Workers Rate Limiting bindings (wrangler.jsonc "ratelimits"); optional: without them nothing is limited here. */
	RATE_LIMIT_PERSON?: RateLimit;
	RATE_LIMIT_SIGNIN?: RateLimit;
	/** Pixels one bring_in or item_image call may decode here (wrangler.jsonc vars): "0" on Workers Free, unset (4,000,000) on Paid. */
	COLOUR_BUDGET_PX?: string;
	/** Reads of other sites (read_link, bring_in, item_image) a minute per person. */
	RATE_LIMIT_WEB?: RateLimit;
}
