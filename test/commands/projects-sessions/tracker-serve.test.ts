import { expect, test, vi } from 'vitest';
import { TrackerCommand } from '../../../src/commands/projects-sessions/TrackerCommand';

test('native serve requires an explicit role selector and never invokes the retained client', async () => {
	vi.stubEnv('HARNESS_TRACKER_LEGACY_BIN', '/dev/null/tracker');
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	try {
		expect(await new TrackerCommand().run(['serve', '--config', '/dev/null/config'])).toBe(2);
		expect(error).toHaveBeenCalledWith(expect.stringContaining('--role hub|spoke'));
	} finally {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	}
});

test('configured native ensure fails closed when its configured service is unavailable', async () => {
	vi.stubEnv('HARNESS_TRACKER_CONFIG', '/dev/null/tracker-config');
	vi.stubEnv('HARNESS_TRACKER_LEGACY_BIN', '/dev/null/tracker');
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	try {
		expect(await new TrackerCommand().run(['ensure'])).toBe(2);
		expect(error).toHaveBeenCalledWith('tracker: invalid or unreadable native configuration');
	} finally {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	}
});
