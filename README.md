# Playground

A showcase landing page for the small web apps and games I build and host on GitHub Pages.

**Live:** https://iamyvj.github.io/playground/

## About

This is the index for my "playground" — a single, self-contained `index.html` (inline CSS and
JavaScript, no build step) that links out to each project's live demo and source code. Every
project listed here is its own repository, served via GitHub Pages.

Features:

- Light / dark theme toggle (remembers your choice, defaults to your system preference)
- Live search and tag filtering across all projects
- Responsive card grid that collapses to a single column on phones
- Fully static and client-side — no backend, no tracking

## Adding a project

Project links are generated from a single data array near the top of the `<script>` in
`index.html`. Each entry looks like:

```js
{ name: 'Display Name', repo: 'repo-slug', description: 'One-line description.', tags: ['JS', 'data'] }
```

Both links are derived from `repo`:

- **Code:** `https://github.com/IamYVJ/{repo}`
- **Live:** `https://iamyvj.github.io/{repo}/`

The `{repo}` slug is case-sensitive in both URLs, so use the repository's exact casing. An optional
`status` field (`"New"`, `"WIP"`, or `"Beta"`) renders a small badge on the card.

Optional flags:

- `noLive: true` — hides the Live button, for a repo with no Pages site (e.g. a CLI script).
- `pendingLive: true` — keeps the Live button but tells the link checker the Pages site is still
  deploying, so a 404 is a warning instead of a build failure. Remove it once the site is up; the
  checker reports when a flagged link starts resolving.

## Maintenance

Two scripts keep the list honest. Both are dependency-free and need Node 20+.

```bash
node scripts/refresh-dates.mjs          # rewrite every date: from the repo's real last push
node scripts/refresh-dates.mjs --check  # report drift without writing; exits 1 if any
node scripts/check-links.mjs            # verify every Code and Live URL resolves
```

`refresh-dates` also reports repositories that exist on GitHub but are missing from `PROJECTS`.
Repos that should never be listed live in [`scripts/ignored-repos.json`](scripts/ignored-repos.json);
forks and archived repos are skipped automatically.

Both run in CI ([`.github/workflows`](.github/workflows)):

- **Refresh project dates** — Mondays 06:00 UTC and on demand. Commits any date changes and
  opens (or updates) a single issue listing unlisted repos.
- **Check links** — on every push and PR touching `index.html` or `scripts/`, plus Mondays.
  Fails the build on a broken Code or Live URL.

Card order is derived from the hard-coded `date` values at parse time, so the page still makes
no network call to render — the automation just keeps those values accurate.

## License

[MIT](LICENSE) © Yashvardhan Jain
