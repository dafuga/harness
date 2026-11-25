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
