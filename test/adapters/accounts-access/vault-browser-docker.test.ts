import { expect, test } from 'vitest';
import { VaultBrowserDockerAdapter } from '../../../src/adapters/accounts-access/VaultBrowserDockerAdapter';

const config = {
	image: 'sha256:' + '1'.repeat(64),
	seccomp: '/opt/harness/vault/seccomp.json',
	journal: '/var/db/harness/vault-fixtures'
};

test('launch requires an immutable image and refuses non-fixture web origins', async () => {
	expect(() => new VaultBrowserDockerAdapter({ ...config, image: 'chromium:latest' })).toThrow(
		'full local image ID'
	);
	const adapter = new VaultBrowserDockerAdapter(config);
	await expect(adapter.launch({ origins: ['https://example.com'], redirects: [] })).rejects.toThrow(
		'synthetic .test origins'
	);
});

test('launch refuses an unscoped Docker network or a host with no fixture address', async () => {
	const adapter = new VaultBrowserDockerAdapter(config);
	const recipe = { origins: ['https://console.example.test'], redirects: [] };
	await expect(adapter.launch({ ...recipe, network: { id: 'bridge', hosts: {} } })).rejects.toThrow(
		'full private Docker network ID'
	);
	await expect(
		adapter.launch({ ...recipe, network: { id: 'a'.repeat(64), hosts: {} } })
	).rejects.toThrow('mapped IPv4 fixture address');
});
