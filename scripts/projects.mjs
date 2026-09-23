// Shared helpers for the maintenance scripts: read the PROJECTS table out of index.html,
// and list the owner's repositories from the GitHub API.
//
// index.html is deliberately a single hand-edited file with no build step, so these scripts
// treat it as text: the table is READ by evaluating the literal (robust against whitespace
// and field order) but WRITTEN by a line-anchored replacement (preserves the hand alignment).

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const INDEX = path.join(ROOT, 'index.html');

export const GH_USER = 'IamYVJ';
export const PAGES_HOST = 'iamyvj.github.io';

export const codeUrl = (repo) => `https://github.com/${GH_USER}/${repo}`;
export const liveUrl = (repo) => `https://${PAGES_HOST}/${repo}/`;

// The end anchor is the four-space `};` that closes the literal. Matching that exact
// indentation avoids brace-counting through apostrophes and em dashes in descriptions.
const BLOCK_RE = /const PROJECTS = \{[\s\S]*?\n {4}\};/;

export async function readIndex() {
  return readFile(INDEX, 'utf8');
}

/**
 * Parse the PROJECTS literal into a flat array of entries, each tagged with its bucket.
 * Evaluated rather than regex-scraped so every optional field (noLive, status, pendingLive)
 * comes through without this parser needing to know they exist.
 */
export function parseProjects(html) {
  const block = html.match(BLOCK_RE);
  if (!block) {
    throw new Error('Could not find the `const PROJECTS = { … };` block in index.html. ' +
      'If the literal was reformatted, update BLOCK_RE in scripts/projects.mjs.');
  }
  // eslint-disable-next-line no-new-func
  const table = new Function(`${block[0]}\nreturn PROJECTS;`)();

  const flat = [];
  for (const [bucket, entries] of Object.entries(table)) {
    for (const entry of entries) flat.push({ ...entry, bucket });
  }
  return flat;
}

/**
 * Replace the `date:` of one entry, matching on the line that carries its `repo:`.
 * Returns the new HTML, or the original string untouched if the date already matches.
 */
export function setDate(html, repo, date) {
  // Repo slugs are [A-Za-z0-9._-] only, so they need no regex escaping — but assert it
  // rather than assume, since a stray character would silently corrupt the file.
  if (!/^[\w.-]+$/.test(repo)) throw new Error(`Unexpected characters in repo slug: ${repo}`);

  const line = new RegExp(`^(.*repo: '${repo}',\\s*date: ')(\\d{4}-\\d{2}-\\d{2})(')`, 'm');
  const found = html.match(line);
  if (!found) throw new Error(`No PROJECTS line found for repo '${repo}'`);
  if (found[2] === date) return html;
  return html.replace(line, `$1${date}$3`);
}

/** Every non-fork repo the user owns, as { name, pushed, isFork, archived, hasPages }. */
export async function fetchRepos() {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': `${GH_USER}-playground-maintenance`
  };
  // Actions injects GITHUB_TOKEN; without it the script still works at the 60/hr anon limit.
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const out = [];
  for (let page = 1; ; page++) {
    const res = await fetch(
      `https://api.github.com/users/${GH_USER}/repos?per_page=100&sort=pushed&page=${page}`,
      { headers }
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText}`);
    const batch = await res.json();
    if (!batch.length) break;
    out.push(...batch.map(r => ({
      name: r.name,
      pushed: r.pushed_at.slice(0, 10),
      isFork: r.fork,
      archived: r.archived,
      hasPages: r.has_pages,
      description: r.description || ''
    })));
    if (batch.length < 100) break;
  }
  return out;
}
