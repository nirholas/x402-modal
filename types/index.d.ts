// Type definitions for @three-ws/x402-modal

/** A CAIP-2 network id, e.g. `solana:5eyk…`, `eip155:8453` (Base). */
export type NetworkId = string;

/** Footer attribution shown at the bottom of the modal. */
export interface Brand {
	/** Visible label, e.g. "Powered by Acme". */
	label?: string;
	/** Optional link target; renders the label as an anchor when present. */
	href?: string;
}

/**
 * ERC-8021 builder-code self-attribution echoed back when the 402 challenge
 * declares a builder code. Set the whole field to `null` to disable the echo.
 */
export interface BuilderCode {
	/** Your wallet code (`[a-z0-9_]{1,32}`). */
	wallet?: string;
	/** Your integration / service code (`[a-z0-9_]{1,32}`). */
	service?: string;
}

/** Per-wallet spending caps, enforced in localStorage. Amounts are µUSD (1e6 = $1). */
export interface SpendingCaps {
	/** Max micro-USD a single call may spend. */
	maxPerCall?: number | string;
	/** Max micro-USD per rolling UTC hour. */
	maxPerHour?: number | string;
	/** Max micro-USD per rolling UTC day. */
	maxPerDay?: number | string;
}

/** Global configuration. Defaults reproduce three.ws's hosted behaviour. */
export interface X402Config {
	/**
	 * Origin serving the Solana `prepare`/`encode` checkout helpers
	 * (`POST {apiOrigin}/api/x402-checkout?action=prepare|encode`). Only the
	 * Solana path uses it; the EVM/EIP-3009 path needs no backend. `null`
	 * resolves from the script's own origin. `''` means same-origin.
	 */
	apiOrigin?: string | null;
	brand?: Brand;
	/** `null` disables the builder-code echo entirely. */
	builderCode?: BuilderCode | null;
	/** CDN URL for `@solana/web3.js`, dynamic-imported on the Solana path. */
	solanaWeb3Url?: string;
	/** CDN URL for `@noble/hashes/sha3`, dynamic-imported on the EVM SIWX path. */
	nobleHashesUrl?: string;
}

/** Options for a single {@link pay} call. */
export interface PayOptions {
	/** The x402-protected endpoint to pay for and call. Required. */
	endpoint: string;
	/** HTTP method to use against `endpoint`. Defaults to GET (POST when a body is set). */
	method?: string;
	/** Request body forwarded to the endpoint (object → JSON, or a raw string). */
	body?: unknown;
	/** Extra request headers merged into the discovery + paid calls. */
	headers?: Record<string, string>;
	/** Merchant name shown in the modal header. */
	merchant?: string;
	/** Action label shown in the modal header (e.g. "Summarize"). */
	action?: string;
	/** Per-wallet spending caps for this call. */
	caps?: SpendingCaps;
	/** Skip the wallet picker when exactly one supported wallet is detected. */
	autoConnect?: boolean;
	/** Per-call override of the Solana checkout API origin. */
	apiOrigin?: string;
	/** Per-call override of the footer brand. */
	brand?: Brand;
}

/** Settlement details parsed from the `x-payment-response` header. */
export interface PaymentReceipt {
	network?: NetworkId;
	payer?: string;
	transaction?: string;
	[k: string]: unknown;
}

/** SIWX re-entry details when the wallet signed in instead of paying. */
export interface SiwxReceipt {
	address: string;
	network: NetworkId | string;
}

/** Resolved value of a successful {@link pay} call. */
export interface PayResult {
	ok: true;
	/** The merchant endpoint's response body (parsed JSON or raw text). */
	result: unknown;
	/** Present on a fresh payment. */
	payment?: PaymentReceipt;
	/** Present when the user re-entered via SIWX instead of paying. */
	siwx?: SiwxReceipt;
	response: { status: number; headers: Record<string, string> };
}

/** Merge config into the global defaults. Returns the resolved snapshot. */
export function configure(opts?: X402Config): Required<X402Config>;

/** Read the current resolved global config. */
export function getConfig(): Required<X402Config>;

/**
 * Open the payment modal for an x402 endpoint. Resolves after settlement, or
 * rejects with an `Error` whose `code` is `'cancelled'` if the user closes it.
 */
export function pay(opts: PayOptions): Promise<PayResult>;

/** Scan the document and bind every `[data-x402-endpoint]` element. Idempotent. */
export function init(): void;

/** Bind one element's click to open the modal (sets the `x402:result` event). */
export function bindElement(el: Element): void;

/** Read {@link PayOptions} from an element's `data-x402-*` attributes. */
export function readOptsFrom(el: Element): PayOptions;

/** The package version string. */
export const version: string;

/** The low-level modal controller. Most callers should use {@link pay}. */
export class CheckoutModal {
	constructor(opts: PayOptions);
	mount(): Promise<PayResult>;
	start(): Promise<void>;
	close(reason?: string): void;
}

declare global {
	interface Window {
		X402?: {
			pay: typeof pay;
			init: typeof init;
			configure: typeof configure;
			version: string;
		};
	}
	interface HTMLElementEventMap {
		'x402:result': CustomEvent<PayResult>;
		'x402:error': CustomEvent<{ error: string }>;
		'x402:siwx-signed': CustomEvent<SiwxReceipt>;
	}
}
