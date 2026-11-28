import { DatabaseSync } from 'node:sqlite';
import { expect, onTestFinished, test } from 'vitest';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { TrackerDispatchRepository } from '../../../src/repositories/projects-sessions/TrackerDispatchRepository';
import { trackerAreaAuthority } from '../../../src/services/projects-sessions/tracker-hub-sync/trackerAreaClaim';
import { areaCheckout, areaLauncher, withOpenPulls } from '../../support/trackerAreaFixture';
import { withTempDir } from '../../support/temporary';

function hub(...ids: string[]) {
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => database.close());
	const store = new TrackerPersistenceService(database, 'hub');
	new TrackerDispatchRepository(store);
	for (const id of ids)
		store.appendLocal({ itemId: id, fields: { title: id, status: 'open', auto: id } });
	const authority = trackerAreaAuthority(store);
	const claim = (id: string, areas: string[], extra: object = {}) =>
		authority({ id, token: id, repo: 'fixture/project', areas, ...extra }, 'alpha');
	const claimed = () =>
		database.prepare('SELECT id, areas FROM tracker_area_claims ORDER BY id').all();
	return { store, claim, claimed };
}

test('an item the hub does not show as the current launch warns and records nothing', () => {
	const { claim, claimed } = hub('first00001');
	expect(claim('first00001', ['src/launcher'])).toMatchObject({ allowed: true, recorded: true });
	const unseen = claim('unseen0002', ['docs']);
	expect(unseen).toMatchObject({ allowed: true, recorded: false });
	expect(unseen.warnings.join(' ')).toContain('current launch');
	expect(claim('unseen0002', ['src/launcher/start.ts'])).toMatchObject({ allowed: false });
	expect(claimed()).toHaveLength(1);
});

test('another session of one item holds only on its declared areas', () => {
	const { claim, claimed } = hub('first00001');
	claim('first00001', ['src/launcher']);
	const manual = { token: 'manual:other' };
	expect(claim('first00001', ['src/launcher/start.ts'], manual)).toMatchObject({ allowed: false });
	const disjoint = claim('first00001', ['docs'], manual);
	expect(disjoint).toMatchObject({ allowed: true, recorded: false });
	expect(disjoint.warnings.join(' ')).toContain('earlier session');
	expect(claimed()).toEqual([{ id: 'first00001', areas: '["src/launcher"]' }]);
});

test('only declared areas are stored and an undeclared claim records nothing', () => {
	const { claim, claimed, store } = hub('guess00001', 'other00002');
	const guess = claim('guess00001', [], { inferred: ['src/launcher'] });
	expect(guess).toMatchObject({ allowed: true, recorded: false });
	expect(claimed()).toEqual([]);
	expect(store.database.prepare('SELECT count(*) AS n FROM item_notes').get()).toEqual({ n: 0 });
	expect(claim('other00002', ['src/launcher'], { inferred: ['docs'] })).toMatchObject({
		allowed: true,
		recorded: true
	});
	expect(claimed()).toEqual([{ id: 'other00002', areas: '["src/launcher"]' }]);
});

test('a live run with no claim is a warning, not a hold', () => {
	const { claim, store } = hub('first00001', 'older00002');
	store.appendLocal({
		itemId: 'older00002',
		fields: { project: 'Harness', status: 'in_progress' }
	});
	store.database
		.prepare(
			`INSERT INTO remote_runs (node, id, item_id, state, project) VALUES ('beta', 1, 'older00002', 'running', 'Harness')`
		)
		.run();
	const decision = claim('first00001', ['src/launcher'], { project: 'Harness' });
	expect(decision).toMatchObject({ allowed: true, recorded: true });
	expect(decision.warnings.join(' ')).toContain('declared no areas: older00002');
});

test(
	'tracker claim reports open pull requests without refusing the paths',
	() =>
		withTempDir('hnt-area-claim-', async (root) => {
			const host = areaLauncher(withOpenPulls(root, areaCheckout(root)));
			host.queue('manual0001', '');
			const reply = await host.runtime.coordination.claim({
				id: 'manual0001',
				areas: ['new/file.ts'],
				session: 'b'.repeat(64)
			});
			expect(reply.allowed).toBe(true);
			expect(reply.reason).toContain('Area claim on fixture/project by manual0001');
			expect(reply.reason).toContain('fixture/project#41');
		}),
	30_000
);
