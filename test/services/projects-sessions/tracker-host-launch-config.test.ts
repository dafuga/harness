import { expect, test } from 'vitest';
import { trackerHostLaunch } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch';
import {
	configuredLaunchRuntime,
	fixtureNow,
	launchFixtureItem,
	seedFailedRuns
} from '../../support/trackerLaunchConfigFixture';
import { withTempDir } from '../../support/temporary';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';
import { trackerNodeApi } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeListeners';
import { TrackerSupervisorService } from '../../../src/services/projects-sessions/TrackerSupervisorService';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { recoverTrackerSession } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerSessionRecovery';
import { trackerRecoveryLaunch } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerSessionHealthRuntime';

const minute = 60_000;

test('a real launch learns from run history, as the pick preview does', () =>
	withTempDir('hnt-learn-', async (root) => {
		const fixture = configuredLaunchRuntime(root);
		try {
			seedFailedRuns(fixture.database, 'sonnet');
			expect(await launchFixtureItem(fixture, 'next200001')).toMatchObject({
				rung: 'opus',
				reason: expect.stringContaining('sonnet succeeded 0% on similar tasks')
			});
		} finally {
			fixture.database.close();
		}
	}));

test('configured learning, ladder, Claude window and default ETA reach the launch', () =>
	withTempDir('hnt-route-', async (root) => {
		const fixture = configuredLaunchRuntime(root, {
			launch: { defaultEtaMinutes: 30 },
			routing: {
				learning: { minSamples: 4 },
				claudeOnlyUntil: '2026-01-01T00:00:00Z',
				ladder: [{ id: 'sol', model: 'gpt-6.2-sol', effort: 'xhigh' }]
			}
		});
		try {
			seedFailedRuns(fixture.database, 'sol');
			expect(await launchFixtureItem(fixture, 'next200002')).toMatchObject({
				rung: 'sol',
				model: 'gpt-6.2-sol',
				reason: expect.not.stringContaining('succeeded'),
				eta_at: fixtureNow + 30 * minute
			});
			expect(fixture.options.ladderConfig).toMatchObject({
				autolaunch: { claudeOnlyUntil: '2026-01-01T00:00:00Z' }
			});
		} finally {
			fixture.database.close();
		}
	}));

test('an explicit provider in the native config reaches the actual launcher and its receipt', () =>
	withTempDir('hnt-provider-', async (root) => {
		const fixture = configuredLaunchRuntime(root, {
			routing: { preferredProvider: { provider: 'codex' } }
		});
		try {
			expect(await launchFixtureItem(fixture, 'next200004')).toMatchObject({
				model: 'gpt-6.2-sol',
				effort: 'medium',
				reason: expect.stringContaining('Codex preferred')
			});
			expect(() =>
				configuredLaunchRuntime(root, {
					routing: { preferredProvider: { provider: 'claude', until: 'tomorrow' } }
				})
			).toThrow();
		} finally {
			fixture.database.close();
		}
	}));

test('the Tracker provider command changes the running launcher and can clear its override', () =>
	withTempDir('hnt-provider-command-', async (root) => {
		const fixture = configuredLaunchRuntime(root);
		const { database, runtime } = fixture;
		const supervisor = new TrackerSupervisorService(runtime);
		async function command(...words: string[]) {
			const { request } = nativeTrackerArgs(['autolaunch', 'provider', ...words]);
			const response = await trackerNodeApi(
				new Request('http://tracker-fixture.invalid' + request.path, {
					method: request.method,
					body: request.body && JSON.stringify(request.body)
				}),
				runtime,
				supervisor,
				'synthetic-fence'
			);
			expect(response.ok).toBe(true);
			return response.json();
		}
		try {
			expect(await command()).toMatchObject({ setting: null, effective: 'claude' });
			expect(await command('codex')).toMatchObject({ setting: { provider: 'codex' } });
			expect(await launchFixtureItem(fixture, 'next200005')).toMatchObject({
				model: 'gpt-6.2-sol',
				reason: expect.stringContaining('Codex preferred')
			});
			expect(await command('default')).toMatchObject({ setting: null, effective: 'claude' });
		} finally {
			database.close();
		}
	}));

test('a fresh recovery uses the current preference when the previous provider is held', () =>
	withTempDir('hnt-provider-recovery-', async (root) => {
		const { database, runtime } = configuredLaunchRuntime(root, {
			routing: { preferredProvider: { provider: 'codex' } }
		});
		try {
			const itemId = 'recover001';
			runtime.store.appendLocal({
				itemId,
				fields: {
					title: 'Recover a missing export session',
					kind: 'task',
					status: 'in_progress',
					project: 'Harness'
				}
			});
			database
				.prepare(
					`INSERT INTO runs
				(item_id, auto_token, attempt, rung, cli, model, effort, queued_at, state)
				VALUES (?, 'old', 1, 'sonnet', 'claude', 'claude-sonnet-5-5', 'medium', 1, 'finished')`
				)
				.run(itemId);
			runtime.store.writeMeta({ autolaunch_quota_claude: '2026-11-25T13:00:00Z' });
			const item = new TrackerItemReadRepository(database).getStored(itemId);
			const message = await recoverTrackerSession(runtime.store, {
				item,
				launch: trackerRecoveryLaunch(runtime.dispatch)!,
				now: fixtureNow,
				ladderConfig: runtime.ladderConfig
			});
			expect(message).toContain('using gpt-6.2-sol');
			await runtime.scheduler!.tick(new AbortController().signal);
			expect(
				database
					.prepare('SELECT model, reason FROM runs WHERE item_id = ? ORDER BY id DESC')
					.get(itemId)
			).toMatchObject({ model: 'gpt-6.2-sol', reason: expect.stringContaining('Codex preferred') });
		} finally {
			database.close();
		}
	}));

test('configured run limits reach the dispatch policy', () =>
	withTempDir('hnt-limit-', async (root) => {
		const { database, runtime } = configuredLaunchRuntime(root);
		const limits = {
			maxRetries: 3,
			defaultEtaMinutes: 30,
			stallMinutes: 10,
			maxRunMinutes: 90
		};
		try {
			const config = { driver: `${root}/driver`, repositories: {}, ...limits };
			expect(trackerHostLaunch(runtime.store, config).policy).toMatchObject(limits);
			expect(() => configuredLaunchRuntime(root, { launch: { maxRetries: -1 } })).toThrow();
			expect(() => configuredLaunchRuntime(root, { launch: { stallMinutes: 0 } })).toThrow();
		} finally {
			database.close();
		}
	}));

test('a higher configured sample minimum keeps the first rung', () =>
	withTempDir('hnt-sample-', async (root) => {
		const fixture = configuredLaunchRuntime(root, { routing: { learning: { minSamples: 4 } } });
		try {
			seedFailedRuns(fixture.database, 'sonnet');
			expect(await launchFixtureItem(fixture, 'next200003')).toMatchObject({ rung: 'sonnet' });
		} finally {
			fixture.database.close();
		}
	}));
