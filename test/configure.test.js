import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configure, getConfig, version, pay, init } from '../src/x402-modal.js';

test('public API surface is intact', () => {
	assert.equal(typeof pay, 'function');
	assert.equal(typeof init, 'function');
	assert.equal(typeof configure, 'function');
	assert.match(version, /^\d+\.\d+\.\d+$/);
});

test('init() is a no-op without a document (does not throw in Node)', () => {
	assert.doesNotThrow(() => init());
});

test('pay() rejects without an endpoint', async () => {
	await assert.rejects(() => pay({}), /endpoint is required/);
});

test('defaults are vendor-neutral until a host opts in', () => {
	const base = getConfig();
	// No footer attribution and no builder-code echo out of the box.
	assert.equal(base.brand, null);
	assert.equal(base.builderCode, null);
	// apiOrigin resolves from the script origin at runtime, so it starts null.
	assert.equal(base.apiOrigin, null);
});

test('configure merges brand and builderCode without dropping siblings', () => {
	configure({ brand: { label: 'Powered by Acme', href: 'https://acme.example' } });
	const afterBrand = getConfig();
	assert.equal(afterBrand.brand.label, 'Powered by Acme');
	assert.equal(afterBrand.brand.href, 'https://acme.example');

	// href left intact since only label is overridden on the second merge
	configure({ brand: { label: 'Acme Pay' } });
	const afterLabel = getConfig();
	assert.equal(afterLabel.brand.label, 'Acme Pay');
	assert.equal(afterLabel.brand.href, 'https://acme.example');

	configure({ apiOrigin: 'https://pay.example.com' });
	assert.equal(getConfig().apiOrigin, 'https://pay.example.com');

	configure({ builderCode: { service: 'acme_checkout' } });
	const afterBuilder = getConfig();
	assert.equal(afterBuilder.builderCode.service, 'acme_checkout');

	configure({ builderCode: { wallet: 'acme' } });
	assert.equal(getConfig().builderCode.wallet, 'acme');
	// service survives the wallet-only merge
	assert.equal(getConfig().builderCode.service, 'acme_checkout');

	// null disables each opt-in entirely
	configure({ builderCode: null });
	assert.equal(getConfig().builderCode, null);
	configure({ brand: null });
	assert.equal(getConfig().brand, null);

	// restore vendor-neutral defaults for any later test run in the same process
	configure({ apiOrigin: null, brand: null, builderCode: null });
});

test("configure honours an explicit empty-string apiOrigin (same-origin)", () => {
	configure({ apiOrigin: '' });
	assert.equal(getConfig().apiOrigin, '');
	configure({ apiOrigin: null });
});
