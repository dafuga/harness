import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '../../verificationExpect';
import type { apiFixture } from './apiFixture';
import { commit, png } from './apiFixture';

/** Size selection runs through the same authenticated local/hosted CLI boundary as presets. */
export async function assertScreenshotSizes(
	f: Awaited<ReturnType<typeof apiFixture>>
): Promise<void> {
	const sized = join(f.directory, 'sized.png');
	await f.cli(['screenshot', 'page.example', '--size', '1440x900', '--output', sized]);
	expect(await readFile(sized)).toEqual(png);
	for (const flags of [
		['--size', '390X844'],
		['--size', '390x844', '--viewport', 'mobile']
	]) {
		const rejected = await f.cli(
			['screenshot', 'page.example', ...flags, '--output', join(f.directory, 'bad.png')],
			false
		);
		expect(rejected.stderr).toContain('--size');
	}
}

/** Exact bytes, provenance and corruption rejection belong to the same standard screenshot case. */
export async function assertScreenshotDownload(
	f: Awaited<ReturnType<typeof apiFixture>>
): Promise<void> {
	const output = join(f.directory, 'page.png');
	const result = await f.cli([
		'screenshot',
		'page.example',
		'--viewport',
		'desktop',
		'--state',
		'ready',
		'--output',
		output
	]);
	expect(await readFile(output)).toEqual(png);
	expect(JSON.parse(result.stdout)).toMatchObject({
		path: output,
		entityId: 'page.example',
		commit,
		viewport: 'desktop',
		state: 'ready',
		mediaType: 'image/png'
	});
	expect(f.seen.find((r) => r.operation === 'artifact')?.input).toMatchObject({
		entityId: 'page.example',
		commit,
		scenarioId: 'page-screens',
		recordId: 'b'.repeat(64),
		evidenceId: 'screen',
		notesRevision: null,
		evidenceRevision: null
	});
	await assertScreenshotSizes(f);
	f.corrupt();
	const failed = await f.cli(
		['screenshot', 'page.example', '--output', join(f.directory, 'corrupt.png')],
		false
	);
	expect(failed.exitCode).toBe(1);
	expect(failed.stderr).toMatch(/hash|SHA-256|integrity/i);
}
