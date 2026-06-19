# Tutorials — @three-ws/x402-modal

Hands-on, copy-paste walkthroughs. Each one is self-contained and ends with
something running. Pick the path that matches your stack:

1. [Tutorial 1 — Sell an API call in 5 minutes (Base, no backend)](#tutorial-1--sell-an-api-call-in-5-minutes-base-no-backend)
2. [Tutorial 2 — Programmatic checkout in a SPA](#tutorial-2--programmatic-checkout-in-a-spa)
3. [Tutorial 3 — A content paywall](#tutorial-3--a-content-paywall)
4. [Tutorial 4 — Self-hosting & full branding](#tutorial-4--self-hosting--full-branding)
5. [Tutorial 5 — Adding the Solana path (the backend helper)](#tutorial-5--adding-the-solana-path-the-backend-helper)
6. [Tutorial 6 — Spending caps for autonomous agents](#tutorial-6--spending-caps-for-autonomous-agents)
7. [Troubleshooting](#troubleshooting)

Every tutorial assumes you already have — or are about to build — an x402 server
that answers a protected route with `402 Payment Required`. If you don't, skim
[the backend doc](./docs/BACKEND.md) first; it shows the minimal server side.

---

## Tutorial 1 — Sell an API call in 5 minutes (Base, no backend)

**Goal:** charge USDC on Base for one API call, with zero backend beyond your
existing x402 server. The Base path is fully client-side.

### 1. Have an endpoint that returns 402

Your server should respond to an unpaid request with `402` and an `accepts`
array describing a Base USDC payment. A minimal challenge body looks like:

```json
{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:8453",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0xYourMerchantWallet",
    "amount": "10000",
    "maxTimeoutSeconds": 600,
    "extra": { "name": "USDC", "version": "2", "decimals": 6 }
  }]
}
```

(`amount` is atomic — `10000` = `$0.01` at 6 decimals.)

### 2. Add the modal to your page

```html
<script type="module" src="https://unpkg.com/@three-ws/x402-modal/global"></script>

<button
  data-x402-endpoint="https://api.acme.com/paid/summarize"
  data-x402-method="POST"
  data-x402-body='{"text":"Long article text here..."}'
  data-x402-merchant="Acme AI"
  data-x402-action="Summarize article">
  Summarize for $0.01
</button>
```

### 3. Handle the result

```html
<script>
  document.querySelector('button').addEventListener('x402:result', (e) => {
    const { result, payment } = e.detail;
    document.querySelector('#out').textContent = JSON.stringify(result, null, 2);
    console.log('settled tx:', payment.transaction);
  });
  document.querySelector('button').addEventListener('x402:error', (e) => {
    alert('Payment failed: ' + e.detail.error);
  });
</script>
<pre id="out"></pre>
```

That's the whole integration. Click → MetaMask signs an EIP-3009 authorization
(no gas, no on-chain tx for the user) → your endpoint runs and settles → the
result renders.

---

## Tutorial 2 — Programmatic checkout in a SPA

**Goal:** trigger checkout from your own button in React/Vue/Svelte/vanilla and
get the result back as a promise.

```sh
npm i @three-ws/x402-modal
```

```jsx
// React example
import { pay } from '@three-ws/x402-modal';

function BuyButton({ text }) {
  const [out, setOut] = useState(null);
  const [err, setErr] = useState(null);

  async function onClick() {
    setErr(null);
    try {
      const res = await pay({
        endpoint: '/api/paid/summarize',
        method: 'POST',
        body: { text },
        merchant: 'Acme AI',
        action: 'Summarize',
      });
      setOut(res.result);
    } catch (e) {
      if (e.code === 'cancelled') return;   // user closed the modal — not an error
      setErr(e.message);
    }
  }

  return (
    <>
      <button onClick={onClick}>Summarize for $0.01</button>
      {err && <p className="error">{err}</p>}
      {out && <pre>{JSON.stringify(out, null, 2)}</pre>}
    </>
  );
}
```

The ESM import has **no side effects** — it won't scan the DOM or touch
`window`. You control exactly when the modal opens.

---

## Tutorial 3 — A content paywall

**Goal:** blur premium content until the visitor pays, then reveal it.

```html
<script type="module" src="https://unpkg.com/@three-ws/x402-modal/global"></script>

<article id="premium" class="locked">
  <div class="blurred">…premium article body…</div>
  <button
    data-x402-endpoint="https://api.acme.com/paid/article/42"
    data-x402-merchant="Acme Times"
    data-x402-action="Unlock this article">
    Unlock — $0.25
  </button>
</article>

<style>
  .locked .blurred { filter: blur(8px); pointer-events: none; user-select: none; }
  .unlocked .blurred { filter: none; }
</style>

<script>
  const article = document.getElementById('premium');
  article.querySelector('button').addEventListener('x402:result', (e) => {
    // Put the unlocked content from the endpoint into the page, then reveal.
    article.querySelector('.blurred').innerHTML = e.detail.result.html;
    article.classList.replace('locked', 'unlocked');
    // Remember it so a refresh doesn't re-lock (optional).
    localStorage.setItem('unlocked:article:42', '1');
  });
</script>
```

To skip the paywall for returning buyers, check your flag on load — and if your
server supports **SIWX** (sign-in-with-x), the modal will automatically offer
"Already paid? Sign in" so they re-enter by signing instead of paying again.

---

## Tutorial 4 — Self-hosting & full branding

**Goal:** serve the script yourself, point the Solana backend at your own
domain, and replace the footer attribution — without writing JS.

```html
<script
  type="module"
  src="https://cdn.acme.com/x402.global.js"
  data-x402-api-origin="https://pay.acme.com"
  data-x402-brand-label="Powered by Acme Pay"
  data-x402-brand-href="https://acme.com/pay"
  data-x402-builder-wallet="acme"
  data-x402-builder-service="acme_checkout"></script>
```

Grab `x402.global.js` from the package's `dist/` (or build it with
`npm run build`) and host it anywhere static.

Prefer JS? Configure before the first payment:

```js
import { configure } from '@three-ws/x402-modal';

configure({
  apiOrigin: 'https://pay.acme.com',
  brand: { label: 'Powered by Acme Pay', href: 'https://acme.com/pay' },
  builderCode: { wallet: 'acme', service: 'acme_checkout' },
});
```

To drop the footer link entirely, set `data-x402-builder-disable` and a
`brand` with no `href`.

---

## Tutorial 5 — Adding the Solana path (the backend helper)

**Goal:** accept USDC on Solana too. This is the only path that needs a backend,
because building a Solana transfer needs RPC + the facilitator fee-payer.

The modal calls two actions on `{apiOrigin}/api/x402-checkout`:

```
POST /api/x402-checkout?action=prepare
  body: { accept, buyer }
  → { tx_base64 }        # a VersionedTransaction the buyer will sign

POST /api/x402-checkout?action=encode
  body: { accept, signed_tx_base64, resource_url, builder_code? }
  → { x_payment }        # the base64 X-PAYMENT value to send to the merchant
```

A reference Express handler that delegates to an x402 facilitator SDK lives in
[`examples/server.mjs`](./examples/server.mjs), and the exact field contract is
in [`docs/BACKEND.md`](./docs/BACKEND.md).

Once the helper is live, no client change is needed beyond pointing `apiOrigin`
at it (Tutorial 4). When your `402` advertises **both** a Solana and a Base
`accept`, the modal shows a wallet picker; when it advertises one, it goes
straight there.

---

## Tutorial 6 — Spending caps for autonomous agents

**Goal:** let an agent (or a kiosk, or a shared browser) pay automatically, but
cap how much it can spend per call / hour / day.

```js
import { pay } from '@three-ws/x402-modal';

await pay({
  endpoint: '/api/paid/inference',
  body: { prompt },
  autoConnect: true,            // skip the picker when one wallet is present
  caps: {
    maxPerCall: 500_000,        // $0.50 max for any single call
    maxPerHour: 5_000_000,      // $5.00/hour
    maxPerDay:  20_000_000,     // $20.00/day
  },
});
```

Amounts are **micro-USD** (`1_000_000` = `$1`). Caps are tracked per wallet
address in `localStorage`, bucketed by rolling UTC hour and day, and survive
page reloads. A call that would breach a cap is rejected *before* the wallet
prompt with a clear reason; a payment that fails downstream rolls its
reservation back so it doesn't count against the budget.

> Caps are a client-side guardrail, not a trust boundary. For hard limits an
> agent can't bypass, also enforce server-side.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| **"Endpoint did not return 402 (got 200)"** | The modal was pointed at a free/unprotected URL, or your server didn't send a `402`. Confirm the route is actually gated. |
| **"no `accepts` array could be found"** | Your `402` body (or `payment-required` header) is missing the `accepts` array. See the challenge shape in Tutorial 1. |
| **"NaN USDC" in the price** | Your `accept` used a field other than `amount`/`maxAmountRequired`. The modal normalizes both; anything else needs mapping. |
| **Solana payment errors with "component … was blocked"** | A strict Content-Security-Policy blocked the dynamic `@solana/web3.js` import. Allow the CDN, set `solanaWeb3Url` to a self-hosted copy, or use the Base path (no third-party code). |
| **EVM signature rejected by the facilitator** | Check the USDC `extra.version` in your `accept` matches the deployed contract (Base USDC is `"2"`), and that `payTo`/`asset` are correct. |
| **Modal opens then immediately shows the picker disabled** | No supported wallet detected. Install Phantom (Solana) or MetaMask (EVM), or advertise an `accept` for a chain the visitor's wallet supports. |
| **`pay()` rejected but nothing went wrong** | The user closed the modal: the rejection's `.code === 'cancelled'`. Treat it as a no-op, not an error. |

Still stuck? Open an issue at
<https://github.com/nirholas/three.ws/issues>.
