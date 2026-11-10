---
name: add-x402-checkout
description: Add the @three-ws/x402-modal payment modal to a web page so users can pay an x402 (HTTP 402) endpoint from their wallet, by script tag, data attributes or the pay() function. Use when a site needs a pay-per-call button or checkout for a paid endpoint.
---

# Add an x402 checkout modal

This plugin is a skill only. There is no MCP server. `@three-ws/x402-modal` is a dependency-free browser library. It discovers an endpoint's 402 challenge, connects a wallet (Phantom on Solana, or an injected EVM wallet via EIP-3009), signs, settles, and shows a receipt.

## Install

Bundler or framework: `npm i @three-ws/x402-modal`, then `import { pay, configure } from '@three-ws/x402-modal'` (no side effects on import).

No bundler: load the global build, which binds every `[data-x402-endpoint]` element and exposes `window.X402`:

```html
<script type="module" src="https://unpkg.com/@three-ws/x402-modal/global"></script>
```

## Declarative use

```html
<button data-x402-endpoint="/api/paid/summarize"
        data-x402-method="POST"
        data-x402-body='{"text":"hello"}'
        data-x402-merchant="Acme"
        data-x402-action="Summarize">Pay and run</button>
```

Attributes read from the source: `data-x402-endpoint`, `-method`, `-body` (JSON), `-headers` (JSON), `-caps` (JSON), `-api-origin`, `-merchant`, `-action`. The button dispatches bubbling events: `x402:result` (detail is the pay result), `x402:siwx-signed` and `x402:error` (detail `{ error }`). A user closing the modal is not an error.

## Programmatic use

```js
import { pay, configure } from '@three-ws/x402-modal';

configure({ apiOrigin: '' });   // '' means same-origin Solana helpers

try {
  const out = await pay({
    endpoint: '/api/paid/summarize',
    method: 'POST',
    body: { text: 'hello' },
    merchant: 'Acme',
    action: 'Summarize',
    caps: { maxPerCall: 100000, maxPerHour: 500000, maxPerDay: 2000000 },
  });
  console.log(out.result, out.payment?.transaction);
} catch (err) {
  if (err.code !== 'cancelled') throw err;
}
```

- `pay(opts)` requires `endpoint`. It resolves `{ ok: true, result, payment?, siwx?, response }` after settlement and rejects with `err.code === 'cancelled'` when the user closes the modal.
- `caps` are per-wallet spending caps in micro-USD (1e6 = $1), enforced in `localStorage`.
- Other `configure` keys: `apiOrigin`, `brand`, `builderCode`, `solanaWeb3Url`, `nobleHashesUrl`. Brand and builder code are off by default.
- `init()` rescans the DOM for `[data-x402-endpoint]` elements. It is idempotent.

## Backend requirement

The EVM path is entirely client-side. The Solana path calls `POST {apiOrigin}/api/x402-checkout?action=prepare|encode` on a backend you run (see `docs/BACKEND.md` in the repo). Without it, Solana wallets cannot complete. Set `apiOrigin` to that origin. The paid endpoint itself must return a valid 402 challenge. `@three-ws/x402-server` builds one.

## Rules for the agent

- Point the modal only at endpoints the user owns or has named. Never hardcode a wallet key. The user signs in their own wallet.
- Set sensible `caps` for any page that can trigger payments from an automated flow.
