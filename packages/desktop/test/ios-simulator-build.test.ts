import { test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect } from '../../../test/verificationExpect';

/** Xcode integration runs in the native scenario after its clean renderer was copied by setup. */
const unavailable =
	process.platform !== 'darwin' || process.env.HARNESS_SCENARIO !== 'remote-mobile-native';

function simulatorBuild(args: string[]) {
	const result = spawnSync('bun', ['scripts/build-ios-simulator.ts', ...args], {
		cwd: resolve(import.meta.dirname, '..'),
		encoding: 'utf8',
		timeout: 240000,
		maxBuffer: 4_000_000
	});
	const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
	console.info(output);
	expect(result.error ?? null).toBeNull();
	return { status: result.status, output };
}

test.skipIf(unavailable)(
	'normal Debug simulator product has usable signing without fixture exceptions',
	() => {
		const result = simulatorBuild([]);
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
	() => {
		const result = simulatorBuild(['--release']);
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
	() => {
		const result = simulatorBuild(['--fixture', '--release']);
		expect(result.status).toBe(2);
		expect(result.output).toContain('--fixture cannot be combined with --release');
		expect(result.output).not.toContain('simulator build;');
	},
	20000
);
