import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { TrackerTmuxAdapter } from '../../../src/adapters/projects-sessions/TrackerTmuxAdapter';
import { trackerHandSession } from '../../../src/utils/projects-sessions/trackerSessionNames';
import { withTempDir } from '../../support/temporary';

const item = {
	id: 'abc123def4',
	title: 'Fix the café export — again',
	owner: null,
	project: 'harness',
	agent: null
};

test('a hand window is still recognised when tmux is run under the C locale', () =>
	withTempDir('hnt-tmux-windows-', async (root) => {
		const executable = join(root, 'tmux-fixture');
		writeFileSync(executable, `#!${process.execPath}\n${localeTmux}`, { mode: 0o700 });
		const tmux = new TrackerTmuxAdapter({ executable, node: 'daniel-primary-mbp' });

		const windows = await tmux.windows(new AbortController().signal);

		expect(windows).toEqual([{ session: 'work', window: 'Harness: Fix the café export — again' }]);
		expect(trackerHandSession(windows, item)).toBe(true);
	}));

// As tmux 3.8 does for a client that is not UTF-8: tabs and non-ASCII print as "_" without -u.
const localeTmux = `
const args = process.argv.slice(2);
if (!args.includes('list-windows')) process.exit(2);
const format = args[args.indexOf('-F') + 1];
const line = format
	.replace('#{session_name}', 'work')
	.replace('#{window_name}', 'Harness: Fix the café export — again');
const utf8 = args.includes('-u') || /utf-?8/i.test(process.env.LC_ALL || process.env.LANG || '');
process.stdout.write((utf8 ? line : line.replace(/[^\\x20-\\x7e]/gu, '_')) + '\\n');
`;
