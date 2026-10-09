# AGENTS.md

Operating notes for AI coding agents (Claude Code, Codex, Cursor, Copilot and others) working in this repository. Everything here is derived from the files actually in the tree, so trust it over guesses, and update it when the facts change.

## What this repository is

A drop-in payment modal for any x402 paid endpoint.  One <script> tag turns an HTTP 402 Payment Required into a polished checkout: discover the challenge, connect a wallet (Phantom on Solana, MetaMask / any EVM wallet via EIP-3009), sign, settle, and show a receipt - in vanilla JS, with no bundler and no framework.

- Source: https://github.com/nirholas/x402-modal
- Primary language: JavaScript
- License: Other (see the LICENSE file)

## Repository layout

- `docs/`
- `examples/`
- `src/`
- `test/`
- `types/`
- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `package.json`

Tests live in `test/`. Add or update a test next to the code you change.

## Setup

```bash
npm install
```

## Commands

| Task | Command |
|---|---|
| build | `npm run build` |
| test | `npm test` |

Run the test and lint commands above before you consider a change finished. If a command fails on code you did not touch, say so in your report instead of silently skipping it.

## Conventions

- Commit messages follow Conventional Commits (`type(scope): summary`), matching the existing history.
- Read `CONTRIBUTING.md` before opening a pull request.
- User-visible changes get an entry in `CHANGELOG.md`.
- Read the surrounding code before adding to it, and match its naming, file organisation and error-handling style.
- Keep `README.md` accurate: if a change alters behaviour, commands or configuration, update the docs in the same commit.
- Do not leave TODO comments, stub functions, placeholder data or commented-out code behind. Finish what you start or leave it out.
- Small, focused commits with a subject line that describes the change, not the act of committing.

## Where to raise things

- Bugs and feature requests: https://github.com/nirholas/x402-modal/issues
- Questions and ideas: https://github.com/nirholas/x402-modal/discussions
- Security issues: report privately at https://github.com/nirholas/x402-modal/security/advisories/new, never in a public issue.
