import { afterEach, expect, test } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	stageTrackerBundle,
	trackerEntitlements,
	trackerHelper,
	trackerShim,
	trackerSigning
} from '../scripts/package-mac-tracker';
import { installBundledTracker } from '../src/services/development-tooling/tracker-bundle/installBundledTracker';
import { fakeLaunchd, writeTrackerConfig } from './tracker-bundle-fixture';

const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test.runIf(process.platform === 'darwin')(
	'the packaged app carries a Tracker that survives hardened-runtime signing and installs from the bundle',
	async () => {
		const root = mkdtempSync(join(tmpdir(), 'harness-package-tracker-'));
		roots.push(root);
		const app = join(root, 'Harness.app');
		await stageTrackerBundle(app);
		const helper = join(app, trackerHelper);
		const options = trackerSigning(app, helper, 'dev.harness.desktop');
		expect(options?.entitlements).toBe(trackerEntitlements);
		expect(
			trackerSigning(app, join(app, 'Contents/MacOS/Harness'), 'dev.harness.desktop')
		).toBeUndefined();
		expect(readFileSync(trackerEntitlements, 'utf8')).toContain('allow-jit');
		execFileSync('/usr/bin/codesign', [
			'--force',
			'--options',
			'runtime',
			'--entitlements',
			trackerEntitlements,
			'--identifier',
			'dev.harness.desktop',
			'--sign',
			'-',
			helper
		]);
		const version = execFileSync(helper, ['--version'], { encoding: 'utf8' });
		expect(version).toMatch(/^\d+\.\d+\.\d+/);

		const home = join(root, 'home');
		mkdirSync(home);
		writeTrackerConfig(home, 'spoke');
		writeFileSync(join(app, 'Contents/Resources/app-marker'), '');
		const launchd = fakeLaunchd();
		launchd.ready = (executable) => {
			const result = spawnSync(executable, ['--version'], { encoding: 'utf8' });
			return result.status === 0 && /^\d+\.\d+\.\d+/.test(result.stdout);
		};
		const outcome = await installBundledTracker({
			app,
			revision: 'b'.repeat(40),
			home,
			host: launchd.host
		});
		expect(outcome.status).toBe('installed');
		const staged = join(
			home,
			'.local/state/tracker/harness-releases',
			(outcome as { release: string }).release,
			'harness'
		);
		execFileSync('/usr/bin/codesign', ['--verify', '--strict', staged]);
		expect(app).toContain(root);
		expect(trackerShim).toBe('Contents/Resources/tracker-shim.sh');
	},
	120_000
);
