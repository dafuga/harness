import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { TrackerTmuxAdapter } from '../../../src/adapters/projects-sessions/TrackerTmuxAdapter';
import { claudePaneFixture } from '../../support/claudePaneFixture';
import { withTempDir } from '../../support/temporary';

const long = `Tracker alerts. ${'filler item ready | '.repeat(45)}end.`;
const short = 'Tracker item [abc123] has been waiting for 5 minutes.';

async function nudge(mode: string, message: string) {
	let outcome = { sent: false, submitted: false, draft: '', enters: 0, combined: false };
	await withTempDir('hnt-claude-pane-', async (root) => {
		const executable = join(root, 'tmux-fixture');
		writeFileSync(executable, `#!${process.execPath}\n${claudePaneFixture}`, { mode: 0o700 });
		writeFileSync(join(root, 'mode'), mode);
		const tmux = new TrackerTmuxAdapter({ executable, node: 'daniel-primary-mbp' });
		const signal = AbortSignal.timeout(18_000);
		const [pane] = await tmux.scan(signal, /^cos$/);
		const sent = await tmux.nudge({ pane, cli: 'claude', message }, signal);
		const commands: { text: string | null; enter: boolean }[] = readFileSync(
			join(root, 'commands'),
			'utf8'
		)
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
		const { submitted, draft, enters } = JSON.parse(readFileSync(join(root, 'state'), 'utf8'));
		const combined = commands.some((command) => command.text !== null && command.enter);
		outcome = { sent, submitted, draft, enters, combined };
	});
	return outcome;
}

const delivered = { sent: true, submitted: true, draft: '', combined: false };

test('a long message to an idle Claude pane is typed, then submitted by a separate Enter', async () => {
	expect(await nudge('idle', long)).toEqual({ ...delivered, enters: 1 });
});

test('a message Claude splits into several pastes is still submitted', async () => {
	const longest = `Tracker digest. ${'filler item ready | '.repeat(230)}Reference end.`;
	expect(await nudge('idle', longest)).toEqual({ ...delivered, enters: 1 });
});

test('a short message is submitted even when the working footer never appears', async () => {
	expect(await nudge('idle', short)).toEqual({ ...delivered, enters: 1 });
});

test('Enter is sent again when the draft is still in the box after five seconds', async () => {
	const started = Date.now();
	expect(await nudge('drops-first-enter', long)).toEqual({ ...delivered, enters: 2 });
	expect(Date.now() - started).toBeGreaterThanOrEqual(5000);
}, 20_000);

test('a draft that never leaves the box is reported as not sent', async () => {
	expect(await nudge('deaf', long)).toMatchObject({ sent: false, submitted: false, enters: 2 });
}, 20_000);

test('text this send did not type is never submitted', async () => {
	expect(await nudge('foreign', short)).toMatchObject({ sent: false, enters: 0, combined: false });
}, 20_000);
