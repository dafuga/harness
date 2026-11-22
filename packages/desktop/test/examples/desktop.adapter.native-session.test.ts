import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { NativeSessionAdapter } from '../../src/adapters/networking-security/NativeSessionAdapter';
import type { NativeEncryption } from '../../src/adapters/networking-security/NativeSessionAdapter.types';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const CREDENTIAL = {
	origin: 'https://hosted.example.com',
	principalId: 'principal_7d41c09e',
	token: 'tok_9f2c71ab56e04d3c'
};

const UNAVAILABLE_MESSAGE = 'Stored hosted session is unavailable. Sign in again.';

function fakeEncryption(options: { available?: boolean; backend?: string } = {}): NativeEncryption {
	return {
		isEncryptionAvailable: () => options.available ?? true,
		getSelectedStorageBackend: () => options.backend ?? 'gnome_libsecret',
		encryptString: (value) => Buffer.from(`enc:${value}`, 'utf8'),
		decryptString: (bytes) => bytes.toString('utf8').replace(/^enc:/, '')
	};
}

function makeSessionFile() {
	const dir = mkdtempSync(join(tmpdir(), 'native-session-'));
	return { dir, file: join(dir, 'state', 'hosted-session.bin') };
}

function failureOf(promise: Promise<unknown>) {
	return promise.then(
		() => null,
		(error: unknown) =>
			error instanceof Error
				? { name: error.name, message: error.message }
				: { name: 'UnknownError', message: String(error) }
	);
}

function meta(symbol: string, state: string) {
	return {
		unitId: 'desktop.adapter.native-session',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Saves an encrypted session and reads it back', async () => {
	const state = 'saves-an-encrypted-session-and-reads-it-back';
	const { dir, file } = makeSessionFile();
	try {
		const adapter = new NativeSessionAdapter(file, fakeEncryption(), 'darwin');
		await adapter.save(CREDENTIAL);
		const onDisk = readFileSync(file, 'utf8');
		const read = await adapter.read();
		adapter.invalidate();
		const files = readdirSync(dirname(file));
		expect(read).toEqual(CREDENTIAL);
		expect(onDisk.startsWith('enc:')).toBe(true);
		expect(adapter.generation).toBe(2);
		expect(files).toEqual(['hosted-session.bin']);
		recordExampleCases(meta('save', state), [
			{ name: 'Save then read returns the stored credential', input: { credential: CREDENTIAL }, output: read },
			{
				name: 'Saved bytes are encrypted and the temp file is renamed away',
				input: { file: 'hosted-session.bin' },
				output: { encryptedPrefix: onDisk.slice(0, 4), generation: adapter.generation, files }
			}
		]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('Refuses to save without OS encryption and reads nothing', async () => {
	const state = 'refuses-to-save-without-os-encryption-and-reads-nothing';
	const { dir, file } = makeSessionFile();
	try {
		const locked = new NativeSessionAdapter(file, fakeEncryption({ available: false }), 'darwin');
		const failure = await failureOf(locked.save(CREDENTIAL));
		const read = await locked.read();
		const linux = new NativeSessionAdapter(file, fakeEncryption({ backend: 'basic_text' }), 'linux');
		const linuxAvailable = linux.available();
		const exists = existsSync(file);
		expect(failure).toEqual({
			name: 'HostedSessionEncryptionRequiredError',
			message: 'OS encryption is required for hosted sessions.'
		});
		expect(read).toBeNull();
		expect(linuxAvailable).toBe(false);
		expect(exists).toBe(false);
		recordExampleCases(meta('save', state), [
			{ name: 'Save is rejected when encryption is unavailable', input: { available: false, credential: CREDENTIAL }, error: failure },
			{ name: 'Read returns null while the session is unavailable', input: { available: false }, output: read },
			{ name: 'Linux with a basic_text backend is not available', input: { platform: 'linux', backend: 'basic_text' }, output: linuxAvailable }
		]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('Rejects a stored session that is missing its token', async () => {
	const state = 'rejects-a-stored-session-that-is-missing-its-token';
	const { dir, file } = makeSessionFile();
	try {
		mkdirSync(dirname(file), { recursive: true });
		const partial = { origin: CREDENTIAL.origin, principalId: CREDENTIAL.principalId };
		writeFileSync(file, `enc:${JSON.stringify(partial)}`);
		const adapter = new NativeSessionAdapter(file, fakeEncryption(), 'darwin');
		const missingToken = await failureOf(adapter.read());
		writeFileSync(file, 'enc:not-json');
		const notJson = await failureOf(adapter.read());
		expect(missingToken).toEqual({ name: 'StoredHostedSessionUnavailableError', message: UNAVAILABLE_MESSAGE });
		expect(notJson).toEqual(missingToken);
		recordExampleCases(meta('read', state), [
			{ name: 'A stored session without a token is unavailable', input: { stored: partial }, error: missingToken },
			{ name: 'A stored session that is not JSON is unavailable', input: { stored: 'not-json' }, error: notJson }
		]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('Clears a saved session and tolerates a missing file', async () => {
	const state = 'clears-a-saved-session-and-tolerates-a-missing-file';
	const { dir, file } = makeSessionFile();
	try {
		const adapter = new NativeSessionAdapter(file, fakeEncryption(), 'darwin');
		await adapter.save(CREDENTIAL);
		await adapter.clear();
		const read = await adapter.read();
		const removed = !existsSync(file);
		await adapter.clear();
		expect(read).toBeNull();
		expect(removed).toBe(true);
		expect(adapter.generation).toBe(3);
		recordExampleCases(meta('clear', state), [
			{ name: 'Clear removes the saved session file', input: { credential: CREDENTIAL }, output: { read, removed } },
			{ name: 'Clear again resolves when the file is already gone', input: {}, output: { generation: adapter.generation } }
		]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
