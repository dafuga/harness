import { test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect } from '../../../test/verificationExpect';

/** Real Swift checks on macOS. Other platforms have an explicit native coverage gap. */
function nativeCheck(script: string) {
	const result = spawnSync('bun', ['run', script], {
		cwd: resolve(import.meta.dirname, '..'),
		encoding: 'utf8',
		timeout: 120000,
		maxBuffer: 2_000_000
	});
	const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
	console.info(output);
	expect(result.error ?? null).toBeNull();
	expect(result.status).toBe(0);
	return output;
}

test.skipIf(process.platform !== 'darwin')(
	'Swift reproduces the backend encrypted protocol vectors',
	() => {
		const output = nativeCheck('ios:check:vectors');
		expect(output).toContain('All vectors reproduced.');
		expect(output).not.toContain('FAIL');
	},
	120000
);

test.skipIf(process.platform !== 'darwin')(
	'native Debug and Release verify authority, redirects, caching and replay',
	() => {
		const output = nativeCheck('ios:check:native');
		expect(output).toMatch(/Debug: \d+ passed, 0 failed\./);
		expect(output).toMatch(/Release: \d+ passed, 0 failed\./);
		expect(output).not.toContain('FAIL');
	},
	120000
);

test('Swift source remains within the declared native shape limits', () => {
	const output = nativeCheck('ios:check:limits');
	expect(output).toMatch(/\d+ Swift files checked; 0 findings\./);
}, 20000);
