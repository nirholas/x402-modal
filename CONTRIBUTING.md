# Contributing to @three-ws/x402-modal

Thanks for helping improve the x402 payment modal. This guide covers the local
setup, the build, the tests, and the conventions the project follows.

## Prerequisites

- **Node.js >= 18** (the package declares this in `engines`).
- npm (ships with Node).

No global tooling is required — `esbuild` is the only dev dependency.

## Setup

```sh
git clone https://github.com/nirholas/x402-modal.git
cd x402-modal
npm install
```

## Project layout

| Path                   | What it is |
|------------------------|------------|
| `src/x402-modal.js`    | The canonical, side-effect-free core. The public API lives here. |
| `src/global.js`        | The CDN entry: reads `data-x402-*` off its `<script>`, auto-binds, exposes `window.X402`. |
| `src/util.js`          | Pure, DOM-free helpers (encoding, network maps, SIWX message, caps math). Unit-tested in Node. |
| `types/index.d.ts`     | TypeScript declarations for the public API. |
| `build.mjs`            | esbuild config — emits `dist/x402-modal.mjs` (ESM) and `dist/x402.global.js` (IIFE). |
| `test/*.test.js`       | Node `node:test` suites. No DOM required. |
| `examples/`            | A runnable demo page and a reference Solana backend helper. |
| `docs/`                | Protocol, configuration, backend, and examples references. |

## Build

```sh
npm run build
```

This produces two artifacts in `dist/`:

- `dist/x402-modal.mjs` — ESM, side-effect-free, for bundlers and npm consumers.
- `dist/x402.global.js` — minified IIFE, the drop-in CDN `<script>`.

The build banner is derived from `package.json`, so no host or branding is
hardcoded in `build.mjs`. The Solana web3.js and keccak imports stay as runtime
CDN URLs and are never bundled.

## Test

```sh
npm test
```

Runs every `test/*.test.js` with Node's built-in test runner. All tests must
pass before a change is merged. Tests run in plain Node — keep new logic that
needs coverage in `src/util.js` (DOM-free) so it stays unit-testable.

## Conventions

- **No new runtime dependencies.** The package is deliberately dependency-free;
  the only network modules (Solana web3.js, a keccak) are dynamic-imported from a
  CDN, on demand. Adding an npm runtime dependency needs a strong reason.
- **Keep the core side-effect-free.** `src/x402-modal.js` must never touch
  `window` or auto-bind on import — that behavior belongs in `src/global.js`.
- **Defaults stay vendor-neutral.** `brand` and `builderCode` default to `null`.
  Don't ship a default footer or builder code.
- **Update types and docs with the code.** A public-API change updates
  `types/index.d.ts`, the README API reference, and the relevant `docs/` file in
  the same change. Every doc sample must actually run.
- **Match the existing style.** Tab indentation, small functions, comments that
  explain *why*, not *what*.

## Submitting a change

1. Branch from `main`.
2. Make the change; run `npm run build && npm test`.
3. Update `types/`, the README, and `docs/` for any public-API change.
4. Open a PR describing the change and the user-visible effect.

## Reporting issues

Open an issue at <https://github.com/nirholas/x402-modal/issues>. For a payment
flow bug, include the network (Base / Solana), the wallet, and the shape of the
`402` body's `accepts[]` entry (redact addresses if needed).

## License

By contributing you agree your contributions become the proprietary property of
the Owner. Proprietary — Copyright (c) 2026 nirholas. All Rights Reserved.
Unauthorized use, copying, modification, or distribution is prohibited. See
[LICENSE](./LICENSE).
