#!/usr/bin/env node
// Verify every Code and Live link the grid renders actually resolves.
//
// Both URLs are derived from the `repo` slug, so a single typo silently breaks a card with
// no visible sign on the page — `amazon_order_statisics` (missing a 't') shipped that way and
// 404'd for months. This check turns that class of mistake into a failing build.
//
//   node scripts/check-links.mjs
//
// Exit codes: 0 all good, 1 something is broken.
//
// A Live 404 is expected for a brand-new repo whose Pages site has not finished its first
// deploy. Mark those entries `pendingLive: true` in index.html and they downgrade to a
// warning; remove the flag once the site is up (this script tells you when it is).
//
// ---------------------------------------------------------------------------------------
// Why Code links are checked through the API rather than by fetching github.com:
//
// One HTML request per repo meant ~37 unauthenticated hits on github.com in a few seconds
// from a single IP. GitHub applies a secondary rate limit to exactly that shape of traffic,
// and datacenter IPs (every Actions runner) are treated far less generously than a home
// connection — so the check passed locally and on a 71-link run, then failed at 73 links.
// The repo list is one paginated API call that answers the same question, and in Actions it
// carries GITHUB_TOKEN for a 1000/hr limit instead of 60/hr.
//
// Live links still need real HTTP — only a request to the Pages host can tell us a site is
// actually served — but that is half the volume, against a host that tolerates it, and every
// request now retries on the throttling and transient errors that make a check like this
// flaky rather than useful.
// ---------------------------------------------------------------------------------------

import { parseProjects, readIndex, codeUrl, liveUrl, fetchRepos } from './projects.mjs';

const CONCURRENCY = 4;
const TIMEOUT_MS = 15000;
const ATTEMPTS = 3;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Retry on the statuses that mean "ask again later", never on a 404 — a genuinely missing
// page answers instantly and identically every time, so retrying it only wastes the budget.
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

async function probe(url) {
  let last = 'unknown';

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(last.retryAfterMs ?? 1000 * 2 ** (attempt - 2));

    // HEAD first (cheap); some hosts answer HEAD with 405, so fall back to a ranged GET.
    for (const method of ['HEAD', 'GET']) {
      try {
        const res = await fetch(url, {
          method,
          redirect: 'follow',
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: {
            'User-Agent': 'playground-link-check',
            ...(method === 'GET' ? { Range: 'bytes=0-0' } : {})
          }
        });
        if (res.status === 405 && method === 'HEAD') continue;

        if (RETRYABLE.has(res.status) && attempt < ATTEMPTS) {
          // Honour Retry-After when the server sends one; it is in seconds.
          const wait = Number(res.headers.get('retry-after'));
          last = { status: res.status, retryAfterMs: Number.isFinite(wait) ? wait * 1000 : undefined };
          break; // out of the method loop, into the next attempt
        }
        return res.status;
      } catch (err) {
        last = { status: `network error (${err.name})` };
        if (method === 'GET' && attempt === ATTEMPTS) return last.status;
        if (method === 'GET') break; // retry the whole thing
      }
    }
  }

  return typeof last === 'object' ? last.status : last;
}

const ok = (status) => typeof status === 'number' && status >= 200 && status < 400;

const entries = parseProjects(await readIndex());

// ---- Code links: existence via the API, no per-repo HTML request ----
let repos;
try {
  repos = await fetchRepos();
} catch (err) {
  console.error(`Could not list repositories from the GitHub API: ${err.message}`);
  console.error('Code links cannot be verified without it; re-run when the API is reachable.');
  process.exit(1);
}
const existing = new Set(repos.map(r => r.name.toLowerCase()));
const missingRepos = entries.filter(e => !existing.has(e.repo.toLowerCase()));

// ---- Live links: real HTTP against the Pages host ----
const liveJobs = entries
  .filter(e => !e.noLive)
  .map(e => ({ repo: e.repo, url: liveUrl(e.repo), pending: Boolean(e.pendingLive) }));

const results = [];
let cursor = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (cursor < liveJobs.length) {
    const job = liveJobs[cursor++];
    results.push({ ...job, status: await probe(job.url) });
  }
}));

const brokenLive = results.filter(r => !ok(r.status) && !r.pending);
const warned = results.filter(r => !ok(r.status) && r.pending);
// A pendingLive entry that now resolves is stale bookkeeping — tell the user to drop the flag.
const nowLive = results.filter(r => ok(r.status) && r.pending);

console.log(
  `Checked ${entries.length} Code link(s) against the repo list ` +
  `and probed ${results.length} Live link(s).`
);

if (warned.length) {
  console.log(`\n${warned.length} pending Live link(s) still not up (not a failure):`);
  for (const r of warned) console.log(`  ${r.repo}  ${r.status}  ${r.url}`);
}

if (nowLive.length) {
  console.log(`\n${nowLive.length} link(s) marked pendingLive are now live — remove the flag from index.html:`);
  for (const r of nowLive) console.log(`  ${r.repo}  ${r.url}`);
}

if (missingRepos.length) {
  console.log(`\n${missingRepos.length} repo(s) in index.html do not exist on GitHub (renamed, deleted, or a typo in the slug):`);
  for (const e of missingRepos) console.log(`  ${e.repo}  ${codeUrl(e.repo)}`);
}

if (brokenLive.length) {
  console.log(`\n${brokenLive.length} BROKEN Live link(s):`);
  for (const r of brokenLive) console.log(`  ${r.repo}  ${r.status}  ${r.url}`);
  console.log('\nIf the repo is new and Pages is still deploying, set `pendingLive: true` on its entry.');
}

if (missingRepos.length || brokenLive.length) process.exit(1);

console.log('\nAll links resolve.');
