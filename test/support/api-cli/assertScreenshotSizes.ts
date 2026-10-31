import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '../../verificationExpect';
import type { apiFixture } from './apiFixture';
import { png } from './apiFixture';

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
