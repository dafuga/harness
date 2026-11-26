import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { TrackerTmuxAdapter } from '../../../src/adapters/projects-sessions/TrackerTmuxAdapter';
import { claudePasteTmuxFixture } from '../../support/claudePasteTmuxFixture';
import { withTempDir } from '../../support/temporary';

const message = `Tracker alerts. ${'[abc123] fixture-mac: a long alert line | '.repeat(40)}`;

/** Claude Code reads text and Enter sent together as one paste, so that Enter never submits. */
async function nudge(root: string, behaviour: { ignoredEnters?: number; reply?: 'done' }) {
	const executable = join(root, 'tmux-fixture');
	writeFileSync(executable, `#!${process.execPath}\n${claudePasteTmuxFixture}`, { mode: 0o700 });
	writeFileSync(join(root, 'state.json'), JSON.stringify({ draft: '', sent: [], ...behaviour }));
	const tmux = new TrackerTmuxAdapter({ executable, node: 'daniel-primary-mbp' });
	const signal = new AbortController().signal;
	const [pane] = await tmux.scan(signal, /^cos$/);
	const sent = await tmux.nudge({ pane, cli: 'claude', message }, signal);
	const state = existsSync(join(root, 'state.json'))
		? JSON.parse(readFileSync(join(root, 'state.json'), 'utf8'))
		: {};
	return { sent, submitted: state.sent as string[] };
}

test('a long alert is submitted to Claude by its own Enter and receipted', () =>
	withTempDir('hnt-claude-paste-', async (root) => {
		expect(await nudge(root, {})).toEqual({ sent: true, submitted: [message] });
	}));

test('Enter is pressed again while the typed alert is still unsent', () =>
	withTempDir('hnt-claude-retry-', async (root) => {
		expect(await nudge(root, { ignoredEnters: 1 })).toEqual({ sent: true, submitted: [message] });
	}));

test('an emptied composer is a receipt when the reply has already finished', () =>
	withTempDir('hnt-claude-fast-', async (root) => {
		expect(await nudge(root, { reply: 'done' })).toEqual({ sent: true, submitted: [message] });
	}));

test(
	'a draft that Claude never submits is not receipted',
	() =>
		withTempDir('hnt-claude-stuck-', async (root) => {
			expect(await nudge(root, { ignoredEnters: 99 })).toEqual({ sent: false, submitted: [] });
		}),
	20_000
);
