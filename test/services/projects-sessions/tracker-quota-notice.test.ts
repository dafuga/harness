import { DatabaseSync } from 'node:sqlite';
import { expect, test, vi } from 'vitest';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { trackerRunSchema } from '../../../src/repositories/projects-sessions/tracker-dispatch-repository/trackerRunSchema';
import { trackerQuotaNotice } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerProviderHolds';
import { recoverTrackerSession } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerSessionRecovery';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';

test('recognizes CLI exhaustion notices and ignores warnings and quoted text', () => {
	for (const [cli, line] of [
		['codex', '\u001b[31m■ You’ve hit your usage limit. Try again at 10:30 AM.'],
		['codex', '■ Workspace owner credits are depleted'],
		['claude', "  ⎿  You've hit your 5-hour limit · resets 10:40am"],
		['claude', '  ⎿  Credit balance is too low']
	] as const)
		expect(trackerQuotaNotice(`before\n${line}\nafter`, cli)).not.toBeNull();
	for (const [cli, screen] of [
		['codex', 'const message = "You\'ve hit your usage limit";'],
		['codex', "■ You've hit your usage limit.\n  Continuing with credits automatically."],
		['claude', "⏺ You've hit your usage limit is the text the CLI prints."],
		['claude', 'Warning: less than 5% of your weekly limit remains. Using credits.']
	] as const)
		expect(trackerQuotaNotice(screen, cli)).toBeNull();
});

test('autolaunch pause, resume and clear-quota are native commands', () => {
	expect(nativeTrackerArgs(['autolaunch', 'pause']).request).toEqual({
		method: 'POST',
		path: '/autolaunch/pause'
	});
	expect(nativeTrackerArgs(['autolaunch', 'resume']).request).toMatchObject({ method: 'POST' });
	expect(nativeTrackerArgs(['autolaunch', 'clear-quota', 'codex']).request).toEqual({
		method: 'POST',
		path: '/autolaunch/clear-quota',
		body: { provider: 'codex' }
	});
	expect(() => nativeTrackerArgs(['autolaunch', 'clear-quota'])).toThrow('<codex|claude>');
	expect(() => nativeTrackerArgs(['autolaunch', 'pause', 'now'])).toThrow('usage');
});

test('a quota hold does not use up watchdog relaunch attempts', async () => {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, 'daniel-primary-mbp', {});
	database.exec(trackerRunSchema);
	try {
		store.appendLocal({
			itemId: 'held000001',
			fields: { title: 'Held work', kind: 'task', status: 'in_progress' }
		});
		database
			.prepare(
				`INSERT INTO runs (id, item_id, cli, model, rung, state, attempt, queued_at, auto_token)
				VALUES (1, 'held000001', 'claude', 'm', 'r', 'finished', 1, 1, 't')`
			)
			.run();
		store.writeMeta({ autolaunch_quota_claude: '2026-11-25T12:00:00Z' });
		const item = new TrackerItemReadRepository(database).getStored('held000001');
		const launch = vi.fn().mockResolvedValue({
			status: 'held',
			reason: 'claude quota exhausted on daniel-primary-mbp'
		});
		for (const now of [1_000_000, 90_000_000])
			await expect(recoverTrackerSession(store, { item, launch, now })).resolves.toBe(
				'Tracker relaunch is waiting: claude quota exhausted on daniel-primary-mbp.'
			);
		store.appendLocal({ itemId: item.id, fields: { model: 'sol:medium' } });
		const current = new TrackerItemReadRepository(database).getStored(item.id);
		launch.mockResolvedValueOnce({ status: 'requested' });
		await expect(
			recoverTrackerSession(store, { item: current, launch, now: 91_000_000 })
		).resolves.toContain('requested relaunch 1/3');
	} finally {
		database.close();
	}
});
