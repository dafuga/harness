import { expect, test } from 'vitest';
import { QueueEtaService } from '../../../src/services/execution-runtimes/QueueEtaService';
import { JobStatisticsService } from '../../../src/services/execution-runtimes/JobStatisticsService';

const records = Array.from({ length: 5 }, (_, i) => ({
	id: String(i),
	unit: 'a',
	source: 'r',
	attempt: 1,
	type: 'smell',
	model: 'luna',
	startedAt: 0,
	endedAt: 100000,
	durationMs: 100000,
	outcome: 'pass' as const
}));
test('estimate schedules queued and elapsed running jobs by model capacity', () => {
	const service = new QueueEtaService(new JobStatisticsService(records));
	const queued = Array.from({ length: 3 }, () => ({ type: 'smell', model: 'luna' }));
	const result = service.estimate(
		{ queued, running: [{ type: 'smell', model: 'luna', startedAt: 0 }], slots: { luna: 2 } },
		30000
	);
	expect(result).toMatchObject({ status: 'estimated', p50Ms: 200000, p90Ms: 200000 });
	expect(result.finish.p50).toContain('Europe/Lisbon');
	expect(service.estimate({ queued: [], running: [], slots: {} }, 0)).toMatchObject({
		status: 'empty',
		p50Ms: 0
	});
	expect(service.estimate({ queued, running: [], slots: { luna: 0 } }, 0)).toMatchObject({
		status: 'blocked',
		p50Ms: null
	});
	expect(
		service.estimate(
			{ queued: [{ type: 'unknown', model: 'other' }], running: [], slots: { other: 1 } },
			0
		).estimates[0].fallback
	).toBe('global');
	const none = new QueueEtaService(new JobStatisticsService([]));
	expect(none.estimate({ queued, running: [], slots: { luna: 2 } }, 0).status).toBe('unknown');
	expect(() => service.estimate({ queued, running: [], slots: { luna: -1 } }, 0)).toThrow();
	expect(
		service.estimate(
			{ queued: Array.from({ length: 1805 }, () => queued[0]), running: [], slots: { luna: 20 } },
			0
		).p50Ms
	).toBe(9100000);
});
