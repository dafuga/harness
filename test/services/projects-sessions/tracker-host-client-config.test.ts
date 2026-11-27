import { realpathSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { trackerWorkerClient } from '../../../src/adapters/projects-sessions/tracker-tmux-adapter/trackerWorkerClient';
import { TrackerHealthCommand } from '../../../src/commands/projects-sessions/TrackerHealthCommand';
import { TrackerServiceCommand } from '../../../src/commands/projects-sessions/TrackerServiceCommand';
import { withTempDir } from '../../support/temporary';

// A launched session's HARNESS_TRACKER_CONFIG is a stub that disappears with the session.
test("health and service setup refuse a launched session's client config", () =>
	withTempDir('htc-', async (directory) => {
		const config = trackerWorkerClient(realpathSync(directory), {
			node: 'fixture-hub',
			role: 'hub',
			apiPort: 17701,
			syncPort: 17702
		});
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
		const output = vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.stubEnv('HARNESS_TRACKER_CONFIG', config);
		try {
			expect(await new TrackerHealthCommand().run([])).toBe(2);
			expect(new TrackerServiceCommand().run(['print', '--executable', '/opt/harness'])).toBe(2);
			expect(errors.mock.calls.map(([line]) => String(line))).toEqual([
				expect.stringContaining("launched session's client config"),
				expect.stringContaining("launched session's client config")
			]);
			expect(output).not.toHaveBeenCalled();
		} finally {
			vi.unstubAllEnvs();
			errors.mockRestore();
			output.mockRestore();
		}
	}));
