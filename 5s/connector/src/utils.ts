/* GitHub as the upstream sign-in (after cloudflare/ai demos/remote-mcp-github-oauth src/utils.ts),
 * with PKCE added and the scopes 5s needs.
 */

/** What 5s asks GitHub for at sign-in: who you are, and making and saving public repositories. */
export const GITHUB_SCOPES = ["read:user", "public_repo"];

export type Props = {
	/** GitHub's numeric user id, as a string: the key for the person's 5s in the connector's store. */
	id: string;
	login: string;
	/** The GitHub token. Only ever inside the OAuth provider's encrypted props (see FiveSMCP.updateProps). */
	accessToken: string;
	scopes?: string[];
	/** Set only by the local dev bypass (DEV_FAKE_USER on localhost). */
	dev?: boolean;
	/** The Worker's own origin, added by the Worker to every /mcp request (never from the token): the round card's links. */
	origin?: string;
};

export function getUpstreamAuthorizeUrl({
	upstream_url,
	client_id,
	scope,
	redirect_uri,
	state,
	code_challenge,
}: {
	upstream_url: string;
	client_id: string;
	scope: string;
	redirect_uri: string;
	state: string;
	code_challenge?: string;
}) {
	const upstream = new URL(upstream_url);
	upstream.searchParams.set("client_id", client_id);
	upstream.searchParams.set("redirect_uri", redirect_uri);
	upstream.searchParams.set("scope", scope);
	upstream.searchParams.set("state", state);
	upstream.searchParams.set("response_type", "code");
	// "allow_signup" keeps GitHub's own sign-up link on its sign-in page: no account yet is fine.
	upstream.searchParams.set("allow_signup", "true");
	if (code_challenge) {
		upstream.searchParams.set("code_challenge", code_challenge);
		upstream.searchParams.set("code_challenge_method", "S256");
	}
	return upstream.href;
}

/** Exchange GitHub's code for a token. -> [token, scopes, null] or [null, null, error Response]. */
export async function fetchUpstreamAuthToken({
	client_id,
	client_secret,
	code,
	redirect_uri,
	upstream_url,
	code_verifier,
}: {
	code: string | null | undefined;
	upstream_url: string;
	client_secret: string;
	redirect_uri: string;
	client_id: string;
	code_verifier?: string;
}): Promise<[string, string[], null] | [null, null, Response]> {
	if (!code) return [null, null, new Response("GitHub did not send a sign-in code. Start again from Claude.", { status: 400 })];
	const body = new URLSearchParams({ client_id, client_secret, code, redirect_uri });
	if (code_verifier) body.set("code_verifier", code_verifier);
	const resp = await fetch(upstream_url, {
		method: "POST",
		body: body.toString(),
		headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": "5s-connector" },
	});
	if (!resp.ok) {
		console.log("GitHub token exchange failed:", resp.status);
		return [null, null, new Response("GitHub sign-in could not be finished. Start again from Claude.", { status: 502 })];
	}
	const data = (await resp.json()) as { access_token?: string; scope?: string; error?: string };
	if (!data.access_token) {
		console.log("GitHub token exchange error:", data.error);
		return [null, null, new Response("GitHub did not give access. Start again from Claude.", { status: 400 })];
	}
	const scopes = String(data.scope || "").split(/[,\s]+/).filter(Boolean);
	return [data.access_token, scopes, null];
}

/**
 * GitHub's API refuses requests without a User-Agent, and fetch in a Worker sends none, so every call
 * the connector makes to api.github.com (its own and the hub driver's) goes through this.
 */
export const githubFetch = (input: RequestInfo | URL, init?: RequestInit) => {
	const headers = new Headers(init?.headers);
	if (!headers.has("User-Agent")) headers.set("User-Agent", "5s-connector");
	return fetch(input, { ...init, headers });
};

/** Who signed in: GitHub's numeric id (it never changes, unlike a login) and the login. */
export async function githubUser(token: string, doFetch: typeof fetch = githubFetch) {
	const res = await doFetch("https://api.github.com/user", {
		headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token, "X-GitHub-Api-Version": "2022-11-28" },
	});
	if (!res.ok) throw new Error("GitHub would not say who signed in (" + res.status + ")");
	const u = (await res.json()) as { id?: number; login?: string };
	if (!u.id || !u.login) throw new Error("GitHub sent no id or login");
	return { id: u.id, login: u.login };
}

/** base64url(SHA-256(verifier)), the PKCE S256 challenge. */
export async function s256(verifier: string) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	let bin = "";
	for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
