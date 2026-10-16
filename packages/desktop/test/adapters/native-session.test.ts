import { test, expect } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NativeSessionAdapter } from '../../src/adapters/NativeSessionAdapter';
test('native session secrets require OS encryption and deleting credentials preserves pending drafts', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-native-secret-'));
	const secret = {
		origin: 'https://harness.example.invalid',
		principalId: 'google:fixture',
		token: 'private-fixture-token'
	};
	const tokens = new Map<string, string>();
	const encryption = {
		isEncryptionAvailable: () => true,
		getSelectedStorageBackend: () => 'gnome_libsecret',
		encryptString: (value: string) => {
			tokens.set('opaque-fixture', value);
			return Buffer.from('opaque-fixture');
		},
		decryptString: (bytes: Buffer) => tokens.get(bytes.toString())!
	};
	try {
		const path = join(root, 'session.enc'),
			outbox = join(root, 'comments.json');
		const store = new NativeSessionAdapter(path, encryption);
		await store.save(secret);
		expect((await readFile(path)).toString()).not.toContain(secret.token);
		expect(await new NativeSessionAdapter(path, encryption).read()).toEqual(secret);
		const unavailable = new NativeSessionAdapter(path, {
			...encryption,
			isEncryptionAvailable: () => false
		});
		await expect(unavailable.save(secret)).rejects.toThrow('OS encryption');
		expect(await unavailable.read()).toBeNull();
		await writeFile(outbox, 'pending human draft');
		await store.clear();
		expect(await store.read()).toBeNull();
		expect(await readFile(outbox, 'utf8')).toBe('pending human draft');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test.each(['basic_text', 'unknown', undefined])(
	'Linux refuses %s even when encryption availability reports true',
	async (backend) => {
		const root = await mkdtemp(join(tmpdir(), 'harness-linux-secret-'));
		const file = join(root, 'session.enc');
		const secret = {
			origin: 'https://example.invalid',
			principalId: 'fixture',
			token: 'private-fixture'
		};
		let encrypted = false,
			decrypted = false;
		const encryption = {
			isEncryptionAvailable: () => true,
			getSelectedStorageBackend: () => backend,
			encryptString: () => {
				encrypted = true;
				return Buffer.from('unsafe');
			},
			decryptString: () => {
				decrypted = true;
				return JSON.stringify(secret);
			}
		};
		try {
			await writeFile(file, 'existing ciphertext');
			const store = new NativeSessionAdapter(file, encryption, 'linux');
			expect(store.available()).toBe(false);
			await expect(store.save(secret)).rejects.toThrow('OS encryption');
			expect(await store.read()).toBeNull();
			expect(encrypted).toBe(false);
			expect(decrypted).toBe(false);
			expect(await readFile(file, 'utf8')).toBe('existing ciphertext');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}
);

test.each(['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'])(
	'Linux recognizes OS-backed %s',
	(backend) => {
		const store = new NativeSessionAdapter(
			'/unused/session.enc',
			{
				isEncryptionAvailable: () => true,
				getSelectedStorageBackend: () => backend,
				encryptString: Buffer.from,
				decryptString: (value) => value.toString()
			},
			'linux'
		);
		expect(store.available()).toBe(true);
	}
);
test.each(['darwin', 'win32'] as const)(
	'native %s retains platform availability without Linux backend probing',
	(platform) => {
		const store = new NativeSessionAdapter(
			'/unused/session.enc',
			{
				isEncryptionAvailable: () => true,
				getSelectedStorageBackend: () => {
					throw new Error('Linux only');
				},
				encryptString: Buffer.from,
				decryptString: (value) => value.toString()
			},
			platform
		);
		expect(store.available()).toBe(true);
	}
);
