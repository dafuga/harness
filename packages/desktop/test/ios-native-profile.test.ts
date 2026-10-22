import { test } from 'vitest';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { expect } from '../../../test/verificationExpect';

/** Real Swift checks on macOS. Other platforms have an explicit native coverage gap. */
async function nativeCheck(script: string) {
	const result = await new Promise<{
		error: Error | null;
		status: number | string;
		stdout: string;
		stderr: string;
	}>((done) => {
		execFile(
			'bun',
			['run', script],
			{
				cwd: resolve(import.meta.dirname, '..'),
				encoding: 'utf8',
				timeout: 120000,
				maxBuffer: 2_000_000
			},
			(error, stdout, stderr) => done({ error, status: error?.code ?? 0, stdout, stderr })
		);
	});
	const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
	console.info(output);
	expect(result.error ?? null).toBeNull();
	expect(result.status).toBe(0);
	return output;
}

test.skipIf(process.platform !== 'darwin')(
	'Swift reproduces the backend encrypted protocol vectors',
	async () => {
		const output = await nativeCheck('ios:check:vectors');
		expect(output).toContain('All vectors reproduced.');
		expect(output).not.toContain('FAIL');
	},
	120000
);

test.skipIf(process.platform !== 'darwin')(
	'native Debug and Release verify authority, redirects, caching and replay',
	async () => {
		let responsive = false;
		const timer = setTimeout(() => {
			responsive = true;
		}, 0);
		try {
			const output = await nativeCheck('ios:check:native');
			expect(responsive, 'Native checks must let the test worker process events').toBe(true);
			expect(output).toMatch(/Debug: \d+ passed, 0 failed\./);
			expect(output).toMatch(/Release: \d+ passed, 0 failed\./);
			expect(output).not.toContain('FAIL');
		} finally {
			clearTimeout(timer);
		}
	},
	120000
);

test('Swift source remains within the declared native shape limits', async () => {
	const output = await nativeCheck('ios:check:limits');
	expect(output).toMatch(/\d+ Swift files checked; 0 findings\./);
}, 20000);
