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

## License

[MIT](LICENSE) © Yashvardhan Jain
