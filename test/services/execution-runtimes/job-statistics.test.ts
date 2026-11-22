import { expect, test } from 'vitest';
import { JobStatisticsService } from '../../../src/services/execution-runtimes/JobStatisticsService';

const records = [10, 20, 30, 40, 50].map((durationMs, i) => ({
	id: String(i),
	unit: 'a',
	source: 'r',
	attempt: 1,
	type: 'smell',
	model: 'luna',
	startedAt: 0,
	endedAt: durationMs,
	durationMs,
	outcome: 'pass' as const
}));
test('summary and estimation expose distribution, sample counts and ordered fallbacks', () => {
	const stats = new JobStatisticsService(records);
	expect(stats.summary()[0]).toMatchObject({
		count: 5,
		meanMs: 30,
		medianMs: 30,
		p80Ms: 40,
		p90Ms: 50
	});
	expect(stats.estimate('smell', 'luna')).toMatchObject({ fallback: 'exact', count: 5 });
	expect(stats.estimate('stub', 'luna')).toMatchObject({ fallback: 'model', count: 5 });
	expect(stats.estimate('smell', 'haiku')).toMatchObject({ fallback: 'type', count: 5 });
	expect(stats.estimate('contract', 'haiku')).toMatchObject({ fallback: 'global', count: 5 });
	expect(new JobStatisticsService([]).estimate('smell', 'luna')).toBeNull();
	expect(new JobStatisticsService(records.slice(0, 1)).estimate('smell', 'luna')).toMatchObject({
		fallback: 'global',
		count: 1
	});
	expect(new JobStatisticsService([{ ...records[0], outcome: 'cancelled' }]).summary()).toEqual([]);
	expect(stats.estimate('smell', 'luna', 35)).toMatchObject({
		medianMs: 10,
		p90Ms: 15,
		conditionalCount: 2
	});
	expect(stats.estimate('smell', 'luna', 100)?.medianMs).toBeGreaterThan(0);
});
