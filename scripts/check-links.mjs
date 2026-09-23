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

import { parseProjects, readIndex, codeUrl, liveUrl } from './projects.mjs';

const CONCURRENCY = 6;
const TIMEOUT_MS = 15000;

async function probe(url) {
  // HEAD first (cheap); some hosts answer HEAD with 405, so fall back to a ranged GET.
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'playground-link-check', ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}) }
      });
      if (res.status === 405 && method === 'HEAD') continue;
      return res.status;
    } catch (err) {
      if (method === 'GET') return `network error (${err.name})`;
    }
  }
  return 'unknown';
}

const ok = (status) => typeof status === 'number' && status >= 200 && status < 400;

const entries = parseProjects(await readIndex());

// Build the full job list first so the concurrency pool is flat rather than per-entry.
const jobs = [];
for (const e of entries) {
  jobs.push({ repo: e.repo, kind: 'code', url: codeUrl(e.repo), pending: false });
  if (!e.noLive) {
    jobs.push({ repo: e.repo, kind: 'live', url: liveUrl(e.repo), pending: Boolean(e.pendingLive) });
  }
}

const results = [];
let cursor = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    results.push({ ...job, status: await probe(job.url) });
  }
}));

const broken = results.filter(r => !ok(r.status) && !r.pending);
const warned = results.filter(r => !ok(r.status) && r.pending);
// A pendingLive entry that now resolves is stale bookkeeping — tell the user to drop the flag.
const nowLive = results.filter(r => ok(r.status) && r.pending);

console.log(`Checked ${results.length} links across ${entries.length} projects.`);

if (warned.length) {
  console.log(`\n${warned.length} pending Live link(s) still not up (not a failure):`);
  for (const r of warned) console.log(`  ${r.repo}  ${r.status}  ${r.url}`);
}

if (nowLive.length) {
  console.log(`\n${nowLive.length} link(s) marked pendingLive are now live — remove the flag from index.html:`);
  for (const r of nowLive) console.log(`  ${r.repo}  ${r.url}`);
}

if (broken.length) {
  console.log(`\n${broken.length} BROKEN link(s):`);
  for (const r of broken) console.log(`  ${r.repo}  [${r.kind}]  ${r.status}  ${r.url}`);
  process.exit(1);
}

console.log('\nAll links resolve.');
