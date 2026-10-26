import { expect, test } from 'vitest';
import { DesktopIntegrityAdapter } from '../../src/adapters/DesktopIntegrityAdapter';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import manifest from '../../specification/units/adapter.desktop-integrity.json';
import { measureWorkload } from '../support/measureWorkload';

test('copy packaging refreshes the embedded digest and keeps validation enabled', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-integrity-'));
	const app = join(root, 'Codex Harness Experimental.app');
	const framework = join(app, 'Contents/Frameworks/Codex Framework.framework');
	try {
		await mkdir(framework, { recursive: true });
		const sentinel = Buffer.from('AGbevlPCksUGKNL8TSn7wGmJEuJsXb2A');
		const binary = join(framework, 'Codex Framework');
		const plist = join(app, 'Contents/Info.plist');
		await writeFile(binary, Buffer.concat([sentinel, Buffer.from([1, 1]), Buffer.alloc(32)]));
		await writeFile(
			plist,
			'<?xml version="1.0"?><plist version="1.0"><dict><key>ElectronAsarIntegrity</key><dict><key>Resources/app.asar</key><dict><key>algorithm</key><string>SHA256</string><key>hash</key><string>new-header</string></dict></dict></dict></plist>'
		);
		const adapter = new DesktopIntegrityAdapter();
		await expect(
			measureWorkload('adapter.desktop-integrity', 'refresh-copy-integrity', () =>
				adapter.update(app)
			)
		).resolves.toBeUndefined();
		const patched = await readFile(binary);
		expect([...patched.subarray(sentinel.length, sentinel.length + 2)]).toEqual([1, 1]);
		expect(patched.subarray(sentinel.length + 2).toString('hex')).toBe(
			createHash('sha256').update('Resources/app.asarSHA256new-header').digest('hex')
		);
		await rm(plist);
		await expect(adapter.update(app)).rejects.toMatchObject({ code: 'ENOENT' });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('integrity updates refuse the installed original app', async () => {
	const expected = manifest.testing.cases[1].expected.value;
	if (!expected) throw new Error('Missing authored refusal expectation');
	await expect(
		new DesktopIntegrityAdapter().update('/Applications/ChatGPT.app')
	).rejects.toMatchObject(expected);
});
