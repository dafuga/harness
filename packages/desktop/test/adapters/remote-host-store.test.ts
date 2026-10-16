import { afterEach, expect, test } from 'vitest';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RemoteHostStoreAdapter } from '../../src/adapters/RemoteHostStoreAdapter';
import type { RemoteHostState } from '../../src/adapters/RemoteHostStoreAdapter';

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const encryption = (available = true) => ({
	isEncryptionAvailable: () => available,
	encryptString: (value: string) => Buffer.from('sealed:' + Buffer.from(value).toString('hex')),
	decryptString: (value: Buffer) => {
		const text = value.toString();
		if (!text.startsWith('sealed:')) throw new Error('not sealed');
		return Buffer.from(text.slice(7), 'hex').toString();
	}
});
const state: RemoteHostState = {
	enabled: true,
	origin: 'https://relay.example',
	hostId: 'a'.repeat(40),
	keys: { d: 'private-scalar-value', publicKey: 'public-point-value' },
	credential: 'host-credential-value',
	generation: 2,
	devices: [],
	revoked: []
};
async function store(available = true) {
	const root = await mkdtemp(join(tmpdir(), 'harness-remote-store-'));
	roots.push(root);
	const file = join(root, 'private', 'remote.enc');
	const config = { file, encryption: encryption(available), platform: 'darwin' as const };
	return { file, adapter: new RemoteHostStoreAdapter(config) };
}

test('state is written encrypted, for the owner only, and read back', async () => {
	const { file, adapter } = await store();
	expect(adapter.available()).toBe(true);
	expect(await adapter.read()).toBeNull();
	await adapter.save(state);
	const raw = (await readFile(file)).toString();
	for (const secret of ['host-credential-value', 'private-scalar-value', 'relay.example'])
		expect(raw).not.toContain(secret);
	expect((await stat(file)).mode & 0o777).toBe(0o600);
	expect(await adapter.read()).toEqual(state);
});
test('without OS encryption nothing is written and nothing is read', async () => {
	const { file, adapter } = await store(false);
	expect(adapter.available()).toBe(false);
	await expect(adapter.save(state)).rejects.toThrow('encryption');
	await expect(stat(file)).rejects.toThrow();
	await expect(adapter.read()).rejects.toThrow('encryption');
});
test('a file that cannot be opened or is not this state is refused, never replaced by defaults', async () => {
	const { file, adapter } = await store();
	await adapter.save(state);
	await writeFile(file, 'plain text, not sealed');
	await expect(adapter.read()).rejects.toThrow();
	await writeFile(file, encryption().encryptString(JSON.stringify({ enabled: true })));
	await expect(adapter.read()).rejects.toThrow();
});
test('clear removes the state', async () => {
	const { file, adapter } = await store();
	await adapter.save(state);
	await adapter.clear();
	await expect(stat(file)).rejects.toThrow();
	expect(await adapter.read()).toBeNull();
	await adapter.clear();
});
