import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { DesktopIntegrityAdapter } from '../../scripts/prepare-desktop-experiment/DesktopIntegrityAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * Each state calls DesktopIntegrityAdapter.update as its caller does, on an experimental copy in a
 * temporary directory. TMPDIR points at that directory during each call, so the adapter's own
 * temporary folder is made there and must be gone when the call settles: only the workspace folder
 * may remain. A resolved undefined is recorded as null, its JSON form.
 */

const refusal = 'Integrity changes require the experimental copy';
const appName = 'Codex Harness Experimental.app';
/** The marker @electron/asar searches the framework binary for; a used flag and version follow it. */
const sentinel = Buffer.from('AGbevlPCksUGKNL8TSn7wGmJEuJsXb2A');
/** The v1 digest of the one entry in the Info.plist below: its key, algorithm and hash, in order. */
const expectedDigest = createHash('sha256')
	.update('Resources/app.asarSHA256new-header')
	.digest('hex');
const infoPlist =
	'<?xml version="1.0"?><plist version="1.0"><dict><key>ElectronAsarIntegrity</key><dict><key>Resources/app.asar</key><dict><key>algorithm</key><string>SHA256</string><key>hash</key><string>new-header</string></dict></dict></dict></plist>';

/** A framework binary whose sentinel holds the used flag, version 1 and a 32-byte digest. */
function sentinelBinary(used: 0 | 1, digest = Buffer.alloc(32)): Buffer {
	return Buffer.concat([sentinel, Buffer.from([used, 1]), digest]);
}

/** Writes an experimental copy with its Info.plist and framework binary, and returns the binary's path. */
function writeCopy(app: string, binary: Buffer): string {
	const frameworks = join(app, 'Contents', 'Frameworks', 'Codex Framework.framework');
	mkdirSync(frameworks, { recursive: true });
	writeFileSync(join(app, 'Contents', 'Info.plist'), infoPlist);
	writeFileSync(join(frameworks, 'Codex Framework'), binary);
	return join(frameworks, 'Codex Framework');
}

/** The integrity record the binary holds now: its used flag, its version and its digest in hex. */
function storedDigest(binary: string) {
	const bytes = readFileSync(binary);
	const at = sentinel.length;
	return {
		used: bytes.readUInt8(at) === 1,
		version: bytes.readUInt8(at + 1),
		sha256Digest: bytes.subarray(at + 2, at + 34).toString('hex')
	};
}

/** Runs calls with the adapter's temporary folder inside directory, and restores TMPDIR afterwards. */
async function withTmpdir<T>(directory: string, use: () => Promise<T>): Promise<T> {
	vi.stubEnv('TMPDIR', directory);
	try {
		expect(tmpdir()).toBe(directory);
		return await use();
	} finally {
		vi.unstubAllEnvs();
	}
}

/** Settles a call and returns the message it rejected with; a call that resolves says so instead. */
function rejectionMessage(outcome: Promise<unknown>): Promise<string> {
	return outcome.then(
		() => 'resolved',
		(error: Error) => error.message
	);
}

/** A path as recorded: the temporary root shows as a placeholder, so every run records the same text. */
function shown(path: string, root: string): string {
	return path.replace(root, '<temporary>');
}

test('Updates the stored digest of the experimental copy', async () => {
	await withTempDir('desktop-integrity-examples-', async (directory) => {
		const app = join(directory, 'workspace', 'apps', appName);
		const binary = writeCopy(app, sentinelBinary(1));
		const adapter = new DesktopIntegrityAdapter();
		await withTmpdir(directory, async () => {
			await expect(adapter.update(app)).resolves.toBeUndefined();
		});
		expect(storedDigest(binary)).toEqual({ used: true, version: 1, sha256Digest: expectedDigest });
		expect(readdirSync(directory)).toEqual(['workspace']);
		await withTmpdir(directory, async () => {
			await expect(adapter.update(app)).resolves.toBeUndefined();
		});
		expect(storedDigest(binary)).toEqual({ used: true, version: 1, sha256Digest: expectedDigest });
		expect(readdirSync(directory)).toEqual(['workspace']);
		recordExampleCases(
			{
				unitId: 'adapter.desktop-integrity',
				symbol: 'DesktopIntegrityAdapter.update',
				state: 'updates-the-stored-digest-of-the-experimental-copy',
				evidence: 'examples-cases',
				file: 'updates-the-stored-digest-of-the-experimental-copy.json'
			},
			[
				{
					name: 'copy with enabled integrity resolves with no value and stores the calculated digest',
					input: { app: shown(app, directory) },
					output: null
				},
				{
					name: 'the same copy updated again resolves with no value and keeps the same digest',
					input: { app: shown(app, directory) },
					output: null
				}
			]
		);
	});
});

test('Refuses an app path that is not the experimental copy', async () => {
	await withTempDir('desktop-integrity-examples-', async (directory) => {
		const installed = join(directory, 'workspace', 'apps', 'Codex Harness.app');
		const trailing = `${join(directory, 'workspace', 'apps', appName)}/`;
		const adapter = new DesktopIntegrityAdapter();
		const messages = await withTmpdir(directory, () =>
			Promise.all(
				[installed, trailing, appName].map((app) => rejectionMessage(adapter.update(app)))
			)
		);
		expect(messages).toEqual([refusal, refusal, refusal]);
		expect(readdirSync(directory)).toEqual([]);
		recordExampleCases(
			{
				unitId: 'adapter.desktop-integrity',
				symbol: 'DesktopIntegrityAdapter.update',
				state: 'refuses-an-app-path-that-is-not-the-experimental-copy',
				evidence: 'examples-cases',
				file: 'refuses-an-app-path-that-is-not-the-experimental-copy.json'
			},
			[
				{
					name: 'installed app that is not the experimental copy',
					input: { app: shown(installed, directory) },
					error: messages[0]
				},
				{
					name: 'experimental copy path with a trailing slash',
					input: { app: shown(trailing, directory) },
					error: messages[1]
				},
				{
					name: 'bare copy name with no folder before it',
					input: { app: appName },
					error: messages[2]
				}
			]
		);
	});
});

test('Rejects a copy whose ASAR integrity is disabled', async () => {
	await withTempDir('desktop-integrity-examples-', async (directory) => {
		const app = join(directory, 'workspace', 'apps', appName);
		const original = sentinelBinary(0);
		const binary = writeCopy(app, original);
		const message = await withTmpdir(directory, () =>
			rejectionMessage(new DesktopIntegrityAdapter().update(app))
		);
		expect(message).toBe('Expected enabled ASAR integrity');
		expect(readFileSync(binary)).toEqual(original);
		expect(readdirSync(directory)).toEqual(['workspace']);
		recordExampleCases(
			{
				unitId: 'adapter.desktop-integrity',
				symbol: 'DesktopIntegrityAdapter.update',
				state: 'rejects-a-copy-whose-asar-integrity-is-disabled',
				evidence: 'examples-cases',
				file: 'rejects-a-copy-whose-asar-integrity-is-disabled.json'
			},
			[
				{
					name: 'copy whose stored integrity is off is rejected and its binary is left unchanged',
					input: { app: shown(app, directory) },
					error: message
				}
			]
		);
	});
});

test('Rejects a copy with no stored integrity digest', async () => {
	await withTempDir('desktop-integrity-examples-', async (directory) => {
		const app = join(directory, 'workspace', 'apps', appName);
		const original = Buffer.from('framework binary built without the integrity sentinel');
		const binary = writeCopy(app, original);
		const message = await withTmpdir(directory, () =>
			rejectionMessage(new DesktopIntegrityAdapter().update(app))
		);
		expect(message).toBe('No integrity digest found in the binary');
		expect(readFileSync(binary)).toEqual(original);
		expect(readdirSync(directory)).toEqual(['workspace']);
		recordExampleCases(
			{
				unitId: 'adapter.desktop-integrity',
				symbol: 'DesktopIntegrityAdapter.update',
				state: 'rejects-a-copy-with-no-stored-integrity-digest',
				evidence: 'examples-cases',
				file: 'rejects-a-copy-with-no-stored-integrity-digest.json'
			},
			[
				{
					name: 'copy whose binary has no integrity sentinel: the @electron/asar error is not caught',
					input: { app: shown(app, directory) },
					error: message
				}
			]
		);
	});
});
