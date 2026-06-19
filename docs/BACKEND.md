# The backend helper

> **TL;DR — EVM/Base needs no backend.** Only the **Solana** payment path uses
> the helper documented here. If you only accept USDC on Base (or any EVM
> chain), you can ignore this file entirely: the payer signs an EIP-3009
> authorization in their wallet and the modal sends it straight to your merchant
> endpoint.

## Why Solana needs a helper

A browser wallet (Phantom) **signs** serialized transactions — it does not
**build** them. Building a Solana SPL transfer requires:

- a Solana RPC connection (to fetch a recent blockhash, resolve associated token
  accounts, etc.), and
- the **facilitator's fee-payer** public key, so the buyer pays no SOL for gas.

Neither belongs in a public browser script. So the modal delegates the *build*
and *encode* steps to a small server endpoint you host, and the wallet only ever
signs the finished transaction.

The EVM path has no equivalent need: EIP-3009 `transferWithAuthorization` is a
typed-data signature the wallet produces locally, with no RPC and no gas.

## The contract

The modal POSTs to **`{apiOrigin}/api/x402-checkout`** with an `action` query
param. `apiOrigin` defaults to the origin that served the script; override it
with `configure({ apiOrigin })` or `data-x402-api-origin`.

### `POST ?action=prepare`

Build the transfer transaction for the buyer to sign.

**Request body**

```jsonc
{
  "accept": {
    "scheme": "exact",
    "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp1aaqr2BSBLY",
    "asset": "<SPL mint address>",       // e.g. USDC mint
    "payTo": "<merchant wallet>",
    "amount": "10000",                    // atomic (6-decimal USDC → 10000 = $0.01)
    "maxTimeoutSeconds": 600,
    "extra": {
      "name": "USDC",
      "decimals": 6,
      "feePayer": "<facilitator fee-payer pubkey>"
    }
  },
  "buyer": "<buyer wallet pubkey>"
}
```

**Response**

```json
{ "network": "solana:5eykt4Us…", "tx_base64": "<base64 VersionedTransaction>" }
```

`tx_base64` is a v0 `VersionedTransaction` whose fee payer is
`accept.extra.feePayer`, carrying the SPL transfer instruction (and the x402
reference / memo your facilitator expects). The buyer's wallet adds its
signature; the facilitator adds the fee-payer signature at settle time.

### `POST ?action=encode`

Wrap the buyer-signed transaction into the `X-PAYMENT` header value.

**Request body**

```jsonc
{
  "accept": { /* same accept as prepare */ },
  "signed_tx_base64": "<base64 of the wallet-signed VersionedTransaction>",
  "resource_url": "https://api.acme.com/paid/route",   // the merchant endpoint
  "builder_code": { "a": "…", "s": ["…"], "w": "…" }    // optional, echoed from the 402
}
```

**Response**

```json
{ "x_payment": "<base64 x402 paymentPayload>" }
```

The modal then re-sends the original request to `resource_url` with
`X-PAYMENT: <x_payment>`; your x402 merchant middleware verifies and settles it.

## Reference implementation

A production implementation backs three.ws at `api/x402-checkout.js`. Its shape:

```js
// POST /api/x402-checkout?action=prepare|encode
import {
  Connection, PublicKey, TransactionMessage, VersionedTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync, createTransferCheckedInstruction,
} from '@solana/spl-token';

export default async function handler(req, res) {
  const action = new URL(req.url, 'http://x').searchParams.get('action');
  if (action === 'prepare') return prepare(req, res);
  if (action === 'encode')  return encode(req, res);
  return res.status(404).json({ error: 'not_found' });
}

async function prepare(req, res) {
  const { accept, buyer } = await readJson(req);
  const conn = new Connection(process.env.SOLANA_RPC, 'confirmed');
  const mint = new PublicKey(accept.asset);
  const payerKey = new PublicKey(buyer);
  const feePayer = new PublicKey(accept.extra.feePayer);
  const fromAta = getAssociatedTokenAddressSync(mint, payerKey);
  const toAta = getAssociatedTokenAddressSync(mint, new PublicKey(accept.payTo));

  const ix = createTransferCheckedInstruction(
    fromAta, mint, toAta, payerKey, BigInt(accept.amount), accept.extra.decimals,
  );
  // …append the x402 reference account / memo your facilitator requires…

  const { blockhash } = await conn.getLatestBlockhash('confirmed');
  const msg = new TransactionMessage({
    payerKey: feePayer, recentBlockhash: blockhash, instructions: [ix],
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);

  res.json({ network: accept.network, tx_base64: Buffer.from(tx.serialize()).toString('base64') });
}

async function encode(req, res) {
  const { accept, signed_tx_base64, resource_url, builder_code } = await readJson(req);
  const paymentPayload = {
    x402Version: 2,
    scheme: 'exact',
    network: accept.network,
    resource: { url: resource_url, mimeType: 'application/json' },
    accepted: accept,
    payload: { transaction: signed_tx_base64 },
    ...(builder_code ? { extensions: { 'builder-code': builder_code } } : {}),
  };
  res.json({ x_payment: Buffer.from(JSON.stringify(paymentPayload)).toString('base64') });
}
```

Adapt the instruction list, reference accounts, and `paymentPayload.payload`
shape to whatever your x402 **facilitator** expects (e.g. PayAI, Coinbase CDP).
The modal is agnostic to those details — it only cares that `prepare` returns a
signable `tx_base64` and `encode` returns a ready-to-send `x_payment`.

## Hardening checklist

- **Rate-limit `prepare`** — it fans out to multiple RPC round-trips per call.
- **Validate `accept`** against your own catalog; never trust a client-supplied
  `payTo`, `asset`, or `amount` blindly — re-derive them server-side from the
  resource being purchased.
- **Pin the blockhash freshness** so signed transactions can't be replayed after
  expiry.
- **CORS**: if the script and the helper are on different origins, allow the
  script's origin on `/api/x402-checkout`.
