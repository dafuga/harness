import { expect, test } from 'vitest';
import { trackerHostLaunch } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch';
import {
	configuredLaunchRuntime,
	fixtureNow,
	launchFixtureItem,
	seedFailedRuns
} from '../../support/trackerLaunchConfigFixture';
import { withTempDir } from '../../support/temporary';

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
