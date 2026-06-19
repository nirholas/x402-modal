// examples/server.mjs — reference Solana checkout helper for @three-ws/x402-modal.
//
// The EVM/Base payment path is fully client-side and needs NO backend. This
// helper exists only for the Solana path, which must build a transfer
// transaction (RPC + facilitator fee-payer) for Phantom to sign.
//
// It implements the two actions the modal calls:
//   POST /api/x402-checkout?action=prepare  { accept, buyer }
//        → { network, tx_base64 }
//   POST /api/x402-checkout?action=encode   { accept, signed_tx_base64, resource_url, builder_code? }
//        → { x_payment }
//
// Run it:
//   npm i @solana/web3.js @solana/spl-token
//   SOLANA_RPC="https://api.mainnet-beta.solana.com" node examples/server.mjs
//
// Then point the modal at it:
//   configure({ apiOrigin: 'http://localhost:8787' })
//
// In production, validate `accept` against your own catalog (never trust a
// client-supplied payTo/asset/amount), rate-limit `prepare`, and shape
// `payload` to whatever your x402 facilitator expects. See ../docs/BACKEND.md.

import { createServer } from 'node:http';
import {
	Connection,
	PublicKey,
	TransactionMessage,
	VersionedTransaction,
} from '@solana/web3.js';
import {
	getAssociatedTokenAddressSync,
	createTransferCheckedInstruction,
} from '@solana/spl-token';

const PORT = Number(process.env.PORT || 8787);
const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC, 'confirmed');

function isSolana(net) {
	return typeof net === 'string' && (net === 'solana' || net.startsWith('solana:'));
}

async function readJson(req) {
	const chunks = [];
	for await (const c of req) chunks.push(c);
	return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function json(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		'content-type': 'application/json',
		// Allow cross-origin use when the script is served from another origin.
		'access-control-allow-origin': '*',
		'access-control-allow-headers': 'content-type',
		'access-control-allow-methods': 'POST, OPTIONS',
	});
	res.end(payload);
}

async function handlePrepare(req, res) {
	const { accept, buyer } = await readJson(req);
	if (!isSolana(accept?.network)) {
		return json(res, 400, {
			error: 'wrong_network',
			error_description: 'prepare only builds Solana transactions; EVM clients sign EIP-3009 locally.',
		});
	}

	const mint = new PublicKey(accept.asset);
	const buyerKey = new PublicKey(buyer);
	const payTo = new PublicKey(accept.payTo);
	const feePayer = new PublicKey(accept.extra.feePayer);
	const decimals = Number(accept.extra.decimals ?? 6);
	const amount = BigInt(accept.amount);

	const fromAta = getAssociatedTokenAddressSync(mint, buyerKey);
	const toAta = getAssociatedTokenAddressSync(mint, payTo);

	const ix = createTransferCheckedInstruction(
		fromAta, mint, toAta, buyerKey, amount, decimals,
	);
	// Append the x402 reference account your facilitator watches for settlement.
	// Many facilitators expect a read-only reference pubkey on the transfer ix:
	if (accept.extra.reference) {
		ix.keys.push({ pubkey: new PublicKey(accept.extra.reference), isSigner: false, isWritable: false });
	}

	const { blockhash } = await connection.getLatestBlockhash('confirmed');
	const message = new TransactionMessage({
		payerKey: feePayer,
		recentBlockhash: blockhash,
		instructions: [ix],
	}).compileToV0Message();
	const tx = new VersionedTransaction(message);

	return json(res, 200, {
		network: accept.network,
		tx_base64: Buffer.from(tx.serialize()).toString('base64'),
	});
}

async function handleEncode(req, res) {
	const { accept, signed_tx_base64, resource_url, builder_code } = await readJson(req);
	if (!signed_tx_base64 || !resource_url) {
		return json(res, 400, { error: 'bad_request', error_description: 'signed_tx_base64 and resource_url are required' });
	}

	// Standard Solana exact-scheme payload. Adapt `payload` to your facilitator.
	const paymentPayload = {
		x402Version: 2,
		scheme: 'exact',
		network: accept.network,
		resource: { url: resource_url, mimeType: 'application/json' },
		accepted: accept,
		payload: { transaction: signed_tx_base64 },
		...(builder_code ? { extensions: { 'builder-code': builder_code } } : {}),
	};

	return json(res, 200, {
		x_payment: Buffer.from(JSON.stringify(paymentPayload), 'utf8').toString('base64'),
	});
}

const server = createServer(async (req, res) => {
	try {
		if (req.method === 'OPTIONS') return json(res, 204, {});
		const url = new URL(req.url, `http://${req.headers.host}`);
		if (req.method === 'POST' && url.pathname === '/api/x402-checkout') {
			const action = url.searchParams.get('action');
			if (action === 'prepare') return await handlePrepare(req, res);
			if (action === 'encode') return await handleEncode(req, res);
			return json(res, 404, { error: 'not_found', error_description: `unknown action: ${action ?? '(none)'}` });
		}
		return json(res, 404, { error: 'not_found' });
	} catch (err) {
		return json(res, 500, { error: 'server_error', error_description: String(err?.message || err) });
	}
});

server.listen(PORT, () => {
	console.log(`x402-checkout helper on http://localhost:${PORT}  (RPC: ${RPC})`);
});
