import { afterEach, expect, test, vi } from 'vitest';
import { TrackerCommand } from '../../../src/commands/projects-sessions/TrackerCommand';
import { formatNativeTrackerRunRead } from '../../../src/commands/projects-sessions/tracker-command/formatNativeTrackerItem';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';

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

test('native Tracker forwards existing run, report and model selection commands', () => {
	expect(nativeTrackerArgs(['runs', '--item', 'abc123', '--limit', '4', '--json']).request).toEqual(
		{
			method: 'GET',
			path: '/runs?item=abc123&limit=4'
		}
	);
	expect(nativeTrackerArgs(['models', 'report']).request).toEqual({
		method: 'GET',
		path: '/models/report'
	});
	expect(nativeTrackerArgs(['pick', 'abc123']).request).toEqual({
		method: 'GET',
		path: '/items/abc123/pick'
	});
	expect(() => nativeTrackerArgs(['models', 'delete'])).toThrow('usage: tracker models report');
	expect(formatNativeTrackerRunRead('runs', [])).toBe('(no runs)');
	expect(formatNativeTrackerRunRead('models', { ladder: ['sol'], rows: [] })).toBe(
		'(no finished runs yet)'
	);
	expect(
		formatNativeTrackerRunRead('pick', {
			rung: 'sol',
			model: 'gpt-6.2-sol',
			effort: 'medium',
			cli: 'codex',
			pinned: true,
			reason: 'named on the item',
			computer: 'fixture-mac'
		})
	).toBe(
		'sol (gpt-6.2-sol medium, codex) - named on the item\n  named on the item\n  computer: fixture-mac'
	);
});
