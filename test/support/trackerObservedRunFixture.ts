import { unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { expect } from '../verificationExpect';

export async function verifyAdoption(
	runtime: TrackerNativeRuntimeService,
	db: DatabaseSync,
	root: string,
	advance: () => void
) {
	const manual = 'man123abcd';
	runtime.store.appendLocal({
		itemId: manual,
		fields: {
			title: 'Hand-launched task',
			kind: 'task',
			status: 'in_progress',
			model: 'gpt-6.1-terra:high',
			schedule_off: true
		}
	});
	const marker = join(root, 'hand-session');
	writeFileSync(marker, '');
	const signal = new AbortController().signal;
	const rows = () =>
		db.prepare('SELECT state,model,effort,tmux FROM runs WHERE item_id = ?').all(manual);
	for (let poll = 0; poll < 2; poll++) {
		advance();
		await runtime.watchdog!.tick(signal);
		expect(rows()).toEqual([
			{ state: 'observed', model: 'gpt-6.1-terra', effort: 'high', tmux: 'man123-recovery' }
		]);
	}
	unlinkSync(marker);
	advance();
	await runtime.watchdog!.tick(signal);
	expect(rows()).toEqual([
		{ state: 'finished', model: 'gpt-6.1-terra', effort: 'high', tmux: 'man123-recovery' }
	]);
	expect((await runtime.watchdog!.inspect(manual, signal)).recovery).toMatchObject([
		{
			item_id: manual,
			host: runtime.store.node,
			kind: 'missing',
			recover: false,
			reason: expect.stringContaining('automatic launch opted out')
		}
	]);
}

export const retainedTrackerTmuxFixture = (at: number) => `
const fs = require('node:fs');
const path = require('node:path');
const [,,, socket, command, ...args] = process.argv;
const closed = path.join(__dirname, 'closed');
const busy = path.join(__dirname, 'busy');
const attached = Number(fs.existsSync(path.join(__dirname, 'attached')));
const raw = 'auto-old008-r8|${at / 1000}|71|%9|200|${at / 1000}|2|2|0|0|0|' + attached + '|1|1|codex';
if (socket !== 'default') process.exit(2);
if (command === 'list-panes' || command === 'display-message') {
	if (!fs.existsSync(closed)) process.stdout.write(raw + '\\n');
} else if (command === 'capture-pane') {
	const idle = !fs.existsSync(busy) || fs.readFileSync(busy, 'utf8') === 'idle';
	process.stdout.write(idle ? 'fixture\\n\\n› \\n\\n100% context left\\n' : 'Working');
} else if (command === 'if-shell') {
	fs.writeFileSync(closed, args.join(' '));
	process.stdout.write('tracker-session-closed\\n');
} else process.exit(2);
`;

export async function verifyStaleIdleAlert(
	runtime: TrackerNativeRuntimeService,
	root: string,
	itemId: string,
	advance: () => void
) {
	runtime.store.appendLocal({ itemId, fields: { status: 'blocked' } });
	const idle = () => runtime.watchdog!.alerts().filter(({ kind }) => kind === 'idle');
	expect(idle()).toEqual([]);
	runtime.store.appendLocal({ itemId, fields: { status: 'in_progress' } });
	writeFileSync(join(root, 'hand-session'), '');
	advance();
	await runtime.watchdog!.tick(new AbortController().signal);
	expect(idle()).toEqual([]);
}
