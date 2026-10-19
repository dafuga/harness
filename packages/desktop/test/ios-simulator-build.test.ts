import { test } from 'vitest';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { expect } from '../../../test/verificationExpect';

/** Xcode integration runs in the native scenario after its clean renderer was copied by setup. */
const unavailable =
	process.platform !== 'darwin' || process.env.HARNESS_SCENARIO !== 'remote-mobile-native';

async function simulatorBuild(args: string[]) {
	const result = await new Promise<{ error: Error | null; status: number | null; output: string }>(
		(done) => {
			execFile(
				'bun',
				['scripts/build-ios-simulator.ts', ...args],
				{
					cwd: resolve(import.meta.dirname, '..'),
					encoding: 'utf8',
					timeout: 240000,
					maxBuffer: 4_000_000
				},
				(error, stdout, stderr) =>
					done({
						error: error && typeof error.code !== 'number' ? error : null,
						status: exitStatus(error),
						output: `${stdout ?? ''}${stderr ?? ''}`
					})
			);
		}
	);
	console.info(result.output);
	expect(result.error).toBeNull();
	return result;
}

test.skipIf(unavailable)(
	'normal Debug simulator product has usable signing without fixture exceptions',
	async () => {
		const result = await simulatorBuild([]);
		expect(result.status).toBe(0);
		expect(result.output).toContain(
			'Debug simulator build; signature ad hoc, no team, no account.'
		);
		expect(result.output).not.toContain('TEST ONLY');
	},
	240000
);

test.skipIf(unavailable)(
	'normal Release simulator product has usable signing without fixture exceptions',
	async () => {
		const result = await simulatorBuild(['--release']);
		expect(result.status).toBe(0);
		expect(result.output).toContain(
			'Release simulator build; signature ad hoc, no team, no account.'
		);
		expect(result.output).not.toContain('TEST ONLY');
	},
	240000
);

test.skipIf(unavailable)(
	'Release refuses fixture exceptions before a build can start',
	async () => {
		const result = await simulatorBuild(['--fixture', '--release']);
		expect(result.status).toBe(2);
		expect(result.output).toContain('--fixture cannot be combined with --release');
		expect(result.output).not.toContain('simulator build;');
	},
	20000
);

function exitStatus(error: (Error & { code?: string | number | null }) | null): number | null {
	if (!error) return 0;
	return typeof error.code === 'number' ? error.code : null;
}
