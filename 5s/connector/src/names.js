/* GitHub's naming rules and the hub's addresses, from the app's own driver (FiveSHub.rules, links,
 * isSiteRepo), plus two guards of the connector's own so a hub never lands somewhere special.
 */
import FiveSHub from './hub.js';

const lower = (s) => String(s || '').toLowerCase();

// The connector's two extra guards, on top of GitHub's rules: no leading "." (".github" is GitHub's
// own settings repository for an account) and no trailing ".git" (it confuses GitHub's addresses).
function extra(name) {
  if (name.charAt(0) === '.') return 'A name starting with "." is kept for GitHub\'s own settings.';
  if (/\.git$/i.test(name)) return 'A name ending in ".git" would confuse GitHub\'s addresses.';
  return '';
}
const tidy = (s) => String(s || '').replace(/^[-._]+/, '').replace(/(\.git)+$/i, '').replace(/[-.]+$/, '');

/** fixName(name) -> a name GitHub (and 5s) will take, from anything typed. */
export function fixName(name) {
  return tidy(FiveSHub.rules.repo(name).fixed) || '5s-hub';
}

/** checkName(name) -> {ok, name?, why?, fix?}: GitHub's rules (FiveSHub.rules.repo) and the two guards. */
export function checkName(name) {
  const r = FiveSHub.rules.repo(typeof name === 'string' ? name : '');
  if (!r.ok) return { ok: false, why: r.reason, fix: fixName(name) };
  const why = extra(r.fixed);
  if (why) return { ok: false, why, fix: fixName(r.fixed) };
  return { ok: true, name: r.fixed };
}

/** The hub that is a website by itself: <login>.github.io (GitHub compares names without case). */
export const pagesName = (login) => lower(login) + '.github.io';
export const isPagesName = (name, login) => FiveSHub.isSiteRepo(login, name);
export const sameName = (a, b) => lower(a) === lower(b);

/** https://<login>.github.io/ for the site repository, else https://<login>.github.io/<name>/. */
export const hubAddress = (login, name) => FiveSHub.links.site(login, name);
export const repoUrl = (login, name) => FiveSHub.links.repo(login, name);
export const pagesSettingsUrl = (login, name) => FiveSHub.links.pagesSettings(login, name);
