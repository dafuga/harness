import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { TrackerHostProcessAdapter } from '../../../src/adapters/projects-sessions/TrackerHostProcessAdapter';
import { measureWorkload } from '../../support/measureWorkload';
import { withTempDir } from '../../support/temporary';

test('runs an explicit process operation with isolated input, rejects unsafe binaries and redacts failures', () =>
	measureWorkload('adapter.projects-sessions-tracker-host-process', 'process-isolation', () =>
		withTempDir('hnt-process-', proveProcessIsolation)
	));

async function proveProcessIsolation(root: string) {
	const path = join(root, 'fixture');
	writeFileSync(path, `#!${process.execPath}\n${program}`, { mode: 0o700 });
	const driver = new TrackerHostProcessAdapter(path);
	const signal = new AbortController().signal;
	vi.stubEnv('FIXTURE_PROVIDER_SESSION_TOKEN', 'synthetic credential');
	try {
		expect(await driver.request('inspect', { node: 'fixture', version: 0 }, signal)).toEqual({
			node: 'fixture',
			version: 1,
			leaked: false
		});
		await expect(driver.request('start', {}, signal)).rejects.toThrow(
			/^Tracker host process failed during start$/
		);
		const aborted = new AbortController();
		aborted.abort(new Error('fixture cancellation'));
		expect(() => driver.request('inspect', {}, aborted.signal)).toThrow('fixture cancellation');
		chmodSync(path, 0o722);
		expect(() => new TrackerHostProcessAdapter(path)).toThrow('owner-controlled executable');
	} finally {
		vi.unstubAllEnvs();
	}
}

const program = `
const { readFileSync } = require('node:fs');
if (process.argv[2] !== 'inspect') {
  process.stderr.write('synthetic private diagnostic');
  process.exit(1);
}
process.stdout.write(JSON.stringify({
  ...JSON.parse(readFileSync(0, 'utf8')),
  leaked: Boolean(process.env.FIXTURE_PROVIDER_SESSION_TOKEN)
}));
`;
