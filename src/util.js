// Pure, browser-API-free helpers shared by the modal. Kept in their own module
// so they can be unit-tested in Node without a DOM, and so the core stays lean.

// USDC EIP-3009 typed-data sig works against Base USDC. The domain `version`
// must match the on-chain `EIP712_DOMAIN_SEPARATOR_VERSION` — Base USDC is "2".
export const EVM_NETWORKS = {
	'eip155:8453': { chainId: 8453, name: 'Base', explorer: 'https://basescan.org/tx/' },
	'eip155:84532': { chainId: 84532, name: 'Base Sepolia', explorer: 'https://sepolia.basescan.org/tx/' },
	'eip155:42161': { chainId: 42161, name: 'Arbitrum', explorer: 'https://arbiscan.io/tx/' },
	'eip155:10': { chainId: 10, name: 'Optimism', explorer: 'https://optimistic.etherscan.io/tx/' },
};

// Stablecoins whose atomics are already 6-decimal USD-pegged (used by caps).
export const STABLE_NAMES = new Set([
	'usdc', 'usd coin', 'usdt', 'tether', 'binance-peg usd coin', 'dai',
]);

// Normalize a single 402 `accept` entry. The x402 spec's canonical atomic-price
// field is `maxAmountRequired`; some merchants emit `amount`. We read `amount`
// everywhere downstream, so coerce here once. Without this a spec-compliant
// merchant yields `accept.amount === undefined` → "NaN USDC".
export function normalizeAccept(accept) {
	if (!accept || typeof accept !== 'object') return accept;
	const amount = accept.amount ?? accept.maxAmountRequired;
	return amount != null && accept.amount == null ? { ...accept, amount: String(amount) } : accept;
}

export function isSolanaNetwork(net) {
	return typeof net === 'string' && (net === 'solana' || net.startsWith('solana:'));
}
export function isEvmNetwork(net) {
	return typeof net === 'string' && net.startsWith('eip155:');
}
// The modal only signs EIP-3009 transferWithAuthorization for EVM. When the
// server publishes both an EIP-3009 entry and a Permit2 sibling (the
// gas-sponsoring path), pick the EIP-3009 one — the sibling carries
// `extra.assetTransferMethod === 'permit2'`.
export function isEip3009Accept(accept) {
	if (!isEvmNetwork(accept?.network)) return false;
	const method = accept?.extra?.assetTransferMethod;
	return !method || method === 'eip3009';
}
export function networkLabel(net, accept) {
	if (isSolanaNetwork(net)) return 'Solana';
	const meta = EVM_NETWORKS[net];
	return meta?.name || accept?.extra?.name || net;
}
export function explorerUrl(net, tx) {
	if (!tx) return null;
	if (isSolanaNetwork(net)) return `https://solscan.io/tx/${tx}`;
	const meta = EVM_NETWORKS[net];
	return meta ? `${meta.explorer}${tx}` : null;
}

export function formatAmount(rawAtomics, decimals = 6) {
	const n = Number(rawAtomics) / 10 ** decimals;
	if (n < 0.01) return n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
	if (n < 1) return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
	return n.toFixed(2);
}

export function b64encode(obj) {
	const json = JSON.stringify(obj);
	if (typeof Buffer !== 'undefined') return Buffer.from(json, 'utf8').toString('base64');
	return btoa(unescape(encodeURIComponent(json)));
}
export function b64decode(str) {
	if (!str) return null;
	try {
		const bin = typeof Buffer !== 'undefined' ? Buffer.from(str, 'base64').toString('utf8') : decodeURIComponent(escape(atob(str)));
		return JSON.parse(bin);
	} catch (_) {
		return null;
	}
}

// Base58 (Bitcoin alphabet) — Solana's encoding for addresses and signatures.
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58encode(bytes) {
	if (!bytes || bytes.length === 0) return '';
	let leadingZeros = 0;
	while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros++;
	let n = 0n;
	for (let i = 0; i < bytes.length; i++) n = (n << 8n) | BigInt(bytes[i]);
	let out = '';
	while (n > 0n) {
		out = BASE58_ALPHABET[Number(n % 58n)] + out;
		n /= 58n;
	}
	for (let i = 0; i < leadingZeros; i++) out = BASE58_ALPHABET[0] + out;
	return out;
}

// Convert an asset's atomic amount to micro-USD for cap accounting. Stablecoins
// pass through (scaled to 6 decimals); non-stable assets pass through atomic and
// must be capped server-side (the browser modal fetches no prices).
export function toMicroUsd(amount, accept) {
	const atomic = BigInt(amount);
	const decimals = Number(accept?.extra?.decimals ?? 6);
	const name = String(accept?.extra?.name || '').toLowerCase();
	if (STABLE_NAMES.has(name)) {
		if (decimals === 6) return atomic;
		if (decimals > 6) return atomic / 10n ** BigInt(decimals - 6);
		return atomic * 10n ** BigInt(6 - decimals);
	}
	return atomic;
}

export function spendBuckets(timestamp = Date.now()) {
	const hour = Math.floor(timestamp / 3_600_000);
	const day = Math.floor(timestamp / 86_400_000);
	return { hour, day };
}

// Build the CAIP-122 SIWX message string. The server rebuilds the same string
// from payload fields when verifying — any line-by-line drift makes the
// recovered signer mismatch payload.address and the signature is rejected.
export function buildSiwxMessage(info, chain, address) {
	const isEvm = chain.type === 'eip191';
	const accountHeader = isEvm
		? `${info.domain} wants you to sign in with your Ethereum account:`
		: `${info.domain} wants you to sign in with your Solana account:`;
	const [, chainTail = ''] = String(chain.chainId).split(':');
	const chainRef = isEvm ? String(parseInt(chainTail, 10)) : chainTail;

	const lines = [accountHeader, address, ''];
	if (info.statement) {
		lines.push(info.statement, '');
	} else if (isEvm) {
		// siwe's prepareMessage() reserves the statement block even when absent,
		// emitting an extra blank line. SIWS does not.
		lines.push('');
	}
	lines.push(`URI: ${info.uri}`);
	lines.push(`Version: ${info.version || '1'}`);
	lines.push(`Chain ID: ${chainRef}`);
	lines.push(`Nonce: ${info.nonce}`);
	lines.push(`Issued At: ${info.issuedAt}`);
	if (info.expirationTime) lines.push(`Expiration Time: ${info.expirationTime}`);
	if (info.notBefore) lines.push(`Not Before: ${info.notBefore}`);
	if (info.requestId !== undefined && info.requestId !== null) lines.push(`Request ID: ${info.requestId}`);
	if (Array.isArray(info.resources) && info.resources.length) {
		lines.push('Resources:');
		for (const r of info.resources) lines.push(`- ${r}`);
	}
	return lines.join('\n');
}
