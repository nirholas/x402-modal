# Examples

Runnable recipes for `@three-ws/x402-modal`. Every snippet below is complete and
copy-pasteable. All you need to supply is your own x402-protected endpoint (one
that answers with `402 Payment Required` + an `accepts[]` array — see
[`PROTOCOL.md`](./PROTOCOL.md)).

For two fully-wired files you can serve and click, see
[`../examples/index.html`](../examples/index.html) (the demo page) and
[`../examples/server.mjs`](../examples/server.mjs) (the Solana backend helper).

---

## 1 — Declarative button (zero JS, CDN only)

The smallest integration. The `/global` script binds the button automatically.

```html
<!doctype html>
<meta charset="utf-8" />

<button
  data-x402-endpoint="https://api.example.com/paid/summarize"
  data-x402-method="POST"
  data-x402-body='{"text":"hello world"}'
  data-x402-merchant="Acme"
  data-x402-action="Summarize">
  Pay &amp; summarize
</button>
<pre id="out"></pre>

<script type="module" src="https://unpkg.com/@three-ws/x402-modal/global"></script>
<script type="module">
  const btn = document.querySelector('button');
  btn.addEventListener('x402:result', (e) => {
    document.getElementById('out').textContent =
      JSON.stringify(e.detail.result, null, 2);
  });
  btn.addEventListener('x402:error', (e) => {
    document.getElementById('out').textContent = 'Error: ' + e.detail.error;
  });
</script>
```

---

## 2 — Programmatic checkout (`pay()`)

Drive the flow from your own handler and await the result.

```js
import { pay } from '@three-ws/x402-modal';

async function buy() {
  try {
    const out = await pay({
      endpoint: '/api/paid/summarize',
      method: 'POST',
      body: { text: 'hello world' },
      merchant: 'Acme',
      action: 'Summarize',
    });
    console.log('result:', out.result);
    console.log('payment:', out.payment); // { network, payer, transaction }
  } catch (err) {
    if (err.code === 'cancelled') return;  // user closed the modal
    console.error('payment failed:', err.message);
  }
}
```

---

## 3 — Content paywall

Unlock content after a single micropayment. CDN-only, no install.

```html
<button id="buy">Unlock article — $0.05</button>
<article id="content" hidden></article>

<script type="module" src="https://unpkg.com/@three-ws/x402-modal/global"></script>
<script>
  document.getElementById('buy').addEventListener('click', async () => {
    try {
      const out = await window.X402.pay({
        endpoint: '/api/article/42',
        merchant: 'The Daily',
        action: 'Unlock article',
      });
      const el = document.getElementById('content');
      el.textContent = out.result.body;
      el.hidden = false;
      document.getElementById('buy').remove();
    } catch (err) {
      if (err.code !== 'cancelled') alert(err.message);
    }
  });
</script>
```

The endpoint should return `402` for the first request and the article body once
the `X-PAYMENT` settles. SIWX re-entry (see below) lets a returning buyer skip
re-paying.

---

## 4 — React

`pay()` is a plain promise — no provider, no context.

```jsx
import { useState, useCallback } from 'react';
import { pay } from '@three-ws/x402-modal';

export function PayButton({ endpoint }) {
  const [out, setOut] = useState(null);
  const [error, setError] = useState(null);

  const onPay = useCallback(async () => {
    setError(null);
    try {
      const res = await pay({ endpoint, merchant: 'Acme', action: 'Run' });
      setOut(res.result);
    } catch (err) {
      if (err.code === 'cancelled') return;
      setError(err.message);
    }
  }, [endpoint]);

  return (
    <>
      <button onClick={onPay}>Pay &amp; run</button>
      {error && <p role="alert">{error}</p>}
      {out && <pre>{JSON.stringify(out, null, 2)}</pre>}
    </>
  );
}
```

Set global config once in your app entry:

```js
import { configure } from '@three-ws/x402-modal';
configure({ brand: { label: 'Powered by Acme', href: 'https://acme.com' } });
```

---

## 5 — Vue 3

```vue
<script setup>
import { ref } from 'vue';
import { pay } from '@three-ws/x402-modal';

const out = ref(null);
const error = ref(null);

async function onPay() {
  error.value = null;
  try {
    const res = await pay({ endpoint: '/api/paid/run', merchant: 'Acme' });
    out.value = res.result;
  } catch (err) {
    if (err.code !== 'cancelled') error.value = err.message;
  }
}
</script>

<template>
  <button @click="onPay">Pay &amp; run</button>
  <p v-if="error" role="alert">{{ error }}</p>
  <pre v-if="out">{{ out }}</pre>
</template>
```

---

## 6 — Self-hosted & fully branded

Repoint the Solana backend and add a footer, all from the script tag — no JS:

```html
<script
  type="module"
  src="https://your.cdn/x402.global.js"
  data-x402-api-origin="https://pay.your-company.com"
  data-x402-brand-label="Powered by Acme"
  data-x402-brand-href="https://acme.com"
  data-x402-builder-wallet="acme"
  data-x402-builder-service="acme_checkout"></script>
```

Equivalent from JS, before the first `pay()`:

```js
import { configure } from '@three-ws/x402-modal';

configure({
  apiOrigin: 'https://pay.your-company.com',
  brand: { label: 'Powered by Acme', href: 'https://acme.com' },
  builderCode: { wallet: 'acme', service: 'acme_checkout' },
});
```

---

## 7 — Spending caps for an autonomous agent

Cap how much a single browser session can spend, so a misbehaving agent can't
drain a wallet. Amounts are micro-USD (`1_000_000` = `$1`).

```js
import { pay } from '@three-ws/x402-modal';

const out = await pay({
  endpoint: '/api/paid/inference',
  body: { prompt: 'summarize this' },
  autoConnect: true,             // skip the picker if exactly one wallet exists
  caps: {
    maxPerCall: 250_000,         // $0.25 per call
    maxPerHour: 5_000_000,       // $5/hour
    maxPerDay:  20_000_000,      // $20/day
  },
});
```

A breach is rejected **before** the wallet prompt; a downstream failure rolls the
reservation back. Caps are advisory client-side guardrails — enforce
authoritative limits server-side too.

---

## 8 — Declarative buttons with the ESM build

The ESM build is side-effect-free, so it does **not** auto-bind. Call `init()`
yourself (and again after injecting buttons):

```js
import { init } from '@three-ws/x402-modal';

init(); // binds every [data-x402-endpoint] on the page

// after dynamically inserting more buttons:
someContainer.append(newButton);
init(); // idempotent — re-scans, skips already-bound elements
```

---

## 9 — Handling SIWX re-entry

When a server supports Sign-In-With-X, a wallet that has already paid can
re-enter by signing a challenge instead of paying again. `PayResult.siwx` is
present in that case, and the declarative path also fires `x402:siwx-signed`.

```js
const out = await pay({ endpoint: '/api/paid/feed' });

if (out.siwx) {
  console.log('re-entered via sign-in:', out.siwx.address, out.siwx.network);
} else {
  console.log('fresh payment:', out.payment.transaction);
}
console.log('content:', out.result);
```

```js
// declarative equivalent
btn.addEventListener('x402:siwx-signed', (e) =>
  console.log('signed in as', e.detail.address));
btn.addEventListener('x402:result', (e) => render(e.detail.result));
```

---

See [`../TUTORIAL.md`](../TUTORIAL.md) for longer end-to-end walkthroughs and
[`CONFIGURATION.md`](./CONFIGURATION.md) for the full option reference.
