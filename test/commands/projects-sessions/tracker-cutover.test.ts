import { afterEach, expect, test, vi } from 'vitest';
import { TrackerCutoverCommand } from '../../../src/commands/projects-sessions/TrackerCutoverCommand';

afterEach(() => {
	vi.restoreAllMocks();
});

test('run requires two copies and a spoke name', () => {
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	expect(new TrackerCutoverCommand().run(['before.sqlite', 'after.sqlite'])).toBe(2);
	expect(error).toHaveBeenCalledWith(expect.stringContaining('--node <node>'));
});

test('run rejects unreadable snapshots without printing their paths', () => {
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	const code = new TrackerCutoverCommand().run([
		'/dev/null/private-copy.sqlite',
		'/dev/null/other-copy.sqlite',
		'--node',
		'fixture'
	]);
	expect(code).toBe(2);
	expect(error).toHaveBeenCalledWith('tracker: Unable to read SQLite snapshot');
});
