import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect } from 'vitest';
import { trackerFixtureEnv } from './trackerNodeProcess';
import type { TrackerNodeFixture } from './trackerNodeProcess.types';

export function verifyCosDryRun(fixture: TrackerNodeFixture, id: string): void {
	const script = process.env.HARNESS_TRACKER_TEST_COS_SCRIPT;
	if (!script) return;
	const env = trackerFixtureEnv(fixture);
	const local = join(env.HOME, '.local');
	const state = join(local, 'state');
	const bin = join(local, 'bin');
	mkdirSync(state, { recursive: true });
	mkdirSync(bin);
	const seen = join(state, 'cos-tracker-alert.seen.json');
	writeFileSync(seen, '[]', { mode: 0o600 });
	symlinkSync(resolve('scripts/tracker-shim.sh'), join(bin, 'tracker'));
	const result = spawnSync('/usr/bin/python3', [script, '--dry-run'], {
		encoding: 'utf8',
		env,
		timeout: 8_000
	});
	expect(result.status).toBe(0);
	expect(result.stdout).toContain('1 flagged, 1 new:');
	expect(result.stdout).toContain(`[${id.slice(0, 6)}]`);
	expect(result.stdout).toContain('Is the fixture ready?');
	expect(readFileSync(seen, 'utf8')).toBe('[]');
}
