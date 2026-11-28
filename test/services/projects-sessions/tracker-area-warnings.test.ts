import { DatabaseSync } from 'node:sqlite';
import { expect, onTestFinished, test } from 'vitest';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { trackerAreaDispatch } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerAreaDispatch';
import type { TrackerNativeRuntimeOptions } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService.types';
import type { TrackerReservedStart } from '../../../src/services/projects-sessions/TrackerDispatchSchedulerService.types';
import { areaCheckout, areaLauncher, withOpenPulls } from '../../support/trackerAreaFixture';
import { fixtureSecret } from '../../support/trackerDispatchQueueFixture';
import { secondary } from '../../support/trackerDispatcherFixture';
import { withTempDir } from '../../support/temporary';

const launchTest = (name: string, run: (root: string) => Promise<void>) =>
	test(name, () => withTempDir('hnt-area-warn-', run), 30_000);

launchTest(
	'a missing GitHub read binding warns in the brief and starts the launch',
	async (root) => {
		const host = areaLauncher(areaCheckout(root));
		host.queue('nobind0001', 'Areas: src/launcher');
		await host.tick();
		expect(host.started()).toEqual(['nobind0001']);
		expect(host.brief('nobind0001')).toContain('No GitHub read binding');
	}
);

launchTest('a declared same-area clash still holds without a GitHub binding', async (root) => {
	const host = areaLauncher(areaCheckout(root));
	host.queue('clash00001', 'Areas: src/launcher');
	host.queue('clash00002', 'Areas: SRC/launcher/start.ts');
	await host.tick(3);
	expect(host.started()).toEqual(['clash00001']);
	expect(host.runtime.store.getMeta('watchdog_alerts')).toContain('waiting for clash00001');
});

launchTest('items that name no area both start and are told what was not checked', async (root) => {
	const host = areaLauncher(areaCheckout(root, ['src/launcher/start.ts']));
	host.queue('quiet00001', 'Routine maintenance');
	host.queue('quiet00002', 'Routine maintenance');
	await host.tick(3);
	expect(host.started()).toEqual(['quiet00001', 'quiet00002']);
	expect(host.brief('quiet00001')).toContain('No areas are claimed for this start');
	expect(host.brief('quiet00002')).toContain('declared no areas: quiet00001');
});

launchTest('open pull requests warn in the brief instead of holding', async (root) => {
	const host = areaLauncher(withOpenPulls(root, areaCheckout(root)));
	host.queue('pulls00001', 'Areas: new/file.ts');
	host.queue('pulls00002', 'Routine maintenance');
	await host.tick(3);
	expect(host.started()).toEqual(['pulls00001', 'pulls00002']);
	expect(host.brief('pulls00001')).toContain('fixture/project#41 (owner, move)');
	expect(host.brief('pulls00001')).not.toContain('#42');
	expect(host.brief('pulls00002')).toContain('open pull requests were not compared');
	expect(host.brief('pulls00002')).not.toContain('#41');
});

launchTest('over 512 mentioned tracked paths warn and start', async (root) => {
	const files = Array.from({ length: 600 }, (_, index) => `many/module-${index}.ts`);
	const host = areaLauncher(areaCheckout(root, files));
	host.queue('large00001', 'History mentions ' + files.join(' '));
	await host.tick();
	expect(host.started()).toEqual(['large00001']);
	expect(host.brief('large00001')).toContain('only the first 512');
});

launchTest('an inferred overlap with a declared area warns and starts', async (root) => {
	const host = areaLauncher(areaCheckout(root, ['src/launcher/start.ts']));
	host.queue('aowner0001', 'Areas: src/launcher');
	host.queue('bguess0002', 'Look at src/launcher/start.ts first');
	await host.tick(3);
	expect(host.started()).toEqual(['aowner0001', 'bguess0002']);
	expect(host.brief('bguess0002')).toContain('Possible overlap');
	expect(host.brief('bguess0002')).toContain('aowner0001');
});

launchTest('an invalid declared path is ignored with a warning', async (root) => {
	const host = areaLauncher(areaCheckout(root));
	host.queue('badpath001', 'Areas: ../outside, src/launcher');
	await host.tick();
	expect(host.started()).toEqual(['badpath001']);
	expect(host.brief('badpath001')).toContain('Ignored invalid declared areas');
});

test.each([
	['has no hub link', undefined],
	[
		'cannot reach the hub',
		[
			{
				secret: fixtureSecret,
				transport: async () => Promise.reject(new Error('offline fixture'))
			}
		]
	]
])('a spoke that %s warns instead of holding', (_name, links) =>
	withTempDir('hnt-area-spoke-', async (root) => {
		const { permit, briefFor, commands, store } = spokeGuard(root, links);
		const start = {
			key: 'start-key',
			run: { item_id: 'spoke00001', auto_token: 'spoke00001', attempt: 1 }
		} as unknown as TrackerReservedStart;
		const item = { id: 'spoke00001', title: 'Areas: src/launcher', notes: '', project: 'Harness' };
		const decision = await permit(item as Parameters<typeof permit>[0], start);
		expect(decision.allowed).toBe(true);
		expect(briefFor(start)).toContain('declared areas were not checked or recorded');
		store.appendLocal({
			itemId: 'spoke00001',
			fields: { title: 'Synthetic', status: 'open', project: 'Harness' }
		});
		const claim = await commands.claim({
			id: 'spoke00001',
			areas: ['src/launcher'],
			session: 'a'.repeat(64)
		});
		expect(claim.allowed).toBe(false);
		expect(claim.reason).toContain('declared areas were not checked or recorded');
	})
);

test('a start with no recorded area check gets a warning brief instead of failing', () =>
	withTempDir('hnt-area-brief-', async (root) => {
		const { briefFor } = spokeGuard(root);
		const start = { key: 'unseen', run: { item_id: 'unseen0001' } } as TrackerReservedStart;
		expect(briefFor(start)).toContain('No area check is recorded for this start');
	}));

function spokeGuard(root: string, links?: unknown) {
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => database.close());
	const store = new TrackerPersistenceService(database, secondary);
	const options = {
		node: secondary,
		role: 'spoke',
		hostEffects: { launch: { repositories: { Harness: areaCheckout(root) } } },
		...(links ? { links } : {})
	} as unknown as TrackerNativeRuntimeOptions;
	return { ...trackerAreaDispatch(store, options), store };
}
