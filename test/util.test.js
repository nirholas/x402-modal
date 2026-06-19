import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	EVM_NETWORKS,
	normalizeAccept,
	isSolanaNetwork,
	isEvmNetwork,
	isEip3009Accept,
	networkLabel,
	explorerUrl,
	formatAmount,
	b64encode,
	b64decode,
	base58encode,
	toMicroUsd,
	spendBuckets,
	buildSiwxMessage,
} from '../src/util.js';

test('formatAmount renders USDC atomics at sensible precision', () => {
	assert.equal(formatAmount(1_000_000), '1.00');
	assert.equal(formatAmount(10_000_000), '10.00');
	assert.equal(formatAmount(1_500_000), '1.50');
	assert.equal(formatAmount(500_000), '0.5');
	assert.equal(formatAmount(1_000), '0.001');
	assert.equal(formatAmount(0), '0');
	// six-decimal token override
	assert.equal(formatAmount(1_000_000_000_000_000_000, 18), '1.00');
});

test('normalizeAccept coerces spec-canonical maxAmountRequired → amount', () => {
	const a = normalizeAccept({ network: 'eip155:8453', maxAmountRequired: 1000 });
	assert.equal(a.amount, '1000');
	// existing amount wins and is left untouched (no clobber)
	const b = normalizeAccept({ amount: '42', maxAmountRequired: 999 });
	assert.equal(b.amount, '42');
	// nothing to normalize → identity
	assert.deepEqual(normalizeAccept(null), null);
});

test('network predicates classify CAIP-2 ids', () => {
	assert.ok(isSolanaNetwork('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'));
	assert.ok(isSolanaNetwork('solana'));
	assert.ok(!isSolanaNetwork('eip155:8453'));
	assert.ok(isEvmNetwork('eip155:8453'));
	assert.ok(!isEvmNetwork('solana:abc'));
});

test('isEip3009Accept selects the legacy entry over a Permit2 sibling', () => {
	assert.ok(isEip3009Accept({ network: 'eip155:8453' }));
	assert.ok(isEip3009Accept({ network: 'eip155:8453', extra: { assetTransferMethod: 'eip3009' } }));
	assert.ok(!isEip3009Accept({ network: 'eip155:8453', extra: { assetTransferMethod: 'permit2' } }));
	assert.ok(!isEip3009Accept({ network: 'solana:abc' }));
});

test('networkLabel + explorerUrl resolve known chains', () => {
	assert.equal(networkLabel('eip155:8453'), 'Base');
	assert.equal(networkLabel('solana:abc'), 'Solana');
	assert.equal(networkLabel('eip155:99999', { extra: { name: 'Frobnet' } }), 'Frobnet');
	assert.equal(explorerUrl('eip155:8453', '0xabc'), 'https://basescan.org/tx/0xabc');
	assert.equal(explorerUrl('solana:x', 'SIG'), 'https://solscan.io/tx/SIG');
	assert.equal(explorerUrl('eip155:8453', null), null);
	// every declared EVM network has chainId + explorer
	for (const [, meta] of Object.entries(EVM_NETWORKS)) {
		assert.ok(Number.isInteger(meta.chainId));
		assert.match(meta.explorer, /^https:\/\/.+\/tx\/$/);
	}
});

test('b64 round-trips structured payloads', () => {
	const obj = { x402Version: 2, scheme: 'exact', n: 'café ☕' };
	assert.deepEqual(b64decode(b64encode(obj)), obj);
	assert.equal(b64decode(''), null);
	assert.equal(b64decode('not-base64-json!!!'), null);
});

test('base58encode matches known Solana vectors', () => {
	assert.equal(base58encode(new Uint8Array([0, 0, 0])), '111');
	assert.equal(base58encode(new Uint8Array([1, 2, 3])), 'Ldp');
	assert.equal(base58encode(new Uint8Array()), '');
});

test('toMicroUsd scales stablecoins and passes non-stable through', () => {
	// USDC, 6 decimals → micro-USD is identity
	assert.equal(toMicroUsd('1000000', { extra: { name: 'USDC', decimals: 6 } }), 1_000_000n);
	// a hypothetical 18-decimal DAI scales down to 6
	assert.equal(toMicroUsd('1000000000000000000', { extra: { name: 'DAI', decimals: 18 } }), 1_000_000n);
	// non-stable: passed through atomic (capped server-side)
	assert.equal(toMicroUsd('5', { extra: { name: 'WBTC', decimals: 8 } }), 5n);
});

test('spendBuckets partitions hour and day windows', () => {
	const t = 1_700_000_000_000;
	const { hour, day } = spendBuckets(t);
	assert.equal(hour, Math.floor(t / 3_600_000));
	assert.equal(day, Math.floor(t / 86_400_000));
	// a later timestamp in the same hour shares a bucket
	assert.equal(spendBuckets(t + 60_000).hour, hour);
});

test('buildSiwxMessage reproduces the SIWS line layout (Solana)', () => {
	const info = {
		domain: 'pay.example.com',
		uri: 'https://pay.example.com/x',
		version: '1',
		nonce: 'abc123',
		issuedAt: '2026-01-01T00:00:00.000Z',
	};
	const chain = { type: 'ed25519', chainId: 'solana:5eykt4UsFv8P8NJ' };
	const msg = buildSiwxMessage(info, chain, 'SoLaNaAddr');
	assert.match(msg, /wants you to sign in with your Solana account:/);
	assert.match(msg, /\nSoLaNaAddr\n/);
	assert.match(msg, /Chain ID: 5eykt4UsFv8P8NJ/);
	assert.match(msg, /Nonce: abc123/);
	// no statement → SIWS does NOT insert the extra blank line the EVM path does
	assert.ok(!msg.includes('\n\n\nURI:'));
});

test('buildSiwxMessage reserves the EVM statement blank line', () => {
	const info = {
		domain: 'pay.example.com',
		uri: 'https://pay.example.com/x',
		version: '1',
		nonce: 'n',
		issuedAt: '2026-01-01T00:00:00.000Z',
	};
	const chain = { type: 'eip191', chainId: 'eip155:8453' };
	const msg = buildSiwxMessage(info, chain, '0xAbC');
	assert.match(msg, /wants you to sign in with your Ethereum account:/);
	assert.match(msg, /Chain ID: 8453/);
	// statement omitted → EVM still carries the extra blank to match siwe
	assert.ok(msg.includes('0xAbC\n\n\nURI:'));
});
