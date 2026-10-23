/* The pages people see while connecting 5s (after cloudflare/ai demos/remote-mcp-github-oauth
 * src/github-handler.ts). The demo's hand-written cookie and state helpers (workers-oauth-utils.ts)
 * are built into @cloudflare/workers-oauth-provider 1.x as beginConsent / approveConsent /
 * beginUpstream / finishUpstream, which this uses instead; the flow is the same:
 *
 *   GET  /authorize  Claude sends the person here. A one-screen "Connect 5s" page (consent per
 *                    client, as MCP requires for a server that signs in through another provider).
 *   POST /authorize  They pressed Continue: on to GitHub's own sign-in (and sign-up) page.
 *   GET  /callback   GitHub sends them back: exchange the code, learn who they are, finish.
 */
import {
	AuthorizationError,
	CimdFetchError,
	authorizationErrorRedirect,
	type AuthRequest,
	type ConsentDescription,
	type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { GITHUB_SCOPES, fetchUpstreamAuthToken, getUpstreamAuthorizeUrl, githubUser, s256, type Props } from "./utils";

type Bindings = Env & { OAUTH_PROVIDER: OAuthHelpers };
const app = new Hono<{ Bindings: Bindings }>();

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const STYLE = `:root{--paper:#faf9fc;--ink:#16131f;--quiet:#5b5670;--line:#d9d5e6;--iris:#6d4fd8;--ember:#c2410c;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--paper:#100e18;--ink:#f1eff8;--quiet:#b3aec7;--line:#34304a;--iris:#a996ff;--ember:#fb923c}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:520px;margin:0 auto;padding:40px 16px}h1{font-size:1.6rem;line-height:1.2;margin:0 0 .5rem}.quiet{color:var(--quiet)}
.box{border:1px solid var(--line);border-radius:20px;padding:16px 18px;margin:20px 0}ul{padding-left:1.2rem}code{font-family:ui-monospace,Menlo,monospace}
.warn{border-color:var(--ember)}.row{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}
button{font:inherit;min-height:48px;padding:10px 22px;border-radius:999px;border:2px solid var(--iris);cursor:pointer}
.go{background:var(--iris);color:#fff}.no{background:transparent;color:var(--ink)}
:focus-visible{outline:2px solid var(--iris);outline-offset:2px}`;

function page(title: string, body: string) {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>${STYLE}</style></head><body><main>${body}</main></body></html>`;
}

function htmlError(message: string, status = 400) {
	return new Response(page("Connecting didn't work", `<h1>Connecting didn't work</h1><p>${escape(message)}</p><p class="quiet">Start again from Claude: Settings → Connectors → 5s → Connect.</p>`), {
		status,
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}

function consentPage(d: ConsentDescription, handle: string) {
	const who = d.clientDomain
		? `<strong>${escape(d.clientName)}</strong>, published by <strong>${escape(d.clientDomain)}</strong>,`
		: `<strong>${escape(d.clientName)}</strong> (an app that registered itself; its name is not verified)`;
	return page(
		"Connect your aesthetic database",
		`<h1>Connect your aesthetic database</h1>
<p>${who} wants to use it for you: your taste, your rounds of five, your seed and your hub.</p>
<div class="box"><p>Next, GitHub's own page asks you to sign in (or make a free account). GitHub is asked for two things only:</p>
<ul><li><strong>who you are</strong> (your public username), so your database is yours;</li>
<li><strong>making and saving public repositories</strong>, so your hub can be made when you ask. Your other repositories are never read.</li></ul></div>
<p class="quiet">Access will be sent to <strong>${escape(d.redirectHost)}</strong>.</p>
${d.redirectIsLoopback ? `<div class="box warn"><p><strong>This sends access to an app on this computer.</strong> Continue only if you just started connecting from it.</p></div>` : ""}
<form method="post" action="/authorize">
<input type="hidden" name="handle" value="${escape(handle)}">
<div class="row"><button class="go" name="decision" value="approve">Continue to GitHub</button><button class="no" name="decision" value="deny">Cancel</button></div>
</form>`,
	);
}

function rememberOptions(env: Env) {
	// Remember "this browser already said yes to this client" for 30 days, in a signed cookie.
	const secret = env.COOKIE_ENCRYPTION_KEY || "";
	return secret.length >= 32 ? { secret } : null;
}

async function redirectToGithub(c: { env: Bindings; req: { url: string } }, request: AuthRequest, headers?: Headers) {
	const verifier = crypto.randomUUID() + crypto.randomUUID();
	const upstream = await c.env.OAUTH_PROVIDER.beginUpstream(request, { data: { verifier }, headers });
	upstream.headers.set(
		"Location",
		getUpstreamAuthorizeUrl({
			upstream_url: "https://github.com/login/oauth/authorize",
			client_id: c.env.GITHUB_CLIENT_ID,
			redirect_uri: new URL("/callback", c.req.url).href,
			scope: GITHUB_SCOPES.join(" "),
			state: upstream.state,
			code_challenge: await s256(verifier),
		}),
	);
	return new Response(null, { status: 302, headers: upstream.headers });
}

function handleAuthError(error: unknown) {
	if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
	if (error instanceof AuthorizationError) return htmlError(error.description || "The request was not valid.");
	if (error instanceof CimdFetchError) return htmlError("This app could not be verified.");
	throw error;
}

app.get("/", (c) => {
	const mcp = new URL("/mcp", c.req.url).href;
	return c.html(
		page(
			"A connector for Claude",
			`<h1>A connector for Claude</h1><p>Your own aesthetic database, in Claude: your taste, your seed and your hub.</p>
<div class="box"><p>To add it: in Claude, open <strong>Settings → Connectors → Add custom connector</strong>, name it <strong>5s</strong>, paste</p><p><code>${escape(mcp)}</code></p><p>then press <strong>Connect</strong> and sign in with GitHub.</p></div>`,
		),
	);
});

app.get("/authorize", async (c) => {
	try {
		const request = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
		const remember = rememberOptions(c.env);
		if (remember && (await c.env.OAUTH_PROVIDER.isConsentRemembered(c.req.raw, request, remember))) {
			return redirectToGithub(c, request);
		}
		const details = await c.env.OAUTH_PROVIDER.describeConsent(request);
		const consent = await c.env.OAUTH_PROVIDER.beginConsent(request);
		consent.headers.set("Content-Type", "text/html; charset=utf-8");
		return new Response(consentPage(details, consent.handle), { headers: consent.headers });
	} catch (error) {
		return handleAuthError(error);
	}
});

app.post("/authorize", async (c) => {
	try {
		const form = await c.req.raw.formData();
		const handle = String(form.get("handle") || "");
		if (form.get("decision") !== "approve") {
			const denied = await c.env.OAUTH_PROVIDER.denyConsent(c.req.raw, handle);
			return new Response(null, { status: 302, headers: denied.headers });
		}
		const remember = rememberOptions(c.env);
		const approved = await c.env.OAUTH_PROVIDER.approveConsent(c.req.raw, handle, remember ? { remember } : undefined);
		return redirectToGithub(c, approved.request, approved.headers);
	} catch (error) {
		return handleAuthError(error);
	}
});

app.get("/callback", async (c) => {
	let resumed: { request: AuthRequest; data: { verifier: string }; headers: Headers };
	try {
		resumed = await c.env.OAUTH_PROVIDER.finishUpstream<{ verifier: string }>(c.req.raw);
	} catch (error) {
		return handleAuthError(error);
	}
	const { request, data, headers } = resumed;
	if (c.req.query("error")) {
		headers.set("Location", authorizationErrorRedirect(request, "access_denied"));
		return new Response(null, { status: 302, headers });
	}
	const [accessToken, scopes, errResponse] = await fetchUpstreamAuthToken({
		upstream_url: "https://github.com/login/oauth/access_token",
		client_id: c.env.GITHUB_CLIENT_ID,
		client_secret: c.env.GITHUB_CLIENT_SECRET,
		code: c.req.query("code"),
		redirect_uri: new URL("/callback", c.req.url).href,
		code_verifier: data.verifier,
	});
	if (errResponse) return errResponse;

	// Who signed in: GitHub's numeric id keys their 5s; the login names their hub.
	let user: { id: number; login: string };
	try {
		user = await githubUser(accessToken);
	} catch (error) {
		console.log("GitHub /user failed:", error instanceof Error ? error.message : error);
		return htmlError("GitHub signed you in but would not say who you are. Try again in a minute.", 502);
	}
	const props: Props = { id: String(user.id), login: user.login, accessToken, scopes };
	const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
		request,
		userId: String(user.id),
		metadata: { label: user.login },
		scope: request.scope,
		props,
	});
	headers.set("Location", redirectTo);
	return new Response(null, { status: 302, headers });
});

// Anything else that fails while connecting (on Workers Free, most likely the day's 1,000 KV writes
// used up: a sign-in writes 5, see costs.js): a page in plain words, never a bare error.
app.onError((error) => {
	console.log("5s sign-in failed:", error instanceof Error ? error.message : error);
	return htmlError(
		"Connecting couldn't finish just now. Try again in a minute; if it keeps happening, today's free allowance for sign-ins is used up: it comes back at midnight UTC. Nothing in your database is affected, and the app keeps working meanwhile.",
		503,
	);
});

export { app as GitHubHandler };
