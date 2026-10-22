import { test } from 'vitest';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { expect } from '../../../test/verificationExpect';
import { measureProcess } from '../../../test/support/cli-measurement/measureHarness';
import { runCommand } from '../../../test/support/cli';
import { nativeAcceptance } from './native-acceptance-fixture';
import nativeScenario from '../../../specification/scenarios/remote-mobile-native.json' with { type: 'json' };

/** Real Swift checks on macOS. Other platforms have an explicit native coverage gap. */
async function nativeCheck(script: string) {
	const name = script.replace('ios:check:', 'check-ios-');
	const result = await measureProcess(
		{
			units: [`desktop.script.${name}`],
			workload: `native-check-command-${name}`,
			target: 'module',
			command: ['bun', 'run', script],
			cwd: resolve(import.meta.dirname, '..'),
			partial:
				'Whole real native-check command, including compilation and subprocess work. Driver timing and OS RSS are separate from compiled Swift adapter behavior; no simulator, camera or physical-device performance.'
		},
		async (command, cwd) => {
			let responsive = false;
			const turn = setImmediate(() => {
				responsive = true;
			});
			const child = await nativeCommand(command, cwd);
			clearImmediate(turn);
			expect(responsive, 'native command must leave the test RPC event loop responsive').toBe(true);
			expect(child.error ?? null).toBeNull();
			return {
				exitCode: child.status ?? 1,
				stdout: child.stdout ?? '',
				stderr: child.stderr ?? ''
			};
		}
	);
	const output = `${result.stdout}${result.stderr}`;
	console.info(output);
	expect(result.exitCode).toBe(0);
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
		const output = await nativeCheck('ios:check:native');
		expect(output).toMatch(/Debug: \d+ passed, 0 failed\./);
		expect(output).toMatch(/Release: \d+ passed, 0 failed\./);
		expect(output).not.toContain('FAIL');
		for (const flavor of ['debug', 'release']) await profileNativeChecks(flavor);
	},
	120000
);

async function profileNativeChecks(flavor: string) {
	const root = resolve(import.meta.dirname, '..');
	const result = await measureProcess(
		{
			units: ['desktop.adapter.ios-remote', 'desktop.adapter.ios-account'],
			workload: `swift-native-${flavor}-authority-cache-account`,
			target: 'module',
			command: [resolve(root, `.cache/ios/native-checks-${flavor}`)],
			cwd: root,
			partial:
				'Real Swift checks compiled for macOS, with test vaults and transports. Excludes compilation, UIKit/Capacitor plugins, camera, simulator and physical-device performance; timing and RSS cover the shared check binary, not isolated adapters.'
		},
		runCommand
	);
	expect(result.exitCode, result.stderr).toBe(0);
	expect(result.stdout).toMatch(/\d+ passed, 0 failed\./);
	expect(result.stdout).not.toContain('FAIL');
}

test('Swift source remains within the declared native shape limits', async () => {
	const output = await nativeCheck('ios:check:limits');
	expect(output).toMatch(/\d+ Swift files checked; 0 findings\./);
}, 20000);

test.skipIf(process.platform !== 'darwin')(
	'actual simulator verifies pairing, cached views, reconnect and revocation',
	async () => {
		const result = await nativeAcceptance();
		expect(result.report.failed).toBe(0);
		expect(result.report.passed).toBeGreaterThanOrEqual(78);
		expect(result.report.source.revision).toBe(result.commit);
		expect(result.report.source.renderer.files).toBeGreaterThan(0);
		expect(result.report.source.native.files).toBeGreaterThan(0);
		expect(result.report.source.fixtureComputer.files).toBeGreaterThan(0);
		for (const unit of nativeScenario.units.filter((unit) =>
			unit.startsWith('desktop.script.ios-acceptance-')
		))
			expect(
				result.profileUnits,
				`Actual native helper requires timing and memory: ${unit}`
			).toContain(unit);
		expect(result.report.checks.every((check: { passed: boolean }) => check.passed)).toBe(true);
		expect(result.drift).toEqual({ mutated: [], added: [] });
	},
	1200000
);

function nativeCommand(command: string[], cwd: string) {
	return new Promise<{ error: Error | null; status: number; stdout: string; stderr: string }>(
		(done) => {
			execFile(
				command[0],
				command.slice(1),
				{
					cwd,
					encoding: 'utf8',
					timeout: 120000,
					maxBuffer: 2_000_000
				},
				(error, stdout, stderr) => {
					let status = 0;
					if (error) status = typeof error.code === 'number' ? error.code : 1;
					done({ error, status, stdout, stderr });
				}
			);
		}
	);
}
