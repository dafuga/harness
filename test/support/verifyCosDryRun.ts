import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect } from 'vitest';
import { trackerFixtureEnv } from './trackerNodeProcess';
import type { TrackerNodeFixture } from './trackerNodeProcess.types';

export function verifyCosDryRun(fixture: TrackerNodeFixture, id: string, visible = true): void {
	const script = process.env.HARNESS_TRACKER_TEST_COS_SCRIPT;
	if (!script) return;
	const env = trackerFixtureEnv(fixture);
	const local = join(env.HOME, '.local');
	const state = join(local, 'state');
	const bin = join(local, 'bin');
	mkdirSync(state, { recursive: true });
	mkdirSync(bin, { recursive: true });
	const seen = join(state, 'cos-tracker-alert.seen.json');
	if (!existsSync(seen)) writeFileSync(seen, '[]', { mode: 0o600 });
	const shim = join(bin, 'tracker');
	if (!existsSync(shim)) symlinkSync(resolve('scripts/tracker-shim.sh'), shim);
	const result = spawnSync('/usr/bin/python3', [script, '--dry-run'], {
		encoding: 'utf8',
		env,
		timeout: 8_000
	});
	expect(result.status).toBe(0);
	const count = Number(visible);
	expect(result.stdout).toContain(`${count} flagged, ${count} new:`);
	const question = `[${id.slice(0, 6)}]`;
	if (visible) {
		expect(result.stdout).toContain(question);
		expect(result.stdout).toContain('Is the fixture ready?');
	} else {
		expect(result.stdout).not.toContain(question);
		expect(result.stdout).not.toContain('Is the fixture ready?');
	}
	expect(readFileSync(seen, 'utf8')).toBe('[]');
}
