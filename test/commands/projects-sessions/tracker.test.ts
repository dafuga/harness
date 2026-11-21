import { afterEach, expect, test, vi } from 'vitest';
import { TrackerCommand } from '../../../src/commands/projects-sessions/TrackerCommand';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

test('Tracker reports a missing retained client', () => {
	vi.stubEnv('HARNESS_TRACKER_FORWARD_PARENT', '');
	vi.stubEnv('HARNESS_TRACKER_LEGACY_BIN', '/dev/null/tracker');
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	expect(new TrackerCommand().run(['status'])).toBe(126);
	expect(error).toHaveBeenCalledWith(expect.stringContaining('could not start the legacy client'));
});

test('Tracker rejects a shim that points back at Harness', () => {
	vi.stubEnv('HARNESS_TRACKER_FORWARD_PARENT', String(process.ppid));
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	expect(new TrackerCommand().run(['status'])).toBe(126);
	expect(error).toHaveBeenCalledWith('tracker: the shim needs a retained legacy client.');
});
