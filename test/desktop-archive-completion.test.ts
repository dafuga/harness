import { afterEach, expect, test, vi } from 'vitest';
import * as asar from '@electron/asar';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { WriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { setImmediate } from 'node:timers';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { DesktopArchiveAdapter } from '../src/adapters/DesktopArchiveAdapter';

vi.mock('@electron/asar', async (original) => ({
	...(await original<typeof asar>()),
	createPackageFromStreams: vi.fn()
}));

afterEach(() => vi.resetAllMocks());

async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'harness-archive-completion-'));
	const input = join(root, 'input');
	await mkdir(input);
	await writeFile(join(input, 'main.js'), 'original');
	const source = join(root, 'source.asar');
	await finished(await asar.createPackageWithOptions(input, source, {}));
	const target = join(root, 'target.asar');
	await copyFile(source, target);
	return { root, source, target };
}

test('patch waits for the archive output to finish before returning its digest', async () => {
	const { root, source, target } = await fixture();
	let release = () => {};
	const output = new Writable({
		final(done) {
			release = done;
		}
	});
	output.end();
	vi.mocked(asar.createPackageFromStreams).mockResolvedValue(output as WriteStream);
	try {
		const patch = new DesktopArchiveAdapter().patch(source, target, new Map());
		const outcome = patch.then(() => 'returned');
		expect(await Promise.race([outcome, nextTurn('pending')])).toBe('pending');
		release();
		expect(await patch).toMatch(/^[a-f0-9]{64}$/u);
	} finally {
		release();
		await finished(output);
		await rm(root, { recursive: true, force: true });
	}
});

test('patch rejects a destination write error instead of returning a digest', async () => {
	const { root, source, target } = await fixture();
	const output = new Writable({ final() {} });
	output.on('error', () => {});
	output.end();
	vi.mocked(asar.createPackageFromStreams).mockResolvedValue(output as WriteStream);
	try {
		const patch = new DesktopArchiveAdapter().patch(source, target, new Map());
		setImmediate(() => output.destroy(new Error('archive destination failed')));
		await expect(patch).rejects.toThrow('archive destination failed');
	} finally {
		output.destroy();
		await rm(root, { recursive: true, force: true });
	}
});
