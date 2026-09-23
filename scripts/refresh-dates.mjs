#!/usr/bin/env node
// Rewrite every `date:` in index.html from the repo's real last-pushed date, and report any
// repo that is not listed yet.
//
// The card order is computed at parse time from these hard-coded dates, so a repo that gets
// pushed without its date being bumped here quietly sinks down the grid. That is exactly what
// this script exists to prevent — it is the automated version of a chore that was previously
// manual and, predictably, drifted (13 entries were stale when this was written).
//
//   node scripts/refresh-dates.mjs           # rewrite index.html in place
//   node scripts/refresh-dates.mjs --check   # report drift, change nothing, exit 1 if any
//
// Writes `new-repos` and `stale-count` to $GITHUB_OUTPUT when running in Actions.

import { writeFile, appendFile, readFile } from 'node:fs/promises';
import { INDEX, readIndex, parseProjects, setDate, fetchRepos, ROOT } from './projects.mjs';
import path from 'node:path';

const checkOnly = process.argv.includes('--check');

const { ignored } = JSON.parse(
  await readFile(path.join(ROOT, 'scripts', 'ignored-repos.json'), 'utf8')
);
const ignoredSet = new Set(ignored.map(n => n.toLowerCase()));

let html = await readIndex();
const entries = parseProjects(html);
const repos = await fetchRepos();

// Slug lookup is case-insensitive: GitHub treats repo names that way, and the table
// deliberately preserves each repo's exact casing for the (case-sensitive) Pages URL.
const pushedBySlug = new Map(repos.map(r => [r.name.toLowerCase(), r.pushed]));

const stale = [];
const missing = [];

for (const entry of entries) {
  const pushed = pushedBySlug.get(entry.repo.toLowerCase());
  if (!pushed) {
    // Listed here but absent from the API — a rename, a deletion, or a typo in the slug.
    // Never silently "fix" this by dropping the entry; surface it for a human.
    missing.push(entry.repo);
    continue;
  }
  if (pushed !== entry.date) {
    stale.push({ repo: entry.repo, from: entry.date, to: pushed });
    html = setDate(html, entry.repo, pushed);
  }
}

const listed = new Set(entries.map(e => e.repo.toLowerCase()));
const newRepos = repos
  .filter(r => !r.isFork && !r.archived)
  .filter(r => !listed.has(r.name.toLowerCase()))
  .filter(r => !ignoredSet.has(r.name.toLowerCase()));

// ---- Report ----
if (stale.length) {
  console.log(`${checkOnly ? 'Stale' : 'Refreshed'} ${stale.length} date(s):`);
  for (const s of stale) console.log(`  ${s.repo}: ${s.from} -> ${s.to}`);
} else {
  console.log('All dates are current.');
}

if (missing.length) {
  console.log(`\nListed in index.html but not found on GitHub (renamed or deleted?):`);
  for (const m of missing) console.log(`  ${m}`);
}

if (newRepos.length) {
  console.log(`\n${newRepos.length} repo(s) not in index.html:`);
  for (const r of newRepos) {
    console.log(`  ${r.name} (pushed ${r.pushed}, Pages: ${r.hasPages ? 'yes' : 'no'}) ${r.description}`);
  }
  console.log('\nAdd them to PROJECTS, or add them to scripts/ignored-repos.json to stop this notice.');
}

if (!checkOnly && stale.length) {
  await writeFile(INDEX, html);
}

// ---- Hand results to the workflow ----
if (process.env.GITHUB_OUTPUT) {
  const summary = newRepos
    .map(r => `- **${r.name}** — pushed ${r.pushed}, Pages ${r.hasPages ? 'enabled' : 'not enabled'}${r.description ? ` — ${r.description}` : ''}`)
    .join('\n');
  await appendFile(process.env.GITHUB_OUTPUT,
    `stale-count=${stale.length}\n` +
    `new-count=${newRepos.length}\n` +
    `new-repos<<__EOF__\n${summary}\n__EOF__\n`);
}

// `missing` is always fatal: it means a link on the live site is broken.
if (missing.length) process.exit(1);
if (checkOnly && stale.length) process.exit(1);
