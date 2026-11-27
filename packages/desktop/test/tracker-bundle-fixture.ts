// @harness-uid u_tbc4p7rxbe
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FakeLaunchd } from './tracker-bundle-fixture.types';
import type { TrackerBundleRun } from '../src/services/development-tooling/tracker-bundle/TrackerBundleService.types';

/** A host that runs the real `plutil` on temporary files and pretends to be launchd. */
export function fakeLaunchd(): FakeLaunchd {
	let elapsed = 0;
	let labelRemovedAt = Infinity;
	let processExitsAt: number | undefined;
	let pid = 730;
	function launchctl(command: string): TrackerBundleRun {
		state.calls.push(command);
		if (command === 'print') {
			const stdout = state.loaded ? `\tpid = ${pid}\n` : '';
			return { status: state.loaded ? 0 : 113, stdout };
		}
		if (command === 'bootout' && state.loaded) {
			labelRemovedAt = elapsed + Math.min(250, state.stopDelayMs);
			processExitsAt = elapsed + state.stopDelayMs;
		}
		if (command === 'bootstrap') {
			if (state.loaded || elapsed < (processExitsAt ?? 0)) return { status: 5, stdout: '' };
			state.loaded = true;
			labelRemovedAt = Infinity;
			processExitsAt = undefined;
			pid++;
		}
		return { status: 0, stdout: '' };
	}
	const state: FakeLaunchd = {
		calls: [],
		loaded: false,
		stopDelayMs: 0,
		ready: () => true,
		host: {
			uid: 501,
			isProcessRunning: (id: number) =>
				id === pid && (state.loaded || elapsed < (processExitsAt ?? 0)),
			sleep: async (milliseconds) => {
				elapsed += milliseconds;
			},
			run: async (file, args): Promise<TrackerBundleRun> => {
				if (elapsed >= labelRemovedAt) state.loaded = false;
				if (file === '/bin/launchctl') return launchctl(args[0]);
				if (file === '/usr/bin/plutil') {
					const result = spawnSync(file, args, { encoding: 'utf8' });
					return { status: result.status ?? 1, stdout: result.stdout };
				}
				state.calls.push('ensure');
				return { status: state.ready(file) ? 0 : 3, stdout: '' };
			}
		}
	};
	return state;
}

/** A temporary home plus a fake Harness.app whose executable body is `executableText`. */
export function trackerFixture(executableText = '#!/bin/sh\necho 0.1.0\n') {
	const root = mkdtempSync(join(tmpdir(), 'harness-tracker-bundle-'));
	const home = join(root, 'home');
	const app = join(root, 'Harness.app');
	mkdirSync(join(app, 'Contents/Helpers'), { recursive: true });
	mkdirSync(join(app, 'Contents/Resources'), { recursive: true });
	mkdirSync(home, { recursive: true });
	writeFileSync(join(app, 'Contents/Helpers/harness'), executableText, { mode: 0o755 });
	writeFileSync(
		join(app, 'Contents/Resources/tracker-shim.sh'),
		'#!/bin/sh\nexec harness tracker "$@"\n',
		{
			mode: 0o755
		}
	);
	return { root, home, app };
}

/** A hub-role LaunchAgent in the shape the live Tracker uses, running an older executable. */
export function existingAgent(home: string, executable: string): string {
	const agent = join(home, 'Library/LaunchAgents/local.harness.tracker.plist');
	mkdirSync(join(home, 'Library/LaunchAgents'), { recursive: true });
	const config = join(home, '.config/harness/tracker.json');
	const text = (value: string) => `<string>${value}</string>`;
	writeFileSync(
		agent,
		`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>EnvironmentVariables</key><dict><key>HARNESS_TRACKER_CONFIG</key>${text(config)}</dict>
<key>KeepAlive</key><true/>
<key>Label</key>${text('local.harness.tracker')}
<key>ProgramArguments</key><array>${[executable, 'tracker', 'serve', '--config', config, '--role', 'hub'].map(text).join('')}</array>
<key>RunAtLoad</key><true/>
<key>ThrottleInterval</key><integer>10</integer>
</dict></plist>
`
	);
	return agent;
}

export function writeTrackerConfig(home: string, role: 'hub' | 'spoke'): string {
	const config = join(home, '.config/harness/tracker.json');
	mkdirSync(join(home, '.config/harness'), { recursive: true });
	writeFileSync(config, JSON.stringify({ version: 1, node: 'fixture', role }), { mode: 0o600 });
	return config;
}
