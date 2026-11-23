import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const repository = vi.hoisted(() => ({ record: vi.fn(), close: vi.fn() }));

vi.mock('../../../../src/repositories/reports-media/AnalyticsRepository', () => ({
	AnalyticsRepository: vi.fn(() => repository)
}));

test('Seeds the analytics fixture store', async () => {
	const root = mkdtempSync(join(tmpdir(), 'analytics-e2e-example-'));
	const previousRoot = process.env.HARNESS_E2E_ROOT;
	const previousAnalytics = process.env.HARNESS_ANALYTICS_HOME;
	const state = 'seeds-the-analytics-fixture-store';
	const analytics = join(root, 'analytics');
	process.env.HARNESS_E2E_ROOT = root;
	process.env.HARNESS_ANALYTICS_HOME = analytics;
	try {
		const { seedAnalyticsE2e } = await import('../../db/seed-data/analytics-e2e');
		vi.clearAllMocks();
		const output = seedAnalyticsE2e();
		expect(output).toBeUndefined();
		expect(repository.record).toHaveBeenCalledTimes(11);
		expect(repository.close).toHaveBeenCalledOnce();
		expect(existsSync(analytics)).toBe(false);
		recordExampleCases(
			{
				unitId: 'reports.seeder.analytics-e2e',
				symbol: 'seedAnalyticsE2e',
				state,
				evidence: 'examples-cases',
				file: `${state}.json`
			},
			[
				{
					name: 'records all fixture events and closes the repository',
					input: { analytics },
					output: { returned: 'undefined', recordedEvents: 11, closed: true }
				}
			]
		);
	} finally {
		if (previousRoot === undefined) delete process.env.HARNESS_E2E_ROOT;
		else process.env.HARNESS_E2E_ROOT = previousRoot;
		if (previousAnalytics === undefined) delete process.env.HARNESS_ANALYTICS_HOME;
		else process.env.HARNESS_ANALYTICS_HOME = previousAnalytics;
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws NonTemporaryAnalyticsStoreError for unsafe analytics path', async () => {
	const root = mkdtempSync(join(tmpdir(), 'analytics-e2e-error-'));
	const previousRoot = process.env.HARNESS_E2E_ROOT;
	const previousAnalytics = process.env.HARNESS_ANALYTICS_HOME;
	const state = 'throws-nontemporaryanalyticsstoreerror-for-unsafe-analytics';
	process.env.HARNESS_E2E_ROOT = root;
	process.env.HARNESS_ANALYTICS_HOME = '/var/analytics-e2e-unsafe';
	try {
		vi.resetModules();
		const error = await import('../../db/seed-data/analytics-e2e').then(
			() => undefined,
			(reason: unknown) => reason
		);
		expect(error).toMatchObject({
			name: 'NonTemporaryAnalyticsStoreError',
			message: 'Fixture requires a temporary analytics store.'
		});
		recordExampleCases(
			{
				unitId: 'reports.seeder.analytics-e2e',
				symbol: 'seedAnalyticsE2e',
				state,
				evidence: 'examples-cases',
				file: `${state}.json`
			},
			[
				{
					name: 'rejects an analytics store outside approved temporary roots',
					input: { root, analytics: '/var/analytics-e2e-unsafe' },
					error: {
						name: 'NonTemporaryAnalyticsStoreError',
						message: 'Fixture requires a temporary analytics store.'
					}
				}
			]
		);
	} finally {
		if (previousRoot === undefined) delete process.env.HARNESS_E2E_ROOT;
		else process.env.HARNESS_E2E_ROOT = previousRoot;
		if (previousAnalytics === undefined) delete process.env.HARNESS_ANALYTICS_HOME;
		else process.env.HARNESS_ANALYTICS_HOME = previousAnalytics;
		rmSync(root, { recursive: true, force: true });
	}
});
